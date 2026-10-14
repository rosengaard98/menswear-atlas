import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "../dist/index.html"), "utf8");
const data = JSON.parse(html.match(/<script[^>]*id="atlas-data"[^>]*>([\s\S]*?)<\/script>/)[1]);

const PHOTO = { regency: "regency", "beau-brummell": "brummell", victorian: "victorian", polo: "polo" }; // prototype only: stand-ins
const STYLE = `<style>.cloth{fill:#fbf8f0;stroke:#2b251d;stroke-width:2.2;stroke-linejoin:round}.cloth-alt{fill:#e9e0cc;stroke:#2b251d;stroke-width:1.6}.shade{fill:#d8ccb2}.line{fill:none;stroke:#2b251d;stroke-width:2.2;stroke-linecap:round}.seam{fill:none;stroke:#2b251d;stroke-width:1.1;stroke-dasharray:4 3}.fold{fill:none;stroke:#2b251d;stroke-width:1;stroke-opacity:.4}.guide,.grain{fill:none;stroke:#7b6e58;stroke-width:1.3}.button{fill:#fbf8f0;stroke:#2b251d;stroke-width:1.4}.hole{fill:#2b251d}</style>`;
const b64 = (buf, mime) => `data:${mime};base64,${buf.toString("base64")}`;

const nodes = [];
for (const n of data.nodes) {
  let thumb = null, bg = null, fit = "cover";
  const photo = PHOTO[n.id];
  if (photo) {
    const f = path.join(here, "img", photo + ".jpg");
    const tint = (s) => s.grayscale().tint("#b79a68");
    thumb = b64(await tint(sharp(f).resize(260, 260, { fit: "cover", position: "attention" })).jpeg({ quality: 70 }).toBuffer(), "image/jpeg");
    bg = b64(await tint(sharp(f).resize(1500, null, { withoutEnlargement: true })).jpeg({ quality: 58 }).toBuffer(), "image/jpeg");
  } else if (n.picture?.kind === "drawing") {
    let svg = data.svgs[n.picture.svg].replace(/<text[\s\S]*?<\/text>/g, "");
    const vb = n.picture.viewBox;
    svg = svg.replace(/<svg\b([^>]*)>/, (m, a) => `<svg${a.replace(/\s(viewBox|width|height)="[^"]*"/g, "")} viewBox="${vb.join(" ")}">${STYLE}`);
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 380 }, background: "#f4ecd8" }).render().asPng();
    thumb = bg = b64(await sharp(png).png({ compressionLevel: 9, palette: true }).toBuffer(), "image/png");
    fit = "contain";
  }
  const p = n.period;
  nodes.push({ id: n.id, name: n.name, type: n.type, aka: n.aka ?? [], regions: n.regions ?? [], summary: n.summary, years: p?.from != null ? [p.from, p.to] : null, when: p?.from != null ? (p.to == null ? `${p.from}–` : p.to === p.from ? `${p.from}` : `${p.from}–${p.to}`) : "", deg: 0, thumb, bg, fit });
}
const mentions = [];
for (const n of data.nodes) for (const m of n.mentions ?? []) mentions.push([n.id, m, "mention"]);
const edges = data.edges.map((e) => [e.from, e.to, e.kind]);
const payload = { nodes, wanted: data.wanted.map((w) => ({ id: w.id, label: w.label })), edges, mentions, types: data.types };

