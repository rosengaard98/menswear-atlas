(() => {
"use strict";
const D = JSON.parse(document.getElementById("data").textContent);
const V = D.variant;
const $ = (s) => document.querySelector(s);
const world = $("#world"), cv = $("#edges"), ctx = cv.getContext("2d");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let W = 0, H = 0, DPR = Math.min(devicePixelRatio || 1, 2);
const view = { x: 0, y: 0, k: 1, tx: 0, ty: 0, tk: 1 };

// ---------- model ----------
const byId = new Map();
const nodes = [];
const mk = (o) => { const n = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, nbrs: new Set(), ph: Math.random() * 6.28, ph2: Math.random() * 6.28, state: "" }, o); byId.set(n.id, n); nodes.push(n); return n; };
D.nodes.forEach((n) => mk(Object.assign(n, { ghost: false })));
D.wanted.forEach((w) => mk({ id: w.id, name: w.label, type: "ghost", ghost: true, summary: "Queued: not written yet.", years: null }));
const edges = [];
const seen = new Set();
const addEdge = (a, b, kind) => { if (a === b || !byId.has(a) || !byId.has(b)) return; const k = a < b ? a + "|" + b : b + "|" + a; if (seen.has(k)) return; seen.add(k); edges.push({ a: byId.get(a), b: byId.get(b), kind, bow: ((a.length * 7 + b.length * 3) % 5 - 2) * 0.09 }); byId.get(a).nbrs.add(b); byId.get(b).nbrs.add(a); };
D.edges.forEach((e) => addEdge(e[0], e[1], e[2]));
D.mentions.forEach((e) => addEdge(e[0], e[1], "mention"));
nodes.forEach((n) => { n.deg = n.nbrs.size; n.r = n.ghost ? 5 : Math.min(V.maxR, V.baseR + Math.sqrt(n.deg) * V.degR) / 1; });

// initial positions: golden-angle spiral, so the web opens as a bloom
nodes.forEach((n, i) => { const a = i * 2.39996, r = 8 * Math.sqrt(i + 1); n.x = Math.cos(a) * r; n.y = Math.sin(a) * r; });

// ---------- dom ----------
const hue = V.colors;
nodes.forEach((n) => {
  const el = document.createElement("div");
  el.className = "node " + (n.ghost ? "ghost" : "real") + " t-" + n.type;
  el.dataset.id = n.id;
  el.style.setProperty("--c", hue[n.type] || hue.ghost);
  el.style.setProperty("--d", n.r * 2 + "px");
  if (n.ghost) el.innerHTML = '<i></i><span class="lbl"></span>';
  else {
    const mono = n.name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("");
    el.innerHTML = '<div class="face"><div class="pic' + (n.thumb ? " has" : "") + '"' + (n.thumb ? ` style="background-image:url(${n.thumb});background-size:${n.fit}"` : "") + '>' + (n.thumb ? "" : `<b>${mono}</b>`) + '</div></div><span class="lbl"></span>';
  }
  el.querySelector(".lbl").textContent = n.name;
  world.appendChild(el);
  n.el = el;
});

// ---------- sim ----------
const rings = V.rings ? { garment: 0.52, detail: 0.9, style: 0.2, era: 0.74, maker: 0.38, person: 0.62, context: 0.62, ghost: 1.12 } : null;
let alpha = 1, T = 0;
let drag = null;
function step(dt) {
  const R0 = Math.min(W, H) * 0.42;
  const rep = V.repulse, rest = V.spring;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.5;
      if (d2 > 160000) continue;
      const d = Math.sqrt(d2), minD = a.r + b.r + (a.ghost || b.ghost ? 18 : 34);
      let f = rep / d2 * (a.ghost || b.ghost ? 0.45 : 1);
      if (d < minD) f += (minD - d) * 0.06;
      dx /= d; dy /= d;
      a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
  }
  for (const e of edges) {
    const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, d = Math.hypot(dx, dy) + 0.01;
    const L = rest * (e.kind === "mention" ? 1.25 : 0.9) + e.a.r + e.b.r;
    const f = (d - L) * (e.kind === "mention" ? 0.0016 : 0.0035) * (rings ? 0.3 : 1);
    const fx = dx / d * f, fy = dy / d * f;
    e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy;
  }
  for (const n of nodes) {
    if (rings) { const ex = 1.55, px = n.x / ex, d = Math.hypot(px, n.y) + 0.01, tr = (rings[n.type] ?? 1) * R0 * 1.15; const f = (tr - d) * 0.011; n.vx += px / d * f * ex; n.vy += n.y / d * f; }
    else { const g = n.ghost ? 1.4 : 1; n.vx -= n.x * V.gravity * 0.55 * g; n.vy -= n.y * V.gravity * 2.1 * g; }
    // slow drift, so the web is never still
    n.vx += Math.cos(T * 0.00035 * (0.6 + n.ph % 1) + n.ph) * V.drift; n.vy += Math.sin(T * 0.0003 * (0.6 + n.ph2 % 1) + n.ph2) * V.drift;
    if (n === drag) { n.vx = n.vy = 0; continue; }
    n.vx *= 0.9; n.vy *= 0.9;
    n.x += n.vx * (alpha * 0.8 + 0.2) * dt; n.y += n.vy * (alpha * 0.8 + 0.2) * dt;
  }
  alpha = Math.max(0.0, alpha * 0.9985);
}

