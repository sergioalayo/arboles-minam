"""Vuelca las formas detectadas (cm) por archivo para inspección manual."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from shapes import docx_shapes, pptx_slides

CM = 360000

def show(shapes):
    for s in sorted(shapes, key=lambda s: (round(s.y / CM), s.x)):
        kind = 'CXN' if s.connector else (s.geom or '-')
        t = s.text.replace('\n', ' | ')[:110]
        if not t and not s.connector:
            continue
        arrows = ('H' if s.head_arrow else '') + ('T' if s.tail_arrow else '')
        print(f'  {s.source:>8} y={s.y/CM:6.2f} x={s.x/CM:6.2f} w={s.w/CM:5.2f} h={s.h/CM:5.2f} {kind:18} {s.fill:8} {"B" if s.bold else " "}{arrows:2} {t}')

for f in sys.argv[1:]:
    p = Path(f)
    print('=' * 10, p.name)
    if p.suffix == '.docx':
        show(docx_shapes(p))
    elif p.suffix == '.pptx':
        for i, sh in pptx_slides(p):
            print(' -- slide', i, len(sh))
            show(sh)
