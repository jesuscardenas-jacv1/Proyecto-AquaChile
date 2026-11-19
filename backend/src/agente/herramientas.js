/**
 * Herramientas de Marea: una función determinista por intención, con los roles que la pueden usar.
 * Leen la BD con las mismas reglas que el resto de la API y reutilizan su lógica (análisis de CV y
 * % de cumplimiento, Planner, ofertas). La IA solo eligió la intención; aquí no se llama a Claude,
 * salvo el análisis de CV contra otros cargos y la redacción de ofertas, que usan las tareas existentes.
 *
 * Cada herramienta recibe el contexto { usuario, parametros, foco, origen, ahora } y devuelve
 * { texto, tarjetas, opciones, foco }. Nunca devuelve notas clínicas ni la pauta de la entrevista.
 * Todo lo que escribe (confirmar_agenda) llega solo desde el botón «Confirmar».
 */
const db = require('../bd/conexion');
const { cambiarEtapa } = require('../bd/planner');
const { analizarCv, redactarOferta } = require('../ia/tareas');
const { buscarDescriptor } = require('../ia/documentos');
const { cvDePostulacion } = require('../ia/analisisPostulacion');
const { calcularCumplimiento, normalizarCriterios } = require('../ia/cumplimiento');
const { ahoraEnChile, horaDisponible, horasLibres, sumarDias } = require('./horarios');
const { buscarPorNombre, formatearRut, mismoRut, rutEnTexto, rutValido } = require('./identidad');
const { frase } = require('./frases');

const MODALIDADES = ['Google Meet', 'Teams', 'Presencial'];
const ETAPAS = { recibida: 'Evaluación recibida', agendada: 'Entrevista agendada', realizada: 'Entrevista realizada', informe: 'Informe enviado' };
const MAXIMO_OPCIONES = 4;
// Análisis contra otros cargos abiertos por persona (cada uno es una llamada a la IA, ~USD 0,08).
const MAXIMO_CARGOS_EXTRA = 2;

const respuesta = ({ texto, tarjetas = [], opciones = [], foco = null }) => ({ texto, tarjetas, opciones, foco });
const opcion = (etiqueta, accion) => ({ etiqueta, accion });
const fechaLarga = (fecha) =>
  new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(
    new Date(`${fecha}T12:00:00Z`),
  );
const primerNombre = (nombre = '') => nombre.split(' ')[0];

// ---------------------------------------------------------------------------------------------
// Datos visibles para el usuario
// ---------------------------------------------------------------------------------------------

const SELECT_SOLICITUD = `
  SELECT s.*, c.nombre, c.rut FROM solicitudes s JOIN candidatos c ON c.id = s.candidato_id`;

/** La psicóloga trabaja con las solicitudes asignadas a ella o aún sin asignar; los demás roles ven todas. */
function filtroSolicitudes(usuario) {
  return usuario.rol === 'evaluador'
    ? { donde: "(s.profesional_responsable = ? OR s.profesional_responsable = '')", parametros: [usuario.nombre ?? ''] }
    : { donde: '1 = 1', parametros: [] };
}

function solicitudesVisibles(usuario, { soloAbiertas = false, limite = 200 } = {}) {
  const { donde, parametros } = filtroSolicitudes(usuario);
  const abiertas = soloAbiertas ? " AND s.estado <> 'Finalizada'" : '';
  return db
    .prepare(`${SELECT_SOLICITUD} WHERE ${donde}${abiertas} ORDER BY s.fecha_solicitud DESC, s.id DESC LIMIT ?`)
    .all(...parametros, limite);
}

function solicitudVisible(usuario, id) {
  const { donde, parametros } = filtroSolicitudes(usuario);
  return db.prepare(`${SELECT_SOLICITUD} WHERE s.id = ? AND ${donde}`).get(Number(id), ...parametros) ?? null;
}

/**
 * Personas de las que el usuario puede hablar: las de sus solicitudes y, para analista y admin,
 * también los postulantes del portal que aún no pasan a evaluación.
 */
function personasVisibles(usuario) {
  const personas = new Map();
  for (const s of solicitudesVisibles(usuario)) {
    if (!personas.has(s.candidato_id)) {
      personas.set(s.candidato_id, { candidatoId: s.candidato_id, nombre: s.nombre, rut: s.rut, solicitudId: s.id });
    }
  }
  if (['analista', 'admin'].includes(usuario.rol)) {
    const postulantes = db
      .prepare(
        `SELECT c.id, c.nombre, c.rut, p.id AS postulacion_id FROM postulaciones p
         JOIN candidatos c ON c.id = p.candidato_id ORDER BY p.id DESC`,
      )
      .all();
    for (const p of postulantes) {
      if (!personas.has(p.id)) personas.set(p.id, { candidatoId: p.id, nombre: p.nombre, rut: p.rut, solicitudId: null });
    }
  }
  return [...personas.values()];
}

