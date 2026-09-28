/** Catálogos alineados con la base de datos simulada de AquaChile (bd/*.xlsx). */
export const FAMILIAS_CARGO = [
  'Jefatura',
  'Profesional A',
  'Profesional B C',
  'Supervisor B',
  'Técnico A',
  'Técnico B C',
  'Operario Calificado',
];

export const ESTADOS_SOLICITUD = ['Pendiente', 'En proceso', 'Finalizada'];

export const ESTADOS_EVALUACION = ['Pendiente', 'Realizada'];

export const RESULTADOS_EVALUACION = [
  'Recomendado',
  'Recomendado con observaciones',
  'No recomendado',
];

/** Reclutadoras responsables de las evaluaciones. */
export const PROFESIONALES = [
  'Carolina Muñoz',
  'Daniela Contreras',
  'Fernanda Rojas',
  'Javiera Soto',
  'Macarena Vidal',
];

/** Estados de solicitud que permiten registrar o actualizar una evaluación. */
export const ESTADOS_QUE_PERMITEN_EVALUAR = ['En proceso', 'Finalizada'];
