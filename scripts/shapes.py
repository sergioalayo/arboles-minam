"""Extracción geométrica recursiva de formas (cuadros de texto, grupos, SmartArt, conectores)
desde .docx (DrawingML wps/wpg) y .pptx (p:sp, p:grpSp, p:cxnSp, gráficos SmartArt).

Cada forma se devuelve en coordenadas absolutas (EMU) aplicando las transformaciones
de grupo (`a:off`, `a:ext`, `a:chOff`, `a:chExt`) de forma recursiva.
Los duplicados VML de `mc:Fallback` se descartan.
"""
from __future__ import annotations

import math
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

from lxml import etree

NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'wps': 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
    'wpg': 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup',
    'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'dgm': 'http://schemas.openxmlformats.org/drawingml/2006/diagram',
    'dsp': 'http://schemas.microsoft.com/office/drawing/2008/diagram',
}


def q(tag: str) -> str:
    pfx, local = tag.split(':')
    return '{%s}%s' % (NS[pfx], local)


@dataclass
class Shape:
    x: float
    y: float
    w: float
    h: float
    text: str = ''
    geom: str = ''
    connector: bool = False
    flip_h: bool = False
    flip_v: bool = False
    head_arrow: bool = False
    tail_arrow: bool = False
    fill: str = ''
    source: str = ''          # página / diapositiva
    bold: bool = False
    font_size: float = 0.0
    rot: float = 0.0          # grados, sentido horario
    footnote_marks: list[str] = field(default_factory=list)
    extra: dict = field(default_factory=dict)

    @property
    def cx(self) -> float:
        return self.x + self.w / 2

    @property
    def cy(self) -> float:
        return self.y + self.h / 2

    @property
    def endpoints(self) -> tuple[tuple[float, float], tuple[float, float]]:
        x1, x2 = (self.x + self.w, self.x) if self.flip_h else (self.x, self.x + self.w)
        y1, y2 = (self.y + self.h, self.y) if self.flip_v else (self.y, self.y + self.h)
        if not self.rot:
            return (x1, y1), (x2, y2)
        return self._rotate(x1, y1), self._rotate(x2, y2)

    def _rotate(self, px: float, py: float) -> tuple[float, float]:
        a = math.radians(self.rot)
        dx, dy = px - self.cx, py - self.cy
        return (self.cx + dx * math.cos(a) - dy * math.sin(a),
                self.cy + dx * math.sin(a) + dy * math.cos(a))

    @property
    def path(self) -> list[tuple[float, float]]:
        """Polilínea aproximada del conector (codo a media distancia para bentConnector)."""
        p1, p2 = self.endpoints
        if 'bentConnector' in self.geom:
            if self.rot % 180 == 0:
                xm = (p1[0] + p2[0]) / 2
                return [p1, (xm, p1[1]), (xm, p2[1]), p2]
            ym = (p1[1] + p2[1]) / 2
            return [p1, (p1[0], ym), (p2[0], ym), p2]
        return [p1, p2]


class Transform:
    """Mapeo afín (solo escala + traslación) de coordenadas hijas a absolutas."""

    def __init__(self, sx=1.0, sy=1.0, tx=0.0, ty=0.0):
        self.sx, self.sy, self.tx, self.ty = sx, sy, tx, ty

    def apply(self, x, y, w, h):
        return self.tx + x * self.sx, self.ty + y * self.sy, w * self.sx, h * self.sy

    def compose_group(self, xfrm) -> 'Transform':
        off, ext = xfrm.find(q('a:off')), xfrm.find(q('a:ext'))
        choff, chext = xfrm.find(q('a:chOff')), xfrm.find(q('a:chExt'))
        if off is None or ext is None:
            return self
        ox, oy = float(off.get('x')), float(off.get('y'))
        ex, ey = float(ext.get('cx')), float(ext.get('cy'))
        cox = float(choff.get('x')) if choff is not None else ox
        coy = float(choff.get('y')) if choff is not None else oy
        cex = float(chext.get('cx')) if chext is not None else ex
        cey = float(chext.get('cy')) if chext is not None else ey
        gsx = ex / cex if cex else 1.0
        gsy = ey / cey if cey else 1.0
        # hijo -> espacio del grupo: X = ox + (x - cox) * gsx ; luego -> absoluto con self
        return Transform(
            self.sx * gsx, self.sy * gsy,
            self.tx + self.sx * (ox - cox * gsx),
            self.ty + self.sy * (oy - coy * gsy),
        )


