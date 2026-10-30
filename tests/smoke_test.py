#!/usr/bin/env python3
"""Smoke test for Times Archive. Run: python3 tests/smoke_test.py  (server must be running on 4645)."""
import json, os, re, subprocess, sys, urllib.request, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = os.environ.get('URL', 'http://127.0.0.1:4645')
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

A = json.load(open(os.path.join(ROOT, 'data', 'archive.json')))
E = A['editions']
check(len(E) >= 30, f'{len(E)} editions indexed')
dates = [e['date'] for e in E]
check(dates == sorted(dates), 'editions sorted by date')
check(A['range']['first'] == dates[0] and A['range']['last'] == dates[-1], f"range {dates[0]}..{dates[-1]}")
for e in E:
    for p in e['pages']:
        for k in ('img', 'thumb'):
            if not os.path.exists(os.path.join(ROOT, 'web', p[k])):
                fails.append(f'missing {p[k]}')
check(not any(f.startswith('missing') for f in fails), 'all page images and thumbnails exist')
check(all(e['headlines'] for e in E), 'every edition has at least one verified headline')
def norm(s): return re.sub(r'[^a-z0-9]+', ' ', s.lower().replace('’', "'").replace('–', '-').replace('—', '-')).strip()
bad = []
for e in E:
    full = ' ' + norm(' '.join(p['text'] for p in e['pages'])) + ' '
    for h in e['headlines']:
        ws = set(norm(h['headline']).split())
        if ws and sum(1 for w in ws if f' {w} ' in full) / len(ws) < 0.85:
            bad.append((e['id'], h['headline']))
check(not bad, f'headlines all appear in PDF text ({sum(len(e["headlines"]) for e in E)} checked) {bad[:3]}')
check(all(e['print']['status'] in ('printed', 'pdf-only', 'unknown') for e in E), 'print status values valid')
check(all(os.path.exists(e['pdf']) for e in E), 'source PDFs still present (read-only)')

# server
for path, ctype in [('/', 'text/html'), ('/app.js', 'javascript'), ('/archive-data.js', 'javascript'), ('/style.css', 'css'), (E[-1]['pages'][0]['thumb'] and '/' + E[-1]['pages'][0]['thumb'], 'image'), (f"/pdf/{E[-1]['id']}", 'pdf')]:
    try:
        r = urllib.request.urlopen(URL + path, timeout=10)
        check(r.status == 200 and ctype in r.headers.get('Content-Type', ''), f'GET {path} -> {r.status} {r.headers.get("Content-Type")}')
    except Exception as ex:
        check(False, f'GET {path} ({ex})')
ss = subprocess.run(['ss', '-ltn'], capture_output=True, text=True).stdout
check('127.0.0.1:4645' in ss and '0.0.0.0:4645' not in ss, 'server bound to 127.0.0.1:4645 only')

# headless browser checks against the live server and the snapshot
def dom(url):
    return subprocess.run(['google-chrome', '--headless=new', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=5000', '--dump-dom', url], capture_output=True, text=True, timeout=90).stdout
d = dom(URL + '/#/search?q=Marty')
m = re.search(r'(\d+) editions? · (\d+) hits? for Marty', d)
check(bool(m) and int(m.group(1)) > 0, f'search "Marty" renders results ({m.group(0) if m else "none"})')
d = dom(URL + f"/#/read/{E[-1]['id']}/2")
check(f"Page 2 of {len(E[-1]['pages'])}" in d, 'reader opens on page 2')
d = dom(URL + '/#/timeline')
check(d.count('class="day ') == len(E), 'print timeline has one tile per edition')
d = dom(URL + '/#/trends')
check('Beat of the week' in d and '<table class="heat">' in d, 'trends view renders heatmaps')
d = dom(URL + '/#/?today=2026-09-30')
check('This day in Parent A history' in d and 'One week ago' in d, 'this-day card renders')

snap = os.path.join(ROOT, 'dist', 'times-archive-snapshot.html')
size = os.path.getsize(snap)
check(size < 40 * 1024 * 1024, f'snapshot {size/1048576:.1f} MB < 40 MB')
html = open(snap).read()
check(not re.search(r'(src|href)=["\']https?://', html), 'snapshot makes no external requests')
d = dom('file://' + snap + '#/search?q=Kid School')
check(re.search(r'\d+ editions? · \d+ hits? for Kid School', d) is not None, 'snapshot search works offline')
d = dom('file://' + snap + '#/wall')
check(d.count('data:image/jpeg;base64') >= len(E), 'snapshot newsstand shows embedded thumbnails')

fl = subprocess.run(['node', '--experimental-websocket', os.path.join(ROOT, 'tests', 'flip_check.mjs')], capture_output=True, text=True, cwd=ROOT, timeout=90)
check('PASS page flip' in fl.stdout, 'reader page-flip animation runs and advances the page')

print('\n' + ('ALL PASS' if not fails else f'{len(fails)} FAILURE(S)'))
sys.exit(1 if fails else 0)
