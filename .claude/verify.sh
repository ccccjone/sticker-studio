#!/bin/sh
# 验收三件套的唯一来源：Stop hook、pre-commit、Definition-of-Done 都调用这个脚本。
# 规则：任何一步失败即非 0 退出。
# 注意：npm test 默认是 vitest watch 模式，必须带 -- run。

set -e
cd "$(dirname "$0")/.."
npm run lint
npm run typecheck
npm test -- run
