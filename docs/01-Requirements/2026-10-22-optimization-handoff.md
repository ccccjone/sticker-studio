# 优化交接 Prompt（给 Claude Code CLI）

> **状态**：待执行
> **日期**：2026-10-22
> **用法**：在仓库根目录启动 Claude Code，把下面「Prompt 正文」整段发给它；或直接说「按 docs/01-Requirements/2026-10-22-optimization-handoff.md 执行」。

---

## Prompt 正文

你在 Sticker Studio（表情包工坊）仓库里工作。这是一个纯前端、所有图片在浏览器本地处理的 React 19 + TS + Vite + Konva + Zustand 应用。当前状态：`main` 干净，25 个测试文件 / 173 个测试全绿，`tsc -b` 和 `oxlint --deny-warnings` 均 0 问题；最后一次提交 2026-07-12（背景系统）。项目**尚未上线**，仓库无任何部署 / CI 配置。

任务分两个阶段，**必须按顺序做**：阶段 0 完成并由我确认后，才进入阶段 1。

### 阶段 0：把协作工作流升级到 workflow-kit v2

目标：本仓库的 Claude 工作流与 <https://github.com/ccccjone/workflow-kit/blob/main/claude-workflow-kit/README.md>（v2）一致。仓库里现在的 `claude-workflow-kit/`（已 gitignore）和 `docs/00-Process/` 是 **v1**，只有 CLAUDE.md + 三份流程文档，没有 `.claude/` 下的 hooks / agents / skills。

1. 把 workflow-kit 克隆到仓库外的临时目录，**先完整读一遍** kit 的 README、CLAUDE.md、`.claude/` 和 `docs/00-Process/`，再动手。
2. 按 kit README 的「已有项目」流程执行：`sh <kit>/claude-workflow-kit/install.sh <本仓库>`（install 脚本不覆盖已存在文件）。
3. 手动合并冲突文件：
   - `CLAUDE.md`：换成 v2 的硬规则 / 执行默认值 / 导航结构；**保留**本项目段落（项目简介、PRD 链接、三件套命令、`docs/01-Requirements/` 导航）。去掉 v1 里对 superpowers plugin 的依赖表，改指向 kit 自带的 skills（project-init / spec-writing / plan-execution / refactor-flow / lesson-capture）。
   - `docs/00-Process/*.md`：用 v2 版本替换 v1，若 v1 中有本项目专属内容则保留合并。
   - `.claude/settings.json`：采用 kit 的 permissions allow/deny 与 hooks 注册。
   - `.claude/skills/verify/`（本项目已有的 Playwright 端到端验证配方）**必须保留**，与 kit skills 并存。
4. 配置 `.claude/verify.sh`，填入本项目三件套：`npm run lint && npm run typecheck && npm test -- run`（注意 `npm test` 默认是 watch 模式，必须带 `-- run`）。确认 `jq` 可用（hooks 依赖）。
5. 运行 `project-init`（已有项目模式），为当前技术栈写 ADR（放 `docs/02-Architecture/`），并补全 CLAUDE.md 的项目段。
6. 创建 `docs/05-Reviews/lessons.md`（若 install 未创建）。
7. 处理旧副本：`claude-workflow-kit/` 目录已无用，列出来问我是否删除，不要自行删。
8. 顺手修正文档漂移：README 中「121+ 测试」→ 实际数量；`docs/01-Requirements/Backlog.md` 的「已完成」补上「画布视口自适应 + 边界遮罩」和「背景系统」（spec 分别是 `2026-07-12-canvas-viewport-bounds.md`、`2026-07-12-export-background.md`），并把本文件的阶段 1 条目并入 Backlog。
9. 验证：故意制造一次 lint 失败，确认 stop hook 能拦住；确认 `--no-verify` 和 force push 被 guard 拒绝。然后恢复。
10. 提交（遵守 verification gate），汇报变更清单，**停下等我确认**。

### 阶段 1：产品与技术优化

每一项都走 v2 流程：按风险分级写 spec（`spec-writing`）→ 写 plan → 我确认 → 先写红测试 → 实现 → reviewer 用新证据（测试输出、截图、导出像素断言）复核 → 提交。**一个条目一个 spec**，不要合并成大 spec。动手前把下面清单整理进 Backlog 并与我确认优先级。

#### 必须保持的不变量
- 图片只在浏览器本地处理，不上传任何服务器（verify skill 里的「隐私断言：非 localhost 请求数为 0」要继续成立；引入模型时，模型文件的下载需在 spec 里单独说明并征得我同意）。
- 透明必须是真实 Alpha；棋盘格仅用于预览。
- 预览用降采样代理图，导出从原图重算。
- `src/core/` 不得 import React / DOM。

#### A. 上线与工程基础（建议最先做，T1/T2）

