import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, now, uid, type HabitRow, type JournalRow } from '../../db'
import { defaultTemplate } from '../../domain/schedule'
import { dayComplete } from '../../domain/streak'
import { addDays, clock, longDate, weekday } from '../../domain/time'
import { Btn, Card, Kicker, NumberInput, Screen, Sheet } from '../../ui'

const field = 'mt-2 w-full resize-none rounded-xl border border-line bg-ink px-3 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-faint focus:border-dim'
const dayNum = (d: string) => Math.round(Date.parse(d + 'T12:00:00Z') / 864e5)

export default function Journal() {
  const today = clock().date
  const loaded = useLiveQuery(async () => ({ row: await db.journal.get(today) }), [today])
  const all = useLiveQuery(() => db.journal.orderBy('date').reverse().toArray(), []) ?? []

  return (
    <Screen title="Diario" kicker={longDate(today)}>
      {loaded && <Entry key={today} date={today} initial={loaded.row} />}
      {weekday(today) === 0 && <WeekSummary today={today} />}
      <Habits today={today} />
      <Past rows={all.filter((r) => r.date !== today)} />
    </Screen>
  )
}

/* ───────────── Entrada del día con autoguardado ───────────── */

type Draft = Omit<JournalRow, 'date' | 'updatedAt' | 'sleep'> & { sleep: string }

function toDraft(r?: JournalRow): Draft {
  return {
    good: r?.good ?? '', bad: r?.bad ?? '', tomorrow: r?.tomorrow ?? '',
    mood: r?.mood ?? 0, energy: r?.energy ?? 0, craving: r?.craving ?? 0, cravingWhat: r?.cravingWhat ?? '',
    sleep: r?.sleep !== undefined ? String(r.sleep) : '',
  }
}

function Entry({ date, initial }: { date: string; initial?: JournalRow }) {
  const [d, setD] = useState<Draft>(() => toDraft(initial))
  const [state, setState] = useState<'' | 'pendiente' | 'guardado'>(initial ? 'guardado' : '')
  const ref = useRef(d)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)

  const write = async () => {
    timer.current = null
    dirty.current = false
    const v = ref.current
    const n = parseFloat(v.sleep.replace(',', '.'))
    const row: JournalRow = {
      date, good: v.good, bad: v.bad, tomorrow: v.tomorrow,
      mood: v.mood, energy: v.energy, craving: v.craving, cravingWhat: v.cravingWhat,
      updatedAt: now(), ...(isFinite(n) ? { sleep: n } : {}),
    }
    await db.journal.put(row)
    setState('guardado')
  }

  const set = (patch: Partial<Draft>) => {
    const next = { ...ref.current, ...patch }
    ref.current = next
    setD(next)
    dirty.current = true
    setState('pendiente')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(write, 600)
  }

  // Al salir de la pantalla se guarda lo pendiente
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
    if (dirty.current) void write()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <Kicker>Hoy</Kicker>
        <span className={`font-mono text-[10.5px] ${state === 'guardado' ? 'text-faint' : 'text-sun'}`}>{state === 'guardado' ? 'guardado' : state === 'pendiente' ? 'escribiendo…' : ''}</span>
      </div>

      <div className="grid gap-4">
        {([
          ['good', '¿Qué hice bien hoy?'],
          ['bad', '¿Qué falló y por qué?'],
          ['tomorrow', '¿Qué hago mañana distinto?'],
        ] as const).map(([k, q]) => (
          <Card key={k}>
            <Kicker>{q}</Kicker>
            <textarea rows={3} value={d[k]} onChange={(e) => set({ [k]: e.target.value })} className={field} placeholder="Escribe sin editar" />
          </Card>
        ))}

        <Card>
          <Scale label="Ánimo" value={d.mood} from={1} to={5} onChange={(n) => set({ mood: n })} />
          <div className="h-4" />
          <Scale label="Energía" value={d.energy} from={1} to={5} onChange={(n) => set({ energy: n })} />
        </Card>

        <Card>
          <Scale label="Antojo" value={d.craving} from={0} to={5} onChange={(n) => set({ craving: n })} />
          <Kicker>{' '}</Kicker>
          <input value={d.cravingWhat} onChange={(e) => set({ cravingWhat: e.target.value })} placeholder="¿De qué?"
            className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2.5 text-[15px] outline-none placeholder:text-faint focus:border-dim" />
        </Card>

        <Card>
          <Kicker>Horas de sueño</Kicker>
          <div className="mt-2"><NumberInput value={d.sleep} onChange={(v) => set({ sleep: v })} placeholder="h" step={0.5} /></div>
        </Card>
      </div>
    </div>
  )
}

function Scale({ label, value, from, to, onChange }: { label: string; value: number; from: number; to: number; onChange: (n: number) => void }) {
  const nums = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  return (
    <div>
      <Kicker>{label}</Kicker>
      <div className="mt-2 flex gap-2">
        {nums.map((n) => {
          const on = value === n && !(from === 1 && value === 0)
          return (
            <button key={n} onClick={() => onChange(from === 1 && value === n ? 0 : n)}
              className={`grid h-11 flex-1 place-items-center rounded-xl border font-serif text-[22px] tnum transition ${on ? 'border-sun bg-sun text-ink' : 'border-line text-dim'}`}>{n}</button>
          )
        })}
      </div>
    </div>
  )
}

/* ───────────── Resumen del domingo ───────────── */

