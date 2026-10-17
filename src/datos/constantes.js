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

/** CV del portal de postulación: solo documentos (PDF o Word), hasta 5 MB. */
export const ARCHIVOS_CV = {
  extensiones: '.pdf,.doc,.docx',
  descripcion: 'PDF o Word',
  tamanoMaximoMb: 5,
};

export const ESTADOS_SOLICITUD = ['Pendiente', 'En proceso', 'Finalizada'];

export const ESTADOS_EVALUACION = ['Pendiente', 'Realizada'];

export const RESULTADOS_EVALUACION = [
  'Recomendado',
  'Recomendado con observaciones',
  'No recomendado',
];

/**
 * Psicólogas evaluadoras: la profesional responsable de cada solicitud (nombres ficticios).
 * La primera es la usuaria de prueba del perfil evaluador.
 */
export const EVALUADORES = ['Ignacia Valdés Ortiz', 'Tomás Riquelme Soto', 'Paula Henríquez Lagos'];

/** Reclutadores/as que solicitan las evaluaciones (columna "Reclutador/a" de la BD). */
export const RECLUTADORES = [
  'Carolina Muñoz',
  'Daniela Contreras',
  'Fernanda Rojas',
  'Javiera Soto',
  'Macarena Vidal',
];

/**
 * Etapas del Planner de la psicóloga (las mismas 4 columnas del Microsoft Planner
 * "Status Evaluaciones" que usa hoy AquaChile). Cada etapa corresponde a uno de los
 * estados oficiales del MVP, así el Planner detalla el estado sin reemplazarlo.
 */
export const ETAPAS_PLANNER = [
  { id: 'recibida', titulo: 'Evaluación Recibida', estado: 'Pendiente', icono: 'bi-inbox' },
  { id: 'agendada', titulo: 'Entrevista Agendada', estado: 'En proceso', icono: 'bi-calendar-event' },
  { id: 'realizada', titulo: 'Entrevista Realizada', estado: 'En proceso', icono: 'bi-person-check' },
  { id: 'informe', titulo: 'Informe enviado', estado: 'Finalizada', icono: 'bi-send-check' },
];

export const MODALIDADES_ENTREVISTA = ['Teams', 'Presencial', 'Telefónica'];

/** Estados de solicitud que permiten registrar o actualizar una evaluación. */
export const ESTADOS_QUE_PERMITEN_EVALUAR = ['En proceso', 'Finalizada'];
