// npm run build — validates, then writes dist/index.html: one self-contained page
// with the styles, the script and all entries (illustrations included) inlined.
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { ROOT, TYPES, loadAll, loadSite, outgoing, wantedList, WIKI_RE, humanize } from "./lib.mjs";

const { nodes, errors } = loadAll();
if (errors.length) {
  for (const e of errors) console.error(`error ${e}`);
  console.error(`\nBuild stopped: ${errors.length} errors. Run npm run validate for details.`);
  process.exit(1);
}

const site = loadSite();
const wanted = wantedList(nodes);
const wantedById = new Map(wanted.map((w) => [w.id, w]));
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
    const label = text ?? autoLabel(id);
    return `<a href="#${id}" class="xref${exists ? "" : " is-wanted"}">${esc(label)}</a>`;
  });
  return marked
    .parse(withLinks, { gfm: true })
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
}

function cleanSvg(svg) {
  return svg.replace(/<\?xml[\s\S]*?\?>/, "").replace(/<!--[\s\S]*?-->/g, "").trim();
}

const backlinks = new Map();
for (const n of nodes.values()) for (const id of outgoing(n).keys()) {
  if (!backlinks.has(id)) backlinks.set(id, []);
  backlinks.get(id).push(n.id);
}

const out = [...nodes.values()].map((n) => ({
  id: n.id,
  type: n.type,
  name: n.name,
  aka: n.aka ?? [],
  period: n.period ?? null,
  summary: n.summary,
  html: renderBody(n.body),
  links: [...outgoing(n).keys()],
  backlinks: backlinks.get(n.id) ?? [],
  views: (n.views ?? []).map((v) => ({
    label: v.label,
    caption: v.caption ?? null,
    viewBox: v._viewBox,
    svg: cleanSvg(v._svg),
    hotspots: (v.hotspots ?? []).map(({ target, x, y, label, note }) => ({ target, x, y, label, note })),
  })),
  sources: n.sources,
  added: n.added,
}));

const data = {
  site: { title: site.title, tagline: site.tagline, intro: site.intro, featured: site.featured, timeline: site.timeline },
  types: TYPES,
  nodes: out,
  wanted,
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

fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "dist/index.html"), html);
const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`Built dist/index.html: ${out.length} entries, ${wanted.length} wanted, ${kb} KB`);
