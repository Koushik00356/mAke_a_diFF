import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DIRECT_GITHUB, repoDetail, repoHealth, searchIssues, searchRepos } from "./api.js";

/* ============================================================================
   mAke_a_diFF - "Whiteprint" design system
   One injected <style> block (tokens, states, media queries, motion) plus
   style objects for one-off layout.
   ========================================================================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Hanken+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.mad[data-theme="blueprint"]{
  --ground:#0e1630; --panel:#131d3d; --panel-2:#18244a; --line:rgba(125,200,255,.18); --line-strong:rgba(125,200,255,.34);
  --grid-minor:rgba(110,190,255,.045); --grid-major:rgba(110,190,255,.10);
  --ink:#e9eefb; --ink-2:#aab7d6; --ink-3:#7c8cb3;
  --accent:#ff6a3d; --accent-ink:#1a0d06; --accent-wash:rgba(255,106,61,.12);
  --cyan:#6fd3ff; --sage:#8fd6ab; --amber:#f2c063; --rose:#ff8fa3;
  --shadow:0 18px 40px -24px rgba(0,0,0,.7);
}
.mad[data-theme="whiteprint"]{
  --ground:#e7ecf1; --panel:#f4f7fa; --panel-2:#ffffff; --line:rgba(20,70,125,.20); --line-strong:rgba(20,70,125,.40);
  --grid-minor:rgba(20,90,150,.06); --grid-major:rgba(20,90,150,.13);
  --ink:#12203f; --ink-2:#3c4c6e; --ink-3:#5e6d8c;
  --accent:#e8501f; --accent-ink:#1a0d06; --accent-wash:rgba(232,80,31,.10);
  --cyan:#0b6f99; --sage:#2c7a52; --amber:#8f6200; --rose:#bf2f4a;
  --shadow:0 18px 40px -26px rgba(18,32,63,.35);
}

.mad{ --display:'Bricolage Grotesque',system-ui,sans-serif; --body:'Hanken Grotesk',system-ui,sans-serif; --mono:'IBM Plex Mono',ui-monospace,Consolas,monospace;
  min-height:100vh; background:var(--ground); color:var(--ink); font-family:var(--body); font-size:15px; line-height:1.5; position:relative; }
.mad *{ box-sizing:border-box; }
.mad-grid{ position:fixed; inset:0; pointer-events:none; z-index:0;
  background-image:
    linear-gradient(var(--grid-major) 1px,transparent 1px),linear-gradient(90deg,var(--grid-major) 1px,transparent 1px),
    linear-gradient(var(--grid-minor) 1px,transparent 1px),linear-gradient(90deg,var(--grid-minor) 1px,transparent 1px);
  background-size:140px 140px,140px 140px,28px 28px,28px 28px; }
.mad-wrap{ position:relative; z-index:1; max-width:1180px; margin:0 auto; padding:0 20px; }

.mad button, .mad input{ font:inherit; color:inherit; }
.mad button{ cursor:pointer; background:none; border:0; padding:0; }
.mad a{ color:var(--cyan); text-decoration:none; text-underline-offset:3px; }
.mad a:hover{ text-decoration:underline; }
.mad :focus-visible{ outline:2px solid var(--accent); outline-offset:2px; border-radius:4px; }
.mono{ font-family:var(--mono); font-variant-numeric:tabular-nums; }
.cap{ font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); }

/* top bar */
.bar{ position:sticky; top:0; z-index:20; background:color-mix(in srgb,var(--ground) 86%,transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--line); }
.bar-in{ display:flex; align-items:center; gap:10px; height:56px; }
.logo{ display:flex; align-items:baseline; gap:8px; font-family:var(--mono); font-weight:600; font-size:16px; letter-spacing:-.01em; margin-right:auto; }
.logo b{ color:var(--accent); font-size:20px; font-weight:600; }
.ghost{ font-family:var(--mono); font-size:12px; height:34px; padding:0 12px !important; border:1px solid var(--line) !important; border-radius:6px; color:var(--ink-2) !important; display:inline-flex; align-items:center; gap:7px; white-space:nowrap; transition:border-color .15s,color .15s,background .15s; }
.ghost:hover{ border-color:var(--line-strong) !important; color:var(--ink) !important; }
.ghost[aria-pressed="true"]{ border-color:var(--cyan) !important; color:var(--cyan) !important; }

/* hero */
.hero{ padding:56px 0 30px; }
.eyebrow{ display:inline-flex; align-items:center; gap:9px; }
.pulse{ width:7px; height:7px; border-radius:50%; background:var(--sage); box-shadow:0 0 0 0 var(--sage); animation:pulse 2.2s infinite; }
.hunk{ margin:20px 0 0; border-left:1px solid var(--line-strong); }
.hunk-head{ font-family:var(--mono); font-size:12px; color:var(--cyan); padding:0 0 10px 14px; }
.hunk-line{ display:grid; grid-template-columns:44px 1fr; align-items:baseline; font-family:var(--display); font-weight:700; font-size:clamp(34px,6.4vw,76px); line-height:1.06; letter-spacing:-.02em; }
.hunk-line .g{ font-family:var(--mono); font-weight:400; font-size:.42em; color:var(--ink-3); text-align:center; letter-spacing:0; }
.hunk-line.add{ color:var(--accent); background:linear-gradient(90deg,var(--accent-wash),transparent 78%); }
.hunk-line.add .g{ color:var(--accent); font-weight:600; }
.hunk-line .name{ font-family:var(--mono); font-weight:500; letter-spacing:-.05em; font-size:.84em; }
.lede{ max-width:56ch; color:var(--ink-2); font-size:17px; margin:22px 0 0; }
.count{ display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; margin:26px 0 0; }
.count strong{ font-family:var(--mono); font-variant-numeric:tabular-nums; font-size:40px; font-weight:500; line-height:1; color:var(--ink); min-width:2ch; }
.count span{ color:var(--ink-2); }
.count small{ font-family:var(--mono); font-size:12px; color:var(--ink-3); }

