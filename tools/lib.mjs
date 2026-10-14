// Shared loading and checking of the atlas content.
// Every entry is a Markdown file with YAML frontmatter in content/<folder>/<id>.md.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const CONTENT = path.join(ROOT, "content");
export const ILLUSTRATIONS = path.join(ROOT, "illustrations");

// type -> folder and display names. Add a type here and in SCHEMA.md together.
export const TYPES = {
  era: { folder: "eras", one: "Era", many: "Eras" },
  style: { folder: "styles", one: "Style", many: "Styles" },
  garment: { folder: "garments", one: "Garment", many: "Garments" },
  detail: { folder: "details", one: "Detail", many: "Details" },
  maker: { folder: "makers", one: "Maker", many: "Makers" },
  person: { folder: "people", one: "Person", many: "People" },
  context: { folder: "context", one: "Context", many: "Context" },
};

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WIKI_RE = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;
const SUMMARY_MAX = 320;
const NOTE_MAX = 260;

export function humanize(id) {
  const s = id.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function splitFrontmatter(raw, file) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing --- frontmatter block`);
  return { data: YAML.parse(m[1]) ?? {}, body: m[2].trim() };
}

export function loadSite() {
  const p = path.join(CONTENT, "site.yml");
  return YAML.parse(fs.readFileSync(p, "utf8"));
}

// Returns { nodes: Map(id -> node), errors: [], warnings: [] }
export function loadAll() {
  const nodes = new Map();
  const errors = [];
  const warnings = [];

  for (const [type, meta] of Object.entries(TYPES)) {
    const dir = path.join(CONTENT, meta.folder);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.endsWith(".md")) continue;
      const file = path.join("content", meta.folder, f);
      let parsed;
      try {
        parsed = splitFrontmatter(fs.readFileSync(path.join(dir, f), "utf8"), file);
      } catch (e) {
        errors.push(e.message);
        continue;
      }
      const { data, body } = parsed;
      const node = { ...data, body, file };
      const err = (msg) => errors.push(`${file}: ${msg}`);
      const warn = (msg) => warnings.push(`${file}: ${msg}`);

      // identity
      if (!node.id) err("missing id");
      else if (!ID_RE.test(node.id)) err(`id "${node.id}" must be lowercase-kebab-case`);
      else if (node.id !== f.replace(/\.md$/, "")) err(`id "${node.id}" must match the file name`);
      if (node.type !== type) err(`type must be "${type}" for files in content/${meta.folder}/`);
      if (node.id && nodes.has(node.id)) err(`duplicate id "${node.id}" (also in ${nodes.get(node.id).file})`);

      // text
      if (!node.name || typeof node.name !== "string") err("missing name");
      if (!node.summary || typeof node.summary !== "string") err("missing summary");
      else if (node.summary.length > SUMMARY_MAX) err(`summary is ${node.summary.length} chars; keep it under ${SUMMARY_MAX}`);
      if (!body || body.length < 200) err("body is missing or under 200 characters");
      if (node.aka && !Array.isArray(node.aka)) err("aka must be a list");

      // period
      const per = node.period;
      if (per !== undefined) {
        if (typeof per !== "object" || per === null) err("period must be { from, to }");
        else {
          if (!Number.isInteger(per.from)) err("period.from must be a year (integer)");
          if (per.to !== undefined && per.to !== null && !Number.isInteger(per.to)) err("period.to must be a year or null");
          if (Number.isInteger(per.from) && Number.isInteger(per.to) && per.to < per.from) err("period.to is before period.from");
        }
      }
      if ((type === "era" || type === "style") && !(per && Number.isInteger(per.from))) err(`${type} entries need period.from`);
      if (type === "era" && !(per && Number.isInteger(per.to))) err("era entries need period.to");

      // links
      if (node.links !== undefined && !Array.isArray(node.links)) err("links must be a list of ids");
      for (const l of node.links ?? []) if (!ID_RE.test(String(l))) err(`link "${l}" is not a valid id`);

      // sources
      if (!Array.isArray(node.sources) || node.sources.length === 0) err("needs at least one source");
      else {
        if (node.sources.length < 2) warn("only one source; two independent sources are preferred");
        for (const s of node.sources) {
          if (!s || !s.title) err("every source needs a title");
          if (s && s.url && !/^https?:\/\//.test(s.url)) err(`source url "${s.url}" must start with http`);
          if (s && !s.url && !s.citation) err(`source "${s.title}" needs a url or a citation (book, page)`);
        }
      }

      // date added
      if (!node.added) err("missing added (YYYY-MM-DD)");
      else node.added = String(node.added instanceof Date ? node.added.toISOString().slice(0, 10) : node.added);
      if (node.added && !/^\d{4}-\d{2}-\d{2}$/.test(node.added)) err("added must be YYYY-MM-DD");

      // views + hotspots
      if (node.views !== undefined) {
        if (!Array.isArray(node.views)) err("views must be a list");
        else
          node.views.forEach((v, i) => {
            const where = `views[${i}]`;
            if (!v.label) err(`${where} needs a label`);
            if (!v.svg) return err(`${where} needs an svg file name`);
            const svgPath = path.join(ILLUSTRATIONS, v.svg);
            if (!fs.existsSync(svgPath)) return err(`${where}: illustrations/${v.svg} does not exist`);
            const svg = fs.readFileSync(svgPath, "utf8");
            const svgProblems = checkSvg(svg);
            svgProblems.forEach((p) => err(`illustrations/${v.svg}: ${p}`));
            const vb = parseViewBox(svg);
            if (!vb) return;
            v._svg = svg;
            v._viewBox = vb;
            for (const [j, h] of (v.hotspots ?? []).entries()) {
              const hw = `${where}.hotspots[${j}]`;
              if (!h.target || !ID_RE.test(h.target)) err(`${hw} needs a target id`);
              if (!h.label) err(`${hw} needs a label`);
              if (!h.note) err(`${hw} needs a note`);
              else if (h.note.length > NOTE_MAX) err(`${hw} note is ${h.note.length} chars; keep it under ${NOTE_MAX}`);
              if (typeof h.x !== "number" || typeof h.y !== "number") err(`${hw} needs numeric x and y`);
              else if (h.x < vb[0] || h.y < vb[1] || h.x > vb[0] + vb[2] || h.y > vb[1] + vb[3])
                err(`${hw} (${h.x}, ${h.y}) is outside the viewBox`);
            }
          });
      }

      if (node.id) nodes.set(node.id, node);
    }
  }

  return { nodes, errors, warnings };
}

export function parseViewBox(svg) {
  const m = svg.match(/viewBox="([-\d.\s]+)"/);
  if (!m) return null;
  const parts = m[1].trim().split(/\s+/).map(Number);
  return parts.length === 4 && parts.every(Number.isFinite) ? parts : null;
}

// Illustrations are inlined into the page, so they must be inert and themeable.
export function checkSvg(svg) {
  const problems = [];
  if (!/^\s*<svg[\s>]/.test(svg)) problems.push("must start with <svg");
  if (!parseViewBox(svg)) problems.push("needs a viewBox");
  if (/<script/i.test(svg)) problems.push("must not contain <script>");
  if (/<foreignObject/i.test(svg)) problems.push("must not contain <foreignObject>");
  if (/\son[a-z]+\s*=/i.test(svg)) problems.push("must not contain event handler attributes");
  if (/(xlink:)?href\s*=\s*"(?!#)/i.test(svg)) problems.push("must not link to external files");
  if (/<image/i.test(svg)) problems.push("must not embed images; draw with paths");
  if (/\s(fill|stroke)\s*=\s*"(?!none"|currentColor")/i.test(svg))
    problems.push('fill/stroke attributes may only be "none" or "currentColor"; colour with the classes in STYLE.md');
  if (/\sstyle\s*=/i.test(svg) || /<style/i.test(svg)) problems.push("must not use style attributes or <style>; use the classes in STYLE.md");
  return problems;
}

// All ids an entry points at: links list, [[wiki-links]] in the body, hotspot targets.
export function outgoing(node) {
  // Label hints, best first: hotspot labels, then [[id|text]] wording, then nothing.
  const out = new Map(); // id -> label hint
  for (const v of node.views ?? []) for (const h of v.hotspots ?? []) if (h.target && !out.get(h.target)) out.set(h.target, h.label);
  for (const m of (node.body ?? "").matchAll(WIKI_RE)) if (!out.get(m[1])) out.set(m[1], m[2] ? m[2].charAt(0).toUpperCase() + m[2].slice(1) : null);
  for (const l of node.links ?? []) if (!out.has(l)) out.set(l, null);
  out.delete(node.id);
  return out;
}

// Ids that are linked to but have no entry yet: the queue the nightly agent works from.
export function wantedList(nodes) {
  const wanted = new Map();
  for (const node of nodes.values()) {
    for (const [id, hint] of outgoing(node)) {
      if (nodes.has(id)) continue;
      const w = wanted.get(id) ?? { id, label: null, notes: [], linkedFrom: [] };
      if (hint && !w.label) w.label = hint;
      if (!w.linkedFrom.includes(node.id)) w.linkedFrom.push(node.id);
      for (const v of node.views ?? [])
        for (const h of v.hotspots ?? [])
          if (h.target === id && !w.notes.some((n) => n.note === h.note)) w.notes.push({ from: node.id, label: h.label, note: h.note });
      wanted.set(id, w);
    }
  }
  for (const w of wanted.values()) w.label ??= humanize(w.id);
  return [...wanted.values()].sort((a, b) => b.linkedFrom.length - a.linkedFrom.length || a.id.localeCompare(b.id));
}

export { WIKI_RE };
