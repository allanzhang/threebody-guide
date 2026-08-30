# 漫威电影世界图鉴 · 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 按已确认的设计文档（docs/plans/2026-08-22-marvel-guide-website-design.md）实现 M1 版本——纯静态 Astro 网站，包含时间线页、人物墙、人物详情页三大页面，灌入无限传奇（Phase 1-3，23 部电影）完整内容。

**Architecture:** Astro 静态生成（零客户端 JS）+ 手写 CSS + 三个 JSON 数据集合（eras/movies/characters）以 id 互链，构建时由 Astro 组件读取 JSON 渲染全部页面。数据引用完整性由独立校验脚本保证。

**Tech Stack:** Astro 5.x、原生 CSS、Node 22（managed runtime）。无任何前端框架、无 JS 交互。

**设计文档:** docs/plans/2026-08-22-marvel-guide-website-design.md（所有视觉与内容决策以此为准）

**运行环境约束:**

- Node 一律使用 `/Users/allan/.workbuddy/binaries/node/versions/22.22.2/bin/node`，npm 用同目录下的 npm
- 包安装在本项目目录内（普通 `npm install`，无全局安装）
- 仓库已初始化：/Users/allan/WorkBuddy/2026-08-22-23-14-45（main 分支，已有设计文档 commit）

## 关键实施决策

1. **占位海报**：无 TMDB API key，M1 用脚本按时代主题色生成 SVG 占位海报（大字片名排版），存 `public/posters/`。后续接真实海报时替换同名文件即可，代码零改动
2. **测试策略**：`scripts/validate-content.mjs` 做数据引用完整性校验（唯一测试逻辑）+ `npm run build` 作为集成验证；样式通过构建后视觉自检
3. **M1 内容范围**：无限传奇 23 部（钢铁侠1 → 蜘蛛侠：英雄远征），4 个时代篇章，约 35 个角色完整三段式文案

## 文件结构（最终形态）

```
/Users/allan/WorkBuddy/2026-08-22-23-14-45/
├── package.json
├── astro.config.mjs
├── content/
│   ├── eras.json          # 时代篇章
│   ├── movies.json        # 电影（23部）
│   └── characters.json    # 人物（~35人）
├── scripts/
│   ├── validate-content.mjs   # 数据引用完整性校验
│   └── gen-placeholders.mjs   # 生成SVG占位海报
├── public/
│   ├── posters/           # 每部电影 poster-<movieId>.svg
│   └── portraits/         # 每个人物 portrait-<charId>.svg
└── src/
    ├── styles/global.css  # 设计令牌 + 全局样式
    ├── layouts/Base.astro
    └── pages/
        ├── index.astro            # 首页
        ├── timeline.astro         # 时间线页
        └── characters/
            ├── index.astro        # 人物墙
            └── [id].astro         # 人物详情
```

## 数据 Schema

```jsonc
// content/eras.json
[
  {
    "id": "era-ww2",              // 唯一id
    "name": "远古与二战",           // 篇章名
    "tagline": "超级士兵与世界初醒",  // 头图副标题
    "years": "公元前1260年 – 1945年",
    "startYear": -1260,           // 排序用
    "color": "#3e4a3d",           // 主题色（暗军绿）
    "colorSoft": "#e8ece7",       // 主题色浅底（注解框/背景装饰）
    "intro": "篇章导读，3-4行，路人视角讲清这个时代发生了什么、为什么重要",
    "heroTitle": "一切从这里开始"
  }
]

// content/movies.json
[
  {
    "id": "captain-america-first-avenger",
    "title": "美国队长：复仇者先锋",
    "subtitle": "二战篇章",
    "year": 1943,                  // 剧情年份（排序键）
    "yearLabel": "1943",
    "eraId": "era-ww2",
    "isMajorEvent": false,         // true = 全宽特别条目
    "summary": "150-250字剧情梗概，讲清发生了什么、和前后剧情的因果",
    "characters": ["steve-rogers", "peggy-carter", "red-skull"],
    "crossUniverseNote": "可选。跨宇宙/版权方解释，显示为灰底注解框",
    "order": 1                     // 年份相同时的次级排序
  }
]

// content/characters.json
[
  {
    "id": "steve-rogers",
    "name": "史蒂夫·罗杰斯",
    "alias": "美国队长",
    "tagline": "复仇者领袖 / 超级士兵",   // 卡片身份标签
    "group": "avengers-core",      // avengers-core|solo|guardians|mystic|villains|support
    "isCoreSix": true,             // 人物墙双倍大卡
    "universe": "sacred",          // sacred=MCU神圣时间线，其他值显示宇宙标签
    "who": "他是谁，150-200字，路人视角白话",
    "role": "他的作用，讲清叙事角色和关键抉择",
    "storyline": "他的故事线，按时序的文字叙述",
    "movies": ["captain-america-first-avenger", "avengers-1"]
  }
]
```

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `astro.config.mjs`, `.gitignore`