const focoDe = (persona, verificado) => ({
  candidatoId: persona.candidatoId,
  solicitudId: persona.solicitudId ?? null,
  nombre: persona.nombre,
  verificado: Boolean(verificado),
});

const opcionesRecientes = (usuario, tipo, extra = {}) =>
  solicitudesVisibles(usuario, { soloAbiertas: true, limite: MAXIMO_OPCIONES }).map((s) =>
    opcion(`${s.nombre} · ${s.cargo}`, { tipo, solicitudId: s.id, ...extra }),
  );

// ---------------------------------------------------------------------------------------------
// ¿De quién se habla? (reglas 2 y 3 de marea-cerebro.md)
// ---------------------------------------------------------------------------------------------

/**
 * Identifica a la persona. Orden: número de solicitud, postulación o candidato (de una opción o
 * un aviso), nombre escrito, y por último el foco de la conversación.
 * Con `exigirRut`, un nombre escrito por primera vez debe confirmarse con su RUT.
 * @returns {{ persona } | { respuesta }}
 */
function identificar(ctx, { tipo, exigirRut = false }) {
  const { usuario, parametros, foco, origen } = ctx;
  const elegida = origen === 'accion';

  if (parametros.solicitudId) {
    const s = solicitudVisible(usuario, parametros.solicitudId);
    if (!s) return { respuesta: noEncontrada(ctx, tipo) };
    const persona = { candidatoId: s.candidato_id, nombre: s.nombre, rut: s.rut, solicitudId: s.id };
    const verificado = elegida || (foco?.solicitudId === s.id && foco.verificado);
    return exigirRut && !verificado ? pedirRut(ctx, persona) : { persona: { ...persona, verificado: true } };
  }

  if (parametros.postulacionId || parametros.candidatoId) {
    const candidatoId =
      parametros.candidatoId ||
      db.prepare('SELECT candidato_id FROM postulaciones WHERE id = ?').get(Number(parametros.postulacionId))?.candidato_id;
    const persona = personasVisibles(usuario).find((p) => p.candidatoId === Number(candidatoId));
    if (!persona) return { respuesta: noEncontrada(ctx, tipo) };
    return exigirRut && !elegida ? pedirRut(ctx, persona) : { persona: { ...persona, verificado: true } };
  }

  if (parametros.persona) {
    const coincidencias = buscarPorNombre(personasVisibles(usuario), parametros.persona);
    if (!coincidencias.length) return { respuesta: noEncontrada(ctx, tipo) };
    if (coincidencias.length > 1) {
      return {
        respuesta: respuesta({
          texto: frase(usuario.id, 'variasCoinciden'),
          opciones: coincidencias
            .slice(0, MAXIMO_OPCIONES)
            .map((p) => opcion(p.nombre, { tipo, candidatoId: p.candidatoId, solicitudId: p.solicitudId ?? undefined })),
        }),
      };
    }
    const [persona] = coincidencias;
    const yaVerificada = foco?.candidatoId === persona.candidatoId && foco.verificado;
    return exigirRut && !yaVerificada ? pedirRut(ctx, persona) : { persona: { ...persona, verificado: Boolean(yaVerificada) } };
  }

  if (foco?.candidatoId) {
    const persona = personasVisibles(usuario).find((p) => p.candidatoId === Number(foco.candidatoId));
    if (!persona) return { respuesta: noEncontrada(ctx, tipo) };
    return exigirRut && !foco.verificado ? pedirRut(ctx, persona) : { persona: { ...persona, verificado: Boolean(foco.verificado) } };
  }

  return {
    respuesta: respuesta({
      texto: frase(usuario.id, tipo === 'agendar' ? 'entrarAgenda' : 'listado'),
      opciones: opcionesRecientes(usuario, tipo),
    }),
  };
}

function noEncontrada({ usuario }, tipo) {
  return respuesta({ texto: frase(usuario.id, 'noEncuentra'), opciones: opcionesRecientes(usuario, tipo) });
}

/** Valida el RUT escrito (o lo pide) y lo compara con el registrado del candidato. */
function pedirRut(ctx, persona) {
  const { usuario, parametros, mensaje } = ctx;
  const rut = parametros.rut || rutEnTexto(mensaje);
  const focoPendiente = { ...focoDe(persona, false), pendiente: 'rut' };
  if (!rut) return { respuesta: respuesta({ texto: frase(usuario.id, 'pideRut', { nombre: persona.nombre }), foco: focoPendiente }) };
  if (!rutValido(rut)) {
    return { respuesta: respuesta({ texto: frase(usuario.id, 'rutInvalido', { rut: formatearRut(rut) || rut }), foco: focoPendiente }) };
  }
  if (persona.rut && !mismoRut(rut, persona.rut)) {
    return { respuesta: respuesta({ texto: frase(usuario.id, 'rutDistinto', { nombre: persona.nombre }), foco: focoPendiente }) };
  }
  return { persona: { ...persona, verificado: true } };
}

