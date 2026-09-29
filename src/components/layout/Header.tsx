import { BrandMark } from './BrandMark'
import { Icon } from '../ui/Icon'

const navItems = ['Overview', 'Live session', 'History']
interface HeaderProps { isSessionActive: boolean; isSessionStarting: boolean; onStartSession: () => void; onStopSession: () => void }

export function Header({ isSessionActive, isSessionStarting, onStartSession, onStopSession }: HeaderProps) {
  return (
    <header className="border-b border-ink/10 bg-paper/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <a className="group flex items-center gap-3" href="/" aria-label="RoomPulse home"><BrandMark /><span className="font-display text-[1.05rem] font-semibold tracking-[-0.03em] text-ink">room<span className="text-moss-600">pulse</span></span></a>
        <nav className="hidden items-center gap-1 rounded-full border border-ink/8 bg-white/65 p-1.5 md:flex" aria-label="Primary navigation">
          {navItems.map((item, index) => <a className={`rounded-full px-4 py-2 text-[0.78rem] font-semibold transition-colors ${index === 0 ? 'bg-ink text-paper shadow-sm' : 'text-ink/55 hover:bg-ink/5 hover:text-ink'}`} href={index === 0 ? '/' : `#${item.toLowerCase().replace(' ', '-')}`} key={item}>{item}</a>)}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-moss-600/20 bg-moss-100/70 px-3 py-2 text-[0.7rem] font-semibold text-moss-800 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-moss-600 shadow-[0_0_0_4px_rgba(110,153,84,0.12)]" />Edge mode on</div>
          <button className="icon-button md:hidden" type="button" aria-label="Open navigation"><Icon name="menu" size={19} /></button>
          {isSessionActive ? <button className="hidden h-9 items-center gap-2 rounded-full bg-lime-300 px-3 text-[0.7rem] font-bold text-ink transition-transform hover:scale-105 sm:inline-flex" onClick={onStopSession} type="button"><span className="h-1.5 w-1.5 rounded-full bg-moss-600" />Stop live</button> : <button className="flex h-9 w-9 items-center justify-center rounded-full bg-coral-300 text-[0.7rem] font-bold text-ink ring-4 ring-coral-200/50 transition-transform hover:scale-105" onClick={onStartSession} type="button" aria-label="Start camera session">JD</button>}
          {isSessionStarting && <span className="sr-only">Starting camera session</span>}
        </div>
      </div>
    </header>
  )
}