**Step 1: 写 package.json**

```json
{
  "name": "marvel-guide",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "validate": "node scripts/validate-content.mjs"
  },
  "dependencies": {
    "astro": "^5.0.0"
  }
}
```

**Step 2: 写 astro.config.mjs**

```js
import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://example.com',
  compressHTML: true
});
```

**Step 3: 写 .gitignore**

```
node_modules/
dist/
.astro/
```

**Step 4: 安装依赖并验证**

Run: `cd /Users/allan/WorkBuddy/2026-08-22-23-14-45 && /Users/allan/.workbuddy/binaries/node/versions/22.22.2/bin/npm install`
Expected: 安装成功，生成 node_modules 和 package-lock.json

**Step 5: Commit**

```bash
git add package.json astro.config.mjs .gitignore package-lock.json
git commit -m "chore: Astro 项目脚手架"
```

## Task 2: 数据 Schema + 校验脚本（TDD：先写校验，再写数据）

**Files:**
- Create: `scripts/validate-content.mjs`
- Create: `content/eras.json`, `content/movies.json`, `content/characters.json`（先放最小种子数据）

**Step 1: 写校验脚本 scripts/validate-content.mjs**

```js
// 数据引用完整性校验。任何一项失败即退出码 1。
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../content/${p}`, import.meta.url), 'utf8'));
const eras = read('eras.json');
const movies = read('movies.json');
const characters = read('characters.json');
const errors = [];
const err = (msg) => errors.push(msg);

// 唯一性
const checkUnique = (arr, key, label) => {
  const seen = new Set();
  for (const item of arr) {
    if (seen.has(item.id)) err(`${label} id 重复: ${item.id}`);
    seen.add(item.id);
    if (!item.id) err(`${label} 缺少 id`);
  }
};
checkUnique(eras, 'id', 'era');
checkUnique(movies, 'id', 'movie');
checkUnique(characters, 'id', 'character');

// 必填字段
for (const m of movies) {
  for (const f of ['title', 'year', 'yearLabel', 'eraId', 'summary', 'characters']) {
    if (m[f] === undefined) err(`movie ${m.id} 缺字段 ${f}`);
  }
}
for (const c of characters) {
  for (const f of ['name', 'alias', 'tagline', 'group', 'who', 'role', 'storyline', 'movies']) {
    if (c[f] === undefined) err(`character ${c.id} 缺字段 ${f}`);
  }
}
for (const e of eras) {
  for (const f of ['name', 'years', 'startYear', 'color', 'colorSoft', 'intro']) {
    if (e[f] === undefined) err(`era ${e.id} 缺字段 ${f}`);
  }
}

// 引用完整性
const eraIds = new Set(eras.map(e => e.id));
const movieIds = new Set(movies.map(m => m.id));
const charIds = new Set(characters.map(c => c.id));
const groupAllowed = new Set(['avengers-core', 'solo', 'guardians', 'mystic', 'villains', 'support']);

for (const m of movies) {
  if (!eraIds.has(m.eraId)) err(`movie ${m.id} 引用了不存在的 eraId: ${m.eraId}`);
  for (const cid of m.characters) {
    if (!charIds.has(cid)) err(`movie ${m.id} 引用了不存在的人物: ${cid}`);
  }
}
for (const c of characters) {
  if (!groupAllowed.has(c.group)) err(`character ${c.id} 非法分组: ${c.group}`);
  for (const mid of c.movies) {
    if (!movieIds.has(mid)) err(`character ${c.id} 引用了不存在的电影: ${mid}`);
  }
}
// 双向一致性：电影引用的人物，其 movies 列表也应包含该电影
for (const m of movies) {
  for (const cid of m.characters) {
    const c = characters.find(x => x.id === cid);
    if (c && !c.movies.includes(m.id)) err(`双向链接断裂: ${c.id}.movies 缺少 ${m.id}`);
  }
}

