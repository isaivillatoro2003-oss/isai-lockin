"""Escribe completas las expresiones con Allah en el contenido de árabe."""
import json, re, sys

def cap(src, word):
    return word[0].upper() + word[1:] if src[:1].isupper() else word

RULES = [
    (re.compile(r'(?<![\w])(?:[eE]l|[lL])7amdella\b'), lambda m: cap(m.group(0), 'al7amdulillah')),
    (re.compile(r'(?<![\w])(?:[eE]l|[lL])Hamdel·?la\b'), lambda m: cap(m.group(0), 'alHamdulil·lah')),
    (re.compile(r'(?<![\w])[nN][cs]halla\b'), lambda m: cap(m.group(0), 'inshallah')),
    (re.compile(r'إنشالله|(?<![؀-ۿ])نشالله'), lambda m: 'إن شاء الله'),
    (re.compile(r'الحمدلله'), lambda m: 'الحمد لله'),
]

def fix(s):
    for rx, fn in RULES:
        s = rx.sub(fn, s)
    return s

def walk(o):
    if isinstance(o, dict): return {k: walk(v) for k, v in o.items()}
    if isinstance(o, list): return [walk(v) for v in o]
    if isinstance(o, str): return fix(o)
    return o

for f in sys.argv[1:]:
    d = walk(json.load(open(f, encoding='utf8')))
    if 'extra' in d:
        for c in d['extra']:
            if c['id'] == 'ar-x062': c.update(t='inshallah', note='también en chat se escribe completo')
            if c['id'] == 'ar-x072': c.update(t='al7amdulillah', note='también en chat se escribe completo')
    for l in d.get('lessons', []):
        if l.get('table'):
            l['table']['rows'] = [r for r in l['table']['rows'] if r[0].lower() != r[1].lower()]
        l['explain'] = [e.replace(', inshallah (ojalá)', '') for e in l['explain']]
    json.dump(d, open(f, 'w', encoding='utf8', newline='\n'), ensure_ascii=False, indent=1)
