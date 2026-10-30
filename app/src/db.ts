import Dexie, { type Table } from 'dexie'
import type { FoodCheck } from './ai'

/* Todo lleva updatedAt para la sincronización entre dispositivos de la versión en Vercel. */

export type Status = 'hecho' | 'minima' | 'saltado'

export interface DayRow { date: string; templateId: string; updatedAt: number }
export interface LogRow { id: string; date: string; blockId: string; status: Status; at: number; updatedAt: number }
export interface MetricRow { id: string; date: string; type: 'peso' | 'cintura' | 'hombros'; value: number; updatedAt: number }
export interface PhotoRow { id: string; date: string; pose: 'frente' | 'perfil' | 'espalda' | 'cara'; blob: Blob; updatedAt: number }
export interface MealRow {
  id: string; date: string; slot: 1 | 2 | 3 | 4; time: string; text: string; tags: string[]; rating?: 1 | 2 | 3; updatedAt: number
  photo?: Blob; ai?: FoodCheck; desc?: string
}
export interface JournalRow {
  date: string; good: string; bad: string; tomorrow: string
  mood: number; energy: number; craving: number; cravingWhat: string; sleep?: number; updatedAt: number
}
export interface HabitRow { id: string; name: string; cleanSince: string; updatedAt: number }
export interface RelapseRow { id: string; habitId: string; date: string; trigger: string; response: string; updatedAt: number }
export interface CardStateRow {
  cardId: string; lang: 'ar' | 'fr'; due: number; stability: number; difficulty: number
  elapsed_days: number; scheduled_days: number; learning_steps: number; reps: number; lapses: number
  state: number; last_review?: number; updatedAt: number
}
export interface ReviewRow { id: string; cardId: string; rating: number; at: number; updatedAt: number }
export interface LessonRow { id: string; doneAt: number; score: number; updatedAt: number }
export interface RecordingRow { id: string; cardId: string; blob: Blob; at: number; updatedAt: number }
export interface PhraseRow {
  id: string; es: string; t: string; done: boolean; updatedAt: number
  lang?: 'ar' | 'fr'; chat?: string; pron?: string; script?: string; note?: string
}
export interface SettingRow { key: string; value: unknown; updatedAt: number }

class LockinDB extends Dexie {
  days!: Table<DayRow, string>
  logs!: Table<LogRow, string>
  metrics!: Table<MetricRow, string>
  photos!: Table<PhotoRow, string>
  meals!: Table<MealRow, string>
  journal!: Table<JournalRow, string>
  habits!: Table<HabitRow, string>
  relapses!: Table<RelapseRow, string>
  cardStates!: Table<CardStateRow, string>
  reviews!: Table<ReviewRow, string>
  lessons!: Table<LessonRow, string>
  recordings!: Table<RecordingRow, string>
  phrases!: Table<PhraseRow, string>
  settings!: Table<SettingRow, string>
  tombstones!: Table<TombstoneRow, string>

  constructor() {
    super('lockin')
    this.version(1).stores({
      days: 'date',
      logs: 'id, date',
      metrics: 'id, date, type, [type+date]',
      photos: 'id, date, pose',
      meals: 'id, date',
      journal: 'date',
      habits: 'id',
      relapses: 'id, habitId, date',
      cardStates: 'cardId, lang, due, [lang+due]',
      reviews: 'id, cardId, at',
      lessons: 'id',
      recordings: 'id, cardId',
      phrases: 'id',
      settings: 'key',
    })
    // v2: registro de borrados para que la sincronización también borre en el otro dispositivo.
    this.version(2).stores({ tombstones: 'id, updatedAt' })
  }
}

export interface TombstoneRow { id: string; table: string; pk: string; updatedAt: number }

export const db = new LockinDB()
export const uid = () => crypto.randomUUID()
export const now = () => Date.now()

/** Tablas que se sincronizan entre dispositivos. */
export const SYNCED = ['days', 'logs', 'metrics', 'photos', 'meals', 'journal', 'habits', 'relapses', 'cardStates', 'reviews', 'lessons', 'recordings', 'phrases', 'settings'] as const

/** Borra y deja constancia para que el borrado viaje al otro dispositivo. */
export async function remove(table: (typeof SYNCED)[number], pk: string) {
  await db.transaction('rw', db.table(table), db.tombstones, async () => {
    await db.table(table).delete(pk)
    await db.tombstones.put({ id: `${table}|${pk}`, table, pk, updatedAt: now() })
  })
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const r = await db.settings.get(key)
  return (r?.value as T) ?? fallback
}
export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value, updatedAt: now() })

export interface Water { done: string[]; extra: number }
export const waterKey = (date: string) => `agua:${date}`
export async function toggleWater(date: string, blockId: string) {
  const w = await getSetting<Water>(waterKey(date), { done: [], extra: 0 })
  const done = w.done.includes(blockId) ? w.done.filter((x) => x !== blockId) : [...w.done, blockId]
  return setSetting(waterKey(date), { ...w, done })
}
export async function addWater(date: string, ml: number) {
  const w = await getSetting<Water>(waterKey(date), { done: [], extra: 0 })
  return setSetting(waterKey(date), { ...w, extra: Math.max(0, w.extra + ml) })
}

export async function setStatus(date: string, blockId: string, status: Status | null) {
  const id = `${date}|${blockId}`
  if (!status) return remove('logs', id)
  return db.logs.put({ id, date, blockId, status, at: now(), updatedAt: now() })
}

const HABITS = ['Porno', 'Alcohol', 'Redes de scroll', 'Azúcar y refresco']
let seeding: Promise<void> | null = null

/** Ids fijos por nombre: así abrir la app dos veces nunca duplica categorías. Limpia duplicados viejos. */
export function seedHabits() {
  seeding ??= db.transaction('rw', db.habits, async () => {
    const all = await db.habits.toArray()
    const keep = new Map<string, (typeof all)[number]>()
    for (const h of all.sort((a, b) => a.cleanSince.localeCompare(b.cleanSince))) {
      if (keep.has(h.name)) await remove('habits', h.id)
      else keep.set(h.name, h)
    }
    for (const name of HABITS) {
      if (!keep.has(name)) await db.habits.put({ id: `h-${name.toLowerCase().replace(/\W+/g, '-')}`, name, cleanSince: '2026-10-29', updatedAt: now() })
    }
  })
  return seeding
}

export async function requestPersist() {
  try { return (await navigator.storage?.persist?.()) ?? false } catch { return false }
}
