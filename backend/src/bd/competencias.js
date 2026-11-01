/**
 * Evaluación por competencias del informe psicolaboral: por cada competencia evaluada,
 * un nivel, sus fortalezas y sus oportunidades de desarrollo (como en el formato de
 * informe que usa hoy el equipo). Mismo catálogo que src/datos/constantes.js del frontend.
 *
 * Las competencias forman parte del informe que recibe el analista; las notas clínicas
 * (observaciones) siguen siendo confidenciales.
 */
const COMPETENCIAS = [
  'Trabajo en equipo',
  'Orientación a resultados',
  'Comunicación efectiva',
  'Adaptación al cambio',
  'Compromiso con la seguridad',
  'Liderazgo',
];
const NIVELES_COMPETENCIA = ['Sobre lo esperado', 'Esperado', 'En desarrollo', 'Bajo lo esperado'];
const LARGO_MAXIMO_TEXTO = 600;

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

/**
 * Valida y normaliza la lista de competencias recibida.
 * @returns {{ competencias: object[] } | { error: string }}
 */
function normalizarCompetencias(valor) {
  if (valor === undefined || valor === null) return { competencias: [] };
  if (!Array.isArray(valor)) return { error: 'Las competencias deben ser una lista.' };

  const competencias = [];
  for (const item of valor) {
    const competencia = texto(item?.competencia);
    const nivel = texto(item?.nivel);
    const fortalezas = texto(item?.fortalezas);
    const oportunidades = texto(item?.oportunidades);

    if (!COMPETENCIAS.includes(competencia)) {
      return { error: `Competencia desconocida: "${competencia}".` };
    }
    if (competencias.some((c) => c.competencia === competencia)) {
      return { error: `La competencia "${competencia}" está repetida.` };
    }
    if (!NIVELES_COMPETENCIA.includes(nivel)) {
      return { error: `Nivel inválido en "${competencia}". Use: ${NIVELES_COMPETENCIA.join(', ')}.` };
    }
    if (!fortalezas && !oportunidades) {
      return { error: `Indique fortalezas u oportunidades de desarrollo en "${competencia}".` };
    }
    if (fortalezas.length > LARGO_MAXIMO_TEXTO || oportunidades.length > LARGO_MAXIMO_TEXTO) {
      return { error: `Los textos de "${competencia}" no pueden superar ${LARGO_MAXIMO_TEXTO} caracteres.` };
    }
    competencias.push({ competencia, nivel, fortalezas, oportunidades });
  }
  return { competencias };
}

/** Lee la columna JSON de la BD; si está vacía o ilegible devuelve una lista vacía. */
function leerCompetencias(json) {
  try {
    const lista = JSON.parse(json || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

module.exports = { COMPETENCIAS, NIVELES_COMPETENCIA, normalizarCompetencias, leerCompetencias };
