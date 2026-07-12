# AI 协作工作流

> 本文件是 CLAUDE.md 顶部 5 条硬规则的展开版。任何 feature 必须遵循此流水线。

## 标准流水线

```
[ 0. 需求出现 ]
      ↓
[ 1. Spec ]    → docs/03-Specs/YYYY-MM-DD-<topic>.md
      ↓        （建议用 superpowers:brainstorming skill）
[ 2. Plan ]    → docs/04-Plans/YYYY-MM-DD-<topic>.md
      ↓        （建议用 superpowers:writing-plans skill）
[ 3. Tests ]   → 在测试目录写失败测试（TDD：先红）
      ↓
[ 4. Code ]    → 让测试变绿；最小改动；不超出 plan 边界
      ↓        （默认混合执行，详见 §Subagent vs Inline）
[ 5. Review ] → 跑 lint + 类型检查 + tests；自查或 code-review skill
      ↓
[ 6. Commit ]  → 一个 plan 步骤一个 commit
```

## TDD 力度规定

- **新 Feature：必须 TDD**——spec → 失败测试 → 实现 → 绿
- **Bug 修复：必须有回归测试**——先写一个能重现 bug 的失败测试，再修；测试转绿即修复完成
- **纯 Refactor：现有测试不破即可**——见下节

## Refactor vs Feature 流水线区别

5 条硬规则（spec-first + plan-first + test-first）对**新 feature** 不打折。
但对**纯 refactor**（迁文件 / 抽组件 / 改路由壳 / 重命名，不动业务逻辑），spec / plan 应该大幅压缩，否则会用 verbatim 代码 dump 的方式重复实现细节，浪费时间且 plan-as-written 容易和实际类型签名打架。

| 维度 | 新 Feature | 纯 Refactor |
|---|---|---|
| Spec 目标长度 | 200-400 行 | **≤100 行** |
| Plan 目标长度 | **≤500 行**（骨架：task boundary + files + acceptance；不含 verbatim 代码） | **≤300 行**（commit 表 + 引用上一个 refactor 样板） |
| TDD 力度 | 红→绿→重构 | 现有测试不破即可；只对"顺手修的 bug"或"顺手补的新行为"写红测试 |
| 必备决策点 | 业务行为、UX、数据流、错误处理 | 文件归属、子组件拆分粒度、边界风险、已知 bug 是否纳入范围 |

### Refactor spec 必备段落（其它都可省）

1. **目标 + 非目标** — 非目标尤其重要，明确说"不动业务逻辑"
2. **决策表** — 5-8 行表格回答关键问题
3. **当前文件清单 + 引用关系** — 找出 cross-layer 风险点
4. **架构边界影响** — 是否需要调 lint / boundaries 配置
5. **手测 smoke 范围** — 哪些路径必跑

### Refactor plan 必备段落

1. **Pre-flight** — baseline 测试数 + 分支创建
2. **Commit 顺序表** — 每个 commit 的 message + 涉及文件 + 一句话说明
3. **引用样板** — "按 X / Y 同款 pattern" + 链接上一个 plan
4. **验收门** — lint + 类型检查 + tests + 手测 smoke
5. **不前置 verbatim 代码** — implementer 读现有代码 + 样板 commit 自己写；plan 是 checklist，不是 code dump

### 何时回到完整 plan

- Refactor 涉及**新引入的架构概念**（首次引入某种分层、首次引入 boundaries 规则、首个新类型实体）
- Refactor 顺手**修非 trivial bug** 或**改公开 API**
- 调用方超过 5 处需要协同改动

## Feature Plan 精简原则

实践证明：1500+ 行的 plan 中大量 verbatim 代码在执行时会被 subagent 重写，浪费 token 且容易与实际类型签名冲突。

**Feature plan 应该是 checklist，不是 code dump。**

### Plan 必备段落（所有 feature）

1. **Header** — Goal + Architecture + Tech Stack（3-5 句）
2. **Pre-flight** — baseline 测试数 + 分支创建
3. **File map** — 每个 task 涉及的 create / modify / test 文件路径
4. **Task list** — 每 task 含：step 拆分（checkbox）+ verification command + expected output + commit message
5. **验收门** — lint + 类型检查 + tests + 架构边界零违规

### Plan 不应包含

- 完整代码块（implementer 读 spec + codebase 自己写）
- 逐行 diff 指令（描述 what to change，不是 how）
- 重复的 type 定义（引用源文件路径即可）

### 何时可以写详细代码

- 首次引入的新 pattern（第一个 feature 可以详细，后续的引用"同 X pattern"）
- 关键 edge case 的测试断言（clarify expected behavior）
- 非源代码配置（test runner / lint / build config snippets 不好从 codebase 推导）

---

## Subagent vs Inline：默认混合

**默认即混合开发**：同一条 plan 内逐 task 判复杂度，复杂任务派 subagent，简单任务 controller 直接 inline 做。不要预先把整条 plan 统一成 "全 inline" 或 "全 subagent"。

> ⚠️ **不要问用户「subagent-driven 还是 inline」**。writing-plans / executing-plans skill 末尾会建议 controller 问用户二选一，**这个问题对本项目不适用**——本项目默认混合。Plan 写完直接按下面 Tier 表分类、按节奏执行；用户已通过本文档授权混合模式，无需重新征求。需要用户输入的是 **plan 边界 / spec 决策 / risky action**，不是执行模式。

**为什么混合是默认（而不是例外）：**
- T1/T4 派 subagent = 浪费：T1 冷启动 + 报告往返开销大于实际改动；T4 需要完整会话上下文，subagent 拿不到。
- T2/T3 inline 做 = 浪费 controller 上下文：把 verbatim 代码、grep 输出、试错 diff 全塞进主会话，挤掉真正需要的 plan / spec 记忆。

