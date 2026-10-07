"""Bundle every game page into one self-contained HTML file (no external css/js).
Single files are what HTML5 game portals accept for upload.
Games are auto-discovered: any <dir>/index.html containing a .stage container."""
import os, re, io

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://foxxx009.github.io/mini-arcade/'
DIST = os.path.join(ROOT, 'dist')
os.makedirs(DIST, exist_ok=True)

# discover game pages
PAGES = []
for name in sorted(os.listdir(ROOT)):
    p = os.path.join(ROOT, name, 'index.html')
    if os.path.isfile(p):
        html = io.open(p, encoding='utf-8').read()
        if 'class="stage"' in html:
            PAGES.append((name + '/index.html', name + '.html'))


def inline(html, base):
    def css(m):
        return '<style>\n' + io.open(os.path.join(base, m.group(1)), encoding='utf-8').read() + '\n</style>'
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)"[^>]*>', css, html)

    def js(m):
        return '<script>\n' + io.open(os.path.join(base, m.group(1)), encoding='utf-8').read() + '\n</script>'
    html = re.sub(r'<script src="([^"]+)"></script>', js, html)

    html = re.sub(r'<link rel="manifest" href="[^"]+">',
                  '<link rel="manifest" href="%smanifest.webmanifest">' % SITE, html)
    html = html.replace('href="../"', 'href="%s"' % SITE)
    html = html.replace('href="../about/"', 'href="%sabout/"' % SITE)
    html = html.replace('href="../privacy/"', 'href="%sprivacy/"' % SITE)
    return html


for rel, out in PAGES:
    src = os.path.join(ROOT, rel)
    html = inline(io.open(src, encoding='utf-8').read(), os.path.dirname(src))
    dst = os.path.join(DIST, out)
    io.open(dst, 'w', encoding='utf-8').write(html)
    left = len(re.findall(r'(?:src|href)="\.\.?/', html))
    print('%-20s %6.1f KB   external-refs-left=%d' % (out, os.path.getsize(dst) / 1024, left))

print('--- bundled %d games into %s' % (len(PAGES), DIST))
