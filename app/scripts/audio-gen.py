"""Genera los MP3 con voces neuronales de Microsoft Edge (gratis).

Uso (desde app/):
  node scripts/audio-list.ts > scripts/audio-list.json
  python scripts/audio-gen.py            # solo genera lo que falta
  python scripts/audio-gen.py --prune    # además borra MP3 que ya no se usan
  python scripts/audio-gen.py --female --exclude-done
      # voces femeninas interinas (Layla/Denise) SOLO para lo que Gemini aún no hizo
      # (audio-gemini-done-*.json); sobrescribe los MP3 de Edge masculinos y lo anota en
      # audio-edge-female-done.json para no repetirlo.
Requiere: pip install edge-tts, y ffmpeg en el PATH (re-codifica a 32 kbps mono).
"""
import asyncio, json, os, subprocess, sys, tempfile
import edge_tts

VOICE = {'ar': 'ar-LB-RamiNeural', 'fr': 'fr-FR-HenriNeural'}  # respaldo; las voces principales salen de audio-gemini.py
FEMALE = {'ar': 'ar-LB-LaylaNeural', 'fr': 'fr-FR-DeniseNeural'}
FEM = '--female' in sys.argv
EXCL = '--exclude-done' in sys.argv
if FEM:
    VOICE = FEMALE
HERE = os.path.dirname(__file__)
FEM_DONE = os.path.join(HERE, 'audio-edge-female-done.json')
skip = set()
if EXCL:
    for l in ('ar', 'fr'):
        f = os.path.join(HERE, f'audio-gemini-done-{l}.json')
        if os.path.exists(f):
            skip |= set(json.load(open(f, encoding='utf8')))
fem_done = set(json.load(open(FEM_DONE, encoding='utf8'))) if FEM and os.path.exists(FEM_DONE) else set()
RATE = '-10%'
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')
items = json.load(open(os.path.join(os.path.dirname(__file__), 'audio-list.json'), encoding='utf8'))


async def one(it, sem, tmp):
    dst = os.path.join(ROOT, it['lang'], it['key'] + '.mp3')
    tag = f"{it['lang']}/{it['key']}"
    if FEM:
        if tag in skip or tag in fem_done:
            return 0
    elif os.path.exists(dst):
        return 0
    async with sem:
        raw = os.path.join(tmp, it['key'] + it['lang'] + '.mp3')
        for attempt in range(4):
            try:
                await edge_tts.Communicate(it['text'], VOICE[it['lang']], rate=RATE).save(raw)
                break
            except Exception as e:  # el servicio corta a veces: reintenta
                if attempt == 3:
                    print('FALLÓ', it['lang'], it['text'], e, file=sys.stderr)
                    return 0
                await asyncio.sleep(2 + attempt * 3)
        proc = await asyncio.create_subprocess_exec(
            'ffmpeg', '-v', 'error', '-y', '-i', raw, '-ac', '1', '-ar', '24000', '-b:a', '32k', dst)
        await proc.wait()
        os.remove(raw)
        if FEM:
            fem_done.add(tag)
        return 1


async def main():
    for lang in VOICE:
        os.makedirs(os.path.join(ROOT, lang), exist_ok=True)
    sem = asyncio.Semaphore(8)
    with tempfile.TemporaryDirectory() as tmp:
        done = 0
        tasks = [one(it, sem, tmp) for it in items]
        for i, t in enumerate(asyncio.as_completed(tasks), 1):
            done += await t
            if i % 250 == 0:
                print(f'{i}/{len(tasks)}', flush=True)
    print('nuevos:', done)
    if FEM:
        json.dump(sorted(fem_done), open(FEM_DONE, 'w', encoding='utf8'))
    if '--prune' in sys.argv:
        keep = {f"{it['lang']}/{it['key']}.mp3" for it in items}
        for lang in VOICE:
            for f in os.listdir(os.path.join(ROOT, lang)):
                if f'{lang}/{f}' not in keep:
                    os.remove(os.path.join(ROOT, lang, f))


asyncio.run(main())
