# Especificación Formal de Datos (`data/arboles.json`)

## Taxonomía de Nodos y Niveles
| Tipo (`type`) | Nivel Jerárquico (`level`) | Dirección Visual | Color de Identidad Sugerido |
| :--- | :--- | :--- | :--- |
| `efecto_indirecto` | `-2` (o menor) | Superior (Cielo/Norte) | Púrpura / Índigo oscuro (`#4338ca`) |
| `efecto_directo` | `-1` | Superior (Cielo/Norte) | Azul pizarra (`#0369a1`) |
| `problema_central` | `0` | Centro Ancla | Grafito / MINAM corporativo (`#0f172a`) |
| `causa_directa` | `1` | Inferior (Tierra/Sur) | Ámbar / Naranja (`#c2410c`) |
| `causa_indirecta` | `2` (o mayor) | Inferior (Tierra/Sur) | Rojo institucional (`#b91c1c`) |

## Contrato de Aristas (`edges`)
Para evitar inconsistencias en el auto-layout con `elkjs`:
- **Sub-grafo de Causas:** Las aristas fluyen de causas indirectas hacia causas directas, y de causas directas hacia el problema central (`source: causa_hijo`, `target: causa_padre`).
- **Sub-grafo de Efectos:** Las aristas fluyen del problema central hacia efectos directos, y de estos hacia efectos indirectos (`source: efecto_padre`, `target: efecto_hijo`).

## Interfaces TypeScript (`web/src/types/tree.ts`)

```typescript
export type NodeType = 
  | 'efecto_indirecto' 
  | 'efecto_directo' 
  | 'problema_central' 
  | 'causa_directa' 
  | 'causa_indirecta';

export type Severidad = 'critica' | 'moderada' | 'baja';

export interface NodeMetadata {
  id: string;
  type: NodeType;
  level: number;
  label: string;              // Título corto (máx. 8-10 palabras) para la card
  description: string;        // Sustento diagnóstico completo para el Drawer
  organo: string;             // Unidad orgánica (DGRS, DGOTA, OEFA, SERNANP, etc.)
  ejeTematico: string;        // Eje ambiental o de modernización
  evidencia?: string;         // Cifras, porcentajes, brechas o artículos normativos
  severidad: Severidad;
  severidad_manual: boolean;  // true = severidad corregida a mano; la re-extracción no la sobreescribe
  fuente: string;             // Archivo de origen y sección/slide
  textoOriginal?: string;     // Solo problema_central: texto literal del documento si difiere de la redacción oficial
  isCollapsed?: boolean;
}

export interface EdgeMetadata {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ProblemTree {
  id: string;
  mesa: string;               // Número oficial de mesa temática ("1" … "10", "11.1", "11.2")
  eje: string;                // Eje temático oficial de la mesa (docs/business-rules.md §3)
  problemaCentral: string;    // Redacción oficial del problema central (Vista Panorámica)
  titulo: string;
  descripcionGeneral: string;
  archivoOrigen: string;
  problemaCentralId: string;
  nodes: NodeMetadata[];
  edges: EdgeMetadata[];
}

export interface RootData {
  arboles: ProblemTree[];
}