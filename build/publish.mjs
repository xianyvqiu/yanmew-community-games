// 维护者本机发布核心；不运行投稿者脚本，不修改本机 Git 身份。
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join, basename} from 'node:path';
import {pack} from './pack.mjs';
import {checkGame} from '../validation/check.mjs';
import {parseTag, verifyExistingAsset} from './release-helpers.mjs';
import {cleanMain, gitFor} from './local-git.mjs';
import {repository, compareVersions, digest, validateEntry, upsert} from '../validation/catalog.mjs';

export async function publish({root, tag, cli, token, output = join(root,'out'), fetchImpl = fetch}) {
  assert.ok(typeof token === 'string' && token.length > 0, '缺少本机 GitHub 登录');
  const {id, version} = parseTag(tag), git = gitFor(root);
  const commit = cleanMain(root);
  assert.equal((await checkGame(root,id)).version, version, 'tag 和 manifest 版本不一致');
  const catalogFile = join(root,'catalog.json');
  const previous = JSON.parse(await readFile(catalogFile,'utf8')).games.find(game=>game.id === id);
  if (previous) assert.ok(compareVersions(version,previous.version) >= 0, '禁止发布旧版本');
  async function api(path, options = {}) {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
      ...options, headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(60000),
    });
    if (response.status === 404 && options.allowMissing) return null;
    assert.ok(response.ok, `GitHub 发布请求失败：HTTP ${response.status}`);
    return response.json();
  }
  let release = await api(`/releases/tags/${encodeURIComponent(tag)}`,{allowMissing:true});
  const ref = await api(`/git/ref/tags/${encodeURIComponent(tag)}`,{allowMissing:true});
  let object = ref?.object;
  if (release) assert.ok(object, '已有 Release 的源码 tag 不存在，请维护者核对');
  for (let depth=0; object?.type === 'tag' && depth<4; depth++) {
    assert.match(object.sha,/^[a-f0-9]{40}$/);
    object = (await api(`/git/tags/${object.sha}`)).object;
  }
  assert.ok(!object || object.type === 'commit', '版本 tag 必须指向可验证的源码提交');
  const sourceCommit = object?.sha ?? commit;
  assert.match(sourceCommit,/^[a-f0-9]{40}$/);
  git('merge-base','--is-ancestor',sourceCommit,'origin/main');
  assert.ok(!git('diff',sourceCommit,commit,'--',`games/${id}`), '已有 tag 与当前游戏源码不一致；已发布版本不能替换，请提升版本');
  const result = await pack(root,id,cli,output);
  const readmeBytes = execFileSync('git',['show',`${sourceCommit}:games/${id}/README.md`],{cwd:root});
  if (!release) release = await api('/releases',{method:'POST',body:JSON.stringify({tag_name:tag,target_commitish:sourceCommit,name:`${result.manifest.name} ${version}`,body:`源码：${sourceCommit}\n\n下载 .yanmew-game 后在颜喵中从本地安装，并确认权限。`,draft:true,prerelease:version.includes('-')})});
  assert.ok(Number.isSafeInteger(release.id) && release.id>0 && release.tag_name === tag, 'Release 身份不匹配');
  for (const file of [result.file,`${result.file}.sha256`]) {
    const name = basename(file), bytes = await readFile(file);
    const asset = release.assets.find(item=>item.name === name);
    if (asset) { verifyExistingAsset(asset,bytes); continue; }
    assert.ok(release.draft, '正式 Release 缺少附件，请人工核对；不会替换已发布内容');
    const upload = new URL(release.upload_url.split('{')[0]);
    assert.ok(upload.protocol === 'https:' && upload.hostname === 'uploads.github.com' && !upload.username && !upload.password && !upload.port && upload.pathname.startsWith(`/repos/${repository}/releases/`), '不可信的附件上传地址');
    upload.searchParams.set('name',name);
    const response = await fetchImpl(upload.href,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream'},body:bytes,signal:AbortSignal.timeout(120000)});
    assert.ok(response.ok, `上传失败：HTTP ${response.status}`);
    verifyExistingAsset(await response.json(),bytes);
  }
  if (release.draft) await api(`/releases/${release.id}`,{method:'PATCH',body:JSON.stringify({draft:false})});
  release = await api(`/releases/${release.id}`);
  const asset = release.assets.find(item=>item.name === basename(result.file));
  assert.ok(asset && release.published_at);
  verifyExistingAsset(asset,await readFile(result.file));
  const entry = validateEntry({id,name:result.manifest.name,description:result.manifest.description,author:result.manifest.author,version,apiVersion:result.manifest.api_version,repository:result.manifest.repository,readmeUrl:`https://raw.githubusercontent.com/${repository}/${sourceCommit}/games/${id}/README.md`,readmeSha256:digest(readmeBytes),downloadUrl:asset.browser_download_url,sha256:result.sha256,sizeBytes:result.sizeBytes,publishedAt:release.published_at});
  // 发布期间远端或本地变化时停止；不切分支、不重置用户文件，也不强推。
  cleanMain(root,commit);
  const catalog = upsert(JSON.parse(await readFile(catalogFile,'utf8')),entry);
  await writeFile(catalogFile,`${JSON.stringify(catalog,null,2)}\n`);
  git('add','catalog.json');
  if (git('diff','--cached','--name-only')) {
    git('commit','-m',`发布 ${id} ${version}`);
    git('push','origin','HEAD:main');
  }
  return {...result,entry,releaseUrl:release.html_url};
}
