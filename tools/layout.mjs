// Lays the atlas out as a web: x is fixed by year where an entry has one, y is found by
// letting related entries pull together and pushing overlapping frames apart.
// Deterministic (no randomness), so the web only moves when the content changes.

export const YEAR_PX = 22;
const PAD_X = 140;
const ENTRY = { w: 112, h: 172 };
const WANTED = { w: 96, h: 64 };

function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000; // 0..1
}

// The year an entry sits at in the web.
export function anchorYear(n) {
  if (Number.isInteger(n.anchor)) return n.anchor;
  if (!n.period || !Number.isInteger(n.period.from)) return null;
  if (n.type === "person") return n.period.from + 25; // when they were active, roughly
  return n.period.from;
}

export function layoutWeb({ nodes, wanted, edges, site }) {
  const start = site.timeline?.from ?? 1770;
  const end = site.timeline?.to ?? 2030;
  const toX = (y) => PAD_X + (y - start) * YEAR_PX;
  const width = toX(end) + PAD_X;

  const items = new Map();
  for (const n of nodes.values()) {
    if (n.type === "era") continue; // eras are drawn as bands behind the web
    const year = anchorYear(n);
    items.set(n.id, { id: n.id, ...ENTRY, x: year != null ? toX(year) : null, fixed: year != null, y: (hash(n.id) - 0.5) * 900 });
  }
  for (const w of wanted) items.set(w.id, { id: w.id, ...WANTED, x: null, fixed: false, wanted: true, y: (hash(w.id) - 0.5) * 900 });

  // neighbours: typed relations count fully, mentions (body links, hotspots) half
  const adj = new Map([...items.keys()].map((id) => [id, []]));
  const pairs = [];
  const addPair = (a, b, w) => {
    if (!items.has(a) || !items.has(b) || a === b) return;
    adj.get(a).push(b); adj.get(b).push(a);
    pairs.push([a, b, w]);
  };
  for (const e of edges) addPair(e.from, e.to, 1);
  for (const n of nodes.values()) for (const id of n._mentions ?? []) addPair(n.id, id, 0.5);

  // place undated entries at the average x of what they connect to
  const mid = toX(Math.round((start + end) / 2));
  for (let round = 0; round < 40; round++) {
    for (const it of items.values()) {
      if (it.fixed) continue;
      const xs = adj.get(it.id).map((id) => items.get(id).x).filter((x) => x != null);
      if (xs.length) it.x = xs.reduce((a, b) => a + b, 0) / xs.length + (hash(it.id + "x") - 0.5) * 60;
    }
  }
  for (const it of items.values()) if (it.x == null) it.x = mid;

  // relax
  const list = [...items.values()];
  for (let step = 0; step < 500; step++) {
    const cool = 1 - step / 600;
    for (const [a, b, w] of pairs) {
      const A = items.get(a), B = items.get(b);
      const dy = (B.y - A.y) * 0.02 * w * cool;
      A.y += dy; B.y -= dy;
      if (!A.fixed) A.x += (B.x - A.x) * 0.004 * w;
      if (!B.fixed) B.x += (A.x - B.x) * 0.004 * w;
    }
    list.sort((p, q) => p.x - q.x);
    for (let i = 0; i < list.length; i++) {
      const A = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const B = list[j];
        const minX = (A.w + B.w) / 2 + 26;
        if (B.x - A.x >= minX) break;
        const minY = (A.h + B.h) / 2 + 22;
        const dy = B.y - A.y;
        if (Math.abs(dy) < minY) {
          const overY = minY - Math.abs(dy);
          const overX = minX - (B.x - A.x);
          const free = !A.fixed || !B.fixed;
          // entries without a year may also step sideways, so clusters spread out instead of stacking
          if (free && overX < overY) {
            const push = overX / 2 + 0.5;
            if (!A.fixed && !B.fixed) { A.x -= push; B.x += push; }
            else if (!A.fixed) A.x -= push * 2;
            else B.x += push * 2;
          } else {
            const push = overY / 2 + 0.5;
            const dir = dy === 0 ? (hash(A.id + B.id) > 0.5 ? 1 : -1) : Math.sign(dy);
            A.y -= push * dir; B.y += push * dir;
          }
        }
      }
    }
    for (const it of list) it.y *= 0.997;
  }

  // shift so the top is at a margin
  const top = Math.min(...list.map((it) => it.y - it.h / 2));
  const bottom = Math.max(...list.map((it) => it.y + it.h / 2));
  const MARGIN = 90; // room under the ruler
  const pos = {};
  for (const it of list) pos[it.id] = [Math.round(it.x), Math.round(it.y - top + MARGIN)];
  const eras = [...nodes.values()].filter((n) => n.type === "era" && n.period)
    .sort((a, b) => a.period.from - b.period.from)
    .map((n) => ({ id: n.id, name: n.name, x0: toX(n.period.from), x1: toX(n.period.to ?? end) }));

  return { pos, width: Math.round(width), height: Math.round(bottom - top + MARGIN * 2), start, end, yearPx: YEAR_PX, padX: PAD_X, eras, sizes: { entry: ENTRY, wanted: WANTED } };
}
