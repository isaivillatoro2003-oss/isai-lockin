import guiaJson from './guia.json'
import bloquesJson from './bloques.json'
import type { Bloques, Entreno, Guia, MorePack, Receta } from './types'

export const guia = guiaJson as unknown as Guia
export const bloques = bloquesJson as unknown as Bloques
export const workout = (id: string) => guia.workouts.find((w) => w.id === id)

/* Contenido que llega por partes (subagentes y la sesión de recetas): opcional hasta que exista el archivo. */
const extra = import.meta.glob('./{recetas,entreno,ar-mas,fr-mas}.json', { eager: true, import: 'default' }) as Record<string, unknown>
const EMPTY: MorePack = { units: [], cards: [], lessons: [], stories: [] }

export const recetas = (extra['./recetas.json'] ?? []) as Receta[]
export const entreno = (extra['./entreno.json'] ?? { ejercicios: {}, programas: {} }) as Entreno
export const more = {
  ar: { ...EMPTY, ...(extra['./ar-mas.json'] as Partial<MorePack> | undefined) },
  fr: { ...EMPTY, ...(extra['./fr-mas.json'] as Partial<MorePack> | undefined) },
}
