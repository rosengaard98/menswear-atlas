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
    thumb = b64(await sharp(png).png({ compressionLevel: 9, palette: true }).toBuffer(), "image/png");
    const chalk = `<style>.cloth,.cloth-alt,.shade,.button{fill:none;stroke:#c9a35b;stroke-width:2.4;stroke-linejoin:round}.hole{fill:#c9a35b}.line,.seam,.fold,.guide,.grain{fill:none;stroke:#c9a35b;stroke-width:1.6;stroke-linecap:round}.seam{stroke-dasharray:4 3}.fold{stroke-opacity:.4}</style>`;
    const svg2 = svg.replace(STYLE, chalk);
    const png2 = new Resvg(svg2, { fitTo: { mode: "height", value: 900 } }).render().asPng();
    bg = b64(await sharp(png2).png({ compressionLevel: 9, palette: true }).toBuffer(), "image/png");
    fit = "contain";
  }
  const p = n.period;
  nodes.push({ id: n.id, name: n.name, type: n.type, aka: n.aka ?? [], regions: n.regions ?? [], summary: n.summary, years: p?.from != null ? [p.from, p.to] : null, when: p?.from != null ? (p.to == null ? `${p.from}–` : p.to === p.from ? `${p.from}` : `${p.from}–${p.to}`) : "", deg: 0, thumb, bg, fit });
}
const mentions = [];
for (const n of data.nodes) for (const m of n.mentions ?? []) mentions.push([n.id, m, "mention"]);
const edges = data.edges.map((e) => [e.from, e.to, e.kind]);
const payload = { nodes, wanted: data.wanted.map((w) => ({ id: w.id, label: w.label })), edges, mentions, types: data.types };


