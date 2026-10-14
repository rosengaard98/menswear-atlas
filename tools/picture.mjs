// npm run picture -- <entry-id> <commons file page or "File:Name.jpg"> [--write] [--contain | --crop=centre]
//
// Fetches one image from Wikimedia Commons, refuses it unless Commons lists it as
// public domain or CC0, gives it the house print treatment and saves it as
// pictures/<entry-id>.jpg. Prints the frontmatter block; --write puts it in the entry.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import YAML from "yaml";
import { ROOT, PICTURES, TYPES } from "./lib.mjs";

const UA = "menswear-atlas/0.1 (https://github.com/rosengaard98/menswear-atlas)";
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const [id, ref] = args;
if (!id || !ref) {
  console.error('Usage: npm run picture -- <entry-id> "https://commons.wikimedia.org/wiki/File:Example.jpg" [--write]');
  process.exit(2);
}

const title = decodeURIComponent(ref.replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\//, "")).replace(/_/g, " ");
if (!/^File:/.test(title)) fail(`"${ref}" is not a Commons file. Pass the file page URL or "File:Name.jpg".`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fail(msg) { console.error(msg); process.exit(1); }

// curl goes through the session's proxy; Node's fetch does not.
async function get(url, binary = false) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    let out;
    try {
      out = execFileSync("curl", ["-sS", "-L", "-A", UA, "-w", "\n%{http_code}", "--max-time", "60", url], { maxBuffer: 80 * 1024 * 1024, encoding: binary ? "buffer" : "utf8" });
    } catch (e) {
      out = null;
    }
    if (out) {
      const buf = Buffer.isBuffer(out) ? out : Buffer.from(out);
      const nl = buf.lastIndexOf(10);
      const code = Number(buf.subarray(nl + 1).toString());
      const body = buf.subarray(0, nl);
      if (code === 200) return binary ? body : body.toString("utf8");
      if (code !== 429 && code < 500) fail(`Commons answered ${code} for ${url}`);
    }
    if (attempt === 5) break;
    const wait = attempt * 20;
    console.error(`Commons is busy (rate limit); waiting ${wait}s before try ${attempt + 1} of 5`);
    await sleep(wait * 1000);
  }
  fail("Wikimedia Commons kept refusing requests from this machine. Do not loop: use the hotlink fallback in STYLE.md (picture.url) instead.");
}

const strip = (s) => String(s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const api = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({
  action: "query", titles: title, prop: "imageinfo", iiprop: "url|extmetadata|mime|size", iiurlwidth: "1000", format: "json",
});
const json = JSON.parse(await get(api));
const page = Object.values(json.query?.pages ?? {})[0];
if (!page || page.missing !== undefined || !page.imageinfo) fail(`No such file on Commons: ${title}`);
const info = page.imageinfo[0];
const meta = info.extmetadata ?? {};
const m = (k) => strip(meta[k]?.value);

// The licence gate. Only public domain and CC0, as Commons itself states it.
const short = m("LicenseShortName");
let licence = null;
if (/^cc0/i.test(short)) licence = "CC0";
else if (/^(public domain|pd\b|pd-)/i.test(short)) licence = "Public domain";
if (!licence || m("Copyrighted") === "True")
  fail(`Refused: Commons gives the licence as "${short || "unknown"}". Only public domain or CC0 images may be used.`);
if (!/^image\/(jpeg|png|tiff|gif|webp)/.test(info.mime)) fail(`Refused: ${info.mime} is not a photo or print.`);

const src = info.thumburl || info.url;
const raw = await get(src, true);

// House treatment: one shared look for every archival picture, like prints hung in
// the same club. Monochrome, warm ink on ivory, a little lift in the blacks.
fs.mkdirSync(PICTURES, { recursive: true });
const file = `${id}.jpg`;
// --contain keeps the whole picture (tall fashion plates); default crops to the frame from the top.
const fit = flags.has("--contain")
  ? { width: 640, height: 800, fit: "contain", background: "#f1ead9" }
  : { width: 640, height: 800, fit: "cover", position: flags.has("--crop=centre") ? "centre" : "north" };
await sharp(raw)
  .rotate()
  .flatten({ background: "#f1ead9" })
  .resize(fit)
  .grayscale()
  .normalise({ lower: 2, upper: 98 })
  .linear(0.9, 14)
  .tint({ r: 122, g: 98, b: 66 })
  .jpeg({ quality: 76, mozjpeg: true, progressive: true })
  .toFile(path.join(PICTURES, file));

const picture = {
  kind: "archival",
  file,
  title: m("ObjectName") || title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
  creator: m("Artist").slice(0, 140) || undefined,
  date: m("DateTimeOriginal").slice(0, 40) || undefined,
  licence,
  source: info.descriptionurl,
};
for (const k of Object.keys(picture)) if (picture[k] === undefined) delete picture[k];
const block = YAML.stringify({ picture }, { lineWidth: 0 }).trimEnd();
console.log(`Saved pictures/${file} (${licence}).\n\n${block}\n`);
console.log("Check creator and date against the Commons page before publishing; Commons metadata is not always clean.");

if (flags.has("--write")) {
  const entry = Object.values(TYPES).map((t) => path.join(ROOT, "content", t.folder, `${id}.md`)).find((p) => fs.existsSync(p));
  if (!entry) fail(`No entry content/*/${id}.md to write into; add the block by hand.`);
  let text = fs.readFileSync(entry, "utf8");
  if (/^picture:/m.test(text)) {
    // replace an existing picture block (the key and its indented lines)
    text = text.replace(/^picture:.*\n(?:[ \t]+.*\n)*/m, block + "\n");
  } else {
    text = text.replace(/^sources:/m, block + "\nsources:");
  }
  fs.writeFileSync(entry, text);
  console.log(`Wrote the picture block into ${path.relative(ROOT, entry)}.`);
}
