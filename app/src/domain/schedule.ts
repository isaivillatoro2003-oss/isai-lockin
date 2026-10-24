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
  /** Clave en content/bloques.json con qué es, cómo y tips. */
  guide?: string
  /** Agua planeada en este momento (ml). */
  water?: number
  /** Pequeñas cosas que van en este bloque: suplementos, protector, luz roja... */
  extras?: string[]
}

/*
 * Agua: ~4 L al día para 100 kg en el calor de Cancún, repartida para no tomar todo de golpe.
 * Nada grande después de las 19:00 para no despertar a orinar.
 */
const WATER: Record<string, number> = {
  '05:00': 500, '06:05': 250, '06:45': 600, '08:10': 300, '09:40': 400, '10:30': 250,
  '12:05': 300, '14:00': 500, '15:40': 300, '17:30': 300, '18:55': 250,
}
const EXTRAS: Record<string, string[]> = {
  '05:00': ['Pizca de sal en el agua', 'Pesarte'],
  '05:05': ['Protector solar SPF 50', 'Limpiar la lengua'],
  '06:05': ['Sin lentes de sol', 'Audio de árabe'],
  '06:45': ['Electrolitos sin azúcar', 'Café antes si lo necesitas'],
  '07:50': ['Solo agua fría', 'Hidratante después'],
  '08:10': ['Teléfono en modo avión'],
  '09:40': ['Agua antes de comer: llena'],
  '10:00': ['Creatina 5 g', 'Proteína primero en el plato'],
  '14:00': ['Verdura primero, luego proteína'],
  '17:05': ['Última comida del día'],
  '17:30': ['Cepíllate al volver: ventana cerrada a las 18:00'],
  '20:00': ['Luz roja o ámbar', 'Teléfono fuera del cuarto'],
  '20:05': ['Retinoide (noches alternas)', 'Hilo dental'],
  '20:15': ['Magnesio si lo compraste'],
  '21:15': ['Cuarto a 24 °C o menos', 'Antifaz y tapones'],
}

function withExtras(t: Template): Template {
  return { ...t, blocks: t.blocks.map((b) => ({ ...b, water: b.water ?? WATER[b.start], extras: b.extras ?? EXTRAS[b.start] })) }
}

export const waterGoal = (blocks: Block[]) => blocks.reduce((s, b) => s + (b.water ?? 0), 0)

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

