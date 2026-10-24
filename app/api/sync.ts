import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkKey, messageOf, runSync, statusOf } from './_sync'

/** Función de Vercel: POST /api/sync */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' })
  try {
    checkKey(req.headers['x-sync-key'] as string | undefined)
    res.status(200).json(await runSync(req.body))
  } catch (e) {
    res.status(statusOf(e)).json({ error: messageOf(e) })
  }
}