// ---------------------------------------------------------------------------------------------
// Agenda (psicóloga)
// ---------------------------------------------------------------------------------------------

/**
 * Entrevistas ya agendadas de la psicóloga (salvo la de esta solicitud). Las de solicitudes sin
 * responsable también cuentan: pudo agendarlas ella y así no se ofrece dos veces la misma hora.
 */
function entrevistasOcupadas(responsable, excepto, hoy) {
  return db
    .prepare(
      `SELECT fecha_entrevista AS fecha, hora_entrevista AS hora FROM solicitudes
       WHERE profesional_responsable IN (?, '') AND etapa = 'agendada' AND motivo_cierre = ''
         AND fecha_entrevista >= ? AND hora_entrevista <> '' AND id <> ?`,
    )
    .all(responsable, hoy, excepto);
}

const responsableDe = (solicitud, usuario) => solicitud.profesional_responsable || usuario.nombre || '';

function tarjetaHoras(ctx, solicitud, { desde = '', modalidad = '' } = {}) {
  const { usuario, ahora } = ctx;
  const hoy = ahoraEnChile(ahora).fecha;
  const libres = horasLibres({ ahora, desde, ocupadas: entrevistasOcupadas(responsableDe(solicitud, usuario), solicitud.id, hoy) });
  const nombre = primerNombre(solicitud.nombre);
  if (!libres) return { texto: frase(usuario.id, 'sinHoras'), tarjetas: [], opciones: [] };

  const texto =
    libres.fecha === hoy || desde
      ? frase(usuario.id, 'horasLibres', { nombre })
      : frase(usuario.id, 'horasOtroDia', { nombre, dia: fechaLarga(libres.fecha) });
  return {
    texto: `${texto}\nFuente: Planner`,
    tarjetas: [
      {
        tipo: 'horas',
        solicitudId: solicitud.id,
        nombre: solicitud.nombre,
        cargo: solicitud.cargo,
        fecha: libres.fecha,
        bloques: libres.bloques,
        modalidades: MODALIDADES,
        modalidad: MODALIDADES.includes(modalidad) ? modalidad : 'Google Meet',
      },
    ],
    opciones: [opcion('Otro día', { tipo: 'agendar', solicitudId: solicitud.id, desde: sumarDias(libres.fecha, 1) })],
  };
}

function tarjetaConfirmacion(ctx, solicitud, { fecha, hora, modalidad }) {
  return respuesta({
    texto: frase(ctx.usuario.id, 'confirmar'),
    tarjetas: [
      {
        tipo: 'confirmacion',
        titulo: `Entrevista con ${solicitud.nombre}`,
        detalle: [`${fechaLarga(fecha)} · ${hora}`, modalidad, solicitud.cargo],
        accion: { tipo: 'confirmar_agenda', solicitudId: solicitud.id, fecha, hora, modalidad },
      },
    ],
    foco: { candidatoId: solicitud.candidato_id, solicitudId: solicitud.id, nombre: solicitud.nombre, verificado: true },
  });
}

/** Solicitud de la persona identificada que todavía se puede agendar, o la respuesta que lo explica. */
function solicitudParaAgendar(ctx, persona, { reagendar }) {
  const solicitud = persona.solicitudId ? solicitudVisible(ctx.usuario, persona.solicitudId) : null;
  if (!solicitud) return { respuesta: respuesta({ texto: `${persona.nombre} no tiene una solicitud de evaluación abierta contigo.` }) };
  if (solicitud.motivo_cierre || solicitud.estado === 'Finalizada') {
    return { respuesta: respuesta({ texto: `La solicitud de ${persona.nombre} ya está finalizada: no se puede agendar.` }) };
  }
  if (reagendar && solicitud.etapa !== 'agendada') {
    return {
      respuesta: respuesta({
        texto: `${persona.nombre} aún no tiene una entrevista agendada.`,
        opciones: [opcion('Agendar', { tipo: 'agendar', solicitudId: solicitud.id })],
      }),
    };
  }
  if (!reagendar && ['realizada', 'informe'].includes(solicitud.etapa)) {
    return { respuesta: respuesta({ texto: `La entrevista de ${persona.nombre} ya se realizó.` }) };
  }
  return { solicitud };
}

