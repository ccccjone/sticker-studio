# AI 创作：Skill + 原图 → 3 张候选 → 选中导出（含打印 DPI）

> ⚠ **状态：已废弃**（2026-10-28）—— 未经批准即移出本项目：随风格 Skill 生成器（Backlog D1）迁到独立新产品，作为其第二期。本文留作新产品的参考，不再在本项目实施。
> **级别**：S2（新增服务端、访问鉴权、密钥管理、打破「图片不出浏览器」不变量）
> **日期**：2026-10-28
> **Backlog**：C10 · 架构见 [ADR 0002](../02-Architecture/Decisions/0002-server-proxy-on-vercel.md)

## 目标

1. 用户选一个 skill（内置预设或自己粘贴的文本）并上传一张原图，生成 **3 张候选图**。
2. 用户选中 1 张：可选择清晰度（推荐值来自 skill，例如明信片 300 DPI）并下载；PNG / JPEG 写入 DPI 元数据，便于打印。
3. 未选中的候选只缓存在用户浏览器，**到期自动清理**，也可手动清除。
4. 模型 token **绝不出服务端**；生成接口必须凭有效访问密钥调用；页面提供申请内测的联系邮箱。
5. 没有密钥的访客也能看完整 demo（预置示例结果），但不能触发真实生成。

## 非目标

- 账号注册 / 登录、付费（以后的 auth spec）。
- 服务端存储任何图片；跨设备找回历史。
- AI 超分辨率（本版用高质量重采样放大，见 §5 的说明）；后续可作为独立条目。
- 选定具体生图厂商：本版做成可插拔 provider，先接 **mock provider**（无 token、零成本，用于开发和测试）+ 用户提供 token 后接 1 家真实 provider。

## 假设（用户批准 spec 即视为确认）

- 部署迁到 Vercel（2026-10-28 用户决定）：静态 SPA + Vercel Functions（Node 运行时）；站点挂在根路径，生产 `base` 改回 `/`（basename 方案保留，见 ADR 0002）。
- 候选只存浏览器 IndexedDB（2026-10-28 用户决定）。
- Skill = 内置预设 + 内测用户可粘贴自定义文本（2026-10-28 用户决定）。
- 上传给模型前，在浏览器把原图缩到最长边 ≤ 1536、编码为 JPEG(0.9) 或带透明的 PNG，请求体 ≤ 4 MB，以控制成本和时延。
- 每次生成固定 3 张；不支持改张数。
- 访问密钥为**服务端签名的令牌**（见 §3），不是存在前端的明文口令。

## 1. 页面与流程（`/create`，导航新增「AI 创作」）

```
[选 skill] → [上传原图] → [生成 3 张] → [选 1 张] → [选清晰度] → [下载]
     ↑ 无密钥：生成按钮置灰，展示预置 demo 结果 + 「申请内测」入口
```

| 区块 | 行为 |
|---|---|
| Skill 选择 | 卡片列出内置预设（名称、用途、物理尺寸、推荐 DPI、示例图）。有密钥时多一个「自定义 skill」文本框（≤ 2000 字） |
| 原图上传 | 复用现有上传组件与校验；显示将发送给模型的缩小后尺寸 |
| 隐私确认 | **首次生成前必须勾选**：「本功能会把这张图片发送到服务器并转交给 AI 模型服务商处理；服务器不保存图片」 |
| 生成中 | 3 个占位格（样式沿用 B7 决定），可取消；显示预计耗时 |
| 候选 | 3 张并排，点选 1 张；可「重新生成」（消耗一次额度） |
| 导出 | 清晰度选项（下表），默认选 skill 推荐项；显示输出像素与物理尺寸；PNG / JPEG |
| 本地缓存 | 「最近生成」列表（仅本机）；显示保留期限；「清除本地 AI 数据」按钮 |

### 清晰度选项

| 选项 | 像素计算 | 用途 |
|---|---|---|
| 原始 | 模型返回尺寸 | 屏幕 / 社交 |
| 打印 · 标准 | 物理尺寸 × 150 DPI | 家用打印 |
| 打印 · 高质量（多数 skill 推荐） | 物理尺寸 × 300 DPI | 冲印、明信片 |

例：明信片 148 × 100 mm @ 300 DPI = **1748 × 1181 px**（`mm / 25.4 × dpi`，四舍五入）。若 skill 定义出血（如 3 mm），尺寸按含出血计算并在界面注明。

