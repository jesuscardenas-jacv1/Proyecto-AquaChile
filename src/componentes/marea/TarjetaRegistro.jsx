import { fechaHoraCorta } from '../../dominio/marea';
import './conocimiento.css';

/** Tarjetas de consulta de Marea: conteos (`conteo`) e historial de la plataforma (`actividad`). */
export default function TarjetaRegistro({ tarjeta }) {
  if (tarjeta.tipo === 'conteo') {
    const mayor = Math.max(1, ...tarjeta.grupos.map((g) => g.total));
    return (
      <div className="marea-ficha">
        <h4>{tarjeta.titulo}</h4>
        <ul className="marea-conteo">
          {tarjeta.grupos.map((g) => (
            <li key={g.nombre}>
              <span>{g.nombre}</span>
              <span className="marea-conteo-barra" aria-hidden="true">
                <i style={{ width: `${(g.total / mayor) * 100}%` }} />
              </span>
              <b>{g.total}</b>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="marea-ficha">
      <h4>{tarjeta.titulo}</h4>
      <ol className="marea-actividad">
        {tarjeta.eventos.map((e) => (
          <li key={e.id}>
            <strong>{e.titulo}</strong>
            {e.detalle && <span>{e.detalle}</span>}
            <small>{[fechaHoraCorta(e.fecha), e.usuario].filter(Boolean).join(', ')}</small>
          </li>
        ))}
      </ol>
    </div>
  );
}
