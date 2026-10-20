"""Reglas de clasificación de nodos (docs/business-rules.md).

- `organo`: sigla oficial del catálogo MINAM según menciones explícitas o temáticas.
- `ejeTematico`: dimensión del factor causal / externalidad del efecto.
- `severidad`: priorización relativa dentro de cada árbol (ver `assign_severity`).
- `label`: título sintetizado (máx. 10 palabras) para la tarjeta.
- `evidencia`: cifras, base normativa, sistemas y notas al pie citadas en el texto.
"""
from __future__ import annotations

import re

TRANSVERSAL = 'Transversal / Sectorial'

# Catálogo oficial (ROF vigente del MINAM): sigla → (nombre completo, dependencia). Fuente única: el extractor lo publica
# en `data/organos.json` para los tooltips del frontend.
ORGANOS: dict[str, tuple[str, str | None]] = {
    'DM': ('Despacho Ministerial', None),
    'SG': ('Secretaría General', 'DM'),
    'VMGA': ('Viceministerio de Gestión Ambiental', 'DM'),
    'VMDERN': ('Viceministerio de Desarrollo Estratégico de los Recursos Naturales', 'DM'),
    'OGPP': ('Oficina General de Planeamiento y Presupuesto', 'SG'),
    'DGRS': ('Dirección General de Gestión de Residuos Sólidos', 'VMGA'),
    'DGCA': ('Dirección General de Calidad Ambiental', 'VMGA'),
    'DGCCA': ('Dirección General de Cambio Climático y Desertificación', 'VMDERN'),
    'DGB': ('Dirección General de Diversidad Biológica', 'VMDERN'),
    'DGOTA': ('Dirección General de Ordenamiento Territorial y Gestión Integrada de los Recursos Naturales', 'VMDERN'),
    'DGCF': ('Dirección General de Economía y Financiamiento Ambiental', 'VMDERN'),
    'OEFA': ('Organismo de Evaluación y Fiscalización Ambiental', 'Organismo público adscrito'),
    'SERNANP': ('Servicio Nacional de Áreas Naturales Protegidas por el Estado', 'Organismo público adscrito'),
    'SENAMHI': ('Servicio Nacional de Meteorología e Hidrología del Perú', 'Organismo público adscrito'),
    'IIAP': ('Instituto de Investigaciones de la Amazonía Peruana', 'Organismo público adscrito'),
    'INAIGEM': ('Instituto Nacional de Investigación en Glaciares y Ecosistemas de Montaña', 'Organismo público adscrito'),
    'SENACE': ('Servicio Nacional de Certificación Ambiental para las Inversiones Sostenibles', 'Organismo público adscrito'),
    TRANSVERSAL: ('Compromete a múltiples entidades o al diseño sectorial general', None),
}
CATALOGO_ORGANOS = set(ORGANOS)

