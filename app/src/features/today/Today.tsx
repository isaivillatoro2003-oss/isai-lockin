import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addWater, db, getSetting, now, setStatus, toggleWater, waterKey, type Status, type Water } from '../../db'
import { ARRIVAL, CAT_LABEL, TEMPLATES, currentBlock, defaultTemplate, waterGoal, type Block } from '../../domain/schedule'
import { computeStreak, dayPct } from '../../domain/streak'
import { addDays, clock, dur, fromMin, longDate, partnerHm, PARTNER_TZ, toMin } from '../../domain/time'
import { useClock } from '../../hooks'
import { CAT_COLOR, Kicker, Sheet } from '../../ui'
import type { Frase } from '../../content/frases'
import BlockDetail from './BlockDetail'
import { frase, markWakeSeen, wakeSeen } from '../../domain/frases'

const OPEN = 10 * 60, CLOSE = 18 * 60

function fasting(min: number) {
  if (min >= OPEN && min < CLOSE) return { open: true, label: `Ventana abierta`, sub: `cierra en ${dur(CLOSE - min)}` }
  const since = min >= CLOSE ? min - CLOSE : min + 1440 - CLOSE
  const until = min < OPEN ? OPEN - min : OPEN + 1440 - min
  return { open: false, label: `Ayuno ${dur(since)}`, sub: `abre en ${dur(until)}` }
}

function dayLabel(date: string) {
  const days = Math.round((Date.parse(date) - Date.parse(ARRIVAL)) / 864e5)
  if (days < 0) return `Faltan ${-days} días · modo prueba`
  return `Día ${days + 1} de lock-in`
}

