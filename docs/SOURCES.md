# 资料与采用来源

## 协作配置依据

2026-11-17 核对以下官方资料：

| 资料 | 本项目采用的内容 |
| --- | --- |
| [Qoder Rules](https://docs.qoder.com/user-guide/rules) | 根目录 AGENTS.md 可自动识别；不复制第二套规则；Qoder 专用规则发生冲突时需检查其优先级 |
| [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow) | 任务分支、commit、push、PR、合并 |
| [gh auth login](https://cli.github.com/manual/gh_auth_login) | 本人浏览器登录自己的 GitHub 账号 |
| [gh auth setup-git](https://cli.github.com/manual/gh_auth_setup-git) | Git HTTPS 凭据帮助器配置；如需用户级变更先说明并由本人同意 |
| [Node Releases](https://nodejs.org/en/about/previous-releases) | 推荐受支持 LTS；本地默认推荐24，不强制替换已有兼容版本 |
| [赛事入口](https://tianchi.aliyun.com/competition/entrance/532536) | 目标比赛地址；完整提交细则尚未核实 |

当前唯一内嵌的第三方代码为 ZzFXMicro（见下方采用记录）；无第三方模型、纹理、字体或音频素材，音效全部由 ZzFX 程序化合成。项目工具使用 Node 内置模块，网页使用系统字体。

## 后续采用记录格式

每项实际采用的库、代码片段或资产写清：用途、本地文件、作者/来源URL、版本或固定提交、许可、署名要求、修改情况。下载候选与正式采用分开；不能只写“网上找的”或“AI 生成所以无须核查”。

## 正式采用

### ZzFXMicro（程序化 8-bit 音效合成器）

| 项 | 内容 |
| --- | --- |
| 用途 | 全部游戏音效的程序化合成（挖掘 blip、连锁递升音、拾取、雷/死亡、出口、UI、摇壶 loop、结算 jingle），零音频素材 |
| 本地文件 | `web/src/vendor/zzfxmicro.js`（封装层 `web/src/engine/audio.js`） |
| 作者 | Frank Force（GitHub KilledByAPixel） |
| 来源 URL | https://github.com/KilledByAPixel/ZzFX |
| 版本/固定提交 | v1.4.0，master 提交 `ac5a4727a44e5506a12f7340087e0b889cfd69dc`（2026-11-03），2026-11-18 经 raw.githubusercontent.com 下载 |
| 许可 | MIT（仓库 LICENSE 已核对：MIT License, Copyright (c) 2019 Frank Force） |
| 署名要求 | 保留原文件 MIT 版权声明头（已原样保留） |
| 修改情况 | 算法与参数原样内嵌，仅在文件末尾追加一行 ES module `export { zzfx, zzfxV, zzfxX }`；由 audio.js 在首次用户交互时动态 import，实现 AudioContext 懒初始化 |

## 思路级参考（不抄代码）

| 项目/资料 | 许可 | 借鉴的思路 | 落点 |
| --- | --- | --- | --- |
| [pwmarcz/kaboom](https://github.com/pwmarcz/kaboom) | MIT | 扫雷 floodReveal 空白格泛洪揭示、首击保护（首击格及邻居布雷排除） | `web/src/core/board.js` 独立实现 |
| [litecanvas](https://github.com/litecanvas/litecanvas) | MIT | 字符串像素图 + 调色板、离屏 canvas 预烘焙后整数倍 blit | `web/src/art/pixels.js`、`web/src/engine/sprites.js` 独立实现 |
| [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS) | MIT | 粒子发射器设计（对象池、上限控制、按事件类型发射） | `web/src/engine/particles.js` 独立实现 |
| [Robert Penner 缓动函数](http://robertpenner.com/easing/) | BSD | easeOutCubic/easeOutBack 等缓动公式（数学公式级参考） | `web/src/engine/fx.js` |
| [Fix Your Timestep!（Gaffer On Games）](https://gafferongames.com/post/fix_your_timestep/) | 文章思路参考 | 固定步长累加器循环、delta 钳制 | `web/src/engine/loop.js` 独立实现 |
