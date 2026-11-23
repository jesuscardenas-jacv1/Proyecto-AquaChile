/**
 * Paso 1 de Marea: entender un mensaje escrito. Como máximo UNA llamada a Gemini por mensaje.
 *
 * - Gemini solo elige una herramienta del rol y propone parámetros: no ve la base de datos, no escribe
 *   y no redacta la respuesta. Antes de enviarle el mensaje se quitan RUT, correos y teléfonos.
 * - Si no hay clave, se llegó al tope de gasto, falla o no entiende, responde el intérprete local.
 * - La persona se busca siempre en el mensaje original (así no se usa el foco por error) y el RUT lo lee
 *   el intérprete local: nunca sale del servidor.
 */
const { configuracionDe } = require('../ia/configuracion');
const { TAREAS } = require('../ia/catalogo');
const { elegirHerramienta, geminiDisponible } = require('../ia/gemini');
const { comoUsuario } = require('../ia/uso');
const { funcionesDelRol } = require('./declaraciones');
const { normalizar } = require('./identidad');
const { interpretar } = require('./interprete');

const DEL_LOCAL = ['ayuda'];
const PARAMETROS_IA = ['solicitudId', 'cargo', 'fecha', 'hora', 'modalidad', 'desde', 'ciudad', 'habilidades', 'estado', 'textoLibre', 'agruparPor', 'tipoEvento', 'tambienAgendar'];

const CON_CARGO_EN_MENSAJE = ['ranking_cargo', 'redactar_oferta'];
const BUSQUEDAS = ['buscar_candidatos', 'estadisticas'];
/** Filtros que discriminan: no se busca por ellos, ni con IA ni sin ella. */
const DATO_SENSIBLE =
  /\b(edad|jovenes|joven|viej[oa]s?|(mayor|menor)(es)? de \d+( anos)?(?! de experiencia)|mujer(es)?|hombres?|varon(es)?|solter[oa]s?|casad[oa]s?|divorciad[oa]s?|embaraz\w*|(con|sin) hij[oa]s|nacionalidad|extranjer[oa]s?|chilen[oa]s?|venezolan[oa]s?|haitian[oa]s?|religi\w+|evangelic[oa]s?|catolic[oa]s?|discapacidad|enferm[oa]s?|genero|sexo)\b/;

/** El mensaje sin datos de contacto ni RUT: lo único que se envía a Gemini. */
const sinDatosPersonales = (mensaje) =>
  mensaje
    .replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, '[correo]')
    .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g, '[RUT]')
    .replace(/\+?\d(?:[\s-]?\d){8,}/g, '[teléfono]');

/** @returns {Promise<{ intencion, parametros, origen: 'local' | 'gemini' }>} */
async function entender(entrada) {
  const resultado = await interpretarMensaje(entrada);
  return BUSQUEDAS.includes(resultado.intencion) && DATO_SENSIBLE.test(normalizar(entrada.mensaje))
    ? { ...resultado, intencion: 'dato_sensible', parametros: {} }
    : resultado;
}

async function interpretarMensaje({ mensaje, usuario, hoy }) {
  const local = interpretar(mensaje, hoy);
  if (DEL_LOCAL.includes(local.intencion) || !geminiDisponible()) return { ...local, origen: 'local' };

  try {
    const base = TAREAS.agenteMarea;
    const config = configuracionDe('agenteMarea');
    const { nombre, argumentos } = await comoUsuario(usuario, () =>
      elegirHerramienta({
        tarea: 'agenteMarea',
        sistema: `${base.sistema}\n${config.indicaciones}\n${base.limites}\nHoy es ${hoy}.`,
        mensaje: sinDatosPersonales(mensaje),
        funciones: funcionesDelRol(usuario.rol),
        esfuerzo: config.esfuerzo,
        modelo: config.modelo || undefined,
      }),
    );
    if (!nombre) return { ...local, origen: 'local' };
    if (nombre === 'fuera_de_alcance') return respaldoSeguro(local);
    const propuestos = Object.fromEntries(PARAMETROS_IA.filter((campo) => argumentos[campo] !== undefined).map((campo) => [campo, argumentos[campo]]));
    return {
      intencion: nombre,
      // `persona` y `rut` salen del mensaje original; los filtros, solo de lo que propuso Gemini.
      parametros: { persona: mensaje, rut: local.parametros.rut, cargo: CON_CARGO_EN_MENSAJE.includes(nombre) ? mensaje : '', ...propuestos },
      origen: 'gemini',
    };
  } catch (error) {
    console.warn('⚠️ Marea usa el intérprete local:', error.message);
    return { ...local, origen: 'local' };
  }
}

/**
 * Gemini dijo «fuera de alcance». Se respeta para las búsquedas (pudo ser un filtro por un dato sensible);
 * para lo demás decide el intérprete local, que además sabe explicar lo que no está entre los permisos.
 */
const respaldoSeguro = (local) =>
  BUSQUEDAS.includes(local.intencion) ? { intencion: 'fuera_de_alcance', parametros: {}, origen: 'gemini' } : { ...local, origen: 'local' };

module.exports = { entender, sinDatosPersonales };
