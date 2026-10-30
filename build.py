#!/usr/bin/env python3
"""Times Archive builder: reads Family Times editions (read-only) and writes
data/archive.json + rendered page images into web/img. Never modifies sources."""
import glob, hashlib, json, os, re, subprocess, sys, datetime, collections

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, 'web')
PAGES = os.path.join(WEB, 'img', 'pages')
THUMBS = os.path.join(WEB, 'img', 'thumbs')
SNAP = os.path.join(ROOT, 'data', 'snap-pages')
for d in (PAGES, THUMBS, SNAP):
    os.makedirs(d, exist_ok=True)

NEWS = '/workspace/newspaper'
AGENTS = '/home/box/agent-data/agents'
FT_AGENT = os.path.join(AGENTS, '784bedfc-74d6-45a0-a291-762ff05bb0c6')

def sh(*a):
    return subprocess.run(a, capture_output=True, text=True).stdout

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()

def pdfinfo(p):
    out = sh('pdfinfo', p)
    info = {}
    for line in out.splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            info[k.strip()] = v.strip()
    return info

VOCAB = {}
def build_vocab(texts):
    import math
    c = collections.Counter()
    for t in texts:
        for line in t.split('\n'):
            toks = line.split(' ')
            if len(toks) >= 4 and sum(1 for x in toks if 0 < len(x) <= 3) / len(toks) > 0.6:
                continue  # skip letter-spaced lines
            for w in re.findall(r"[A-Za-z]+(?:['’][a-z]+)?", line):
                c[w.lower().replace('’', "'")] += 1
    for w in ('a', 'i', 'of', 'on', 'the', 'for', 'day', 'look', 'needs', 'mini', 'dad', 'joke', 'bible', 'verse', 'athlete', 'quote', 'kids', 'beats', 'town', 'from', 'kida', "kida's", 'interesting', 'fact', 'time', 'only', 'dry', 'window', 'pa', 'csz', 'iaam', 'nws', 'umterps', 'nfhs', 'espn', 'nfl', 'mlb', 'masn', 'stjohnsp', 'org', 'com'):
        c[w] += 50
    total = sum(c.values())
    VOCAB.clear()
    for w, n in c.items():
        if len(w) == 1 and w not in ('a', 'i'):
            continue
        VOCAB[w] = math.log(total / n) + (2.5 if len(w) <= 2 else 0)

def segment(run):
    """Split a joined run like THEFAMILYTIMES into words using the archive's own vocabulary."""
    low = run.lower().replace('’', "'")
    n = len(low)
    best = [(0.0, 0)] + [(1e9, 0)] * n
    for i in range(1, n + 1):
        for j in range(max(0, i - 18), i):
            w = low[j:i]
            cost = VOCAB.get(w, 25 + 4 * len(w) if len(w) > 0 else 1e9)
            if best[j][0] + cost < best[i][0]:
                best[i] = (best[j][0] + cost, j)
    out, i = [], n
    while i > 0:
        j = best[i][1]; out.append(run[j:i]); i = j
    return ' '.join(reversed(out))

def fix_tracking(line):
    """Join letter-spaced small caps like 'W E D N E S DAY' and re-split them into words."""
    toks = line.split(' ')
    if len(toks) >= 4:
        short = sum(1 for t in toks if 0 < len(t) <= 3)
        upper = sum(1 for t in toks if t and t.upper() == t)
        if short / len(toks) > 0.6 and upper / len(toks) > 0.8:
            s = ''.join(toks)
            s = re.sub(r'([A-Za-z])(\d)', r'\1 \2', s)
            s = re.sub(r'(\.)([A-Z0-9])(?![A-Z]?\.)', r'\1 \2', s) if 'A.M.' not in s and 'P.M.' not in s else re.sub(r'(VOL\.|NO\.)(\S)', r'\1 \2', s)
            s = re.sub(r"[A-Za-z'’]{4,}", lambda m: segment(m.group(0)) if VOCAB else m.group(0), s)
            s = re.sub(r'·', ' · ', s)
            s = re.sub(r',(?=\S)', ', ', s)
            s = re.sub(r'\b(AS OF)(\d)', r'\1 \2', s)
            return re.sub(r'\s+', ' ', s).strip()
    return line

