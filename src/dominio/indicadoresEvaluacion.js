import { RESULTADOS_EVALUACION } from '../datos/constantes';
import { contarPor, promedioDiasRespuesta } from './indicadores';

/** Tipos de evaluación psicolaboral (según el origen del candidato/a). */
export const TIPOS_EVALUACION = ['externa', 'interna'];

const NOMBRES_MES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** Etiqueta corta de un mes en formato AAAA-MM (ej: "mar 2026"). */
export function etiquetaMes(mes) {
  const [anio, numero] = mes.split('-');
  return `${NOMBRES_MES[Number(numero) - 1]} ${anio}`;
}

/**
 * Une cada evaluación con resultado (candidato/a evaluado/a) con su solicitud,
 * dejando los campos que usan los gráficos del dashboard.
 */
export function registrosEvaluados(solicitudes = [], evaluaciones = []) {
  const solicitudPorId = new Map(solicitudes.map((solicitud) => [solicitud.id, solicitud]));
  return evaluaciones
    .filter((evaluacion) => evaluacion.resultado)
    .map((evaluacion) => {
      const solicitud = solicitudPorId.get(Number(evaluacion.solicitudId)) ?? {};
      return {
        resultado: evaluacion.resultado,
        tipo: solicitud.tipoEvaluacion ?? '',
        familia: solicitud.familiaCargo ?? '',
        reclutador: solicitud.profesionalResponsable ?? '',
        mes: (evaluacion.fechaEvaluacion ?? '').slice(0, 7),
        diasRespuesta: evaluacion.diasRespuesta,
      };
    });
}

/** Aplica los filtros del dashboard; un filtro vacío incluye todo. */
export function filtrarRegistros(registros = [], { mes = '', tipo = '' } = {}) {
  return registros.filter(
    (registro) => (!mes || registro.mes === mes) && (!tipo || registro.tipo === tipo),
  );
}

/** Meses con evaluaciones, en orden cronológico. */
export function mesesDisponibles(registros = []) {
  return [...new Set(registros.map((registro) => registro.mes).filter(Boolean))].sort();
}

/** Candidatos/as por categoría de resultado, en el orden fijo de las categorías. */
export function porCategoria(registros = []) {
  const total = registros.length;
  return RESULTADOS_EVALUACION.map((categoria) => {
    const cantidad = registros.filter((registro) => registro.resultado === categoria).length;
    return {
      etiqueta: categoria,
      total: cantidad,
      porcentaje: total === 0 ? 0 : Math.round((cantidad / total) * 100),
    };
  });
}

function agruparPorTipo(registros, obtenerClave, sinDato) {
  const grupos = new Map();
  registros.forEach((registro) => {
    const clave = obtenerClave(registro) || sinDato;
    const grupo = grupos.get(clave) ?? { etiqueta: clave, externa: 0, interna: 0, total: 0 };
    if (TIPOS_EVALUACION.includes(registro.tipo)) grupo[registro.tipo] += 1;
    grupo.total += 1;
    grupos.set(clave, grupo);
  });
  return [...grupos.values()];
}

/** Candidatos/as por familia de cargo separados por tipo de evaluación (mayor a menor). */
export function porFamiliaYTipo(registros = []) {
  return agruparPorTipo(registros, (registro) => registro.familia, 'Sin familia').sort(
    (a, b) => b.total - a.total || a.etiqueta.localeCompare(b.etiqueta),
  );
}

/** Candidatos/as por mes separados por tipo de evaluación (orden cronológico). */
export function porMesYTipo(registros = []) {
  return agruparPorTipo(registros, (registro) => registro.mes, 'Sin fecha').sort((a, b) =>
    a.etiqueta.localeCompare(b.etiqueta),
  );
}

/** Candidatos/as evaluados/as por reclutador/a (mayor a menor). */
export function porReclutador(registros = []) {
  return contarPor(registros, (registro) => registro.reclutador, 'Sin asignar');
}

/** Promedio de días hábiles entre la solicitud y el envío del informe. */
export function promedioTiming(registros = []) {
  return promedioDiasRespuesta(registros);
}