if (errors.length) {
  console.error(`✗ 校验失败，${errors.length} 个问题:\n` + errors.map(e => '  - ' + e).join('\n'));
  process.exit(1);
}
console.log(`✓ 校验通过: ${eras.length} 篇章 / ${movies.length} 部电影 / ${characters.length} 个人物，全部引用有效`);
```

**Step 2: 写最小种子数据（era 1 个 / movie 1 部 / character 2 人，字段完整且互链正确）**

按上文 Schema 写入三个 JSON。

**Step 3: 运行校验验证通过**

Run: `cd /Users/allan/WorkBuddy/2026-08-22-23-14-45 && /Users/allan/.workbuddy/binaries/node/versions/22.22.2/bin/node scripts/validate-content.mjs`
Expected: `✓ 校验通过: 1 篇章 / 1 部电影 / 2 个人物`

**Step 4: 故意制造一处坏引用验证校验能抓到**

临时把某 movie 的 characters 加一个 `ghost-id`，重新运行。
Expected: `✗ 校验失败`，列出 `movie ... 引用了不存在的人物: ghost-id`。验证后还原。

**Step 5: Commit**

```bash
git add scripts/validate-content.mjs content/
git commit -m "feat: 数据 schema 与引用完整性校验脚本"
```

## Task 3: 全局样式与设计令牌

**Files:**
- Create: `src/styles/global.css`
- Create: `src/layouts/Base.astro`

**Step 1: 写 global.css（设计令牌核心）**

```css
:root {
  /* 版式 */
  --w-wide: 1440px;          /* 宽屏容器 */
  --w-text: 680px;           /* 长文阅读宽度（梗概段落用） */
  --gap: 24px;
  /* 字体 */
  --font-serif: 'Noto Serif SC', 'Songti SC', serif;
  --font-sans: 'PingFang SC', 'Helvetica Neue', sans-serif;
  /* 全站色 */
  --ink: #17181a;
  --ink-soft: #55585e;
  --paper: #f7f6f3;
  --line: #d8d5cf;
  --accent: #b02a1e;          /* 全站主强调色（钢铁红） */
  /* 字号层级 */
  --fs-hero: clamp(48px, 7vw, 96px);      /* 篇章头图大标题 */
  --fs-year-bg: clamp(120px, 18vw, 240px); /* 篇章背景装饰大字 */
  --fs-title: 40px;
  --fs-sub: 22px;
  --fs-body: 17px;
  --fs-small: 14px;
  --fs-tiny: 12.5px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: var(--font-sans); color: var(--ink); background: var(--paper); font-size: var(--fs-body); line-height: 1.8; }
img { display: block; max-width: 100%; }
a { color: inherit; text-decoration: none; }

.container-wide { max-width: var(--w-wide); margin: 0 auto; padding: 0 48px; }
.container-text { max-width: var(--w-text); margin: 0 auto; }
.full-bleed { width: 100vw; margin-left: calc(50% - 50vw); }
```

（其余组件级样式随各页面任务补充，统一写在此文件内，保持单文件 CSS。）

**Step 2: 写 Base.astro 布局（head + 全站导航 + footer）**

导航仅 3 项：时间线 / 人物墙 / 关于。纯锚点链接。

**Step 3: 临时验证页面渲染**

建一个临时 `src/pages/index.astro` 只含标题，运行 `npm run build` 验证管线通。

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: 全局样式令牌与基础布局"
```

## Task 4: 时间线页

**Files:**
- Create: `src/pages/timeline.astro`
- Modify: `src/styles/global.css`（追加时间线组件样式）

**Step 1: 写 timeline.astro**

数据逻辑：

```astro
---
import Base from '../layouts/Base.astro';
import { readFileSync } from 'node:fs';
const eras = JSON.parse(readFileSync('content/eras.json', 'utf8')).sort((a,b)=>a.startYear-b.startYear);
const movies = JSON.parse(readFileSync('content/movies.json', 'utf8'))
  .sort((a,b)=> a.year - b.year || a.order - b.order);
const characters = JSON.parse(readFileSync('content/characters.json', 'utf8'));
const charById = Object.fromEntries(characters.map(c=>[c.id,c]));
const moviesOf = (eraId) => movies.filter(m=>m.eraId===eraId);
---
```

页面结构（每个篇章）：

