import { Icon } from '../ui/Icon'

type StatusPillProps = {
  label: string
  tone?: 'neutral' | 'lime' | 'coral'
}

export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  const toneClasses = {
    neutral: 'border-ink/10 bg-ink/[0.04] text-ink/55',
    lime: 'border-lime-500/25 bg-lime-300/35 text-moss-800',
    coral: 'border-coral-400/25 bg-coral-200/45 text-coral-700',
  }

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.13em] ${toneClasses[tone]}`}>
      <Icon name={tone === 'lime' ? 'check' : 'clock'} size={13} />
      {label}
    </span>
  )
}
