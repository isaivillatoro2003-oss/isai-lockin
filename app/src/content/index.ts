import guiaJson from './guia.json'
import type { Guia } from './types'

export const guia = guiaJson as unknown as Guia
export const workout = (id: string) => guia.workouts.find((w) => w.id === id)
