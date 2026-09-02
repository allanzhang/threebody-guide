import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, topConceptIds, skeletonIds, layout, LAYOUT, nodeKey } from '../src/lib/knowledge-graph.mjs';

// 合成数据：3 概念 a(度数5) b(3) c(3)，k=2 时阈值=第2名度数3 → a,b,c 全取
const synthetic = () => ({
  books: [{ id: 'b1', title: 'B1', order: 1, subtitle: '', intro: '', cover: '' }],
  eras: [{ id: 'e1', name: 'E1', order: 1, startYear: 1, years: '', heroTitle: '', color: '#fff', colorSoft: '#000', intro: '', hero: '' }],
  events: [
    { id: 'ev1', title: 'EV1', bookId: 'b1', eraId: 'e1', yearLabel: '1', order: 1, isMajorEvent: true, summary: 'S', characters: ['ch1'], concepts: ['a', 'b', 'c'] },
    { id: 'ev2', title: 'EV2', bookId: 'b1', eraId: 'e1', yearLabel: '2', order: 2, isMajorEvent: false, summary: 'S', characters: [], concepts: ['a'] },
    { id: 'ev3', title: 'EV3', bookId: 'b1', eraId: 'e1', yearLabel: '3', order: 3, isMajorEvent: false, summary: 'S', characters: [], concepts: ['a', 'b', 'c'] },
  ],
  concepts: [
    { id: 'a', name: 'A', tagline: '', group: 'law', inBook: 'b1', science: '', events: ['ev1', 'ev2', 'ev3'], characters: [], related: [] },
    { id: 'b', name: 'B', tagline: '', group: 'tech', inBook: 'b1', science: '', events: ['ev1', 'ev3'], characters: [], related: [] },
    { id: 'c', name: 'C', tagline: '', group: 'org', inBook: 'b1', science: '', events: ['ev1', 'ev3'], characters: [], related: [] },
  ],
  characters: [{ id: 'ch1', name: 'CH1', tagline: '', group: 'origin', isCore: true, who: '', role: '', storyline: '', events: ['ev1'], concepts: [], portrait: '' }],
  scenes: [{ id: 'sc1', title: 'SC1', tagline: '', bookId: 'b1', eraId: 'e1', eventIds: ['ev1'], conceptIds: [], characterIds: ['ch1'], sceneType: 'droplet', moment: '', shock: '', science: '', echo: '' }],
});

test('派生完整性：边两端节点都存在（真实数据）', () => {
  const g = buildGraph();
  for (const e of g.edges) {
    assert.ok(g.nodeById.get(e.source), `边缺 source 节点 ${e.source}`);
    assert.ok(g.nodeById.get(e.target), `边缺 target 节点 ${e.target}`);
  }
});

test('边无重复、related 保留双向', () => {
  const g = buildGraph();
  const seen = new Set();
  for (const e of g.edges) {
    const key = `${e.source}|${e.target}|${e.kind}`;
    assert.ok(!seen.has(key), `重复边 ${key}`);
    seen.add(key);
  }
  const rel = g.edges.filter((e) => e.kind === 'concept-related');
  for (const e of rel) {
    assert.ok(g.edges.some((x) => x.source === e.target && x.target === e.source && x.kind === 'concept-related'), `related 缺反向 ${e.source}↔${e.target}`);
  }
});

test('骨架层规则与包含关系', () => {
  const g = buildGraph();
  const sk = skeletonIds(g);
  const top = topConceptIds(g);
  for (const n of g.nodes) {
    if (n.type === 'book' || n.type === 'era') assert.ok(sk.has(n.id), `${n.id} 应常驻骨架`);
    if (n.type === 'character' && n.isCore) assert.ok(sk.has(n.id), `核心人物 ${n.id} 应在骨架`);
    if (n.type === 'event' && n.isMajorEvent) assert.ok(sk.has(n.id), `大事件 ${n.id} 应在骨架`);
    if (n.type === 'scene') assert.ok(!sk.has(n.id), `场景 ${n.id} 不应在骨架`);
  }
  for (const id of top) assert.ok(sk.has(id), `top 概念 ${id} 应在骨架`);
  assert.ok(sk.size < g.nodes.length, '骨架应严格小于全量');
});

test('topConceptIds 按度数降序且并列全取', () => {
  const g = buildGraph(synthetic());
  const top = topConceptIds(g, 2);
  assert.deepEqual([...top].sort(), ['concept:a', 'concept:b', 'concept:c']); // 度数 a=4, b=3, c=3（各含 1 条 concept-book）→ 阈值=第2名度数3，并列全取
});

test('节点 id 全局唯一（跨类型同名隔离）', () => {
  const g = buildGraph();
  assert.equal(new Set(g.nodes.map((n) => n.id)).size, g.nodes.length);
  assert.ok(g.nodeById.has('event:three-body-game'));
  assert.ok(g.nodeById.has('concept:three-body-game'));
  assert.ok(g.nodeById.has('book:dark-forest'));
  assert.ok(g.nodeById.has('concept:dark-forest'));
});

test('最小数据不崩', () => {
  const g = buildGraph({ books: [], eras: [], events: [], concepts: [], characters: [], scenes: [] });
  assert.equal(g.nodes.length, 0);
  assert.equal(skeletonIds(g).size, 0);
});

test('布局：事件 x 对齐所属纪元列；列内 y 不重叠', () => {
  const g = buildGraph();
  const { pos } = layout(g);
  const eraX = new Map(g.eras.map((e) => [e.id, pos.get(nodeKey('era', e.id)).x]));
  for (const ev of g.events) assert.equal(pos.get(nodeKey('event', ev.id)).x, eraX.get(ev.eraId), `${ev.id} 列位错误`);
  const cols = new Map();
  for (const ev of g.events) {
    const ys = cols.get(ev.eraId) || [];
    ys.push(pos.get(nodeKey('event', ev.id)).y);
    cols.set(ev.eraId, ys);
  }
  for (const [era, ys] of cols) assert.equal(new Set(ys).size, ys.length, `${era} 列事件 y 重叠`);
});

test('布局：概念按派生的 bookRef 收敛轨道', () => {
  const g = buildGraph();
  const { pos } = layout(g);
  const byBook = new Map();
  for (const c of g.concepts) {
    const bk = g.nodeById.get(nodeKey('concept', c.id)).bookRef;
    if (!bk) continue; // 无事件引用的概念落入松散区（真实数据当前无此情况）
    const l = byBook.get(bk) || [];
    l.push(nodeKey('concept', c.id));
    byBook.set(bk, l);
  }
  assert.ok(byBook.size >= 1, '至少一卷有概念挂靠');
  for (const [book, ids] of byBook) {
    assert.equal(new Set(ids.map((i) => pos.get(i).x)).size, 1, `${book} 概念应收敛一列`);
  }
});

test('布局：所有坐标在画布内且有限（含最小数据）', () => {
  const g = buildGraph();
  const { pos, W, H } = layout(g);
  for (const n of g.nodes) {
    const p = pos.get(n.id);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${n.id} 坐标非法`);
    assert.ok(p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H, `${n.id} 越界 (${p.x}, ${p.y})`);
  }
  const empty = buildGraph({ books: [], eras: [], events: [], concepts: [], characters: [], scenes: [] });
  const r = layout(empty);
  assert.equal(r.pos.size, 0);
  assert.ok(r.W > 0 && r.H > 0);
});