## 2. Skill 定义

```typescript
interface CreationSkill {
  id: string                    // 'postcard'
  name: { zh: string; en: string }
  promptTemplate: string        // 发给模型的指令模板，含 {{userNote}} 等占位
  print?: { widthMm: number; heightMm: number; bleedMm?: number; recommendedDpi: 150 | 300 }
  aspect: number                // 宽 / 高，用于请求模型与最终裁切
}
```

- 内置预设首批：明信片、贴纸（沿用现有贴纸工作流的透明需求）、方形社交头像、A5 海报。具体文案在 plan 中列出，由用户确认。
- 预设的 `promptTemplate` **只放服务端**；前端只拿到展示字段。自定义 skill 文本由服务端拼进固定外壳模板（限制长度，去掉控制字符）。
- skill 的纯函数（像素计算、模板渲染、校验）放 `src/core/creation/`，前后端共用，全量单测。

## 3. 访问控制与密钥（安全核心）

### 秘密只在服务端

| 变量（仅 Vercel 环境变量 / 本地 `.env`，已 gitignore） | 用途 |
|---|---|
| `IMAGE_PROVIDER` | `mock` / 真实 provider id |
| `IMAGE_API_KEY` | 厂商 token |
| `ACCESS_SIGNING_SECRET` | 签发与校验访问密钥的 HMAC 密钥 |
| `ACCESS_REVOKED_IDS` | 吊销的密钥 id 列表（逗号分隔） |

- **禁止**任何以 `VITE_` 开头的变量承载秘密（Vite 会把它们打进前端 JS）。
- **代码强制**：新增 `scripts/check-no-secrets.mjs`，在 `npm run build` 之后扫描 `dist/`：若出现 `.env` / 环境中任一秘密变量的值，或出现 `VITE_*KEY*` / `*SECRET*` 字样，构建失败。并入 verify 流程（构建步骤）。

### 访问密钥格式

`ssk_<base64url(payload)>.<base64url(HMAC-SHA256(payload))>`，payload = `{ id, exp, dailyQuota }`。

- 签发：本地脚本 `npm run mint-key -- --id <名字> --days 30 --quota 20`（读本地 `.env` 的签名密钥），把生成的密钥发给内测用户。
- 校验（服务端）：格式 → 时间安全比较签名 → 未过期 → id 不在吊销列表 → 额度未用完。任一失败返回 401 / 403 / 429 及 i18n 错误码，不透露哪一步失败的细节以外的信息。
- 前端：用户在页面输入密钥，存 `localStorage`（可「退出内测」清除）；每次请求放在 `Authorization: Bearer` 头。密钥泄露最多造成该 id 的额度被用掉，可随时吊销。

### 额度与防滥用

- 每个密钥每日额度（payload 内 `dailyQuota`）；计数需要跨实例共享存储 → **待决问题 1**。
- 单请求限制：请求体 ≤ 4 MB、只接受 PNG / JPEG / WebP、自定义 skill ≤ 2000 字、服务端超时 60 s。
- 只允许本站 origin（CORS 不开放给其他域）。

## 4. 服务端（Vercel Function `api/generate`）

```
POST /api/generate
Headers: Authorization: Bearer ssk_...
Body (multipart): image, skillId | customSkill, userNote?
→ 200 { images: [{ mime, dataBase64, width, height }] × 3 }
→ 400 invalid / 401 unauthorized / 403 revoked|expired / 429 quota / 502 provider / 504 timeout
```

- `api/_lib/auth.ts`（密钥校验）、`api/_lib/skills.ts`（预设模板）、`api/_lib/providers/{mock,<real>}.ts`（`ImageGenProvider` 接口：`generate({ image, prompt, aspect, n }) → Image[]`）。
- handler 写成与平台无关的纯函数 `handle(request, env) → response`，Vercel 入口只做适配；vitest 直接测 handler，dev 时用一个 Vite 中间件挂载同一 handler（不必装 Vercel CLI）。
- **不落盘、不记录图片内容**；日志只记 key id、skill id、耗时、状态码。

## 5. 放大与 DPI 元数据

