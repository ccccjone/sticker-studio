---
name: verify
description: 构建并驱动 Sticker Studio（浏览器端图片处理 SPA）验证改动 — 启动 preview 服务器，用 Playwright + 系统 Chrome 驱动上传/编辑/导出流程并检查导出像素
---

# Sticker Studio 验证配方

## 构建与启动

```bash
npm run build                          # tsc -b + vite build
npm run preview -- --port 4173 --strictPort   # 后台运行，SPA fallback 已内置
```

三件套（CI 门，不属于运行时验证）：`npm run lint` / `npm run typecheck` / `npm test -- run`。

## 驱动（Playwright，勿装进项目依赖）

在 scratchpad 目录 `npm i playwright`，用系统 Chrome：`chromium.launch({ channel: 'chrome' })`。

关键 gotcha：

- **必须先设中文**，否则 UI 跟随 navigator 变英文、中文选择器全部失效：
  `browser.newContext({ locale: 'zh-CN' })` + `ctx.addInitScript(() => localStorage.setItem('i18nextLng', 'zh'))`
- `window.confirm`（清除项目/重新切分）：`page.on('dialog', d => d.accept())`
- 上传：`page.setInputFiles('input[type=file]', path)`（input 隐藏但可直接 set）
- 导出：`Promise.all([page.waitForEvent('download'), click])` → `download.saveAs()`
- 测试图不用外部素材：在页面里 canvas 画完 `toDataURL` 存文件（白底+圆形主体、4×4 灰底拼图等）
- 导出像素断言：新开 page，`setContent('<input id=f type=file>')` + `setInputFiles`，`page.evaluate` 里 `createImageBitmap` + `OffscreenCanvas.getImageData` 检查四角 alpha、中心色、白边像素数
- 隐私断言：`ctx.on('request')` 收集非 localhost/data:/blob: 的 URL，应为 0 个

## 值得驱动的流程

1. 单图：上传 → 自动取色 → 应用 → 画布预设 1024 → 主体占比 80% → 启用描边(range 滑块 fill('48')) → 导出图片 → 断言四角透明/中心不透明/描边存在
2. Contain/Cover：横图 → 完整显示导出（顶部 alpha 0）→ 填满画布导出（透明像素 0）
3. 拆分：/split 上传拼图 → 点 4×4 → 「切分为 16 张贴纸」→ 「下一步：导出」→ ZIP 按钮 → `unzip` 后核对 sticker-01..16.png + manifest.json
4. 负路径：txt 上传出现「不支持的图片格式」；外边距填 2000 出现「网格参数无效」且切分按钮 disabled

已验证可用的完整脚本样例见 git 历史或重写（约 200 行）。