def clean_text(t):
    t = t.replace('\f', '\n')
    t = re.sub(r'[\u2010\u00ad-]\n(?=[a-z])', '', t)  # rejoin hyphenated line breaks
    lines = [fix_tracking(l.rstrip()) for l in t.split('\n')]
    t = '\n'.join(lines)
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()

def norm(s):
    s = s.lower().replace('’', "'").replace('–', '-').replace('—', '-')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def verified(h, ptext_norm):
    """True if headline's words appear (in order, contiguous after normalising) in the PDF text."""
    n = norm(h)
    if not n:
        return False
    if n in ptext_norm:
        return True
    words = n.split()
    if len(words) < 3:
        return False
    hits = sum(1 for w in set(words) if f' {w} ' in f' {ptext_norm} ')
    return hits / len(set(words)) >= 0.85

# ---------- discover sources ----------
log_rows = []
for path in (os.path.join(NEWS, 'edition-log.jsonl'), '/workspace/format-v2/edition-log.jsonl'):
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line:
                try:
                    r = json.loads(line); r['_src'] = path; log_rows.append(r)
                except Exception:
                    pass

edition_dirs = sorted(glob.glob(os.path.join(NEWS, 'edition-[0-9]*')))
all_pdfs = {}  # sha -> list of paths
def add_pdf(p):
    all_pdfs.setdefault(sha(p), []).append(p)

for d in edition_dirs:
    for p in glob.glob(os.path.join(d, '*.pdf')):
        add_pdf(p)
# agent attachments of the newspaper bot + any other *Times* PDFs under /workspace and agent folders
extra_candidates = glob.glob(os.path.join(FT_AGENT, 'attachments', '*.pdf'))
for p in sh('bash', '-lc', "find /workspace /home/box/agent-data/agents -iname '*.pdf' -not -path '*/venv/*' -not -path '/workspace/tokenmax/*' 2>/dev/null").split('\n'):
    if p and not p.startswith(NEWS + '/edition-'):
        extra_candidates.append(p)
extras = []
for p in sorted(set(extra_candidates)):
    info = pdfinfo(p)
    title = info.get('Title', '')
    if 'Times' in title or 'Times' in os.path.basename(p):
        h = sha(p)
        known = h in all_pdfs
        extras.append({'path': p, 'title': title, 'sha256': h, 'duplicate_of': all_pdfs.get(h, [None])[0]})
        add_pdf(p)

# HTML editions elsewhere (edition.html is the build source for each PDF)

