// npm run wanted — lists ids that entries link to but nobody has written yet,
// most-linked first. This is the nightly agent's main source of work.
import { loadAll, wantedList, TYPES } from "./lib.mjs";

const { nodes } = loadAll();
const wanted = wantedList(nodes);
const json = process.argv.includes("--json");

if (json) {
  console.log(JSON.stringify(wanted, null, 2));
} else {
  const counts = Object.keys(TYPES).map((t) => `${t}: ${[...nodes.values()].filter((n) => n.type === t).length}`);
  console.log(`Entries by type: ${counts.join(", ")}\n`);
  if (!wanted.length) console.log("Nothing wanted. Take new topics from BACKLOG.md.");
  for (const w of wanted) {
    console.log(`${w.id}  (${w.label})  linked from ${w.linkedFrom.length}: ${w.linkedFrom.join(", ")}`);
    for (const n of w.notes) console.log(`    hotspot note on ${n.from}: ${n.note}`);
  }
}
