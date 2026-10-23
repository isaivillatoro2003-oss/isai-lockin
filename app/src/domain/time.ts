export const TZ = 'America/Cancun'
export const PARTNER_TZ = 'Asia/Beirut'

function parts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short',
  })
  const o: Record<string, string> = {}
  for (const p of f.formatToParts(d)) o[p.type] = p.value
  return o
}

/** Fecha 'YYYY-MM-DD', hora 'HH:mm' y minutos desde medianoche en una zona. */
export function clock(tz = TZ, d = new Date()) {
  const o = parts(d, tz)
  const hm = `${o.hour}:${o.minute}`
  return { date: `${o.year}-${o.month}-${o.day}`, hm, min: toMin(hm), sec: +o.second }
}

export const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m }
export const fromMin = (n: number) => {
  const m = ((n % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Diferencia actual en minutos entre Beirut y Cancún (420 en invierno). */
export function partnerOffset(d = new Date()) {
  const a = clock(TZ, d), b = clock(PARTNER_TZ, d)
  let diff = b.min - a.min
  if (b.date > a.date) diff += 1440
  if (b.date < a.date) diff -= 1440
  return diff
}

export const partnerHm = (hm: string) => fromMin(toMin(hm) + partnerOffset())

export function addDays(date: string, n: number) {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 0 = domingo */
export const weekday = (date: string) => new Date(date + 'T12:00:00Z').getUTCDay()

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export function longDate(date: string) {
  const [, m, d] = date.split('-').map(Number)
  return `${DAYS[weekday(date)]} ${d} ${MONTHS[m - 1]}`
}

export function dur(min: number) {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h ? `${h} h${m ? ` ${m}` : ''}` : `${m} min`
}
