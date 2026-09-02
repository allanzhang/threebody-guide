// 知识图谱数据派生：从 6 套 JSON 建节点/边 + 骨架分层（纯函数，服务端与测试共用）
import { books as dbBooks, eras as dbEras, events as dbEvents, concepts as dbConcepts, characters as dbCharacters, scenes as dbScenes } from './data.mjs';

const CONCEPT_COLOR = { law: '#d8c48a', tech: '#5b8db8', org: '#3fa39c' };
const CHAR_COLOR = { origin: '#d8c48a', face: '#5b8db8', eto: '#8a6a92', support: '#56616e' };
const BOOK_COLOR = '#b8a877';

/** 内部节点 id：`${type}:${rawId}`——内容跨类型存在同名 id（dark-forest 兼书与概念等 6 组），必须命名空间隔离 */
export const nodeKey = (type, rawId) => `${type}:${rawId}`;

export function buildGraph(data = null) {
  const books = data ? data.books : dbBooks;
  const eras = data ? data.eras : dbEras;
  const events = data ? data.events : dbEvents;
  const concepts = data ? data.concepts : dbConcepts;
  const characters = data ? data.characters : dbCharacters;
  const scenes = data ? data.scenes : dbScenes;

  const eraColor = new Map(eras.map((e) => [e.id, e.color]));
  const bookOrder = new Map(books.map((b) => [b.id, b.order]));

  // 概念 → 卷归属：内容里 inBook 是散文描述而非书 id，改为用它引用事件的 bookId 众数推导（并列取 order 更早的卷；无引用 → null）
  const list = (x) => x || [];
  const eventBook = new Map(events.map((e) => [e.id, e.bookId]));
  const bookRefFor = (c) => {
    const counts = new Map();
    for (const eid of list(c.events)) {
      const bk = eventBook.get(eid);
      if (bk) counts.set(bk, (counts.get(bk) || 0) + 1);
    }
    if (counts.size === 0) return null;
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || (bookOrder.get(a[0]) ?? 9) - (bookOrder.get(b[0]) ?? 9))[0][0];
  };
  const conceptBook = new Map(concepts.map((c) => [c.id, bookRefFor(c)]));

  const nodes = [];
  const nodeById = new Map();
  const add = (n) => { nodes.push(n); nodeById.set(n.id, n); return n; };

  for (const b of books) add({ id: nodeKey('book', b.id), type: 'book', label: b.title, color: BOOK_COLOR, ref: b.id, bookId: b.id });
  for (const e of eras) add({ id: nodeKey('era', e.id), type: 'era', label: e.name, color: e.color, ref: e.id, eraId: e.id });
  for (const ev of events) add({ id: nodeKey('event', ev.id), type: 'event', label: ev.title, color: eraColor.get(ev.eraId), ref: ev.id, eraId: ev.eraId, bookId: ev.bookId, isMajorEvent: Boolean(ev.isMajorEvent) });
  for (const c of concepts) add({ id: nodeKey('concept', c.id), type: 'concept', label: c.name, color: CONCEPT_COLOR[c.group] || '#9aa0a8', ref: c.id, group: c.group, bookRef: conceptBook.get(c.id) });
  for (const ch of characters) add({ id: nodeKey('character', ch.id), type: 'character', label: ch.name, color: CHAR_COLOR[ch.group] || '#9aa0a8', ref: ch.id, group: ch.group, isCore: Boolean(ch.isCore) });
  for (const s of scenes) add({ id: nodeKey('scene', s.id), type: 'scene', label: s.title, color: eraColor.get(s.eraId), ref: s.id, eraId: s.eraId, bookId: s.bookId });

  const edges = [];
  const seen = new Set();
  const push = (a, b, kind) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source: a, target: b, kind });
  };
  // pushDir 用有向 key 去重（related 由 validate 保证对称：声明方直推两个方向，反向重复自动去重 → 每对恰好两条有向边）
  const dirSeen = new Set();
  const pushDir = (a, b, kind) => {
    if (a === b) return;
    const key = `${a}|${b}|${kind}`;
    if (dirSeen.has(key)) return;
    dirSeen.add(key);
    edges.push({ source: a, target: b, kind });
  };
  for (const ev of events) {
    push(nodeKey('event', ev.id), nodeKey('book', ev.bookId), 'event-book');
    push(nodeKey('event', ev.id), nodeKey('era', ev.eraId), 'event-era');
    for (const cid of list(ev.characters)) push(nodeKey('event', ev.id), nodeKey('character', cid), 'event-char');
    for (const cid of list(ev.concepts)) push(nodeKey('event', ev.id), nodeKey('concept', cid), 'event-concept');
  }
  for (const c of concepts) {
    const bk = conceptBook.get(c.id);
    if (bk) push(nodeKey('concept', c.id), nodeKey('book', bk), 'concept-book');
    for (const cid of list(c.characters)) push(nodeKey('concept', c.id), nodeKey('character', cid), 'concept-char');
    for (const rid of list(c.related)) { pushDir(nodeKey('concept', c.id), nodeKey('concept', rid), 'concept-related'); pushDir(nodeKey('concept', rid), nodeKey('concept', c.id), 'concept-related'); }
  }
  for (const s of scenes) {
    for (const eid of list(s.eventIds)) push(nodeKey('scene', s.id), nodeKey('event', eid), 'scene-event');
    for (const cid of list(s.conceptIds)) push(nodeKey('scene', s.id), nodeKey('concept', cid), 'scene-concept');
    for (const cid of list(s.characterIds)) push(nodeKey('scene', s.id), nodeKey('character', cid), 'scene-char');
  }

  const degree = new Map();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }
  for (const n of nodes) n.degree = degree.get(n.id) || 0;

  return { nodes, edges, nodeById, books, eras, events, concepts, characters, scenes };
}

