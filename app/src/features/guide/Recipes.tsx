import { useState } from 'react'
import { recetas } from '../../content'
import type { Receta } from '../../content/types'
import { Card, Kicker, Sheet } from '../../ui'

const SLOT: Record<Receta['slot'], string> = { comida1: 'Comida 1', comida2: 'Comida 2', comida3: 'Comida 3', snack: 'Snack' }

const own = (r: Receta) => r.fuente.creador.startsWith('Lock-in')

export function RecipeCard({ r, onOpen }: { r: Receta; onOpen: () => void }) {
  return (
    <Card onClick={onOpen}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[15.5px] leading-snug">{r.name}</div>
        <div className="shrink-0 font-mono text-[10.5px] text-faint">{r.tiempo}</div>
      </div>
      <div className="mt-1 font-mono text-[11px] text-dim tnum">{r.kcal} kcal · {r.proteinaG} g proteína</div>
      <div className="mt-1 text-[12px] text-faint">{own(r) ? r.fuente.creador : `${r.fuente.creador} · ${r.fuente.plataforma}`}{r.tags.includes('horno') && ' · horno'}</div>
    </Card>
  )
}

export function RecipeDetail({ r }: { r: Receta }) {
  return (
    <div className="pb-4">
      <Kicker>{SLOT[r.slot]} · {r.tiempo} · {r.porciones} porción{r.porciones > 1 ? 'es' : ''}</Kicker>
      <h2 className="mt-1 font-serif text-[32px] leading-[1.05]">{r.name}</h2>
      <div className="mt-3 grid grid-cols-4 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {[['kcal', r.kcal], ['prot', `${r.proteinaG} g`], ['carbos', `${r.carbosG} g`], ['grasa', `${r.grasaG} g`]].map(([k, v]) => (
          <div key={k} className="bg-raised py-2 text-center"><div className="font-serif text-[20px] tnum">{v}</div><div className="font-mono text-[9.5px] uppercase text-faint">{k}</div></div>
        ))}
      </div>
      <p className="mt-4 rounded-xl bg-ink px-4 py-3 text-[14px] leading-relaxed text-dim"><span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">Cómo se ve · </span>{r.seVe}</p>
      <div className="mt-5"><Kicker>Ingredientes</Kicker>
        <ul className="mt-2 divide-y divide-line">{r.ingredientes.map((x, i) => <li key={i} className="flex justify-between gap-3 py-2 text-[14.5px]"><span>{x.item}</span><span className="shrink-0 text-dim">{x.cantidad}</span></li>)}</ul>
      </div>
      <div className="mt-5"><Kicker>Paso a paso</Kicker>
        <ol className="mt-2 space-y-3">{r.pasos.map((x, i) => <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed"><span className="w-4 shrink-0 font-serif text-[18px] text-sun">{i + 1}</span>{x}</li>)}</ol>
      </div>
      {r.horno && <div className="mt-5 rounded-xl border border-line px-4 py-3"><Kicker>En horno</Kicker><p className="mt-1 text-[14px] leading-relaxed text-dim">{r.horno}</p></div>}
      {r.tips.length > 0 && <div className="mt-5"><Kicker>Tips</Kicker><ul className="mt-2 space-y-1.5">{r.tips.map((x, i) => <li key={i} className="text-[13.5px] text-dim">· {x}</li>)}</ul></div>}
      <p className="mt-5 text-[12px] text-faint">
        {own(r) ? 'Receta propia de Lock-in' : <>Idea de {r.fuente.creador} ({r.fuente.plataforma})</>}{r.fuente.url && <> · <a href={r.fuente.url} target="_blank" rel="noreferrer" className="underline">ver video</a></>}
      </p>
    </div>
  )
}

/** Sugerencias del día para un tiempo de comida: rotan por fecha para no repetir. */
export function suggestions(slot: Receta['slot'], date: string, n = 3) {
  const list = recetas.filter((r) => r.slot === slot)
  if (!list.length) return []
  const seed = Math.floor(Date.parse(date) / 864e5)
  return Array.from({ length: Math.min(n, list.length) }, (_, i) => list[(seed * n + i) % list.length])
}

export default function Recipes() {
  const [slot, setSlot] = useState<Receta['slot'] | 'todo'>('todo')
  const [open, setOpen] = useState<Receta | null>(null)
  const list = recetas.filter((r) => slot === 'todo' || r.slot === slot)
  return (
    <div>
      <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
        {(['todo', 'comida1', 'comida2', 'comida3', 'snack'] as const).map((s) => (
          <button key={s} onClick={() => setSlot(s)} className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] ${slot === s ? 'bg-paper text-ink' : 'border border-line text-dim'}`}>{s === 'todo' ? 'Todas' : SLOT[s]}</button>
        ))}
      </div>
      {!recetas.length && <p className="py-6 text-center text-[13.5px] text-faint">Las recetas de TikTok y Reels se están investigando.</p>}
      <div className="grid gap-2">{list.map((r) => <RecipeCard key={r.id} r={r} onOpen={() => setOpen(r)} />)}</div>
      <Sheet open={!!open} onClose={() => setOpen(null)}>{open && <RecipeDetail r={open} />}</Sheet>
    </div>
  )
}
