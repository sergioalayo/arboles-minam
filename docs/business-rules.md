# Reglas Metodológicas de Gestión Pública y Marco MINAM

## 1. Validación de la Cadena Causal
- El **Problema Central** no debe formularse como la ausencia de una solución (evitar: "Falta de presupuesto para fiscalización"), sino como un estado negativo sobre el bien público o la entidad (correcto: "Baja cobertura y oportunidad de la fiscalización ambiental en zonas críticas").
- Las **Causas** representan los factores institucionales, normativos, operacionales o presupuestales que generan el problema central.
- Los **Efectos** representan las externalidades negativas que el problema central genera sobre la calidad ambiental, la salud ciudadana y la competitividad del país.

## 2. Catálogo Oficial de Unidades y Organismos Adscritos
Durante la extracción en Python, clasificar las entidades detectadas bajo estas siglas oficiales:
- **Órganos del MINAM Central:**
  - `DM`: Despacho Ministerial.
  - `SG`: Secretaría General.
  - `VMGA`: Viceministerio de Gestión Ambiental (DGRS, DGCA).
    - `DGRS`: Dirección General de Gestión de Residuos Sólidos.
    - `DGCA`: Dirección General de Calidad Ambiental.
  - `VMDERN`: Viceministerio de Desarrollo Estratégico de los Recursos Naturales (DGB, DGOTA, DGCCA, DGCF).
    - `DGB`: Dirección General de Diversidad Biológica.
    - `DGOTA`: Dirección General de Ordenamiento Territorial y Gestión Integrada de los Recursos Naturales.
    - `DGCCA`: Dirección General de Cambio Climático y Desertificación.
    - `DGCF`: Dirección General de Economía y Financiamiento Ambiental.
    - Los temas generales de bosques y fauna silvestre se asignan a `VMDERN` (o a SERFOR según corresponda; SERFOR no forma parte del catálogo del MINAM).
  - `OGPP`: Oficina General de Planeamiento y Presupuesto.
- **Organismos Públicos Adscritos:**
  - `OEFA`: Organismo de Evaluación y Fiscalización Ambiental.
  - `SERNANP`: Servicio Nacional de Áreas Naturales Protegidas por el Estado.
  - `SENAMHI`: Servicio Nacional de Meteorología e Hidrología del Perú.
  - `IIAP`: Instituto de Investigaciones de la Amazonía Peruana.
  - `INAIGEM`: Instituto Nacional de Investigación en Glaciares y Ecosistemas de Montaña.
  - `SENACE`: Servicio Nacional de Certificación Ambiental para las Inversiones Sostenibles.
- **Clasificación por Defecto:** Si una causa compromete a múltiples entidades o al diseño sectorial general, asignar: `Transversal / Sectorial`.

## 3. Mesas Temáticas Oficiales
Metadata de la Vista Panorámica Ejecutiva. Fuente única: `MESAS` en `scripts/extract_trees.py`, que la
emite en `data/arboles.json` como `mesa`, `eje` y `problemaCentral` de cada árbol. La redacción oficial del
problema central se usa en la Vista Panorámica y en el nodo `problema_central` (`label` y `description`);
si el documento de origen difiere, su texto literal se conserva en `textoOriginal` y se muestra en la
sección de Trazabilidad del Drawer.

| Mesa | Eje temático |
| :--- | :--- |
| 1 | Gobernanza ambiental, marcos normativos y descentralización |
| 2 | Servicios al ciudadano y simplificación administrativa |
| 3 | Ciencia, información ambiental y gestión del riesgo |
| 4 | Cierre de brechas sectoriales |
| 5 | Gestión integrada de programas, proyectos e intervenciones |
| 6 | Modernización de tecnologías de información |
| 7 | Optimización del proceso de certificación ambiental |
| 8 | Optimización presupuestal y financiera |
| 9 | Trabajo articulado contra economías ilegales |
| 10 | Optimización de la fiscalización ambiental |
| 11.1 | Recursos humanos e integridad (Integridad) |
| 11.2 | Recursos humanos e integridad (Talento Humano) |
