import type { VercelRequest, VercelResponse } from '@vercel/node'
import { errorMessage, runAi } from './_core'

/** Función de Vercel: POST /api/ai */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' })
  try {
    res.status(200).json(await runAi(req.body))
  } catch (e) {
    res.status(500).json({ error: errorMessage(e) })
  }
}
