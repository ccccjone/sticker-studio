# Plan: 错误边界
> Spec: ../03-Specs/2026-10-28-error-boundary.md

## Header

新增 `src/app/ErrorBoundary.tsx`（class 组件，`getDerivedStateFromError` + `componentDidCatch` → `console.error`），提供两种用法：路由级（包住 Layout 的 `<Outlet />`，key = pathname，渲染错误卡片）和根级（包住 `<AppRoutes />`，渲染只有「刷新页面」的兜底页）。「重置当前项目」按 pathname 映射到 editor / batch / splitter store 的 `actions.clear()`。DEV 构建提供 `?crash=1`（路由内抛错）/ `?crash=layout`（Layout 抛错）触发器，生产构建由 `import.meta.env.DEV` 剔除。

## Pre-flight

- baseline：verify 32/243（88b3416），分支 main

## File map

| Task | 文件 |
|---|---|
| 1 | create `src/app/ErrorBoundary.tsx`；modify `src/app/Layout.tsx`、`src/app/App.tsx`、`src/locales/{zh,en}.json`；test `src/app/__tests__/ErrorBoundary.test.tsx` |
| 2 | create `src/app/DevCrash.tsx`（或并入 ErrorBoundary 文件）；modify `Layout.tsx`；smoke 脚本在 scratchpad |

## Tasks

- [x] Task 1: 错误边界 + 恢复操作（T3）
  - 先红：组件测试用 `<Boom />` 子组件（受外部变量控制是否抛错）
    - 路由级：顶栏导航仍在，主区域显示标题 + 说明 + 「重试」「重置当前项目」「返回首页」；不出现错误信息文本
    - 「重试」：Boom 不再抛错时内容恢复，store 未被 clear
    - 「重置当前项目」：`/single`、`/batch`、`/split` 分别只调用对应 store 的 `clear`（`window.confirm` mock 为 true；为 false 时不调用）；`/`、`/guide` 不显示该按钮
    - 「返回首页」跳到 `/`；在 `/` 出错时不显示
    - 出错后切换路由：目标页正常显示
    - 根级：Layout 抛错时显示兜底页，只有「刷新页面」
  - i18n：`errorBoundary.{title,desc,retry,reset,home,fatalTitle,fatalDesc,reload}`，中英
  - verification：`.claude/verify.sh`
  - commit：`feat(app): route-level error boundary with retry / reset / home`
- [x] Task 2: DEV 触发器 + smoke（T1）
  - `?crash=1` 在路由边界内抛错、`?crash=layout` 在 Layout 内抛错，仅 `import.meta.env.DEV`；`npm run build` 后 grep dist 不含触发器标识
  - Playwright（vite dev）：`/batch?crash=1` 中、英截图；导航可点、切到 `/single` 正常；`/?crash=layout` 兜底页截图；外部请求 0
  - commit：`chore(app): dev-only crash trigger for error boundary smoke`

## 验收门

verify.sh 全绿；`src/core/` 无新增 React/DOM import；中英错误卡片截图 + 兜底页截图；生产包不含触发器；外部请求 0。

## Progress

- baseline：verify 32/243（88b3416）
- Task 1：4815bcd；reviewer APPROVE（7 个指定变异全部变红）；审查修复 bd6456c（重置查表前规范化尾斜杠与大小写；返回首页不再多调用 reset，避免出错页多渲染一次），verify 33/258
- Task 2：DevCrash（`?crash=1` / `?crash=layout`，仅 DEV）；`npm run build` 后 dist 中无触发器字样；Playwright 系统 Chrome（vite dev）11/11：中文批量页卡片三按钮、顶栏 4 个链接仍在、卡片不含错误信息、切到单图页恢复、指南页无重置按钮、返回首页恢复、Layout 出错显示只有「刷新页面」的兜底页、英文卡片、外部请求 0
- 偏离：无。smoke 首轮有 2 项因导航在 transition 中提交、检查过早而误报，改为等待卡片移除后通过
- 状态：完成
