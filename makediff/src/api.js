// Single fetch base for the whole frontend.
//   prod / local:      the Spring backend (token stays server-side)
//   standalone demo:   build with VITE_DIRECT_GITHUB=true to call api.github.com
//                      unauthenticated - no backend needed, much lower rate limits.
export const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8080").replace(/\/$/, "");
export const DIRECT_GITHUB = import.meta.env.VITE_DIRECT_GITHUB === "true";

const direct = () => import("./githubDirect.js");

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status; // 0 = network, 429 = rate limit, 422 = filter too narrow
  }
}

async function getJson(path, params) {
  const qs = params ? `?${params.toString()}` : "";
  let res;
  try {
    res = await fetch(`${API_BASE}${path}${qs}`, { headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError(`Can't reach the backend at ${API_BASE}.`, 0);
  }
  if (!res.ok) {
    let message = `The backend answered ${res.status}.`;
    try {
      const body = await res.json();
      if (body && body.message) message = body.message;
    } catch {
      /* non-JSON error body - keep the generic message */
    }
    throw new ApiError(message, res.status);
  }
  return res.json();
}

function query(entries) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
    else if (v !== "" && v !== null && v !== undefined) p.append(k, String(v));
  }
  return p;
}

/* ---------- normalisers: cards only ever see these slim shapes ---------- */

export function slimIssue(i) {
  const repo = (i.repository_url || "").split("/repos/")[1] || "";
  return {
    kind: "issue",
    id: i.id,
    number: i.number,
    title: i.title,
    url: i.html_url,
    repo,
    updated_at: i.updated_at,
    created_at: i.created_at,
    comments: i.comments ?? 0,
    reactions: i.reactions?.total_count ?? 0,
    labels: (i.labels || []).map((l) => ({ name: l.name, color: l.color })),
  };
}

export function slimRepo(r) {
  return {
    kind: "repo",
    id: r.id,
    full_name: r.full_name,
    url: r.html_url,
    description: r.description || "",
    avatar: r.owner?.avatar_url || "",
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    open_issues: r.open_issues_count ?? 0,
    language: r.language || "",
    pushed_at: r.pushed_at,
    license: r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : "",
  };
}

/* ---------- endpoints ---------- */

export async function searchIssues(f) {
  if (DIRECT_GITHUB) return (await direct()).searchIssues(f);
  const body = await getJson(
    "/api/issues",
    query({
      labels: f.labels,
      language: f.language,
      unassignedOnly: f.unassignedOnly,
      maxComments: f.maxComments,
      minReactions: f.minReactions || "",
      maxAgeDays: f.maxAgeDays || "",
      createdWithinDays: f.createdWithinDays || "",
      keyword: f.keyword,
      sort: f.sort,
      order: f.order,
      perLabel: f.perLabel,
    }),
  );
  return {
    items: body.items.map(slimIssue),
    total: body.total,
    matches: body.github_matches ?? body.total,
    searched: body.labels_searched || [],
    failed: body.labels_failed || [],
  };
}

export async function searchRepos(f) {
  if (DIRECT_GITHUB) return (await direct()).searchRepos(f);
  const body = await getJson(
    "/api/repos",
    query({
      topics: f.topics,
      language: f.language,
      minStars: f.minStars || "",
      maxStars: f.maxStars || "",
      minGoodFirstIssues: f.minGoodFirstIssues || "",
      minHelpWantedIssues: f.minHelpWantedIssues || "",
      pushedWithinDays: f.pushedWithinDays || "",
      license: f.license,
      excludeForks: f.excludeForks,
      keyword: f.keyword,
      sort: f.sort,
      order: f.order,
    }),
  );
  return {
    items: body.items.map(slimRepo),
    total: body.total,
    matches: body.github_matches ?? body.total,
    searched: body.topics_searched || [],
    failed: body.topics_failed || [],
  };
}

export async function repoDetail(fullName) {
  if (DIRECT_GITHUB) return (await direct()).repoDetail(fullName);
  return slimRepo(await getJson(`/api/repo/${fullName}`));
}

export async function repoHealth(fullName) {
  if (DIRECT_GITHUB) return (await direct()).repoHealth(fullName);
  return getJson(`/api/health/${fullName}`);
}