# (patrón, órgano). Un texto que active más de un órgano se clasifica como transversal,
# salvo las precedencias de PRECEDENCIA (un patrón específico absorbe a uno genérico).
ORGANO_PATTERNS: list[tuple[str, str]] = [
    (r'\bOEFA\b|\bSINEFA\b|\bEFAS?\b|fiscaliza', 'OEFA'),
    (r'\bSENACE\b|\bSEIA\b|certificaci[oó]n|estudios ambientales|consultoras|'
     r'evaluaci[oó]n de impacto|opinantes|viabilidad ambiental|instrumentos complementarios', 'SENACE'),
    (r'\bSERNANP\b|\bANP\b|[aá]reas naturales protegidas|guardaparques|\bSINANPE\b|\bSINAMPE\b', 'SERNANP'),
    (r'\bSENAMHI\b|meteorol|hidrol[oó]g|alerta temprana', 'SENAMHI'),
    (r'\bINAIGEM\b|glaciar', 'INAIGEM'),
    (r'\bIIAP\b|amaz[oó]n', 'IIAP'),
    (r'\bOGPP\b|presupuest|\bMEF\b|inversi[oó]n|inversiones|financiamiento|recursos asignados|'
     r'programaci[oó]n|cierre de brechas|indicadores? de brecha|\bPMI\b|cooperaci[oó]n internacional|\bRDR\b', 'OGPP'),
    (r'residuos', 'DGRS'),
    (r'calidad ambiental|contaminaci[oó]n', 'DGCA'),
    (r'cambio clim[aá]tico|desertificaci|degradaci[oó]n de (?:las? )?tierras?|sequ[ií]a|efecto invernadero', 'DGCCA'),
    (r'diversidad biol[oó]gica|biodiversidad|servicios ecosist[eé]micos|infraestructura natural', 'DGB'),
    (r'ordenamiento territorial|instrumentos territoriales|gesti[oó]n territorial', 'DGOTA'),
    # DGCF: economía y financiamiento ambiental.
    (r'econom[ií]a ambiental|financiamiento ambiental|instrumentos econ[oó]micos ambientales|'
     r'retribuci[oó]n por servicios ecosist[eé]micos|negocios verdes|bionegocios', 'DGCF'),
    # Bosques, fauna silvestre y recursos naturales: viceministerio rector (SERFOR, fuera del catálogo
    # MINAM, se consigna en el texto del nodo cuando corresponda).
    (r'forestal|\bbosques?\b|fauna silvestre|recursos naturales', 'VMDERN'),
    (r'recursos humanos|talento humano|\bpersonal\b|\bSST\b|capacitaci[oó]n|legajos|rendimiento|'
     r'integridad|denuncia|conflictos? de intereses|tr[aá]mites|canales de atenci[oó]n|aplicativos|'
     r'infraestructura tecnol[oó]gica|servicios? de informaci[oó]n', 'SG'),
]
# órgano específico → órganos genéricos que absorbe cuando coinciden en el mismo texto
PRECEDENCIA: dict[str, set[str]] = {
    'DGCF': {'OGPP', 'DGB', 'VMDERN'},
    # una dirección general prevalece sobre su viceministerio
    **{dg: {'VMDERN'} for dg in ('DGCCA', 'DGB', 'DGOTA')},
    **{dg: {'VMGA'} for dg in ('DGRS', 'DGCA')},
}
ADSCRITOS = {'OEFA', 'SERNANP', 'SENAMHI', 'IIAP', 'INAIGEM', 'SENACE'}
# Fenómeno multisectorial: transversal salvo que el texto nombre a un único organismo adscrito.
MULTISECTORIAL_PATTERN = r'econom[ií]as (?:il[ií]citas|ilegales)'
TRANSVERSAL_PATTERN = (r'sector ambiental|organismos adscritos|tres niveles de gobierno|entidades del sector|'
                       r'\bIPIs?\b|intersectorial|otros sectores|\bSNGA\b|interinstitucional|multisectorial')

EJES_CAUSA: list[tuple[str, str]] = [
    ('Normativo y competencial', r'normativ|\bnormas?\b|\bley\b|directiva|reglament|competencias|funciones|'
                                 r'vac[ií]os|lineamientos|disposiciones|marco .*institucional'),
    ('Presupuestal y financiero', r'presupuest|financ|recursos econ[oó]micos|costos|inversi'),
    ('Tecnológico y de información', r'informaci[oó]n|sistemas|interoperab|digital|tecnol[oó]g|datos|plataforma|aplicativos'),
    ('Capacidades y talento humano', r'personal|capacidades|capacitaci[oó]n|talento|recursos humanos|rotaci[oó]n|especializad'),
    ('Articulación institucional', r'articulaci[oó]n|coordinaci[oó]n|desarticul|interinstitucional|intersectorial|'
                                   r'gobernanza|fragmentad|dispers|duplic|superposici'),
    ('Procesos y gestión operativa', r'proceso|procedimient|tr[aá]mite|plazos|seguimiento|monitoreo|planificaci|operativ|servicio'),
]
EJES_EFECTO: list[tuple[str, str]] = [
    ('Confianza y legitimidad ciudadana', r'confianza|legitimidad|percepci[oó]n|imagen|abandono|vigilancia ciudadana|denunciar'),
    ('Competitividad e inversión', r'inversi|competitiv|costos|econ[oó]mic|proyectos|financiamiento'),
    ('Calidad ambiental y ecosistemas', r'ambiente|ambiental|ecosistem|contamina|patrimonio natural|da[nñ]os|'
                                        r'brechas|desastre|cambio clim[aá]tico|ilegales|crimen'),
    ('Efectividad de la gestión pública', r'.'),
]
EJE_CAUSA_DEFAULT = 'Procesos y gestión operativa'

CRITICAL_KW = (r'ilegal|il[ií]cit|corrupci|crimen|da[nñ]o|deterior|contamina|p[eé]rdida|conflicto|desastre|'
               r'prescripci|riesgo|incumplimiento|paraliz|irregularidad|ausencia|falta de')
INTENSIFIER_KW = r'insuficient|d[eé]bil|deficien|limitad|escas|\bbaja?\b|desarticul|fragment|inadecuad|desactualiz|inoportun'