/* Lunes a viernes. Árabe 3 h y francés 2 h 30 activos, separados para que no se mezclen. Sin tutores. */
const normalRows: Row[] = [
  ['05:00', 5, 'Despertar', 'despertar', { ...C, guide: 'despertar', detail: 'Sin snooze. Cama tendida. 500 ml de agua con una pizca de sal.', link: 'weigh' }],
  ['05:05', 10, 'Cara y dientes (mañana)', 'glow', { ...C, guide: 'glow-am', detail: 'Lengua, dientes, hilo, limpiar cara, hidratante y protector solar.', link: 'glow-am' }],
  ['05:15', 30, 'Tarjetas de árabe', 'ar', { ...C, guide: 'tarjetas-ar', detail: 'Repaso de las que tocan hoy + 18 frases nuevas, aquí en la app.', link: 'anki-ar' }],
  ['05:45', 15, 'Buenos días a Pam', 'novia', { guide: 'novia-am', detail: 'Llamada o voice notes. Intenta 3 frases en árabe.' }],
  ['06:00', 5, 'Café negro', 'libre', { guide: 'cafe', detail: 'Ropa de entreno puesta. Revisa el día.' }],
  ['06:05', 35, 'Caminata al amanecer', 'caminata', { ...C, guide: 'caminata-sol', detail: 'Luz de sol en los ojos, sin lentes. Audio de árabe en los audífonos.' }],
  ['06:45', 60, 'Entrenamiento', 'ejercicio', { ...C, guide: 'entreno', link: 'workout' }],
  ['07:50', 20, 'Ducha fría + piel', 'glow', { guide: 'ducha-fria', detail: '1 a 2 min de agua fría al final.' }],
  ['08:10', 60, 'Uni', 'uni', { ...C, guide: 'uni', detail: 'Teléfono en modo avión. 50 min y 10 de descanso.' }],
  ['09:10', 30, 'Tarjetas de francés', 'fr', { ...C, guide: 'tarjetas-fr', detail: 'Repaso + 25 nuevas.', link: 'anki-fr' }],
  ['09:40', 20, 'Preparar comida', 'comida', { guide: 'preparar-comida' }],
  ['10:00', 30, 'Comida 1', 'comida', { ...C, guide: 'comida-1', detail: 'Rompe el ayuno: proteína alta, verdura, grasa buena.', link: 'meal' }],
  ['10:30', 15, 'Caminata corta', 'caminata', { guide: 'caminata-post', detail: '15 min después de comer.' }],
  ['10:45', 45, 'Francés: escuchar y entender', 'fr', { ...C, guide: 'fr-input', detail: 'Videos o podcast que entiendas en un 80 %.', link: 'lesson-fr' }],
  ['11:30', 20, 'Francés: lectura', 'fr', { guide: 'fr-lectura' }],
  ['11:50', 15, 'Francés: repetir en voz alta', 'fr', { guide: 'fr-shadowing', detail: 'Shadowing: 5 frases, 5 veces cada una.' }],
  ['12:05', 25, 'Árabe: frases para Pam', 'ar', { guide: 'ar-frases', detail: 'Escribe en Arabizi lo que le dirás a Pam en la llamada y grábate.', link: 'speak-ar' }],
  ['12:30', 30, 'Pendientes', 'libre', { guide: 'pendientes', detail: 'Trámites, limpieza, lo que falte. Sin redes.' }],
  ['13:00', 60, 'Llamada con Pam', 'novia', { guide: 'llamada', detail: 'Su noche. Usa árabe libanés aunque sean frases cortas.' }],
  ['14:00', 30, 'Comida 2', 'comida', { ...C, guide: 'comida-2', detail: 'La principal del día.', link: 'meal' }],
  ['14:30', 20, 'Descanso profundo (NSDR)', 'sueno', { guide: 'nsdr', detail: 'Audio guiado acostado sin dormirte, o siesta de 20 min con alarma.' }],
  ['14:50', 50, 'Árabe: escuchar y entender', 'ar', { ...C, guide: 'ar-input', detail: 'Talk In Arabic, Shankaboot, Hayda Haki o Sarde.', link: 'lesson-ar' }],
  ['15:40', 20, 'Árabe: repetir en voz alta', 'ar', { guide: 'ar-shadowing', detail: 'Shadowing: 5 frases, 5 veces cada una.' }],
  ['16:00', 5, 'Buenas noches a Pam', 'novia', { guide: 'buenas-noches' }],
  ['16:05', 60, 'Árabe: hablar', 'ar', { ...C, guide: 'ar-hablar', detail: 'Voz con IA en libanés, HelloTalk, hablar solo y voice notes. Gratis.' }],
  ['17:05', 25, 'Comida 3', 'comida', { ...C, guide: 'comida-3', detail: 'Ligera, alta en proteína. La ventana cierra a las 18:00.', link: 'meal' }],
  ['17:30', 40, 'Caminata con podcast', 'caminata', { ...C, guide: 'caminata-podcast', detail: 'Podcast en francés.' }],
  ['18:10', 45, 'Francés: hablar', 'fr', { ...C, guide: 'fr-hablar', detail: 'Tandem o HelloTalk, voz con IA, hablar solo, grabarte. Gratis.' }],
  ['18:55', 15, 'Diario + plan de mañana', 'diario', { ...C, guide: 'diario', link: 'journal' }],
  ['19:10', 50, 'Serie en francés', 'fr', { guide: 'fr-serie', detail: 'Subtítulos en francés, nunca en español.' }],
  ['20:00', 5, 'Pantallas fuera, luz roja', 'sueno', { ...C, guide: 'pantallas-fuera', detail: 'Teléfono a la cocina en modo avión. Solo luz roja o ámbar desde aquí.' }],
  ['20:05', 10, 'Cara y dientes (noche)', 'glow', { ...C, guide: 'glow-pm', link: 'glow-pm' }],
  ['20:15', 60, 'Bajar revoluciones', 'sueno', { guide: 'bajar-revoluciones', detail: 'Estiramientos, respiración y lectura en papel con luz roja.' }],
  ['21:15', 15, 'A la cama', 'sueno', { guide: 'cama', detail: 'Cuarto fresco y oscuro, antifaz y tapones.' }],
  ['21:30', 450, 'Dormir', 'sueno', { ...C, guide: 'dormir' }],
]

