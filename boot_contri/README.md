# FirstDiff Backend

Spring Boot proxy API for FirstDiff — find beginner-friendly open source issues
and repos, with caching, a GitHub token kept safely server-side, and a repo
health score no aggregator site offers.

## Requirements

- Java 21 (uses virtual threads)
- Maven 3.9+ (or use the IDE's bundled Maven)
- Optional but recommended: a GitHub fine-grained personal access token
  (no scopes/permissions needed — public data only)

## Run

```bash
# with a token (30 searches/min, 5000 core calls/hr)
export GH_TOKEN=github_pat_xxxxx        # Windows: set GH_TOKEN=...
mvn spring-boot:run

# without a token also works (10 searches/min, 60 core calls/hr)
mvn spring-boot:run
```

Server starts on http://localhost:8080.

## Endpoints

### GET /api/issues — search beginner issues

Each label runs its own parallel GitHub search (virtual threads); results are
merged and deduplicated, which is how multiple labels give MORE results
(OR semantics) instead of fewer (GitHub's native AND).

| param | default | meaning |
|---|---|---|
| `labels` | good first issue | repeatable, max 6 — e.g. `&labels=help wanted&labels=easy` |
| `language` | (any) | any GitHub language string |
| `unassignedOnly` | true | only issues nobody has claimed |
| `maxComments` | (off) | `0` = completely untouched issues |
| `minReactions` | (off) | community-validated issues only |
| `maxAgeDays` | 0 (any) | only issues updated within N days |
| `createdWithinDays` | 0 (any) | only issues opened within N days |
| `sort` | updated | `updated` \| `created` \| `comments` \| `reactions` |
| `order` | desc | `asc` \| `desc` |
| `perLabel` | 20 | results fetched per label, 1–50 |

Example — fresh, unclaimed, zero-comment Python issues across 3 labels:
```
/api/issues?labels=good first issue&labels=help wanted&labels=easy&language=Python&maxComments=0&maxAgeDays=14
```

### GET /api/repos — search welcoming repositories

| param | default | meaning |
|---|---|---|
| `topics` | good-first-issue | repeatable, max 4 — e.g. `first-timers-only`, `hacktoberfest` |
| `language` | (any) | |
| `minStars` / `maxStars` | (off) | project size range — browse small → big |
| `minGoodFirstIssues` | (off) | repos with ≥N OPEN "good first issue" labels right now |
| `minHelpWantedIssues` | (off) | same for "help wanted" |
| `pushedWithinDays` | 0 (any) | only actively developed repos |
| `license` | (off) | e.g. `mit`, `apache-2.0` |
| `excludeForks` | true | skip forked copies |
| `sort` | stars | `stars` \| `updated` \| `forks` \| `help-wanted-issues` |
| `order` | desc | `asc` = small → big |

`minGoodFirstIssues` is the killer filter: GitHub's `good-first-issues:>=N`
qualifier finds repos that have open beginner issues *right now*, not just a
welcoming topic tag.

Example — small active Python repos with real beginner issues, small → big:
```
/api/repos?topics=good-first-issue&topics=first-timers-only&language=Python&minStars=50&maxStars=2000&minGoodFirstIssues=3&pushedWithinDays=30&sort=stars&order=asc
```

### GET /api/health/{owner}/{repo} — maintainer responsiveness score

Computes from the 30 most recently closed PRs:
- merge rate (are outside contributions accepted?)
- median PR close time
- days since last push

Returns a 0–100 score and a plain-language verdict. Cached 3 hours
(costs 2 GitHub calls per uncached repo).

```
/api/health/fastapi/fastapi
```

## Caching

Caffeine in-memory: search results 30 min, health scores 3 h
(tune in `application.properties`). 100 users running the same search
costs 1 GitHub call.

## Connecting the React frontend

In the FirstDiff frontend, change the `gh()` helper's base URL from
`https://api.github.com/search/...` to `http://localhost:8080/api/...`
and map your filter state to the query params above. The multi-label
merge logic can then be deleted from the frontend — the backend does it.

`firstdiff.cors.origins` in `application.properties` already allows
localhost:5173 (Vite) and localhost:3000. Add your deployed frontend
origin there before going live.

## Deploying

Any Java host works: Railway, Render, Fly.io, or a ₹300/mo VPS.
Set `GH_TOKEN` as an environment variable in the host's dashboard —
never commit it.

## Roadmap ideas

- GitHub OAuth login → personalized recommendations from the user's repos
- Persist saved issues per user (MongoDB + Spring Data)
- Webhook/polling-based "issue claimed" notifications
- Batch health scores for search results (background warming)
