import { Icon } from '../ui/Icon'
import { StatusPill } from '../layout/StatusPill'
import type { FaceDetectorStatus } from '../../hooks/useFaceDetector'

const metrics = [
  { label: 'Engagement', color: 'bg-moss-500' },
  { label: 'Happiness', color: 'bg-coral-400' },
  { label: 'Tension', color: 'bg-ink/30' },
]
interface DashboardPreviewProps { detectorStatus: FaceDetectorStatus; faceCount: number; sessionActive: boolean }

export function DashboardPreview({ detectorStatus, faceCount, sessionActive }: DashboardPreviewProps) {
  const isTracking = sessionActive && detectorStatus === 'ready'
  return (
    <section className="panel flex flex-col" aria-labelledby="dashboard-heading">
      <div className="flex items-start justify-between border-b border-ink/8 px-5 py-5 sm:px-7">
        <div><div className="mb-2 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-moss-600"><Icon name="activity" size={14} />Room vibe</div><h2 className="font-display text-xl font-semibold tracking-[-0.04em] text-ink" id="dashboard-heading">Meeting pulse</h2></div>
        <StatusPill label={isTracking ? 'Live tracking' : sessionActive ? 'Loading tracker' : 'Offline preview'} tone={isTracking ? 'lime' : sessionActive ? 'coral' : 'neutral'} />
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-7">
        <div className="mb-7 rounded-[1.2rem] border border-ink/8 bg-moss-100/45 p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-ink/45">Overall signal</p><p className="mt-2 font-display text-3xl font-semibold tracking-[-0.07em] text-ink sm:text-4xl">{!sessionActive ? 'Ready when you are' : isTracking ? 'Reading the room' : 'Warming up'}</p><p className="mt-2 text-xs text-ink/50">{!sessionActive ? 'Connect a camera to begin.' : isTracking ? `${faceCount} ${faceCount === 1 ? 'face' : 'faces'} in view.` : 'Preparing local face detection.'}</p></div><div className="rounded-2xl bg-white/75 p-3 text-moss-600 shadow-sm"><Icon name="pulse" size={23} /></div></div><div className="mt-5 flex items-center gap-2 text-xs text-ink/50"><Icon name="shield" size={15} /><span>Private by design · browser processing</span></div></div>
        <div className="grid grid-cols-3 gap-2.5">{metrics.map((metric) => <div className="rounded-2xl border border-ink/8 bg-white/55 px-3 py-4 text-center" key={metric.label}><p className="text-[0.62rem] font-bold uppercase tracking-[0.11em] text-ink/40">{metric.label}</p><p className="mt-2 font-display text-2xl font-semibold tracking-[-0.06em] text-ink">—</p><div className="mt-3 flex justify-center"><span className={`h-1.5 w-1.5 rounded-full ${metric.color}`} /></div></div>)}</div>
        <div className="chart-empty mt-6 flex min-h-32 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-ink/12 px-5 py-6 text-center"><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink/35"><Icon name={isTracking ? 'activity' : 'layers'} size={17} /></div><p className="text-sm font-semibold text-ink/60">{isTracking ? 'Face tracking is active' : 'Your timeline starts here'}</p><p className="mt-1 text-xs text-ink/40">{isTracking ? 'Emotion metrics will appear after the inference model is loaded.' : 'Live emotion trends will appear after camera setup.'}</p></div>
        <div className="mt-5 flex items-center justify-between border-t border-ink/8 pt-4 text-[0.65rem] font-semibold text-ink/40"><span className="inline-flex items-center gap-1.5"><Icon name="clock" size={13} />Last 30 minutes</span><span>Data stays local</span></div>
      </div>
    </section>
  )
}
