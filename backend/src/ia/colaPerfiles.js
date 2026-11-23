/**
 * Cola de extracción de perfiles: cuando llega un CV (del portal o subido a una solicitud), Gemini lo
 * lee en segundo plano, de a uno y con pausa. Persistente (tabla cola_perfiles): un reinicio retoma lo
 * pendiente. Sin clave o sobre el tope de gasto lo pendiente espera, no se pierde.
 * El portal es público, así que hay un máximo de CV por día (PERFILES_MAX_DIA, 100).
 * PERFILES_AUTOMATICOS=no apaga el encolado automático.
 */
const db = require('../bd/conexion');
const { emitir } = require('../tiempoReal');
const { geminiDisponible } = require('./gemini');
const { extraerYGuardar } = require('./perfil');
const { comoSistema } = require('./uso');

const NOMBRE_SISTEMA = 'Base de conocimiento';
const INTENTOS = 3;
const ESPERAS_REINTENTO_MIN = [5, 30];
const ESPERA_SIN_GEMINI_MS = 10 * 60 * 1000;

const pausaMs = () => {
  const segundos = Number(process.env.PERFILES_PAUSA_S);
  return (Number.isFinite(segundos) && segundos >= 0 ? segundos : 5) * 1000;
};
const maximoDia = () => {
  const valor = Number(process.env.PERFILES_MAX_DIA);
  return Number.isFinite(valor) && valor > 0 ? valor : 100;
};
const leidosHoy = () =>
  db.prepare("SELECT COUNT(*) AS total FROM uso_ia WHERE tarea = 'perfilCandidato' AND creado_en >= datetime('now', '-1 day')").get().total;
const automatico = () => !['no', 'false', '0'].includes(String(process.env.PERFILES_AUTOMATICOS ?? '').toLowerCase());

let extractor = extraerYGuardar;
let pausadaHasta = 0;

/** Para las pruebas: reemplaza la extracción (null vuelve a la real) y quita la pausa. */
function establecerExtractor(fn) {
  pausadaHasta = 0;
  extractor = fn ?? extraerYGuardar;
}

/** Pone al candidato en la cola (o lo vuelve a poner si subió otro CV) y despierta al proceso. */
function encolarPerfil({ candidatoId, postulacionId = null, solicitudId = null, forzar = false }) {
  if (!candidatoId || (!forzar && !automatico())) return false;
  db.prepare(
    `INSERT INTO cola_perfiles (candidato_id, postulacion_id, solicitud_id, turno)
     VALUES (?, ?, ?, (SELECT COALESCE(MAX(turno), 0) + 1 FROM cola_perfiles))
     ON CONFLICT(candidato_id) DO UPDATE SET postulacion_id = excluded.postulacion_id, solicitud_id = excluded.solicitud_id,
       estado = 'pendiente', turno = excluded.turno, intentos = 0, ultimo_error = '', proximo_intento = datetime('now'), terminado_en = NULL`,
  ).run(candidatoId, postulacionId, solicitudId);
  despertar();
  return true;
}

/** Postulantes con CV en el portal que aún no tienen perfil (para procesar los que ya existían). */
function encolarPendientes() {
  const filas = db
    .prepare(
      `SELECT p.candidato_id AS candidatoId, MAX(p.id) AS postulacionId FROM postulaciones p
       WHERE p.cv_nombre <> '' AND NOT EXISTS (SELECT 1 FROM perfiles_candidato f WHERE f.candidato_id = p.candidato_id)
         AND NOT EXISTS (SELECT 1 FROM cola_perfiles q WHERE q.candidato_id = p.candidato_id AND q.estado IN ('pendiente', 'procesando'))
       GROUP BY p.candidato_id`,
    )
    .all();
  filas.forEach((fila) => encolarPerfil({ ...fila, forzar: true }));
  return filas.length;
}

