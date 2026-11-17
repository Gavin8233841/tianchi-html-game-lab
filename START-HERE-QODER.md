# 队友入场包：把本文件交给 Qoder Agent

这是一个可单独转发的接力文件，不要求你先会 GitHub 或编程。

## 你本人先做这两件事

1. 注册或登录自己的 GitHub 账号：https://github.com 。把 **GitHub 用户名**发给队长，让他邀请你；不要发送密码、验证码或 token。
2. 在 Qoder 中打开一个准备放项目的空文件夹，使用具备终端和文件操作能力的 Agent 模式，把本文件发给 Agent，并说：

> 请按入场包完成配置。我同意你为这个项目安装缺少的 Git、GitHub CLI 和 Node.js 工具，下载仓库、进行项目级配置，并把本任务的非敏感文件主动提交和推送到自己的任务分支，创建/更新 Issue 和合并请求。不要直接推送远程 main；相关检查通过后主动 squash 合并本任务 PR，无需再等我或队长验收。需要我本人登录、接受邀请或系统授权时，用简单中文告诉我怎么操作；其余步骤请直接完成。

系统或 Qoder 如果要求执行授权，需要你本人确认。这个文件不能绕过工具权限。

---

## 以下是给接手 Qoder Agent 的完整执行指令

你正在协助一名不熟悉计算机开发的队员，加入三人 HTML 游戏共创团队。请实际完成配置，不能只交付操作教程。当前任务是**接入协作与证明同步可用**，不是自行制作游戏。以下路径、账号与地址是已确认值：

- 仓库：`Gavin8233841/tianchi-html-game-lab`
- HTTPS：`https://github.com/Gavin8233841/tianchi-html-game-lab.git`
- 页面：https://github.com/Gavin8233841/tianchi-html-game-lab
- 默认分支：`main`
- 项目负责人：`Gavin8233841`
- 比赛：https://tianchi.aliyun.com/competition/entrance/532536
- 本文件版本：2026-11-17；克隆后以远程最新 `AGENTS.md`、README 和运行命令为准。

### 0. 确认授权和位置

- 若队员已经发送上面的同意语句，直接执行，不重复征求同一授权；只发送文件且未表达执行意愿时，先简短确认是否执行入场配置与主动推送。
- 识别系统、终端和当前目录。优先使用本人选定的空工作区；若当前目录属于另一个项目，不在里面执行 git init，不覆盖任何已有文件。
- 普通空目录可直接克隆到该目录；若里面已有本接力文件或其他内容，创建独立子目录 `tianchi-html-game-lab` 克隆。重跑先寻找本仓库已存在的本地副本并核对 origin，不重复下载到多层目录。
- 没有合适的工作区时，仅问“你想把项目放在哪个文件夹？可以先在 Qoder 打开一个空文件夹”。不得猜测 Windows 盘符或擅自在其他私人目录大量写入。

### 1. 检查和补齐最少工具

检查 `git --version`、`gh --version`、`node --version`、`npm --version`，只补缺项。新装优先 Node.js 24 LTS；已有受支持的 Node 22.12+ / 24 / 26 可以沿用，不为统一版本强行卸载。

- Windows：若已有 winget，可从官方软件包安装 `Git.Git`、`GitHub.cli`，Node 包先查询可用版本再选择兼容 LTS；不要猜包名和版本。其他情况下使用官方安装器。
- macOS：若已有 Homebrew，可用它安装缺少的 Git/gh；Node 先检查现有版本管理器和官方可用包。没有 Homebrew 不为此强行安装整套 Homebrew，可使用官方安装器/官方发布包。
- Linux：核对发行版，采用官方支持的包管理器或官方发布包，不套用 Windows/macOS 命令。
- 官方入口：Git https://git-scm.com/downloads ，GitHub CLI https://cli.github.com ，Node https://nodejs.org/en/download 。先核实当前官方步骤，不执行来历不明的远程 shell 管道。
- 安装遇到系统管理员密码、安装向导或平台权限时由本人操作；告诉他一个当前需要做的动作。安装后检查 PATH，必要时重新打开终端或 Qoder；先重试检测，不让队员自己猜。
- 本项目此阶段没有第三方 npm 依赖，不需要全局安装引擎、Vite、Playwright、Docker、MCP、插件或其他模型工具。不要顺手升级 Qoder/系统或安装一套无关开发环境。

