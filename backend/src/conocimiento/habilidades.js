/**
 * Catálogo de habilidades con sus sinónimos: así "powerbi", "PBI" y "Power BI" son la misma y se
 * filtran con SQL exacto. Lo que no está en el catálogo se guarda tal cual y el administrador lo
 * ve en la Base de conocimiento para sumarlo después. Lógica pura.
 */
const { normalizar } = require('../agente/identidad');

const CATEGORIAS = ['herramienta', 'tecnica', 'blanda', 'licencia', 'certificacion', 'idioma'];

/** [categoría, nombre, ...sinónimos] */
const CATALOGO = [
  ['herramienta', 'Power BI', 'powerbi', 'pbi', 'microsoft power bi'],
  ['herramienta', 'Excel', 'microsoft excel', 'ms excel', 'planillas excel'],
  ['herramienta', 'Excel intermedio', 'excel nivel intermedio', 'excel medio'],
  ['herramienta', 'Excel avanzado', 'excel nivel avanzado'],
  ['herramienta', 'Microsoft Office', 'office', 'ms office', 'paquete office'],
  ['herramienta', 'SAP'],
  ['herramienta', 'SAP PM', 'sap mantenimiento'],
  ['herramienta', 'Innova', 'software innova', 'marel innova'],
  ['herramienta', 'SQL', 'sql server', 'mysql', 'postgresql'],
  ['herramienta', 'Python'],
  ['herramienta', 'AutoCAD', 'auto cad'],
  ['herramienta', 'Sernapesca SIFA', 'sifa', 'plataforma sernapesca'],
  ['tecnica', 'HACCP', 'sistema haccp'],
  ['tecnica', 'BPM', 'buenas practicas de manufactura'],
  ['tecnica', 'Control de calidad', 'aseguramiento de calidad', 'calidad e inocuidad'],
  ['tecnica', 'Trazabilidad'],
  ['tecnica', 'Electricidad industrial', 'electricidad', 'instalaciones electricas'],
  ['tecnica', 'Electromecánica', 'electromecanico'],
  ['tecnica', 'Neumática'],
  ['tecnica', 'Automatización', 'automatizacion industrial', 'plc'],
  ['tecnica', 'Mantenimiento industrial', 'mantencion industrial', 'mantencion preventiva', 'mantenimiento preventivo'],
  ['tecnica', 'Refrigeración', 'refrigeracion industrial'],
  ['tecnica', 'Soldadura', 'soldador'],
  ['tecnica', 'Acuicultura', 'salmonicultura', 'centros de cultivo', 'centro de cultivo'],
  ['tecnica', 'Cosecha', 'cosecha de peces', 'wellboat'],
  ['tecnica', 'Buceo', 'buzo'],
  ['tecnica', 'Logística', 'bodega', 'control de inventario', 'inventarios'],
  ['tecnica', 'Prevención de riesgos', 'seguridad y salud ocupacional'],
  ['tecnica', 'Reclutamiento y selección', 'seleccion de personal', 'reclutamiento'],
  ['tecnica', 'Control de gestión', 'kpi', 'indicadores de gestion'],
  ['tecnica', 'Laboratorio', 'analisis de laboratorio'],
  ['blanda', 'Liderazgo', 'liderazgo de equipos', 'manejo de equipos'],
  ['blanda', 'Trabajo en equipo'],
  ['blanda', 'Comunicación', 'comunicacion efectiva'],
  ['licencia', 'Licencia clase B', 'licencia b', 'licencia de conducir clase b', 'licencia de conducir b'],
  ['licencia', 'Licencia clase A2', 'licencia a2'],
  ['licencia', 'Licencia clase A4', 'licencia a4'],
  ['licencia', 'Licencia clase D', 'licencia d', 'licencia de conducir clase d'],
  ['licencia', 'Licencia SEC', 'sec clase d', 'licencia sec clase d'],
  ['certificacion', 'Patrón de nave menor', 'patron nave menor', 'credencial patron nave menor'],
  ['certificacion', 'Matrícula de buzo', 'matricula buzo', 'buzo comercial', 'buzo mariscador'],
  ['certificacion', 'OS-10', 'os10', 'curso os10'],
  ['certificacion', 'Primeros auxilios'],
  ['certificacion', 'Operador de grúa horquilla', 'grua horquilla', 'gruero'],
  ['certificacion', 'Operador de calderas', 'certificado de caldera', 'calderas'],
  ['idioma', 'Inglés', 'ingles', 'english'],
  ['idioma', 'Inglés intermedio', 'ingles intermedio'],
  ['idioma', 'Inglés avanzado', 'ingles avanzado', 'ingles fluido'],
  ['idioma', 'Portugués'],
  ['idioma', 'Noruego'],
].map(([categoria, nombre, ...sinonimos]) => ({ categoria, nombre, claves: [...new Set([nombre, ...sinonimos].map(normalizar))] }));

const FORMAS = CATALOGO.flatMap((habilidad) => habilidad.claves.map((clave) => ({ clave, habilidad }))).sort(
  (a, b) => b.clave.length - a.clave.length,
);
const NOMBRES = new Set(CATALOGO.map((habilidad) => habilidad.nombre));
const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "powerbi" → { nombre: 'Power BI', categoria: 'herramienta', enCatalogo: true }. */
function normalizarHabilidad(texto, categoria = '') {
  const clave = normalizar(texto);
  const forma = FORMAS.find((item) => item.clave === clave);
  if (forma) return { nombre: forma.habilidad.nombre, categoria: forma.habilidad.categoria, enCatalogo: true };
  const limpio = String(texto ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  return {
    nombre: limpio ? limpio[0].toUpperCase() + limpio.slice(1) : '',
    categoria: CATEGORIAS.includes(categoria) ? categoria : 'tecnica',
    enCatalogo: false,
  };
}

/** Habilidades del catálogo nombradas en una pregunta, sin repetir ("que sepan powerbi y excel avanzado"). */
function habilidadesEnTexto(mensaje) {
  let resto = ` ${normalizar(mensaje)} `;
  const encontradas = [];
  for (const { clave, habilidad } of FORMAS) {
    const patron = new RegExp(`([^a-z0-9])${escapar(clave)}(?=[^a-z0-9])`);
    if (!patron.test(resto)) continue;
    // Se quita del texto: "excel avanzado" no debe contar además como "excel".
    resto = resto.replace(patron, '$1 ');
    if (!encontradas.includes(habilidad.nombre)) encontradas.push(habilidad.nombre);
  }
  return encontradas;
}

const enCatalogo = (nombre) => NOMBRES.has(nombre);

module.exports = { CATALOGO, CATEGORIAS, enCatalogo, habilidadesEnTexto, normalizarHabilidad };