.cmd{ display:flex; gap:8px; margin-top:24px; padding:8px; background:var(--panel); border:1px solid var(--line-strong); border-radius:10px; box-shadow:var(--shadow); max-width:760px; }
.seg{ display:inline-flex; border:1px solid var(--line); border-radius:7px; overflow:hidden; flex:none; }
.seg button{ font-family:var(--mono); font-size:12.5px; padding:0 14px; height:40px; color:var(--ink-3); transition:background .15s,color .15s; }
.seg button + button{ border-left:1px solid var(--line); }
.seg button:focus-visible{ outline-offset:-3px; }
.seg button[aria-pressed="true"]{ background:var(--panel-2); color:var(--ink); box-shadow:inset 0 -2px 0 var(--cyan); }
.cmd input{ flex:1; min-width:0; height:40px; background:transparent; border:0; padding:0 10px; font-family:var(--mono); font-size:14px; }
.cmd input::placeholder, .field::placeholder{ color:var(--ink-3); }
.cmd input:focus-visible{ outline:none; }
.cmd:focus-within{ border-color:var(--accent); }
.go{ background:var(--accent) !important; color:var(--accent-ink) !important; font-weight:600; height:40px; padding:0 18px !important; border-radius:7px; white-space:nowrap; transition:filter .15s,transform .1s; flex:none; }
.go:hover{ filter:brightness(1.07); }
.go:active{ transform:translateY(1px); }
.go:disabled{ opacity:.6; cursor:progress; }

/* body layout */
.body{ display:grid; grid-template-columns:282px minmax(0,1fr); gap:28px; align-items:start; padding:14px 0 90px; }
.rail{ position:sticky; top:72px; max-height:calc(100vh - 88px); overflow:auto; background:var(--panel); border:1px solid var(--line); border-radius:10px; }
.rail-toggle{ display:none; }
.rail-body{ padding:6px 16px 16px; }
.sec{ padding:14px 0; border-bottom:1px dashed var(--line); }
.sec:last-of-type{ border-bottom:0; }
.sec-h{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:9px; }
.sub{ font-size:12.5px; color:var(--ink-2); margin:10px 0 6px; }
.chips{ display:flex; flex-wrap:wrap; gap:6px; }
.chip{ font-family:var(--mono); font-size:11.5px; padding:5px 9px !important; border:1px solid var(--line) !important; border-radius:999px; color:var(--ink-2) !important; transition:border-color .15s,color .15s,background .15s; }
.chip:hover{ border-color:var(--line-strong) !important; color:var(--ink) !important; }
.chip[aria-pressed="true"]{ border-color:var(--cyan) !important; color:var(--cyan) !important; background:color-mix(in srgb,var(--cyan) 10%,transparent) !important; }
.chip:disabled{ opacity:.4; cursor:not-allowed; }
.field{ width:100%; height:34px; margin-top:8px; background:var(--ground); border:1px solid var(--line); border-radius:6px; padding:0 10px; font-family:var(--mono); font-size:12.5px; }
.field:focus-visible{ outline:none; border-color:var(--accent); }
.switch{ display:flex; align-items:center; justify-content:space-between; width:100%; font-size:13px; color:var(--ink-2) !important; padding:4px 0 !important; text-align:left; }
.switch i{ width:30px; height:16px; border-radius:99px; border:1px solid var(--line-strong); position:relative; flex:none; transition:background .15s; }
.switch i::after{ content:""; position:absolute; top:2px; left:2px; width:10px; height:10px; border-radius:50%; background:var(--ink-3); transition:transform .15s,background .15s; }
.switch[aria-checked="true"] i{ background:color-mix(in srgb,var(--cyan) 22%,transparent); border-color:var(--cyan); }
.switch[aria-checked="true"] i::after{ transform:translateX(14px); background:var(--cyan); }
.apply{ width:100%; height:40px; margin-top:14px; border:1px solid var(--line-strong) !important; border-radius:7px; font-weight:600; color:var(--ink-2) !important; transition:all .15s; }
.apply.dirty{ background:var(--accent) !important; border-color:var(--accent) !important; color:var(--accent-ink) !important; }
.apply:disabled{ opacity:.6; cursor:progress; }
.reset{ display:block; margin:10px auto 0; font-family:var(--mono); font-size:11.5px; color:var(--ink-3) !important; }
.reset:hover{ color:var(--ink) !important; }