def _is_superscript(run) -> bool:
    rpr = run.find(q('w:rPr'))
    if rpr is not None:
        va = rpr.find(q('w:vertAlign'))
        return va is not None and va.get(q('w:val')) == 'superscript'
    rpr = run.find(q('a:rPr'))
    return rpr is not None and int(rpr.get('baseline', '0')) > 0


def _paragraph_text(p, marks: list | None = None) -> str:
    out = []
    for run in p.iter(q('w:r'), q('a:r')):
        text = ''.join(t.text or '' for t in run.iter(q('w:t'), q('a:t')))
        if _is_superscript(run):
            if marks is not None and text.strip():
                marks.append(text.strip())
            continue
        out.append(text)
    return ''.join(out)


def _text_of(container, marks: list | None = None) -> str:
    if container is None:
        return ''
    paras = list(container.iter(q('w:p'))) or list(container.iter(q('a:p')))
    parts = [_paragraph_text(p, marks).strip() for p in paras]
    return '\n'.join(p for p in parts if p)


def _run_props(container):
    bold, size = False, 0.0
    if container is None:
        return bold, size
    for rpr in container.iter(q('a:rPr')):
        if rpr.get('b') == '1':
            bold = True
        if rpr.get('sz'):
            size = max(size, int(rpr.get('sz')) / 100)
    for rpr in container.iter(q('w:rPr')):
        if rpr.find(q('w:b')) is not None and rpr.find(q('w:b')).get(q('w:val')) not in ('0', 'false'):
            bold = True
        sz = rpr.find(q('w:sz'))
        if sz is not None:
            size = max(size, int(sz.get(q('w:val'))) / 2)
    return bold, size


def _fill_of(sppr) -> str:
    if sppr is None:
        return ''
    solid = sppr.find(q('a:solidFill'))
    if solid is not None:
        for c in solid:
            return c.get('val', '')
    return ''


def _shape_from(sppr, txt_container, transform: Transform, source: str, is_cxn: bool, base=None) -> Shape | None:
    xfrm = sppr.find(q('a:xfrm')) if sppr is not None else None
    if xfrm is not None and xfrm.find(q('a:off')) is not None:
        off, ext = xfrm.find(q('a:off')), xfrm.find(q('a:ext'))
        x, y = float(off.get('x')), float(off.get('y'))
        w, h = float(ext.get('cx')), float(ext.get('cy'))
        flip_h, flip_v = xfrm.get('flipH') == '1', xfrm.get('flipV') == '1'
        rot = int(xfrm.get('rot', '0')) / 60000
    elif base is not None:
        x, y, w, h = base
        flip_h = flip_v = False
        rot = 0.0
        if xfrm is not None:
            flip_h, flip_v = xfrm.get('flipH') == '1', xfrm.get('flipV') == '1'
            rot = int(xfrm.get('rot', '0')) / 60000
    else:
        return None
    ax, ay, aw, ah = transform.apply(x, y, w, h)
    geom_el = sppr.find(q('a:prstGeom')) if sppr is not None else None
    geom = geom_el.get('prst') if geom_el is not None else ('custom' if sppr is not None and sppr.find(q('a:custGeom')) is not None else '')
    ln = sppr.find(q('a:ln')) if sppr is not None else None
    head = tail = False
    if ln is not None:
        he, te = ln.find(q('a:headEnd')), ln.find(q('a:tailEnd'))
        head = he is not None and he.get('type') not in (None, 'none')
        tail = te is not None and te.get('type') not in (None, 'none')
    connector = is_cxn or geom in ('line', 'straightConnector1') or 'Connector' in geom
    bold, size = _run_props(txt_container)
    marks: list[str] = []
    text = _text_of(txt_container, marks)
    shape = Shape(ax, ay, aw, ah, text, geom, connector, flip_h, flip_v,
                  head, tail, _fill_of(sppr), source, bold, size, rot, marks)
    items = _list_items(txt_container)
    if items:
        shape.extra['items'] = items
    return shape


