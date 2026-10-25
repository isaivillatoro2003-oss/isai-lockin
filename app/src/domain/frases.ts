import { FRASES, type Frase } from '../content/frases'

/* Rotación por teléfono: la misma frase todo el día en cada momento, y no se repite hasta pasar ~90 frases. */
const RECENT = 'frases:recent'
const MEMORY = 90

function get<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v === null ? fallback : (JSON.parse(v) as T) } catch { return fallback }
}
function put(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento: rota igual, solo sin memoria */ }
}

export function frase(date: string, slot: string): Frase {
  const key = `frase:${date}:${slot}`
  const saved = get<number | null>(key, null)
  if (saved !== null && FRASES[saved]) return FRASES[saved]
  const recent = get<number[]>(RECENT, [])
  const pool = FRASES.map((_, i) => i).filter((i) => !recent.includes(i))
  const i = pool[Math.floor(Math.random() * pool.length)] ?? 0
  put(key, i)
  put(RECENT, [...recent, i].slice(-MEMORY))
  return FRASES[i]
}

export const wakeSeen = (date: string) => get(`frase:${date}:wake:ok`, false)
export const markWakeSeen = (date: string) => put(`frase:${date}:wake:ok`, true)
