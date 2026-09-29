import type { SVGProps } from 'react'

export type IconName =
  | 'activity'
  | 'arrow-up-right'
  | 'camera'
  | 'check'
  | 'chevron-down'
  | 'clock'
  | 'info'
  | 'layers'
  | 'lock'
  | 'menu'
  | 'mic'
  | 'more'
  | 'play'
  | 'pulse'
  | 'settings'
  | 'shield'
  | 'sparkle'
  | 'users'
  | 'x'

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName
  size?: number
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  }

  const paths: Record<IconName, React.ReactNode> = {
    activity: <><path d="M3 12h4l2.2-7 4.1 14L15.5 12H21" /></>,
    'arrow-up-right': <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
    camera: <><path d="m9 6 1.2-2h3.6L15 6" /><path d="M5.5 6h13A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-8A2.5 2.5 0 0 1 5.5 6Z" /><circle cx="12" cy="12.5" r="3.25" /></>,
    check: <><path d="m5 12 4.2 4.2L19 6.5" /></>,
    'chevron-down': <><path d="m6 9 6 6 6-6" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
    info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5v5" /><path d="M12 7.5h.01" /></>,
    layers: <><path d="m12 3 8 4.2-8 4.2-8-4.2L12 3Z" /><path d="m4 12 8 4.2 8-4.2" /><path d="m4 16.8 8 4.2 8-4.2" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21" /><path d="M8.5 21h7" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    play: <><path d="m9 6 9 6-9 6V6Z" fill="currentColor" stroke="none" /></>,
    pulse: <><path d="M3 12h3l2-5 4 10 2.5-7 1.5 2H21" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.4v-.2a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.46 15a1.7 1.7 0 0 0-1.56-1.03H6.7v-2.4h.2A1.7 1.7 0 0 0 8.46 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.7-1.7.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56V5h2.4v.2a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.7 1.7-.06.06A1.7 1.7 0 0 0 19.4 10c.23.62.83 1.03 1.5 1.03h.2v2.4h-.2A1.7 1.7 0 0 0 19.4 15Z" /></>,
    shield: <><path d="M12 3 19 6v5c0 4.5-2.8 8.3-7 10-4.2-1.7-7-5.5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    sparkle: <><path d="m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3L12 3Z" /><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" /></>,
    users: <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3" /><path d="M16 11a3 3 0 1 0-1.2-5.75" /><path d="M20 20v-1.2a3.5 3.5 0 0 0-2.5-3.35" /></>,
    x: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  }

  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      {...commonProps}
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
