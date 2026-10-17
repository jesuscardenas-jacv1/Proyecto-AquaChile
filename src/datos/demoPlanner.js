/**
 * Solicitudes ficticias en curso para la demostración del Planner de la psicóloga.
 * Todos los nombres, correos y teléfonos son inventados (regla de datos ficticios del caso).
 * Los ids parten en 101 para no chocar con los 100 registros de la BD simulada.
 */

const candidato = (id, nombre, correo, telefono, cargo, familiaCargo, origen) => ({
  id,
  nombre,
  correo,
  telefono,
  cargo,
  familiaCargo,
  origen,
});

export const candidatosDemoPlanner = [
  candidato(101, 'Valentina Ríos Ojeda', 'valentina.rios@correo.cl', '+56920001101', 'Monitor Producción', 'Técnico B C', 'Externo'),
  candidato(102, 'Tomás Barrientos Leal', 'tomas.barrientos@correo.cl', '+56920001102', 'Operador Grúa Horquilla', 'Operario Calificado', 'Interno'),
  candidato(103, 'Constanza Vera Millán', 'constanza.vera@correo.cl', '+56920001103', 'Analista de Control de Gestión', 'Profesional B C', 'Externo'),
  candidato(104, 'Ignacio Paredes Soto', 'ignacio.paredes@correo.cl', '+56920001104', 'Técnico Eléctrico', 'Técnico A', 'Externo'),
  candidato(105, 'Francisca Oyarzún Díaz', 'francisca.oyarzun@correo.cl', '+56920001105', 'Supervisor Centro de Cultivo', 'Supervisor B', 'Interno'),
  candidato(106, 'Matías Gallardo Pinto', 'matias.gallardo@correo.cl', '+56920001106', 'Prevencionista de Riesgos', 'Profesional B C', 'Externo'),
  candidato(107, 'Antonia Cárdenas Vidal', 'antonia.cardenas@correo.cl', '+56920001107', 'Técnico Laboratorio', 'Técnico B C', 'Interno'),
  candidato(108, 'Benjamín Navarro Uribe', 'benjamin.navarro@correo.cl', '+56920001108', 'Jefe de Turno', 'Jefatura', 'Externo'),
];

const solicitud = (id, datos) => ({
  id,
  candidatoId: id,
  cv: '',
  ceco: '',
  requiereReferencias: false,
  modalidadEntrevista: '',
  fechaEntrevista: '',
  horaEntrevista: '',
  ...datos,
});

export const solicitudesDemoPlanner = [
  // Evaluación Recibida: falta coordinar la entrevista con el candidato.
  solicitud(101, {
    cargo: 'Monitor Producción', familiaCargo: 'Técnico B C', fechaSolicitud: '2026-10-07',
    estado: 'Pendiente', etapa: 'recibida', profesionalResponsable: '', reclutador: 'Javiera Soto',
    observaciones: 'Profundizar en experiencia en turnos rotativos.', tipoEvaluacion: 'externa',
    ubicacion: 'Planta Calbuco', unidad: 'Industrial', descriptorCargo: 'DC_Monitor_Producción.pdf',
  }),
  solicitud(102, {
    cargo: 'Operador Grúa Horquilla', familiaCargo: 'Operario Calificado', fechaSolicitud: '2026-10-09',
    estado: 'Pendiente', etapa: 'recibida', profesionalResponsable: '', reclutador: 'Macarena Vidal',
    observaciones: '', tipoEvaluacion: 'interna',
    ubicacion: 'Planta Cailin', unidad: 'Industrial', descriptorCargo: 'DC_Operador_Grúa_Horquilla.pdf',
  }),
  solicitud(103, {
    cargo: 'Analista de Control de Gestión', familiaCargo: 'Profesional B C', fechaSolicitud: '2026-10-12',
    estado: 'Pendiente', etapa: 'recibida', profesionalResponsable: '', reclutador: 'Carolina Muñoz',
    observaciones: 'Revisar manejo de presión y plazos de cierre mensual.', tipoEvaluacion: 'externa',
    ubicacion: 'Oficina Central', unidad: 'Corporativo', descriptorCargo: 'DC_Analista_de_Control_de_Gestión.pdf',
  }),
  // Entrevista Agendada.
  solicitud(104, {
    cargo: 'Técnico Eléctrico', familiaCargo: 'Técnico A', fechaSolicitud: '2026-10-01',
    estado: 'En proceso', etapa: 'agendada', profesionalResponsable: 'Ignacia Valdés Ortiz', reclutador: 'Fernanda Rojas',
    observaciones: '', tipoEvaluacion: 'externa',
    ubicacion: 'Planta Magallanes', unidad: 'Industrial', descriptorCargo: 'DC_Técnico_Eléctrico.pdf',
    fechaEntrevista: '2026-10-14', horaEntrevista: '09:30', modalidadEntrevista: 'Teams',
  }),
  solicitud(105, {
    cargo: 'Supervisor Centro de Cultivo', familiaCargo: 'Supervisor B', fechaSolicitud: '2026-10-02',
    estado: 'En proceso', etapa: 'agendada', profesionalResponsable: 'Ignacia Valdés Ortiz', reclutador: 'Daniela Contreras',
    observaciones: 'Evaluar liderazgo de equipos en terreno.', tipoEvaluacion: 'interna',
    ubicacion: 'AM Chonchi', unidad: 'Producción AM', descriptorCargo: 'DC_Supervisor_Centro_de_Cultivo.pdf',
    fechaEntrevista: '2026-10-14', horaEntrevista: '12:30', modalidadEntrevista: 'Teams',
  }),
  solicitud(106, {
    cargo: 'Prevencionista de Riesgos', familiaCargo: 'Profesional B C', fechaSolicitud: '2026-10-05',
    estado: 'En proceso', etapa: 'agendada', profesionalResponsable: 'Ignacia Valdés Ortiz', reclutador: 'Javiera Soto',
    observaciones: '', tipoEvaluacion: 'externa',
    ubicacion: 'Pargua PA', unidad: 'Otros Producción', descriptorCargo: 'DC_Prevencionista_de_Riesgos.pdf',
    fechaEntrevista: '2026-10-15', horaEntrevista: '15:00', modalidadEntrevista: 'Presencial',
  }),
  // Entrevista Realizada: falta registrar la evaluación y enviar el informe.
  solicitud(107, {
    cargo: 'Técnico Laboratorio', familiaCargo: 'Técnico B C', fechaSolicitud: '2026-09-28',
    estado: 'En proceso', etapa: 'realizada', profesionalResponsable: 'Ignacia Valdés Ortiz', reclutador: 'Macarena Vidal',
    observaciones: '', tipoEvaluacion: 'interna',
    ubicacion: 'Codihue', unidad: 'Producción AD', descriptorCargo: 'DC_Técnico_Laboratorio.pdf',
    fechaEntrevista: '2026-10-08', horaEntrevista: '10:00', modalidadEntrevista: 'Teams',
  }),
  solicitud(108, {
    cargo: 'Jefe de Turno', familiaCargo: 'Jefatura', fechaSolicitud: '2026-09-30',
    estado: 'En proceso', etapa: 'realizada', profesionalResponsable: 'Ignacia Valdés Ortiz', reclutador: 'Carolina Muñoz',
    observaciones: 'Indagar estilo de manejo de conflictos.', tipoEvaluacion: 'externa',
    ubicacion: 'Planta Calbuco', unidad: 'Industrial', descriptorCargo: 'DC_Jefe_de_Turno.pdf',
    fechaEntrevista: '2026-10-09', horaEntrevista: '11:30', modalidadEntrevista: 'Presencial',
  }),
];
