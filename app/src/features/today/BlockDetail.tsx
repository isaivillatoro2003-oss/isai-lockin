import { useState } from 'react'
import { db, now, uid, type Status } from '../../db'
import { bloques, guia } from '../../content'
import type { BlockGuide } from '../../content/types'
import { CAT_LABEL, type Block } from '../../domain/schedule'
import { dur, fromMin, partnerHm, toMin } from '../../domain/time'
import { useNav } from '../../hooks'
import { Btn, CAT_COLOR, Grade, Kicker, NumberInput, Sheet } from '../../ui'
import { TodayWorkout } from '../training/Training'
import { RecipeCard, RecipeDetail, suggestions } from '../guide/Recipes'
import type { Receta } from '../../content/types'

function MealIdeas({ title, date, onLog }: { title: string; date: string; onLog: () => void }) {
  const slot = (title.includes('1') ? 'comida1' : title.includes('2') ? 'comida2' : 'comida3') as Receta['slot']
  const ideas = suggestions(slot, date)
  const [open, setOpen] = useState<Receta | null>(null)
  return (
    <div>
      <Btn kind="line" className="w-full" onClick={onLog}>Registrar o fotografiar la comida</Btn>
      {ideas.length > 0 && (
        <div className="mt-5">
          <Kicker>Ideas para hoy</Kicker>
          <div className="mt-2 grid gap-2">{ideas.map((r) => <RecipeCard key={r.id} r={r} onOpen={() => setOpen(r)} />)}</div>
        </div>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)}>{open && <RecipeDetail r={open} />}</Sheet>
    </div>
  )
}

function GuideView({ g, color }: { g: BlockGuide; color: string }) {
  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-2xl border border-line p-4">
        <Kicker color={color}>Qué es</Kicker>
        <p className="mt-1.5 text-[15px] leading-relaxed">{g.que}</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-dim">{g.por}</p>
      </div>
      <div>
        <Kicker>Cómo</Kicker>
        <ol className="mt-2 space-y-2.5">
          {g.como.map((x, i) => (
            <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed">
              <span className="w-4 shrink-0 font-serif text-[18px] leading-tight" style={{ color }}>{i + 1}</span>{x}
            </li>
          ))}
        </ol>
      </div>
      {g.tips.length > 0 && (
        <div>
          <Kicker>Tips</Kicker>
          <ul className="mt-2 divide-y divide-line">
            {g.tips.map((t, i) => (
              <li key={i} className="py-2.5"><Grade g={t.grade} /><p className="mt-1 text-[14px] leading-relaxed text-dim">{t.text}</p></li>
            ))}
          </ul>
        </div>
      )}
      {g.minimo && (
        <p className="rounded-xl bg-ink px-4 py-3 text-[13.5px] leading-relaxed text-dim">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">Si el día va mal · </span>{g.minimo}
        </p>
      )}
    </div>
  )
}

export default function BlockDetail({ b, date, status, onMark, onClose }: {
  b: Block; date: string; status?: Status; onMark: (s: Status | null) => void; onClose: () => void
}) {
  const { go } = useNav()
  const color = CAT_COLOR[b.cat]
  const g = b.guide ? bloques.bloques[b.guide] : undefined
  const open = (tab: Parameters<typeof go>[0]) => { onClose(); go(tab) }

  return (
    <div className="pb-4">
      <Kicker color={color}>{CAT_LABEL[b.cat]} · {b.start} a {fromMin(toMin(b.start) + b.dur)} · {dur(b.dur)}</Kicker>
      <h2 className="mt-2 font-serif text-[36px] leading-[1.02]">{b.title}</h2>
      {b.cat === 'novia' && <div className="mt-1 font-mono text-[11px] text-dim">{partnerHm(b.start)} en Beirut</div>}
      {b.detail && <p className="mt-3 text-[15px] leading-relaxed text-dim">{b.detail}</p>}
      {(b.water || b.extras) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {b.water ? <span className="rounded-full border border-blue/50 px-2.5 py-1 text-[12px] text-blue">Toma {b.water} ml de agua</span> : null}
          {b.extras?.map((x) => <span key={x} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-dim">{x}</span>)}
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2">
        {(['hecho', 'minima', 'saltado'] as Status[]).map((s) => (
          <button key={s} onClick={() => onMark(status === s ? null : s)}
            className={`rounded-full py-3 text-[14px] transition ${status === s ? 'text-ink' : 'border border-line text-dim'}`}
            style={status === s ? { background: s === 'saltado' ? 'var(--color-faint)' : color } : undefined}>
            {{ hecho: 'Hecho', minima: 'Mínima', saltado: 'Saltar' }[s]}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {b.link === 'workout' && <TodayWorkout date={date} />}
        {b.link === 'glow-am' && <Steps title="Rutina de mañana" steps={guia.glow.am} />}
        {b.link === 'glow-pm' && <Steps title="Rutina de noche" steps={guia.glow.pm} />}
        {(b.link === 'weigh' || b.link === 'measure') && <QuickWeight date={date} />}
        {(b.link === 'anki-ar' || b.link === 'anki-fr') && (
          <Btn className="w-full" onClick={() => open({ tab: 'idiomas', sub: `review-${b.link!.slice(5)}` })}>Empezar repaso</Btn>
        )}
        {(b.link === 'lesson-ar' || b.link === 'lesson-fr') && (
          <Btn kind="line" className="w-full" onClick={() => open({ tab: 'idiomas', sub: b.link!.slice(7) })}>Ver unidades y recursos</Btn>
        )}
        {b.link === 'speak-ar' && <Btn kind="line" className="w-full" onClick={() => open({ tab: 'idiomas', sub: 'ella' })}>Frases para Pam</Btn>}
        {b.link === 'meal' && <MealIdeas title={b.title} date={date} onLog={() => open({ tab: 'cuerpo', sub: 'comidas' })} />}
        {b.link === 'journal' && <Btn kind="line" className="w-full" onClick={() => open({ tab: 'diario' })}>Abrir diario</Btn>}
        {b.link === 'measure' && <Btn kind="line" className="mt-2 w-full" onClick={() => open({ tab: 'cuerpo', sub: 'fotos' })}>Fotos de la semana</Btn>}
      </div>

      {g && <GuideView g={g} color={color} />}
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
