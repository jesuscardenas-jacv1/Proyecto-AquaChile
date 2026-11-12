/**
 * Reuniones online de la entrevista psicolaboral (Planner).
 *
 * - Google Meet: al agendar con la modalidad "Google Meet" se crea (o actualiza) un evento en
 *   Google Calendar con enlace de Meet, con la misma cuenta de Google autorizada para Drive.
 *   Se desactiva con REUNIONES_GOOGLE=no.
 * - Teams: por defecto la psicóloga pega el enlace a mano. Con REUNIONES_TEAMS=graph y un
 *   registro de aplicación en Entra ID, la reunión se crea con Microsoft Graph.
 *
 * Si el proveedor no está configurado o falla, la agenda se guarda igual y se devuelve un aviso.
 *
 * Interfaz de cada proveedor:
 *   guardarEvento({ eventoId, titulo, descripcion, fecha, hora }) → { eventoId, enlace }
 *   cancelarEvento(eventoId)
 */
const path = require('path');
const { ReunionesGoogle } = require('./google');
const { ReunionesGraph } = require('./graph');
const { leerRefreshToken } = require('../almacenamiento/drive');
const { validarEnlaceReunion } = require('./comun');

const TOKEN_GOOGLE_POR_DEFECTO = path.join(__dirname, '..', '..', '.gdrive-token.json');
const MODALIDAD_MEET = 'Google Meet';
const MODALIDAD_TEAMS = 'Teams';

/** Arma los proveedores según el entorno. Un proveedor mal configurado queda nulo con su motivo. */
function crearReuniones(entorno = process.env) {
  const reuniones = { google: null, teams: null, motivos: {} };

  if ((entorno.REUNIONES_GOOGLE || '').toLowerCase() === 'no') {
    reuniones.motivos.google = 'La creación de reuniones de Google Meet está desactivada (REUNIONES_GOOGLE=no).';
  } else if ((entorno.GDRIVE_MODO || 'oauth').toLowerCase() !== 'oauth') {
    reuniones.motivos.google = 'Google Meet requiere una cuenta de Google autorizada (GDRIVE_MODO=oauth).';
  } else {
    try {
      reuniones.google = new ReunionesGoogle({
        clientId: entorno.GDRIVE_CLIENT_ID,
        clientSecret: entorno.GDRIVE_CLIENT_SECRET,
        refreshToken:
          entorno.GDRIVE_REFRESH_TOKEN || leerRefreshToken(entorno.GDRIVE_TOKEN_ARCHIVO || TOKEN_GOOGLE_POR_DEFECTO),
        calendarioId: entorno.REUNIONES_CALENDARIO_ID || 'primary',
      });
    } catch (error) {
      reuniones.motivos.google = `Google Meet no está configurado: ${error.message}`;
    }
  }

  if ((entorno.REUNIONES_TEAMS || '').toLowerCase() === 'graph') {
    try {
      reuniones.teams = new ReunionesGraph({
        tenantId: entorno.GRAPH_TENANT_ID,
        clientId: entorno.GRAPH_CLIENT_ID,
        clientSecret: entorno.GRAPH_CLIENT_SECRET,
        usuario: entorno.GRAPH_REUNIONES_USUARIO,
      });
    } catch (error) {
      reuniones.motivos.teams = `Teams con Microsoft Graph no está configurado: ${error.message}`;
    }
  }
  return reuniones;
}

let instancia = null;

function obtenerReuniones() {
  instancia ??= crearReuniones();
  return instancia;
}

/** Permite a las pruebas inyectar proveedores simulados ({ google, teams, motivos }). */
function establecerReuniones(reuniones) {
  instancia = reuniones ? { google: null, teams: null, motivos: {}, ...reuniones } : null;
}

const proveedorDe = (reuniones, nombre) => (nombre === 'google' ? reuniones.google : nombre === 'graph' ? reuniones.teams : null);

/** Cancela el evento guardado de una solicitud. Devuelve un aviso si no se pudo (nunca lanza). */
async function cancelarReunion(actual, reuniones = obtenerReuniones()) {
  if (!actual.evento_reunion_id || !actual.proveedor_reunion) return null;
  const proveedor = proveedorDe(reuniones, actual.proveedor_reunion);
  if (!proveedor) return 'No se pudo cancelar el evento del calendario: el proveedor ya no está configurado. Bórrelo a mano.';
  try {
    await proveedor.cancelarEvento(actual.evento_reunion_id);
    return null;
  } catch (error) {
    console.error(`⚠️  No se pudo cancelar la reunión de la solicitud #${actual.id}:`, error.message);
    return `No se pudo cancelar el evento del calendario: ${error.message}`;
  }
}

