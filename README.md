# 三体世界图鉴

顺时间线读懂刘慈欣《三体》三部曲的纯静态科普站：时间线（纪年分章）+ 概念册（书里怎么讲 / 科学底子）+ 人物墙（四段式）。全站剧透，以小说为唯一正史。

## 运行

- 安装：`npm install`
- 开发：`npm run dev`（默认 http://localhost:4321）
- 构建：`npm run build`（产物 dist/）
- 校验：`npm run validate`（引用完整性 + 双向链接对称；加 `--self-test` 自检校验器本身）
- 占位图：`npm run placeholders`（科学符号风 SVG，输出 public/images/）

## 内容结构

- `content/books.json` 三部曲 / `content/eras.json` 纪年 5 章 / `content/events.json` 时间线条目 / `content/concepts.json` 概念 / `content/characters.json` 人物
- 全部以 id 互链：事件↔人物、事件↔概念、人物↔概念、概念↔概念；改数据后必须跑 `npm run validate`

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

## 待办（M2 打磨，见设计文档第八节）

- SEO：favicon / og / 逐页 description / canonical / robots / sitemap
- 移动端真机复测（375px 断点）
- 中英对照标注（沿用 annotate-terms 幂等管线）
- 腾讯剧照真实图片接入（书名徽标/人物肖像替换占位图）
- 纪年数值人工校准确认（纪元切分点的公历年份以原著为准复核）
