import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorApi, apiDocumentos } from '../../servicios/apiDocumentos';
import { ARCHIVOS_PERMITIDOS } from '../../datos/constantes';
import { formatearFecha } from '../../dominio/formateo';
import Mensaje from '../comunes/Mensaje';

/** Categorías de la carpeta de la solicitud, en el orden en que se muestran. */
export const CATEGORIAS_DOCUMENTO = [
  { id: 'cv', etiqueta: 'CV del candidato', icono: 'bi-person-vcard' },
  { id: 'descriptor', etiqueta: 'Descriptor de cargo', icono: 'bi-file-earmark-text' },
  { id: 'informe', etiqueta: 'Informe psicolaboral', icono: 'bi-clipboard2-check' },
];
const OTROS = { id: 'otro', etiqueta: 'Otros archivos de la carpeta', icono: 'bi-folder2' };

const PROVEEDORES = {
  graph: { etiqueta: 'OneDrive', icono: 'bi-cloud-check' },
  local: { etiqueta: 'Almacenamiento local', icono: 'bi-hdd' },
};

function formatearTamano(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Documentos de la solicitud: CV, descriptor de cargo e informe psicolaboral.
 * Los archivos viven en la carpeta de la solicitud (OneDrive/SharePoint o disco local,
 * según el backend); este panel solo los muestra, sube, descarga y elimina.
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
  const entradas = useRef({});

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
  const archivos = datos?.archivos ?? [];
  const permisos = datos?.permisos ?? [];
  const categorias = archivos.some((archivo) => archivo.categoria === 'otro')
    ? [...CATEGORIAS_DOCUMENTO, OTROS]
    : CATEGORIAS_DOCUMENTO;

  return (
    <section className="card border-0 shadow-sm" aria-labelledby="titulo-documentos">
      <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h2 id="titulo-documentos" className="h6 mb-0">
            Documentos
          </h2>
          {datos ? (
            <small className="text-secondary">
              <i className="bi bi-folder2-open me-1" aria-hidden="true" />
              {datos.carpeta ? datos.carpeta.nombre : 'La carpeta se crea al subir el primer archivo'}
            </small>
          ) : null}
        </div>
        <div className="d-flex align-items-center gap-2">
          {proveedor ? (
            <span className="badge bg-light text-secondary border fw-medium">
              <i className={`bi ${proveedor.icono} me-1`} aria-hidden="true" />
              {proveedor.etiqueta}
            </span>
          ) : null}
          {datos?.carpeta?.webUrl ? (
            <a
              href={datos.carpeta.webUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
            >
              <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
              Abrir en OneDrive
            </a>
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
          <ul className="list-unstyled mb-0 documentos-lista">
            {categorias.map((categoria) => {
              const deCategoria = archivos.filter((archivo) => archivo.categoria === categoria.id);
              const puedeSubir = permisos.includes(categoria.id);
              return (
                <li key={categoria.id} className="documentos-categoria">
                  <div className="d-flex align-items-center justify-content-between gap-2">
                    <h3 className="h6 small fw-semibold mb-0 d-flex align-items-center gap-2">
                      <i className={`bi ${categoria.icono} text-secondary`} aria-hidden="true" />
                      {categoria.etiqueta}
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
                    <p className="small text-secondary mb-0 mt-1 ps-4">Sin archivos.</p>
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
                            title="Descargar"
                            onClick={() =>
                              ejecutar(archivo.id, () => api.descargar(solicitud.id, archivo))
                            }
                          >
                            <i className="bi bi-file-earmark-arrow-down me-1" aria-hidden="true" />
                            {archivo.nombre}
                          </button>
                          <span className="d-flex align-items-center gap-2 flex-shrink-0">
                            <small className="text-secondary">
                              {formatearTamano(archivo.tamano)}
                              {archivo.modificado ? ` · ${formatearFecha(archivo.modificado)}` : ''}
                            </small>
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
    </section>
  );
}
