import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { bloques, entreno, guia } from '../../content'
import { EQUIPOS, SessionView, useEquipo } from '../training/Training'
import Recipes from './Recipes'
import { lastSyncAt, setSyncKey, syncKey, syncNow } from '../../sync'
import { buildIcs } from '../../domain/ics'
import type { Grade as G } from '../../content/types'
import { db, getSetting, requestPersist, setSetting } from '../../db'
import { Btn, Card, Chips, Grade, Kicker, Screen } from '../../ui'

type View = 'tips' | 'comida' | 'entreno' | 'glow' | 'adicciones' | 'salud' | 'glosario' | 'compras' | 'datos'

function Glossary() {
  const [q, setQ] = useState('')
  const items = [...bloques.glosario].sort((a, b) => a.term.localeCompare(b.term, 'es'))
    .filter((x) => !q || `${x.term} ${x.def}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: NSDR, Anki, zona 2..."
        className="mb-4 w-full rounded-xl border border-line bg-ink px-4 py-3 text-[15px] outline-none placeholder:text-faint" />
      <dl className="divide-y divide-line">
        {items.map((x) => (
          <div key={x.term} className="py-3">
            <dt className="font-serif text-[21px] leading-tight">{x.term}</dt>
            <dd className="mt-1 text-[14px] leading-relaxed text-dim">{x.def}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Shopping() {
  const got = new Set(useLiveQuery(() => getSetting<string[]>('compras', []), []) ?? [])
  const toggle = (k: string) => {
    const n = new Set(got); n.has(k) ? n.delete(k) : n.add(k)
    setSetting('compras', [...n])
  }
  const label = { 1: 'Imprescindible', 2: 'Útil', 3: 'Opcional' }
  return (
    <div className="space-y-8">
      {([1, 2, 3] as const).map((p) => (
        <section key={p}>
          <Kicker>{label[p]}</Kicker>
          <ul className="mt-2 divide-y divide-line">
            {bloques.compras.filter((c) => c.prioridad === p).map((c) => (
              <li key={c.item} onClick={() => toggle(c.item)} className={`flex cursor-pointer gap-3 py-3 ${got.has(c.item) ? 'opacity-40' : ''}`}>
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[11px] ${got.has(c.item) ? 'border-sun bg-sun text-ink' : 'border-line'}`}>{got.has(c.item) && '✓'}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="text-[15px]">{c.item}</span><Grade g={c.grade} /></div>
                  <div className="mt-0.5 text-[13px] leading-relaxed text-dim">{c.why}</div>
                  <div className="text-[12px] text-faint">{c.donde}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

const AREAS: Record<string, string> = {
  cuerpo: 'Cuerpo', desinflamar: 'Desinflamar', cara: 'Cara', piel: 'Piel', cabello: 'Cabello', barba: 'Barba',
  dientes: 'Dientes', manana: 'Mañana', sueno: 'Sueño', jetlag: 'Jet lag', adicciones: 'Adicciones',
  estilo: 'Estilo', postura: 'Postura', idiomas: 'Idiomas',
}

export default function Guide() {
  const [view, setView] = useState<View>('tips')
  return (
    <Screen title="Guía" kicker="Todo lo investigado">
      <Chips value={view} onChange={setView} options={[
        { v: 'tips', l: 'Tips' }, { v: 'comida', l: 'Comida' }, { v: 'entreno', l: 'Entreno' }, { v: 'glow', l: 'Glow up' },
        { v: 'adicciones', l: 'Adicciones' }, { v: 'salud', l: 'Salud' }, { v: 'glosario', l: 'Glosario' },
        { v: 'compras', l: 'Compras' }, { v: 'datos', l: 'Datos' },
      ]} />
      {view === 'tips' && <Tips />}
      {view === 'glosario' && <Glossary />}
      {view === 'compras' && <Shopping />}
      {view === 'comida' && <Food />}
      {view === 'entreno' && <Training />}
      {view === 'glow' && <Glow />}
      {view === 'adicciones' && <Addictions />}
      {view === 'salud' && <Health />}
      {view === 'datos' && <Data />}
    </Screen>
  )
}

function List({ items }: { items: string[] }) {
  return <ul className="mt-2 divide-y divide-line">{items.map((x, i) => <li key={i} className="py-2.5 text-[14.5px] leading-relaxed">{x}</li>)}</ul>
}

function Tips() {
  const [area, setArea] = useState('todo')
  const [grades, setGrades] = useState<Set<G>>(new Set(['A', 'B', 'C', 'D']))
  const tips = guia.tips.filter((t) => (area === 'todo' || t.area === area) && grades.has(t.grade))
  const areas = ['todo', ...Object.keys(AREAS).filter((a) => guia.tips.some((t) => t.area === a))]
  return (
    <div>
      <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
        {areas.map((a) => (
          <button key={a} onClick={() => setArea(a)} className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] ${area === a ? 'bg-raised text-paper border border-dim' : 'border border-line text-faint'}`}>
            {a === 'todo' ? 'Todo' : AREAS[a]}
          </button>
        ))}
      </div>
      <div className="mb-5 flex gap-3">
        {(['A', 'B', 'C', 'D'] as G[]).map((g) => (
          <button key={g} onClick={() => setGrades((s) => { const n = new Set(s); n.has(g) ? n.delete(g) : n.add(g); return n })} className={grades.has(g) ? '' : 'opacity-25'}>
            <Grade g={g} />
          </button>
        ))}
      </div>
      <div className="mb-3 font-mono text-[10.5px] text-faint">{tips.length} tips · D = no lo hagas, ahí dice qué hacer en su lugar</div>
      <div className="grid gap-2">
        {tips.map((t, i) => (
          <Card key={i} className={t.grade === 'D' ? 'border-bad/40' : ''}>
            <div className="mb-1.5 flex items-center justify-between gap-2"><Grade g={t.grade} /><span className="font-mono text-[10px] text-faint">{AREAS[t.area] ?? t.area}</span></div>
            <div className="text-[15.5px] leading-snug">{t.title}</div>
            <p className="mt-1 text-[13.5px] leading-relaxed text-dim">{t.text}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Food() {
  const m = guia.macros
  const [meal, setMeal] = useState(Object.keys(guia.menus)[0])
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-line bg-line">
        {[['kcal', m.kcal], ['proteína', `${m.proteinG} g`], ['grasa', `${m.grasaG} g`], ['carbos', `${m.carbosG} g`]].map(([k, v]) => (
          <div key={k} className="bg-raised px-2 py-3 text-center"><div className="font-serif text-[24px] leading-none tnum">{v}</div><div className="mt-1 font-mono text-[9.5px] uppercase tracking-wider text-faint">{k}</div></div>
        ))}
      </div>
      <p className="text-[14.5px] leading-relaxed text-dim">{guia.estrategia}</p>
      <section><Kicker>Recetas de TikTok y Reels</Kicker><div className="mt-3"><Recipes /></div></section>
      <section>
        <Kicker>Menús</Kicker>
        <div className="mt-2 mb-3 flex gap-2">
          {Object.keys(guia.menus).map((k) => <button key={k} onClick={() => setMeal(k)} className={`rounded-full px-3 py-1.5 text-[12.5px] capitalize ${meal === k ? 'bg-paper text-ink' : 'border border-line text-dim'}`}>{k}</button>)}
        </div>
        <div className="grid gap-2">
          {guia.menus[meal].map((x, i) => (
            <Card key={i}>
              <div className="flex items-baseline justify-between gap-2"><div className="text-[15.5px]">{x.name}</div>{x.kcal ? <div className="shrink-0 font-mono text-[11px] text-faint">{x.kcal} kcal · {x.proteinG} g</div> : null}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-dim">{x.items}</p>
              {x.seVe && <p className="mt-2 text-[12.5px] italic leading-relaxed text-faint">{x.seVe}</p>}
              {x.pasos && x.pasos.length > 0 && (
                <ol className="mt-2 space-y-1.5 border-t border-line pt-2">{x.pasos.map((p, j) => <li key={j} className="flex gap-2 text-[13px] leading-relaxed"><span className="text-sun">{j + 1}</span>{p}</li>)}</ol>
              )}
            </Card>
          ))}
        </div>
      </section>
      <section><Kicker>Llenarte con pocas calorías</Kicker><List items={guia.saciedad} /></section>
      <section>
        <Kicker>Lista de súper</Kicker>
        {guia.super.map((s) => (
          <div key={s.cat} className="mt-4">
            <div className="mb-1 text-[13px] text-sun">{s.cat}</div>
            <div className="flex flex-wrap gap-1.5">{s.items.map((x) => <span key={x} className="rounded-lg border border-line px-2.5 py-1 text-[13px]">{x}</span>)}</div>
          </div>
        ))}
      </section>
      <section><Kicker>Evitar</Kicker><List items={guia.evitar} /></section>
      <section>
        <Kicker>Suplementos</Kicker>
        <div className="mt-2 grid gap-2">
          {guia.suplementos.map((s, i) => (
            <Card key={i} className="!py-3"><div className="flex items-center justify-between"><span className="text-[15px]">{s.name}</span><Grade g={s.grade} /></div><div className="mt-1 text-[13px] text-dim">{s.dose} · {s.when}</div></Card>
          ))}
        </div>
      </section>
    </div>
  )
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function Training() {
  const [eq, setEq] = useEquipo()
  const [open, setOpen] = useState<string | null>(null)
  const prog = entreno.programas[eq]
  return (
    <div className="space-y-8">
      <div className="flex rounded-full border border-line p-1">
        {EQUIPOS.map((e) => (
          <button key={e.v} onClick={() => setEq(e.v)} className={`flex-1 rounded-full py-2 text-[13px] ${eq === e.v ? 'bg-paper text-ink' : 'text-dim'}`}>{e.l}</button>
        ))}
      </div>
      <p className="-mt-5 text-[12.5px] text-faint">Lo que elijas aquí es lo que te muestra el bloque de Entrenamiento cada mañana.</p>
      {prog?.fases.map((f) => (
        <section key={f.weeks}>
          <Kicker>Semanas {f.weeks}</Kicker>
          <p className="mt-1 mb-3 text-[13.5px] leading-relaxed text-dim">{f.nota}</p>
          <div className="divide-y divide-line rounded-2xl border border-line">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const ses = f.dias[String(d)]
              if (!ses) return null
              const k = `${f.weeks}-${d}`
              return (
                <div key={k}>
                  <button onClick={() => setOpen(open === k ? null : k)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                    <div><div className="font-mono text-[10.5px] uppercase tracking-wider text-faint">{DAYS[d]}</div><div className="text-[15px]">{ses.title}</div></div>
                    <span className="text-faint">{open === k ? '−' : '+'}</span>
                  </button>
                  {open === k && <div className="px-4 pb-4"><SessionView sesion={ses} /></div>}
                </div>
              )
            })}
          </div>
        </section>
      ))}
      <section>
        <Kicker>Progresión del plan</Kicker>
        <ol className="mt-2 divide-y divide-line">
          {guia.progresion.map((p) => <li key={p.week} className="flex gap-4 py-2.5"><span className="w-6 shrink-0 font-serif text-[22px] leading-none">{p.week}</span><span className="text-[13.5px] leading-relaxed text-dim">{p.text}</span></li>)}
        </ol>
      </section>
    </div>
  )
}

function Glow() {
  const g = guia.glow
  const Steps = ({ t, s }: { t: string; s: typeof g.am }) => (
    <section>
      <Kicker>{t}</Kicker>
      <ol className="mt-2 divide-y divide-line">
        {s.map((x, i) => <li key={i} className="py-3"><div className="text-[15px]">{x.step}{x.min ? <span className="ml-2 font-mono text-[10.5px] text-faint">{x.min} min</span> : null}</div><div className="text-[13px] leading-relaxed text-dim">{x.how}</div>{x.product && <div className="text-[12px] text-faint">{x.product}</div>}</li>)}
      </ol>
    </section>
  )
  return (
    <div className="space-y-8">
      <Steps t="Mañana" s={g.am} />
      <Steps t="Noche" s={g.pm} />
      <Steps t="Semanal" s={g.semanal} />
      <section><Kicker>Checklist</Kicker><List items={g.checklist} /></section>
    </div>
  )
}

function Addictions() {
  const a = guia.adicciones
  return (
    <div className="space-y-8">
      <Card className="border-sun/40">
        <Kicker color="#e9a640">Cuando llega un antojo</Kicker>
        <ol className="mt-2 space-y-2">{a.antojo.map((x, i) => <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed"><span className="font-serif text-sun">{i + 1}</span>{x}</li>)}</ol>
      </Card>
      <section><Kicker>Bloqueadores</Kicker><List items={a.bloqueadores} /></section>
      <section><Kicker>Apoyo</Kicker><List items={a.apoyo} /></section>
      <section><Kicker>Seguridad</Kicker><List items={a.seguridad} /></section>
    </div>
  )
}

function Health() {
  return (
    <div className="space-y-8">
      <section><Kicker>Chequeo médico antes de empezar</Kicker><List items={guia.medico} /></section>
      <section><Kicker>Cuándo ajustar calorías</Kicker><List items={guia.ajustes} /></section>
      <section><Kicker>Metas</Kicker><List items={Object.values(guia.metas)} /></section>
    </div>
  )
}

function SyncCard() {
  const [key, setKey] = useState(syncKey() ?? '')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [at, setAt] = useState(lastSyncAt())
  const go = async () => {
    setBusy(true); setMsg('')
    try {
      if (key.trim() !== syncKey()) setSyncKey(key)
      const r = await syncNow()
      setAt(lastSyncAt())
      setMsg(`Listo: subí ${r.sent} y bajé ${r.got} cambios.`)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'No se pudo sincronizar.') } finally { setBusy(false) }
  }
  return (
    <Card>
      <Kicker>Sincronizar compu y teléfono</Kicker>
      <p className="mt-2 text-[14px] leading-relaxed text-dim">
        Con la clave, tus datos se guardan en tu nube privada y se sincronizan solos al abrir la app, cada minuto y al salir. Pon la misma clave en cada dispositivo.
      </p>
      <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Clave de sincronización" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        className="mt-3 w-full rounded-xl border border-line bg-ink px-4 py-3 font-mono text-[14px] outline-none placeholder:text-faint" />
      <div className="mt-3 flex items-center gap-3">
        <Btn disabled={busy || !key.trim()} onClick={go}>{busy ? 'Sincronizando…' : 'Sincronizar ahora'}</Btn>
        <span className="font-mono text-[10.5px] text-faint">{at ? `última: ${new Date(at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}` : 'nunca'}</span>
      </div>
      {msg && <p className="mt-2 text-[12.5px] text-dim">{msg}</p>}
    </Card>
  )
}

function AlarmsCard() {
  const download = (core: boolean) => {
    const url = URL.createObjectURL(new Blob([buildIcs(core)], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url; a.download = core ? 'lockin-avisos-clave.ics' : 'lockin-todos-los-bloques.ics'; a.click()
  }
  return (
    <Card>
      <Kicker>Avisos en el iPhone</Kicker>
      <p className="mt-2 text-[14px] leading-relaxed text-dim">
        Descarga tu horario como calendario y ábrelo en el iPhone: te avisa al inicio de cada bloque aunque la app esté cerrada. Cubre el jet lag y 12 semanas.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn onClick={() => download(true)}>Solo lo clave</Btn>
        <Btn kind="line" onClick={() => download(false)}>Todos los bloques</Btn>
      </div>
      <p className="mt-2 text-[12px] text-faint">"Solo lo clave" avisa en lo que cuenta para la racha y en las llamadas con Pam.</p>
    </Card>
  )
}

const blobToData =(b: Blob) => new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(f.result as string); f.readAsDataURL(b) })
const dataToBlob = async (d: string) => (await fetch(d)).blob()

function Data() {
  const persisted = useLiveQuery(() => getSetting('persisted', false), []) ?? false
  const last = useLiveQuery(() => getSetting<number>('lastExport', 0), []) ?? 0
  const [msg, setMsg] = useState('')

  const exportAll = async () => {
    const out: Record<string, unknown[]> = {}
    for (const t of db.tables) {
      const rows = await t.toArray()
      out[t.name] = await Promise.all(rows.map(async (r) => {
        const o: Record<string, unknown> = { ...r }
        for (const [k, v] of Object.entries(o)) if (v instanceof Blob) o[k] = { __blob: await blobToData(v) }
        return o
      }))
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify({ app: 'lockin', v: 1, at: Date.now(), data: out })], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `lockin-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    await setSetting('lastExport', Date.now())
    setMsg('Respaldo descargado.')
  }

  const importAll = async (file: File) => {
    const j = JSON.parse(await file.text())
    if (j.app !== 'lockin') return setMsg('Ese archivo no es un respaldo de Lock-in.')
    await db.transaction('rw', db.tables, async () => {
      for (const t of db.tables) {
        const rows = j.data[t.name] ?? []
        for (const r of rows) for (const [k, v] of Object.entries(r)) if (v && typeof v === 'object' && '__blob' in (v as object)) r[k] = await dataToBlob((v as { __blob: string }).__blob)
        await t.bulkPut(rows)
      }
    })
    setMsg('Datos restaurados.')
  }

  return (
    <div className="space-y-6">
      <SyncCard />
      <AlarmsCard />
      <Card>
        <Kicker>En este dispositivo</Kicker>
        <p className="mt-2 text-[14px] leading-relaxed text-dim">
          Todo se guarda aquí primero, también sin internet, y se sube a tu nube privada cuando hay conexión.
        </p>
        <div className="mt-3 font-mono text-[11px] text-faint">Almacenamiento persistente: {persisted ? 'concedido' : 'sin confirmar'}</div>
        {!persisted && <Btn kind="line" className="mt-3" onClick={async () => setSetting('persisted', await requestPersist())}>Pedir que no se borre</Btn>}
      </Card>
      <Card>
        <Kicker>Respaldo</Kicker>
        <p className="mt-2 text-[14px] text-dim">Último: {last ? new Date(last).toLocaleDateString('es-MX') : 'nunca'}. Haz uno cada domingo.</p>
        <div className="mt-3 flex gap-2">
          <Btn onClick={exportAll}>Exportar</Btn>
          <label className="cursor-pointer rounded-full border border-line px-5 py-3 text-[15px]">
            Importar<input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importAll(e.target.files[0])} />
          </label>
        </div>
        {msg && <div className="mt-3 font-mono text-[11px] text-ok">{msg}</div>}
      </Card>
    </div>
  )
}