const sabadoRows: Row[] = normalRows.map((r): Row => {
  const [s, d, , c, o] = r
  if (s === '06:45') return [s, d, 'Actividad libre', c, { ...o, guide: 'actividad-libre', detail: 'Playa, nadar o caminata larga. Abajo tienes la sesión del programa si prefieres entrenar.' }]
  if (s === '08:10') return [s, d, 'Uni: repaso', c, o]
  if (s === '16:05') return [s, d, 'Árabe solo con Pam', c, { ...o, guide: 'ar-ella', detail: '60 min hablando únicamente en árabe.' }]
  if (s === '12:30') return [s, d, 'Limpieza profunda', c, { ...o, guide: 'limpieza' }]
  return r
})

const descansoRows: Row[] = [
  ['05:00', 30, 'Despertar', 'despertar', { ...C, guide: 'despertar', detail: 'Margen de 30 min. Agua con sal.' }],
  ['05:30', 15, 'Medición semanal', 'glow', { ...C, guide: 'medicion', detail: 'Peso en ayunas, cintura en el ombligo, 4 fotos con la misma luz.', link: 'measure' }],
  ['05:45', 30, 'Tarjetas árabe + francés', 'ar', { ...C, guide: 'tarjetas-ar', link: 'anki-ar' }],
  ['06:15', 75, 'Caminata larga al amanecer', 'caminata', { ...C, guide: 'caminata-larga', detail: 'Sin prisa.' }],
  ['07:30', 30, 'Ducha + rutina semanal de piel', 'glow', { guide: 'ducha-fria', link: 'glow-am' }],
  ['08:00', 60, 'Llamada larga con Pam', 'novia', { guide: 'llamada' }],
  ['09:00', 30, 'Revisión semanal', 'diario', { guide: 'revision-semanal', detail: 'Rachas, gráficas, qué falló y por qué. Plan de uni.' }],
  ['09:30', 30, 'Gold List', 'fr', { guide: 'gold-list', detail: '25 frases por idioma a mano.' }],
  ['10:00', 30, 'Comida 1', 'comida', { ...C, guide: 'comida-1', link: 'meal' }],
  ['10:30', 90, 'Meal prep', 'comida', { guide: 'meal-prep', detail: 'Proteína cocida, verdura lavada, porciones.' }],
  ['12:00', 45, 'Episodio en árabe', 'ar', { guide: 'ar-episodio', detail: 'Serie libanesa.' }],
  ['12:45', 75, 'Libre', 'libre', { guide: 'actividad-libre', detail: 'Playa, cenote, lectura.' }],
  ['14:00', 30, 'Comida 2', 'comida', { ...C, guide: 'comida-2', link: 'meal' }],
  ['14:30', 30, 'Movilidad', 'ejercicio', { guide: 'movilidad', detail: 'Estiramientos 30 min.' }],
  ['15:00', 45, 'Episodio en francés', 'fr', { guide: 'fr-episodio' }],
  ['16:00', 5, 'Buenas noches a Pam', 'novia', { guide: 'buenas-noches' }],
  ['17:05', 25, 'Comida 3', 'comida', { ...C, guide: 'comida-3', link: 'meal' }],
  ['18:30', 20, 'Diario semanal', 'diario', { ...C, guide: 'diario', link: 'journal' }],
  ['20:00', 15, 'Pantallas fuera + cara y dientes', 'glow', { ...C, guide: 'pantallas-fuera', link: 'glow-pm' }],
  ['20:15', 60, 'Lectura con luz roja', 'sueno', { guide: 'lectura' }],
  ['21:30', 450, 'Dormir', 'sueno', { ...C, guide: 'dormir' }],
]

const minimaRows: Row[] = [
  ['05:00', 5, 'Despertar', 'despertar', { ...C, guide: 'despertar' }],
  ['05:05', 5, 'Cara y dientes rápido', 'glow', { ...C, guide: 'glow-am', link: 'glow-am' }],
  ['05:15', 20, 'Tarjetas de árabe', 'ar', { ...C, guide: 'tarjetas-ar', link: 'anki-ar' }],
  ['06:05', 30, 'Entreno corto', 'ejercicio', { ...C, guide: 'entreno', link: 'workout' }],
  ['08:10', 60, 'Uni', 'uni', { ...C, guide: 'uni' }],
  ['09:10', 20, 'Tarjetas de francés', 'fr', { ...C, guide: 'tarjetas-fr', link: 'anki-fr' }],
  ['10:00', 30, 'Comida 1', 'comida', { ...C, guide: 'comida-1', link: 'meal' }],
  ['14:00', 30, 'Comida 2', 'comida', { ...C, guide: 'comida-2', link: 'meal' }],
  ['17:05', 25, 'Comida 3', 'comida', { ...C, guide: 'comida-3', link: 'meal' }],
  ['18:55', 10, 'Diario', 'diario', { ...C, guide: 'diario', link: 'journal' }],
  ['21:30', 450, 'Dormir', 'sueno', { ...C, guide: 'dormir' }],
]

