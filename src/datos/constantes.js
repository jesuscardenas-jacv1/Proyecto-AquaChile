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

/** Centros de costo ficticios para la lista desplegable de la solicitud. */
export const CECOS = [
  { codigo: 'A170010301', nombre: 'Cultivo Agua Dulce - Pisciculturas' },
  { codigo: 'A170010311', nombre: 'Planta Calbuco - Producción' },
  { codigo: 'A170020706', nombre: 'Cultivo Mar - Centros Chiloé' },
  { codigo: 'A170021102', nombre: 'Cultivo Mar - Centros Aysén' },
  { codigo: 'A170021510', nombre: 'Cultivo Mar - Centros Magallanes' },
  { codigo: 'A170030402', nombre: 'Planta de Alimentos - Pargua' },
  { codigo: 'A170030404', nombre: 'Cadena de Suministro - Bodegas' },
  { codigo: 'A170040205', nombre: 'Mantención Industrial' },
  { codigo: 'A170040209', nombre: 'Calidad y Laboratorio' },
  { codigo: 'A170050104', nombre: 'Administración y Finanzas' },
  { codigo: 'A170050603', nombre: 'Gestión de Personas' },
  { codigo: 'A170050605', nombre: 'Tecnología y Sistemas' },
];

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

/**
 * Modalidades de la entrevista. Con "Google Meet" el backend crea el evento en Google Calendar
 * con su enlace; con "Teams" la psicóloga pega el enlace de la reunión.
 */
export const MODALIDADES_ENTREVISTA = ['Teams', 'Google Meet', 'Presencial', 'Telefónica'];

/**
 * Motivos para cerrar una solicitud sin evaluación (mismo catálogo que el backend).
 * La solicitud queda Finalizada con el motivo; no cuenta como evaluada.
 */
export const MOTIVOS_CIERRE = [
  'No se presentó a la entrevista',
  'Desistió del proceso',
  'No cumple requisitos',
  'Otro',
];

/** Estados de solicitud que permiten registrar o actualizar una evaluación. */

/**
 * Evaluación por competencias del informe psicolaboral (mismo catálogo que
 * backend/src/bd/competencias.js). Por cada competencia evaluada: nivel, fortalezas y
 * oportunidades de desarrollo. Forman parte del informe que ve el analista.
 */
export const COMPETENCIAS = [
  'Trabajo en equipo',
  'Orientación a resultados',
  'Comunicación efectiva',
  'Adaptación al cambio',
  'Compromiso con la seguridad',
  'Liderazgo',
];

export const NIVELES_COMPETENCIA = ['Sobre lo esperado', 'Esperado', 'En desarrollo', 'Bajo lo esperado'];
