/* Cliente de /api/ai. Los tipos de respuesta son espejo de los esquemas de api/_core.ts. */

export interface Translation {
  t: string; chat: string; pron: string; script: string; literal: string
  words: { t: string; es: string }[]; alternatives: { t: string; when: string }[]; note: string
}
export interface FoodCheck {
  plato: string; kcal: number; proteinaG: number; carbosG: number; grasaG: number
  veredicto: 'bien' | 'regular' | 'mal'; resumen: string; bien: string[]; mejorar: string[]
}
export interface SpeakCheck { score: number; heard: string; feedback: string; tips: string[] }

async function call<T>(body: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error('Sin conexión. Esto necesita internet.')
  }
  const j = await r.json().catch(() => ({ error: 'Respuesta inválida del servidor.' }))
  if (!r.ok) throw new Error(j.error ?? 'Error del servidor.')
  return j as T
}

export const translate = (text: string, lang: 'ar' | 'fr', to?: 'm' | 'f') => call<Translation>({ task: 'translate', text, lang, to })
export const checkFood = (image: string, mime: string, slot: string, time: string) => call<FoodCheck>({ task: 'food', image, mime, slot, time })
export const checkSpeech = (lang: 'ar' | 'fr', target: string, heard: string, script?: string) =>
  call<SpeakCheck>({ task: 'speak', lang, target, heard, script })

/** Reduce una foto a JPEG de 1024 px y la devuelve en base64 sin prefijo. */
export async function photoToBase64(file: File, max = 1024) {
  const img = await createImageBitmap(file)
  const s = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82).split(',')[1]
}
