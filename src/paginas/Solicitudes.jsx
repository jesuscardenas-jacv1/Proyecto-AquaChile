import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { ESTADOS_SOLICITUD } from '../datos/constantes';
import ListaSolicitudes from '../componentes/solicitudes/ListaSolicitudes';

/** Listado de solicitudes con búsqueda y filtros (acepta ?estado= en la URL). */
export default function Solicitudes() {
  const { solicitudes, candidatos } = useDatos();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
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
        <button
          type="button"
          className="btn btn-primary align-self-start"
          onClick={() => navegar('/solicitudes/nueva')}
        >
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          Nueva solicitud
        </button>
      </header>

      <ListaSolicitudes
        key={estadoInicial}
        estadoInicial={estadoInicial}
        solicitudes={solicitudes}
        candidatos={candidatos}
        alAbrir={(solicitud) => navegar(`/solicitudes/${solicitud.id}`)}
      />
    </div>
  );
}
