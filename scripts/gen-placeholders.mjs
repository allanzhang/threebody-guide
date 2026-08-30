// 占位图生成 v2：杂志/海报级「带字 SVG」
// 四类：书封(封面式) / 纪元头图(宽幅大标题) / 事件图(海报式) / 人物肖像(姓名卡)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const SERIF = "'Noto Serif CJK SC','Songti SC','STSong','SimSun',serif";
const SANS = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";
const MONO = "'SFMono-Regular','Menlo','Consolas',monospace";

function stars(w, h, n, seed) {
  const r = rng(seed); let out = '';
  for (let i = 0; i < n; i++) {
    const x = (r() * w).toFixed(1), y = (r() * h).toFixed(1), R = (0.6 + r() * 1.4).toFixed(1);
    out += `<circle cx="${x}" cy="${y}" r="${R}" fill="#e8e6e1" opacity="${(0.12 + r() * 0.4).toFixed(2)}"/>`;
  }
  return out;
}
function grid(w, h) {
  let out = '';
  for (let x = 0; x <= w; x += 96) out += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#e8e6e1" stroke-width="0.5" opacity="0.05"/>`;
  for (let y = 0; y <= h; y += 96) out += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#e8e6e1" stroke-width="0.5" opacity="0.05"/>`;
  return out;
}
/** 标题两行拆分：优先在「：」断行，否则中间断 */
function splitTitle(t) {
  const tt = (t || '').trim();
  const i = tt.search(/[：:]/);
  if (i > 0 && i < tt.length - 1) return [tt.slice(0, i), tt.slice(i + 1).trim()];
  if (tt.length <= 12) return [tt, ''];
  const mid = Math.ceil(tt.length / 2);
  return [tt.slice(0, mid), tt.slice(mid)];
}
const fit = (len, big, small) => (len > 10 ? small : len > 7 ? (big + small) / 2 : big);

const defs = (c1, c2) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.18" r="0.75">
      <stop offset="0" stop-color="${c2}" stop-opacity="0.5"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
const svg = (w, h, c1, c2, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs(c1, c2)}<rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#glow)"/>${body}</svg>`;
const WATER = (w, h) => `<text x="${w - 24}" y="${h - 22}" text-anchor="end" font-family="${MONO}" font-size="13" fill="#e8e6e1" opacity="0.45" letter-spacing="3">三体世界图鉴</text>`;
const BANDS = (w, h, color) => `<g>${[0, 1, 2].map((i) => `<rect x="${16 + i * 12}" y="${h - 14}" width="${w - 32 - i * 24}" height="2" fill="${color}" opacity="${0.8 - i * 0.22}"/>`).join('')}</g>`;

/* ---------- 书封 ---------- */
const bookCover = (b) => {
  const t = splitTitle(b.title);
  return svg(400, 560, '#0a0e14', '#233048', `
  ${stars(400, 560, 90, hash('b' + b.id))}
  ${grid(400, 560)}
  <rect x="18" y="18" width="364" height="524" fill="none" stroke="#b8a877" stroke-width="1" opacity="0.5"/>
  <text x="30" y="62" font-family="${MONO}" font-size="13" fill="#b8a877" letter-spacing="4">三体世界图鉴 · 第 ${'一二三'[b.order - 1]} 部</text>
  <line x1="30" y1="78" x2="370" y2="78" stroke="#b8a877" stroke-width="1" opacity="0.6"/>
  <text x="30" y="300" font-family="${SERIF}" font-size="${t[1] ? 54 : 60}" fill="#e8e6e1" letter-spacing="10">${esc(t[0])}</text>
  ${t[1] ? `<text x="30" y="${300 + 74}" font-family="${SERIF}" font-size="54" fill="#e8e6e1" letter-spacing="10">${esc(t[1])}</text>` : ''}
  ${b.subtitle ? `<text x="32" y="${t[1] ? 430 : 400}" font-family="${SANS}" font-size="20" fill="#9aa0a8" letter-spacing="8">${esc(b.subtitle)}</text>` : ''}
  <text x="30" y="500" font-family="${SANS}" font-size="15" fill="#9aa0a8" letter-spacing="2">刘慈欣 著</text>
  ${BANDS(400, 560, '#b8a877')}
`);
};

