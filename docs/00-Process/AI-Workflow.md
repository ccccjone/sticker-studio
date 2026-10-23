# AI 协作工作流

> 本文件是给人看的总览和设计理由。Claude 执行时用的操作细节在 `.claude/skills/` 与 `.claude/agents/`，两者冲突时以 skills 为准。
> 设计依据主要来自《深入理解 AI Agent》（bojieli/ai-agent-book）第 1、2、5、7、9、10 章。

## 标准流水线

```
[0. 需求] → 判级 S0 / S1 / S2                      spec-writing
   ↓ S0：说明假设 → 直接做 → verify.sh → commit
[1. Spec]  docs/03-Specs/YYYY-MM-DD-<topic>.md     spec-writing（S2 需用户确认）
   ↓
[2. Plan]  docs/04-Plans/<同名>.md                   plan-execution
   ↓
[3. Tests] 先红
[4. Code]  变绿；逐 task 分 T1-T4 混合执行           plan-execution + agents/
[5. Review] T2 主会话看 diff；T3 reviewer 基于执行证据
[6. Commit] 一个 task 一个 commit；verify.sh 由 hook 强制
[7. 收尾]  Progress 更新 + 5 行变更说明 + lesson-capture
```

纯 refactor 走 `refactor-flow`，spec/plan 大幅压缩。

## 框架：Harness 五要素如何落地

书中的公式：**Agent = Model + Harness**，**Harness = 上下文管理 + 工具接口 + 约束 + 验证 + 纠正**。本工作流对应如下：

| 要素 | 本仓库的落地 | 强制方式 |
|---|---|---|
| 上下文管理 | CLAUDE.md（短、常驻）+ skills（按需加载）+ spec/plan 在仓库内；explorer 隔离搜索噪声 | 结构 |
| 工具接口 | `.claude/agents/` 三个角色，prompt 自包含，报告格式固定 | 模板 |
| 约束 | `settings.json` 的 deny/ask + `guard-bash.sh` | **代码** |
| 验证 | `verify.sh` 单一来源；Stop hook + pre-commit；reviewer 自己跑、看截图 | **代码** |
| 纠正 | 熔断（3 次）、Tier 升级、SPEC_PROBLEM 回退、git 回滚 | 规则 |

核心原则：**约束优先于指导**——能用 hook / lint / 测试强制的，不要只写在文档里。文字规则是"建议别做"，代码规则是"做不了"。

## 为什么 spec 要分级

书中第 9 章的需求澄清实验：问得太少导致返工，问得太多把小改动变成访谈。所以按"歧义 × 风险 × 返工成本"分级，而不是所有 feature 一律写 200-400 行 spec。详见 `spec-writing` skill。

## 为什么 review 要有执行证据

第 10 章的判据：多 Agent 协作有价值的前提是引入**生成时没有的新信息**。同一模型重读 diff 几乎不引入新信息；审查者自己跑测试、看渲染截图、用工具验证事实，效果才显著提升。所以 reviewer 必须自己跑 verify.sh，UI 改动要看截图。

## 模型分工：按角色写，在一处绑定

文档和 skills 里只写**角色**，不写模型名；模型只在 `.claude/agents/*.md` 的 `model:` 字段绑定一次。

| 角色 | 需要的能力 | 绑定位置 | 默认 |
|---|---|---|---|
| 主会话（T1/T4、计划、最终验收） | 最强推理、完整上下文 | 你启动 session 时 `/model` 选择 | 当前最强档 |
| implementer（T2/T3） | 均衡：够聪明、够快、够便宜 | `.claude/agents/implementer.md` | `sonnet` |
| reviewer（T3 审查） | 判断力；要能发现 implementer 发现不了的问题 | `.claude/agents/reviewer.md` | `inherit`（跟主会话同档） |
| explorer（搜索定位） | 速度与成本 | `.claude/agents/explorer.md` | `haiku` |

规则：

1. **用别名（`sonnet` / `opus` / `haiku` / `inherit`），不用完整版本号。** 别名随新版本自动升级，文档不会过时。只有在需要可复现对比时（例如评估自家产品里的 prompt）才固定完整模型 ID，并写在评估配置里，而不是这里。
2. **reviewer 不低于 implementer 的档位。** 同档模型更容易放过自己同类的错误；`inherit` 让它跟随主会话。
3. **换档靠证据，不靠感觉。** 新模型出来或想给 implementer 降档省钱时，拿 `docs/05-Reviews/` 里 5-10 个做过的真实 task 重跑一遍，对比：一次通过率、reviewer 打回次数、熔断次数、token 消耗。结果写成 ADR，再改 `model:` 字段（书中第 7 章"评估驱动的模型选型"）。
4. **临时调整不改文件。** 某个特别难的 T3 可以在派发时临时要求用更强的模型，或者直接升级为 T4 由主会话来做。

## Commit 规范

格式：`<type>(<scope>): <subject>`，type ∈ `feat` / `fix` / `refactor` / `docs` / `test` / `chore`。body 引用 spec/plan 路径。一个 plan task 一个 commit。

```text
feat(reports): add OCR auto-rotation for sideways photos

Implements docs/03-Specs/2026-05-16-reports-feature.md §4.2
Refs: docs/04-Plans/2026-05-16-reports-feature.md Task 7
```

## 人的职责：防理解债

第 10 章："可以外包思考，但不能外包理解。" Agent 交付越快，人对系统的理解越容易落后。

- T4 与 S2 的决策由你拍板，写成 ADR。
- 每个 plan 收尾时读 Claude 写的 5 行变更说明，并亲自看它点名的几处 diff。
- 每个 Phase 结束，整理一次 `lessons.md`（见 `lesson-capture`）。

## 推荐搭配（可选）

[superpowers](https://github.com/obra/superpowers) plugin 的 `brainstorming`、`systematic-debugging`、`verification-before-completion` 可以与本工作流叠加。它的 `writing-plans` / `executing-plans` 末尾会问"subagent 还是 inline"，**本项目忽略这个问题**，按 `plan-execution` 默认混合执行。

---

**See also:** [Definition-of-Done.md](./Definition-of-Done.md), [Doc-Conventions.md](./Doc-Conventions.md)
