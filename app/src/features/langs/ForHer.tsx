import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, now, uid } from '../../db'
import { translate, type Translation } from '../../ai'
import { allCards } from '../../domain/srs'
import { speak, startRecording } from '../../domain/speech'
import { Btn, Kicker } from '../../ui'
import SpeakCheck from './SpeakCheck'

/** Traductor para Pam + frases guardadas + frases de pareja, con audio, grabación y revisión de pronunciación. */
export default function ForHer({ lang }: { lang: 'ar' | 'fr' }) {
  const [text, setText] = useState('')
  const [to, setTo] = useState<'f' | 'm'>('f')
  const [res, setRes] = useState<Translation | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [saved, setSaved] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const mine = (useLiveQuery(() => db.phrases.toArray(), []) ?? []).filter((p) => (p.lang ?? 'ar') === lang).sort((a, b) => b.updatedAt - a.updatedAt)
  const love = allCards(lang).filter((c) => c.tags.includes('amor'))

  const go = async () => {
    if (!text.trim()) return
    setBusy(true); setErr(''); setRes(null); setSaved(false)
    try {
      const r = await translate(text.trim(), lang, to)
      setRes(r)
      speak(r, lang)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Algo falló.')
    } finally { setBusy(false) }
  }

  const save = () => {
    if (!res) return
    db.phrases.put({ id: uid(), es: text.trim(), t: res.t, chat: res.chat, pron: res.pron, script: res.script, note: res.note, lang, done: false, updatedAt: now() })
    setSaved(true)
  }

  return (
    <div>
      <div className="rounded-3xl border border-line bg-raised p-4">
        <Kicker>Qué le quieres decir a Pam</Kicker>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
          placeholder={lang === 'ar' ? 'Ej: te extraño, mañana te marco temprano' : 'Ej: ¿qué hiciste hoy, mi amor?'}
          className="mt-2 w-full resize-none rounded-xl border border-line bg-ink px-4 py-3 text-[16px] outline-none placeholder:text-faint" />
        <div className="mt-3 flex items-center gap-2">
          <div className="flex rounded-full border border-line p-1 text-[12px]">
            {(['f', 'm'] as const).map((g) => (
              <button key={g} onClick={() => setTo(g)} className={`rounded-full px-3 py-1 ${to === g ? 'bg-paper text-ink' : 'text-dim'}`}>{g === 'f' ? 'a ella' : 'a él'}</button>
            ))}
          </div>
          <Btn className="flex-1" disabled={busy || !text.trim()} onClick={go}>{busy ? 'Traduciendo…' : 'Traducir'}</Btn>
        </div>
        {err && <p className="mt-3 text-[13px] text-bad">{err}</p>}

        {res && (
          <div className="mt-5 border-t border-line pt-4">
            <button onClick={() => speak(res, lang)} className="block text-left font-serif text-[34px] leading-[1.05]">{res.t}</button>
            <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13.5px]">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">WhatsApp</span><span className="font-mono">{res.chat}</span>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">Se lee</span><span>{res.pron}</span>
              {res.script && <><span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">Árabe</span><span dir="rtl" className="text-right text-[17px]">{res.script}</span></>}
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">Literal</span><span className="text-dim">{res.literal}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {res.words.map((w, i) => <span key={i} className="rounded-lg border border-line px-2 py-1 text-[12.5px]"><b className="font-medium">{w.t}</b> <span className="text-faint">{w.es}</span></span>)}
            </div>
            {res.alternatives.length > 0 && (
              <ul className="mt-3 space-y-1">{res.alternatives.map((a, i) => <li key={i} className="text-[13px]"><span>{a.t}</span> <span className="text-faint">· {a.when}</span></li>)}</ul>
            )}
            {res.note && <p className="mt-3 text-[13px] leading-relaxed text-dim">{res.note}</p>}
            <SpeakCheck lang={lang} t={res.t} script={res.script} />
            <div className="mt-3 flex gap-2">
              <Btn kind="line" className="flex-1" onClick={() => speak(res, lang)}>Oír otra vez</Btn>
              <Btn className="flex-1" disabled={saved} onClick={save}>{saved ? 'Guardada ✓' : 'Guardar'}</Btn>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8"><Kicker>Mis frases guardadas</Kicker></div>
      {mine.length === 0 && <p className="py-4 text-[13.5px] text-faint">Traduce algo arriba y guárdalo para practicarlo antes de la llamada.</p>}
      <ul className="mt-2 divide-y divide-line">
        {mine.map((p) => (
          <li key={p.id} className="py-3">
            <div className="flex items-start gap-3">
              <button onClick={() => { speak(p, lang); setOpen(open === p.id ? null : p.id) }} className="min-w-0 flex-1 text-left">
                <div className="text-[16px]">{p.t}</div>
                <div className="text-[12.5px] text-faint">{p.es}{p.pron && <span className="font-mono"> · {p.pron}</span>}</div>
              </button>
              <Recorder id={`mine-${p.id}`} />
            </div>
            {open === p.id && (
              <div className="mt-2">
                {p.chat && <div className="font-mono text-[12.5px] text-dim">WhatsApp: {p.chat}</div>}
                <SpeakCheck lang={lang} t={p.t} script={p.script} />
                <button onClick={() => db.phrases.delete(p.id)} className="mt-3 text-[12px] text-faint">Borrar</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-8"><Kicker>Amor y pareja</Kicker></div>
      <ul className="mt-2 divide-y divide-line">
        {love.map((c) => (
          <li key={c.id} className="py-3">
            <div className="flex items-start gap-3">
              <button onClick={() => { speak(c, lang); setOpen(open === c.id ? null : c.id) }} className="min-w-0 flex-1 text-left">
                <div className="text-[16px]">{c.t}</div>
                <div className="text-[12.5px] text-faint">{c.es}{c.pron && <span className="font-mono"> · {c.pron}</span>}</div>
              </button>
              <Recorder id={c.id} />
            </div>
            {open === c.id && <SpeakCheck lang={lang} t={c.t} script={c.script} />}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Graba tu voz y la reproduce para compararla con el audio. */
function Recorder({ id }: { id: string }) {
  const recs = useLiveQuery(() => db.recordings.where('cardId').equals(id).toArray(), [id]) ?? []
  const [stop, setStop] = useState<(() => Promise<Blob>) | null>(null)
  const toggle = async () => {
    if (stop) {
      const blob = await stop()
      await db.recordings.put({ id: uid(), cardId: id, blob, at: now(), updatedAt: now() })
      setStop(null)
      return
    }
    try { const s = await startRecording(); setStop(() => s) } catch { alert('Necesito permiso para el micrófono.') }
  }
  const last = recs.sort((a, b) => b.at - a.at)[0]
  return (
    <div className="flex shrink-0 gap-2">
      <button onClick={toggle} className={`grid h-9 w-9 place-items-center rounded-full border ${stop ? 'border-bad bg-bad' : 'border-line'}`} aria-label="grabar">
        <span className={`h-2.5 w-2.5 ${stop ? 'rounded-sm bg-ink' : 'rounded-full bg-bad'}`} />
      </button>
      <button disabled={!last} onClick={() => last && new Audio(URL.createObjectURL(last.blob)).play()}
        className="grid h-9 w-9 place-items-center rounded-full border border-line text-[12px] disabled:opacity-20" aria-label="oír mi grabación">▶</button>
    </div>
  )
}
