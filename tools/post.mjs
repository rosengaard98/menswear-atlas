// npm run post -- <entry-id> [--date=YYYY-MM-DD]
// Renders an Instagram carousel for one entry into social/<date>/: three 1080x1350 JPEG
// slides (the picture, the story, how it connects) and post.json with a caption to finish.
// The social editor writes the caption; the GitHub workflow publishes after Lasse approves.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { ROOT, PICTURES, TYPES, RELATIONS, loadAll, relationEdges, wantedList, findChromium } from "./lib.mjs";

const SITE = "https://rosengaard98.github.io/menswear-atlas/";
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const date = (args.find((a) => a.startsWith("--date=")) ?? "").slice(7) || new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Copenhagen" });
const allowMonogram = args.includes("--allow-monogram");
const { nodes } = loadAll();
const n = nodes.get(id);
if (!n) { console.error(`No entry "${id}". Usage: npm run post -- <entry-id>`); process.exit(2); }

const edges = relationEdges(nodes);
const wanted = wantedList(nodes);
const nameOf = (x) => nodes.get(x)?.name ?? wanted.find((w) => w.id === x)?.label ?? x;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const years = (p) => (!p || p.from == null ? "" : p.to == null ? `${p.from} to today` : p.to === p.from ? `${p.from}` : `${p.from}–${p.to}`);

let usedMonogram = false;
function picture(node, { track = false, small = false } = {}) {
  const p = node.picture;
  if (p?.kind === "archival" && p.file) return `<img class="print" src="file://${esc(path.join(PICTURES, p.file))}" alt="">`;
  if (p?.kind === "drawing" && p._svg && p._viewBox) return p._svg.replace(/viewBox="[^"]*"/, `viewBox="${p._viewBox.join(" ")}" preserveAspectRatio="xMidYMid meet"`);
  if (!p && node.views?.length) return node.views[0]._svg;
  if (track) usedMonogram = true; // hotlinked prints cannot be fetched from here, so they also fall back
  return `<span class="mono${small ? " small" : ""}"><span>${esc(node.name.replace(/^The\s+/i, "").charAt(0))}</span></span>`;
}
const rels = edges.filter((e) => e.kind !== "belongs-to-era" && (e.from === id || e.to === id))
  .map((e) => (e.from === id ? { label: RELATIONS[e.kind].label, other: e.to } : { label: RELATIONS[e.kind].inverseLabel, other: e.from }))
  .slice(0, 5);
const kindLine = [TYPES[n.type]?.one, years(n.period)].filter(Boolean).join(", ");

const css = `
  @import url("https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..700;1,400..700&display=swap");
  * { box-sizing: border-box; margin: 0; }
  body { width: 1080px; height: 1350px; font-family: "EB Garamond", Garamond, Georgia, serif; overflow: hidden; }
  .slide { width: 1080px; height: 1350px; position: relative; display: flex; flex-direction: column; }
  .baize { background-color: #22402f; background-image: radial-gradient(ellipse at 50% 40%, rgba(255,255,255,.06), transparent 70%), repeating-linear-gradient(45deg, rgba(0,0,0,.04) 0 1px, transparent 1px 3px); color: #ece4d0; }
  .paper { background: #f4efe4; color: #221e18; }
  .tie { height: 16px; background: repeating-linear-gradient(-45deg, #712530 0 16px, #1f3b2d 16px 34px, #b8945a 34px 39px, #1f3b2d 39px 57px); }
  .mark { position: absolute; left: 0; right: 0; bottom: 0; }
  .mark .word { font-style: italic; font-size: 34px; padding: 18px 64px 22px; display: flex; justify-content: space-between; align-items: baseline; }
  .mark .word span { font-style: normal; font-size: 24px; opacity: .75; }
  .frame { padding: 22px; background: linear-gradient(135deg, #d7b77a, #8d6a35 45%, #caa564 70%, #7a5a2b); box-shadow: 0 24px 50px rgba(0,0,0,.5), inset 0 0 0 2px rgba(255,240,200,.4); }
  .mat { width: 100%; height: 100%; background: #f5efe2; overflow: hidden; display: grid; place-items: center; }
  .mat svg, .mat img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
  .print { filter: grayscale(1) sepia(.42) contrast(1.04); }
  .mono { width: 60%; aspect-ratio: 3/4; border-radius: 50%; border: 2px solid #a8864d; box-shadow: 0 0 0 8px #f5efe2, 0 0 0 10px #a8864d; display: grid; place-items: center; font-style: italic; font-size: 160px; color: #1f3b2d; }
  .mono.small { font-size: 46px; border-width: 1px; box-shadow: 0 0 0 3px #f5efe2, 0 0 0 4px #a8864d; }
  .plate { background: linear-gradient(180deg, #e2c88f, #b8945a); color: #2a2014; padding: 10px 34px 12px; box-shadow: 0 6px 12px rgba(0,0,0,.4); text-align: center; font-variant-caps: all-small-caps; letter-spacing: .07em; font-size: 40px; line-height: 1.1; max-width: 860px; }
  .kicker { font-variant-caps: all-small-caps; letter-spacing: .08em; font-size: 30px; }
  .cloth { fill: #fbf8f0; stroke: #2b251d; stroke-width: 2.2; stroke-linejoin: round; } .cloth-alt { fill: #e9e0cc; stroke: #2b251d; stroke-width: 1.6; }
  .shade { fill: #d8ccb2; } .line { fill: none; stroke: #2b251d; stroke-width: 2.2; } .seam { fill: none; stroke: #2b251d; stroke-width: 1.1; stroke-dasharray: 4 3; }
  .fold { fill: none; stroke: #2b251d; stroke-width: 1; stroke-opacity: .4; } .guide { fill: none; stroke: #7b6e58; stroke-width: 1.2; stroke-dasharray: 10 5; }
  .grain { fill: none; stroke: #7b6e58; stroke-width: 1.4; } .button { fill: #fbf8f0; stroke: #2b251d; stroke-width: 1.4; } .hole { fill: #2b251d; }
  .label { fill: #5a4f3d; font-size: 16px; } .label-sm { fill: #5a4f3d; font-size: 13px; }
`;
const brand = (tone) => `<div class="mark"><div class="word" style="color:${tone}">The Menswear Atlas<span>${esc(date)}</span></div><div class="tie"></div></div>`;

