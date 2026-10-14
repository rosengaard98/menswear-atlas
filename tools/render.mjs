// npm run render -- <id> [<id> ...]   (no ids = every entry with views)
// Renders each view to .preview/<id>-<view>.png with the hotspots drawn as numbered
// red rings, so an agent (or you) can look at the picture and check placement.
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { ROOT, loadAll } from "./lib.mjs";

// Same classes as site/styles.css, with fixed light-theme colours.
const PREVIEW_CSS = `
  .cloth{fill:#f4f6f8;stroke:#1d2a40;stroke-width:2.2;stroke-linejoin:round}
  .cloth-alt{fill:#dbe3ec;stroke:#1d2a40;stroke-width:1.6;stroke-linejoin:round}
  .shade{fill:#c9d4e0}
  .line{fill:none;stroke:#1d2a40;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round}
  .seam{fill:none;stroke:#1d2a40;stroke-width:1.1;stroke-dasharray:4 3}
  .fold{fill:none;stroke:#1d2a40;stroke-width:1;stroke-opacity:.45}
  .guide{fill:none;stroke:#6b7a8f;stroke-width:1.2;stroke-dasharray:10 5}
  .grain{fill:none;stroke:#6b7a8f;stroke-width:1.4}
  .button{fill:#fbfbf8;stroke:#1d2a40;stroke-width:1.4}
  .hole{fill:#1d2a40}
  .label{fill:#3a4a61;font-family:sans-serif;font-size:15px}
  .label-sm{fill:#3a4a61;font-family:sans-serif;font-size:12px}
`;

const ids = process.argv.slice(2);
const { nodes, errors } = loadAll();
if (errors.length) console.warn(`Note: ${errors.length} validation errors exist; run npm run validate.`);
const outDir = path.join(ROOT, ".preview");
fs.mkdirSync(outDir, { recursive: true });

const targets = ids.length ? ids.map((id) => nodes.get(id) ?? (console.error(`No entry "${id}"`), null)).filter(Boolean) : [...nodes.values()];
let count = 0;
for (const node of targets) {
  for (const view of node.views ?? []) {
    if (!view._svg) continue;
    const [vx, vy, vw, vh] = view._viewBox;
    const r = Math.max(10, vw / 45);
    const marks = (view.hotspots ?? [])
      .map((h, i) => `<circle cx="${h.x}" cy="${h.y}" r="${r}" fill="none" stroke="#d0021b" stroke-width="2.5"/>` +
        `<text x="${h.x + r + 3}" y="${h.y - r + 2}" fill="#d0021b" font-family="sans-serif" font-weight="bold" font-size="${r * 1.2}">${i + 1}</text>`)
      .join("");
    const svg = view._svg.replace(/<svg([^>]*)>/, `<svg$1><style>${PREVIEW_CSS}</style><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#ffffff"/>`)
      .replace(/<\/svg>\s*$/, `<g>${marks}</g></svg>`);
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1000 }, font: { loadSystemFonts: true } }).render().asPng();
    const slug = view.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const file = path.join(outDir, `${node.id}-${slug}.png`);
    fs.writeFileSync(file, png);
    console.log(`${path.relative(ROOT, file)}`);
    (view.hotspots ?? []).forEach((h, i) => console.log(`   ${i + 1}. ${h.label} -> ${h.target} (${h.x}, ${h.y})`));
    count++;
  }
  // the node's picture in the web, when it is a drawing (possibly a crop of a view)
  const pic = node.picture;
  if (pic?.kind === "drawing" && pic._svg && pic._viewBox) {
    const [vx, vy, vw, vh] = pic._viewBox;
    const svg = pic._svg
      .replace(/viewBox="[^"]*"/, `viewBox="${vx} ${vy} ${vw} ${vh}"`)
      .replace(/<svg([^>]*)>/, `<svg$1><style>${PREVIEW_CSS}</style><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#ffffff"/>`);
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 480 }, font: { loadSystemFonts: true } }).render().asPng();
    const file = path.join(outDir, `${node.id}-picture.png`);
    fs.writeFileSync(file, png);
    console.log(`${path.relative(ROOT, file)}  (picture in the web)`);
    count++;
  }
}
if (!count) console.log("Nothing to render.");