1. `full-bleed` 头图区（背景 = era.colorSoft + 主题色叠加 + 篇章名/years/导读文字）
2. 背景装饰大字：era 起始年份，`--fs-year-bg`，描边字，绝对定位
3. 篇章内条目循环：
   - `isMajorEvent: true` → 全宽特别条目（海报横铺区 + 超大片名 + 加长梗概）
   - 常规条目 → 海报（420-480px）与文字区左右并排，相邻条目左右交替（`:nth-child(even)` 反转方向）
   - 条目内：yearLabel 大字衬线、片名+副标题、梗概、关联人物行（链接到 `/characters/<id>`）、crossUniverseNote 存在时渲染灰底注解框
4. 篇章主题色通过内联 `style="--era-color: ...; --era-soft: ..."` 注入，组件样式引用变量

**Step 2: 追加时间线 CSS（脊线、条目卡片、注解框、大事件条目）**

**Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功，`dist/timeline/index.html` 存在

**Step 4: 视觉自检（对照设计文档 5.1 节逐项检查）**

Run: `npm run dev`（后台起 dev server，浏览器人工核查）
自检清单：头图全宽、年份大字层次、条目交替节奏、注解框灰底、核心六人大卡区域无重叠、移动端 375px 宽度下不破版。

**Step 5: Commit**

```bash
git add src/
git commit -m "feat: 时间线页（篇章头图+条目排版+跨宇宙注解）"
```

## Task 5: 人物墙页

**Files:**
- Create: `src/pages/characters/index.astro`
- Modify: `src/styles/global.css`

**Step 1: 写页面**

- 按 group 顺序渲染六个分组区块：avengers-core → solo → guardians → mystic → villains → support，每组带中文组名标题（复仇者核心 / 独行英雄 / 银河护卫队 / 神域与魔法 / 反派堂 / 重要配角）
- 网格：`grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`
- `isCoreSix: true` 的卡片 `grid-column: span 2; grid-row: span 2`（双倍尺寸）
- 卡片：肖像（`/portraits/portrait-<id>.svg`）+ 姓名 + 代号 + tagline，整卡为链接

**Step 2: 构建验证 + 视觉自检（对照 5.2 节）**

**Step 3: Commit**

```bash
git add src/
git commit -m "feat: 人物墙页（分组网格+核心六人大卡）"
```

## Task 6: 人物详情页

**Files:**
- Create: `src/pages/characters/[id].astro`
- Modify: `src/styles/global.css`

**Step 1: 写页面**

```astro
export async function getStaticPaths() {
  const characters = JSON.parse(readFileSync('content/characters.json', 'utf8'));
  return characters.map(c => ({ params: { id: c.id }, props: { c } }));
}
```

结构：全宽头图区（肖像大图 70vh + 大字姓名/代号，universe 非 sacred 时显示宇宙标签）→ 三段式：他是谁 / 他的作用 / 他的故事线 → 电影作品区（按时序列出 c.movies，每部小海报 + 片名 + 剧情年份，链接回 `/timeline#<movieId>`）。

**Step 2: 时间线页条目加锚点 id（`id={m.id}`）实现互跳闭环**

