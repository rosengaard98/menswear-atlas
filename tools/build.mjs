// npm run build — validates, then writes dist/: index.html (styles, script and all
// entries inlined) plus dist/pictures/ for archival prints.
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { ROOT, PICTURES, TYPES, RELATIONS, loadAll, loadSite, outgoing, wantedList, relationEdges, WIKI_RE, humanize } from "./lib.mjs";
import { layoutWeb, anchorYear } from "./layout.mjs";

const { nodes, errors } = loadAll();
if (errors.length) {
  for (const e of errors) console.error(`error ${e}`);
  console.error(`\nBuild stopped: ${errors.length} errors. Run npm run validate for details.`);
  process.exit(1);
}

const site = loadSite();
const wanted = wantedList(nodes);
const wantedById = new Map(wanted.map((w) => [w.id, w]));
const edges = relationEdges(nodes).filter((e) => e.from !== e.to);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// [[id]] without text reads mid-sentence, so common nouns lose their capital:
// "the [[box-pleat]]" -> "the box pleat". Names with other capitals are kept.
const lowerFirst = (s) => (/^[A-Z][^A-Z]*$/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
function autoLabel(id) {
  const n = nodes.get(id);
  if (n) return ["detail", "garment"].includes(n.type) ? lowerFirst(n.name) : n.name;
  return lowerFirst(wantedById.get(id)?.label ?? humanize(id));
}

function renderBody(md) {
  const withLinks = md.replace(WIKI_RE, (_, id, text) => {
    const exists = nodes.has(id);
    return `<a href="#${id}" class="xref${exists ? "" : " is-wanted"}">${esc(text ?? autoLabel(id))}</a>`;
  });
  return marked
    .parse(withLinks, { gfm: true })
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
}

const cleanSvg = (svg) => svg.replace(/<\?xml[\s\S]*?\?>/, "").replace(/<!--[\s\S]*?-->/g, "").replace(/\n\s*\n/g, "\n").trim();

// Each SVG file is shipped once; pictures refer to it by key with their own viewBox.
const svgs = {};
const svgKey = (text) => {
  const key = "s" + Object.keys(svgs).length;
  for (const [k, v] of Object.entries(svgs)) if (v === text) return k;
  svgs[key] = text;
  return key;
};

// mentions = links that are not typed relations (body links and hotspots), used for placement
const relatedIds = new Map([...nodes.keys()].map((id) => [id, new Set()]));
for (const e of edges) { relatedIds.get(e.from)?.add(e.to); relatedIds.get(e.to)?.add(e.from); }
for (const n of nodes.values()) n._mentions = [...outgoing(n).keys()].filter((id) => !relatedIds.get(n.id).has(id));

const layout = layoutWeb({ nodes, wanted, edges, site });

fs.rmSync(path.join(ROOT, "dist"), { recursive: true, force: true });
fs.mkdirSync(path.join(ROOT, "dist/pictures"), { recursive: true });

function pictureOut(n) {
  const p = n.picture;
  if (p?.kind === "archival") {
    const credit = [p.title, p.creator, p.date].filter(Boolean).join(", ");
    if (p.file) {
      fs.copyFileSync(path.join(PICTURES, p.file), path.join(ROOT, "dist/pictures", p.file));
      return { kind: "print", src: `pictures/${p.file}`, credit, licence: p.licence, source: p.source };
    }
    return { kind: "print", src: p.url, remote: true, credit, licence: p.licence, source: p.source };
  }
  if (p?.kind === "drawing" && p._svg) return { kind: "drawing", svg: svgKey(cleanSvg(p._svg)), viewBox: p._viewBox };
  if (!p && n.views?.length) return { kind: "drawing", svg: svgKey(cleanSvg(n.views[0]._svg)), viewBox: n.views[0]._viewBox };
  return null;
}

const out = [...nodes.values()].map((n) => ({
  id: n.id,
  type: n.type,
  name: n.name,
  aka: n.aka ?? [],
  period: n.period ?? null,
  year: anchorYear(n),
  regions: n.regions ?? [],
  summary: n.summary,
  html: renderBody(n.body),
  mentions: n._mentions,
  picture: pictureOut(n),
  views: (n.views ?? []).map((v) => ({
    label: v.label,
    caption: v.caption ?? null,
    viewBox: v._viewBox,
    svg: svgKey(cleanSvg(v._svg)),
    hotspots: (v.hotspots ?? []).map(({ target, x, y, label, note }) => ({ target, x, y, label, note })),
  })),
  sources: n.sources,
  added: n.added,
}));

const data = {
  site: { title: site.title, tagline: site.tagline, intro: site.intro, timeline: site.timeline },
  types: TYPES,
  relations: RELATIONS,
  nodes: out,
  edges,
  wanted,
  layout,
  svgs,
  built: new Date().toISOString().slice(0, 10),
};

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const json = JSON.stringify(data).replace(/</g, "\\u003c");
const html = read("site/index.html")
  .replace("{{title}}", esc(site.title))
  .replace("{{description}}", esc(site.tagline))
  .replace("/*{{styles}}*/", () => read("site/styles.css"))
  .replace("{{data}}", () => json)
  .replace("/*{{script}}*/", () => read("site/app.js"));

fs.writeFileSync(path.join(ROOT, "dist/index.html"), html);
const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`Built dist/index.html: ${out.length} entries, ${edges.length} relations, ${wanted.length} wanted, ${kb} KB`);
