(() => {
  "use strict";
  const DATA = JSON.parse(document.getElementById("atlas-data").textContent);
  const nodes = new Map(DATA.nodes.map((n) => [n.id, n]));
  const wanted = new Map(DATA.wanted.map((w) => [w.id, w]));
  const TYPES = DATA.types;
  const REL = DATA.relations;
  const SITE = DATA.site;
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
    return `<footer class="foot"><div class="wrap"><span>Updated ${esc(DATA.built)}. Every entry lists its sources; pictures are original drawings or public-domain prints.</span><span>New entries are researched and added every night. <a href="#run-log">Run log</a></span></div></footer>`;
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
    app.innerHTML = '<div class="tw-root"></div>';
    window.mountWeb(app.firstElementChild, DATA, { signal: pageAbort.signal, focusId });
  }

  function renderCatalogue() {
    document.title = `Catalogue · ${SITE.title}`;
    app.innerHTML = `${masthead(false)}
      <main>
        <div class="wrap intro"><div><h1>Catalogue</h1><p>${esc(SITE.intro)}</p></div><p class="how"><a href="#">Back to the web</a></p></div>
        <div class="wrap">
          <section class="block" aria-labelledby="h-index">
            <div class="block-head"><h2 id="h-index">Every entry, by kind</h2></div>
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

  // ---------- run log: what each agent did on each run ----------
  const ROLE_NAMES = { curator: "Curator", researcher: "Researcher", writer: "Writer", weaver: "Weaver", illustrator: "Illustrator", "fact-checker": "Fact-checker", "visual-reviewer": "Visual reviewer", tester: "Tester", gardener: "Gardener" };
  const pill = (st) => `<span class="pill pill-${esc(st)}">${esc(st)}</span>`;
  const nums = (o) => o ? Object.entries(o).map(([k, v]) => `<span class="num"><span class="soft">${esc(k.replace(/([A-Z])/g, " $1").toLowerCase())}</span> ${esc(String(v))}</span>`).join("") : "";
  // one dot per run for each role: the worst status that role had in that run
  function roleHealth(runs) {
    const rank = { failed: 3, partial: 2, ok: 1, skipped: 0 };
    const roles = Object.keys(ROLE_NAMES).filter((r) => runs.some((run) => run.agents.some((a) => a.role === r)));
    return roles.map((role) => {
      const recent = runs.slice(0, 12).map((run) => {
        const mine = run.agents.filter((a) => a.role === role);
        if (!mine.length) return null;
        return mine.reduce((w, a) => (rank[a.status] > rank[w] ? a.status : w), "skipped");
      }).reverse();
      const last = runs.find((run) => run.agents.some((a) => a.role === role));
      const lastAgents = last.agents.filter((a) => a.role === role);
      const problems = runs.slice(0, 6).flatMap((run) => run.agents.filter((a) => a.role === role).flatMap((a) => a.problems ?? []));
      return { role, recent, model: lastAgents[0]?.model ?? "", problems };
    });
  }
  function renderRuns() {
    document.title = `Run log | ${SITE.title}`;
    const runs = DATA.runs ?? [];
    const health = roleHealth(runs);
    const healthHTML = health.length ? `<section class="block" aria-labelledby="h-health"><div class="block-head"><h2 id="h-health">How each agent is doing</h2><p>One mark per run, oldest on the left. Recurring problems from the last six runs are listed beside it.</p></div>
      <div class="table-wrap"><table class="runtable"><thead><tr><th>Agent</th><th>Model</th><th>Recent runs</th><th>Recurring problems</th></tr></thead><tbody>
      ${health.map((h) => `<tr><td>${esc(ROLE_NAMES[h.role])}</td><td class="soft">${esc(h.model)}</td><td><span class="dots">${h.recent.map((st) => st ? `<span class="dot dot-${st}" title="${st}"></span>` : `<span class="dot dot-none" title="did not run"></span>`).join("")}</span></td><td>${h.problems.length ? `<ul class="probs">${[...new Set(h.problems)].slice(0, 4).map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : '<span class="soft">none</span>'}</td></tr>`).join("")}
      </tbody></table></div></section>` : "";
    const runHTML = runs.map((r) => {
      const t = r.totals ?? {};
      const delta = t.before && t.after ? ["entries", "relations", "wanted"].map((k) => `<span class="num"><span class="soft">${k === "wanted" ? "queued" : k}</span> ${t.before[k] ?? "?"} \u2192 ${t.after[k] ?? "?"}</span>`).join("") : "";
      const topics = (r.topics ?? []).map((tp) => `<li>${nodes.has(tp.id) ? `<a href="#${esc(tp.id)}">${esc(nameOf(tp.id))}</a>` : esc(tp.id)} <span class="pill pill-${tp.outcome === "dropped" ? "failed" : tp.outcome === "folded" ? "partial" : "ok"}">${esc(tp.outcome)}</span>${tp.reason ? ` <span class="soft">${esc(tp.reason)}</span>` : ""}</li>`).join("");
      const rows = r.agents.map((a) => `<tr><td>${esc(ROLE_NAMES[a.role] ?? a.role)}${a.topic ? `<div class="soft small">${esc(a.topic)}</div>` : ""}</td><td class="soft">${esc(a.model ?? "")}</td><td>${pill(a.status)}</td><td>${esc(a.summary)}${a.numbers ? `<div class="nums">${nums(a.numbers)}</div>` : ""}${a.problems?.length ? `<ul class="probs">${a.problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}</td></tr>`).join("");
      return `<article class="run"><header class="run-head"><h3>${esc(r.date)} <span class="soft">${esc(r.kind)}${r.started ? `, ${esc(r.started)}\u2013${esc(r.finished ?? "")}` : ""}</span></h3><div class="nums">${delta}${r.commit ? `<span class="num"><span class="soft">commit</span> <a href="https://github.com/rosengaard98/menswear-atlas/commit/${esc(r.commit)}" target="_blank" rel="noopener">${esc(r.commit.slice(0, 7))}</a></span>` : ""}</div></header>
        ${topics ? `<ul class="topics">${topics}</ul>` : ""}
        <div class="table-wrap"><table class="runtable"><thead><tr><th>Agent</th><th>Model</th><th>Status</th><th>What it did</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${r.notes?.length ? `<ul class="probs">${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}</article>`;
    }).join("");
    app.innerHTML = `${masthead(false)}
      <main class="wrap runlog">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="#">The web</a> / Run log</nav>
        <h1>Run log</h1>
        <p class="summary">What the agents did on each nightly and weekly run: what they found, what they changed, and what went wrong.</p>
        ${runs.length ? healthHTML + `<section class="block" aria-labelledby="h-runs"><div class="block-head"><h2 id="h-runs">Runs</h2><p>${runs.length} so far, newest first.</p></div>${runHTML}</section>`
          : `<p class="empty-state">No runs logged yet. The first nightly run writes its log here.</p>`}
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
    else if (raw === "run-log") renderRuns();
    else if (raw === "catalogue") renderCatalogue();
    else if (raw.startsWith("~")) renderHome(raw.slice(1));
    else if (nodes.has(raw)) renderEntry(nodes.get(raw));
    else if (wanted.has(raw)) renderWanted(wanted.get(raw));
    else renderMissing(raw);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