SISTEMAS = ['SEIA', 'SINEFA', 'SINIA', 'SINANPE', 'SINAMPE', 'SNGRH', 'SNGA', 'SINAGERD', 'SRGA', 'SLGA', 'PNP', 'FFAA',
            'MEF', 'PMI', 'PDP', 'GDR', 'SST', 'SCI', 'RDR', 'GEF', 'FEMA', 'DICAPI', 'DIRMEAMB', 'TDR', 'PAS',
            'Planefa', 'MINDEF', 'FN', 'MP', 'GOREs', 'GOLOs', 'IPIs', 'IPI', 'UE', 'ET', 'EFA']

# Palabras que no pueden cerrar un título recortado (preposiciones, artículos, conjunciones,
# determinantes y adverbios de enlace).
STOPWORDS_END = {
    'a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante', 'en', 'entre', 'hacia', 'hasta',
    'mediante', 'para', 'por', 'según', 'sin', 'sobre', 'tras',
    'el', 'la', 'lo', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'y', 'e', 'o', 'u', 'ni', 'que', 'y/o', 'como', 'pero', 'sino', 'aunque', 'donde', 'cuando', 'cuyo', 'cuya',
    'su', 'sus', 'se', 'cada', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'otro', 'otra', 'otros', 'otras',
    'mismo', 'misma', 'dicho', 'dicha', 'más', 'menos', 'muy', 'no', 'así', 'tanto', 'todo', 'toda', 'todos', 'todas',
    # adjetivos antepuestos que exigen un sustantivo a continuación
    'mal', 'mala', 'malas', 'buen', 'buena', 'gran', 'alta', 'alto', 'bajo', 'escasa', 'escaso', 'nueva', 'nuevo',
}
ELLIPSIS = '…'
OPENERS = {'(': ')', '«': '»', '“': '”', '"': '"', '[': ']'}


def _find(pattern: str, text: str) -> bool:
    return re.search(pattern, text, re.IGNORECASE) is not None


def classify_organo(text: str, default: str) -> str:
    found = {org for pat, org in ORGANO_PATTERNS if _find(pat, text)}
    for specific, generic in PRECEDENCIA.items():
        if specific in found:
            found -= generic
    if _find(MULTISECTORIAL_PATTERN, text) and not (len(found) == 1 and found <= ADSCRITOS):
        return TRANSVERSAL
    if _find(TRANSVERSAL_PATTERN, text) or len(found) > 1:
        return TRANSVERSAL
    if found:
        return found.pop()
    return default


def classify_eje(text: str, side: str, central_eje: str) -> str:
    if side == 'central':
        return central_eje
    table = EJES_EFECTO if side == 'effect' else EJES_CAUSA
    for eje, pat in table:
        if _find(pat, text):
            return eje
    return EJE_CAUSA_DEFAULT


REDUNDANT = [r'\s*\([^()]*\)', r'\s*\(\*+\)|\*+', r',? (?:de las entidades )?del [Ss]ector [Aa]mbient(?:al|e)\b',
             r' (?:en|de) las entidades del Sector Ambiental', r' a nivel nacional\b']


def _word_core(word: str) -> str:
    return word.lower().strip(',;:.–-—«»“”"()[]')


def _balanced(text: str) -> bool:
    return all(text.count(o) == text.count(c) if o != c else text.count(o) % 2 == 0 for o, c in OPENERS.items())


def _tidy_tail(words: list[str]) -> list[str]:
    """Quita del final palabras de enlace, signos colgantes y aperturas sin cerrar."""
    words = list(words)
    while words:
        last = words[-1]
        if not _word_core(last) or _word_core(last) in STOPWORDS_END:
            words.pop()
            continue
        if not _balanced(' '.join(words)):
            # retrocede hasta antes del signo de apertura sin cierre
            joined = ' '.join(words)
            cut = max(joined.rfind(o) for o in OPENERS)
            words = joined[:cut].split()
            continue
        words[-1] = last.rstrip(',;:–-—')
        break
    return words


