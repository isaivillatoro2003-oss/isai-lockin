import Dexie, { type Table } from 'dexie'

/* Todo lleva updatedAt para la sincronización entre dispositivos de la versión en Vercel. */

export type Status = 'hecho' | 'minima' | 'saltado'

export interface DayRow { date: string; templateId: string; updatedAt: number }
export interface LogRow { id: string; date: string; blockId: string; status: Status; at: number; updatedAt: number }
export interface MetricRow { id: string; date: string; type: 'peso' | 'cintura'; value: number; updatedAt: number }
export interface PhotoRow { id: string; date: string; pose: 'frente' | 'perfil' | 'espalda' | 'cara'; blob: Blob; updatedAt: number }
export interface MealRow { id: string; date: string; slot: 1 | 2 | 3 | 4; time: string; text: string; tags: string[]; rating?: 1 | 2 | 3; updatedAt: number }
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
export interface PhraseRow { id: string; es: string; t: string; done: boolean; updatedAt: number }
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
  }
}

export const db = new LockinDB()
export const uid = () => crypto.randomUUID()
export const now = () => Date.now()

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const r = await db.settings.get(key)
  return (r?.value as T) ?? fallback
}
export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value, updatedAt: now() })

export async function setStatus(date: string, blockId: string, status: Status | null) {
  const id = `${date}|${blockId}`
  if (!status) return db.logs.delete(id)
  return db.logs.put({ id, date, blockId, status, at: now(), updatedAt: now() })
}

export async function seedHabits() {
  if (await db.habits.count()) return
  const since = '2026-10-29'
  await db.habits.bulkPut(
    ['Porno', 'Alcohol', 'Redes de scroll', 'Azúcar y refresco'].map((name) => ({ id: uid(), name, cleanSince: since, updatedAt: now() })),
  )
}

export async function requestPersist() {
  try { return (await navigator.storage?.persist?.()) ?? false } catch { return false }
}
