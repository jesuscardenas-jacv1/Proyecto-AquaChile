import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDatos } from '../../datos/DatosContext';
import { AREAS_OFERTA } from '../../datos/demoPostulaciones';
import { filtrarOfertas } from '../../dominio/postulaciones';
import { formatearFecha } from '../../dominio/formateo';
import EstadoVacio from '../../componentes/comunes/EstadoVacio';

/** Portal público: ofertas laborales abiertas de AquaChile, filtrables por área. */
export default function PortalOfertas() {
  const { ofertas } = useDatos();
  const [area, setArea] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const visibles = filtrarOfertas(ofertas, { area, busqueda });

  return (
    <div className="d-flex flex-column gap-4">
      <header className="text-center py-3">
        <h1 className="h3 mb-2">Ven a ser parte de nuestra comunidad</h1>
        <p className="text-secondary mb-0 mx-auto" style={{ maxWidth: '40rem' }}>
          Revisa nuestras ofertas laborales y postula con tus datos y currículum. Si tu perfil se ajusta,
          un analista del equipo de Reclutamiento y Selección te contactará.
        </p>
      </header>

      <section className="card border-0 shadow-sm" aria-label="Buscar ofertas">
        <div className="card-body row g-2">
          <div className="col-12 col-md-7">
            <label className="visually-hidden" htmlFor="buscar-oferta">
              Buscar ofertas
            </label>
            <input
              id="buscar-oferta"
              type="search"
              className="form-control"
              placeholder="Buscar por cargo, ubicación o región"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
            />
          </div>
          <div className="col-12 col-md-5">
            <label className="visually-hidden" htmlFor="area-oferta">
              Área
            </label>
            <select
              id="area-oferta"
              className="form-select"
              value={area}
              onChange={(evento) => setArea(evento.target.value)}
            >
              <option value="">Todas las áreas</option>
              {AREAS_OFERTA.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <p className="small text-secondary mb-0" aria-live="polite">
        {visibles.length} oferta{visibles.length === 1 ? '' : 's'} disponible{visibles.length === 1 ? '' : 's'}
      </p>

      {visibles.length === 0 ? (
        <section className="card border-0 shadow-sm">
          <EstadoVacio
            titulo="Sin ofertas"
            descripcion="No hay ofertas abiertas que coincidan con tu búsqueda."
            icono="bi-briefcase"
          />
        </section>
      ) : (
        <div className="row g-3">
          {visibles.map((oferta) => (
            <div key={oferta.id} className="col-12 col-md-6 col-xl-4">
              <article className="card border-0 shadow-sm h-100" aria-label={oferta.titulo}>
                <div className="card-body d-flex flex-column gap-2">
                  <span className="badge bg-light text-primary border align-self-start">{oferta.area}</span>
                  <h2 className="h6 mb-0">{oferta.titulo}</h2>
                  <p className="small text-secondary mb-0">
                    <i className="bi bi-geo-alt me-1" aria-hidden="true" />
                    {oferta.ubicacion} · {oferta.region}
                  </p>
                  <p className="small text-secondary mb-0">
                    <i className="bi bi-calendar3 me-1" aria-hidden="true" />
                    Publicada el {formatearFecha(oferta.fechaPublicacion)}
                  </p>
                  <Link
                    to={`/trabaja-con-nosotros/ofertas/${oferta.id}`}
                    className="btn btn-primary btn-sm mt-auto align-self-start"
                    aria-label={`Ver oferta ${oferta.titulo}`}
                  >
                    Ver oferta y postular
                  </Link>
                </div>
              </article>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
