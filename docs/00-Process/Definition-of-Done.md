# Definition of Done

任何 work item 在以下条件全部满足时才算完成。验收命令只维护在 [`.claude/verify.sh`](../../.claude/verify.sh)，这里不重复写。

## 通用门槛（所有 work item）

- [ ] `.claude/verify.sh` 通过（lint / 类型检查 / 测试），**回复中贴出输出最后几行作为证据**——只说"测试通过"不算
- [ ] 测试数不少于 baseline；如有减少，说明原因
- [ ] 改动有对应 commit，message 引用 spec/plan 路径（S0 除外）
- [ ] 没有 `console.log` / `print` / debug 留存
- [ ] 没有 TODO / FIXME 留存（除非对应 issue 已创建并在注释中引用）

## Feature 级别（一个 spec/plan 完成）

- [ ] plan 中所有 task 已勾选，Progress 段已更新到最终状态
- [ ] 关键路径 E2E 通过（如有 E2E 套件）
- [ ] UI 改动有截图 / 录屏证据（获取方式见 CLAUDE.md「项目特定」段），并对照 spec 的验收标准
- [ ] spec / plan 已入档；架构决定有 ADR（如有 `docs/02-Architecture/Decisions/`）
- [ ] CLAUDE.md / 架构文档反映新增模块（如有）
- [ ] 5 行变更说明：改了什么、为什么、用户需要亲自看哪几处 diff
- [ ] 本次出现的返工 / 纠正已记入 `docs/05-Reviews/lessons.md`

## 产品内 LLM 功能（改了 prompt、工具定义、模型或 RAG 配置时）

Prompt 改动无法用单元测试证明正确，需要额外满足：

- [ ] 在评估集上跑过（放在 `evals/` 或 `docs/06-Testing/`；起步 10-20 条真实用例即可）
- [ ] 报告改动前后的通过率；样本少时多跑几次，避免把随机波动当成提升
- [ ] 原本通过的用例没有被改坏
- [ ] 评估时固定完整模型 ID，便于前后对比

## 手工 Smoke 触发规则（示例，按项目调整）

以下情况 merge 前必须跑一次；能自动化（截图 / E2E）的优先自动化：

| 触发条件 | 原因 |
|---|---|
| 改了路由 / 入口文件 | 导航和启动变化只在运行时暴露 |
| 新增 / 删除依赖 | 依赖解析可能失败 |
| 改了构建配置 | 构建结果可能变化 |
| 数据库迁移 / 权限策略 | 权限错误往往不会被单元测试发现 |
| Phase 级别 merge | 最终安全网 |

不触发：纯内部 lib、测试目录、`docs/` 改动。

## Bug 修复

- [ ] 先写能重现 bug 的失败测试，修复后转绿
- [ ] root cause 不明显时，在 `lessons.md` 记一行
- [ ] 通用门槛全部满足

## Phase 级别（多个 spec 组成的阶段）

- [ ] 该 Phase 所有 plan 已勾选
- [ ] 应用在目标环境（本地 / 模拟器 / 真机）能正常启动
- [ ] Phase 验收门全部满足
- [ ] 回顾写入 `docs/05-Reviews/YYYY-MM-DD-<phase>-retro.md`，并整理 `lessons.md`（升级 / 合并 / 删除规则）
- [ ] 打 git tag

---

**See also:** [AI-Workflow.md](./AI-Workflow.md), [Doc-Conventions.md](./Doc-Conventions.md)
