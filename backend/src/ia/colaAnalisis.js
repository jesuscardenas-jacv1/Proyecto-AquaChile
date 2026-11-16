/**
 * Cola del análisis automático del CV con IA.
 *
 * Cuando un postulante sube su CV desde el portal, la postulación entra a esta cola y un
 * proceso del servidor la analiza contra el descriptor del cargo. Cada análisis tiene costo,
 * así que la cola se protege de las ráfagas (p. ej. 100 postulaciones en una hora):
 *
 * - Procesa de a UNA postulación por vez, con una pausa entre análisis (IA_COLA_PAUSA_S, 30 s).
 * - Máximo de análisis por hora (IA_COLA_MAX_HORA, 20) y por día (IA_COLA_MAX_DIA, 100). Al
 *   llegar al tope espera a que se libere cupo; lo pendiente no se pierde.
 * - Reintenta hasta IA_COLA_INTENTOS veces (3) con espera creciente (5 min, 30 min…) ante fallos
 *   transitorios. Si no hay CV o la postulación está descartada, la omite. Si la IA devuelve
 *   «demasiadas solicitudes» o no hay clave, pausa toda la cola un rato en vez de insistir.
 * - Persistente en la BD (tabla cola_analisis_cv): un reinicio retoma lo pendiente.
 * - Se apaga con IA_ANALISIS_AUTOMATICO=no (queda el botón manual «Analizar CV»).
 */
const db = require('../bd/conexion');
const { iaDisponible } = require('./cliente');
const { analizarYGuardar } = require('./analisisPostulacion');
const { comoSistema } = require('./uso');
const { emitir } = require('../tiempoReal');

const NOMBRE_SISTEMA = 'Análisis automático';
const ESPERAS_REINTENTO_MIN = [5, 30, 120];

const numero = (variable, porDefecto) => {
  const valor = Number(process.env[variable]);
  return Number.isFinite(valor) && valor >= 0 ? valor : porDefecto;
};

/** Configuración vigente (se lee en cada uso para poder ajustarla sin cambiar código). */
function configuracionCola() {
  return {
    activa: !['no', 'false', '0'].includes(String(process.env.IA_ANALISIS_AUTOMATICO ?? '').toLowerCase()),
    pausaMs: numero('IA_COLA_PAUSA_S', 30) * 1000,
    maxHora: numero('IA_COLA_MAX_HORA', 20),
    maxDia: numero('IA_COLA_MAX_DIA', 100),
    intentos: Math.max(1, numero('IA_COLA_INTENTOS', 3)),
  };
}

let analizador = (id) => analizarYGuardar(id, { creadoPor: NOMBRE_SISTEMA });
let pausadaHasta = 0;

/** Para las pruebas: reemplaza la función que analiza (null vuelve a la real) y quita la pausa. */
function establecerAnalizador(fn) {
  pausadaHasta = 0;
  analizador = fn ?? ((id) => analizarYGuardar(id, { creadoPor: NOMBRE_SISTEMA }));
}

/** Agrega (o vuelve a poner) una postulación en la cola y despierta al proceso. */
function encolar(postulacionId) {
  if (!configuracionCola().activa) return false;
  db.prepare(
    `INSERT INTO cola_analisis_cv (postulacion_id, turno)
     VALUES (?, (SELECT COALESCE(MAX(turno), 0) + 1 FROM cola_analisis_cv))
     ON CONFLICT(postulacion_id) DO UPDATE SET
       estado = 'pendiente', turno = excluded.turno, intentos = 0, ultimo_error = '', proximo_intento = datetime('now'), terminado_en = NULL
     WHERE estado <> 'procesando'`,
  ).run(postulacionId);
  despertar();
  return true;
}

const contarDesde = (modificador) =>
  db.prepare(`SELECT COUNT(*) AS total FROM cola_analisis_cv WHERE iniciado_en >= datetime('now', ?)`).get(modificador)
    .total;

/** Cuántos segundos faltan para que haya cupo, o 0 si se puede analizar ahora. */
function esperaPorCupo({ maxHora, maxDia }) {
  const esperaDe = (maximo, modificador) => {
    if (contarDesde(modificador) < maximo) return 0;
    // El cupo se libera cuando el análisis más antiguo de la ventana sale de ella.
    const { segundos } = db
      .prepare(
        `SELECT CAST(strftime('%s', iniciado_en, ?) - strftime('%s', 'now') AS INTEGER) + 1 AS segundos
         FROM cola_analisis_cv WHERE iniciado_en >= datetime('now', ?) ORDER BY iniciado_en DESC LIMIT 1 OFFSET ?`,
      )
      .get(modificador.replace('-', '+'), modificador, maximo - 1);
    return Math.max(1, segundos ?? 60);
  };
  return Math.max(esperaDe(maxHora, '-1 hour'), esperaDe(maxDia, '-1 day'));
}

/**
 * Procesa la siguiente postulación pendiente, si los límites lo permiten.
 * Devuelve { estado, ... } para el bucle y las pruebas:
 * 'apagada' | 'sin-ia' | 'pausada' | 'limite' | 'vacia' | 'listo' | 'omitido' | 'reintento' | 'error'.
 */
