import { createEmptyCard, fsrs, Rating, type Card as FCard, type Grade } from 'ts-fsrs'
import { db, now, uid, type CardStateRow } from '../db'
import ar from '../content/ar.json'
import fr from '../content/fr.json'
import { more } from '../content'
import type { Card, LangPack } from '../content/types'

/** Paquete base + ampliación (más unidades y tarjetas), ordenado por unidad. */
function merge(base: LangPack, l: 'ar' | 'fr'): LangPack {
  const seen = new Set(base.units.map((u) => u.n))
  return {
    ...base,
    units: [...base.units, ...more[l].units.filter((u) => !seen.has(u.n))].sort((a, b) => a.n - b.n),
    cards: [...base.cards, ...more[l].cards],
  }
}
export const PACKS = { ar: merge(ar as LangPack, 'ar'), fr: merge(fr as LangPack, 'fr') }
export const lessonFor = (l: Lang, unit: number) => more[l].lessons.find((x) => x.unit === unit)
export const stories = (l: Lang) => [...more[l].stories].sort((a, b) => a.level - b.level)
export type Lang = 'ar' | 'fr'

const ALL = new Map<string, Card>()
for (const p of Object.values(PACKS)) for (const c of [...p.cards, ...(p.extra ?? [])]) ALL.set(c.id, c)
export const cardById = (id: string) => ALL.get(id)
export const allCards = (l: Lang) => [...PACKS[l].cards, ...(PACKS[l].extra ?? [])]

export const NEW_PER_DAY: Record<Lang, number> = { ar: 18, fr: 25 }

const f = fsrs({ enable_fuzz: true })

const toRow = (cardId: string, lang: Lang, c: FCard): CardStateRow => ({
  cardId, lang, due: +c.due, stability: c.stability, difficulty: c.difficulty,
  elapsed_days: c.elapsed_days, scheduled_days: c.scheduled_days, learning_steps: c.learning_steps,
  reps: c.reps, lapses: c.lapses, state: c.state, last_review: c.last_review ? +c.last_review : undefined, updatedAt: now(),
})
const fromRow = (r: CardStateRow): FCard => ({
  due: new Date(r.due), stability: r.stability, difficulty: r.difficulty, elapsed_days: r.elapsed_days,
  scheduled_days: r.scheduled_days, learning_steps: r.learning_steps, reps: r.reps, lapses: r.lapses,
  state: r.state, last_review: r.last_review ? new Date(r.last_review) : undefined,
})

export async function review(cardId: string, rating: Grade) {
  const lang = cardId.slice(0, 2) as Lang
  const row = await db.cardStates.get(cardId)
  const base = row ? fromRow(row) : createEmptyCard(new Date())
  const { card } = f.next(base, new Date(), rating)
  await db.transaction('rw', db.cardStates, db.reviews, async () => {
    await db.cardStates.put(toRow(cardId, lang, card))
    await db.reviews.put({ id: uid(), cardId, rating, at: now(), updatedAt: now() })
  })
}

export const dueCount = (l: Lang) => db.cardStates.where('[lang+due]').between([l, 0], [l, Date.now()]).count()
export const dueIds = async (l: Lang) =>
  (await db.cardStates.where('[lang+due]').between([l, 0], [l, Date.now()]).toArray()).map((r) => r.cardId)

/** Tarjetas nuevas que tocan hoy, en orden de frecuencia, descontando las ya presentadas hoy. */
export async function newIds(l: Lang) {
  const seen = new Set((await db.cardStates.where('lang').equals(l).toArray()).map((r) => r.cardId))
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const todayNew = (await db.cardStates.where('lang').equals(l).toArray()).filter((r) => r.reps <= 2 && (r.last_review ?? 0) >= +start).length
  const left = Math.max(0, NEW_PER_DAY[l] - todayNew)
  return PACKS[l].cards.filter((c) => !seen.has(c.id)).sort((a, b) => a.unit - b.unit || a.rank - b.rank).slice(0, left).map((c) => c.id)
}

/** Siguientes tarjetas sin ver, sin tope diario: para los días que quieres avanzar más. */
export async function moreIds(l: Lang, n = 10) {
  const seen = new Set((await db.cardStates.where('lang').equals(l).toArray()).map((r) => r.cardId))
  return PACKS[l].cards.filter((c) => !seen.has(c.id)).sort((a, b) => a.unit - b.unit || a.rank - b.rank).slice(0, n).map((c) => c.id)
}

export { Rating }

/* Corrector tolerante de Arabizi (sección 6.4): normaliza antes de comparar. */
export function normAr(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/7'/g, '5').replace(/3'/g, '8').replace(/kh/g, '5').replace(/gh/g, '8')
    .replace(/ch/g, 'sh').replace(/'/g, '2')
    .replace(/ou/g, 'u').replace(/o/g, 'u').replace(/e/g, 'i')
    .replace(/(.)\1+/g, '$1')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}
export function normFr(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function lev(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const t = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = t
    }
  }
  return d[b.length]
}

/* Árabe en alfabeto árabe: sin vocales marcadas y con letras que el dictado confunde unificadas. */
const normScript = (s: string) => s
  .replace(/[ً-ْٰـ]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[^ء-ي\s]/g, '').replace(/\s+/g, ' ').trim()

/**
 * Pronunciación sin IA: compara lo que entendió el dictado del teléfono con la frase objetivo.
 * Devuelve 1 a 5 según qué tan parecido es (5 = idéntico).
 */
export function localSpeechScore(lang: Lang, heard: string, t: string, script?: string) {
  const [a, targets] = lang === 'ar' && script
    ? [normScript(heard), [normScript(script)]]
    : [normFr(heard), variants(t).map(lang === 'ar' ? normAr : normFr)]
  if (!a) return 1
  const sim = Math.max(...targets.map((b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1)))
  return sim >= 0.9 ? 5 : sim >= 0.75 ? 4 : sim >= 0.55 ? 3 : sim >= 0.35 ? 2 : 1
}

/** Las variantes del campo t vienen separadas por " / ". */
export const variants = (t: string) => t.replace(/\([^)]*\)/g, '').split('/').map((x) => x.trim()).filter(Boolean)

export function check(lang: Lang, answer: string, t: string): 'ok' | 'casi' | 'mal' {
  const n = lang === 'ar' ? normAr : normFr
  const a = n(answer)
  if (!a) return 'mal'
  let best = 99, len = 1
  for (const v of variants(t)) {
    const b = n(v)
    const dd = lev(a, b)
    if (dd < best) { best = dd; len = b.length }
  }
  if (best === 0) return 'ok'
  return best <= Math.max(1, Math.floor(len / 6)) ? 'casi' : 'mal'
}
