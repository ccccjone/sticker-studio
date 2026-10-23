---
name: refactor-flow
description: 纯 refactor（迁文件、抽组件、改路由壳、重命名，不动业务逻辑）时使用，替代完整的 spec + plan 流程。
---

# 纯 Refactor 流程

硬规则里的 spec/plan 对 refactor 大幅压缩；TDD 力度降为"现有测试不破"。

## 何时不适用（回到 spec-writing + plan-execution）

- 首次引入新的架构概念（新分层、首次 boundaries 规则、首个新类型实体）
- 顺手修非 trivial bug，或改公开 API
- 调用方超过 5 处需要协同改动

## Refactor spec（≤100 行，其余段落可省）

1. **目标 + 非目标**——明确写"不动业务逻辑"
2. **决策表**——5-8 行，回答文件归属、子组件拆分粒度、边界风险、已知 bug 是否纳入
3. **当前文件清单 + 引用关系**——找出跨层风险点
4. **架构边界影响**——是否要改 lint / boundaries 配置
5. **Smoke 范围**——哪些路径必须跑（优先用截图或 E2E 自动化）

## Refactor plan（≤300 行）

1. **Pre-flight**——baseline：verify.sh 结果与测试数 + 分支
2. **Commit 顺序表**——每个 commit 的 message + 文件 + 一句话说明
3. **引用样板**——"按 X 同款 pattern" + 链接上一个 refactor plan
4. **验收门**——verify.sh 全绿 + 测试数不少于 baseline + smoke
5. **不写 verbatim 代码**

## TDD 力度

现有测试不破即可；只对"顺手修的 bug"或"顺手补的新行为"写红测试。测试总数下降必须在报告中解释。
