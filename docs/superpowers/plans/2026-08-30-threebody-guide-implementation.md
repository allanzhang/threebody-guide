# 三体世界图鉴 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按已确认的设计文档（docs/superpowers/specs/2026-08-30-threebody-guide-design.md）实现 M1 全量版——纯静态 Astro 网站，包含时间线、概念册、人物墙三大页面及详情页，灌入刘慈欣《三体》三部曲全量内容（书/纪元/事件/概念/人物五套 JSON 数据，id 互链）。

**Architecture:** Astro 静态生成（零客户端 JS）+ 手写 CSS + `content/` 下五个 JSON 集合（books/eras/events/concepts/characters）以 id 互相引用，构建时由 Astro 组件读取渲染全部页面。数据引用完整性与双向链接对称性由独立校验脚本保证（含 `--self-test` 自检）。占位图由脚本按科学符号风生成，与真实图同名替换。

**Tech Stack:** Astro 5.x、原生 CSS、Node 22（系统 `node` v22.23.0 或托管运行时 `/Users/allan/.workbuddy/binaries/node/versions/22.22.2/bin/node` 均可）。无任何前端框架、无客户端 JS。

**设计文档:** docs/superpowers/specs/2026-08-30-threebody-guide-design.md（所有视觉与内容决策以此为准）

## Global Constraints

- 内容口径：纯小说正史，只讲刘慈欣三部曲；影视改编不入正文，图片注脚例外。
- 剧透策略：全剧透，不折叠、不设防。
- 中文文案一律用弯引号「」；禁止在 JSON 中文文案中使用 ASCII 直引号 `"`。
- 图片规则：横版容器只用横版图，竖版图只进竖版容器；占位图与真实图同名文件替换。
- 零客户端 JS：构建产物不得含 script 标签（Astro 框架注入除外）。
- 数据改动必跑 `node scripts/validate-content.mjs`；视觉改动后必须构建截图自检。
- 每任务结束必须 commit（中文 commit message）。
- 部署路径：base 一律 helper 化（pageUrl/imageUrl），禁止裸写绝对路径。
- 移动端 375px 断点不破版。

## 文件结构（最终形态）

```
/Users/allan/Documents/AIProject/threebody/
├── package.json
├── astro.config.mjs
├── .gitignore                      # 已存在（node_modules/dist/.env*/.DS_Store）
├── content/
│   ├── books.json                  # 三部曲（3）
│   ├── eras.json                   # 纪元年表分章（5）
│   ├── events.json                 # 时间线条目（三部曲全量 ~64）
│   ├── concepts.json               # 概念（~36）
│   └── characters.json             # 人物（~20）
├── scripts/
│   ├── validate-content.mjs        # 校验（引用完整性 + 必填 + 双向对称 + self-test）
│   └── gen-placeholders.mjs        # 科学符号风 SVG 占位图生成
├── public/images/                  # 占位图产物（脚本生成）
└── src/
    ├── lib/data.mjs                # 共享数据入口 + 路径 helper（唯一入口）
    ├── styles/global.css           # 设计令牌 + 全局样式
    ├── layouts/Base.astro
    └── pages/
        ├── index.astro             # 首页
        ├── timeline.astro          # 时间线页
        ├── concepts/
        │   ├── index.astro         # 概念册
        │   └── [id].astro          # 概念详情
        └── characters/
            ├── index.astro         # 人物墙
            └── [id].astro          # 人物详情
```

---

### Task 1: 项目脚手架与 Astro 配置

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `src/pages/index.astro`（占位首页 stub，保证空仓可构建；Task 6 重写）

**Interfaces:**
- Produces: `npm run dev / build / preview / validate / placeholders` 五个脚本；`astro.config.mjs` 读 `SITE_URL`/`BASE_PATH` 环境变量。

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "threebody-guide",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "validate": "node scripts/validate-content.mjs",
    "placeholders": "node scripts/gen-placeholders.mjs"
  },
  "dependencies": {
    "astro": "^5.0.0"
  }
}
```

- [ ] **Step 2: 写 astro.config.mjs**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || 'https://example.com',
  base: process.env.BASE_PATH || '/',
});
```

- [ ] **Step 3: 写占位首页 stub（保证空仓库可构建，Task 6 重写）**

```astro
---
---
<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><title>三体世界图鉴</title></head>
  <body><h1>三体世界图鉴 · 建设中</h1></body>
</html>
```

- [ ] **Step 4: 安装依赖**

Run: `npm install`
Expected: `added N packages` 且无红色错误（registry 为 npmmirror，若网络受限则用 `require_escalated` 重跑）。

- [ ] **Step 5: 验证脚手架**

