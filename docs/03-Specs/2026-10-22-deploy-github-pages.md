# 部署上线：GitHub Pages

> **状态**：部分完成——子路径代码已完成；上线方式待定（CI 搁置，见 Progress）
> **级别**：S1
> **日期**：2026-10-22
> **Backlog**：A1 · 依赖 [CI spec](./2026-10-22-ci.md)

## 目标

`main` 上 CI 通过后自动部署到 `https://ccccjone.github.io/sticker-studio/`，得到可分享链接；任何路由（含深链和刷新）都能正常打开。

## 非目标

- 自定义域名、SEO / 分享卡片（A3）、统计（A4）。
- 预览环境（PR preview）。

## 假设

- 用户已决定（2026-10-22）：仓库改为公开，用同仓库 GitHub Pages；作者邮箱可公开；加 MIT 许可证（已完成 `15001dc`）。
- 仓库公开与 Pages Source 设为「GitHub Actions」由用户在 GitHub 设置中操作（或经用户同意后由 Claude 用 `gh api` 开启）。
- 保持 `BrowserRouter`（干净 URL），不改 `HashRouter`。

## 现状问题（需要修的代码）

| 问题 | 位置 | 后果 |
|---|---|---|
| 站点挂在子路径 `/sticker-studio/` | `vite.config.ts` 无 `base` | 资源 404，白屏 |
| 路由没有 basename | `src/main.tsx` 的 `<BrowserRouter>` | 路由全部不匹配；`<Link to="/">` 指向域名根 |
| GitHub Pages 无 SPA 回落 | — | 深链 / 刷新 `/sticker-studio/batch` 返回 404 |

## 行为与验收标准

1. `vite.config.ts` 设置 `base`：生产构建为 `/sticker-studio/`，开发与测试保持 `/`（`npm run dev` 地址不变）。
2. 抽出 `src/app/App.tsx`：`<BrowserRouter basename={…}>` 包 `AppRoutes`，basename 取 `import.meta.env.BASE_URL`；`main.tsx` 只负责挂载。
3. **红测试**（`src/app/__tests__/`）：以 basename `/sticker-studio/` 渲染、地址为 `/sticker-studio/batch` 时显示批量处理页；首页链接 href 为 `/sticker-studio/single` 等；Logo 链接为 `/sticker-studio/`。
4. 构建后生成 `dist/404.html`（与 `index.html` 相同），GitHub Pages 用它回落 SPA 路由。
5. `ci.yml` 增加 job `deploy`：`needs: verify`，仅 `push` 到 `main` 时运行；`upload-pages-artifact` + `deploy-pages`，权限 `pages: write`、`id-token: write`，environment `github-pages`。
6. 本地 smoke（verify skill）：`npm run build && npm run preview` 后，用 Playwright 访问 `/sticker-studio/`、直接打开 `/sticker-studio/split` 并刷新，页面正常；导航到四个工作流均正常；单图上传→导出流程跑通（确认 worker 在子路径下可加载）；隐私断言外部请求数 = 0。
7. 线上 smoke：部署完成后用 Playwright 打开线上 URL 的首页和一个深链，截图；外部请求数 = 0（github.io 本身除外）。

## 风险与回滚

- 部署出问题：在 Pages 设置里停用，或回滚 commit 后重新部署；不影响源码。
- `404.html` 回落的 HTTP 状态码是 404（对用户无影响，对 SEO 不友好）——A3 时再评估。

## 待决问题

- 无（仓库公开由用户操作）。