/* ---------- 纪元头图 ---------- */
const eraHero = (era) => svg(1600, 900, '#0a0e14', era.color, `
  ${stars(1600, 900, 240, hash('hero' + era.id))}
  ${grid(1600, 900)}
  <text x="1500" y="120" text-anchor="end" font-family="${MONO}" font-size="20" fill="${era.color}" letter-spacing="6">${esc(era.years)}</text>
  <circle cx="1330" cy="170" r="120" fill="none" stroke="${era.color}" stroke-width="1" opacity="0.35"/>
  <circle cx="1330" cy="170" r="70" fill="none" stroke="${era.color}" stroke-width="1" opacity="0.5"/>
  <rect x="1500" y="504" width="1.5" height="120" fill="${era.color}" opacity="0.7"/>
  <text x="120" y="560" font-family="${SERIF}" font-size="132" fill="#e8e6e1" letter-spacing="14">${esc(era.heroTitle)}</text>
  <line x1="128" y1="616" x2="820" y2="616" stroke="${era.color}" stroke-width="2" opacity="0.8"/>
  <text x="124" y="676" font-family="${SERIF}" font-size="44" fill="#b8a877" letter-spacing="10">${esc(era.name)}</text>
  <text x="126" y="728" font-family="${SANS}" font-size="21" fill="#9aa0a8" letter-spacing="2" opacity="0.9">${esc(era.intro.slice(0, 48))}</text>
  ${WATER(1600, 900)}
  ${BANDS(1600, 900, era.color)}
`);

/* ---------- 事件图（海报式） ---------- */
const eventImg = (ev, era, book) => {
  const t = splitTitle(ev.title);
  return svg(960, 540, '#0a0e14', era.color, `
  ${stars(960, 540, 110, hash('ev' + ev.id))}
  ${grid(960, 540)}
  <text x="44" y="64" font-family="${MONO}" font-size="18" fill="${era.color}" letter-spacing="4">${esc(ev.yearLabel)}</text>
  <text x="44" y="104" font-family="${SANS}" font-size="15" fill="#9aa0a8" letter-spacing="2">《${esc(book.title)}》 · ${esc(era.name)}</text>
  <line x1="44" y1="126" x2="916" y2="126" stroke="#e8e6e1" stroke-width="0.5" opacity="0.25"/>
  <text x="44" y="330" font-family="${SERIF}" font-size="${fit(ev.title.length, 58, 40)}" fill="#e8e6e1" letter-spacing="4">${esc(t[0])}</text>
  ${t[1] ? `<text x="44" y="${330 + (fit(ev.title.length, 58, 40) + 18)}" font-family="${SERIF}" font-size="${fit(ev.title.length, 58, 40)}" fill="#e8e6e1" letter-spacing="4">${esc(t[1])}</text>` : ''}
  ${ev.isMajorEvent ? `<text x="44" y="448" font-family="${SANS}" font-size="16" fill="#b8a877" letter-spacing="6">★ 大事件</text>` : ''}
  ${WATER(960, 540)}
  ${BANDS(960, 540, era.color)}
`);
};

/* ---------- 人物肖像（姓名卡） ---------- */
const portrait = (ch) => svg(480, 640, '#0a0e14', '#2a3350', `
  ${stars(480, 640, 100, hash('p' + ch.id))}
  ${grid(480, 640)}
  <rect x="26" y="26" width="428" height="588" fill="none" stroke="#b8a877" stroke-width="1" opacity="0.4"/>
  <text x="48" y="90" font-family="${MONO}" font-size="15" fill="#b8a877" letter-spacing="3">${esc(ch.id.toUpperCase())}</text>
  <line x1="48" y1="106" x2="432" y2="106" stroke="#b8a877" stroke-width="1" opacity="0.5"/>
  <text x="48" y="400" font-family="${SERIF}" font-size="60" fill="#e8e6e1" letter-spacing="6">${esc(ch.name)}</text>
  <line x1="50" y1="436" x2="180" y2="436" stroke="#b8a877" stroke-width="2"/>
  <text x="48" y="486" font-family="${SANS}" font-size="22" fill="#9aa0a8" letter-spacing="2">${esc(ch.tagline.slice(0, 16))}</text>
  ${WATER(480, 640)}
  ${BANDS(480, 640, '#b8a877')}
`);
WATER; // noop ref

/* ---------- 生成 ---------- */
mkdirSync(OUT, { recursive: true });
const eraMap = new Map(eras.map((e) => [e.id, e]));
const bookMap = new Map(books.map((b) => [b.id, b]));
let n = 0;
for (const era of eras) { writeFileSync(join(OUT, `era-hero-${era.id}.svg`), eraHero(era)); n++; }
for (const ev of events) { writeFileSync(join(OUT, `event-${ev.id}.svg`), eventImg(ev, eraMap.get(ev.eraId), bookMap.get(ev.bookId))); n++; }
for (const ch of characters) { writeFileSync(join(OUT, `portrait-${ch.id}.svg`), portrait(ch)); n++; }
for (const b of books) { writeFileSync(join(OUT, `book-${b.id}.svg`), bookCover(b)); n++; }
console.log(`✓ 占位图 v2 生成: ${n} 张 -> public/images/`);
