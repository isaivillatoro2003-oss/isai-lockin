import { audioUrl, spokenText, type Speakable } from './audioKey'

let voices: SpeechSynthesisVoice[] = []
function load() { voices = window.speechSynthesis?.getVoices() ?? [] }
if (typeof window !== 'undefined' && window.speechSynthesis) {
  load()
  window.speechSynthesis.onvoiceschanged = load
}

const PREF: Record<string, string[]> = { ar: ['ar-LB', 'ar-SY', 'ar-JO', 'ar-PS', 'ar'], fr: ['fr-FR', 'fr'] }

function voiceFor(lang: 'ar' | 'fr') {
  if (!voices.length) load()
  for (const p of PREF[lang]) {
    const v = voices.find((x) => x.lang.replace('_', '-').toLowerCase().startsWith(p.toLowerCase()))
    if (v) return v
  }
  return null
}

/** Respaldo: la voz del sistema, solo si falta el MP3 (por ejemplo, traducciones nuevas de la IA). */
function system(text: string, lang: 'ar' | 'fr') {
  const synth = window.speechSynthesis
  if (!synth) return Promise.resolve()
  synth.cancel()
  return new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    const v = voiceFor(lang)
    if (v) u.voice = v
    u.lang = v?.lang ?? (lang === 'ar' ? 'ar' : 'fr-FR')
    u.rate = 0.85
    u.onend = u.onerror = () => resolve()
    synth.speak(u)
  })
}

/* Un solo elemento de audio: en iPhone, una vez que suena con un toque, puede volver a sonar sin otro toque. */
let player: HTMLAudioElement | null = null
let turn = 0

export function stopSpeaking() {
  turn++
  player?.pause()
  window.speechSynthesis?.cancel()
}

/**
 * Lee en voz alta con el MP3 pregenerado (voz neuronal de Edge). En árabe lee el campo script.
 * Termina cuando acaba el audio, así se pueden encadenar líneas.
 */
export function speak(item: Speakable, lang: 'ar' | 'fr') {
  const text = spokenText(item, lang)
  const url = audioUrl(item, lang)
  if (!text || !url) return Promise.resolve()
  stopSpeaking()
  const mine = turn
  player ??= new Audio()
  const a = player
  return new Promise<void>((resolve) => {
    let settled = false
    const finish = (useSystem: boolean) => {
      if (settled) return
      settled = true
      a.onended = a.onerror = null
      if (useSystem && mine === turn) system(text, lang).then(resolve)
      else resolve()
    }
    const done = () => finish(false)
    const fallback = () => finish(true)
    a.onended = done
    a.onerror = fallback
    a.src = url
    a.play().catch((e: unknown) => (e instanceof DOMException && e.name === 'AbortError' ? done() : fallback()))
  })
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
