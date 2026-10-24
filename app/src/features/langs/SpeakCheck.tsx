import { useState } from 'react'
import { checkSpeech, type SpeakCheck as Result } from '../../ai'
import { canRecognize, recognize } from '../../domain/speech'
import { localSpeechScore } from '../../domain/srs'

/** "Dilo tú": escucha tu pronunciación y la califica contra la frase objetivo. */
export default function SpeakCheck({ lang, t, script }: { lang: 'ar' | 'fr'; t: string; script?: string }) {
  const [state, setState] = useState<'idle' | 'listening' | 'checking'>('idle')
  const [res, setRes] = useState<Result | null>(null)
  const [err, setErr] = useState('')

  if (!canRecognize()) return null

  const go = async () => {
    setErr(''); setRes(null); setState('listening')
    try {
      const heard = await recognize(lang)
      setState('checking')
      try {
        setRes(await checkSpeech(lang, t, heard, script))
      } catch {
        // Sin IA (sin internet o sin cuota): calificación local comparando con la frase.
        const score = localSpeechScore(lang, heard, t, script)
        setRes({
          score, heard,
          feedback: score >= 4 ? 'Se entendió casi igual a la frase.' : score >= 3 ? 'Se entendió en parte; repite más lento y marcando cada sonido.' : 'No se reconoció bien; escucha el audio otra vez y repite por partes.',
          tips: ['Revisión sin IA: compara lo que el teléfono entendió con la frase.'],
        })
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Algo falló.')
    } finally {
      setState('idle')
    }
  }

  const color = res ? (res.score >= 4 ? '#9cb380' : res.score >= 3 ? '#e9a640' : '#c9705a') : undefined
  return (
    <div className="mt-4">
      <button onClick={go} disabled={state !== 'idle'}
        className={`flex w-full items-center justify-center gap-2 rounded-full border py-3 text-[14px] transition ${state === 'listening' ? 'border-bad text-bad' : 'border-line text-dim'}`}>
        <span className={`h-2.5 w-2.5 rounded-full bg-bad ${state === 'listening' ? 'animate-pulse' : ''}`} />
        {state === 'listening' ? 'Te escucho… di la frase' : state === 'checking' ? 'Revisando…' : 'Dilo tú y revisa tu pronunciación'}
      </button>
      {err && <p className="mt-2 text-[12.5px] text-bad">{err}</p>}
      {res && (
        <div className="mt-3 rounded-2xl border p-4" style={{ borderColor: `${color}66` }}>
          <div className="flex items-baseline justify-between">
            <span className="font-serif text-[34px] leading-none" style={{ color }}>{res.score}/5</span>
            <span className="truncate pl-3 text-[12px] text-faint">Entendí: {res.heard || 'nada'}</span>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed">{res.feedback}</p>
          <ul className="mt-2 space-y-1">{res.tips.map((x, i) => <li key={i} className="text-[13px] text-dim">· {x}</li>)}</ul>
        </div>
      )}
    </div>
  )
}
