/**
 * 手写内联 SVG 图标集（stroke 风格，24 viewBox）。
 * 零依赖、零外部请求（隐私承诺）；颜色跟随 currentColor。
 */

import type { SVGProps } from 'react'

const PATHS = {
  upload: <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5" />,
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 18 4.5-4.5a1.4 1.4 0 0 1 2 0l1.7 1.7 2.3-2.3a1.4 1.4 0 0 1 2 0L20.5 16" />
    </>
  ),
  stack: (
    <>
      <rect x="7" y="3.5" width="13.5" height="11" rx="2" />
      <path d="M16.5 17.5v.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2H6" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="6" cy="17" r="2.5" />
      <path d="M8.2 8.6 20 19M8.2 15.4 20 5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 4.5 13.8 9l4.5 1.8-4.5 1.8L12 17l-1.8-4.4L5.7 10.8 10.2 9 12 4.5Z" />
      <path d="M19 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" />
    </>
  ),
  eyedropper: (
    <path d="m12.5 7.5 4 4M4 20l.6-3.2a2 2 0 0 1 .55-1.05l8.1-8.1 3 3-8.1 8.1a2 2 0 0 1-1.05.55L4 20Zm11.5-14.5 1.3-1.3a2.1 2.1 0 0 1 3 3L18.5 8.5" />
  ),
  hand: (
    <path d="M12 3v8m0-8 2.5 2.5M12 3 9.5 5.5M12 21v-8m0 8 2.5-2.5M12 21l-2.5-2.5M3 12h8m-8 0 2.5-2.5M3 12l2.5 2.5M21 12h-8m8 0-2.5-2.5M21 12l-2.5 2.5" />
  ),
  eraser: (
    <path d="m9 20 -4.6-4.6a2 2 0 0 1 0-2.8L12.6 4.4a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1 0 2.8L11 20m-2 0h12M9 20h2m-4.8-9.4 7.2 7.2" />
  ),
  brush: (
    <path d="M14 5.5 18.5 10M5 19c1.5 0 2.5-.5 3-1.5.4-.8.2-1.8 1-2.5.9-.8 2.2-.7 3 .1L20.5 6.6a1.9 1.9 0 0 0-2.7-2.7L9.4 12.4c.8.8.9 2.1.1 3-.7.8-1.7.6-2.5 1-1 .5-1.5 1.5-2 2.6Z" />
  ),
  undo: <path d="M8.5 13.5 4 9l4.5-4.5M4 9h10a6 6 0 1 1 0 12h-3" />,
  redo: <path d="M15.5 13.5 20 9l-4.5-4.5M20 9H10a6 6 0 1 0 0 12h3" />,
  download: <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5" />,
  archive: (
    <>
      <rect x="3.5" y="4" width="17" height="4.5" rx="1" />
      <path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4" />
    </>
  ),
  trash: (
    <path d="M5 7h14m-9-2.5h4M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12M10 11v6m4-6v6" />
  ),
  check: <path d="m5 13 4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 1 1 8 0v3" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  arrowRight: <path d="M4 12h16m0 0-5-5m5 5-5 5" />,
} as const

export type IconName = keyof typeof PATHS

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