- 选中的候选按目标像素用浏览器高质量重采样（`createImageBitmap` resizeQuality=high，必要时分步放大）。界面说明：**放大不会增加细节**；若原始尺寸不足目标 DPI 的 50%，提示「打印可能偏软」。
- 按 skill 宽高比 cover 裁切到精确尺寸。
- PNG 写 `pHYs`（像素 / 米），JPEG 写 JFIF density（DPI）——纯函数放 `src/core/creation/dpi.ts`，用字节级断言测试。

## 6. 本地缓存（IndexedDB）

| 记录 | 保留 |
|---|---|
| 未选中候选 | 7 天后自动删除 |
| 已选中（含已下载） | 30 天，或超出 50 条时按最早删除 |

- 清理时机：进入 `/create` 时 + 每次生成后。
- 「清除本地 AI 数据」一键删除全部记录与密钥。
- 纯函数 `selectExpired(records, now)` 放 `core/`，单测覆盖边界（恰好 7 天、选中后取消等）。

## 7. Demo 模式（无密钥）

- 预置 1 组示例：一张自制原图 + 明信片 skill 的 3 张结果（用户用真实 provider 生成一次后放进 `public/demo/`，或先用 mock 占位）。
- 流程可以完整点一遍（选候选、选清晰度、下载示例），生成按钮置灰并显示「申请内测」：展示邮箱地址文本 + 复制按钮 + `mailto:` 链接。

## 8. 不变量变更

- ADR 0001 不变量 1 修订为：**除「AI 创作」页的生成请求外**，图片不离开浏览器。
- 其他页面行为与 verify 的隐私断言不变；AI 创作页的断言改为「只有发往本站 `/api/generate` 的请求，且只在用户点击生成之后」。

## 行为与验收标准

1. 无密钥访问 `/create`：可浏览 demo，生成按钮禁用，「申请内测」显示邮箱；网络请求中无 `/api/generate`。
2. 错误 / 过期 / 吊销 / 超额密钥 → 对应 401 / 403 / 429，界面显示中英文提示；handler 单测覆盖每一种。
3. 有效密钥 + mock provider：生成 3 张候选，选 1 张、选「打印 · 高质量」导出明信片 → 文件像素 1748 × 1181，PNG `pHYs` = 11811 px/m（300 DPI）；Playwright 像素断言 + 字节断言。
4. `npm run build` 后 `check-no-secrets` 通过；人为把 token 放进 `VITE_` 变量 → 构建失败（负向测试）。
5. 未选中候选 7 天后自动消失（单测用假时间）；「清除本地 AI 数据」后 IndexedDB 为空。
6. 首次生成前未勾选隐私确认 → 无法生成。
7. 其他 4 个工作流的隐私断言（外部请求 0）不受影响。
8. 产品内 AI 功能评估（DoD）：真实 provider 接入时，准备 10 条「skill × 原图」用例，人工打分并记录在 `docs/06-Testing/`。

## 数据流 / 错误处理

```
浏览器                         Vercel Function                    生图厂商
原图 → 缩小编码 ──POST──▶ 校验密钥/额度 → 拼 prompt ──▶ generate(n=3)
                                  ◀── 3 张图 ──────────────────────
IndexedDB ◀── 3 张 ◀── 200 JSON（不落盘）
选中 → 重采样 + 裁切 + 写 DPI → 下载
```

- 网络失败 / 504：保留已上传设置，提示重试，不扣额度（仅成功返回才计数）。
- provider 返回少于 3 张：返回实际张数并提示，按实际张数计额度。
- 前端在生成中离开页面：请求取消（AbortController）。

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| token 泄露 | 只在服务端；构建扫描；不用 `VITE_`；日志不打印头部 |
| 访问密钥被转发滥用 | 每日额度 + 到期 + 吊销列表 |
| 费用失控 | 固定 3 张、请求体上限、额度；厂商后台另设硬上限（用户操作） |
| 内容安全 | 依赖厂商安全策略；自定义 skill 长度限制；返回拒绝时提示 |
| 迁移 Vercel 影响现有站点 | 现有页面纯静态不变；回滚 = 停用 `/create` 路由与 function |

## 待决问题

1. **额度计数存储**：A. Upstash Redis（Vercel Marketplace 免费档）做每日计数（推荐，额度才真正生效）；B. 本版不做计数，只靠到期 + 吊销。
2. **申请内测的邮箱**：显示哪个地址？
3. **首个真实 provider**：等你拿到 token 时定；之前全部用 mock 开发。
4. **内置预设首批**：明信片 / 贴纸 / 社交头像 / A5 海报，是否增删？
