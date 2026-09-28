const COLOR_ESTADO_SOLICITUD = {
  Pendiente: 'bg-secondary',
  'En proceso': 'bg-warning text-dark',
  Finalizada: 'bg-success',
};

const COLOR_ESTADO_EVALUACION = {
  Pendiente: 'bg-secondary',
  Realizada: 'bg-primary',
};

const COLOR_RESULTADO = {
  Recomendado: 'bg-success',
  'Recomendado con observaciones': 'bg-warning text-dark',
  'No recomendado': 'bg-danger',
};

const coloresPorContexto = {
  solicitud: COLOR_ESTADO_SOLICITUD,
  evaluacion: COLOR_ESTADO_EVALUACION,
  resultado: COLOR_RESULTADO,
};

/**
 * Muestra una etiqueta (badge) de Bootstrap segun el estado o resultado.
 */
export default function EtiquetaEstado({ valor, contexto = 'solicitud', className = '' }) {
  const colores = coloresPorContexto[contexto] ?? COLOR_ESTADO_SOLICITUD;
  const color = colores[valor] ?? 'bg-dark';

  return (
    <span className={`badge rounded-pill ${color} ${className}`.trim()}>{valor}</span>
  );
}
