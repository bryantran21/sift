// Generates the company-browser page from src/data/companies.ts so the data is
// never duplicated. Emits Artifact-ready page content (no <html>/<head>/<body> —
// the Artifact host wraps those) to dist/company-browser.html.
//
//   pnpm build:browser
//
// Browser-side JS below is written with string concatenation (no template
// literals) so it never collides with this file's own template literal.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { companies, companyCounts } from '../src/data/companies';

const here = path.dirname(fileURLToPath(import.meta.url));

const counts = companyCounts();
const liveJobs = companies
  .filter((c) => c.status === 'live')
  .reduce((sum, c) => sum + (c.jobs ?? 0), 0);
const meta = { counts, liveJobs, generatedAt: new Date().toISOString().slice(0, 10) };

// Inlined favicons (base64 data URIs) from `pnpm build:logos`. Optional — the page
// falls back to monogram badges for any company without one.
let logosJson = '{}';
try {
  logosJson = readFileSync(path.join(here, '..', 'src', 'data', 'logos.json'), 'utf8');
} catch {
  console.warn('no logos.json — run `pnpm build:logos` for real icons (using monograms)');
}

const dataJson = JSON.stringify(companies).replace(/</g, '\\u003c');
const metaJson = JSON.stringify(meta).replace(/</g, '\\u003c');

