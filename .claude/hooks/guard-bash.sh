#!/bin/sh
# PreToolUse(Bash)：权限 deny 只做前缀匹配，这里补上"参数在中间"的情况。
# exit 2 = 拦截，stderr 会作为反馈交给 Claude。只做确定性检查，不调用模型。
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$cmd" ] && exit 0

case "$cmd" in
  *--no-verify*)
    echo "已拦截：禁止 --no-verify 绕过验收门（CLAUDE.md 硬规则 4）。先修好失败的检查。" >&2; exit 2 ;;
esac
if printf '%s' "$cmd" | grep -Eq 'git +push.*(--force|-f( |$)|--force-with-lease)'; then
  echo "已拦截：禁止 force push。需要时请用户手动执行。" >&2; exit 2
fi
exit 0
