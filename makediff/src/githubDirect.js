// Standalone-demo path: talks to api.github.com unauthenticated, straight from
// the browser. Only loaded when the build sets VITE_DIRECT_GITHUB=true.
// In the normal build the Spring backend owns all of this (fan-out, merge,
// de-dupe, health scoring) and this module is never fetched.
import { ApiError, slimIssue, slimRepo } from "./api.js";

const GH = "https://api.github.com";
const HEADERS = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };

async function gh(path) {
  let res;
  try {
    res = await fetch(GH + path, { headers: HEADERS });
  } catch {
    throw new ApiError("Can't reach GitHub.", 0);
  }
  if (res.status === 403 || res.status === 429)
    throw new ApiError("GitHub rate limit reached. Unauthenticated demo mode gets 10 searches a minute.", 429);
  if (res.status === 422) throw new ApiError("Filter too narrow - GitHub rejected this combination.", 422);
  if (res.status === 404) throw new ApiError("Not found on GitHub.", 404);
  if (!res.ok) throw new ApiError(`GitHub returned ${res.status}.`, 502);
  return res.json();
}

const daysAgoIso = (d) => new Date(Date.now() - d * 864e5).toISOString();
const clamp = (x) => Math.max(0, Math.min(1, x));

// one search per value, in parallel; merge + de-dupe by id; partial failures tolerated
async function fanOut(values, buildPath) {
  const settled = await Promise.allSettled(values.map((v) => gh(buildPath(v))));
  const merged = new Map();
  const failed = [];
  let matches = 0;
  let firstError = null;
  settled.forEach((s, i) => {
    if (s.status === "rejected") {
      failed.push(values[i]);
      firstError = firstError || s.reason;
      return;
    }
    matches += s.value.total_count || 0;
    for (const item of s.value.items || []) if (!merged.has(item.id)) merged.set(item.id, item);
  });
  if (failed.length === values.length) throw firstError;
  return { items: [...merged.values()], failed, matches };
}

export async function searchIssues(f) {
  const labels = f.labels.slice(0, 6);
  const sort = f.sort === "reactions" ? "reactions-+1" : f.sort;
  const { items, failed, matches } = await fanOut(labels, (label) => {
    let q = f.keyword ? `${f.keyword} in:title,body ` : "";
    q += `label:"${label}" state:open is:issue`;
    if (f.language) q += ` language:"${f.language}"`;
    if (f.unassignedOnly) q += " no:assignee";
    if (f.maxComments !== "") q += ` comments:<=${f.maxComments}`;
    if (f.createdWithinDays) q += ` created:>=${daysAgoIso(f.createdWithinDays).slice(0, 10)}`;
    return `/search/issues?q=${encodeURIComponent(q)}&sort=${encodeURIComponent(sort)}&order=${f.order}&per_page=${f.perLabel}`;
  });

  let out = items.map(slimIssue);
  if (f.maxAgeDays) out = out.filter((i) => i.updated_at >= daysAgoIso(f.maxAgeDays));
  if (f.minReactions) out = out.filter((i) => i.reactions >= f.minReactions);
  const key = { created: "created_at", comments: "comments", reactions: "reactions" }[f.sort] || "updated_at";
  const dir = f.order === "asc" ? 1 : -1;
  out.sort((a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0));
  return { items: out, total: out.length, matches, searched: labels, failed };
}

export async function searchRepos(f) {
  const topics = f.topics.slice(0, 4);
  const { items, failed, matches } = await fanOut(topics, (topic) => {
    let q = f.keyword ? `${f.keyword} in:name,description ` : "";
    q += `topic:${topic} archived:false`;
    if (f.language) q += ` language:"${f.language}"`;
    if (f.minStars && f.maxStars) q += ` stars:${f.minStars}..${f.maxStars}`;
    else if (f.minStars) q += ` stars:>=${f.minStars}`;
    else if (f.maxStars) q += ` stars:<=${f.maxStars}`;
    if (f.minGoodFirstIssues) q += ` good-first-issues:>=${f.minGoodFirstIssues}`;
    if (f.minHelpWantedIssues) q += ` help-wanted-issues:>=${f.minHelpWantedIssues}`;
    if (f.license) q += ` license:${f.license}`;
    if (f.excludeForks) q += " fork:false";
    return `/search/repositories?q=${encodeURIComponent(q)}&sort=${f.sort}&order=${f.order}&per_page=25`;
  });

  let out = items.map(slimRepo);
  if (f.pushedWithinDays) out = out.filter((r) => r.pushed_at >= daysAgoIso(f.pushedWithinDays));
  const key = { updated: "pushed_at", forks: "forks", "help-wanted-issues": "open_issues" }[f.sort] || "stars";
  const dir = f.order === "asc" ? 1 : -1;
  out.sort((a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0));
  return { items: out, total: out.length, matches, searched: topics, failed };
}

export async function repoDetail(fullName) {
  return slimRepo(await gh(`/repos/${fullName}`));
}

// mirrors HealthScoreService.java
export async function repoHealth(fullName) {
  const [repo, prs] = await Promise.all([
    gh(`/repos/${fullName}`),
    gh(`/repos/${fullName}/pulls?state=closed&sort=updated&direction=desc&per_page=30`),
  ]);
  const hours = prs
    .filter((p) => p.created_at && p.closed_at)
    .map((p) => Math.floor((new Date(p.closed_at) - new Date(p.created_at)) / 36e5))
    .sort((a, b) => a - b);
  const n = hours.length;
  const median = n === 0 ? -1 : n % 2 ? hours[(n - 1) / 2] : Math.floor((hours[n / 2 - 1] + hours[n / 2]) / 2);
  const mergeRate = prs.length ? prs.filter((p) => p.merged_at).length / prs.length : 0;
  const days = Math.floor((Date.now() - new Date(repo.pushed_at)) / 864e5);
  const speed = median < 0 ? 0.5 : clamp(1 - median / (14 * 24));
  const score = Math.round(100 * (0.4 * mergeRate + 0.4 * speed + 0.2 * clamp(1 - days / 90)));
  return {
    repo: fullName,
    score,
    verdict:
      score >= 70
        ? "welcoming - PRs get reviewed and merged quickly"
        : score >= 40
          ? "moderate - expect some waiting"
          : "slow - PRs may sit for a long time",
    merge_rate: `${Math.round(mergeRate * 100)}%`,
    median_pr_close_hours: median,
    days_since_last_push: days,
    sample_size: prs.length,
    stars: repo.stargazers_count,
    open_issues: repo.open_issues_count,
  };
}