/** Procesa el siguiente: 'sin-gemini' | 'pausada' | 'limite' | 'vacia' | 'listo' | 'omitido' | 'reintento' | 'error'. */
async function procesarSiguiente() {
  if (!geminiDisponible()) return { estado: 'sin-gemini', esperaMs: ESPERA_SIN_GEMINI_MS };
  if (Date.now() < pausadaHasta) return { estado: 'pausada', esperaMs: pausadaHasta - Date.now() };
  if (leidosHoy() >= maximoDia()) return { estado: 'limite', esperaMs: 30 * 60 * 1000 };
  const trabajo = db
    .prepare("SELECT * FROM cola_perfiles WHERE estado = 'pendiente' AND proximo_intento <= datetime('now') ORDER BY turno LIMIT 1")
    .get();
  if (!trabajo) return { estado: 'vacia' };
  const id = trabajo.candidato_id;
  db.prepare("UPDATE cola_perfiles SET estado = 'procesando', intentos = intentos + 1 WHERE candidato_id = ?").run(id);
  // Si llegó otro CV mientras se leía este, la fila volvió a 'pendiente' con otro turno y no se toca.
  const terminar = (estado, error = '', espera = null) =>
    db
      .prepare(
        `UPDATE cola_perfiles SET estado = ?, ultimo_error = ?, proximo_intento = datetime('now', ?),
           terminado_en = CASE WHEN ? = 'pendiente' THEN NULL ELSE datetime('now') END
         WHERE candidato_id = ? AND turno = ? AND estado = 'procesando'`,
      )
      .run(estado, error, espera ?? '+0 minutes', estado, id, trabajo.turno);
  try {
    await comoSistema(NOMBRE_SISTEMA, () =>
      extractor({ candidatoId: id, postulacionId: trabajo.postulacion_id, solicitudId: trabajo.solicitud_id }),
    );
    terminar('listo');
    emitir('datos', { ruta: '/api/ia/perfiles' });
    return { estado: 'listo', id };
  } catch (error) {
    const status = error?.status ?? 500;
    const mensaje = String(error?.message ?? 'Error desconocido').slice(0, 300);
    if (status === 404) {
      terminar('omitido', mensaje);
      return { estado: 'omitido', id, mensaje };
    }
    if (status === 503 || status === 429) pausadaHasta = Date.now() + (status === 429 ? 2 : 15) * 60 * 1000;
    const intentos = trabajo.intentos + 1;
    // El documento no se puede leer (413, 415, 422): reintentar no cambia el resultado.
    if ([400, 413, 415, 422].includes(status) || intentos >= INTENTOS) {
      terminar('error', mensaje);
      return { estado: 'error', id, mensaje };
    }
    terminar('pendiente', mensaje, `+${ESPERAS_REINTENTO_MIN[Math.min(intentos - 1, ESPERAS_REINTENTO_MIN.length - 1)]} minutes`);
    return { estado: 'reintento', id, mensaje };
  }
}

const esperaProximo = () =>
  db
    .prepare("SELECT MAX(0, strftime('%s', MIN(proximo_intento)) - strftime('%s', 'now')) AS s FROM cola_perfiles WHERE estado = 'pendiente'")
    .get()?.s ?? null;

// --- Bucle del servidor ---------------------------------------------------------------
let temporizador = null;
let trabajando = false;
let iniciada = false;

function programar(ms) {
  clearTimeout(temporizador);
  temporizador = setTimeout(ciclo, Math.max(0, ms));
  temporizador.unref?.();
}

async function ciclo() {
  temporizador = null;
  trabajando = true;
  let siguienteMs = 60 * 1000;
  try {
    const resultado = await procesarSiguiente();
    if (resultado.mensaje) console.warn(`⚠️ Perfil del candidato #${resultado.id}: ${resultado.estado}.`, resultado.mensaje);
    if (resultado.esperaMs) siguienteMs = resultado.esperaMs;
    else {
      const espera = esperaProximo();
      siguienteMs = espera == null ? null : Math.max(pausaMs(), espera * 1000);
    }
  } catch (error) {
    console.error('❌ Cola de perfiles:', error.message);
  } finally {
    trabajando = false;
  }
  if (siguienteMs != null) programar(siguienteMs);
}

function despertar() {
  if (iniciada && !trabajando && !temporizador) programar(0);
}

/** Arranca el bucle (desde servidor.js). Lo que quedó «procesando» por un reinicio vuelve a la cola. */
function iniciarColaPerfiles() {
  if (iniciada) return;
  iniciada = true;
  db.prepare("UPDATE cola_perfiles SET estado = 'pendiente' WHERE estado = 'procesando'").run();
  programar(8 * 1000);
}

module.exports = { encolarPendientes, encolarPerfil, establecerExtractor, iniciarColaPerfiles, procesarSiguiente };
