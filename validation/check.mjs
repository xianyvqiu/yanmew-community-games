import assert from 'node:assert/strict';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateCatalog, validId, validVersion } from './catalog.mjs';

export async function gameDirectories(root = process.cwd()) {
  return (await readdir(join(root, 'games'), {withFileTypes:true})).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}
export async function checkGame(root, id) {
  assert.ok(validId(id), '社区插件 ID 无效');
  const directory = join(root, 'games', id);
  async function walk(path) {
    for (const entry of await readdir(path, {withFileTypes:true})) {
      const file = join(path, entry.name), info = await lstat(file);
      assert.ok(!info.isSymbolicLink(), '投稿不能包含符号链接');
      assert.ok(!['node_modules','.git','.env','data','target'].includes(entry.name) && !entry.name.endsWith('.yanmew-game'), '不能提交依赖、凭据、用户数据或成品包');
      if (info.isDirectory()) await walk(file); else assert.ok(info.isFile() && info.size <= 32*1024*1024, '投稿包含非法文件或过大单文件');
    }
  }
  await walk(directory);
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.id, id); assert.ok(validVersion(manifest.version)); assert.equal(manifest.api_version, '1.0.0');
  const repo = new URL(manifest.repository);
  assert.ok(repo.protocol === 'https:' && repo.hostname === 'github.com' && !repo.port && !repo.username && !repo.password && !repo.search && !repo.hash && /^\/[^/]+\/[^/]+\/?$/.test(repo.pathname), '公开投稿必须填写源码 GitHub 仓库地址');
  const readme = await readFile(join(directory, 'README.md'));
  assert.ok(readme.length > 0 && readme.length <= 256*1024, 'README 须为 1～256 KiB 内的 UTF-8 文本');
  new TextDecoder('utf-8', {fatal:true}).decode(readme);
  assert.ok((await readFile(join(directory, 'LICENSE.txt'), 'utf8')).trim(), '必须附带作者许可与素材授权说明');
  assert.ok(/^ui\/[A-Za-z0-9_./-]+\.html$/.test(manifest.entry) && !manifest.entry.split('/').includes('..'));
  await readFile(join(directory, manifest.entry));
  return manifest;
}
export async function check(root = process.cwd()) {
  const bytes = await readFile(join(root, 'catalog.json'));
  assert.ok(bytes.length <= 1024*1024); validateCatalog(JSON.parse(bytes));
  const ids = await gameDirectories(root);
  for (const id of ids) await checkGame(root, id);
  return ids;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ids = await check(); console.log(`目录校验通过，源码小游戏 ${ids.length} 个`);
}
