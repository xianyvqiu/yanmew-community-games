import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog, digest, upsert, compareVersions, validVersion } from './catalog.mjs';
const entry = () => ({id:'org.example.blocks', name:'方块', description:'方块小游戏', author:'Example', version:'1.0.0', apiVersion:'1.0.0', repository:'https://github.com/example/blocks', readmeUrl:`https://raw.githubusercontent.com/xianyvqiu/yanmew-community-games/${'a'.repeat(40)}/games/org.example.blocks/README.md`, readmeSha256:digest('介绍'), downloadUrl:'https://github.com/xianyvqiu/yanmew-community-games/releases/download/org.example.blocks%2Fv1.0.0/org.example.blocks-1.0.0.yanmew-game',sha256:digest('package'),sizeBytes:200,publishedAt:'2026-11-09T00:00:00Z'});
test('空目录和完整发布条目；重复 ID、未知字段不能进入目录', () => {
  validateCatalog({schemaVersion:1,games:[]}); validateCatalog({schemaVersion:1,games:[entry()]});
  assert.throws(()=>validateCatalog({schemaVersion:1,games:[entry(),entry()]}));
  assert.throws(()=>validateCatalog({schemaVersion:1,games:[],extra:true}));
});
test('拒绝外部下载、凭据、浮动 README、非法版本、大小及第一方 ID', () => {
  for (const patch of [{downloadUrl:'https://example.com/a.yanmew-game'}, {downloadUrl:'https://github.com/other/repo/releases/download/v1/a.yanmew-game'}, {repository:'https://token@github.com/example/blocks'}, {readmeUrl:entry().readmeUrl.replace('a'.repeat(40),'main')}, {sha256:'bad'}, {sizeBytes:0}, {version:'01.0.0'}, {id:'com.yanmew.game.example'}, {author:'a\nb'}, {publishedAt:'today'}, {extra:true}]) assert.throws(()=>validateCatalog({schemaVersion:1,games:[{...entry(),...patch}]}));
});
test('发布条目不可倒退或替换同版本附件，允许幂等重试及升级', () => {
  const old = {schemaVersion:1,games:[entry()]};
  assert.deepEqual(upsert(old,entry()),old);
  assert.throws(()=>upsert(old,{...entry(),sha256:digest('changed')}));
  assert.throws(()=>upsert(old,{...entry(),version:'0.9.0'}));
  assert.equal(upsert(old,{...entry(),version:'1.1.0'}).games[0].version,'1.1.0');
  assert.ok(compareVersions('1.0.0','1.0.0-rc.2')>0);
  assert.ok(compareVersions('1.0.0-rc.10','1.0.0-rc.2')>0);
  assert.equal(compareVersions('1.0.0+build.1','1.0.0+build.2'),0);
  assert.ok(validVersion('1.0.0-alpha.1+build'));
});
