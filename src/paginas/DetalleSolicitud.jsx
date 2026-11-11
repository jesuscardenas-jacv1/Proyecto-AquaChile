import { useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { useAuth } from '../datos/AuthContext';
import { formatearFecha } from '../dominio/formateo';
import { etapaDeSolicitud } from '../dominio/planner';
import { resolverDescriptor } from '../datos/catalogos';
import { normalizar } from '../dominio/texto';
import EtiquetaEstado from '../componentes/comunes/EtiquetaEstado';
import Mensaje from '../componentes/comunes/Mensaje';
import PanelGestion from '../componentes/solicitudes/PanelGestion';
import FormularioEvaluacion from '../componentes/evaluacion/FormularioEvaluacion';
import PanelDocumentos from '../componentes/solicitudes/PanelDocumentos';
import FormularioEdicionSolicitud from '../componentes/solicitudes/FormularioEdicionSolicitud';
import { apiDocumentos } from '../servicios/apiDocumentos';
import { apiIa, useIaDisponible } from '../servicios/apiIa';

/** Detalle de solicitud: datos del candidato, seguimiento y evaluación. El avance se gestiona en el Planner. */
export default function DetalleSolicitud() {
  const iaDisponible = useIaDisponible();
  const { id } = useParams();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const { esAnalista, esEvaluador, soloLectura } = useAuth();
  const {
    obtenerSolicitud,
    obtenerCandidato,
    obtenerEvaluacionDeSolicitud,
    editarSolicitud,
    asignarProfesional,
    registrarEvaluacion,
    cargos,
    registrarCargo,
  } = useDatos();
  const [versionDocumentos, setVersionDocumentos] = useState(0);
  const [avisoInforme, setAvisoInforme] = useState(null);
  const [editando, setEditando] = useState(false);
  const [guardandoEvaluacion, setGuardandoEvaluacion] = useState(false);
  const [avisoEdicion, setAvisoEdicion] = useState(null);

  const solicitud = obtenerSolicitud(id);
  const mensaje = ubicacion.state?.mensaje;
  const tipo = ubicacion.state?.tipo ?? 'success';

  if (!solicitud) {
    return (
      <Mensaje tipo="warning" titulo="Solicitud no encontrada">
        La solicitud solicitada no existe.
        <div className="mt-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => navegar('/solicitudes')}
          >
            Volver al listado
          </button>
        </div>
      </Mensaje>
    );
  }

  const candidato = obtenerCandidato(solicitud.candidatoId);
  const evaluacion = obtenerEvaluacionDeSolicitud(solicitud.id);
  // Se evalúa con la entrevista ya realizada (el Planner trae hasta aquí); después, se puede corregir el informe.
  const puedeEvaluar = ['realizada', 'informe'].includes(etapaDeSolicitud(solicitud));
  /**
   * Registra la evaluación y guarda el informe oficial (PDF) en la carpeta de la solicitud.
   * Si el servicio de documentos no responde, la evaluación queda registrada igual.
   */
  const guardarEvaluacion = async (datos) => {
    setGuardandoEvaluacion(true);
    try {
      const registro = await registrarEvaluacion(solicitud.id, datos);
      if (!registro) return;
      const nombre = candidato?.nombre ?? 'el candidato';
      // Al guardar, la solicitud queda finalizada: se vuelve al Planner con un aviso en la esquina.
      let aviso = {
        tipo: 'success',
        mensaje: `Evaluación ${evaluacion ? 'actualizada' : 'registrada'}: ${nombre}. La solicitud quedó finalizada en "Informe enviado".`,
      };
      if (!apiDocumentos.conectado()) {
        aviso = {
          tipo: 'warning',
          mensaje: 'Evaluación registrada. El informe no se guardó en la carpeta porque el servicio de documentos no está conectado.',
        };
      } else {
        try {
          await apiDocumentos.generarInforme(solicitud.id, { candidato, solicitud, evaluacion: registro });
        } catch (error) {
          aviso = {
            tipo: 'warning',
            mensaje: `Evaluación registrada, pero no se pudo guardar el informe en la carpeta: ${error.message}`,
          };
        }
      }
      navegar('/planner', { state: aviso });
    } finally {
      setGuardandoEvaluacion(false);
    }
  };

  /**
   * Deja en la carpeta el descriptor del cargo nuevo. El backend quita el anterior y copia el
   * guardado; el analista además sube el del catálogo o el adjuntado, como al crear la solicitud.
   */
  const actualizarDescriptor = async (cambios, archivoDescriptor) => {
    const nombreCandidato = candidato?.nombre;
    const descriptor = resolverDescriptor({ cargo: cambios.cargo, cargosGuardados: cargos });
    if (archivoDescriptor && !apiDocumentos.conectado()) {
      registrarCargo({
        nombre: cambios.cargo,
        familiaCargo: cambios.familiaCargo,
        descriptorNombre: archivoDescriptor.name,
      });
    }
    if (!apiDocumentos.conectado()) return;

    await apiDocumentos.sincronizarDescriptor(solicitud.id, nombreCandidato);
    if (!esAnalista) return;
    if (descriptor.origen === 'catalogo') {
      const archivo = await apiDocumentos.archivoDescriptorCatalogo(descriptor.nombre);
      await apiDocumentos.subir(solicitud.id, { categoria: 'descriptor', archivo, nombreCandidato });
    } else if (archivoDescriptor) {
      await apiDocumentos.subir(solicitud.id, { categoria: 'descriptor', archivo: archivoDescriptor, nombreCandidato });
      registrarCargo(
        await apiDocumentos.subirDescriptorCargo({
          cargo: cambios.cargo,
          familiaCargo: cambios.familiaCargo,
          archivo: archivoDescriptor,
        }),
      );
    }
  };

  const guardarEdicion = async (cambios, archivoDescriptor) => {
    const cambioCargo = normalizar(cambios.cargo) !== normalizar(solicitud.cargo ?? '');
    const actualizada = await editarSolicitud(solicitud.id, cambios);
    if (!actualizada) return;
    setEditando(false);
    let aviso = { tipo: 'success', texto: 'Datos de la solicitud actualizados.' };
    if (cambioCargo) {
      try {
        await actualizarDescriptor(cambios, archivoDescriptor);
      } catch {
        aviso = {
          tipo: 'warning',
          texto: 'Datos actualizados, pero no se pudo actualizar el descriptor en la carpeta: revísalo en Documentos.',
        };
      }
      setVersionDocumentos((version) => version + 1);
    }
    setAvisoEdicion(aviso);
  };

  const datosSolicitud = [
    ['Reclutador/a', solicitud.reclutador],
    ['Ubicación', [solicitud.ubicacion, solicitud.unidad].filter(Boolean).join(' · ')],
    ['CECO', solicitud.ceco],
    ['Requiere referencias', solicitud.requiereReferencias ? 'Sí' : 'No'],
    // Con el servicio de documentos, el CV y el descriptor se ven (y suben) en Documentos.
    ...(apiDocumentos.conectado()
      ? []
      : [
          ['CV', solicitud.cv],
          ['Descriptor de cargo', solicitud.descriptorCargo],
        ]),
  ];

  return (
    <div className="d-flex flex-column gap-3">
      <nav aria-label="miga de pan">
        <button
          type="button"
          className="btn btn-link btn-sm px-0"
          onClick={() => navegar('/solicitudes')}
        >
          <i className="bi bi-arrow-left me-1" aria-hidden="true" />
          Volver a solicitudes
        </button>
      </nav>

      <header className="d-flex flex-column flex-md-row justify-content-between gap-2">
        <div>
          <h1 className="h4 mb-1">
            Solicitud #{solicitud.id} · {candidato ? candidato.nombre : 'Candidato eliminado'}
          </h1>
          <p className="text-secondary mb-0">
            {solicitud.cargo} · {solicitud.familiaCargo} · {formatearFecha(solicitud.fechaSolicitud)}
          </p>
        </div>
        <EtiquetaEstado valor={solicitud.estado} className="align-self-start fs-6" />
      </header>

      {solicitud.cierre ? (
        <Mensaje tipo="warning" titulo={`Cerrada sin evaluación: ${solicitud.cierre.motivo}`}>
          {formatearFecha(solicitud.cierre.fecha)}
          {solicitud.cierre.responsable ? ` · ${solicitud.cierre.responsable}` : ''}
          {solicitud.cierre.comentario ? <span className="d-block">{solicitud.cierre.comentario}</span> : null}
          {esEvaluador ? <span className="d-block mt-2 small">Se puede reabrir desde el Planner.</span> : null}
        </Mensaje>
      ) : null}

      {mensaje ? (
        <Mensaje tipo={tipo} alCerrar={() => navegar(`/solicitudes/${solicitud.id}`, { replace: true })}>
          {mensaje}
        </Mensaje>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <section className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white">
              <h2 className="h6 mb-0">Datos del candidato</h2>
            </div>
            <div className="card-body">
              {candidato ? (
                <dl className="row mb-0 small">
                  <dt className="col-5 text-secondary">Nombre</dt>
                  <dd className="col-7">{candidato.nombre}</dd>
                  <dt className="col-5 text-secondary">Correo</dt>
                  <dd className="col-7">{candidato.correo}</dd>
                  <dt className="col-5 text-secondary">Teléfono</dt>
                  <dd className="col-7">{candidato.telefono}</dd>
                  <dt className="col-5 text-secondary">Cargo</dt>
                  <dd className="col-7">{candidato.cargo}</dd>
                  <dt className="col-5 text-secondary">Familia</dt>
                  <dd className="col-7">{candidato.familiaCargo}</dd>
                  {candidato.origen ? (
                    <>
                      <dt className="col-5 text-secondary">Origen</dt>
                      <dd className="col-7">
                        {candidato.origen}
                        {solicitud.referido === true ? ' · Referido/a' : ''}
                      </dd>
                    </>
                  ) : null}
                </dl>
              ) : (
                <p className="text-secondary mb-0">
                  El candidato asociado fue eliminado del registro.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="col-12 col-lg-7">
          <PanelGestion
            solicitud={solicitud}
            alAsignarProfesional={(profesional) => asignarProfesional(solicitud.id, profesional)}
            soloLectura={soloLectura}
            puedeAsignar={esAnalista}
            puedeGestionar={esEvaluador}
          />
        </div>
      </div>

      <section className="card border-0 shadow-sm">
        <div className="card-header bg-white d-flex justify-content-between align-items-center gap-2">
          <h2 className="h6 mb-0">Datos de la solicitud</h2>
          {!soloLectura && !editando ? (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
              onClick={() => {
                setAvisoEdicion(null);
                setEditando(true);
              }}
            >
              <i className="bi bi-pencil" aria-hidden="true" />
              Editar
            </button>
          ) : null}
        </div>
        <div className="card-body">
          {avisoEdicion ? (
            <Mensaje tipo={avisoEdicion.tipo} alCerrar={() => setAvisoEdicion(null)}>
              {avisoEdicion.texto}
            </Mensaje>
          ) : null}
          {editando ? (
            <FormularioEdicionSolicitud
              solicitud={solicitud}
              origenCandidato={candidato?.origen}
              cargosGuardados={cargos}
              puedeSubirDescriptor={esAnalista}
              alGuardar={guardarEdicion}
              alCancelar={() => setEditando(false)}
            />
          ) : (
            <>
              <dl className="row mb-0 small">
                {datosSolicitud.map(([etiqueta, valor]) => (
                  <div key={etiqueta} className="col-12 col-sm-6 col-lg-4 mb-2">
                    <dt className="text-secondary fw-normal">{etiqueta}</dt>
                    <dd className="mb-0 text-break">{valor || '—'}</dd>
                  </div>
                ))}
              </dl>
              {solicitud.observaciones ? (
                <div className="mt-3">
                  <h3 className="h6 text-secondary small mb-1">Aspectos a indagar</h3>
                  <p className="mb-0">{solicitud.observaciones}</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <PanelDocumentos
        solicitud={solicitud}
        nombreCandidato={candidato?.nombre}
        actualizacion={versionDocumentos}
      />

      <section className="card border-0 shadow-sm">
        <div className="card-header bg-white d-flex flex-wrap justify-content-between gap-2 align-items-center">
          <h2 className="h6 mb-0">Evaluación psicolaboral</h2>
          {evaluacion ? (
            <div className="d-flex align-items-center flex-wrap gap-2">
              <Link
                to={`/solicitudes/${solicitud.id}/informe`}
                className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                title="Generar e imprimir informe oficial de la evaluación"
              >
                <i className="bi bi-printer" aria-hidden="true" />
                <span>Ver Informe Oficial</span>
              </Link>
              <EtiquetaEstado valor={evaluacion.resultado} contexto="resultado" />
              <EtiquetaEstado valor={evaluacion.estado} contexto="evaluacion" />
            </div>
          ) : (
            <span className="badge bg-light text-secondary">Sin evaluación</span>
          )}
        </div>
        <div className="card-body">
          {/* Vista para el profesional evaluador (acceso clínico completo) */}
          {esEvaluador && (
            <>
              {avisoInforme ? (
                <Mensaje tipo={avisoInforme.tipo} alCerrar={() => setAvisoInforme(null)}>
                  {avisoInforme.texto}
                </Mensaje>
              ) : null}

              {!puedeEvaluar && !solicitud.cierre ? (
                <Mensaje tipo="info">
                  Para registrar la evaluación, primero marca la entrevista como realizada en el{' '}
                  <Link to="/planner">Planner</Link>.
                </Mensaje>
              ) : null}

              {evaluacion ? (
                <div className="mb-3">
                  <p className="small text-secondary mb-1">
                    Fecha de evaluación: {formatearFecha(evaluacion.fechaEvaluacion)}
                  </p>
                  <p className="mb-0">{evaluacion.observaciones}</p>
                </div>
              ) : null}

              {puedeEvaluar ? (
                <FormularioEvaluacion
                  evaluacion={evaluacion}
                  alGuardar={guardarEvaluacion}
                  guardando={guardandoEvaluacion}
                  alGenerarBorrador={iaDisponible ? (notas) => apiIa.borradorEvaluacion(solicitud.id, notas) : null}
                />
              ) : null}
            </>
          )}

          {/* Analista y jefatura: solo el dictamen final, las observaciones son confidenciales */}
          {!esEvaluador && (
            <>
              {evaluacion ? (
                <div className="d-flex flex-column gap-2">
                  <div className="p-3 bg-light rounded border d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div>
                      <span className="text-secondary small d-block">Dictamen de la evaluación:</span>
                      <strong className="fs-6">{evaluacion.resultado}</strong>
                      <span className="text-secondary small d-block mt-1">
                        Fecha de informe: {formatearFecha(evaluacion.fechaEvaluacion)}
                      </span>
                    </div>
                    <EtiquetaEstado valor={evaluacion.resultado} contexto="resultado" />
                  </div>
                  <p className="small text-secondary fst-italic mb-0">
                    * Las notas clínicas y pauta detallada de entrevista son confidenciales del profesional evaluador.
                  </p>
                </div>
              ) : (
                <p className="text-secondary mb-0">
                  La evaluación aún no ha sido realizada por el profesional asignado.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
