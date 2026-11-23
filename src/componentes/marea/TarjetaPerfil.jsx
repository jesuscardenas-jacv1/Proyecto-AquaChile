import './conocimiento.css';

const periodo = ({ desde, hasta }) => [desde, hasta].filter(Boolean).join(' a ');

function Seccion({ titulo, children }) {
  return (
    <div>
      <h5>{titulo}</h5>
      {children}
    </div>
  );
}

/** Perfil profesional de una persona, extraído de su CV. Sin datos personales sensibles ni de contacto. */
export default function TarjetaPerfil({ tarjeta }) {
  const anios = tarjeta.aniosExperiencia;
  return (
    <div className="marea-ficha">
      <div>
        <h4>{tarjeta.nombre}</h4>
        <span className="marea-persona-dato">
          {[tarjeta.ciudad, anios ? `${anios.toLocaleString('es-CL')} ${anios === 1 ? 'año' : 'años'} de experiencia` : ''].filter(Boolean).join(', ')}
        </span>
      </div>
      {tarjeta.resumen && <p className="marea-perfil-resumen">{tarjeta.resumen}</p>}
      {tarjeta.habilidades.length > 0 && (
        <Seccion titulo="Habilidades">
          <ul className="marea-habilidades">
            {tarjeta.habilidades.map((h) => (
              <li key={h.habilidad} title={h.evidencia || undefined}>
                {h.habilidad}
              </li>
            ))}
          </ul>
        </Seccion>
      )}
      {tarjeta.experiencia.length > 0 && (
        <Seccion titulo="Experiencia">
          <ul className="marea-detalle">
            {tarjeta.experiencia.map((e, indice) => (
              <li key={`${e.cargo}-${indice}`}>
                {[e.cargo, e.empresa].filter(Boolean).join(', ')}
                {periodo(e) && <small className="marea-persona-dato"> ({periodo(e)})</small>}
              </li>
            ))}
          </ul>
        </Seccion>
      )}
      {tarjeta.formacion.length > 0 && (
        <Seccion titulo="Formación">
          <ul className="marea-detalle">
            {tarjeta.formacion.map((f, indice) => (
              <li key={`${f.titulo}-${indice}`}>{[f.titulo, f.institucion, f.estado].filter(Boolean).join(', ')}</li>
            ))}
          </ul>
        </Seccion>
      )}
      <p className="marea-nota">{tarjeta.demostracion ? 'Perfil ficticio de demostración.' : tarjeta.nota}</p>
    </div>
  );
}
