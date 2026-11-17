# 负责人指南

当前负责人：`Gavin8233841`。队友不懂 gh 没关系，他们自己的 Agent 会完成本地配置、提交和 PR。你主要处理邀请、游戏方向与试玩反馈；三人的 Agent 均可主动合并合格任务。

## 1. 邀请两位队友

先收集他们各自的 **GitHub 用户名**。进入：

https://github.com/Gavin8233841/tianchi-html-game-lab/settings/access

使用 Add people 邀请为协作者即可，不需要给予管理员权限。他们接受邀请后才有 push 权限；公开仓库能下载不代表能写入。

也可以把两个准确用户名交给负责人的 Agent，并明确让它邀请这两人；不需要密码或 token。入场包允许队友先完成本地配置，等待邀请时不影响本地试玩。

## 2. 转发接力包

把根目录 `START-HERE-QODER.md` 发给两人，告诉他们“用 Qoder Agent 打开并按文件执行”。文件含仓库地址和同意语句，可以独立转发。建议下载原文件附件，避免聊天软件截断。

网页：https://github.com/Gavin8233841/tianchi-html-game-lab/blob/main/START-HERE-QODER.md

原文件：https://raw.githubusercontent.com/Gavin8233841/tianchi-html-game-lab/main/START-HERE-QODER.md

## 3. 入场验收

每人应出现一个入场 PR 和独立的 `docs/team/<login>.md`。你可以告诉自己的 Agent：

> 检查两个队友的入场 PR，核对差异、环境记录和 CI；没有问题就主动 squash 合并，并汇报仍缺的实际验证。

不要仅凭“配置好了”判断同步成功，PR 链接和远端文件就是可见证据。

## 4. 之后怎么分工

先讨论并选一个游戏方向，再让一人搭出可运行的核心循环。之后按独立任务并行：核心玩法、场景或视觉实验、反馈与界面等，职责可以轮换。

队友完成后发来 PR 链接，Agent 核对差异、检查和与最新 main 的兼容性后主动 squash 合并，无需你逐项验收；你可随时试玩提出调整。没有完成的原型保存在 Draft PR，不会自动进入共同版本。

## 当前仓库设置与边界

- 公开；Issues 和 PR 可用；不启用 Wiki、正式部署或付费服务。
- 初始化配置：main 需要 PR 与 `Workspace check` 通过，并与最新 main 同步；禁止强推/删 main，允许 squash 合并。负责人保留管理员应急处理能力。实际设置可在仓库 Settings → Branches 核对；**以 GitHub 当前设置为准**。
- 不要求固定数量的审批，避免三人互相等待。三人的 Agent 均可主动合入自己的合格任务。负责人可在必要时处理仓库设置，不把日常小修变成复杂审批。
- CI 的绿色只表示当前工具检查通过；游戏还未实现，玩法、审美和手感需要之后实际试玩。
- 已启用 GitHub 自动合并；每轮聊天由 Agent 主动同步远端进展。没有后台本地同步、Pages 或外部部署。
- 赛事完整提交规则尚待核对；本仓库不会把未核实的原创性、工具使用或部署要求写成已满足。
