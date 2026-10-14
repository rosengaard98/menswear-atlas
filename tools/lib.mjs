// Shared loading and checking of the atlas content.
// Every entry is a Markdown file with YAML frontmatter in content/<folder>/<id>.md.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const CONTENT = path.join(ROOT, "content");
export const ILLUSTRATIONS = path.join(ROOT, "illustrations");
export const PICTURES = path.join(ROOT, "pictures");

// type -> folder and display names. Change together with SCHEMA.md.
export const TYPES = {
  garment: { folder: "garments", one: "Garment", many: "Garments" },
  detail: { folder: "details", one: "Detail", many: "Details" },
  style: { folder: "styles", one: "Style", many: "Styles" },
  era: { folder: "eras", one: "Era", many: "Eras" },
  maker: { folder: "makers", one: "Maker", many: "Makers" },
  person: { folder: "people", one: "Person", many: "People" },
  context: { folder: "context", one: "Context", many: "Places, sports and books" },
};

// Typed relations. Each kind can be written from either end; the build stores the
// canonical direction (the first key) and shows the right label on both entries.
export const RELATIONS = {
  "part-of": { inverse: "includes", label: "Part of", inverseLabel: "Includes" },
  "introduced-by": { inverse: "introduced", label: "Introduced by", inverseLabel: "Introduced" },
  "made-by": { inverse: "makes", label: "Made by", inverseLabel: "Makes" },
  "worn-by": { inverse: "wore", label: "Worn by", inverseLabel: "Wore" },
  "originated-in": { inverse: "origin-of", label: "Came from", inverseLabel: "Gave rise to" },
  "evolved-into": { inverse: "evolved-from", label: "Evolved into", inverseLabel: "Evolved from" },
  "revived-as": { inverse: "revival-of", label: "Revived as", inverseLabel: "Revival of" },
  "influenced": { inverse: "influenced-by", label: "Influenced", inverseLabel: "Influenced by" },
  "named-after": { inverse: "gave-name-to", label: "Named after", inverseLabel: "Gave its name to" },
  "belongs-to-era": { inverse: "era-of", label: "Era", inverseLabel: "From this era" },
  "related": { inverse: "related", label: "Related", inverseLabel: "Related" },
};
const INVERSE = Object.fromEntries(Object.entries(RELATIONS).filter(([k, v]) => v.inverse !== k).map(([k, v]) => [v.inverse, k]));
export const RELATION_KINDS = [...Object.keys(RELATIONS), ...Object.keys(INVERSE)];

// Regions used for the coverage report. Add new ones here and in SCHEMA.md.
export const REGIONS = ["uk", "us", "italy", "france", "japan", "india", "germany", "scandinavia", "spain", "argentina", "global", "other"];

