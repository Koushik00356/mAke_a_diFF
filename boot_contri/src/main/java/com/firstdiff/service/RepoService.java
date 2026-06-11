package com.firstdiff.service;

import com.firstdiff.dto.RepoFilters;
import com.firstdiff.github.GitHubClient;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class RepoService {

    private static final int MAX_TOPICS = 4;
    private final GitHubClient github;
    private final ExecutorService vt = Executors.newVirtualThreadPerTaskExecutor();

    public RepoService(GitHubClient github) {
        this.github = github;
    }

    @Cacheable(value = "search", key = "'repos:' + #f.toString()")
    public Map<String, Object> search(RepoFilters f) {
        List<String> topics = f.topics().stream().limit(MAX_TOPICS).toList();

        List<CompletableFuture<List<Map<String, Object>>>> futures = topics.stream()
                .map(topic -> CompletableFuture.supplyAsync(() -> fetchForTopic(topic, f), vt)
                        .exceptionally(ex -> List.of()))
                .toList();

        CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();

        Map<Object, Map<String, Object>> merged = new LinkedHashMap<>();
        for (var fut : futures) {
            for (Map<String, Object> repo : fut.join()) {
                merged.putIfAbsent(repo.get("id"), repo);
            }
        }

        List<Map<String, Object>> items = new ArrayList<>(merged.values());

        if (f.pushedWithinDays() != null && f.pushedWithinDays() > 0) {
            Instant cutoff = Instant.now().minus(f.pushedWithinDays(), ChronoUnit.DAYS);
            items.removeIf(r -> Instant.parse((String) r.get("pushed_at")).isBefore(cutoff));
        }

        sortItems(items, f.sort(), f.order());

        return Map.of(
                "total", items.size(),
                "topics_searched", topics,
                "items", items
        );
    }

    private List<Map<String, Object>> fetchForTopic(String topic, RepoFilters f) {
        StringBuilder q = new StringBuilder("topic:").append(topic).append(" archived:false");
        if (f.language() != null && !f.language().isBlank())
            q.append(" language:\"").append(f.language()).append('"');

        // project size: stars range, supports small -> big browsing
        int min = f.minStars() == null ? 0 : f.minStars();
        int max = f.maxStars() == null ? 0 : f.maxStars();
        if (min > 0 && max > 0) q.append(" stars:").append(min).append("..").append(max);
        else if (min > 0) q.append(" stars:>=").append(min);
        else if (max > 0) q.append(" stars:<=").append(max);

        // these two qualifiers are the gems for this use case:
        // they find repos that ACTUALLY have open beginner issues right now
        if (f.minGoodFirstIssues() != null && f.minGoodFirstIssues() > 0)
            q.append(" good-first-issues:>=").append(f.minGoodFirstIssues());
        if (f.minHelpWantedIssues() != null && f.minHelpWantedIssues() > 0)
            q.append(" help-wanted-issues:>=").append(f.minHelpWantedIssues());

        if (f.license() != null && !f.license().isBlank())
            q.append(" license:").append(f.license());
        if (f.excludeForks()) q.append(" fork:false");

        String query = q.toString();
        Map<String, Object> body = github.get(u -> u.path("/search/repositories")
                .queryParam("q", query)
                .queryParam("sort", f.sort())
                .queryParam("order", f.order())
                .queryParam("per_page", 25)
                .build());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        return items;
    }

    private static void sortItems(List<Map<String, Object>> items, String sort, String order) {
        Comparator<Map<String, Object>> cmp = switch (sort) {
            case "updated" -> Comparator.comparing(r -> Instant.parse((String) r.get("pushed_at")));
            case "forks" -> Comparator.comparingInt(r -> ((Number) r.getOrDefault("forks_count", 0)).intValue());
            case "help-wanted-issues" -> Comparator.comparingInt(r -> ((Number) r.getOrDefault("open_issues_count", 0)).intValue());
            default -> Comparator.comparingInt(r -> ((Number) r.getOrDefault("stargazers_count", 0)).intValue());
        };
        if (!"asc".equals(order)) cmp = cmp.reversed();
        items.sort(cmp);
    }
}