/* results */
.res-h{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
.res-h h2{ font-family:var(--display); font-size:22px; font-weight:700; letter-spacing:-.02em; margin:0; }
.note{ display:flex; gap:10px; padding:11px 14px; border:1px solid var(--amber); border-left-width:3px; border-radius:8px; background:color-mix(in srgb,var(--amber) 9%,transparent); font-size:13.5px; margin-bottom:14px; }
.note .mono{ color:var(--amber); flex:none; }
.list{ display:grid; gap:12px; }
.card{ display:grid; grid-template-columns:38px minmax(0,1fr); background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; transition:border-color .18s,transform .18s,box-shadow .18s; animation:rise .45s cubic-bezier(.2,.7,.2,1) both; }
.card:hover{ border-color:var(--line-strong); transform:translateY(-1px); box-shadow:var(--shadow); }
.gut{ font-family:var(--mono); font-size:17px; font-weight:600; text-align:center; padding-top:15px; border-right:1px solid var(--line); }
.gut.plus{ color:var(--accent); background:var(--accent-wash); }
.gut.branch{ color:var(--cyan); background:color-mix(in srgb,var(--cyan) 8%,transparent); }
.card-b{ padding:14px 16px 13px; min-width:0; }
.card-top{ display:flex; align-items:flex-start; gap:10px; }
.card-top .grow{ flex:1; min-width:0; }
.ref{ font-family:var(--mono); font-size:12px; color:var(--ink-3); overflow-wrap:anywhere; }
.title{ font-family:var(--display); font-weight:500; font-size:18px; line-height:1.28; letter-spacing:0; margin:4px 0 0; overflow-wrap:anywhere; }
.title a{ color:var(--ink); }
.desc{ color:var(--ink-2); font-size:14px; margin:6px 0 0; overflow-wrap:anywhere; }
.icon{ width:32px; height:32px; border-radius:6px; display:inline-grid; place-items:center; color:var(--ink-3) !important; border:1px solid transparent !important; font-size:16px; flex:none; transition:color .15s,border-color .15s,transform .2s; }
.icon:hover{ color:var(--ink) !important; border-color:var(--line) !important; }
.icon.star[aria-pressed="true"]{ color:var(--amber) !important; }
.icon.chev[aria-expanded="true"]{ transform:rotate(180deg); }
.meta{ display:flex; flex-wrap:wrap; align-items:center; gap:6px 14px; margin-top:10px; font-family:var(--mono); font-size:12px; color:var(--ink-3); font-variant-numeric:tabular-nums; }
.meta b{ color:var(--ink-2); font-weight:500; }
.fresh{ display:inline-flex; align-items:center; gap:7px; padding:3px 9px; border:1px solid currentColor; border-radius:999px; font-family:var(--mono); font-size:11px; }
.dots{ display:inline-flex; gap:3px; }
.dots i{ width:5px; height:5px; border-radius:50%; background:currentColor; opacity:.22; }
.dots i.on{ opacity:1; }
.labels{ display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
.lab{ display:inline-flex; align-items:center; gap:6px; font-family:var(--mono); font-size:11px; color:var(--ink-2); padding:2px 8px; border:1px solid var(--line); border-radius:4px; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lab i{ width:7px; height:7px; border-radius:2px; flex:none; }
.more{ margin-top:13px; padding-top:13px; border-top:1px dashed var(--line); animation:rise .3s ease both; }
.kv{ display:grid; grid-template-columns:repeat(auto-fit,minmax(96px,1fr)); gap:10px; }
.kv div{ border-left:1px solid var(--line-strong); padding-left:9px; }
.kv dt{ font-family:var(--mono); font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3); }
.kv dd{ margin:2px 0 0; font-family:var(--mono); font-size:14px; font-variant-numeric:tabular-nums; }
.links{ display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:12px; font-family:var(--mono); font-size:12.5px; }
.avatar{ width:38px; height:38px; border-radius:8px; border:1px solid var(--line); background:var(--panel-2); flex:none; }

/* health meter */
.health{ margin-top:13px; padding:11px 12px; border:1px dashed var(--line-strong); border-radius:8px; }
.health-row{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.scout{ font-family:var(--mono); font-size:12px; height:30px; padding:0 12px !important; border:1px solid var(--cyan) !important; color:var(--cyan) !important; border-radius:6px; transition:background .15s; }
.scout:hover{ background:color-mix(in srgb,var(--cyan) 12%,transparent) !important; }
.scout:disabled{ opacity:.6; cursor:progress; }
.track{ flex:1; min-width:120px; height:8px; border-radius:99px; background:color-mix(in srgb,var(--ink-3) 22%,transparent); overflow:hidden; }
.track i{ display:block; height:100%; border-radius:99px; background:currentColor; transform-origin:left; animation:fill .7s cubic-bezier(.2,.7,.2,1) both; }
.score{ font-family:var(--mono); font-size:20px; font-weight:500; font-variant-numeric:tabular-nums; min-width:3ch; text-align:right; }
.verdict{ font-size:13.5px; margin:8px 0 0; color:var(--ink-2); }

/* states */
.skel{ height:118px; border-radius:10px; border:1px solid var(--line); background:linear-gradient(100deg,var(--panel) 30%,var(--panel-2) 50%,var(--panel) 70%); background-size:240% 100%; animation:shimmer 1.4s linear infinite; }
.state{ border:1px dashed var(--line-strong); border-radius:10px; padding:38px 26px; background:var(--panel); }
.state h3{ font-family:var(--display); font-size:22px; font-weight:700; letter-spacing:-.02em; margin:10px 0 6px; }
.state p{ color:var(--ink-2); margin:0 0 6px; max-width:60ch; }
.state .cap.err{ color:var(--rose); }
.state button{ margin-top:14px; }
.foot{ border-top:1px solid var(--line); padding:20px 0 34px; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }

@keyframes rise{ from{ opacity:0; transform:translateY(10px); } to{ opacity:1; transform:none; } }
@keyframes shimmer{ to{ background-position:-240% 0; } }
@keyframes fill{ from{ transform:scaleX(0); } to{ transform:scaleX(1); } }
@keyframes pulse{ 0%{ box-shadow:0 0 0 0 color-mix(in srgb,var(--sage) 60%,transparent); } 70%,100%{ box-shadow:0 0 0 8px transparent; } }

@media (max-width:880px){
  .body{ grid-template-columns:minmax(0,1fr); gap:16px; }
  .rail{ position:static; max-height:none; }
  .rail-toggle{ display:flex; width:100%; align-items:center; justify-content:space-between; padding:13px 16px !important; font-family:var(--mono); font-size:12.5px; color:var(--ink-2) !important; }
  .rail-body{ display:none; border-top:1px solid var(--line); }
  .rail-body.open{ display:block; }
  .hero{ padding:34px 0 22px; }
}
@media (max-width:560px){
  .mad-wrap{ padding:0 14px; }
  .cmd{ flex-wrap:wrap; }
  .seg{ width:100%; } .seg button{ flex:1; }
  .cmd input{ flex:1 1 55%; }
  .hunk-line{ grid-template-columns:30px 1fr; }
  .card{ grid-template-columns:28px minmax(0,1fr); }
  .card-b{ padding:12px 12px 11px; }
  .ghost .hide-s{ display:none; }
  .count strong{ font-size:32px; }
}
@media (prefers-reduced-motion:reduce){
  .mad *, .mad *::before, .mad *::after{ animation:none !important; transition:none !important; }
}
`;

/* ============================== data ====================================== */

const LANGUAGES = ["JavaScript", "TypeScript", "Python", "Java", "Go", "Rust", "C++", "C#", "Ruby", "PHP", "Kotlin", "Swift"];
const LABELS = ["good first issue", "help wanted", "beginner friendly", "first-timers-only", "easy", "documentation", "up-for-grabs", "good-first-issue", "starter", "low-hanging-fruit"];
const TOPICS = ["good-first-issue", "first-timers-only", "hacktoberfest", "beginner-friendly", "help-wanted", "up-for-grabs"];
const LABEL_CAP = 6;
const TOPIC_CAP = 4;

const SIZES = [
  { v: "any", l: "any size", min: 0, max: 0 },
  { v: "micro", l: "micro <100★", min: 0, max: 99 },
  { v: "small", l: "small 100–1k", min: 100, max: 999 },
  { v: "mid", l: "mid 1k–10k", min: 1000, max: 9999 },
  { v: "large", l: "large 10k–50k", min: 10000, max: 49999 },
  { v: "flagship", l: "flagship 50k+", min: 50000, max: 0 },
];
const WITHIN = [{ v: 0, l: "any time" }, { v: 7, l: "7 days" }, { v: 30, l: "30 days" }, { v: 90, l: "90 days" }];

const DEFAULTS = {
  language: "",
  labels: ["good first issue"],
  topics: ["good-first-issue"],
  // issues
  unassignedOnly: true,
  maxComments: "",
  minReactions: 0,
  maxAgeDays: 0,
  createdWithinDays: 0,
  issueSort: "updated",
  issueOrder: "desc",
  perLabel: 20,
  // repos
  size: "any",
  minGoodFirstIssues: 0,
  minHelpWantedIssues: 0,
  pushedWithinDays: 0,
  license: "",
  excludeForks: true,
  repoSort: "stars",
  repoOrder: "desc",
};

/* ============================== helpers =================================== */

const store = {
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode / quota - the shortlist just stays in memory */
    }
  },
};

const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));

function ago(iso) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n ?? 0));

function closeTime(hours) {
  if (hours == null || hours < 0) return "n/a";
  if (hours < 1) return "<1h";
  if (hours < 48) return `${hours}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function freshness(iso) {
  const d = daysSince(iso);
  if (d <= 7) return { dots: 4, label: "fresh", color: "var(--sage)" };
  if (d <= 30) return { dots: 3, label: "active", color: "var(--cyan)" };
  if (d <= 90) return { dots: 2, label: "cooling", color: "var(--amber)" };
  return { dots: 1, label: "stale", color: "var(--ink-3)" };
}

const healthColor = (score) => (score >= 70 ? "var(--sage)" : score >= 40 ? "var(--amber)" : "var(--rose)");

function toRequest(mode, keyword, f) {
  if (mode === "issues") {
    return {
      labels: f.labels, language: f.language, unassignedOnly: f.unassignedOnly, maxComments: f.maxComments,
      minReactions: f.minReactions, maxAgeDays: f.maxAgeDays, createdWithinDays: f.createdWithinDays,
      keyword, sort: f.issueSort, order: f.issueOrder, perLabel: f.perLabel,
    };
  }
  const size = SIZES.find((s) => s.v === f.size) || SIZES[0];
  return {
    topics: f.topics, language: f.language, minStars: size.min, maxStars: size.max,
    minGoodFirstIssues: f.minGoodFirstIssues, minHelpWantedIssues: f.minHelpWantedIssues,
    pushedWithinDays: f.pushedWithinDays, license: f.license, excludeForks: f.excludeForks,
    keyword, sort: f.repoSort, order: f.repoOrder,
  };
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = (e) => setReduce(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

function useCountUp(target, reduce) {
  const [n, setN] = useState(0);
  const shown = useRef(0);
  useEffect(() => {
    const from = shown.current;
    const dur = reduce ? 0 : 900;
    const t0 = performance.now();
    let raf = requestAnimationFrame(function tick(t) {
      const p = dur ? Math.min(1, (t - t0) / dur) : 1;
      const v = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      shown.current = v;
      setN(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [target, reduce]);
  return n;
}

/* ============================== small parts =============================== */

function Choice({ label, options, value, onChange }) {
  return (
    <>
      {label && <p className="sub">{label}</p>}
      <div className="chips" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.v)} type="button" className="chip" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
            {o.l}
          </button>
        ))}
      </div>
    </>
  );
}

function MultiChips({ options, selected, cap, onChange }) {
  const toggle = (v) => {
    if (selected.includes(v)) {
      if (selected.length > 1) onChange(selected.filter((x) => x !== v));
    } else if (selected.length < cap) onChange([...selected, v]);
  };
  return (
    <div className="chips">
      {options.map((v) => {
        const on = selected.includes(v);
        return (
          <button key={v} type="button" className="chip" aria-pressed={on} disabled={!on && selected.length >= cap} onClick={() => toggle(v)}>
            {v}
          </button>
        );
      })}
    </div>
  );
}

function Switch({ label, checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      {label}
      <i aria-hidden="true" />
    </button>
  );
}

function Fresh({ iso }) {
  const f = freshness(iso);
  return (
    <span className="fresh" style={{ color: f.color }} title={`last activity ${ago(iso)}`}>
      <span className="dots" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i < f.dots ? "on" : ""} />
        ))}
      </span>
      {f.label}
    </span>
  );
}

