import { useEffect, useState } from 'react'
import { NavCtx, type Nav, type Tab } from './hooks'
import { requestPersist, seedHabits } from './db'
import Today from './features/today/Today'
import Body from './features/body/Body'
import Langs from './features/langs/Langs'
import Journal from './features/journal/Journal'
import Guide from './features/guide/Guide'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'hoy', label: 'Hoy', icon: 'M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M17.7 6.3l1.4-1.4M4.9 19.1l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
  { id: 'cuerpo', label: 'Cuerpo', icon: 'M4 19h16M7 15l3-4 3 2 4-6' },
  { id: 'idiomas', label: 'Idiomas', icon: 'M4 6h9M8.5 4v2M6 6c0 4 3 7 6 8M11 6c0 3-3 7-6 8M13 20l4-9 4 9M14.5 17h5' },
  { id: 'diario', label: 'Diario', icon: 'M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4ZM6 18a2 2 0 0 1 2-2h10M10 8h5' },
  { id: 'guia', label: 'Guía', icon: 'M4 5.5C6 4.5 9 4.5 12 6c3-1.5 6-1.5 8-.5V19c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5V5.5ZM12 6v13.5' },
]

export default function App() {
  const [nav, setNav] = useState<Nav>({ tab: 'hoy' })
  const go = (n: Nav) => { setNav(n); window.scrollTo({ top: 0 }) }

  useEffect(() => { seedHabits(); requestPersist() }, [])

  return (
    <NavCtx.Provider value={{ nav, go }}>
      <main className="mx-auto min-h-full max-w-[480px]">
        {nav.tab === 'hoy' && <Today />}
        {nav.tab === 'cuerpo' && <Body />}
        {nav.tab === 'idiomas' && <Langs />}
        {nav.tab === 'diario' && <Journal />}
        {nav.tab === 'guia' && <Guide />}
      </main>
      <nav className="safe-b fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[480px] justify-around pt-2">
          {TABS.map((t) => {
            const on = nav.tab === t.id
            return (
              <button key={t.id} onClick={() => go({ tab: t.id })}
                className={`flex w-16 flex-col items-center gap-1 py-1 transition ${on ? 'text-paper' : 'text-faint'}`}>
                <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={on ? 1.8 : 1.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d={t.icon} />
                </svg>
                <span className="text-[10.5px] tracking-wide">{t.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </NavCtx.Provider>
  )
}
