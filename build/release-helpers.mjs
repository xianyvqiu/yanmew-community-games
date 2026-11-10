import assert from 'node:assert/strict';
import {validId, validVersion, digest} from '../validation/catalog.mjs';

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
