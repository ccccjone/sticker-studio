# ADR 0002: 引入服务端代理，整站部署迁到 Vercel

**Date:** 2026-10-28
**Status:** Deprecated（未采纳，2026-10-28）

> AI 创作（C10）随风格 Skill 生成器（Backlog D1）迁到独立新产品，本项目保持纯静态、零后端，部署仍按 GitHub Pages。本 ADR 的服务端代理思路（token 只在服务端、HMAC 访问密钥、handler 与平台解耦、构建后扫描 dist 防泄露）可供新产品参考。

## Context

用户要新增「AI 创作」（[spec](../../03-Specs/2026-10-28-ai-skill-generation.md)）：调用第三方生图模型，token 必须不暴露，接口要凭访问密钥使用。

ADR 0001 的形态是纯静态 SPA（GitHub Pages）。静态站无法保存秘密：Vite 会把 `VITE_*` 变量直接写进 JS，前端校验的口令也可被绕过。因此必须有服务端。

候选：Cloudflare Worker（站点留在 GitHub Pages）、Vercel（整站 + Functions）、自建服务器。用户 2026-10-28 选择 Vercel。

## Decision

- 整站部署到 Vercel：静态 SPA + Vercel Functions（Node 运行时），目录 `api/`。
- 生产构建 `base` 改回 `/`；`App` 的 basename 机制保留（取 `BASE_URL`），GitHub Pages 方案的 `404.html` 由 Vercel 的 SPA rewrite 取代（`/api/*` 除外）。
- 服务端只做 AI 生成代理：鉴权（HMAC 签名的访问密钥）、拼 prompt、调用可插拔 provider、原样返回结果；**不存储图片**。
- 秘密只存 Vercel 环境变量 / 本地 `.env`（已 gitignore）；构建后扫描 `dist/` 防泄露。
- handler 与平台解耦（纯函数 `handle(request, env)`），便于 vitest 测试和本地 Vite 中间件挂载。
- 修订 ADR 0001 不变量 1：除「AI 创作」的生成请求外，图片不离开浏览器。

## Consequences

- 正面：秘密有安全存放处；为以后 auth / 付费留出服务端位置。
- 负面：项目不再是零后端；依赖 Vercel 平台与其免费额度；需要隐私说明与用户确认。
- 未决：额度计数存储（Upstash Redis 或不计数）；首个真实 provider；A1 部署 spec 需按 Vercel 重写（CI 仍搁置）。