### 2. 使用队员自己的 GitHub 账号

- 检查 gh 是否已经登录 github.com，使用 `gh api user --jq .login` 确认账号。不要输出 `gh auth token`、认证文件、环境密钥或密码。
- 未登录时运行 `gh auth login --hostname github.com --git-protocol https --web`，在浏览器由队员亲自完成设备授权。官方短期设备码仅用于本人当前登录，不记录到文件、截图、PR 或聊天归档。需要 PTY 时使用交互终端。
- 如果当前登录属于别人，先请队员确认使用自己的账号；不退出/删除别人的凭据，不让队员借用队长账号。
- gh 登录后如 Git HTTPS 凭据尚不可用，按官方 `gh auth setup-git --help` 支持的方式配置 Git 凭据帮助器；这一步可能涉及用户级认证配置，应说明用途并取得本人同意，已有可用凭据则跳过。不要设置明文 token remote。
- 获取 `gh api repos/Gavin8233841/tianchi-html-game-lab --jq .permissions.push` 检查写权限。公开可读不代表可推送。
- 无写权限时，请队员把**自己的 GitHub 用户名**发给队长，等待邀请，在 https://github.com/notifications 或仓库页面接受。邀请本身不能由普通队员自己创建。不要自动 fork、申请管理员权限或反复尝试推送。
- 权限等待期间继续克隆、预览、检查和本地记录；最后准确标记“等待邀请，尚未完成远端同步”，队员接受后复查权限并续做。
- 以后若确实需要修改 GitHub Actions 工作流，而 push 明确提示缺少 `workflow` scope，再说明原因并通过本人浏览器执行 `gh auth refresh --hostname github.com --scopes workflow`。不要为首次文档提交预先扩大授权。

### 3. 克隆并配置项目工作区

在已确认位置执行 HTTPS 克隆，或对已存在的正确副本执行 fetch；绝不重新初始化覆盖。进入仓库后核对：

```sh
git rev-parse --show-toplevel
git remote -v
git status --short
git branch --show-current
```

之后先读 `AGENTS.md`、`README.md`、`docs/COLLABORATION.md`、`docs/DECISIONS.md`。Qoder 官方支持根目录 `AGENTS.md` 自动识别，无需另抄一份规则。核对自己确实读到其中的主动提交/推送与 main 边界。

确认 Qoder 左侧文件树打开的是这个**仓库根目录**，能看见 AGENTS.md 与 package.json。如果你不能控制 IDE 切换目录，给出实际本地路径，请队员只执行一次“打开文件夹”；切换后让他发送“继续入场配置”，不要声称已自动切换工作区。

项目配置仅对本仓库生效：

- 用 GitHub 登录名作为本仓库 `user.name`；GitHub API 返回的本人 `id` 与 `login` 组合为 `<id>+<login>@users.noreply.github.com` 作为本仓库 `user.email`，避免公开私人邮箱。先核对是本人；已有明确偏好的本仓库身份可保留。
- 使用 `git config --local pull.ff only`、`git config --local fetch.prune true`、`git config --local core.autocrlf false`。换行由仓库 `.gitattributes` 管理。不要修改全局 Git 身份或 Qoder 全局规则。
- 若已有本机 Qoder 规则与本项目冲突，指出具体冲突；只处理影响本项目的部分，不删除队员其他项目规则。读取根目录规则失败时先显式附加 AGENTS.md 并核对当前 Qoder 官方文档，再修复加载，不盲造 `.qoder` 配置格式。

### 4. 跑通本地预览与检查

从 README 获取当前命令，此版本为：

```sh
npm run check
npm run dev
```

- 检查命令正常结束；开发服务持续运行是正常状态，使用另一个终端或后台任务检查。
- 用本机 HTTP 请求验证页面返回 200；具备浏览器工具时打开页面核对实际显示，没有浏览器工具则明确说只验证 HTTP，让队员点开地址确认页面。不能把终端返回成功说成看过页面。
- 默认 http://127.0.0.1:4173 ，端口被占用就 `npm run dev -- --port 4174` 或其他空闲端口，不结束不认识的进程。
- 当前只有“协作环境已就绪”占位页，没有游戏。不要为了演示自行加入玩法、选引擎、下载素材或部署站点。
- 不修改系统防火墙、不绑定到公网；要跨电脑在线试玩时另开部署任务。

