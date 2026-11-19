import { porcentajeVisible } from '../../dominio/marea';

/** Barra horizontal con el % de requisitos de un cargo. */
export function BarraPorcentaje({ porcentaje }) {
  const valor = porcentajeVisible(porcentaje);
  return (
    <span className="marea-barra-pct">
      <span>
        <i style={{ width: `${valor}%` }} />
      </span>
      <b>{valor}%</b>
    </span>
  );
}

/**
 * Análisis completo de una persona: anillo con el cargo de mayor ajuste, % por cargo, fortalezas y
 * lo que hay que confirmar. El % lo calcula la plataforma (cumplimiento.js); la decisión es de la persona.
 */
export default function TarjetaAnalisis({ tarjeta }) {
  const { mayorAjuste } = tarjeta;
  return (
    <div className="marea-analisis">
      <div className="marea-analisis-cabeza">
        <div>
          <small>Mayor ajuste</small>
          <strong>{mayorAjuste.cargo}</strong>
          <span>{tarjeta.nombre}</span>
        </div>
        <div
          className="marea-anillo"
          style={{ '--pct': porcentajeVisible(mayorAjuste.porcentaje) }}
          role="img"
          aria-label={`${porcentajeVisible(mayorAjuste.porcentaje)}% de los requisitos`}
        >
          <span>{porcentajeVisible(mayorAjuste.porcentaje)}%</span>
        </div>
      </div>
      <div className="marea-analisis-cuerpo">
        {tarjeta.cargos.length > 1 && (
          <div className="marea-cargos">
            <h4>% de requisitos por cargo</h4>
            {tarjeta.cargos.map((cargo) => (
              <div key={cargo.cargo} className="marea-cargo-fila">
                <span>{cargo.cargo}</span>
                <BarraPorcentaje porcentaje={cargo.porcentaje} />
              </div>
            ))}
          </div>
        )}
        <div>
          <h4>Fortalezas</h4>
          <ul>
            {tarjeta.fortalezas.length ? tarjeta.fortalezas.map((f) => <li key={f} className="marea-fuerte">{f}</li>) : <li>Sin requisitos cumplidos con claridad.</li>}
          </ul>
        </div>
        <div>
          <h4>A confirmar</h4>
          <ul>
            {tarjeta.aConfirmar.length ? tarjeta.aConfirmar.map((f) => <li key={f} className="marea-debil">{f}</li>) : <li>Nada pendiente.</li>}
          </ul>
        </div>
      </div>
      <p className="marea-nota">{tarjeta.nota}</p>
    </div>
  );
}
