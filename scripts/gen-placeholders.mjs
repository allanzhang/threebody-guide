// 科学符号风占位图生成：纪元头图 / 事件图 / 人物肖像 / 书封
// 符号系统：雷达信号弧 / 坐标准星 / 扩散广播环 / 降维平面线 / 轨道椭圆 / 频谱柱
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
const pick = (seed, arr) => arr[hash(seed) % arr.length];

function stars(w, h, n, seed) {
  const r = rng(seed);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = (r() * w).toFixed(1), y = (r() * h).toFixed(1), R = (0.6 + r() * 1.6).toFixed(1);
    out += `<circle cx="${x}" cy="${y}" r="${R}" fill="#e8e6e1" opacity="${(0.15 + r() * 0.5).toFixed(2)}"/>`;
  }
  return out;
}

function grid(w, h, color) {
  let out = '';
  for (let x = 0; x <= w; x += 80) out += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${color}" stroke-width="0.5"/>`;
  for (let y = 0; y <= h; y += 80) out += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${color}" stroke-width="0.5"/>`;
  return out;
}

/* ---------- 五种主题符号 ---------- */
// 电波波形（沿水平扫过的正弦）
function motifWave(w, h, color, seed, amp) {
  const r = rng(seed);
  let pts = [];
  for (let x = 0; x <= w; x += 16) {
    const y = h / 2 + Math.sin(x / 60 + r() * 6) * amp + (r() - 0.5) * amp * 0.6;
    pts.push(`${x.toFixed(0)},${y.toFixed(0)}`);
  }
  return `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.55"/>`;
}

// 坐标准星（同心圆 + 十字刻度）
function motifTarget(w, h, color) {
  const cx = w * 0.78, cy = h * 0.30;
  let out = `<g opacity="0.5" stroke="${color}" fill="none">`;
  for (const r of [40, 90, 150, 220]) out += `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  out += `<line x1="${cx - 260}" y1="${cy}" x2="${cx + 260}" y2="${cy}"/><line x1="${cx}" y1="${cy - 260}" x2="${cx}" y2="${cy + 260}"/>`;
  for (let a = 0; a < 360; a += 30) {
    const rad = (a / 180) * Math.PI;
    out += `<line x1="${cx + Math.cos(rad) * 45}" y1="${cy + Math.sin(rad) * 45}" x2="${cx + Math.cos(rad) * 70}" y2="${cy + Math.sin(rad) * 70}"/>`;
  }
  return out + '</g>';
}

// 扩散广播环（同心圆弧 + 外扩线，代表广播）
function motifBeacon(w, h, color, seed) {
  const r = rng(seed);
  const cx = w * 0.22, cy = h * 0.66;
  let out = `<g opacity="0.5" stroke="${color}" fill="none">`;
  for (const rad of [30, 70, 120, 180, 250]) {
    out += `<circle cx="${cx}" cy="${cy}" r="${rad}"/>`;
    for (let k = 0; k < 3; k++) {
      const a = (r() * Math.PI * 2).toFixed(2);
      out += `<line x1="${cx + Math.cos(+a) * (rad + 6)}" y1="${cy + Math.sin(+a) * (rad + 6)}" x2="${cx + Math.cos(+a) * (rad + 26)}" y2="${cy + Math.sin(+a) * (rad + 26)}"/>`;
    }
  }
  return out + '</g>';
}

// 降维平面线（水平压缩的细线，越靠下越密）
function motifPlane(w, h, color, offsetY = 0) {
  let out = `<g opacity="0.45" stroke="${color}">`;
  let y = offsetY + 40;
  let step = 26;
  while (y < h - 20) {
    out += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke-width="${(1 + (h - y) / 400).toFixed(2)}"/>`;
    y += step; step = Math.max(4, step - 1.1);
  }
  return out + '</g>';
}

// 轨道椭圆（银河/恒星轨道）
function motifOrbit(w, h, color, seed) {
  const r = rng(seed);
  const cx = w * 0.80, cy = h * 0.22;
  let out = `<g opacity="0.5" stroke="${color}" fill="none">`;
  for (const [rx, ry] of [[70, 26], [140, 52], [220, 82], [300, 112]]) {
    out += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(-14 ${cx} ${cy})"/>`;
  }
  out += `<circle cx="${cx}" cy="${cy}" r="${4 + r() * 5}" fill="${color}" stroke="none"/>`;
  return out + '</g>';
}

// 频谱柱（右缘数据条）
function motifSpectrum(w, h, color, seed) {
  const r = rng(seed);
  const x0 = w * 0.86, bw = 14;
  let out = `<g opacity="0.55" fill="${color}">`;
  for (let i = 0; i < 10; i++) {
    const bh = (h * (0.12 + r() * 0.55)).toFixed(0);
    out += `<rect x="${(x0 + i * (bw + 5)).toFixed(0)}" y="${(h - 40 - +bh).toFixed(0)}" width="${bw}" height="${bh}"/>`;
  }
  return out + '</g>';
}

