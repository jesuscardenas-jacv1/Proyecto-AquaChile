/**
 * Cumplimiento de los requisitos del cargo según el CV.
 *
 * La IA solo clasifica cada requisito (cumple, parcial, sin evidencia o no evaluable) y cita la
 * evidencia del CV. El porcentaje lo calcula este módulo con reglas fijas y visibles, así el
 * número se puede explicar y no cambia aunque cambie el modelo:
 *
 *   porcentaje = Σ (peso × factor) / Σ peso        (solo requisitos evaluables)
 *
 * - Peso: obligatorio 2, deseable 1 (deseable = el texto empieza con "Deseable").
 * - Factor: cumple 1, parcial 0,5, sin evidencia 0.
 * - "No evaluable" (no se comprueba con un CV, p. ej. disponibilidad para turnos) queda fuera
 *   del cálculo y se lista para confirmar en la entrevista.
 *
 * Es un apoyo para preparar la entrevista: no decide ni descarta a nadie.
 */

const NIVELES = ['cumple', 'parcial', 'sin-evidencia', 'no-evaluable'];
const TIPOS = ['obligatorio', 'deseable'];
const PESOS = { obligatorio: 2, deseable: 1 };
const FACTORES = { cumple: 1, parcial: 0.5, 'sin-evidencia': 0 };

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

/** "Deseable experiencia de 2 años…" es deseable; el resto es obligatorio. */
const tipoDeRequisito = (requisito) => (/^deseable\b/i.test(texto(requisito)) ? 'deseable' : 'obligatorio');

/** Requisitos de la oferta (columna JSON `requisitos`), sin vacíos ni repetidos. */
function requisitosDeOferta(oferta) {
  let lista = [];
  try {
    lista = JSON.parse(oferta?.requisitos ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  return lista.map(texto).filter((requisito) => {
    const clave = requisito.toLowerCase();
    if (!requisito || vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

/**
 * Deja los criterios que devolvió la IA con forma segura. Si hay requisitos de la oferta,
 * mandan ellos: se toma la clasificación de la IA en el mismo orden y el texto y el tipo
 * salen de la oferta (la IA no puede agregar, quitar ni reescribir requisitos).
 */
function normalizarCriterios(criteriosIa, requisitos = []) {
  const desdeIa = Array.isArray(criteriosIa) ? criteriosIa : [];
  const base = requisitos.length ? requisitos.map((requisito, indice) => ({ ...desdeIa[indice], requisito })) : desdeIa;

  return base
    .map((criterio) => {
      const requisito = texto(criterio?.requisito);
      const nivel = NIVELES.includes(criterio?.nivel) ? criterio.nivel : 'sin-evidencia';
      const tipo = requisitos.length
        ? tipoDeRequisito(requisito)
        : TIPOS.includes(criterio?.tipo)
          ? criterio.tipo
          : tipoDeRequisito(requisito);
      return { requisito, tipo, nivel, evidencia: texto(criterio?.evidencia) };
    })
    .filter((criterio) => criterio.requisito);
}

/**
 * Porcentaje de cumplimiento y su desglose. Sin requisitos evaluables, `porcentaje` es null
 * (no se inventa un número).
 */
function calcularCumplimiento(criterios) {
  const evaluables = criterios.filter((criterio) => criterio.nivel !== 'no-evaluable');
  const pesoTotal = evaluables.reduce((suma, criterio) => suma + PESOS[criterio.tipo], 0);
  const puntos = evaluables.reduce((suma, criterio) => suma + PESOS[criterio.tipo] * FACTORES[criterio.nivel], 0);
  const obligatorios = criterios.filter((criterio) => criterio.tipo === 'obligatorio');

  return {
    porcentaje: pesoTotal ? Math.round((puntos / pesoTotal) * 100) : null,
    evaluados: evaluables.length,
    total: criterios.length,
    obligatoriosCumplidos: obligatorios.filter((criterio) => criterio.nivel === 'cumple').length,
    obligatoriosTotal: obligatorios.length,
    porConfirmar: criterios.filter((criterio) => criterio.nivel !== 'cumple').map((criterio) => criterio.requisito),
  };
}

module.exports = {
  FACTORES,
  NIVELES,
  PESOS,
  TIPOS,
  calcularCumplimiento,
  normalizarCriterios,
  requisitosDeOferta,
  tipoDeRequisito,
};