const engine = fs.readFileSync(path.join(here, "engine.js"), "utf8");
const BASE = `
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden}
body{font-family:"EB Garamond","Cormorant Garamond",Georgia,"Times New Roman",serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased}
#stage{position:fixed;inset:0;touch-action:none;cursor:grab;overflow:hidden}#stage.grab{cursor:grabbing}
.bg{position:absolute;inset:-4%;background-size:cover;background-position:center;opacity:0;transition:opacity 1.3s ease,transform 9s ease;transform:scale(1.03);will-change:opacity,transform;filter:var(--bgfilter)}
.bg.on{opacity:var(--bgop);transform:scale(1.1)}
.bg::after{content:"";position:absolute;inset:0;background:var(--tint);mix-blend-mode:var(--tintmode);opacity:.35}
#veil{position:absolute;inset:0;background:var(--veil);pointer-events:none}
#bgWord{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-size:clamp(3rem,13vw,11rem);line-height:1;letter-spacing:.02em;color:var(--ink);opacity:0;transition:opacity 1s;pointer-events:none;font-style:italic;padding:0 4vw}
#bgWord.on{opacity:.07}
#edges{position:absolute;inset:0;pointer-events:none}
#world{position:absolute;left:0;top:0;transform-origin:0 0}
.node{position:absolute;left:0;top:0;width:0;height:0;will-change:transform;cursor:pointer}
.node>*{position:absolute;left:0;top:0}
.node .lbl{transform:translate(-50%,calc(var(--d)/2 + 7px));white-space:nowrap;font-size:.86rem;letter-spacing:.02em;color:var(--ink);text-shadow:var(--lblshadow);pointer-events:none;transition:opacity .4s,transform .4s}
.node.ghost .lbl{opacity:0;transform:translate(-50%,14px);font-size:.8rem}
.node.ghost:hover .lbl,.node.ghost.lit .lbl,.node.ghost.hit .lbl,.node.ghost.focus .lbl{opacity:.95}
.node.ghost i{display:block;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;border:1.5px solid var(--c);opacity:.7;transition:all .4s;background:transparent}
.node.ghost:hover i,.node.ghost.focus i,.node.ghost.hit i{transform:scale(1.7);background:var(--c);opacity:1}
.node{opacity:0;transition:opacity .35s}.node.in{opacity:1;transition:opacity 1.2s .1s}
.node.dim{opacity:.16!important}.node.out{opacity:.05!important;pointer-events:none}
.node .face{transition:transform .45s cubic-bezier(.2,.8,.2,1),box-shadow .45s,filter .45s}
.node.focus .face,.node:hover .face{transform:translate(-50%,-50%) scale(1.3)}
.node.hit .face{animation:pulse 1.6s ease-in-out infinite}
@keyframes pulse{50%{transform:translate(-50%,-50%) scale(1.14)}}
.node.focus,.node:hover{z-index:5}
.pic{width:100%;height:100%;background-position:center;background-repeat:no-repeat;display:grid;place-items:center}
.pic.has{background-color:#f4ecd8}.pic b{font-weight:500;font-size:1.25rem;letter-spacing:.04em;color:var(--ink);opacity:.8}
.ui{position:fixed;z-index:20}
#brand{left:22px;top:18px;pointer-events:none}#brand h1{margin:0;font-weight:500;font-size:1.5rem;letter-spacing:.01em}#brand small{display:block;font-size:.8rem;letter-spacing:.2em;text-transform:uppercase;color:var(--soft)}
#search{left:50%;top:16px;transform:translateX(-50%);width:min(520px,calc(100vw - 32px));display:flex;align-items:center;gap:.6rem;padding:.55rem 1rem;border-radius:999px;background:var(--glass);border:1px solid var(--edge);backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);box-shadow:var(--pshadow)}
#search input{flex:1;min-width:0;background:none;border:0;outline:0;font:inherit;font-size:1.15rem;color:var(--ink)}#search input::placeholder{color:var(--soft)}
#search kbd{font:inherit;font-size:.75rem;border:1px solid var(--edge);border-radius:5px;padding:0 .4rem;color:var(--soft)}#count{font-size:.85rem;color:var(--soft);white-space:nowrap}
#chips{left:50%;top:72px;transform:translateX(-50%);display:flex;gap:.4rem;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 32px)}
#chips button{font:inherit;font-size:.82rem;letter-spacing:.04em;padding:.12rem .75rem;border-radius:999px;border:1px solid var(--edge);background:var(--glass);color:var(--soft);cursor:pointer;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);transition:all .25s}
#chips button::before{content:"";display:inline-block;width:.5rem;height:.5rem;border-radius:50%;background:var(--c);margin-right:.4rem}
#chips button:hover{color:var(--ink)}#chips button.on{color:var(--ink);border-color:var(--c);box-shadow:0 0 12px -2px var(--c)}
#years{left:50%;bottom:20px;transform:translateX(-50%);width:min(560px,calc(100vw - 32px));padding:.55rem 1.1rem .7rem;border-radius:16px;background:var(--glass);border:1px solid var(--edge);backdrop-filter:blur(18px) saturate(150%);-webkit-backdrop-filter:blur(18px) saturate(150%);box-shadow:var(--pshadow)}
#years .row{display:flex;justify-content:space-between;font-size:.85rem;color:var(--soft);letter-spacing:.06em;text-transform:uppercase}#ylabel{color:var(--ink)}
.track{position:relative;height:22px;margin-top:2px}.track::before{content:"";position:absolute;left:0;right:0;top:10px;height:2px;background:var(--edge);border-radius:2px}
#yspan{position:absolute;top:10px;height:2px;background:var(--accent);box-shadow:0 0 10px var(--accent)}
.track input{position:absolute;left:0;top:0;width:100%;height:22px;margin:0;background:none;pointer-events:none;-webkit-appearance:none;appearance:none}
.track input::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:16px;height:16px;border-radius:50%;background:var(--accent);border:2px solid var(--bg);cursor:pointer;box-shadow:0 0 12px var(--accent)}
.track input::-moz-range-thumb{pointer-events:auto;width:12px;height:12px;border-radius:50%;background:var(--accent);border:2px solid var(--bg);cursor:pointer}
#card{left:22px;bottom:22px;width:min(340px,calc(100vw - 44px));padding:.9rem 1.1rem 1rem;border-radius:14px;background:var(--glass);border:1px solid var(--edge);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:var(--pshadow);opacity:0;transform:translateY(10px);transition:all .45s;pointer-events:none}
#card.on{opacity:1;transform:none}#card small,#panel small{font-size:.74rem;letter-spacing:.18em;text-transform:uppercase;color:var(--soft)}#card h2,#panel h2{margin:.15rem 0 .3rem;font-weight:500;font-size:1.4rem;line-height:1.15}#card p,#panel p{margin:0;font-size:1.02rem;line-height:1.4;color:var(--ink2)}
#panel{right:20px;top:76px;bottom:96px;width:min(340px,calc(100vw - 40px));overflow:auto;padding:1.1rem 1.2rem;border-radius:16px;background:var(--glass2);border:1px solid var(--edge);backdrop-filter:blur(24px) saturate(150%);-webkit-backdrop-filter:blur(24px) saturate(150%);box-shadow:var(--pshadow);opacity:0;transform:translateX(24px);pointer-events:none;transition:all .5s cubic-bezier(.2,.8,.2,1)}
#panel.on{opacity:1;transform:none;pointer-events:auto}#panel .x{position:absolute;right:.7rem;top:.4rem;background:none;border:0;color:var(--soft);font-size:1.6rem;cursor:pointer}
#panel h3{margin:1rem 0 .4rem;font-weight:500;font-size:.78rem;letter-spacing:.18em;text-transform:uppercase;color:var(--soft)}
.rel{display:flex;flex-wrap:wrap;gap:.35rem}.rel button{font:inherit;font-size:.9rem;padding:.08rem .65rem;border-radius:999px;border:1px solid var(--edge);background:transparent;color:var(--ink);cursor:pointer}.rel button:hover{border-color:var(--accent);box-shadow:0 0 10px -2px var(--accent)}.rel button.g{color:var(--soft);border-style:dashed}
.go{display:inline-block;margin-top:1rem;color:var(--accent);text-decoration:none;border-bottom:1px solid currentColor}
.proto{right:20px;bottom:20px;font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);pointer-events:none}
#hint{right:20px;bottom:46px;text-align:right;font-size:.85rem;color:var(--soft);pointer-events:none;opacity:.8}
@media(max-width:700px){#brand h1{font-size:1.15rem}#brand small{display:none}#hint,.proto{display:none}#chips{top:68px}#panel{top:auto;bottom:90px;max-height:46vh;right:12px;left:12px;width:auto}#card{bottom:96px;left:12px}}
`;