const slides = [
  // 1. the picture, hung on the baize
  `<div class="slide baize" style="align-items:center;padding-top:96px;gap:34px">
     <p class="kicker" style="color:#d2b072">${esc(kindLine)}</p>
     <div class="frame" style="width:620px;height:775px"><div class="mat">${picture(n, { track: true })}</div></div>
     <div class="plate">${esc(n.name)}</div>
     ${brand("#ece4d0")}
   </div>`,
  // 2. the story
  `<div class="slide paper" style="padding:110px 96px 0">
     <p class="kicker" style="color:#625949">${esc(kindLine)}</p>
     <h1 style="font-weight:400;font-size:84px;line-height:1.02;margin:14px 0 40px">${esc(n.name)}</h1>
     <p style="font-size:46px;line-height:1.32">${esc(n.summary)}</p>
     <p style="font-size:30px;color:#625949;margin-top:44px">${n.sources.length} sources. Read the full entry on the atlas, link in bio.</p>
     ${brand("#221e18")}
   </div>`,
  // 3. how it connects
  `<div class="slide baize" style="padding:96px 80px 0">
     <p class="kicker" style="color:#d2b072">How it connects</p>
     <h1 style="font-weight:400;font-size:70px;line-height:1.05;margin:10px 0 44px">${esc(n.name)}</h1>
     <div style="display:grid;gap:26px">
       ${rels.length ? rels.map((r) => { const o = nodes.get(r.other); return `<div style="display:flex;align-items:center;gap:30px">
         <div class="frame" style="width:120px;height:150px;padding:8px;flex:none"><div class="mat">${o ? picture(o, { small: true }) : `<span class="mono small" style="border-style:dashed;box-shadow:none"><span>?</span></span>`}</div></div>
         <div><p style="font-size:30px;color:#d2b072;font-variant-caps:all-small-caps;letter-spacing:.06em">${esc(r.label)}</p><p style="font-size:46px;line-height:1.1">${esc(nameOf(r.other))}</p></div></div>`; }).join("")
        : `<p style="font-size:44px">Its threads are still being researched.</p>`}
     </div>
     ${brand("#ece4d0")}
   </div>`,
];

const outDir = path.join(ROOT, "social", date);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
const files = [];
for (const [i, body] of slides.entries()) {
  const tmp = path.join(ROOT, ".preview", `slide-${i + 1}.html`);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`);
  await page.goto("file://" + tmp, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const file = `slide-${i + 1}.jpg`;
  await page.screenshot({ path: path.join(outDir, file), type: "jpeg", quality: 86 });
  files.push(file);
}
await browser.close();

if (usedMonogram && !allowMonogram) {
  console.error(`${n.name} has no picture that can be rendered here (only a monogram). Pick another entry, or pass --allow-monogram.`);
  fs.rmSync(outDir, { recursive: true, force: true });
  process.exit(1);
}

const postFile = path.join(outDir, "post.json");
const post = {
  entry: id,
  date,
  status: "draft",
  slides: files.map((f) => `${SITE}social/${date}/${f}`),
  caption: "TODO: written by the social editor (see agents/social-editor.md)",
  link: `${SITE}#${id}`,
};
fs.writeFileSync(postFile, JSON.stringify(post, null, 2) + "\n");
console.log(`Wrote social/${date}/: ${files.join(", ")} and post.json. Look at the slides with the Read tool, then write the caption into post.json.`);
