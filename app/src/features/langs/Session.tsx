import { useEffect, useMemo, useRef, useState } from 'react'
import { db, now } from '../../db'
import type { Card } from '../../content/types'
import { Rating, allCards, cardById, check, review, variants, type Lang } from '../../domain/srs'
import { speak } from '../../domain/speech'
import { Btn, Kicker } from '../../ui'

export type Mode = 'review' | 'new' | 'lesson' | 'listen'
type Ex = { kind: 'elegir' | 'escuchar' | 'escribir' | 'ordenar'; card: Card; options?: string[] }

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
const main = (t: string) => variants(t)[0] ?? t

export default function Session({ lang, mode, ids, title, onExit }: { lang: Lang; mode: Mode; ids: string[]; title: string; onExit: () => void }) {
  const cards = useMemo(() => ids.map(cardById).filter(Boolean) as Card[], [ids])
  const exercises = useMemo(() => (mode === 'lesson' ? buildLesson(lang, cards) : []), [lang, mode, cards])
  const total = mode === 'lesson' ? exercises.length : cards.length
  const [i, setI] = useState(0)
  const [right, setRight] = useState(0)
  const accent = lang === 'ar' ? '#e9a640' : '#7d9bb8'

  const nextStep = () => setI((x) => x + 1)
  const done = i >= total

  useEffect(() => {
    if (done && mode === 'lesson') {
      const unit = cards[0]?.unit
      db.lessons.put({ id: `${lang}-u${unit}`, doneAt: now(), score: right / Math.max(1, total), updatedAt: now() })
    }
  }, [done, mode, cards, lang, right, total])

  return (
    <div className="safe-t flex min-h-dvh flex-col px-5 pb-28">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={onExit} className="text-[22px] text-dim" aria-label="cerrar">×</button>
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(Math.min(i, total) / total) * 100}%`, background: accent }} />
        </div>
        <span className="font-mono text-[11px] text-faint tnum">{Math.min(i + 1, total)}/{total}</span>
      </div>

      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Kicker color={accent}>{title}</Kicker>
          <div className="mt-3 font-serif text-[64px] leading-none">Listo</div>
          {mode === 'lesson' && <div className="mt-3 font-mono text-[13px] text-dim">{right} de {total} bien</div>}
          <Btn className="mt-10 w-48" onClick={onExit}>Volver</Btn>
        </div>
      ) : mode === 'review' ? (
        <ReviewCard key={i} card={cards[i]} lang={lang} accent={accent} onDone={nextStep} />
      ) : mode === 'new' ? (
        <NewCard key={i} card={cards[i]} lang={lang} accent={accent} onDone={nextStep} />
      ) : mode === 'listen' ? (
        <ListenCard key={i} card={cards[i]} lang={lang} onDone={nextStep} />
      ) : (
        <Exercise key={i} ex={exercises[i]} lang={lang} accent={accent} onDone={(ok) => { if (ok) setRight((r) => r + 1); nextStep() }} />
      )}
    </div>
  )
}

function buildLesson(lang: Lang, cards: Card[]): Ex[] {
  const pool = allCards(lang)
  const kinds: Ex['kind'][] = ['elegir', 'escuchar', 'escribir', 'ordenar']
  return shuffle(cards).slice(0, 12).map((card, n) => {
    let kind = kinds[n % 4]
    if (kind === 'ordenar' && main(card.t).split(' ').length < 2) kind = 'escribir'
    const others = shuffle(pool.filter((c) => c.id !== card.id && c.es !== card.es)).slice(0, 3)
    const options = kind === 'elegir' ? shuffle([card.es, ...others.map((c) => c.es)])
      : kind === 'escuchar' ? shuffle([main(card.t), ...others.map((c) => main(c.t))]) : undefined
    return { kind, card, options }
  })
}

function Big({ card, lang, reveal = true }: { card: Card; lang: Lang; reveal?: boolean }) {
  return (
    <div>
      <button onClick={() => speak(card, lang)} className="block text-left font-serif text-[46px] leading-[1.02]">{reveal ? main(card.t) : '· · ·'}</button>
      {reveal && (
        <>
          {card.alt && <div className="mt-1 text-[15px] text-dim">a mujer / otra forma: {card.alt}</div>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px] text-faint">
            {card.pron && <span>se lee: {card.pron}</span>}
            {card.script && <span className="font-sans text-[16px] text-dim" dir="rtl">{card.script}</span>}
            {card.chat && <span>chat: {card.chat}</span>}
          </div>
          {card.note && <p className="mt-2 text-[13px] text-dim">{card.note}</p>}
        </>
      )}
    </div>
  )
}

function Speaker({ card, lang }: { card: Card; lang: Lang }) {
  return (
    <button onClick={() => speak(card, lang)} className="grid h-14 w-14 place-items-center rounded-full border border-line" aria-label="oír">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d="M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>
    </button>
  )
}

function NewCard({ card, lang, accent, onDone }: { card: Card; lang: Lang; accent: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(() => speak(card, lang), 250); return () => clearTimeout(t) }, [card, lang])
  const go = async (r: typeof Rating.Good | typeof Rating.Easy) => { await review(card.id, r); onDone() }
  return (
    <div className="flex flex-1 flex-col">
      <Kicker color={accent}>Nueva</Kicker>
      <div className="mt-2 mb-8 text-[20px] text-dim">{card.es}</div>
      <Big card={card} lang={lang} />
      <div className="mt-auto flex items-center gap-3 pt-10">
        <Speaker card={card} lang={lang} />
        <Btn kind="line" onClick={() => go(Rating.Easy)}>Ya la sé</Btn>
        <Btn className="flex-1" onClick={() => go(Rating.Good)}>Siguiente</Btn>
      </div>
    </div>
  )
}

function ReviewCard({ card, lang, accent, onDone }: { card: Card; lang: Lang; accent: string; onDone: () => void }) {
  const [shown, setShown] = useState(false)
  const listen = useMemo(() => Math.random() < 0.3, [])
  useEffect(() => { if (listen) setTimeout(() => speak(card, lang), 250) }, [listen, card, lang])
  const rate = async (r: number) => { await review(card.id, r as typeof Rating.Good); onDone() }
  return (
    <div className="flex flex-1 flex-col">
      <Kicker color={accent}>{listen ? 'Escucha: ¿qué significa?' : '¿Cómo se dice?'}</Kicker>
      {listen && !shown ? <div className="mt-6"><Speaker card={card} lang={lang} /></div> : <div className="mt-2 mb-8 text-[24px] leading-snug">{card.es}</div>}
      {shown && (listen ? <><div className="mt-6 mb-6 text-[22px]">{card.es}</div><Big card={card} lang={lang} /></> : <Big card={card} lang={lang} />)}
      <div className="mt-auto pt-10">
        {!shown ? (
          <Btn className="w-full" onClick={() => { setShown(true); if (!listen) speak(card, lang) }}>Mostrar</Btn>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {[[Rating.Again, 'Otra vez', '#c9705a'], [Rating.Hard, 'Difícil', '#8f8673'], [Rating.Good, 'Bien', accent], [Rating.Easy, 'Fácil', '#9cb380']].map(([r, l, c]) => (
              <button key={l as string} onClick={() => rate(r as number)} className="rounded-2xl border py-3 text-[13px]" style={{ borderColor: c as string, color: c as string }}>{l as string}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ListenCard({ card, lang, onDone }: { card: Card; lang: Lang; onDone: () => void }) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    speak(card, lang)
    const t = setTimeout(onDone, 4200)
    return () => clearTimeout(t)
  }, [card, lang, paused, onDone])
  return (
    <div className="flex flex-1 flex-col">
      <Kicker>Escucha pasiva</Kicker>
      <div className="mt-6"><Big card={card} lang={lang} /></div>
      <div className="mt-4 text-[20px] text-dim">{card.es}</div>
      <div className="mt-auto flex gap-2 pt-10">
        <Btn kind="line" onClick={() => setPaused(!paused)}>{paused ? 'Seguir' : 'Pausa'}</Btn>
        <Btn className="flex-1" onClick={onDone}>Siguiente</Btn>
      </div>
    </div>
  )
}

function Exercise({ ex, lang, accent, onDone }: { ex: Ex; lang: Lang; accent: string; onDone: (ok: boolean) => void }) {
  const { card } = ex
  const [answer, setAnswer] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [result, setResult] = useState<'ok' | 'casi' | 'mal' | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const tokens = useMemo(() => shuffle(main(card.t).split(' ')), [card])

  useEffect(() => { if (ex.kind === 'escuchar' || ex.kind === 'escribir') setTimeout(() => speak(card, lang), 250) }, [ex, card, lang])

  const finish = async (r: 'ok' | 'casi' | 'mal') => {
    setResult(r)
    speak(card, lang)
    const known = await db.cardStates.get(card.id)
    await review(card.id, r === 'mal' ? Rating.Again : known ? Rating.Good : Rating.Good)
  }

  const prompt = {
    elegir: '¿Qué significa?',
    escuchar: 'Escucha y elige',
    escribir: lang === 'ar' ? 'Escríbelo en Arabizi' : 'Escríbelo en francés',
    ordenar: 'Ordena la frase',
  }[ex.kind]

  return (
    <div className="flex flex-1 flex-col">
      <Kicker color={accent}>{prompt}</Kicker>
      <div className="mt-3 mb-6">
        {ex.kind === 'elegir' && <Big card={card} lang={lang} reveal />}
        {ex.kind === 'escuchar' && <Speaker card={card} lang={lang} />}
        {(ex.kind === 'escribir' || ex.kind === 'ordenar') && <div className="text-[24px] leading-snug">{card.es}</div>}
      </div>

      {ex.options && (
        <div className="grid gap-2">
          {ex.options.map((o) => {
            const correct = ex.kind === 'elegir' ? o === card.es : o === main(card.t)
            const isPick = picked[0] === o
            return (
              <button key={o} disabled={!!result} onClick={() => { setPicked([o]); finish(correct ? 'ok' : 'mal') }}
                className="rounded-2xl border px-4 py-3.5 text-left text-[16px] transition"
                style={{ borderColor: result && correct ? '#9cb380' : isPick ? '#c9705a' : 'var(--color-line)' }}>
                {o}
              </button>
            )
          })}
        </div>
      )}

      {ex.kind === 'escribir' && (
        <input ref={input} autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={!!result}
          onKeyDown={(e) => e.key === 'Enter' && answer && finish(check(lang, answer, card.t))}
          autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={lang === 'ar' ? 'kifak...' : 'bonjour...'}
          className="w-full rounded-2xl border border-line bg-ink px-4 py-4 text-[20px] outline-none placeholder:text-faint" />
      )}

      {ex.kind === 'ordenar' && (
        <>
          <div className="mb-4 min-h-[56px] rounded-2xl border border-dashed border-line px-3 py-3 text-[18px]">
            {picked.map((w, k) => <button key={k} onClick={() => !result && setPicked(picked.filter((_, j) => j !== k))} className="mr-2 mb-1">{w}</button>)}
          </div>
          <div className="flex flex-wrap gap-2">
            {tokens.map((w, k) => {
              const used = picked.filter((p) => p === w).length >= tokens.slice(0, k + 1).filter((t) => t === w).length
              return <button key={k} disabled={used || !!result} onClick={() => setPicked([...picked, w])} className={`rounded-xl border border-line px-3 py-2 text-[16px] ${used ? 'opacity-20' : ''}`}>{w}</button>
            })}
          </div>
        </>
      )}

      <div className="mt-auto pt-8">
        {result ? (
          <div>
            <div className="mb-3 rounded-2xl px-4 py-3" style={{ background: result === 'mal' ? '#c9705a22' : '#9cb38022' }}>
              <div className="text-[15px]" style={{ color: result === 'mal' ? '#c9705a' : '#9cb380' }}>{{ ok: 'Bien', casi: 'Casi: se acepta', mal: 'No' }[result]}</div>
              <div className="mt-1 text-[18px]">{main(card.t)}</div>
              <div className="text-[13px] text-dim">{card.es}{card.pron && ` · ${card.pron}`}</div>
            </div>
            <Btn className="w-full" onClick={() => onDone(result !== 'mal')}>Continuar</Btn>
          </div>
        ) : ex.kind === 'escribir' ? (
          <Btn className="w-full" disabled={!answer} onClick={() => finish(check(lang, answer, card.t))}>Comprobar</Btn>
        ) : ex.kind === 'ordenar' ? (
          <Btn className="w-full" disabled={!picked.length} onClick={() => finish(check(lang, picked.join(' '), card.t))}>Comprobar</Btn>
        ) : null}
      </div>
    </div>
  )
}
