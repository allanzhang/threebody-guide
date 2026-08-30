#!/usr/bin/env node
// 从 TMDB 拉取腾讯剧版《三体》(id 204541) 的人物肖像与头图（走本地代理）
// 覆写字段：character.portrait / era.hero / book.cover；占位图同名机制保留
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const KEY = readFileSync(join(ROOT, '.env.local'), 'utf8').match(/TMDB_API_KEY=(\S+)/)?.[1];
if (!KEY) { console.error('缺少 TMDB_API_KEY（.env.local）'); process.exit(1); }
const PROXY = process.env.TMDB_PROXY || 'http://127.0.0.1:7897';
const SERIES_ID = 204541; // 腾讯剧版《三体》
const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

function curl(url, dest = null) {
  const args = ['-sS', '-x', PROXY, '--max-time', '30'];
  if (dest) { execFileSync('curl', [...args, url, '-o', dest]); return dest; }
  return execFileSync('curl', [...args, url], { encoding: 'utf8' });
}
function api(path) { return JSON.parse(curl(`${API}${path}${path.includes('?') ? '&' : '?'}api_key=${KEY}&language=zh-CN`)); }
function dl(url, dest) { if (!existsSync(dest)) { curl(url, dest); console.log(`  ↓ ${dest}`); } else console.log(`  = ${dest}（已存在）`); }

// 1) 剧集信息 + 海报 + backdrops
const tv = api(`/tv/${SERIES_ID}`);
const imgs = api(`/tv/${SERIES_ID}/images`);
const backdrop = tv.backdrop_path || (imgs.backdrops[0] && imgs.backdrops[0].file_path);
const poster = tv.poster_path;

// 2) 演职员（角色名 → 我方人物 id）
const credits = api(`/tv/${SERIES_ID}/credits`);
const ALIAS = [
  [/Wang Miao/i, 'wang-miao'], [/Shi Qiang/i, 'shi-qiang'], [/Ye Wenjie/i, 'ye-wenjie'],
  [/Chang Weisi/i, 'chang-weisi'], [/Shen Yufei/i, 'shen-yufei'], [/Yang Dong/i, 'yang-dong'],
  [/Ding Yi/i, 'ding-yi'], [/Pan Han/i, 'pan-han'], [/Evans/i, 'evans'],
];
// 同角色多演员（叶文洁老年/青年）：优先 Older 版
const prefer = (a, b) => {
  if (a.id === b.id) {
    const aOld = /^Older/i.test(a.character || ''); const bOld = /^Older/i.test(b.character || '');
    if (aOld !== bOld) return aOld ? -1 : 1;
  }
  return a.order - b.order;
};
const mapped = [];
for (const c of credits.cast || []) {
  const name = `${c.name}「${c.character}」`;
  for (const [re, id] of ALIAS) {
    if (re.test(c.character || '')) { mapped.push({ id, actor: c.name, character: c.character, path: c.profile_path, order: c.order }); break; }
  }
}
// 多演员同角色：按 order 优先（叶文洁：老年/青年都保留时会选 order 更靠前者）
const seen = new Set(); const portraits = [];
for (const m of mapped.sort(prefer)) {
  if (seen.has(m.id)) continue; seen.add(m.id);
  if (m.path) portraits.push(m);
}
console.log(`演职员映射 ${mapped.length} 条 → 去重后 ${portraits.length} 人`);

// 3) 下载
mkdirSync(join(ROOT, 'public', 'images'), { recursive: true });
for (const p of portraits) {
  const dest = join(ROOT, 'public', 'images', `portrait-${p.id}.jpg`);
  dl(`${IMG}/w500${p.path}`, dest);
}
// 头图：era-crisis 用剧集 backdrop；book-threebody 封面用剧集海报
if (backdrop) dl(`${IMG}/w1280${backdrop}`, join(ROOT, 'public', 'images', 'era-hero-era-crisis.jpg'));
if (poster) dl(`${IMG}/w500${poster}`, join(ROOT, 'public', 'images', 'book-threebody.jpg'));

// 4) 回写覆写字段（只写成功下载的）
const load = (n) => JSON.parse(readFileSync(join(ROOT, 'content', `${n}.json`), 'utf8'));
const save = (n, d) => writeFileSync(join(ROOT, 'content', `${n}.json`), JSON.stringify(d, null, 2) + '\n');
const characters = load('characters');
for (const p of portraits) {
  const ch = characters.find((c) => c.id === p.id);
  if (ch) { ch.portrait = `/images/portrait-${p.id}.jpg`; console.log(`  portrait ${p.id} <- ${p.actor}（${p.character}）`); }
}
save('characters', characters);
const eras = load('eras');
const ec = eras.find((e) => e.id === 'era-crisis');
if (ec && backdrop) { ec.hero = '/images/era-hero-era-crisis.jpg'; save('eras', eras); console.log('  era-crisis.hero <- backdrop'); }
const books = load('books');
const b1 = books.find((b) => b.id === 'threebody');
if (b1 && poster) { b1.cover = '/images/book-threebody.jpg'; save('books', books); console.log('  book-threebody.cover <- poster'); }
console.log('✓ 完成');