function agendar(ctx, { reagendar = false } = {}) {
  const identificada = identificar(ctx, { tipo: reagendar ? 'reagendar' : 'agendar', exigirRut: true });
  if (identificada.respuesta) return identificada.respuesta;
  const { persona } = identificada;
  const { solicitud, respuesta: aviso } = solicitudParaAgendar(ctx, persona, { reagendar });
  if (aviso) return aviso;

  const foco = focoDe(persona, true);
  const { fecha, hora, modalidad, desde } = ctx.parametros;
  // Si ya dijo la hora y está libre, se pasa directo a confirmar.
  if (fecha && hora && MODALIDADES.includes(modalidad)) {
    const hoy = ahoraEnChile(ctx.ahora).fecha;
    const ocupadas = entrevistasOcupadas(responsableDe(solicitud, ctx.usuario), solicitud.id, hoy);
    if (horaDisponible({ fecha, hora, ahora: ctx.ahora, ocupadas })) return tarjetaConfirmacion(ctx, solicitud, { fecha, hora, modalidad });
  }
  const actual =
    reagendar && solicitud.fecha_entrevista
      ? `Hoy está agendada para el ${fechaLarga(solicitud.fecha_entrevista)} a las ${solicitud.hora_entrevista}.\n`
      : '';
  const horas = tarjetaHoras(ctx, solicitud, { desde, modalidad });
  return respuesta({ ...horas, texto: `${actual}${horas.texto}`, foco });
}

/** Eligió una hora en la tarjeta: se muestra la propuesta para confirmar (no guarda nada). */
function elegirHora(ctx) {
  const { fecha, hora, modalidad, solicitudId } = ctx.parametros;
  const solicitud = solicitudVisible(ctx.usuario, solicitudId);
  if (!solicitud) return noEncontrada(ctx, 'agendar');
  if (!MODALIDADES.includes(modalidad)) return respuesta({ texto: 'Elige la modalidad: Google Meet, Teams o Presencial.' });
  const hoy = ahoraEnChile(ctx.ahora).fecha;
  const ocupadas = entrevistasOcupadas(responsableDe(solicitud, ctx.usuario), solicitud.id, hoy);
  if (!horaDisponible({ fecha, hora, ahora: ctx.ahora, ocupadas })) {
    return respuesta({ ...tarjetaHoras(ctx, solicitud, { modalidad }), texto: frase(ctx.usuario.id, 'horaTomada') });
  }
  return tarjetaConfirmacion(ctx, solicitud, { fecha, hora, modalidad });
}

/**
 * Botón «Confirmar»: única acción de Marea que escribe. Revisa de nuevo que la hora siga libre y
 * agenda con el mismo flujo del Planner (etapa «Entrevista agendada» y, con Google Meet, evento en Calendar).
 */
async function confirmarAgenda(ctx) {
  const { fecha, hora, modalidad, solicitudId } = ctx.parametros;
  const solicitud = solicitudVisible(ctx.usuario, solicitudId);
  if (!solicitud) return noEncontrada(ctx, 'agendar');
  const { respuesta: aviso } = solicitudParaAgendar(ctx, { solicitudId, nombre: solicitud.nombre }, { reagendar: solicitud.etapa === 'agendada' });
  if (aviso) return aviso;
  if (!MODALIDADES.includes(modalidad)) return respuesta({ texto: 'Elige la modalidad: Google Meet, Teams o Presencial.' });

  const hoy = ahoraEnChile(ctx.ahora).fecha;
  const ocupadas = entrevistasOcupadas(responsableDe(solicitud, ctx.usuario), solicitud.id, hoy);
  if (!horaDisponible({ fecha, hora, ahora: ctx.ahora, ocupadas })) {
    return respuesta({ ...tarjetaHoras(ctx, solicitud, { modalidad }), texto: frase(ctx.usuario.id, 'horaTomada') });
  }

  const { solicitud: agendada, avisoReunion } = await cambiarEtapa(solicitud.id, {
    etapa: 'agendada',
    fechaEntrevista: fecha,
    horaEntrevista: hora,
    modalidadEntrevista: modalidad,
  });
  const nombre = primerNombre(solicitud.nombre);
  return {
    ...respuesta({
      texto: [frase(ctx.usuario.id, 'agendado', { nombre }), avisoReunion].filter(Boolean).join('\n'),
      tarjetas: [
        {
          tipo: 'resumen',
          titulo: `Entrevista con ${solicitud.nombre}`,
          lineas: [
            `${fechaLarga(fecha)} · ${hora} · ${modalidad}`,
            agendada.enlaceReunion ? `Enlace: ${agendada.enlaceReunion}` : '',
            'Etapa: Entrevista agendada',
          ].filter(Boolean),
          fuente: modalidad === 'Google Meet' ? 'Planner · Google Calendar' : 'Planner',
        },
      ],
      foco: { candidatoId: solicitud.candidato_id, solicitudId: solicitud.id, nombre: solicitud.nombre, verificado: true },
    }),
    cambioDatos: true,
  };
}

// ---------------------------------------------------------------------------------------------
// Solicitudes, análisis y guía
// ---------------------------------------------------------------------------------------------

/** Último análisis del CV de la postulación que originó la solicitud (o null). */
function analisisDeSolicitud(solicitudId) {
  const fila = db
    .prepare(
      `SELECT a.resultado FROM analisis_cv a JOIN postulaciones p ON p.id = a.postulacion_id
       WHERE p.solicitud_id = ? ORDER BY a.creado_en DESC LIMIT 1`,
    )
    .get(solicitudId);
  return fila ? JSON.parse(fila.resultado) : null;
}

