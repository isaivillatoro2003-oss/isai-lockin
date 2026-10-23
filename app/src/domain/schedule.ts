import { addDays, toMin, weekday } from './time'

export type Cat =
  | 'despertar' | 'glow' | 'ar' | 'fr' | 'uni' | 'ejercicio' | 'caminata'
  | 'comida' | 'novia' | 'diario' | 'libre' | 'sueno'

/** Qué abre el bloque al tocarlo. */
export type Link =
  | 'anki-ar' | 'anki-fr' | 'lesson-ar' | 'lesson-fr' | 'speak-ar' | 'workout'
  | 'glow-am' | 'glow-pm' | 'meal' | 'journal' | 'weigh' | 'measure'

export interface Block {
  id: string
  start: string
  dur: number
  title: string
  cat: Cat
  core?: boolean
  detail?: string
  link?: Link
}

export interface Template { id: string; name: string; blocks: Block[] }

type Row = [start: string, dur: number, title: string, cat: Cat, opts?: Partial<Block>]

const C = { core: true }

function tpl(id: string, name: string, rows: Row[]): Template {
  return {
    id, name,
    blocks: rows.map(([start, d, title, cat, o]) => ({
      id: `${id}-${start.replace(':', '')}`, start, dur: d, title, cat, ...o,
    })),
  }
}

/* Lunes a viernes. Árabe 3 h y francés 2 h 30 activos, separados para que no se mezclen. */
const normalRows: Row[] = [
  ['05:00', 5, 'Despertar', 'despertar', { ...C, detail: 'Sin snooze. Cama tendida. 500 ml de agua con una pizca de sal.', link: 'weigh' }],
  ['05:05', 10, 'Glow up mañana', 'glow', { ...C, link: 'glow-am' }],
  ['05:15', 30, 'Anki árabe', 'ar', { ...C, detail: 'Repaso + 18 frases nuevas.', link: 'anki-ar' }],
  ['05:45', 15, 'Buenos días a ella', 'novia', { detail: 'Llamada o voice notes. Intenta 3 frases en árabe.' }],
  ['06:00', 5, 'Café negro y checklist', 'libre', { detail: 'Ropa de entreno puesta.' }],
  ['06:05', 35, 'Caminata 1 + sol', 'caminata', { ...C, detail: 'Amanecer sin lentes ni teléfono en la mano. Audio pasivo de árabe (Pimsleur o música libanesa).' }],
  ['06:45', 60, 'Entrenamiento', 'ejercicio', { ...C, link: 'workout' }],
  ['07:50', 20, 'Ducha fría + skincare', 'glow', { detail: '1 a 2 min de agua fría al final.' }],
  ['08:10', 60, 'Uni', 'uni', { ...C, detail: 'Teléfono en modo avión. 50 + 10.' }],
  ['09:10', 30, 'Anki francés', 'fr', { ...C, detail: 'Repaso + 25 nuevas.', link: 'anki-fr' }],
  ['09:40', 20, 'Preparar comida', 'comida'],
  ['10:00', 30, 'Comida 1', 'comida', { ...C, detail: 'Rompe el ayuno: proteína alta, verdura, grasa buena.', link: 'meal' }],
  ['10:30', 15, 'Caminata 2', 'caminata', { detail: '15 min después de comer. Música libanesa.' }],
  ['10:45', 45, 'Francés: input', 'fr', { ...C, detail: 'Soirée avec Baba, Easy French o innerFrench.', link: 'lesson-fr' }],
  ['11:30', 20, 'Francés: Assimil / LingQ', 'fr', { detail: 'Estructura y lectura.' }],
  ['11:50', 15, 'Francés: shadowing', 'fr', { detail: '5 frases del input, 5 repeticiones cada una.' }],
  ['12:05', 25, 'Árabe: frases para ella', 'ar', { detail: 'Escribe en Arabizi lo que le vas a decir en la llamada.', link: 'speak-ar' }],
  ['12:30', 30, 'Pendientes', 'libre', { detail: 'Trámites, limpieza, lo que falte. Sin redes.' }],
  ['13:00', 60, 'Llamada con ella', 'novia', { detail: 'Su noche. Usa árabe libanés aunque sean frases cortas.' }],
  ['14:00', 30, 'Comida 2', 'comida', { ...C, detail: 'La principal del día.', link: 'meal' }],
  ['14:30', 20, 'NSDR', 'sueno', { detail: 'Descanso sin dormir o siesta de 20 min con alarma.' }],
  ['14:50', 50, 'Árabe: input', 'ar', { ...C, detail: 'Talk In Arabic, Shankaboot, Hayda Haki o Sarde según la semana.', link: 'lesson-ar' }],
  ['15:40', 20, 'Árabe: shadowing', 'ar', { detail: '5 frases del input, 5 repeticiones.' }],
  ['16:00', 5, 'Buenas noches a ella', 'novia'],
  ['16:05', 60, 'Árabe: tutor', 'ar', { ...C, detail: 'italki o Preply.' }],
  ['17:05', 25, 'Comida 3', 'comida', { ...C, detail: 'Ligera, alta en proteína. La ventana cierra a las 18:00.', link: 'meal' }],
  ['17:30', 40, 'Caminata 3', 'caminata', { ...C, detail: 'Podcast en francés.' }],
  ['18:10', 45, 'Francés: hablar', 'fr', { ...C, detail: 'Tutor de lunes a jueves. Viernes: intercambio en Tandem o HelloTalk.' }],
  ['18:55', 15, 'Diario + plan', 'diario', { ...C, link: 'journal' }],
  ['19:10', 50, 'Serie en francés', 'fr', { detail: 'Subtítulos en francés.' }],
  ['20:00', 5, 'Pantallas fuera', 'sueno', { ...C, detail: 'Teléfono a la cocina en modo avión. Luces cálidas.' }],
  ['20:05', 10, 'Glow up noche', 'glow', { ...C, link: 'glow-pm' }],
  ['20:15', 60, 'Bajar revoluciones', 'sueno', { detail: 'Estiramientos 10 min, respiración 5 min, lectura en papel.' }],
  ['21:15', 15, 'Cama', 'sueno', { detail: 'Cuarto fresco y oscuro.' }],
  ['21:30', 450, 'Dormir', 'sueno', { ...C }],
]