/**
 * Decide el enlace de la reunión al mover la solicitud en el Planner.
 * @param {object} p
 * @param {object} p.actual       fila actual de la solicitud
 * @param {string} p.etapa        etapa destino
 * @param {object} p.agenda       { fecha, hora, modalidad } ya resuelta
 * @param {boolean} p.agendando   el cuerpo trae datos de agenda (agendar o reagendar)
 * @param {string|undefined} p.enlacePegado enlace pegado a mano (ya validado) o undefined
 * @param {string} p.titulo       título del evento
 * @param {string} p.descripcion  descripción del evento
 * @returns {Promise<{ enlace, eventoId, proveedor, aviso }>}
 */
async function sincronizarReunion(
  { actual, etapa, agenda, agendando, enlacePegado, titulo, descripcion },
  reuniones = obtenerReuniones(),
) {
  const previo = {
    enlace: actual.enlace_reunion ?? '',
    eventoId: actual.evento_reunion_id ?? '',
    proveedor: actual.proveedor_reunion ?? '',
  };
  const avisos = [];
  const resultado = (datos) => ({ ...datos, aviso: avisos.filter(Boolean).join(' ') || null });

  // Volver a "recibida": la entrevista queda por coordinar y su evento se cancela.
  if (etapa === 'recibida') {
    avisos.push(await cancelarReunion(actual, reuniones));
    return resultado({ enlace: '', eventoId: '', proveedor: '' });
  }
  // Marcar como realizada (u otro movimiento sin agenda): la reunión no cambia.
  if (!agendando) return resultado(previo);

  let destino = '';
  if (agenda.modalidad === MODALIDAD_MEET) destino = 'google';
  else if (agenda.modalidad === MODALIDAD_TEAMS && reuniones.teams && !enlacePegado) destino = 'graph';

  // Cambió de proveedor (p. ej. de Google Meet a Presencial): el evento anterior se cancela.
  if (previo.proveedor && previo.proveedor !== destino) {
    avisos.push(await cancelarReunion(actual, reuniones));
    previo.eventoId = '';
    previo.proveedor = '';
  }

  if (destino) {
    const proveedor = proveedorDe(reuniones, destino);
    if (!proveedor) {
      const motivo = destino === 'google' ? reuniones.motivos.google : reuniones.motivos.teams;
      avisos.push(`La entrevista se agendó, pero no se creó el enlace de la reunión. ${motivo ?? ''}`.trim());
      return resultado({ enlace: enlacePegado ?? '', eventoId: '', proveedor: '' });
    }
    try {
      const evento = await proveedor.guardarEvento({
        eventoId: previo.proveedor === destino ? previo.eventoId : null,
        titulo,
        descripcion,
        fecha: agenda.fecha,
        hora: agenda.hora,
      });
      return resultado({ enlace: evento.enlace, eventoId: evento.eventoId, proveedor: destino });
    } catch (error) {
      console.error(`⚠️  No se pudo crear la reunión de la solicitud #${actual.id}:`, error.message);
      avisos.push(`La entrevista se agendó, pero no se pudo crear o actualizar la reunión: ${error.message}`);
      // Si ya había un evento de este proveedor se conserva su enlace (con la hora anterior).
      return resultado(previo.proveedor === destino ? previo : { enlace: enlacePegado ?? '', eventoId: '', proveedor: '' });
    }
  }

  if (agenda.modalidad === MODALIDAD_TEAMS) {
    // Teams a mano: el enlace pegado; sin enviar, se mantiene el anterior si ya era Teams.
    const anterior = actual.modalidad_entrevista === MODALIDAD_TEAMS ? previo.enlace : '';
    return resultado({ enlace: enlacePegado ?? anterior, eventoId: '', proveedor: '' });
  }
  // Presencial o telefónica: sin enlace.
  return resultado({ enlace: '', eventoId: '', proveedor: '' });
}

module.exports = {
  MODALIDAD_MEET,
  MODALIDAD_TEAMS,
  cancelarReunion,
  crearReuniones,
  establecerReuniones,
  obtenerReuniones,
  sincronizarReunion,
  validarEnlaceReunion,
};
