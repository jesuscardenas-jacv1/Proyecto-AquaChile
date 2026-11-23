/**
 * Catálogo de ciudades y comunas para normalizar lo que escribe el postulante ("pto montt",
 * "PMontt") y reconocer la ciudad dentro de una pregunta a Marea. Parte por las regiones donde
 * opera AquaChile. Lógica pura.
 */
const { normalizar } = require('../agente/identidad');

const REGIONES = {
  'Los Lagos': [
    ['Puerto Montt', 'pto montt', 'pto. montt', 'pmontt', 'p montt', 'p. montt', 'puertomontt'],
    ['Puerto Varas', 'pto varas', 'pto. varas', 'pvaras'],
    ['Calbuco'], ['Pargua'], ['Maullín'], ['Llanquihue'], ['Frutillar'], ['Los Muermos'], ['Fresia'], ['Cochamó'],
    ['Alerce'], ['Hualaihué', 'hornopiren'], ['Chaitén'], ['Ancud'], ['Castro'], ['Dalcahue'], ['Chonchi'],
    ['Quellón', 'quellon chiloe'], ['Quemchi'], ['Curaco de Vélez'], ['Achao', 'quinchao'], ['Queilén'],
    ['Osorno'], ['Purranque'], ['Río Negro'], ['Puerto Octay', 'pto octay'],
  ],
  Aysén: [['Puerto Aysén', 'pto aysen', 'aysen', 'puerto aisen'], ['Coyhaique', 'coihaique'], ['Puerto Chacabuco', 'chacabuco'], ['Puerto Cisnes'], ['Melinka']],
  Magallanes: [['Puerto Natales', 'pto natales', 'pto. natales', 'natales'], ['Punta Arenas', 'pta arenas', 'pta. arenas'], ['Porvenir']],
  'Los Ríos': [['Valdivia'], ['La Unión'], ['Panguipulli'], ['Río Bueno']],
  'La Araucanía': [['Temuco'], ['Villarrica'], ['Pucón'], ['Angol']],
  Biobío: [['Concepción'], ['Talcahuano'], ['Los Ángeles'], ['Chillán']],
  'Metropolitana de Santiago': [['Santiago', 'santiago de chile', 'stgo']],
  Valparaíso: [['Valparaíso'], ['Viña del Mar']],
};

const CIUDADES = Object.entries(REGIONES).flatMap(([region, ciudades]) =>
  ciudades.map(([nombre, ...variantes]) => ({
    nombre,
    region,
    claves: [normalizar(nombre), ...variantes.map(normalizar)],
  })),
);

/** Todas las formas de escribir una ciudad, de la más larga a la más corta ("puerto natales" antes que "natales"). */
const FORMAS = CIUDADES.flatMap((ciudad) => ciudad.claves.map((clave) => ({ clave, ciudad }))).sort(
  (a, b) => b.clave.length - a.clave.length,
);

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mayusculaInicial = (texto) => texto.replace(/(^|\s)(\p{L})/gu, (_, espacio, letra) => espacio + letra.toUpperCase());

/**
 * "pto montt, chile" → { ciudad: 'Puerto Montt', region: 'Los Lagos' }.
 * Lo que no está en el catálogo queda tal cual, con mayúscula inicial y sin región.
 */
function normalizarCiudad(texto) {
  const clave = normalizar(texto);
  if (!clave) return { ciudad: '', region: '' };
  const forma =
    FORMAS.find((item) => item.clave === clave) ??
    FORMAS.find((item) => new RegExp(`(^|[^a-z0-9])${escapar(item.clave)}([^a-z0-9]|$)`).test(clave));
  if (forma) return { ciudad: forma.ciudad.nombre, region: forma.ciudad.region };
  return { ciudad: mayusculaInicial(String(texto).trim().toLowerCase().replace(/\s+/g, ' ')).slice(0, 60), region: '' };
}

/**
 * Ciudad nombrada en una pregunta ("¿quiénes son de pto montt?" → "Puerto Montt"), o ''.
 * Las de una sola palabra también pueden ser apellidos (Castro, Valdivia): se exige "de", "en" o "desde" antes.
 */
function ciudadEnTexto(mensaje) {
  const texto = normalizar(mensaje);
  const forma = FORMAS.find(({ clave }) => {
    const antes = clave.includes(' ') || clave.includes('.') ? '(^|[^a-z0-9])' : '(^|[^a-z0-9])(?:de|en|desde|vive[n]?|reside[n]?)\\s+';
    return new RegExp(`${antes}${escapar(clave)}([^a-z0-9]|$)`).test(texto);
  });
  return forma?.ciudad.nombre ?? '';
}

module.exports = { CIUDADES, ciudadEnTexto, normalizarCiudad };