const sabadoRows: Row[] = normalRows.map((r): Row => {
  const [s, d, , c, o] = r
  if (s === '06:45') return [s, d, 'Actividad libre', c, { ...o, detail: 'Playa, nadar o caminata larga.', link: undefined }]
  if (s === '08:10') return [s, d, 'Uni: repaso', c, o]
  if (s === '16:05') return [s, d, 'Árabe solo con ella', c, { ...o, detail: '60 min hablando únicamente en árabe.' }]
  if (s === '18:10') return [s, d, 'Francés: intercambio', c, o]
  if (s === '12:30') return [s, d, 'Limpieza profunda', c, o]
  return r
})

const descansoRows: Row[] = [
  ['05:00', 30, 'Despertar', 'despertar', { ...C, detail: 'Margen de 30 min. Agua con sal.' }],
  ['05:30', 15, 'Medición semanal', 'glow', { ...C, detail: 'Peso en ayunas, cintura en el ombligo, 4 fotos con la misma luz.', link: 'measure' }],
  ['05:45', 30, 'Anki árabe + francés', 'ar', { ...C, link: 'anki-ar' }],
  ['06:15', 75, 'Caminata de amanecer', 'caminata', { ...C, detail: 'Larga y sin prisa.' }],
  ['07:30', 30, 'Ducha + rutina semanal', 'glow', { link: 'glow-am' }],
  ['08:00', 60, 'Llamada larga con ella', 'novia'],
  ['09:00', 30, 'Revisión semanal', 'diario', { detail: 'Rachas, gráficas, qué falló y por qué. Plan de uni.' }],
  ['09:30', 30, 'Gold List', 'fr', { detail: '25 frases por idioma.' }],
  ['10:00', 30, 'Comida 1', 'comida', { ...C, link: 'meal' }],
  ['10:30', 90, 'Meal prep', 'comida', { detail: 'Proteína cocida, verdura lavada, porciones.' }],
  ['12:00', 45, 'Episodio en árabe', 'ar', { detail: 'Serie libanesa.' }],
  ['12:45', 75, 'Libre', 'libre', { detail: 'Playa, cenote, lectura.' }],
  ['14:00', 30, 'Comida 2', 'comida', { ...C, link: 'meal' }],
  ['14:30', 30, 'Movilidad', 'ejercicio', { detail: 'Estiramientos 30 min.' }],
  ['15:00', 45, 'Episodio en francés', 'fr'],
  ['16:00', 5, 'Buenas noches a ella', 'novia'],
  ['17:05', 25, 'Comida 3', 'comida', { ...C, link: 'meal' }],
  ['18:30', 20, 'Diario semanal', 'diario', { ...C, link: 'journal' }],
  ['20:00', 15, 'Pantallas fuera + glow up', 'glow', { ...C, link: 'glow-pm' }],
  ['20:15', 60, 'Lectura', 'sueno'],
  ['21:30', 450, 'Dormir', 'sueno', { ...C }],
]