function WeekSummary({ today }: { today: string }) {
  const start = addDays(today, -6)
  const data = useLiveQuery(async () => {
    const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i))
    const [logs, days, peso, reviews] = await Promise.all([
      db.logs.where('date').between(start, today, true, true).toArray(),
      db.days.where('date').between(start, today, true, true).toArray(),
      db.metrics.where('type').equals('peso').sortBy('date'),
      db.reviews.where('at').aboveOrEqual(Date.now() - 7 * 864e5).count(),
    ])
    const tpl = new Map(days.map((r) => [r.date, r.templateId]))
    const complete = dates.filter((dt) => dayComplete(tpl.get(dt) ?? defaultTemplate(dt), logs.filter((l) => l.date === dt))).length
    const inWeek = peso.filter((p) => p.date >= start && p.date <= today)
    const before = [...peso].reverse().find((p) => p.date < start)
    const ref = before ?? inWeek[0]
    const last = inWeek[inWeek.length - 1]
    const delta = ref && last && ref.id !== last.id ? last.value - ref.value : null
    return { complete, delta, reviews }
  }, [today])

  const delta = data?.delta
  return (
    <div className="mb-8">
      <Kicker>Resumen de la semana</Kicker>
      <div className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        <Cell k="Días completos" v={data ? `${data.complete}/7` : '—'} />
        <Cell k="Peso" v={delta == null ? '—' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Math.abs(delta).toFixed(1)}`} unit="kg" />
        <Cell k="Tarjetas" v={data ? String(data.reviews) : '—'} unit="repasadas" />
      </div>
    </div>
  )
}

function Cell({ k, v, unit }: { k: string; v: string; unit?: string }) {
  return (
    <div className="bg-raised px-3 py-3">
      <Kicker>{k}</Kicker>
      <div className="mt-1 font-serif text-[32px] leading-none tnum">{v}</div>
      <div className="mt-1 truncate font-mono text-[10px] text-faint">{unit ?? ' '}</div>
    </div>
  )
}

/* ───────────── Días limpios ───────────── */

function Habits({ today }: { today: string }) {
  const habits = useLiveQuery(() => db.habits.toArray(), []) ?? []
  const [target, setTarget] = useState<HabitRow | null>(null)
  const [trigger, setTrigger] = useState('')
  const [response, setResponse] = useState('')

  const close = () => { setTarget(null) }
  const save = async () => {
    if (!target) return
    await db.relapses.put({ id: uid(), habitId: target.id, date: today, trigger: trigger.trim(), response: response.trim(), updatedAt: now() })
    await db.habits.put({ ...target, cleanSince: today, updatedAt: now() })
    setTrigger(''); setResponse(''); close()
  }

  return (
    <div className="mb-8">
      <Kicker>Días limpios</Kicker>
      <div className="mt-2 grid gap-3">
        {habits.map((h) => {
          const n = dayNum(today) - dayNum(h.cleanSince)
          return (
            <Card key={h.id}>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px]">{h.name}</div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-faint">{n < 0 ? `empieza en ${-n} ${-n === 1 ? 'día' : 'días'}` : `desde ${longDate(h.cleanSince)}`}</div>
                </div>
                <div className="font-serif text-[64px] leading-[0.85] tracking-tight tnum">{Math.max(0, n)}</div>
              </div>
              <button onClick={() => setTarget(h)} className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">Registrar recaída</button>
            </Card>
          )
        })}
      </div>

      <Sheet open={!!target} onClose={close}>
        {target && (
          <div className="pb-4">
            <Kicker color="var(--color-bad)">Recaída · {target.name}</Kicker>
            <p className="mt-2 text-[14px] leading-relaxed text-dim">Sin castigo. El contador vuelve a cero y queda el registro para aprender el patrón.</p>
            <div className="mt-4">
              <Kicker>Disparador</Kicker>
              <textarea rows={2} value={trigger} onChange={(e) => setTrigger(e.target.value)} className={field} placeholder="Qué pasó justo antes" />
            </div>
            <div className="mt-4">
              <Kicker>Qué hice</Kicker>
              <textarea rows={2} value={response} onChange={(e) => setResponse(e.target.value)} className={field} placeholder="Cómo respondí" />
            </div>
            <div className="mt-5 flex gap-2">
              <Btn kind="line" className="flex-1" onClick={close}>Cancelar</Btn>
              <Btn className="flex-1" onClick={save}>Registrar</Btn>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

/* ───────────── Entradas anteriores ───────────── */

function Past({ rows }: { rows: JournalRow[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!rows.length) return null
  return (
    <div>
      <Kicker>Entradas anteriores</Kicker>
      <div className="mt-2">
        {rows.map((r) => {
          const on = open === r.date
          return (
            <div key={r.date} className="border-b border-line">
              <button onClick={() => setOpen(on ? null : r.date)} className="flex w-full items-center justify-between py-3 text-left">
                <span className="font-mono text-[12px] text-dim">{longDate(r.date)}</span>
                <span className="flex items-center gap-3 font-mono text-[10.5px] text-faint tnum">
                  {r.mood ? <span>ánimo {r.mood}</span> : null}
                  {r.energy ? <span>energía {r.energy}</span> : null}
                  <span>{on ? '−' : '+'}</span>
                </span>
              </button>
              {on && (
                <div className="grid gap-3 pb-4">
                  <Block k="Hice bien" v={r.good} />
                  <Block k="Falló y por qué" v={r.bad} />
                  <Block k="Mañana distinto" v={r.tomorrow} />
                  <div className="font-mono text-[11px] text-faint tnum">
                    antojo {r.craving}{r.cravingWhat ? ` · ${r.cravingWhat}` : ''}{r.sleep !== undefined ? ` · sueño ${r.sleep} h` : ''}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Block({ k, v }: { k: string; v: string }) {
  if (!v.trim()) return null
  return (
    <div>
      <Kicker>{k}</Kicker>
      <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed">{v}</p>
    </div>
  )
}