### 5. 实际完成首次提交、推送和 PR

这一步是入场验收，不能省略成“以后记得提交”。

1. fetch 最新 main，检查工作区；从最新 `origin/main` 创建 `task/<本人GitHub名>/onboarding`。重跑时先检查此分支与对应 PR 是否已存在/已合并，未合并就续做，已合并且无变化就不再创建重复 PR。
2. 仅新增/更新 `docs/team/<本人GitHub名>.md`，记录 GitHub 用户名、系统大类、实际 Git/gh/Node 版本、规则已读、本地检查结果和日期。不要写完整本地路径、私人邮箱、电脑名、token 或聊天原文。每人独立文件，避免两人入场撞文件。
3. 明确暂存这个文件，commit，例如 `docs: 完成 <用户名> 协作入场检查`。检查暂存差异，无关修改不带上。
4. 确认有写权限后 `git push -u origin <本任务分支>`，用 `gh pr create --base main --head <本任务分支> --title ... --body-file <说明文件>` 创建 PR。说明文件放项目 `.local/`（已忽略），不要把临时路径写进公开正文。标题如“入场：<用户名> 完成协作配置”。
5. PR 简短记录已验证事项和仍需本人确认的事项；不因存在未核实的浏览器显示而假称全部通过。跟踪 GitHub 检查结果，失败则定位修复本任务问题；不修改检查标准掩盖失败。
6. 核对差异与检查后主动 squash 合并本任务 PR，检查未结束可启用自动合并。提供 PR 链接和合并提交号，干净时回 main 快进更新。仍排队就说明“等待自动检查后合并”，不能说已合入。不直接推 main，不额外发送邮件/私信。

没有写权限/断网时，保留本地 commit，报告尚未推送和确切所需动作。队员接受邀请或恢复网络后继续本步骤，不让他重头安装工具。

### 6. 配置以后每次都主动协作的习惯

根据仓库 AGENTS.md 执行，核心是：

- 新会话先看状态、fetch、读当前任务和决定；同一任务复用未合并分支。
- 队员描述需求后，你负责识别任务边界并实现，不让他先会写专业需求文档。
- 做到阶段结果就主动提交和推送；结束前检查未提交/未推送，不等队员提醒。
- 未完成的成果用 Draft PR 保存，完成功能用 Ready PR 交付；同一 PR 追加修改。
- 三人 Agent 均可在检查通过后主动合并本任务 PR，无需额外验收。大改动提前提醒影响和回滚办法，不增加固定审批；不擅自扩大成改权限或部署上线。
- 每次收到新请求先获取并安全同步 main 和队友进展。保留未完成改动，断网或冲突要说明同步缺口。
- 默认复用固定克隆，按实际职责拆分源码，临时产物放忽略目录；不反复创建 worktree，不自动清理他人修改。
- 有同步障碍，及时用中文说清；登录、接受邀请由本人完成，Git 日常工作你来做。
- 规则不是后台服务：关闭 Qoder、电脑休眠或用户停止任务后不保证继续保存。用户说准备结束时，优先完成当前可保存阶段并反馈同步状态。

### 7. 最终只向队员汇报这些

入场后的团队动态辅助功能见 docs/TEAM-FEED.md：可以让轻量子智能体按需读取近期并发布有意义的摘要，不派工、不催办、不要求协助或回复，失败不影响开发。不要为入场验证发送测试签到评论，也无需额外安装服务。

```text
仓库与本地位置：……
GitHub 账号 / 写权限：……
Qoder 工作区与规则：……
本地页面：……（HTTP / 浏览器实际检查分别说明）
检查结果：……
分支与提交：……
远端同步 / PR：……
还需要你操作：无 / 一个明确动作
```

结束时告诉队员：以后可直接用自然语言说想法；Agent 会处理 Git。初始化完成后等待创意讨论，不擅自开始做一个游戏。

## 官方依据（初始化时可按需核对最新版）

- Qoder 规则与 AGENTS.md：https://docs.qoder.com/user-guide/rules
- GitHub 轻量协作：https://docs.github.com/en/get-started/using-github/github-flow
- gh 浏览器登录：https://cli.github.com/manual/gh_auth_login
- gh Git 凭据：https://cli.github.com/manual/gh_auth_setup-git
- Node LTS：https://nodejs.org/en/about/previous-releases
