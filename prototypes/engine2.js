(() => {
"use strict";
const D = JSON.parse(document.getElementById("data").textContent);
const $ = (s) => document.querySelector(s);
const world = $("#world"), cv = $("#threads"), ctx = cv.getContext("2d");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let W = 0, H = 0, DPR = Math.min(devicePixelRatio || 1, 2);
const view = { x: 0, y: 0, k: 1, tx: 0, ty: 0, tk: 1 };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---------- cloth ----------
const POOL = [
  ["twill", "#2a2f3a", "#3a4150"], ["herringbone", "#4a3b2a", "#6b573f"], ["pinstripe", "#2b3340", "#c9c4b4"], ["tweed", "#5c5a3e", "#8c6f3c", "#c8b684"],
  ["glen", "#3d403d", "#6d6f68", "#9c3f33"], ["oxford", "#d9dfe9", "#aeb9ce"], ["houndstooth", "#26272a", "#d9d3c2"], ["madras", "#27415f", "#a23c32", "#d8cfa0", "#2c5a46"],
];
const CLOTH = {
  "ivy-league-look": ["madras", "#27415f", "#a23c32", "#d8cfa0", "#2c5a46"], preppy: ["madras", "#2f5a46", "#c2495a", "#e3d6a2", "#2a3f66"],
  "neapolitan-tailoring": ["pinstripe", "#2a3a52", "#c9c6b8"], "english-country": ["tweed", "#58573a", "#8c6f3c", "#c8b684"], "savile-row": ["pinstripe", "#2a2b2f", "#9c9a94"],
  edwardian: ["herringbone", "#4a3b2a", "#6b573f"], victorian: ["twill", "#2c2829", "#413a3b"], regency: ["twill", "#1e3a2c", "#2f503e"], interwar: ["glen", "#46473f", "#76736a", "#a34a3a"],
  postwar: ["houndstooth", "#2a2a2c", "#e0d9c6"], ametora: ["glen", "#1f2f55", "#4a5f8f", "#e0d9c6"], "oxford-cloth": ["oxford", "#dfe4ee", "#b3bed2"],
};
const SEXTANT = { garment: "#d8cdb0", detail: "#8fb3a0", style: "#b9473e", era: "#c9a35b", maker: "#c97c4c", person: "#86a0c4", context: "#78aeb0", ghost: "#b8b29c" };

function clothSVG(spec, w, h, uid, sc = 1) {
  const [kind, a, b, c, d] = spec, r = rng(hash(uid));
  const pid = "p" + uid.replace(/[^a-z0-9]/gi, ""), gid = "g" + pid;
  let tile = 20, body = "";
  if (kind === "herringbone") { tile = 20; body = `<path d="M0 5L5 0 10 5 15 0 20 5M0 15L5 10 10 15 15 10 20 15" stroke="${b}" stroke-width="3.4" fill="none"/><path d="M0 8L5 3 10 8 15 3 20 8M0 18L5 13 10 18 15 13 20 18" stroke="${a}" stroke-width=".8" stroke-opacity=".7" fill="none"/>`; }
  else if (kind === "houndstooth") { tile = 16; body = `<path d="M0 0H8L4 4 8 8H0ZM8 8H16L12 12 16 16H8Z" fill="${b}"/>`; }
  else if (kind === "glen") { tile = 48; body = `<rect width="16" height="48" fill="${b}" opacity=".55"/><rect width="48" height="16" fill="${b}" opacity=".55"/><rect x="24" width="1.2" height="48" fill="${c || b}"/><rect y="24" width="48" height="1.2" fill="${c || b}"/>`; }
  else if (kind === "madras") { tile = 60; body = `<rect x="6" width="10" height="60" fill="${b}" opacity=".72"/><rect x="30" width="4" height="60" fill="${c}" opacity=".85"/><rect x="44" width="12" height="60" fill="${d}" opacity=".55"/><rect y="10" width="60" height="6" fill="${c}" opacity=".7"/><rect y="30" width="60" height="14" fill="${b}" opacity=".6"/><rect y="50" width="60" height="4" fill="${d}" opacity=".8"/>`; }
  else if (kind === "pinstripe") { tile = 14; body = `<rect x="3" width="1.1" height="14" fill="${b}"/><path d="M0 14L14 0" stroke="${b}" stroke-width=".4" stroke-opacity=".25"/>`; }
  else if (kind === "twill") { tile = 6; body = `<path d="M-1 7L7 -1M-1 1L1 -1M5 7L7 5" stroke="${b}" stroke-width="1.5" fill="none"/>`; }
  else if (kind === "oxford") { tile = 8; body = `<rect width="4" height="4" fill="${b}" opacity=".7"/><rect x="4" y="4" width="4" height="4" fill="${b}" opacity=".7"/><path d="M0 4H8M4 0V8" stroke="${a}" stroke-width=".5" stroke-opacity=".5"/>`; }
  else { tile = 64; const cols = [b, c || b, d || "#e8dfc6"]; let s = ""; for (let i = 0; i < 90; i++) s += `<circle cx="${(r() * 64).toFixed(1)}" cy="${(r() * 64).toFixed(1)}" r="${(0.6 + r() * 1.3).toFixed(2)}" fill="${cols[i % 3]}" opacity="${(0.55 + r() * 0.4).toFixed(2)}"/>`; body = s; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"><defs>
<pattern id="${pid}" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse" patternTransform="scale(${sc}) rotate(${kind === "twill" ? 0 : 0})"><rect width="${tile}" height="${tile}" fill="${a}"/>${body}</pattern>
<filter id="${gid}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${hash(uid) % 90}"/><feColorMatrix type="saturate" values="0"/></filter>
<linearGradient id="l${pid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#${pid})"/><rect width="${w}" height="${h}" filter="url(#${gid})" opacity=".30" style="mix-blend-mode:multiply"/><rect width="${w}" height="${h}" fill="url(#l${pid})"/></svg>`;
}
function pinked(w, h, t = 4.5) {
  const pts = []; const nx = Math.round(w / (t * 2)) * 2, ny = Math.round(h / (t * 2)) * 2;
  for (let i = 0; i <= nx; i++) pts.push([i * w / nx, i % 2 ? t : 0]);
  for (let i = 1; i <= ny; i++) pts.push([i % 2 ? w - t : w, i * h / ny]);
  for (let i = nx - 1; i >= 0; i--) pts.push([i * w / nx, i % 2 ? h - t : h]);
  for (let i = ny - 1; i >= 1; i--) pts.push([i % 2 ? t : 0, i * h / ny]);
  return "polygon(" + pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(",") + ")";
}

// ---------- model ----------
const byId = new Map(), nodes = [];
const mk = (o) => { const n = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, nbrs: new Set(), ph: hash(Math.random() + '') % 628 / 100, ph2: hash(Math.random() + 'b') % 628 / 100, state: "", rotK: 1 }, o); byId.set(n.id, n); nodes.push(n); return n; };
D.nodes.forEach((n) => mk(Object.assign(n, { ghost: false })));
D.wanted.forEach((w) => mk({ id: w.id, name: w.label, type: "ghost", ghost: true, summary: "", years: null }));
const edges = [], seen = new Set();
const addEdge = (a, b, kind) => { if (a === b || !byId.has(a) || !byId.has(b)) return; const k = a < b ? a + "|" + b : b + "|" + a; if (seen.has(k)) return; seen.add(k); edges.push({ a: byId.get(a), b: byId.get(b), kind, off: (hash(k) % 7 - 3) * 0.012 }); byId.get(a).nbrs.add(b); byId.get(b).nbrs.add(a); };
D.edges.forEach((e) => addEdge(e[0], e[1], e[2]));
D.mentions.forEach((e) => addEdge(e[0], e[1], "mention"));
nodes.forEach((n) => {
  n.deg = n.nbrs.size;
  if (n.ghost) { n.w = n.h = 10; n.r = 6; return; }
  const s = Math.min(128, 66 + Math.sqrt(n.deg) * 16);
  n.form = n.thumb ? "print" : n.type === "maker" ? "label" : (n.type === "person" || n.type === "context") ? "ticket" : "swatch";
  if (n.form === "print") { n.w = s * 0.86; n.h = s * 1.06; } else if (n.form === "label") { n.w = s * 1.2; n.h = s * 0.5; } else if (n.form === "ticket") { n.w = s * 0.78; n.h = s * 0.98; } else { n.w = s; n.h = s * 0.92; }
  n.r = Math.max(n.w, n.h) * 0.52;
  n.rot0 = (hash(n.id) % 100 / 100 - 0.5) * (n.form === "label" ? 6 : 12);
});
nodes.forEach((n, i) => { const a = i * 2.39996, r = 9 * Math.sqrt(i + 1); n.x = Math.cos(a) * r * 1.4; n.y = Math.sin(a) * r; });

// ---------- dom ----------
nodes.forEach((n, i) => {
  const el = document.createElement("div");
  el.className = "node " + (n.ghost ? "ghost" : "real f-" + n.form) + " t-" + n.type; el.dataset.id = n.id; el.style.setProperty("--i", i);
  el.style.setProperty("--thread", SEXTANT[n.type]);
  if (n.ghost) { el.innerHTML = '<i class="pin"></i><span class="tag"></span>'; el.querySelector(".tag").textContent = n.name; }
  else {
    const o = document.createElement("div"); o.className = "obj"; o.style.width = n.w + "px"; o.style.height = n.h + "px"; o.style.marginLeft = -n.w / 2 + "px"; o.style.marginTop = -n.h / 2 + "px";
    let inner = "";
    if (n.form === "swatch") {
      const spec = CLOTH[n.id] || POOL[hash(n.id) % POOL.length]; n.spec = spec;
      inner = `<div class="body swatch" style="clip-path:${pinked(n.w, n.h)}">${clothSVG(spec, Math.round(n.w), Math.round(n.h), n.id)}${n.when ? `<b class="stamp">${n.type === "era" ? n.when : ""}</b>` : ""}</div>`;
    } else if (n.form === "print") {
      inner = `<div class="body print"><div class="img" style="background-image:url(${n.thumb});background-size:${n.fit}${n.fit === "cover" ? ";filter:sepia(.35) contrast(1.05)" : ""}"></div></div>`;
    } else if (n.form === "label") {
      const tone = ["#1d2b3f", "#4a1d27", "#16352a"][hash(n.id) % 3];
      inner = `<div class="body label" style="--tone:${tone}"><span style="font-size:${Math.max(12, Math.min(18, n.w / 7.5))}px">${esc(n.name)}</span></div>`;
    } else {
      inner = `<div class="body ticket"><i class="hole"></i><span class="tn">${esc(n.name)}</span><small>${esc(n.when || "")}</small></div>`;
    }
    o.innerHTML = inner + '<span class="lbl"></span>';
    o.querySelector(".lbl").textContent = n.form === "label" ? "" : n.name;
    el.appendChild(o); n.obj = o;
  }
  world.appendChild(el); n.el = el;
});

// ---------- sim ----------
let alpha = 1, T = 0, drag = null;
function step(dt) {
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const rx = a.x - b.x, ry = a.y - b.y;
      let dx = rx, dy = ry * 1.7, d2 = dx * dx + dy * dy + 0.5;
      if (d2 > 190000) continue;
      const d = Math.sqrt(d2);
      let f = 7200 / d2 * (a.ghost || b.ghost ? 0.4 : 1);
      dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      // objects must not lie on top of each other: separate by their real boxes
      const ox = (a.w + b.w) / 2 + (a.ghost || b.ghost ? 6 : 16) - Math.abs(rx), oy = (a.h + b.h) / 2 + (a.ghost || b.ghost ? 6 : 22) - Math.abs(ry);
      if (ox > 0 && oy > 0) { if (ox < oy) { const sx = Math.sign(rx) || 1, k = ox * 0.06; a.vx += sx * k; b.vx -= sx * k; } else { const sy = Math.sign(ry) || 1, k = oy * 0.06; a.vy += sy * k; b.vy -= sy * k; } }
    }
  }
  for (const e of edges) {
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.hypot(dx, dy) + 0.01;
    const L = (e.kind === "mention" ? 120 : 92) + e.a.r + e.b.r, f = (d - L) * (e.kind === "mention" ? 0.0016 : 0.0034);
    const fx = dx / d * f, fy = dy / d * f; e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy;
  }
  for (const n of nodes) {
    const g = n.ghost ? 1.4 : 1; n.vx -= n.x * 0.00045 * g; n.vy -= n.y * 0.0042 * g;
    n.vx += Math.cos(T * 0.00035 * (0.6 + n.ph % 1) + n.ph) * 0.011; n.vy += Math.sin(T * 0.0003 * (0.6 + n.ph2 % 1) + n.ph2) * 0.011;
    if (n === drag) { n.vx = n.vy = 0; continue; }
    n.vx *= 0.9; n.vy *= 0.9; n.x += n.vx * (alpha * 0.8 + 0.2) * dt; n.y += n.vy * (alpha * 0.8 + 0.2) * dt;
  }
  alpha *= 0.9985;
}

// ---------- view ----------
function fitView(first) {
  const real = nodes.filter((n) => !n.ghost); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const n of real) { x0 = Math.min(x0, n.x - n.r - 40); x1 = Math.max(x1, n.x + n.r + 40); y0 = Math.min(y0, n.y - n.r - 20); y1 = Math.max(y1, n.y + n.r + 44); }
  const aw = W - (W > 900 ? 400 : 20), ah = H - 215;
  view.tk = Math.max(0.3, Math.min(1.2, Math.min(aw / (x1 - x0), ah / (y1 - y0))));
  view.tx = W / 2 + (W > 900 ? 100 : 0) - (x0 + x1) / 2 * view.tk; view.ty = 92 + ah / 2 - (y0 + y1) / 2 * view.tk;
  if (first) { view.k = view.tk; view.x = view.tx; view.y = view.ty; } view.fit = true;
}
function resize() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + "px"; cv.style.height = H + "px"; if (!view.fit) fitView(true); }
addEventListener("resize", () => { view.fit = false; resize(); });
const stage = $("#stage"); let panning = null;
stage.addEventListener("pointerdown", (e) => {
  const nd = e.target.closest(".node");
  if (nd) { drag = byId.get(nd.dataset.id); drag.moved = false; drag.px = e.clientX; drag.py = e.clientY; stage.setPointerCapture(e.pointerId); return; }
  if (e.target.closest(".ui")) return;
  panning = { x: e.clientX, y: e.clientY, vx: view.tx, vy: view.ty }; stage.setPointerCapture(e.pointerId); stage.classList.add("grab");
});
const lamp = { x: 0.55, y: 0.45, tx: 0.55, ty: 0.45 };
stage.addEventListener("pointermove", (e) => {
  lamp.tx = e.clientX / W; lamp.ty = e.clientY / H;
  if (drag) { if (Math.hypot(e.clientX - drag.px, e.clientY - drag.py) > 4) drag.moved = true; if (drag.moved) { drag.x = (e.clientX - view.x) / view.k; drag.y = (e.clientY - view.y) / view.k; alpha = Math.max(alpha, 0.25); } return; }
  if (panning) { view.tx = panning.vx + e.clientX - panning.x; view.ty = panning.vy + e.clientY - panning.y; }
});
stage.addEventListener("pointerup", () => { if (drag) { if (!drag.moved) select(drag.id); drag = null; } panning = null; stage.classList.remove("grab"); });
stage.addEventListener("wheel", (e) => { e.preventDefault(); const f = Math.exp(-e.deltaY * 0.0015), nk = Math.max(0.3, Math.min(3, view.tk * f)); const wx = (e.clientX - view.tx) / view.tk, wy = (e.clientY - view.ty) / view.tk; view.tk = nk; view.tx = e.clientX - wx * nk; view.ty = e.clientY - wy * nk; }, { passive: false });
stage.addEventListener("dblclick", (e) => { if (!e.target.closest(".node") && !e.target.closest(".ui")) fitView(); });

// ---------- focus ----------
const bgA = $("#bgA"), bgB = $("#bgB"); let flip = false, bgNow = "";
function bgFor(n) {
  if (n.ghost) return null;
  if (n.form === "swatch") return { html: clothSVG(n.spec, 1280, 800, n.id + "bg", 1.7), cls: "cloth" };
  if (n.bg) return { img: n.bg, cls: n.form === "print" && n.fit === "contain" ? "plate" : "photo" };
  return { html: clothSVG(POOL[hash(n.id) % POOL.length], 1280, 800, n.id + "bg", 1.7), cls: "cloth" };
}
function setBg(n) {
  const key = n ? n.id : ""; if (key === bgNow) return; bgNow = key;
  const next = flip ? bgA : bgB, prev = flip ? bgB : bgA; flip = !flip;
  const b = n && bgFor(n);
  next.className = "bg " + (b ? b.cls : ""); next.innerHTML = ""; next.style.backgroundImage = "none";
  if (b) { if (b.img) next.style.backgroundImage = `url(${b.img})`; else next.innerHTML = b.html; next.classList.add("on"); }
  prev.classList.remove("on");
}
const S = { hover: null, sel: null, q: "", matches: null, kinds: new Set(), y0: 1770, y1: 2030 };
const inYears = (n) => !n.years || (n.years[0] <= S.y1 && (n.years[1] ?? 2030) >= S.y0);
const passKinds = (n) => !S.kinds.size || S.kinds.has(n.type);
const focusId = () => S.hover || S.sel;
const TY = D.types;
function paint() {
  const f = focusId() ? byId.get(focusId()) : null, m = S.matches;
  for (const n of nodes) {
    let st = ""; const ok = inYears(n) && passKinds(n);
    if (!ok) st = "out"; else if (f) st = n === f ? "focus" : f.nbrs.has(n.id) ? "lit" : "dim"; else if (m) st = m.hit.has(n.id) ? "hit" : m.near.has(n.id) ? "lit" : "dim";
    if (f && m && m.hit.has(n.id) && st === "dim") st = "lit";
    if (st !== n.state) { n.el.classList.remove("out", "focus", "lit", "dim", "hit"); if (st) n.el.classList.add(st); n.state = st; }
  }
  const t = f || (m && m.first ? byId.get(m.first) : null);
  setBg(t);
  const cap = $("#caption");
  if (t) {
    const kind = t.ghost ? "Not written yet" : (TY[t.type]?.one ?? t.type);
    const meta = [kind, t.when, (t.regions || []).join(", ")].filter(Boolean).join(", ");
    cap.innerHTML = `<h2>${esc(t.name)}</h2><p class="meta">${esc(meta)}</p>${t.ghost ? `<p>Linked from ${t.deg} ${t.deg === 1 ? "entry" : "entries"}.</p>` : `<p>${esc(t.summary)}</p>`}`; cap.classList.add("on");
  } else cap.classList.remove("on");
}
world.addEventListener("pointerover", (e) => { const nd = e.target.closest(".node"); const id = nd ? nd.dataset.id : null; if (id !== S.hover && !drag) { S.hover = id; paint(); } });
world.addEventListener("pointerleave", () => { S.hover = null; paint(); });
stage.addEventListener("pointerover", (e) => { if (!e.target.closest(".node") && S.hover) { S.hover = null; paint(); } });

// search
const q = $("#q"), count = $("#count");
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function search(text) {
  S.q = text; const t = norm(text).trim();
  if (!t) { S.matches = null; count.textContent = ""; paint(); return; }
  const words = t.split(/\s+/), hit = new Set(); let first = null, best = -1;
  for (const n of nodes) {
    const hay = norm([n.name, n.id.replace(/-/g, " "), (n.aka || []).join(" "), TY[n.type]?.one || "", (n.regions || []).join(" "), n.summary].join(" "));
    const head = norm(n.name + " " + (n.aka || []).join(" "));
    if (words.every((w) => hay.includes(w))) { hit.add(n.id); const sc = (head.includes(t) ? 3 : 0) + (n.ghost ? 0 : 1) + n.deg * 0.05; if (sc > best) { best = sc; first = n.id; } }
  }
  const near = new Set(); hit.forEach((id) => byId.get(id).nbrs.forEach((x) => { if (!hit.has(x)) near.add(x); }));
  S.matches = { hit, near, first };
  count.textContent = hit.size ? `${hit.size} ${hit.size === 1 ? "piece" : "pieces"} found` : "Nothing by that name yet";
  if (hit.size) { let sx = 0, sy = 0; hit.forEach((id) => { const n = byId.get(id); sx += n.x; sy += n.y; }); sx /= hit.size; sy /= hit.size; view.tx = W / 2 + (W > 900 ? 60 : 0) - sx * view.tk; view.ty = H / 2 - 40 - sy * view.tk; lamp.tx = 0.55; lamp.ty = 0.5; }
  paint();
}
q.addEventListener("input", () => search(q.value));
q.addEventListener("keydown", (e) => { if (e.key === "Enter" && S.matches?.first) select(S.matches.first); if (e.key === "Escape") { q.value = ""; search(""); q.blur(); } });
addEventListener("keydown", (e) => { if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); } if (e.key === "Escape" && document.activeElement !== q) select(null); });

// kinds
const kinds = $("#kinds");
const ICON = { garment: "print", detail: "swatch", style: "swatch", era: "swatch", maker: "label", person: "ticket", context: "ticket" };
Object.entries(TY).forEach(([k, v]) => { const b = document.createElement("button"); b.innerHTML = `<i class="ic ${ICON[k]}" style="--c:${SEXTANT[k]}"></i>${esc(v.many)}`; b.onclick = () => { S.kinds.has(k) ? S.kinds.delete(k) : S.kinds.add(k); b.classList.toggle("on", S.kinds.has(k)); paint(); }; kinds.appendChild(b); });

// tape
const tape = $("#tape"), clipL = $("#clipL"), clipR = $("#clipR"), shade = $("#tshade"), tlabel = $("#tlabel");
const Y0 = 1770, Y1 = 2030; let cl = Y0, cr = Y1;
(function ticks() { let s = ""; for (let y = Y0; y <= Y1; y += 10) { const p = (y - Y0) / (Y1 - Y0) * 100; const big = y % 50 === 0; s += `<i style="left:${p}%;height:${big ? 15 : 8}px"></i>${big ? `<em style="left:${p}%">${y}</em>` : ""}`; } $("#tticks").innerHTML = s; })();
function tapeUpdate() {
  const a = Math.min(cl, cr), b = Math.max(cl, cr); S.y0 = Math.round(a); S.y1 = Math.round(b);
  const pa = (a - Y0) / (Y1 - Y0) * 100, pb = (b - Y0) / (Y1 - Y0) * 100;
  clipL.style.left = pa + "%"; clipR.style.left = pb + "%"; shade.style.left = pa + "%"; shade.style.width = (pb - pa) + "%";
  tlabel.textContent = S.y0 === Y0 && S.y1 === Y1 ? "Every year, 1770 to today" : `${S.y0} to ${S.y1 >= 2030 ? "today" : S.y1}`;
  paint();
}
function tapeDrag(el, which) {
  el.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); el.classList.add("held"); });
  el.addEventListener("pointermove", (e) => { if (!el.hasPointerCapture(e.pointerId)) return; const r = tape.getBoundingClientRect(); const y = Y0 + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (Y1 - Y0); if (which === "l") cl = y; else cr = y; tapeUpdate(); });
  el.addEventListener("pointerup", () => el.classList.remove("held"));
  el.addEventListener("keydown", (e) => { const d = e.key === "ArrowLeft" ? -5 : e.key === "ArrowRight" ? 5 : 0; if (!d) return; e.preventDefault(); if (which === "l") cl = Math.max(Y0, Math.min(Y1, cl + d)); else cr = Math.max(Y0, Math.min(Y1, cr + d)); tapeUpdate(); });
}
tapeDrag(clipL, "l"); tapeDrag(clipR, "r");

// panel
const panel = $("#panel");
function select(id) {
  S.sel = id;
  if (!id) { panel.classList.remove("on"); paint(); return; }
  const n = byId.get(id), rel = [...n.nbrs].map((x) => byId.get(x)).sort((a, b) => (a.ghost - b.ghost) || b.deg - a.deg);
  const meta = n.ghost ? "Not written yet" : [TY[n.type]?.one ?? n.type, n.when, (n.regions || []).join(", ")].filter(Boolean).join(", ");
  panel.innerHTML = `<button class="x" aria-label="Close">×</button><h2>${esc(n.name)}</h2><p class="meta">${esc(meta)}</p>${n.ghost ? `<p>Linked from ${n.deg} ${n.deg === 1 ? "entry" : "entries"}. The next run may write it.</p>` : `<p>${esc(n.summary)}</p>`}` +
    (rel.length ? `<h3>Joined by thread to</h3><ul class="rel">${rel.map((r) => `<li><button data-id="${r.id}" class="${r.ghost ? "g" : ""}">${esc(r.name)}</button></li>`).join("")}</ul>` : "") +
    (n.ghost ? "" : `<a class="go" href="https://rosengaard98.github.io/menswear-atlas/#${n.id}" target="_blank" rel="noopener">Read the full entry</a>`);
  panel.classList.add("on");
  panel.querySelector(".x").onclick = () => select(null);
  panel.querySelectorAll(".rel button").forEach((b) => { b.onclick = () => select(b.dataset.id); b.onpointerenter = () => { S.hover = b.dataset.id; paint(); }; b.onpointerleave = () => { S.hover = null; paint(); }; });
  view.tx = W / 2 - 180 - n.x * view.tk; view.ty = H / 2 - 40 - n.y * view.tk; paint();
}

// ---------- draw ----------
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H); ctx.translate(view.x, view.y); ctx.scale(view.k, view.k);
  const fid = focusId(), m = S.matches; ctx.lineCap = "round";
  for (const e of edges) {
    const a = e.a, b = e.b, vis = inYears(a) && inYears(b) && passKinds(a) && passKinds(b), stitch = e.kind === "mention";
    let al = stitch ? 0.3 : 0.62, w = stitch ? 1 : 1.5, lit = false;
    if (fid) { lit = a.id === fid || b.id === fid; al = lit ? 1 : 0.05; w = lit ? 2.2 : 1; }
    else if (m) { lit = m.hit.has(a.id) && m.hit.has(b.id); const half = m.hit.has(a.id) || m.hit.has(b.id); al = lit ? 1 : half ? 0.4 : 0.05; w = lit ? 2.1 : 1; }
    if (!vis) al = 0.03;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + len * (0.15 + e.off);
    const col = e.kind === "mention" ? "#e6dcc0" : SEXTANT[(fid && b.id === fid ? b : a).type] || "#d8cdb0";
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y);
    if (stitch || lit) ctx.setLineDash(stitch ? [5, 5] : [14, 5]); else ctx.setLineDash([]);
    if (lit && !reduce) ctx.lineDashOffset = -T * 0.02;
    ctx.save(); ctx.translate(0, 2.2); ctx.lineWidth = w; ctx.strokeStyle = `rgba(0,0,0,${al * 0.38})`; ctx.stroke(); ctx.restore();
    ctx.lineWidth = w; ctx.strokeStyle = rgba(col.length === 7 ? col : "#d8cdb0", al); ctx.stroke();
    if (!stitch && al > 0.3) { ctx.save(); ctx.translate(-0.5, -0.6); ctx.lineWidth = Math.max(0.5, w * 0.35); ctx.strokeStyle = `rgba(255,250,235,${al * 0.28})`; ctx.stroke(); ctx.restore(); }
    ctx.setLineDash([]);
  }
}
function place() {
  for (const n of nodes) {
    n.el.style.transform = `translate(${n.x.toFixed(1)}px,${n.y.toFixed(1)}px)`;
    if (n.obj) { const tgt = (n.state === "focus" || n.el.matches(":hover")) ? 0 : 1; n.rotK += (tgt - n.rotK) * 0.15; const sway = reduce ? 0 : Math.sin(T * 0.0006 + n.ph) * 1.3; n.obj.style.transform = `rotate(${((n.rot0 + sway) * n.rotK).toFixed(2)}deg)`; }
  }
  world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
  const lx = lamp.x * 100, ly = lamp.y * 100; stage.style.setProperty("--lx", lx.toFixed(1) + "%"); stage.style.setProperty("--ly", ly.toFixed(1) + "%");
}
let last = performance.now();
function frame(t) {
  const dt = Math.min(2, (t - last) / 16.7); last = t; T = t;
  const e = reduce ? 1 : 0.085; view.x += (view.tx - view.x) * e; view.y += (view.ty - view.y) * e; view.k += (view.tk - view.k) * e;
  lamp.x += (lamp.tx - lamp.x) * 0.06; lamp.y += (lamp.ty - lamp.y) * 0.06;
  step(dt); draw(); place(); requestAnimationFrame(frame);
}
resize(); tapeUpdate();
for (let i = 0; i < 420; i++) step(1);
fitView(true); alpha = 0.5;
requestAnimationFrame(() => requestAnimationFrame(() => nodes.forEach((n) => n.el.classList.add("in"))));
requestAnimationFrame(frame);
window.__atlas = { S, search, select, nodes };
})();
