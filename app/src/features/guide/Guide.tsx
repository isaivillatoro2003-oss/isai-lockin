import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { guia } from '../../content'
import type { Grade as G } from '../../content/types'
import { db, getSetting, requestPersist, setSetting } from '../../db'
import { Btn, Card, Chips, Grade, Kicker, Screen } from '../../ui'

type View = 'tips' | 'comida' | 'entreno' | 'glow' | 'adicciones' | 'salud' | 'datos'

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
        { v: 'adicciones', l: 'Adicciones' }, { v: 'salud', l: 'Salud' }, { v: 'datos', l: 'Datos' },
      ]} />
      {view === 'tips' && <Tips />}
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

function Training() {
  return (
    <div className="space-y-8">
      <section>
        <Kicker>12 semanas</Kicker>
        <ol className="mt-2 divide-y divide-line">
          {guia.progresion.map((p) => <li key={p.week} className="flex gap-4 py-2.5"><span className="w-6 shrink-0 font-serif text-[22px] leading-none">{p.week}</span><span className="text-[13.5px] leading-relaxed text-dim">{p.text}</span></li>)}
        </ol>
      </section>
      {guia.workouts.map((w) => (
        <section key={w.id}>
          <Kicker>{w.where === 'gym' ? 'Gimnasio' : 'En casa'}</Kicker>
          <div className="font-serif text-[26px]">{w.name}</div>
          <div className="mb-2 text-[13px] text-faint">{w.focus}</div>
          <div className="divide-y divide-line rounded-xl border border-line">
            {w.exercises.map((e, i) => (
              <div key={i} className="flex justify-between gap-3 px-3 py-2.5">
                <div><div className="text-[14.5px]">{e.name}</div>{e.alt && <div className="text-[12px] text-faint">sin gym: {e.alt}</div>}</div>
                <div className="shrink-0 text-right font-mono text-[11px] text-dim">{e.sets} × {e.reps}<div className="text-faint">{e.rest}</div></div>
              </div>
            ))}
          </div>
        </section>
      ))}
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

const blobToData = (b: Blob) => new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(f.result as string); f.readAsDataURL(b) })
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
      <Card>
        <Kicker>Dónde viven tus datos</Kicker>
        <p className="mt-2 text-[14px] leading-relaxed text-dim">
          Por ahora se guardan en este dispositivo, también sin internet. Cuando la app esté terminada y en Vercel, se sincronizarán solos entre tu compu y tu teléfono.
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
