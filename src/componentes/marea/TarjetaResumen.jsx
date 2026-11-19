import { BarraPorcentaje } from './TarjetaAnalisis';

/**
 * Tarjetas de solo lectura de Marea: resumen (solicitud, guía, entrevista agendada, borrador de
 * oferta) y ranking de postulantes por % de requisitos.
 */
export default function TarjetaResumen({ tarjeta }) {
  if (tarjeta.tipo === 'ranking') {
    return (
      <div className="marea-ficha">
        <h4>Postulantes a {tarjeta.cargo}</h4>
        <ol className="marea-ranking">
          {tarjeta.postulantes.map((p) => (
            <li key={p.candidatoId}>
              <span>
                {p.nombre}
                {p.brecha && <small className="marea-brecha">Brecha: {p.brecha}</small>}
              </span>
              <BarraPorcentaje porcentaje={p.porcentaje} />
            </li>
          ))}
        </ol>
        <p className="marea-nota">{tarjeta.nota}</p>
      </div>
    );
  }

  return (
    <div className="marea-ficha">
      <h4>{tarjeta.titulo}</h4>
      <ul className="marea-detalle">
        {tarjeta.lineas.map((linea) => (
          <li key={linea}>{linea}</li>
        ))}
      </ul>
      {(tarjeta.secciones ?? []).map((seccion) => (
        <div key={seccion.titulo}>
          <h5>{seccion.titulo}</h5>
          <ul className="marea-detalle">
            {seccion.lineas.map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </ul>
        </div>
      ))}
      {tarjeta.fuente && <p className="marea-fuente">Fuente: {tarjeta.fuente}</p>}
    </div>
  );
}