const VARIANTS = {
  glass: {
    title: "Glass", file: "1-glass.html",
    cfg: { baseR: 22, degR: 5, maxR: 44, repulse: 5200, spring: 78, gravity: 0.0016, drift: 0.012, edgeA: 0.28, line: "#e8d6a8", glow: true, glowColor: "#ffe7a6", travel: true, rings: false,
      colors: { garment: "#e0b85c", detail: "#9fd3b8", style: "#7fb7e0", era: "#c9a0dc", maker: "#e68a7a", person: "#f2d28b", context: "#9bd0d6", ghost: "#a8b5a6" } },
    css: `
:root{--bg:#06150f;--ink:#f3ecda;--ink2:#e6dfc9;--soft:#a9b9ab;--glass:rgba(255,255,255,.07);--glass2:rgba(14,38,30,.55);--edge:rgba(240,220,170,.26);--accent:#e3c27a;--pshadow:0 10px 40px -10px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.18);--lblshadow:0 1px 8px rgba(0,0,0,.9);--bgfilter:saturate(.85) contrast(1.05);--bgop:.55;--tintmode:soft-light;--tint:transparent;--veil:radial-gradient(ellipse at 50% 45%,rgba(6,21,15,.1),rgba(6,21,15,.85) 90%)}
body{background:radial-gradient(ellipse at 30% 20%,#103a2c 0%,#07180f 55%,#030a07 100%)}
#veil::before,#veil::after{content:"";position:absolute;width:60vmax;height:60vmax;border-radius:50%;filter:blur(70px);opacity:.25;animation:float 26s ease-in-out infinite alternate}
#veil::before{left:-15vmax;top:-10vmax;background:#2e7a5a}#veil::after{right:-20vmax;bottom:-25vmax;background:#8a5a1c;animation-duration:34s}
@keyframes float{to{transform:translate(8vmax,6vmax) scale(1.15)}}
.node .face{left:0;top:0;width:var(--d);height:var(--d);transform:translate(-50%,-50%);border-radius:50%;overflow:hidden;background:linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.04));border:1px solid rgba(255,244,214,.45);backdrop-filter:blur(12px) saturate(160%);-webkit-backdrop-filter:blur(12px) saturate(160%);box-shadow:0 8px 30px -8px rgba(0,0,0,.6),inset 0 1px 1px rgba(255,255,255,.55),inset 0 -10px 18px rgba(0,0,0,.15),0 0 0 2px color-mix(in srgb,var(--c) 40%,transparent)}
.node .face::after{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(ellipse at 30% 18%,rgba(255,255,255,.5),transparent 48%);pointer-events:none}
.node.focus .face,.node:hover .face{box-shadow:0 0 36px 4px color-mix(in srgb,var(--c) 70%,transparent),inset 0 1px 1px rgba(255,255,255,.7)}
.pic.has{background-color:rgba(244,236,216,.88)}.pic:not(.has){background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--c) 55%,transparent),rgba(0,0,0,.15))}
` },
  gallery: {
    title: "Gallery", file: "2-gallery.html",
    cfg: { baseR: 30, degR: 5, maxR: 54, repulse: 6800, spring: 92, gravity: 0.0014, drift: 0.01, edgeA: 0.5, line: "#6b4f2a", glow: false, glowColor: "#8d2a36", travel: false, rings: false,
      colors: { garment: "#8d6a35", detail: "#5d7a52", style: "#1f4a3a", era: "#8d2a36", maker: "#a0522d", person: "#6a5230", context: "#4a6a74", ghost: "#8c7a5a" } },
    css: `
:root{--bg:#f1e9d6;--ink:#2a2118;--ink2:#3d3226;--soft:#7d6d52;--glass:rgba(250,245,232,.72);--glass2:rgba(250,245,232,.88);--edge:rgba(125,95,45,.35);--accent:#8d2a36;--pshadow:0 12px 34px -14px rgba(60,40,10,.45);--lblshadow:0 0 6px #f1e9d6,0 0 10px #f1e9d6;--bgfilter:sepia(.55) contrast(.95);--bgop:.5;--tintmode:multiply;--tint:transparent;--veil:radial-gradient(ellipse at 50% 50%,rgba(241,233,214,0),rgba(190,165,115,.55) 100%)}
body{background:radial-gradient(ellipse at 50% 40%,#f6efdd,#e9dfc6)}
#stage::before{content:"";position:absolute;inset:0;z-index:0;opacity:.35;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .4  0 0 0 0 .3  0 0 0 0 .15  0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");pointer-events:none}
.node .face{width:calc(var(--d)*.86);height:calc(var(--d)*1.08);left:0;top:0;transform:translate(-50%,-50%);padding:5px;background:#f8f2e2;border:5px solid transparent;border-image:linear-gradient(135deg,#dcbc7d,#8d6a35 45%,#caa564 70%,#7a5a2b) 1;box-shadow:0 14px 24px -12px rgba(50,30,5,.55),0 2px 4px rgba(50,30,5,.25)}
.pic{filter:sepia(.35) saturate(.9)}.pic:not(.has){background:linear-gradient(160deg,color-mix(in srgb,var(--c) 30%,#f4ecd8),color-mix(in srgb,var(--c) 70%,#d9c9a2))}.pic b{color:#f8f2e2;font-size:1.5rem}
.node .lbl{transform:translate(-50%,calc(var(--d)*.54 + 9px));font-style:italic}
.node.focus .face,.node:hover .face{box-shadow:0 22px 34px -12px rgba(50,30,5,.6),0 0 0 3px rgba(141,42,54,.35)}
#chips button.on{box-shadow:none;background:var(--c);color:#fbf6e8}#chips button.on::before{background:#fbf6e8}
` },
  orrery: {
    title: "Orrery", file: "3-orrery.html",
    cfg: { baseR: 15, degR: 3.4, maxR: 30, repulse: 4200, spring: 64, gravity: 0.002, drift: 0.014, edgeA: 0.26, line: "#d8b46a", glow: true, glowColor: "#ffd98a", travel: true, rings: true,
      colors: { garment: "#e6b45e", detail: "#7fc4a2", style: "#e4e0cf", era: "#c15a6a", maker: "#e08c5a", person: "#d9a7c7", context: "#7ab0d6", ghost: "#7d8aa0" } },
    css: `
:root{--bg:#090c16;--ink:#ece6d3;--ink2:#d8d2bf;--soft:#8f98ad;--glass:rgba(20,26,46,.55);--glass2:rgba(14,19,36,.72);--edge:rgba(216,180,106,.3);--accent:#d8b46a;--pshadow:0 10px 40px -10px rgba(0,0,0,.7);--lblshadow:0 1px 10px #090c16,0 0 4px #090c16;--bgfilter:saturate(.8) brightness(.8);--bgop:.5;--tintmode:color;--tint:transparent;--veil:radial-gradient(ellipse at 50% 50%,rgba(9,12,22,.1),rgba(9,12,22,.88) 85%)}
body{background:radial-gradient(ellipse at 50% 50%,#141b33 0%,#090c16 60%,#04060c 100%)}
#veil::before{content:"";position:absolute;inset:0;background-image:radial-gradient(1px 1px at 12% 18%,#fff8,transparent),radial-gradient(1px 1px at 78% 30%,#fff6,transparent),radial-gradient(1.4px 1.4px at 40% 82%,#fff7,transparent),radial-gradient(1px 1px at 88% 72%,#fff6,transparent),radial-gradient(1px 1px at 25% 60%,#fff5,transparent),radial-gradient(1.2px 1.2px at 62% 12%,#fff7,transparent);animation:twinkle 7s ease-in-out infinite alternate}
@keyframes twinkle{50%{opacity:.35}}
.node .face{left:0;top:0;width:var(--d);height:var(--d);transform:translate(-50%,-50%);border-radius:50%;overflow:hidden;background:#141a30;border:1.5px solid var(--c);box-shadow:0 0 18px -2px color-mix(in srgb,var(--c) 60%,transparent);transition:transform .5s cubic-bezier(.2,.8,.2,1),box-shadow .5s}
.pic{filter:sepia(.4) brightness(.9)}.pic:not(.has){background:radial-gradient(circle,color-mix(in srgb,var(--c) 55%,#141a30),#141a30 75%)}.pic b{font-size:.95rem;color:var(--c)}
.node.focus .face,.node:hover .face{transform:translate(-50%,-50%) scale(1.9);box-shadow:0 0 40px 2px color-mix(in srgb,var(--c) 75%,transparent)}
.node .lbl{font-size:.74rem;letter-spacing:.14em;text-transform:uppercase}
` },
};