function StarButton({ on, onToggle, name }) {
  return (
    <button type="button" className="icon star" aria-pressed={on} aria-label={`${on ? "Remove" : "Add"} ${name} ${on ? "from" : "to"} shortlist`} onClick={onToggle}>
      {on ? "★" : "☆"}
    </button>
  );
}

function RepoFacts({ repo }) {
  return (
    <>
      <dl className="kv" style={{ margin: 0 }}>
        <div><dt>stars</dt><dd>{compact(repo.stars)}</dd></div>
        <div><dt>forks</dt><dd>{compact(repo.forks)}</dd></div>
        <div><dt>open</dt><dd>{compact(repo.open_issues)}</dd></div>
        <div><dt>pushed</dt><dd>{ago(repo.pushed_at)}</dd></div>
        <div><dt>license</dt><dd>{repo.license || "none"}</dd></div>
      </dl>
      {repo.description && <p className="desc" style={{ marginTop: 12 }}>{repo.description}</p>}
    </>
  );
}

function ContributeLinks({ repo, issueUrl }) {
  const base = `https://github.com/${repo}`;
  return (
    <div className="links">
      {issueUrl && <a href={issueUrl} target="_blank" rel="noreferrer">open the issue ↗</a>}
      <a href={`${base}/blob/HEAD/CONTRIBUTING.md`} target="_blank" rel="noreferrer">CONTRIBUTING.md ↗</a>
      <a href={`${base}/contribute`} target="_blank" rel="noreferrer">/contribute ↗</a>
    </div>
  );
}

