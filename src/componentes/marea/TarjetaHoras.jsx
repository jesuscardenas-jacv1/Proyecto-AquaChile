import { useState } from 'react';
import { validarAgenda } from '../../dominio/planner';
import { fechaLarga } from '../../dominio/marea';

/**
 * Horas libres de la psicóloga para una entrevista (bloques de 45 min). La primera se marca como
 * "Primera libre". Se elige la modalidad y luego la hora: eso pide la propuesta para confirmar
 * (aún no guarda nada).
 */
export default function TarjetaHoras({ tarjeta, alElegir, desactivado = false }) {
  const [modalidad, setModalidad] = useState(tarjeta.modalidad);
  const [error, setError] = useState('');

  const elegir = (hora) => {
    // Mismas reglas que la ventana de agenda del Planner.
    const errores = validarAgenda({ fechaEntrevista: tarjeta.fecha, horaEntrevista: hora, modalidadEntrevista: modalidad });
    const primero = Object.values(errores)[0];
    if (primero) return setError(primero);
    setError('');
    return alElegir(
      { tipo: 'elegir_hora', solicitudId: tarjeta.solicitudId, fecha: tarjeta.fecha, hora, modalidad },
      `${hora} · ${modalidad}`,
    );
  };

  return (
    <div className="marea-confirmar">
      <div className="marea-dia">
        <strong>{fechaLarga(tarjeta.fecha)}</strong>
        <span>
          {tarjeta.nombre} · {tarjeta.cargo}
        </span>
      </div>
      <div className="marea-modalidades" role="group" aria-label="Modalidad de la entrevista">
        {tarjeta.modalidades.map((opcion) => (
          <button
            key={opcion}
            type="button"
            className="marea-modalidad"
            aria-pressed={modalidad === opcion}
            disabled={desactivado}
            onClick={() => setModalidad(opcion)}
          >
            {opcion}
          </button>
        ))}
      </div>
      <div className="marea-horas">
        {tarjeta.bloques.map((bloque) => (
          <button
            key={bloque.hora}
            type="button"
            className={`marea-hora${bloque.primera ? ' marea-primera' : ''}`}
            disabled={desactivado}
            aria-label={`${bloque.hora}${bloque.primera ? ', primera libre' : ''}`}
            onClick={() => elegir(bloque.hora)}
          >
            {bloque.primera && <small className="marea-etiqueta-primera">Primera libre</small>}
            <b>{bloque.hora}</b>
            <small>45 min</small>
          </button>
        ))}
      </div>
      {error && (
        <p className="marea-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