for (const [key, v] of Object.entries(VARIANTS)) {
  const d = { ...payload, variant: v.cfg };
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Menswear Atlas, prototype: ${v.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<style>${BASE}${v.css}</style></head><body>
<div id="stage"><div class="bg" id="bgA"></div><div class="bg" id="bgB"></div><div id="veil"></div><div id="bgWord"></div><canvas id="edges"></canvas><div id="world"></div></div>
<div class="ui" id="brand"><h1>The Menswear Atlas</h1><small>Prototype · ${v.title}</small></div>
<div class="ui" id="search"><input id="q" type="search" placeholder="Search the web: ivy, collar, Italy, Brooks…" autocomplete="off" aria-label="Search"><span id="count"></span><kbd>/</kbd></div>
<div class="ui" id="chips"></div>
<div class="ui" id="hint">Hover a piece · drag the background · scroll to zoom · double-click to reset</div>
<div class="ui" id="card"></div>
<div class="ui" id="panel"></div>
<div class="ui" id="years"><div class="row"><span>Years</span><span id="ylabel">All years</span></div><div class="track"><div id="yspan"></div><input id="y0" type="range" min="1770" max="2030" value="1770" aria-label="From year"><input id="y1" type="range" min="1770" max="2030" value="2030" aria-label="To year"></div></div>
<script type="application/json" id="data">${JSON.stringify(d).replace(/</g, "\\u003c")}</script>
<script>${engine}</script></body></html>`;
  fs.writeFileSync(path.join(here, v.file), page);
  console.log(v.file, (page.length / 1024).toFixed(0) + " KB");
}