/* Semana 1: atrasar el reloj ~5 h. Luz y ejercicio en la tarde, nada de sol temprano. */
function jetlag(n: number, wake: string, sleep: string): Template {
  const rows: Row[] = [
    [wake, 15, 'Despertar', 'despertar', { ...C, guide: 'despertar', detail: 'Si despertaste a las 2 o 3: cama, oscuridad, sin teléfono. No te levantas antes.' }],
    ['05:05', 10, 'Cara y dientes (mañana)', 'glow', { ...C, guide: 'glow-am', link: 'glow-am' }],
    ['05:15', 30, 'Tarjetas de árabe', 'ar', { ...C, guide: 'tarjetas-ar', link: 'anki-ar' }],
    ['05:45', 15, 'Buenos días a Pam', 'novia', { guide: 'novia-am' }],
    ['06:05', 40, 'Caminata con lentes de sol', 'caminata', { guide: 'caminata-lentes', detail: 'Antes de las 9:00, lentes de sol afuera.' }],
    ['08:10', 60, 'Uni', 'uni', { ...C, guide: 'uni', detail: 'Si estás muy mal, 30 min. Nunca cero.' }],
    ['09:10', 30, 'Tarjetas de francés', 'fr', { ...C, guide: 'tarjetas-fr', link: 'anki-fr' }],
    ['10:00', 30, 'Comida 1', 'comida', { ...C, guide: 'comida-1', detail: 'Ventana de 10 a 18 desde hoy.', link: 'meal' }],
    ['10:45', 45, 'Francés: escuchar y entender', 'fr', { guide: 'fr-input', link: 'lesson-fr' }],
    ['12:05', 25, 'Árabe: frases para Pam', 'ar', { guide: 'ar-frases', link: 'speak-ar' }],
    ['13:00', 60, 'Llamada con Pam', 'novia', { guide: 'llamada', detail: 'Te ayuda a no dormirte.' }],
    ['14:00', 30, 'Comida 2', 'comida', { ...C, guide: 'comida-2', link: 'meal' }],
    ['14:50', 50, 'Árabe: escuchar y entender', 'ar', { guide: 'ar-input', link: 'lesson-ar' }],
    ['15:40', 20, 'Sol de tarde', 'caminata', { ...C, guide: 'sol-tarde', detail: 'Sal al sol hasta las 17:30. La luz de tarde atrasa el reloj.' }],
    ['16:00', 5, 'Buenas noches a Pam', 'novia', { guide: 'buenas-noches' }],
    ['16:30', 45, n === 4 ? 'Caminata larga' : 'Entreno de tarde', 'ejercicio', { ...C, guide: n === 4 ? 'caminata-larga' : 'entreno-tarde', detail: n === 1 ? 'Solo caminata ligera.' : 'Al 60 %.', link: n === 4 ? undefined : 'workout' }],
    ['17:20', 25, 'Comida 3', 'comida', { ...C, guide: 'comida-3', link: 'meal' }],
    ['18:55', 15, 'Diario', 'diario', { ...C, guide: 'diario', link: 'journal' }],
    ['19:10', 50, 'Serie en francés', 'fr', { guide: 'fr-serie', detail: 'Luces encendidas, nada de siesta.' }],
    [sleep, 450, 'Dormir', 'sueno', { ...C, guide: 'dormir' }],
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
].map((t) => [t.id, withExtras(t)]))

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
  despertar: 'Despertar', glow: 'Cuidado personal', ar: 'Árabe', fr: 'Francés', uni: 'Uni',
  ejercicio: 'Ejercicio', caminata: 'Caminata', comida: 'Comida', novia: 'Pam',
  diario: 'Diario', libre: 'Libre', sueno: 'Sueño',
}

export function currentBlock(blocks: Block[], nowMin: number) {
  let idx = -1
  for (let i = 0; i < blocks.length; i++) if (toMin(blocks[i].start) <= nowMin) idx = i
  return idx
}