Run: `npm run build`
Expected: `astro build` 成功，`dist/index.html` 生成（stub 首页）。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json astro.config.mjs src/pages/index.astro
git commit -m "chore: Astro 5 脚手架（零JS静态站 + SITE_URL/BASE_PATH 环境变量）"
```

---

### Task 2: 数据文件与校验器（含 self-test）

**Files:**
- Create: `content/books.json`
- Create: `content/eras.json`
- Create: `content/events.json`（初始空数组）
- Create: `content/concepts.json`（初始空数组）
- Create: `content/characters.json`（初始空数组）
- Create: `scripts/validate-content.mjs`

**Interfaces:**
- Produces: 五套 JSON 的 schema 定稿（字段名被后续所有脚本/组件依赖，一字不改）；`validate-content.mjs` 退出码 0=通过，非 0=失败；`--self-test` 参数自检。

- [ ] **Step 1: 写 content/books.json**

```json
[
  {
    "id": "threebody",
    "title": "三体",
    "subtitle": "地球往事",
    "order": 1,
    "intro": "1960 年代的红岸基地向宇宙发出第一声问候，四光年外的三体文明收到回音。人类此后进入危机纪元。",
    "cover": ""
  },
  {
    "id": "dark-forest",
    "title": "黑暗森林",
    "subtitle": "",
    "order": 2,
    "intro": "面壁计划与破壁人的对决，罗辑在冰川与墓地之间悟出宇宙的黑暗森林图景。",
    "cover": ""
  },
  {
    "id": "deaths-end",
    "title": "死神永生",
    "subtitle": "",
    "order": 3,
    "intro": "威慑失败、太阳系二维化、星舰与归零：文明在宇宙尺度上走向终点。",
    "cover": ""
  }
]
```

- [ ] **Step 2: 写 content/eras.json（5 章，主题色为设计定稿）**

```json
[
  {
    "id": "era-crisis",
    "name": "红岸与危机纪元",
    "years": "1969 – 2208",
    "startYear": 1969,
    "order": 1,
    "heroTitle": "不要回答",
    "color": "#8a6d3b",
    "colorSoft": "#241f16",
    "intro": "红岸基地向宇宙发出第一声问候，回音来自四光年外的三体文明。人类用三百年仓促准备一场必败的战争。",
    "hero": ""
  },
  {
    "id": "era-deterrence",
    "name": "威慑纪元",
    "years": "2208 – 2270",
    "startYear": 2208,
    "order": 2,
    "heroTitle": "黑暗森林",
    "color": "#3f6f9e",
    "colorSoft": "#16202b",
    "intro": "罗辑以同归于尽为筹码，为人类换来六十二年虚假的和平。平衡建立在天平的一端——执剑人的手上。",
    "hero": ""
  },
  {
    "id": "era-broadcast",
    "name": "广播纪元",
    "years": "2270 – 2272",
    "startYear": 2270,
    "order": 3,
    "heroTitle": "坐标已暴露",
    "color": "#2f8f8f",
    "colorSoft": "#142626",
    "intro": "威慑失败，引力波天线向宇宙广播了三体世界的坐标。等待人类的，是来自宇宙深处的回音。",
    "hero": ""
  },
  {
    "id": "era-shelter",
    "name": "掩体纪元",
    "years": "2272 – 2400",
    "startYear": 2272,
    "order": 4,
    "heroTitle": "降维",
    "color": "#7a6a92",
    "colorSoft": "#221d2c",
    "intro": "太阳系躲进木星背后的阴影，却躲不过一张薄薄的白纸。二维化从太阳开始。",
    "hero": ""
  },
  {
    "id": "era-galaxy",
    "name": "银河纪元与归零",
    "years": "2400 – 宇宙末日",
    "startYear": 2400,
    "order": 5,
    "heroTitle": "归零",
    "color": "#aeb4c2",
    "colorSoft": "#1a1c22",
    "intro": "文明在星海间漂流千万年。最后的归零者，要把宇宙归零重来。",
    "hero": ""
  }
]
```

- [ ] **Step 3: 写三个空内容文件**

`content/events.json`、`content/concepts.json`、`content/characters.json` 内容均为 `[]`（后续 Task 10–12 分批灌入）。

- [ ] **Step 4: 写校验器（完整代码，含 --self-test）**

```js
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
  const checkSym = (listA, fieldA, idSetA, listB, fieldB, label) => {
    const oneWay = (from, fA, idsA, to, fB) => {
      for (const a of from) {
        for (const id of a[fA] || []) {
          if (!idsA.has(id)) continue; // 存在性已查
          const b = to.find((x) => x.id === id);
          if (b && !(b[fB] || []).includes(a.id)) {
            errors.push(`双向链接不对称(${label}): ${a.id} 引用了 ${id}，但 ${b.id} 反向缺失`);
          }
        }
      }
    };
    oneWay(listA, fieldA, idSetA, listB, fieldB);
    oneWay(listB, fieldB, idSetB, listA, fieldA);
  };
  checkSym(events, 'characters', charIds, characters, 'events', '事件↔人物');
  checkSym(events, 'concepts', conceptIds, concepts, 'events', '事件↔概念');
  checkSym(characters, 'concepts', conceptIds, concepts, 'characters', '人物↔概念');
  checkSym(concepts, 'related', conceptIds, concepts, 'related', '概念↔概念');

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
  console.log('✓ self-test 通过：非法引用与不对称均能被捕获');
  process.exit(0);
}

