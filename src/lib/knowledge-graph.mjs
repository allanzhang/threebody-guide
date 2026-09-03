// 知识图谱数据派生：从 5 套 JSON 建节点/边 + 骨架分层（纯函数，服务端与测试共用）
import { books as dbBooks, eras as dbEras, events as dbEvents, concepts as dbConcepts, characters as dbCharacters } from './data.mjs';

const CONCEPT_COLOR = { law: '#d8c48a', tech: '#5b8db8', org: '#3fa39c', astro: '#9a7ab8', physics: '#b8836a' };
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

  const degree = new Map();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }
  for (const n of nodes) n.degree = degree.get(n.id) || 0;

  return { nodes, edges, nodeById, books, eras, events, concepts, characters };
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

export const LAYOUT = { PAD: 110, COL_W: 400, ROW_H: 38, COL_OFF: 76, MAX_ROWS: 9, ROW_H_CON: 52, COL_OFF_CON: 100, MAX_ROWS_CON: 8, BOOK_Y: 88, ERA_Y: 192, EVENT_Y: 268, BAND_GAP: 48, LABEL_H: 44 };

// 概念/人物分区顺序与标题（与 buildGraph 的 group 颜色表一致）
const CONCEPT_ORDER = ['law', 'tech', 'org', 'astro', 'physics'];
const CONCEPT_GROUP_TITLE = { law: '法则与理论', tech: '科技与器物', org: '组织与文明', astro: '天文与宇宙', physics: '物理与时空' };
const CHAR_ORDER = ['origin', 'face', 'eto', 'support'];
const CHAR_GROUP_TITLE = { origin: '红岸与源头', face: '面壁与执剑', eto: 'ETO 与三体侧', support: '重要配角' };

/**
 * 分区化布局（方案 A）：
 * 顶部 = 书锚点；中部 = 时间线（5 纪元分区 + 各纪元事件网格）；
 * 下部 = 概念体系（5 group 分区）+ 人物（4 group 分区）。
 * 每个实体「位置维度 = 颜色维度 = 自身分类」：事件按纪元、概念按 group、人物按 group，
 * 组内多列网格 + 垂直居中，消除单列撑高与大片空白。
 * 返回 { pos, r, W, H, zones }，zones 供前端绘制分区背景与分组标题。
 */
