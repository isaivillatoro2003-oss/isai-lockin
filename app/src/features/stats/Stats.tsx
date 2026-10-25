import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { AREAS, dayStats, verdict, weekStats, type Area, type DayStats } from '../../domain/stats'
import { computeStreak } from '../../domain/streak'
import { clock, dur, longDate, toMin, weekday } from '../../domain/time'
import { Card, Chips, Kicker, Screen } from '../../ui'

const pctTxt = (x: number) => `${Math.round(x * 100)} %`
const DAY = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

/** Se recalcula con cada cambio en bloques, agua, tarjetas o peso: estadísticas en tiempo real. */
function useLive<T>(fn: () => Promise<T>, deps: unknown[]) {
  const tick = useLiveQuery(async () => {
    const [l, r, m, s] = await Promise.all([db.logs.count(), db.reviews.count(), db.metrics.count(), db.settings.toArray()])
    return `${l}|${r}|${m}|${s.reduce((a, x) => Math.max(a, x.updatedAt), 0)}|${(await db.logs.toArray()).reduce((a, x) => Math.max(a, x.updatedAt), 0)}`
  }, [])
  return useLiveQuery(fn, [tick, ...deps])
}

export default function Stats() {
  const [view, setView] = useState<'hoy' | 'semana'>('hoy')
  const { date } = clock()
  return (
    <Screen title="Estadísticas" kicker={longDate(date)}>
      <Chips value={view} onChange={setView} options={[{ v: 'hoy', l: 'Hoy en vivo' }, { v: 'semana', l: 'Últimos 7 días' }]} />
      {view === 'hoy' ? <Today date={date} /> : <Week date={date} />}
    </Screen>
  )
}

/* ---------- Hoy ---------- */

function Today({ date }: { date: string }) {
  const s = useLive(() => dayStats(date), [date])
  const streak = useLive(computeStreak, []) ?? 0
  if (!s) return null
  const { min } = clock()
  const closing = min >= toMin('20:00')
  return (
    <div className="space-y-5">
      <Hero s={s} streak={streak} />
      {closing && <DayReport s={s} />}
      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <Kicker>Por área</Kicker>
          <span className="font-mono text-[10.5px] text-faint">toca una barra</span>
        </div>
        <AreaBars values={s.areas} />
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Tile k="Idiomas" v={dur(s.langMin.ar + s.langMin.fr)} sub={`árabe ${Math.round(s.langMin.ar)} · francés ${Math.round(s.langMin.fr)} min`} />
        <Tile k="Tarjetas" v={String(s.cards)} sub="repasadas hoy" />
        <Tile k="Agua" v={`${s.waterL.toFixed(1)} L`} sub={`de ${s.waterGoalL.toFixed(1)} L`} bar={s.waterGoalL ? s.waterL / s.waterGoalL : 0} />
        <Tile k="Peso" v={s.weight ? `${s.weight.toFixed(1)}` : '—'} sub={s.weight ? 'kg hoy' : 'sin registrar hoy'} />
      </div>
      {!closing && <p className="text-center font-mono text-[10.5px] text-faint">A las 20:00 aparece tu reporte del día</p>}
    </div>
  )
}

