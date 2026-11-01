import { useCallback, useEffect, useState } from 'react';
import { ROLES, USUARIOS } from '../../datos/usuarios';
import { hayErrores, validarUsuario } from '../../dominio/validaciones';
import { apiAdmin } from '../../servicios/api';
import Mensaje from '../comunes/Mensaje';

const ROLES_DISPONIBLES = Object.keys(ROLES);
const VACIO = { nombre: '', correo: '', rol: '', cargo: '', unidad: '', contrasena: '' };
const clase = (base, error) => `${base} ${error ? 'is-invalid' : ''}`.trim();

/** Formulario para crear o editar un usuario de prueba. */
function FormularioUsuario({ usuario, alGuardar, alCancelar }) {
  const esNuevo = !usuario;
  const [formulario, setFormulario] = useState(() => ({ ...VACIO, ...(usuario ?? {}), contrasena: '' }));
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const cambiar = (evento) => {
    const { name, value } = evento.target;
    setFormulario((actual) => ({ ...actual, [name]: value }));
    setErrores((actual) => {
      const siguientes = { ...actual };
      delete siguientes[name];
      return siguientes;
    });
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    const nuevosErrores = validarUsuario(formulario, { esNuevo, roles: ROLES_DISPONIBLES });
    setErrores(nuevosErrores);
    if (hayErrores(nuevosErrores)) return;
    setGuardando(true);
    try {
      await alGuardar({
        nombre: formulario.nombre.trim(),
        correo: formulario.correo.trim().toLowerCase(),
        rol: formulario.rol,
        cargo: formulario.cargo.trim(),
        unidad: formulario.unidad.trim(),
        ...(formulario.contrasena ? { contrasena: formulario.contrasena } : {}),
      });
    } finally {
      setGuardando(false);
    }
  };

  const campo = (nombre, etiqueta, props = {}) => (
    <div className="col-12 col-md-6">
      <label className="form-label" htmlFor={`usuario-${nombre}`}>
        {etiqueta}
      </label>
      <input
        id={`usuario-${nombre}`}
        name={nombre}
        className={clase('form-control', errores[nombre])}
        value={formulario[nombre]}
        onChange={cambiar}
        {...props}
      />
      {errores[nombre] ? <div className="invalid-feedback">{errores[nombre]}</div> : null}
    </div>
  );

  return (
    <form onSubmit={enviar} noValidate className="border rounded p-3" aria-label={esNuevo ? 'Nuevo usuario' : 'Editar usuario'}>
      <h3 className="h6 mb-3">{esNuevo ? 'Nuevo usuario de prueba' : `Editar a ${usuario.nombre}`}</h3>
      <div className="row g-3">
        {campo('nombre', 'Nombre *', { autoComplete: 'off' })}
        {campo('correo', 'Correo *', { type: 'email', autoComplete: 'off', placeholder: 'nombre@aquachile.cl' })}
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="usuario-rol">
            Rol *
          </label>
          <select
            id="usuario-rol"
            name="rol"
            className={clase('form-select', errores.rol)}
            value={formulario.rol}
            onChange={cambiar}
          >
            <option value="">Seleccione un rol</option>
            {ROLES_DISPONIBLES.map((rol) => (
              <option key={rol} value={rol}>
                {ROLES[rol].nombre}
              </option>
            ))}
          </select>
          {errores.rol ? <div className="invalid-feedback">{errores.rol}</div> : null}
        </div>
        {campo('contrasena', esNuevo ? 'Contraseña *' : 'Nueva contraseña (opcional)', {
          type: 'password',
          autoComplete: 'new-password',
          placeholder: esNuevo ? 'Mínimo 8 caracteres' : 'Dejar vacío para mantenerla',
        })}
        {campo('cargo', 'Cargo')}
        {campo('unidad', 'Unidad')}
      </div>
      <div className="d-flex justify-content-end gap-2 mt-3">
        <button type="button" className="btn btn-outline-secondary" onClick={alCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : esNuevo ? 'Crear usuario' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

/**
 * Mantenedor de usuarios de prueba del Administrador académico: crear, editar (incluida la
 * contraseña) y eliminar. Necesita el servidor; sin él muestra los usuarios de
 * demostración en modo lectura. El backend impide eliminarse a sí mismo o dejar el
 * sistema sin administrador.
 */
export default function GestionUsuarios({ conServidor, idUsuarioActual, api = apiAdmin }) {
  const [usuarios, setUsuarios] = useState(conServidor ? [] : USUARIOS);
  const [cargando, setCargando] = useState(conServidor);
  const [edicion, setEdicion] = useState(null); // null | 'nuevo' | usuario
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(async () => {
    if (!conServidor) return;
    setCargando(true);
    try {
      setUsuarios(await api.listarUsuarios());
    } catch (error) {
      setAviso({ tipo: 'danger', texto: error.message });
    } finally {
      setCargando(false);
    }
  }, [api, conServidor]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ejecutar = async (accion, exito) => {
    setAviso(null);
    try {
      await accion();
      setEdicion(null);
      setAviso({ tipo: 'success', texto: exito });
      await cargar();
    } catch (error) {
      setAviso({ tipo: 'danger', texto: error.message });
    }
  };

  const guardar = (datos) =>
    edicion === 'nuevo'
      ? ejecutar(() => api.crearUsuario(datos), `Se creó el usuario ${datos.nombre}.`)
      : ejecutar(() => api.actualizarUsuario(edicion.id, datos), `Se actualizó a ${datos.nombre}.`);

  const eliminar = (usuario) => {
    if (!window.confirm(`¿Eliminar al usuario ${usuario.nombre}? Ya no podrá iniciar sesión.`)) return;
    ejecutar(() => api.eliminarUsuario(usuario.id), `Se eliminó a ${usuario.nombre}.`);
  };

  return (
    <section className="card border-0 shadow-sm" aria-labelledby="titulo-usuarios">
      <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h2 id="titulo-usuarios" className="h6 mb-0">
            Usuarios de prueba
          </h2>
          <small className="text-secondary">Todos son ficticios; nunca uses datos de personas reales.</small>
        </div>
        {conServidor && edicion === null ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEdicion('nuevo')}>
            <i className="bi bi-person-plus me-1" aria-hidden="true" />
            Nuevo usuario
          </button>
        ) : null}
      </div>

      <div className="card-body d-flex flex-column gap-3">
        {!conServidor ? (
          <Mensaje tipo="info">
            Sin servidor solo se muestran los usuarios de demostración. Para crear, editar o eliminar usuarios
            inicia el backend.
          </Mensaje>
        ) : null}
        {aviso ? (
          <Mensaje tipo={aviso.tipo} alCerrar={() => setAviso(null)}>
            {aviso.texto}
          </Mensaje>
        ) : null}
        {edicion ? (
          <FormularioUsuario
            key={edicion === 'nuevo' ? 'nuevo' : edicion.id}
            usuario={edicion === 'nuevo' ? null : edicion}
            alGuardar={guardar}
            alCancelar={() => setEdicion(null)}
          />
        ) : null}

        {cargando ? (
          <p className="text-secondary small mb-0" role="status">
            Cargando usuarios…
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Acceso</th>
                  <th scope="col">Rol</th>
                  <th scope="col" className="d-none d-md-table-cell">
                    Cargo
                  </th>
                  {conServidor ? (
                    <th scope="col" className="text-end">
                      Acciones
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td className="fw-semibold">
                      {usuario.nombre}
                      {usuario.id === idUsuarioActual ? (
                        <span className="badge text-bg-light border ms-2 fw-normal">Tú</span>
                      ) : null}
                    </td>
                    <td className="small">{usuario.alias || usuario.correo}</td>
                    <td>
                      <span className="badge bg-primary-subtle text-primary-emphasis border">
                        {ROLES[usuario.rol]?.etiqueta ?? usuario.rol}
                      </span>
                    </td>
                    <td className="small text-secondary d-none d-md-table-cell">{usuario.cargo}</td>
                    {conServidor ? (
                      <td className="text-end text-nowrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary me-1"
                          aria-label={`Editar a ${usuario.nombre}`}
                          onClick={() => setEdicion(usuario)}
                        >
                          <i className="bi bi-pencil" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          aria-label={`Eliminar a ${usuario.nombre}`}
                          disabled={usuario.id === idUsuarioActual}
                          title={usuario.id === idUsuarioActual ? 'No puedes eliminar tu propio usuario' : undefined}
                          onClick={() => eliminar(usuario)}
                        >
                          <i className="bi bi-trash3" aria-hidden="true" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
