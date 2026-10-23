export interface Card {
  id: string; rank: number; unit: number; es: string; t: string
  pron?: string; script?: string; chat?: string; g?: string; alt?: string; tags: string[]; note?: string
}
export interface Unit { n: number; title: string; goal: string; grammar: string }
export interface LangPack {
  lang: 'ar' | 'fr'
  units: Unit[]
  cards: Card[]
  extra?: Card[]
  alphabet?: { char: string; script: string; sound: string; example: string; exampleEs: string }[]
  cognates?: { rule: string; examples: string }[]
  falseFriends?: { fr: string; looksLike: string; means: string }[]
  chatAbbr?: { short: string; full: string; es: string }[]
}

export interface Exercise { name: string; sets: string; reps: string; rest: string; notes?: string; alt?: string }
export interface Workout { id: string; name: string; where: string; focus: string; exercises: Exercise[] }
export interface Step { step: string; how: string; product?: string; min?: number }
export type Grade = 'A' | 'B' | 'C' | 'D'
export interface Tip { area: string; title: string; text: string; grade: Grade }

export interface Guia {
  metas: Record<string, string>
  macros: { kcal: number; proteinG: number; grasaG: number; carbosG: number; nota?: string }
  estrategia: string
  workouts: Workout[]
  progresion: { week: string; text: string }[]
  menus: Record<string, { name: string; items: string; kcal?: number; proteinG?: number }[]>
  super: { cat: string; items: string[] }[]
  evitar: string[]
  saciedad: string[]
  glow: { am: Step[]; pm: Step[]; semanal: Step[]; checklist: string[] }
  tips: Tip[]
  suplementos: { name: string; dose: string; when: string; grade: Grade }[]
  medico: string[]
  ajustes: string[]
  adicciones: { seguridad: string[]; bloqueadores: string[]; antojo: string[]; apoyo: string[] }
  idiomas: {
    tecnicas: { name: string; how: string }[]
    recursos: Record<'ar' | 'fr', { name: string; type: string; note: string }[]>
    musica: Record<'ar' | 'fr', { artist: string; songs: string; weeks: string; why: string }[]>
    postits: { es: string; ar: string; fr: string }[]
    habitos: string[]
  }
}
