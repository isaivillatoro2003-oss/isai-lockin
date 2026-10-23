import guiaJson from './guia.json'
import bloquesJson from './bloques.json'
import type { Bloques, Guia } from './types'

export const guia = guiaJson as unknown as Guia
export const bloques = bloquesJson as unknown as Bloques
export const workout = (id: string) => guia.workouts.find((w) => w.id === id)
