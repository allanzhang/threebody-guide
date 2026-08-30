#!/usr/bin/env node
// 三体图鉴内容校验器：引用完整性 + 必填/唯一性 + 双向链接对称 + self-test
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const load = (name) => JSON.parse(readFileSync(join(ROOT, 'content', `${name}.json`), 'utf8'));

function validate(data) {
  const { books, eras, events, concepts, characters } = data;
  const errors = [];

  const checkUnique = (list, label) => {
    const seen = new Set();
    for (const x of list) {
      if (seen.has(x.id)) errors.push(`${label} id 重复: ${x.id}`);
      seen.add(x.id);
    }
  };
  checkUnique(books, 'books'); checkUnique(eras, 'eras');
  checkUnique(events, 'events'); checkUnique(concepts, 'concepts'); checkUnique(characters, 'characters');

  const required = (obj, fields, label) => {
    for (const f of fields) {
      if (obj[f] === undefined || obj[f] === '') errors.push(`${label} ${obj.id} 缺少必填字段 ${f}`);
    }
  };

  const bookIds = new Set(books.map((b) => b.id));
  const eraIds = new Set(eras.map((e) => e.id));
  const eventIds = new Set(events.map((e) => e.id));
  const conceptIds = new Set(concepts.map((c) => c.id));
  const charIds = new Set(characters.map((c) => c.id));

  for (const b of books) required(b, ['id', 'title', 'order'], 'book');
  for (const e of eras) required(e, ['id', 'name', 'years', 'startYear', 'order', 'heroTitle', 'color', 'colorSoft', 'intro'], 'era');

  for (const ev of events) {
    required(ev, ['id', 'title', 'bookId', 'eraId', 'yearLabel', 'order', 'summary', 'characters', 'concepts'], 'event');
    if (!bookIds.has(ev.bookId)) errors.push(`event ${ev.id} 引用了不存在的 book ${ev.bookId}`);
    if (!eraIds.has(ev.eraId)) errors.push(`event ${ev.id} 引用了不存在的 era ${ev.eraId}`);
    for (const cid of ev.characters) if (!charIds.has(cid)) errors.push(`event ${ev.id} 引用了不存在的人物 ${cid}`);
    for (const cid of ev.concepts) if (!conceptIds.has(cid)) errors.push(`event ${ev.id} 引用了不存在的概念 ${cid}`);
    if (ev.image && !existsSync(join(ROOT, 'public', ev.image))) errors.push(`event ${ev.id} 图片文件不存在: ${ev.image}`);
  }

  for (const c of concepts) {
    required(c, ['id', 'name', 'tagline', 'group', 'inBook', 'science', 'events', 'characters', 'related'], 'concept');
    if (!['law', 'tech', 'org'].includes(c.group)) errors.push(`concept ${c.id} 分组非法: ${c.group}`);
    for (const eid of c.events) if (!eventIds.has(eid)) errors.push(`concept ${c.id} 引用了不存在的事件 ${eid}`);
    for (const cid of c.characters) if (!charIds.has(cid)) errors.push(`concept ${c.id} 引用了不存在的人物 ${cid}`);
    for (const rid of c.related) if (!conceptIds.has(rid)) errors.push(`concept ${c.id} 的 related 引用了不存在的概念 ${rid}`);
  }

  for (const ch of characters) {
    required(ch, ['id', 'name', 'tagline', 'group', 'who', 'role', 'storyline', 'events', 'concepts'], 'character');
    if (!['origin', 'face', 'eto', 'support'].includes(ch.group)) errors.push(`character ${ch.id} 分组非法: ${ch.group}`);
    for (const eid of ch.events) if (!eventIds.has(eid)) errors.push(`character ${ch.id} 引用了不存在的事件 ${eid}`);
    for (const cid of ch.concepts) if (!conceptIds.has(cid)) errors.push(`character ${ch.id} 引用了不存在的概念 ${cid}`);
    if (ch.portrait && !ch.portrait.startsWith('/')) errors.push(`character ${ch.id} portrait 必须以 / 开头`);
    if (ch.portrait && !existsSync(join(ROOT, 'public', ch.portrait))) errors.push(`character ${ch.id} 肖像文件不存在: ${ch.portrait}`);
  }

  // 双向链接对称检查（双向各扫一遍）
  const checkSym = (listA, fieldA, listB, fieldB, idSetB, idSetA, label) => {
    const oneWay = (from, fA, to, fB, ids) => {
      for (const a of from) {
        for (const id of a[fA] || []) {
          if (!ids.has(id)) continue; // 存在性已查
          const b = to.find((x) => x.id === id);
          if (b && !(b[fB] || []).includes(a.id)) {
            errors.push(`双向链接不对称(${label}): ${a.id} 引用了 ${id}，但 ${b.id} 反向缺失`);
          }
        }
      }
    };
    oneWay(listA, fieldA, listB, fieldB, idSetB);
    oneWay(listB, fieldB, listA, fieldA, idSetA);
  };
  checkSym(events, 'characters', characters, 'events', charIds, eventIds, '事件↔人物');
  checkSym(events, 'concepts', concepts, 'events', conceptIds, eventIds, '事件↔概念');
  checkSym(characters, 'concepts', concepts, 'characters', conceptIds, charIds, '人物↔概念');
  checkSym(concepts, 'related', concepts, 'related', conceptIds, conceptIds, '概念↔概念');

  return errors;
}

