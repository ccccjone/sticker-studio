---
name: plan-execution
description: spec 批准后写 plan 并执行时使用。包含 plan 结构、T1-T4 分级、subagent 派发模板、熔断规则和进度交接。
---

# Plan 编写与混合执行

## 1. Plan 结构（checklist，不是 code dump）

文件：`docs/04-Plans/<与 spec 同名>.md`。S1 plan ≤150 行，S2 ≤500 行。

```markdown
# Plan: <topic>
> Spec: ../03-Specs/<same-name>.md

## Header        目标 + 架构 + 技术栈（3-5 句）
## Pre-flight    baseline：verify.sh 结果与测试数；分支名
## File map      每个 task 的 create / modify / test 文件
## Tasks
- [ ] Task 1: <名称>
  - steps / verification command / expected output / commit message
## 验收门       .claude/verify.sh 全绿 + 架构边界零违规 + 需要的截图/smoke
## Progress      ← 执行中持续更新，见 §5
```

不写完整代码、逐行 diff、重复类型定义。例外：首次引入的新 pattern、关键 edge case 的测试断言、构建/测试配置片段。

## 2. 逐 task 分级（在主会话内部分类，不写进 plan）

| Tier | 判别信号 | 谁来做 | Review |
|---|---|---|---|
| T1 Trivial | 1-2 文件 / 单行 / 配置 / 文档 / 重命名 | 主会话直接做 | 自验：diff + verify.sh |
| T2 Mechanical | 2-5 文件 + 有样板 + spec 明确 | `implementer` subagent | 主会话对照 spec 看 diff + 自己跑 verify.sh |
| T3 Judgment | 5+ 文件 / 跨 feature / import graph 变化 / 新 pattern 首次实现 | `implementer` subagent | `reviewer` subagent 两阶段，基于执行证据 |
| T4 Architecture | 设计决策 / 新 entity / 新 shared module / ADR | 主会话直接做 | 自审 + 用户 review |

需要大范围搜索代码库时，先派 `explorer`，只把结论带回主会话。

**不要问用户"subagent 还是 inline"**——默认混合，已由本文件授权。需要用户确认的只有：spec/plan 边界、删除性或不可逆动作、BLOCKED。

## 3. Implementer prompt 必备字段（subagent 看不到主会话，prompt 必须自包含）

1. 工作目录 + 当前分支
2. Task 全文（从 plan 复制，含 steps 和 verification command）
3. Spec 路径 + 关键决策摘要（1-3 句）+ 可参考的样板文件路径
4. 约束：不绕过 hook、不跳过验收门、不做 task 外改动
5. 要求按 implementer 定义的报告格式返回

## 4. 熔断（每条恢复路径都要有上限）

- 同一命令/测试连续失败 **3 次**且输出没有新变化 → 停止重试，写下 2-3 个假设，改策略或返回 BLOCKED。
- NEEDS_CONTEXT → 补 context 重派 1 次；仍失败 → 升级为 T3 或拆 task。
- BLOCKED 是能力问题 → 拆 task，而不是反复重派。
- reviewer 返回 SPEC_PROBLEM → 暂停执行，回到 spec/plan 修订。

## 5. 进度交接（防上下文耗尽、防过早声明完成）

每完成一个 task，更新 plan 末尾的 Progress：

```markdown
## Progress
- 已完成：Task 1-3（commit a1b2c3d, d4e5f6a, ...）
- 当前：Task 4，卡在 <...>
- 下一步：<...>
- 已知问题 / 偏离 plan 的地方：<...>
```

新 session 或上下文压缩后，先读 Progress 再继续。

## 6. 收尾

- 所有 task 勾选 + verify.sh 全绿（贴输出最后几行作为证据，不要只说"测试通过"）。
- 写 5 行"改了什么、为什么这样改、用户需要亲自看哪几处 diff"，防止理解债。
- 本次出现的失败/返工，调用 lesson-capture skill 记录。
