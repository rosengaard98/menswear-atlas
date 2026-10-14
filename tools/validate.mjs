// npm run validate — checks every entry against SCHEMA.md. Exits 1 on any error.
import { loadAll, loadSite, wantedList } from "./lib.mjs";

const { nodes, errors, warnings } = loadAll();
const site = loadSite();
if (site.featured && !nodes.has(site.featured)) errors.push(`content/site.yml: featured "${site.featured}" has no entry`);
const featured = nodes.get(site.featured);
if (featured && !(featured.views?.length > 0)) errors.push(`content/site.yml: featured "${site.featured}" needs at least one view`);

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`error ${e}`);

const wanted = wantedList(nodes);
console.log(`\n${nodes.size} entries, ${wanted.length} wanted (linked but not written), ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