# ---------- people / topics config ----------
FAMILY = [
    ('Parent A', r'\bParent A\b(?! Family Times)(?!s\b)'),
    ('Parent B', r'\bParent B\b'),
    ('Kid B (Kid B)', r'\b(Kid B|Kid B)\b'),
    ('Kid A (Kid A)', r'\b(Kid A|Kid A)\b'),
    ('Marty (the dog)', r'\bMarty\b'),
]
TOPICS = [
    ('Kid School', r'\bKid School\b|\bKid School team?\b'),
    ('Ravens', r'\bRavens\b'),
    ('Terps', r'\bTerps\b|\bTerrapins\b|\bMaryland football\b'),
    ('Orioles', r"\bOrioles\b|\bO['’]s\b"),
    ('Bravo / Blue baseball', r'\bAPI\b|\bBlue\b'),
    ('Team Alpha', r'\bTeam Alpha\b'),
    ('Kid Club / Delta soccer', r'\bKid Club\b|\bDelta\b'),
    ('Rain & storms', r'\b(rain|rainy|storms?|showers?|thunderstorms?|wet)\b'),
    ('Sunshine', r'\b(sunny|sun|clear)\b'),
    ('School (Kid School / KS)', r'\bSt\. John\b|\bSJE\b|\bPicture Day\b|\bschool\b'),
    ('HSPT & high-school search', r'\bHSPT\b|\bKid School for a Day\b|\bshadow\b'),
    ('Faith (Mass / Confirmation)', r'\bMass\b|\bConfirmation\b|\bverse\b|\bSaint\b|\bFeast\b'),
    ('Space & science', r'\bNASA\b|\bAPOD\b|\bSpaceX\b|\bnebula\b|\bgalaxy\b|\bstar\b|\bplanet\b|\bmoon\b'),
    ('AI & tech', r'\bAI\b|\bOpenAI\b|\bGPT\b|\bApple\b|\biPhone\b|\biOS\b|\bGoogle\b|\bxAI\b|\bGrok\b'),
    ('Work calendar', r'\bwork calendar\b|\bZoom\b|\bconference room\b|\bdiscovery call\b'),
    ('Puzzles & comics', r'\bcrossword\b|\bJumble\b|\bDear Times\b|\bcomic\b'),
]
COMMON_FIRST = set("""Aaron Adam Adrian Alan Alex Alexander Alexis Allison Amanda Amy Andrew Andy Angela Anna Anne Anthony Ashley Austin Ben Benjamin Grandparent D Bill Billy Blake Bob Bobby Brad Brandon Brian Brittany Bruce Bryan Caleb Cameron Carl Carlos Caroline Carson Catherine Charles Charlie Chase Cheryl Chris Christian Christina Christopher Cindy Claire Cody Colin Connor Craig Dan Daniel Danny Dave David Dawn Dean Deborah Dennis Derek Devin Diana Donald Donna Doug Douglas Drew Dylan Ed Eddie Edward Elizabeth Ellen Emily Emma Eric Erin Ethan Evan Frank Gabriel Gary George Grace Greg Gregory Hannah Harold Heather Henry Ian Isaac Jack Jackson Jacob Jake James Jamie Jane Janet Janna Jared Jason Jay Jeff Jeffrey Jennifer Jenny Jeremy Jerry Jesse Jessica Jim Jimmy Joe Joel John Johnny Jon Jonathan Jordan Jose Joseph Josh Joshua Juan Julia Julie Justin Karen Kate Katherine Katie Keith Kelly Ken Kevin Kim Kyle Lamar Larry Laura Lauren Lee Leo Linda Lisa Logan Lucas Luke Lynn Madison Marcus Maria Mark Martin Mary Matt Matthew Max Megan Melissa Michael Michelle Mike Mitchell Molly Nancy Nathan Nick Nicholas Nicole Noah Olivia Owen Pat Patrick Paul Peter Phil Philip Rachel Ray Rebecca Richard Rick Rob Robert Ron Ronald Ross Russell Ryan Sam Samuel Sara Sarah Scott Sean Seth Shane Shannon Sharon Stephen Steve Steven Susan Taylor Teresa Thomas Tim Timothy Tina Todd Tom Tommy Tony Travis Tyler Victoria Vincent Walter Wayne William Zach Zachary Derrick Mark Zay Isaiah Kyle Tyrone Trey Odell Rashod Roquan Kyle Jalen Keaton Gunnar Adley Colton Jackson Cedric Malaki Billy Mike Taulia Dante Ray Jesse Joe Jordan Patrick Pope Leo Francis""".split())

# capitalised pairs that start with a given name but are places/schools in this paper
NOT_PEOPLE = {'John Carroll', 'Anne Arundel', 'Joseph Friday'}

