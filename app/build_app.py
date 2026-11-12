"""Build the installable study app into docs/ (served by GitHub Pages).

Run after src/build.py:   py app/build_app.py
"""
import html as htmlmod
import json
import os
import re
import shutil
import struct
import time
import zlib

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
docs = os.path.join(root, 'docs')
os.makedirs(docs, exist_ok=True)
course = open(os.path.join(root, 'EV-Hybrid-Technician-Course.html'), encoding='utf-8').read()
version = time.strftime('%Y.%m.%d-%H%M')

# ---- pieces of the course
css = re.search(r'<style>(.*?)</style>', course, flags=re.S).group(1)
defs = re.search(r'<svg width="0" height="0".*?</svg>', course, flags=re.S).group(0)
sections = re.findall(r'<section class="mod" data-part="(.*?)" data-title="(.*?)">(.*?)</section>', course, flags=re.S)

def text(s):
    return htmlmod.unescape(re.sub(r'<[^>]+>', '', s)).strip()

bank, templates = [], []
for n, (part, title, body) in enumerate(sections, 1):
    is_last = n == len(sections)
    quiz = re.search(r'<div class="quiz">.*?</ol></div>', body, flags=re.S)
    if quiz and not is_last:
        for q, opts in re.findall(r'<li>((?:(?!<ul>).)*?)<ul>(.*?)</ul></li>', quiz.group(0), flags=re.S):
            items = re.findall(r'<li( data-c)?>(.*?)</li>', opts, flags=re.S)
            right = [text(t) for c, t in items if c]
            wrong = [text(t) for c, t in items if not c]
            assert len(right) == 1 and len(wrong) >= 2, (n, q)
            bank.append({'m': n, 'q': text(q), 'c': right[0], 'w': wrong, 's': 1 if n == 3 else 0})
    if quiz and is_last:
        # the final paper assessment is replaced in the app by the timed exam
        body = body.replace(quiz.group(0), '<aside class="c"><h4>Final exam</h4><p>In this app the final assessment is the timed <b>Exam</b> in the Quiz tab.</p></aside>')
    templates.append('<template data-m="%d" data-part="%s" data-title="%s"><section class="mod">%s</section></template>' % (n, part, title, body))

for row in json.load(open(os.path.join(here, 'extra_questions.json'), encoding='utf-8')):
    m, q, c = row[0], row[1], row[2]
    bank.append({'m': m, 'q': q, 'c': c, 'w': row[3:6], 's': 1 if m == 3 else 0})

apx = []
marks = [m.start() for m in re.finditer(r'<div class="front" id="apx', course)] + [course.index('</main>')]
for a, b in zip(marks, marks[1:]):
    chunk = course[a:b].strip()
    k, title = re.search(r'data-toc="(\w)\|(.*?)"', chunk).groups()
    if k == 'D':
        continue  # the answer key is not shipped in the app
    apx.append('<template data-apx="%s" data-title="%s">%s</template>' % (k, title, chunk))

# ---- shell
shell = open(os.path.join(here, 'shell.html'), encoding='utf-8').read()
cardir = os.path.join(root, 'car')
car_page = open(os.path.join(cardir, 'index.html'), encoding='utf-8').read()
car_view = re.search(r'<!--CAR-->(.*?)<!--/CAR-->', car_page, flags=re.S).group(1)
out = (shell.replace('<!--CAR_VIEW-->', car_view).replace('/*COURSE_CSS*/', css)
            .replace('<!--SVG_DEFS-->', defs)
            .replace('<!--TEMPLATES-->', '\n'.join(templates + apx))
            .replace('__VERSION__', version))
open(os.path.join(docs, 'index.html'), 'w', encoding='utf-8').write(out)
open(os.path.join(docs, 'bank.js'), 'w', encoding='utf-8').write('window.BANK=' + json.dumps(bank, ensure_ascii=False, separators=(',', ':')) + ';')
for f in ('app.js', 'app.css', 'manifest.webmanifest'):
    shutil.copyfile(os.path.join(here, f), os.path.join(docs, f))
for f in ('car.js', 'car.css', 'parts.js', 'faults.js', 'vehicles.js', 'vexplorer.js', 'vexplorer.css'):   # the car explorer (Car tab)
    shutil.copyfile(os.path.join(cardir, f), os.path.join(docs, f))
sw = open(os.path.join(here, 'sw.js'), encoding='utf-8').read().replace('__VERSION__', version)
open(os.path.join(docs, 'sw.js'), 'w', encoding='utf-8').write(sw)
cfg_path = os.path.join(docs, 'config.js')
cfg = open(os.path.join(here, 'config.js'), encoding='utf-8').read().replace('__VERSION__', version)
open(cfg_path, 'w', encoding='utf-8').write(cfg)
pdf = os.path.join(root, 'EV-Hybrid-Technician-Course.pdf')
if os.path.exists(pdf):
    shutil.copyfile(pdf, os.path.join(docs, 'EV-Hybrid-Technician-Course.pdf'))
open(os.path.join(docs, '.nojekyll'), 'w').close()

# ---- icons (plain PNG writer, no extra libraries)
def png(size, path):
    teal, white, orange = (11, 110, 105), (255, 255, 255), (232, 89, 12)
    s = size / 512.0
    bolt = [(290, 120), (190, 290), (250, 290), (220, 400), (330, 220), (268, 220)]
    def inside(px, py):
        hit = False
        for i in range(len(bolt)):
            x1, y1 = bolt[i]; x2, y2 = bolt[(i + 1) % len(bolt)]
            if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1:
                hit = not hit
        return hit
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            u, v = x / s, y / s
            c = teal
            if 110 <= u <= 402 and 96 <= v <= 424:
                c = white
            if 206 <= u <= 306 and 66 <= v <= 96:
                c = white
            if inside(u, v):
                c = orange
            row += bytes(c)
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', raw) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

for size in (192, 512):
    p = os.path.join(docs, 'icon-%d.png' % size)
    if not os.path.exists(p):
        png(size, p)

print('app built: %d modules, %d appendices, %d questions (%d safety), version %s'
      % (len(templates), len(apx), len(bank), sum(q['s'] for q in bank), version))
