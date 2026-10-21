/** Hitos oficiales del proceso de modernización y reorganización del MINAM (Hoja de Ruta). */

export type HitoEstado = 'completado' | 'hito_actual';

export interface Hito {
  numero: number;
  /** Fecha narrativa, tal como se comunica a la Alta Dirección. */
  fecha: string;
  /** Fecha corta para la pastilla del eje temporal (dd/mm). */
  fechaCorta: string;
  titulo: string;
  resumen: string;
  metrica?: string;
  estado: HitoEstado;
}

export interface Fase {
  numero: string;
  titulo: string;
  hitos: readonly Hito[];
}

export const FASES: readonly Fase[] = [
  {
    numero: 'I',
    titulo: 'Transferencia y Diagnóstico Inicial',
    hitos: [
      {
        numero: 1,
        fecha: '28 de Julio',
        fechaCorta: '28/07',
        titulo: 'Inicio de la Nueva Gestión Ministerial',
        resumen:
          'Asunción de funciones y establecimiento del mandato de modernización institucional del Sector Ambiental.',
        estado: 'completado',
      },
      {
        numero: 2,
        fecha: '31 de Julio',
        fechaCorta: '31/07',
        titulo: 'Reporte de Transferencia: 112 Hallazgos',
        resumen:
          'El equipo de transferencia consolida y reporta 112 hallazgos críticos de gestión, alertando nudos operativos y normativos en el MINAM y sus organismos adscritos.',
        metrica: '112 Hallazgos Críticos',
        estado: 'completado',
      },
      {
        numero: 3,
        fecha: '05 de Agosto',
        fechaCorta: '05/08',
        titulo: 'Creación de la Comisión de Seguimiento',
        resumen:
          'Conformación del equipo técnico de alto nivel encargado de monitorear y viabilizar las acciones correctivas y de reforma del sector.',
        estado: 'completado',
      },
    ],
  },
  {
    numero: 'II',
    titulo: 'Declaratoria y Articulación Estratégica',
    hitos: [
      {
        numero: 4,
        fecha: '17 de Setiembre',
        fechaCorta: '17/09',
        titulo: 'Declaratoria de Modernización del Sector Ambiente',
        resumen:
          'Se declara formalmente en proceso de modernización y reorganización el Sector Ambiental para adecuar su estructura a los desafíos actuales.',
        estado: 'completado',
      },
      {
        numero: 5,
        fecha: '28 de Setiembre',
        fechaCorta: '28/09',
        titulo: 'Incorporación de Socios Cooperantes',
        resumen:
          'Alianza y articulación con organismos de cooperación internacional para brindar soporte técnico y metodológico a la modernización sectorial.',
        estado: 'completado',
      },
      {
        numero: 6,
        fecha: '05 de Octubre',
        fechaCorta: '05/10',
        titulo: 'Lineamientos y Plan de Trabajo General',
        resumen:
          'Aprobación de la directriz metodológica, alcance técnico, roles y cronograma de despliegue de las mesas técnicas.',
        estado: 'completado',
      },
    ],
  },
  {
    numero: 'III',
    titulo: 'Despliegue Operativo y Construcción de Árboles',
    hitos: [
      {
        numero: 7,
        fecha: '07 de Octubre',
        fechaCorta: '07/10',
        titulo: 'Instalación de las 11 Mesas de Trabajo',
        resumen:
          'Despliegue de los equipos técnicos del MINAM central y organismos adscritos estructurados en las 11 mesas temáticas prioritarias.',
        metrica: '11 Mesas Temáticas',
        estado: 'completado',
      },
      {
        numero: 8,
        fecha: '09 al 15 de Octubre',
        fechaCorta: '09/10 – 15/10',
        titulo: 'Jornada Intensiva: 35 Sesiones Técnicas',
        resumen:
          'Desarrollo de 35 sesiones participativas de trabajo técnico para el levantamiento de causas, efectos, evidencias normativas y brechas operativas.',
        metrica: '35 Sesiones Realizadas',
        estado: 'completado',
      },
      {
        numero: 9,
        fecha: '19 de Octubre',
        fechaCorta: '19/10',
        titulo: 'Consolidación y Culminación de Árboles de Problemas',
        resumen:
          'Cierre metodológico y aprobación técnica de los árboles de problemas, causas y efectos validados con la alta dirección y los equipos sectoriales.',
        metrica: '12 Árboles Causalmente Validados',
        estado: 'hito_actual',
      },
    ],
  },
];

/** Resumen métrico de la barra de estado global. */
export const ROADMAP_METRICAS: readonly { valor: number; etiqueta: string }[] = [
  { valor: FASES.reduce((a, f) => a + f.hitos.length, 0), etiqueta: 'Hitos Cumplidos' },
  { valor: 112, etiqueta: 'Hallazgos' },
  { valor: 35, etiqueta: 'Sesiones de Trabajo' },
  { valor: 11, etiqueta: 'Mesas Activas' },
];
