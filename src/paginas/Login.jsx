import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../datos/AuthContext';
import { ContextoDatos } from '../datos/DatosContext';
import logoAquaChile from '../assets/logo-aquachile-blanco.png';
import fondoCentroCultivo from '../assets/fondo-login.jpg';

/**
 * Pantalla formal de inicio de sesión corporativo para AquaChile.
 * Proporciona acceso según el perfil de usuario (Analista o Evaluador).
 */
export default function Login() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const { iniciarSesion, estaAutenticado } = useAuth();
  // Aviso del servidor (p. ej. una sesión que hubo que cerrar) mientras no haya error propio.
  const errorOperacion = useContext(ContextoDatos)?.errorOperacion;
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const destino = ubicacion.state?.desde?.pathname || '/';

  useEffect(() => {
    if (estaAutenticado) {
      navegar(destino, { replace: true });
    }
  }, [estaAutenticado, destino, navegar]);

  const manejarEnvio = async (e) => {
    e.preventDefault();
    setError('');

    if (!correo.trim() || !contrasena) {
      setError('Por favor ingrese su correo corporativo y contraseña.');
      return;
    }

    setCargando(true);
    const resultado = await iniciarSesion(correo, contrasena);

    if (resultado.ok) {
      navegar(destino, { replace: true });
    } else {
      setError(resultado.error || 'Credenciales inválidas.');
      setCargando(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center p-3"
      style={{
        backgroundImage: `linear-gradient(rgba(8, 21, 29, 0.15), rgba(8, 21, 29, 0.6)), url(${fondoCentroCultivo})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="card border-0 shadow-sm w-100" style={{ maxWidth: '440px' }}>
        {/* Cabecera institucional */}
        <div className="bg-primary text-white text-center p-4 rounded-top">
          <img
            src={logoAquaChile}
            alt="AquaChile"
            className="mb-2"
            style={{ maxHeight: '42px', width: 'auto' }}
          />
          <h1 className="h5 fw-semibold mb-1 text-white">Módulo de Evaluaciones</h1>
          <p className="small text-white-50 mb-0">Reclutamiento y Selección · Personas</p>
        </div>

        {/* Cuerpo del formulario */}
        <div className="card-body p-4">
          <h2 className="h6 fw-bold text-secondary mb-3 text-uppercase small text-center">
            Iniciar sesión
          </h2>

          {error || errorOperacion ? (
            <div
              className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3"
              role="alert"
            >
              <i className="bi bi-exclamation-triangle-fill flex-shrink-0" aria-hidden="true" />
              <div>{error || errorOperacion}</div>
            </div>
          ) : null}

          <form onSubmit={manejarEnvio} noValidate>
            <div className="mb-3">
              <label htmlFor="correo" className="form-label small fw-semibold text-secondary">
                Correo corporativo
              </label>
              <div className="input-group">
                <span className="input-group-text bg-white text-secondary border-end-0">
                  <i className="bi bi-envelope" aria-hidden="true" />
                </span>
                <input
                  id="correo"
                  name="correo"
                  type="email"
                  className="form-control border-start-0"
                  placeholder="usuario@aquachile.cl"
                  autoComplete="username"
                  autoFocus
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  disabled={cargando}
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="contrasena" className="form-label small fw-semibold text-secondary">
                Contraseña
              </label>
              <div className="input-group">
                <span className="input-group-text bg-white text-secondary border-end-0">
                  <i className="bi bi-lock" aria-hidden="true" />
                </span>
                <input
                  id="contrasena"
                  name="contrasena"
                  type={mostrarPassword ? 'text' : 'password'}
                  className="form-control border-start-0 border-end-0"
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  disabled={cargando}
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary border-start-0 bg-white text-secondary"
                  onClick={() => setMostrarPassword((prev) => !prev)}
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  tabIndex="-1"
                >
                  <i className={`bi ${mostrarPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
              disabled={cargando}
            >
              {cargando ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al sistema</span>
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Pie institucional */}
        <div className="card-footer bg-white border-top text-center py-3">
          <small className="text-secondary" style={{ fontSize: '0.75rem' }}>
            Acceso restringido a personal autorizado de AquaChile.
          </small>
          <div className="mt-2">
            <Link to="/trabaja-con-nosotros" className="small">
              ¿Buscas trabajo? Revisa nuestras ofertas
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