// ---------- view ----------
function resize() { W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + "px"; cv.style.height = H + "px"; if (!view.fit) fitView(true); }
function fitView(first) {
  const real = nodes.filter((n) => !n.ghost); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const n of real) { x0 = Math.min(x0, n.x - n.r - 40); x1 = Math.max(x1, n.x + n.r + 40); y0 = Math.min(y0, n.y - n.r - 20); y1 = Math.max(y1, n.y + n.r + 40); }
  const availW = W - (W > 900 ? 120 : 30), availH = H - 230;
  view.tk = Math.max(0.35, Math.min(1.25, Math.min(availW / (x1 - x0), availH / (y1 - y0))));
  view.tx = W / 2 - (x0 + x1) / 2 * view.tk; view.ty = 78 + 56 + (availH) / 2 - (y0 + y1) / 2 * view.tk; if (first) { view.k = view.tk * 0.6; view.x = view.tx; view.y = view.ty; } view.fit = true; }
addEventListener("resize", () => { view.fit = false; resize(); });
let panning = null;
const stage = $("#stage");
stage.addEventListener("pointerdown", (e) => {
  const nd = e.target.closest(".node");
  if (nd) { drag = byId.get(nd.dataset.id); drag.moved = false; drag.px = e.clientX; drag.py = e.clientY; stage.setPointerCapture(e.pointerId); return; }
  if (e.target.closest(".ui")) return;
  panning = { x: e.clientX, y: e.clientY, vx: view.tx, vy: view.ty }; stage.setPointerCapture(e.pointerId); stage.classList.add("grab");
});
stage.addEventListener("pointermove", (e) => {
  if (drag) { if (Math.hypot(e.clientX - drag.px, e.clientY - drag.py) > 4) drag.moved = true; if (drag.moved) { drag.x = (e.clientX - view.x) / view.k; drag.y = (e.clientY - view.y) / view.k; alpha = Math.max(alpha, 0.25); } return; }
  if (panning) { view.tx = panning.vx + e.clientX - panning.x; view.ty = panning.vy + e.clientY - panning.y; }
});
stage.addEventListener("pointerup", (e) => {
  if (drag) { if (!drag.moved) select(drag.id); drag = null; }
  panning = null; stage.classList.remove("grab");
});
stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  const f = Math.exp(-e.deltaY * 0.0015), nk = Math.max(0.35, Math.min(3, view.tk * f));
  const wx = (e.clientX - view.tx) / view.tk, wy = (e.clientY - view.ty) / view.tk;
  view.tk = nk; view.tx = e.clientX - wx * nk; view.ty = e.clientY - wy * nk;
}, { passive: false });
stage.addEventListener("dblclick", (e) => { if (!e.target.closest(".node")) { fitView(); } });

