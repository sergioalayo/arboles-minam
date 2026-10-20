# Visualizador Ejecutivo de Árboles de Problemas - Reorganización MINAM

## Propósito
Herramienta web interactiva basada en grafos para Alta Dirección (Secretaría General, Viceministerios, Direcciones Generales), orientada a sustentar técnicamente las decisiones de reorganización del MINAM a partir de la metodología de marco lógico.

## Entorno y Stack Técnico
- **Procesamiento de Insumos:** Python 3.10+ (`python-pptx`, `python-docx`) en `scripts/`.
- **Frontend:** Node.js 20+, Vite, React 18/19, TypeScript, Tailwind CSS.
- **Visualización de Grafos:** `@xyflow/react` (React Flow v12+) con layout de grafos jerárquicos vía `elkjs`.
- **UI Components & Iconos:** `lucide-react`, `clsx`, `tailwind-merge`.
- **Salida de Datos:** Archivo estático `data/arboles.json`.

## Reglas de Ejecución y Flujo
1. **Fase 1 (Datos):** Ejecutar inspección de `./raw_docs/`. Asegurar la extracción recursiva de formas agrupadas (SmartArt/GroupShapes). Generar `data/arboles.json` y validar contra `docs/data-schema.md` antes de escribir código frontend.
2. **Fase 2 (Frontend Scaffolding):** Inicializar `web/` con Vite React-TS. Configurar Tailwind y dependencias.
3. **Fase 3 (Lógica de Grafo):**
   - El layout bi-direccional divide el grafo en dos sub-árboles ELK: uno ascendente (Efectos: `UP`) y uno descendente (Causas: `DOWN`), anclados en el Problema Central (`x=0, y=0`).
   - El estado de colapso/expansión debe operar de manera recursiva sobre la descendencia causal o ascendencia de efectos.
4. **Verificación de Calidad:**
   - Cero errores en `npm run build` y tipado estricto en TypeScript.
   - Rendimiento fluido (60 fps) en zoom y paneo para grafos de más de 80 nodos.