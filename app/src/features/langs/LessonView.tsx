import { useRef, useState } from 'react'
import type { Lesson, Line, Story } from '../../content/types'
import { speak, stopSpeaking } from '../../domain/speech'
import { Btn, Kicker } from '../../ui'

/** Línea tocable: se oye y muestra lectura y traducción. */
export function LineRow({ l, lang, showEs = true }: { l: Line; lang: 'ar' | 'fr'; showEs?: boolean }) {
  const [es, setEs] = useState(showEs)
  return (
    <button onClick={() => { speak(l, lang); setEs(true) }} className="block w-full py-2.5 text-left">
      {l.who && <span className="mr-2 font-mono text-[10.5px] uppercase tracking-wider text-sun">{l.who}</span>}
      <span className="text-[16px]">{l.t}</span>
      {l.pron && <div className="font-mono text-[11.5px] text-faint">{l.pron}</div>}
      {es && <div className="text-[13px] text-dim">{l.es}</div>}
    </button>
  )
}

/** Reproduce un diálogo línea por línea. */
function useAutoplay(lines: Line[], lang: 'ar' | 'fr') {
  const [i, setI] = useState(-1)
  const stop = useRef(false)
  const play = async () => {
    stop.current = false
    for (let k = 0; k < lines.length && !stop.current; k++) {
      setI(k)
      await speak(lines[k], lang)
      await new Promise((r) => setTimeout(r, 500))
    }
    setI(-1)
  }
  return { i, play, stop: () => { stop.current = true; stopSpeaking(); setI(-1) } }
}

export default function LessonView({ lesson, lang, onPractice, onListen }: { lesson: Lesson; lang: 'ar' | 'fr'; onPractice: () => void; onListen: () => void }) {
  const dlg = useAutoplay(lesson.dialogue, lang)
  return (
    <div className="space-y-7 pb-4">
      <div className="space-y-3">
        {lesson.explain.map((p, i) => <p key={i} className="text-[15px] leading-[1.65]">{p}</p>)}
      </div>

      {lesson.table && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-[13.5px]">
            <thead><tr>{lesson.table.head.map((h) => <th key={h} className="border-b border-line px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wider text-faint">{h}</th>)}</tr></thead>
            <tbody>
              {lesson.table.rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0">{r.map((c, j) => <td key={j} className={`px-3 py-2 ${j === 0 ? 'text-dim' : ''}`}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lesson.examples.length > 0 && (
        <section>
          <Kicker>Ejemplos · toca para oír</Kicker>
          <div className="mt-1 divide-y divide-line">{lesson.examples.map((l, i) => <LineRow key={i} l={l} lang={lang} />)}</div>
        </section>
      )}

      {lesson.dialogue.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <Kicker>Diálogo</Kicker>
            <button onClick={dlg.i >= 0 ? dlg.stop : dlg.play} className="rounded-full border border-line px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-dim">
              {dlg.i >= 0 ? 'Parar' : 'Reproducir todo'}
            </button>
          </div>
          <div className="mt-1 divide-y divide-line">
            {lesson.dialogue.map((l, i) => (
              <div key={i} className={`transition ${dlg.i === i ? 'bg-sun/10' : ''}`}><LineRow l={l} lang={lang} showEs={false} /></div>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-faint">Toca cada línea para ver la traducción. Primero intenta entender sin ella.</p>
        </section>
      )}

      {lesson.practice.length > 0 && (
        <section className="rounded-2xl border border-sun/40 p-4">
          <Kicker color="#e9a640">Reto de hoy</Kicker>
          <ul className="mt-2 space-y-2">{lesson.practice.map((p, i) => <li key={i} className="text-[14.5px] leading-relaxed">{p}</li>)}</ul>
        </section>
      )}

      <div className="flex gap-2">
        <Btn className="flex-1" onClick={onPractice}>Practicar</Btn>
        <Btn kind="line" onClick={onListen}>Escuchar</Btn>
      </div>
    </div>
  )
}

export function StoryView({ story, lang, onClose }: { story: Story; lang: 'ar' | 'fr'; onClose: () => void }) {
  const [es, setEs] = useState(false)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const read = useAutoplay(story.lines, lang)
  const right = story.questions.filter((q, i) => answers[i] === q.answer).length
  return (
    <div className="pb-4">
      <Kicker>Historia · nivel {story.level}</Kicker>
      <h2 className="mt-1 mb-4 font-serif text-[32px] leading-tight">{story.title}</h2>
      <div className="mb-3 flex gap-2">
        <button onClick={read.i >= 0 ? read.stop : read.play} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-dim">{read.i >= 0 ? 'Parar' : 'Leer en voz alta'}</button>
        <button onClick={() => setEs(!es)} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-dim">{es ? 'Ocultar español' : 'Ver español'}</button>
      </div>
      <div className="divide-y divide-line">
        {story.lines.map((l, i) => <div key={i} className={read.i === i ? 'bg-sun/10' : ''}><LineRow l={l} lang={lang} showEs={es} /></div>)}
      </div>
      <div className="mt-8"><Kicker>¿Entendiste?</Kicker></div>
      {story.questions.map((q, i) => (
        <div key={i} className="mt-4">
          <p className="text-[15px]">{q.q}</p>
          <div className="mt-2 grid gap-1.5">
            {q.options.map((o, j) => {
              const picked = answers[i] === j, done = answers[i] !== undefined
              const c = done && j === q.answer ? '#9cb380' : picked ? '#c9705a' : 'var(--color-line)'
              return <button key={j} disabled={done} onClick={() => setAnswers({ ...answers, [i]: j })} className="rounded-xl border px-3 py-2.5 text-left text-[14px]" style={{ borderColor: c }}>{o}</button>
            })}
          </div>
        </div>
      ))}
      {Object.keys(answers).length === story.questions.length && story.questions.length > 0 && (
        <p className="mt-5 font-serif text-[26px]">{right} de {story.questions.length}</p>
      )}
      <Btn kind="line" className="mt-6 w-full" onClick={onClose}>Cerrar</Btn>
    </div>
  )
}
