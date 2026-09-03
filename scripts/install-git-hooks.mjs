#!/usr/bin/env node
// 零依赖 git hooks 安装：把 scripts/git-hooks/* 复制到 .git/hooks/ 并加执行权限
import { existsSync, mkdirSync, copyFileSync, chmodSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const hooksSrc = join(here, 'git-hooks');
const hooksDest = join(root, '.git', 'hooks');

if (!existsSync(join(root, '.git'))) { console.log('  (非 git 仓库，跳过 hook 安装)'); process.exit(0); }
if (!existsSync(hooksSrc)) { console.log('  (无 git-hooks 目录，跳过)'); process.exit(0); }

mkdirSync(hooksDest, { recursive: true });
for (const f of readdirSync(hooksSrc)) {
  copyFileSync(join(hooksSrc, f), join(hooksDest, f));
  chmodSync(join(hooksDest, f), 0o755);
  console.log(`  ✓ 已安装 git hook: ${f}`);
}
