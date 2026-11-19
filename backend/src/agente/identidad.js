/**
 * Identidad de la persona de quien se habla con Marea: búsqueda por nombre y validación del RUT
 * (dígito verificador con módulo 11). Lógica pura.
 */

/** Minúsculas, sin tildes ni espacios repetidos. */
const normalizar = (texto = '') =>
  String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Dígito verificador de un cuerpo de RUT (números): '0'-'9' o 'K'. */
function digitoVerificador(cuerpo) {
  let suma = 0;
  let multiplicador = 2;
  for (const digito of String(cuerpo).split('').reverse()) {
    suma += Number(digito) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  return resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
}

/** "17.284.563-5" → { cuerpo: '17284563', dv: '5' }; null si no tiene forma de RUT. */
function separarRut(rut) {
  const limpio = String(rut ?? '').replace(/[.\s]/g, '').toUpperCase();
  const coincidencia = /^(\d{7,8})-?([\dK])$/.exec(limpio);
  return coincidencia ? { cuerpo: coincidencia[1], dv: coincidencia[2] } : null;
}

const rutValido = (rut) => {
  const partes = separarRut(rut);
  return Boolean(partes) && digitoVerificador(partes.cuerpo) === partes.dv;
};

/** "17284563-5" → "17.284.563-5" (o '' si no tiene forma de RUT). */
function formatearRut(rut) {
  const partes = separarRut(rut);
  if (!partes) return '';
  return `${partes.cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${partes.dv}`;
}

/** Compara dos RUT sin importar puntos, guion ni mayúsculas. */
const mismoRut = (a, b) => {
  const [x, y] = [separarRut(a), separarRut(b)];
  return Boolean(x && y) && x.cuerpo === y.cuerpo && x.dv === y.dv;
};

/** Primer RUT escrito en un texto ("su rut es 17.284.563-5"), o ''. */
function rutEnTexto(texto) {
  const coincidencia = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/.exec(String(texto ?? ''));
  return coincidencia ? coincidencia[0] : '';
}

/**
 * RUT ficticio y válido para los datos de demostración (los candidatos de la semilla no traen RUT).
 * Determinista: el mismo id da siempre el mismo RUT.
 */
function rutFicticio(id) {
  const cuerpo = String(15_000_000 + ((Number(id) * 104_729) % 9_000_000));
  return formatearRut(`${cuerpo}-${digitoVerificador(cuerpo)}`);
}

const palabrasDe = (texto) => new Set(normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean));

/**
 * Personas nombradas dentro de un mensaje ("agenda a valentina rios mañana"). Primero las que
 * aparecen con nombre y algún apellido; si no hay, las que calzan solo por el primer nombre.
 * @param {Array<{ nombre: string }>} personas
 */
function buscarEnTexto(personas, texto) {
  const palabras = palabrasDe(texto);
  const partes = (persona) => normalizar(persona.nombre).split(' ');
  const completas = personas.filter((persona) => {
    const [nombre, ...apellidos] = partes(persona);
    return palabras.has(nombre) && apellidos.some((apellido) => palabras.has(apellido));
  });
  return completas.length ? completas : personas.filter((persona) => palabras.has(partes(persona)[0]));
}

/** Nombres (cargos) cuyas palabras de más de 3 letras aparecen todas en el texto. */
function nombresEnTexto(nombres, texto) {
  const palabras = palabrasDe(texto);
  return nombres.filter((nombre) => {
    const clave = normalizar(nombre).split(/[^a-z0-9]+/).filter((palabra) => palabra.length > 3);
    return clave.length > 0 && clave.every((palabra) => palabras.has(palabra));
  });
}

/** Si el texto parece traer un nombre propio (una palabra con mayúscula que no es la primera). */
const pareceNombre = (texto = '') =>
  String(texto)
    .split(/\s+/)
    .slice(1)
    .some((palabra) => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}/.test(palabra) && !/^(Google|Meet|Teams|RUT|Presencial)/.test(palabra));

module.exports = {
  buscarEnTexto,
  nombresEnTexto,
  pareceNombre,
  digitoVerificador,
  formatearRut,
  mismoRut,
  normalizar,
  rutEnTexto,
  rutFicticio,
  rutValido,
};
