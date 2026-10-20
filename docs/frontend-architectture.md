# Directrices de Arquitectura Frontend: Árbol Bi-Direccional

## 1. Patrón de Layout Bi-Direccional con ELKjs
El problema central actúa como eje ancla en el origen (`y = 0`). La disposición no puede ser unidireccional simple:
- **Sub-árbol de Efectos:** Se calcula con dirección ascendente (`elk.direction: 'UP'`). Las coordenadas resultantes se ubican en el semiplano superior (`y < 0`).
- **Sub-árbol de Causas:** Se calcula con dirección descendente (`elk.direction: 'DOWN'`). Las coordenadas resultantes se ubican en el semiplano inferior (`y > 0`).
- **Problema Central:** Actúa como nodo raíz compartido o nodo pivote (`fixed: true` en el centro del canvas).
- Los nodos deben disponer de handles duales (`type="target"` arriba y `type="source"` abajo para causas; invertido para efectos) para permitir trazabilidad vertical limpia.

## 2. Tipado Estricto de Datos (`src/types/tree.ts`)
Todo nodo debe adherirse a una interfaz `ProblemNodeData` que contemple:
- `id`: Identificador único semántico.
- `type`: `'efecto_indirecto' | 'efecto_directo' | 'problema_central' | 'causa_directa' | 'causa_indirecta'`.
- `label`: Título sintetizado para la tarjeta (máximo 8 a 10 palabras).
- `description`: Texto íntegro del diagnóstico.
- `organo`: Sigla de la unidad u organismo adscrito (ej. DGRS, DGOTA, OEFA, SERNANP).
- `severidad`: `'critica' | 'moderada' | 'baja'`.
- `evidencia` (opcional): Datos cuantitativos o base normativa citada.
- `fuente`: Diapositiva o documento de origen.
- `isCollapsed`: Booleano para el estado de sus ramas hijas/padres.
- `isDimmed`: Booleano para atenuación de opacidad al aislar rutas críticas.
- `childCount`: Número de ramas dependientes para mostrar en el botón interactivo.

## 3. Especificación del Componente de Nodo (`CustomNode.tsx`)
El nodo personalizado de `@xyflow/react` debe seguir estas reglas de UI:
- **Diseño Card:** Ancho constante (`w-72`), fondo neutro de contraste (`bg-white` o `bg-slate-900`), borde sutil con acento semántico según `type`.
- **Cabecera Semántica:**
  - Badge con sigla de la unidad orgánica (`text-xs font-semibold px-2 py-0.5 rounded-full`).
  - Semáforo o indicador discreto de `severidad`.
- **Cuerpo:** Título (`label`) con tipografía condensada y legible a distancia (`line-clamp-3`).
- **Pie Interactivo:**
  - Botón colapsable con indicador numérico (ej. `[+ 3 causas]` o `[- colapsar]`). Al presionarlo, debe invocar la acción de colapso recursivo sin propagar el clic de selección.
- **Interacción de Selección:**
  - Al hacer clic en la tarjeta, se debe emitir un evento `onNodeSelect` al estado global para desplegar el Drawer lateral con el diagnóstico íntegro (`description`, `evidencia`, `fuente`).
- **Atenuación:**
  - Si `isDimmed === true`, la tarjeta debe transicionar a `opacity-20 pointer-events-none`.

## 4. Lienzo y Controles Ejecutivos (`App.tsx` o `Canvas.tsx`)
- Incluir controles estándar de `@xyflow/react`: `<Controls />`, `<MiniMap />`, `<Background />`.
- Toolbar flotante superior con:
  - Selector de árbol (para cambiar entre distintos problemas analizados).
  - Filtro por unidad orgánica o eje temático.
  - Botón de reajuste de vista (`fitView`) y reset de filtros.
- Drawer lateral deslizante (Sheet) que no ocluya el centro del lienzo.