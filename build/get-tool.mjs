import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, mkdtemp, rm, rename, appendFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve, join, relative, isAbsolute, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {digest} from '../validation/catalog.mjs';

export function validateLock(lock) {
  assert.equal(lock.schemaVersion, 1);
  assert.match(lock.version, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.platform, 'windows-x64');
  assert.equal(lock.apiVersion, '1.0.0');
  const name = `yanmew-plugin-devkit-${lock.version}-windows-x64`;
  assert.equal(lock.url, `https://github.com/xianyvqiu/yanmew-community-games/releases/download/devkit-v${lock.version}/${name}.zip`);
  assert.equal(lock.directory, name);
  assert.equal(lock.cli, 'bin/yanmew-plugin.exe');
  assert.match(lock.sha256, /^[a-f0-9]{64}$/);
  assert.match(lock.cliSha256, /^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(lock.sizeBytes) && lock.sizeBytes > 0 && lock.sizeBytes <= 64*1024*1024);
  return lock;
}
export async function downloadArchive(lock, fetchImpl = fetch) {
  validateLock(lock);
  const response = await fetchImpl(lock.url, {signal:AbortSignal.timeout(60000)});
  assert.ok(response.ok && response.body, `开发工具下载失败：HTTP ${response.status}`);
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      assert.ok(size <= lock.sizeBytes, '工具包下载超过锁定大小');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  const bytes = Buffer.concat(chunks);
  assert.equal(bytes.length, lock.sizeBytes, '工具包下载不完整');
  assert.equal(digest(bytes), lock.sha256, '工具包 SHA-256 不一致');
  return bytes;
}
async function checkedCli(directory, lock) {
  const metadata = JSON.parse(await readFile(join(directory, 'DEVKIT.json'), 'utf8'));
  for (const key of ['version','platform','apiVersion','cliSha256','cli']) assert.equal(metadata[key], lock[key], `工具包 ${key} 不一致`);
  const cli = join(directory, lock.cli);
  assert.equal(digest(await readFile(cli)), lock.cliSha256, 'CLI SHA-256 不一致');
  return cli;
}
export async function getTool(root = process.cwd()) {
  assert.ok(process.platform === 'win32' && process.arch === 'x64', '当前开发工具只支持 Windows x64');
  const lock = validateLock(JSON.parse(await readFile(join(root, 'toolchain.json'), 'utf8')));
  const cache = resolve(root, '.toolchain');
  await mkdir(cache, {recursive:true});
  const destination = join(cache, `${lock.version}-${lock.sha256}`);
  try { return await checkedCli(destination, lock); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const stage = await mkdtemp(join(cache, 'download-'));
  try {
    const archive = join(stage, 'tool.zip');
    await writeFile(archive, await downloadArchive(lock));
    execFileSync('powershell.exe', ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./expand-tool.ps1', import.meta.url)), '-Archive',archive,'-Destination',join(stage,'unpacked')], {stdio:'inherit'});
    const extracted = join(stage, 'unpacked', lock.directory);
    await checkedCli(extracted, lock);
    await rename(extracted, destination);
    return await checkedCli(destination, lock);
  } finally {
    const child = relative(cache, resolve(stage));
    assert.ok(child && !child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child), '临时目录超出工具缓存');
    await rm(stage, {recursive:true, force:true});
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const cli = await getTool();
  console.log(`校验完成：${cli}`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `cli=${cli}\n`);
}
