import { useNavigate } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import FormularioSolicitud from '../componentes/solicitudes/FormularioSolicitud';

/**
 * Página de creación de solicitud de evaluación.
 * Si el candidato/a no está registrado/a, se registra junto con la solicitud.
 */
export default function NuevaSolicitud() {
  const { candidatos, agregarCandidato, agregarSolicitud } = useDatos();
  const navegar = useNavigate();

  const guardar = ({ nombreCandidato, correo, telefono, ...datos }) => {
    const candidatoId =
      datos.candidatoId ||
      agregarCandidato({
        nombre: nombreCandidato,
        correo,
        telefono,
        cargo: datos.cargo,
        familiaCargo: datos.familiaCargo,
        origen: datos.origen,
      }).id;
    const solicitud = agregarSolicitud({ ...datos, candidatoId });
    navegar(`/solicitudes/${solicitud.id}`, {
      state: {
        mensaje: datos.candidatoId
          ? 'Solicitud enviada correctamente. Queda pendiente de agendar la entrevista.'
          : 'Solicitud enviada y candidato/a registrado/a correctamente.',
        tipo: 'success',
      },
    });
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header>
        <h1 className="h4 mb-1">Solicitud de evaluación psicolaboral</h1>
        <p className="text-secondary mb-0">
          Completa los datos del candidato/a y del cargo para solicitar su evaluación.
        </p>
      </header>

      <div className="row">
        <div className="col-12 col-xl-10">
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
