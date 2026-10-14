// npm test — builds the site, then clicks through it in a headless browser.
// Checks every entry page, every hotspot, the web and its cards, phone width and
// dark mode, and saves screenshots to .preview/test/ for the visual reviewer.
// Writes .preview/test/report.json. Exits 1 if anything fails.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { ROOT, loadAll, wantedList, findChromium } from "./lib.mjs";

execFileSync("node", [path.join(ROOT, "tools/build.mjs")], { stdio: "inherit" });

const out = path.join(ROOT, ".preview/test");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const url = "file://" + path.join(ROOT, "dist/index.html");
const { nodes } = loadAll();
const wanted = wantedList(nodes);
const failures = [];
const fail = (where, what) => failures.push({ where, what });
let checks = 0;

const browser = await chromium.launch({ executablePath: findChromium() });
async function page(width, height, scheme) {
  const p = await browser.newPage({ viewport: { width, height }, colorScheme: scheme });
  p._errors = [];
  p.on("pageerror", (e) => p._errors.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text())) p._errors.push(m.text()); });
  return p;
}
const go = async (p, hash) => { await p.goto(url + "#" + hash); await p.waitForTimeout(150); };

// 1. the web
for (const [w, h, scheme, name] of [[1366, 900, "light", "web-desktop-light"], [1366, 900, "dark", "web-desktop-dark"], [400, 860, "light", "web-phone"]]) {
  const p = await page(w, h, scheme);
  await p.goto(url); await p.waitForTimeout(700);
  checks++;
  const count = await p.locator(".node").count();
  const expected = [...nodes.values()].filter((n) => n.type !== "era").length + wanted.length;
  if (count !== expected) fail(name, `web shows ${count} pictures, expected ${expected}`);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) fail(name, `page scrolls sideways by ${overflow}px`);
  await p.screenshot({ path: path.join(out, `${name}.png`) });
  if (p._errors.length) fail(name, p._errors.join(" | "));
  await p.close();
}

// 2. every web card opens with the right name (sampled when the web is large)
{
  const p = await page(1366, 900, "light");
  await p.goto(url); await p.waitForTimeout(600);
  const ids = [...nodes.keys()].filter((id) => nodes.get(id).type !== "era");
  const sample = ids.length > 150 ? ids.filter((_, i) => i % Math.ceil(ids.length / 150) === 0) : ids;
  for (const id of sample) {
    checks++;
    await p.evaluate((id) => document.querySelector(`.node[data-id="${id}"]`)?.click(), id);
    const title = await p.locator(".web-card h2").textContent({ timeout: 2000 }).catch(() => null);
    if (title !== nodes.get(id).name) fail(`web card ${id}`, `card shows "${title}"`);
  }
  await p.evaluate((id) => document.querySelector(`.node[data-id="${id}"]`)?.click(), sample[0]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(out, "web-card.png") });
  if (p._errors.length) fail("web cards", p._errors.join(" | "));
  await p.close();
}

// 3. every entry page, every link on it, every hotspot
{
  const p = await page(1280, 900, "light");
  for (const n of nodes.values()) {
    await go(p, n.id);
    checks++;
    const h1 = await p.locator("h1").last().textContent({ timeout: 2000 }).catch(() => null);
    if (h1 !== n.name) fail(`entry ${n.id}`, `heading is "${h1}"`);
    const hrefs = await p.$$eval("main a[href^='#']", (as) => as.map((a) => a.getAttribute("href").slice(1).replace(/^~/, "")));
    for (const href of hrefs) if (href && !nodes.has(href) && !wanted.some((w) => w.id === href)) fail(`entry ${n.id}`, `link to "${href}" goes nowhere`);
    const views = n.views ?? [];
    for (let vi = 0; vi < views.length; vi++) {
      if (vi > 0) await p.locator(".views button").nth(vi).click();
      for (let si = 0; si < (views[vi].hotspots ?? []).length; si++) {
        checks++;
        try { await p.locator(".figure .spot").nth(si).click({ timeout: 4000 }); }
        catch { fail(`hotspot ${n.id} ${views[vi].label} #${si + 1}`, "ring cannot be clicked (covered or off the plate)"); continue; }
        const label = await p.locator(".pop h3").textContent({ timeout: 2000 }).catch(() => null);
        if (label !== views[vi].hotspots[si].label) fail(`hotspot ${n.id} ${views[vi].label} #${si + 1}`, `box shows "${label}"`);
        const box = await p.locator(".pop").boundingBox();
        const fig = await p.locator(".figure").boundingBox();
        if (box && fig && (box.x < fig.x - 2 || box.x + box.width > fig.x + fig.width + 2)) fail(`hotspot ${n.id} ${views[vi].label} #${si + 1}`, "box sticks out of the plate");
        await p.locator(".pop .close").click({ timeout: 2000 }).catch(() => {});
      }
    }
  }
  if (p._errors.length) fail("entry pages", p._errors.join(" | "));
  await p.close();
}

// 4. queued topics render
{
  const p = await page(1280, 900, "light");
  for (const w of wanted) {
    await go(p, w.id);
    checks++;
    const h1 = await p.locator("h1").last().textContent({ timeout: 2000 }).catch(() => null);
    if (h1 !== w.label) fail(`queued ${w.id}`, `heading is "${h1}"`);
  }
  await p.close();
}

// 5. phone width and dark mode for the newest entries, with screenshots
const newest = [...nodes.values()].sort((a, b) => b.added.localeCompare(a.added) || a.id.localeCompare(b.id)).slice(0, 4);
for (const [w, h, scheme] of [[400, 860, "light"], [1280, 900, "dark"]]) {
  const p = await page(w, h, scheme);
  for (const n of newest) {
    await go(p, n.id);
    checks++;
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) fail(`entry ${n.id} at ${w}px`, `page scrolls sideways by ${overflow}px`);
    await p.screenshot({ path: path.join(out, `entry-${n.id}-${w}-${scheme}.png`), fullPage: w < 500 });
  }
  if (p._errors.length) fail(`${scheme} ${w}px`, p._errors.join(" | "));
  await p.close();
}

await browser.close();
const report = { checks, failures, screenshots: fs.readdirSync(out).filter((f) => f.endsWith(".png")) };
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(`\n${checks} checks, ${failures.length} failures. Screenshots and report in .preview/test/`);
for (const f of failures) console.log(`FAIL ${f.where}: ${f.what}`);
process.exit(failures.length ? 1 : 0);
