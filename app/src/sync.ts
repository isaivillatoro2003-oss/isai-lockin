import { db, SYNCED, type TombstoneRow } from './db'

/*
 * Sincronización con el servidor (api/_sync.ts). La clave y las marcas de tiempo son de cada dispositivo,
 * así que viven en localStorage; los datos viven en IndexedDB y en el Blob privado.
 */

type Row = Record<string, unknown> & { updatedAt: number }
const LS = { key: 'lockin:syncKey', push: 'lockin:lastPush', pull: 'lockin:lastPull', at: 'lockin:lastSyncAt' }

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } },
}

export const syncKey = () => ls.get(LS.key)
export const setSyncKey = (k: string) => ls.set(LS.key, k.trim())
export const lastSyncAt = () => Number(ls.get(LS.at) ?? 0)

async function call<T>(body: unknown): Promise<T> {
  const r = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sync-key': syncKey() ?? '' },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({ error: 'Respuesta inválida.' }))
  if (!r.ok) throw new Error(j.error ?? 'Error de sincronización.')
  return j as T
}

const toB64 = (b: Blob) => new Promise<string>((res) => { const f = new FileReader(); f.onload = () => res((f.result as string).split(',')[1]); f.readAsDataURL(b) })
const fileKey = (table: string, pk: string, field: string) => `files/${`${table}|${pk}|${field}`.replace(/[^\w.|-]/g, '_')}`
const pkOf = (table: string, row: Row) => String(row[db.table(table).schema.primKey.keyPath as string])

/** Sube las fotos y audios de la fila como archivos y deja una referencia en su lugar. */
async function outgoing(table: string, row: Row) {
  const out: Row = { ...row }
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Blob) {
      const p = fileKey(table, pkOf(table, row), k)
      await call({ op: 'putFile', p, data: await toB64(v), type: v.type || 'application/octet-stream' })
      out[k] = { __file: p, type: v.type }
    }
  }
  return out
}

async function incoming(row: Row) {
  const out: Row = { ...row }
  delete out._s
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === 'object' && '__file' in (v as object)) {
      const f = await call<{ data: string; type: string }>({ op: 'getFile', p: (v as { __file: string }).__file })
      out[k] = await (await fetch(`data:${f.type};base64,${f.data}`)).blob()
    }
  }
  return out
}

let running: Promise<{ sent: number; got: number }> | null = null

/** Sube lo cambiado desde la última vez y baja lo nuevo. Si ya hay una en curso, espera esa. */
export function syncNow() {
  if (!syncKey()) return Promise.reject(new Error('Falta la clave de sincronización.'))
  running ??= (async () => {
    const started = Date.now()
    const since = Number(ls.get(LS.push) ?? 0)

    // 1. Subir
    const rows: Record<string, { pk: string; row: Row }[]> = {}
    let sent = 0
    for (const t of SYNCED) {
      const changed = (await db.table(t).toArray() as Row[]).filter((r) => (r.updatedAt ?? 0) > since)
      if (!changed.length) continue
      rows[t] = await Promise.all(changed.map(async (r) => ({ pk: pkOf(t, r), row: await outgoing(t, r) })))
      sent += changed.length
    }
    const tombs = await db.tombstones.where('updatedAt').above(since).toArray()
    if (sent || tombs.length) await call({ op: 'push', rows, tombstones: tombs })
    ls.set(LS.push, String(started))

    // 2. Bajar
    const pull = await call<{ rows: Record<string, Row[]>; tombstones: (TombstoneRow & { _s?: number })[]; now: number }>(
      { op: 'pull', since: Number(ls.get(LS.pull) ?? 0) },
    )
    let got = 0
    for (const [t, list] of Object.entries(pull.rows)) {
      if (!(SYNCED as readonly string[]).includes(t)) continue
      const table = db.table(t)
      for (const r of list) {
        const local = await table.get(pkOf(t, r)) as Row | undefined
        if (local && local.updatedAt > r.updatedAt) continue
        await table.put(await incoming(r))
        got++
      }
    }
    for (const tomb of pull.tombstones) {
      if (!(SYNCED as readonly string[]).includes(tomb.table)) continue
      const local = await db.table(tomb.table).get(tomb.pk) as Row | undefined
      if (local && local.updatedAt <= tomb.updatedAt) { await db.table(tomb.table).delete(tomb.pk); got++ }
    }
    ls.set(LS.pull, String(pull.now))
    ls.set(LS.at, String(Date.now()))
    return { sent, got }
  })().finally(() => { running = null })
  return running
}

/** Vincular un dispositivo abriendo el enlace con #k=clave una sola vez; la clave sale de la barra de direcciones. */
function keyFromUrl() {
  const m = location.hash.match(/[#&]k=([^&]+)/)
  if (!m) return
  setSyncKey(decodeURIComponent(m[1]))
  history.replaceState(null, '', location.pathname + location.search)
}

/** Sincroniza al abrir, cada minuto y al salir de la app. */
export function startAutoSync() {
  keyFromUrl()
  if (!syncKey()) return () => {}
  const run = () => { syncNow().catch(() => {}) }
  run()
  const t = setInterval(run, 60_000)
  const vis = () => run()
  document.addEventListener('visibilitychange', vis)
  return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
}
