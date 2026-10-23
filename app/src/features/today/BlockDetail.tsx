import { useState } from 'react'
import { db, now, uid, type Status } from '../../db'
import { guia, workout } from '../../content'
import { CAT_LABEL, planWeek, workoutsFor, type Block } from '../../domain/schedule'
import { dur, fromMin, partnerHm, toMin } from '../../domain/time'
import { useNav } from '../../hooks'
import { Btn, CAT_COLOR, Kicker, NumberInput } from '../../ui'

export default function BlockDetail({ b, date, status, onMark, onClose }: {
  b: Block; date: string; status?: Status; onMark: (s: Status | null) => void; onClose: () => void
}) {
  const { go } = useNav()
  const color = CAT_COLOR[b.cat]
  const open = (tab: Parameters<typeof go>[0]) => { onClose(); go(tab) }

  return (
    <div className="pb-4">
      <Kicker color={color}>{CAT_LABEL[b.cat]} · {b.start} a {fromMin(toMin(b.start) + b.dur)} · {dur(b.dur)}</Kicker>
      <h2 className="mt-2 font-serif text-[36px] leading-[1.02]">{b.title}</h2>
      {b.cat === 'novia' && <div className="mt-1 font-mono text-[11px] text-dim">{partnerHm(b.start)} en Beirut</div>}
      {b.detail && <p className="mt-3 text-[15px] leading-relaxed text-dim">{b.detail}</p>}

      <div className="mt-5">
        {b.link === 'workout' && <WorkoutView date={date} />}
        {b.link === 'glow-am' && <Steps title="Rutina de mañana" steps={guia.glow.am} />}
        {b.link === 'glow-pm' && <Steps title="Rutina de noche" steps={guia.glow.pm} />}
        {(b.link === 'weigh' || b.link === 'measure') && <QuickWeight date={date} />}
        {(b.link === 'anki-ar' || b.link === 'anki-fr') && (
          <Btn className="w-full" onClick={() => open({ tab: 'idiomas', sub: `review-${b.link!.slice(5)}` })}>Empezar repaso</Btn>
        )}
        {(b.link === 'lesson-ar' || b.link === 'lesson-fr') && (
          <Btn kind="line" className="w-full" onClick={() => open({ tab: 'idiomas', sub: b.link!.slice(7) })}>Ver unidades y recursos</Btn>
        )}
        {b.link === 'speak-ar' && <Btn kind="line" className="w-full" onClick={() => open({ tab: 'idiomas', sub: 'ella' })}>Frases para ella</Btn>}
        {b.link === 'meal' && <Btn kind="line" className="w-full" onClick={() => open({ tab: 'cuerpo', sub: 'comidas' })}>Registrar comida</Btn>}
        {b.link === 'journal' && <Btn kind="line" className="w-full" onClick={() => open({ tab: 'diario' })}>Abrir diario</Btn>}
        {b.link === 'measure' && <Btn kind="line" className="mt-2 w-full" onClick={() => open({ tab: 'cuerpo', sub: 'fotos' })}>Fotos de la semana</Btn>}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        {(['hecho', 'minima', 'saltado'] as Status[]).map((s) => (
          <button key={s} onClick={() => onMark(status === s ? null : s)}
            className={`rounded-full py-3 text-[14px] transition ${status === s ? 'text-ink' : 'border border-line text-dim'}`}
            style={status === s ? { background: s === 'saltado' ? 'var(--color-faint)' : color } : undefined}>
            {{ hecho: 'Hecho', minima: 'Mínima', saltado: 'Saltar' }[s]}
          </button>
        ))}
      </div>
    </div>
  )
}

function Steps({ title, steps }: { title: string; steps: { step: string; how: string; product?: string; min?: number }[] }) {
  const [done, setDone] = useState<Set<number>>(new Set())
  return (
    <div>
      <Kicker>{title}</Kicker>
      <ol className="mt-2 divide-y divide-line">
        {steps.map((s, i) => (
          <li key={i} onClick={() => setDone((d) => { const n = new Set(d); n.has(i) ? n.delete(i) : n.add(i); return n })} className="flex gap-3 py-3">
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${done.has(i) ? 'border-sun bg-sun text-ink' : 'border-line text-faint'}`}>{done.has(i) ? '✓' : i + 1}</span>
            <div className={done.has(i) ? 'opacity-40' : ''}>
              <div className="text-[15px]">{s.step}{s.min ? <span className="ml-2 font-mono text-[10.5px] text-faint">{s.min} min</span> : null}</div>
              <div className="text-[13px] leading-relaxed text-dim">{s.how}</div>
              {s.product && <div className="mt-0.5 text-[12px] text-faint">{s.product}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function WorkoutView({ date }: { date: string }) {
  const [casa, setCasa] = useState(false)
  const wk = planWeek(date)
  const ids = workoutsFor(date)
  const prog = guia.progresion.find((p) => p.week === String(wk))
  const gym = ids.some((id) => workout(id)?.where === 'gym')
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Kicker>Semana {wk} de 12</Kicker>
        {gym && (
          <button onClick={() => setCasa(!casa)} className="rounded-full border border-line px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-dim">
            {casa ? 'Sin gym' : 'Gym'} ⇄
          </button>
        )}
      </div>
      {prog && <p className="mb-4 text-[13px] leading-relaxed text-dim">{prog.text}</p>}
      {ids.map((id) => {
        const w = workout(id)
        if (!w) return null
        return (
          <div key={id} className="mb-4">
            <div className="font-serif text-[24px]">{w.name}</div>
            <div className="mb-2 text-[13px] text-faint">{w.focus}</div>
            <div className="divide-y divide-line rounded-xl border border-line">
              {w.exercises.map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[14.5px]">{casa && e.alt ? e.alt : e.name}</div>
                    {e.notes && <div className="text-[12px] leading-snug text-faint">{e.notes}</div>}
                  </div>
                  <div className="shrink-0 text-right font-mono text-[11px] text-dim tnum">
                    {e.sets} × {e.reps}<div className="text-faint">{e.rest}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function QuickWeight({ date }: { date: string }) {
  const [v, setV] = useState('')
  const [saved, setSaved] = useState(false)
  const save = async () => {
    const n = parseFloat(v)
    if (!n) return
    const prev = await db.metrics.where('[type+date]').equals(['peso', date]).first()
    await db.metrics.put({ id: prev?.id ?? uid(), date, type: 'peso', value: n, updatedAt: now() })
    setSaved(true)
  }
  return (
    <div>
      <Kicker>Peso en ayunas</Kicker>
      <div className="mt-2 flex gap-2">
        <NumberInput value={v} onChange={(x) => { setV(x); setSaved(false) }} placeholder="kg" />
        <Btn onClick={save}>{saved ? '✓' : 'Guardar'}</Btn>
      </div>
    </div>
  )
}
