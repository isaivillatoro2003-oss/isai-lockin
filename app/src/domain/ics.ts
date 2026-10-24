import { ARRIVAL, TEMPLATES, type Block } from './schedule'
import { addDays } from './time'

/*
 * Calendario .ics con alarma en cada bloque, para importarlo al calendario del iPhone.
 * Es la forma más confiable de que el teléfono avise a la hora aunque la app esté cerrada.
 * Jet lag con fechas exactas; después, semanas que se repiten por 12 semanas.
 */

const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
const dt = (date: string, hm: string) => `${date.replace(/-/g, '')}T${hm.replace(':', '')}00`
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function event(b: Block, date: string, rrule?: string) {
  const end = (() => {
    const [h, m] = b.start.split(':').map(Number)
    const t = Math.min(h * 60 + m + Math.min(b.dur, 120), 23 * 60 + 59)
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  })()
  const desc = [b.detail, b.water ? `Toma ${b.water} ml de agua` : '', ...(b.extras ?? [])].filter(Boolean).join('\n')
  return [
    'BEGIN:VEVENT',
    `UID:${b.id}-${date}@lockin`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;TZID=America/Cancun:${dt(date, b.start)}`,
    `DTEND;TZID=America/Cancun:${dt(date, end)}`,
    rrule ? `RRULE:${rrule}` : '',
    `SUMMARY:${esc(b.title)}`,
    desc ? `DESCRIPTION:${esc(desc)}` : '',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(b.title)}`, 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n')
}

/** onlyCore: solo los bloques que cuentan para la racha (menos avisos). */
export function buildIcs(onlyCore: boolean) {
  const pick = (bs: Block[]) => bs.filter((b) => b.title !== 'Dormir' && (!onlyCore || b.core || b.cat === 'novia'))
  const events: string[] = []
  for (let i = 0; i < 4; i++) {
    const date = addDays(ARRIVAL, i)
    for (const b of pick(TEMPLATES[`jetlag${i + 1}`].blocks)) events.push(event(b, date))
  }
  // Desde el lunes 2 de noviembre: lunes a viernes, sábado y domingo, 12 semanas.
  const start = addDays(ARRIVAL, 4)
  const weekly = [
    { tpl: 'normal', days: [1, 2, 3, 4, 5], from: start },
    { tpl: 'sabado', days: [6], from: addDays(start, 5) },
    { tpl: 'descanso', days: [0], from: addDays(start, 6) },
  ]
  for (const w of weekly) {
    for (const b of pick(TEMPLATES[w.tpl].blocks)) {
      events.push(event(b, w.from, `FREQ=WEEKLY;BYDAY=${w.days.map((d) => BYDAY[d]).join(',')};COUNT=${12 * w.days.length}`))
    }
  }
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lock-in//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Lock-in',
    'BEGIN:VTIMEZONE', 'TZID:America/Cancun', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0500', 'TZNAME:EST', 'END:STANDARD', 'END:VTIMEZONE',
    ...events, 'END:VCALENDAR',
  ].join('\r\n')
}