const minimaRows: Row[] = [
  ['05:00', 5, 'Despertar', 'despertar', { ...C }],
  ['05:05', 5, 'Glow up mínimo', 'glow', { ...C, link: 'glow-am' }],
  ['05:15', 20, 'Anki árabe', 'ar', { ...C, link: 'anki-ar' }],
  ['06:05', 30, 'Entreno corto', 'ejercicio', { ...C, link: 'workout' }],
  ['08:10', 60, 'Uni', 'uni', { ...C }],
  ['09:10', 20, 'Anki francés', 'fr', { ...C, link: 'anki-fr' }],
  ['10:00', 30, 'Comida 1', 'comida', { ...C, link: 'meal' }],
  ['14:00', 30, 'Comida 2', 'comida', { ...C, link: 'meal' }],
  ['17:05', 25, 'Comida 3', 'comida', { ...C, link: 'meal' }],
  ['18:55', 10, 'Diario', 'diario', { ...C, link: 'journal' }],
  ['21:30', 450, 'Dormir', 'sueno', { ...C }],
]

/* Semana 1: atrasar el reloj ~5 h. Luz y ejercicio en la tarde, nada de sol temprano. */
function jetlag(n: number, wake: string, sleep: string): Template {
  const rows: Row[] = [
    [wake, 15, 'Despertar', 'despertar', { ...C, detail: 'Si despertaste a las 2 o 3: cama, oscuridad, sin teléfono. No te levantas antes.' }],
    ['05:05', 10, 'Glow up mañana', 'glow', { ...C, link: 'glow-am' }],
    ['05:15', 30, 'Anki árabe', 'ar', { ...C, link: 'anki-ar' }],
    ['05:45', 15, 'Buenos días a ella', 'novia'],
    ['06:05', 40, 'Caminata con lentes de sol', 'caminata', { detail: 'Antes de las 9:00, lentes de sol afuera.' }],
    ['08:10', 60, 'Uni', 'uni', { ...C, detail: 'Si estás muy mal, 30 min. Nunca cero.' }],
    ['09:10', 30, 'Anki francés', 'fr', { ...C, link: 'anki-fr' }],
    ['10:00', 30, 'Comida 1', 'comida', { ...C, detail: 'Ventana 10 a 18 desde hoy.', link: 'meal' }],
    ['10:45', 45, 'Francés: input', 'fr', { link: 'lesson-fr' }],
    ['12:05', 25, 'Árabe: frases para ella', 'ar', { link: 'speak-ar' }],
    ['13:00', 60, 'Llamada con ella', 'novia', { detail: 'Te ayuda a no dormirte.' }],
    ['14:00', 30, 'Comida 2', 'comida', { ...C, link: 'meal' }],
    ['14:50', 50, 'Árabe: input', 'ar', { link: 'lesson-ar' }],
    ['15:40', 20, 'Sol de tarde', 'caminata', { ...C, detail: 'Sal al sol hasta las 17:30. La luz de tarde atrasa el reloj.' }],
    ['16:00', 5, 'Buenas noches a ella', 'novia'],
    ['16:30', 45, n === 4 ? 'Caminata larga' : 'Entreno de tarde', 'ejercicio', { ...C, detail: n === 1 ? 'Solo caminata ligera.' : 'Al 60 %.', link: n === 4 ? undefined : 'workout' }],
    ['17:20', 25, 'Comida 3', 'comida', { ...C, link: 'meal' }],
    ['18:55', 15, 'Diario', 'diario', { ...C, link: 'journal' }],
    ['19:10', 50, 'Serie en francés', 'fr', { detail: 'Luces encendidas, nada de siesta.' }],
    [sleep, 450, 'Dormir', 'sueno', { ...C }],
  ]
  return tpl(`jetlag${n}`, `Jet lag día ${n}`, rows.sort((a, b) => toMin(a[0]) - toMin(b[0])))
}

