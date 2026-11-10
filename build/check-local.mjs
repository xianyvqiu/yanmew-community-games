import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, readdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {check} from '../validation/check.mjs';
import {getTool} from './get-tool.mjs';
import {pack} from './pack.mjs';

const root = process.cwd();
const tests = (await readdir(join(root,'validation'))).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>join(root,'validation',name));
execFileSync(process.execPath,['--test',...tests],{stdio:'inherit'});
const ids = await check(root), cli = await getTool(root);
execFileSync(process.execPath,[resolve('build/smoke.mjs')],{cwd:root,env:{...process.env,YANMEW_PLUGIN_CLI:cli},stdio:'inherit'});
await mkdir(join(root,'out'),{recursive:true});
const output = await mkdtemp(join(root,'out','check-'));
for (const id of ids) await pack(root,id,cli,output);
console.log(`本地检查通过：${ids.length} 个源码小游戏；模板仅用于开发包验证。输出：${output}`);
