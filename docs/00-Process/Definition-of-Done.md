# Definition of Done

任何 work item 在以下条件全部满足时才能视为完成。具体命令按项目实际栈替换（下面以 Node/TS 为例）。

## 通用门槛（所有 work item）

- [ ] lint 通过（如 `npm run lint --max-warnings 0`）
- [ ] 类型检查通过（如 `npx tsc --noEmit`、`mypy`、`go vet` 等）
- [ ] 测试全绿（如 `npm test`、`pytest`、`go test ./...`）
- [ ] 改动有对应的 commit，message 引用 spec/plan 路径
- [ ] 没有 `console.log` / `print` / debug 留存
- [ ] 没有 TODO 或 FIXME 留存（除非创建了对应 issue 并在注释里引用）

## Feature 级别（一个 spec/plan 完成）

- [ ] 所有 plan 中的 task 已 check
- [ ] 关键路径 E2E 测试通过（如有 E2E 套件）
- [ ] 手工 smoke 通过（如适用——触发条件由项目自行约定，见下方示例）
- [ ] 对应 spec 和 plan 在 `docs/03-Specs/` 和 `docs/04-Plans/` 入档
- [ ] 如有架构决定，对应 ADR 在 `docs/02-Architecture/Decisions/` 入档（如有该目录）
- [ ] CLAUDE.md / 架构文档反映新增模块（如有）
- [ ] Barrel / 公共导出审计：`index.ts` 只暴露有外部 consumer 的 symbol（如项目用 barrel 模式）

## 手工 Smoke 触发规则（示例，按项目调整）

不需要每个 commit 跑，但以下情况 **必须在 merge 前跑一次**：

| 触发条件 | 原因 |
|---|---|
| 改了路由 / 入口文件 | 导航/启动变化只在跑起来时能验证 |
| 新增 / 删除依赖（修改 `package.json` / `requirements.txt` 等） | 依赖解析可能失败 |
| 改了构建配置（webpack / vite / tsconfig / build script 等） | 构建结果可能变化 |
| Phase 级别 merge（含整个 feature 合并 main） | 最终安全网 |

**不触发的情况**：纯内部 lib、`__tests__/`、`docs/` 改动（不影响运行时）。

## Bug 修复

- [ ] 先写一个能重现 bug 的失败测试
- [ ] 修复后该测试转绿
- [ ] 如有 root cause 不明显，在 `docs/05-Reviews/` 加一段简短笔记（如有该目录）
- [ ] 通用门槛全部满足

## Phase 级别（多 spec 组成的阶段完成）

- [ ] 对应 Phase 的所有 plan 已 check
- [ ] 应用在目标环境（本地 / 模拟器 / 真机）能正常启动
- [ ] 该 Phase 验收门（在 phase proposal / refactor proposal 中定义）全部满足
- [ ] 该 Phase 的回顾笔记写入 `docs/05-Reviews/YYYY-MM-DD-<phase>-retro.md`
- [ ] 打 git tag（命名按项目约定，如 `refactor-pN`、`v1.2.0`）

---

**See also:** [AI-Workflow.md](./AI-Workflow.md), [Doc-Conventions.md](./Doc-Conventions.md)