export function layout(graph) {
  const { PAD, COL_W, ROW_H, COL_OFF, MAX_ROWS, ROW_H_CON, COL_OFF_CON, MAX_ROWS_CON, BOOK_Y, ERA_Y, EVENT_Y, BAND_GAP, LABEL_H } = LAYOUT;
  const pos = new Map();
  const zones = [];
  const xi = (i) => PAD + COL_W / 2 + i * COL_W;
  const node = (type, id) => nodeKey(type, id);

  /** 网格放置：bandRows 为带内统一行数（跨列），列内垂直居中避免「上满下空」 */
  const placeGrid = (ids, cx, bandTop, bandRows, opt = {}) => {
    const { rowH = ROW_H, colOff = COL_OFF, maxRows = MAX_ROWS } = opt;
    const n = ids.length;
    if (n === 0) return;
    const rows = Math.max(1, Math.min(maxRows, n));
    const cols = Math.ceil(n / rows);
    const top = bandTop + ((bandRows - rows) / 2) * rowH;
    ids.forEach((id, idx) => {
      const col = Math.floor(idx / rows);
      const row = idx % rows;
      pos.set(id, { x: cx + (col - (cols - 1) / 2) * colOff, y: top + row * rowH });
    });
  };
  const bandRowsOf = (counts, maxRows = MAX_ROWS) => Math.max(1, ...[...counts].map((n) => Math.min(maxRows, Math.max(1, n))));

  // ---- 时间线 band：5 纪元分区 + 事件网格 ----
  const erasSorted = [...graph.eras].sort((a, b) => a.order - b.order);
  const eraIdx = new Map(erasSorted.map((e, i) => [e.id, i]));
  const eventsByEra = new Map();
  for (const ev of [...graph.events].sort((a, b) => a.order - b.order)) {
    if (!eventsByEra.has(ev.eraId)) eventsByEra.set(ev.eraId, []);
    eventsByEra.get(ev.eraId).push(ev);
  }
  const eraRows = bandRowsOf(erasSorted.map((e) => (eventsByEra.get(e.id) || []).length));
  for (const e of erasSorted) {
    const list = eventsByEra.get(e.id) || [];
    placeGrid(list.map((ev) => node('event', ev.id)), xi(eraIdx.get(e.id)), EVENT_Y, eraRows);
    pos.set(node('era', e.id), { x: xi(eraIdx.get(e.id)), y: ERA_Y });
  }
  const eventBottom = EVENT_Y + eraRows * ROW_H;
  zones.push({ kind: 'band', x: xi(0) - COL_W / 2, y: EVENT_Y - 12, w: 5 * COL_W, label: '时间线' });

  // ---- 概念体系 band：5 group 分区 ----
  const conByGroup = new Map(CONCEPT_ORDER.map((g) => [g, []]));
  for (const c of graph.concepts) if (conByGroup.has(c.group)) conByGroup.get(c.group).push(c);
  const conTop = eventBottom + BAND_GAP;
  const conCounts = CONCEPT_ORDER.map((g) => conByGroup.get(g).length);
  const conRows = bandRowsOf(conCounts, MAX_ROWS_CON);
  for (let i = 0; i < CONCEPT_ORDER.length; i++) {
    const g = CONCEPT_ORDER[i];
    placeGrid(conByGroup.get(g).sort((a, b) => a.id.localeCompare(b.id)).map((c) => node('concept', c.id)), xi(i), conTop + LABEL_H, conRows, { rowH: ROW_H_CON, colOff: COL_OFF_CON, maxRows: MAX_ROWS_CON });
    zones.push({ kind: 'group', x: xi(i), y: conTop, label: CONCEPT_GROUP_TITLE[g], color: CONCEPT_COLOR[g] });
  }
  const conBottom = conTop + LABEL_H + conRows * ROW_H_CON;
  zones.push({ kind: 'band', x: xi(0) - COL_W / 2, y: conTop - 10, w: 5 * COL_W, label: '概念体系' });

  // ---- 人物 band：4 group 分区（复用前 4 个分区位）----
  const chByGroup = new Map(CHAR_ORDER.map((g) => [g, []]));
  for (const c of graph.characters) if (chByGroup.has(c.group)) chByGroup.get(c.group).push(c);
  const charTop = conBottom + BAND_GAP;
  const charCounts = CHAR_ORDER.map((g) => chByGroup.get(g).length);
  const charRows = bandRowsOf(charCounts);
  for (let i = 0; i < CHAR_ORDER.length; i++) {
    const g = CHAR_ORDER[i];
    placeGrid(chByGroup.get(g).sort((a, b) => a.id.localeCompare(b.id)).map((c) => node('character', c.id)), xi(i), charTop + LABEL_H, charRows);
    zones.push({ kind: 'group', x: xi(i), y: charTop, label: CHAR_GROUP_TITLE[g], color: CHAR_COLOR[g] });
  }
  const charBottom = charTop + LABEL_H + charRows * ROW_H;
  zones.push({ kind: 'band', x: xi(0) - COL_W / 2, y: charTop - 10, w: 5 * COL_W, label: '人物' });

  // ---- 顶部：书锚点（横向贯穿，作为作品维度背景）----
  const W = PAD * 2 + 5 * COL_W;
  const H = charBottom + PAD;
  const nBooks = Math.max(1, graph.books.length);
  const xFirst = xi(0), xLast = xi(Math.max(0, CONCEPT_ORDER.length - 1));
  for (const b of [...graph.books].sort((a, b) => a.order - b.order)) {
    const bx = xFirst + ((b.order - 0.5) / nBooks) * (xLast - xFirst);
    pos.set(node('book', b.id), { x: bx, y: BOOK_Y });
  }
  return { pos, W, H, zones };
}

/** 节点大小（按关联度分级，供前端渲染）：锚点 > 核心事件/人物/高关联概念 > 普通 */
export function nodeSize(graph) {
  const top = topConceptIds(graph);
  const r = new Map();
  for (const n of graph.nodes) {
    let v;
    if (n.type === 'book') v = 22;
    else if (n.type === 'era') v = 15;
    else if (n.type === 'event') v = n.isMajorEvent ? 11 : 7.5;
    else if (n.type === 'concept') v = top.has(n.id) ? 12 : n.degree >= 6 ? 10 : n.degree >= 3 ? 8.5 : 7;
    else if (n.type === 'character') v = n.isCore ? 11 : 8.5;
    else v = 8;
    r.set(n.id, v);
  }
  return r;
}