const errors = validate(data);
if (errors.length > 0) {
  console.error('✗ 校验失败:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ 校验通过: ${data.books.length} 书 / ${data.eras.length} 章 / ${data.events.length} 事件 / ${data.concepts.length} 概念 / ${data.characters.length} 人物`);
```

- [ ] **Step 5: 运行校验 + self-test**

Run: `node scripts/validate-content.mjs && node scripts/validate-content.mjs --self-test`
Expected: `✓ 校验通过: 3 书 / 5 章 / 0 事件 / 0 概念 / 0 人物` + `✓ self-test 通过：非法引用与不对称均能被捕获`（self-test 使用内置合成数据，不依赖 content 是否为空）

- [ ] **Step 6: Commit**

```bash
git add content/ scripts/validate-content.mjs
git commit -m "feat: 数据 schema 定稿 + 校验器（引用完整性/双向对称/self-test）"
```

---

### Task 3: 共享数据模块

**Files:**
- Create: `src/lib/data.mjs`

**Interfaces:**
- Produces（后续所有页面/布局依赖，签名固定）：
  - `books/eras/events/concepts/characters`（数组）
  - `bookById/eraById/eventById/conceptById/characterById`（Map）
  - `pageUrl(path)`、`imageUrl(path)`（自动加 base 前缀）
  - `eventImage(ev)`、`charPortrait(ch)`、`eraHero(era)`、`bookCover(b)`
  - `sortedEras()`、`eraEvents(eraId)`、`conceptGroups()`、`characterGroups()`

- [ ] **Step 1: 写 src/lib/data.mjs（完整代码）**

```js
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
```

- [ ] **Step 2: 验证模块可被 Astro 加载（后续任务构建会覆盖，此处仅快速冒烟）**

Run: `node -e "import('./src/lib/data.mjs').then(m => console.log('books:', m.books.length, 'eras:', m.eras.length))"`
Expected: `books: 3 eras: 5`（data.mjs 在 Node 下默认 BASE 为 '/'，import.meta.env 在纯 Node 加载时可能为 undefined——若报错，将 `BASE()` 改为 `(import.meta.env?.BASE_URL || '/')` 的守卫写法已内置可选链，应无碍）

- [ ] **Step 3: Commit**

```bash
git add src/lib/data.mjs
git commit -m "feat: 共享数据模块（五集合唯一入口 + base 路径 helper）"
```

---

### Task 4: 全局样式与 Base 布局

**Files:**
- Create: `src/styles/global.css`
- Create: `src/layouts/Base.astro`

**Interfaces:**
- Produces: `.site-nav/.brand/.site-footer/.hero/.page-title/.page-lead/.entry-grid/.entry-card/.start-guide/.book-strip/.book-card/.era/.era-hero/.timeline/.entry/.entry.major/.entry-year/.book-badge(.b1/.b2/.b3)/.entry-sub/.entry-summary/.entry-note/.chip/.card-grid/.concept-card/.char-grid/.char-card(.core)/.detail/.detail header/.crumb/.tagline/.block/.science/.detail-links` 样式类；`Base.astro` 接收 `title`/`description` props。

- [ ] **Step 1: 写 src/styles/global.css（完整代码，设计令牌出处见设计文档第五节）**

```css
/* ===== 设计令牌 ===== */
:root {
  --bg: #0a0e14;
  --bg-soft: #10151d;
  --ink: #e8e6e1;
  --ink-dim: #9aa0a8;
  --accent: #b8a877;          /* 红岸苍黄 */
  --accent-strong: #d8c48a;
  --line: rgba(232, 230, 225, 0.12);
  --mono: 'SFMono-Regular', 'Menlo', 'Consolas', monospace;
  --serif: 'Noto Serif SC', 'Songti SC', 'SimSun', serif;
  --sans: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --maxw: 1440px;
  --radius: 4px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 72px; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  line-height: 1.9;
  font-size: 16px;
}
img { display: block; max-width: 100%; }
a { color: inherit; text-decoration: none; }
h1, h2, h3, h4 { font-family: var(--serif); line-height: 1.35; }
main { max-width: var(--maxw); margin: 0 auto; padding: 0 24px 80px; }

/* ===== 顶部导航 ===== */
.site-nav {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: baseline; justify-content: space-between;
  max-width: var(--maxw); margin: 0 auto; padding: 20px 24px 12px;
  background: linear-gradient(var(--bg) 82%, transparent);
}
.brand { font-family: var(--serif); font-size: 22px; letter-spacing: 0.12em; color: var(--accent); }
.brand span { color: var(--ink); }
.site-nav nav a {
  margin-left: 26px; font-size: 15px; color: var(--ink-dim);
  transition: color 0.15s;
}
.site-nav nav a:hover { color: var(--accent-strong); }

/* ===== 页脚 ===== */
.site-footer {
  border-top: 1px solid var(--line);
  padding: 28px 24px 40px; text-align: center;
  color: var(--ink-dim); font-size: 13px; line-height: 1.8;
}

/* ===== 首页 ===== */
.hero { padding: 72px 0 56px; text-align: center; }
.hero h1 {
  font-size: clamp(44px, 7vw, 88px); letter-spacing: 0.16em;
  color: var(--accent); font-weight: 600;
}
.hero-lead { margin-top: 22px; font-size: clamp(16px, 2vw, 20px); color: var(--ink-dim); }
.entry-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 32px 0 64px; }
.entry-card {
  border: 1px solid var(--line); border-radius: var(--radius);
  padding: 30px 26px; background: var(--bg-soft);
  transition: border-color 0.2s, transform 0.2s;
}
.entry-card:hover { border-color: var(--accent); transform: translateY(-3px); }
.entry-card h2 { font-size: 24px; color: var(--accent-strong); margin-bottom: 10px; }
.entry-card p { color: var(--ink-dim); font-size: 14px; }
.book-strip { margin: 8px 0 72px; }
.book-strip h2, .start-guide h2 { text-align: center; font-size: 28px; margin-bottom: 24px; }
.book-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.book-card {
  display: flex; gap: 18px; align-items: center;
  border: 1px solid var(--line); border-radius: var(--radius);
  padding: 18px; background: var(--bg-soft);
}
.book-card img { width: 84px; height: 118px; object-fit: cover; border-radius: 2px; }
.book-card h3 { font-size: 20px; color: var(--accent-strong); }
.book-card p { font-size: 13px; color: var(--ink-dim); margin-top: 4px; }
.start-guide ol { max-width: 560px; margin: 0 auto; counter-reset: step; }
.start-guide li {
  list-style: none; padding: 12px 0 12px 46px; position: relative;
  font-size: 16px; color: var(--ink-dim); border-bottom: 1px dashed var(--line);
}
.start-guide li::before {
  counter-increment: step; content: counter(step);
  position: absolute; left: 0; top: 14px;
  font-family: var(--mono); font-size: 20px; color: var(--accent);
}
.start-guide b { color: var(--ink); }

/* ===== 页级标题 ===== */
.page-title { text-align: center; font-size: clamp(34px, 5vw, 56px); letter-spacing: 0.1em; margin: 48px 0 8px; }
.page-lead { text-align: center; color: var(--ink-dim); max-width: 720px; margin: 0 auto 48px; }

/* ===== 时间线页 ===== */
.era { margin-bottom: 96px; }
.era-hero {
  position: relative; height: 62vh; min-height: 380px;
  background-size: cover; background-position: center;
  display: flex; align-items: flex-end; overflow: hidden;
}
.era-hero::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(10,14,20,0.2) 0%, rgba(10,14,20,0.88) 100%);
}
.era-hero-inner { position: relative; z-index: 1; padding: 48px 32px; max-width: 1080px; }
.era-years { font-family: var(--mono); color: var(--accent-strong); font-size: 15px; letter-spacing: 0.2em; }
.era-hero h2 { font-size: clamp(34px, 5vw, 60px); color: #fff; margin: 10px 0 14px; letter-spacing: 0.1em; }
.era-intro { color: rgba(232, 230, 225, 0.85); font-size: 16px; max-width: 640px; }
.timeline {
  position: relative; margin: 0 auto; max-width: 1040px;
  padding: 40px 0 0; border-left: 1px solid var(--line);
}
.entry { position: relative; margin: 0 0 72px 34px; }
.entry::before {
  content: ''; position: absolute; left: -40px; top: 28px;
  width: 11px; height: 11px; border-radius: 50%;
  background: var(--era, var(--accent)); border: 2px solid var(--bg);
}
.entry-grid-row { display: grid; grid-template-columns: 420px 1fr; gap: 32px; align-items: start; }
.entry img.event-img { width: 100%; border-radius: var(--radius); border: 1px solid var(--line); }
.entry-year {
  font-family: var(--mono); font-size: 15px; letter-spacing: 0.14em;
  color: var(--era, var(--accent));
}
.book-badge {
  display: inline-block; padding: 1px 10px; font-size: 12px;
  border: 1px solid var(--line); border-radius: 999px; color: var(--ink-dim);
  margin: 8px 0 0 10px; vertical-align: middle;
}
.book-badge.b1 { border-color: #b8a877; color: #b8a877; }
.book-badge.b2 { border-color: #3f9e8f; color: #6fd0c0; }
.book-badge.b3 { border-color: #8f7ab8; color: #b39ae0; }
.entry h3 { font-size: clamp(22px, 3vw, 30px); margin: 10px 0 6px; }
.entry-sub { color: var(--ink-dim); font-size: 14px; margin-bottom: 12px; }
.entry-summary { font-size: 15px; color: var(--ink-dim); max-width: 720px; }
.entry-note {
  margin-top: 14px; padding: 12px 16px; font-size: 13px;
  background: rgba(184, 168, 119, 0.08); border-left: 2px solid var(--accent);
  color: var(--ink-dim);
}
.entry.major {
  margin: 0 0 96px -34px; padding: 40px 32px;
  border: 1px solid var(--line); border-left: 3px solid var(--era, var(--accent));
  background: var(--bg-soft);
}
.entry.major .entry-grid-row { grid-template-columns: 1fr; }
.entry.major img { width: 100%; max-height: 480px; object-fit: cover; }
.entry.major .entry-summary { font-size: 16px; }

/* ===== chip ===== */
.chip-row { margin-top: 16px; }
.chip-row .chip-label { font-size: 13px; color: var(--ink-dim); margin-right: 10px; }
.chip {
  display: inline-block; margin: 0 8px 8px 0; padding: 3px 12px;
  border: 1px solid var(--line); border-radius: 999px; font-size: 13px; color: var(--ink);
}
.chip:hover { border-color: var(--accent); color: var(--accent-strong); }

/* ===== 概念册 / 人物墙通用卡片网格 ===== */
.concept-group, .char-group { margin-bottom: 72px; }
.concept-group > h2, .char-group > h2 {
  font-size: 26px; color: var(--accent-strong);
  border-bottom: 1px solid var(--line); padding-bottom: 10px; margin-bottom: 22px;
}
.card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.concept-card, .char-card {
  border: 1px solid var(--line); border-radius: var(--radius);
  padding: 22px; background: var(--bg-soft);
  transition: border-color 0.2s, transform 0.2s;
}
.concept-card:hover, .char-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.concept-card h3 { font-size: 19px; color: var(--accent-strong); }
.concept-card p, .char-card p { font-size: 13px; color: var(--ink-dim); margin-top: 6px; }
.char-card { padding: 0; overflow: hidden; }
.char-card img { width: 100%; height: 300px; object-fit: cover; }
.char-card .char-meta { padding: 14px 16px; }
.char-card h3 { font-size: 18px; color: var(--accent-strong); }
.char-card.core { grid-column: span 2; }
.char-card.core img { height: 420px; }

/* ===== 详情页 ===== */
.detail header { padding: 40px 0 24px; border-bottom: 1px solid var(--line); margin-bottom: 36px; }
.crumb { font-size: 13px; color: var(--ink-dim); margin-bottom: 14px; }
.crumb a { color: var(--accent-strong); }
.detail h1 { font-size: clamp(34px, 5vw, 56px); letter-spacing: 0.08em; }
.detail .tagline { margin-top: 10px; color: var(--ink-dim); font-size: 16px; }
.detail .char-head { display: grid; grid-template-columns: 320px 1fr; gap: 40px; align-items: center; }
.detail .char-head img { width: 100%; border-radius: var(--radius); border: 1px solid var(--line); }
.block { margin-bottom: 40px; }
.block h2 {
  font-size: 22px; color: var(--accent-strong);
  margin-bottom: 12px; display: flex; align-items: center; gap: 12px;
}
.block h2::before {
  content: ''; width: 26px; height: 1px; background: var(--accent); display: inline-block;
}
.block p { color: var(--ink-dim); font-size: 15px; max-width: 860px; }
.block.science { border-left: 2px solid var(--accent); padding-left: 22px; }
.detail-links { border-top: 1px solid var(--line); padding-top: 24px; }
.detail-links h3 { font-size: 14px; color: var(--ink-dim); margin: 14px 0 10px; }

/* ===== 响应式 ===== */
@media (max-width: 900px) {
  .entry-grid, .book-cards, .card-grid { grid-template-columns: 1fr; }
  .entry-grid-row { grid-template-columns: 1fr; }
  .entry.major { margin-left: 0; }
  .detail .char-head { grid-template-columns: 1fr; }
  .char-card.core { grid-column: span 1; }
}
@media (max-width: 480px) {
  main { padding: 0 16px 60px; }
  .site-nav { padding: 14px 16px 8px; }
  .site-nav nav a { margin-left: 16px; font-size: 14px; }
  .era-hero { height: 50vh; }
}
```

- [ ] **Step 2: 写 src/layouts/Base.astro（完整代码）**

```astro
---
import '../styles/global.css';
import { pageUrl } from '../lib/data.mjs';

const { title = '三体世界图鉴', description = '顺时间线读懂三体三部曲：事件、概念、人物全景图鉴' } = Astro.props;
const nav = [
  { href: '/', label: '首页' },
  { href: '/timeline/', label: '时间线' },
  { href: '/concepts/', label: '概念册' },
  { href: '/characters/', label: '人物墙' },
];
---
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body>
    <header class="site-nav">
      <a class="brand" href={pageUrl('/')}>三体<span>世界图鉴</span></a>
      <nav>
        {nav.map((n) => <a href={pageUrl(n.href)}>{n.label}</a>)}
      </nav>
    </header>
    <main><slot /></main>
    <footer class="site-footer">
      <p>《三体》三部曲 · 刘慈欣著。本站为个人非商用科普项目，全站剧透。图片素材来自腾讯剧版宣传物料与自绘占位图，侵权请联系删除。</p>
    </footer>
  </body>
</html>
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功、dist 产物无 script 标签（`grep -r "<script" dist/ || echo "no scripts"`）。

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css src/layouts/Base.astro
git commit -m "feat: 全局样式（科学符号风设计令牌）+ Base 布局（导航/页脚/版权声明）"
```

---

### Task 5: 占位图生成管线（科学符号风 SVG）

**Files:**
- Create: `scripts/gen-placeholders.mjs`
- Create: `public/images/*.svg`（脚本产物，产物入库，保证构建无 404）

**Interfaces:**
- Produces: 文件名规则与 data.mjs helper 一一对应——`era-hero-<eraId>.svg`（1600×900）、`event-<eventId>.svg`（960×540 横版）、`portrait-<charId>.svg`（480×640 竖版）、`book-<bookId>.svg`（400×560 竖版）。接真实图时按同名替换（如腾讯剧照存为 `public/images/portrait-ye-wenjie.webp` 并给 character 填 `portrait` 字段）。

- [ ] **Step 1: 写 scripts/gen-placeholders.mjs（完整代码）**

```js
// 科学符号风占位图生成：纪元头图 / 事件图 / 人物肖像 / 书封
// 输出 public/images/，文件名规则与 src/lib/data.mjs 的 helper 一一对应
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
```

- [ ] **Step 2: 运行生成**

Run: `node scripts/gen-placeholders.mjs`
Expected: `✓ 占位图生成: 12 张 -> public/images/`（5 头图 + 0 事件 + 0 肖像 + 3 书封；数字随内容增加）

- [ ] **Step 3: 构建验证无 404**

Run: `npm run build 2>&1 | grep -i "404\|not found" || echo "no missing assets"`
Expected: `no missing assets`

- [ ] **Step 4: Commit**

```bash
git add scripts/gen-placeholders.mjs public/images/
git commit -m "feat: 科学符号风占位图管线（头图/事件/肖像/书封，同名替换接真实图）"
```

---

### Task 6: 首页

**Files:**
- Modify: `src/pages/index.astro`（重写占位 stub 为正式首页）

**Interfaces:**
- Consumes: `pageUrl/bookCover/bookById`（Task 3）、`Base`（Task 4）、书封占位图（Task 5）。
- Produces: `/` 首页，含 hero、三大入口、三部曲导读、从哪开始读。

- [ ] **Step 1: 写 src/pages/index.astro（完整代码）**

```astro
---
import Base from '../layouts/Base.astro';
import { pageUrl, imageUrl, bookCover, books } from '../lib/data.mjs';

const entries = [
  { href: '/timeline/', title: '时间线', desc: '从红岸到归零，按纪年顺着读完整个故事' },
  { href: '/concepts/', title: '概念册', desc: '黑暗森林、智子、二向箔……每条设定讲透设定与科学底子' },
  { href: '/characters/', title: '人物墙', desc: '叶文洁、罗辑、章北海、程心……每个人的来路与抉择' },
];
---
<Base title="三体世界图鉴 · 顺时间线读懂整个三体故事">
  <section class="hero">
    <h1>三体世界图鉴</h1>
    <p class="hero-lead">从「不要回答」到宇宙归零——顺着时间线，读懂刘慈欣《三体》三部曲。</p>
  </section>

  <section class="entry-grid">
    {entries.map((e) => (
      <a class="entry-card" href={pageUrl(e.href)}>
        <h2>{e.title}</h2>
        <p>{e.desc}</p>
      </a>
    ))}
  </section>

  <section class="book-strip">
    <h2>三部曲</h2>
    <div class="book-cards">
      {books.sort((a, b) => a.order - b.order).map((b) => (
        <div class="book-card">
          <img src={imageUrl(bookCover(b))} alt={b.title} loading="lazy" />
          <div>
            <h3>{b.title}</h3>
            {b.subtitle && <p>{b.subtitle}</p>}
            <p>{b.intro}</p>
          </div>
        </div>
      ))}
    </div>
  </section>

  <section class="start-guide">
    <h2>从哪开始读</h2>
    <ol>
      <li>先读<b>时间线</b>，建立三部曲的完整框架</li>
      <li>遇到陌生概念，点进<b>概念册</b>看设定与科学底子</li>
      <li>遇到人物，点进<b>人物墙</b>看他的故事与关键抉择</li>
    </ol>
  </section>
</Base>
```

- [ ] **Step 2: 构建 + 截图自检**

Run: `npm run build && npm run preview`（或 `npm run dev`），浏览器打开 `/`，对照设计文档 4.1 检查：hero 大标题、三大入口卡、三部曲卡片（书封可见）、三步指引。

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: 首页（定位 hero + 三入口 + 三部曲导读 + 新手指引）"
```

---

### Task 7: 时间线页（核心页面，先攻难点）

**Files:**
- Create: `src/pages/timeline.astro`

**Interfaces:**
- Consumes: `sortedEras/eraEvents/bookById/characterById/conceptById/pageUrl/imageUrl/eventImage/eraHero`（Task 3）、`Base`（Task 4）、占位图（Task 5）。
- Produces: `/timeline/` 纵向长卷：5 纪元章（全宽头图 + 主题色 + 导读）→ 章节内时间轴条目（所属书徽标 + 纪年 + 梗概 + 人物/概念 chip + 大事件全宽版）。

- [ ] **Step 1: 写 src/pages/timeline.astro（完整代码）**

```astro
---
import Base from '../layouts/Base.astro';
import {
  sortedEras, eraEvents, bookById, characterById, conceptById,
  pageUrl, imageUrl, eventImage, eraHero,
} from '../lib/data.mjs';

const Chips = ({ ev }) => (
  <>
    {ev.characters.length > 0 && (
      <div class="chip-row">
        <span class="chip-label">人物</span>
        {ev.characters.map((cid) => (
          <a class="chip" href={pageUrl(`/characters/${cid}/`)}>{characterById.get(cid).name}</a>
        ))}
      </div>
    )}
    {ev.concepts.length > 0 && (
      <div class="chip-row">
        <span class="chip-label">概念</span>
        {ev.concepts.map((cid) => (
          <a class="chip" href={pageUrl(`/concepts/${cid}/`)}>{conceptById.get(cid).name}</a>
        ))}
      </div>
    )}
  </>
);
---
<Base title="时间线 · 三体世界图鉴" description="按纪元年表顺着读完三体三部曲：红岸与危机 → 威慑 → 广播 → 掩体 → 银河与归零。">
  <h1 class="page-title">时间线</h1>
  <p class="page-lead">按纪元年表顺着读：红岸与危机 → 威慑纪元 → 广播纪元 → 掩体纪元 → 银河纪元与归零。每条标注所属书。</p>

  {sortedEras().map((era) => {
    const list = eraEvents(era.id);
    return (
      <section class="era" id={`era-${era.id}`} style={`--era:${era.color};--era-soft:${era.colorSoft}`}>
        <div class="era-hero" style={`background-image:url('${imageUrl(eraHero(era))}')`}>
          <div class="era-hero-inner">
            <p class="era-years">{era.years}</p>
            <h2>{era.name}</h2>
            <p class="era-intro">{era.intro}</p>
          </div>
        </div>
        <div class="timeline">
          {list.map((ev) => {
            const book = bookById.get(ev.bookId);
            const badge = <span class={`book-badge b${book.order}`}>{book.title}</span>;
            const body = (
              <div class="entry-body">
                <p class="entry-year">{ev.yearLabel}</p>
                {badge}
                <h3>{ev.title}</h3>
                {ev.subtitle && <p class="entry-sub">{ev.subtitle}</p>}
                <p class="entry-summary">{ev.summary}</p>
                <Chips ev={ev} />
                {ev.note && <p class="entry-note">{ev.note}</p>}
              </div>
            );
            return ev.isMajorEvent ? (
              <article class="entry major" id={ev.id}>
                <img class="event-img" src={imageUrl(eventImage(ev))} alt={ev.title} loading="lazy" />
                {body}
              </article>
            ) : (
              <article class="entry" id={ev.id}>
                <div class="entry-grid-row">
                  <img class="event-img" src={imageUrl(eventImage(ev))} alt={ev.title} loading="lazy" />
                  {body}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  })}
</Base>
```

- [ ] **Step 2: 构建 + 视觉走查**

Run: `npm run build && npm run dev`
检查（对照设计文档 4.2）：每章全宽头图 + heroTitle 大字可见、章主题色生效（时间轴脊/纪年/徽标换色）、条目左右分栏（图 420px + 文）、所属书徽标三种配色、大事件全宽条目、chip 可跳转、章内锚点 `id` 就位、375px 不破版。

- [ ] **Step 3: Commit**

```bash
git add src/pages/timeline.astro
git commit -m "feat: 时间线页（纪年分章/所属书徽标/大事件全宽/人物概念互链）"
```

---

### Task 8: 概念册两页

**Files:**
- Create: `src/pages/concepts/index.astro`
- Create: `src/pages/concepts/[id].astro`

**Interfaces:**
- Consumes: `conceptGroups/conceptById/characterById/eventById/pageUrl`（Task 3）。
- Produces: `/concepts/` 分组卡片墙；`/concepts/<id>/` 双区块详情（书里怎么讲 / 科学底子）+ 相关概念/人物/事件互链。

- [ ] **Step 1: 写 src/pages/concepts/index.astro（完整代码）**

```astro
---
import Base from '../../layouts/Base.astro';
import { conceptGroups, pageUrl } from '../../lib/data.mjs';
---
<Base title="概念册 · 三体世界图鉴" description="三体世界的法则理论、科技器物、组织文明——每条讲清『书里怎么讲』与『科学底子』。">
  <h1 class="page-title">概念册</h1>
  <p class="page-lead">三体的魅力在思想。每一条设定：书里怎么讲 + 科学底子（真实科学 vs 文学发挥，通俗不较真）。</p>
  {conceptGroups().map((g) => (
    <section class="concept-group">
      <h2>{g.title}</h2>
      <div class="card-grid">
        {g.items.map((c) => (
          <a class="concept-card" href={pageUrl(`/concepts/${c.id}/`)}>
            <h3>{c.name}</h3>
            <p>{c.tagline}</p>
          </a>
        ))}
      </div>
    </section>
  ))}
</Base>
```

- [ ] **Step 2: 写 src/pages/concepts/[id].astro（完整代码）**

```astro
---
import Base from '../../layouts/Base.astro';
import { concepts, conceptById, characterById, eventById, pageUrl } from '../../lib/data.mjs';

export function getStaticPaths() {
  return concepts.map((c) => ({ params: { id: c.id } }));
}

const { id } = Astro.params;
const c = conceptById.get(id);
const groupTitles = { law: '法则与理论', tech: '科技与器物', org: '组织与文明' };
---
<Base title={`${c ? c.name : '未找到'} · 概念册 · 三体世界图鉴`}>
  {c && (
    <article class="detail">
      <header>
        <p class="crumb"><a href={pageUrl('/concepts/')}>概念册</a> / {groupTitles[c.group]}</p>
        <h1>{c.name}</h1>
        <p class="tagline">{c.tagline}</p>
      </header>
      <section class="block">
        <h2>书里怎么讲</h2>
        <p>{c.inBook}</p>
      </section>
      <section class="block science">
        <h2>科学底子</h2>
        <p>{c.science}</p>
      </section>
      <footer class="detail-links">
        {c.related.length > 0 && (
          <div>
            <h3>相关概念</h3>
            {c.related.map((rid) => <a class="chip" href={pageUrl(`/concepts/${rid}/`)}>{conceptById.get(rid).name}</a>)}
          </div>
        )}
        {c.characters.length > 0 && (
          <div>
            <h3>相关人物</h3>
            {c.characters.map((cid) => <a class="chip" href={pageUrl(`/characters/${cid}/`)}>{characterById.get(cid).name}</a>)}
          </div>
        )}
        {c.events.length > 0 && (
          <div>
            <h3>相关事件</h3>
            {c.events.map((eid) => <a class="chip" href={pageUrl(`/timeline/#${eid}`)}>{eventById.get(eid).title}</a>)}
          </div>
        )}
      </footer>
    </article>
  )}
</Base>
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: `/concepts/` 与 `/concepts/<id>/` 路由生成（当前概念为空，页面只显示分组标题；Task 10 灌内容后复查）。

- [ ] **Step 4: Commit**

```bash
git add src/pages/concepts/
git commit -m "feat: 概念册（三组卡片墙 + 双区块详情 + 相关互链）"
```

---

### Task 9: 人物墙两页

**Files:**
- Create: `src/pages/characters/index.astro`
- Create: `src/pages/characters/[id].astro`

**Interfaces:**
- Consumes: `characterGroups/characterById/eventById/conceptById/pageUrl/imageUrl/charPortrait`（Task 3）。
- Produces: `/characters/` 四组分群网格（core 双倍大卡）；`/characters/<id>/` 四段式详情（他是谁/他的作用/他的故事线/关键抉择）+ 相关事件/概念互链。

- [ ] **Step 1: 写 src/pages/characters/index.astro（完整代码）**

```astro
---
import Base from '../../layouts/Base.astro';
import { characterGroups, pageUrl, imageUrl, charPortrait } from '../../lib/data.mjs';
---
<Base title="人物墙 · 三体世界图鉴" description="叶文洁、罗辑、章北海、程心、云天明……三体世界里每个人的来路、作用与关键抉择。">
  <h1 class="page-title">人物墙</h1>
  <p class="page-lead">每个人都背负着一个时代的抉择。点进去，看他的故事线。</p>
  {characterGroups().map((g) => (
    <section class="char-group">
      <h2>{g.title}</h2>
      <div class="card-grid">
        {g.items.map((c) => (
          <a class={`char-card${c.isCore ? ' core' : ''}`} href={pageUrl(`/characters/${c.id}/`)}>
            <img src={imageUrl(charPortrait(c))} alt={c.name} loading="lazy" />
            <div class="char-meta">
              <h3>{c.name}</h3>
              <p>{c.tagline}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  ))}
</Base>
```

- [ ] **Step 2: 写 src/pages/characters/[id].astro（完整代码）**

```astro
---
import Base from '../../layouts/Base.astro';
import { characters, characterById, eventById, conceptById, pageUrl, imageUrl, charPortrait } from '../../lib/data.mjs';

export function getStaticPaths() {
  return characters.map((c) => ({ params: { id: c.id } }));
}

const { id } = Astro.params;
const c = characterById.get(id);
---
<Base title={`${c ? c.name : '未找到'} · 人物墙 · 三体世界图鉴`}>
  {c && (
    <article class="detail">
      <header>
        <p class="crumb"><a href={pageUrl('/characters/')}>人物墙</a></p>
        <div class="char-head">
          <img src={imageUrl(charPortrait(c))} alt={c.name} />
          <div>
            <h1>{c.name}</h1>
            <p class="tagline">{c.tagline}</p>
          </div>
        </div>
      </header>
      <section class="block">
        <h2>他是谁</h2>
        <p>{c.who}</p>
      </section>
      <section class="block">
        <h2>他的作用</h2>
        <p>{c.role}</p>
      </section>
      <section class="block">
        <h2>他的故事线</h2>
        <p>{c.storyline}</p>
      </section>
      {c.choices && (
        <section class="block science">
          <h2>关键抉择</h2>
          <p>{c.choices}</p>
        </section>
      )}
      <footer class="detail-links">
        {c.events.length > 0 && (
          <div>
            <h3>相关事件</h3>
            {c.events.map((eid) => <a class="chip" href={pageUrl(`/timeline/#${eid}`)}>{eventById.get(eid).title}</a>)}
          </div>
        )}
        {c.concepts.length > 0 && (
          <div>
            <h3>相关概念</h3>
            {c.concepts.map((cid) => <a class="chip" href={pageUrl(`/concepts/${cid}/`)}>{conceptById.get(cid).name}</a>)}
          </div>
        )}
      </footer>
    </article>
  )}
</Base>
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: `/characters/` 与 `/characters/<id>/` 路由生成；当前人物为空只显示分组标题，Task 10 后复查。

- [ ] **Step 4: Commit**

```bash
git add src/pages/characters/
git commit -m "feat: 人物墙（四组网格/核心大卡 + 四段式详情 + 事件概念互链）"
```

---

### Task 10: 内容批次 1——《三体》（最大工作量开始）

**Files:**
- Modify: `content/events.json`、`content/concepts.json`、`content/characters.json`

**内容模板（全批次统一口径，弯引号「」，全剧透，路人视角）：**

- **event**：`summary` 150–250 字，讲清「发生了什么 + 和前后剧情的因果」；`subtitle` 可空；`note` 可空（灰底注解，如剧版差异/原文出处）；`isMajorEvent` 必填布尔；`image` 留空（用占位图）。
- **concept**：`inBook` 150–300 字（设定 + 剧情中如何登场）；`science` 80–150 字（真实科学对应物 vs 文学发挥，通俗不较真，不确定明说「此为科幻假设」）。
- **character**：`who` 150–200 字；`role` 120–200 字；`storyline` 按时间线叙述出场与走向；`choices` 核心人物必写（关键抉择分析），配角可留 `""`。
- **双向链接必须两边同时写**：event.characters ↔ character.events、event.concepts ↔ concept.events、character.concepts ↔ concept.characters、concept.related 概念↔概念对称——validate 会抓不对称，一次写对。
- 图片：本批人物（叶文洁/汪淼/史强等）腾讯剧照如用户后续提供，填入 `portrait` 字段并放文件；默认留空用占位图。

**本批清单（数量/顺序以原著为准，审校环节修正归属）：**

《三体》事件（bookId=`threebody`，eraId=`era-crisis`）：

| id | 标题 | major |
|---|---|---|
| red-coast-foundation | 红岸基地建立 | |
| ye-wenjie-redcoast | 叶文洁初入红岸 | |
| solar-amplifier-launch | 第一次向宇宙发射 | ★ |
| trisolaran-reply | 三体人的警告与回应 | |
| wang-miao-countdown | 汪淼与倒计时 | |
| three-body-game | 三体游戏 | |
| eto-gathering | ETO 的凝聚 | |
| scientists-deaths | 科学家自杀疑云 | |
| sophon-blockade | 智子抵达与基础科学封锁 | ★ |
| universe-flicker | 宇宙闪烁 | |
| gu-zheng-operation | 古筝行动 | ★ |
| eto-fall | ETO 覆灭与叶文洁被捕 | |
| trisolaran-fleet-launch | 三体舰队启航 | |
| luo-ji-ye-wenjie | 罗辑与叶文洁：宇宙社会学 | |
| luo-ji-car-crash | 罗辑遇袭与死里逃生 | |
| luo-ji-facewall | 罗辑成为面壁者 | ★ |
| crisis-era-begins | 危机纪元与全球备战 | |

《三体》概念（group 见列）：

| id | 名称 | group |
|---|---|---|
| three-body-problem | 三体问题 | law |
| chaotic-era | 恒纪元与乱纪元 | law |
| cosmic-sociology | 宇宙社会学 | law |
| red-coast | 红岸基地 | tech |
| solar-amplifier | 太阳放大器 | tech |
| sophon | 智子 | tech |
| three-body-game | 三体游戏 | tech |
| human-column-computer | 人列计算机 | tech |
| nanofiber | 飞刃 | tech |
| dehydration | 脱水 | tech |
| eto | ETO 地球三体组织 | org |
| trisolaran-civilization | 三体文明 | org |
| scientific-boundary | 科学边界 | org |

《三体》人物（group 见列，★=isCore 双倍大卡）：

| id | 姓名 | group |
|---|---|---|
| ye-wenjie | 叶文洁 | origin ★ |
| wang-miao | 汪淼 | origin |
| shi-qiang | 史强 | origin |
| shen-yufei | 申玉菲 | origin |
| luo-ji | 罗辑 | face ★ |
| evans | 伊文斯 | eto |
| pan-han | 潘寒 | eto |
| chang-weisi | 常伟思 | support |
| yang-dong | 杨冬 | support |

- [ ] **Step 1: 灌入数据**

按模板补齐上表全部条目的全字段文案，写入三个 JSON；`bookId`/`eraId` 全部用 `threebody`/`era-crisis`；双向链接一次写全。

- [ ] **Step 2: 校验 + self-test（必须全绿）**

Run: `node scripts/validate-content.mjs && node scripts/validate-content.mjs --self-test`
Expected: `✓ 校验通过: 3 书 / 5 章 / 17 事件 / 13 概念 / 9 人物` + `✓ self-test 通过`（数字以实际为准）
若有「双向链接不对称」报错：补齐反向引用后重跑。

- [ ] **Step 3: 重新生成占位图 + 构建**

Run: `node scripts/gen-placeholders.mjs && npm run build 2>&1 | grep -i "404\|not found" || echo "no missing assets"`
Expected: 占位图计数增加、`no missing assets`

- [ ] **Step 4: 事实审校（三类高频错误逐条过）**

情节事实错误 / 物理概念表述错误 / 书与纪元错位。发现问题即改，改完重跑 Step 2。

- [ ] **Step 5: Commit**

```bash
git add content/ public/images/
git commit -m "feat: 内容批次1《三体》灌入（17事件/13概念/9人物）"
```

---

### Task 11: 内容批次 2——《黑暗森林》

**Files:**
- Modify: `content/events.json`、`content/concepts.json`、`content/characters.json`

**模板与校验流程同 Task 10（Step 2–4 一致执行）。**

**本批清单：**

《黑暗森林》事件（bookId=`dark-forest`；前 10 条 eraId=`era-crisis` 危机纪元，后 2 条 eraId=`era-deterrence` 威慑纪元）：

| id | 标题 | era | major |
|---|---|---|---|
| face-wall-plan | 面壁计划启动 | crisis | |
| wall-breakers | 破壁人降临 | crisis | |
| luo-ji-idyll | 罗辑的世外桃源 | crisis | |
| thought-stamp | 思想钢印 | crisis | |
| zhang-beihai-future | 章北海：增援未来 | crisis | |
| curse-broadcast | 罗辑的诅咒广播 | crisis | |
| dark-forest-confirmed | 黑暗森林得到验证 | crisis | ★ |
| droplet-arrival | 水滴抵达太阳系 | crisis | |
| droplet-massacre | 末日战役：水滴屠灭舰队 | crisis | ★ |
| zhang-beihai-escape | 自然选择号叛逃 | crisis | |
| luo-ji-deterrence | 执剑人：威慑建立 | deterrence | ★ |
| deterrence-era-peace | 六十二年和平 | deterrence | |

《黑暗森林》概念：

| id | 名称 | group |
|---|---|---|
| dark-forest | 黑暗森林法则 | law |
| suspect-chain | 猜疑链 | law |
| tech-explosion | 技术爆炸 | law |
| droplet | 水滴 | tech |
| thought-stamp | 思想钢印 | tech |
| gravity-broadcast | 引力波广播 | tech |
| deterrence | 黑暗森林威慑 | tech |
| sword-holder | 执剑人 | tech |
| face-wall-plan | 面壁计划 | org |
| fleet-international | 地球舰队国际 | org |

《黑暗森林》人物：

| id | 姓名 | group |
|---|---|---|
| zhang-beihai | 章北海 | face ★ |
| hines | 希恩斯 | face |
| rey-diaz | 雷迪亚兹 | face |
| tyler | 泰勒 | face |
| ding-yi | 丁仪 | support |
| zhuang-yan | 庄颜 | support |

- [ ] **Step 1–4: 灌入 → 校验 → 占位图+构建 → 审校（同 Task 10）**

Run: `node scripts/validate-content.mjs && node scripts/validate-content.mjs --self-test && node scripts/gen-placeholders.mjs && npm run build`
Expected: 校验全绿、self-test 通过、构建无 404

- [ ] **Step 5: Commit**

```bash
git add content/ public/images/
git commit -m "feat: 内容批次2《黑暗森林》灌入（12事件/10概念/6人物）"
```

---

### Task 12: 内容批次 3——《死神永生》

**Files:**
- Modify: `content/events.json`、`content/concepts.json`、`content/characters.json`

**模板与校验流程同 Task 10。**

**本批清单：**

《死神永生》事件（bookId=`deaths-end`；era 分布见列）：

| id | 标题 | era | major |
|---|---|---|---|
| ladder-plan | 阶梯计划：云天明的大脑 | deterrence | |
| yun-tianming-chengxin | 云天明与程心 | deterrence | |
| cheng-xin-awake | 程心苏醒与执剑人竞选 | deterrence | |
| deterrence-failure | 威慑失败：程心放下开关 | broadcast | ★ |
| broadcast-of-coordinates | 引力波广播：坐标暴露 | broadcast | ★ |
| trisolaris-destroyed | 三体母星覆灭 | broadcast | ★ |
| fairy-tales | 云天明童话 | broadcast | |
| shelter-era-begins | 掩体纪元：太阳系太空城 | shelter | |
| singer-two-dimensional | 歌者的二向箔：太阳系二维化 | shelter | ★ |
| cheng-xin-escape | 程心与艾AA 逃离太阳系 | shelter | |
| black-domain-roji | 罗辑的黑域与留守 | shelter | |
| galaxy-era-meeting | 银河纪元：程心与云天明相会 | galaxy | |
| returner-return | 归零者与回归运动 | galaxy | |
| mini-universe | 小宇宙与生态球 | galaxy | |
| universe-restart | 宇宙的最后：归零与重生 | galaxy | ★ |

《死神永生》概念：

| id | 名称 | group |
|---|---|---|
| dimensional-reduction | 降维打击 | law |
| return-to-zero | 宇宙归零 | law |
| ladder-plan | 阶梯计划 | tech |
| curvature-drive | 曲率驱动 | tech |
| lightspeed-ship | 光速飞船 | tech |
| black-domain | 黑域 | tech |
| two-dimensional-foil | 二向箔 | tech |
| singer | 歌者文明 | org |
| returner | 归零者 | org |
| mini-universe | 小宇宙 | org |
| shelter-plan | 掩体计划 | org |

《死神永生》人物：

| id | 姓名 | group |
|---|---|---|
| cheng-xin | 程心 | face ★ |
| yun-tianming | 云天明 | face ★ |
| ai-aa | 艾AA | support |
| guan-yifan | 关一帆 | support |
| ge-zhe | 歌者 | eto |

- [ ] **Step 1–4: 灌入 → 校验 → 占位图+构建 → 审校（同 Task 10）**

Run: `node scripts/validate-content.mjs && node scripts/validate-content.mjs --self-test && node scripts/gen-placeholders.mjs && npm run build`
Expected: 校验全绿、self-test 通过、构建无 404

- [ ] **Step 5: Commit**

```bash
git add content/ public/images/
git commit -m "feat: 内容批次3《死神永生》灌入（15事件/11概念/5人物）"
```

---

### Task 13: 收尾验证与 README

**Files:**
- Create: `README.md`

- [ ] **Step 1: 全量校验 + 构建**

Run: `node scripts/validate-content.mjs && node scripts/validate-content.mjs --self-test && npm run build`
Expected: 校验绿（约 3 书 / 5 章 / 44+ 事件 / 34+ 概念 / 20 人物）+ self-test 通过 + 构建零报错

- [ ] **Step 2: 零客户端 JS 检查**

Run: `grep -rl "<script" dist/ || echo "no script tags"`
Expected: `no script tags`

- [ ] **Step 3: 全站视觉走查（对照设计文档第四节全清单）**

`npm run dev` 起服务逐页过：首页 / 时间线 5 章（头图、主题色、所属书徽标、大事件、chip 跳转）/ 概念册三组 / 概念详情双区块 / 人物墙四组与核心大卡 / 人物详情四段式 / 详情页互链回时间线锚点；375px 移动端不破版。

- [ ] **Step 4: 写 README.md（完整内容）**

```markdown
# 三体世界图鉴

顺时间线读懂刘慈欣《三体》三部曲的纯静态科普站：时间线（纪年分章）+ 概念册（书里怎么讲 / 科学底子）+ 人物墙（四段式）。全站剧透，以小说为唯一正史。

## 运行

- 安装：`npm install`
- 开发：`npm run dev`（默认 http://localhost:4321）
- 构建：`npm run build`（产物 dist/）
- 校验：`npm run validate`（引用完整性 + 双向链接对称，加 `--self-test` 自检）
- 占位图：`npm run placeholders`（科学符号风 SVG，输出 public/images/）

## 内容结构

- `content/books.json` 三部曲 / `content/eras.json` 纪年 5 章 / `content/events.json` 时间线条目 / `content/concepts.json` 概念 / `content/characters.json` 人物
- 全部以 id 互链：事件↔人物、事件↔概念、人物↔概念、概念↔概念，改数据后必须跑 `npm run validate`

## 如何加条目

1. 在对应 JSON 按现有条目字段模板新增 id 与文案（中文一律弯引号「」）
2. 双向链接两边同时写（validate 会抓不对称）
3. `npm run validate && npm run placeholders && npm run build`

## 如何接真实图片

占位图按 `event-<id>.svg` / `portrait-<id>.svg` / `era-hero-<id>.svg` / `book-<id>.svg` 命名：
- 人物有腾讯剧照：图片存 `public/images/portrait-<id>.webp`，并在人物 JSON 填 `portrait: "/images/portrait-<id>.webp"`
- 事件有剧照：存 `public/images/event-<id>.webp`，填 `image` 字段
- 站内所有链接/图片已统一 base 前缀处理，部署子路径时设 `BASE_PATH` 环境变量即可

## 部署

Vercel / Cloudflare Pages / GitHub Pages 均可：构建命令 `npm run build`，输出目录 `dist/`；子路径部署设置环境变量 `BASE_PATH`（如 `/threebody/`）。
```

- [ ] **Step 5: Final commit**

```bash
git add README.md
git commit -m "docs: README（运行/内容结构/加条目/接真实图片/部署）"
```

## 交付标准（对照设计文档）

- [ ] 时间线：5 章纪年分章 + 章主题色 + 全宽头图 + 描边纪年 + 所属书徽标（三色）+ 大事件全宽条目 + 人物/概念 chip 互链
- [ ] 概念册：三组（法则理论/科技器物/组织文明）+ 双区块详情（书里怎么讲/科学底子）+ 相关互链
- [ ] 人物墙：四组 + 核心双倍大卡 + 四段式详情（他是谁/作用/故事线/关键抉择）
- [ ] 三者互链闭环：时间线↔概念↔人物，详情页跳时间线锚点
- [ ] 纯小说正史口径、全站剧透；科学底子通俗不较真
- [ ] 数据校验 + self-test 全绿、构建零报错、零客户端 JS、375px 不破版
- [ ] 占位图全部命中（无 404），同名替换机制就位