async function procesarSiguiente() {
  const config = configuracionCola();
  if (!config.activa) return { estado: 'apagada' };
  if (!iaDisponible()) return { estado: 'sin-ia', esperaMs: 10 * 60 * 1000 };
  if (Date.now() < pausadaHasta) return { estado: 'pausada', esperaMs: pausadaHasta - Date.now() };
  const esperaCupo = esperaPorCupo(config);
  if (esperaCupo > 0) return { estado: 'limite', esperaMs: esperaCupo * 1000 };

  const trabajo = db
    .prepare(
      `SELECT c.*, p.estado AS estado_postulacion FROM cola_analisis_cv c JOIN postulaciones p ON p.id = c.postulacion_id
       WHERE c.estado = 'pendiente' AND c.proximo_intento <= datetime('now')
       ORDER BY c.proximo_intento, c.turno LIMIT 1`,
    )
    .get();
  if (!trabajo) return { estado: 'vacia' };
  const id = trabajo.postulacion_id;

  const terminar = (estado, error = '') =>
    db
      .prepare(
        `UPDATE cola_analisis_cv SET estado = ?, ultimo_error = ?, terminado_en = datetime('now') WHERE postulacion_id = ?`,
      )
      .run(estado, error, id);

  const yaAnalizada = db.prepare('SELECT 1 FROM analisis_cv WHERE postulacion_id = ?').get(id);
  if (trabajo.estado_postulacion === 'Descartada' || yaAnalizada) {
    terminar(yaAnalizada ? 'listo' : 'omitido', yaAnalizada ? '' : 'Postulación descartada.');
    return { estado: yaAnalizada ? 'listo' : 'omitido', id };
  }

  db.prepare(
    `UPDATE cola_analisis_cv SET estado = 'procesando', intentos = intentos + 1, iniciado_en = datetime('now')
     WHERE postulacion_id = ?`,
  ).run(id);
  try {
    await comoSistema(NOMBRE_SISTEMA, () => analizador(id));
    terminar('listo');
    // La bandeja de postulaciones muestra el porcentaje: que se actualice en las pantallas abiertas.
    emitir('datos', { ruta: '/api/ia/cola' });
    return { estado: 'listo', id };
  } catch (error) {
    const status = error?.status ?? 500;
    const mensaje = String(error?.message ?? 'Error desconocido').slice(0, 300);
    if (status === 404) {
      terminar('omitido', mensaje);
      return { estado: 'omitido', id };
    }
    // Clave inválida o sin IA (503) o demasiadas solicitudes (429): se pausa toda la cola.
    if (status === 503 || status === 429) pausadaHasta = Date.now() + (status === 429 ? 2 : 15) * 60 * 1000;
    const intentos = trabajo.intentos + 1;
    // 422: el documento no se puede procesar; reintentar no cambia el resultado.
    if (status === 422 || intentos >= config.intentos) {
      terminar('error', mensaje);
      emitir('datos', { ruta: '/api/ia/cola' });
      return { estado: 'error', id, mensaje };
    }
    const minutos = ESPERAS_REINTENTO_MIN[Math.min(intentos - 1, ESPERAS_REINTENTO_MIN.length - 1)];
    db.prepare(
      `UPDATE cola_analisis_cv SET estado = 'pendiente', ultimo_error = ?, proximo_intento = datetime('now', ?)
       WHERE postulacion_id = ?`,
    ).run(mensaje, `+${minutos} minutes`, id);
    return { estado: 'reintento', id, mensaje };
  }
}

/** Segundos hasta el próximo reintento programado (para dormir hasta entonces). */
function esperaProximoPendiente() {
  const fila = db
    .prepare(
      `SELECT MAX(0, strftime('%s', MIN(proximo_intento)) - strftime('%s', 'now')) AS segundos
       FROM cola_analisis_cv WHERE estado = 'pendiente'`,
    )
    .get();
  return fila?.segundos == null ? null : fila.segundos * 1000;
}

// --- Bucle del servidor ---------------------------------------------------------------
let temporizador = null; // null: dormido sin plazo, hasta que `encolar` lo despierte
let trabajando = false;
let avisoPendiente = false;
let iniciada = false;

function programar(ms) {
  clearTimeout(temporizador);
  temporizador = setTimeout(ciclo, Math.max(0, ms));
  temporizador.unref?.();
}

async function ciclo() {
  temporizador = null;
  trabajando = true;
  avisoPendiente = false;
  let siguienteMs = null;
  try {
    const resultado = await procesarSiguiente();
    if (['listo', 'omitido', 'reintento', 'error'].includes(resultado.estado)) {
      if (resultado.estado !== 'listo') {
        console.warn(`⚠️ Análisis automático P${resultado.id}: ${resultado.estado}`, resultado.mensaje ?? '');
      }
      siguienteMs = configuracionCola().pausaMs;
    } else if (resultado.esperaMs) {
      siguienteMs = resultado.esperaMs;
    } else if (resultado.estado === 'vacia') {
      siguienteMs = esperaProximoPendiente();
    }
  } catch (error) {
    console.error('❌ Cola de análisis automático:', error.message);
    siguienteMs = 60 * 1000;
  } finally {
    trabajando = false;
  }
  // Llegó una postulación mientras analizaba y la cola había quedado vacía: se revisa tras la pausa.
  if (siguienteMs == null && avisoPendiente) siguienteMs = configuracionCola().pausaMs;
  if (siguienteMs != null) programar(siguienteMs);
}

/** Despierta el bucle si dormía sin plazo. No adelanta pausas, reintentos ni límites ya programados. */
function despertar() {
  if (!iniciada) return;
  if (trabajando) avisoPendiente = true;
  else if (!temporizador) programar(0);
}

/** Arranca el bucle (desde servidor.js). Lo que quedó «procesando» por un reinicio vuelve a la cola. */
function iniciarCola() {
  if (iniciada) return;
  iniciada = true;
  db.prepare(`UPDATE cola_analisis_cv SET estado = 'pendiente' WHERE estado = 'procesando'`).run();
  programar(5 * 1000);
}

module.exports = {
  NOMBRE_SISTEMA,
  configuracionCola,
  encolar,
  establecerAnalizador,
  iniciarCola,
  procesarSiguiente,
};
