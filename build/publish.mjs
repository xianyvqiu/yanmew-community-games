// 仅由维护者的 tag 发布工作流运行；不运行投稿者的脚本。
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pack} from './pack.mjs';
import {checkGame} from '../validation/check.mjs';
import {parseTag, verifyExistingAsset} from './release-helpers.mjs';
import {repository, compareVersions, digest, validateEntry, upsert} from '../validation/catalog.mjs';

assert.equal(process.env.GITHUB_REPOSITORY, repository);
assert.ok(process.env.GH_TOKEN, '缺少发布权限');
const tag = process.env.GITHUB_REF_NAME;
const {id, version} = parseTag(tag);
const git = (...args) => execFileSync('git', args, {encoding:'utf8'}).trim();
const commit = git('rev-parse','HEAD');
git('fetch','origin','main'); git('merge-base','--is-ancestor',commit,'origin/main');
assert.equal((await checkGame(process.cwd(), id)).version, version, 'tag 和 manifest 版本不一致');
const previous = JSON.parse(await readFile('catalog.json','utf8')).games.find(game => game.id === id);
if (previous) assert.ok(compareVersions(version, previous.version) >= 0, '禁止发布旧版本');
const result = await pack(process.cwd(), id, process.env.YANMEW_PLUGIN_CLI);
assert.equal(result.manifest.version, version, 'tag 和 manifest 版本不一致');
const readmeBytes = execFileSync('git', ['show',`${commit}:games/${id}/README.md`]);
async function api(path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    ...options, headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', 'Content-Type':'application/json', ...options.headers}, signal:AbortSignal.timeout(60000),
  });
  if (response.status === 404 && options.allowMissing) return null;
  assert.ok(response.ok, `GitHub 发布请求失败：HTTP ${response.status}`);
  return response.json();
}
let release = await api(`/releases/tags/${encodeURIComponent(tag)}`, {allowMissing:true});
if (!release) release = await api('/releases', {method:'POST', body:JSON.stringify({tag_name:tag,target_commitish:commit,name:`${result.manifest.name} ${version}`,body:`源码：${commit}\n\n下载 .yanmew-game 后在颜喵中从本地安装，并确认权限。`,draft:true,prerelease:version.includes('-')})});
for (const file of [result.file, `${result.file}.sha256`]) {
  const name = file.split(/[\\/]/).at(-1), bytes = await readFile(file);
  const asset = release.assets.find(item => item.name === name);
  if (asset) {
    verifyExistingAsset(asset, bytes);
    continue;
  }
  assert.ok(release.draft, '正式 Release 缺少附件，请人工核对；不会替换已发布内容');
  const response = await fetch(`${release.upload_url.split('{')[0]}?name=${encodeURIComponent(name)}`, {method:'POST', headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`, 'Content-Type':'application/octet-stream'}, body:bytes, signal:AbortSignal.timeout(120000)});
  assert.ok(response.ok, `上传失败：HTTP ${response.status}`);
}
if (release.draft) await api(`/releases/${release.id}`, {method:'PATCH',body:JSON.stringify({draft:false})});
release = await api(`/releases/${release.id}`);
const asset = release.assets.find(item => item.name === result.file.split(/[\\/]/).at(-1));
assert.ok(asset && release.published_at);
verifyExistingAsset(asset, await readFile(result.file));
const entry = validateEntry({id,name:result.manifest.name,description:result.manifest.description,author:result.manifest.author,version,apiVersion:result.manifest.api_version,repository:result.manifest.repository,readmeUrl:`https://raw.githubusercontent.com/${repository}/${commit}/games/${id}/README.md`,readmeSha256:digest(readmeBytes),downloadUrl:asset.browser_download_url,sha256:result.sha256,sizeBytes:result.sizeBytes,publishedAt:release.published_at});
// 基于最新 main 更新，避免 tag 指向旧目录导致覆盖其他作品。
git('fetch','origin','main'); git('checkout','-B','main','origin/main');
const catalog = upsert(JSON.parse(await readFile('catalog.json','utf8')), entry);
await writeFile('catalog.json', `${JSON.stringify(catalog,null,2)}\n`);
git('add','catalog.json');
if (git('diff','--cached','--name-only')) {
  git('config','user.name','github-actions[bot]'); git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com');
  git('commit','-m',`发布 ${id} ${version}`); git('push','origin','HEAD:main');
}
console.log(`发布完成：${id} ${version}`);
