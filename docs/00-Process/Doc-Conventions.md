# 文档约定

## 文件命名

| 类型 | 命名规则 | 示例 |
|---|---|---|
| Spec | `YYYY-MM-DD-<kebab-case-topic>.md` | `2026-05-16-reports-feature.md` |
| Plan | `YYYY-MM-DD-<kebab-case-topic>.md`（与 spec 同名） | `2026-05-16-reports-feature.md` |
| ADR | `NNNN-<kebab-case-topic>.md`（NNNN 单调递增 4 位） | `0001-state-management-zustand.md` |
| Review | `YYYY-MM-DD-<scope>.md` | `2026-05-14-Codebase-Audit.md` |
| 其他 doc | 描述性英文 kebab-case 或大驼峰 | `Code-Layout.md`、`AI-Workflow.md` |

## 链接规则

- 跨文档链接用**相对路径**（Obsidian、VSCode、GitHub 都能解析）
- 链接格式：`[显示文本](./relative/path.md)` 或 `[显示文本](../sibling/path.md)`
- 不要用绝对路径 `/docs/...`（Obsidian vault 根可能不一样）

## Spec / Plan 归档

Specs 和 plans 是不可变的历史交付物，但活动目录里堆久了会淹没在做的事。约定如下：

- **活动目录**（`docs/03-Specs/`、`docs/04-Plans/`）只放：在做的、未启动的、近期（约 30 天内）刚 ship 的。
- **归档**：feature 已 merge 到 main + 已过 ~30 天 grace period → `git mv` 到对应 `_archive/` 子目录（保 git history、保文件名 `YYYY-MM-DD-<topic>.md`）：
  - `docs/03-Specs/_archive/`
  - `docs/04-Plans/_archive/`
- **保留例外**：还在被活文档（spec/plan/runbook）或代码 README 引用、或正在做的 follow-up 仍要参考的，先不动。
- **跨引用**：归档后不强求回头改所有引用——存量 spec 内的「下一步：见 docs/04-Plans/...」这类历史叙述保持原文 OK；新写引用应指向 `_archive/` 路径或干脆引 ship 时的 PR/commit。

不动 `docs/05-Reviews/`——reviews 性质就是事后归档，不需再分级。

## 废弃 banner

任何被废弃的文档保留至少一个 Phase，顶部加：

```markdown
> ⚠ **状态：已废弃** — 内容已迁移到 [新位置](./new-path.md)
> 本文件将在 Phase N 完成后删除。
```

## ADR（Architecture Decision Record）格式

每个架构决定一个文件，放 `docs/02-Architecture/Decisions/NNNN-<topic>.md`：

```markdown
# ADR NNNN: <Decision Title>

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded by ADR-XXXX | Deprecated

## Context

为什么需要做这个决定？背景是什么？

## Decision

我们决定 ...

## Consequences

正面影响、负面影响、未决问题
```

## 章节深度

- 顶部用 `# 标题`（H1，每个文件唯一）
- `## H2` 为主要章节
- 不超过 `#### H4`，更深的层级用列表

## 代码块

- 必须标语言：` ```typescript `、` ```bash ` 等
- shell 命令前不加 `$`
- 长输出片段截断后用 `...` 表示省略

## 表格

- 表头用 `|---|` 简单分隔（不用 alignment）
- 中英文混排时表格更易扫读，优先使用

## 文档的状态

每个文档顶部（H1 下面）可选加：

```markdown
> **状态**：草案 v1 | 已批准 | 已废弃
> **日期**：YYYY-MM-DD
```

适用于：spec、plan、proposal、ADR。其他常规 doc 不需要。

---

**See also:** [AI-Workflow.md](./AI-Workflow.md), [Definition-of-Done.md](./Definition-of-Done.md)
