# Plan: 部署到 GitHub Pages
> Spec: ../03-Specs/2026-10-22-deploy-github-pages.md

## Header

生产构建 `base: '/sticker-studio/'`；路由 basename 取 `import.meta.env.BASE_URL`；构建后复制 `404.html` 做 SPA 回落；在 `ci.yml` 追加 `deploy` job（needs verify，仅 main push）。依赖 CI plan 先完成。

## Pre-flight

- baseline：CI plan 完成后的 verify.sh 结果与测试数
- 前置（用户）：仓库已公开；Pages Source = GitHub Actions
- 分支：`main`

## File map

| Task | 文件 |
|---|---|
| 1 | create `src/app/App.tsx`；test `src/app/__tests__/basename.test.tsx`；modify `src/main.tsx` |
| 2 | modify `vite.config.ts`、`package.json`（postbuild 复制 404.html） |
| 3 | modify `.github/workflows/ci.yml` |
| 4 | — （本地 + 线上 smoke） |

## Tasks

- [ ] Task 1: App 组件 + basename（TDD）
  - 先写红测试：`App` 接收可选 `basename`（默认 `import.meta.env.BASE_URL`）；`history.pushState` 到 `/sticker-studio/batch` 后渲染 `<App basename="/sticker-studio/" />` → 批量页可见；首页 4 个入口 href 带前缀；Logo href `/sticker-studio/`
  - 运行确认红（`App` 不存在）→ 实现 → 绿；`main.tsx` 改为渲染 `<App />`
  - commit：`feat(app): router basename from BASE_URL for subpath hosting`
- [ ] Task 2: 构建配置
  - `vite.config.ts`：`base: command === 'build' ? '/sticker-studio/' : '/'`
  - `package.json`：`"postbuild": "cp dist/index.html dist/404.html"`
  - 验证：`npm run build` 后 `dist/index.html` 资源路径以 `/sticker-studio/assets/` 开头，`dist/404.html` 存在且与 index 相同
  - commit：`build: base path and 404.html fallback for GitHub Pages`
- [ ] Task 3: deploy job
  - `ci.yml` 追加 `deploy`：`needs: verify`，`if: github.event_name == 'push' && github.ref == 'refs/heads/main'`；verify job 构建后 `actions/upload-pages-artifact@v3`（path dist）；deploy 用 `actions/deploy-pages@v4`；job 级 `permissions: pages: write, id-token: write`；`environment: github-pages`
  - commit：`ci: deploy to GitHub Pages after verify`
- [ ] Task 4: smoke
  - 本地：`npm run preview`（base 生效于 `/sticker-studio/`）+ Playwright：首页、直接打开 `/sticker-studio/split`、四个工作流导航、单图上传→导出（worker 加载）、外部请求 0，截图
  - 线上：push（用户确认）→ `gh run watch` → Playwright 打开线上首页 + 深链 `/sticker-studio/guide` 截图
  - 无 commit；结果写入 Progress

## 验收门

verify.sh 全绿且测试数 ≥ baseline；本地与线上截图；隐私断言 0。

## Progress

- 已完成：Task 1（078244e，+3 测试）、Task 2（9ed6daa）、preview base 修复（75b57bb，smoke 发现 vite preview 下 base 退回 /）
- Task 4 本地 smoke：11/11 PASS（首页、深链刷新 /split /guide、四工作流导航、单图上传→导出像素断言、外部请求 0）
- Task 3（deploy job）随 CI 搁置；Pages 已开启（build_type=workflow），站点尚无内容
- 下一步：用户决定上线方式后再做线上 smoke