const html = `<style>
  :root {
    /* light theme (fallback); dark is the product default below */
    --bg: #f7f8fa; --panel: #ffffff; --panel-2: #f1f3f6; --line: #e3e7ec;
    --ink: #1a1d23; --ink-2: #1a1d2308; --muted: #5b616b; --faint: #8b929c;
    --accent: #2563eb; --accent-2: #1d4ed8; --accent-ink: #ffffff; --accent-soft: #2563eb12;
    --live: #1a7f37; --pending: #9a6700; --blocked: #cf222e; --unknown: #6b7280;
    --live-soft: #e7f4ea; --pending-soft: #fbf3dc; --blocked-soft: #fce8ea; --unknown-soft: #eef0f3;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0b0c0e; --panel: #131519; --panel-2: #181b20; --line: #262a31;
      --ink: #e9ebee; --ink-2: #ffffff0b; --muted: #98a0ab; --faint: #6b7480;
      --accent: #2f6df6; --accent-2: #6ea8ff; --accent-ink: #ffffff; --accent-soft: #2f6df61f;
      --live: #46c46a; --pending: #e0b23c; --blocked: #f0616d; --unknown: #8a919c;
      --live-soft: #46c46a1c; --pending-soft: #e0b23c1c; --blocked-soft: #f0616d1c; --unknown-soft: #8a919c1f;
    }
  }
  :root[data-theme="light"] {
    --bg: #f7f8fa; --panel: #ffffff; --panel-2: #f1f3f6; --line: #e3e7ec;
    --ink: #1a1d23; --ink-2: #1a1d2308; --muted: #5b616b; --faint: #8b929c;
    --accent: #2563eb; --accent-2: #1d4ed8; --accent-ink: #ffffff; --accent-soft: #2563eb12;
    --live: #1a7f37; --pending: #9a6700; --blocked: #cf222e; --unknown: #6b7280;
    --live-soft: #e7f4ea; --pending-soft: #fbf3dc; --blocked-soft: #fce8ea; --unknown-soft: #eef0f3;
  }
  :root[data-theme="dark"] {
    --bg: #0b0c0e; --panel: #131519; --panel-2: #181b20; --line: #262a31;
    --ink: #e9ebee; --ink-2: #ffffff0b; --muted: #98a0ab; --faint: #6b7480;
    --accent: #2f6df6; --accent-2: #6ea8ff; --accent-ink: #ffffff; --accent-soft: #2f6df61f;
    --live: #46c46a; --pending: #e0b23c; --blocked: #f0616d; --unknown: #8a919c;
    --live-soft: #46c46a1c; --pending-soft: #e0b23c1c; --blocked-soft: #f0616d1c; --unknown-soft: #8a919c1f;
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); }
  .wrap {
    min-height: 100vh;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: var(--ink); background: var(--bg);
    max-width: 1120px; margin: 0 auto; padding: 32px 24px 64px;
    font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased;
    accent-color: var(--accent);
  }
  .mono { font-family: ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Consolas, monospace; font-variant-numeric: tabular-nums; }

  .brand { display: flex; align-items: center; gap: 9px; margin-bottom: 18px; }
  .mark { font-weight: 700; letter-spacing: -0.02em; font-size: 15px; color: var(--ink); }
  .brand .sep { width: 3px; height: 3px; border-radius: 50%; background: var(--accent-2); }
  .kicker { text-transform: uppercase; letter-spacing: 0.14em; font-size: 10.5px; color: var(--faint); }
  h1 { font-size: 24px; line-height: 1.2; letter-spacing: -0.02em; margin: 0 0 8px; text-wrap: balance; }
  .lede { margin: 0; color: var(--muted); max-width: 66ch; font-size: 13.5px; }
  .lede b { color: var(--ink); font-weight: 600; }

  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 26px 0 22px; }
  .tile { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 14px 16px; display: flex; flex-direction: column; gap: 3px; }
  .tile .n { font-size: 26px; font-weight: 650; letter-spacing: -0.02em; }
  .tile .k { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--faint); }
  .tile .s { font-size: 11.5px; color: var(--muted); }
  .tile.live .n { color: var(--live); }
  .tile.pending .n { color: var(--pending); }
  .tile.cold .n { color: var(--unknown); }

  .tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid var(--line); margin-bottom: 16px; }
  .tab { appearance: none; background: none; border: none; border-bottom: 2px solid transparent; color: var(--muted); font: inherit; font-size: 13px; padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 7px; margin-bottom: -1px; transition: color .12s; }
  .tab:hover { color: var(--ink); }
  .tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--accent); font-weight: 600; }
  .tab .c { font-size: 11px; color: var(--faint); background: var(--panel-2); border: 1px solid var(--line); border-radius: 20px; padding: 1px 7px; }
  .tab[aria-selected="true"] .c { color: var(--accent-2); border-color: var(--accent-soft); }

  .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { appearance: none; font: inherit; font-size: 12px; cursor: pointer; border: 1px solid var(--line); background: var(--panel); color: var(--muted); border-radius: 20px; padding: 4px 11px 4px 9px; display: inline-flex; align-items: center; gap: 6px; transition: background .12s, color .12s, border-color .12s; }
  .chip .dot { width: 7px; height: 7px; border-radius: 50%; }
  .chip[aria-pressed="true"] { color: var(--ink); background: var(--panel-2); border-color: var(--faint); }
  .chip[aria-pressed="false"] { opacity: .5; }
  .search { margin-left: auto; position: relative; }
  .search input { font: inherit; font-size: 13px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 7px; padding: 7px 11px 7px 30px; width: 230px; outline: none; transition: border-color .12s; }
  .search input:focus { border-color: var(--accent); }
  .search input::placeholder { color: var(--faint); }
  .search .ic { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--faint); font-size: 13px; pointer-events: none; }

  /* selection bar */
  .selbar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 9px 4px; margin-bottom: 10px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .selcount { font-size: 12.5px; color: var(--muted); }
  .selcount b { color: var(--accent-2); font-weight: 650; }
  .selactions { display: flex; gap: 6px; margin-left: auto; flex-wrap: wrap; }
  .lbtn { appearance: none; font: inherit; font-size: 12px; cursor: pointer; border: 1px solid var(--line); background: var(--panel); color: var(--muted); border-radius: 6px; padding: 5px 11px; transition: background .12s, color .12s, border-color .12s; }
  .lbtn:hover { color: var(--ink); border-color: var(--faint); }
  .lbtn[aria-pressed="true"] { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); }
  .lbtn.primary { color: var(--accent-2); border-color: var(--accent-soft); }
  .lbtn:disabled { opacity: .45; cursor: default; }

  .exportwrap { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); margin-bottom: 14px; overflow: hidden; }
  .exporthead { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--muted); background: var(--panel-2); }
  .exportwrap textarea { width: 100%; border: none; background: var(--panel); color: var(--ink); font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.5; padding: 12px; resize: vertical; min-height: 150px; outline: none; }

  .tablewrap { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--panel); }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; min-width: 760px; }
  thead th { position: sticky; top: 0; background: var(--panel-2); text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.09em; color: var(--faint); font-weight: 600; padding: 10px 14px; border-bottom: 1px solid var(--line); white-space: nowrap; }
  th.sortable { cursor: pointer; user-select: none; }
  th.sortable:hover { color: var(--muted); }
  th .arrow { color: var(--accent-2); font-size: 9px; margin-left: 3px; }
  th.num, td.num { text-align: right; }
  th.cbcol, td.cbcol { width: 34px; padding-left: 14px; padding-right: 0; text-align: center; }
  td.cbcol input, th.cbcol input { cursor: pointer; width: 15px; height: 15px; vertical-align: middle; }
  tbody td { padding: 11px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: var(--ink-2); }
  tbody tr.cold td { opacity: .6; }
  tbody tr.sel td { background: var(--accent-soft); }
  tbody tr.sel:hover td { background: var(--accent-soft); }
  .corow { display: flex; align-items: center; gap: 10px; }
  .ico { width: 18px; height: 18px; border-radius: 4px; flex: none; object-fit: contain; }
  .mono-ico { display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; font-weight: 600; }
  .cocell { min-width: 0; }
  .co { font-weight: 550; color: var(--ink); text-decoration: none; }
  a.co:hover { color: var(--accent-2); text-decoration: underline; }
  .ext { color: var(--faint); font-size: 10px; margin-left: 4px; }
  a.co:hover .ext { color: var(--accent-2); }
  .sub { font-size: 11.5px; color: var(--faint); margin-top: 1px; }
  .src { font-size: 12px; color: var(--muted); }
  .src .slug { color: var(--faint); }

  .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 2px 9px; border-radius: 20px; white-space: nowrap; }
  .pill .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
  .st-live { color: var(--live); background: var(--live-soft); } .st-live .dot { background: var(--live); }
  .st-pending { color: var(--pending); background: var(--pending-soft); } .st-pending .dot { background: var(--pending); }
  .st-blocked { color: var(--blocked); background: var(--blocked-soft); } .st-blocked .dot { background: var(--blocked); }
  .st-unknown { color: var(--unknown); background: var(--unknown-soft); } .st-unknown .dot { background: var(--unknown); }
  .eta { color: var(--faint); font-size: 11px; margin-left: 2px; }

  .tag { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 8px; border-radius: 5px; border: 1px solid var(--line); background: var(--panel-2); color: var(--muted); white-space: nowrap; }
  .tier { font-size: 11px; padding: 1px 7px; border-radius: 5px; border: 1px solid var(--line); color: var(--muted); }
  .tier.t1 { color: var(--accent-2); border-color: var(--accent-soft); }
  .jobs { color: var(--ink); }
  .jobs.zero, .jobs.na { color: var(--faint); }

  .empty { padding: 40px; text-align: center; color: var(--muted); font-size: 13px; }
  .showing { font-size: 11.5px; color: var(--faint); padding: 9px 14px; border-top: 1px solid var(--line); background: var(--panel-2); }

  .legend { margin-top: 22px; display: flex; flex-wrap: wrap; gap: 18px 26px; }
  .legend .item { display: flex; gap: 8px; align-items: baseline; font-size: 12px; color: var(--muted); max-width: 250px; }
  .note { margin-top: 16px; font-size: 12px; color: var(--faint); border-top: 1px solid var(--line); padding-top: 14px; max-width: 82ch; }
  .note code { font-family: ui-monospace, monospace; color: var(--muted); }

  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  @media (max-width: 720px) {
    .stats { grid-template-columns: repeat(2, 1fr); }
    .search { margin-left: 0; width: 100%; } .search input { width: 100%; }
    .selactions { margin-left: 0; }
  }
</style>

<main class="wrap">
  <div class="brand"><span class="mark">sift</span><span class="sep"></span><span class="kicker">company radar</span></div>
  <h1>The company universe</h1>
  <p class="lede">Every firm on your radar, grouped by tag. <b>Live</b> boards are ingesting now; the rest show why they aren't and what unlocks them. Tick companies to build your list — it's remembered on this device.</p>

  <section class="stats" id="stats"></section>
  <nav class="tabs" id="tabs" role="tablist" aria-label="Filter by tag"></nav>
  <div class="toolbar">
    <div class="chips" id="statusFilter" aria-label="Filter by status"></div>
    <div class="search"><span class="ic">⌕</span><input id="search" type="search" placeholder="Search  ( / )" aria-label="Search companies" autocomplete="off" /></div>
  </div>

  <div class="selbar">
    <span class="selcount" id="selcount">None selected</span>
    <div class="selactions">
      <button class="lbtn" id="selOnly" aria-pressed="false">Selected only</button>
      <button class="lbtn primary" id="selExport">Export to sources.yaml</button>
      <button class="lbtn" id="selClear">Clear</button>
    </div>
  </div>
  <div class="exportwrap" id="exportwrap" hidden>
    <div class="exporthead"><span id="exporttitle"></span><button class="lbtn" id="exportCopy">Copy</button></div>
    <textarea id="exporttext" readonly spellcheck="false"></textarea>
  </div>

  <div class="tablewrap">
    <div class="scroll"><table><thead><tr id="head"></tr></thead><tbody id="body"></tbody></table></div>
    <div class="showing" id="showing"></div>
  </div>

  <section class="legend" id="legend"></section>
  <p class="note" id="note"></p>
</main>

<script>
const COMPANIES = ${dataJson};
const META = ${metaJson};
const LOGOS = ${logosJson};
const SEL_KEY = "sift.selected.v1";

const TAGS = [
  { key: "all", label: "All" },
  { key: "quant", label: "Quant" },
  { key: "big-tech", label: "Big Tech" },
  { key: "fortune-500", label: "Fortune 500" },
  { key: "college", label: "College" }
];
const STATUSES = [
  { key: "live", label: "Live", desc: "Verified JSON board + adapter exists — ingesting now." },
  { key: "pending", label: "Pending", desc: "On a supported ATS; adapter is still coming (see ETA)." },
  { key: "blocked", label: "Blocked", desc: "Custom / Taleo / iCIMS site, no JSON API — out of scope." },
  { key: "unknown", label: "Unknown", desc: "No board found at common slugs; ATS unconfirmed." }
];
const TAG_LABEL = { "quant": "Quant", "big-tech": "Big Tech", "fortune-500": "Fortune 500", "college": "College" };
const RANK = { live: 0, pending: 1, unknown: 2, blocked: 3 };
const COLS = [
  { key: "company", label: "Company", sortable: true },
  { key: "tag", label: "Tag", sortable: false },
  { key: "source", label: "Source", sortable: false },
  { key: "status", label: "Status", sortable: true },
  { key: "tier", label: "Tier", sortable: true, num: true },
  { key: "jobs", label: "Open roles", sortable: true, num: true }
];

let SELECTED;
try { SELECTED = new Set(JSON.parse(localStorage.getItem(SEL_KEY) || "[]")); } catch (e) { SELECTED = new Set(); }
const state = { tag: "all", statuses: new Set(["live", "pending", "blocked", "unknown"]), q: "", sortKey: "default", sortDir: 1, selectedOnly: false };

function saveSel() { try { localStorage.setItem(SEL_KEY, JSON.stringify(Array.from(SELECTED))); } catch (e) {} }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function renderStats() {
  const c = META.counts;
  const cold = c.byStatus.blocked + c.byStatus.unknown;
  const tiles = [
    { cls: "", n: c.total, k: "Companies", s: "quant · big tech · F500" },
    { cls: "live", n: c.byStatus.live, k: "Live now", s: META.liveJobs.toLocaleString() + " open roles" },
    { cls: "pending", n: c.byStatus.pending, k: "Adapter pending", s: "Ashby (Phase 2)" },
    { cls: "cold", n: cold, k: "Not ingestable", s: c.byStatus.blocked + " blocked · " + c.byStatus.unknown + " unknown" }
  ];
  document.getElementById("stats").innerHTML = tiles.map(function (t) {
    return '<div class="tile ' + t.cls + '"><span class="n mono">' + t.n + '</span><span class="k">' + t.k + '</span><span class="s">' + esc(t.s) + '</span></div>';
  }).join("");
}

function renderTabs() {
  document.getElementById("tabs").innerHTML = TAGS.map(function (t) {
    const n = t.key === "all" ? COMPANIES.length : COMPANIES.filter(function (c) { return c.tag === t.key; }).length;
    return '<button class="tab" role="tab" aria-selected="' + (state.tag === t.key) + '" data-tag="' + t.key + '">' + t.label + '<span class="c mono">' + n + '</span></button>';
  }).join("");
}

function renderChips() {
  document.getElementById("statusFilter").innerHTML = STATUSES.map(function (s) {
    return '<button class="chip" aria-pressed="' + state.statuses.has(s.key) + '" data-status="' + s.key + '" title="' + esc(s.desc) + '"><span class="dot" style="background:var(--' + s.key + ')"></span>' + s.label + '</button>';
  }).join("");
}

function renderHead() {
  let html = '<th class="cbcol"><input type="checkbox" id="master" aria-label="Select all shown" /></th>';
  html += COLS.map(function (col) {
    const active = state.sortKey === col.key;
    const arrow = active ? '<span class="arrow">' + (state.sortDir > 0 ? "▲" : "▼") + "</span>" : "";
    const cls = (col.num ? "num " : "") + (col.sortable ? "sortable" : "");
    const attr = col.sortable ? ' data-sort="' + col.key + '" tabindex="0" role="button"' : "";
    return '<th class="' + cls.trim() + '"' + attr + ">" + col.label + arrow + "</th>";
  }).join("");
  document.getElementById("head").innerHTML = html;
}

function passes(c) {
  if (state.tag !== "all" && c.tag !== state.tag) return false;
  if (!state.statuses.has(c.status)) return false;
  if (state.selectedOnly && !SELECTED.has(c.name)) return false;
  if (state.q) {
    const hay = (c.name + " " + (c.industry || "") + " " + c.ats + " " + (c.slug || "")).toLowerCase();
    if (hay.indexOf(state.q) === -1) return false;
  }
  return true;
}

function cmp(a, b) {
  const d = state.sortDir;
  if (state.sortKey === "company") return a.name.localeCompare(b.name) * d;
  if (state.sortKey === "tier") return (a.tier - b.tier) * d || a.name.localeCompare(b.name);
  if (state.sortKey === "status") return (RANK[a.status] - RANK[b.status]) * d || a.name.localeCompare(b.name);
  if (state.sortKey === "jobs") {
    const aj = a.jobs == null ? -1 : a.jobs, bj = b.jobs == null ? -1 : b.jobs;
    return (aj - bj) * d || a.name.localeCompare(b.name);
  }
  return RANK[a.status] - RANK[b.status] || a.tier - b.tier || (b.jobs || 0) - (a.jobs || 0) || a.name.localeCompare(b.name);
}

function statusPill(c) {
  const label = c.status.charAt(0).toUpperCase() + c.status.slice(1);
  const eta = c.status === "pending" && c.eta ? '<span class="eta">' + esc(c.eta) + "</span>" : "";
  return '<span class="pill st-' + c.status + '"><span class="dot"></span>' + label + "</span>" + eta;
}
function boardUrl(c) {
  if (c.status === "live") {
    if (c.ats === "greenhouse" && c.slug) return "https://job-boards.greenhouse.io/" + c.slug;
    if (c.ats === "workday" && c.tenant) return "https://" + c.tenant + ".wd" + c.shard + ".myworkdayjobs.com/" + c.site;
  }
  return c.domain ? "https://" + c.domain : null;
}
function iconHtml(c) {
  const logo = LOGOS[c.name];
  if (logo) return '<img class="ico" src="' + logo + '" alt="" loading="lazy" />';
  const s = c.name.replace(/[^A-Za-z0-9]/g, "");
  const ch = (s ? s.charAt(0) : "?").toUpperCase();
  let h = 0; for (let i = 0; i < c.name.length; i++) h = (h * 31 + c.name.charCodeAt(i)) % 360;
  return '<span class="ico mono-ico" style="background:hsl(' + h + ',36%,42%)">' + ch + "</span>";
}
function companyCell(c) {
  const url = boardUrl(c);
  const name = esc(c.name);
  const nameHtml = url
    ? '<a class="co" href="' + url + '" target="_blank" rel="noopener">' + name + '<span class="ext">↗</span></a>'
    : '<span class="co">' + name + "</span>";
  const cold = c.status === "blocked" || c.status === "unknown";
  const sub = c.industry ? '<div class="sub">' + esc(c.industry) + "</div>" : (c.note && cold ? '<div class="sub">' + esc(c.note) + "</div>" : "");
  return '<div class="corow">' + iconHtml(c) + '<div class="cocell">' + nameHtml + sub + "</div></div>";
}
function sourceCell(c) {
  if (c.slug) return '<span class="src">' + esc(c.ats) + ' <span class="slug">/' + esc(c.slug) + "</span></span>";
  return '<span class="src">' + esc(c.ats) + "</span>";
}
function jobsCell(c) {
  if (c.status === "live") return '<span class="jobs' + (c.jobs === 0 ? " zero" : "") + ' mono">' + (c.jobs == null ? "0" : c.jobs) + "</span>";
  return '<span class="jobs na mono">—</span>';
}

function render() {
  const rows = COMPANIES.filter(passes).sort(cmp);
  const body = document.getElementById("body");
  if (rows.length === 0) {
    body.innerHTML = '<tr><td colspan="7"><div class="empty">No companies match these filters.</div></td></tr>';
  } else {
    body.innerHTML = rows.map(function (c) {
      const cold = c.status === "blocked" || c.status === "unknown";
      const on = SELECTED.has(c.name);
      return '<tr class="' + (cold ? "cold " : "") + (on ? "sel" : "") + '" title="' + esc(c.note || "") + '">' +
        '<td class="cbcol"><input type="checkbox" data-name="' + esc(c.name) + '"' + (on ? " checked" : "") + ' aria-label="Select ' + esc(c.name) + '" /></td>' +
        "<td>" + companyCell(c) + "</td>" +
        '<td><span class="tag">' + TAG_LABEL[c.tag] + "</span></td>" +
        "<td>" + sourceCell(c) + "</td>" +
        "<td>" + statusPill(c) + "</td>" +
        '<td class="num"><span class="tier t' + c.tier + '">T' + c.tier + "</span></td>" +
        '<td class="num">' + jobsCell(c) + "</td></tr>";
    }).join("");
  }
  document.getElementById("showing").textContent = "Showing " + rows.length + " of " + COMPANIES.length + " companies";
  document.querySelectorAll(".tab").forEach(function (el) { el.setAttribute("aria-selected", String(el.dataset.tag === state.tag)); });
  renderHead();
  const master = document.getElementById("master");
  if (master) {
    const shown = rows.length, picked = rows.filter(function (c) { return SELECTED.has(c.name); }).length;
    master.checked = shown > 0 && picked === shown;
    master.indeterminate = picked > 0 && picked < shown;
  }
  renderSelbar();
}

function renderSelbar() {
  const n = SELECTED.size;
  const live = Array.from(SELECTED).filter(function (name) { const c = byName(name); return c && c.status === "live"; }).length;
  document.getElementById("selcount").innerHTML = n === 0 ? "None selected" : "<b>" + n + "</b> selected · " + live + " ingestable";
  document.getElementById("selClear").disabled = n === 0;
  document.getElementById("selExport").disabled = live === 0;
  document.getElementById("selOnly").setAttribute("aria-pressed", String(state.selectedOnly));
}

function byName(name) { for (let i = 0; i < COMPANIES.length; i++) if (COMPANIES[i].name === name) return COMPANIES[i]; return null; }

function buildYaml() {
  const chosen = COMPANIES.filter(function (c) { return SELECTED.has(c.name); });
  const live = chosen.filter(function (c) { return c.status === "live"; });
  const skipped = chosen.filter(function (c) { return c.status !== "live"; });
  const lines = ["# " + live.length + " live board(s) — paste into sources.yaml", ""];
  live.forEach(function (c) {
    lines.push("- company: " + c.name);
    lines.push("  ats: " + c.ats);
    lines.push("  slug: " + (c.slug || ""));
    lines.push("  tier: " + c.tier);
    lines.push("  tags: [" + c.tag + "]");
    if (c.ats === "workday") {
      lines.push("  tenant: " + c.tenant);
      lines.push('  shard: "' + c.shard + '"');
      lines.push("  site: " + c.site);
    }
    lines.push("");
  });
  if (skipped.length) lines.push("# Not ingestable yet, omitted: " + skipped.map(function (c) { return c.name; }).join(", "));
  return lines.join("\\n");
}

// events
document.getElementById("tabs").addEventListener("click", function (e) { const b = e.target.closest(".tab"); if (b) { state.tag = b.dataset.tag; render(); } });
document.getElementById("statusFilter").addEventListener("click", function (e) {
  const b = e.target.closest(".chip"); if (!b) return;
  const k = b.dataset.status;
  if (state.statuses.has(k)) state.statuses.delete(k); else state.statuses.add(k);
  if (state.statuses.size === 0) state.statuses.add(k);
  b.setAttribute("aria-pressed", String(state.statuses.has(k)));
  render();
});
const head = document.getElementById("head");
head.addEventListener("click", function (e) { const th = e.target.closest("th.sortable"); if (th) sortBy(th.dataset.sort); });
head.addEventListener("keydown", function (e) { if (e.key !== "Enter" && e.key !== " ") return; const th = e.target.closest("th.sortable"); if (th) { e.preventDefault(); sortBy(th.dataset.sort); } });
head.addEventListener("change", function (e) {
  if (e.target.id !== "master") return;
  const rows = COMPANIES.filter(passes);
  const allOn = rows.every(function (c) { return SELECTED.has(c.name); });
  rows.forEach(function (c) { if (allOn) SELECTED.delete(c.name); else SELECTED.add(c.name); });
  saveSel(); render();
});
document.getElementById("body").addEventListener("change", function (e) {
  const cb = e.target.closest("input[type=checkbox]"); if (!cb || !cb.dataset.name) return;
  if (cb.checked) SELECTED.add(cb.dataset.name); else SELECTED.delete(cb.dataset.name);
  saveSel(); render();
});
function sortBy(key) {
  if (state.sortKey === key) state.sortDir *= -1;
  else { state.sortKey = key; state.sortDir = key === "company" ? 1 : -1; }
  render();
}
document.getElementById("search").addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); render(); });
document.addEventListener("keydown", function (e) { if (e.key === "/" && document.activeElement.id !== "search") { e.preventDefault(); document.getElementById("search").focus(); } });
document.getElementById("selOnly").addEventListener("click", function () { state.selectedOnly = !state.selectedOnly; render(); });
document.getElementById("selClear").addEventListener("click", function () { SELECTED.clear(); saveSel(); if (state.selectedOnly) state.selectedOnly = false; document.getElementById("exportwrap").hidden = true; render(); });
document.getElementById("selExport").addEventListener("click", function () {
  const yaml = buildYaml();
  const live = Array.from(SELECTED).filter(function (name) { const c = byName(name); return c && c.status === "live"; }).length;
  document.getElementById("exporttitle").textContent = "sources.yaml — " + live + " live board(s)";
  document.getElementById("exporttext").value = yaml;
  document.getElementById("exportwrap").hidden = false;
  document.getElementById("exporttext").focus();
  document.getElementById("exporttext").select();
});
document.getElementById("exportCopy").addEventListener("click", function () {
  const ta = document.getElementById("exporttext");
  ta.focus(); ta.select();
  const btn = document.getElementById("exportCopy");
  function done() { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1400); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, function () { try { document.execCommand("copy"); done(); } catch (e) {} });
  else { try { document.execCommand("copy"); done(); } catch (e) {} }
});

function renderLegend() {
  document.getElementById("legend").innerHTML = STATUSES.map(function (s) {
    return '<div class="item"><span class="pill st-' + s.key + '"><span class="dot"></span>' + s.label + "</span><span>" + esc(s.desc) + "</span></div>";
  }).join("");
  document.getElementById("note").innerHTML =
    "Company names link out to the live board (or the company site) — that's where the open positions are. " +
    "Live boards feed <code>sources.yaml</code> and the ingest directly, across Greenhouse and Workday (NVIDIA, Salesforce, Mastercard, Target, CMU). " +
    "Among colleges, only <b>CMU</b> is on a public Workday board; Stanford &amp; UC Berkeley run Oracle/UCPath and Georgia Tech is on Trakstar, so they can't be ingested. " +
    "Pending boards unlock with the Ashby adapter (OpenAI, Ramp) in Phase 2. " +
    "Generated " + META.generatedAt + " from src/data/companies.ts.";
}

renderStats();
renderTabs();
renderChips();
renderLegend();
render();
</script>`;

const outDir = path.join(here, '..', 'dist');
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'company-browser.html');
writeFileSync(outPath, html, 'utf8');
console.log('wrote', outPath, `(${companies.length} companies, ${(html.length / 1024).toFixed(1)}kb)`);