/* ============================== cards ===================================== */

// Lazy, cached fetch: results live in a Map held by a ref in the root
// component, so re-expanding a card (or re-rendering it in the shortlist)
// costs nothing.
function useLazy(cacheRef, key, fetcher) {
  // One-time read on mount so an already-fetched repo shows instantly; the cache never drives re-renders.
  // eslint-disable-next-line react-hooks/refs
  const [state, setState] = useState(() => {
    const cache = cacheRef.current;
    return cache.has(key) ? { status: "done", data: cache.get(key) } : { status: "idle" };
  });
  const load = useCallback(async () => {
    const cache = cacheRef.current;
    if (cache.has(key)) return setState({ status: "done", data: cache.get(key) });
    setState({ status: "loading" });
    try {
      const data = await fetcher();
      cache.set(key, data);
      setState({ status: "done", data });
    } catch (e) {
      setState({ status: "error", error: e });
    }
  }, [cacheRef, key, fetcher]);
  return [state, load];
}

const lazyError = (e) =>
  e?.status === 429 ? "GitHub is rate-limiting us. Give it a minute, then try again."
  : e?.status === 404 ? "GitHub says this repo no longer exists."
  : e?.status === 0 ? e.message
  : "That lookup failed. Try again in a moment.";

function IssueCard({ item, index, starred, onStar, cacheRef }) {
  const [open, setOpen] = useState(false);
  const fetcher = useCallback(() => repoDetail(item.repo), [item.repo]);
  const [detail, load] = useLazy(cacheRef, `repo:${item.repo}`, fetcher);
  const toggle = () => {
    if (!open && detail.status !== "done") load();
    setOpen(!open);
  };
  return (
    <article className="card" style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}>
      <div className="gut plus" aria-hidden="true">+</div>
      <div className="card-b">
        <div className="card-top">
          <div className="grow">
            <div className="ref">{item.repo}#{item.number}</div>
            <h3 className="title"><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></h3>
          </div>
          <StarButton on={starred} onToggle={onStar} name={`${item.repo}#${item.number}`} />
          <button type="button" className="icon chev" aria-expanded={open} aria-label="Repository details" onClick={toggle}>▾</button>
        </div>
        <div className="meta">
          <Fresh iso={item.updated_at} />
          <span>updated <b>{ago(item.updated_at)}</b></span>
          <span><b>{item.comments}</b> comments</span>
          <span><b>{item.reactions}</b> reactions</span>
        </div>
        {item.labels.length > 0 && (
          <div className="labels">
            {item.labels.slice(0, 6).map((l) => (
              <span key={l.name} className="lab"><i style={{ background: `#${l.color || "888"}` }} />{l.name}</span>
            ))}
          </div>
        )}
        {open && (
          <div className="more">
            {detail.status === "loading" && <span className="cap">reading {item.repo}…</span>}
            {detail.status === "error" && <span className="cap" style={{ color: "var(--rose)" }}>{lazyError(detail.error)}</span>}
            {detail.status === "done" && <RepoFacts repo={detail.data} />}
            <ContributeLinks repo={item.repo} issueUrl={item.url} />
          </div>
        )}
      </div>
    </article>
  );
}

function RepoCard({ item, index, starred, onStar, cacheRef }) {
  const fetcher = useCallback(() => repoHealth(item.full_name), [item.full_name]);
  const [health, scout] = useLazy(cacheRef, `health:${item.full_name}`, fetcher);
  const h = health.data;
  return (
    <article className="card" style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}>
      <div className="gut branch" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="4" cy="3.3" r="1.7" /><circle cx="4" cy="12.7" r="1.7" /><circle cx="12" cy="5.3" r="1.7" />
          <path d="M4 5v6M12 7c0 2.8-3.4 2.6-8 4" />
        </svg>
      </div>
      <div className="card-b">
        <div className="card-top">
          {item.avatar ? <img className="avatar" src={`${item.avatar}&s=76`} alt="" loading="lazy" width="38" height="38" /> : <span className="avatar" />}
          <div className="grow">
            <h3 className="title" style={{ marginTop: 0 }}><a href={item.url} target="_blank" rel="noreferrer">{item.full_name}</a></h3>
            {item.description && <p className="desc">{item.description}</p>}
          </div>
          <StarButton on={starred} onToggle={onStar} name={item.full_name} />
        </div>
        <div className="meta">
          <Fresh iso={item.pushed_at} />
          <span><b>{compact(item.stars)}</b> stars</span>
          <span><b>{compact(item.forks)}</b> forks</span>
          <span><b>{compact(item.open_issues)}</b> open</span>
          {item.language && <span>{item.language}</span>}
          {item.license && <span>{item.license}</span>}
        </div>

        <div className="health">
          {health.status !== "done" ? (
            <div className="health-row">
              <span className="cap">maintainer health</span>
              <span style={{ flex: 1 }} />
              {health.status === "error" && <span className="mono" style={{ fontSize: 12, color: "var(--rose)" }}>{lazyError(health.error)}</span>}
              <button type="button" className="scout" disabled={health.status === "loading"} onClick={scout}>
                {health.status === "loading" ? "scouting…" : health.status === "error" ? "retry" : "scout health"}
              </button>
            </div>
          ) : (
            <div style={{ color: healthColor(h.score) }}>
              <div className="health-row">
                <span className="cap">health</span>
                <div className="track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={h.score} aria-label="Repository health score">
                  <i style={{ width: `${h.score}%` }} />
                </div>
                <span className="score">{h.score}</span>
              </div>
              <p className="verdict">{h.verdict}</p>
              <div className="meta" style={{ marginTop: 6 }}>
                <span><b>{h.merge_rate}</b> merged</span>
                <span><b>{closeTime(h.median_pr_close_hours)}</b> median PR close</span>
                <span>last <b>{h.sample_size}</b> closed PRs</span>
              </div>
            </div>
          )}
        </div>
        <ContributeLinks repo={item.full_name} />
      </div>
    </article>
  );
}

