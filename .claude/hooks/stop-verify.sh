#!/bin/sh
# Stop hook：Claude 准备结束回合时，如果有未提交的源码改动，就跑 .claude/verify.sh。
# 失败 → exit 2，阻止"测试没过就说完成"。
#
# 防死亡螺旋（ai-agent-book 第 5 章）：
#   1. 只跑确定性命令，绝不在这里调用模型（例如自动生成 commit message）；
#   2. stop_hook_active=true 说明已经因本 hook 续跑过一次，直接放行，避免无限循环。
input=$(cat)
if printf '%s' "$input" | jq -e '.stop_hook_active == true' >/dev/null 2>&1; then
  exit 0
fi
[ "${SKIP_STOP_VERIFY:-0}" = "1" ] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -x .claude/verify.sh ] || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# 只有 docs / markdown 改动时不跑
changed=$(git status --porcelain -- . ':(exclude)docs' ':(exclude)*.md' ':(exclude).claude' 2>/dev/null)
[ -z "$changed" ] && exit 0

out=$(.claude/verify.sh 2>&1)
if [ $? -ne 0 ]; then
  {
    echo "验收未通过，不能结束本回合。最后 40 行输出："
    printf '%s\n' "$out" | tail -n 40
    echo "如果这是有意的红测试（TDD 红阶段）或需要用户决定，请在回复中明确说明原因再结束。"
  } >&2
  exit 2
fi
exit 0
