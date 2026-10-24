import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { entreno } from '../../content'
import type { Equipo, Sesion } from '../../content/types'
import { getSetting, setSetting } from '../../db'
import { planWeek } from '../../domain/schedule'
import { weekday } from '../../domain/time'
import { Kicker, Sheet } from '../../ui'

export const EQUIPOS: { v: Equipo; l: string }[] = [
  { v: 'nada', l: 'Sin nada' }, { v: 'mancuernas', l: 'Mancuernas' }, { v: 'gym', l: 'Gimnasio' },
]

export function useEquipo() {
  const eq = useLiveQuery(() => getSetting<Equipo>('equipo', 'nada'), []) ?? 'nada'
  return [eq, (v: Equipo) => setSetting('equipo', v)] as const
}

/** Sesión que toca ese día según el equipo y la semana del plan. */
export function sessionFor(date: string, eq: Equipo) {
  const wk = planWeek(date)
  const fase = entreno.programas[eq]?.fases.find((f) => {
    const [a, b] = f.weeks.split('-').map(Number)
    return wk >= a && wk <= (b || a)
  })
  return { wk, fase, sesion: fase?.dias[String(weekday(date))] }
}

/** Alterna la foto de inicio y la de final para que se vea el movimiento. */
export function ExerciseImage({ img, className = '' }: { img: string[]; className?: string }) {
  const [f, setF] = useState(0)
  useEffect(() => {
    if (img.length < 2) return
    const t = setInterval(() => setF((x) => (x + 1) % img.length), 900)
    return () => clearInterval(t)
  }, [img.length])
  if (!img.length) return null
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white ${className}`}>
      {img.map((src, i) => (
        <img key={src} src={src} alt="" loading="lazy"
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${i === f ? 'opacity-100' : 'opacity-0'}`} />
      ))}
    </div>
  )
}

export function SessionView({ sesion, nota }: { sesion: Sesion; nota?: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const ex = open ? entreno.ejercicios[open] : null
  return (
    <div>
      <div className="font-serif text-[26px] leading-tight">{sesion.title}</div>
      <p className="mt-1 text-[14px] leading-relaxed text-dim">{sesion.explica}</p>
      {nota && <p className="mt-2 text-[12.5px] leading-relaxed text-faint">{nota}</p>}

      {sesion.calentamiento.length > 0 && (
        <div className="mt-4"><Kicker>Calentamiento</Kicker>
          <ul className="mt-1.5 space-y-1">{sesion.calentamiento.map((x, i) => <li key={i} className="text-[13.5px] text-dim">· {x}</li>)}</ul>
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {sesion.bloques.map((b, i) => {
          const e = entreno.ejercicios[b.ex]
          return (
            <button key={i} onClick={() => setOpen(b.ex)} className="flex items-center gap-3 rounded-2xl border border-line p-2.5 text-left">
              {e && <ExerciseImage img={e.img} className="h-20 w-20 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="text-[15px] leading-snug">{e?.name ?? b.ex}</div>
                <div className="mt-0.5 font-mono text-[11px] text-dim tnum">{b.series} × {b.reps} · {b.descanso}</div>
                {b.nota && <div className="mt-0.5 text-[12px] text-faint">{b.nota}</div>}
              </div>
              <span className="pr-1 text-faint">›</span>
            </button>
          )
        })}
      </div>

      {sesion.enfriamiento.length > 0 && (
        <div className="mt-4"><Kicker>Al terminar</Kicker>
          <ul className="mt-1.5 space-y-1">{sesion.enfriamiento.map((x, i) => <li key={i} className="text-[13.5px] text-dim">· {x}</li>)}</ul>
        </div>
      )}

      <Sheet open={!!ex} onClose={() => setOpen(null)}>
        {ex && (
          <div className="pb-4">
            <ExerciseImage img={ex.img} className="aspect-[4/3] w-full" />
            <h3 className="mt-4 font-serif text-[30px] leading-tight">{ex.name}</h3>
            <div className="text-[13px] text-faint">{ex.musculos}</div>
            <div className="mt-4"><Kicker>Cómo se hace</Kicker>
              <ol className="mt-2 space-y-2">{ex.como.map((x, i) => <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed"><span className="font-serif text-sun">{i + 1}</span>{x}</li>)}</ol>
            </div>
            {ex.errores.length > 0 && <div className="mt-4"><Kicker>Errores comunes</Kicker>
              <ul className="mt-2 space-y-1.5">{ex.errores.map((x, i) => <li key={i} className="text-[13.5px] text-dim">✕ {x}</li>)}</ul></div>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-line p-3"><Kicker>Más fácil</Kicker><p className="mt-1 text-[13px] text-dim">{ex.facil}</p></div>
              <div className="rounded-xl border border-line p-3"><Kicker>Más difícil</Kicker><p className="mt-1 text-[13px] text-dim">{ex.dificil}</p></div>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

/** Entreno del día dentro del bloque de Hoy. */
export function TodayWorkout({ date }: { date: string }) {
  const [eq, setEq] = useEquipo()
  const { wk, fase, sesion } = sessionFor(date, eq)
  return (
    <div>
      <div className="mb-3 flex rounded-full border border-line p-1">
        {EQUIPOS.map((e) => (
          <button key={e.v} onClick={() => setEq(e.v)} className={`flex-1 rounded-full py-1.5 text-[12.5px] ${eq === e.v ? 'bg-paper text-ink' : 'text-dim'}`}>{e.l}</button>
        ))}
      </div>
      <div className="mb-2"><Kicker>Semana {wk} de 12</Kicker></div>
      {sesion ? <SessionView sesion={sesion} nota={fase?.nota} /> : <p className="text-[14px] text-faint">Sin sesión para hoy en este programa.</p>}
    </div>
  )
}
