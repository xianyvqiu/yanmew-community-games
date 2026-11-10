import assert from 'node:assert/strict';
import {mkdir, mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {check, checkGame} from '../validation/check.mjs';
import {validId} from '../validation/catalog.mjs';
import {verifyOrigin} from './release-helpers.mjs';
import {cleanMain, gitFor, githubLogin} from './local-git.mjs';
import {getTool} from './get-tool.mjs';
import {publish} from './publish.mjs';

async function main() {
  const root = process.cwd(), id = process.argv[2];
  assert.ok(process.argv.length === 3 && validId(id), '用法：npm run release:local -- <plugin-id>');
  verifyOrigin(gitFor(root)('remote','get-url','origin'));
  cleanMain(root);
  await check(root);
  const manifest = await checkGame(root,id);
  const cli = await getTool(root);
  // 登录信息只保留在内存中，不写环境文件或传入命令行。
  const token = githubLogin(root);
  await mkdir(join(root,'out'),{recursive:true});
  const output = await mkdtemp(join(root,'out','release-'));
  const result = await publish({root,tag:`${id}/v${manifest.version}`,cli,token,output});
  console.log(`发布完成：${result.releaseUrl}\n目录已推送到 main，本地包：${result.file}`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