// ---------- focus: hover / select / search / filters ----------
const bgA = $("#bgA"), bgB = $("#bgB"); let bgFlip = false, bgNow = "";
function setBg(img, tint) {
  const key = (img || "") + "|" + tint; if (key === bgNow) return; bgNow = key;
  const next = bgFlip ? bgA : bgB, prev = bgFlip ? bgB : bgA; bgFlip = !bgFlip;
  next.style.backgroundImage = img ? `url(${img})` : "none";
  next.style.setProperty("--tint", tint || "transparent");
  next.classList.add("on"); prev.classList.remove("on");
}
const S = { hover: null, sel: null, q: "", matches: null, kinds: new Set(), y0: 1770, y1: 2030 };
function inYears(n) { if (!n.years) return true; const [a, b] = n.years; return a <= S.y1 && (b ?? 2030) >= S.y0; }
function passKinds(n) { return !S.kinds.size || S.kinds.has(n.type); }
const focusId = () => S.hover || S.sel;
function paint() {
  const f = focusId() ? byId.get(focusId()) : null;
  const m = S.matches;
  for (const n of nodes) {
    let st = "";
    const ok = inYears(n) && passKinds(n);
    if (!ok) st = "out";
    else if (f) st = n === f ? "focus" : f.nbrs.has(n.id) ? "lit" : "dim";
    else if (m) st = m.hit.has(n.id) ? "hit" : m.near.has(n.id) ? "lit" : "dim";
    if (f && m && m.hit.has(n.id) && st === "dim") st = "lit";
    if (st !== n.state) { n.el.classList.remove("out", "focus", "lit", "dim", "hit"); if (st) n.el.classList.add(st); n.state = st; }
  }
  // backdrop
  const t = f || (m && m.first ? byId.get(m.first) : null);
  if (t) setBg(t.bg || null, hue[t.type] || hue.ghost); else setBg(null, "transparent");
  $("#bgWord").textContent = t && !t.bg ? t.name : "";
  $("#bgWord").classList.toggle("on", !!(t && !t.bg));
  const card = $("#card");
  if (t && !t.ghost) { card.classList.add("on"); card.innerHTML = `<small>${D.types[t.type]?.one ?? t.type}${t.when ? " · " + t.when : ""}${t.regions && t.regions.length ? " · " + t.regions.join(", ") : ""}</small><h2>${esc(t.name)}</h2><p>${esc(t.summary)}</p>`; }
  else if (t) { card.classList.add("on"); card.innerHTML = `<small>Queued</small><h2>${esc(t.name)}</h2><p>Linked from ${t.deg} ${t.deg === 1 ? "entry" : "entries"}; not written yet.</p>`; }
  else card.classList.remove("on");
}
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
world.addEventListener("pointerover", (e) => { const nd = e.target.closest(".node"); const id = nd ? nd.dataset.id : null; if (id !== S.hover && !drag) { S.hover = id; paint(); } });
world.addEventListener("pointerleave", () => { S.hover = null; paint(); });
stage.addEventListener("pointerover", (e) => { if (!e.target.closest(".node") && S.hover) { S.hover = null; paint(); } });

// search
const q = $("#q"), count = $("#count");
function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function search(text) {
  S.q = text; const t = norm(text).trim();
  if (!t) { S.matches = null; count.textContent = ""; paint(); return; }
  const words = t.split(/\s+/); const hit = new Set(); let first = null, best = -1;
  for (const n of nodes) {
    const hay = norm([n.name, n.id.replace(/-/g, " "), (n.aka || []).join(" "), n.type, (n.regions || []).join(" "), n.summary].join(" "));
    const head = norm(n.name + " " + (n.aka || []).join(" "));
    if (words.every((w) => hay.includes(w))) { hit.add(n.id); const sc = (head.includes(t) ? 3 : 0) + (n.ghost ? 0 : 1) + n.deg * 0.05; if (sc > best) { best = sc; first = n.id; } }
  }
  const near = new Set(); hit.forEach((id) => byId.get(id).nbrs.forEach((x) => { if (!hit.has(x)) near.add(x); }));
  S.matches = { hit, near, first };
  count.textContent = hit.size ? `${hit.size} ${hit.size === 1 ? "match" : "matches"}` : "nothing found";
  if (hit.size) { // ease the view to the matches
    let sx = 0, sy = 0; hit.forEach((id) => { const n = byId.get(id); sx += n.x; sy += n.y; }); sx /= hit.size; sy /= hit.size;
    view.tx = W / 2 - sx * view.tk; view.ty = H / 2 - sy * view.tk;
  }
  paint();
}
q.addEventListener("input", () => search(q.value));
q.addEventListener("keydown", (e) => { if (e.key === "Enter" && S.matches?.first) select(S.matches.first); if (e.key === "Escape") { q.value = ""; search(""); q.blur(); } });
addEventListener("keydown", (e) => { if (e.key === "/" && document.activeElement !== q) { e.preventDefault(); q.focus(); } if (e.key === "Escape") { select(null); } });

// kinds + years
const chips = $("#chips");
Object.entries(D.types).forEach(([k, v]) => { const b = document.createElement("button"); b.textContent = v.many; b.style.setProperty("--c", hue[k]); b.onclick = () => { S.kinds.has(k) ? S.kinds.delete(k) : S.kinds.add(k); b.classList.toggle("on", S.kinds.has(k)); paint(); }; chips.appendChild(b); });
const y0 = $("#y0"), y1 = $("#y1"), yl = $("#ylabel");
function yr() { let a = +y0.value, b = +y1.value; if (a > b) [a, b] = [b, a]; S.y0 = a; S.y1 = b; yl.textContent = a === 1770 && b === 2030 ? "All years" : `${a} – ${b}`; const sp = $("#yspan"); sp.style.left = ((a - 1770) / 260 * 100) + "%"; sp.style.right = (100 - (b - 1770) / 260 * 100) + "%"; paint(); }
y0.oninput = y1.oninput = yr;

