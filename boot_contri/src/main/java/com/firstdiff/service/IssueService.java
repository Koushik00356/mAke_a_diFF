package com.firstdiff.service;

import com.firstdiff.dto.IssueFilters;
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
public class IssueService {

    private static final Logger log = LoggerFactory.getLogger(IssueService.class);
    private static final int MAX_LABELS = 6;

    private final GitHubClient github;

    public IssueService(GitHubClient github) {
        this.github = github;
    }

    /** Partial results (some label searches failed) are returned but never cached. */
    @Cacheable(value = "search", key = "'issues:' + #f.toString()", unless = "#result['partial'] == true")
    public Map<String, Object> search(IssueFilters f) {
        // this body only runs on a cache miss: a repeated search logs nothing here
        log.info("cache MISS (search) -> calling GitHub: {}", f);

        List<String> labels = f.labels().stream()
                .map(l -> l.replace("\"", "").trim())
                .filter(l -> !l.isEmpty())
                .distinct()
                .limit(MAX_LABELS)
                .toList();
        if (labels.isEmpty()) labels = List.of("good first issue");

        FanOut.Result r = FanOut.run(labels, label -> fetchForLabel(label, f));
        List<Map<String, Object>> items = r.items();

        // post-filters GitHub's query language can't express precisely
        if (f.maxAgeDays() != null && f.maxAgeDays() > 0) {
            Instant cutoff = Instant.now().minus(f.maxAgeDays(), ChronoUnit.DAYS);
            items.removeIf(i -> Instant.parse((String) i.get("updated_at")).isBefore(cutoff));
        }
        if (f.minReactions() != null && f.minReactions() > 0) {
            items.removeIf(i -> reactionCount(i) < f.minReactions());
        }

        sortItems(items, f.sort(), f.order());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", items.size());
        out.put("github_matches", r.matched()); // summed per label, before de-duplication
        out.put("labels_searched", labels);
        out.put("labels_failed", r.failed());
        out.put("partial", !r.failed().isEmpty());
        out.put("items", items);
        return out;
    }

    private Map<String, Object> fetchForLabel(String label, IssueFilters f) {
        StringBuilder q = new StringBuilder();
        if (f.keyword() != null && !f.keyword().isBlank())
            q.append(f.keyword().trim()).append(" in:title,body ");
        q.append("label:\"").append(label).append("\" state:open is:issue");
        if (f.language() != null && !f.language().isBlank())
            q.append(" language:\"").append(f.language().replace("\"", "").trim()).append('"');
        if (f.unassignedOnly()) q.append(" no:assignee");
        if (f.maxComments() != null && f.maxComments() >= 0)
            q.append(" comments:<=").append(f.maxComments());
        if (f.createdWithinDays() != null && f.createdWithinDays() > 0)
            q.append(" created:>=").append(
                    Instant.now().minus(f.createdWithinDays(), ChronoUnit.DAYS)
                            .toString().substring(0, 10));

        String query = q.toString();
        return github.get(u -> u.path("/search/issues")
                .queryParam("q", "{q}")
                .queryParam("sort", "{sort}")
                .queryParam("order", "asc".equals(f.order()) ? "asc" : "desc")
                .queryParam("per_page", Math.min(Math.max(f.perLabel(), 1), 50))
                .build(query, apiSort(f.sort())));
    }

    private static String apiSort(String sort) {
        // GitHub's API accepts these sort values; "reactions" needs the long form
        return switch (sort == null ? "" : sort) {
            case "reactions" -> "reactions-+1";
            case "created", "comments" -> sort;
            default -> "updated";
        };
    }

    @SuppressWarnings("unchecked")
    private static int reactionCount(Map<String, Object> issue) {
        Map<String, Object> r = (Map<String, Object>) issue.get("reactions");
        return r == null ? 0 : ((Number) r.getOrDefault("total_count", 0)).intValue();
    }

    private static void sortItems(List<Map<String, Object>> items, String sort, String order) {
        Comparator<Map<String, Object>> cmp = switch (sort == null ? "" : sort) {
            case "created" -> Comparator.comparing(i -> Instant.parse((String) i.get("created_at")));
            case "comments" -> Comparator.comparingInt(i -> ((Number) i.getOrDefault("comments", 0)).intValue());
            case "reactions" -> Comparator.comparingInt(IssueService::reactionCount);
            default -> Comparator.comparing(i -> Instant.parse((String) i.get("updated_at")));
        };
        if (!"asc".equals(order)) cmp = cmp.reversed();
        items.sort(cmp);
    }
}
