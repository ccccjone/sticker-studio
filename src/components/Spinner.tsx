export interface SpinnerProps {
  size?: number
  /** 提供 label 时以 role=status 对外可达（用于独立的加载指示） */
  label?: string
  className?: string
}

export function Spinner({ size = 16, label, className = '' }: SpinnerProps) {
  const svg = (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      className={`animate-spin ${className}`}
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 1-9 9" />
    </svg>
  )
  if (!label) return svg
  return (
    <span role="status" aria-label={label} className="inline-flex items-center gap-2">
      {svg}
      <span className="text-sm text-zinc-500">{label}</span>
    </span>
  )
}
