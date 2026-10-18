import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { useAuth } from '../datos/AuthContext';
import { ESTADOS_SOLICITUD, EVALUADORES } from '../datos/constantes';
import ListaSolicitudes from '../componentes/solicitudes/ListaSolicitudes';
import Mensaje from '../componentes/comunes/Mensaje';

/** Listado de solicitudes con búsqueda y filtros (acepta ?estado= en la URL). */
export default function Solicitudes() {
  const { solicitudes, candidatos } = useDatos();
  const { esAnalista, soloEnEvaluacion, usuarioActual } = useAuth();
  // La psicóloga parte viendo las solicitudes asignadas a ella (puede quitar el filtro).
  const responsableInicial =
    soloEnEvaluacion && EVALUADORES.includes(usuarioActual?.nombre) ? usuarioActual.nombre : '';
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  // Aviso enviado por otra vista, p. ej. RutaProtegida al negar el acceso.
  const ubicacion = useLocation();
  const mensaje = ubicacion.state?.mensaje;
  const total = solicitudes.length;
  const estadoUrl = parametros.get('estado');
  const estadoInicial = ESTADOS_SOLICITUD.includes(estadoUrl) ? estadoUrl : '';

  return (
    <div className="d-flex flex-column gap-3">
      <header className="d-flex flex-column flex-md-row justify-content-between gap-2 align-items-md-center">
        <div>
          <h1 className="h4 mb-1">Solicitudes</h1>
          <p className="text-secondary mb-0">
            {total} solicitud{total === 1 ? '' : 'es'} registrada{total === 1 ? '' : 's'}.
          </p>
        </div>
        {esAnalista ? (
          <button
            type="button"
            className="btn btn-primary align-self-start"
            onClick={() => navegar('/solicitudes/nueva')}
          >
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Nueva solicitud
          </button>
        ) : null}
      </header>

      {mensaje ? (
        <Mensaje
          tipo={ubicacion.state?.tipo ?? 'info'}
          alCerrar={() => navegar(`/solicitudes${ubicacion.search}`, { replace: true })}
        >
          {mensaje}
        </Mensaje>
      ) : null}

      <ListaSolicitudes
        key={`${estadoInicial}-${responsableInicial}`}
        estadoInicial={estadoInicial}
        responsableInicial={responsableInicial}
        solicitudes={solicitudes}
        candidatos={candidatos}
        alAbrir={(solicitud) => navegar(`/solicitudes/${solicitud.id}`)}
      />
    </div>
  );
}