const data = {
  books: load('books'), eras: load('eras'), events: load('events'),
  concepts: load('concepts'), characters: load('characters'),
};

if (process.argv.includes('--self-test')) {
  // 用内置合成数据自检，不依赖 content 是否有内容
  const makeData = () => ({
    books: [{ id: 'b1', title: 'B', subtitle: '', order: 1, intro: '', cover: '' }],
    eras: [{ id: 'e1', name: 'E', years: '1–2', startYear: 1, order: 1, heroTitle: 'H', color: '#fff', colorSoft: '#000', intro: '', hero: '' }],
    events: [{ id: 'ev1', title: 'T', subtitle: '', bookId: 'b1', eraId: 'e1', yearLabel: '1', order: 1, isMajorEvent: false, summary: 'S', characters: ['c1'], concepts: [], image: '', note: '' }],
    concepts: [],
    characters: [{ id: 'c1', name: 'N', alias: '', tagline: 'T', group: 'origin', isCore: false, who: 'W', role: 'R', storyline: 'S', choices: '', events: ['ev1'], concepts: [], portrait: '' }],
  });
  // 用例1：非法引用必须被捕获
  const broken1 = makeData();
  broken1.events[0].bookId = 'none';
  if (validate(broken1).length === 0) { console.error('✗ self-test 失败：非法引用未被捕获'); process.exit(1); }
  // 用例2：双向不对称必须被捕获（事件删掉人物引用，人物仍引用事件）
  const broken2 = makeData();
  broken2.events[0].characters = [];
  if (validate(broken2).length === 0) { console.error('✗ self-test 失败：双向不对称未被捕获'); process.exit(1); }
  // 用例3：图片覆写文件不存在必须被捕获（portrait / event.image 同名替换机制的门禁）
  const broken3 = makeData();
  broken3.characters[0].portrait = '/images/does-not-exist.svg';
  broken3.events[0].image = '/images/does-not-exist.svg';
  if (validate(broken3).length < 2) { console.error('✗ self-test 失败：图片文件缺失未被捕获'); process.exit(1); }
  console.log('✓ self-test 通过：非法引用/不对称/图片文件缺失均能被捕获');
  process.exit(0);
}

const errors = validate(data);
if (errors.length > 0) {
  console.error('✗ 校验失败:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ 校验通过: ${data.books.length} 书 / ${data.eras.length} 章 / ${data.events.length} 事件 / ${data.concepts.length} 概念 / ${data.characters.length} 人物`);
