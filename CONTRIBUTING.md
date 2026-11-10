# 小游戏投稿说明

## 准备

使用 [公开开发工具包](https://github.com/xianyvqiu/yanmew-community-games/releases/tag/devkit-v1.0.0) 与 [完整 SDK 教程](developer/sdk/README.md) 开发，宿主协议为 `1.0.0`。向 `games/<plugin-id>/` 提交源码，一个 PR 只新增或更新一个游戏。ID 使用稳定的小写反向域名格式，不占用第一方的 `com.yanmew.game.*`；发布后不换 ID。

manifest 与宿主保持同一协议，必须填写实际源码所在的 GitHub 仓库 `repository`。分发入口必须是 `ui/` 下的 HTML。运行资源放在 `ui/`、`assets/`、`locales/`，图标用根目录 `icon.svg` 或 `icon.png`，迁移脚本由 manifest 的 `migration` 指明。包内路径遵守宿主的 ASCII 安全相对路径规则。

必须提供 README.md，写明玩法、控制方式、喵币与联网权限用途、拒绝权限后的行为、存档结构及升级说明、自测宿主版本和结果。README 最多 256 KiB，使用 UTF-8。应用显示 Markdown，忽略原始 HTML；图片请使用本仓库内的相对资源路径，外部站点图片不会自动加载。每个游戏必须有 LICENSE.txt，说明源码许可及素材、字体、音乐等的来源和再分发许可。

不接受只有成品包、无来源的素材、混淆代码、用户数据、API Key、`.env` 或 `node_modules`。构建产物必须可与源码对应。投稿者的脚本不会在发布流程执行；需要预编译时，请提交可审查的开发源码和最终 `ui/`，写明如何复现。

## 权限及数据

游戏只能通过 `window.yanmew` 使用宿主提供的接口，不能使用 Tauri 命令、直接访问数据库、文件系统、聊天或模型配置。联网通过已授权的 `network.fetch()` origin，不在页面直接请求远端资源。喵币只使用宿主钱包，检查扣款失败和未知结果；同一结算重试保持原 request_id，不重复扣款、返还或发奖。

长期进度保存到插件私有存档；不要把关闭窗口当作丢弃用户长期进度。改变存档结构须提供迁移方案，并验证旧存档升级及失败回退。

## 检查和审阅

提交前运行 `npm test`、`npm run validate`，运行 `npm run toolchain` 取得锁定工具，将打印的 CLI 路径设为 `YANMEW_PLUGIN_CLI`，再执行 `npm run pack -- <plugin-id>`。自动检查只验证目录、元数据及包结构，不运行游戏。维护者还须人工验证实际游玩、不同窗口尺寸、键鼠操作、关闭重开、权限拒绝、网络失败、喵币不足及存档升级。

非维护者不要直接修改 `catalog.json`、发布工作流或仓库工具来通过某个游戏的检查。如需调整公共规则，另开 Issue 讨论。合入源码后由维护者发布，不能在 manifest 自报“官方”或“审核通过”。

## 更新与问题反馈

更新沿用 ID 并提升 SemVer 版本，在 PR 中列明变更、兼容范围和测试结果。发现问题请提交 Issue，包含宿主版本、插件 ID/版本、复现步骤与脱敏报错；不要上传私人存档、聊天记录或密钥。
