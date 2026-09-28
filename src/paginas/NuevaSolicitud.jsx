import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import FormularioSolicitud from '../componentes/solicitudes/FormularioSolicitud';
import Mensaje from '../componentes/comunes/Mensaje';

/** Página de creación de solicitud de evaluación. */
export default function NuevaSolicitud() {
  const { candidatos, agregarSolicitud } = useDatos();
  const navegar = useNavigate();
  const [error, setError] = useState('');

  const guardar = (datos) => {
    if (candidatos.length === 0) {
      setError('Debes registrar un candidato antes de crear una solicitud.');
      return;
    }
    const solicitud = agregarSolicitud(datos);
    navegar(`/solicitudes/${solicitud.id}`, {
      state: {
        mensaje: 'Solicitud creada correctamente. Puedes asignar un profesional y evaluarla.',
        tipo: 'success',
      },
    });
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header>
        <h1 className="h4 mb-1">Nueva solicitud de evaluación</h1>
        <p className="text-secondary mb-0">
          Selecciona el candidato y completa los datos de la evaluación que se solicitara.
        </p>
      </header>

      {candidatos.length === 0 ? (
        <Mensaje tipo="warning" titulo="Sin candidatos registrados">
          Primero debes registrar al menos un candidato.
          <div className="mt-2">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => navegar('/candidatos/nuevo')}
            >
              Registrar candidato
            </button>
          </div>
        </Mensaje>
      ) : null}

      {error ? <Mensaje tipo="danger">{error}</Mensaje> : null}

      <div className="row">
        <div className="col-12 col-lg-9">
          <FormularioSolicitud
            candidatos={candidatos}
            alGuardar={guardar}
            alCancelar={() => navegar('/solicitudes')}
          />
        </div>
      </div>
    </div>
  );
}
