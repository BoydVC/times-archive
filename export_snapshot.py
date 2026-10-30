#!/usr/bin/env python3
"""Build dist/times-archive-snapshot.html: one offline file with data, fonts and page images embedded."""
import base64, json, os, re, glob
ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, 'web')
OUT = os.path.join(ROOT, 'dist', 'times-archive-snapshot.html')
LIMIT = 40 * 1024 * 1024
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()

css = open(os.path.join(WEB, 'style.css')).read()
def font(m):
    p = os.path.join(WEB, m.group(1))
    mime = 'font/otf' if p.endswith('.otf') else 'font/ttf'
    return f'url(data:{mime};base64,{b64(p)})'
css = re.sub(r'url\((fonts/[^)]+)\)', font, css)

imgs = {}
for p in sorted(glob.glob(os.path.join(WEB, 'img', 'thumbs', '*.jpg'))):
    imgs['img/thumbs/' + os.path.basename(p)] = 'data:image/jpeg;base64,' + b64(p)
for p in sorted(glob.glob(os.path.join(ROOT, 'data', 'snap-pages', '*.jpg'))):  # lighter page renders for the reader
    imgs['img/pages/' + os.path.basename(p)] = 'data:image/jpeg;base64,' + b64(p)

html = open(os.path.join(WEB, 'index.html')).read()
data_js = open(os.path.join(WEB, 'archive-data.js')).read()
app_js = open(os.path.join(WEB, 'app.js')).read()
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + css + '</style>')
html = html.replace('<script src="archive-data.js"></script>', '<script>window.SNAPSHOT=true;window.IMGS=' + json.dumps(imgs) + ';</script>\n<script>' + data_js.replace('</script', '<\\/script') + '</script>')
html = html.replace('<script src="app.js"></script>', '<script>' + app_js.replace('</script', '<\\/script') + '</script>')
html = html.replace('<div class="box" id="earL">Private family archive · Local only</div>', '<div class="box" id="earL">Private family archive · Offline snapshot</div>')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w').write(html)
size = os.path.getsize(OUT)
print(f'{OUT} {size/1048576:.1f} MB, {len(imgs)} images embedded')
assert size < LIMIT, 'snapshot exceeds 40 MB'
