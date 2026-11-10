# 颜喵社区小游戏

第三方作者向本仓库提交小游戏源码。作品经自动检查及维护者审阅后，统一打包为 `.yanmew-game`，在 [Releases](https://github.com/xianyvqiu/yanmew-community-games/releases) 下载。

颜喵自带小游戏保留在主仓库，这里不重复收录。第三方开发者使用公开的 [开发工具包 1.0.0](https://github.com/xianyvqiu/yanmew-community-games/releases/tag/devkit-v1.0.0)；SDK、模板和教程的对应版本可直接在 [developer/](developer/README.md) 查看，无需访问主仓库。

当前尚无社区作品，`catalog.json` 为空。工具包 Release 不属于小游戏，不会显示在游戏目录中。

## 下载与安装

在支持社区浏览的颜喵版本中，打开“全局设置 → 小游戏插件 → 社区小游戏”，点击卡片查看该版本的 README，点击“下载”在浏览器获取插件包。下载后返回小游戏插件页，使用“从本地安装”，核对权限后安装。旧版颜喵也可以直接从 Releases 下载并本地安装。

只有成功发布到本仓库 Release 并写入 [catalog.json](catalog.json) 的作品才显示在应用内。源码合并不等于已发布；空目录时应用显示暂无作品。程序不会自动安装或自动授权。社区收录不授予“官方”身份，自动检查也不代替玩法、授权和内容审查。

## 开发与投稿

先读 [投稿说明](CONTRIBUTING.md)、[完整开发教程及接口](developer/sdk/README.md) 和 [开发模板](developer/template)。

```text
games/<plugin-id>/
  manifest.json       插件描述，ID 与目录名一致
  ui/                 可直接运行的 HTML、CSS、JavaScript 源码
  assets/             可选素材
  locales/            可选翻译
  src/                可选的额外开发源码，不直接打入包
  README.md           玩法、操作、权限、存档升级与测试说明
  LICENSE.txt         源码及素材的使用和分发许可
validation/           投稿规则与目录校验
build/                统一打包与发布入口
catalog.json          已发布目录，维护者通过发布流程更新
```

本仓库脚本使用 Node.js 22 及以上，无第三方 npm 依赖：

```powershell
npm test
npm run validate
npm run toolchain
# 上一步核验并打印 CLI 路径，将其填入下面变量：
$env:YANMEW_PLUGIN_CLI = 'C:\path\to\bin\yanmew-plugin.exe'
npm run smoke
npm run pack -- org.example.blocks
```

`npm run toolchain` 下载 `toolchain.json` 锁定的公开开发包，核对 ZIP 大小、SHA-256、版本及 CLI 哈希后解压至 `.toolchain/`；只支持 Windows x64，无需 Rust 或主仓库权限。作者只使用 CLI 时不需要 Node.js。已校验缓存会复用，损坏缓存会停止，不能跳过校验。打包输出位于 `out/`，不会覆盖已有包；再次打包应换一个空输出目录或清理自己生成的文件。统一流程只复制声明的分发资源，不执行作者脚本。如果使用 TypeScript 或其他构建工具，作者须同时提交可审查源码和构建后的 `ui/`，在 README 中说明构建步骤和依赖许可。

## 维护者发布

1. 审阅 PR 的源码、玩法、权限、素材许可和实际存档升级，确认自动检查通过后合入 `main`。每次更新提升 manifest 的 SemVer 版本。
2. 在已合入 `main` 的提交上创建并推送 tag，例如 `org.example.blocks/v1.0.0`。
3. “发布小游戏”工作流使用固定版本与 SHA-256 的公开开发包中的宿主校验器打包，创建 Release、上传插件包和 SHA-256 校验文件，然后更新 `main` 的目录。发布流程不运行作者提供的构建脚本。
4. 核对 Actions、Release 附件和 `catalog.json`，再在颜喵中刷新社区列表验证。

```powershell
git switch main
git pull --ff-only
git tag org.example.blocks/v1.0.0
git push origin org.example.blocks/v1.0.0
```

无需个人 Access Token；Actions 使用本仓库自带的 `GITHUB_TOKEN`，只在发布任务赋予写权限。若组织策略禁止 Actions 发布或阻止机器人更新 `main`，需由仓库所有者调整该策略；不要绕过组织规则，也不要向投稿者提供 token。已经发布的同版本附件不可替换，修复应升级版本。网络失败可在 Actions 重跑；已有附件会比对 SHA-256，内容不一致或缺少校验信息时停止，由维护者检查。

删除目录中的条目可下架，但不会删除已下载的包或用户存档。不要删除或移动已发布 README 对应的源码提交。

## 许可

仓库工具与文档采用 [Apache-2.0](LICENSE)。每个小游戏及素材按其目录下 `LICENSE.txt` 的许可分发；投稿不改变原作者著作权，根目录许可不替代游戏作者许可。

## 更新开发工具包

由维护者从主仓库运行 `scripts/build-plugin-devkit.ps1 -Version <新版本>`，验证独立 CLI、SDK 与模板后，以 `devkit-v<新版本>` 发布 ZIP 及 SHA-256 附件。同版本不得覆盖。随后更新 `toolchain.json` 的版本、URL、大小及两个哈希，并用同一开发包刷新 `developer/` 文本快照；该目录不提交 EXE。检查流程通过后合入。不需要发布新游戏即可更新开发工具。
