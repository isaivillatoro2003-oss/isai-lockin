import { useLiveQuery } from 'dexie-react-hooks'
import { db, type LogRow } from '../../db'
import { ARRIVAL, defaultTemplate } from '../../domain/schedule'
import { dayComplete, dayPct } from '../../domain/streak'
import { addDays, clock } from '../../domain/time'
import { Kicker } from '../../ui'

/** 12 semanas del lock-in: cada cuadro es un día, más intenso cuanto más cumpliste. Borde ámbar = día completo. */
export default function ProgressGrid() {
  const today = clock().date
  const data = useLiveQuery(async () => {
    const [logs, days] = await Promise.all([db.logs.toArray(), db.days.toArray()])
    const byDate = new Map<string, LogRow[]>()
    for (const l of logs) byDate.set(l.date, [...(byDate.get(l.date) ?? []), l])
    const tpl = new Map(days.map((d) => [d.date, d.templateId]))
    return Array.from({ length: 84 }, (_, i) => {
      const date = addDays(ARRIVAL, i)
      const t = tpl.get(date) ?? defaultTemplate(date)
      const l = byDate.get(date) ?? []
      return { date, pct: dayPct(t, l), full: dayComplete(t, l) }
    })
  }, []) ?? []
  const done = data.filter((d) => d.full).length
  return (
    <div className="mb-8 rounded-2xl border border-line p-4">
      <div className="flex items-baseline justify-between">
        <Kicker>12 semanas</Kicker>
        <span className="font-mono text-[11px] text-dim tnum">{done} días completos</span>
      </div>
      <div className="mt-3 grid grid-cols-12 gap-1" style={{ gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 1fr)' }}>
        {data.map((d) => (
          <div key={d.date} title={d.date}
            className={`aspect-square rounded-[3px] ${d.date === today ? 'ring-1 ring-paper' : ''}`}
            style={{
              background: d.date > today ? 'var(--color-line)' : d.pct ? `rgba(233,166,64,${0.15 + d.pct * 0.85})` : '#2a2620aa',
              outline: d.full ? '1px solid #e9a640' : undefined,
            }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[9.5px] text-faint"><span>29 oct</span><span>cada columna es una semana</span></div>
    </div>
  )
}