function proximoPaso(solicitud) {
  if (solicitud.motivo_cierre) return `Cerrada sin evaluación: ${solicitud.motivo_cierre}.`;
  if (solicitud.estado === 'Finalizada') return 'Proceso finalizado.';
  if (!solicitud.profesional_responsable) return 'Asignar una psicóloga responsable.';
  if (solicitud.etapa === 'agendada') return `Realizar la entrevista el ${fechaLarga(solicitud.fecha_entrevista)} a las ${solicitud.hora_entrevista}.`;
  if (solicitud.etapa === 'realizada') return 'Registrar la evaluación y enviar el informe.';
  return 'Agendar la entrevista.';
}

function resumenSolicitud(ctx) {
  const identificada = identificar(ctx, { tipo: 'resumen_solicitud' });
  if (identificada.respuesta) return identificada.respuesta;
  const { persona } = identificada;
  const solicitud = persona.solicitudId ? solicitudVisible(ctx.usuario, persona.solicitudId) : null;
  if (!solicitud) {
    return respuesta({
      texto: `${persona.nombre} postuló por el portal, pero aún no pasa a evaluación.`,
      opciones: ctx.usuario.rol === 'jefatura' ? [] : [opcion('Análisis completo', { tipo: 'analizar_candidato', candidatoId: persona.candidatoId })],
      foco: focoDe(persona, persona.verificado),
    });
  }

  const porcentaje = analisisDeSolicitud(solicitud.id)?.cumplimiento?.porcentaje;
  const { rol } = ctx.usuario;
  const opciones = [];
  if (['evaluador', 'admin'].includes(rol) && solicitud.etapa !== 'agendada' && solicitud.estado !== 'Finalizada') {
    opciones.push(opcion('Agendar', { tipo: 'agendar', solicitudId: solicitud.id }));
  }
  if (rol !== 'jefatura') opciones.push(opcion('Análisis completo', { tipo: 'analizar_candidato', solicitudId: solicitud.id }));
  if (['evaluador', 'admin'].includes(rol) && ['agendada', 'realizada'].includes(solicitud.etapa)) {
    opciones.push(opcion('Guía de entrevista', { tipo: 'guia_entrevista', solicitudId: solicitud.id }));
  }

  return respuesta({
    texto: frase(ctx.usuario.id, 'resumen', { nombre: primerNombre(solicitud.nombre) }),
    tarjetas: [
      {
        tipo: 'resumen',
        titulo: `Solicitud #${solicitud.id} · ${solicitud.nombre}`,
        lineas: [
          `Cargo: ${solicitud.cargo}`,
          `Estado: ${solicitud.estado} · ${ETAPAS[solicitud.etapa] ?? 'Sin etapa'}`,
          `Psicóloga responsable: ${solicitud.profesional_responsable || 'sin asignar'}`,
          Number.isFinite(porcentaje) ? `Requisitos del CV: ${porcentaje}%` : 'Sin análisis de CV',
          `Próximo paso: ${proximoPaso(solicitud)}`,
        ],
        fuente: 'Solicitudes · Planner',
      },
    ],
    opciones,
    foco: focoDe({ ...persona, solicitudId: solicitud.id }, persona.verificado),
  });
}

/** Ajustes ya calculados: análisis de las postulaciones de la persona y los guardados contra otros cargos. */
function ajustesGuardados(candidatoId) {
  const dePostulaciones = db
    .prepare(
      `SELECT o.id AS oferta_id, o.cargo, a.resultado FROM postulaciones p
       JOIN ofertas o ON o.id = p.oferta_id JOIN analisis_cv a ON a.postulacion_id = p.id
       WHERE p.candidato_id = ?`,
    )
    .all(candidatoId);
  const deOtrosCargos = db
    .prepare(
      `SELECT o.id AS oferta_id, o.cargo, j.resultado FROM ajuste_cargo j JOIN ofertas o ON o.id = j.oferta_id
       WHERE j.candidato_id = ?`,
    )
    .all(candidatoId);
  return [...dePostulaciones, ...deOtrosCargos].map((fila) => ({ ofertaId: fila.oferta_id, cargo: fila.cargo, ...JSON.parse(fila.resultado) }));
}

/**
 * Analiza el CV de la persona contra hasta MAXIMO_CARGOS_EXTRA cargos abiertos a los que no postuló,
 * con la misma tarea y el mismo cálculo de cumplimiento que el análisis de Postulaciones.
 * Guarda el resultado en ajuste_cargo para no repetir el costo.
 */
