import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, cp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, relative, isAbsolute, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from '../validation/catalog.mjs';
import {publish} from '../build/publish.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const cli = process.env.YANMEW_PLUGIN_CLI;
test('本地发布、幂等重试、源码/远端变化拦截及 Git 身份保留', {skip:!cli}, async () => {
  const temp = await mkdtemp(join(tmpdir(),'yanmew-publish-test-'));
  try {
    const root = join(temp,'work'), remote = join(temp,'remote.git');
    await mkdir(root);
    const git = (...args) => execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    git('init','--bare','--initial-branch=main',remote); git('init','--initial-branch=main');
    git('config','core.autocrlf','false'); git('config','user.name','Local Test'); git('config','user.email','test@example.invalid');
    const id = 'org.example.publish-test', tag = `${id}/v1.0.0`, source = join(root,'games',id);
    await cp(join(repositoryRoot,'developer/template'),source,{recursive:true});
    const manifest = JSON.parse(await readFile(join(source,'manifest.json'),'utf8'));
    manifest.id=id; manifest.repository='https://github.com/example/publish-test';
    await writeFile(join(source,'manifest.json'),JSON.stringify(manifest));
    const readme = '# 发布演练\n\n仅在本地测试，不向 GitHub 发请求。\n';
    await writeFile(join(source,'README.md'),readme);
    await writeFile(join(source,'src-only.txt'),'not a distributed resource');
    await writeFile(join(root,'catalog.json'),' {"schemaVersion":1,"games":[]}\n');
    await writeFile(join(root,'.gitignore'),'out/\n');
    git('add','.'); git('commit','-m','Local fixture'); git('remote','add','origin',remote); git('push','origin','main');
    const commit = git('rev-parse','HEAD');
    const base = 'https://api.github.com/repos/xianyvqiu/yanmew-community-games';
    let release = null, requests = 0, duringRequest = null;
    const fetchImpl = async(url,options={}) => {
      requests++;
      assert.equal(options.headers.Authorization,'Bearer local-test-not-a-credential');
      if (duringRequest) { const callback=duringRequest; duringRequest=null; await callback(); }
      const method=options.method || 'GET';
      const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
      if (url===`${base}/releases/tags/${encodeURIComponent(tag)}`) return release?json(release):json({},404);
      if (url===`${base}/git/ref/tags/${encodeURIComponent(tag)}`) return release?json({object:{type:'commit',sha:commit}}):json({},404);
      if (url===`${base}/releases` && method==='POST') {
        assert.equal(options.headers['Content-Type'],'application/json');
        const data=JSON.parse(options.body); assert.equal(data.draft,true); assert.equal(data.target_commitish,commit);
        release={id:1,tag_name:tag,draft:true,assets:[],upload_url:'https://uploads.github.com/repos/xianyvqiu/yanmew-community-games/releases/1/assets{?name}',published_at:null,html_url:'https://github.com/xianyvqiu/yanmew-community-games/releases/tag/'+encodeURIComponent(tag)};
        return json(release);
      }
      if (url.startsWith('https://uploads.github.com/repos/xianyvqiu/yanmew-community-games/releases/1/assets?') && method==='POST') {
        const name=new URL(url).searchParams.get('name');
        const asset={name,digest:'sha256:'+digest(options.body),browser_download_url:'https://github.com/xianyvqiu/yanmew-community-games/releases/download/'+encodeURIComponent(tag)+'/'+name};
        release.assets.push(asset);return json(asset);
      }
      if (url===`${base}/releases/1` && method==='PATCH') {assert.equal(release.assets.length,2);release.draft=false;release.published_at='2026-11-10T00:00:00Z';return json(release);}
      if (url===`${base}/releases/1` && method==='GET') return json(release);
      throw Error('Unexpected network call: '+method+' '+url);
    };
    const run = (name) => publish({root,tag,cli:resolve(cli),token:'local-test-not-a-credential',output:join(root,'out',name),fetchImpl});
    const result = await run('first');
    const catalog=JSON.parse(await readFile(join(root,'catalog.json'),'utf8')), entry=catalog.games[0];
    assert.equal(catalog.games.length,1); assert.equal(entry.sha256,digest(await readFile(result.file)));
    assert.equal(entry.readmeSha256,digest(readme)); assert.ok(entry.readmeUrl.includes(commit));
    assert.ok(!(await readFile(result.file)).includes(Buffer.from('src-only.txt')));
    assert.equal(git('rev-parse','HEAD'),git('rev-parse','origin/main'));
    assert.equal(git('show','--pretty=','--name-only','HEAD'),'catalog.json');
    assert.equal(git('config','user.name'),'Local Test'); assert.equal(git('config','user.email'),'test@example.invalid');
    const publishedHead=git('rev-parse','HEAD');
    const retry=await run('retry');
    assert.deepEqual(retry.entry,entry); assert.equal(git('rev-parse','HEAD'),publishedHead); assert.equal(release.assets.length,2);
    await writeFile(join(root,'uncommitted.txt'),'unsaved');
    const before=requests;
    await assert.rejects(run('dirty'),/未提交/); assert.equal(requests,before);
    await rm(join(root,'uncommitted.txt'));
    duringRequest=async()=>{await writeFile(join(root,'unrelated.txt'),'main advanced');git('add','unrelated.txt');git('commit','-m','Unrelated update');git('push','origin','main');};
    await assert.rejects(run('changed-during-release'),/发布期间源码发生变化/);
    assert.equal(git('show','--pretty=','--name-only','HEAD'),'unrelated.txt');
    const hash=release.assets[0].digest;release.assets[0].digest='sha256:'+digest('different');
    await assert.rejects(run('different-asset'),/禁止覆盖/);release.assets[0].digest=hash;
    await writeFile(join(source,'README.md'),readme+'Changed without version bump\n');
    git('add','.');git('commit','-m','Invalid same-version source change');git('push','origin','main');
    await assert.rejects(run('changed-game'),/源码不一致/);
    assert.equal(git('config','user.email'),'test@example.invalid');
  } finally {
    const child=relative(resolve(tmpdir()),resolve(temp));
    assert.ok(child && child!=='..' && !child.startsWith(`..${sep}`) && !isAbsolute(child));
    await rm(temp,{recursive:true,force:true});
  }
});
