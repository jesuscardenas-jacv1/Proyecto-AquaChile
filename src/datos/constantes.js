/** Familias de cargo del formulario de solicitud (Microsoft Forms original + BD simulada). */
export const FAMILIAS_CARGO = [
  'Operario',
  'Operario Calificado',
  'Operario Calificado AM',
  'Administrativo',
  'Técnico B C',
  'Técnico A',
  'Profesional B C',
  'Profesional A',
  'Supervisor B',
  'Supervisor A',
  'Jefatura',
];

export const ORIGENES_CANDIDATO = ['Externo', 'Interno'];

export const OPCIONES_SI_NO = ['Sí', 'No'];

/** Restricciones de los archivos adjuntos (CV y descriptor de cargo), iguales al Forms. */
export const ARCHIVOS_PERMITIDOS = {
  extensiones: '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,image/*,video/*,audio/*',
  descripcion: 'Word, Excel, PPT, PDF, imagen, video o audio',
  tamanoMaximoMb: 10,
};

export const ESTADOS_SOLICITUD = ['Pendiente', 'En proceso', 'Finalizada'];

export const ESTADOS_EVALUACION = ['Pendiente', 'Realizada'];

export const RESULTADOS_EVALUACION = [
  'Recomendado',
  'Recomendado con observaciones',
  'No recomendado',
];

/** Reclutadores/as que solicitan las evaluaciones (columna "Reclutador/a" de la BD). */
export const PROFESIONALES = [
  'Carolina Muñoz',
  'Daniela Contreras',
  'Fernanda Rojas',
  'Javiera Soto',
  'Macarena Vidal',
];

/** Estados de solicitud que permiten registrar o actualizar una evaluación. */
export const ESTADOS_QUE_PERMITEN_EVALUAR = ['En proceso', 'Finalizada'];
