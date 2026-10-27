/**
 * Texto exacto que se lee en voz alta y nombre estable de su MP3.
 * Lo usan la app y scripts/audio-list.ts: si cambias algo aquí, regenera el audio.
 */
export type Speakable = { t: string; script?: string }

export function spokenText(item: Speakable, lang: 'ar' | 'fr') {
  let s = lang === 'ar' ? item.script ?? '' : item.t
  s = s
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ') // notas entre paréntesis
    .split(/\s+\/\s+|\s*\|\s*/)[0] // alternativas: solo la primera
    .replace(/(\S)\/\S+/g, '$1') // il/elle → il
    .replace(/\.{2,}|…/g, ' ') // huecos tipo "yalla nrou7 3a ..."
    .replace(/[_*~"«»“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s
}

/** FNV-1a de 32 bits con dos semillas sobre unidades UTF-16: 16 caracteres hex. */
export function audioKey(text: string) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ c, 0x01000193) >>> 0
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}

/** Súbelo cuando se regeneren las voces: los MP3 se guardan con caché permanente en el teléfono. */
const VOICES = 6 // 1 = Edge masculina, 2-3 = Gemini Kore, 4 = Kore + Layla/Denise interinas, 5 = francés completo en Kore, 6 = +24 árabe; súbelo en cada tanda nueva

export const audioUrl = (item: Speakable, lang: 'ar' | 'fr') => {
  const text = spokenText(item, lang)
  return text ? `/audio/${lang}/${audioKey(text)}.mp3?v=${VOICES}` : null
}