export default function Today() {
  const c = useClock()
  const [date, setDate] = useState<string | null>(null)
  const day = date ?? c.date
  const isToday = day === c.date
  const nowMin = isToday ? c.min : -1

  const row = useLiveQuery(() => db.days.get(day), [day])
  const tplId = row?.templateId ?? defaultTemplate(day)
  const tpl = TEMPLATES[tplId]
  const logs = useLiveQuery(() => db.logs.where('date').equals(day).toArray(), [day]) ?? []
  const streak = useLiveQuery(computeStreak, [logs.length, logs.map((l) => l.status).join()]) ?? 0
  const status = useMemo(() => new Map(logs.map((l) => [l.blockId, l.status])), [logs])
  const water = useLiveQuery(() => getSetting<Water>(waterKey(day), { done: [], extra: 0 }), [day]) ?? { done: [], extra: 0 }

  const idx = isToday ? currentBlock(tpl.blocks, nowMin) : -1
  const cur = idx >= 0 ? tpl.blocks[idx] : null
  const next = tpl.blocks.find((b, i) => i > idx && !status.get(b.id))
  const [open, setOpen] = useState<Block | null>(null)
  const [pickTpl, setPickTpl] = useState(false)
  const pct = dayPct(tplId, logs)
  const fast = fasting(c.min)
  const beirut = clock(PARTNER_TZ)

  const mark = (b: Block, s: Status | null) => setStatus(day, b.id, s)

  /* Frase al despertar (primera apertura del día o bloque Despertar) y frase cuando vas tarde en bloques núcleo. */
  const [wakeDone, setWakeDone] = useState('')
  const wakeOk = wakeDone === c.date || wakeSeen(c.date)
  const late = isToday ? tpl.blocks.filter((b) => b.core && !status.get(b.id) && toMin(b.start) + b.dur <= nowMin) : []
  const push = late.length
    ? { kind: 'late' as const, f: frase(day, `late:${late[0].id}`) }
    : isToday && (!wakeOk || cur?.cat === 'despertar') ? { kind: 'wake' as const, f: frase(day, 'wake') } : null

  return (
    <div className="safe-t px-5 pb-32">
      {/* Cabecera */}
      <div className="mb-1 flex items-center justify-between">
        <Kicker>{longDate(day)}</Kicker>
        <button onClick={() => setPickTpl(true)} className="rounded-full border border-line px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">
          {tpl.name}
        </button>
      </div>
      <div className="flex items-end justify-between">
        <div className="font-serif text-[76px] leading-[0.9] tracking-tight tnum">{isToday ? c.hm : longDate(day).split(' ')[0]}</div>
        <div className="pb-2 text-right">
          <Kicker>Beirut</Kicker>
          <div className="font-mono text-[18px] text-dim tnum">{beirut.hm}</div>
        </div>
      </div>
      <div className="mt-1 mb-6 font-mono text-[11px] text-faint">{dayLabel(day)}</div>

      {push && (
        <Push kind={push.kind} f={push.f} late={late}
          onGo={() => { if (push.kind === 'late') setOpen(late[0]); else { markWakeSeen(c.date); setWakeDone(c.date) } }} />
      )}

      {/* Indicadores */}
      <div className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        <Stat k="Racha" v={String(streak)} unit={streak === 1 ? 'día' : 'días'} />
        <Stat k="Hoy" v={String(Math.round(pct * 100))} unit="%" bar={pct} />
        <Stat k={fast.open ? 'Comer' : 'Ayuno'} v={fast.label.replace(/^(Ayuno|Ventana abierta) ?/, '') || 'abierta'} unit={fast.sub} small />
      </div>

      <WaterBar day={day} blocks={tpl.blocks} water={water} />

      {/* Ahora */}
      {cur && (
        <NowCard b={cur} nowMin={nowMin} status={status.get(cur.id)} onMark={(s) => mark(cur, s)} onOpen={() => setOpen(cur)} />
      )}
      {next && isToday && (
        <button onClick={() => setOpen(next)} className="mb-8 flex w-full items-center justify-between rounded-2xl border border-line px-4 py-3 text-left">
          <div>
            <Kicker>Siguiente · {next.start}</Kicker>
            <div className="mt-0.5 text-[15px]">{next.title}</div>
          </div>
          <div className="font-mono text-[11px] text-faint">en {dur(Math.max(0, toMin(next.start) - nowMin))}</div>
        </button>
      )}

      {/* Navegación de días */}
      <div className="mb-3 flex items-center justify-between">
        <Kicker>El día</Kicker>
        <div className="flex items-center gap-1 font-mono text-[11px] text-dim">
          <button className="px-2 py-1" onClick={() => setDate(addDays(day, -1))}>←</button>
          {!isToday && <button className="px-2 py-1 text-sun" onClick={() => setDate(null)}>hoy</button>}
          <button className="px-2 py-1" onClick={() => setDate(addDays(day, 1))}>→</button>
        </div>
      </div>

      {/* Línea de tiempo */}
      <ol className="relative">
        {tpl.blocks.map((b, i) => {
          const s = status.get(b.id)
          const past = isToday && i < idx
          const live = i === idx
          return (
            <li key={b.id} className={`flex items-stretch gap-3 ${past && !s ? 'opacity-45' : ''}`}>
              <div className="w-11 shrink-0 pt-3 text-right font-mono text-[11px] text-dim tnum">{b.start}</div>
              <div className="relative flex w-3 justify-center">
                <div className="absolute inset-y-0 w-px bg-line" />
                <div className="relative mt-[17px] h-2 w-2 rounded-full" style={{ background: live ? CAT_COLOR[b.cat] : s ? CAT_COLOR[b.cat] : 'var(--color-line)', boxShadow: live ? `0 0 0 4px ${CAT_COLOR[b.cat]}33` : undefined }} />
              </div>
              <button onClick={() => setOpen(b)} className="min-w-0 flex-1 py-2.5 text-left">
                <div className={`truncate text-[15px] ${s === 'saltado' ? 'text-faint line-through' : ''} ${s === 'hecho' || s === 'minima' ? 'text-dim' : ''}`}>
                  {b.title}{b.core && <span className="ml-1.5 text-sun">·</span>}
                </div>
                <div className="font-mono text-[10.5px] text-faint">
                  {CAT_LABEL[b.cat]} · {dur(b.dur)}{b.cat === 'novia' && ` · ${partnerHm(b.start)} en Beirut`}{s === 'minima' && ' · mínima'}
                </div>
                {b.extras && <div className="mt-0.5 truncate text-[11.5px] text-faint">{b.extras.join(' · ')}</div>}
              </button>
              {b.water ? (
                <button onClick={() => toggleWater(day, b.id)} aria-label="agua"
                  className={`my-2 shrink-0 self-center rounded-full border px-2 py-1 font-mono text-[10px] tnum transition ${water.done.includes(b.id) ? 'border-blue bg-blue/20 text-blue' : 'border-line text-faint'}`}>
                  {b.water} ml
                </button>
              ) : null}
              <Check s={s} color={CAT_COLOR[b.cat]} onClick={() => mark(b, s ? null : 'hecho')} />
            </li>
          )
        })}
      </ol>
      <p className="mt-6 text-center font-mono text-[10.5px] text-faint">El punto ámbar marca lo que cuenta para la racha</p>

      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open && <BlockDetail b={open} date={day} status={status.get(open.id)} onMark={(s) => { mark(open, s); if (s) setOpen(null) }} onClose={() => setOpen(null)} />}
      </Sheet>

      <Sheet open={pickTpl} onClose={() => setPickTpl(false)}>
        <Kicker>Plantilla de este día</Kicker>
        <div className="mt-3 mb-4 grid gap-2">
          {Object.values(TEMPLATES).map((t) => (
            <button key={t.id} onClick={() => { db.days.put({ date: day, templateId: t.id, updatedAt: now() }); setPickTpl(false) }}
              className={`rounded-xl border px-4 py-3 text-left text-[15px] ${t.id === tplId ? 'border-paper' : 'border-line text-dim'}`}>
              {t.name}{t.id === defaultTemplate(day) && <span className="ml-2 font-mono text-[10px] text-faint">por defecto</span>}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}

function WaterBar({ day, blocks, water }: { day: string; blocks: Block[]; water: Water }) {
  const goal = waterGoal(blocks)
  const drunk = blocks.filter((b) => water.done.includes(b.id)).reduce((s, b) => s + (b.water ?? 0), 0) + water.extra
  const p = goal ? Math.min(1, drunk / goal) : 0
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-line px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-blue">Agua</span>
          <span className="font-mono text-[11px] text-dim tnum">{(drunk / 1000).toFixed(1)} de {(goal / 1000).toFixed(1)} L</span>
        </div>
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-blue transition-all duration-500" style={{ width: `${p * 100}%` }} />
        </div>
      </div>
      <button onClick={() => addWater(day, 250)} className="rounded-full border border-line px-3 py-1.5 font-mono text-[11px] text-dim">+250</button>
    </div>
  )
}

function Stat({ k, v, unit, bar, small }: { k: string; v: string; unit: string; bar?: number; small?: boolean }) {
  return (
    <div className="relative bg-raised px-3 py-3">
      <Kicker>{k}</Kicker>
      <div className={`mt-1 font-serif leading-none tnum ${small ? 'text-[26px]' : 'text-[34px]'}`}>{v}</div>
      <div className="mt-1 truncate font-mono text-[10px] text-faint">{unit}</div>
      {bar !== undefined && <div className="absolute inset-x-0 bottom-0 h-[2px] bg-sun transition-all" style={{ width: `${bar * 100}%` }} />}
    </div>
  )
}

function Check({ s, color, onClick }: { s?: Status; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="marcar" className="grid w-11 shrink-0 place-items-center">
      <span className="grid h-[26px] w-[26px] place-items-center rounded-full border transition"
        style={{ borderColor: s ? color : 'var(--color-line)', background: s === 'hecho' ? color : s === 'minima' ? `${color}55` : 'transparent' }}>
        {s === 'hecho' && <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="#0d0c0a" strokeWidth={3}><path d="m5 12 5 5 9-10" /></svg>}
        {s === 'saltado' && <span className="h-px w-3 bg-faint" />}
      </span>
    </button>
  )
}

function NowCard({ b, nowMin, status, onMark, onOpen }: { b: Block; nowMin: number; status?: Status; onMark: (s: Status | null) => void; onOpen: () => void }) {
  const start = toMin(b.start)
  const elapsed = Math.max(0, nowMin - start)
  const p = Math.min(1, elapsed / b.dur)
  const left = b.dur - elapsed
  const color = CAT_COLOR[b.cat]
  return (
    <div className="relative mb-3 overflow-hidden rounded-3xl border border-line bg-raised p-5">
      <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full opacity-20 blur-3xl" style={{ background: color }} />
      <div className="flex items-center justify-between">
        <Kicker color={color}>Ahora · {CAT_LABEL[b.cat]}</Kicker>
        <span className="font-mono text-[11px] text-dim tnum">{b.start} a {fromMin(start + b.dur)}</span>
      </div>
      <button onClick={onOpen} className="mt-2 block text-left font-serif text-[38px] leading-[1.02]">{b.title}</button>
      {b.detail && <p className="mt-2 text-[14px] leading-relaxed text-dim">{b.detail}</p>}
      <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${p * 100}%`, background: color }} />
      </div>
      <div className="mt-1.5 font-mono text-[10.5px] text-faint">{left > 0 ? `quedan ${dur(left)}` : 'tiempo cumplido'}</div>
      <div className="mt-4 flex gap-2">
        {status ? (
          <button onClick={() => onMark(null)} className="flex-1 rounded-full border border-line py-3 text-[15px] text-dim">
            {status === 'hecho' ? 'Hecho ✓' : status === 'minima' ? 'Versión mínima ✓' : 'Saltado'} · deshacer
          </button>
        ) : (
          <>
            <button onClick={() => onMark('hecho')} className="flex-1 rounded-full py-3 text-[15px] font-medium text-ink active:scale-[0.98] transition" style={{ background: color }}>Hecho</button>
            <button onClick={() => onMark('minima')} className="rounded-full border border-line px-4 py-3 text-[13px] text-dim">Mínima</button>
            {(b.link || b.guide) && <button onClick={onOpen} className="rounded-full border border-line px-4 py-3 text-[13px] text-dim">{b.link ? 'Abrir' : 'Cómo'}</button>}
          </>
        )}
      </div>
    </div>
  )
}

function Push({ kind, f, late, onGo }: { kind: 'wake' | 'late'; f: Frase; late: Block[]; onGo: () => void }) {
  const color = kind === 'late' ? 'var(--color-bad)' : 'var(--color-sun)'
  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl border p-5" style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}>
      <div className="pointer-events-none absolute -top-20 -left-16 h-52 w-52 rounded-full opacity-25 blur-3xl" style={{ background: color }} />
      <div className="pointer-events-none absolute -right-2 -bottom-16 font-serif text-[180px] leading-none opacity-[0.07]" style={{ color }}>”</div>
      <Kicker color={color}>{kind === 'late' ? `Vas tarde · ${late.length === 1 ? late[0].title : `${late.length} bloques`}` : 'Buenos días · arranca'}</Kicker>
      <p className="relative mt-3 font-serif text-[30px] italic leading-[1.08] tracking-tight">{f.t}</p>
      <div className="relative mt-4 flex items-center justify-between gap-3">
        <span className="truncate font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">{f.by === 'viral' ? 'viral' : f.by}</span>
        <button onClick={onGo} className="shrink-0 rounded-full px-4 py-2 text-[13px] font-medium text-ink active:scale-[0.97] transition" style={{ background: color }}>
          {kind === 'late' ? 'Recuperar' : 'Vamos'}
        </button>
      </div>
    </div>
  )
}
