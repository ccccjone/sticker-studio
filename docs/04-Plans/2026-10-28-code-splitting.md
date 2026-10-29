# Plan: 代码分割
> Spec: ../03-Specs/2026-10-28-code-splitting.md

## Header

路由级 `React.lazy` 拆出四个工作页；JSZip 改为导出时动态 import；错误边界改为点击重置时动态 import store，切断入口包对 store → JSZip 的静态依赖。用 `scripts/check-bundle.mjs` 锁住入口包体积和内容。Vite 8（rolldown）自然分包，不手工配置 chunk。

## Pre-flight

- baseline：`.claude/verify.sh` 全绿，33 文件 / 258 测试（2026-10-28）
- bundle baseline：单个 `index-*.js` 841.35 KB / gzip 259.20 KB
- 分支：直接在 main（与前几项一致，小步提交）

## File map

| Task | create | modify | test |
|---|---|---|---|
| 1 | `scripts/check-bundle.mjs` | `package.json`（`check:bundle` 脚本） | 脚本本身（先红） |
| 2 | — | `features/{batch,splitter}/exportZip.ts` | 现有 exportZip 测试 |
| 3 | — | `app/ErrorBoundary.tsx` | `app/__tests__/ErrorBoundary.test.tsx` |
| 4 | — | `app/router.tsx`、`locales/{zh,en}.json` | `app/__tests__/{app,basename,ErrorBoundary}.test.tsx` |
| 5 | — | Backlog、本 plan | verify skill e2e |

## Tasks

- [ ] Task 1: bundle 检查脚本（先红）
  - 读 `dist/index.html` 找入口 script → gzip 体积 ≤ 120 KB，且不含 `Konva`、`JSZip` 特征串
  - verification：`npm run build && npm run check:bundle` → 当前应失败（体积 + 两个特征串）
  - commit：`test(build): bundle budget check for entry chunk (red)`
- [ ] Task 2: JSZip 按需加载
  - 两个 `exportZip.ts` 改为函数内 `const { default: JSZip } = await import('jszip')`
  - verification：`npm test -- run src/features` 全绿
- [ ] Task 3: 错误边界不静态依赖 store
  - `CLEAR_BY_PATH` 值改为 `() => import(store).then(clear)`；按钮点击后 await 再 `reset()`
  - 测试：重置用例改为 `await waitFor` 断言 clear 被调用
- [ ] Task 4: 路由懒加载
  - `lazy(() => import('../pages/X').then(m => ({ default: m.X })))`；`<Suspense>` 放在路由 element 外层，fallback 为 `Spinner` + `common.loading` 文案（已有则复用）
  - 测试：`route %s renders`、basename、ErrorBoundary 中涉及懒页面的断言改 `findBy*`
  - verification：`.claude/verify.sh` + `npm run build && npm run check:bundle` 转绿
  - commit：`perf(app): lazy-load workflow pages and JSZip; entry bundle budget`
- [ ] Task 5: e2e + 收尾
  - `verify` skill：三个工作流上传 → 导出 + 像素断言 + 隐私断言；深链接直开 `/sticker-studio/batch`
  - 记录前后 bundle 对比到 Progress；Backlog 标 B3 完成
  - commit：`docs(backlog): mark B3 done`

## 验收门

- `.claude/verify.sh` 全绿；`npm run check:bundle` 通过；构建无 >500 KB 警告
- `src/core/` 无 React / DOM import（本次不碰 core）
- verify skill e2e 通过

## Progress

- 已完成：—
- 当前：Task 1
