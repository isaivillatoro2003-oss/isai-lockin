import { ApiError, GoogleGenAI, type Part } from '@google/genai'
import { z } from 'zod'

/*
 * Funciones de IA de Lock-in con Gemini (nivel gratuito de Google AI Studio).
 * Se usa igual desde el servidor de desarrollo (vite.config.ts) y desde la función de Vercel (api/ai.ts).
 * La llave vive en GEMINI_API_KEY, nunca en el navegador. GEMINI_MODEL permite cambiar de modelo sin tocar código.
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

const CONTEXT = `El usuario es Isaí, mexicano, habla español, inglés y portugués. Aprende árabe libanés hablado
(Beirut, jóvenes, 2026) escrito en Arabizi, como en WhatsApp: números por letras (2 = hamza, 3 = ayn, 5 = kha,
7 = ha fuerte, 8 = ghayn, 9 = qaf), mezcla natural con francés e inglés. También aprende francés de Francia.
Su novia se llama Pam, es libanesa, vive en Beirut y habla árabe libanés y francés.
Responde siempre en español (salvo las frases en el idioma meta), solo con el JSON pedido.`

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

let client: GoogleGenAI | null = null
const ai = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }))

/** Una llamada con salida JSON validada contra el esquema de zod. */
async function ask<S extends z.ZodType>(schema: S, system: string, parts: Part[]): Promise<z.infer<S>> {
  const res = await ai().models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: `${CONTEXT}\n${system}`,
      responseMimeType: 'application/json',
      responseJsonSchema: z.toJSONSchema(schema),
    },
  })
  if (!res.text) throw new Error('Gemini no devolvió respuesta (puede haberla bloqueado).')
  const parsed = schema.safeParse(JSON.parse(res.text))
  if (!parsed.success) throw new Error('No se pudo leer la respuesta.')
  return parsed.data
}

export async function runAi(req: AiRequest) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Falta la llave: ponla en app/.env.local (o en Vercel) como GEMINI_API_KEY.')

  if (req.task === 'translate') {
    const langName = req.lang === 'ar' ? 'árabe libanés en Arabizi' : 'francés de Francia'
    const to = req.to === 'm' ? ' a un hombre' : req.to === 'f' ? ' a una mujer (por ejemplo a Pam)' : ''
    return ask(TranslateOut,
      `Traduce lo que Isaí quiere decir a ${langName}, como lo diría alguien joven y natural, no como libro de texto.`,
      [{ text: `Quiero decirle${to}: ${req.text}` }])
  }

  if (req.task === 'food') {
    return ask(FoodOut,
      'Isaí mide 1.73 m, pesa ~100 kg y baja grasa: ~1,950 kcal y ~180 g de proteína al día, en 3 comidas entre 10:00 y 18:00. Estima con honestidad la comida de la foto (porciones visibles) y dile si encaja en su plan.',
      [{ inlineData: { mimeType: req.mime, data: req.image } }, { text: `Esta es mi ${req.slot}, a las ${req.time}.` }])
  }

  return ask(SpeakOut,
    'Evalúas la pronunciación de Isaí. Recibes la frase objetivo y la transcripción automática de lo que dijo. El reconocedor de voz del teléfono escribe en árabe estándar o en francés y puede equivocarse; sé justo y concreto.',
    [{ text: `Idioma: ${req.lang === 'ar' ? 'árabe libanés' : 'francés'}\nFrase objetivo: ${req.target}${req.script ? ` (${req.script})` : ''}\nTranscripción de lo que dije: ${req.heard || '(no se reconoció nada)'}` }])
}

export function errorMessage(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 429) return 'Se acabó la cuota gratis por ahora. Espera un rato o mañana.'
    if (e.status === 400 || e.status === 403) return 'La llave de Gemini no es válida o no tiene permiso.'
    return `Error de Gemini (${e.status}).`
  }
  if (e instanceof Error) return e.message
  return 'Error desconocido.'
}
