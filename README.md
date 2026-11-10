# 颜喵社区小游戏

第三方作者在这里提交小游戏源码。作品经过维护者审阅、本地检查和实际游玩后，统一发布为 `.yanmew-game`，在 [Releases](https://github.com/xianyvqiu/yanmew-community-games/releases) 下载。

本仓库使用**本地检查、本地发布**，不启用 GitHub Actions。维护者在自己的 Windows 电脑执行命令，GitHub 保存源码、PR、Release 附件和目录；使用这套发布工具不需要 GitHub 付费 runner、付款方式或仓库 Secret。

[开发工具包 1.0.1](https://github.com/xianyvqiu/yanmew-community-games/releases/tag/devkit-v1.0.1) 包含独立 CLI、SDK、模板、完整教程、版本和校验文件。公开教程见 [developer/sdk/README.md](developer/sdk/README.md)，无需访问颜喵主仓库。自带小游戏保留在主仓库，这里不重复收录。当前社区游戏目录为空，开发模板和工具包不列为游戏。

## 下载与安装

在包含社区浏览功能的颜喵版本中，打开“全局设置 → 小游戏插件 → 社区小游戏”，点击卡片查看该版本 README，点击“下载”在浏览器获取插件包。下载后返回小游戏插件页，使用“从本地安装”，核对权限后安装。旧版也可以直接从 Releases 下载并本地安装。

只有已发布到本仓库 Release 并写入 [catalog.json](catalog.json) 的作品才显示在应用内。源码合并不等于已发布。程序不自动安装或授权，社区收录不授予“官方”身份；结构检查不代替玩法和素材授权审查。

## 编写与投稿

先读 [完整教程与接口](developer/sdk/README.md)、[模板](developer/template) 和 [投稿说明](CONTRIBUTING.md)。个人编写和打包插件可直接使用工具包 CLI，不需要 Rust 或 Node.js；使用本社区脚本需要 Windows 10/11 x64、Node.js 22 及以上、Git 和 Windows PowerShell，无第三方 npm 依赖，无需 npm install。

```text
games/<plugin-id>/
  manifest.json       ID 与目录名一致，填写真实 GitHub 源码仓库
  ui/                 可直接运行的 HTML、CSS、JavaScript
  assets/             可选素材
  locales/            可选翻译
  src/                可选额外源码，不直接打入分发包
  README.md           玩法、操作、权限、存档升级及测试结果
  LICENSE.txt         源码及素材的使用和分发许可
developer/            公开 SDK、模板、教程与许可文本快照
validation/           投稿及目录规则
build/                本地检查、打包和发布入口
catalog.json          已发布游戏目录，由发布命令维护
```

作者提交前或维护者审查时，在仓库根目录执行：

```powershell
npm run check:local
```

它运行规则测试、检查目录及所有游戏源码，下载 `toolchain.json` 锁定的开发包，核对 ZIP 大小、SHA-256、版本和 CLI 哈希，验证模板可打包，再用同一 CLI 打包所有投稿并 validate。输出在新的 `out/check-*/`，不覆盖上次生成的包。不运行游戏或作者的构建脚本。

本地检查会执行仓库维护者提供的校验工具。审查 PR 时先看文件差异，确认只包含约定的游戏修改；工具改动应单独审阅，不直接运行陌生 fork 中改过的脚本。若使用 TypeScript 等构建工具，作者须提交可审查源码和可直接运行的 `ui/`，写明如何复现及依赖许可。

工具下载和单项检查也可以分开运行：`npm test`、`npm run validate`、`npm run toolchain`。单独执行 `npm run pack -- <plugin-id>` 时，将下载器打印的 CLI 路径设置为 `YANMEW_PLUGIN_CLI`。直接打包默认输出在 `out/`，不覆盖已有文件。

## 维护者本地发布

1. 审阅 PR 的源码、玩法、权限及素材许可，用本地检查命令和真实颜喵验证，结果填写在 PR。合入 main；每次更新提升 manifest 的 SemVer 版本。
2. 使用正式社区仓库的完整本地克隆，确认本机 Git 身份正确、Git Credential Manager 或 GitHub Desktop 已登录 GitHub，且 `git push` 有写权限。使用普通 GitHub 登录，不需要手填 token。
3. 在干净且与远端同步的 main 执行下列命令，将示例 ID 换成实际游戏 ID：

```powershell
git switch main
git pull --ff-only
npm run release:local -- org.example.blocks
```

发布命令检查仓库及源码、下载并核验固定开发包，从 manifest 读取版本，生成包和 SHA-256，创建或核对 `<plugin-id>/v<version>` 的 Release，上传两个附件并发布，然后提交并推送 catalog.json。无需先手工推 tag，也不会因推 tag 自动触发 Actions。源码 README 固定到该版本 tag 的40位提交，并记录字节哈希。

凭据只通过本机 Git 凭据助手读取并在进程内使用，不写入文件、URL、命令行或日志。命令保留本机 Git 姓名/邮箱，不切分支、不重置文件、不强推。生成包保留在新的 `out/release-*/`。

最后核对 Release 附件、catalog.json 和颜喵社区页，实际下载并安装游玩。没有真实作品时保持空目录，不发布模板占位。

### 失败后继续

- 未提交文件、分支错误、没有登录或没有写权限：按提示先修正。本机登录失效时通过 Git Credential Manager/GitHub Desktop 重新登录，不提交凭据到仓库。
- 上传或网络失败：工作区仍干净且同步时，重新运行同一发布命令；已有附件只有 SHA-256 完全相同才复用，不覆盖已发布同版本内容。
- 发布期间 main 更新：先 `git pull --ff-only`，再重新执行。该游戏源码与版本 tag 不一致时停止，修复应提升版本。
- catalog 提交已生成但 push 失败：先核对 `git status` 和最近提交，再执行 `git push origin main`；发生冲突时人工同步并解决目录冲突，不强推、不重新覆盖 Release 附件。

删除目录条目可下架，但不会删除已下载包或用户存档。保留已发布 README 对应提交及工具版本，不删除仍被历史版本引用的附件。

## 更新开发工具包

维护者从主仓库运行 `scripts/build-plugin-devkit.ps1 -Version <新版本>`，验证独立 CLI、SDK 和模板，以 `devkit-v<新版本>` 手动或通过 Releases API 发布 ZIP 与 SHA-256 文件。工具包同版本不覆盖。

用同一开发包刷新 `developer/` 文本快照（不提交 EXE），更新 `toolchain.json` 的版本、URL、大小及 ZIP/CLI 两个哈希，运行 `npm run check:local` 后提交。工具包版本与插件、颜喵应用版本分别管理，不占用游戏目录。

## 许可

仓库工具与文档采用 [Apache-2.0](LICENSE)。每个游戏及素材按其 `LICENSE.txt` 分发；根许可不替代作者许可。
