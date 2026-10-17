/**
 * Ofertas laborales y postulaciones ficticias para el portal "Trabaja con nosotros".
 * Replica la estructura del portal real de AquaChile (ofertas por área, con ubicación,
 * región y fecha), con datos inventados. Los candidatos parten en el id 201 para no
 * chocar con la BD simulada (1-100) ni con la demo del Planner (101-108).
 */

/** Áreas del portal real de AquaChile. */
export const AREAS_OFERTA = [
  'Producción',
  'Planta de Alimentos',
  'Industrial',
  'Comercial',
  'Cadena de Suministro',
  'Personas',
  'Administración y Finanzas',
  'Asuntos Corporativos y Sustentabilidad',
  'Prácticas y Memorias',
];

export const ESTADOS_POSTULACION = ['Recibida', 'En evaluación', 'Descartada'];

const oferta = (id, datos) => ({ id, estado: 'Abierta', jornada: 'Jornada completa', ...datos });

export const ofertasDemo = [
  oferta(1, {
    titulo: 'Monitor Producción - Planta Calbuco',
    area: 'Industrial',
    cargo: 'Monitor Producción',
    familiaCargo: 'Técnico B C',
    ubicacion: 'Planta Calbuco',
    region: 'Los Lagos',
    fechaPublicacion: '2026-10-01',
    descripcion:
      'Buscamos un Monitor de Producción para coordinar a los equipos de línea y asegurar el cumplimiento de los estándares de calidad y seguridad.',
    requisitos: ['Técnico de nivel medio o superior', '2 años de experiencia en plantas de proceso', 'Disponibilidad para turnos rotativos'],
  }),
  oferta(2, {
    titulo: 'Técnico Eléctrico - Puerto Natales, XII Región',
    area: 'Industrial',
    cargo: 'Técnico Eléctrico',
    familiaCargo: 'Técnico A',
    ubicacion: 'Planta Magallanes',
    region: 'Magallanes',
    fechaPublicacion: '2026-10-03',
    descripcion:
      'Responsable de la mantención eléctrica preventiva y correctiva de los equipos de la planta.',
    requisitos: ['Título de Técnico Eléctrico', 'Licencia SEC clase D deseable', 'Experiencia en mantención industrial'],
  }),
  oferta(3, {
    titulo: 'Supervisor Centro de Cultivo - Chonchi',
    area: 'Producción',
    cargo: 'Supervisor Centro de Cultivo',
    familiaCargo: 'Supervisor B',
    ubicacion: 'AM Chonchi',
    region: 'Los Lagos',
    fechaPublicacion: '2026-10-06',
    descripcion:
      'Liderar la operación diaria del centro de cultivo, velando por el bienestar animal y la seguridad del equipo.',
    requisitos: ['Técnico o profesional en acuicultura', '3 años de experiencia en centros de mar', 'Licencia de conducir clase B'],
  }),
  oferta(4, {
    titulo: 'Técnico Laboratorio - Piscicultura Codihue',
    area: 'Producción',
    cargo: 'Técnico Laboratorio',
    familiaCargo: 'Técnico B C',
    ubicacion: 'Codihue',
    region: 'La Araucanía',
    fechaPublicacion: '2026-10-08',
    descripcion: 'Realizar análisis de calidad de agua y muestreos sanitarios en la piscicultura.',
    requisitos: ['Técnico en laboratorio o química', 'Manejo de equipos de medición'],
  }),
  oferta(5, {
    titulo: 'Analista de Control de Gestión',
    area: 'Administración y Finanzas',
    cargo: 'Analista de Control de Gestión',
    familiaCargo: 'Profesional B C',
    ubicacion: 'Oficina Central',
    region: 'Los Lagos',
    fechaPublicacion: '2026-10-09',
    descripcion: 'Elaborar reportes de gestión, presupuestos y seguimiento de indicadores operacionales.',
    requisitos: ['Ingeniero Comercial o Civil Industrial', 'Excel avanzado y Power BI'],
  }),
  oferta(6, {
    titulo: 'Prevencionista de Riesgos - Pargua',
    area: 'Planta de Alimentos',
    cargo: 'Prevencionista de Riesgos',
    familiaCargo: 'Profesional B C',
    ubicacion: 'Pargua PA',
    region: 'Los Lagos',
    fechaPublicacion: '2026-10-10',
    descripcion: 'Implementar y controlar el programa de prevención de riesgos de la planta de alimentos.',
    requisitos: ['Ingeniero en Prevención de Riesgos', 'Registro SEREMI vigente'],
  }),
  oferta(7, {
    titulo: 'Operador Grúa Horquilla - Planta Cailin',
    area: 'Cadena de Suministro',
    cargo: 'Operador Grúa Horquilla',
    familiaCargo: 'Operario Calificado',
    ubicacion: 'Planta Cailin',
    region: 'Los Lagos',
    fechaPublicacion: '2026-10-12',
    descripcion: 'Operar grúa horquilla para el movimiento de materias primas y producto terminado.',
    requisitos: ['Licencia clase D', 'Experiencia en bodega'],
  }),
  oferta(8, {
    titulo: 'Analista de Sistemas',
    area: 'Administración y Finanzas',
    cargo: 'Analista de Sistemas',
    familiaCargo: 'Profesional B C',
    ubicacion: 'Oficina Central',
    region: 'Los Lagos',
    fechaPublicacion: '2026-10-14',
    descripcion: 'Dar soporte y desarrollar mejoras a los sistemas internos de la compañía.',
    requisitos: ['Ingeniero en Informática o similar', 'Conocimientos de SQL y desarrollo web'],
  }),
];

