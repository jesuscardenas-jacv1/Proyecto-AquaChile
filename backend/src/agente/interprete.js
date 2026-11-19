/**
 * Intérprete local de Marea: entiende el mensaje con reglas de palabras clave, sin IA.
 * Es gratis, no necesita claves ni servicios externos y responde siempre igual (fácil de probar).
 *
 * Devuelve { intencion, parametros } con los mismos nombres que usan las herramientas.
 * La persona y el cargo no se adivinan aquí: se pasa el texto y cada herramienta los busca entre
 * los datos que el usuario puede ver.
 */
const { normalizar, rutEnTexto } = require('./identidad');
const { sumarDias } = require('./horarios');

/** Reglas en orden de prioridad: la primera que calza decide la intención. */
const REGLAS = [
  ['guia_entrevista', /\bguia\b|\bpreguntas?\b|que le pregunto/],
  ['reagendar', /\breagend|\bcambi\w* (la )?hora|\bmover (la )?entrevista|\bpostergar/],
  ['ranking_cargo', /\branking\b|\bordena\w*|\bmejores postulantes|\bpostulantes (a|de|para)\b/],
  ['analizar_candidato', /\banaliz\w*|\banalisis\b|\bajuste\b|\bcv\b|\bcurriculum/],
  ['agendar', /\bagend\w*|\bcita\b|\bhora para\b|\bbusca\w* (una )?hora/],
  ['redactar_oferta', /\boferta\b|\bredact\w*/],
  ['avisos', /\bavisos?\b|\bnotificacion\w*|\bnovedad\w*|\bcampana\b/],
  ['resumen_solicitud', /\bresum\w*|\bestado\b|\bcomo va\b|\ben que va\b/],
  ['listar_solicitudes', /\bsolicitudes\b|\bpendientes\b|\bmis casos\b/],
  ['ayuda', /^(hola|buen[oa]s?|ayuda|que (puedes|sabes) hacer)\b|\bayuda\b/],
];

const MODALIDADES = [
  ['Google Meet', /\bmeet\b|\bgoogle\b/],
  ['Teams', /\bteams\b/],
  ['Presencial', /\bpresencial\b/],
];

const dosDigitos = (n) => String(n).padStart(2, '0');

/** "15:30", "9.00" o "a las 10" → "HH:MM" (o ''). */
function horaEnTexto(texto) {
  const conMinutos = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/.exec(texto);
  if (conMinutos) return `${dosDigitos(conMinutos[1])}:${conMinutos[2]}`;
  const soloHora = /\ba las (\d{1,2})\b/.exec(texto);
  return soloHora && Number(soloHora[1]) < 24 ? `${dosDigitos(soloHora[1])}:00` : '';
}

/** "hoy", "mañana" o "20/11" / "20-11-2026" → yyyy-mm-dd (o ''). */
function fechaEnTexto(texto, hoy) {
  if (/\bpasado manana\b/.test(texto)) return sumarDias(hoy, 2);
  if (/\bmanana\b/.test(texto)) return sumarDias(hoy, 1);
  if (/\bhoy\b/.test(texto)) return hoy;
  const fecha = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b/.exec(texto);
  if (!fecha) return '';
  const [dia, mes, anio] = [Number(fecha[1]), Number(fecha[2]), fecha[3] ?? hoy.slice(0, 4)];
  return dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 ? `${anio}-${dosDigitos(mes)}-${dosDigitos(dia)}` : '';
}

/**
 * @param {string} mensaje lo que escribió el usuario
 * @param {string} hoy fecha de hoy en Chile (yyyy-mm-dd), para "hoy" y "mañana"
 */
function interpretar(mensaje, hoy) {
  const rut = rutEnTexto(mensaje);
  // Sin el RUT, para que sus números no se lean como fecha u hora.
  const texto = normalizar(mensaje.replace(rut, ' '));
  const intencion = REGLAS.find(([, regla]) => regla.test(texto))?.[0] ?? 'fuera_de_alcance';
  const solicitud = /\b(?:solicitud|s)\s*#?\s*(\d{1,6})\b|#(\d{1,6})\b/.exec(texto);

  return {
    intencion,
    parametros: {
      persona: mensaje,
      cargo: mensaje,
      rut,
      solicitudId: solicitud ? Number(solicitud[1] ?? solicitud[2]) : null,
      fecha: fechaEnTexto(texto, hoy),
      hora: horaEnTexto(texto),
      modalidad: MODALIDADES.find(([, regla]) => regla.test(texto))?.[0] ?? '',
      // "analiza y agenda a…": el análisis completo agrega las horas libres.
      tambienAgendar: intencion === 'analizar_candidato' && /\bagend\w*/.test(texto),
    },
  };
}

module.exports = { fechaEnTexto, horaEnTexto, interpretar };