export const PICTURE_LICENCES = ["Public domain", "CC0"];

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const WIKI_RE = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;
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
  return YAML.parse(fs.readFileSync(path.join(CONTENT, "site.yml"), "utf8"));
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
      if (node.links !== undefined) err("links is replaced by relations; see SCHEMA.md");

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

      if (node.anchor !== undefined && !Number.isInteger(node.anchor)) err("anchor must be a year (integer)");

      // regions
      if (node.regions !== undefined) {
        if (!Array.isArray(node.regions)) err("regions must be a list");
        else for (const r of node.regions) if (!REGIONS.includes(r)) err(`unknown region "${r}"; use one of ${REGIONS.join(", ")}`);
      } else warn("no regions; add them so the curator can see coverage");

      // relations
      if (node.relations !== undefined && !Array.isArray(node.relations)) err("relations must be a list");
      for (const [i, r] of (node.relations ?? []).entries()) {
        const where = `relations[${i}]`;
        if (!r || typeof r !== "object") { err(`${where} must be { to, kind }`); continue; }
        if (!r.to || !ID_RE.test(String(r.to))) err(`${where} needs a valid "to" id`);
        if (r.to === node.id) err(`${where} points at itself`);
        if (!RELATION_KINDS.includes(r.kind)) err(`${where} kind "${r.kind}" is not one of: ${RELATION_KINDS.join(", ")}`);
        if (r.year !== undefined && !Number.isInteger(r.year)) err(`${where} year must be an integer`);
        if (r.note !== undefined && String(r.note).length > 160) err(`${where} note is too long (160 max)`);
      }

      // sources
      if (!Array.isArray(node.sources) || node.sources.length === 0) err("needs at least one source");
      else {
        if (node.sources.length < 2) warn("only one source; two independent sources are expected");
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
            const svg = readSvg(v.svg, where, err);
            if (!svg) return;
            v._svg = svg.text;
            v._viewBox = svg.viewBox;
            const vb = svg.viewBox;
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

      // picture
      const pic = node.picture;
      if (pic === undefined) {
        if (!node.views?.length) warn("no picture; every node in the web should have one (see STYLE.md, Pictures)");
      } else if (!pic || typeof pic !== "object") err("picture must be an object");
      else if (pic.kind === "drawing") {
        if (pic.svg) {
          const svg = readSvg(pic.svg, "picture", err);
          if (svg) { pic._svg = svg.text; pic._viewBox = svg.viewBox; }
        } else if (!pic.from && !node.views?.length) err("picture.kind drawing needs svg, from + view, or views on the entry");
        if (pic.focus !== undefined && !(Array.isArray(pic.focus) && pic.focus.length === 2 && pic.focus.every(Number.isFinite))) err("picture.focus must be [x, y]");
        if (pic.size !== undefined && !(Number(pic.size) > 0)) err("picture.size must be a positive number");
        pic._err = err; // resolved after all entries are loaded
      } else if (pic.kind === "archival") {
        if (pic.file) {
          if (!fs.existsSync(path.join(PICTURES, pic.file))) err(`picture.file pictures/${pic.file} does not exist; add it with npm run picture`);
        } else if (pic.url) {
          if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(pic.url)) err("picture.url must be an upload.wikimedia.org/wikipedia/commons/ image");
        } else err("archival picture needs file (from npm run picture) or url (Commons upload URL)");
        for (const k of ["title", "licence", "source"]) if (!pic[k]) err(`archival picture needs ${k}`);
        if (pic.licence && !PICTURE_LICENCES.includes(pic.licence)) err(`picture licence "${pic.licence}" is not allowed; only ${PICTURE_LICENCES.join(" or ")}`);
        if (pic.source && !/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(pic.source)) err("picture.source must be the Wikimedia Commons file page");
      } else err('picture.kind must be "drawing" or "archival"');

      if (node.id) nodes.set(node.id, node);
    }
  }

  // drawing pictures that borrow a view (from another entry, or the entry's own)
  for (const node of nodes.values()) {
    const pic = node.picture;
    if (!pic || pic.kind !== "drawing" || pic.svg) continue;
    const err = pic._err; delete pic._err;
    const owner = pic.from ? nodes.get(pic.from) : node;
    if (!owner) { err(`picture.from "${pic.from}" has no entry`); continue; }
    const view = pic.view ? owner.views?.find((v) => v.label === pic.view) : owner.views?.[0];
    if (!view?._svg) { err(`picture.view "${pic.view ?? "(first)"}" not found on ${owner.id}`); continue; }
    pic._svg = view._svg;
    const vb = view._viewBox;
    if (pic.focus) {
      const size = Number(pic.size ?? Math.min(vb[2], vb[3]) / 3);
      pic._viewBox = [pic.focus[0] - size * 0.4, pic.focus[1] - size * 0.5, size * 0.8, size];
    } else pic._viewBox = vb;
  }

  return { nodes, errors, warnings };
}