const candidato = (id, nombre, correo, telefono, cargo, familiaCargo, origen = 'Externo') => ({
  id,
  nombre,
  correo,
  telefono,
  cargo,
  familiaCargo,
  origen,
});

export const candidatosDemoPostulaciones = [
  candidato(201, 'Camilo Fuentealba Ruiz', 'camilo.fuentealba@correo.cl', '+56930002201', 'Monitor Producción', 'Técnico B C'),
  candidato(202, 'Daniela Moraga Soto', 'daniela.moraga@correo.cl', '+56930002202', 'Monitor Producción', 'Técnico B C', 'Interno'),
  candidato(203, 'Rodrigo Alarcón Vera', 'rodrigo.alarcon@correo.cl', '+56930002203', 'Técnico Eléctrico', 'Técnico A'),
  candidato(204, 'Josefa Barría Mansilla', 'josefa.barria@correo.cl', '+56930002204', 'Supervisor Centro de Cultivo', 'Supervisor B'),
  candidato(205, 'Felipe Oyarzo Cárcamo', 'felipe.oyarzo@correo.cl', '+56930002205', 'Supervisor Centro de Cultivo', 'Supervisor B'),
  candidato(206, 'Ignacia Pérez Lagos', 'ignacia.perez@correo.cl', '+56930002206', 'Analista de Control de Gestión', 'Profesional B C'),
  candidato(207, 'Martín Gallardo Toledo', 'martin.gallardo@correo.cl', '+56930002207', 'Operador Grúa Horquilla', 'Operario Calificado'),
  candidato(208, 'Sofía Andrade Muñoz', 'sofia.andrade@correo.cl', '+56930002208', 'Analista de Sistemas', 'Profesional B C'),
];

const postulacion = (id, ofertaId, candidatoId, fechaPostulacion, datos = {}) => ({
  id,
  ofertaId,
  candidatoId,
  fechaPostulacion,
  estado: 'Recibida',
  ciudad: 'Puerto Montt',
  cvNombre: `CV_${candidatoId}.pdf`,
  solicitudId: null,
  ...datos,
});

export const postulacionesDemo = [
  postulacion(1, 1, 201, '2026-10-02'),
  postulacion(2, 1, 202, '2026-10-04', { ciudad: 'Calbuco' }),
  postulacion(3, 2, 203, '2026-10-05', { ciudad: 'Puerto Natales' }),
  postulacion(4, 3, 204, '2026-10-07', { ciudad: 'Castro' }),
  postulacion(5, 3, 205, '2026-10-08', { ciudad: 'Chonchi', estado: 'Descartada' }),
  postulacion(6, 5, 206, '2026-10-10'),
  postulacion(7, 7, 207, '2026-10-13', { ciudad: 'Puerto Varas' }),
  postulacion(8, 8, 208, '2026-10-15'),
];