function Hero({ s, streak }: { s: DayStats; streak: number }) {
  const r = 52, c = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-5 rounded-3xl border border-line bg-raised p-5">
      <svg viewBox="0 0 120 120" className="h-[118px] w-[118px] shrink-0 -rotate-90" role="img" aria-label={`Día cumplido al ${pctTxt(s.pct)}`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-line)" strokeWidth="8" />
        {s.pct > 0 && <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-paper)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${s.pct * c} ${c}`} className="transition-all duration-700" />}
      </svg>
      <div>
        <Kicker>Día cumplido</Kicker>
        <div className="font-serif text-[56px] leading-none tnum">{Math.round(s.pct * 100)}<span className="text-[28px] text-dim"> %</span></div>
        <div className="mt-2 font-mono text-[11px] text-dim tnum">núcleo {s.core.done}/{s.core.total} · racha {streak}</div>
      </div>
    </div>
  )
}

function DayReport({ s }: { s: DayStats }) {
  const ranked = AREAS.filter((a) => s.areas[a.id].total).sort((a, b) => s.areas[b.id].pct - s.areas[a.id].pct)
  const best = ranked[0], worst = ranked[ranked.length - 1]
  return (
    <div className="rounded-3xl border border-sun/40 p-5">
      <Kicker color="#e9a640">Reporte del día</Kicker>
      <div className="mt-2 font-serif text-[34px] leading-tight">{verdict(s.pct)}</div>
      <ul className="mt-3 space-y-1.5 text-[14px] leading-relaxed">
        {best && <li>Lo mejor: <b className="font-medium">{best.label}</b> al {pctTxt(s.areas[best.id].pct)}.</li>}
        {worst && worst !== best && <li>A mejorar mañana: <b className="font-medium">{worst.label}</b> al {pctTxt(s.areas[worst.id].pct)}.</li>}
        <li>Idiomas: {dur(s.langMin.ar + s.langMin.fr)}, {s.cards} tarjetas, {s.waterL.toFixed(1)} L de agua.</li>
      </ul>
      {s.missedCore.length > 0 && (
        <div className="mt-3">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-faint">Faltó de lo clave</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{s.missedCore.map((b) => <span key={b.id} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-dim">{b.title}</span>)}</div>
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-faint">Escribe en el Diario qué falló y qué harás distinto.</p>
    </div>
  )
}

/** Barras horizontales por área: color = identidad del área; el texto va en tinta, no en el color. */
function AreaBars({ values, compare }: { values: Record<Area, { done: number; total: number; pct: number }> | Record<Area, number>; compare?: Record<Area, number> }) {
  const [sel, setSel] = useState<Area | null>(null)
  return (
    <div className="space-y-2.5">
      {AREAS.map((a) => {
        const v = values[a.id]
        const pct = typeof v === 'number' ? v : v.pct
        const detail = typeof v === 'number' ? null : v
        if (detail && !detail.total) return null
        const delta = compare ? pct - compare[a.id] : null
        return (
          <button key={a.id} onClick={() => setSel(sel === a.id ? null : a.id)} className="block w-full text-left">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: a.color }} />{a.label}</span>
              <span className="font-mono text-[11.5px] tnum">
                {pctTxt(pct)}
                {delta !== null && Math.abs(delta) >= 0.005 && <span className="ml-1.5 text-faint">{delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}</span>}
              </span>
            </div>
            <div className="mt-1 h-[10px] overflow-hidden rounded-[4px] bg-line">
              <div className="h-full rounded-[4px] transition-all duration-700" style={{ width: `${Math.max(pct * 100, pct ? 2 : 0)}%`, background: a.color }} />
            </div>
            {sel === a.id && (
              <div className="mt-1 font-mono text-[10.5px] text-dim">
                {detail ? `${detail.done % 1 ? detail.done.toFixed(1) : detail.done} de ${detail.total} bloques` : `promedio de 7 días`}
                {compare && ` · semana pasada ${pctTxt(compare[a.id])}`}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Tile({ k, v, sub, bar, delta, unit = '' }: { k: string; v: string; sub: string; bar?: number; delta?: number; unit?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-raised px-4 py-3">
      <Kicker>{k}</Kicker>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-serif text-[32px] leading-none tnum">{v}</span>
        {delta !== undefined && Number.isFinite(delta) && Math.round(delta) !== 0 && (
          <span className="font-mono text-[11px] text-dim">{delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))}{unit}</span>
        )}
      </div>
      <div className="mt-1 truncate font-mono text-[10px] text-faint">{sub}</div>
      {bar !== undefined && <div className="absolute inset-x-0 bottom-0 h-[3px] bg-blue transition-all" style={{ width: `${Math.min(1, bar) * 100}%` }} />}
    </div>
  )
}

/* ---------- Semana ---------- */

function Week({ date }: { date: string }) {
  const w = useLive(() => weekStats(date), [date])
  if (!w) return null
  const dPct = (w.avgPct - w.prevAvgPct) * 100
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Tile k="Promedio" v={pctTxt(w.avgPct)} sub={`semana pasada ${pctTxt(w.prevAvgPct)}`} delta={dPct} unit=" pts" />
        <Tile k="Días completos" v={`${w.fullDays}/7`} sub="todo lo clave hecho" />
        <Tile k="Idiomas" v={dur(w.langMin)} sub={`semana pasada ${dur(w.prevLangMin)}`} delta={(w.langMin - w.prevLangMin) / 60} unit=" h" />
        <Tile k="Tarjetas" v={String(w.cards)} sub={`semana pasada ${w.prevCards}`} delta={w.cards - w.prevCards} />
      </div>
      {w.weightDelta !== undefined && (
        <p className="rounded-2xl border border-line px-4 py-3 text-[14px]">
          Peso en estos 7 días: <b className="font-medium tnum">{w.weightDelta > 0 ? '+' : ''}{w.weightDelta.toFixed(1)} kg</b>
        </p>
      )}
      <Card>
        <Kicker>Cumplimiento por día</Kicker>
        <DayColumns days={w.days} avg={w.avgPct} />
      </Card>
      <Card>
        <Kicker>Minutos de idiomas</Kicker>
        <LangColumns days={w.days} />
      </Card>
      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <Kicker>Promedio por área</Kicker>
          <span className="font-mono text-[10.5px] text-faint">▲▼ vs semana pasada</span>
        </div>
        <AreaBars values={w.areaAvg} compare={w.prevAreaAvg} />
      </Card>
    </div>
  )
}

const W = 320, H = 150, PAD_B = 22, PAD_T = 18

function DayColumns({ days, avg }: { days: DayStats[]; avg: number }) {
  const [sel, setSel] = useState<number | null>(null)
  const bw = W / days.length
  const h = (p: number) => p * (H - PAD_B - PAD_T)
  const today = clock().date
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Cumplimiento de los últimos 7 días">
      {days.map((d, i) => {
        const x = i * bw + 5, wdt = bw - 10, y = H - PAD_B - h(d.pct)
        return (
          <g key={d.date} onClick={() => setSel(sel === i ? null : i)} className="cursor-pointer">
            <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
            <rect x={x} y={H - PAD_B - h(1)} width={wdt} height={h(1)} rx={4} fill="var(--color-line)" opacity={0.45} />
            {d.pct > 0 && <path d={roundTop(x, y, wdt, h(d.pct))} fill="var(--color-paper)" opacity={d.date === today ? 1 : 0.78} />}
            <text x={x + wdt / 2} y={H - 6} textAnchor="middle" className="fill-[var(--color-dim)] font-mono text-[10px]">{DAY[weekday(d.date)]}</text>
            {(sel === i || (sel === null && d.date === today)) && (
              <text x={x + wdt / 2} y={Math.max(11, y - 5)} textAnchor="middle" className="fill-[var(--color-paper)] font-mono text-[10px]">{Math.round(d.pct * 100)}%</text>
            )}
          </g>
        )
      })}
      <line x1={0} x2={W} y1={H - PAD_B - h(avg)} y2={H - PAD_B - h(avg)} stroke="var(--color-sun)" strokeWidth={1.5} strokeDasharray="4 4" />
      <text x={W - 2} y={H - PAD_B - h(avg) - 4} textAnchor="end" className="fill-[var(--color-dim)] font-mono text-[9.5px]">promedio {Math.round(avg * 100)}%</text>
    </svg>
  )
}

function LangColumns({ days }: { days: DayStats[] }) {
  const [sel, setSel] = useState<number | null>(null)
  const max = Math.max(60, ...days.map((d) => d.langMin.ar + d.langMin.fr))
  const bw = W / days.length
  const h = (m: number) => (m / max) * (H - PAD_B - PAD_T)
  const ar = AREAS.find((a) => a.id === 'ar')!.color, fr = AREAS.find((a) => a.id === 'fr')!.color
  return (
    <>
      <div className="mt-2 flex gap-4 text-[12px] text-dim">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ar }} />Árabe</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: fr }} />Francés</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Minutos de árabe y francés por día">
        {days.map((d, i) => {
          const x = i * bw + 5, wdt = bw - 10
          const ha = h(d.langMin.ar), hf = h(d.langMin.fr)
          const base = H - PAD_B
          return (
            <g key={d.date} onClick={() => setSel(sel === i ? null : i)} className="cursor-pointer">
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              {ha > 0 && <path d={hf > 0 ? sq(x, base - ha, wdt, ha) : roundTop(x, base - ha, wdt, ha)} fill={ar} />}
              {hf > 0 && <path d={roundTop(x, base - ha - hf - (ha > 0 ? 2 : 0), wdt, hf)} fill={fr} />}
              <text x={x + wdt / 2} y={H - 6} textAnchor="middle" className="fill-[var(--color-dim)] font-mono text-[10px]">{DAY[weekday(d.date)]}</text>
              {sel === i && (
                <text x={x + wdt / 2} y={Math.max(11, base - ha - hf - 6)} textAnchor="middle" className="fill-[var(--color-paper)] font-mono text-[9.5px]">
                  {Math.round(d.langMin.ar)}+{Math.round(d.langMin.fr)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <p className="font-mono text-[10px] text-faint">Toca un día para ver árabe + francés en minutos.</p>
    </>
  )
}

/** Barra con esquinas de 4 px solo arriba, anclada a la base. */
function roundTop(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}
const sq = (x: number, y: number, w: number, h: number) => `M${x},${y + h}V${y}H${x + w}V${y + h}Z`
