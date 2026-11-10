import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const repository = 'xianyvqiu/yanmew-community-games';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const validId = id => typeof id === 'string' && id.length <= 128 && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(id) && !id.startsWith('com.yanmew.game.');
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
export const validVersion = value => typeof value === 'string' && value.length <= 128 && semver.test(value);
function text(value, limit) { return typeof value === 'string' && value.trim() && [...value].length <= limit && !/[\u0000-\u001f\u007f-\u009f]/.test(value); }
function https(value, host) {
  assert.equal(typeof value, 'string'); assert.ok(value.length <= 2048);
  const url = new URL(value);
  assert.ok(url.protocol === 'https:' && url.hostname === host && !url.port && !url.username && !url.password && !url.search && !url.hash, 'URL 必须为无凭据的公开 HTTPS 地址');
  return url;
}
export function validateEntry(game) {
  const fields = ['id','name','description','author','version','apiVersion','repository','readmeUrl','readmeSha256','downloadUrl','sha256','sizeBytes','publishedAt'];
  assert.deepEqual(Object.keys(game).sort(), fields.sort());
  assert.ok(validId(game.id), '社区插件 ID 无效或占用了第一方命名空间');
  for (const [key, limit] of [['name',100],['description',2000],['author',100]]) assert.ok(text(game[key], limit), `${key} 为空、过长或含控制字符`);
  assert.ok(validVersion(game.version), '版本须符合 SemVer');
  assert.equal(game.apiVersion, '1.0.0');
  for (const key of ['sha256','readmeSha256']) assert.match(game[key], /^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(game.sizeBytes) && game.sizeBytes > 0 && game.sizeBytes <= 64 * 1024 * 1024);
  assert.ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(game.publishedAt) && Number.isFinite(Date.parse(game.publishedAt)));
  assert.match(https(game.repository, 'github.com').pathname, /^\/[^/]+\/[^/]+\/?$/);
  const raw = https(game.readmeUrl, 'raw.githubusercontent.com').pathname;
  assert.ok(new RegExp(`^/${repository}/[a-f0-9]{40}/games/${game.id.replaceAll('.', '\\.')}/README\\.md$`).test(raw), 'README 必须固定到社区源码提交');
  const download = https(game.downloadUrl, 'github.com').pathname;
  assert.ok(download.startsWith(`/${repository}/releases/download/`) && download.slice(`/${repository}/releases/download/`.length).includes('/') && download.endsWith('.yanmew-game'), '只能下载社区 Release 附件');
  return game;
}
export function validateCatalog(catalog) {
  assert.deepEqual(Object.keys(catalog).sort(), ['games','schemaVersion']);
  assert.equal(catalog.schemaVersion, 1);
  assert.ok(Array.isArray(catalog.games) && catalog.games.length <= 500);
  assert.ok(Buffer.byteLength(JSON.stringify(catalog)) <= 1024 * 1024);
  const ids = new Set();
  for (const game of catalog.games) { validateEntry(game); assert.ok(!ids.has(game.id), '目录中存在重复插件 ID'); ids.add(game.id); }
  return catalog;
}
export function compareVersions(a, b) {
  assert.ok(validVersion(a) && validVersion(b));
  const left = semver.exec(a), right = semver.exec(b);
  for (let i = 1; i <= 3; i++) if (BigInt(left[i]) !== BigInt(right[i])) return BigInt(left[i]) > BigInt(right[i]) ? 1 : -1;
  if (left[4] === right[4]) return 0;
  if (!left[4]) return 1; if (!right[4]) return -1;
  const la = left[4].split('.'), ra = right[4].split('.');
  for (let i = 0; i < Math.max(la.length, ra.length); i++) {
    if (la[i] === undefined) return -1; if (ra[i] === undefined) return 1;
    if (la[i] === ra[i]) continue;
    const ln = /^\d+$/.test(la[i]), rn = /^\d+$/.test(ra[i]);
    if (ln && rn) return BigInt(la[i]) > BigInt(ra[i]) ? 1 : -1;
    if (ln !== rn) return ln ? -1 : 1;
    return la[i] > ra[i] ? 1 : -1;
  }
  return 0;
}
export function upsert(catalog, entry) {
  validateCatalog(catalog); validateEntry(entry);
  const previous = catalog.games.find(game => game.id === entry.id);
  if (previous) {
    assert.ok(compareVersions(entry.version, previous.version) >= 0, '禁止目录版本倒退');
    if (compareVersions(entry.version, previous.version) === 0) assert.deepEqual(entry, previous, '已发布版本不可替换；请升级版本');
  }
  return validateCatalog({schemaVersion:1, games:[...catalog.games.filter(game => game.id !== entry.id), entry].sort((a,b) => a.id.localeCompare(b.id))});
}
