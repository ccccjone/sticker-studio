# CLAUDE.md

本文件为 Claude Code（claude.ai/code）提供本仓库的协作规则。

## 项目：Sticker Studio（表情包工坊）

浏览器端 AI 表情包 / 透明图片处理工具：去背景、统一尺寸、拼图拆分、批量导出、Prompt 生成指南。纯前端（Vite + React + TypeScript），所有图片在浏览器本地处理，不上传服务器、无账号、无云端存储。界面中英双语。

- 需求 PRD：[docs/01-Requirements/2026-07-11-sticker-studio-prd.md](./docs/01-Requirements/2026-07-11-sticker-studio-prd.md)
- 三件套命令：`npm run lint` / `npm run typecheck` / `npm test`（见 Definition-of-Done）

> **角色**：纯导航 + 硬规则。所有详细内容下沉到 [docs/](./docs/)。

## 5 条硬规则

1. **Spec-first**：任何 feature 必须先有 spec 再写代码（1-line typo 除外）。Spec 放 [docs/03-Specs/](./docs/03-Specs/)。
2. **Plan-first**：任何 spec 必须配对一个 plan。Plan 放 [docs/04-Plans/](./docs/04-Plans/)。
3. **Test-first**：feature 改动必须先写红测试；bug 修复必须先有能重现 bug 的回归测试。详见 [TDD 力度规定](./docs/00-Process/AI-Workflow.md#tdd-力度规定)。
4. **Verification gate**：commit 前必须跑项目的 lint / 类型检查 / 测试三件套（具体命令见 [Definition-of-Done.md](./docs/00-Process/Definition-of-Done.md)）。建议配 pre-commit hook 强制。
5. **Single source of truth**：文档源在 in-repo `docs/`。禁止把权威信息只写在 chat、Obsidian、Notion 等仓库外的笔记中。

## 导航

| 想做什么 | 去哪 |
|---|---|
| 看产品需求 | [docs/01-Requirements/](./docs/01-Requirements/) |
| 了解工作流 | [docs/00-Process/AI-Workflow.md](./docs/00-Process/AI-Workflow.md) |
| 看完成标准 | [docs/00-Process/Definition-of-Done.md](./docs/00-Process/Definition-of-Done.md) |
| 看文档约定 | [docs/00-Process/Doc-Conventions.md](./docs/00-Process/Doc-Conventions.md) |
| 看 / 写 spec、plan | [docs/03-Specs/](./docs/03-Specs/) + [docs/04-Plans/](./docs/04-Plans/) |

> 视项目情况，可在此表追加：`docs/01-Requirements/`（需求 / backlog）、`docs/02-Architecture/`（架构 / ADR）、`docs/05-Reviews/`（review / audit）、`docs/06-Testing/`、`docs/07-Runbooks/` 等。

## 推荐 Skills（可选）

需要先安装 [superpowers](https://github.com/obra/superpowers) plugin。

| 阶段 | Skill |
|---|---|
| Feature 启动 / 需求探索 | `superpowers:brainstorming` |
| Spec 通过后写 plan | `superpowers:writing-plans` |
| 执行 plan | `superpowers:executing-plans` 或 `superpowers:subagent-driven-development` |
| Commit 前自查 | `superpowers:requesting-code-review` |
| Debug | `superpowers:systematic-debugging` |
| 完成前验证 | `superpowers:verification-before-completion` |

不强制——这些 skill 内置了本工作流的检查点。