# ---------- per edition ----------
build_vocab([sh('pdftotext', p, '-') for d in edition_dirs for p in glob.glob(os.path.join(d, '*.pdf')) if '-larger' not in p])
editions = []
for d in edition_dirs:
    eid = os.path.basename(d).split('-')[1]
    cpath = os.path.join(d, 'content.json')
    c = json.load(open(cpath)) if os.path.exists(cpath) else {}
    meta = c.get('meta', {})
    pdfs = sorted(glob.glob(os.path.join(d, '*.pdf')))
    primary = [p for p in pdfs if '-larger' not in p]
    primary = primary[0] if primary else (pdfs[0] if pdfs else None)
    variants = [p for p in pdfs if p != primary]
    if not primary:
        print('WARN no pdf in', d); continue
    info = pdfinfo(primary)
    npages = int(info.get('Pages', '0'))
    date = meta.get('edition_date_iso')
    if not date:
        m = re.search(r'(\d{4}-\d{2}-\d{2})', primary)
        date = m.group(1) if m else None
    pages = []
    for i in range(1, npages + 1):
        raw = sh('pdftotext', '-f', str(i), '-l', str(i), primary, '-')
        txt = clean_text(raw)
        base = f'e{eid}-p{i}'
        pj, tj, sj = (os.path.join(PAGES, base + '.jpg'), os.path.join(THUMBS, base + '.jpg'), os.path.join(SNAP, base + '.jpg'))
        if not os.path.exists(pj):
            subprocess.run(['pdftoppm', '-f', str(i), '-l', str(i), '-singlefile', '-scale-to-x', '1300', '-scale-to-y', '-1', '-jpeg', '-jpegopt', 'quality=82', primary, pj[:-4]])
        if not os.path.exists(tj):
            subprocess.run(['pdftoppm', '-f', str(i), '-l', str(i), '-singlefile', '-scale-to-x', '380', '-scale-to-y', '-1', '-jpeg', '-jpegopt', 'quality=72', primary, tj[:-4]])
        if not os.path.exists(sj):
            subprocess.run(['pdftoppm', '-f', str(i), '-l', str(i), '-singlefile', '-scale-to-x', '860', '-scale-to-y', '-1', '-jpeg', '-jpegopt', 'quality=62', primary, sj[:-4]])
        # section label: line after 'A<n>' page marker, else page-1 kicker
        sec = None
        lines = [l.strip() for l in txt.split('\n') if l.strip()]
        for j, l in enumerate(lines[:12]):
            if re.fullmatch(r'A\d', l) and j + 1 < len(lines):
                sec = lines[j + 1]; break
        if i == 1 and not sec:
            k = (c.get('page1') or {}).get('kicker')
            sec = ('Front page · ' + k.title()) if k else 'Front page'
        if not sec:
            sm = meta.get('sheet_map') or {}
            sec = (sm.get(f'A{i}') or f'Page {i}').split('(')[0].strip()
        pages.append({'n': i, 'img': f'img/pages/{base}.jpg', 'thumb': f'img/thumbs/{base}.jpg', 'section': sec.title() if sec.isupper() else sec, 'text': txt})
    fulltext = '\n'.join(p['text'] for p in pages)
    fnorm = norm(fulltext)
    # headlines from content.json, kept only if verified in the printed PDF text
    cand = []
    p1 = c.get('page1') or {}
    if p1.get('headline'): cand.append(('lead', p1.get('kicker') or 'YOUR DAY', p1['headline'], p1.get('deck')))
    rp = c.get('reading_pages') or {}
    for f in rp.get('features') or []:
        if f.get('headline'): cand.append(('feature', f.get('kicker') or '', f['headline'], f.get('deck')))
    for f in rp.get('recommended') or []:
        if f.get('headline'): cand.append(('recommended', 'RECOMMENDED', f['headline'], None))
    for f in rp.get('on_the_town') or []:
        if f.get('headline'): cand.append(('town', 'ON THE TOWN', f['headline'], None))
    sf = c.get('standing_features') or {}
    vf = sf.get('vic_fact') or {}
    if vf.get('headline'): cand.append(('kida', vf.get('kicker') or 'FOR KID A', vf['headline'], None))
    dt = (c.get('puzzles') or {}).get('dear_times') or {}
    if dt.get('headline'): cand.append(('dear', 'DEAR TIMES', dt['headline'], None))
    heads, dropped = [], []
    for kind, kicker, h, deck in cand:
        if verified(h, fnorm):
            heads.append({'kind': kind, 'kicker': kicker, 'headline': h, 'deck': deck if deck and verified(deck[:80], fnorm) else None})
        else:
            dropped.append(h)
    # standing features verified
    standing = {}
    dj = sf.get('dad_joke') or {}
    if dj.get('joke') and verified(dj['joke'][:70], fnorm): standing['dad_joke'] = {'text': dj['joke'], 'attribution': dj.get('attribution')}
    bv = sf.get('bible_verse') or {}
    if bv.get('text') and verified(bv['text'][:70], fnorm): standing['verse'] = {'text': bv['text'], 'citation': bv.get('citation')}
    aq = sf.get('athlete_quote') or {}
    if aq.get('text') and verified(aq['text'][:70], fnorm): standing['quote'] = {'text': aq['text'], 'attribution': aq.get('attribution')}
    w = p1.get('weather') or {}
    weather = None
    if isinstance(w, dict) and w.get('today_high') is not None and f"{w.get('today_high')}" in fulltext:
        weather = {'high': w.get('today_high'), 'low': w.get('today_low')}
    # print status evidence
    evid = []
    for r in log_rows:
        if r.get('date') == date and (r.get('volume') == meta.get('volume') or (r.get('pdf') and r['pdf'].startswith(d))) and r.get('print'):
            evid.append(('log', r['print'], r['_src']))
    draft = open(os.path.join(d, 'DRAFT.md')).read() if os.path.exists(os.path.join(d, 'DRAFT.md')) else ''
    dl = [l.strip('-* ').strip() for l in draft.splitlines() if re.search(r'(silent print|Print:|PDF-only|BlueCubed (offline|online|HP)|job Complete)', l, re.I) and not re.search(r'do not|attempt silent print after|note in meta|Main turn must', l, re.I)]
    for l in dl:
        evid.append(('draft', l, os.path.join(d, 'DRAFT.md')))
    mnote = meta.get('machines_note')
    def classify(text):
        t = text.lower()
        if 'complete 3/3' in t or 'job complete' in t: return 'printed'
        if 'pdf-only' in t or 'offline' in t or 'skipped' in t or 'deferred' in t: return 'pdf-only'
        return None
    status, basis = None, None
    for src, text, path in evid:
        s = classify(text)
        if s:
            status, basis = s, {'source': path, 'text': text}; break
    if not status:
        if meta.get('delivery_mode') == 'pdf_only' or (draft and '(pdf_only)' in draft):
            status, basis = 'pdf-only', {'planned': True, 'source': cpath if meta.get('delivery_mode') == 'pdf_only' else os.path.join(d, 'DRAFT.md'), 'text': 'planned delivery mode pdf_only (no print outcome logged)'}
        else:
            status, basis = 'unknown', {'source': None, 'text': ('No print outcome logged. ' + (f'Machine note at fire: {mnote}' if mnote else (f"Planned mode: {meta.get('delivery_mode')}" if meta.get('delivery_mode') else 'No delivery mode recorded.'))).strip()}
    if status == 'printed' and 'tray not physically confirmed' in (basis['text'] or '').lower():
        basis['caveat'] = 'Queue reported complete; paper tray not physically confirmed.'
    # topic / people counts (text only)
    counts_t = {name: len(re.findall(rx, fulltext, flags=re.I if name in ('Rain & storms', 'Sunshine', 'Space & science', 'Work calendar', 'Puzzles & comics') else 0)) for name, rx in TOPICS}
    counts_p = {name: len(re.findall(rx, fulltext)) for name, rx in FAMILY}
    names = collections.Counter()
    for m in re.finditer(r"\b([A-Z][a-z]+)\s+([A-Z][a-zA-Z'’\-]+)\b", fulltext):
        a, b = m.group(1), re.sub(r"['’]s$", '', m.group(2))
        pre = fulltext[max(0, m.start() - 6):m.start()]
        if pre.rstrip().endswith(('St.', 'Mount', 'Mt.')) or f'{a} {b}' in NOT_PEOPLE:
            continue
        if a in COMMON_FIRST and b not in ('Times', 'Day', 'Family', 'Sports', 'Complex', 'Field', 'School', 'High', 'Prep', 'Park', 'Mass', 'Fair'):
            names[f'{a} {b}'] += 1
    dt_obj = datetime.date.fromisoformat(date)
    editions.append({
        'id': eid, 'num': int(eid), 'date': date, 'weekday': dt_obj.strftime('%A'),
        'date_long': meta.get('edition_date') or dt_obj.strftime('%A, %B %-d, %Y'),
        'paper': meta.get('paper_name') or 'The Family Times', 'volume': meta.get('volume'),
        'as_of': meta.get('as_of'), 'pdf': primary, 'variants': variants, 'pdf_title': info.get('Title'),
        'pages': pages, 'headlines': heads, 'dropped_unverified': dropped, 'standing': standing, 'weather': weather,
        'print': {'status': status, **basis}, 'topics': counts_t, 'people': counts_p, 'names': dict(names),
        'words': len(fulltext.split()),
    })

