import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorApi, apiDocumentos } from '../../servicios/apiDocumentos';
import { ARCHIVOS_PERMITIDOS } from '../../datos/constantes';
import { useAuth } from '../../datos/AuthContext';
import { nombreCarpetaSolicitud } from '../../dominio/documentos';
import { formatearFecha } from '../../dominio/formateo';
import Mensaje from '../comunes/Mensaje';
import VentanaDocumento from './VentanaDocumento';
import { esDescriptorCatalogo } from '../../datos/catalogos';
import { documentoCatalogo } from '../../servicios/apiDocumentos';

/** Categorías de la carpeta de la solicitud, en el orden en que se muestran. */
export const CATEGORIAS_DOCUMENTO = [
  { id: 'cv', etiqueta: 'CV del candidato', icono: 'bi-person-vcard' },
  { id: 'descriptor', etiqueta: 'Descriptor de cargo', icono: 'bi-file-earmark-text' },
  { id: 'informe', etiqueta: 'Informe psicolaboral', icono: 'bi-clipboard2-check' },
  // Confidencial: el backend solo la muestra a la psicóloga (y al administrador).
  { id: 'pauta', etiqueta: 'Pauta de entrevista', icono: 'bi-journal-text', confidencial: true },
];
const OTROS = { id: 'otro', etiqueta: 'Otros archivos de la carpeta', icono: 'bi-folder2' };

const PROVEEDORES = {
  drive: { etiqueta: 'Google Drive', icono: 'bi-google' },
  graph: { etiqueta: 'OneDrive', icono: 'bi-cloud-check' },
  local: { etiqueta: 'Almacenamiento local', icono: 'bi-hdd' },
};

