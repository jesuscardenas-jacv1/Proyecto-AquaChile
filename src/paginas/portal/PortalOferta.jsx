import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDatos } from '../../datos/DatosContext';
import { formatearFecha } from '../../dominio/formateo';
import { subirCvPostulacion } from '../../servicios/apiDocumentos';
import FormularioPostulacion from '../../componentes/portal/FormularioPostulacion';
import Mensaje from '../../componentes/comunes/Mensaje';

/**
 * Detalle público de una oferta con el formulario de postulación.
 * La postulación se registra siempre; el CV se envía al backend si está disponible.
 */
export default function PortalOferta({ subirCv = subirCvPostulacion }) {
  const { id } = useParams();
  const { obtenerOferta, postular } = useDatos();
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const oferta = obtenerOferta(id);
  const volver = (
    <Link to="/trabaja-con-nosotros" className="btn btn-link btn-sm px-0">
      <i className="bi bi-arrow-left me-1" aria-hidden="true" />
      Ver todas las ofertas
    </Link>
  );

  if (!oferta || oferta.estado !== 'Abierta') {
    return (
      <div className="d-flex flex-column gap-3">
        {volver}
        <Mensaje tipo="warning" titulo="Oferta no disponible">
          La oferta que buscas no existe o ya cerró su proceso de postulación.
        </Mensaje>
      </div>
    );
  }

  const enviar = async ({ cv, ...datos }) => {
    setEnviando(true);
    setError(null);
    try {
      const { postulacion } = postular(oferta.id, datos);
      const cvGuardado = await subirCv(postulacion.id, cv, datos.nombre);
      setResultado({ nombre: datos.nombre, cvGuardado });
    } catch (excepcion) {
      setError(excepcion.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-3">
      <nav aria-label="miga de pan">{volver}</nav>

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <article className="card border-0 shadow-sm h-100" aria-labelledby="titulo-oferta">
            <div className="card-body">
              <span className="badge bg-light text-primary border mb-2">{oferta.area}</span>
              <h1 id="titulo-oferta" className="h4">
                {oferta.titulo}
              </h1>
              <ul className="list-unstyled small text-secondary mb-3">
                <li>
                  <i className="bi bi-geo-alt me-1" aria-hidden="true" />
                  {oferta.ubicacion} · {oferta.region}
                </li>
                <li>
                  <i className="bi bi-clock me-1" aria-hidden="true" />
                  {oferta.jornada}
                </li>
                <li>
                  <i className="bi bi-calendar3 me-1" aria-hidden="true" />
                  Publicada el {formatearFecha(oferta.fechaPublicacion)} · ID {oferta.id}
                </li>
              </ul>
              <h2 className="h6">Descripción del cargo</h2>
              <p>{oferta.descripcion}</p>
              {oferta.requisitos?.length ? (
                <>
                  <h2 className="h6">Requisitos</h2>
                  <ul className="mb-0">
                    {oferta.requisitos.map((requisito) => (
                      <li key={requisito}>{requisito}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </article>
        </div>

        <div className="col-12 col-lg-7">
          {resultado ? (
            <section className="card border-0 shadow-sm" aria-live="polite">
              <div className="card-body text-center py-5">
                <i className="bi bi-check-circle text-success fs-1" aria-hidden="true" />
                <h2 className="h5 mt-3">¡Gracias por postular, {resultado.nombre.split(' ')[0]}!</h2>
                <p className="text-secondary mb-0">
                  Recibimos tu postulación a <strong>{oferta.titulo}</strong>. Si tu perfil se ajusta,
                  un analista de Reclutamiento y Selección te contactará.
                </p>
                {!resultado.cvGuardado ? (
                  <p className="small text-secondary mt-3 mb-0">
                    Tu currículum quedó registrado; si lo necesitamos nuevamente te lo solicitaremos.
                  </p>
                ) : null}
                <Link to="/trabaja-con-nosotros" className="btn btn-outline-primary btn-sm mt-4">
                  Ver más ofertas
                </Link>
              </div>
            </section>
          ) : (
            <>
              {error ? (
                <Mensaje tipo="danger" titulo="No se pudo enviar la postulación">
                  {error}
                </Mensaje>
              ) : null}
              <FormularioPostulacion alEnviar={enviar} enviando={enviando} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
