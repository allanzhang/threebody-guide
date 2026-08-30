#!/usr/bin/env node
// 中英对照标注：单趟最长匹配 + 显式幂等 + 污染扫描门禁
// 用法：node scripts/annotate-terms.mjs [--scan]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TERMS = JSON.parse(readFileSync(join(ROOT, 'scripts', 'terms.json'), 'utf8'))
  .sort((a, b) => b[0].length - a[0].length); // 最长优先

const EN_AFTER = /^（[A-Za-z][A-Za-z0-9 \-_().]*?）/;

function annotate(text) {
  if (!text) return text;
  let out = '';
  let i = 0;
  while (i < text.length) {
    let hit = null;
    for (const [cn, en] of TERMS) {
      if (text.startsWith(cn, i)) { hit = [cn, en]; break; }
    }
    if (hit) {
      const [cn, en] = hit;
      const afterStr = text.slice(i + cn.length);
      const nextCh = text[i + cn.length];
      // 幂等（已有（English））或后随中文括号/半角括号 → 不标注，避免「（英）（中」叠加
      const skip = EN_AFTER.test(afterStr) || nextCh === '（' || nextCh === '(';
      out += skip ? cn : `${cn}（${en}）`;
      i += cn.length;
      continue;
    }
    out += text[i];
    i++;
  }
  return out;
}

const FIELDS = {
  events: ['summary', 'note'],
  concepts: ['inBook', 'science'],
  characters: ['who', 'role', 'storyline', 'choices'],
  books: ['intro'],
  eras: ['intro'],
};

const POLLUTION = /（[A-Za-z][^）]{0,40}）（[\u4e00-\u9fff]/g;

if (process.argv.includes('--scan')) {
  let total = 0;
  for (const [coll, fields] of Object.entries(FIELDS)) {
    const data = JSON.parse(readFileSync(join(ROOT, 'content', `${coll}.json`), 'utf8'));
    for (const item of data) {
      for (const f of fields) {
        const m = (item[f] || '').match(POLLUTION);
        if (m) {
          total += m.length;
          console.error(`污染 [${coll}] ${item.id}.${f}: ${m[0]}`);
        }
      }
    }
  }
  if (total > 0) { console.error(`✗ 污染扫描: 发现 ${total} 处「中文（英）（中」叠加`); process.exit(1); }
  console.log('✓ 污染扫描通过：无「中文（英）（中」叠加');
  process.exit(0);
}

let changed = 0;
for (const [coll, fields] of Object.entries(FIELDS)) {
  const file = join(ROOT, 'content', `${coll}.json`);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  for (const item of data) {
    for (const f of fields) {
      const before = item[f];
      const after = annotate(before);
      if (before !== after) changed++;
      item[f] = after;
    }
  }
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
console.log(`✓ 标注完成: ${changed} 个字段更新`);
