"""Genera las voces con Gemini TTS (voz Kore, estilo chic y claro para aprender).

Junta varias frases por petición y corta el audio en los silencios entre líneas.
Si el número de cortes no coincide con el de frases, reintenta esas frases una por una.

Uso (desde app/):
  node scripts/audio-list.ts > scripts/audio-list.json
  GEMINI_API_KEY=... python scripts/audio-gemini.py [ar|fr] [--limit N] [--batch 24] [--out DIR]
Lo ya hecho queda en scripts/audio-gemini-done-<lang>.json y no se vuelve a pedir.
"""
import argparse, base64, json, os, re, subprocess, sys, tempfile, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = 'gemini-3.8-flash-tts'
VOICE = 'Kore'
STYLE = {
    'ar': ("Young, chic Beiruti woman with the relaxed AUB style, warm and a little playful. She speaks Lebanese Arabic "
           "with natural everyday Beirut pronunciation, never formal Arabic. She speaks clearly and a bit slowly, "
           "articulating every word, like teaching a friend who is learning Lebanese. Each line is a separate phrase: "
           "read them in order and leave a clear two-second silence between lines."),
    'fr': ("Chic young Parisian woman, relaxed and warm, slightly playful. She speaks clearly and a bit slowly, "
           "articulating every word, like teaching a friend who is learning French, with natural everyday Paris "
           "pronunciation. Each line is a separate phrase: read them in order and leave a clear two-second silence "
           "between lines."),
}
DONE = os.path.join(HERE, 'audio-gemini-done-{}.json')


def request(lang, lines, key):
    text = "# DIRECTOR'S NOTES\n" + STYLE[lang] + "\n\n# TRANSCRIPT\n" + "\n".join(lines)
    body = {"contents": [{"parts": [{"text": text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}}}}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
                                 json.dumps(body).encode(), {"Content-Type": "application/json", "x-goog-api-key": key})
    for attempt in range(6):
        try:
            r = json.load(urllib.request.urlopen(req, timeout=300))
            return base64.b64decode(r['candidates'][0]['content']['parts'][0]['inlineData']['data'])
        except urllib.error.HTTPError as e:
            raw = e.read().decode()
            msg = raw[:300]
            daily = re.search(r'per_day[\s\S]*?"retryDelay": "(\d+)', raw)
            if e.code == 429 and daily:  # Tier 1: 100 peticiones al día por modelo. Espera al reinicio y sigue.
                wait = int(daily.group(1)) + 120
                print(f'  límite diario: sigo en {wait // 3600} h {wait % 3600 // 60} min', flush=True)
                time.sleep(wait)
                return request(lang, lines, key)
            if e.code in (429, 500, 503) and attempt < 5:
                wait = 20 * (attempt + 1)
                print(f'  {e.code}, espero {wait}s', flush=True)
                time.sleep(wait)
                continue
            raise SystemExit(f'Error {e.code}: {msg}')
        except (KeyError, IndexError, urllib.error.URLError, TimeoutError) as e:
            if attempt < 5:
                time.sleep(10)
                continue
            raise SystemExit(f'Respuesta inválida: {e}')


def split(pcm_path, n):
    """Busca los n-1 silencios más largos y devuelve n tramos (inicio, fin) en segundos."""
    out = subprocess.run(['ffmpeg', '-v', 'info', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcm_path,
                          '-af', 'silencedetect=noise=-40dB:d=0.45', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    total = os.path.getsize(pcm_path) / 48000
    gaps = [(e - s, s, e) for s, e in zip(starts, ends) if s > 0.05 and e < total - 0.05]
    if len(gaps) < n - 1:
        return None
    cut = sorted(sorted(gaps, reverse=True)[:n - 1], key=lambda g: g[1])
    bounds, t = [], 0.0
    for _, s, e in cut:
        bounds.append((t, s))
        t = e
    bounds.append((t, total))
    return bounds


def encode(pcm_path, start, end, dst):
    start, end = max(0, start - 0.08), end + 0.12
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcm_path,
                    '-ss', f'{start:.3f}', '-to', f'{end:.3f}',
                    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.15',
                    '-ac', '1', '-ar', '24000', '-b:a', '40k', dst], check=True)


def plausible(bounds, items):
    """Descarta cortes donde una frase corta salió muy larga o al revés (señal de que se movió un corte)."""
    secs = [e - s for s, e in bounds]
    chars = [len(it['text']) for it in items]
    rate = sum(secs) / max(1, sum(chars))
    return all(0.35 < s / max(0.4, c * rate) < 2.8 for s, c in zip(secs, chars))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('lang', choices=['ar', 'fr'])
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--batch', type=int, default=24)
    ap.add_argument('--out', default=os.path.join(HERE, '..', 'public', 'audio'))
    ap.add_argument('--only', nargs='*', help='textos exactos a generar (pruebas)')
    a = ap.parse_args()
    key = os.environ.get('GEMINI_API_KEY') or sys.exit('Falta GEMINI_API_KEY')
    items = [x for x in json.load(open(os.path.join(HERE, 'audio-list.json'), encoding='utf8')) if x['lang'] == a.lang]
    if a.only:
        items = [x for x in items if x['text'] in a.only]
    DONE_PATH = DONE.format(a.lang)
    done = json.load(open(DONE_PATH, encoding='utf8')) if os.path.exists(DONE_PATH) else {}
    todo = [x for x in items if done.get(f"{x['lang']}/{x['key']}") != MODEL + VOICE or a.only]
    if a.limit:
        todo = todo[:a.limit]
    os.makedirs(os.path.join(a.out, a.lang), exist_ok=True)
    print(f'{a.lang}: {len(todo)} por generar', flush=True)
    queue = [todo[i:i + a.batch] for i in range(0, len(todo), a.batch)]
    made = 0
    with tempfile.TemporaryDirectory() as tmp:
        while queue:
            group = queue.pop(0)
            pcm = os.path.join(tmp, 'b.pcm')
            open(pcm, 'wb').write(request(a.lang, [x['text'] for x in group], key))
            bounds = split(pcm, len(group)) if len(group) > 1 else [(0, os.path.getsize(pcm) / 48000)]
            if bounds is None or (len(group) > 1 and not plausible(bounds, group)):
                print(f'  cortes dudosos en un lote de {len(group)}: lo parto', flush=True)
                if len(group) > 1:
                    half = len(group) // 2
                    queue[:0] = [group[:half], group[half:]]
                continue
            for it, (s, e) in zip(group, bounds):
                encode(pcm, s, e, os.path.join(a.out, a.lang, it['key'] + '.mp3'))
                done[f"{it['lang']}/{it['key']}"] = MODEL + VOICE
            made += len(group)
            json.dump(done, open(DONE_PATH, 'w', encoding='utf8'), indent=0, sort_keys=True)
            print(f'  {made}/{len(todo)}', flush=True)


main()
