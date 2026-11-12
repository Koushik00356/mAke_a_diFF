package com.firstdiff.service;

import com.firstdiff.dto.RepoFilters;
import com.firstdiff.github.GitHubClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class RepoService {

    private static final Logger log = LoggerFactory.getLogger(RepoService.class);
    private static final int MAX_TOPICS = 4;

    private final GitHubClient github;

    public RepoService(GitHubClient github) {
        this.github = github;
    }

    /** Partial results (some topic searches failed) are returned but never cached. */
    @Cacheable(value = "search", key = "'repos:' + #f.toString()", unless = "#result['partial'] == true")
    public Map<String, Object> search(RepoFilters f) {
        log.info("cache MISS (search) -> calling GitHub: {}", f);

        List<String> topics = f.topics().stream()
                .map(t -> t.trim().toLowerCase().replaceAll("[^a-z0-9-]", "-"))
                .filter(t -> !t.isEmpty())
                .distinct()
                .limit(MAX_TOPICS)
                .toList();
        if (topics.isEmpty()) topics = List.of("good-first-issue");

        FanOut.Result r = FanOut.run(topics, topic -> fetchForTopic(topic, f));
        List<Map<String, Object>> items = r.items();

        if (f.pushedWithinDays() != null && f.pushedWithinDays() > 0) {
            Instant cutoff = Instant.now().minus(f.pushedWithinDays(), ChronoUnit.DAYS);
            items.removeIf(x -> Instant.parse((String) x.get("pushed_at")).isBefore(cutoff));
        }

        sortItems(items, f.sort(), f.order());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", items.size());
        out.put("github_matches", r.matched()); // summed per topic, before de-duplication
        out.put("topics_searched", topics);
        out.put("topics_failed", r.failed());
        out.put("partial", !r.failed().isEmpty());
        out.put("items", items);
        return out;
    }

    /** Single repo detail, for the issue card's expanded view. */
    @Cacheable(value = "health", key = "'repo:' + #owner + '/' + #repo")
    public Map<String, Object> detail(String owner, String repo) {
        log.info("cache MISS (repo) -> calling GitHub: {}/{}", owner, repo);
        return github.get(u -> u.path("/repos/{o}/{r}").build(owner, repo));
    }

    private Map<String, Object> fetchForTopic(String topic, RepoFilters f) {
        StringBuilder q = new StringBuilder();
        if (f.keyword() != null && !f.keyword().isBlank())
            q.append(f.keyword().trim()).append(" in:name,description ");
        q.append("topic:").append(topic).append(" archived:false");
        if (f.language() != null && !f.language().isBlank())
            q.append(" language:\"").append(f.language().replace("\"", "").trim()).append('"');

        // project size: stars range, supports small -> big browsing
        int min = f.minStars() == null ? 0 : f.minStars();
        int max = f.maxStars() == null ? 0 : f.maxStars();
        if (min > 0 && max > 0) q.append(" stars:").append(min).append("..").append(max);
        else if (min > 0) q.append(" stars:>=").append(min);
        else if (max > 0) q.append(" stars:<=").append(max);

        // these two qualifiers find repos that ACTUALLY have open beginner issues right now
        if (f.minGoodFirstIssues() != null && f.minGoodFirstIssues() > 0)
            q.append(" good-first-issues:>=").append(f.minGoodFirstIssues());
        if (f.minHelpWantedIssues() != null && f.minHelpWantedIssues() > 0)
            q.append(" help-wanted-issues:>=").append(f.minHelpWantedIssues());

        if (f.license() != null && !f.license().isBlank())
            q.append(" license:").append(f.license().trim().replaceAll("\\s+", "-"));
        if (f.excludeForks()) q.append(" fork:false");

        String query = q.toString();
        return github.get(u -> u.path("/search/repositories")
                .queryParam("q", "{q}")
                .queryParam("sort", apiSort(f.sort()))
                .queryParam("order", "asc".equals(f.order()) ? "asc" : "desc")
                .queryParam("per_page", 25)
                .build(query));
    }

    private static String apiSort(String sort) {
        return switch (sort == null ? "" : sort) {
            case "updated", "forks", "help-wanted-issues" -> sort;
            default -> "stars";
        };
    }

    private static void sortItems(List<Map<String, Object>> items, String sort, String order) {
        Comparator<Map<String, Object>> cmp = switch (sort == null ? "" : sort) {
            case "updated" -> Comparator.comparing(x -> Instant.parse((String) x.get("pushed_at")));
            case "forks" -> Comparator.comparingInt(x -> ((Number) x.getOrDefault("forks_count", 0)).intValue());
            case "help-wanted-issues" -> Comparator.comparingInt(x -> ((Number) x.getOrDefault("open_issues_count", 0)).intValue());
            default -> Comparator.comparingInt(x -> ((Number) x.getOrDefault("stargazers_count", 0)).intValue());
        };
        if (!"asc".equals(order)) cmp = cmp.reversed();
        items.sort(cmp);
    }
}
