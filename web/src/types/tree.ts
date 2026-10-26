import type { Edge, Node } from '@xyflow/react';

/* ------------------------------------------------------------------ *
 * Contrato de datos (docs/data-schema.md) — data/arboles.json
 * ------------------------------------------------------------------ */

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
  label: string; // Título corto (máx. 8-10 palabras) para la card
  description: string; // Sustento diagnóstico completo para el Drawer
  organo: string; // Unidad orgánica (DGRS, DGOTA, OEFA, SERNANP, etc.)
  ejeTematico: string; // Eje ambiental o de modernización
  evidencia?: string; // Cifras, porcentajes, brechas o artículos normativos
  severidad: Severidad;
  severidad_manual: boolean; // true = corregida a mano; la re-extracción no la sobreescribe
  fuente: string; // Archivo de origen y sección/slide
  textoOriginal?: string; // Solo problema_central: texto literal del documento si difiere de la redacción oficial
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
  mesa: string; // Número oficial de mesa temática ("1" … "10", "11.1", "11.2")
  eje: string; // Eje temático oficial de la mesa
  problemaCentral: string; // Redacción oficial del problema central (Vista Panorámica)
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

/** Catálogo `data/organos.json` (generado desde scripts/classify.py). */
export interface OrganoInfo {
  nombre: string;
  dependencia: string | null;
}

export type OrganoCatalog = Record<string, OrganoInfo>;

/* ------------------------------------------------------------------ *
 * Modelo de vista (docs/frontend-architectture.md §2)
 * ------------------------------------------------------------------ */

/** Sentido del nodo respecto del problema central. */
export type Branch = 'efecto' | 'central' | 'causa';

export type ProblemNodeData = {
  id: string;
  type: NodeType;
  level: number;
  label: string;
  description: string;
  organo: string;
  ejeTematico: string;
  severidad: Severidad;
  evidencia?: string;
  fuente: string;
  /** Sus ramas dependientes (causas que lo explican / efectos que genera) están ocultas. */
  isCollapsed: boolean;
  /** Atenuado al aislar una ruta crítica o aplicar filtros. */
  isDimmed: boolean;
  /** Número de ramas dependientes directas. */
  childCount: number;
  /** Total de nodos dependientes (recursivo), para el indicador del botón colapsable. */
  descendantCount: number;
  branch: Branch;
  isSelected: boolean;
  isSearchHit: boolean;
};

export type ProblemFlowNode = Node<ProblemNodeData, 'problem'>;

/** Fondo de la Vista general que agrupa una causa (o efecto) directa con su descendencia. */
export type PanelNodeData = { side: 'causa' | 'efecto'; isDimmed: boolean };
export type PanelFlowNode = Node<PanelNodeData, 'panel'>;
export type FlowNode = ProblemFlowNode | PanelFlowNode;
export type ProblemFlowEdge = Edge;
