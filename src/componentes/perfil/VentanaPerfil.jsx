import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { guardarFotoLocal, useAuth } from '../../datos/AuthContext';
import { ROLES } from '../../datos/usuarios';
import { hayErrores, validarCambioContrasena } from '../../dominio/validaciones';
import { apiPerfil } from '../../servicios/api';
import { reducirFoto, TIPOS_FOTO, validarArchivoFoto } from '../../servicios/imagen';
import Mensaje from '../comunes/Mensaje';
import AvatarUsuario from './AvatarUsuario';

const SELECTOR_ENFOCABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const CONTRASENA_VACIA = { actual: '', nueva: '', confirmacion: '' };

/** Formulario para cambiar la contraseña (pide la actual). */
function FormularioContrasena({ api, alTerminar, alCancelar }) {
  const [campos, setCampos] = useState(CONTRASENA_VACIA);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const cambiar = (evento) => {
    const { name, value } = evento.target;
    setCampos((actual) => ({ ...actual, [name]: value }));
    setErrores((actual) => ({ ...actual, [name]: undefined }));
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    const nuevosErrores = validarCambioContrasena(campos);
    setErrores(nuevosErrores);
    if (hayErrores(nuevosErrores)) return;
    setGuardando(true);
    try {
      await api.cambiarContrasena(campos.actual, campos.nueva);
      alTerminar({ tipo: 'success', texto: 'Tu contraseña se actualizó. Úsala la próxima vez que inicies sesión.' });
    } catch (error) {
      setErrores({ actual: error.message });
    } finally {
      setGuardando(false);
    }
  };

  const campo = (nombre, etiqueta, autoComplete) => (
    <div className="col-12">
      <label className="form-label small" htmlFor={`perfil-${nombre}`}>
        {etiqueta}
      </label>
      <input
        id={`perfil-${nombre}`}
        name={nombre}
        type="password"
        autoComplete={autoComplete}
        className={`form-control form-control-sm ${errores[nombre] ? 'is-invalid' : ''}`.trim()}
        value={campos[nombre]}
        onChange={cambiar}
      />
      {errores[nombre] ? <div className="invalid-feedback">{errores[nombre]}</div> : null}
    </div>
  );

  return (
    <form onSubmit={enviar} noValidate aria-label="Cambiar contraseña" className="border rounded p-3 mt-2">
      <div className="row g-2">
        {campo('actual', 'Contraseña actual', 'current-password')}
        {campo('nueva', 'Nueva contraseña (mínimo 8 caracteres)', 'new-password')}
        {campo('confirmacion', 'Repite la nueva contraseña', 'new-password')}
      </div>
      <div className="d-flex justify-content-end gap-2 mt-3">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={alCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-sm btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </div>
    </form>
  );
}

/**
 * Ventana "Mi perfil" que se abre desde el avatar del menú lateral: datos del usuario,
 * lo que permite su rol, la foto de perfil y el cambio de contraseña. Con servidor la
 * foto y la contraseña se guardan en la base de datos; sin servidor la foto queda en
 * este navegador y la contraseña no se puede cambiar (son las de demostración).
 */
export default function VentanaPerfil({ conServidor = false, alCerrar, alCerrarSesion, api = apiPerfil }) {
  const { usuarioActual, actualizarUsuario } = useAuth();
  const [aviso, setAviso] = useState(null);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [editandoContrasena, setEditandoContrasena] = useState(false);
  const refDialogo = useRef(null);
  const refCerrarBoton = useRef(null);
  const refArchivo = useRef(null);
  const refCerrar = useRef(alCerrar);
  refCerrar.current = alCerrar;

  useEffect(() => {
    const enfocadoAntes = document.activeElement;
    document.body.classList.add('modal-open');
    refCerrarBoton.current?.focus();

    const alPresionarTecla = (evento) => {
      if (evento.key === 'Escape') {
        refCerrar.current();
        return;
      }
      if (evento.key !== 'Tab' || !refDialogo.current) return;
      const enfocables = [...refDialogo.current.querySelectorAll(SELECTOR_ENFOCABLES)];
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alPresionarTecla);

    return () => {
      document.removeEventListener('keydown', alPresionarTecla);
      document.body.classList.remove('modal-open');
      enfocadoAntes?.focus?.();
    };
  }, []);

  if (!usuarioActual) return null;
  const rol = ROLES[usuarioActual.rol];

  const elegirFoto = async (evento) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;
    const error = validarArchivoFoto(archivo);
    if (error) {
      setAviso({ tipo: 'danger', texto: error });
      return;
    }
    setAviso(null);
    setProcesandoFoto(true);
    try {
      const foto = await reducirFoto(archivo);
      if (conServidor) await api.guardarFoto(foto);
      else guardarFotoLocal(usuarioActual.id, foto);
      actualizarUsuario({ foto });
      setAviso({ tipo: 'success', texto: 'Tu foto de perfil se actualizó.' });
    } catch (excepcion) {
      setAviso({ tipo: 'danger', texto: excepcion.message });
    } finally {
      setProcesandoFoto(false);
    }
  };

  const quitarFoto = async () => {
    setAviso(null);
    setProcesandoFoto(true);
    try {
      if (conServidor) await api.quitarFoto();
      else guardarFotoLocal(usuarioActual.id, null);
      actualizarUsuario({ foto: null });
      setAviso({ tipo: 'success', texto: 'Se quitó tu foto de perfil.' });
    } catch (excepcion) {
      setAviso({ tipo: 'danger', texto: excepcion.message });
    } finally {
      setProcesandoFoto(false);
    }
  };

  const dato = (etiqueta, valor) => (
    <div className="col-12 col-sm-6">
      <dt className="small text-secondary fw-normal">{etiqueta}</dt>
      <dd className="mb-0 text-break">{valor || '—'}</dd>
    </div>
  );

  return createPortal(
    <>
      <div
        ref={refDialogo}
        className="modal d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventana-perfil-titulo"
        tabIndex={-1}
        onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) alCerrar();
        }}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <h2 id="ventana-perfil-titulo" className="h5 mb-0">
                Mi perfil
              </h2>
              <button ref={refCerrarBoton} type="button" className="btn-close" aria-label="Cerrar" onClick={alCerrar} />
            </div>

            <div className="modal-body d-flex flex-column gap-4">
              {aviso ? (
                <Mensaje tipo={aviso.tipo} alCerrar={() => setAviso(null)}>
                  {aviso.texto}
                </Mensaje>
              ) : null}

              <section className="d-flex flex-column flex-sm-row align-items-center gap-3 text-center text-sm-start">
                <AvatarUsuario usuario={usuarioActual} tamano={88} />
                <div className="flex-grow-1">
                  <p className="h5 mb-1">{usuarioActual.nombre}</p>
                  <span className="badge bg-primary-subtle text-primary-emphasis border">
                    {rol?.nombre ?? usuarioActual.rol}
                  </span>
                  <div className="d-flex flex-wrap justify-content-center justify-content-sm-start gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => refArchivo.current?.click()}
                      disabled={procesandoFoto}
                    >
                      <i className="bi bi-camera me-1" aria-hidden="true" />
                      {procesandoFoto ? 'Guardando…' : usuarioActual.foto ? 'Cambiar foto' : 'Subir foto'}
                    </button>
                    {usuarioActual.foto ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={quitarFoto}
                        disabled={procesandoFoto}
                      >
                        Quitar foto
                      </button>
                    ) : null}
                    <input
                      ref={refArchivo}
                      type="file"
                      accept={TIPOS_FOTO.join(',')}
                      className="d-none"
                      aria-label="Elegir foto de perfil"
                      onChange={elegirFoto}
                    />
                  </div>
                  {!conServidor ? (
                    <small className="d-block text-secondary mt-1">Sin servidor la foto se guarda solo en este navegador.</small>
                  ) : null}
                </div>
              </section>

              <section aria-labelledby="perfil-datos">
                <h3 id="perfil-datos" className="h6 text-uppercase small text-secondary mb-2">
                  Mis datos
                </h3>
                <dl className="row g-3 mb-0">
                  {dato('Correo', usuarioActual.correo)}
                  {dato('Acceso rápido', usuarioActual.alias)}
                  {dato('Cargo', usuarioActual.cargo)}
                  {dato('Unidad', usuarioActual.unidad)}
                </dl>
              </section>

              {rol ? (
                <section aria-labelledby="perfil-permisos">
                  <h3 id="perfil-permisos" className="h6 text-uppercase small text-secondary mb-2">
                    Lo que puedo hacer
                  </h3>
                  <p className="small mb-2">{rol.descripcion}</p>
                  <ul className="small mb-0 ps-3">
                    {rol.permisos.map((permiso) => (
                      <li key={permiso}>{permiso}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section aria-labelledby="perfil-seguridad">
                <h3 id="perfil-seguridad" className="h6 text-uppercase small text-secondary mb-2">
                  Seguridad
                </h3>
                <p className="small mb-2">
                  <i
                    className={`bi ${conServidor ? 'bi-shield-check text-success' : 'bi-wifi-off text-secondary'} me-1`}
                    aria-hidden="true"
                  />
                  {conServidor
                    ? 'Sesión iniciada en el servidor. Se cierra sola a las 8 horas.'
                    : 'Modo demostración: la sesión y los datos viven solo en este navegador.'}
                </p>
                {conServidor ? (
                  editandoContrasena ? (
                    <FormularioContrasena
                      api={api}
                      alCancelar={() => setEditandoContrasena(false)}
                      alTerminar={(resultado) => {
                        setEditandoContrasena(false);
                        setAviso(resultado);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => setEditandoContrasena(true)}
                    >
                      <i className="bi bi-key me-1" aria-hidden="true" />
                      Cambiar contraseña
                    </button>
                  )
                ) : (
                  <small className="text-secondary">El cambio de contraseña necesita el servidor.</small>
                )}
              </section>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-danger me-auto" onClick={alCerrarSesion}>
                <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />
                Cerrar sesión
              </button>
              <button type="button" className="btn btn-primary" onClick={alCerrar}>
                Listo
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>,
    document.body,
  );
}
