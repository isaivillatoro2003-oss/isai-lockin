import { get, put } from '@vercel/blob'

/*
 * Sincronización entre dispositivos sobre Vercel Blob privado.
 * Todo vive en un documento (lockin/db.json); fotos y audios van aparte en lockin/files/.
 * Cada fila guarda _s = hora del servidor al recibirla: así "dame lo nuevo desde X" no depende del reloj del teléfono.
 * Gana el cambio con updatedAt más reciente. Protegido con SYNC_KEY.
 */

type Row = Record<string, unknown> & { updatedAt: number; _s?: number }
interface Doc { tables: Record<string, Record<string, Row>>; tombstones: Record<string, Row> }

export type SyncRequest =
  | { op: 'pull'; since: number }
  | { op: 'push'; rows: Record<string, { pk: string; row: Row }[]>; tombstones: Row[] }
  | { op: 'putFile'; p: string; data: string; type: string }
  | { op: 'getFile'; p: string }

const DOC = 'lockin/db.json'

async function readText(pathname: string) {
  const r = await get(pathname, { access: 'private', useCache: false })
  if (!r || r.statusCode !== 200) return null
  return new Response(r.stream).text()
}

async function load(): Promise<Doc> {
  const t = await readText(DOC)
  return t ? JSON.parse(t) : { tables: {}, tombstones: {} }
}

const save = (doc: Doc) => put(DOC, JSON.stringify(doc), { access: 'private', allowOverwrite: true, contentType: 'application/json' })

const safePath = (p: string) => {
  if (!/^files\/[\w.|-]+$/.test(p)) throw new Error('Ruta inválida.')
  return `lockin/${p}`
}

export function checkKey(key: string | undefined) {
  if (!process.env.SYNC_KEY) throw new Error('El servidor no tiene SYNC_KEY configurada.')
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('El servidor no tiene almacenamiento (Blob) conectado.')
  if (key !== process.env.SYNC_KEY) throw Object.assign(new Error('Clave de sincronización incorrecta.'), { status: 401 })
}

export async function runSync(req: SyncRequest) {
  if (req.op === 'pull') {
    const doc = await load()
    const rows: Record<string, Row[]> = {}
    for (const [t, byPk] of Object.entries(doc.tables)) {
      const fresh = Object.values(byPk).filter((r) => (r._s ?? 0) > req.since)
      if (fresh.length) rows[t] = fresh
    }
    const tombstones = Object.values(doc.tombstones).filter((r) => (r._s ?? 0) > req.since)
    return { rows, tombstones, now: Date.now() }
  }

  if (req.op === 'push') {
    const doc = await load()
    const s = Date.now()
    for (const [t, list] of Object.entries(req.rows)) {
      const byPk = (doc.tables[t] ??= {})
      for (const { pk, row } of list) {
        const cur = byPk[pk]
        if (!cur || row.updatedAt >= cur.updatedAt) byPk[pk] = { ...row, _s: s }
      }
    }
    for (const tomb of req.tombstones) {
      const { table, pk } = tomb as Row & { table: string; pk: string }
      const cur = doc.tables[table]?.[pk]
      if (cur && cur.updatedAt <= tomb.updatedAt) delete doc.tables[table][pk]
      doc.tombstones[tomb.id as string] = { ...tomb, _s: s }
    }
    await save(doc)
    return { now: s }
  }

  if (req.op === 'putFile') {
    await put(safePath(req.p), Buffer.from(req.data, 'base64'), { access: 'private', allowOverwrite: true, contentType: req.type })
    return { ok: true }
  }

  const r = await get(safePath(req.p), { access: 'private', useCache: false })
  if (!r || r.statusCode !== 200) throw Object.assign(new Error('Archivo no encontrado.'), { status: 404 })
  const buf = Buffer.from(await new Response(r.stream).arrayBuffer())
  return { data: buf.toString('base64'), type: r.headers.get('content-type') ?? 'application/octet-stream' }
}

export const statusOf = (e: unknown) => (e as { status?: number })?.status ?? 500
export const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Error de sincronización.')