**Step 3: 构建验证（dist/characters/ 下 35+ 静态页）+ 视觉自检（对照 5.3 节）**

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: 人物详情页（三段式+作品互链）"
```

## Task 7: 首页

**Files:**
- Create: `src/pages/index.astro`（重写）

**Step 1: 写首页**

全屏 hero（站名大字 + 一句话定位 + 两个入口大卡：时间线 / 人物墙）+ 简短"这是什么"说明段 + 底部"从哪开始看"指引（3 步：先读时间线第一章 → 认识核心六人 → 按年份顺读）。纯排版，无动效。

**Step 2: 构建 + 视觉自检 + Commit**

```bash
git add src/
git commit -m "feat: 首页（定位+双入口+新手指引）"
```

## Task 8: M1 内容灌入（最大工作量任务）

**Files:**
- Modify: `content/eras.json`（4 篇章）
- Modify: `content/movies.json`（23 部）
- Modify: `content/characters.json`（~35 人）

**Step 1: eras.json — 4 个篇章**

| id | 名称 | startYear | 主题色 |
|----|------|-----------|--------|
| era-ww2 | 远古与二战 | -1260 | 暗军绿 #3e4a3d |
| era-assembly | 复仇者集结 | 2010 | 钢铁红金 #8f1d14 |
| era-civil-war | 内战与分裂 | 2016 | 冷蓝灰 #2f4156 |
| era-infinity | 无限战争 | 2018 | 灭霸紫 #4a2c5f |

每篇 intro 3-4 行路人视角导读。

**Step 2: movies.json — 无限传奇 23 部，剧情年份与排序按 manweimi 时间轴口径**

美队1(1943)、惊奇队长(1995)、钢铁侠(2010)、无敌浩克(2011)、钢铁侠2(2011)、雷神(2011)、复联1(2012)、雷神2(2013)、钢铁侠3(2013)、美队2(2014)、银河护卫队(2014)、银护2(2014)、复联2(2015)、蚁人(2015)、美队3(2016)、黑寡妇(2016)、黑豹(2016)、蜘蛛侠：英雄归来(2016)、奇异博士(2016-17)、雷神3(2017)、蚁人2(2018)、复联3(2018)、复联4(2023)、蜘蛛侠：英雄远征(2024)。

注：FFH 剧情年份 2024，收尾无限传奇。每部 summary 150-250 字，讲清因果；isMajorEvent 标记：复联1、复联3、复联4。

**Step 3: characters.json — 约 35 人，三段式文案齐全**

核心六人（大卡）+ 二代复仇者（蜘蛛侠、奇异博士、黑豹、惊奇队长、旺达、幻视、猩红女巫系）+ 银护全员（星爵、卡魔拉、德拉克斯、火箭、格鲁特、螳螂女、 Nebula）+ 神域侧（洛基、海姆达尔、女武神）+ 反派（灭霸、奥创、红骷髅、泽莫、秃鹫、海拉、伊戈）+ 配角（尼克·弗瑞、佩吉·卡特、战争机器、猎鹰、冬兵、黄蜂女、蚁人、王）。实际名单以剧情关联完备为准，允许 30-40 浮动。

**Step 4: 运行校验（必须全绿）**

Run: `node scripts/validate-content.mjs`
Expected: `✓ 校验通过: 4 篇章 / 24 部电影 / 3x 个人物`（电影数以实际为准）

**Step 5: 事实审校自查（三类高频错误逐条过）**

漫画设定混入电影设定 / 剧情年份错位 / 跨宇宙归属说错。发现问题即改，改完重跑校验。

**Step 6: Commit**

```bash
git add content/
git commit -m "feat: M1 内容灌入（无限传奇全量：4篇章/23部电影/35人物）"
```

## Task 9: 占位海报与肖像生成

**Files:**
- Create: `scripts/gen-placeholders.mjs`
- Create: `public/posters/*.svg`, `public/portraits/*.svg`（脚本产物）

**Step 1: 写生成脚本**

读三个 JSON，为每部电影生成竖版 SVG 海报（era 主题色渐变底 + 大字竖排片名 + 年份），为每个人物生成肖像占位（主题色底 + 姓名大字 + 代号）。输出到 public/。

**Step 2: 运行生成**

Run: `node scripts/gen-placeholders.mjs`
Expected: `public/posters/` 下电影数个 SVG、`public/portraits/` 下人物数个 SVG

**Step 3: 全站构建验证海报路径全部命中（build 无 404 警告）+ 视觉自检**

**Step 4: Commit**

```bash
git add scripts/gen-placeholders.mjs public/
git commit -m "feat: 占位海报/肖像生成管线（时代主题色SVG）"
```

## Task 10: 收尾验证

**Step 1: 全量校验 + 构建**

Run: `node scripts/validate-content.mjs && npm run build`
Expected: 校验绿 + 构建零报错

**Step 2: 全站视觉走查（对照设计文档第五节全清单）**

`npm run dev` 起服务，逐页过：首页 / 时间线 / 人物墙 / 抽查 5 个人物详情页 / 移动端 375px。

**Step 3: README.md（简短：项目定位、内容分期、如何加内容、如何换真实海报）**

**Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: README（内容维护指南）"
```

## 交付标准（对照设计文档）

- [ ] 时间线：4 篇章主题色、头图全宽、背景大字年份、大事件全宽条目、跨宇宙注解框（FFH 条目含"神秘客骗局"注：无，M1 内跨宇宙注解主要体现在惊奇队长条目说明克里/斯克鲁战争背景）
- [ ] 人物墙：6 分组、核心六人双倍大卡、卡片可跳转
- [ ] 人物详情：三段式齐全、作品列表可跳回时间线锚点
- [ ] 三者互链闭环：电影→人物、人物→电影、时间线↔详情
- [ ] 数据校验全绿、构建零报错、移动端不破版
- [ ] 零客户端 JS（检查 dist 产物无 script 标签，astro 默认注入的除外）
