"""Build the course: join the parts in src/ into one HTML file.

Run:  py src/build.py
Then print EV-Hybrid-Technician-Course.html to PDF (A4) from Edge or Chrome.
"""
import glob
import os
import re

here = os.path.dirname(os.path.abspath(__file__))
parts = sorted(glob.glob(os.path.join(here, 'p0*.html')))
html = ''.join(open(f, encoding='utf-8').read() for f in parts)


def split(m):
    """An SVG marker-end is drawn only on the last sub-path, so give each arrow its own <path>."""
    d, rest = m.group(1), m.group(2)
    subs = [p.strip() for p in re.split(r'(?=M)', d) if p.strip()]
    return ''.join('<path d="%s"%s/>' % (p, rest) for p in subs)


html = re.sub(r'<path d="(M[^"]*M[^"]*)"([^>]*marker-end[^>]*?)/>', split, html)

out = os.path.join(here, '..', 'EV-Hybrid-Technician-Course.html')
open(out, 'w', encoding='utf-8').write(html)
print('built', len(parts), 'parts,', len(html), 'characters')
