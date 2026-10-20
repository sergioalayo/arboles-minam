"""Normalización de documentos Word mediante MS Word (COM).

Algunos insumos anclan cada forma a un párrafo distinto (`relativeFrom="paragraph"`),
por lo que su posición real solo se conoce tras el layout de Word. Otros están en
formato binario `.doc` con formas VML. Este paso:

1. Abre cada .doc/.docx de `raw-docs/` en Word (solo lectura).
2. Convierte el documento al modo de compatibilidad actual (formas DrawingML).
3. Reancla todas las formas de nivel superior a la página (posición absoluta).
4. Guarda una copia `.docx` en `scripts/.work/normalized/` (los insumos no se modifican).

Requiere Windows + MS Word + pywin32.
"""
from __future__ import annotations

import sys
import unicodedata
from pathlib import Path

import win32com.client  # type: ignore

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'raw-docs'
OUT = Path(__file__).resolve().parent / '.work' / 'normalized'

WD_FORMAT_DOCX = 16
WD_RELATIVE_PAGE = 1
SPECIAL = -999000  # Left/Top < SPECIAL son constantes de alineación (wdShapeCenter, etc.)


def anchor_to_page(shape) -> bool:
    """Reancla la forma a la página. Word recalcula Left/Top conservando la posición visual."""
    moved = False
    if shape.Top > SPECIAL and shape.RelativeVerticalPosition != WD_RELATIVE_PAGE:
        shape.RelativeVerticalPosition = WD_RELATIVE_PAGE
        moved = True
    if shape.Left > SPECIAL and shape.RelativeHorizontalPosition != WD_RELATIVE_PAGE:
        shape.RelativeHorizontalPosition = WD_RELATIVE_PAGE
        moved = True
    return moved


def normalize(word, src: Path, dst: Path) -> int:
    doc = word.Documents.Open(str(src), False, True)
    try:
        if doc.CompatibilityMode < 15:
            doc.Convert()
        moved = sum(anchor_to_page(doc.Shapes(i)) for i in range(1, doc.Shapes.Count + 1))
        doc.SaveAs2(str(dst), WD_FORMAT_DOCX)
        return moved
    finally:
        doc.Close(False)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    word = win32com.client.DispatchEx('Word.Application')
    word.Visible = False
    word.DisplayAlerts = 0
    try:
        for src in sorted(RAW.iterdir()):
            if src.suffix.lower() not in ('.doc', '.docx'):
                continue
            name = unicodedata.normalize('NFC', src.stem) + '.docx'
            n = normalize(word, src, OUT / name)
            print(f'{src.name}: {n} formas reancladas a la página', flush=True)
    finally:
        word.Quit()


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
