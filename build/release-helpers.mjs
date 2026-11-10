import assert from 'node:assert/strict';
import {repository, validId, validVersion, digest} from '../validation/catalog.mjs';

export function parseTag(tag) {
  assert.equal(typeof tag, 'string', '缺少发布 tag');
  const slash = tag.lastIndexOf('/v');
  const id = tag.slice(0, slash), version = tag.slice(slash + 2);
  assert.ok(slash > 0 && validId(id) && validVersion(version), 'tag 格式须为 <plugin-id>/v<version>');
  return {id, version};
}
export function verifyExistingAsset(asset, bytes) {
  assert.equal(asset.digest, `sha256:${digest(bytes)}`, '已发布附件内容不同或无法验证；禁止覆盖，请检查后升级版本');
}
export function verifyOrigin(value) {
  const url = new URL(value);
  assert.ok(url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password && !url.search && !url.hash, '发布只支持无凭据的社区 GitHub HTTPS origin');
  assert.equal(url.pathname.replace(/\/$/, '').replace(/\.git$/, ''), `/${repository}`, '请在正式社区仓库发布，不要从作者 fork 发布');
}
export function credentialToken(value) {
  const fields = Object.fromEntries(value.split(/\r?\n/).filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
  assert.ok(fields.protocol === 'https' && fields.host === 'github.com' && typeof fields.password === 'string' && fields.password.length > 0 && !/\s/.test(fields.password), '未找到 GitHub 登录，请先确认本机 git push 可用');
  return fields.password;
}