def _list_items(container) -> list[str] | None:
    """Párrafos de una caja que es íntegramente una lista numerada automática (≥ 2 ítems)."""
    if container is None:
        return None
    paras = [p for p in container.iter(q('w:p')) if _paragraph_text(p).strip()]
    numbered = [p for p in paras if p.find(q('w:pPr')) is not None and p.find(q('w:pPr')).find(q('w:numPr')) is not None]
    if len(numbered) >= 2 and len(numbered) == len(paras):
        return [_paragraph_text(p).strip() for p in numbered]
    return None


# ---------------------------------------------------------------- DOCX

def _walk_wpg(group, transform: Transform, out: list, source: str):
    gsp = group.find(q('wpg:grpSpPr'))
    xfrm = gsp.find(q('a:xfrm')) if gsp is not None else None
    t = transform.compose_group(xfrm) if xfrm is not None else transform
    for child in group:
        if child.tag in (q('wpg:grpSp'), q('wpg:wgp')):
            _walk_wpg(child, t, out, source)
        elif child.tag == q('wps:wsp'):
            sppr = child.find(q('wps:spPr'))
            s = _shape_from(sppr, child.find('.//' + q('w:txbxContent')), t, source,
                            child.find(q('wps:cNvCnPr')) is not None)
            if s:
                out.append(s)


def _emu_pos(anchor, axis: str) -> float:
    pos = anchor.find(q('wp:position' + axis))
    if pos is None:
        return 0.0
    off = pos.find(q('wp:posOffset'))
    return float(off.text) if off is not None else 0.0


def docx_shapes(path: Path) -> list[Shape]:
    z = zipfile.ZipFile(path)
    root = etree.fromstring(z.read('word/document.xml'))
    # descartar Fallback (VML duplicado)
    for fb in root.iter(q('mc:Fallback')):
        fb.clear()
    out: list[Shape] = []
    page = 1
    for el in root.iter():
        if el.tag == q('w:br') and el.get(q('w:type')) == 'page':
            page += 1
            continue
        if el.tag not in (q('wp:anchor'), q('wp:inline')):
            continue
        src = f'pág. {page}'
        bx, by = (_emu_pos(el, 'H'), _emu_pos(el, 'V')) if el.tag == q('wp:anchor') else (0.0, 0.0)
        ext = el.find(q('wp:extent'))
        bw, bh = float(ext.get('cx')), float(ext.get('cy'))
        gd = el.find('.//' + q('a:graphicData'))
        if gd is None:
            continue
        wgp = gd.find(q('wpg:wgp'))
        if wgp is not None:
            gsp = wgp.find(q('wpg:grpSpPr'))
            xfrm = gsp.find(q('a:xfrm'))
            off, gext = xfrm.find(q('a:off')), xfrm.find(q('a:ext'))
            # el grupo top-level se coloca en (bx,by) con tamaño extent
            ox, oy = float(off.get('x')), float(off.get('y'))
            gx, gy = float(gext.get('cx')), float(gext.get('cy'))
            t = Transform(bw / gx if gx else 1, bh / gy if gy else 1, bx - ox, by - oy)
            _walk_wpg(wgp, t, out, src)
            continue
        wsp = gd.find(q('wps:wsp'))
        if wsp is not None:
            sppr = wsp.find(q('wps:spPr'))
            s = _shape_from(sppr, wsp.find('.//' + q('w:txbxContent')), Transform(1, 1, bx, by), src,
                            wsp.find(q('wps:cNvCnPr')) is not None, base=(0, 0, bw, bh))
            if s:
                # top-level: off/ext del spPr suele ser 0 -> usar posición del anchor
                s.x, s.y, s.w, s.h = bx, by, bw, bh
                out.append(s)
            continue
        dm = gd.find(q('dgm:relIds'))
        if dm is not None:
            out.extend(_smartart(z, 'word/_rels/document.xml.rels', 'word/', dm, Transform(1, 1, bx, by), src))
    return out


# ---------------------------------------------------------------- SmartArt

def _rels(z: zipfile.ZipFile, rels_path: str) -> dict[str, str]:
    if rels_path not in z.namelist():
        return {}
    root = etree.fromstring(z.read(rels_path))
    return {r.get('Id'): r.get('Target') for r in root}


