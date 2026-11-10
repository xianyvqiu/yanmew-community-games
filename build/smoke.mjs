import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';

assert.ok(process.env.YANMEW_PLUGIN_CLI, '请先下载并校验工具包');
const directory = await mkdtemp(join(tmpdir(), 'yanmew-devkit-smoke-'));
const file = join(directory, 'template.yanmew-game');
execFileSync(process.env.YANMEW_PLUGIN_CLI, ['pack', resolve('developer/template'), file], {stdio:'inherit'});
execFileSync(process.env.YANMEW_PLUGIN_CLI, ['validate', file], {stdio:'inherit'});
assert.ok((await readFile(file)).length > 0);
console.log('公开开发包模板打包及校验通过；模板不进入社区游戏目录。');