// selection panel
const panel = $("#panel");
function select(id) {
  S.sel = id;
  if (!id) { panel.classList.remove("on"); paint(); return; }
  const n = byId.get(id); const rel = [...n.nbrs].map((x) => byId.get(x)).sort((a, b) => (a.ghost - b.ghost) || b.deg - a.deg);
  panel.innerHTML = `<button class="x" aria-label="Close">×</button><small>${n.ghost ? "Queued" : (D.types[n.type]?.one ?? n.type) + (n.when ? " · " + n.when : "")}</small><h2>${esc(n.name)}</h2><p>${esc(n.summary)}</p>` +
    (rel.length ? `<h3>Threads</h3><div class="rel">${rel.map((r) => `<button data-id="${r.id}" class="${r.ghost ? "g" : ""}">${esc(r.name)}</button>`).join("")}</div>` : "") +
    (n.ghost ? "" : `<a class="go" href="https://rosengaard98.github.io/menswear-atlas/#${n.id}" target="_blank" rel="noopener">Open the full entry →</a>`);
  panel.classList.add("on");
  panel.querySelector(".x").onclick = () => select(null);
  panel.querySelectorAll(".rel button").forEach((b) => { b.onclick = () => select(b.dataset.id); b.onpointerenter = () => { S.hover = b.dataset.id; paint(); }; b.onpointerleave = () => { S.hover = null; paint(); }; });
  view.tx = W / 2 - n.x * view.tk - (W > 900 ? 150 : 0); view.ty = H / 2 - n.y * view.tk;
  paint();
}

// ---------- draw ----------
const col = (hex, a) => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.translate(view.x, view.y); ctx.scale(view.k, view.k);
  if (rings) { const R0 = Math.min(W, H) * 0.42 * 1.15; ctx.lineWidth = 1 / view.k; ctx.setLineDash([2, 6]); [0.2, 0.38, 0.52, 0.62, 0.74, 0.9, 1.12].forEach((r, i) => { ctx.strokeStyle = col(V.line, 0.1); ctx.beginPath(); ctx.ellipse(0, 0, r * R0 * 1.55, r * R0, 0, 0, 6.283); ctx.stroke(); }); ctx.setLineDash([]); }
  const fid = focusId(), m = S.matches;
  for (const e of edges) {
    const a = e.a, b = e.b;
    const vis = inYears(a) && inYears(b) && passKinds(a) && passKinds(b);
    let al = V.edgeA * (e.kind === "mention" ? 0.5 : 1), w = e.kind === "mention" ? 0.8 : 1.4, lit = false;
    if (fid) { lit = a.id === fid || b.id === fid; al = lit ? 0.95 : 0.04; w = lit ? 2.2 : 0.8; }
    else if (m) { lit = m.hit.has(a.id) && m.hit.has(b.id); const half = m.hit.has(a.id) || m.hit.has(b.id); al = lit ? 0.85 : half ? 0.3 : 0.04; w = lit ? 2 : 1; }
    if (!vis) al = 0.02;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
    const cx = mx - dy * e.bow, cy = my + dx * e.bow;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y);
    ctx.lineWidth = w / Math.max(0.8, view.k * 0.9); ctx.strokeStyle = col(V.line, al);
    if (lit && V.glow) { ctx.shadowColor = col(V.glowColor, 0.9); ctx.shadowBlur = 14; }
    if (lit && !reduce) { ctx.setLineDash([10, 8]); ctx.lineDashOffset = -T * 0.03; } else ctx.setLineDash(e.kind === "mention" ? [3, 5] : []);
    ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
    if (lit && V.travel && !reduce) { // a bead travelling along the thread
      const t = ((T * 0.0004) + e.bow * 3) % 1, u = 1 - t; const px = u * u * a.x + 2 * u * t * cx + t * t * b.x, py = u * u * a.y + 2 * u * t * cy + t * t * b.y;
      ctx.fillStyle = col(V.glowColor, 0.95); ctx.beginPath(); ctx.arc(px, py, 2.6 / view.k * 1.2, 0, 6.283); ctx.fill();
    }
  }
}
function place() {
  for (const n of nodes) { n.el.style.transform = `translate(${n.x.toFixed(1)}px,${n.y.toFixed(1)}px)`; }
  world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
}
let last = performance.now();
function frame(t) {
  const dt = Math.min(2, (t - last) / 16.7); last = t; T = t;
  const e = reduce ? 1 : 0.085;
  view.x += (view.tx - view.x) * e; view.y += (view.ty - view.y) * e; view.k += (view.tk - view.k) * e;
  step(dt); draw(); place();
  requestAnimationFrame(frame);
}
resize(); yr(); paint();
// pre-warm so the first frame is already a web
for (let i = 0; i < 400; i++) step(1);
fitView(true);
alpha = 0.5;
nodes.forEach((n) => n.el.classList.add("in"));
requestAnimationFrame(frame);
window.__atlas = { S, search, select, nodes };
})();
