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

/**
 * Personas cuyo nombre calza con lo escrito. Todas las palabras escritas deben aparecer en el
 * nombre ("valentina rios" calza con "Valentina Ríos Ojeda"). Primero las coincidencias exactas.
 * @param {Array<{ nombre: string }>} personas
 */
function buscarPorNombre(personas, texto) {
  const palabras = normalizar(texto).split(' ').filter((palabra) => palabra.length > 1);
  if (!palabras.length) return [];
  const buscado = palabras.join(' ');
  return personas
    .filter((persona) => {
      const nombre = normalizar(persona.nombre).split(' ');
      return palabras.every((palabra) => nombre.includes(palabra));
    })
    .sort((a, b) => Number(normalizar(b.nombre) === buscado) - Number(normalizar(a.nombre) === buscado));
}

module.exports = {
  buscarPorNombre,
  digitoVerificador,
  formatearRut,
  mismoRut,
  normalizar,
  rutEnTexto,
  rutFicticio,
  rutValido,
};