async function analizarOtrosCargos(candidatoId, conocidos) {
  const postulacion = db
    .prepare("SELECT id FROM postulaciones WHERE candidato_id = ? AND cv_nombre <> '' ORDER BY id DESC LIMIT 1")
    .get(candidatoId);
  if (!postulacion) return [];
  const ofertas = db
    .prepare("SELECT * FROM ofertas WHERE estado = 'Abierta' AND publicada = 1 AND requisitos <> '[]' ORDER BY fecha_publicacion DESC")
    .all()
    .filter((oferta) => !conocidos.has(oferta.id))
    .slice(0, MAXIMO_CARGOS_EXTRA);
  if (!ofertas.length) return [];
  const cv = await cvDePostulacion(postulacion.id);
  if (!cv) return [];

  const nuevos = [];
  for (const oferta of ofertas) {
    const descriptor = await buscarDescriptor({ cargo: oferta.cargo, ofertaId: oferta.id });
    const { datos, modelo } = await analizarCv({ cv, descriptor, oferta });
    db.prepare(
      `INSERT INTO ajuste_cargo (candidato_id, oferta_id, resultado, modelo) VALUES (?, ?, ?, ?)
       ON CONFLICT (candidato_id, oferta_id) DO UPDATE SET resultado = excluded.resultado, modelo = excluded.modelo, creado_en = datetime('now')`,
    ).run(candidatoId, oferta.id, JSON.stringify(datos), modelo);
    nuevos.push({ ofertaId: oferta.id, cargo: oferta.cargo, ...datos });
  }
  return nuevos;
}

/** El % siempre se recalcula con cumplimiento.js desde los criterios guardados (nunca lo da la IA). */
const porcentajeDe = (analisis) => calcularCumplimiento(normalizarCriterios(analisis.criterios)).porcentaje;

async function analizarCandidato(ctx) {
  const identificada = identificar(ctx, { tipo: 'analizar_candidato' });
  if (identificada.respuesta) return identificada.respuesta;
  const { persona } = identificada;
  const { usuario } = ctx;

  const guardados = ajustesGuardados(persona.candidatoId);
  const extra = await analizarOtrosCargos(persona.candidatoId, new Set(guardados.map((a) => a.ofertaId)));
  const cargos = [...guardados, ...extra]
    .map((analisis) => ({ ...analisis, porcentaje: porcentajeDe(analisis) }))
    .filter((analisis) => Number.isFinite(analisis.porcentaje))
    .sort((a, b) => b.porcentaje - a.porcentaje);

  const foco = focoDe(persona, persona.verificado);
  if (!cargos.length) return respuesta({ texto: frase(usuario.id, 'sinAnalisis', { nombre: persona.nombre }), foco });

  const [mayor] = cargos;
  const criterios = normalizarCriterios(mayor.criterios);
  const resultado = respuesta({
    texto: `${frase(usuario.id, 'analisis', { nombre: primerNombre(persona.nombre), cargo: mayor.cargo, porcentaje: mayor.porcentaje })}\nFuente: Análisis de CV`,
    tarjetas: [
      {
        tipo: 'analisis',
        nombre: persona.nombre,
        mayorAjuste: { cargo: mayor.cargo, porcentaje: mayor.porcentaje },
        cargos: cargos.map(({ cargo, porcentaje }) => ({ cargo, porcentaje })),
        fortalezas: criterios.filter((c) => c.nivel === 'cumple').map((c) => c.requisito).slice(0, 4),
        aConfirmar: criterios.filter((c) => c.nivel !== 'cumple').map((c) => c.requisito).slice(0, 4),
        nota: 'La decisión es tuya.',
      },
    ],
    foco,
  });

  if (!ctx.parametros.tambienAgendar) return resultado;
  if (!['evaluador', 'admin'].includes(usuario.rol)) {
    return { ...resultado, texto: `${resultado.texto}\n${frase(usuario.id, 'agendaEsDePsicologa')}` };
  }
  const solicitud = persona.solicitudId ? solicitudVisible(usuario, persona.solicitudId) : null;
  if (!solicitud) return resultado;
  const horas = tarjetaHoras(ctx, solicitud);
  return { ...resultado, texto: `${resultado.texto}\n${horas.texto}`, tarjetas: [...resultado.tarjetas, ...horas.tarjetas], opciones: horas.opciones };
}

function guiaEntrevista(ctx) {
  const identificada = identificar(ctx, { tipo: 'guia_entrevista' });
  if (identificada.respuesta) return identificada.respuesta;
  const { persona } = identificada;
  const foco = focoDe(persona, persona.verificado);
  const analisis = persona.solicitudId ? analisisDeSolicitud(persona.solicitudId) : null;
  if (!analisis) return respuesta({ texto: frase(ctx.usuario.id, 'sinAnalisis', { nombre: persona.nombre }), foco });

  const brechas = normalizarCriterios(analisis.criterios)
    .filter((c) => c.nivel === 'parcial' || c.nivel === 'sin-evidencia')
    .map((c) => (c.evidencia ? `${c.requisito}: ${c.evidencia}` : c.requisito))
    .slice(0, 3);
  return respuesta({
    texto: `${frase(ctx.usuario.id, 'guia', { nombre: primerNombre(persona.nombre) })}\nFuente: Análisis de CV`,
    tarjetas: [
      {
        tipo: 'resumen',
        titulo: `Guía para entrevistar a ${persona.nombre}`,
        lineas: (analisis.preguntasSugeridas ?? []).slice(0, 3),
        secciones: [{ titulo: 'Brechas del CV', lineas: brechas }],
        fuente: 'Análisis de CV',
      },
    ],
    foco,
  });
}

