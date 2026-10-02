import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import {
  contarPor,
  promedioDiasRespuesta,
  resumenSolicitudes,
  solicitudesPorFamilia,
  solicitudesRecientes,
} from '../dominio/indicadores';
import { formatearFecha } from '../dominio/formateo';
import EtiquetaEstado from '../componentes/comunes/EtiquetaEstado';
import EstadoVacio from '../componentes/comunes/EstadoVacio';
import TarjetaIndicador from '../componentes/comunes/TarjetaIndicador';
import DetalleIndicador from '../componentes/dashboard/DetalleIndicador';

const ID_DETALLE = 'detalle-indicador';

/** Texto en plural de cada estado para los títulos del detalle. */
const PLURAL_ESTADO = {
  Pendiente: 'pendientes',
  'En proceso': 'en proceso',
  Finalizada: 'finalizadas',
};

/** Dashboard con indicadores simples del proceso de evaluación. */
export default function Dashboard() {
  const { solicitudes, candidatos, evaluaciones } = useDatos();
  const navegar = useNavigate();
  const [seleccionada, setSeleccionada] = useState(null);

  const resumen = resumenSolicitudes(solicitudes);
  const porFamilia = solicitudesPorFamilia(solicitudes);
  const recientes = solicitudesRecientes(solicitudes, 5);
  const nombreCandidato = (id) =>
    candidatos.find((candidato) => candidato.id === Number(id))?.nombre ?? 'Sin candidato';
  const totalSolicitudes = Math.max(resumen.total, 1);

  const conNombre = (lista) =>
    solicitudesRecientes(lista, 5).map((solicitud) => ({
      ...solicitud,
      nombreCandidato: nombreCandidato(solicitud.candidatoId),
    }));
  const porProfesional = (lista) =>
    contarPor(lista, (solicitud) => solicitud.profesionalResponsable, 'Sin asignar');
  const porFamiliaCargo = (lista) => contarPor(lista, (item) => item.familiaCargo, 'Sin familia');

  const detalleDeEstado = (estado) => {
    const filtradas = solicitudes.filter((solicitud) => solicitud.estado === estado);
    const plural = PLURAL_ESTADO[estado] ?? estado.toLowerCase();
    return {
      titulo: `Solicitudes ${plural}`,
      resumen: `${filtradas.length} de ${resumen.total} solicitudes`,
      grupos: [
        { titulo: 'Por profesional responsable', filas: porProfesional(filtradas) },
        { titulo: 'Por familia de cargo', filas: porFamiliaCargo(filtradas) },
      ],
      solicitudes: conNombre(filtradas),
      textoListado: `Ver solicitudes ${plural}`,
      ruta: `/solicitudes?estado=${encodeURIComponent(estado)}`,
    };
  };

  const construirDetalle = (clave) => {
    switch (clave) {
      case 'candidatos':
        return {
          titulo: 'Candidatos registrados',
          resumen: `${candidatos.length} candidatos en la base de datos`,
          grupos: [
            { titulo: 'Por origen', filas: contarPor(candidatos, (candidato) => candidato.origen) },
            { titulo: 'Por familia de cargo', filas: porFamiliaCargo(candidatos) },
          ],
          textoListado: 'Ver candidatos',
          ruta: '/candidatos',
        };
      case 'solicitudes':
        return {
          titulo: 'Solicitudes totales',
          resumen: `${resumen.total} solicitudes en el histórico`,
          grupos: [
            { titulo: 'Por estado', filas: contarPor(solicitudes, (solicitud) => solicitud.estado) },
            { titulo: 'Por profesional responsable', filas: porProfesional(solicitudes) },
          ],
          solicitudes: conNombre(solicitudes),
          textoListado: 'Ver todas las solicitudes',
          ruta: '/solicitudes',
        };
      case 'evaluaciones': {
        const promedio = promedioDiasRespuesta(evaluaciones);
        return {
          titulo: 'Evaluaciones',
          resumen:
            promedio === null
              ? `${evaluaciones.length} evaluaciones registradas`
              : `${evaluaciones.length} evaluaciones · tiempo de respuesta promedio: ${promedio} días hábiles`,
          grupos: [
            {
              titulo: 'Por resultado',
              filas: contarPor(evaluaciones, (evaluacion) => evaluacion.resultado, 'Sin resultado'),
            },
            {
              titulo: 'Por estado de la evaluación',
              filas: contarPor(evaluaciones, (evaluacion) => evaluacion.estado),
            },
          ],
          textoListado: 'Ver solicitudes finalizadas',
          ruta: `/solicitudes?estado=${encodeURIComponent('Finalizada')}`,
        };
      }
      default:
        return detalleDeEstado(clave);
    }
  };

  const detalle = seleccionada ? construirDetalle(seleccionada) : null;
  const propsSeleccion = (clave) => ({
    alSeleccionar: () => setSeleccionada(clave),
    seleccionada: seleccionada === clave,
    controla: ID_DETALLE,
  });

  return (
    <div className="d-flex flex-column gap-4">
      <header className="d-flex flex-column flex-md-row justify-content-between gap-2">
        <div>
          <h1 className="h4 mb-1">Dashboard</h1>
          <p className="text-secondary mb-0">
            Resumen del proceso de evaluación psicolaboral de AquaChile.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary align-self-start"
          onClick={() => navegar('/solicitudes/nueva')}
        >
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          Nueva solicitud
        </button>
      </header>

      <div className="row g-3">
        <TarjetaIndicador
          titulo="Candidatos registrados"
          valor={candidatos.length}
          descripcion="En la base de datos"
          icono="bi-people"
          variante="primary"
          {...propsSeleccion('candidatos')}
        />
        <TarjetaIndicador
          titulo="Solicitudes totales"
          valor={resumen.total}
          descripcion="Histórico completo"
          icono="bi-file-earmark-text"
          variante="acento"
          {...propsSeleccion('solicitudes')}
        />
        <TarjetaIndicador
          titulo="Pendientes"
          valor={resumen.porEstado.Pendiente ?? 0}
          descripcion="Sin profesional asignado"
          icono="bi-hourglass-split"
          variante="secondary"
          {...propsSeleccion('Pendiente')}
        />
        <TarjetaIndicador
          titulo="En proceso"
          valor={resumen.porEstado['En proceso'] ?? 0}
          descripcion="En evaluación"
          icono="bi-arrow-repeat"
          variante="warning"
          {...propsSeleccion('En proceso')}
        />
        <TarjetaIndicador
          titulo="Finalizadas"
          valor={resumen.finalizadas}
          descripcion={`${resumen.porcentajeFinalizadas}% del total`}
          icono="bi-check2-circle"
          variante="success"
          {...propsSeleccion('Finalizada')}
        />
        <TarjetaIndicador
          titulo="Evaluaciones"
          valor={evaluaciones.length}
          descripcion="Registros de evaluación"
          icono="bi-clipboard-check"
          variante="dark"
          {...propsSeleccion('evaluaciones')}
        />
      </div>

      {detalle ? (
        <DetalleIndicador
          id={ID_DETALLE}
          titulo={detalle.titulo}
          resumen={detalle.resumen}
          grupos={detalle.grupos}
          solicitudes={detalle.solicitudes}
          textoListado={detalle.textoListado}
          alVerListado={() => navegar(detalle.ruta)}
          alAbrirSolicitud={(solicitud) => navegar(`/solicitudes/${solicitud.id}`)}
          alCerrar={() => setSeleccionada(null)}
        />
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <section className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <h2 className="h6 mb-0">Solicitudes recientes</h2>
              <button
                type="button"
                className="btn btn-link btn-sm"
                onClick={() => navegar('/solicitudes')}
              >
                Ver todas
              </button>
            </div>
            {recientes.length === 0 ? (
              <EstadoVacio
                titulo="Sin solicitudes"
                descripcion="Crea la primera solicitud de evaluación."
                icono="bi-file-earmark-text"
              />
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col">Candidato</th>
                      <th scope="col">Cargo</th>
                      <th scope="col">Fecha</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recientes.map((solicitud) => (
                      <tr key={solicitud.id}>
                        <td className="fw-semibold">{nombreCandidato(solicitud.candidatoId)}</td>
                        <td>{solicitud.cargo}</td>
                        <td>{formatearFecha(solicitud.fechaSolicitud)}</td>
                        <td>
                          <EtiquetaEstado valor={solicitud.estado} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="col-12 col-lg-5">
          <section className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white">
              <h2 className="h6 mb-0">Distribución por familia de cargo</h2>
            </div>
            <div className="card-body">
              {porFamilia.length === 0 ? (
                <p className="text-secondary mb-0">Aún no hay datos para mostrar.</p>
              ) : (
                porFamilia.map(({ familia, total }) => (
                  <div key={familia} className="mb-3">
                    <div className="d-flex justify-content-between small mb-1">
                      <span>{familia}</span>
                      <span className="text-secondary">{total}</span>
                    </div>
                    <div
                      className="progress"
                      role="progressbar"
                      aria-label={`Solicitudes de ${familia}`}
                      aria-valuenow={total}
                      aria-valuemin={0}
                      aria-valuemax={totalSolicitudes}
                    >
                      <div
                        className="progress-bar bg-primary"
                        style={{ width: `${(total / totalSolicitudes) * 100}%` }}
                      >
                        {total}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
