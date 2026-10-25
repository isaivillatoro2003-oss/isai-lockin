"""Genera los MP3 con voces neuronales de Microsoft Edge (gratis).

Uso (desde app/):
  node scripts/audio-list.ts > scripts/audio-list.json
  python scripts/audio-gen.py            # solo genera lo que falta
  python scripts/audio-gen.py --prune    # además borra MP3 que ya no se usan
Requiere: pip install edge-tts, y ffmpeg en el PATH (re-codifica a 32 kbps mono).
"""
import asyncio, json, os, subprocess, sys, tempfile
import edge_tts

VOICE = {'ar': 'ar-LB-RamiNeural', 'fr': 'fr-FR-HenriNeural'}  # respaldo; las voces principales salen de audio-gemini.py
RATE = '-10%'
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')
items = json.load(open(os.path.join(os.path.dirname(__file__), 'audio-list.json'), encoding='utf8'))


async def one(it, sem, tmp):
    dst = os.path.join(ROOT, it['lang'], it['key'] + '.mp3')
    if os.path.exists(dst):
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
    if '--prune' in sys.argv:
        keep = {f"{it['lang']}/{it['key']}.mp3" for it in items}
        for lang in VOICE:
            for f in os.listdir(os.path.join(ROOT, lang)):
                if f'{lang}/{f}' not in keep:
                    os.remove(os.path.join(ROOT, lang, f))


asyncio.run(main())
