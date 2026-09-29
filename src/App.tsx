import { useRef, useState } from 'react'
import { DashboardPreview } from './components/dashboard/DashboardPreview'
import { useFaceDetector } from './hooks/useFaceDetector'
import { useWebcam } from './hooks/useWebcam'
import { Header } from './components/layout/Header'
import { VideoStage } from './components/video/VideoStage'
import { Icon } from './components/ui/Icon'

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [consentAccepted, setConsentAccepted] = useState(() => window.sessionStorage.getItem('roompulse-consent') === 'accepted')
  const [consentOpen, setConsentOpen] = useState(false)
  const [participantsInformed, setParticipantsInformed] = useState(false)
  const webcam = useWebcam(videoRef)
  const faceDetector = useFaceDetector({ canvasRef, isActive: webcam.status === 'active', videoRef })
  const sessionActive = webcam.status === 'active'
  const sessionStarting = webcam.status === 'requesting'

  const startSession = () => {
    if (!consentAccepted) {
      setConsentOpen(true)
      return
    }
    void webcam.start()
  }
  const stopSession = () => webcam.stop()
  const acceptConsent = () => {
    if (!participantsInformed) return
    window.sessionStorage.setItem('roompulse-consent', 'accepted')
    setConsentAccepted(true)
    setConsentOpen(false)
    void webcam.start()
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header isSessionActive={sessionActive} isSessionStarting={sessionStarting} onStartSession={startSession} onStopSession={stopSession} />
      <main className="mx-auto max-w-[1440px] px-5 pb-10 pt-8 sm:px-8 sm:pt-10 lg:px-12 lg:pb-14">
        <section className="mb-8 flex flex-col justify-between gap-6 lg:mb-10 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink/40">
              <span>Tuesday, October 14, 2025</span><span className="h-1 w-1 rounded-full bg-coral-400" /><span>Good morning, Jordan</span>
            </div>
            <h1 className="max-w-2xl font-display text-[clamp(2.35rem,5vw,4.75rem)] font-semibold leading-[0.96] tracking-[-0.075em] text-ink">
              Make space for <span className="relative inline-block"><span className="relative z-10">better</span><span className="title-underline" /></span> conversations.
            </h1>
          </div>
          <div className="relative flex items-center gap-3 lg:pb-1">
            <button className="secondary-button" onClick={() => setPreferencesOpen((open) => !open)} type="button"><Icon name="settings" size={16} />Preferences</button>
            <button className="primary-button disabled:cursor-wait disabled:opacity-60" disabled={sessionStarting} onClick={sessionActive ? stopSession : startSession} type="button">
              <Icon name={sessionActive ? 'x' : 'play'} size={14} />{sessionStarting ? 'Starting…' : sessionActive ? 'Stop session' : 'Start a session'}
            </button>
            {preferencesOpen && <div className="absolute right-0 top-14 z-20 w-64 rounded-2xl border border-ink/10 bg-white p-4 text-xs text-ink/65 shadow-xl"><p className="font-bold text-ink">Privacy defaults</p><p className="mt-2 leading-5">Camera frames stay in this browser. MediaPipe runs locally at 4 samples per second.</p></div>}
          </div>
        </section>

        <div className="mb-8 flex flex-wrap items-center gap-2.5 border-y border-ink/8 py-4 text-xs text-ink/50">
          <span className="mr-1 inline-flex items-center gap-2 font-semibold text-ink/65"><span className="h-2 w-2 rounded-full bg-moss-500" />Workspace status</span>
          <span className="status-chip"><Icon name={sessionActive ? 'check' : 'lock'} size={13} />{sessionActive ? 'Camera connected' : 'No camera connected'}</span>
          <span className="status-chip"><Icon name="clock" size={13} />{sessionActive ? 'Session in progress' : 'Last session: Never'}</span>
          <span className="status-chip hidden sm:inline-flex"><Icon name="users" size={13} />Solo workspace</span>
        </div>

        <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.8fr)]">
          <VideoStage canvasRef={canvasRef} detectorError={faceDetector.error} detectorStatus={faceDetector.status} faceCount={faceDetector.faceCount} onStart={startSession} onStop={stopSession} status={webcam.status} videoRef={videoRef} webcamError={webcam.error} />
          <DashboardPreview detectorStatus={faceDetector.status} faceCount={faceDetector.faceCount} sessionActive={sessionActive} />
        </div>

        <footer className="mt-8 flex flex-col gap-3 border-t border-ink/8 pt-5 text-xs text-ink/50 sm:flex-row sm:items-center sm:justify-between"><p>Facial expression is an observable signal, not a direct reading of internal emotion.</p><p className="inline-flex items-center gap-1.5"><Icon name="shield" size={14} />Edge processing enabled</p></footer>
      </main>
      {consentOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) setConsentOpen(false) }}>
        <section aria-describedby="consent-description" aria-labelledby="consent-title" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-ink/10 bg-paper p-6 shadow-2xl sm:p-8" role="dialog">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-moss-100 text-moss-800"><Icon name="shield" size={21} /></div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-ink" id="consent-title">Before you start</h2>
          <p className="mt-3 text-sm leading-6 text-ink/65" id="consent-description">RoomPulse analyzes visible facial expressions as an observable signal, not a reading of anyone’s internal emotion. Camera frames are processed in this browser and are not uploaded or stored.</p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-ink/10 bg-white/60 p-4 text-sm leading-5 text-ink/75">
            <input checked={participantsInformed} className="mt-1 accent-moss-600" onChange={(event) => setParticipantsInformed(event.target.checked)} type="checkbox" />
            <span>I have informed everyone visible that facial expressions will be analyzed, and have their consent to proceed.</span>
          </label>
          <div className="mt-6 flex justify-end gap-3">
            <button className="secondary-button" onClick={() => setConsentOpen(false)} type="button">Cancel</button>
            <button className="primary-button disabled:cursor-not-allowed disabled:opacity-50" disabled={!participantsInformed} onClick={acceptConsent} type="button">Continue to camera</button>
          </div>
        </section>
      </div>}
    </div>
  )
}

export default App
