(() => {
  "use strict";
  const DATA = JSON.parse(document.getElementById("atlas-data").textContent);
  const nodes = new Map(DATA.nodes.map((n) => [n.id, n]));
  const wanted = new Map(DATA.wanted.map((w) => [w.id, w]));
  const TYPES = DATA.types;
  const ORDER = ["garment", "detail", "era", "style", "maker", "person", "context"].filter((t) => TYPES[t]);
  for (const t of Object.keys(TYPES)) if (!ORDER.includes(t)) ORDER.push(t);
  const SITE = DATA.site;
  const THIS_YEAR = new Date().getFullYear();
  const app = document.getElementById("app");

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const nameOf = (id) => nodes.get(id)?.name ?? wanted.get(id)?.label ?? id;
  const typeOne = (t) => TYPES[t]?.one ?? t;

  function years(p, long = false) {
    if (!p || p.from == null) return "";
    if (p.to == null) return long ? `${p.from} to today` : `${p.from}–`;
    if (p.to === p.from) return String(p.from);
    return `${p.from}–${p.to}`;
  }
  function readAbout(target, label) {
    if (target.name.toLowerCase() === label.toLowerCase()) return "Read the full entry";
    if (!["detail", "garment"].includes(target.type)) return `Read about ${target.name}`;
    return `Read about the ${target.name.charAt(0).toLowerCase()}${target.name.slice(1)}`;
  }
  function entryLink(id, text) {
    const exists = nodes.has(id);
    return `<a href="#${esc(id)}" class="xref${exists ? "" : " is-wanted"}">${esc(text ?? nameOf(id))}</a>`;
  }

  // ---------- plate: an illustration with rings that open boxes ----------
  function buildPlate(node, opts = {}) {
    const plate = h(`<div class="plate"><div class="plate-head"><span class="mark plate-title"></span><div class="views" role="group" aria-label="Views"></div></div><div class="figure"></div><p class="mark plate-caption"></p></div>`);
    const fig = plate.querySelector(".figure");
    const tabs = plate.querySelector(".views");
    const title = plate.querySelector(".plate-title");
    const caption = plate.querySelector(".plate-caption");
    let current = 0;
    let openIndex = -1;
    const listeners = [];

    if (node.views.length > 1) {
      node.views.forEach((v, i) => {
        const b = h(`<button type="button" aria-pressed="false">${esc(v.label)}</button>`);
        b.addEventListener("click", () => show(i));
        tabs.append(b);
      });
    }

    function show(i) {
      close();
      current = i;
      const v = node.views[i];
      [...tabs.children].forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
      title.textContent = opts.titleText ?? `${node.name}, ${v.label.toLowerCase()}`;
      caption.textContent = v.caption ?? "";
      caption.hidden = !v.caption;
      fig.innerHTML = v.svg;
      const svg = fig.querySelector("svg");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `${node.name}, ${v.label}`);
      svg.removeAttribute("width"); svg.removeAttribute("height");
      const [vx, vy, vw, vh] = v.viewBox;
      v.hotspots.forEach((s, j) => {
        const isWanted = !nodes.has(s.target);
        const b = h(`<button type="button" class="spot${isWanted ? " is-wanted" : ""}" aria-expanded="false" aria-label="${esc(s.label)}: open note"></button>`);
        b.style.left = `${((s.x - vx) / vw) * 100}%`;
        b.style.top = `${((s.y - vy) / vh) * 100}%`;
        b.addEventListener("click", (e) => { e.stopPropagation(); openIndex === j ? close() : open(j); });
        fig.append(b);
      });
      listeners.forEach((fn) => fn(v));
    }

    function open(j) {
      close(false);
      const v = node.views[current];
      const s = v.hotspots[j];
      const spot = fig.querySelectorAll(".spot")[j];
      if (!spot) return;
      openIndex = j;
      spot.setAttribute("aria-expanded", "true");
      const exists = nodes.has(s.target);
      const foot = exists
        ? `<a class="go" href="#${esc(s.target)}">${esc(readAbout(nodes.get(s.target), s.label))}</a>`
        : `<a class="queued" href="#${esc(s.target)}">Not written yet. See what is known</a>`;
      const pop = h(`<div class="pop" role="dialog" aria-label="${esc(s.label)}"><h3>${esc(s.label)}</h3><p>${esc(s.note)}</p><div class="pop-foot">${foot}<button type="button" class="close">Close</button></div></div>`);
      pop.querySelector(".close").addEventListener("click", () => close());
      pop.addEventListener("click", (e) => e.stopPropagation());
      fig.append(pop);
      // place it next to the ring, inside the figure
      const fw = fig.clientWidth, fh = fig.clientHeight;
      const sx = spot.offsetLeft, sy = spot.offsetTop;
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      const gap = 24;
      let left = sx - pw / 2;
      let top = sy + gap;
      if (fw >= 30 * 16 && pw < fw * 0.6) {
        left = sx < fw / 2 ? sx + gap : sx - gap - pw;
        top = sy - 28;
      } else if (sy + gap + ph > fh) {
        top = sy - gap - ph;
      }
      pop.style.left = `${Math.max(0, Math.min(left, fw - pw))}px`;
      pop.style.top = `${Math.max(-8, Math.min(top, fh - ph + 8))}px`;
      pop.querySelector("a, .close").focus({ preventScroll: true });
    }

    function close(refocus = true) {
      const pop = fig.querySelector(".pop");
      if (pop) pop.remove();
      const spot = openIndex >= 0 ? fig.querySelectorAll(".spot")[openIndex] : null;
      if (spot) { spot.setAttribute("aria-expanded", "false"); if (refocus && document.activeElement && pop?.contains(document.activeElement)) spot.focus({ preventScroll: true }); }
      openIndex = -1;
    }

    plate.addEventListener("keydown", (e) => { if (e.key === "Escape" && openIndex >= 0) { const s = fig.querySelectorAll(".spot")[openIndex]; close(); s?.focus(); } });
    document.addEventListener("click", (e) => { if (!plate.contains(e.target)) close(false); });

    plate.api = {
      show,
      open: (j) => { open(j); fig.querySelectorAll(".spot")[j]?.scrollIntoView({ block: "nearest", behavior: "smooth" }); },
      onView: (fn) => listeners.push(fn),
      current: () => node.views[current],
    };
    // first view is drawn by the caller after listeners are attached
    return plate;
  }

  // ---------- tape-measure timeline ----------
  function buildTape() {
    const from = SITE.timeline?.from ?? 1790;
    const to = SITE.timeline?.to ?? THIS_YEAR + 4;
    const span = to - from;
    const pct = (y) => ((Math.max(from, Math.min(to, y)) - from) / span) * 100;
    const wrap = h(`<div class="tape-wrap" tabindex="0" aria-label="Timeline from ${from} to ${to}"><div class="tape"><div class="bands"></div><div class="ruler" aria-hidden="true"></div><div class="pins"></div></div></div>`);
    const tape = wrap.querySelector(".tape");
    const ruler = wrap.querySelector(".ruler");
    for (let y = Math.ceil(from / 5) * 5; y <= to; y += 5) {
      const cls = y % 50 === 0 ? "y50" : y % 10 === 0 ? "y10" : "y5";
      const t = h(`<span class="tick ${cls}"></span>`);
      t.style.left = `${pct(y)}%`;
      ruler.append(t);
      if (y % 10 === 0) { const n = h(`<span class="num">${y}</span>`); n.style.left = `${pct(y)}%`; ruler.append(n); }
    }

    const dated = [...nodes.values()].filter((n) => n.period?.from != null).sort((a, b) => a.period.from - b.period.from);
    // Give each item a lane so that neither bars nor labels overlap at the current width.
    const lanesFor = (items, width) => {
      const ends = [];
      return items.map((it) => {
        const x = (pct(it.a) / 100) * width;
        const barEnd = (pct(it.b) / 100) * width;
        const tight = barEnd - x < it.labelW;
        const right = tight ? x + (barEnd - x) + it.labelW + 8 : barEnd;
        let l = ends.findIndex((e) => e <= x + 1);
        if (l === -1) { l = ends.length; ends.push(0); }
        ends[l] = right;
        return { ...it, lane: l, tight };
      });
    };
    const place = () => {
      const width = tape.clientWidth || 992;
      const bandsEl = wrap.querySelector(".bands");
      const pinsEl = wrap.querySelector(".pins");
      bandsEl.innerHTML = ""; pinsEl.innerHTML = "";
      for (const type of ["era", "style"]) {
        const items = dated.filter((n) => n.type === type)
          .map((n) => ({ n, a: n.period.from, b: n.period.to ?? THIS_YEAR, labelW: n.name.length * 7.6 + 18 }));
        const laid = lanesFor(items, width);
        const count = Math.max(0, ...laid.map((i) => i.lane + 1));
        for (let l = 0; l < count; l++) {
          const lane = h(`<div class="lane"></div>`);
          for (const it of laid.filter((i) => i.lane === l)) {
            const a = h(`<a class="band ${type}${it.tight ? " tight" : ""}" href="#${esc(it.n.id)}" title="${esc(it.n.name)}, ${years(it.n.period)}"><span>${esc(it.n.name)}</span></a>`);
            a.style.left = `${pct(it.a)}%`;
            a.style.width = `${Math.max(pct(it.b) - pct(it.a), 0.8)}%`;
            lane.append(a);
          }
          bandsEl.append(lane);
        }
      }
      const pins = dated.filter((n) => !["era", "style"].includes(n.type))
        .map((n) => ({ n, a: n.period.from, b: n.period.from, labelW: n.name.length * 7.4 + 22 }));
      const laid = lanesFor(pins, width);
      const count = Math.max(0, ...laid.map((i) => i.lane + 1));
      for (let l = 0; l < count; l++) {
        const lane = h(`<div class="lane"></div>`);
        for (const it of laid.filter((i) => i.lane === l)) {
          const a = h(`<a class="pin" href="#${esc(it.n.id)}" title="${esc(typeOne(it.n.type))}, ${years(it.n.period, true)}">${esc(it.n.name)}</a>`);
          a.style.left = `${pct(it.a)}%`;
          lane.append(a);
        }
        pinsEl.append(lane);
      }
    };
    requestAnimationFrame(place);
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(place, 150); });
    return wrap;
  }

  function miniTape(p) {
    if (!p || p.from == null) return "";
    const from = SITE.timeline?.from ?? 1790, to = SITE.timeline?.to ?? THIS_YEAR + 4;
    const pct = (y) => ((Math.max(from, Math.min(to, y)) - from) / (to - from)) * 100;
    const marks = [];
    for (let y = Math.ceil(from / 50) * 50; y <= to; y += 50) marks.push(`<span class="num" style="left:${pct(y)}%">${y}</span>`);
    const end = p.to ?? THIS_YEAR;
    const shape = end > p.from
      ? `<span class="span" style="left:${pct(p.from)}%;width:${pct(end) - pct(p.from)}%"></span>`
      : `<span class="dot" style="left:${pct(p.from)}%"></span>`;
    return `<div class="tape-mini" aria-label="${years(p, true)}">${shape}${p.to == null && end > p.from ? `<span class="dot" style="left:${pct(p.from)}%"></span>` : ""}${marks.join("")}</div>`;
  }

  // ---------- pages ----------
  function masthead() {
    return `<header class="masthead"><a class="wordmark" href="#">${esc(SITE.title)}</a><span class="masthead-meta">${nodes.size} entries, ${wanted.size} being researched</span></header>`;
  }
  function footer() {
    return `<footer class="foot"><span class="mark">Updated ${esc(DATA.built)}. Every entry lists its sources.</span><span class="mark">New entries are researched and added every night.</span></footer>`;
  }

  function renderHome() {
    document.title = SITE.title;
    const featured = nodes.get(SITE.featured);
    app.innerHTML = `${masthead()}
      <section class="hero">
        <div class="hero-plate"></div>
        <div class="hero-text">
          <h1>${esc(SITE.title)}</h1>
          <p class="lede">${esc(SITE.tagline)}</p>
          <p class="intro">${esc(SITE.intro)}</p>
          <ol class="legend" aria-label="Details on this plate"></ol>
        </div>
      </section>
      <section class="block" aria-labelledby="h-time">
        <div class="block-head"><h2 id="h-time">Through time</h2><p>Eras and styles sit above the tape; garments, details, makers and people are pinned below it at the year they appear.</p></div>
        <div class="time"></div>
      </section>
      <section class="block" aria-labelledby="h-index">
        <div class="block-head"><h2 id="h-index">Everything in the atlas</h2><p class="mark">${nodes.size} entries</p></div>
        <div class="finder"><label for="find">Find</label><input id="find" type="search" placeholder="Collar, Brooks, 1950s" autocomplete="off"></div>
        <div class="index"></div>
      </section>
      <section class="block" aria-labelledby="h-queue">
        <div class="block-head"><h2 id="h-queue">Being researched</h2><p>Linked from existing entries but not written yet. Each night's run starts with the most-linked.</p></div>
        <ul class="queue">${DATA.wanted.map((w) => `<li><a href="#${esc(w.id)}" class="xref is-wanted">${esc(w.label)}</a> <span class="count">${w.linkedFrom.length > 1 ? `${w.linkedFrom.length} links` : "1 link"}</span></li>`).join("")}</ul>
      </section>
      ${footer()}`;

    if (featured) {
      const plate = buildPlate(featured, {});
      app.querySelector(".hero-plate").append(plate);
      const legend = app.querySelector(".legend");
      plate.api.onView((v) => {
        legend.innerHTML = "";
        v.hotspots.forEach((s, j) => {
          const li = h(`<li><button type="button"><span class="n">${j + 1}</span><span class="t">${esc(s.label)}</span>${nodes.has(s.target) ? "" : `<span class="mark wanted-tag">not written yet</span>`}</button></li>`);
          li.querySelector("button").addEventListener("click", (e) => { e.stopPropagation(); plate.api.open(j); });
          legend.append(li);
        });
      });
      plate.api.show(0);
      const heroTitle = app.querySelector(".plate-title");
      plate.api.onView((v) => { heroTitle.innerHTML = `${esc(v.label)} of the <a href="#${esc(featured.id)}">${esc(featured.name.toLowerCase())}</a>`; });
      heroTitle.innerHTML = `${esc(featured.views[0].label)} of the <a href="#${esc(featured.id)}">${esc(featured.name.toLowerCase())}</a>`;
    }

    app.querySelector(".time").append(buildTape());
    const index = app.querySelector(".index");
    const drawIndex = (q) => {
      const needle = q.trim().toLowerCase();
      const match = (n) => !needle || [n.name, ...(n.aka || []), n.summary, years(n.period)].join(" ").toLowerCase().includes(needle);
      index.innerHTML = ORDER.map((t) => {
        const list = [...nodes.values()].filter((n) => n.type === t && match(n))
          .sort((a, b) => (a.period?.from ?? 9999) - (b.period?.from ?? 9999) || a.name.localeCompare(b.name));
        if (!list.length) return needle ? "" : `<div><h3>${esc(TYPES[t].many)}</h3><p class="empty">None yet.</p></div>`;
        return `<div><h3>${esc(TYPES[t].many)}</h3><ul>${list.map((n) => `<li><a href="#${esc(n.id)}">${esc(n.name)}</a><span class="years">${years(n.period)}</span></li>`).join("")}</ul></div>`;
      }).join("") || `<p class="empty">Nothing matches “${esc(q)}”. Try a garment, a maker or a decade.</p>`;
    };
    drawIndex("");
    app.querySelector("#find").addEventListener("input", (e) => drawIndex(e.target.value));
  }

  function connections(node) {
    const ids = [...new Set([...node.links, ...node.backlinks])];
    const groups = new Map();
    for (const id of ids) {
      const t = nodes.get(id)?.type ?? "_wanted";
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t).push(id);
    }
    const order = [...ORDER, "_wanted"].filter((t) => groups.has(t));
    if (!order.length) return "";
    const rows = order.flatMap((t) => groups.get(t).map((id) =>
      `<li><span class="mark">${t === "_wanted" ? "Not written" : esc(typeOne(t))}</span>${entryLink(id)}</li>`));
    return `<div class="links"><h2>Connected entries</h2><ul>${rows.join("")}</ul></div>`;
  }
  function sources(node) {
    return `<div class="sources"><h2>Sources</h2><ol>${node.sources.map((s) => {
      const title = s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title);
      const pub = [s.publisher, s.citation].filter(Boolean).join(", ");
      return `<li>${title}${pub ? ` <span class="pub">${esc(pub)}</span>` : ""}</li>`;
    }).join("")}</ol><p class="mark added">Added ${esc(node.added)}</p></div>`;
  }

  function renderEntry(node) {
    document.title = `${node.name} | ${SITE.title}`;
    const hasPlate = node.views.length > 0;
    const meta = [typeOne(node.type), years(node.period, true)].filter(Boolean).join(", ");
    const text = `
      <p class="mark">${esc(meta)}</p>
      <h1>${esc(node.name)}</h1>
      ${node.aka.length ? `<p class="aka">Also called ${esc(node.aka.join(", "))}</p>` : ""}
      <p class="summary">${esc(node.summary)}</p>
      ${miniTape(node.period)}
      <div class="prose">${node.html}</div>`;
    app.innerHTML = `${masthead()}
      <nav class="crumbs mark" aria-label="Breadcrumb"><a href="#">${esc(SITE.title)}</a> / ${esc(TYPES[node.type]?.many ?? node.type)}</nav>
      <article class="entry${hasPlate ? "" : " no-plate"}">
        ${hasPlate ? `<div class="entry-plate"></div><div class="entry-text">${text}<div class="side" style="margin-top:2.5rem">${connections(node)}${sources(node)}</div></div>`
                   : `<div class="entry-text">${text}</div><aside class="side">${connections(node)}${sources(node)}</aside>`}
      </article>
      ${footer()}`;
    if (hasPlate) {
      const plate = buildPlate(node);
      app.querySelector(".entry-plate").append(plate);
      plate.api.show(0);
    }
  }

  function renderWanted(w) {
    document.title = `${w.label} | ${SITE.title}`;
    app.innerHTML = `${masthead()}
      <nav class="crumbs mark" aria-label="Breadcrumb"><a href="#">${esc(SITE.title)}</a> / Being researched</nav>
      <article class="entry no-plate wanted-page">
        <div class="entry-text">
          <p class="mark">Not written yet</p>
          <h1>${esc(w.label)}</h1>
          <p class="summary">This entry is on the research list. Other entries already link to it, and the nightly run picks the most-linked topics first.</p>
          ${w.notes.length ? `<ul class="notes">${w.notes.map((n) => `<li>${esc(n.note)} <span class="mark">On the plate of ${entryLink(n.from)}</span></li>`).join("")}</ul>` : ""}
        </div>
        <aside class="side"><div class="links"><h2>Mentioned in</h2><ul>${w.linkedFrom.map((id) => `<li><span class="mark">${esc(typeOne(nodes.get(id)?.type))}</span>${entryLink(id)}</li>`).join("")}</ul></div></aside>
      </article>
      ${footer()}`;
  }

  function renderMissing(id) {
    document.title = SITE.title;
    app.innerHTML = `${masthead()}<article class="entry no-plate"><div class="entry-text"><p class="mark">No entry</p><h1>Nothing called “${esc(id)}” yet</h1><p class="summary">The link may be old, or the entry may have been renamed. <a href="#">Go to the start of the atlas</a> or use Find there.</p></div></article>${footer()}`;
  }

  // ---------- routing ----------
  let last = null;
  function route() {
    const id = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    if (id === last) return;
    last = id;
    if (!id) renderHome();
    else if (nodes.has(id)) renderEntry(nodes.get(id));
    else if (wanted.has(id)) renderWanted(wanted.get(id));
    else renderMissing(id);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
