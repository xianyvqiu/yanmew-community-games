import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {credentialToken} from './release-helpers.mjs';

export function gitFor(root) {
  return (...args) => execFileSync('git',args,{cwd:root,encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'},stdio:['pipe','pipe','pipe']}).trim();
}
export function cleanMain(root, expectedCommit) {
  const git = gitFor(root);
  assert.equal(git('branch','--show-current'),'main','请切换到 main 后发布');
  assert.ok(!git('status','--porcelain'),'工作区有未提交内容，请先保存或提交后再发布');
  git('fetch','origin','main');
  const commit = git('rev-parse','HEAD');
  assert.equal(commit,git('rev-parse','origin/main'),'本地和远端 main 不一致，请先同步后重试');
  if (expectedCommit) assert.equal(commit,expectedCommit,'发布期间源码发生变化；请同步 main 后重新执行，已上传附件会核对后复用');
  return commit;
}
export function githubLogin(root) {
  let value;
  try {
    value = execFileSync('git',['credential','fill'],{cwd:root,encoding:'utf8',input:'protocol=https\nhost=github.com\npath=xianyvqiu/yanmew-community-games.git\n\n',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'},stdio:['pipe','pipe','pipe']});
  } catch { throw new Error('无法读取本机 GitHub 登录；请先用 Git Credential Manager 或 GitHub Desktop 登录，并确认 git push 可用'); }
  return credentialToken(value);
}