const CSS = `
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden}
:root{--baize:#0d281e;--ink:#efe6d0;--soft:#a9b5a6;--brass:#c9a35b;--paper:#ece3cb;--oxblood:#6e1f2b}
body{font-family:"EB Garamond",Georgia,"Times New Roman",serif;background:var(--baize);color:var(--ink);-webkit-font-smoothing:antialiased}
#stage{position:fixed;inset:0;overflow:hidden;touch-action:none;cursor:grab;--lx:55%;--ly:45%;
 background:radial-gradient(ellipse at 50% 40%,#17402f 0%,#0d281e 55%,#06150f 100%)}
#stage.grab{cursor:grabbing}
#felt{position:absolute;inset:0;opacity:.55;mix-blend-mode:soft-light;pointer-events:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .5  0 0 0 0 .6  0 0 0 0 .5  0 0 0 1.1 -.15'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.bg{position:absolute;inset:0;opacity:0;transition:opacity 1.2s ease;pointer-events:none;background-size:cover;background-position:center}
.bg.on{opacity:1}
.bg.cloth svg{display:block;width:100%;height:100%;opacity:.62;filter:blur(1.5px) saturate(.9)}
.bg.photo{background-size:cover;filter:sepia(.45) brightness(.78) contrast(1.05);opacity:0}.bg.photo.on{opacity:.62}
.bg.plate{background-size:auto 90%;background-repeat:no-repeat}.bg.plate.on{opacity:.5}
#threads{position:absolute;inset:0;pointer-events:none}
#world{position:absolute;left:0;top:0;transform-origin:0 0}
#lamp{position:absolute;inset:0;pointer-events:none;z-index:10;background:radial-gradient(circle 42vmax at var(--lx) var(--ly),rgba(255,222,160,.09) 0%,rgba(255,222,160,0) 60%),radial-gradient(circle 66vmax at var(--lx) var(--ly),rgba(0,0,0,0) 18%,rgba(1,7,4,.66) 100%)}
.node{position:absolute;left:0;top:0;width:0;height:0;cursor:pointer;will-change:transform}
.obj{position:absolute;left:0;top:0;filter:drop-shadow(0 7px 8px rgba(0,0,0,.5)) drop-shadow(0 1px 1px rgba(0,0,0,.6));transition:opacity .45s,filter .45s}
.body{position:relative;width:100%;height:100%;transition:transform .55s cubic-bezier(.2,.9,.25,1)}
.node.in .body{animation:lay .95s cubic-bezier(.2,.8,.2,1) calc(var(--i)*28ms) backwards}
@keyframes lay{from{opacity:0;transform:translateY(-34px) scale(1.25) rotate(-6deg)}}
.node:hover .body,.node.focus .body{transform:translateY(-8px) scale(1.16)}
.node:hover .obj,.node.focus .obj{filter:drop-shadow(0 22px 20px rgba(0,0,0,.6)) drop-shadow(0 1px 1px rgba(0,0,0,.6))}
.node:hover,.node.focus{z-index:6}.node.hit{z-index:4}.node.lit .body{transform:translateY(-3px) scale(1.04)}
.node.dim .obj{opacity:.32;filter:grayscale(.6) drop-shadow(0 4px 4px rgba(0,0,0,.4))}
.node.out{opacity:.05;pointer-events:none}
.node.hit .body{animation:breathe 2.2s ease-in-out infinite}
@keyframes breathe{50%{transform:translateY(-6px) scale(1.1)}}
.swatch{overflow:hidden}.swatch svg{display:block}
.stamp{position:absolute;right:9px;bottom:6px;font:italic 500 .86rem "EB Garamond",serif;color:rgba(255,248,230,.92);text-shadow:0 1px 2px rgba(0,0,0,.7);letter-spacing:.02em}
.print{background:#ece3cb;padding:6px 6px 6px;box-shadow:inset 0 0 0 1px rgba(70,50,20,.22)}
.print .img{width:100%;height:100%;background-position:center;background-repeat:no-repeat;background-color:#f3ecd8;box-shadow:inset 0 0 0 1px rgba(70,50,20,.18)}
.label{background:var(--tone);color:#ecdfb8;display:grid;place-items:center;text-align:center;padding:2px 10px;line-height:1.05;font-style:italic;box-shadow:inset 0 0 0 3px var(--tone),inset 0 0 0 4px rgba(201,163,91,.85)}
.ticket{background:#e8dec2;clip-path:polygon(0 14%,14% 0,100% 0,100% 100%,14% 100%,0 86%);color:#2a2118;padding:10px 8px 6px 24%;display:flex;flex-direction:column;justify-content:center}
.ticket .hole{position:absolute;left:11%;top:50%;width:9px;height:9px;margin-top:-4.5px;border-radius:50%;background:#0d281e;box-shadow:inset 0 1px 2px rgba(0,0,0,.8),0 0 0 1px rgba(110,80,30,.5)}
.ticket .tn{font-style:italic;font-size:.98rem;line-height:1.08;font-weight:500}.ticket small{font-size:.76rem;color:#6b5a3a;font-style:italic;margin-top:3px}
.lbl{position:absolute;left:50%;top:100%;transform:translate(-50%,10px);white-space:nowrap;font:italic 400 .92rem "EB Garamond",serif;color:var(--ink);text-shadow:0 1px 7px #000,0 0 3px #000;pointer-events:none}
.ghost .pin{position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f3dca0,#a47c34 60%,#5e4416);box-shadow:0 2px 3px rgba(0,0,0,.6);transition:transform .3s}
.ghost .tag{position:absolute;left:10px;top:-10px;white-space:nowrap;font:italic .85rem "EB Garamond",serif;color:var(--ink);background:rgba(236,227,203,.0);opacity:0;transition:opacity .3s;text-shadow:0 1px 6px #000}
.ghost:hover .pin,.ghost.focus .pin,.ghost.hit .pin{transform:scale(1.7)}.ghost:hover .tag,.ghost.focus .tag,.ghost.hit .tag,.ghost.lit .tag{opacity:1}
.ghost{opacity:.85}.ghost.dim{opacity:.18}
.ui{position:fixed;z-index:20}
#brand{left:26px;top:20px;pointer-events:none}#brand h1{margin:0;font:italic 400 1.75rem/1.1 "EB Garamond",serif;letter-spacing:.005em}#brand p{margin:.2rem 0 0;font-size:.98rem;color:var(--soft)}
#search{left:50%;top:22px;transform:translateX(-50%);width:min(440px,calc(100vw - 150px));text-align:center}
#search input{width:100%;background:none;border:0;border-bottom:1px solid rgba(201,163,91,.55);outline:0;padding:.3rem .2rem .45rem;font:italic 400 1.4rem "EB Garamond",serif;color:var(--ink);text-align:center;transition:border-color .3s}
#search input::-webkit-search-cancel-button{display:none}#search input:focus{border-bottom-color:var(--brass)}#search input::placeholder{color:#8e9d8e}
#count{display:block;min-height:1.3em;margin-top:.35rem;font-style:italic;font-size:.92rem;color:var(--brass)}
#kinds{left:26px;top:132px;display:flex;flex-direction:column;gap:.2rem;align-items:flex-start}
#kinds button{display:flex;align-items:center;gap:.65rem;background:none;border:0;padding:.18rem 0;font:italic 400 1.05rem "EB Garamond",serif;color:var(--soft);cursor:pointer;white-space:nowrap;transition:color .25s}
#kinds button:hover{color:var(--ink)}#kinds button.on{color:var(--ink);text-decoration:underline;text-decoration-color:var(--brass);text-underline-offset:4px}
.ic{display:inline-block;width:14px;height:11px;background:var(--c);box-shadow:0 1px 2px rgba(0,0,0,.6)}.ic.print{background:#ece3cb;box-shadow:inset 0 0 0 2px var(--c),0 1px 2px rgba(0,0,0,.6);width:11px;height:14px}.ic.label{height:8px;width:16px}.ic.ticket{clip-path:polygon(0 25%,25% 0,100% 0,100% 100%,25% 100%,0 75%)}
#caption{left:26px;bottom:104px;width:min(400px,calc(100vw - 52px));opacity:0;transform:translateY(8px);transition:opacity .5s,transform .5s;pointer-events:none;text-shadow:0 2px 14px #000,0 0 3px rgba(0,0,0,.7)}
#caption.on{opacity:1;transform:none}#caption h2{margin:0;font:italic 400 2.3rem/1.02 "EB Garamond",serif}#caption .meta{margin:.35rem 0 .5rem;font-style:italic;color:var(--brass);font-size:1rem}#caption p{margin:0 0 .3rem;font-size:1.08rem;line-height:1.42}
#tapewrap{left:50%;bottom:18px;transform:translateX(-50%);width:min(820px,calc(100vw - 20px));padding:0 24px}
#tlabel{display:block;text-align:center;font-style:italic;font-size:.98rem;color:var(--soft);margin-bottom:.45rem}
#tape{position:relative;height:34px;background:linear-gradient(#f1e3b6,#dcc98f 60%,#cdb87a);border-radius:2px;box-shadow:0 6px 14px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.55)}
#tape::before{content:"";position:absolute;left:-20px;top:0;bottom:0;width:20px;background:linear-gradient(90deg,#8a6a2c,#d9bd78 50%,#8a6a2c);border-radius:3px 0 0 3px}
#tticks i{position:absolute;bottom:0;width:1px;background:#3b2f1b;opacity:.8}#tticks em{position:absolute;top:3px;transform:translateX(-50%);font:italic 500 .78rem "EB Garamond",serif;color:#3b2f1b}
#tshade{position:absolute;top:0;bottom:0;background:rgba(110,31,43,.3);box-shadow:inset 0 0 0 1px rgba(110,31,43,.5);pointer-events:none}
.clip{position:absolute;top:-7px;width:16px;height:48px;margin-left:-8px;border:0;padding:0;cursor:ew-resize;border-radius:3px;background:linear-gradient(90deg,#8d6c2e,#e4c882 45%,#9a7835);box-shadow:0 4px 8px rgba(0,0,0,.55);touch-action:none;transition:transform .2s}
.clip::after{content:"";position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2.5px;border-radius:50%;background:#5c4416;box-shadow:0 1px 0 rgba(255,255,255,.35)}.clip.held,.clip:focus-visible{transform:translateY(-3px);outline:0}
#panel{right:26px;top:96px;width:min(330px,calc(100vw - 52px));max-height:calc(100vh - 200px);overflow:auto;background:var(--paper);color:#2a2118;padding:2.1rem 1.4rem 1.3rem;border-radius:2px;box-shadow:0 24px 50px rgba(0,0,0,.6);opacity:0;transform:translateY(-14px) rotate(2.4deg);transform-origin:50% -80px;pointer-events:none;transition:opacity .45s,transform .7s cubic-bezier(.2,.9,.25,1);
 background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .27  0 0 0 0 .15  0 0 0 .22 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
#panel.on{opacity:1;transform:rotate(.8deg);pointer-events:auto}
#panel::before{content:"";position:absolute;left:50%;top:12px;width:13px;height:13px;margin-left:-6.5px;border-radius:50%;background:#0d281e;box-shadow:inset 0 1px 3px rgba(0,0,0,.9),0 0 0 1px rgba(110,80,30,.5)}
#panel .x{position:absolute;right:.6rem;top:.3rem;background:none;border:0;font-size:1.5rem;color:#6b5a3a;cursor:pointer}
#panel h2{margin:0;font:italic 500 1.8rem/1.05 "EB Garamond",serif}#panel .meta{margin:.3rem 0 .7rem;font-style:italic;color:#7a5e2a}#panel p{margin:0 0 .5rem;line-height:1.5;font-size:1.04rem}
#panel h3{margin:1.1rem 0 .35rem;font:italic 400 .98rem "EB Garamond",serif;color:#6b5a3a}
.rel{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.15rem 1rem}.rel button{background:none;border:0;padding:0;font:italic 400 1.04rem "EB Garamond",serif;color:#2a2118;border-bottom:1px solid rgba(110,31,43,.45);cursor:pointer}.rel button:hover{color:var(--oxblood);border-bottom-color:var(--oxblood)}.rel button.g{color:#7d6d52;border-bottom-style:dotted}
.go{display:inline-block;margin-top:1.1rem;color:var(--oxblood);font-weight:500;text-decoration:none;border-bottom:1px solid currentColor}
@media(max-width:760px){#kinds{display:none}#brand h1{font-size:1.3rem}#brand p{display:none}#search{top:18px;width:calc(100vw - 190px);left:auto;right:16px;transform:none}#search input{font-size:1.15rem}#caption{bottom:112px}#caption h2{font-size:1.7rem}#panel{top:auto;bottom:100px;right:12px;left:12px;width:auto;max-height:44vh}}
@media(prefers-reduced-motion:reduce){.node.in .body{animation:none}.node.hit .body{animation:none}}
`;

