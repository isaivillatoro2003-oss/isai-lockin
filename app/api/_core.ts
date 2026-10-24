import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

/*
 * Funciones de IA de Lock-in. Se usa igual desde el servidor de desarrollo (vite.config.ts)
 * y desde la función de Vercel (api/ai.ts). La llave vive en ANTHROPIC_API_KEY, nunca en el navegador.
 */

const MODEL = 'claude-opus-5-5'

const CONTEXT = `El usuario es Isaí, mexicano, habla español, inglés y portugués. Aprende árabe libanés hablado
(Beirut, jóvenes, 2026) escrito en Arabizi, como en WhatsApp: números por letras (2 = hamza, 3 = ayn, 5 = kha,
7 = ha fuerte, 8 = ghayn, 9 = qaf), mezcla natural con francés e inglés. También aprende francés de Francia.
Su novia se llama Pam, es libanesa, vive en Beirut y habla árabe libanés y francés.`

export const TranslateOut = z.object({
  t: z.string().describe('La frase lista para mandar: Arabizi libanés natural o francés correcto'),
  chat: z.string().describe('Cómo se escribiría rápido en WhatsApp (abreviado si es lo normal)'),
  pron: z.string().describe('Cómo se lee, escrito para un hispanohablante'),
  script: z.string().describe('Árabe libanés coloquial en alfabeto árabe (para la voz). Vacío si es francés'),
  literal: z.string().describe('Traducción palabra por palabra al español'),
  words: z.array(z.object({ t: z.string(), es: z.string() })).describe('Cada palabra o pieza importante y su significado'),
  alternatives: z.array(z.object({ t: z.string(), when: z.string() })).describe('1 a 3 formas alternativas y cuándo usarlas'),
  note: z.string().describe('Nota corta: género, tono, si suena cariñoso o formal, error típico a evitar'),
})

export const FoodOut = z.object({
  plato: z.string(),
  kcal: z.number(), proteinaG: z.number(), carbosG: z.number(), grasaG: z.number(),
  veredicto: z.enum(['bien', 'regular', 'mal']),
  resumen: z.string().describe('Una frase directa sobre si encaja en su plan'),
  bien: z.array(z.string()).describe('Lo que está bien del plato'),
  mejorar: z.array(z.string()).describe('Cambios concretos para que encaje mejor la próxima vez'),
})

export const SpeakOut = z.object({
  score: z.number().describe('1 a 5'),
  heard: z.string().describe('Lo que parece que dijo, en la misma escritura del objetivo'),
  feedback: z.string().describe('Qué estuvo bien y qué falló, en español, 1 a 3 frases'),
  tips: z.array(z.string()).describe('1 a 3 consejos de pronunciación concretos para esta frase'),
})

export type AiRequest =
  | { task: 'translate'; text: string; lang: 'ar' | 'fr'; to?: 'm' | 'f' }
  | { task: 'food'; image: string; mime: string; slot: string; time: string }
  | { task: 'speak'; lang: 'ar' | 'fr'; target: string; script?: string; heard: string }

let client: Anthropic | null = null
const api = () => (client ??= new Anthropic())

export async function runAi(req: AiRequest) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta la llave de la API: ponla en app/.env.local (o en Vercel) como ANTHROPIC_API_KEY.')
  if (req.task === 'translate') {
    const langName = req.lang === 'ar' ? 'árabe libanés en Arabizi' : 'francés de Francia'
    const res = await api().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: `${CONTEXT}\nTraduce lo que Isaí quiere decir a ${langName}, como lo diría alguien joven y natural, no como libro de texto.`,
      messages: [{ role: 'user', content: `Quiero decirle${req.to === 'm' ? ' a un hombre' : req.to === 'f' ? ' a una mujer (por ejemplo a Pam)' : ''}: ${req.text}` }],
      output_config: { format: zodOutputFormat(TranslateOut), effort: 'low' },
    })
    return guard(res)
  }

  if (req.task === 'food') {
    const res = await api().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: `${CONTEXT}\nIsaí mide 1.73 m, pesa ~100 kg y baja grasa: ~1,950 kcal y ~180 g de proteína al día, en 3 comidas entre 10:00 y 18:00. Estima con honestidad la comida de la foto (porciones visibles) y dile si encaja en su plan.`,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: req.mime as 'image/jpeg', data: req.image } },
          { type: 'text', text: `Esta es mi ${req.slot}, a las ${req.time}.` },
        ],
      }],
      output_config: { format: zodOutputFormat(FoodOut), effort: 'medium' },
    })
    return guard(res)
  }

  const res = await api().messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: `${CONTEXT}\nEvalúas la pronunciación de Isaí. Recibes la frase objetivo y la transcripción automática de lo que dijo. El reconocedor de voz del teléfono escribe en árabe estándar o en francés y puede equivocarse; sé justo y concreto.`,
    messages: [{
      role: 'user',
      content: `Idioma: ${req.lang === 'ar' ? 'árabe libanés' : 'francés'}\nFrase objetivo: ${req.target}${req.script ? ` (${req.script})` : ''}\nTranscripción de lo que dije: ${req.heard || '(no se reconoció nada)'}`,
    }],
    output_config: { format: zodOutputFormat(SpeakOut), effort: 'low' },
  })
  return guard(res)
}

function guard<T>(res: { stop_reason: string | null; parsed_output: T | null }) {
  if (res.stop_reason === 'refusal') throw new Error('El modelo no quiso responder a esto.')
  if (!res.parsed_output) throw new Error('No se pudo leer la respuesta.')
  return res.parsed_output
}

export function errorMessage(e: unknown) {
  if (e instanceof Anthropic.AuthenticationError) return 'Falta la llave de la API o no es válida.'
  if (e instanceof Anthropic.RateLimitError) return 'Demasiadas peticiones, espera un momento.'
  if (e instanceof Anthropic.APIError) return `Error de la API (${e.status}).`
  if (e instanceof Error) return e.message
  return 'Error desconocido.'
}
