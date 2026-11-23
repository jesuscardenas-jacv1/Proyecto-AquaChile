/**
 * Banco de frases de Marea (docs/marea/marea-cerebro.md, sección 6). Cada intención tiene
 * varias variantes y nunca se repite la última usada con el mismo usuario.
 * Las variables van entre llaves: "¿Seguimos con {nombre}?".
 */
const FRASES = {
  entrarAgenda: [
    'Agendemos. ¿A quién entrevistas?',
    'Busquemos una hora. ¿Para quién?',
    'Vamos con la agenda. Elige a la persona o escribe su nombre y RUT.',
  ],
  seguirCon: ['¿Seguimos con {nombre}?', '¿Es para {nombre}, o para otra persona?'],
  noEncuentra: [
    'No la encuentro entre tus solicitudes. ¿Es alguna de estas?',
    'No aparece en tus solicitudes. Te dejo las más recientes:',
  ],
  variasCoinciden: ['Encontré a más de una persona con ese nombre. ¿Cuál es?', 'Hay varias coincidencias. Elige a quién te refieres:'],
  pideRut: [
    'Encontré a {nombre}. Solo me falta su RUT para estar seguros.',
    'Es {nombre}, ¿cierto? Escríbeme su RUT para confirmar.',
  ],
  rutInvalido: ['Ese RUT ({rut}) no es válido. Puede ser un dígito cambiado.', 'El RUT {rut} no cuadra con su dígito verificador. Revísalo, por favor.'],
  rutDistinto: [
    'Ese RUT no coincide con el de {nombre} en la solicitud. Revísalo, por favor.',
    'El RUT no corresponde a {nombre}. ¿Lo revisamos?',
  ],
  horasLibres: ['Te dejo los espacios disponibles para {nombre}:', 'Estas horas están libres para {nombre}:'],
  horasOtroDia: ['Hoy ya no quedan horas. El {dia} sí hay espacio para {nombre}:', 'Para hoy no hay espacio. El {dia} quedan estas horas para {nombre}:'],
  sinHoras: ['No encontré horas libres en los próximos 15 días.', 'Tu agenda está llena en los próximos 15 días.'],
  confirmar: ['Revisa los datos y confirma:', '¿Lo dejo así? Confirma para guardarlo:'],
  agendado: ['Listo, la entrevista de {nombre} quedó agendada.', 'Hecho. La entrevista con {nombre} ya está en tu agenda.'],
  horaTomada: ['Esa hora se acaba de ocupar. Te muestro las que siguen libres:', 'Alguien tomó esa hora recién. Elige otra:'],
  analisis: [
    'Analicé a {nombre}. Su mayor ajuste es {cargo}, con {porcentaje}% de los requisitos.',
    'Revisé el CV de {nombre}: el mayor ajuste es {cargo} ({porcentaje}% de los requisitos).',
  ],
  sinAnalisis: ['{nombre} aún no tiene un análisis de CV.', 'No encontré un análisis del CV de {nombre}.'],
  resumen: ['Así va la solicitud de {nombre}:', 'Este es el estado de {nombre}:'],
  guia: ['Te preparé la guía para entrevistar a {nombre}:', 'Para la entrevista con {nombre}, revisaría esto:'],
  ranking: ['Así quedan los postulantes a {cargo}, por % de requisitos:', 'Postulantes a {cargo}, de mayor a menor ajuste:'],
  oferta: ['Te dejo un borrador para {cargo}. Revísalo antes de publicarlo:', 'Borrador de la oferta de {cargo}, listo para revisar:'],
  listado: ['Estas son tus solicitudes más recientes:', 'Te muestro las últimas solicitudes:'],
  avisos: ['Tienes {total} avisos nuevos:', 'Llegaron {total} avisos:'],
  datoSensible: ['No busco por datos personales como edad, género o nacionalidad. Puedo ayudarte con esto:', 'Ese dato no se usa para seleccionar personas. Prueba con una ciudad, una habilidad o un cargo:'],
  candidatos: ['Encontré', 'Calzan'],
  sinCandidatos: ['No encontré a nadie que cumpla todo', 'Nadie calza con esa búsqueda'],
  perfil: ['Este es el perfil de {nombre}, según su CV:', 'Esto dice el CV de {nombre}:'],
  sinPerfil: ['Aún no tengo leído el CV de {nombre}.', '{nombre} todavía no tiene su perfil en la base de conocimiento.'],
  actividad: ['Esto es lo último que pasó:', 'Así viene la actividad reciente:'],
  sinActividad: ['No hay actividad registrada en ese período.', 'Sin movimientos para mostrar.'],
  sinAvisos: ['No tienes avisos nuevos.', 'Todo al día: no hay avisos nuevos.'],
  fueraDeRol: [
    '{funcion} no está entre tus permisos. Te muestro lo que sí puedo hacer por ti:',
    'Eso le corresponde a otro rol. Puedo ayudarte con esto:',
  ],
  agendaEsDePsicologa: ['La agenda es de la psicóloga. Te muestro el análisis y ella elige la hora.'],
  noEntiende: ['Mmm, no lo capté. ¿Es alguna de estas?', 'No te entendí bien. ¿Te sirve alguna de estas opciones?'],
  ayuda: ['Esto es lo que puedo hacer por ti:', 'Puedo ayudarte con esto:'],
};

/** Reemplaza {variable} por su valor (las que no vienen quedan vacías). */
const completar = (plantilla, datos = {}) => plantilla.replace(/\{(\w+)\}/g, (_, clave) => datos[clave] ?? '');

/**
 * Elige una variante distinta a `anterior` (pura: `azar` se inyecta en las pruebas).
 * @returns {string} la plantilla elegida, sin completar
 */
function elegirVariante(clave, anterior = '', azar = Math.random) {
  const variantes = FRASES[clave] ?? [''];
  const candidatas = variantes.length > 1 ? variantes.filter((variante) => variante !== anterior) : variantes;
  return candidatas[Math.floor(azar() * candidatas.length)] ?? candidatas[0];
}

// Última variante usada por usuario y clave (en memoria, como el resto del estado en vivo).
const ultimas = new Map();

/** Frase completa para el usuario, sin repetir la última que vio de esa intención. */
function frase(usuarioId, clave, datos = {}, azar = Math.random) {
  const llave = `${usuarioId}:${clave}`;
  const plantilla = elegirVariante(clave, ultimas.get(llave), azar);
  ultimas.set(llave, plantilla);
  return completar(plantilla, datos);
}

module.exports = { FRASES, completar, elegirVariante, frase };