/* ============================== main ====================================== */

export default function FirstDiffUltra() {
  const reduce = useReducedMotion();
  const [theme, setTheme] = useState(() => (store.get("mad.theme", "blueprint") === "whiteprint" ? "whiteprint" : "blueprint"));
  const [mode, setMode] = useState("issues");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [filters, setFilters] = useState(DEFAULTS);
  const [applied, setApplied] = useState({ mode: "issues", keyword: "", filters: DEFAULTS });
  const [scan, setScan] = useState({ status: "loading", items: [], total: 0, matches: 0, searched: [], failed: [], error: null });
  const [view, setView] = useState("results"); // results | shortlist
  const [shortlist, setShortlist] = useState(() => {
    const saved = store.get("mad.shortlist", []);
    return Array.isArray(saved) ? saved.filter((x) => x && x.id && x.kind) : [];
  });
  const [railOpen, setRailOpen] = useState(false);
  const [customLang, setCustomLang] = useState("");

  const cacheRef = useRef(new Map()); // repo detail + health, keyed "repo:o/r" / "health:o/r"
  const scanId = useRef(0);

  // latest scan wins: a slower, older response never overwrites a newer one
  const fetchScan = useCallback((nextMode, keyword, f) => {
    const id = ++scanId.current;
    const req = toRequest(nextMode, keyword, f);
    (nextMode === "issues" ? searchIssues(req) : searchRepos(req)).then(
      (res) => {
        if (id === scanId.current) setScan({ status: "done", error: null, ...res });
      },
      (error) => {
        if (id === scanId.current) setScan({ status: "error", items: [], total: 0, matches: 0, searched: [], failed: [], error });
      },
    );
  }, []);

  const runScan = (nextMode, keyword, f) => {
    setApplied({ mode: nextMode, keyword, filters: f });
    setScan((s) => ({ ...s, status: "loading", error: null }));
    fetchScan(nextMode, keyword, f);
  };

  // first scan on load (state already starts as "loading" with the defaults applied)
  useEffect(() => {
    fetchScan("issues", "", DEFAULTS);
  }, [fetchScan]);

  useEffect(() => store.set("mad.theme", theme), [theme]);
  useEffect(() => store.set("mad.shortlist", shortlist), [shortlist]);

  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const dirty = useMemo(() => JSON.stringify(filters) !== JSON.stringify(applied.filters), [filters, applied.filters]);
  const loading = scan.status === "loading";

  const submit = (e) => {
    e?.preventDefault();
    setView("results");
    runScan(mode, keywordDraft.trim(), filters);
  };
  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setView("results");
    runScan(m, keywordDraft.trim(), filters);
  };
  const reset = () => {
    setFilters(DEFAULTS);
    setCustomLang("");
    setKeywordDraft("");
    runScan(mode, "", DEFAULTS);
  };

  const starredKeys = useMemo(() => new Set(shortlist.map((x) => `${x.kind}:${x.id}`)), [shortlist]);
  const toggleStar = (item) =>
    setShortlist((list) =>
      list.some((x) => x.kind === item.kind && x.id === item.id)
        ? list.filter((x) => !(x.kind === item.kind && x.id === item.id))
        : [item, ...list],
    );

  const count = useCountUp(scan.status === "done" ? scan.total : 0, reduce);
  const noun = applied.mode === "issues" ? "issues" : "repos";
  const unit = applied.mode === "issues" ? "label" : "topic";
  const showing = view === "shortlist" ? shortlist : scan.items;

  const renderCard = (item, i) =>
    item.kind === "issue" ? (
      <IssueCard key={`issue:${item.id}`} item={item} index={i} cacheRef={cacheRef} starred={starredKeys.has(`issue:${item.id}`)} onStar={() => toggleStar(item)} />
    ) : (
      <RepoCard key={`repo:${item.id}`} item={item} index={i} cacheRef={cacheRef} starred={starredKeys.has(`repo:${item.id}`)} onStar={() => toggleStar(item)} />
    );

  return (
    <div className="mad" data-theme={theme}>
      <style>{CSS}</style>
      <div className="mad-grid" aria-hidden="true" />

      <header className="bar">
        <div className="mad-wrap bar-in">
          <a className="logo" href="#top" style={{ color: "var(--ink)", textDecoration: "none" }}>
            <b aria-hidden="true">+</b>mAke_a_diFF
          </a>
          <button type="button" className="ghost" aria-pressed={view === "shortlist"} onClick={() => setView(view === "shortlist" ? "results" : "shortlist")}>
            ★ <span className="hide-s">shortlist</span> <span className="mono">{shortlist.length}</span>
          </button>
          <button type="button" className="ghost" onClick={() => setTheme(theme === "blueprint" ? "whiteprint" : "blueprint")} aria-label={`Switch to ${theme === "blueprint" ? "Whiteprint (light)" : "Blueprint (dark)"} theme`}>
            ◐ <span className="hide-s">{theme === "blueprint" ? "whiteprint" : "blueprint"}</span>
          </button>
        </div>
      </header>

      <main className="mad-wrap" id="top">
        <section className="hero">
          <span className="cap eyebrow"><span className="pulse" aria-hidden="true" />live from GitHub{DIRECT_GITHUB ? " · demo mode" : ""}</span>

          <h1 className="hunk" aria-label="mAke_a_diFF: your first open-source win">
            <div className="hunk-head" aria-hidden="true">@@ -0,0 +1,3 @@ contributor</div>
            <div className="hunk-line" aria-hidden="true"><span className="g">+</span><span className="name">mAke_a_diFF</span></div>
            <div className="hunk-line" aria-hidden="true"><span className="g">+</span><span>your first</span></div>
            <div className="hunk-line add" aria-hidden="true"><span className="g">+</span><span>open-source win</span></div>
          </h1>

          <p className="lede">
            Beginner issues that are still unclaimed, in repositories that still merge pull requests. Read straight from GitHub, scored for maintainer health.
          </p>

          <div className="count" aria-live="polite">
            <strong>{loading ? "···" : scan.status === "error" ? "—" : count}</strong>
            <span>{applied.mode === "issues" ? "contributable issues on the table" : "welcoming repositories on the table"}</span>
            {scan.status === "done" && scan.matches > scan.total && (
              <small>surfaced from {scan.matches.toLocaleString()} {unit} matches on GitHub</small>
            )}
          </div>

          <form className="cmd" onSubmit={submit} role="search">
            <div className="seg" role="group" aria-label="Search for">
              <button type="button" aria-pressed={mode === "issues"} onClick={() => switchMode("issues")}>Issues</button>
              <button type="button" aria-pressed={mode === "repos"} onClick={() => switchMode("repos")}>Repos</button>
            </div>
            <input
              value={keywordDraft}
              onChange={(e) => setKeywordDraft(e.target.value)}
              placeholder={mode === "issues" ? "keyword in title or body — e.g. docs, typo, cli" : "keyword in name or description"}
              aria-label="Keyword"
              maxLength={120}
            />
            <button type="submit" className="go" disabled={loading}>{loading ? "scanning…" : "scan GitHub"}</button>
          </form>
        </section>

        <div className="body">
          <aside className="rail" aria-label="Filters">
            <button type="button" className="rail-toggle" aria-expanded={railOpen} onClick={() => setRailOpen(!railOpen)}>
              <span>filters{dirty ? " · unapplied changes" : ""}</span><span aria-hidden="true">{railOpen ? "−" : "+"}</span>
            </button>
            <div className={`rail-body${railOpen ? " open" : ""}`}>
              <div className="sec">
                <div className="sec-h"><span className="cap">language</span></div>
                <div className="chips">
                  <button type="button" className="chip" aria-pressed={filters.language === ""} onClick={() => { set({ language: "" }); setCustomLang(""); }}>any</button>
                  {LANGUAGES.map((l) => (
                    <button key={l} type="button" className="chip" aria-pressed={filters.language === l} onClick={() => { set({ language: l }); setCustomLang(""); }}>{l}</button>
                  ))}
                </div>
                <input
                  className="field"
                  value={customLang}
                  onChange={(e) => { setCustomLang(e.target.value); set({ language: e.target.value.trim() }); }}
                  placeholder="or type any language — Elixir, Zig…"
                  aria-label="Custom language"
                  maxLength={40}
                />
              </div>

              {mode === "issues" ? (
                <>
                  <div className="sec">
                    <div className="sec-h"><span className="cap">labels · merged</span><span className="cap">{filters.labels.length}/{LABEL_CAP}</span></div>
                    <MultiChips options={LABELS} selected={filters.labels} cap={LABEL_CAP} onChange={(labels) => set({ labels })} />
                  </div>
                  <div className="sec">
                    <div className="sec-h"><span className="cap">issue filters</span></div>
                    <Switch label="Unassigned only" checked={filters.unassignedOnly} onChange={(v) => set({ unassignedOnly: v })} />
                    <Choice label="Comments" value={filters.maxComments} onChange={(v) => set({ maxComments: v })}
                      options={[{ v: "", l: "any" }, { v: 0, l: "untouched" }, { v: 3, l: "≤ 3" }, { v: 10, l: "≤ 10" }]} />
                    <Choice label="Reactions at least" value={filters.minReactions} onChange={(v) => set({ minReactions: v })}
                      options={[{ v: 0, l: "any" }, { v: 1, l: "1+" }, { v: 5, l: "5+" }, { v: 10, l: "10+" }]} />
                    <Choice label="Updated within" value={filters.maxAgeDays} onChange={(v) => set({ maxAgeDays: v })} options={WITHIN} />
                    <Choice label="Opened within" value={filters.createdWithinDays} onChange={(v) => set({ createdWithinDays: v })} options={WITHIN} />
                    <Choice label="Results per label" value={filters.perLabel} onChange={(v) => set({ perLabel: v })}
                      options={[10, 20, 30, 50].map((v) => ({ v, l: String(v) }))} />
                  </div>
                  <div className="sec">
                    <div className="sec-h"><span className="cap">order</span></div>
                    <Choice label="Sort by" value={filters.issueSort} onChange={(v) => set({ issueSort: v })}
                      options={["updated", "created", "comments", "reactions"].map((v) => ({ v, l: v }))} />
                    <Choice label="Direction" value={filters.issueOrder} onChange={(v) => set({ issueOrder: v })}
                      options={[{ v: "desc", l: "big → small" }, { v: "asc", l: "small → big" }]} />
                  </div>
                </>
              ) : (
                <>
                  <div className="sec">
                    <div className="sec-h"><span className="cap">topics · merged</span><span className="cap">{filters.topics.length}/{TOPIC_CAP}</span></div>
                    <MultiChips options={TOPICS} selected={filters.topics} cap={TOPIC_CAP} onChange={(topics) => set({ topics })} />
                  </div>
                  <div className="sec">
                    <div className="sec-h"><span className="cap">project size</span></div>
                    <Choice value={filters.size} onChange={(v) => set({ size: v })} options={SIZES} />
                  </div>
                  <div className="sec">
                    <div className="sec-h"><span className="cap">repo filters</span></div>
                    <Choice label="Open good-first-issues right now" value={filters.minGoodFirstIssues} onChange={(v) => set({ minGoodFirstIssues: v })}
                      options={[{ v: 0, l: "any" }, { v: 1, l: "1+" }, { v: 3, l: "3+" }, { v: 5, l: "5+" }, { v: 10, l: "10+" }]} />
                    <Choice label="Open help-wanted issues" value={filters.minHelpWantedIssues} onChange={(v) => set({ minHelpWantedIssues: v })}
                      options={[{ v: 0, l: "any" }, { v: 1, l: "1+" }, { v: 3, l: "3+" }, { v: 10, l: "10+" }]} />
                    <Choice label="Pushed within" value={filters.pushedWithinDays} onChange={(v) => set({ pushedWithinDays: v })} options={WITHIN} />
                    <Choice label="License" value={filters.license} onChange={(v) => set({ license: v })}
                      options={[{ v: "", l: "any" }, { v: "mit", l: "MIT" }, { v: "apache-2.0", l: "Apache-2.0" }, { v: "gpl-3.0", l: "GPL-3.0" }, { v: "bsd-3-clause", l: "BSD-3" }]} />
                    <div style={{ marginTop: 10 }}>
                      <Switch label="Exclude forks" checked={filters.excludeForks} onChange={(v) => set({ excludeForks: v })} />
                    </div>
                  </div>
                  <div className="sec">
                    <div className="sec-h"><span className="cap">order</span></div>
                    <Choice label="Sort by" value={filters.repoSort} onChange={(v) => set({ repoSort: v })}
                      options={[{ v: "stars", l: "stars" }, { v: "updated", l: "updated" }, { v: "forks", l: "forks" }, { v: "help-wanted-issues", l: "help wanted" }]} />
                    <Choice label="Direction" value={filters.repoOrder} onChange={(v) => set({ repoOrder: v })}
                      options={[{ v: "asc", l: "small → big" }, { v: "desc", l: "big → small" }]} />
                  </div>
                </>
              )}

              <button type="button" className={`apply${dirty ? " dirty" : ""}`} disabled={loading} onClick={submit}>
                {loading ? "scanning…" : dirty ? "apply filters" : "rescan"}
              </button>
              <button type="button" className="reset" onClick={reset}>reset to defaults</button>
            </div>
          </aside>

          <section aria-label={view === "shortlist" ? "Shortlist" : "Results"} aria-busy={loading}>
            <div className="res-h">
              <h2>{view === "shortlist" ? "Your shortlist" : applied.mode === "issues" ? "Issues" : "Repositories"}</h2>
              <span className="cap">
                {view === "shortlist"
                  ? `${shortlist.length} saved`
                  : loading ? "scanning github…"
                  : scan.status === "done" ? `${scan.total} ${noun} · ${scan.searched.length} ${unit}${scan.searched.length === 1 ? "" : "s"} merged`
                  : "scan interrupted"}
              </span>
            </div>

            {view === "results" && scan.status === "done" && scan.failed.length > 0 && (
              <div className="note" role="status">
                <span className="mono">partial</span>
                <span>
                  {scan.searched.length - scan.failed.length} of {scan.searched.length} {unit} scans came back. GitHub turned away{" "}
                  <span className="mono">{scan.failed.join(", ")}</span>, most likely a rate limit. These are the results we do have; rescan in a minute for the rest.
                </span>
              </div>
            )}

            {view === "shortlist" ? (
              shortlist.length === 0 ? (
                <div className="state">
                  <span className="cap">shortlist · empty</span>
                  <h3>Nothing pinned to the board yet.</h3>
                  <p>Star an issue or repository and it lands here, saved in this browser, so you can compare before you commit.</p>
                  <button type="button" className="ghost" onClick={() => setView("results")}>back to results</button>
                </div>
              ) : (
                <div className="list">{showing.map(renderCard)}</div>
              )
            ) : loading ? (
              <div className="list" aria-label="Loading results">
                {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skel" style={{ animationDelay: `${i * 90}ms` }} />)}
              </div>
            ) : scan.status === "error" ? (
              <ErrorState error={scan.error} onRetry={submit} />
            ) : scan.items.length === 0 ? (
              <div className="state">
                <span className="cap">0 matches</span>
                <h3>The plan came back blank.</h3>
                <p>Nothing on GitHub fits every filter at once. That usually means one constraint is doing all the work.</p>
                <p>Try adding a second {unit}, widening the time window, or dropping the keyword.</p>
                <button type="button" className="ghost" onClick={reset}>reset filters and rescan</button>
              </div>
            ) : (
              <div className="list">{showing.map(renderCard)}</div>
            )}
          </section>
        </div>

        <footer className="foot">
          <span className="cap">mAke_a_diFF · data live from the GitHub REST API</span>
          <span className="cap">health = 40% merge rate · 40% review speed · 20% recency</span>
        </footer>
      </main>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  const status = error?.status;
  const copy =
    status === 429
      ? { tag: "rate limit", title: "GitHub asked us to slow down.", body: "We've made more searches than GitHub allows in a minute. Nothing is broken. Wait about sixty seconds and scan again; results you already loaded are cached." }
      : status === 422
        ? { tag: "filter too narrow", title: "GitHub couldn't read that combination.", body: "One of the filters produced a query GitHub rejects, usually an unusual language or licence name. Loosen it and rescan." }
        : status === 0
          ? { tag: "offline", title: "The line to the backend is down.", body: `${error.message} Start the Spring Boot server, then scan again.` }
          : { tag: "upstream error", title: "GitHub returned something unexpected.", body: `${error?.message || "No details came back."} This is usually temporary.` };
  return (
    <div className="state" role="alert">
      <span className="cap err">{copy.tag}</span>
      <h3>{copy.title}</h3>
      <p>{copy.body}</p>
      <button type="button" className="ghost" onClick={onRetry}>scan again</button>
    </div>
  );
}
