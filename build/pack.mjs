import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkGame, gameDirectories } from '../validation/check.mjs';
import { digest } from '../validation/catalog.mjs';

export async function pack(root, id, cli, output = join(root, 'out')) {
  const manifest = await checkGame(root, id), source = join(root, 'games', id);
  assert.ok(cli, '请通过 YANMEW_PLUGIN_CLI 指定已校验的开发包 bin/yanmew-plugin.exe');
  const stage = await mkdtemp(join(tmpdir(), 'yanmew-community-'));
  try {
    // 只打包约定的分发资源；不执行投稿代码或作者的构建脚本。
    for (const name of ['manifest.json','ui','assets','locales','icon.svg','icon.png','README.md','LICENSE.txt', ...(manifest.migration ? [manifest.migration] : [])]) {
      assert.ok(!name.includes('..') && !name.includes('\\') && !name.startsWith('/'), '非法分发路径');
      try { await stat(join(source, name)); } catch (error) { if(error.code === 'ENOENT') continue; throw error; }
      await mkdir(resolve(stage, name, '..'), {recursive:true});
      await cp(join(source, name), join(stage, name), {recursive:true, dereference:false});
    }
    await mkdir(output, {recursive:true});
    const file = join(output, `${id}-${manifest.version}.yanmew-game`);
    execFileSync(cli, ['pack', stage, file], {stdio:'inherit'});
    execFileSync(cli, ['validate', file], {stdio:'inherit'});
    const bytes = await readFile(file), sha256 = digest(bytes);
    await writeFile(`${file}.sha256`, `${sha256}  ${id}-${manifest.version}.yanmew-game\n`);
    return {file, sha256, sizeBytes:bytes.length, manifest};
  } finally {
    const child = relative(resolve(tmpdir()), resolve(stage));
    assert.ok(child && !child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child), '临时目录超出预期范围');
    await rm(stage, {recursive:true, force:true});
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.cwd(), ids = process.argv[2] ? [process.argv[2]] : await gameDirectories(root);
  for (const id of ids) await pack(root, id, process.env.YANMEW_PLUGIN_CLI);
}
