import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, cp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, relative, isAbsolute, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {digest} from '../validation/catalog.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const cli = process.env.YANMEW_PLUGIN_CLI;
test('真实 CLI 与本地 Git 完成发布链路，目录引用 Git 中的 README 和真实附件哈希', {skip:!cli}, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'yanmew-publish-test-'));
  try {
    const root = join(temp, 'work'), remote = join(temp, 'remote.git');
    await mkdir(root);
    const git = (...args) => execFileSync('git', args, {cwd:root, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim();
    git('init','--bare','--initial-branch=main',remote);
    git('init','--initial-branch=main');
    git('config','core.autocrlf','false');
    git('config','user.name','Local Test'); git('config','user.email','test@example.invalid');
    const id = 'org.example.publish-test', source = join(root,'games',id);
    await cp(join(repositoryRoot,'developer/template'),source,{recursive:true});
    const manifest = JSON.parse(await readFile(join(source,'manifest.json'),'utf8'));
    manifest.id = id; manifest.repository = 'https://github.com/example/publish-test';
    await writeFile(join(source,'manifest.json'),JSON.stringify(manifest));
    const readme = '# 发布演练\n\n仅在本地测试，不向 GitHub 发请求。\n';
    await writeFile(join(source,'README.md'),readme);
    await writeFile(join(source,'src-only.txt'),'not a distributed resource');
    await writeFile(join(root,'catalog.json'),' {"schemaVersion":1,"games":[]}\n');
    await writeFile(join(root,'.gitignore'),'out/\n');
    git('add','.'); git('commit','-m','Local fixture'); git('remote','add','origin',remote); git('push','origin','main');
    const commit = git('rev-parse','HEAD');
    const mock = join(temp,'mock.mjs');
    await writeFile(mock, `
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='https://api.github.com/repos/xianyvqiu/yanmew-community-games';
let release=null;
globalThis.fetch=async(url,options={})=>{
 const method=options.method||'GET';
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 if(url.startsWith(base+'/releases/tags/')) return release?json(release):json({},404);
 if(url===base+'/releases'&&method==='POST') {
  assert.equal(options.headers['Content-Type'],'application/json');
  const data=JSON.parse(options.body); assert.equal(data.draft,true);
  release={id:1,draft:true,assets:[],upload_url:'https://uploads.github.com/test{?name}',published_at:null};return json(release);
 }
 if(url.startsWith('https://uploads.github.com/test?name=')&&method==='POST') {
  const name=new URL(url).searchParams.get('name'); const hash=createHash('sha256').update(options.body).digest('hex');
  release.assets.push({name,digest:'sha256:'+hash,browser_download_url:'https://github.com/xianyvqiu/yanmew-community-games/releases/download/org.example.publish-test%2Fv1.0.0/'+name});return json(release.assets.at(-1));
 }
 if(url===base+'/releases/1'&&method==='PATCH') {assert.equal(release.assets.length,2);release.draft=false;release.published_at='2026-11-10T00:00:00Z';return json(release);}
 if(url===base+'/releases/1'&&method==='GET') return json(release);
 throw Error('Unexpected network call: '+method+' '+url);
};
`);
    execFileSync(process.execPath,['--import',pathToFileURL(mock).href,join(repositoryRoot,'build/publish.mjs')],{cwd:root,env:{...process.env,GITHUB_REPOSITORY:'xianyvqiu/yanmew-community-games',GITHUB_REF_NAME:`${id}/v1.0.0`,GH_TOKEN:'local-test-not-a-credential',YANMEW_PLUGIN_CLI:resolve(cli)},stdio:['ignore','pipe','pipe']});
    const catalog = JSON.parse(await readFile(join(root,'catalog.json'),'utf8'));
    assert.equal(catalog.games.length,1);
    const entry = catalog.games[0], file = join(root,'out',`${id}-1.0.0.yanmew-game`);
    assert.equal(entry.sha256,digest(await readFile(file)));
    assert.equal(entry.readmeSha256,digest(readme));
    assert.ok(entry.readmeUrl.includes(commit));
    assert.equal(git('rev-parse','HEAD'),git('rev-parse','origin/main'));
    assert.equal(git('show','--pretty=','--name-only','HEAD'),'catalog.json');
  } finally {
    const child = relative(resolve(tmpdir()),resolve(temp));
    assert.ok(child && child!=='..' && !child.startsWith(`..${sep}`) && !isAbsolute(child));
    await rm(temp,{recursive:true,force:true});
  }
});