| # | 项 | 现状 / 证据 | 要做什么 |
|---|---|---|---|
| A1 | 部署上线 | 无 `.github/`、`vercel.json`、`netlify.toml`；仓库私有；`dist/` 只在本地 | **先问我选哪个平台**（Vercel / Cloudflare Pages / GitHub Pages）。SPA 需配置所有路由回落到 `index.html`（react-router 刷新防 404）；若选 GitHub Pages 需在 `vite.config.ts` 设 `base`。 |
| A2 | CI | 三件套全靠自觉 | GitHub Actions：push / PR 时跑 `.claude/verify.sh` 同等命令；部署挂在 CI 通过之后。 |
| A3 | SEO / 分享 | `index.html` 只有 title | 补 description、Open Graph / Twitter card、分享预览图（中英）。 |
| A4 | 使用统计 | 无 | 选一个不收集图片、隐私友好的方案（如 Plausible / Umami / Cloudflare Web Analytics），只记页面与工作流事件。需要我确认。 |

#### B. 技术优化

| # | 项 | 现状 / 证据 | 要做什么 |
|---|---|---|---|
| B1 | 批量上传内存峰值（**高优，可能崩溃**） | `src/features/batch/batchStore.ts` ~L196 用 `Promise.all` 同时解码全部文件，50 张 2048² ≈ 800MB ImageData | 改为限并发队列（如 2–3），逐张解码；补回归测试。导出端已是串行（`exportZip.ts`），保持一致。 |
| B2 | 重像素运算移入 Worker | 只有 `engines/colorTolerance.ts` 走 `runPixelTask`；描边（`core/outline.ts`）与导出合成（`canvas/renderExport.ts`）在主线程 | 扩展 `workers/pixelTasks.ts` 覆盖描边与导出；能 transfer 的 buffer 用 transfer，避免结构化克隆复制大数组（`runPixelTask.ts` 注释里写了目前不 transfer）。保留主线程降级。 |
| B3 | 代码分割 | 单个 `index-*.js` ≈ 829KB | 路由级 `React.lazy`；Konva / JSZip 按需加载；为后续 AI 模型（几十 MB）预留懒加载路径。给出前后 bundle 对比。 |
| B4 | 重复的蒙版 / 撤销逻辑 | `splitterStore.ts` 870 行、`batchStore.ts` 686 行、`editorStore.ts` 452 行，笔刷 undo/redo 实现相似（如 batchStore ~L480–506） | 用 `refactor-flow` 抽公共的 mask-history 模块，行为不变，测试先行锁定现有行为。 |
| B5 | 错误边界 | 无 ErrorBoundary，任一异常整页白屏 | 路由级 ErrorBoundary + 友好中英文案 + 「重置当前项目」入口。 |
| B6 | 资源释放 | `createObjectURL` 只在 `canvas/encode.ts` 一处，靠 10s `setTimeout` 回收 | 审计 Canvas / Blob / ImageBitmap 生命周期，切换图片或离开页面时显式释放（PRD §12.2）。 |

#### C. 产品优化

| # | 项 | 现状 / 证据 | 要做什么 |
|---|---|---|---|
| C1 | 真·自动去背景（**核心价值**） | 「自动」实际只有颜色容差引擎；对棋盘格假透明、阴影、渐变背景效果差（PRD §2 问题一） | 用 `RemovalEngine` 接口接入浏览器本地分割模型（候选 `@imgly/background-removal` / onnxruntime-web）。懒加载、显示下载进度、失败回退到颜色引擎。spec 里写清模型体积、许可证、首次加载体验。 |
| C2 | 拼图自动拆分 | 只有网格 + 手动框选（PRD §7.4 未实现） | 基于现有前景蒙版做连通区域 → 过滤噪点 → 合并临近元素 → 加安全边距 → 让用户确认/修正。算法放 `core/`，纯函数全量单测。 |
| C3 | 去白边 / 去色边（defringe） | Backlog P1 首项，代码中无实现 | 边缘颜色净化，与 C1 配合；用像素断言测试。 |
| C4 | 编辑体验补齐 | 无前后对比滑块、无擦除放大镜（PRD §5.2） | 对比滑块 + 笔刷放大镜。 |
| C5 | 导出前检查 | PRD §5.11 未实现 | 导出前提示：残留背景、主体被裁切、全透明、尺寸异常等。 |
| C6 | 刷新不丢工作 | 除 i18n 外无任何持久化（PRD §9.3 允许本地暂存） | IndexedDB 暂存当前项目（仅本地），提供「清除本地数据」。 |
| C7 | 示例体验 | 首页需上传自己的图才能体验 | 内置示例图（自制，无版权问题），一键试用各工作流。 |
| C8 | 其余 PRD 第二阶段 | WebP 导出（目前仅输入支持）、HEIC 输入、Alpha 自动检测 / 质量检查 | 按 Backlog 排期。 |
| C9 | 暗色模式 | Backlog P2 | 排在最后。 |

#### 建议顺序

1. 阶段 0（workflow 升级）
2. A1 部署 + A2 CI（尽快有可分享链接）
3. B1 内存修复 + B5 错误边界（稳定性）
4. B3 代码分割（为 C1 铺路）
5. C1 本地 AI 去背景 → C3 defringe → C2 自动拆分
6. 其余按 Backlog 与我确认后推进

#### 每项完成的验收
- `.claude/verify.sh` 全绿；
- UI 相关改动用 `.claude/skills/verify` 的 Playwright 配方跑一遍对应工作流，附截图或导出像素断言结果；
- 隐私断言（外部请求数 = 0，模型下载除外且已在 spec 中批准）；
- 有教训就用 `lesson-capture` 记入 `docs/05-Reviews/lessons.md`。
