"""Correcciones estructurales validadas por el equipo técnico sobre `data/arboles.json`.

La extracción geométrica de los insumos puede interpretar mal la jerarquía de algunas formas
(p. ej. leer como subcausa una causa indirecta dibujada más abajo). Estas correcciones se
declaran aquí, se aplican al final de `extract_trees.py` y pueden re-aplicarse sobre el JSON
vigente con `python scripts/apply_corrections.py`. Son idempotentes.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data' / 'arboles.json'

# Reubica un nodo: nuevo ID, nivel y padres (causas: padre = nodo más cercano al problema).
RELOCATE = [
    {
        'tree': 'm2',
        'node': 'm2-c3-1-1',
        'new_id': 'm2-c3-2',
        'level': 2,
        'parents': ['m2-c3'],
        'reason': 'Mesa 2: «Limitada coordinación y/o articulación entre entidades del Sector Público» es la '
                  'segunda causa indirecta de la causa directa 3, no una subcausa de la primera.',
    },
]


def node_type(level: int) -> str:
    if level == 0:
        return 'problema_central'
    if level > 0:
        return 'causa_directa' if level == 1 else 'causa_indirecta'
    return 'efecto_directo' if level == -1 else 'efecto_indirecto'


def edge(parent: str, child: str, level: int) -> dict:
    # Contrato: causas hijo → padre; efectos padre → hijo.
    source, target = (child, parent) if level > 0 else (parent, child)
    return {'id': f'{source}__{target}', 'source': source, 'target': target}


def apply(trees: list[dict]) -> list[str]:
    applied: list[str] = []
    by_id = {t['id']: t for t in trees}
    for fix in RELOCATE:
        tree = by_id.get(fix['tree'])
        if tree is None:
            continue
        nodes = {n['id']: n for n in tree['nodes']}
        node = nodes.get(fix['node'])
        if node is None:
            continue  # ya aplicada (o el nodo cambió en el insumo)
        new_id, level = fix['new_id'], fix['level']
        node.update(id=new_id, level=level, type=node_type(level))
        # Se descartan los vínculos con sus padres anteriores; los vínculos con sus hijos se renombran.
        kept = []
        for e in tree['edges']:
            child_end = e['source'] if level > 0 else e['target']
            if child_end == fix['node']:
                continue
            for k in ('source', 'target'):
                if e[k] == fix['node']:
                    e[k] = new_id
            e['id'] = f"{e['source']}__{e['target']}"
            kept.append(e)
        kept += [edge(p, new_id, level) for p in fix['parents']]
        tree['edges'] = kept
        applied.append(f"{fix['tree']}: {fix['node']} → {new_id} ({fix['reason']})")
    return applied


def main() -> None:
    data = json.loads(DATA.read_text(encoding='utf-8'))
    applied = apply(data['arboles'])
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print('\n'.join(applied) if applied else 'Sin correcciones pendientes.')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
