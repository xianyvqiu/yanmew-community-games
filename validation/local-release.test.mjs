import test from 'node:test';
import assert from 'node:assert/strict';
import {credentialToken, verifyOrigin} from '../build/release-helpers.mjs';

test('本地发布只接受正式社区仓库的 HTTPS origin', () => {
  verifyOrigin('https://github.com/xianyvqiu/yanmew-community-games.git');
  verifyOrigin('https://github.com/xianyvqiu/yanmew-community-games');
  for (const url of ['https://github.com/other/yanmew-community-games.git','https://example.com/xianyvqiu/yanmew-community-games','https://token@github.com/xianyvqiu/yanmew-community-games','https://github.com/xianyvqiu/yanmew-community-games?token=value','file:///repo']) assert.throws(()=>verifyOrigin(url));
});
test('登录仅解析 GitHub 凭据，不接受其他域名、空登录或带换行空白的 token', () => {
  assert.equal(credentialToken('protocol=https\r\nhost=github.com\r\nusername=example\r\npassword=local-test-value\r\n'),'local-test-value');
  for (const value of ['protocol=https\nhost=example.com\npassword=local-test-value','protocol=http\nhost=github.com\npassword=local-test-value','protocol=https\nhost=github.com\npassword=','protocol=https\nhost=github.com\npassword=has space']) assert.throws(()=>credentialToken(value));
});
