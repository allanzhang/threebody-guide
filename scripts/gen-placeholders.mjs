// 科学符号风占位图生成：纪元头图 / 事件图 / 人物肖像 / 书封
// 输出 public/images/，文件名规则与 src/lib/data.mjs 的 helper 一一对应
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'public', 'images');
const load = (name) => JSON.parse(readFileSync(join(ROOT, 'content', `${name}.json`), 'utf8'));
const { books, eras, events, characters } = {
  books: load('books'), eras: load('eras'), events: load('events'),
  concepts: load('concepts'), characters: load('characters'),
};

/* ---------- 工具 ---------- */
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => () => { seed = Math.imul(seed ^ (seed >>> 15), 2246822519); seed = Math.imul(seed ^ (seed >>> 13), 3266489917); return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296; };
const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function stars(w, h, n, seed) {
  const r = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = (r() * w).toFixed(1), y = (r() * h).toFixed(1), R = (0.6 + r() * 1.6).toFixed(1);
    out += `<circle cx="${x}" cy="${y}" r="${R}" fill="#e8e6e1" opacity="${(0.15 + r() * 0.5).toFixed(2)}"/>`;
  }
  return out;
}

function wave(w, h, color, seed, amp) {
  const r = rng(seed);
  let pts = [];
  for (let x = 0; x <= w; x += 16) {
    const y = h / 2 + Math.sin(x / 60 + r() * 6) * amp + (r() - 0.5) * amp * 0.6;
    pts.push(`${x.toFixed(0)},${y.toFixed(0)}`);
  }
  return `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.55"/>`;
}

function grid(w, h, color) {
  let out = '';
  for (let x = 0; x <= w; x += 80) out += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${color}" stroke-width="0.5"/>`;
  for (let y = 0; y <= h; y += 80) out += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${color}" stroke-width="0.5"/>`;
  return out;
}

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const SANS = "'PingFang SC','Microsoft YaHei',sans-serif";
const SERIF = "'Noto Serif SC','Songti SC',serif";
const MONO = "'SFMono-Regular','Menlo',monospace";

/* ---------- 四类占位图 ---------- */
const eraHero = (era) => svg(1600, 900, `
  <rect width="1600" height="900" fill="#0a0e14"/>
  <rect width="1600" height="900" fill="${era.color}" opacity="0.14"/>
  ${grid(1600, 900, '#e8e6e1')}
  ${stars(1600, 900, 260, hash('hero' + era.id))}
  <text x="80" y="760" font-family="${MONO}" font-size="26" fill="${era.color}" letter-spacing="6">${esc(era.years)}</text>
  <text x="78" y="600" font-family="${SERIF}" font-size="120" fill="#e8e6e1" letter-spacing="10">${esc(era.heroTitle)}</text>
  <text x="84" y="820" font-family="${SERIF}" font-size="40" fill="#b8a877" letter-spacing="8">${esc(era.name)}</text>
  ${wave(1600, 420, era.color, hash('w' + era.id), 26)}
`);

const eventImg = (ev, era, book) => svg(960, 540, `
  <rect width="960" height="540" fill="#0a0e14"/>
  <rect width="960" height="540" fill="${era.color}" opacity="0.12"/>
  ${grid(960, 540, '#e8e6e1')}
  ${stars(960, 540, 120, hash('ev' + ev.id))}
  <text x="56" y="84" font-family="${MONO}" font-size="20" fill="${era.color}" letter-spacing="4">${esc(ev.yearLabel)}</text>
  <text x="56" y="300" font-family="${SERIF}" font-size="52" fill="#e8e6e1" letter-spacing="4">${esc(ev.title)}</text>
  <text x="58" y="352" font-family="${SANS}" font-size="24" fill="#9aa0a8">${esc(book.title)} · ${esc(era.name)}</text>
  ${wave(960, 500, era.color, hash('w' + ev.id), 22)}
`);

const portrait = (ch) => svg(480, 640, `
  <rect width="480" height="640" fill="#0a0e14"/>
  <rect width="480" height="640" fill="#b8a877" opacity="0.08"/>
  ${stars(480, 640, 110, hash('p' + ch.id))}
  <text x="56" y="60" font-family="${MONO}" font-size="16" fill="#b8a877" letter-spacing="3">P/${esc(ch.id.toUpperCase())}</text>
  <text x="56" y="360" font-family="${SERIF}" font-size="56" fill="#e8e6e1" letter-spacing="4">${esc(ch.name)}</text>
  <text x="58" y="408" font-family="${SANS}" font-size="23" fill="#9aa0a8">${esc(ch.tagline)}</text>
  ${wave(480, 560, '#b8a877', hash('pw' + ch.id), 16)}
`);

const cover = (b) => svg(400, 560, `
  <rect width="400" height="560" fill="#0a0e14"/>
  <rect width="400" height="560" fill="#b8a877" opacity="0.10"/>
  ${stars(400, 560, 90, hash('b' + b.id))}
  <text x="48" y="150" font-family="${MONO}" font-size="20" fill="#b8a877" letter-spacing="3">${String(b.order).padStart(2, '0')}</text>
  <text x="48" y="330" font-family="${SERIF}" font-size="58" fill="#e8e6e1" letter-spacing="8">${esc(b.title)}</text>
  ${b.subtitle ? `<text x="50" y="390" font-family="${SANS}" font-size="24" fill="#9aa0a8" letter-spacing="6">${esc(b.subtitle)}</text>` : ''}
`);

/* ---------- 生成 ---------- */
mkdirSync(OUT, { recursive: true });
const eraMap = new Map(eras.map((e) => [e.id, e]));
const bookMap = new Map(books.map((b) => [b.id, b]));
let n = 0;
for (const era of eras) { writeFileSync(join(OUT, `era-hero-${era.id}.svg`), eraHero(era)); n++; }
for (const ev of events) { writeFileSync(join(OUT, `event-${ev.id}.svg`), eventImg(ev, eraMap.get(ev.eraId), bookMap.get(ev.bookId))); n++; }
for (const ch of characters) { writeFileSync(join(OUT, `portrait-${ch.id}.svg`), portrait(ch)); n++; }
for (const b of books) { writeFileSync(join(OUT, `book-${b.id}.svg`), cover(b)); n++; }
console.log(`✓ 占位图生成: ${n} 张 -> public/images/`);
