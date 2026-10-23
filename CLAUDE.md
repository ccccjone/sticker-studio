# CLAUDE.md

本文件为 Claude Code 提供本仓库的协作规则。

> **角色**：硬规则 + 导航。操作细节在 `.claude/skills/`（按需加载），背景说明在 [docs/](./docs/)。
> 本文件每次会话都会载入，保持短、少改动（稳定前缀有利于 prompt cache）。
> 本文件只规定流程，不规定语言、框架与架构；这些以下方「项目特定」段和 ADR 为准。

## 5 条硬规则

1. **Spec 按风险分级**：开工前先判定 S0 / S1 / S2，写在回复第一行。S0 说明假设后直接做；S1 写短 spec；S2 写完整 spec 并等用户确认。见 `spec-writing` skill。
2. **Plan-first（S1/S2）**：spec 配一个同名 plan，plan 是 checklist 不是代码。见 `plan-execution` skill。
3. **Test-first**：feature 先写红测试；bug 先写能重现的回归测试；纯 refactor 现有测试不破即可（见 `refactor-flow` skill）。
4. **Verification gate**：`.claude/verify.sh` 是验收三件套的唯一来源。声称完成时必须贴出它的输出摘录；禁止 `--no-verify`（已由 hook 强制）。
5. **Single source of truth**：权威信息只放在仓库内（`docs/`、`.claude/`）。仓库外的笔记和聊天记录不算。

## 执行默认

- 默认混合执行（T1/T4 主会话做，T2/T3 派 `implementer`，大范围搜索派 `explorer`），**不要问用户选执行模式**。
- 需要用户确认的只有：S2 spec、plan 边界变化、删除性 / 不可逆操作、BLOCKED。
- 同一命令或测试连续失败 3 次且没有进展 → 停止，写下假设，换策略或上报。
- 出现返工、被纠正、被打回时，用 `lesson-capture` 记录。

## 项目特定

**Sticker Studio（表情包工坊）**：浏览器端 AI 表情包 / 透明图片处理工具——去背景、统一尺寸、拼图拆分、批量导出、Prompt 生成指南。纯前端，所有图片在浏览器本地处理，不上传服务器、无账号、无云端存储。界面中英双语。需求见 [PRD](./docs/01-Requirements/2026-07-11-sticker-studio-prd.md)，待办见 [Backlog](./docs/01-Requirements/Backlog.md)。

- **技术栈**：React 19 + TypeScript strict + Vite + Tailwind v4 + Konva + Zustand + react-i18next + JSZip；Vitest + oxlint（见 [ADR 0001](./docs/02-Architecture/Decisions/0001-tech-stack.md)）
- **目录约定**：`src/core/`（纯算法，**禁止 import React / DOM**）· `engines/`（引擎实现）· `canvas/`（core ↔ Canvas 唯一桥接）· `workers/` · `features/`（editor / batch / splitter / guide）· `pages/` · `app/` · `locales/{zh,en}.json`
- **不变量**：图片不出浏览器（外部请求数 = 0）；透明是真实 Alpha，棋盘格仅预览；预览用代理图，导出从原图重算
- **运行 / 测试**：`npm run dev`；三件套 `npm run lint` / `npm run typecheck` / `npm test -- run`（`npm test` 默认 watch），统一入口 `.claude/verify.sh`
- **UI 视觉验证方式**：`verify` skill（`.claude/skills/verify/`）——`vite preview` + Playwright 系统 Chrome，截图 + 导出像素断言 + 隐私断言

## 导航

| 想做什么 | 去哪 |
|---|---|
| 产品需求 / 待办 | [docs/01-Requirements/](./docs/01-Requirements/) |
| 架构决定（ADR） | [docs/02-Architecture/Decisions/](./docs/02-Architecture/Decisions/) |
| 工作流总览与设计理由 | [docs/00-Process/AI-Workflow.md](./docs/00-Process/AI-Workflow.md) |
| 完成标准 | [docs/00-Process/Definition-of-Done.md](./docs/00-Process/Definition-of-Done.md) |
| 文档约定 / ADR 格式 | [docs/00-Process/Doc-Conventions.md](./docs/00-Process/Doc-Conventions.md) |
| Spec / Plan | [docs/03-Specs/](./docs/03-Specs/) · [docs/04-Plans/](./docs/04-Plans/) |
| 经验记录 | [docs/05-Reviews/lessons.md](./docs/05-Reviews/lessons.md) |
| 验收命令 | [.claude/verify.sh](./.claude/verify.sh) |
| Skills | `spec-writing` · `plan-execution` · `refactor-flow` · `lesson-capture` · `project-init` · `verify`（端到端验证） |
