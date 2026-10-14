// npm run validate — checks every entry against SCHEMA.md. Exits 1 on any error.
import { loadAll, loadSite, wantedList, loadRuns, checkPosts } from "./lib.mjs";

const { nodes, errors, warnings } = loadAll();
const site = loadSite();
const runLog = loadRuns();
errors.push(...runLog.errors);
errors.push(...checkPosts(nodes));
if (!site.title || !site.timeline?.from || !site.timeline?.to) errors.push("content/site.yml: needs title and timeline.from/to");

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`error ${e}`);

const wanted = wantedList(nodes);
console.log(`\n${nodes.size} entries, ${wanted.length} wanted (linked but not written), ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