const MOTIFS = [motifWave, motifTarget, motifBeacon, motifPlane, motifOrbit, motifSpectrum];

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const SANS = "'PingFang SC','Microsoft YaHei',sans-serif";
const SERIF = "'Noto Serif SC','Songti SC',serif";
const MONO = "'SFMono-Regular','Menlo',monospace";

/* ---------- 纪元专属符号映射 ---------- */
const ERA_MOTIF = {
  'era-crisis': (w, h, c) => motifBeacon(w, h, c, hash('beacon-crisis')),     // 红岸：雷达/广播弧
  'era-deterrence': (w, h, c) => motifTarget(w, h, c),                        // 威慑：坐标准星
  'era-broadcast': (w, h, c) => motifBeacon(w, h, c, hash('beacon-broadcast')), // 广播：扩散环
  'era-shelter': (w, h, c) => motifPlane(w, h, c, 0),                         // 掩体：降维平面
  'era-galaxy': (w, h, c) => motifOrbit(w, h, c, hash('orbit-galaxy')),       // 银河：轨道
};

/* ---------- 四类占位图 ---------- */
const eraHero = (era) => svg(1600, 900, `
  <rect width="1600" height="900" fill="#0a0e14"/>
  <rect width="1600" height="900" fill="${era.color}" opacity="0.14"/>
  ${grid(1600, 900, '#e8e6e1')}
  ${stars(1600, 900, 260, hash('hero' + era.id))}
  ${(ERA_MOTIF[era.id] || motifWave)(1600, 900, era.color)}
  <text x="80" y="760" font-family="${MONO}" font-size="26" fill="${era.color}" letter-spacing="6">${esc(era.years)}</text>
  <text x="78" y="600" font-family="${SERIF}" font-size="120" fill="#e8e6e1" letter-spacing="10">${esc(era.heroTitle)}</text>
  <text x="84" y="820" font-family="${SERIF}" font-size="40" fill="#b8a877" letter-spacing="8">${esc(era.name)}</text>
`);

const eventImg = (ev, era, book) => {
  const motif = pick('ev' + ev.id, MOTIFS);
  const amp = pick('amp' + ev.id, [18, 22, 26]);
  return svg(960, 540, `
  <rect width="960" height="540" fill="#0a0e14"/>
  <rect width="960" height="540" fill="${era.color}" opacity="0.12"/>
  ${grid(960, 540, '#e8e6e1')}
  ${stars(960, 540, 120, hash('ev' + ev.id))}
  ${motif(960, 540, era.color, hash('m' + ev.id), amp)}
  <text x="56" y="84" font-family="${MONO}" font-size="20" fill="${era.color}" letter-spacing="4">${esc(ev.yearLabel)}</text>
  <text x="56" y="300" font-family="${SERIF}" font-size="52" fill="#e8e6e1" letter-spacing="4">${esc(ev.title)}</text>
  <text x="58" y="352" font-family="${SANS}" font-size="24" fill="#9aa0a8">${esc(book.title)} · ${esc(era.name)}</text>
`);
};

const GROUP_MOTIF = {
  origin: (w, h, c) => motifBeacon(w, h, c, hash('p-origin')),
  face: (w, h, c) => motifTarget(w, h, c),
  eto: (w, h, c) => motifPlane(w, h, c, h * 0.55),
  support: (w, h, c) => motifSpectrum(w, h, c, hash('p-support')),
};

const portrait = (ch) => {
  const motif = (GROUP_MOTIF[ch.group] || motifWave)(480, 640, '#b8a877');
  return svg(480, 640, `
  <rect width="480" height="640" fill="#0a0e14"/>
  <rect width="480" height="640" fill="#b8a877" opacity="0.08"/>
  ${stars(480, 640, 110, hash('p' + ch.id))}
  <text x="56" y="60" font-family="${MONO}" font-size="16" fill="#b8a877" letter-spacing="3">P/${esc(ch.id.toUpperCase())}</text>
  ${motif.replace('<g opacity="0.5"', '<g opacity="0.22"').replace('<g opacity="0.45"', '<g opacity="0.22"').replace('<g opacity="0.55"', '<g opacity="0.22"')}
  <text x="56" y="360" font-family="${SERIF}" font-size="56" fill="#e8e6e1" letter-spacing="4">${esc(ch.name)}</text>
  <text x="58" y="408" font-family="${SANS}" font-size="23" fill="#9aa0a8">${esc(ch.tagline)}</text>
`);
};

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
