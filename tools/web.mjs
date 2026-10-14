// npm run web — the state of the web, for the curator, the weaver and the gardener.
// Coverage by decade, region and kind; loose ends; possible duplicates; missing links.
// --json prints the same as data; --index prints one line per entry.
import { loadAll, wantedList, relationEdges, outgoing, TYPES, REGIONS } from "./lib.mjs";
import { anchorYear } from "./layout.mjs";

const { nodes } = loadAll();
const wanted = wantedList(nodes);
const edges = relationEdges(nodes);
const list = [...nodes.values()];

// degree by typed relations
const nbr = new Map(list.map((n) => [n.id, new Set()]));
for (const e of edges) { nbr.get(e.from)?.add(e.to); nbr.get(e.to)?.add(e.from); }

// coverage by decade (entries placed by year), region and type
const decades = {};
for (let d = 1770; d <= 2020; d += 10) decades[d] = [];
for (const n of list) {
  const y = n.type === "era" ? null : anchorYear(n);
  if (y == null) continue;
  const d = Math.max(1770, Math.min(2020, Math.floor(y / 10) * 10));
  decades[d].push(n.id);
}
const regions = Object.fromEntries(REGIONS.map((r) => [r, list.filter((n) => (n.regions ?? []).includes(r)).map((n) => n.id)]));
const byType = Object.fromEntries(Object.keys(TYPES).map((t) => [t, list.filter((n) => n.type === t).map((n) => n.id)]));
const stylesByRegion = Object.fromEntries(REGIONS.map((r) => [r, byType.style.filter((id) => (nodes.get(id).regions ?? []).includes(r))]).filter(([, v]) => v.length));

// loose ends
const orphans = list.filter((n) => n.type !== "era" && nbr.get(n.id).size === 0).map((n) => n.id);
const thin = list.filter((n) => n.type !== "era" && nbr.get(n.id).size === 1).map((n) => n.id);
const noPicture = list.filter((n) => n.type !== "era" && !n.picture && !n.views?.length).map((n) => n.id);
const oneSource = list.filter((n) => (n.sources ?? []).length < 2).map((n) => n.id);
const hubs = list.map((n) => [n.id, nbr.get(n.id).size]).sort((a, b) => b[1] - a[1]).slice(0, 6);

// possible duplicates: entries or queued topics whose names overlap heavily
const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["the", "and"].includes(w)));
const names = [...list.map((n) => ({ id: n.id, names: [n.name, ...(n.aka ?? [])] })), ...wanted.map((w) => ({ id: w.id, names: [w.label], wanted: true }))];
const dupes = [];
for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
  const A = names[i], B = names[j];
  if (A.wanted && B.wanted) continue;
  // same name, or every word of a two-plus-word name appears in the other
  let hit = false;
  for (const a of A.names) for (const b of B.names) {
    const wa = words(a), wb = words(b);
    if (!wa.size || !wb.size) continue;
    const [small, big] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
    const contained = [...small].every((w) => big.has(w));
    if (contained && (small.size >= 2 || wa.size === wb.size)) hit = true;
  }
  if (hit) dupes.push([A.id, B.id]);
}

// missing links: entries that share two or more neighbours but are not connected themselves
const missing = [];
const ids = list.filter((n) => n.type !== "era").map((n) => n.id);
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  const a = ids[i], b = ids[j];
  if (nbr.get(a).has(b)) continue;
  const shared = [...nbr.get(a)].filter((x) => nbr.get(b).has(x) && nodes.get(x)?.type !== "era");
  const mentioned = outgoing(nodes.get(a)).has(b) || outgoing(nodes.get(b)).has(a);
  if (shared.length >= 2 || (mentioned && shared.length >= 1)) missing.push({ a, b, shared, mentioned });
}
missing.sort((p, q) => q.shared.length - p.shared.length);

const report = {
  totals: { entries: list.length, relations: edges.length, wanted: wanted.length },
  byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v.length])),
  decades: Object.fromEntries(Object.entries(decades).map(([k, v]) => [k, v.length])),
  regions: Object.fromEntries(Object.entries(regions).map(([k, v]) => [k, v.length])),
  stylesByRegion, orphans, thin, noPicture, oneSource, hubs, duplicates: dupes, missingLinks: missing.slice(0, 15),
};

if (process.argv.includes("--json")) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

// --index: one line per entry, so the weaver can hold the whole web in view
if (process.argv.includes("--index")) {
  const first = (s) => String(s).replace(/\s+/g, " ").split(/(?<=\.)\s/)[0];
  for (const n of list.sort((a, b) => (anchorYear(a) ?? 9999) - (anchorYear(b) ?? 9999))) {
    // ">kind:id" this entry points at id; "<kind:id" id points at this entry
    const rel = edges.filter((e) => e.from === n.id || e.to === n.id).map((e) => (e.from === n.id ? `>${e.kind}:${e.to}` : `<${e.kind}:${e.from}`)).join(" ");
    console.log(`${n.id} | ${n.type} | ${anchorYear(n) ?? "-"} | ${(n.regions ?? []).join(",")} | ${n.name} | ${first(n.summary)} | ${rel}`);
  }
  for (const w of wanted) console.log(`${w.id} | queued | - | - | ${w.label} | linked from ${w.linkedFrom.join(", ")} |`);
  process.exit(0);
}

const bar = (n) => "#".repeat(n) || ".";
console.log(`${report.totals.entries} entries, ${report.totals.relations} typed relations, ${report.totals.wanted} topics queued\n`);
console.log("By kind:   " + Object.entries(report.byType).map(([k, v]) => `${k} ${v}`).join(", "));
console.log("By region: " + Object.entries(report.regions).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(", ") + "   (empty: " + Object.entries(report.regions).filter(([k, v]) => !v && k !== "other" && k !== "global").map(([k]) => k).join(", ") + ")");
console.log("Styles by region: " + (Object.entries(stylesByRegion).map(([r, s]) => `${r}: ${s.join(", ")}`).join("; ") || "none"));
console.log("\nEntries by decade (thin decades are where the curator should look):");
for (const [d, v] of Object.entries(report.decades)) console.log(`  ${d}s ${bar(v)}`);
const show = (label, arr, fmt = (x) => x) => console.log(`\n${label} (${arr.length}): ${arr.length ? arr.map(fmt).join(", ") : "none"}`);
show("Orphans, no typed relation", orphans);
show("Thin, one relation", thin);
show("No picture yet", noPicture);
show("Only one source", oneSource);
show("Most connected", hubs, ([id, d]) => `${id} ${d}`);
show("Possible duplicates", dupes, ([a, b]) => `${a} ~ ${b}`);
show("Possible missing links (share neighbours, not connected)", report.missingLinks, (m) => `${m.a} ~ ${m.b} via ${m.shared.join("/") || "a mention"}`);
