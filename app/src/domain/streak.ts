import { db, type LogRow } from '../db'
import { TEMPLATES, defaultTemplate } from './schedule'
import { addDays, clock } from './time'

/** Un día cuenta si todos sus bloques núcleo están en hecho o mínima. */
export function dayComplete(templateId: string, logs: LogRow[]) {
  const done = new Set(logs.filter((l) => l.status !== 'saltado').map((l) => l.blockId))
  return TEMPLATES[templateId].blocks.filter((b) => b.core).every((b) => done.has(b.id))
}

export function dayPct(templateId: string, logs: LogRow[]) {
  const blocks = TEMPLATES[templateId].blocks
  const done = new Set(logs.filter((l) => l.status !== 'saltado').map((l) => l.blockId))
  return blocks.length ? blocks.filter((b) => done.has(b.id)).length / blocks.length : 0
}

/**
 * Racha: días seguidos completos. Hoy suma si ya está completo.
 * Ayer sigue abierto hasta las 12:00 de hoy (gracia), así que no rompe la racha antes de esa hora.
 */
export async function computeStreak() {
  const { date: today, min } = clock()
  const [logs, days] = await Promise.all([db.logs.toArray(), db.days.toArray()])
  const byDate = new Map<string, LogRow[]>()
  for (const l of logs) byDate.set(l.date, [...(byDate.get(l.date) ?? []), l])
  const tplOf = new Map(days.map((d) => [d.date, d.templateId]))
  const ok = (d: string) => dayComplete(tplOf.get(d) ?? defaultTemplate(d), byDate.get(d) ?? [])

  let streak = ok(today) ? 1 : 0
  let d = addDays(today, -1)
  if (!ok(d) && min < 12 * 60) d = addDays(d, -1) // ayer aún en gracia
  for (let i = 0; i < 400 && ok(d); i++) { streak++; d = addDays(d, -1) }
  return streak
}