function rankingCargo(ctx) {
  const { usuario, parametros } = ctx;
  const cargos = db.prepare("SELECT DISTINCT cargo FROM ofertas WHERE estado = 'Abierta' ORDER BY cargo").all().map((f) => f.cargo);
  const cargo = parametros.cargo ? buscarPorNombre(cargos.map((nombre) => ({ nombre })), parametros.cargo)[0]?.nombre : '';
  if (!cargo) {
    return respuesta({
      texto: parametros.cargo ? `No encontré ofertas abiertas de "${parametros.cargo}". ¿Es alguna de estas?` : '¿De qué cargo? Elige uno:',
      opciones: cargos.slice(0, MAXIMO_OPCIONES).map((nombre) => opcion(nombre, { tipo: 'ranking_cargo', cargo: nombre })),
    });
  }

  const filas = db
    .prepare(
      `SELECT c.id AS candidato_id, c.nombre, a.resultado FROM postulaciones p
       JOIN ofertas o ON o.id = p.oferta_id JOIN candidatos c ON c.id = p.candidato_id
       JOIN analisis_cv a ON a.postulacion_id = p.id
       WHERE o.cargo = ? AND p.estado <> 'Descartada'`,
    )
    .all(cargo)
    .map((fila) => {
      const analisis = JSON.parse(fila.resultado);
      const brecha = normalizarCriterios(analisis.criterios).find((c) => c.tipo === 'obligatorio' && c.nivel !== 'cumple');
      return { candidatoId: fila.candidato_id, nombre: fila.nombre, porcentaje: porcentajeDe(analisis), brecha: brecha?.requisito ?? '' };
    })
    .filter((fila) => Number.isFinite(fila.porcentaje))
    .sort((a, b) => b.porcentaje - a.porcentaje);

  if (!filas.length) return respuesta({ texto: `Aún no hay postulantes con CV analizado para ${cargo}.` });
  return respuesta({
    texto: `${frase(usuario.id, 'ranking', { cargo })}\nFuente: Postulaciones · Análisis de CV`,
    tarjetas: [{ tipo: 'ranking', cargo, postulantes: filas.slice(0, 10), nota: 'La decisión es tuya.' }],
    opciones: filas.slice(0, 3).map((f) => opcion(`Analizar a ${primerNombre(f.nombre)}`, { tipo: 'analizar_candidato', candidatoId: f.candidatoId })),
  });
}

async function redactarOfertaMarea(ctx) {
  const cargo = (ctx.parametros.cargo ?? '').trim();
  if (cargo.length < 2) return respuesta({ texto: '¿Para qué cargo redacto la oferta?' });
  const oferta = { cargo, familiaCargo: '', area: '', ubicacion: '', jornada: '' };
  const descriptor = await buscarDescriptor({ cargo });
  const { datos } = await redactarOferta({ oferta, descriptor });
  return respuesta({
    texto: `${frase(ctx.usuario.id, 'oferta', { cargo })}\nFuente: ${descriptor ? 'Descriptor del cargo' : 'Sin descriptor del cargo'}`,
    tarjetas: [
      {
        tipo: 'resumen',
        titulo: datos.titulo,
        lineas: [datos.descripcion],
        secciones: [{ titulo: 'Requisitos', lineas: datos.requisitos }],
        fuente: 'Borrador para revisar en Ofertas (no se publicó nada)',
      },
    ],
  });
}

function listarSolicitudes(ctx) {
  const opciones = opcionesRecientes(ctx.usuario, 'resumen_solicitud');
  if (!opciones.length) return respuesta({ texto: 'No tienes solicitudes abiertas.' });
  return respuesta({ texto: `${frase(ctx.usuario.id, 'listado')}\nFuente: Solicitudes`, opciones });
}

// ---------------------------------------------------------------------------------------------
// Avisos (campana de Marea)
// ---------------------------------------------------------------------------------------------

/** "/solicitudes/12" o "/postulaciones?postulacion=7" → a qué se refiere el aviso. */
function referenciaDeEnlace(enlace = '') {
  const solicitud = /^\/solicitudes\/(\d+)/.exec(enlace);
  if (solicitud) return { solicitudId: Number(solicitud[1]) };
  const postulacion = /^\/postulaciones\?postulacion=(\d+)/.exec(enlace);
  return postulacion ? { postulacionId: Number(postulacion[1]) } : {};
}

