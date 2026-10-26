"""Genera las voces con Gemini TTS (voz Kore, estilo chic y claro para aprender).

Junta varias frases por petición y corta el audio en los silencios entre líneas.
Si el número de cortes no coincide con el de frases, reintenta esas frases una por una.

Uso (desde app/):
  node scripts/audio-list.ts > scripts/audio-list.json
  GEMINI_API_KEY=... python scripts/audio-gemini.py [ar|fr] [--limit N] [--batch 24] [--out DIR]
Lo ya hecho queda en scripts/audio-gemini-done-<lang>.json y no se vuelve a pedir.
"""
import argparse, base64, json, math, os, re, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.request

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


def silences(pcm_path, min_len=0.22):
    out = subprocess.run(['ffmpeg', '-v', 'info', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcm_path,
                          '-af', f'silencedetect=noise=-40dB:d={min_len}', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    total = os.path.getsize(pcm_path) / 48000
    return [(s, e) for s, e in zip(starts, ends) if s > 0.05 and e < total - 0.05], total


def weight(text):
    """Duración relativa esperada de una frase: letras más un fijo por arranque y pausa interna por coma."""
    return len(text) + 4 + 6 * len(re.findall(r'[،,؟?!.]\s', text))


def split(pcm_path, items):
    """Elige los n-1 silencios que mejor reparten el audio según el largo de cada frase.

    Programación dinámica: premia silencios largos y castiga tramos cuya duración no cuadra
    con la esperada. Así una coma dentro de una frase no se toma por el cambio de línea.
    Devuelve los tramos (inicio, fin) o None si ni el mejor reparto es creíble.
    """
    n = len(items)
    gaps, total = silences(pcm_path)
    if n == 1:
        return [(0.0, total)]
    if len(gaps) < n - 1:
        return None
    w = [weight(it['text']) for it in items]
    speech = total - sum(sorted((e - s for s, e in gaps), reverse=True)[:n - 1])
    exp = [speech * x / sum(w) for x in w]
    pts = [(0.0, 0.0)] + gaps + [(total, total)]  # (inicio silencio, fin silencio); extremos ficticios
    m = len(pts)
    INF = float('inf')

    def seg_cost(i, j, k):  # tramo k entre el silencio i y el j
        dur = pts[j][0] - pts[i][1]
        if dur <= 0.15:
            return INF
        return math.log(dur / exp[k]) ** 2

    def gap_bonus(j):
        return min(pts[j][1] - pts[j][0], 2.0)

    best = [[INF] * m for _ in range(n + 1)]
    back = [[-1] * m for _ in range(n + 1)]
    best[0][0] = 0.0
    for k in range(1, n + 1):
        for j in range(1, m):
            if (k < n) == (j == m - 1):
                continue
            for i in range(j):
                if best[k - 1][i] == INF:
                    continue
                c = best[k - 1][i] + seg_cost(i, j, k - 1) - (1.5 * gap_bonus(j) if j < m - 1 else 0)
                if c < best[k][j]:
                    best[k][j], back[k][j] = c, i
    if best[n][m - 1] == INF:
        return None
    idx, j = [], m - 1
    for k in range(n, 0, -1):
        idx.append(j)
        j = back[k][j]
    idx = [0] + idx[::-1]
    bounds = [(pts[idx[k]][1], pts[idx[k + 1]][0]) for k in range(n)]
    ok = all(abs(math.log((e - s) / x)) < math.log(2.6) for (s, e), x in zip(bounds, exp))
    return bounds if ok else None


def encode(pcm_path, start, end, dst):
    start, end = max(0, start - 0.08), end + 0.12
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcm_path,
                    '-ss', f'{start:.3f}', '-to', f'{end:.3f}',
                    '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.15',
                    '-ac', '1', '-ar', '24000', '-b:a', '40k', dst], check=True)


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
    tmp_keep = os.path.join(tempfile.gettempdir(), 'lockin-audio-dudosos')
    os.makedirs(tmp_keep, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        while queue:
            group = queue.pop(0)
            pcm = os.path.join(tmp, 'b.pcm')
            open(pcm, 'wb').write(request(a.lang, [x['text'] for x in group], key))
            bounds = split(pcm, group)
            if bounds is None:
                shutil.copy(pcm, os.path.join(tmp_keep, f'dudoso-{time.time():.0f}.pcm'))
                json.dump([x['text'] for x in group], open(os.path.join(tmp_keep, f'dudoso-{time.time():.0f}.json'), 'w', encoding='utf8'), ensure_ascii=False)
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