export const TEMPLATES: Record<string, Template> = Object.fromEntries([
  tpl('normal', 'Normal', normalRows),
  tpl('sabado', 'Sábado', sabadoRows),
  tpl('descanso', 'Descanso', descansoRows),
  tpl('minima', 'Mínima', minimaRows),
  jetlag(1, '05:00', '20:00'),
  jetlag(2, '04:15', '20:00'),
  jetlag(3, '04:30', '20:30'),
  jetlag(4, '04:30', '20:45'),
].map((t) => [t.id, t]))

export const ARRIVAL = '2026-10-29'

export function defaultTemplate(date: string) {
  for (let i = 0; i < 4; i++) if (date === addDays(ARRIVAL, i)) return `jetlag${i + 1}`
  const w = weekday(date)
  return w === 0 ? 'descanso' : w === 6 ? 'sabado' : 'normal'
}

export const WEEK1 = '2026-11-02'

/** Semana del plan (1 a 12) contada desde el lunes 2 de noviembre. Antes de esa fecha cuenta como 1. */
export const planWeek = (date: string) =>
  Math.min(12, Math.max(1, Math.floor((Date.parse(date) - Date.parse(WEEK1)) / (7 * 864e5)) + 1))

/**
 * Rutinas del día (ids de guia.workouts). Semanas 1 a 4: full body A/B alternando 3 días.
 * Semanas 5 a 12: torso/pierna 4 días. Zona 2, HIIT y core entre medio.
 */
export function workoutsFor(date: string): string[] {
  const w = weekday(date), wk = planWeek(date)
  if (wk <= 4) {
    const ab = wk % 2 ? ['A', 'B', 'A'] : ['B', 'A', 'B']
    return ({ 1: [ab[0]], 2: ['Z2', 'CORE'], 3: [ab[1]], 4: [wk === 1 ? 'Z2' : 'HIIT'], 5: [ab[2]], 6: ['Z2'], 0: ['MOV'] } as Record<number, string[]>)[w]
  }
  return ({ 1: ['C'], 2: ['D'], 3: ['Z2', 'CORE'], 4: ['E'], 5: ['F'], 6: ['HIIT'], 0: ['MOV'] } as Record<number, string[]>)[w]
}

export const CAT_LABEL: Record<Cat, string> = {
  despertar: 'Despertar', glow: 'Glow up', ar: 'Árabe', fr: 'Francés', uni: 'Uni',
  ejercicio: 'Ejercicio', caminata: 'Caminata', comida: 'Comida', novia: 'Ella',
  diario: 'Diario', libre: 'Libre', sueno: 'Sueño',
}

export function currentBlock(blocks: Block[], nowMin: number) {
  let idx = -1
  for (let i = 0; i < blocks.length; i++) if (toMin(blocks[i].start) <= nowMin) idx = i
  return idx
}
