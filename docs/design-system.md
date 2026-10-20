# Sistema de Diseño y Experiencia de Usuario para Alta Dirección

## 1. Principios de Interacción Ejecutiva
- **Cero saturación inicial:** El árbol se carga con las causas indirectas de nivel 2 y efectos indirectos de nivel -2 colapsados. La pantalla muestra inicialmente el problema central con sus causas y efectos directos.
- **Navegación guiada:** Al hacer clic en un nodo, la cámara centra suavemente (`fitView` con padding y transición) la ruta causal seleccionada, mientras los nodos ajenos reducen su opacidad al 15% (`isDimmed: true`).
- **Doble nivel de lectura:**
  - *Nivel 1 (Lienzo):* Visualización macro con badges de entidad, títulos de causas/efectos e indicadores visuales de severidad.
  - *Nivel 2 (Drawer Lateral):* Al seleccionar un nodo, se abre un panel lateral sin tapar el centro del grafo para leer el diagnóstico normativo e indicadores de brecha.

## 2. Especificación de Componentes Clave

### `CustomNode.tsx`
- Contenedor: Tarjeta con ancho fijo (`w-72` o `w-80`), bordes redondeados (`rounded-xl`), sombra suave (`shadow-md`) y borde lateral que indique el tipo de nodo.
- Cabecera:
  - Badge con sigla de la unidad orgánica (`text-xs font-semibold px-2 py-0.5 rounded-full`).
  - Indicador de severidad (semáforo discreto).
- Cuerpo:
  - Título (`font-medium text-sm leading-snug line-clamp-3`).
- Pie de nodo:
  - Botón interactivo de colapso con contador de ramas hijas: `[+ 3 causas]` o `[- colapsar]`.

### Barra Superior (Toolbar)
- Selector de Árbol (Dropdown para alternar entre diferentes diagnósticos temáticos).
- Buscador predictivo por texto o unidad orgánica.
- Filtro rápido por órgano (ej. botón "Solo OEFA", "Solo SERNANP").
- Botones de acción: `Restablecer Vista`, `Expandir Todo`, `Colapsar Todo`.

### Drawer de Detalle (`NodeDrawer.tsx`)
- Encabezado: Título completo, tipo de elemento causal y órgano responsable.
- Sección "Diagnóstico y Sustento": Texto íntegro extraído de los documentos.
- Sección "Evidencia y Brechas": Datos cuantitativos o menciones normativas (si existen).
- Sección "Trazabilidad": Nombre del archivo original y número de diapositiva o página.