def make_label(text: str, max_words: int = 10, min_cut: int = 6) -> str:
    """Título corto e íntegro: quita incisos redundantes; si sigue excediendo `max_words`, corta en
    un separador natural (si conserva ≥ `min_cut` palabras) o en el límite de palabras, nunca a
    mitad de palabra ni tras una preposición/artículo/conjunción, y añade una elipsis limpia."""
    clean = re.sub(r'\s+', ' ', text).strip().rstrip('.')
    for pat in REDUNDANT:
        shorter = re.sub(pat, '', clean).strip()
        if len(shorter.split(' ')) >= 4:
            clean = shorter
    words = clean.split(' ')
    if len(words) <= max_words:
        return clean
    # «X (detalle…)» con X muy breve: el detalle es el contenido, se lee como «X: detalle…».
    m = re.match(r'^(\S+(?: \S+){0,2}) \((.+?)\)?$', clean)
    if m:
        clean = f'{m.group(1)}: {m.group(2).rstrip(")")}'
        words = clean.split(' ')
    best: list[str] | None = None
    for sep in [r',', r';', r':', r' \(', r' – ', r' que ', r' debido ', r' generando ', r' afectando ',
                r' asociad', r' para ', r' con ', r' respecto ', r' frente ', r' en el marco', r' sin ']:
        for m in re.finditer(sep, clean):
            prefix = _tidy_tail(clean[:m.start()].split())
            if min_cut <= len(prefix) <= max_words and (best is None or len(prefix) > len(best)):
                best = prefix
    if best is None:
        best = _tidy_tail(words[:max_words])
    return ' '.join(best) + ELLIPSIS


def label_problems(label: str) -> list[str]:
    """Defectos de un título (usado por el validador)."""
    out = []
    words = label.rstrip(ELLIPSIS).split()
    if len(words) > 10:
        out.append('supera 10 palabras')
    if words and _word_core(words[-1]) in STOPWORDS_END:
        out.append(f'termina en palabra de enlace «{words[-1]}»')
    if label.endswith(ELLIPSIS) and re.search(r'[,;:\s]…$', label):
        out.append('signo o espacio antes de la elipsis')
    if not _balanced(label.rstrip(ELLIPSIS)):
        out.append('paréntesis o comillas sin cerrar')
    return out


def extract_evidencia(text: str, notes: list[str]) -> str | None:
    parts: list[str] = []
    cifras = re.findall(r'\d+(?:[.,]\d+)?\s*%|\b\d{2,}(?:[.,]\d+)?\b', text)
    if cifras:
        parts.append('Cifras: ' + ', '.join(dict.fromkeys(c.strip() for c in cifras)))
    normas = re.findall(r'\b(?:Ley(?: del)? [A-Z][\w-]*|D\.S\.[^,;.)]*|Decreto[^,;.)]*|Directiva [\w/-]+|'
                        r'Instructivo|Resoluci[oó]n[^,;.)]*|art[ií]culo \d+)', text)
    if normas:
        parts.append('Base normativa: ' + ', '.join(dict.fromkeys(n.strip() for n in normas)))
    sist = [s for s in SISTEMAS if re.search(r'(?<![\w])' + re.escape(s) + r'(?![\w])', text)]
    if sist:
        parts.append('Sistemas y actores referidos: ' + ', '.join(sist))
    paren = [p.strip() for p in re.findall(r'\(([^()]{12,})\)', text)]
    if paren:
        parts.append('Detalle: ' + '; '.join(paren))
    parts.extend(notes)
    return ' · '.join(parts) if parts else None


def assign_severity(nodes: list[dict], descendants: dict[str, int]) -> None:
    """Severidad relativa por árbol.

    puntaje = 3·[palabra crítica] + 0.5·[intensificadores] + min(descendencia, 8)/2 + 1.5·[nivel ±1]
    - `critica`: problema central y el 25 % de nodos con mayor puntaje.
    - `baja`: el 30 % de nodos con menor puntaje.
    - `moderada`: resto.
    """
    scores: dict[str, float] = {}
    for n in nodes:
        if n['type'] == 'problema_central':
            continue
        t = n['description']
        s = 3.0 * _find(CRITICAL_KW, t)
        s += 0.5 * len(re.findall(INTENSIFIER_KW, t, re.IGNORECASE))
        s += min(descendants.get(n['id'], 0), 8) / 2
        s += 1.5 * (abs(n['level']) == 1)
        scores[n['id']] = s
    # ranking estable: a igual puntaje, prevalece el nodo más cercano al problema central
    ranked = sorted(scores, key=lambda i: (-scores[i], abs(next(n['level'] for n in nodes if n['id'] == i)), i))
    n_crit = round(len(ranked) * 0.25)
    n_baja = round(len(ranked) * 0.30)
    sev = {i: 'critica' if r < n_crit else ('baja' if r >= len(ranked) - n_baja else 'moderada')
           for r, i in enumerate(ranked)}
    for n in nodes:
        n['severidad'] = 'critica' if n['type'] == 'problema_central' else sev[n['id']]
