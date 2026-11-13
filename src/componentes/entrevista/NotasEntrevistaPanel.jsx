import { useRef } from 'react';
import { COMPETENCIAS } from '../../datos/constantes';
import { agregarLinea, competenciasConNotas, etiquetaCompetencia, tiempoDesde } from '../../dominio/entrevista';

const MAXIMO = 20000;

/** Estado del guardado automático: "Guardando…", "Guardado hace 5 s" o el error. */
export function EstadoGuardado({ guardado, ahora = Date.now() }) {
  if (guardado?.error) {
    return (
      <span className="small text-danger" role="alert">
        <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />
        {guardado.error}
      </span>
    );
  }
  if (guardado?.guardando) {
    return (
      <span className="small text-secondary">
        <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
        Guardando…
      </span>
    );
  }
  if (!guardado?.guardadoEn) return null;
  return (
    <span className="small text-success">
      <i className="bi bi-check2-circle me-1" aria-hidden="true" />
      Guardado {tiempoDesde(guardado.guardadoEn, ahora)}
    </span>
  );
}

/**
 * "Mis notas" del panel de entrevista: texto libre que se guarda solo. Los botones de
 * competencia agregan una línea con la hora de la entrevista y la competencia, para ordenar
 * las notas; las frases citadas desde la transcripción también llegan aquí.
 */
export default function NotasEntrevistaPanel({ notas = '', alCambiar, milisegundosActuales = 0, guardado, ahora }) {
  const area = useRef(null);
  const conNotas = competenciasConNotas(notas);

  const etiquetar = (competencia) => {
    const nuevas = agregarLinea(notas, etiquetaCompetencia(competencia, milisegundosActuales));
    alCambiar(nuevas);
    // Deja el foco en las notas y el cursor al final para seguir escribiendo la nota.
    area.current?.focus();
    requestAnimationFrame(() => {
      const elemento = area.current;
      if (!elemento) return;
      elemento.setSelectionRange?.(elemento.value.length, elemento.value.length);
      elemento.scrollTop = elemento.scrollHeight;
    });
  };

  return (
    <section className="card border-0 shadow-sm" aria-labelledby="mis-notas-titulo">
      <div className="card-header bg-white d-flex flex-wrap align-items-center gap-2 py-2">
        <i className="bi bi-journal-text text-primary" aria-hidden="true" />
        <h2 id="mis-notas-titulo" className="h6 mb-0 me-auto">
          Mis notas
        </h2>
        <EstadoGuardado guardado={guardado} ahora={ahora} />
      </div>
      <div className="card-body d-flex flex-column gap-2">
        <div className="d-flex flex-wrap align-items-center gap-1" role="group" aria-label="Agregar nota por competencia">
          <span className="small text-secondary me-1">Nota sobre:</span>
          {COMPETENCIAS.map((competencia) => (
            <button
              key={competencia}
              type="button"
              className={`btn btn-sm ${conNotas.includes(competencia) ? 'btn-primary' : 'btn-outline-primary'} rounded-pill`}
              onClick={() => etiquetar(competencia)}
            >
              <i className="bi bi-plus me-1" aria-hidden="true" />
              {competencia}
            </button>
          ))}
        </div>
        <label htmlFor="notas-entrevista" className="visually-hidden">
          Notas de la entrevista
        </label>
        <textarea
          id="notas-entrevista"
          ref={area}
          className="form-control panel-entrevista-notas"
          rows={9}
          maxLength={MAXIMO}
          value={notas}
          placeholder="Anota lo que observas: situación, acción y resultado que relata el postulante. Usa los botones para marcar la competencia."
          onChange={(evento) => alCambiar(evento.target.value)}
        />
        <div className="d-flex justify-content-between small text-secondary">
          <span>Confidencial: solo la ves tú. Se guarda sola mientras escribes.</span>
          <span>
            {notas.length.toLocaleString('es-CL')} / {MAXIMO.toLocaleString('es-CL')}
          </span>
        </div>
      </div>
    </section>
  );
}
