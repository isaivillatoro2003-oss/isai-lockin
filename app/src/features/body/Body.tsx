import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, now, uid, type MealRow, type MetricRow, type PhotoRow } from '../../db'
import { addDays, clock, longDate } from '../../domain/time'
import { useNav } from '../../hooks'
import { Btn, Card, Chips, Empty, Kicker, NumberInput, Screen, Sheet } from '../../ui'

type Sub = 'peso' | 'cintura' | 'fotos' | 'comidas'
const SUBS: Sub[] = ['peso', 'cintura', 'fotos', 'comidas']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const shortDate = (d: string) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]}`
const dayNum = (d: string) => Math.round(Date.parse(d + 'T12:00:00Z') / 864e5)

export default function Body() {
  const { nav } = useNav()
  const [sub, setSub] = useState<Sub>(() => (SUBS.includes(nav.sub as Sub) ? (nav.sub as Sub) : 'peso'))
  useEffect(() => { if (SUBS.includes(nav.sub as Sub)) setSub(nav.sub as Sub) }, [nav.sub])

  return (
    <Screen title="Cuerpo" kicker="Lo que se mide mejora">
      <Chips<Sub> value={sub} onChange={setSub} options={[
        { v: 'peso', l: 'Peso' }, { v: 'cintura', l: 'Cintura' }, { v: 'fotos', l: 'Fotos' }, { v: 'comidas', l: 'Comidas' },
      ]} />
      {sub === 'peso' && <MetricPanel type="peso" unit="kg" label="Peso" />}
      {sub === 'cintura' && <MetricPanel type="cintura" unit="cm" label="Cintura" />}
      {sub === 'fotos' && <Photos />}
      {sub === 'comidas' && <Meals />}
    </Screen>
  )
}

/* ───────────── Peso y cintura ───────────── */

interface Pt { date: string; x: number; v: number; ma: number }

function withAverage(rows: MetricRow[]): Pt[] {
  return rows.map((r) => {
    const x = dayNum(r.date)
    const win = rows.filter((o) => { const ox = dayNum(o.date); return ox <= x && ox > x - 7 })
    return { date: r.date, x, v: r.value, ma: win.reduce((s, o) => s + o.value, 0) / win.length }
  })
}

function MetricPanel({ type, unit, label }: { type: 'peso' | 'cintura'; unit: string; label: string }) {
  const rows = useLiveQuery(() => db.metrics.where('type').equals(type).sortBy('date'), [type]) ?? []
  const [val, setVal] = useState('')
  const today = clock().date
  const todayRow = rows.find((r) => r.date === today)
  const weekly = type === 'cintura'
  const pts = useMemo(() => withAverage(rows), [rows])

  const last = pts[pts.length - 1]
  const first = pts[0]
  const total = last && first ? last.v - first.v : 0
  const rate = useMemo(() => {
    if (pts.length < 2) return null
    const l = pts[pts.length - 1]
    const win = pts.filter((p) => p.x >= l.x - 7)
    const f = win[0]
    if (!f || l.x - f.x < 2) return null
    return ((l.ma - f.ma) / (l.x - f.x)) * 7
  }, [pts])

  const save = async () => {
    const n = parseFloat(val.replace(',', '.'))
    if (!isFinite(n) || n <= 0) return
    const id = todayRow?.id ?? uid()
    await db.metrics.put({ id, date: today, type, value: Math.round(n * 10) / 10, updatedAt: now() })
    setVal('')
  }
  const sign = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`

  return (
    <>
      <div className="mb-5">
        <Kicker>{label} actual</Kicker>
        <div className="flex items-end gap-2">
          <div className="font-serif text-[76px] leading-[0.9] tracking-tight tnum">{last ? last.v.toFixed(1) : '—'}</div>
          <div className="pb-2 font-mono text-[13px] text-dim">{unit}</div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
          <div className="bg-raised px-3 py-3">
            <Kicker>Desde el inicio</Kicker>
            <div className="mt-1 font-serif text-[30px] leading-none tnum">{pts.length > 1 ? sign(total) : '—'}<span className="ml-1 font-mono text-[11px] text-faint">{unit}</span></div>
          </div>
          <div className="bg-raised px-3 py-3">
            <Kicker>Última semana</Kicker>
            <div className="mt-1 font-serif text-[30px] leading-none tnum">{rate === null ? '—' : sign(rate)}<span className="ml-1 font-mono text-[11px] text-faint">{unit}/sem</span></div>
          </div>
        </div>
      </div>

      <Card className="mb-5">
        <Kicker>{todayRow ? `Hoy ${todayRow.value.toFixed(1)} ${unit} · reemplazar` : weekly ? 'Medida de esta semana' : 'Pésate en ayunas'}</Kicker>
        <div className="mt-2 flex items-center gap-3">
          <div className="min-w-0 flex-1"><NumberInput value={val} onChange={setVal} placeholder={unit} /></div>
          <Btn onClick={save} disabled={!val}>Guardar</Btn>
        </div>
        {weekly && <p className="mt-2 font-mono text-[10.5px] text-faint">Una vez por semana, mismo punto, mismo momento</p>}
      </Card>

      <Card className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <Kicker>Tendencia</Kicker>
          {!weekly && (
            <div className="flex items-center gap-3 font-mono text-[10px] text-faint">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-dim opacity-60" />diario</span>
              <span className="flex items-center gap-1"><span className="h-[2px] w-3 bg-sun" />media 7 d</span>
            </div>
          )}
        </div>
        {pts.length === 0 ? <Empty>Aún no hay registros</Empty> : <Chart pts={pts} average={!weekly} />}
      </Card>

      <Kicker>Últimos registros</Kicker>
      <div className="mt-2">
        {rows.length === 0 && <Empty>Nada todavía</Empty>}
        {[...rows].reverse().slice(0, 14).map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b border-line py-2.5">
            <span className="font-mono text-[12px] text-dim">{longDate(r.date)}</span>
            <span className="flex items-center gap-4">
              <span className="font-serif text-[22px] tnum">{r.value.toFixed(1)} <span className="font-mono text-[10.5px] text-faint">{unit}</span></span>
              <button onClick={() => db.metrics.delete(r.id)} className="font-mono text-[10.5px] uppercase tracking-wider text-faint">borrar</button>
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

function Chart({ pts, average }: { pts: Pt[]; average: boolean }) {
  const W = 340, H = 170, L = 34, R = 10, T = 10, B = 22
  const xs = pts.map((p) => p.x)
  const ys = pts.flatMap((p) => (average ? [p.v, p.ma] : [p.v]))
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  let y0 = Math.min(...ys), y1 = Math.max(...ys)
  if (y1 - y0 < 1) { const m = (y0 + y1) / 2; y0 = m - 0.5; y1 = m + 0.5 }
  const pad = (y1 - y0) * 0.12
  y0 -= pad; y1 += pad
  const sx = (x: number) => (x1 === x0 ? (L + W - R) / 2 : L + ((x - x0) / (x1 - x0)) * (W - L - R))
  const sy = (y: number) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B)
  const path = (f: (p: Pt) => number) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(f(p)).toFixed(1)}`).join(' ')
  const ticks = [y0 + pad, (y0 + y1) / 2, y1 - pad]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfica de tendencia">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} className="stroke-line" strokeWidth={1} />
          <text x={L - 6} y={sy(t) + 3} textAnchor="end" className="fill-faint font-mono" fontSize={10}>{t.toFixed(1)}</text>
        </g>
      ))}
      <text x={L} y={H - 6} textAnchor="start" className="fill-faint font-mono" fontSize={10}>{shortDate(pts[0].date)}</text>
      {pts.length > 1 && <text x={W - R} y={H - 6} textAnchor="end" className="fill-faint font-mono" fontSize={10}>{shortDate(pts[pts.length - 1].date)}</text>}
      {pts.length > 1 && <path d={path((p) => (average ? p.ma : p.v))} fill="none" className="stroke-sun" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {pts.map((p) => (
        average
          ? <circle key={p.date} cx={sx(p.x)} cy={sy(p.v)} r={2.2} className="fill-dim" opacity={0.5} />
          : <circle key={p.date} cx={sx(p.x)} cy={sy(p.v)} r={3} className="fill-sun" />
      ))}
      {average && pts.length === 1 && <circle cx={sx(pts[0].x)} cy={sy(pts[0].ma)} r={3.5} className="fill-sun" />}
    </svg>
  )
}

/* ───────────── Fotos ───────────── */

const POSES: { v: PhotoRow['pose']; l: string }[] = [
  { v: 'frente', l: 'Frente' }, { v: 'perfil', l: 'Perfil' }, { v: 'espalda', l: 'Espalda' }, { v: 'cara', l: 'Cara' },
]

async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 1080 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/webp', 0.82))
}

function useObjectUrls(photos: PhotoRow[]) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    const m: Record<string, string> = {}
    for (const p of photos) m[p.id] = URL.createObjectURL(p.blob)
    setUrls(m)
    return () => { Object.values(m).forEach((u) => URL.revokeObjectURL(u)) }
  }, [photos])
  return urls
}

function Photos() {
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), []) ?? []
  const urls = useObjectUrls(photos)
  const [pose, setPose] = useState<PhotoRow['pose']>('frente')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [view, setView] = useState<PhotoRow | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const onFile = async (f?: File) => {
    if (!f) return
    setBusy(true); setErr('')
    try {
      const blob = await compress(f)
      await db.photos.put({ id: uid(), date: clock().date, pose, blob, updatedAt: now() })
    } catch { setErr('No pude procesar esa foto') }
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  const ofPose = photos.filter((p) => p.pose === pose)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [pos, setPos] = useState(50)
  const aId = ofPose.some((p) => p.id === a) ? a : ofPose[ofPose.length - 1]?.id ?? ''
  const bId = ofPose.some((p) => p.id === b) ? b : ofPose[0]?.id ?? ''
  const before = ofPose.find((p) => p.id === aId)
  const after = ofPose.find((p) => p.id === bId)

  return (
    <>
      <Card className="mb-5">
        <Kicker>Nueva foto</Kicker>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {POSES.map((p) => (
            <button key={p.v} onClick={() => setPose(p.v)}
              className={`rounded-full py-2 text-[13px] transition ${pose === p.v ? 'bg-paper text-ink' : 'border border-line text-dim'}`}>{p.l}</button>
          ))}
        </div>
        <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Btn className="mt-3 w-full" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Procesando…' : `Tomar foto de ${pose}`}</Btn>
        {err && <p className="mt-2 font-mono text-[11px] text-bad">{err}</p>}
        <p className="mt-2 font-mono text-[10.5px] text-faint">Misma luz, misma distancia, misma hora</p>
      </Card>

      <Kicker>Comparador · {pose}</Kicker>
      {ofPose.length < 2 ? (
        <Empty>Hacen falta dos fotos de {pose} para comparar</Empty>
      ) : (
        <div className="mt-2 mb-6">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <PhotoSelect label="Antes" value={aId} onChange={setA} list={ofPose} />
            <PhotoSelect label="Después" value={bId} onChange={setB} list={ofPose} />
          </div>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-line bg-raised">
            {before && urls[before.id] && <img src={urls[before.id]} alt="antes" className="absolute inset-0 h-full w-full object-cover" />}
            {after && urls[after.id] && (
              <img src={urls[after.id]} alt="después" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
            )}
            <div className="pointer-events-none absolute inset-y-0 w-px bg-paper/80" style={{ left: `${pos}%` }} />
            <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-2 py-0.5 font-mono text-[10px] text-paper">{after ? shortDate(after.date) : ''}</span>
            <span className="absolute right-3 top-3 rounded-full bg-ink/70 px-2 py-0.5 font-mono text-[10px] text-paper">{before ? shortDate(before.date) : ''}</span>
          </div>
          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)} className="mt-3 w-full accent-[#e9a640]" aria-label="Deslizador antes y después" />
        </div>
      )}

      <Kicker>Galería</Kicker>
      {photos.length === 0 ? <Empty>Sin fotos todavía</Empty> : (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button key={p.id} onClick={() => setView(p)} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-raised">
              {urls[p.id] && <img src={urls[p.id]} alt={`${p.pose} ${p.date}`} className="h-full w-full object-cover" />}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent px-2 pb-1 pt-4 text-left font-mono text-[9.5px] text-paper">{shortDate(p.date)} · {p.pose}</span>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!view} onClose={() => setView(null)}>
        {view && (
          <div className="pb-4">
            <Kicker>{longDate(view.date)} · {view.pose}</Kicker>
            {urls[view.id] && <img src={urls[view.id]} alt={view.pose} className="mt-3 max-h-[60vh] w-full rounded-xl object-contain" />}
            <div className="mt-4 flex gap-2">
              <Btn kind="line" className="flex-1" onClick={() => setView(null)}>Cerrar</Btn>
              <Btn kind="ghost" className="text-bad" onClick={async () => { await db.photos.delete(view.id); setView(null) }}>Borrar</Btn>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}

function PhotoSelect({ label, value, onChange, list }: { label: string; value: string; onChange: (v: string) => void; list: PhotoRow[] }) {
  return (
    <label className="block">
      <Kicker>{label}</Kicker>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 font-mono text-[12px] outline-none">
        {list.map((p) => <option key={p.id} value={p.id}>{shortDate(p.date)}</option>)}
      </select>
    </label>
  )
}

/* ───────────── Comidas ───────────── */

const SLOTS: { slot: 1 | 2 | 3 | 4; name: string; time: string }[] = [
  { slot: 1, name: 'Comida 1', time: '10:00' },
  { slot: 2, name: 'Comida 2', time: '14:00' },
  { slot: 3, name: 'Comida 3', time: '17:05' },
  { slot: 4, name: 'Extra', time: '' },
]
const TAGS = ['proteína', 'verdura', 'carbo', 'grasa', 'fuera de plan']

function Meals() {
  const [date, setDate] = useState<string | null>(null)
  const c = clock()
  const day = date ?? c.date
  const isToday = day === c.date
  const rows = useLiveQuery(async () => ({ list: await db.meals.where('date').equals(day).toArray() }), [day])

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Kicker>{longDate(day)}</Kicker>
        <div className="flex items-center gap-1 font-mono text-[11px] text-dim">
          <button className="px-2 py-1" onClick={() => setDate(addDays(day, -1))}>←</button>
          {!isToday && <button className="px-2 py-1 text-sun" onClick={() => setDate(null)}>hoy</button>}
          <button className="px-2 py-1" onClick={() => setDate(addDays(day, 1))}>→</button>
        </div>
      </div>
      {rows && (
        <div className="grid gap-3">
          {SLOTS.map((s) => <MealCard key={`${day}|${s.slot}`} day={day} def={s} row={rows.list.find((r) => r.slot === s.slot)} />)}
        </div>
      )}
      <p className="mt-6 text-center font-mono text-[10.5px] text-faint">Ventana de comida: 10:00 a 18:00</p>
    </>
  )
}

function MealCard({ day, def, row }: { day: string; def: (typeof SLOTS)[number]; row?: MealRow }) {
  const [text, setText] = useState(row?.text ?? '')
  const [tags, setTags] = useState<string[]>(row?.tags ?? [])
  const [rating, setRating] = useState<1 | 2 | 3 | undefined>(row?.rating)
  const [state, setState] = useState<'' | 'guardado' | 'fuera'>('')

  const save = async () => {
    const empty = !text.trim() && tags.length === 0 && !rating
    if (empty) {
      if (row) await db.meals.delete(row.id)
      setState('')
      return
    }
    const min = clock().min
    const out = min < 10 * 60 || min >= 18 * 60
    const rec: MealRow = {
      id: row?.id ?? uid(), date: day, slot: def.slot, time: row?.time ?? (def.time || clock().hm),
      text: text.trim(), tags, updatedAt: now(),
      ...(rating ? { rating } : {}),
    }
    await db.meals.put(rec)
    setState(out ? 'fuera' : 'guardado')
  }
  const toggle = (t: string) => { setTags((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t])); setState('') }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Kicker>{def.name}</Kicker>
        <span className="font-mono text-[11px] text-dim tnum">{def.time || row?.time || ''}</span>
      </div>
      <input value={text} onChange={(e) => { setText(e.target.value); setState('') }} placeholder="Qué comiste"
        className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2.5 text-[15px] outline-none placeholder:text-faint focus:border-dim" />
      <div className="mt-3 flex flex-wrap gap-2">
        {TAGS.map((t) => {
          const on = tags.includes(t)
          const bad = t === 'fuera de plan'
          return (
            <button key={t} onClick={() => toggle(t)}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${on ? (bad ? 'border-bad text-bad' : 'border-sun text-sun') : 'border-line text-dim'}`}>{t}</button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Kicker>Califica</Kicker>
          {([1, 2, 3] as const).map((n) => (
            <button key={n} onClick={() => { setRating(rating === n ? undefined : n); setState('') }}
              className={`grid h-8 w-8 place-items-center rounded-full border font-serif text-[17px] tnum transition ${rating === n ? 'border-sun bg-sun text-ink' : 'border-line text-dim'}`}>{n}</button>
          ))}
        </div>
        <Btn kind="line" className="!px-4 !py-2 !text-[13px]" onClick={save}>Guardar</Btn>
      </div>
      {state === 'guardado' && <p className="mt-2 font-mono text-[10.5px] text-faint">guardado</p>}
      {state === 'fuera' && <p className="mt-2 font-mono text-[10.5px] text-bad">guardado · fuera de la ventana</p>}
    </Card>
  )
}
