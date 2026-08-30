// 构建后生成 sitemap.xml 与 robots.txt（读 SITE_URL / BASE_PATH 环境变量）
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SITE = (process.env.SITE_URL || 'https://example.com').replace(/\/+$/, '');
const BASE = (process.env.BASE_PATH || '/').replace(/\/+$/, '');
const dist = join(ROOT, 'dist');

function walk(dir, urlPath) {
  let urls = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.name.startsWith('.')) continue;
    const p = join(dir, name.name);
    if (name.isDirectory()) urls.push(...walk(p, `${urlPath}${name.name}/`));
    else if (name.name === 'index.html') urls.push(urlPath === '' ? '/' : urlPath);
  }
  return urls;
}

const urls = walk(dist, BASE === '' ? '' : `${BASE}/`).map((u) => u.replace(/\/{2,}/g, '/'));
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}
</urlset>
`;
writeFileSync(join(dist, 'sitemap.xml'), xml);
writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}${BASE === '' ? '' : BASE}/sitemap.xml\n`
);
console.log(`✓ sitemap.xml: ${urls.length} 个 URL + robots.txt 生成`);
