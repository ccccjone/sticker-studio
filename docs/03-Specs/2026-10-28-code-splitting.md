# 代码分割

> **状态**：草案 v1（S1，按规则不等确认直接进 plan）
> **级别**：S1
> **日期**：2026-10-28
> **Backlog**：B3 · 为 C1（本地 AI 去背景模型懒加载）铺路

## 现状（2026-10-28 实测）

- `vite build` 只产出一个 `index-*.js`：841 KB（gzip 259 KB），触发 >500 KB 警告。
- 首页、指南页不用 Konva / JSZip，但也要下载全部代码。
- `app/ErrorBoundary.tsx` 静态 import 三个 store → `splitterStore` → `splitter/exportZip` → JSZip，因此即使页面懒加载，JSZip 仍会留在入口包。

## 目标

首屏（首页 / 指南页）只下载外壳代码；Konva、JSZip 只在用到时下载。

## 非目标

- 鼠标悬停预取、Service Worker 缓存。
- 手工调整 vendor 分包（`manualChunks` / `codeSplitting` 配置），先看自然分割结果。
- 改变任何页面功能或样式。

## 假设

1. 路由级 `React.lazy`：`/single`、`/batch`、`/split`、`/guide` 四个页面懒加载；首页和 `Layout` 留在入口包（首页是落地页）。
2. JSZip 在导出 ZIP 的函数内部 `await import('jszip')`，点击「导出 ZIP」时才下载。
3. Konva 不单独处理：只被三个编辑页引用，懒加载页面后自然拆成共享 chunk。
4. 错误边界的「重置当前项目」改为在点击时动态 import 对应 store，入口包不再静态依赖 store。
5. Suspense 占位使用现有 `Spinner`，放在 `Layout` 的 `<main>` 内（导航栏不闪）；占位文案中英双语。
6. 新版部署后，旧页面请求已不存在的 chunk 会失败：由现有路由错误边界接住；本版不做自动刷新，用户刷新页面即可恢复。

## 行为与验收标准

1. `npm run build` 后，入口 chunk 不含 Konva 与 JSZip 代码，gzip 体积 ≤ 120 KB；构建不再出现 >500 KB 警告。
2. 新增 `scripts/check-bundle.mjs`：读取 `dist/`，校验第 1 条（入口 gzip 上限 + 不含 `Konva` / `JSZip` 特征字符串），失败非 0 退出。先写、先红。
3. 直接打开 `/sticker-studio/single` 等深链接、从首页点进各页、浏览器前进后退，页面都正常渲染；懒加载期间 `<main>` 内显示 Spinner，导航栏保持不动。
4. 现有单测全部通过；路由测试改为等待懒加载页面（`findBy*`）。
5. `verify` skill 端到端：单张、批量、拆分的上传 → 编辑 → 导出流程正常，导出像素断言通过；隐私断言（非 localhost 请求数 = 0）通过。
6. 错误边界「重置当前项目」行为不变（现有测试覆盖），重置操作改为异步完成。
7. 在 plan 收尾时记录前后 bundle 对比（各 chunk 原始 / gzip 体积）。

## 待决问题

无。
