import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, topConceptIds, skeletonIds, layout, LAYOUT, nodeKey } from '../src/lib/knowledge-graph.mjs';
import { conceptGroups, characterGroups, storyOrderKey } from '../src/lib/data.mjs';

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

test('布局：事件按纪元分区（x 在分区内），同分区坐标不重叠', () => {
  const g = buildGraph();
  const { pos } = layout(g);
  const { PAD, COL_W } = LAYOUT;
  const eraIdx = new Map([...g.eras].sort((a, b) => a.order - b.order).map((e, i) => [e.id, i]));
  const seen = new Map();
  for (const ev of g.events) {
    const p = pos.get(nodeKey('event', ev.id));
    const cx = PAD + COL_W / 2 + eraIdx.get(ev.eraId) * COL_W;
    assert.ok(Math.abs(p.x - cx) < COL_W / 2, `${ev.id} 超出纪元分区`);
    const key = `${ev.eraId}:${p.x}:${p.y}`;
    assert.ok(!seen.has(key), `${ev.id} 与 ${seen.get(key) || ''} 重叠`);
    seen.set(key, ev.id);
  }
});

test('布局：概念/人物按 group 分区收敛（位置=颜色=分类）', () => {
  const g = buildGraph();
  const { pos } = layout(g);
  const { PAD, COL_W } = LAYOUT;
  const CONCEPT_ORDER = ['law', 'tech', 'org', 'astro', 'physics'];
  const gi = new Map(CONCEPT_ORDER.map((x, i) => [x, i]));
  const byGroup = new Map();
  for (const c of g.concepts) {
    const l = byGroup.get(c.group) || [];
    l.push(nodeKey('concept', c.id));
    byGroup.set(c.group, l);
  }
  for (const [group, ids] of byGroup) {
    const cx = PAD + COL_W / 2 + gi.get(group) * COL_W;
    for (const id of ids) assert.ok(Math.abs(pos.get(id).x - cx) < COL_W / 2, `${id} 超出 ${group} 分区`);
  }
  const CHAR_ORDER = ['origin', 'face', 'eto', 'support'];
  const ci = new Map(CHAR_ORDER.map((x, i) => [x, i]));
  const chg = new Map();
  for (const c of g.characters) {
    const l = chg.get(c.group) || [];
    l.push(nodeKey('character', c.id));
    chg.set(c.group, l);
  }
  for (const [group, ids] of chg) {
    const cx = PAD + COL_W / 2 + ci.get(group) * COL_W;
    for (const id of ids) assert.ok(Math.abs(pos.get(id).x - cx) < COL_W / 2, `${id} 超出 ${group} 分区`);
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
// 断言某分组内排序键字典序单调非递减
function assertSorted(groups, label) {
  for (const g of groups) {
    let prev = null;
    for (const [i, item] of g.items.entries()) {
      const k = storyOrderKey(item.events, i);
      if (prev) {
        assert.ok(k[0] >= prev[0], `${label} ${g.key} 纪元乱序：${prev[0]} -> ${k[0]} (${item.id})`);
        if (k[0] === prev[0]) assert.ok(k[1] >= prev[1], `${label} ${g.key} 书序乱序：${prev[1]} -> ${k[1]} (${item.id})`);
        if (k[0] === prev[0] && k[1] === prev[1]) assert.ok(k[2] >= prev[2], `${label} ${g.key} 事件序乱序：${prev[2]} -> ${k[2]} (${item.id})`);
      }
      prev = k;
    }
    // 有事件引用的实体必须集中在无事件实体（组尾）之前
    const keys = g.items.map((c, i) => storyOrderKey(c.events, i));
    const firstNone = keys.findIndex((k) => k[0] === 9);
    if (firstNone >= 0) {
      for (let i = firstNone; i < keys.length; i++) assert.equal(keys[i][0], 9, `${label} ${g.key} 无事件实体应集中在组尾`);
    }
  }
}

test('概念分组内按首次提及（纪元时间线→书→事件序）排列，无事件科普词条居组尾', () => {
  assertSorted(conceptGroups(), '概念');
  // 火鸡（农场主假说）首次提及在危机纪元，应排 physics 组前部而非末尾
  const ph = conceptGroups().find((g) => g.key === 'physics');
  const idx = ph.items.findIndex((c) => c.id === 'farmer-hypothesis');
  assert.ok(idx >= 0 && idx < ph.items.length / 2, `farmer-hypothesis 应排在 physics 组前部，实际第 ${idx}/${ph.items.length}`);
  // 时间线锚定：降维打击(掩体纪元) 应先于 回归运动(归零纪元)
  const law = conceptGroups().find((g) => g.key === 'law');
  const di = law.items.findIndex((c) => c.id === 'dimensional-reduction');
  const ri = law.items.findIndex((c) => c.id === 'return-to-zero');
  assert.ok(di < ri, `降维打击(${di}) 应先于 回归运动(${ri})`);
});

test('人物分组内按出场顺序（纪元时间线→书→事件序）排列', () => {
  assertSorted(characterGroups(), '人物');
  const origin = characterGroups().find((g) => g.key === 'origin');
  const yi = origin.items.findIndex((c) => c.id === 'ye-wenjie');
  const si = origin.items.findIndex((c) => c.id === 'shen-yufei');
  assert.ok(yi < si, `叶文洁(${yi}) 应先于 申玉菲(${si})`);
  const face = characterGroups().find((g) => g.key === 'face');
  const lj = face.items.findIndex((c) => c.id === 'luo-ji');
  const cx = face.items.findIndex((c) => c.id === 'cheng-xin');
  assert.ok(lj < cx, `罗辑(${lj}) 应先于 程心(${cx})`);
});
