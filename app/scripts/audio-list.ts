/** Lista todo lo que la app puede leer en voz alta. Uso: node scripts/audio-list.ts > scripts/audio-list.json */
import { readFileSync } from 'node:fs'
import { audioKey, spokenText, type Speakable } from '../src/domain/audioKey.ts'

const read = (f: string) => JSON.parse(readFileSync(new URL(`../src/content/${f}`, import.meta.url), 'utf8'))
const out = new Map<string, { lang: string; text: string; key: string }>()

for (const lang of ['ar', 'fr'] as const) {
  const base = read(`${lang}.json`)
  const more = read(`${lang}-mas.json`)
  const items: Speakable[] = [...base.cards, ...(base.extra ?? []), ...more.cards]
  for (const l of more.lessons) items.push(...l.examples, ...l.dialogue)
  for (const s of more.stories) items.push(...s.lines)
  for (const x of base.alphabet ?? []) items.push({ t: x.example, script: x.script.split(' ')[0] })
  for (const it of items) {
    const text = spokenText(it, lang)
    if (!text) continue
    const key = audioKey(text)
    out.set(`${lang}/${key}`, { lang, text, key })
  }
}
process.stdout.write(JSON.stringify([...out.values()]))
