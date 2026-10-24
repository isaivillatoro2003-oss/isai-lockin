import type { Card } from '../content/types'

let voices: SpeechSynthesisVoice[] = []
function load() { voices = window.speechSynthesis?.getVoices() ?? [] }
if (typeof window !== 'undefined' && window.speechSynthesis) {
  load()
  window.speechSynthesis.onvoiceschanged = load
}

const PREF: Record<string, string[]> = { ar: ['ar-LB', 'ar-SY', 'ar-JO', 'ar-PS', 'ar'], fr: ['fr-FR', 'fr'] }

export function voiceFor(lang: 'ar' | 'fr') {
  if (!voices.length) load()
  for (const p of PREF[lang]) {
    const v = voices.find((x) => x.lang.replace('_', '-').toLowerCase().startsWith(p.toLowerCase()))
    if (v) return v
  }
  return null
}

export const hasVoice = (lang: 'ar' | 'fr') => !!voiceFor(lang)

/** El TTS no lee Arabizi: en árabe usa el campo script. */
export function speak(card: Pick<Card, 't' | 'script'>, lang: 'ar' | 'fr', rate = 0.85) {
  const synth = window.speechSynthesis
  if (!synth) return
  const text = lang === 'ar' ? (card.script ?? '').replace(/\([^)]*\)/g, '') : card.t.replace(/\([^)]*\)/g, '').split('/')[0]
  if (!text.trim()) return
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const v = voiceFor(lang)
  if (v) u.voice = v
  u.lang = v?.lang ?? (lang === 'ar' ? 'ar' : 'fr-FR')
  u.rate = rate
  synth.speak(u)
}

type Rec = { lang: string; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }

export const canRecognize = () => typeof window !== 'undefined' && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)

/**
 * Escucha una frase con el reconocedor del teléfono y devuelve lo que entendió.
 * En iPhone usa el dictado de Safari: necesita internet y permiso de micrófono.
 */
export function recognize(lang: 'ar' | 'fr') {
  const W = window as unknown as Record<string, new () => Rec>
  const R = W.SpeechRecognition || W.webkitSpeechRecognition
  if (!R) return Promise.reject(new Error('Este navegador no reconoce voz. Usa Safari en el iPhone.'))
  return new Promise<string>((resolve, reject) => {
    const r = new R()
    r.lang = lang === 'ar' ? 'ar-LB' : 'fr-FR'
    r.interimResults = false
    r.maxAlternatives = 1
    let text = ''
    r.onresult = (e) => { text = Array.from(e.results).map((x) => x[0].transcript).join(' ') }
    r.onerror = (e) => { if (e.error !== 'no-speech') reject(new Error(`No pude escucharte (${e.error}).`)) }
    r.onend = () => resolve(text)
    r.start()
  })
}

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const rec = new MediaRecorder(stream)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => chunks.push(e.data)
  rec.start()
  return () => new Promise<Blob>((resolve) => {
    rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); resolve(new Blob(chunks, { type: rec.mimeType })) }
    rec.stop()
  })
}
