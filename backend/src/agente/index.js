/**
 * Marea: agente de reclutamiento. Enrutador de intenciones con herramientas deterministas, no un chat libre.
 *
 *   1. Interpreta: con `accion` (chips y botones) se usa tal cual; con texto, el intérprete local de
 *      palabras clave (interprete.js) elige la intención. No se llama a ningún servicio de IA: es gratis.
 *   2. Valida el rol del usuario contra la herramienta (RBAC en el backend, no solo en la pantalla).
 *   3. Ejecuta la herramienta y arma { texto, tarjetas, opciones, foco }.
 *
 * `foco` es la memoria corta que guarda el frontend: de quién se habla y si su RUT ya se confirmó.
 */
const { interpretar } = require('./interprete');
const { ahoraEnChile } = require('./horarios');
const { rutEnTexto } = require('./identidad');
const { frase } = require('./frases');
const { HERRAMIENTAS, opcionesDelRol, puedeUsar } = require('./herramientas');

const LARGO_MAXIMO_MENSAJE = 1000;

const texto = (valor, maximo = 200) => (typeof valor === 'string' ? valor.trim().slice(0, maximo) : '');
const numero = (valor) => (Number.isInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : null);

/** El foco viene del navegador: se deja solo lo que se usa, con su tipo. */
function limpiarFoco(foco) {
  if (!foco || typeof foco !== 'object') return null;
  const limpio = {
    candidatoId: numero(foco.candidatoId),
    solicitudId: numero(foco.solicitudId),
    nombre: texto(foco.nombre),
    verificado: foco.verificado === true,
  };
  if (foco.pendiente === 'rut') {
    limpio.pendiente = 'rut';
    limpio.intencion = HERRAMIENTAS[foco.intencion] ? foco.intencion : 'agendar';
  }
  return limpio.candidatoId || limpio.solicitudId ? limpio : null;
}

/** Parámetros de una herramienta (de la IA o de un botón), con su tipo. */
function limpiarParametros(datos = {}) {
  return {
    solicitudId: numero(datos.solicitudId),
    candidatoId: numero(datos.candidatoId),
    postulacionId: numero(datos.postulacionId),
    persona: texto(datos.persona, LARGO_MAXIMO_MENSAJE),
    rut: texto(datos.rut, 20),
    cargo: texto(datos.cargo, LARGO_MAXIMO_MENSAJE),
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) ? datos.fecha : '',
    hora: /^([01]\d|2[0-3]):[0-5]\d$/.test(datos.hora) ? datos.hora : '',
    desde: /^\d{4}-\d{2}-\d{2}$/.test(datos.desde) ? datos.desde : '',
    modalidad: texto(datos.modalidad, 30),
    tambienAgendar: datos.tambienAgendar === true,
  };
}

const sinPermiso = (usuario, tipo) => ({
  texto:
    usuario.rol === 'analista' && ['agendar', 'reagendar'].includes(tipo)
      ? frase(usuario.id, 'agendaEsDePsicologa')
      : frase(usuario.id, 'fueraDeRol', { funcion: HERRAMIENTAS[tipo]?.nombre ?? 'Eso' }),
  tarjetas: [],
  opciones: opcionesDelRol(usuario.rol),
});

/**
 * Atiende un mensaje (o un botón) de Marea.
 * @param {{ usuario: { id, nombre, rol }, mensaje?: string, foco?: object, accion?: object, ahora?: Date }} entrada
 * @returns {Promise<{ texto, tarjetas, opciones, foco, cambioDatos? }>}
 */
async function procesarMensaje({ usuario, mensaje = '', foco: focoEntrada = null, accion = null, ahora = new Date() }) {
  const foco = limpiarFoco(focoEntrada);
  const escrito = texto(mensaje, LARGO_MAXIMO_MENSAJE);
  let tipo;
  let parametros;
  let origen = 'texto';

  if (accion && typeof accion === 'object') {
    // Atajo sin IA: un chip, una hora o «Confirmar».
    tipo = accion.tipo;
    parametros = limpiarParametros(accion);
    origen = 'accion';
  } else if (foco?.pendiente === 'rut' && rutEnTexto(escrito)) {
    // Respondió con el RUT que se le pidió: se sigue con lo que estaba haciendo, sin IA.
    tipo = foco.intencion;
    parametros = limpiarParametros({ rut: rutEnTexto(escrito) });
  } else {
    if (!escrito) return { texto: frase(usuario.id, 'ayuda'), tarjetas: [], opciones: opcionesDelRol(usuario.rol), foco };
    const { intencion, parametros: interpretados } = interpretar(escrito, ahoraEnChile(ahora).fecha);
    if (!HERRAMIENTAS[intencion]) {
      return { texto: frase(usuario.id, intencion === 'ayuda' ? 'ayuda' : 'noEntiende'), tarjetas: [], opciones: opcionesDelRol(usuario.rol), foco };
    }
    tipo = intencion;
    parametros = limpiarParametros(interpretados);
  }

  if (!HERRAMIENTAS[tipo]) return { texto: frase(usuario.id, 'noEntiende'), tarjetas: [], opciones: opcionesDelRol(usuario.rol), foco };
  if (!puedeUsar(usuario.rol, tipo)) return { ...sinPermiso(usuario, tipo), foco };

  const resultado = await HERRAMIENTAS[tipo].ejecutar({ usuario, parametros, foco, origen, mensaje: escrito, ahora });
  // Si la herramienta pidió el RUT, se recuerda qué se estaba haciendo para retomarlo.
  const nuevoFoco = resultado.foco?.pendiente === 'rut' ? { ...resultado.foco, intencion: tipo } : (resultado.foco ?? foco);
  return { ...resultado, foco: nuevoFoco };
}

module.exports = { limpiarFoco, limpiarParametros, procesarMensaje };
