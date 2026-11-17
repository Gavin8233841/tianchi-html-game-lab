# HTML Game Lab

三人共创的 HTML 游戏项目，准备参加 **2026 Qoder 高校创造力大赛**。仓库名为临时名称，游戏创意、正式名称、2D / 3D 与引擎尚未确定。

- 仓库：https://github.com/Gavin8233841/tianchi-html-game-lab
- 比赛：https://tianchi.aliyun.com/competition/entrance/532536
- 项目负责人：[@Gavin8233841](https://github.com/Gavin8233841)
- 当前阶段：**协作初始化完成，等待队友入场和创意讨论**。

## 新队友从这里开始

把 [START-HERE-QODER.md](START-HERE-QODER.md) 下载后发给自己的 Qoder Agent，让它按文件完成配置。无需先学习 Git 命令。GitHub 登录和邀请接受由本人操作，Agent 负责其余可执行步骤。

已有工作区时，给 Agent 一句话即可：

> 阅读 AGENTS.md，检查本地与远程状态，接着完成我的任务；每次收到请求先同步队友最新进展；结束前主动提交、推送并在检查通过后合并本任务 PR，告诉我本地试玩地址和同步结果。

## 当前可以运行什么

需要 Git、GitHub CLI（`gh`）、Node.js。新装推荐 Node.js 24 LTS，已有受支持的 22.12+ / 24 / 26 可先沿用。无需安装 npm 依赖。

```sh
npm run dev
```

打开 http://127.0.0.1:4173 。现在仅显示一张协作就绪页，**尚未实现游戏**。关闭终端或 Ctrl+C 停止。端口已占用时：

```sh
npm run dev -- --port 4174
```

```sh
npm run check
```

检查当前预览脚本语法与本地 HTTP 行为。后续采用引擎与构建工具时，由实施该任务的 Agent 同步更新这些命令和检查。

## 怎么一起做

每项任务一个分支，Agent 主动提交和推送，通过 Pull Request（PR，合并请求）汇合。`main` 保存大家共同使用的版本，由三名成员的 Agent 在相关检查通过后主动 squash 合入，无需人工审批。详细操作见 [docs/COLLABORATION.md](docs/COLLABORATION.md)。

创意先提交到 [Issues](https://github.com/Gavin8233841/tianchi-html-game-lab/issues)，大家选定一个方向后，先做能试玩的核心循环，再分工扩展。无需三个人同时搭建基础工程。

[团队动态 #3](https://github.com/Gavin8233841/tianchi-html-game-lab/issues/3) 按需共享简短进展，不派工、不催办、无需回复，也不阻塞开发；各自 Agent 的一次启用指令见 [docs/TEAM-FEED.md](docs/TEAM-FEED.md)。

| 文件 / 目录 | 用途 |
| --- | --- |
| `AGENTS.md` | 所有开发 Agent 共用的规则 |
| `START-HERE-QODER.md` | 可单独转发的队友入场指令 |
| `docs/COLLABORATION.md` | 同步、冲突与交付操作方法 |
| `docs/OWNER.md` | 负责人邀请队友、验收与合并的方法 |
| `docs/DECISIONS.md` | 已确认的游戏方向和重要决定 |
| `docs/SOURCES.md` | 资料依据、采用的代码和资产来源 |
| `docs/team/` | 每位成员各自的入场记录 |
| `web/` | 当前浏览器入口及将来的运行资源 |
| `scripts/` | 当前无第三方依赖的本地预览与检查 |

## 交付边界

目标为通过 HTML 入口在浏览器游玩的游戏，并准备比赛展示和 Qoder 实际使用记录。是否必须单文件、离线运行、部署平台及正式提交要求，待核对赛事规则后确定；当前不预先锁死引擎或架构。

这是一个全新项目，不自动继承 GOLDEN HOUR 或其他工程的代码、素材、玩法和署名。公开仓库不等于为内容授予开源许可；采用第三方内容时逐项记录来源与许可，团队代码的发布许可另行决定。Qoder 配置、密钥和私人聊天不上传。
