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
