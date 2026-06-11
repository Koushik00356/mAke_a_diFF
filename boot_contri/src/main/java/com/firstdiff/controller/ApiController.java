package com.firstdiff.controller;

import com.firstdiff.dto.IssueFilters;
import com.firstdiff.dto.RepoFilters;
import com.firstdiff.service.HealthScoreService;
import com.firstdiff.service.IssueService;
import com.firstdiff.service.RepoService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {

    private final IssueService issues;
    private final RepoService repos;
    private final HealthScoreService health;

    public ApiController(IssueService issues, RepoService repos, HealthScoreService health) {
        this.issues = issues;
        this.repos = repos;
        this.health = health;
    }

    /**
     * GET /api/issues
     * Example:
     *   /api/issues?labels=good first issue&labels=help wanted&language=Python
     *     &unassignedOnly=true&maxComments=0&maxAgeDays=30&sort=updated&order=desc&perLabel=20
     */
    @GetMapping("/issues")
    public Map<String, Object> searchIssues(
            @RequestParam(defaultValue = "good first issue") List<String> labels,
            @RequestParam(required = false) String language,
            @RequestParam(defaultValue = "true") boolean unassignedOnly,
            @RequestParam(required = false) Integer maxComments,
            @RequestParam(required = false) Integer minReactions,
            @RequestParam(defaultValue = "0") Integer maxAgeDays,
            @RequestParam(defaultValue = "0") Integer createdWithinDays,
            @RequestParam(defaultValue = "updated") String sort,
            @RequestParam(defaultValue = "desc") String order,
            @RequestParam(defaultValue = "20") int perLabel) {
        return issues.search(new IssueFilters(labels, language, unassignedOnly, maxComments,
                minReactions, maxAgeDays, createdWithinDays, sort, order, perLabel));
    }

    /**
     * GET /api/repos
     * Example (small, genuinely beginner-welcoming Python projects, small -> big):
     *   /api/repos?topics=good-first-issue&topics=first-timers-only&language=Python
     *     &minStars=50&maxStars=2000&minGoodFirstIssues=3&pushedWithinDays=30
     *     &excludeForks=true&sort=stars&order=asc
     */
    @GetMapping("/repos")
    public Map<String, Object> searchRepos(
            @RequestParam(defaultValue = "good-first-issue") List<String> topics,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) Integer minStars,
            @RequestParam(required = false) Integer maxStars,
            @RequestParam(required = false) Integer minGoodFirstIssues,
            @RequestParam(required = false) Integer minHelpWantedIssues,
            @RequestParam(defaultValue = "0") Integer pushedWithinDays,
            @RequestParam(required = false) String license,
            @RequestParam(defaultValue = "true") boolean excludeForks,
            @RequestParam(defaultValue = "stars") String sort,
            @RequestParam(defaultValue = "desc") String order) {
        return repos.search(new RepoFilters(topics, language, minStars, maxStars,
                minGoodFirstIssues, minHelpWantedIssues, pushedWithinDays, license,
                excludeForks, sort, order));
    }

    /**
     * GET /api/health/{owner}/{repo}
     * The differentiator: maintainer responsiveness score from recent PR history.
     */
    @GetMapping("/health/{owner}/{repo}")
    public Map<String, Object> repoHealth(@PathVariable String owner, @PathVariable String repo) {
        return health.score(owner, repo);
    }
}
