package com.firstdiff.service;

import com.firstdiff.dto.IssueFilters;
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
public class IssueService {

    private static final int MAX_LABELS = 6;
    private final GitHubClient github;
    // virtual threads: thousands of cheap blocking calls, perfect for API fan-out
    private final ExecutorService vt = Executors.newVirtualThreadPerTaskExecutor();

    public IssueService(GitHubClient github) {
        this.github = github;
    }

    @Cacheable(value = "search", key = "'issues:' + #f.toString()")
    public Map<String, Object> search(IssueFilters f) {
        List<String> labels = f.labels().stream().limit(MAX_LABELS).toList();

        // one GitHub search per label, in parallel
        List<CompletableFuture<List<Map<String, Object>>>> futures = labels.stream()
                .map(label -> CompletableFuture.supplyAsync(() -> fetchForLabel(label, f), vt)
                        .exceptionally(ex -> List.of())) // a failed label search degrades, not breaks
                .toList();

        CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).join();

        // merge + dedupe by issue id
        Map<Object, Map<String, Object>> merged = new LinkedHashMap<>();
        for (var fut : futures) {
            for (Map<String, Object> issue : fut.join()) {
                merged.putIfAbsent(issue.get("id"), issue);
            }
        }

        List<Map<String, Object>> items = new ArrayList<>(merged.values());

        // post-filters GitHub's query language can't express precisely
        if (f.maxAgeDays() != null && f.maxAgeDays() > 0) {
            Instant cutoff = Instant.now().minus(f.maxAgeDays(), ChronoUnit.DAYS);
            items.removeIf(i -> Instant.parse((String) i.get("updated_at")).isBefore(cutoff));
        }
        if (f.minReactions() != null && f.minReactions() > 0) {
            items.removeIf(i -> reactionCount(i) < f.minReactions());
        }

        sortItems(items, f.sort(), f.order());

        return Map.of(
                "total", items.size(),
                "labels_searched", labels,
                "items", items
        );
    }

    private List<Map<String, Object>> fetchForLabel(String label, IssueFilters f) {
        StringBuilder q = new StringBuilder("label:\"").append(label).append("\" state:open is:issue");
        if (f.language() != null && !f.language().isBlank())
            q.append(" language:\"").append(f.language()).append('"');
        if (f.unassignedOnly()) q.append(" no:assignee");
        if (f.maxComments() != null && f.maxComments() >= 0)
            q.append(" comments:<=").append(f.maxComments());
        if (f.createdWithinDays() != null && f.createdWithinDays() > 0)
            q.append(" created:>=").append(
                    Instant.now().minus(f.createdWithinDays(), ChronoUnit.DAYS)
                            .toString().substring(0, 10));

        String query = q.toString();
        Map<String, Object> body = github.get(u -> u.path("/search/issues")
                .queryParam("q", query)
                .queryParam("sort", apiSort(f.sort()))
                .queryParam("order", f.order())
                .queryParam("per_page", Math.min(Math.max(f.perLabel(), 1), 50))
                .build());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.getOrDefault("items", List.of());
        return items;
    }

    private static String apiSort(String sort) {
        // GitHub's API accepts these sort values; "reactions" needs the long form
        return switch (sort) {
            case "reactions" -> "reactions-+1";
            case "created", "comments", "updated" -> sort;
            default -> "updated";
        };
    }

    @SuppressWarnings("unchecked")
    private static int reactionCount(Map<String, Object> issue) {
        Map<String, Object> r = (Map<String, Object>) issue.get("reactions");
        return r == null ? 0 : ((Number) r.getOrDefault("total_count", 0)).intValue();
    }

    private static void sortItems(List<Map<String, Object>> items, String sort, String order) {
        Comparator<Map<String, Object>> cmp = switch (sort) {
            case "created" -> Comparator.comparing(i -> Instant.parse((String) i.get("created_at")));
            case "comments" -> Comparator.comparingInt(i -> ((Number) i.getOrDefault("comments", 0)).intValue());
            case "reactions" -> Comparator.comparingInt(IssueService::reactionCount);
            default -> Comparator.comparing(i -> Instant.parse((String) i.get("updated_at")));
        };
        if (!"asc".equals(order)) cmp = cmp.reversed();
        items.sort(cmp);
    }
}
