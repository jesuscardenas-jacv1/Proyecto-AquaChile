import { BarraPorcentaje } from './TarjetaAnalisis';
import './conocimiento.css';

/**
 * Personas encontradas por Marea: ciudad, cargo, estado y la evidencia del CV por cada habilidad
 * pedida. El % es el del análisis de CV ya hecho (si existe); Marea no ordena ni recomienda.
 */
export default function TarjetaCandidatos({ tarjeta }) {
  const restantes = tarjeta.total - tarjeta.candidatos.length;
  return (
    <div className="marea-ficha">
      <h4>{tarjeta.titulo}</h4>
      <ul className="marea-personas">
        {tarjeta.candidatos.map((c) => (
          <li key={c.candidatoId}>
            <div className="marea-persona-cabeza">
              <strong>{c.nombre}</strong>
              <span className="marea-persona-estado">{c.estado}</span>
            </div>
            <span className="marea-persona-dato">{[c.cargo, c.ciudad].filter(Boolean).join(', ')}</span>
            {c.coincidencias.map((item) => (
              <span key={item.habilidad} className="marea-persona-evidencia">
                <b>{item.habilidad}</b>
                {item.evidencia && `: ${item.evidencia}`}
              </span>
            ))}
            {c.porcentaje !== null && c.porcentaje !== undefined && <BarraPorcentaje porcentaje={c.porcentaje} />}
            {!c.conPerfil && <span className="marea-persona-dato">Su CV aún no está leído.</span>}
          </li>
        ))}
      </ul>
      {restantes > 0 && <p className="marea-nota">Y {restantes} más. Agrega otro filtro para acotar.</p>}
      <p className="marea-nota">{tarjeta.nota}</p>
    </div>
  );
}
