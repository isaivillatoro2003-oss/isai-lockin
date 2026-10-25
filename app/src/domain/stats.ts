import { db, getSetting, waterKey, type LogRow, type Water } from '../db'
import { TEMPLATES, defaultTemplate, type Block, type Cat } from './schedule'
import { addDays, clock, toMin } from './time'

/*
 * Estadísticas del día y de la semana. Las áreas agrupan categorías del horario; cada una tiene
 * un color fijo validado para fondo oscuro (orden de la paleta categórica de la guía de gráficas).
 */

export type Area = 'fr' | 'mov' | 'comida' | 'ar' | 'pam' | 'uni' | 'cuidado'

export const AREAS: { id: Area; label: string; color: string }[] = [
  { id: 'fr', label: 'Francés', color: '#3987e5' },
  { id: 'mov', label: 'Movimiento', color: '#d95926' },
  { id: 'comida', label: 'Comida', color: '#199e70' },
  { id: 'ar', label: 'Árabe', color: '#c98500' },
  { id: 'pam', label: 'Pam', color: '#d55181' },
  { id: 'uni', label: 'Uni', color: '#008300' },
  { id: 'cuidado', label: 'Cuidado y sueño', color: '#9085e9' },
]

const AREA_OF: Record<Cat, Area> = {
  fr: 'fr', ejercicio: 'mov', caminata: 'mov', comida: 'comida', ar: 'ar', novia: 'pam', uni: 'uni',
  glow: 'cuidado', despertar: 'cuidado', sueno: 'cuidado', diario: 'cuidado', libre: 'cuidado',
}

/** Hecho cuenta 1, versión mínima cuenta 0.5, saltado o pendiente 0. */
const credit = (s?: string) => (s === 'hecho' ? 1 : s === 'minima' ? 0.5 : 0)

export interface DayStats {
  date: string
  pct: number
  core: { done: number; total: number }
  areas: Record<Area, { done: number; total: number; pct: number }>
  langMin: { ar: number; fr: number }
  cards: number
  waterL: number
  waterGoalL: number
  missedCore: Block[]
  weight?: number
}

export async function dayStats(date: string): Promise<DayStats> {
  const [dayRow, logs, water, reviews, weight] = await Promise.all([
    db.days.get(date),
    db.logs.where('date').equals(date).toArray(),
    getSetting<Water>(waterKey(date), { done: [], extra: 0 }),
    db.reviews.where('at').between(Date.parse(`${date}T00:00:00-05:00`), Date.parse(`${date}T23:59:59-05:00`)).count(),
    db.metrics.where('[type+date]').equals(['peso', date]).first(),
  ])
  const blocks = TEMPLATES[dayRow?.templateId ?? defaultTemplate(date)].blocks
  const st = new Map(logs.map((l: LogRow) => [l.blockId, l.status]))

  const areas = Object.fromEntries(AREAS.map((a) => [a.id, { done: 0, total: 0, pct: 0 }])) as DayStats['areas']
  let sum = 0
  const langMin = { ar: 0, fr: 0 }
  for (const b of blocks) {
    const c = credit(st.get(b.id))
    const a = areas[AREA_OF[b.cat]]
    a.total++; a.done += c; sum += c
    if (b.cat === 'ar' || b.cat === 'fr') langMin[b.cat] += b.dur * c
  }
  for (const a of Object.values(areas)) a.pct = a.total ? a.done / a.total : 0

  const core = blocks.filter((b) => b.core)
  const goal = blocks.reduce((s, b) => s + (b.water ?? 0), 0)
  const drunk = blocks.filter((b) => water.done.includes(b.id)).reduce((s, b) => s + (b.water ?? 0), 0) + water.extra
  const { date: today, min } = clock()
  return {
    date,
    pct: blocks.length ? sum / blocks.length : 0,
    core: { done: core.filter((b) => credit(st.get(b.id)) > 0).length, total: core.length },
    areas, langMin, cards: reviews,
    waterL: drunk / 1000, waterGoalL: goal / 1000,
    // Solo cuentan como fallados los núcleo cuya hora ya pasó.
    missedCore: core.filter((b) => !credit(st.get(b.id)) && (date < today || (date === today && toMin(b.start) + b.dur <= min))),
    weight: weight?.value,
  }
}

export interface WeekStats {
  days: DayStats[]
  avgPct: number
  prevAvgPct: number
  fullDays: number
  langMin: number
  prevLangMin: number
  cards: number
  prevCards: number
  areaAvg: Record<Area, number>
  prevAreaAvg: Record<Area, number>
  weightDelta?: number
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function summarize(days: DayStats[]) {
  const areaAvg = Object.fromEntries(AREAS.map((a) => [a.id, avg(days.map((d) => d.areas[a.id].pct))])) as Record<Area, number>
  return {
    avgPct: avg(days.map((d) => d.pct)),
    langMin: days.reduce((s, d) => s + d.langMin.ar + d.langMin.fr, 0),
    cards: days.reduce((s, d) => s + d.cards, 0),
    areaAvg,
  }
}

/** Los 7 días que terminan en endDate (incluido) y los 7 anteriores para comparar. */
export async function weekStats(endDate: string): Promise<WeekStats> {
  const dates = Array.from({ length: 14 }, (_, i) => addDays(endDate, i - 13))
  const all = await Promise.all(dates.map(dayStats))
  const prev = all.slice(0, 7), cur = all.slice(7)
  const c = summarize(cur), p = summarize(prev)
  const w = cur.filter((d) => d.weight !== undefined)
  return {
    days: cur,
    avgPct: c.avgPct, prevAvgPct: p.avgPct,
    fullDays: cur.filter((d) => d.core.total && d.core.done === d.core.total).length,
    langMin: c.langMin, prevLangMin: p.langMin,
    cards: c.cards, prevCards: p.cards,
    areaAvg: c.areaAvg, prevAreaAvg: p.areaAvg,
    weightDelta: w.length >= 2 ? w[w.length - 1].weight! - w[0].weight! : undefined,
  }
}

/** Frase corta para el reporte del día. */
export function verdict(pct: number) {
  if (pct >= 0.95) return 'Día perfecto'
  if (pct >= 0.8) return 'Muy buen día'
  if (pct >= 0.6) return 'Buen día'
  if (pct >= 0.4) return 'Día a medias'
  return 'Día difícil'
}