/** Acciones de un aviso según el rol: «Analizar y agendar» y «Resumen». */
function accionesDeAviso(referencia, rol) {
  if (!referencia.solicitudId && !referencia.postulacionId) return [];
  const acciones = [];
  if (['analista', 'evaluador', 'admin'].includes(rol)) {
    acciones.push(opcion('Analizar y agendar', { tipo: 'analizar_candidato', ...referencia, tambienAgendar: true }));
  }
  if (referencia.solicitudId) acciones.push(opcion('Resumen', { tipo: 'resumen_solicitud', ...referencia }));
  return acciones;
}

/** Solicitudes nuevas, asignaciones y postulaciones recientes del usuario (tabla notificaciones). */
function listarAvisos(usuario, { limite = 10 } = {}) {
  const avisos = db
    .prepare(
      `SELECT * FROM notificaciones WHERE usuario_id = ? AND tipo IN ('solicitud', 'asignacion', 'postulacion')
       ORDER BY id DESC LIMIT ?`,
    )
    .all(usuario.id, limite)
    .map((n) => {
      const referencia = referenciaDeEnlace(n.enlace);
      return {
        id: n.id,
        tipo: n.tipo,
        mensaje: n.mensaje,
        leida: Boolean(n.leida),
        creadaEn: n.creado_en,
        ...referencia,
        acciones: accionesDeAviso(referencia, usuario.rol),
      };
    });
  return { noLeidas: avisos.filter((a) => !a.leida).length, avisos };
}

function avisos(ctx) {
  const { avisos: lista, noLeidas } = listarAvisos(ctx.usuario, { limite: 5 });
  const nuevos = lista.filter((a) => !a.leida);
  if (!nuevos.length) return respuesta({ texto: frase(ctx.usuario.id, 'sinAvisos'), opciones: [opcion('Ver solicitudes', { tipo: 'listar_solicitudes' })] });
  return respuesta({
    texto: frase(ctx.usuario.id, 'avisos', { total: noLeidas }),
    tarjetas: [{ tipo: 'opciones', titulo: 'Avisos', avisos: nuevos }],
  });
}

// ---------------------------------------------------------------------------------------------
// Catálogo de herramientas y permisos (RBAC por herramienta; el admin pasa siempre)
// ---------------------------------------------------------------------------------------------

const TODOS = ['analista', 'evaluador', 'jefatura'];

const HERRAMIENTAS = {
  agendar: { roles: ['evaluador'], nombre: 'Agendar entrevistas', ejecutar: (ctx) => agendar(ctx) },
  reagendar: { roles: ['evaluador'], nombre: 'Reagendar entrevistas', ejecutar: (ctx) => agendar(ctx, { reagendar: true }) },
  elegir_hora: { roles: ['evaluador'], nombre: 'Agendar entrevistas', soloAccion: true, ejecutar: elegirHora },
  confirmar_agenda: { roles: ['evaluador'], nombre: 'Agendar entrevistas', soloAccion: true, ejecutar: confirmarAgenda },
  resumen_solicitud: { roles: TODOS, nombre: 'Resumen de una solicitud', ejecutar: resumenSolicitud },
  analizar_candidato: { roles: ['analista', 'evaluador'], nombre: 'Análisis completo del CV', ejecutar: analizarCandidato },
  ranking_cargo: { roles: ['analista'], nombre: 'Ranking de postulantes', ejecutar: rankingCargo },
  guia_entrevista: { roles: ['evaluador'], nombre: 'Guía de entrevista', ejecutar: guiaEntrevista },
  redactar_oferta: { roles: ['analista'], nombre: 'Redactar ofertas', ejecutar: redactarOfertaMarea },
  listar_solicitudes: { roles: TODOS, nombre: 'Solicitudes recientes', ejecutar: listarSolicitudes },
  avisos: { roles: TODOS, nombre: 'Avisos', ejecutar: avisos },
};

const puedeUsar = (rol, herramienta) => rol === 'admin' || Boolean(HERRAMIENTAS[herramienta]?.roles.includes(rol));

/** Atajos a lo que el rol sí puede hacer (para ayuda, «no entiendo» y «fuera de tu rol»). */
const ATAJOS = [
  ['agendar', 'Agendar una entrevista'],
  ['avisos', 'Ver avisos'],
  ['listar_solicitudes', 'Solicitudes recientes'],
  ['ranking_cargo', 'Ranking por cargo'],
  ['redactar_oferta', 'Redactar una oferta'],
];
const opcionesDelRol = (rol) =>
  ATAJOS.filter(([herramienta]) => puedeUsar(rol, herramienta)).map(([tipo, etiqueta]) => opcion(etiqueta, { tipo }));

module.exports = { HERRAMIENTAS, listarAvisos, opcionesDelRol, puedeUsar, referenciaDeEnlace };
