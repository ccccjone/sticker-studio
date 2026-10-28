# Lessons

> 由 `lesson-capture` skill 维护。只记录事实与来源；规则提案需用户批准后才写入 CLAUDE.md / skills / hooks。

## 记录

| 日期 | 现象（一句话） | 根因 | 来源 | 次数 | 状态 |
|---|---|---|---|---|---|
| 2026-10-28 | implementer 实现与测试同时写，未单独跑出红测试 | prompt 只写「先红后绿」，没要求在报告中贴出红阶段输出 | 948bb64（B1 Task 3） | 1 | 观察中：B7 Task 1/2 的 implementer prompt 要求附红阶段输出后均已贴出，暂有效 |
| 2026-10-28 | 缩略图用 `toDataURL('image/jpeg')`，透明区域被编码成黑色 | 编码格式没有考虑本项目的主要输入是透明图；`decodeThumbnail` 依赖 canvas，jsdom 测不到，只有真实 Chrome 能发现 | 2065378 → 2dc4d61（B7 Task 1 review） | 1 | 观察中：涉及 canvas 编码的改动要在真实 Chrome 里用透明图验证 alpha |
| 2026-10-28 | AbortError 回归测试第一次没有变红 | jsdom 的 `DOMException` 不是 `Error` 实例，`instanceof Error` 的判定没有命中；浏览器里的是 | 2dc4d61（B7 Task 1 review 修复） | 1 | 观察中：测试里模拟浏览器异常时用带 name 的 `Error`，并先确认测试能变红 |

## 已升级的规则

| 日期 | 规则 | 放在 | 来源行 |
|---|---|---|---|
| | | | |
