"""Valida `data/arboles.json` contra el contrato de `docs/data-schema.md`.

Comprueba: estructura y tipos de `RootData/ProblemTree/NodeMetadata/EdgeMetadata`, coherencia
`type`↔`level`, catálogo de órganos, contrato de dirección de aristas (causas: hijo→padre;
efectos: padre→hijo), integridad referencial, unicidad de IDs y alcanzabilidad desde el
problema central. Termina con código 1 si hay errores.
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from classify import CATALOGO_ORGANOS, label_problems  # noqa: E402

DATA = Path(__file__).resolve().parent.parent / 'data' / 'arboles.json'
ORGANOS = DATA.with_name('organos.json')

NODE_TYPES = {'efecto_indirecto', 'efecto_directo', 'problema_central', 'causa_directa', 'causa_indirecta'}
SEVERIDADES = {'critica', 'moderada', 'baja'}
TREE_KEYS = {'id': str, 'mesa': str, 'eje': str, 'problemaCentral': str, 'titulo': str, 'descripcionGeneral': str, 'archivoOrigen': str,
             'problemaCentralId': str, 'nodes': list, 'edges': list}
NODE_REQ = {'id': str, 'type': str, 'level': int, 'label': str, 'description': str, 'organo': str,
            'ejeTematico': str, 'severidad': str, 'severidad_manual': bool, 'fuente': str}
NODE_OPT = {'evidencia': str, 'textoOriginal': str, 'isCollapsed': bool}
EDGE_REQ = {'id': str, 'source': str, 'target': str}
EDGE_OPT = {'label': str}


def level_ok(t: str, lv: int) -> bool:
    return {'efecto_indirecto': lv <= -2, 'efecto_directo': lv == -1, 'problema_central': lv == 0,
            'causa_directa': lv == 1, 'causa_indirecta': lv >= 2}[t]


def check_fields(obj: dict, req: dict, opt: dict, where: str, errors: list[str]) -> None:
    for k, typ in req.items():
        if k not in obj:
            errors.append(f'{where}: falta «{k}»')
        elif not isinstance(obj[k], typ) or (typ is int and isinstance(obj[k], bool)):
            errors.append(f'{where}: «{k}» debe ser {typ.__name__}')
        elif typ is str and not obj[k].strip():
            errors.append(f'{where}: «{k}» vacío')
    for k, typ in opt.items():
        if k in obj and not isinstance(obj[k], typ):
            errors.append(f'{where}: «{k}» debe ser {typ.__name__}')
    extra = set(obj) - set(req) - set(opt)
    if extra:
        errors.append(f'{where}: campos no definidos en el esquema {sorted(extra)}')


def validate(root: dict) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if set(root) != {'arboles'} or not isinstance(root['arboles'], list) or not root['arboles']:
        return ['raíz: se espera {"arboles": [ProblemTree, ...]} no vacío'], warnings
    all_ids: Counter = Counter()
    tree_ids: Counter = Counter()
    for t_i, tree in enumerate(root['arboles']):
        tw = f'arboles[{t_i}]'
        check_fields(tree, TREE_KEYS, {}, tw, errors)
        if errors:
            continue
        tw = f'árbol {tree["id"]}'
        tree_ids[tree['id']] += 1
        nodes = {}
        for n in tree['nodes']:
            nw = f'{tw} / nodo {n.get("id", "?")}'
            check_fields(n, NODE_REQ, NODE_OPT, nw, errors)
            if any(k not in n for k in NODE_REQ):
                continue
            all_ids[n['id']] += 1
            nodes[n['id']] = n
            if n['type'] not in NODE_TYPES:
                errors.append(f'{nw}: type inválido «{n["type"]}»')
            elif not level_ok(n['type'], n['level']):
                errors.append(f'{nw}: level {n["level"]} incoherente con type {n["type"]}')
            if n['severidad'] not in SEVERIDADES:
                errors.append(f'{nw}: severidad inválida «{n["severidad"]}»')
            if n['organo'] not in CATALOGO_ORGANOS:
                errors.append(f'{nw}: órgano fuera del catálogo «{n["organo"]}»')
            for problem in label_problems(n['label']):
                errors.append(f'{nw}: label {problem} («{n["label"]}»)')
        centrals = [n for n in nodes.values() if n['type'] == 'problema_central']
        if len(centrals) != 1:
            errors.append(f'{tw}: debe haber exactamente un problema_central (hay {len(centrals)})')
        if tree['problemaCentralId'] not in nodes or nodes[tree['problemaCentralId']]['type'] != 'problema_central':
            errors.append(f'{tw}: problemaCentralId no apunta al problema central')
        edge_ids: Counter = Counter()
        parents: dict[str, set[str]] = {k: set() for k in nodes}
        for e in tree['edges']:
            ew = f'{tw} / arista {e.get("id", "?")}'
            check_fields(e, EDGE_REQ, EDGE_OPT, ew, errors)
            if any(k not in e for k in EDGE_REQ):
                continue
            edge_ids[e['id']] += 1
            s, t = nodes.get(e['source']), nodes.get(e['target'])
            if s is None or t is None:
                errors.append(f'{ew}: referencia a nodo inexistente')
                continue
            if s['level'] > 0 and t['level'] >= 0:      # sub-grafo de causas: hijo → padre
                if s['level'] != t['level'] + 1:
                    errors.append(f'{ew}: causa debe apuntar a su padre inmediato (niveles {s["level"]}→{t["level"]})')
                parents[s['id']].add(t['id'])
            elif s['level'] <= 0 and t['level'] < 0:    # sub-grafo de efectos: padre → hijo
                if t['level'] != s['level'] - 1:
                    errors.append(f'{ew}: efecto debe partir de su padre inmediato (niveles {s["level"]}→{t["level"]})')
                parents[t['id']].add(s['id'])
            else:
                errors.append(f'{ew}: dirección inválida según el contrato de aristas')
        errors += [f'{tw}: arista duplicada {k}' for k, c in edge_ids.items() if c > 1]
        if centrals:
            pc = centrals[0]['id']
            reach: dict[str, bool] = {pc: True}

            def reachable(k: str, seen: frozenset = frozenset()) -> bool:
                if k in reach:
                    return reach[k]
                reach[k] = any(reachable(p, seen | {k}) for p in parents[k] if p not in seen)
                return reach[k]
            for k in nodes:
                if not reachable(k):
                    errors.append(f'{tw}: nodo {k} no conectado con el problema central')
        multi = sum(1 for k, ps in parents.items() if len(ps) > 1)
        if multi:
            warnings.append(f'{tw}: {multi} nodo(s) con más de un padre (grafo dirigido acíclico)')
    errors += [f'ID de nodo duplicado: {k}' for k, c in all_ids.items() if c > 1]
    errors += [f'ID de árbol duplicado: {k}' for k, c in tree_ids.items() if c > 1]
    return errors, warnings


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA
    root = json.loads(path.read_text(encoding='utf-8'))
    errors, warnings = validate(root)
    if not ORGANOS.exists():
        errors.append(f'falta {ORGANOS.name} (catálogo de órganos para el frontend)')
    else:
        catalogo = json.loads(ORGANOS.read_text(encoding='utf-8'))
        faltan = CATALOGO_ORGANOS - set(catalogo)
        if faltan:
            errors.append(f'{ORGANOS.name}: faltan siglas {sorted(faltan)}')
        errors += [f'{ORGANOS.name}: {k} sin nombre completo' for k, v in catalogo.items() if not v.get('nombre')]
    for w in warnings:
        print('AVISO:', w)
    for e in errors:
        print('ERROR:', e)
    trees = root.get('arboles', [])
    n_nodes = sum(len(t.get('nodes', [])) for t in trees)
    n_edges = sum(len(t.get('edges', [])) for t in trees)
    print(f'{"OK" if not errors else "FALLÓ"}: {len(trees)} árboles, {n_nodes} nodos, {n_edges} aristas, '
          f'{len(errors)} errores')
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
