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
export const scenes = load('scenes');

const index = (list) => new Map(list.map((x) => [x.id, x]));
export const bookById = index(books);
export const eraById = index(eras);
export const eventById = index(events);
export const conceptById = index(concepts);
export const characterById = index(characters);
export const sceneById = index(scenes);

/** 大事件 → 绑定的场景页（无则为 undefined） */
export function sceneForEvent(eventId) {
  return scenes.find((s) => s.eventIds.includes(eventId));
}

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
  return CONCEPT_GROUPS.map((g) => ({ ...g, items: concepts.filter((c) => c.group === g.key) }));
}

const CHAR_GROUPS = [
  { key: 'origin', title: '红岸与源头' },
  { key: 'face', title: '面壁与执剑' },
  { key: 'eto', title: 'ETO 与三体侧' },
  { key: 'support', title: '重要配角' },
];
export function characterGroups() {
  return CHAR_GROUPS.map((g) => ({ ...g, items: characters.filter((c) => c.group === g.key) }));
}
