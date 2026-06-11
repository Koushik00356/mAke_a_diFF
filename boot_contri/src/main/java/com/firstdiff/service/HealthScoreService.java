package com.firstdiff.service;

import com.firstdiff.github.GitHubClient;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The feature aggregator sites don't have: "will a maintainer actually
 * look at my PR?" Computed from the repo's 30 most recently closed PRs:
 *
 *  - merge rate:        merged / closed (are outside PRs accepted?)
 *  - median close time: how long until a PR gets resolved
 *  - recency:           last push
 *
 * Costs ~2 GitHub calls per repo, so results are cached for 3 hours.
 */
@Service
public class HealthScoreService {

    private final GitHubClient github;

    public HealthScoreService(GitHubClient github) {
        this.github = github;
    }

    @Cacheable(value = "health", key = "#owner + '/' + #repo")
    public Map<String, Object> score(String owner, String repo) {
        Map<String, Object> repoData = github.get(u -> u.path("/repos/{o}/{r}").build(owner, repo));

        List<Map<String, Object>> prs = github.getList(u -> u.path("/repos/{o}/{r}/pulls")
                .queryParam("state", "closed")
                .queryParam("sort", "updated")
                .queryParam("direction", "desc")
                .queryParam("per_page", 30)
                .build(owner, repo));

        int closed = 0, mergedCount = 0;
        List<Long> closeHours = new ArrayList<>();
        if (prs != null) {
            for (Map<String, Object> pr : prs) {
                closed++;
                if (pr.get("merged_at") != null) mergedCount++;
                Object createdAt = pr.get("created_at");
                Object closedAt = pr.get("closed_at");
                if (createdAt != null && closedAt != null) {
                    closeHours.add(Duration.between(
                            Instant.parse((String) createdAt),
                            Instant.parse((String) closedAt)).toHours());
                }
            }
        }

        double mergeRate = closed == 0 ? 0 : (double) mergedCount / closed;
        long medianCloseHours = median(closeHours);
        long daysSincePush = Duration.between(
                Instant.parse((String) repoData.get("pushed_at")), Instant.now()).toDays();

        // 0-100 composite: 40% merge rate, 40% speed, 20% recency
        double speedScore = medianCloseHours <= 0 ? 0.5
                : Math.max(0, Math.min(1, 1.0 - (medianCloseHours / (14.0 * 24)))); // 2 weeks -> 0
        double recencyScore = Math.max(0, Math.min(1, 1.0 - (daysSincePush / 90.0))); // 90d -> 0
        int composite = (int) Math.round(100 * (0.4 * mergeRate + 0.4 * speedScore + 0.2 * recencyScore));

        String verdict = composite >= 70 ? "welcoming - PRs get reviewed and merged quickly"
                : composite >= 40 ? "moderate - expect some waiting"
                : "slow - PRs may sit for a long time";

        return Map.of(
                "repo", owner + "/" + repo,
                "score", composite,
                "verdict", verdict,
                "merge_rate", Math.round(mergeRate * 100) + "%",
                "median_pr_close_hours", medianCloseHours,
                "days_since_last_push", daysSincePush,
                "sample_size", closed,
                "stars", repoData.get("stargazers_count"),
                "open_issues", repoData.get("open_issues_count")
        );
    }

    private static long median(List<Long> xs) {
        if (xs.isEmpty()) return -1;
        var sorted = xs.stream().sorted().toList();
        int n = sorted.size();
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2;
    }
}