const engine = fs.readFileSync(path.join(here, "engine2.js"), "utf8");
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Menswear Atlas, prototype: Baize</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<div id="stage"><div id="felt"></div><div class="bg" id="bgA"></div><div class="bg" id="bgB"></div><canvas id="threads"></canvas><div id="world"></div><div id="lamp"></div></div>
<div class="ui" id="brand"><h1>The Menswear Atlas</h1><p>How men's clothing connects, 1770 to today</p></div>
<div class="ui" id="search"><input id="q" type="search" placeholder="Search the atlas: ivy, collar, Naples" autocomplete="off" aria-label="Search the atlas"><span id="count" aria-live="polite"></span></div>
<div class="ui" id="kinds" role="group" aria-label="Show only"></div>
<div class="ui" id="caption"></div>
<aside class="ui" id="panel" aria-live="polite"></aside>
<div class="ui" id="tapewrap"><span id="tlabel">Every year, 1770 to today</span><div id="tape"><div id="tticks"></div><div id="tshade"></div><button class="clip" id="clipL" aria-label="From year"></button><button class="clip" id="clipR" aria-label="To year"></button></div></div>
<script type="application/json" id="data">${JSON.stringify({ ...payload, variant: {} }).replace(/</g, "\\u003c")}</script>
<script>${engine}</script></body></html>`;
fs.writeFileSync(path.join(here, "4-baize.html"), page);
console.log("4-baize.html", (page.length / 1024).toFixed(0) + " KB");