**快速判断（详细分类见下表）：**

| 任务长这样 | 做法 |
|---|---|
| 改 1-2 个文件 / 单行 edit / 配置 / 文档 / 重命名 | **inline 直接做**（T1） |
| 改 2-5 个文件 + 有样板可参考 + spec 明确 | **派 subagent**（T2，Sonnet） |
| 改 5+ 文件 / 跨多 feature / 新 pattern 首次实现 | **派 subagent**（T3，Sonnet，走 2-stage review） |
| 设计决策 / 新 entity / ADR / 跨模块重构 | **inline 直接做**（T4，需完整上下文） |

典型一条 plan 的节奏：开头 T1 类型/字符串改动 inline → 中段 T2/T3 实现派 subagent → 收尾的 lint/类型检查/test/手测 步骤 inline。

### Tier 分类

| Tier | 判别信号 | 执行 | Review |
|---|---|---|---|
| **T1 Trivial** | 1-2 文件 / 单行 edit / 配置 / 文档 / 重命名 | **Opus inline** | 自验：diff + 类型检查/test |
| **T2 Mechanical** | 2-5 文件 + 有样板 + spec 明确 | **Sonnet subagent** | Controller 对照 spec 看 diff |
| **T3 Judgment** | 5+ 文件 / 跨 feature / import graph 变化 / 新 pattern 首次实现 | **Sonnet subagent** | 2-stage：spec compliance + code quality |
| **T4 Architecture** | 设计决策 / 新 entity / 新 shared module / ADR | **Opus inline** | 自审 + 用户 review |

### 模板：Implementer prompt 必备字段

```
1. Working directory + current branch
2. Task 全文（从 plan 复制，含 steps + verification commands）
3. Context：spec 路径 + 关键决策摘要（1-3 句）
4. 约束：不绕过 pre-commit hook / 不跳过验收门
5. 报告格式要求：DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
   + commit SHA + git log --oneline -3 + test count
```

### 模板：Reviewer prompt 要点

**Spec compliance（T3+ 才跑）：**
- 对照 spec 每条 requirement，确认有 task 对应
- 找 "多做的"（spec 没要求的 feature）和 "少做的"（spec 要求但没实现的）

**Code quality（T3+ 才跑）：**
- 通过 `git diff <base>..HEAD` 看实际改动
- 关注：架构层违规 / 类型安全 / 测试覆盖 / 命名一致性
- 不关注：code style（lint 已覆盖）/ 性能微优化

### 执行节奏

T1/T4 inline 做完即 mark done；T2 subagent → controller 看 diff → mark done；T3 subagent → spec reviewer →（修）→ code reviewer →（修）→ mark done。

**Task 间不停顿**，除非 BLOCKED 自己解不开 / 需要用户审批（如删除性动作）/ 所有 task 完成。

### Controller 启动 checklist（plan 通过后）

不要问用户执行模式。按以下顺序：

1. **Plan 通读** — 扫一遍所有 task，记录每条的文件数 + 改动性质
2. **逐 task 标 Tier** — 直接在 controller 内部分类（不写进 plan 文件）；标准看上表
3. **开始第 1 个 task** — 按 Tier 决定 inline 还是 dispatch subagent，不再请示
4. **每条 task 完成** — mark done，立即起下一条（除非 BLOCKED）
5. **风险点 / dead code / 删除性动作** — 这些才需要 confirm；执行模式本身不需要

### 何时升级 Tier

执行过程中如果发现：
- Implementer 返回 NEEDS_CONTEXT → 可能 prompt 缺信息，先补 context 重试；如果仍然失败 → 升级到 T3 review
- Implementer 返回 BLOCKED → 评估 blocker 性质：context 问题 → 补信息；能力问题 → 不升模型，拆 task
- 2-stage review 发现根本性设计问题 → 暂停，回到 spec/plan 修订

---

## 推荐 Skills

| 阶段 | Skill |
|---|---|
| Feature 启动 / 需求探索 | `superpowers:brainstorming` |
| Spec 通过后写 plan | `superpowers:writing-plans` |
| 执行 plan | `superpowers:executing-plans` 或 `superpowers:subagent-driven-development` |
| Commit 前自查 | `superpowers:requesting-code-review` |
| Debug 时 | `superpowers:systematic-debugging` |
| 完成前验证 | `superpowers:verification-before-completion` |

不强制使用，但推荐——这些 skill 内置了本工作流的检查点。

## Commit 规范

格式：`<type>(<scope>): <subject>`

- `type`: `feat` / `fix` / `refactor` / `docs` / `test` / `chore`
- `scope`: feature 名（按项目模块命名）
- body：引用对应 spec / plan 路径
- 每个 plan 步骤一个 commit，不混合不同 phase 的改动

示例：

```
feat(reports): add OCR auto-rotation for sideways photos

Implements docs/03-Specs/2026-05-16-reports-feature.md §4.2
Refs: docs/04-Plans/2026-05-16-reports-feature.md Task 7
```

## 5 条硬规则（CLAUDE.md 同步）

1. 任何 feature 必须先有 spec 再写代码（1-line typo 除外）
2. 任何 spec 必须配对一个 plan
3. 任何 feature 改动必须先有红测试；bug 修复必须有能重现 bug 的回归测试
4. commit 前必须跑项目的 lint / 类型检查 / tests（建议 pre-commit hook 强制）
5. 文档源在 in-repo，禁止把权威信息只写在 chat 或仓库外笔记

---

**See also:** [Doc-Conventions.md](./Doc-Conventions.md), [Definition-of-Done.md](./Definition-of-Done.md)
