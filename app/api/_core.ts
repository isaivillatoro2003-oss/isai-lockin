import { ApiError, GoogleGenAI, type Part } from '@google/genai'
import { z } from 'zod'

/*
 * Funciones de IA de Lock-in con Gemini (nivel gratuito de Google AI Studio).
 * Se usa igual desde el servidor de desarrollo (vite.config.ts) y desde la función de Vercel (api/ai.ts).
 * La llave vive en GEMINI_API_KEY, nunca en el navegador. GEMINI_MODEL permite cambiar de modelo sin tocar código.
 * Respaldo opcional: NVIDIA NIM (build.nvidia.com, gratis ~40 peticiones/min) con NVIDIA_API_KEY y NVIDIA_MODEL.
 * Solo para texto (traducir y pronunciación); si Gemini falla o no tiene llave, se intenta NVIDIA.
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash' // 2.5 ya no está disponible para llaves nuevas
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'qwen/qwen3.5-397b-a17b'

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
  plato: z.string().describe('Nombre corto del plato'),
  entendi: z.string().describe('Qué entendiste que comió, con ingredientes y cantidades, en una o dos frases. Si mandó audio, aquí va lo que dijo, limpio'),
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
  | { task: 'food'; image?: string; mime?: string; audio?: string; audioMime?: string; desc?: string; slot: string; time: string; plan: string }
  | { task: 'speak'; lang: 'ar' | 'fr'; target: string; script?: string; heard: string }

let client: GoogleGenAI | null = null
const ai = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }))

class NvidiaError extends Error {
  status: number
  constructor(status: number) {
    super(`Error de NVIDIA (${status}).`)
    this.status = status
  }
}

/** Respaldo por NVIDIA NIM (API compatible con OpenAI). El esquema va en el prompt y la salida se valida con zod. */
async function askNvidia<S extends z.ZodType>(schema: S, system: string, text: string): Promise<z.infer<S>> {
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      temperature: 0.4,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: `${CONTEXT}\n${system}\nDevuelve solo un objeto JSON que cumpla este esquema:\n${JSON.stringify(z.toJSONSchema(schema))}` },
        { role: 'user', content: text },
      ],
    }),
  })
  if (!res.ok) throw new NvidiaError(res.status)
  const data = await res.json() as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content ?? ''
  // Algunos modelos razonan antes de responder: se toma solo el objeto JSON.
  const json = content.replace(/<think>[\s\S]*?<\/think>/g, '').match(/\{[\s\S]*\}/)?.[0]
  const parsed = json ? schema.safeParse(JSON.parse(json)) : null
  if (!parsed?.success) throw new Error('No se pudo leer la respuesta.')
  return parsed.data
}

/** Gemini primero; si falla o no tiene llave, NVIDIA (solo texto). */
async function ask<S extends z.ZodType>(schema: S, system: string, parts: Part[]): Promise<z.infer<S>> {
  const text = parts.every(p => p.text !== undefined) ? parts.map(p => p.text).join('\n') : null
  const nvidia = process.env.NVIDIA_API_KEY && text !== null
  if (!process.env.GEMINI_API_KEY) {
    if (nvidia) return askNvidia(schema, system, text)
    throw new Error('Falta la llave: ponla en app/.env.local (o en Vercel) como GEMINI_API_KEY.')
  }
  try {
    return await askGemini(schema, system, parts)
  } catch (e) {
    if (!nvidia) throw e
    return askNvidia(schema, system, text)
  }
}

/** Una llamada con salida JSON validada contra el esquema de zod. */
async function askGemini<S extends z.ZodType>(schema: S, system: string, parts: Part[]): Promise<z.infer<S>> {
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
  if (req.task === 'translate') {
    const langName = req.lang === 'ar' ? 'árabe libanés en Arabizi' : 'francés de Francia'
    const to = req.to === 'm' ? ' a un hombre' : req.to === 'f' ? ' a una mujer (por ejemplo a Pam)' : ''
    return ask(TranslateOut,
      `Traduce lo que Isaí quiere decir a ${langName}, como lo diría alguien joven y natural, no como libro de texto.`,
      [{ text: `Quiero decirle${to}: ${req.text}` }])
  }

  if (req.task === 'food') {
    if (!req.image && !req.audio && !req.desc?.trim()) throw new Error('Manda una foto, escribe qué comiste o graba un audio.')
    const parts: Part[] = []
    if (req.image) parts.push({ inlineData: { mimeType: req.mime || 'image/jpeg', data: req.image } })
    if (req.audio) parts.push({ inlineData: { mimeType: req.audioMime || 'audio/mp4', data: req.audio } })
    parts.push({ text: [
      `Esta es mi ${req.slot}, a las ${req.time}.`,
      req.image ? 'La foto es solo para que te des una idea del plato y las porciones.' : 'No hay foto.',
      req.audio ? 'En el audio te explico qué comí y cómo lo preparé.' : '',
      req.desc?.trim() ? `Lo que comí, en mis palabras: ${req.desc.trim()}` : '',
    ].filter(Boolean).join('\n') })
    return ask(FoodOut,
      `Analizas las comidas de Isaí: 1.73 m, ~100 kg, cuerpo endomorfo, bajando grasa. Su plan: ${req.plan}. Come en una ventana de 10:00 a 18:00. ` +
      'Lo que él describe (texto o audio) manda sobre la foto: ingredientes, cantidades, aceite y forma de cocinar. Si algo no se ve o no lo dice, supón porciones normales y dilo. ' +
      'Estima con honestidad kcal y macros de esta comida y dile si encaja en su plan del día.',
      parts)
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
  if (e instanceof NvidiaError) {
    if (e.status === 429) return 'Se acabó el límite gratis de NVIDIA por ahora. Espera un minuto.'
    if (e.status === 401 || e.status === 403) return 'La llave de NVIDIA no es válida o no tiene permiso.'
  }
  if (e instanceof Error) return e.message
  return 'Error desconocido.'
}