editions.sort(key=lambda e: (e['date'], e['num']))
# auto names: keep those seen in >=2 editions
agg = collections.Counter(); edcount = collections.Counter()
for e in editions:
    for k, v in e['names'].items():
        agg[k] += v; edcount[k] += 1
auto_people = [{'name': k, 'mentions': agg[k], 'editions': edcount[k]} for k in agg if edcount[k] >= 2]
auto_people.sort(key=lambda x: (-x['mentions'], x['name']))
dates = [e['date'] for e in editions]
d0, d1 = datetime.date.fromisoformat(dates[0]), datetime.date.fromisoformat(dates[-1])
missing = [(d0 + datetime.timedelta(days=i)).isoformat() for i in range((d1 - d0).days + 1) if (d0 + datetime.timedelta(days=i)).isoformat() not in dates]
archive = {
    'built_at': datetime.datetime.now().astimezone().isoformat(timespec='seconds'),
    'editions': editions,
    'topics_def': [{'name': n, 'pattern': rx} for n, rx in TOPICS],
    'people_def': [{'name': n, 'pattern': rx} for n, rx in FAMILY],
    'auto_people': auto_people[:40],
    'range': {'first': dates[0], 'last': dates[-1], 'missing_dates': missing},
    'sources': {
        'edition_dirs': edition_dirs,
        'logs': sorted({r['_src'] for r in log_rows}),
        'extra_pdfs': extras,
        'excluded': ['/workspace/newspaper/17.4/LAYOUT-TEMPLATE-REFERENCE-ONLY.pdf (layout template, not an edition)',
                     '/workspace/newspaper-17.4 (setup instructions only, no editions)'],
    },
}
json.dump(archive, open(os.path.join(ROOT, 'data', 'archive.json'), 'w'), ensure_ascii=False, indent=1)
with open(os.path.join(WEB, 'archive-data.js'), 'w') as f:
    f.write('window.ARCHIVE=' + json.dumps(archive, ensure_ascii=False) + ';\n')
print(f"editions={len(editions)} pages={sum(len(e['pages']) for e in editions)} range={dates[0]}..{dates[-1]} missing={missing}")
print('print status:', collections.Counter(e['print']['status'] for e in editions))
print('extra pdfs:', len(extras), 'non-duplicate:', [x['path'] for x in extras if not x['duplicate_of']])
print('headlines verified:', sum(len(e['headlines']) for e in editions), 'dropped:', sum(len(e['dropped_unverified']) for e in editions))