export function topConceptIds(graph, k = 10) {
  const cons = graph.nodes.filter((n) => n.type === 'concept').sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id));
  if (cons.length === 0) return new Set();
  const threshold = cons[Math.min(k, cons.length) - 1].degree;
  return new Set(cons.filter((n) => n.degree >= threshold).map((n) => n.id));
}

export function skeletonIds(graph) {
  const top = topConceptIds(graph);
  const ids = new Set();
  for (const n of graph.nodes) {
    if (n.type === 'book' || n.type === 'era') ids.add(n.id);
    else if (n.type === 'character' && n.isCore) ids.add(n.id);
    else if (n.type === 'event' && n.isMajorEvent) ids.add(n.id);
    else if (n.type === 'concept' && top.has(n.id)) ids.add(n.id);
  }
  return ids;
}

export const LAYOUT = { PAD: 90, COL_W: 260, ROW_H: 56, RAIL_GAP: 130, RAIL_OFF: 70, ANCHOR_R: 14, NODE_R: 9 };

export function layout(graph) {
  const { PAD, COL_W, ROW_H, RAIL_GAP, RAIL_OFF } = LAYOUT;
  const erasSorted = [...graph.eras].sort((a, b) => a.order - b.order);
  const eraOrder = new Map(erasSorted.map((e, i) => [e.id, i]));
  const eraX = (id) => PAD + eraOrder.get(id) * COL_W;
  const railX = (bId) => PAD + 5 * COL_W + RAIL_OFF + (Math.max(0, (graph.books.find((b) => b.id === bId)?.order || 1) - 1)) * RAIL_GAP;

  const pos = new Map();
  const eraCount = new Map();
  for (const ev of [...graph.events].sort((a, b) => a.order - b.order)) {
    const k = eraCount.get(ev.eraId) || 0;
    pos.set(nodeKey('event', ev.id), { x: eraX(ev.eraId), y: PAD + k * ROW_H });
    eraCount.set(ev.eraId, k + 1);
  }
  const bookCount = new Map();
  const looseConcepts = [];
  for (const c of [...graph.concepts].sort((a, b) => a.id.localeCompare(b.id))) {
    // 卷归属用 buildGraph 派生的 bookRef（inBook 是散文，不可用）
    const bk = graph.nodeById.get(nodeKey('concept', c.id)).bookRef;
    if (!bk) { looseConcepts.push(c); continue; }
    const k = bookCount.get(bk) || 0;
    pos.set(nodeKey('concept', c.id), { x: railX(bk), y: PAD + k * ROW_H });
    bookCount.set(bk, k + 1);
  }

  const maxRows = Math.max(1, ...[...eraCount.values(), ...bookCount.values()]);
  const W = PAD * 2 + 5 * COL_W + RAIL_OFF + 3 * RAIL_GAP;
  const H = PAD * 2 + maxRows * ROW_H;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const neighbors = (id) => graph.edges.filter((e) => e.source === id || e.target === id)
    .map((e) => (e.source === id ? e.target : e.source));

  // 无卷归属概念（无事件引用）→ 底部松散区横排
  for (let i = 0; i < looseConcepts.length; i++) {
    pos.set(nodeKey('concept', looseConcepts[i].id), { x: PAD + (i % 5) * 130, y: H - 46 - Math.floor(i / 5) * 44 });
  }
  for (const ch of graph.characters) {
    const pts = neighbors(nodeKey('character', ch.id)).map((i) => pos.get(i)).filter(Boolean);
    const base = pts.length
      ? { x: avg(pts.map((p) => p.x)), y: avg(pts.map((p) => p.y)) }
      : { x: W / 2, y: H - 46 };
    pos.set(nodeKey('character', ch.id), { x: clamp(base.x, PAD, W - PAD), y: clamp(base.y, PAD, H - PAD) });
  }
  for (const s of graph.scenes) {
    const base = pos.get(nodeKey('event', s.eventIds?.[0])) || { x: W / 2, y: H / 2 };
    pos.set(nodeKey('scene', s.id), { x: clamp(base.x + 44, PAD, W - PAD), y: clamp(base.y - 44, PAD, H - PAD) });
  }
  for (const e of erasSorted) pos.set(nodeKey('era', e.id), { x: eraX(e.id), y: PAD - 42 });
  for (const b of graph.books) {
    const k = Math.max(0, (b.order || 1) - 1);
    pos.set(nodeKey('book', b.id), { x: railX(b.id), y: PAD - 42 });
    if (k > 0) pos.get(nodeKey('book', b.id)).x += (k % 2 ? 1 : -1) * 14; // 三本轨道同名轴微错位，避免标签叠压
  }
  return { pos, W, H };
}