// npm run report [-- runs/<file>.json]   (default: the newest run log)
// Writes reports/<date>.pdf: the morning report for Lasse. What was added, how each
// agent did, what needs his attention, what comes next, and the web at a glance.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { ROOT, PICTURES, TYPES, RELATIONS, loadAll, loadRuns, relationEdges, wantedList, findChromium } from "./lib.mjs";
import { anchorYear } from "./layout.mjs";

const SITE = "https://rosengaard98.github.io/menswear-atlas/";
const { runs, errors: runErrors } = loadRuns();
if (runErrors.length) { console.error(runErrors.join("\n")); process.exit(1); }
const arg = process.argv[2];
const run = arg ? runs.find((r) => r.file === path.basename(arg)) : runs.find((r) => r.kind !== "gardener") ?? runs[0];
if (!run) { console.error("No run log found in runs/. The curator writes one before the report."); process.exit(1); }

const { nodes } = loadAll();
const edges = relationEdges(nodes);
const wanted = wantedList(nodes);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const say = (n) => (n >= 0 && n <= 10 ? words[n] : String(n));
const years = (p) => (!p || p.from == null ? "" : p.to == null ? `${p.from} to today` : p.to === p.from ? `${p.from}` : `${p.from}–${p.to}`);
const dateLong = new Date(run.date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// what was added: the run's topics, or entries dated that day
const ids = (run.topics ?? []).filter((t) => ["added", "changed"].includes(t.outcome) && nodes.has(t.id)).map((t) => t.id);
const fresh = (ids.length ? ids : [...nodes.values()].filter((n) => n.added === run.date).map((n) => n.id)).map((id) => nodes.get(id));
const dropped = (run.topics ?? []).filter((t) => t.outcome === "dropped" || t.outcome === "folded");
const before = run.totals?.before ?? {}, after = run.totals?.after ?? {};
const newThreads = (after.relations ?? 0) - (before.relations ?? 0);

// pictures, as they hang on the site
const svgOf = (n) => {
  const p = n.picture;
  if (p?.kind === "drawing" && p._svg && p._viewBox) return p._svg.replace(/viewBox="[^"]*"/, `viewBox="${p._viewBox.join(" ")}" preserveAspectRatio="xMidYMid meet"`);
  if (!p && n.views?.length) return n.views[0]._svg;
  return null;
};
function picture(n) {
  const p = n.picture;
  const mono = `<span class="mono"><span>${esc(n.name.replace(/^The\s+/i, "").charAt(0))}</span></span>`;
  if (p?.kind === "archival") {
    const src = p.file ? "file://" + path.join(PICTURES, p.file) : p.url;
    return `<img class="print" src="${esc(src)}" alt="" onerror="this.outerHTML='${mono.replace(/'/g, "\\'")}'">`;
  }
  return svgOf(n) ?? mono;
}
function threadsOf(id) {
  const out = [];
  for (const e of edges) {
    if (e.kind === "belongs-to-era") continue;
    if (e.from === id) out.push(`${RELATIONS[e.kind].label} ${nameOf(e.to)}`);
    else if (e.to === id) out.push(`${RELATIONS[e.kind].inverseLabel} ${nameOf(e.from)}`);
  }
  return out;
}
const nameOf = (id) => nodes.get(id)?.name ?? wanted.find((w) => w.id === id)?.label ?? id;

const freshHTML = fresh.length ? fresh.map((n) => `
  <div class="entry">
    <div class="frame"><div class="mat">${picture(n)}</div></div>
    <div class="entry-text">
      <p class="kind">${esc(TYPES[n.type]?.one ?? n.type)}${years(n.period) ? `, ${esc(years(n.period))}` : ""}${n.regions?.length ? `, ${esc(n.regions.join(", "))}` : ""}</p>
      <h3><a href="${SITE}#${esc(n.id)}">${esc(n.name)}</a></h3>
      <p>${esc(n.summary)}</p>
      ${threadsOf(n.id).length ? `<p class="threads">${threadsOf(n.id).slice(0, 8).map(esc).join("; ")}.</p>` : ""}
      <p class="meta">${n.sources.length} sources${n.picture?.kind === "archival" ? `; picture: ${esc(n.picture.title)}, ${esc(n.picture.licence)}` : n.picture || n.views?.length ? "; picture: drawing" : "; no picture yet"}</p>
    </div>
  </div>`).join("") : `<p class="quiet">Nothing new was added on this run.</p>`;

const ROLE = { curator: "Curator", researcher: "Researcher", writer: "Writer", weaver: "Weaver", illustrator: "Illustrator", "fact-checker": "Fact-checker", "visual-reviewer": "Visual reviewer", tester: "Tester", gardener: "Gardener" };
const nums = (o) => (o ? Object.entries(o).map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()} ${v}`).join(", ") : "");
const agentRows = run.agents.map((a) => `<tr>
  <td>${esc(ROLE[a.role] ?? a.role)}${a.topic ? `<div class="small">${esc(a.topic)}</div>` : ""}</td>
  <td class="small">${esc(a.model ?? "")}</td>
  <td><span class="pill ${esc(a.status)}">${esc(a.status)}</span></td>
  <td>${esc(a.summary)}${a.numbers ? `<div class="small">${esc(nums(a.numbers))}</div>` : ""}${a.problems?.length ? `<ul>${a.problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}</td></tr>`).join("");

const attention = [
  ...dropped.map((t) => `${t.outcome === "folded" ? "Folded" : "Dropped"} <b>${esc(t.id)}</b>${t.reason ? `: ${esc(t.reason)}` : ""}`),
  ...run.agents.filter((a) => a.status === "failed").map((a) => `<b>${esc(ROLE[a.role])}</b> failed: ${esc(a.summary)}`),
  ...(run.notes ?? []).map(esc),
];

// next up, from the backlog and the queue
const backlog = fs.existsSync(path.join(ROOT, "BACKLOG.md")) ? fs.readFileSync(path.join(ROOT, "BACKLOG.md"), "utf8") : "";
const nextUp = (backlog.split(/^## Next up\s*$/m)[1] ?? "").split(/^## /m)[0].split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2)).slice(0, 5);

// the web at a glance: entries per decade, and regions
const decades = {};
for (let d = 1770; d <= 2020; d += 10) decades[d] = 0;
for (const n of nodes.values()) { const y = n.type === "era" ? null : anchorYear(n); if (y != null) decades[Math.max(1770, Math.min(2020, Math.floor(y / 10) * 10))]++; }
const maxD = Math.max(1, ...Object.values(decades));
const bars = Object.entries(decades).map(([d, v], i) => `<rect x="${i * 24 + 2}" y="${70 - (v / maxD) * 60}" width="18" height="${(v / maxD) * 60}" class="bar"/>${Number(d) % 50 === 0 ? `<text x="${i * 24 + 11}" y="86" text-anchor="middle" class="axis">${d}</text>` : ""}`).join("");
const regionCounts = {};
for (const n of nodes.values()) for (const r of n.regions ?? []) regionCounts[r] = (regionCounts[r] ?? 0) + 1;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Morning report ${esc(run.date)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..700;1,400..700&display=swap">
<style>
  @page { size: A4; margin: 16mm 16mm 18mm; }
  :root { --ink: #221e18; --soft: #625949; --rule: #d3c7b0; --green: #1f3b2d; --brass: #a8864d; --ox: #712530; --mat: #f5efe2; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "EB Garamond", Garamond, Georgia, serif; color: var(--ink); font-size: 11.5pt; line-height: 1.42; }
  a { color: var(--ox); text-decoration: none; }
  .mast { display: flex; justify-content: space-between; align-items: baseline; }
  .mast .word { font-style: italic; font-size: 20pt; font-weight: 500; }
  .mast .date { color: var(--soft); }
  .tie { height: 5px; margin: 4px 0 14px; background: repeating-linear-gradient(-45deg, #712530 0 5px, #1f3b2d 5px 11px, #b8945a 11px 12.5px, #1f3b2d 12.5px 18px); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { font-weight: 400; font-size: 21pt; line-height: 1.15; margin: 0 0 6px; }
  h2 { font-weight: 500; font-size: 14pt; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid var(--rule); break-after: avoid; }
  .totals { display: flex; gap: 22px; color: var(--soft); margin-bottom: 4px; font-variant-numeric: lining-nums; }
  .totals b { color: var(--ink); font-weight: 600; }
  .entry { display: grid; grid-template-columns: 30mm 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--rule); break-inside: avoid; }
  .frame { width: 30mm; height: 37.5mm; padding: 2mm; background: linear-gradient(135deg, #d7b77a, #8d6a35 45%, #caa564 70%, #7a5a2b); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .mat { width: 100%; height: 100%; background: var(--mat); overflow: hidden; display: grid; place-items: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .mat svg, .mat img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
  .print { filter: grayscale(1) sepia(.42) contrast(1.04); }
  .mono { width: 62%; aspect-ratio: 3/4; border-radius: 50%; border: 1px solid var(--brass); box-shadow: 0 0 0 2px var(--mat), 0 0 0 3px var(--brass); display: grid; place-items: center; font-style: italic; font-size: 20pt; color: var(--green); }
  .entry h3 { margin: 0 0 2px; font-weight: 500; font-size: 13.5pt; }
  .entry p { margin: 0 0 3px; }
  .kind, .meta, .small { color: var(--soft); font-size: 9.5pt; }
  .kind { font-variant-caps: all-small-caps; letter-spacing: .05em; }
  .threads { font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  th { text-align: left; font-weight: 500; color: var(--soft); font-size: 9.5pt; border-bottom: 1px solid var(--rule); padding: 3px 6px 3px 0; }
  td { vertical-align: top; border-bottom: 1px solid var(--rule); padding: 5px 8px 5px 0; }
  tr { break-inside: avoid; }
  td ul, .list { margin: 3px 0 0; padding-left: 14px; color: var(--soft); }
  .pill { font-size: 8.5pt; padding: 0 6px; border-radius: 9px; border: 1px solid; font-variant-caps: all-small-caps; letter-spacing: .05em; white-space: nowrap; }
  .pill.ok { color: var(--green); } .pill.partial { color: var(--brass); } .pill.failed { color: var(--ox); } .pill.skipped { color: var(--soft); }
  .quiet { color: var(--soft); font-style: italic; }
  .cols { display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; break-inside: avoid; }
  .bar { fill: var(--green); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .axis { font-size: 15px; fill: var(--soft); font-family: inherit; }
  .foot { margin-top: 16px; color: var(--soft); font-size: 9.5pt; }
  .cloth { fill: #fbf8f0; stroke: #2b251d; stroke-width: 2.2; stroke-linejoin: round; }
  .cloth-alt { fill: #e9e0cc; stroke: #2b251d; stroke-width: 1.6; }
  .shade { fill: #d8ccb2; } .line { fill: none; stroke: #2b251d; stroke-width: 2.2; }
  .seam { fill: none; stroke: #2b251d; stroke-width: 1.1; stroke-dasharray: 4 3; }
  .fold { fill: none; stroke: #2b251d; stroke-width: 1; stroke-opacity: .4; }
  .guide { fill: none; stroke: #7b6e58; stroke-width: 1.2; stroke-dasharray: 10 5; } .grain { fill: none; stroke: #7b6e58; stroke-width: 1.4; }
  .button { fill: #fbf8f0; stroke: #2b251d; stroke-width: 1.4; } .hole { fill: #2b251d; }
  .label { fill: #5a4f3d; font-size: 16px; } .label-sm { fill: #5a4f3d; font-size: 13px; }
</style></head><body>
  <div class="mast"><span class="word">The Menswear Atlas</span><span class="date">Morning report, ${esc(dateLong)}</span></div>
  <div class="tie"></div>
  <h1>${fresh.length ? `${say(fresh.length).replace(/^./, (c) => c.toUpperCase())} new ${fresh.length === 1 ? "entry" : "entries"}${newThreads > 0 ? ` and ${say(newThreads)} new threads` : ""} ${run.kind === "test" ? "on the test run" : "last night"}.` : `No new entries ${run.kind === "test" ? "on the test run" : "last night"}.`}</h1>
  <div class="totals"><span>Entries <b>${before.entries ?? "?"} → ${after.entries ?? nodes.size}</b></span><span>Threads <b>${before.relations ?? "?"} → ${after.relations ?? edges.length}</b></span><span>Being researched <b>${before.wanted ?? "?"} → ${after.wanted ?? wanted.length}</b></span></div>

  <h2>New on the wall</h2>
  ${freshHTML}

  <h2>For you</h2>
  ${attention.length ? `<ul class="list">${attention.map((a) => `<li>${a}</li>`).join("")}</ul>` : `<p class="quiet">Nothing needs your attention.</p>`}

  <h2>How the agents did</h2>
  <table><thead><tr><th>Agent</th><th>Model</th><th>Status</th><th>What it did</th></tr></thead><tbody>${agentRows}</tbody></table>

  <div class="cols">
    <div><h2>The web by decade</h2><svg viewBox="0 0 630 94" width="100%">${bars}</svg>
      <p class="small">Regions: ${Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).map(([r, c]) => `${esc(r)} ${c}`).join(", ") || "none yet"}.</p></div>
    <div><h2>Next up</h2>${nextUp.length ? `<ul class="list">${nextUp.map((l) => `<li>${esc(l.split(":")[0].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()))}<span class="small">${esc(l.includes(":") ? ":" + l.split(":").slice(1).join(":").split(".")[0] : "")}</span></li>`).join("")}</ul>` : `<p class="quiet">Next up is empty; the curator will pick from the gaps and the queue.</p>`}
      <p class="small">Most-linked topics in the queue: ${wanted.slice(0, 5).map((w) => esc(w.label)).join(", ") || "none"}.</p></div>
  </div>

  <p class="foot">The web: <a href="${SITE}">${SITE.replace("https://", "")}</a>. Full run log: <a href="${SITE}#run-log">${SITE.replace("https://", "")}#run-log</a>. Steer the next nights by editing Next up in BACKLOG.md.</p>
</body></html>`;

fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
const tmp = path.join(ROOT, ".preview");
fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, "report.html"), html);
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage();
await page.goto("file://" + path.join(tmp, "report.html"), { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
const name = `${run.date}${run.kind === "gardener" ? "-gardener" : run.kind === "test" ? "-test" : ""}.pdf`;
await page.pdf({ path: path.join(ROOT, "reports", name), format: "A4", printBackground: true, margin: { top: "16mm", bottom: "18mm", left: "16mm", right: "16mm" } });
await browser.close();
const kb = Math.round(fs.statSync(path.join(ROOT, "reports", name)).size / 1024);
console.log(`Wrote reports/${name} (${kb} KB). Once pushed and deployed it is at ${SITE}reports/${name}`);
