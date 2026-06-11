package com.firstdiff.dto;

import java.util.List;

/** Every knob a user can turn when searching repositories. */
public record RepoFilters(
        List<String> topics,         // multi-select, merged (max 4)
        String language,             // optional
        Integer minStars,            // project size lower bound
        Integer maxStars,            // project size upper bound (0 = unbounded)
        Integer minGoodFirstIssues,  // repos with at least N open "good first issue" labels
        Integer minHelpWantedIssues, // repos with at least N open "help wanted" labels
        Integer pushedWithinDays,    // only repos pushed to within N days (0 = any)
        String license,              // e.g. mit, apache-2.0 (optional)
        boolean excludeForks,        // skip forked repos
        String sort,                 // stars | updated | forks | help-wanted-issues
        String order                 // asc (small -> big) | desc
) {}