function formatearTamano(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Carpeta de documentos de la solicitud: CV, descriptor de cargo e informe psicolaboral.
 * Al pincharla lista los archivos y al pinchar uno se abre dentro del portal (el backend
 * decide dónde viven). También sube, descarga y elimina. La insignia del proveedor
 * lleva a la carpeta en Google Drive u OneDrive.
 */
export default function PanelDocumentos({
  solicitud,
  nombreCandidato,
  api = apiDocumentos,
  actualizacion = 0,
}) {
  const [estado, setEstado] = useState({ cargando: true });
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [abierta, setAbierta] = useState(false);
  const [documento, setDocumento] = useState(null);
  const [documentoReferencia, setDocumentoReferencia] = useState(null);
  const { soloLectura } = useAuth();
  const entradas = useRef({});
  // Nombres que la solicitud trae de su creación (el CV elegido y el descriptor del
  // catálogo de cargos): se muestran como referencia mientras no estén en la carpeta.
  const referencias = { cv: solicitud.cv, descriptor: solicitud.descriptorCargo };

  const cargar = useCallback(async () => {
    // Sin sesión en el backend no tiene sentido llamar: se informa de inmediato.
    if (api.conectado && !api.conectado()) {
      setEstado({
        cargando: false,
        error: new ErrorApi('Sin conexión con el servicio de documentos.', { noDisponible: true }),
      });
      return;
    }
    setEstado((actual) => ({ ...actual, cargando: true, error: null }));
    try {
      const datos = await api.listar(solicitud.id);
      setEstado({ cargando: false, datos });
    } catch (error) {
      setEstado({ cargando: false, error });
    }
  }, [api, solicitud.id]);

  // `actualizacion` cambia cuando otra parte de la página agrega archivos (p. ej. el informe).
  useEffect(() => {
    cargar();
  }, [cargar, actualizacion]);

  const ejecutar = async (clave, accion, mensajeExito) => {
    setOcupado(clave);
    setAviso(null);
    try {
      await accion();
      if (mensajeExito) setAviso({ tipo: 'success', texto: mensajeExito });
      await cargar();
    } catch (error) {
      setAviso({ tipo: 'danger', texto: error.message });
    } finally {
      setOcupado(null);
    }
  };

  const alElegirArchivo = (categoria) => async (evento) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;
    if (archivo.size > ARCHIVOS_PERMITIDOS.tamanoMaximoMb * 1024 * 1024) {
      setAviso({
        tipo: 'danger',
        texto: `El archivo supera el máximo de ${ARCHIVOS_PERMITIDOS.tamanoMaximoMb} MB.`,
      });
      return;
    }
    await ejecutar(
      categoria.id,
      () => api.subir(solicitud.id, { categoria: categoria.id, archivo, nombreCandidato }),
      `"${archivo.name}" se guardó en la carpeta de la solicitud.`,
    );
  };

  const alEliminar = (archivo) => {
    if (!window.confirm(`¿Eliminar "${archivo.nombre}" de la carpeta de la solicitud?`)) return;
    ejecutar(archivo.id, () => api.eliminar(solicitud.id, archivo.id), 'Documento eliminado.');
  };

  const { cargando, datos, error } = estado;
  const proveedor = PROVEEDORES[datos?.proveedor];
  // La jefatura solo consulta en el portal; la carpeta en la nube es para quien trabaja el proceso.
  const enlaceCarpeta = soloLectura ? null : datos?.carpeta?.webUrl;
  const archivos = datos?.archivos ?? [];
  const permisos = datos?.permisos ?? [];
  // Las categorías confidenciales solo aparecen para quien puede subirlas o ya tiene archivos en ellas.
  const visibles = CATEGORIAS_DOCUMENTO.filter(
    (categoria) =>
      !categoria.confidencial ||
      permisos.includes(categoria.id) ||
      archivos.some((archivo) => archivo.categoria === categoria.id),
  );
  const categorias = archivos.some((archivo) => archivo.categoria === 'otro') ? [...visibles, OTROS] : visibles;
  const idLista = `carpeta-solicitud-${solicitud.id}`;
  const nombreDeCarpeta = datos?.carpeta?.nombre ?? nombreCarpetaSolicitud(solicitud.id, nombreCandidato);
  const textoCantidad =
    archivos.length === 0
      ? 'Sin documentos todavía'
      : `${archivos.length} ${archivos.length === 1 ? 'documento' : 'documentos'}`;

  return (
    <section className="card border-0 shadow-sm" aria-labelledby="titulo-documentos">
      <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h2 id="titulo-documentos" className="h6 mb-0">
            Documentos
          </h2>
        </div>
        <div className="d-flex align-items-center gap-2">
          {/* La insignia abre la carpeta en la nube; Drive decide si la cuenta del usuario tiene acceso. */}
          {proveedor && enlaceCarpeta ? (
            <a
              href={enlaceCarpeta}
              target="_blank"
              rel="noreferrer"
              className="badge bg-light text-secondary border fw-medium text-decoration-none"
              aria-label={`Abrir la carpeta en ${proveedor.etiqueta}`}
              title={`Abrir la carpeta en ${proveedor.etiqueta}`}
            >
              <i className={`bi ${proveedor.icono} me-1`} aria-hidden="true" />
              {proveedor.etiqueta}
              <i className="bi bi-box-arrow-up-right ms-1" aria-hidden="true" />
            </a>
          ) : proveedor ? (
            <span className="badge bg-light text-secondary border fw-medium">
              <i className={`bi ${proveedor.icono} me-1`} aria-hidden="true" />
              {proveedor.etiqueta}
            </span>
          ) : null}
        </div>
      </div>

      <div className="card-body">
        {aviso ? (
          <Mensaje tipo={aviso.tipo} alCerrar={() => setAviso(null)}>
            {aviso.texto}
          </Mensaje>
        ) : null}

        {cargando && !datos ? (
          <p className="text-secondary small mb-0" role="status">
            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
            Cargando documentos…
          </p>
        ) : null}

        {error ? (
          <Mensaje
            tipo={error.noDisponible ? 'info' : 'danger'}
            titulo={error.noDisponible ? 'Documentos no disponibles' : 'No se pudieron cargar los documentos'}
          >
            {error.noDisponible
              ? 'El servicio de documentos no está conectado. Verifique que el backend esté en ejecución y vuelva a iniciar sesión.'
              : error.message}
            <div className="mt-2">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={cargar}>
                Reintentar
              </button>
            </div>
          </Mensaje>
        ) : null}

        {datos ? (
          <button
            type="button"
            className="carpeta-documentos d-flex align-items-center gap-3 w-100 text-start"
            aria-expanded={abierta}
            aria-controls={idLista}
            aria-label={`Carpeta ${nombreDeCarpeta}: ${textoCantidad}`}
            onClick={() => setAbierta((valor) => !valor)}
          >
            <i className={`bi ${abierta ? 'bi-folder2-open' : 'bi-folder-fill'} carpeta-documentos-icono`} aria-hidden="true" />
            <span className="flex-grow-1 overflow-hidden">
              <span className="d-block fw-semibold text-truncate">{nombreDeCarpeta}</span>
              <small className="text-secondary">{textoCantidad}</small>
            </span>
            <i className={`bi ${abierta ? 'bi-chevron-up' : 'bi-chevron-down'} text-secondary`} aria-hidden="true" />
          </button>
        ) : null}

        {datos && abierta ? (
          <ul id={idLista} className="list-unstyled mb-0 mt-3 documentos-lista">
            {categorias.map((categoria) => {
              const deCategoria = archivos.filter((archivo) => archivo.categoria === categoria.id);
              const puedeSubir = permisos.includes(categoria.id);
              return (
                <li key={categoria.id} className="documentos-categoria">
                  <div className="d-flex align-items-center justify-content-between gap-2">
                    <h3 className="h6 small fw-semibold mb-0 d-flex align-items-center gap-2">
                      <i className={`bi ${categoria.icono} text-secondary`} aria-hidden="true" />
                      {categoria.etiqueta}
                      {categoria.confidencial ? (
                        <span className="badge text-bg-light border fw-normal" title="Solo la ve la psicóloga">
                          <i className="bi bi-lock-fill me-1" aria-hidden="true" />
                          Confidencial
                        </span>
                      ) : null}
                    </h3>
                    {puedeSubir ? (
                      <>
                        <input
                          ref={(nodo) => {
                            entradas.current[categoria.id] = nodo;
                          }}
                          type="file"
                          className="d-none"
                          accept={ARCHIVOS_PERMITIDOS.extensiones}
                          aria-label={`Archivo para ${categoria.etiqueta}`}
                          onChange={alElegirArchivo(categoria)}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                          disabled={ocupado !== null}
                          onClick={() => entradas.current[categoria.id]?.click()}
                        >
                          {ocupado === categoria.id ? (
                            <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                          ) : (
                            <i className="bi bi-upload" aria-hidden="true" />
                          )}
                          Subir
                        </button>
                      </>
                    ) : null}
                  </div>

                  {deCategoria.length === 0 ? (
                    <p className="small text-secondary mb-0 mt-1 ps-4">
                      Sin archivos.
                      {referencias[categoria.id] ? (
                        <>
                          {' '}
                          En la solicitud se indicó <strong>{referencias[categoria.id]}</strong>
                          {puedeSubir ? '; súbelo aquí para guardarlo en la carpeta.' : ', pero aún no está en la carpeta.'}
                          {categoria.id === 'descriptor' && esDescriptorCatalogo(referencias.descriptor) ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary py-0 px-2 ms-2"
                              aria-label={`Ver ${referencias.descriptor}`}
                              title="Vista previa"
                              onClick={() =>
                                setDocumentoReferencia({
                                  archivo: { nombre: referencias.descriptor },
                                  api: documentoCatalogo(referencias.descriptor),
                                })
                              }
                            >
                              <i className="bi bi-eye" aria-hidden="true" />
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </p>
                  ) : (
                    <ul className="list-unstyled mb-0 mt-2 ps-4 d-flex flex-column gap-1">
                      {deCategoria.map((archivo) => (
                        <li
                          key={archivo.id}
                          className="documentos-archivo d-flex align-items-center justify-content-between gap-2"
                        >
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-start text-break"
                            title="Ver documento"
                            onClick={() => setDocumento(archivo)}
                          >
                            <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />
                            {archivo.nombre}
                          </button>
                          <span className="d-flex align-items-center gap-2 flex-shrink-0">
                            <small className="text-secondary">
                              {formatearTamano(archivo.tamano)}
                              {archivo.modificado ? ` · ${formatearFecha(archivo.modificado)}` : ''}
                            </small>
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-0"
                              aria-label={`Descargar ${archivo.nombre}`}
                              title="Descargar"
                              disabled={ocupado !== null}
                              onClick={() => ejecutar(archivo.id, () => api.descargar(solicitud.id, archivo))}
                            >
                              <i className="bi bi-download" aria-hidden="true" />
                            </button>
                            {archivo.puedeEliminar ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-danger p-0"
                                aria-label={`Eliminar ${archivo.nombre}`}
                                disabled={ocupado !== null}
                                onClick={() => alEliminar(archivo)}
                              >
                                <i className="bi bi-trash3" aria-hidden="true" />
                              </button>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {documentoReferencia ? (
        <VentanaDocumento
          archivo={documentoReferencia.archivo}
          api={documentoReferencia.api}
          alCerrar={() => setDocumentoReferencia(null)}
        />
      ) : null}
      {documento ? (
        <VentanaDocumento
          solicitudId={solicitud.id}
          archivo={documento}
          api={api}
          alCerrar={() => setDocumento(null)}
        />
      ) : null}
    </section>
  );
}