def _smartart(z, rels_path, base_dir, relids, transform, source) -> list[Shape]:
    """Usa el drawing pre-renderizado (dsp) del SmartArt si existe; si no, solo textos."""
    rels = _rels(z, rels_path)
    out = []
    data_target = rels.get(relids.get(q('r:dm')))
    if data_target is None:
        return out
    data_path = (base_dir + data_target.replace('../', '')) if not data_target.startswith('/') else data_target[1:]
    data_rels = data_path.rsplit('/', 1)[0] + '/_rels/' + data_path.rsplit('/', 1)[1] + '.rels'
    drawing = None
    for tgt in _rels(z, data_rels).values():
        if 'drawing' in tgt:
            drawing = data_path.rsplit('/', 1)[0] + '/' + tgt.split('/')[-1]
    if drawing and drawing in z.namelist():
        root = etree.fromstring(z.read(drawing))
        for sp in root.iter(q('dsp:sp')):
            s = _shape_from(sp.find(q('dsp:spPr')), sp.find(q('dsp:txBody')), transform, source, False)
            if s:
                out.append(s)
    return out


# ---------------------------------------------------------------- PPTX

def _walk_ppt(tree, transform: Transform, out: list, source: str, z, slide_path: str):
    for child in tree:
        tag = child.tag
        if tag == q('p:grpSp'):
            xfrm = child.find(q('p:grpSpPr')).find(q('a:xfrm'))
            _walk_ppt(child, transform.compose_group(xfrm) if xfrm is not None else transform, out, source, z, slide_path)
        elif tag in (q('p:sp'), q('p:cxnSp')):
            s = _shape_from(child.find(q('p:spPr')), child.find(q('p:txBody')), transform, source, tag == q('p:cxnSp'))
            if s:
                if tag == q('p:cxnSp'):
                    st = child.find('.//' + q('a:stCxn'))
                    en = child.find('.//' + q('a:endCxn'))
                    s.extra = {'st': st.get('id') if st is not None else None,
                               'en': en.get('id') if en is not None else None}
                else:
                    cnv = child.find('.//' + q('p:cNvPr'))
                    s.extra = {'id': cnv.get('id') if cnv is not None else None}
                out.append(s)
        elif tag == q('p:graphicFrame'):
            gd = child.find('.//' + q('a:graphicData'))
            xfrm = child.find(q('p:xfrm'))
            if gd is None or xfrm is None:
                continue
            off = xfrm.find(q('a:off'))
            t = Transform(transform.sx, transform.sy,
                          transform.tx + transform.sx * float(off.get('x')),
                          transform.ty + transform.sy * float(off.get('y')))
            dm = gd.find(q('dgm:relIds'))
            if dm is not None:
                folder, name = slide_path.rsplit('/', 1)
                out.extend(_smartart(z, f'{folder}/_rels/{name}.rels', 'ppt/', dm, t, source))
            tbl = gd.find(q('a:tbl'))
            if tbl is not None:
                ext = xfrm.find(q('a:ext'))
                for r, tr in enumerate(tbl.findall(q('a:tr'))):
                    for c, tc in enumerate(tr.findall(q('a:tc'))):
                        out.append(Shape(t.tx + c, t.ty + r, float(ext.get('cx')), 1, _text_of(tc), 'table',
                                         source=source, extra={'row': r, 'col': c}))


def pptx_slides(path: Path) -> list[tuple[int, list[Shape]]]:
    z = zipfile.ZipFile(path)
    pres = etree.fromstring(z.read('ppt/presentation.xml'))
    rels = _rels(z, 'ppt/_rels/presentation.xml.rels')
    result = []
    for i, sid in enumerate(pres.find(q('p:sldIdLst')), start=1):
        slide_path = 'ppt/' + rels[sid.get(q('r:id'))]
        root = etree.fromstring(z.read(slide_path))
        for fb in root.iter(q('mc:Fallback')):
            fb.clear()
        out: list[Shape] = []
        _walk_ppt(root.find('.//' + q('p:spTree')), Transform(), out, f'diapositiva {i}', z, slide_path)
        result.append((i, out))
    return result