function readSvg(file, where, err) {
  if (!file) { err(`${where} needs an svg file name`); return null; }
  const p = path.join(ILLUSTRATIONS, file);
  if (!fs.existsSync(p)) { err(`${where}: illustrations/${file} does not exist`); return null; }
  const text = fs.readFileSync(p, "utf8");
  checkSvg(text).forEach((problem) => err(`illustrations/${file}: ${problem}`));
  const viewBox = parseViewBox(text);
  return viewBox ? { text, viewBox } : null;
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

// Typed edges in canonical direction, deduplicated: [{ from, to, kind, year, note }]
export function relationEdges(nodes) {
  const seen = new Map();
  for (const n of nodes.values()) {
    for (const r of n.relations ?? []) {
      if (!RELATION_KINDS.includes(r.kind)) continue;
      let from = n.id, to = r.to, kind = r.kind;
      if (INVERSE[kind]) { kind = INVERSE[kind]; [from, to] = [to, from]; }
      if (kind === "related" && from > to) [from, to] = [to, from];
      const key = `${from}|${kind}|${to}`;
      const prev = seen.get(key);
      seen.set(key, { from, to, kind, year: r.year ?? prev?.year ?? null, note: r.note ?? prev?.note ?? null });
    }
  }
  return [...seen.values()];
}

// All ids an entry points at: relations, [[wiki-links]] in the body, hotspot targets.
export function outgoing(node) {
  // Label hints, best first: hotspot labels, then [[id|text]] wording, then nothing.
  const out = new Map(); // id -> label hint
  for (const v of node.views ?? []) for (const h of v.hotspots ?? []) if (h.target && !out.get(h.target)) out.set(h.target, h.label);
  for (const m of (node.body ?? "").matchAll(WIKI_RE)) if (!out.get(m[1])) out.set(m[1], m[2] ? m[2].charAt(0).toUpperCase() + m[2].slice(1) : null);
  for (const r of node.relations ?? []) if (r?.to && !out.has(r.to)) out.set(r.to, null);
  out.delete(node.id);
  return out;
}

// Ids that are linked to but have no entry yet: the queue the nightly agents work from.
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

// ---------- run logs: one JSON file per run in runs/, written by the curator or gardener ----------
export const RUNS = path.join(ROOT, "runs");
export const ROLES = ["curator", "researcher", "writer", "weaver", "illustrator", "fact-checker", "visual-reviewer", "tester", "gardener"];
const STATUS = ["ok", "partial", "failed", "skipped"];

export function loadRuns() {
  const runs = [];
  const errors = [];
  if (!fs.existsSync(RUNS)) return { runs, errors };
  for (const f of fs.readdirSync(RUNS).filter((f) => f.endsWith(".json")).sort()) {
    const file = path.join("runs", f);
    let r;
    try { r = JSON.parse(fs.readFileSync(path.join(RUNS, f), "utf8")); } catch (e) { errors.push(`${file}: not valid JSON (${e.message})`); continue; }
    const err = (m) => errors.push(`${file}: ${m}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? "")) err("date must be YYYY-MM-DD");
    if (!["nightly", "gardener", "test"].includes(r.kind)) err('kind must be "nightly", "gardener" or "test"');
    if (!Array.isArray(r.agents) || !r.agents.length) err("agents must be a non-empty list");
    for (const [i, a] of (r.agents ?? []).entries()) {
      if (!ROLES.includes(a.role)) err(`agents[${i}].role "${a.role}" is not one of ${ROLES.join(", ")}`);
      if (!STATUS.includes(a.status)) err(`agents[${i}].status must be one of ${STATUS.join(", ")}`);
      if (!a.summary) err(`agents[${i}] needs a one-line summary`);
      if (a.numbers !== undefined && (typeof a.numbers !== "object" || Array.isArray(a.numbers))) err(`agents[${i}].numbers must be an object of counts`);
      if (a.problems !== undefined && !Array.isArray(a.problems)) err(`agents[${i}].problems must be a list`);
    }
    for (const [i, t] of (r.topics ?? []).entries()) {
      if (!t.id) err(`topics[${i}] needs an id`);
      if (!["added", "dropped", "folded", "changed"].includes(t.outcome)) err(`topics[${i}].outcome must be added, dropped, folded or changed`);
    }
    runs.push({ ...r, file: f });
  }
  runs.sort((a, b) => (b.date + b.file).localeCompare(a.date + a.file));
  return { runs, errors };
}
