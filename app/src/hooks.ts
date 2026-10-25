import { createContext, useContext, useEffect, useState } from 'react'
import { clock } from './domain/time'

export function useClock(everyMs = 15_000) {
  const [c, setC] = useState(() => clock())
  useEffect(() => {
    const t = setInterval(() => setC(clock()), everyMs)
    const v = () => document.visibilityState === 'visible' && setC(clock())
    document.addEventListener('visibilitychange', v)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v) }
  }, [everyMs])
  return c
}

export type Tab = 'hoy' | 'stats' | 'cuerpo' | 'idiomas' | 'diario' | 'guia'
export interface Nav { tab: Tab; sub?: string }
export const NavCtx = createContext<{ nav: Nav; go: (n: Nav) => void }>({ nav: { tab: 'hoy' }, go: () => {} })
export const useNav = () => useContext(NavCtx)
