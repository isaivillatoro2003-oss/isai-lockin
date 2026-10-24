import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { guia } from '../../content'
import { PACKS, allCards, dueCount, dueIds, lessonFor, moreIds, newIds, stories, type Lang } from '../../domain/srs'
import { hasVoice, speak } from '../../domain/speech'
import { useNav } from '../../hooks'
import { Btn, Card, Chips, Kicker, Screen, Sheet } from '../../ui'
import Session, { type Mode } from './Session'
import ForHer from './ForHer'
import LessonView, { StoryView } from './LessonView'
import type { Story } from '../../content/types'

type View = 'ruta' | 'historias' | 'ella' | 'claves' | 'recursos'

export default function Langs() {
  const { nav } = useNav()
  const initial = nav.sub ?? ''
  const [lang, setLang] = useState<Lang>(initial.endsWith('fr') ? 'fr' : 'ar')
  const [view, setView] = useState<View>(initial === 'ella' ? 'ella' : 'ruta')
  const [session, setSession] = useState<{ mode: Mode; ids: string[]; title: string } | null>(null)
  const [unit, setUnit] = useState<number | null>(null)

  const due = useLiveQuery(() => dueCount(lang), [lang, session]) ?? 0
  const fresh = useLiveQuery(() => newIds(lang), [lang, session]) ?? []
  const states = useLiveQuery(() => db.cardStates.where('lang').equals(lang).toArray(), [lang, session]) ?? []
  const known = new Set(states.map((s) => s.cardId))
  const mature = states.filter((s) => s.stability > 21).length
  const pack = PACKS[lang]
  const total = allCards(lang).length

  useEffect(() => {
    if (initial.startsWith('review-')) startReview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startReview() {
    const ids = await dueIds(lang)
    if (ids.length) setSession({ mode: 'review', ids, title: 'Repaso' })
    else { const n = await newIds(lang); if (n.length) setSession({ mode: 'new', ids: n, title: 'Nuevas de hoy' }) }
  }

  if (session) return <Session lang={lang} {...session} onExit={() => setSession(null)} />

  const name = lang === 'ar' ? 'Árabe' : 'Francés'
  const units = pack.units.map((u) => {
    const cards = allCards(lang).filter((c) => c.unit === u.n)
    return { ...u, cards, learned: cards.filter((c) => known.has(c.id)).length }
  })

  return (
    <Screen title={name} kicker={lang === 'ar' ? 'Libanés · Arabizi' : 'De Francia'}
      right={
        <div className="flex rounded-full border border-line p-1">
          {(['ar', 'fr'] as Lang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider ${lang === l ? 'bg-paper text-ink' : 'text-dim'}`}>{l}</button>
          ))}
        </div>
      }>

      {/* Hoy */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card onClick={() => due && dueIds(lang).then((ids) => setSession({ mode: 'review', ids, title: 'Repaso' }))} className={due ? '' : 'opacity-50'}>
          <Kicker>Repaso</Kicker>
          <div className="mt-1 font-serif text-[44px] leading-none tnum">{due}</div>
          <div className="mt-1 font-mono text-[10.5px] text-faint">{due ? 'tarjetas pendientes' : 'al día'}</div>
        </Card>
        <Card onClick={() => fresh.length && setSession({ mode: 'new', ids: fresh, title: 'Nuevas de hoy' })} className={fresh.length ? '' : 'opacity-50'}>
          <Kicker color={lang === 'ar' ? '#e9a640' : '#7d9bb8'}>Nuevas</Kicker>
          <div className="mt-1 font-serif text-[44px] leading-none tnum">{fresh.length}</div>
          <div className="mt-1 font-mono text-[10.5px] text-faint">{fresh.length ? 'para hoy' : 'cupo cumplido'}</div>
        </Card>
      </div>
      <div className="mb-6 flex items-center justify-between font-mono text-[10.5px] text-faint">
        <span>{known.size} de {total} vistas · {mature} maduras</span>
        <button onClick={() => moreIds(lang).then((ids) => ids.length && setSession({ mode: 'new', ids, title: 'Extra' }))}
          className="rounded-full border border-line px-3 py-1 text-dim">+10 nuevas</button>
      </div>
      {!hasVoice(lang) && (
        <p className="mb-5 rounded-xl border border-line px-4 py-3 text-[13px] leading-relaxed text-dim">
          Tu teléfono no tiene voz de {lang === 'ar' ? 'árabe' : 'francés'}. Instálala en Ajustes, Accesibilidad, Contenido leído (iPhone) o Texto a voz (Android).
        </p>
      )}

      <Chips value={view} onChange={setView} options={[
        { v: 'ruta', l: 'Unidades' },
        { v: 'historias', l: 'Historias' },
        { v: 'ella', l: 'Para Pam' },
        { v: 'claves', l: lang === 'ar' ? 'Arabizi' : 'Trampas y chat' },
        { v: 'recursos', l: 'Recursos' },
      ]} />

      {view === 'ruta' && (
        <ol className="relative">
          {units.filter((u) => u.cards.length).map((u) => {
            const p = u.learned / u.cards.length
            return (
              <li key={u.n} onClick={() => setUnit(u.n)} className="flex cursor-pointer items-center gap-4 py-3">
                <div className="relative grid h-12 w-12 shrink-0 place-items-center">
                  <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
                    <circle cx="24" cy="24" r="21" fill="none" stroke="var(--color-line)" strokeWidth="2" />
                    <circle cx="24" cy="24" r="21" fill="none" stroke={lang === 'ar' ? '#e9a640' : '#7d9bb8'} strokeWidth="2" strokeDasharray={`${p * 132} 132`} strokeLinecap="round" />
                  </svg>
                  <span className="font-serif text-[20px]">{u.n}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px]">{u.title}</div>
                  <div className="truncate text-[12.5px] text-faint">{u.goal}</div>
                </div>
                <div className="font-mono text-[10.5px] text-faint tnum">{u.learned}/{u.cards.length}</div>
              </li>
            )
          })}
        </ol>
      )}

      {view === 'historias' && <Stories lang={lang} />}
      {view === 'ella' && <ForHer lang={lang} />}
      {view === 'claves' && (lang === 'ar' ? <Alphabet /> : <FrenchKeys />)}
      {view === 'recursos' && <Resources lang={lang} />}

      <Sheet open={unit !== null} onClose={() => setUnit(null)}>
        {unit !== null && (() => {
          const u = units.find((x) => x.n === unit)!
          return (
            <div className="pb-4">
              <Kicker>Unidad {u.n}{u.grammar ? ` · ${u.grammar}` : ''}</Kicker>
              <h2 className="mt-1 font-serif text-[34px] leading-tight">{u.title}</h2>
              <p className="mb-4 text-[14px] text-dim">{u.goal}</p>
              {(() => {
                const practice = () => { setUnit(null); setSession({ mode: 'lesson', ids: u.cards.map((c) => c.id), title: u.title }) }
                const listen = () => { setUnit(null); setSession({ mode: 'listen', ids: u.cards.map((c) => c.id), title: u.title }) }
                const lesson = lessonFor(lang, u.n)
                return lesson ? <LessonView lesson={lesson} lang={lang} onPractice={practice} onListen={listen} /> : (
                  <div className="mb-5 flex gap-2">
                    <Btn className="flex-1" onClick={practice}>Practicar</Btn>
                    <Btn kind="line" onClick={listen}>Escuchar</Btn>
                  </div>
                )
              })()}
              <div className="mt-6 mb-1"><Kicker>Frases de la unidad · {u.cards.length}</Kicker></div>
              <ul className="divide-y divide-line">
                {u.cards.map((c) => (
                  <li key={c.id} onClick={() => speak(c, lang)} className="flex cursor-pointer items-baseline justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[15.5px]">{c.t}{c.alt && <span className="text-faint"> · {c.alt}</span>}</div>
                      <div className="text-[12.5px] text-faint">{c.es}{c.pron && <span className="font-mono"> · {c.pron}</span>}</div>
                    </div>
                    {known.has(c.id) && <span className="text-[11px] text-ok">●</span>}
                  </li>
                ))}
              </ul>
            </div>
          )
        })()}
      </Sheet>
    </Screen>
  )
}

function Stories({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState<Story | null>(null)
  const list = stories(lang)
  return (
    <div>
      <p className="mb-4 text-[14px] leading-relaxed text-dim">Historias cortas graduadas: léelas, escúchalas y contesta. Es la forma más rápida de entender sin traducir en la cabeza.</p>
      {!list.length && <p className="py-6 text-center text-[13.5px] text-faint">Las historias se están escribiendo.</p>}
      <div className="grid gap-2">
        {list.map((s) => (
          <Card key={s.id} onClick={() => setOpen(s)}>
            <div className="flex items-baseline justify-between"><span className="text-[15.5px]">{s.title}</span><span className="font-mono text-[10.5px] text-faint">nivel {s.level}</span></div>
            <div className="mt-0.5 text-[12.5px] text-faint">{s.lines.length} líneas · {s.questions.length} preguntas</div>
          </Card>
        ))}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)}>{open && <StoryView story={open} lang={lang} onClose={() => setOpen(null)} />}</Sheet>
    </div>
  )
}

function Alphabet() {
  const a = PACKS.ar.alphabet ?? []
  return (
    <div>
      <p className="mb-4 text-[14px] leading-relaxed text-dim">Los números son letras que no existen en el alfabeto latino. Tócalas para oírlas.</p>
      <div className="grid grid-cols-2 gap-2">
        {a.map((x) => (
          <Card key={x.char} onClick={() => speak({ t: x.example, script: x.script.split(' ')[0] }, 'ar')} className="!p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-serif text-[40px] leading-none">{x.char}</span>
              <span className="text-[22px] text-dim">{x.script.split(' ')[0]}</span>
            </div>
            <div className="mt-2 text-[12.5px] leading-snug text-dim">{x.sound}</div>
            <div className="mt-2 font-mono text-[11px] text-sun">{x.example}</div>
            <div className="text-[11px] text-faint">{x.exampleEs}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function FrenchKeys() {
  const p = PACKS.fr
  return (
    <div className="space-y-8">
      <section>
        <Kicker>Cognados: de español a francés</Kicker>
        <ul className="mt-2 divide-y divide-line">
          {p.cognates?.map((c, i) => <li key={i} className="py-2.5"><div className="text-[15px]">{c.rule}</div><div className="text-[12.5px] text-faint">{c.examples}</div></li>)}
        </ul>
      </section>
      <section>
        <Kicker>Falsos amigos</Kicker>
        <ul className="mt-2 divide-y divide-line">
          {p.falseFriends?.map((f, i) => (
            <li key={i} className="py-2.5"><div className="text-[15px]">{f.fr} <span className="text-faint">≠ {f.looksLike}</span></div><div className="text-[12.5px] text-dim">{f.means}</div></li>
          ))}
        </ul>
      </section>
      <section>
        <Kicker>Francés de WhatsApp</Kicker>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {p.chatAbbr?.map((c, i) => (
            <div key={i} className="rounded-xl border border-line px-3 py-2">
              <div className="font-mono text-[15px] text-blue">{c.short}</div>
              <div className="text-[12px] text-dim">{c.full}</div>
              <div className="text-[11.5px] text-faint">{c.es}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Resources({ lang }: { lang: Lang }) {
  const r = (guia.idiomas.recursos[lang] ?? []).filter((x) => x.type !== 'tutor')
  const m = guia.idiomas.musica[lang] ?? []
  const types = [...new Set(r.map((x) => x.type))]
  return (
    <div className="space-y-8">
      <section>
        <Kicker>Música por semana</Kicker>
        <ul className="mt-2 divide-y divide-line">
          {m.map((x, i) => (
            <li key={i} className="py-3">
              <div className="flex items-baseline justify-between gap-3"><span className="text-[15.5px]">{x.artist}</span><span className="shrink-0 font-mono text-[10.5px] text-faint">sem {x.weeks}</span></div>
              <div className="text-[13px] text-dim">{x.songs}</div>
              <div className="text-[12px] text-faint">{x.why}</div>
            </li>
          ))}
        </ul>
      </section>
      {types.map((t) => (
        <section key={t}>
          <Kicker>{t}</Kicker>
          <ul className="mt-2 divide-y divide-line">
            {r.filter((x) => x.type === t).map((x, i) => (
              <li key={i} className="py-2.5"><div className="text-[15px]">{x.name}</div>{x.note && <div className="text-[12.5px] text-faint">{x.note}</div>}</li>
            ))}
          </ul>
        </section>
      ))}
      <section>
        <Kicker>Técnicas</Kicker>
        <ul className="mt-2 divide-y divide-line">
          {guia.idiomas.tecnicas.map((x, i) => <li key={i} className="py-2.5"><div className="text-[15px]">{x.name}</div><div className="text-[12.5px] leading-relaxed text-dim">{x.how}</div></li>)}
        </ul>
      </section>
    </div>
  )
}
