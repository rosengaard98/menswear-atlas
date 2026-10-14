(() => {
  "use strict";
  const DATA = JSON.parse(document.getElementById("atlas-data").textContent);
  const nodes = new Map(DATA.nodes.map((n) => [n.id, n]));
  const wanted = new Map(DATA.wanted.map((w) => [w.id, w]));
  const TYPES = DATA.types;
  const REL = DATA.relations;
  const SITE = DATA.site;
  const L = DATA.layout;
  const SVGS = DATA.svgs;
  const ORDER = Object.keys(TYPES);
  const THIS_YEAR = new Date().getFullYear();
  const app = document.getElementById("app");
  let pageAbort = null; // listeners on window/document belong to one page view

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const nameOf = (id) => nodes.get(id)?.name ?? wanted.get(id)?.label ?? id;
  const typeOne = (t) => TYPES[t]?.one ?? t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function years(p, long = false) {
    if (!p || p.from == null) return "";
    if (p.to == null) return long ? `${p.from} to today` : `${p.from}–`;
    if (p.to === p.from) return String(p.from);
    return `${p.from}–${p.to}`;
  }

  // relations, both directions, with the label that reads right from each end
  const rels = new Map();
  const addRel = (id, other, label, extra = {}) => { if (!rels.has(id)) rels.set(id, []); rels.get(id).push({ other, label, ...extra }); };
  for (const e of DATA.edges) {
    const r = REL[e.kind];
    addRel(e.from, e.to, r.label, { year: e.year, note: e.note });
    if (e.kind !== "related" || e.from !== e.to) addRel(e.to, e.from, r.inverseLabel, { year: e.year, note: e.note });
  }
  function relGroups(id) {
    const groups = new Map();
    const seen = new Set();
    for (const r of rels.get(id) ?? []) {
      if (!groups.has(r.label)) groups.set(r.label, []);
      groups.get(r.label).push(r.other); seen.add(r.other);
    }
    const n = nodes.get(id);
    const mentioned = (n ? n.mentions : wanted.get(id)?.linkedFrom ?? []).filter((x) => !seen.has(x));
    // entries that mention this one without a typed relation
    const mentionedBy = [...nodes.values()].filter((m) => m.mentions.includes(id) && !seen.has(m.id) && !mentioned.includes(m.id)).map((m) => m.id);
    if (mentioned.length) groups.set(n ? "Mentions" : "Mentioned in", mentioned);
    if (mentionedBy.length) groups.set("Mentioned in", [...(groups.get("Mentioned in") ?? []), ...mentionedBy]);
    return groups;
  }

  // ---------- pictures ----------
  function svgMarkup(key, viewBox) {
    const src = SVGS[key] ?? "";
    return src.replace(/<svg\b([^>]*)>/, (m, attrs) => `<svg${attrs.replace(/\sviewBox="[^"]*"/, "")} viewBox="${viewBox.join(" ")}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">`);
  }
  function matHTML(n) {
    const pic = n?.picture;
    if (pic?.kind === "print") return `<img class="print-img" src="${esc(pic.src)}" alt="" loading="lazy" decoding="async"${pic.remote ? ' referrerpolicy="no-referrer"' : ""}>`;
    if (pic?.kind === "drawing") return svgMarkup(pic.svg, pic.viewBox);
    const letter = (n?.name ?? "?").replace(/^The\s+/i, "").charAt(0);
    return `<span class="monogram-wrap"><span class="monogram">${esc(letter)}</span></span>`;
  }
  const frameHTML = (n) => `<span class="frame"><span class="mat">${matHTML(n)}</span></span>`;
  function creditHTML(n) {
    const p = n.picture;
    if (p?.kind !== "print") return "";
    return `<p class="credit">Picture: ${esc(p.credit)}. ${esc(p.licence)}, via <a href="${esc(p.source)}" target="_blank" rel="noopener">Wikimedia Commons</a>.</p>`;
  }

  // ---------- page chrome ----------
  function masthead(isHome) {
    const mark = isHome ? `<h1 class="wordmark" style="margin:0">${esc(SITE.title)}</h1>` : `<a class="wordmark" href="#">${esc(SITE.title)}</a>`;
    return `<header class="masthead"><div class="wrap">${mark}<span class="masthead-meta">${nodes.size} entries, ${DATA.edges.length} connections, ${wanted.size} being researched</span></div><div class="tie" aria-hidden="true"></div></header>`;
  }
  function footer() {
    return `<footer class="foot"><div class="wrap"><span>Updated ${esc(DATA.built)}. Every entry lists its sources; pictures are original drawings or public-domain prints.</span><span>New entries are researched and added every night.</span></div></footer>`;
  }

  // ---------- the web ----------
  function buildWeb(root, focusId) {
    const pos = L.pos;
    const S = L.sizes;
    const box = (id) => (nodes.has(id) ? S.entry : S.wanted);
    const ids = Object.keys(pos).sort((a, b) => pos[a][0] - pos[b][0]);

    // threads: typed relations, plus dashed threads to topics not written yet
    const threads = [];
    for (const e of DATA.edges) if (pos[e.from] && pos[e.to]) threads.push({ a: e.from, b: e.to, wanted: false });
    for (const w of DATA.wanted) for (const from of w.linkedFrom) if (pos[from] && pos[w.id]) threads.push({ a: from, b: w.id, wanted: true });
    const near = new Map(ids.map((id) => [id, new Set()]));
    for (const t of threads) { near.get(t.a)?.add(t.b); near.get(t.b)?.add(t.a); }

    const centre = (id) => { const [x, y] = pos[id]; const b = box(id); return [x, y - b.h / 2 + (nodes.has(id) ? 65 : 20)]; };
    const paths = threads.map((t, i) => {
      const [x1, y1] = centre(t.a), [x2, y2] = centre(t.b);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
      const bend = 0.12;
      return `<path data-i="${i}" class="${t.wanted ? "to-wanted" : ""}" d="M${x1},${y1} Q${(mx - dy * bend).toFixed(1)},${(my + dx * bend).toFixed(1)} ${x2},${y2}"/>`;
    }).join("");

    const nodeHTML = ids.map((id) => {
      const [x, y] = pos[id];
      const b = box(id);
      const style = `left:${x - b.w / 2}px;top:${y - b.h / 2}px;width:${b.w}px`;
      const n = nodes.get(id);
      if (!n) {
        const w = wanted.get(id);
        return `<button type="button" class="node is-wanted" data-id="${esc(id)}" data-type="_wanted" style="${style}" aria-label="${esc(w.label)}, not written yet"><span class="frame"><span class="wanted-label">${esc(w.label)}</span></span></button>`;
      }
      const yr = n.type === "person" ? years(n.period) : n.period?.from ?? "";
      return `<button type="button" class="node" data-id="${esc(id)}" data-type="${esc(n.type)}" style="${style}" aria-label="${esc(n.name)}, ${esc(typeOne(n.type))}${yr ? `, ${yr}` : ""}">${frameHTML(n)}<span class="nameplate"><span class="sc">${esc(n.name)}</span>${yr ? `<span class="y">${esc(String(yr))}</span>` : ""}</span></button>`;
    }).join("");

    const typesShown = ORDER.filter((t) => t !== "era" && [...nodes.values()].some((n) => n.type === t));
    root.innerHTML = `
      <div class="web-ruler" aria-hidden="true"></div>
      <div class="web-stage" style="width:${L.width}px;height:${L.height}px">
        <div class="web-bands">${L.eras.map((e) => `<div class="web-band" style="left:${e.x0}px;width:${e.x1 - e.x0}px"></div>`).join("")}</div>
        <svg class="web-threads" width="${L.width}" height="${L.height}" viewBox="0 0 ${L.width} ${L.height}" aria-hidden="true">${paths}</svg>
        <div class="web-nodes">${nodeHTML}</div>
      </div>
      <div class="web-tools">
        <div class="finder-web"><label class="sr-only" for="webfind">Find in the web</label><input id="webfind" type="search" placeholder="Find a garment, maker or person" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="suggest"><ul class="suggest" id="suggest" role="listbox" hidden></ul></div>
        <div class="chips" role="group" aria-label="Show or hide kinds of entry">${typesShown.map((t) => `<button type="button" class="chip" data-type="${t}" aria-pressed="true">${esc(TYPES[t].many)}</button>`).join("")}<button type="button" class="chip" data-type="_wanted" aria-pressed="true">Being researched</button></div>
        <div class="zoom"><button type="button" data-z="out" aria-label="Zoom out">−</button><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" class="fit" data-z="fit">Whole web</button></div>
      </div>
      <aside class="web-card" hidden></aside>`;

    const stage = root.querySelector(".web-stage");
    const ruler = root.querySelector(".web-ruler");
    const card = root.querySelector(".web-card");
    const pathEls = [...root.querySelectorAll(".web-threads path")];
    const nodeEls = new Map([...root.querySelectorAll(".node")].map((el) => [el.dataset.id, el]));
    let tx = 0, ty = 0, k = 1, raf = 0;

    const RULER_H = 46;
    function apply() {
      stage.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
      root.classList.toggle("is-far", k < 0.5);
      root.classList.toggle("is-very-far", k < 0.3);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawRuler(); });
    }
    function drawRuler() {
      const vw = root.clientWidth;
      const x0 = -tx / k, x1 = (vw - tx) / k;
      const yearAt = (x) => L.start + (x - L.padX) / L.yearPx;
      const screenX = (year) => (L.padX + (year - L.start) * L.yearPx) * k + tx;
      const pxPerYear = L.yearPx * k;
      const step = [5, 10, 25, 50, 100].find((s) => s * pxPerYear >= 64) ?? 100;
      const minor = step >= 25 ? step / 5 : step / 5 >= 1 ? step / 5 : 1;
      let html = "";
      const y0 = Math.max(L.start, Math.floor(yearAt(x0) / minor) * minor), y1 = Math.min(L.end, yearAt(x1));
      for (let y = Math.ceil(y0 / minor) * minor; y <= y1; y += minor) {
        const x = screenX(y);
        const major = y % step === 0;
        html += `<span class="tick${major ? " major" : ""}" style="left:${x.toFixed(1)}px"></span>`;
        if (major) html += `<span class="num" style="left:${x.toFixed(1)}px">${y}</span>`;
      }
      for (const e of L.eras) {
        const a = Math.max((e.x0) * k + tx, 0), b = Math.min(e.x1 * k + tx, vw);
        if (b - a > 40) html += `<span class="era" style="left:${((a + b) / 2).toFixed(1)}px">${esc(e.name)}</span>`;
      }
      ruler.innerHTML = html;
    }

    function viewport() {
      const open = !card.hidden;
      const narrow = root.clientWidth <= 544;
      const cardW = open && !narrow ? card.offsetWidth + 24 : 0;
      const cardH = open && narrow ? card.offsetHeight + 8 : 56;
      return { w: root.clientWidth - cardW, h: root.clientHeight - RULER_H - cardH };
    }
    function fit() {
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      for (const id of ids) {
        const [x, y] = pos[id]; const b = box(id);
        minx = Math.min(minx, x - b.w / 2); maxx = Math.max(maxx, x + b.w / 2);
        miny = Math.min(miny, y - b.h / 2); maxy = Math.max(maxy, y + b.h / 2);
      }
      const { w, h: vh } = viewport();
      if (w <= 544) {
        // on a phone, fill the height and start in the middle of the years; drag sideways for the rest
        k = clamp(vh / (maxy - miny + 80), 0.3, 0.9);
        const midX = pos[ids[Math.floor(ids.length / 2)]][0];
        tx = w / 2 - midX * k;
      } else {
        k = clamp(Math.min(w / (maxx - minx + 160), vh / (maxy - miny + 80)), 0.12, 1.1);
        tx = (w - (maxx - minx) * k) / 2 - minx * k;
      }
      ty = RULER_H + (vh - (maxy - miny) * k) / 2 - miny * k;
      apply();
    }
    function zoomAt(f, cx, cy) {
      const nk = clamp(k * f, 0.12, 2.4);
      tx = cx - (cx - tx) * (nk / k); ty = cy - (cy - ty) * (nk / k); k = nk; apply();
    }
    function fly(apply2) {
      root.classList.add("is-flying");
      apply2(); apply();
      setTimeout(() => root.classList.remove("is-flying"), 600);
    }
    function flyTo(id) {
      const [x, y] = centre(id);
      const { w, h: vh } = viewport();
      fly(() => { k = Math.max(k, 0.8); tx = w / 2 - x * k; ty = RULER_H + vh / 2 - y * k; });
    }

    // selection and highlighting
    let selected = null;
    function light(id) {
      root.classList.toggle("has-focus", !!id);
      const lit = id ? new Set([id, ...near.get(id)]) : new Set();
      for (const [nid, el] of nodeEls) { el.classList.toggle("is-lit", lit.has(nid)); el.classList.toggle("is-selected", nid === selected); }
      pathEls.forEach((p, i) => { const t = threads[i]; p.classList.toggle("is-lit", !!id && (t.a === id || t.b === id)); });
    }
    function select(id, { flyThere = true } = {}) {
      selected = id;
      light(id);
      openCard(id);
      if (flyThere) flyTo(id);
    }
    function deselect() { selected = null; light(null); card.hidden = true; }

    function openCard(id) {
      const n = nodes.get(id);
      const groups = relGroups(id);
      const relHTML = [...groups].map(([label, list]) => `<dt>${esc(label)}</dt><dd>${list.map((o) => `<button type="button" data-go="${esc(o)}" class="${nodes.has(o) ? "" : "is-wanted"}">${esc(nameOf(o))}</button>`).join("")}</dd>`).join("");
      if (n) {
        const meta = [typeOne(n.type), years(n.period, true)].filter(Boolean).join(", ");
        card.innerHTML = `<button type="button" class="close" aria-label="Close">×</button>
          <div class="card-pic">${frameHTML(n)}</div>
          <p class="soft sc" style="margin:0">${esc(meta)}</p>
          <h2>${esc(n.name)}</h2>
          <p>${esc(n.summary)}</p>
          <a class="open" href="#${esc(n.id)}">Read the entry</a>
          ${relHTML ? `<dl class="rels">${relHTML}</dl>` : ""}
          ${creditHTML(n)}`;
      } else {
        const w = wanted.get(id);
        card.innerHTML = `<button type="button" class="close" aria-label="Close">×</button>
          <p class="soft sc" style="margin:0">Being researched</p>
          <h2>${esc(w.label)}</h2>
          <p>Not written yet. ${w.linkedFrom.length > 1 ? `${w.linkedFrom.length} entries link here` : "One entry links here"}, and each night's run starts with the most-linked topics.</p>
          ${w.notes[0] ? `<p class="soft">${esc(w.notes[0].note)}</p>` : ""}
          <a class="open" href="#${esc(id)}">What is known so far</a>
          ${relHTML ? `<dl class="rels">${relHTML}</dl>` : ""}`;
      }
      card.hidden = false;
      card.scrollTop = 0;
    }
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target.closest(".close")) { deselect(); return; }
      const go = e.target.closest("[data-go]");
      if (go) select(go.dataset.go);
    });
    card.addEventListener("pointerdown", (e) => e.stopPropagation());
    card.addEventListener("wheel", (e) => e.stopPropagation());

    // pointer: drag to pan, two fingers to pinch, click to select
    const pts = new Map();
    let drag = null, pinch = null, moved = false;
    root.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".web-tools, .web-card")) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { drag = { x: e.clientX, y: e.clientY, tx, ty }; moved = false; }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const r = root.getBoundingClientRect();
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k, tx, ty, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top };
        moved = true;
      }
    });
    const onMove = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const f = Math.hypot(a.x - b.x, a.y - b.y) / pinch.d;
        const nk = clamp(pinch.k * f, 0.12, 2.4);
        tx = pinch.cx - (pinch.cx - pinch.tx) * (nk / pinch.k); ty = pinch.cy - (pinch.cy - pinch.ty) * (nk / pinch.k); k = nk;
        apply();
      } else if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!moved && Math.abs(dx) + Math.abs(dy) > 5) { moved = true; root.classList.add("is-dragging"); }
        if (moved) { tx = drag.tx + dx; ty = drag.ty + dy; apply(); }
      }
    };
    const onUp = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) { drag = null; root.classList.remove("is-dragging"); }
    };
    const sig = { signal: pageAbort.signal };
    window.addEventListener("pointermove", onMove, sig);
    window.addEventListener("pointerup", onUp, sig);
    window.addEventListener("pointercancel", onUp, sig);
    root.addEventListener("click", (e) => {
      if (moved) { moved = false; return; }
      if (e.target.closest(".web-tools, .web-card")) return;
      const nodeEl = e.target.closest(".node");
      if (nodeEl) select(nodeEl.dataset.id, { flyThere: false });
      else deselect();
    });
    root.addEventListener("wheel", (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = root.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    root.addEventListener("dblclick", (e) => {
      if (e.target.closest(".web-tools, .web-card, .node")) return;
      const r = root.getBoundingClientRect();
      fly(() => zoomAt(1.8, e.clientX - r.left, e.clientY - r.top));
    });

    // hover lights the neighbourhood when nothing is selected
    root.addEventListener("pointerover", (e) => {
      if (selected || e.pointerType !== "mouse") return;
      const el = e.target.closest(".node"); if (el) light(el.dataset.id);
    });
    root.addEventListener("pointerout", (e) => {
      if (selected || e.pointerType !== "mouse") return;
      if (e.target.closest(".node") && !e.relatedTarget?.closest?.(".node")) light(null);
    });
    root.addEventListener("focusin", (e) => { const el = e.target.closest(".node"); if (el && !selected) light(el.dataset.id); });

    // keyboard
    root.addEventListener("keydown", (e) => {
      if (e.target.closest("input")) return;
      const step = 90;
      const map = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (map[e.key] && !e.target.closest(".node")) { tx += map[e.key][0]; ty += map[e.key][1]; apply(); e.preventDefault(); }
      else if (e.key === "+" || e.key === "=") zoomAt(1.25, root.clientWidth / 2, root.clientHeight / 2);
      else if (e.key === "-") zoomAt(0.8, root.clientWidth / 2, root.clientHeight / 2);
      else if (e.key === "0") fly(fit);
      else if (e.key === "Escape") deselect();
      else if (e.key === "Enter" && e.target.closest(".node")) { e.preventDefault(); select(e.target.closest(".node").dataset.id); }
    });

    // tools
    root.querySelector(".zoom").addEventListener("click", (e) => {
      const z = e.target.closest("button")?.dataset.z;
      if (z === "in") fly(() => zoomAt(1.4, root.clientWidth / 2, root.clientHeight / 2));
      if (z === "out") fly(() => zoomAt(1 / 1.4, root.clientWidth / 2, root.clientHeight / 2));
      if (z === "fit") { deselect(); fly(fit); }
    });
    const hidden = new Set();
    root.querySelector(".chips").addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return;
      const t = b.dataset.type;
      hidden.has(t) ? hidden.delete(t) : hidden.add(t);
      b.setAttribute("aria-pressed", String(!hidden.has(t)));
      for (const el of nodeEls.values()) el.classList.toggle("is-muted", hidden.has(el.dataset.type));
    });

    const input = root.querySelector("#webfind");
    const list = root.querySelector(".suggest");
    let matches = [], active = 0;
    const all = [...[...nodes.values()].map((n) => ({ id: n.id, name: n.name, words: [n.name, ...(n.aka || [])].join(" ").toLowerCase(), kind: typeOne(n.type) })),
      ...DATA.wanted.map((w) => ({ id: w.id, name: w.label, words: w.label.toLowerCase(), kind: "being researched" }))];
    function suggest() {
      const q = input.value.trim().toLowerCase();
      matches = q ? all.filter((a) => a.words.includes(q)).sort((a, b) => a.words.indexOf(q) - b.words.indexOf(q)).slice(0, 7) : [];
      active = 0;
      list.hidden = !matches.length;
      input.setAttribute("aria-expanded", String(!!matches.length));
      list.innerHTML = matches.map((m, i) => `<li><button type="button" role="option" aria-selected="${i === 0}" data-go="${esc(m.id)}"><span>${esc(m.name)}</span><span class="soft">${esc(m.kind)}</span></button></li>`).join("");
    }
    const pick = (id) => { list.hidden = true; input.value = ""; input.setAttribute("aria-expanded", "false"); select(id); };
    input.addEventListener("input", suggest);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!matches.length) return;
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length;
        [...list.querySelectorAll("button")].forEach((b, i) => b.setAttribute("aria-selected", String(i === active)));
      } else if (e.key === "Enter" && matches[active]) { e.preventDefault(); pick(matches[active].id); }
      else if (e.key === "Escape") { list.hidden = true; input.value = ""; }
    });
    list.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) pick(b.dataset.go); });

    let rz;
    window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { selected ? flyTo(selected) : fit(); }, 200); }, sig);

    fit();
    if (focusId && pos[focusId]) select(focusId);
  }

  // ---------- plate with hotspot rings (garments) ----------
  function buildPlate(node) {
    const plate = h(`<div class="plate"><div class="plate-head"><span class="plate-title"></span><div class="views" role="group" aria-label="Views"></div></div><div class="figure"></div><p class="plate-caption"></p></div>`);
    const fig = plate.querySelector(".figure");
    const tabs = plate.querySelector(".views");
    let current = 0, openIndex = -1;
    if (node.views.length > 1) node.views.forEach((v, i) => {
      const b = h(`<button type="button" aria-pressed="false">${esc(v.label)}</button>`);
      b.addEventListener("click", () => show(i));
      tabs.append(b);
    });
    function show(i) {
      close(); current = i;
      const v = node.views[i];
      [...tabs.children].forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
      plate.querySelector(".plate-title").textContent = `${v.label} view. Open a ring for the detail.`;
      const cap = plate.querySelector(".plate-caption");
      cap.textContent = v.caption ?? ""; cap.hidden = !v.caption;
      fig.innerHTML = svgMarkup(v.svg, v.viewBox).replace('aria-hidden="true"', `role="img" aria-label="${esc(node.name)}, ${esc(v.label)}"`);
      const [vx, vy, vw, vh] = v.viewBox;
      v.hotspots.forEach((s, j) => {
        const b = h(`<button type="button" class="spot${nodes.has(s.target) ? "" : " is-wanted"}" aria-expanded="false" aria-label="${esc(s.label)}: open note"></button>`);
        b.style.left = `${((s.x - vx) / vw) * 100}%`; b.style.top = `${((s.y - vy) / vh) * 100}%`;
        b.addEventListener("click", (e) => { e.stopPropagation(); openIndex === j ? close() : open(j); });
        fig.append(b);
      });
    }
    function open(j) {
      close();
      const s = node.views[current].hotspots[j];
      const spot = fig.querySelectorAll(".spot")[j];
      openIndex = j; spot.setAttribute("aria-expanded", "true");
      const t = nodes.get(s.target);
      const foot = t ? `<a class="go" href="#${esc(s.target)}">${t.name.toLowerCase() === s.label.toLowerCase() ? "Read the entry" : `Read about ${esc(["detail", "garment"].includes(t.type) ? t.name.charAt(0).toLowerCase() + t.name.slice(1) : t.name)}`}</a>`
        : `<a class="queued" href="#${esc(s.target)}">Not written yet</a>`;
      const pop = h(`<div class="pop" role="dialog" aria-label="${esc(s.label)}"><h3>${esc(s.label)}</h3><p>${esc(s.note)}</p><div class="pop-foot">${foot}<button type="button" class="close">Close</button></div></div>`);
      pop.querySelector(".close").addEventListener("click", () => { close(); spot.focus(); });
      pop.addEventListener("click", (e) => e.stopPropagation());
      fig.append(pop);
      const fw = fig.clientWidth, fh = fig.clientHeight, sx = spot.offsetLeft, sy = spot.offsetTop, pw = pop.offsetWidth, ph = pop.offsetHeight;
      let left = sx - pw / 2, top = sy + 24;
      if (fw >= 480 && pw < fw * 0.6) { left = sx < fw / 2 ? sx + 24 : sx - 24 - pw; top = sy - 28; }
      else if (sy + 24 + ph > fh) top = sy - 24 - ph;
      pop.style.left = `${clamp(left, 0, fw - pw)}px`; pop.style.top = `${clamp(top, -8, fh - ph + 8)}px`;
      pop.querySelector("a, .close").focus({ preventScroll: true });
    }
    function close() {
      fig.querySelector(".pop")?.remove();
      if (openIndex >= 0) fig.querySelectorAll(".spot")[openIndex]?.setAttribute("aria-expanded", "false");
      openIndex = -1;
    }
    plate.addEventListener("keydown", (e) => { if (e.key === "Escape" && openIndex >= 0) { const s = fig.querySelectorAll(".spot")[openIndex]; close(); s?.focus(); } });
    document.addEventListener("click", (e) => { if (!plate.contains(e.target)) close(); }, { signal: pageAbort.signal });
    show(0);
    return plate;
  }

  function miniTape(p) {
    if (!p || p.from == null) return "";
    const from = SITE.timeline?.from ?? 1770, to = SITE.timeline?.to ?? THIS_YEAR + 4;
    const pct = (y) => ((clamp(y, from, to) - from) / (to - from)) * 100;
    const marks = [];
    for (let y = Math.ceil(from / 50) * 50; y <= to; y += 50) marks.push(`<span class="num" style="left:${pct(y)}%">${y}</span>`);
    const end = p.to ?? THIS_YEAR;
    const shape = end > p.from ? `<span class="span" style="left:${pct(p.from)}%;width:${pct(end) - pct(p.from)}%"></span>` : "";
    return `<div class="tape-mini" aria-label="${years(p, true)}">${shape}<span class="dot" style="left:${pct(p.from)}%"></span>${marks.join("")}</div>`;
  }

  // ---------- pages ----------
  function renderHome(focusId) {
    document.title = SITE.title;
    app.innerHTML = `${masthead(true)}
      <main>
        <div class="wrap intro"><p style="font-size:var(--step-1);color:var(--ink)">${esc(SITE.tagline)}</p><p class="how">Drag to move around. Pinch, or hold Ctrl and scroll, to zoom.<br>Click a picture to see what it connects to.</p></div>
        <div class="web" tabindex="0" aria-label="The web of entries. Use Tab to move between pictures, arrow keys to pan, plus and minus to zoom."></div>
        <div class="wrap">
          <section class="block" aria-labelledby="h-index">
            <div class="block-head"><h2 id="h-index">The catalogue</h2><p>Every entry, by kind. ${esc(SITE.intro)}</p></div>
            <div class="finder"><label for="find">Find</label><input id="find" type="search" placeholder="Collar, Brooks, 1950s" autocomplete="off"></div>
            <div class="index"></div>
          </section>
          <section class="block" aria-labelledby="h-queue">
            <div class="block-head"><h2 id="h-queue">Being researched</h2><p>Linked from existing entries but not written yet. Each night's run starts with the most-linked.</p></div>
            <ul class="queue">${DATA.wanted.map((w) => `<li><a href="#${esc(w.id)}">${esc(w.label)}</a> <span class="count">${w.linkedFrom.length > 1 ? `${w.linkedFrom.length} links` : "1 link"}</span></li>`).join("")}</ul>
          </section>
        </div>
      </main>
      ${footer()}`;
    buildWeb(app.querySelector(".web"), focusId);
    const index = app.querySelector(".index");
    const drawIndex = (q) => {
      const needle = q.trim().toLowerCase();
      const match = (n) => !needle || [n.name, ...(n.aka || []), n.summary, years(n.period), ...(n.regions || [])].join(" ").toLowerCase().includes(needle);
      index.innerHTML = ORDER.map((t) => {
        const items = [...nodes.values()].filter((n) => n.type === t && match(n)).sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.name.localeCompare(b.name));
        if (!items.length) return needle ? "" : `<div><h3>${esc(TYPES[t].many)}</h3><p class="empty">None yet.</p></div>`;
        return `<div><h3>${esc(TYPES[t].many)}</h3><ul>${items.map((n) => `<li><a href="#${esc(n.id)}">${esc(n.name)}</a><span class="years">${years(n.period)}</span></li>`).join("")}</ul></div>`;
      }).join("") || `<p class="empty">Nothing matches “${esc(q)}”. Try a garment, a maker or a decade.</p>`;
    };
    drawIndex("");
    app.querySelector("#find").addEventListener("input", (e) => drawIndex(e.target.value));
  }

  function relListHTML(id) {
    const groups = relGroups(id);
    if (!groups.size) return "";
    return `<div><h2>Connections</h2><dl class="rels">${[...groups].map(([label, list]) => `<dt>${esc(label)}</dt><dd>${list.map((o) => `<a href="#${esc(o)}" class="${nodes.has(o) ? "" : "is-wanted"}">${esc(nameOf(o))}</a>`).join("")}</dd>`).join("")}</dl></div>`;
  }
  function sourcesHTML(n) {
    return `<div class="sources"><h2>Sources</h2><ol>${n.sources.map((s) => {
      const title = s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title);
      const pub = [s.publisher, s.citation].filter(Boolean).join(", ");
      return `<li>${title}${pub ? ` <span class="pub">${esc(pub)}</span>` : ""}</li>`;
    }).join("")}</ol><p class="credit">Added ${esc(n.added)}</p></div>`;
  }

  function renderEntry(n) {
    document.title = `${n.name} | ${SITE.title}`;
    const meta = [typeOne(n.type), years(n.period, true)].filter(Boolean).join(", ");
    const side = n.views.length ? `<div class="entry-side plate-slot"></div>`
      : `<div class="entry-side"><div class="hung">${frameHTML(n)}<span class="nameplate"><span class="sc">${esc(n.name)}</span></span></div><div class="hung-credit">${creditHTML(n)}</div></div>`;
    app.innerHTML = `${masthead(false)}
      <main class="wrap">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="#">The web</a> / ${esc(TYPES[n.type]?.many ?? n.type)}</nav>
        <article class="entry">
          ${side}
          <div class="entry-text">
            <p class="kind sc" style="margin:0">${esc(meta)}</p>
            <h1>${esc(n.name)}</h1>
            ${n.aka.length ? `<p class="aka">Also called ${esc(n.aka.join(", "))}</p>` : ""}
            <p class="summary">${esc(n.summary)}</p>
            ${miniTape(n.period)}
            <a class="in-web" href="#~${esc(n.id)}">See it in the web</a>
            <div class="prose">${n.html}</div>
            <div class="facts">${relListHTML(n.id)}${sourcesHTML(n)}</div>
          </div>
        </article>
      </main>
      ${footer()}`;
    if (n.views.length) app.querySelector(".plate-slot").append(buildPlate(n));
  }

  function renderWanted(w) {
    document.title = `${w.label} | ${SITE.title}`;
    app.innerHTML = `${masthead(false)}
      <main class="wrap">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="#">The web</a> / Being researched</nav>
        <article class="entry wanted-page">
          <div class="entry-text">
            <p class="kind sc" style="margin:0">Not written yet</p>
            <h1>${esc(w.label)}</h1>
            <p class="summary">This topic is on the research list. Other entries already link to it, and the nightly run picks the most-linked topics first.</p>
            <a class="in-web" href="#~${esc(w.id)}">See where it sits in the web</a>
            ${w.notes.length ? `<ul class="notes">${w.notes.map((x) => `<li>${esc(x.note)} <span class="soft">(from the plate of <a href="#${esc(x.from)}">${esc(nameOf(x.from))}</a>)</span></li>`).join("")}</ul>` : ""}
          </div>
          <div class="entry-text facts">${relListHTML(w.id)}</div>
        </article>
      </main>
      ${footer()}`;
  }

  function renderMissing(id) {
    document.title = SITE.title;
    app.innerHTML = `${masthead(false)}<main class="wrap"><article class="entry"><div class="entry-text"><p class="kind sc">No entry</p><h1>Nothing called “${esc(id)}” yet</h1><p class="summary">The link may be old, or the entry may have been renamed. <a href="#">Go back to the web</a> and use Find.</p></div></article></main>${footer()}`;
  }

  // a print that cannot load (offline, blocked host) falls back to the monogram
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains("print-img")) return;
    const id = img.closest("[data-id]")?.dataset.id ?? location.hash.replace(/^#~?/, "");
    const letter = (nodes.get(id)?.name ?? "?").replace(/^The\s+/i, "").charAt(0);
    img.replaceWith(h(`<span class="monogram-wrap"><span class="monogram">${esc(letter)}</span></span>`));
  }, true);

  // ---------- routing: "" home, "~id" home focused on id, "id" an entry ----------
  let last = null;
  function route() {
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    if (raw === last) return;
    last = raw;
    pageAbort?.abort();
    pageAbort = new AbortController();
    if (!raw) renderHome();
    else if (raw.startsWith("~")) renderHome(raw.slice(1));
    else if (nodes.has(raw)) renderEntry(nodes.get(raw));
    else if (wanted.has(raw)) renderWanted(wanted.get(raw));
    else renderMissing(raw);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
