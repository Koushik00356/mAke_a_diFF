package com.firstdiff.dto;

import java.util.List;

/** Every knob a user can turn when searching issues. */
public record IssueFilters(
        List<String> labels,        // multi-select; each runs its own search, merged (max 6)
        String language,            // any GitHub language string, optional
        boolean unassignedOnly,     // no:assignee
        Integer maxComments,        // e.g. 0 = completely unclaimed, 5 = low-noise
        Integer minReactions,       // community-validated issues
        Integer maxAgeDays,         // only issues updated within N days (0 = any)
        Integer createdWithinDays,  // only issues opened within N days (0 = any)
        String sort,                // updated | created | comments | reactions
        String order,               // asc | desc
        int perLabel                // results fetched per label (1-50)
) {}
