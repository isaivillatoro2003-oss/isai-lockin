import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, now, uid } from '../../db'
import { allCards } from '../../domain/srs'
import { speak, startRecording } from '../../domain/speech'
import { Btn, Kicker } from '../../ui'

/** Frases de pareja listas para la llamada, con grabación propia para comparar con el audio. */
export default function ForHer() {
  const love = allCards('ar').filter((c) => c.tags.includes('amor'))
  const mine = useLiveQuery(() => db.phrases.toArray(), []) ?? []
  const recs = useLiveQuery(() => db.recordings.toArray(), []) ?? []
  const [es, setEs] = useState('')
  const [t, setT] = useState('')
  const [rec, setRec] = useState<{ id: string; stop: () => Promise<Blob> } | null>(null)

  const toggleRec = async (cardId: string) => {
    if (rec) {
      const blob = await rec.stop()
      await db.recordings.put({ id: uid(), cardId: rec.id, blob, at: now(), updatedAt: now() })
      setRec(null)
      return
    }
    try { setRec({ id: cardId, stop: await startRecording() }) } catch { alert('Necesito permiso para el micrófono.') }
  }
  const play = (cardId: string) => {
    const r = recs.filter((x) => x.cardId === cardId).sort((a, b) => b.at - a.at)[0]
    if (r) new Audio(URL.createObjectURL(r.blob)).play()
  }

  const Row = ({ id, top, sub, script }: { id: string; top: string; sub: string; script?: string }) => {
    const has = recs.some((x) => x.cardId === id)
    const live = rec?.id === id
    return (
      <li className="flex items-center gap-3 py-3">
        <button onClick={() => speak({ t: top, script }, 'ar')} className="min-w-0 flex-1 text-left">
          <div className="text-[16px]">{top}</div>
          <div className="text-[12.5px] text-faint">{sub}</div>
        </button>
        <button onClick={() => toggleRec(id)} className={`grid h-9 w-9 place-items-center rounded-full border ${live ? 'border-bad bg-bad' : 'border-line'}`} aria-label="grabar">
          <span className={`h-2.5 w-2.5 ${live ? 'rounded-sm bg-ink' : 'rounded-full bg-bad'}`} />
        </button>
        <button disabled={!has} onClick={() => play(id)} className="grid h-9 w-9 place-items-center rounded-full border border-line text-[12px] disabled:opacity-20" aria-label="oír mi grabación">▶</button>
      </li>
    )
  }

  return (
    <div>
      <p className="mb-5 text-[14px] leading-relaxed text-dim">
        Toca la frase para oírla, graba la tuya con el punto rojo y compara. La voz del teléfono es árabe estándar: el acento real te lo da ella. Pídele que te mande voice notes de estas frases.
      </p>

      <Kicker>Mis frases para hoy</Kicker>
      <div className="mt-2 mb-2 grid gap-2">
        <input value={es} onChange={(e) => setEs(e.target.value)} placeholder="Lo que quiero decir (español)" className="rounded-xl border border-line bg-ink px-4 py-3 text-[15px] outline-none placeholder:text-faint" />
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder="En Arabizi" autoCapitalize="off" className="rounded-xl border border-line bg-ink px-4 py-3 text-[15px] outline-none placeholder:text-faint" />
        <Btn kind="line" disabled={!t} onClick={() => { db.phrases.put({ id: uid(), es, t, done: false, updatedAt: now() }); setEs(''); setT('') }}>Agregar</Btn>
      </div>
      <ul className="mb-8 divide-y divide-line">
        {mine.map((p) => <Row key={p.id} id={`mine-${p.id}`} top={p.t} sub={p.es} />)}
      </ul>

      <Kicker>Amor y pareja</Kicker>
      <ul className="mt-2 divide-y divide-line">
        {love.map((c) => <Row key={c.id} id={c.id} top={c.t} sub={`${c.es}${c.pron ? ` · ${c.pron}` : ''}`} script={c.script} />)}
      </ul>
    </div>
  )
}
