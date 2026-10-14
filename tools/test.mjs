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

// 1. the web: the home page draws every entry and every queued topic, fits the screen
for (const [w, h, name] of [[1366, 900, "web-desktop"], [400, 860, "web-phone"]]) {
  const p = await page(w, h, "light");
  await p.goto(url); await p.waitForTimeout(1600);
  checks++;
  const count = await p.locator(".tw-node").count();
  const expected = nodes.size + wanted.length;
  if (count !== expected) fail(name, `web shows ${count} pieces, expected ${expected}`);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) fail(name, `page scrolls sideways by ${overflow}px`);
  // every real piece sits inside the screen after the first fit
  checks++;
  const outside = await p.evaluate(() => [...document.querySelectorAll(".tw-real .tw-body")].filter((el) => { const r = el.getBoundingClientRect(); return r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight; }).length);
  if (outside) fail(name, `${outside} pieces start outside the screen`);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(out, `${name}.png`) });
  if (p._errors.length) fail(name, p._errors.join(" | "));
  await p.close();
}

// 2. every piece opens its ticket with the right name; search, filters and the tape measure work
{
  const p = await page(1366, 900, "light");
  await p.goto(url); await p.waitForTimeout(1200);
  const ids = [...nodes.keys()];
  const sample = ids.length > 150 ? ids.filter((_, i) => i % Math.ceil(ids.length / 150) === 0) : ids;
  for (const id of sample) {
    checks++;
    await p.evaluate((id) => document.querySelector(`.tw-node[data-id="${id}"]`)?.click(), id);
    const title = await p.locator("#tw-panel h2").textContent({ timeout: 2000 }).catch(() => null);
    if (title !== nodes.get(id).name) fail(`web ticket ${id}`, `ticket shows "${title}"`);
  }
  for (const w of wanted.slice(0, 5)) {
    checks++;
    await p.evaluate((id) => document.querySelector(`.tw-node[data-id="${id}"]`)?.click(), w.id);
    const title = await p.locator("#tw-panel h2").textContent({ timeout: 2000 }).catch(() => null);
    if (title !== w.label) fail(`web ticket ${w.id}`, `ticket shows "${title}"`);
  }
  // search: "ivy" must find the Ivy League look and dim the rest
  checks++;
  await p.keyboard.press("Escape");
  await p.fill("#tw-q", "ivy"); await p.waitForTimeout(500);
  const found = await p.locator("#tw-count").textContent();
  const hits = await p.locator(".tw-node.hit").count(), dim = await p.locator(".tw-node.dim").count();
  if (!/found/.test(found ?? "") || hits < 1 || dim < 1) fail("web search", `"ivy" gave "${found}", ${hits} lit, ${dim} dimmed`);
  if (!(await p.locator('.tw-node[data-id="ivy-league-look"].hit').count())) fail("web search", "the Ivy League look is not highlighted for \"ivy\"");
  await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(out, "web-search.png") });
  await p.fill("#tw-q", "");
  // kind filter
  checks++;
  await p.locator("#tw-kinds button").first().click();
  const out1 = await p.locator(".tw-node.out").count();
  if (out1 < 1) fail("web filter", "choosing a kind hid nothing");
  await p.locator("#tw-kinds button").first().click();
  // tape measure: pushing the left clip forward dims early pieces
  checks++;
  await p.locator("#tw-clipL").focus();
  for (let i = 0; i < 30; i++) await p.keyboard.press("ArrowRight");
  const label = await p.locator("#tw-tlabel").textContent();
  const early = await p.locator('.tw-node[data-id="regency"].out').count();
  if (!/to today/.test(label ?? "") || !early) fail("web tape", `tape says "${label}", Regency dimmed: ${early}`);
  // hover shows the caption and a backdrop
  checks++;
  await p.evaluate(() => document.querySelector("#tw-clipL").dispatchEvent(new KeyboardEvent("keydown", { key: "Home" })));
  await p.locator("#tw-panel .x").click({ timeout: 1000 }).catch(() => {});
  const box = await p.evaluate(() => { const r = document.querySelector('.tw-node[data-id="english-country"] .tw-body').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.mouse.move(box[0], box[1]); await p.waitForTimeout(1500);
  const cap = await p.locator("#tw-caption h2").textContent().catch(() => null);
  const bgOn = await p.locator(".tw-bg.on").count();
  if (cap !== "English country" || !bgOn) fail("web hover", `caption "${cap}", backdrop ${bgOn}`);
  await p.screenshot({ path: path.join(out, "web-hover.png") });
  if (p._errors.length) fail("web interactions", p._errors.join(" | "));
  await p.close();
}

// 2b. the catalogue page lists every entry
{
  const p = await page(1280, 900, "light");
  await go(p, "catalogue");
  checks++;
  const links = await p.locator(".index a").count();
  if (links !== nodes.size) fail("catalogue", `lists ${links} entries, expected ${nodes.size}`);
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
