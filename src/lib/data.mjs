// 共享数据入口：全站唯一数据读取点 + 路径 helper（base 前缀集中处理）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const load = (name) => JSON.parse(readFileSync(join(ROOT, 'content', `${name}.json`), 'utf8'));

export const books = load('books');
export const eras = load('eras');
export const events = load('events');
export const concepts = load('concepts');
export const characters = load('characters');

const index = (list) => new Map(list.map((x) => [x.id, x]));
export const bookById = index(books);
export const eraById = index(eras);
export const eventById = index(events);
export const conceptById = index(concepts);
export const characterById = index(characters);

const BASE = () => (import.meta.env?.BASE_URL || '/').replace(/\/+$/, '');

/** 站内页面路径加 base 前缀 */
export function pageUrl(path) {
  return `${BASE()}${path}`;
}

/** 静态资源路径加 base 前缀 */
export function imageUrl(path) {
  return `${BASE()}${path}`;
}

/** 事件图：有覆写用覆写，否则用占位图 */
export function eventImage(ev) {
  return ev.image || `/images/event-${ev.id}.svg`;
}

/** 人物肖像：有覆写（腾讯剧照）用覆写，否则用占位图 */
export function charPortrait(ch) {
  return ch.portrait || `/images/portrait-${ch.id}.svg`;
}

/** 纪元头图 */
export function eraHero(era) {
  return era.hero || `/images/era-hero-${era.id}.svg`;
}

/** 书封 */
export function bookCover(b) {
  return b.cover || `/images/book-${b.id}.svg`;
}

/** 纪元按 startYear 排序 */
export function sortedEras() {
  return [...eras].sort((a, b) => a.startYear - b.startYear);
}

/** 某纪元内事件按 order 排序 */
export function eraEvents(eraId) {
  return events.filter((e) => e.eraId === eraId).sort((a, b) => a.order - b.order);
}

const CONCEPT_GROUPS = [
  { key: 'law', title: '法则与理论' },
  { key: 'tech', title: '科技与器物' },
  { key: 'org', title: '组织与文明' },
  { key: 'astro', title: '天文与宇宙' },
  { key: 'physics', title: '物理与时空' },
];
export function conceptGroups() {
  return CONCEPT_GROUPS.map((g) => ({
    ...g,
    items: concepts
      .filter((c) => c.group === g.key)
      .map((c, i) => [c, i])
      .sort(([a, i], [b, j]) => {
        const ka = storyOrderKey(a.events, i), kb = storyOrderKey(b.events, j);
        return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || ka[3] - kb[3];
      })
      .map(([c]) => c),
  }));
}

/** 全局时间键：纪元 order → 书 order → 事件书内 order。
 *  注意：事件 order 仅在「同一纪元内」才是时间顺序（如 dark-forest 的威慑纪元 order=1,2
 *  反而早于危机纪元 order=18+），跨纪元必须先以纪元 order 定锚，否则时间线会倒挂。 */
const eraOrderOf = new Map(eras.map((e) => [e.id, e.order]));
const bookOrderOf = new Map(books.map((b) => [b.id, b.order]));
const eventTimeKey = new Map(events.map((e) => [e.id, [eraOrderOf.get(e.eraId) ?? 9, bookOrderOf.get(e.bookId) ?? 9, e.order]]));
const cmpKey = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** 实体「首次提及/最早出场」= 关联事件中全局时间键最小者；无事件引用 → null（排组尾保持原序） */
function firstTimeKey(ids) {
  let best = null;
  for (const id of ids || []) {
    const k = eventTimeKey.get(id);
    if (k && (!best || cmpKey(k, best) < 0)) best = k;
  }
  return best;
}

/** 概念/人物共用排序键：最早出场时间键(纪元→书→书内 order) → 原 JSON 索引(兜底，保持作者手排顺序) */
export function storyOrderKey(ids, idx) {
  const k = firstTimeKey(ids);
  return k ? [...k, idx] : [9, 9, Infinity, idx];
}

const CHAR_GROUPS = [
  { key: 'origin', title: '红岸与源头' },
  { key: 'face', title: '面壁与执剑' },
  { key: 'eto', title: 'ETO 与三体侧' },
  { key: 'support', title: '重要配角' },
];
export function characterGroups() {
  return CHAR_GROUPS.map((g) => ({
    ...g,
    items: characters
      .filter((c) => c.group === g.key)
      .map((c, i) => [c, i])
      .sort(([a, i], [b, j]) => {
        const ka = storyOrderKey(a.events, i), kb = storyOrderKey(b.events, j);
        return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || ka[3] - kb[3];
      })
      .map(([c]) => c),
  }));
}
