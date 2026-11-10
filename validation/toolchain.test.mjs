import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadArchive, validateLock} from '../build/get-tool.mjs';
import {parseTag, verifyExistingAsset} from '../build/release-helpers.mjs';
import {digest} from './catalog.mjs';

const lock = () => ({schemaVersion:1, version:'1.0.0', platform:'windows-x64', apiVersion:'1.0.0', directory:'yanmew-plugin-devkit-1.0.0-windows-x64', cli:'bin/yanmew-plugin.exe', cliSha256:digest('cli'), url:'https://github.com/xianyvqiu/yanmew-community-games/releases/download/devkit-v1.0.0/yanmew-plugin-devkit-1.0.0-windows-x64.zip', sizeBytes:3, sha256:digest('zip')});

test('开发包只能从固定版本社区 Release 获取，拒绝外部链接及不安全路径', () => {
  validateLock(lock());
  for (const patch of [{url:'https://example.com/tool.zip'},{url:lock().url.replace('devkit-v1.0.0','latest')},{directory:'../../escape'}, {cli:'../app.exe'}, {sizeBytes:64*1024*1024+1}, {sha256:'bad'}, {platform:'linux-x64'}]) assert.throws(()=>validateLock({...lock(),...patch}));
});
test('下载须同时满足大小和 SHA-256，拒绝错误状态、截断和被替换的内容', async () => {
  assert.equal((await downloadArchive(lock(),async()=>new Response('zip'))).toString(),'zip');
  for (const value of ['zi','zipp','bad']) await assert.rejects(downloadArchive(lock(),async()=>new Response(value)));
  await assert.rejects(downloadArchive(lock(),async()=>new Response('missing',{status:404})));
});
test('开发工具 tag 不能用作游戏版本；拒绝非法 ID 和版本', () => {
  assert.deepEqual(parseTag('org.example.blocks/v1.2.0'),{id:'org.example.blocks',version:'1.2.0'});
  for (const tag of ['devkit-v1.0.0','com.yanmew.game.blocks/v1.0.0','org.example.blocks/v01.0.0',undefined]) assert.throws(()=>parseTag(tag));
});
test('已上传附件只允许哈希相同的重试，不能覆盖或信任缺失的哈希', () => {
  verifyExistingAsset({digest:`sha256:${digest('zip')}`},Buffer.from('zip'));
  assert.throws(()=>verifyExistingAsset({digest:`sha256:${digest('bad')}`},Buffer.from('zip')));
  assert.throws(()=>verifyExistingAsset({},Buffer.from('zip')));
});
