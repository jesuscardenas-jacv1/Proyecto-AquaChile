import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { useAccion } from '../datos/useAccion';
import FormularioSolicitud from '../componentes/solicitudes/FormularioSolicitud';
import Mensaje from '../componentes/comunes/Mensaje';

/**
 * Página de creación de solicitud de evaluación.
 * Si el candidato/a no está registrado/a, se registra junto con la solicitud.
 */
export default function NuevaSolicitud() {
  const { candidatos, agregarCandidato, agregarSolicitud } = useDatos();
  const navegar = useNavigate();
  const { ejecutar, error, limpiarError } = useAccion();
  // Si el candidato se registró pero la solicitud falló, el reintento reutiliza ese
  // candidato en vez de crear un duplicado (la clave es su correo).
  const candidatoCreado = useRef(null);

  const guardar = async ({ nombreCandidato, correo, telefono, ...datos }) => {
    const resultado = await ejecutar(async () => {
      let candidatoId = datos.candidatoId;
      if (!candidatoId) {
        const correoNormalizado = correo.trim().toLowerCase();
        if (candidatoCreado.current?.correo !== correoNormalizado) {
          const creado = await agregarCandidato({
            nombre: nombreCandidato,
            correo,
            telefono,
            cargo: datos.cargo,
            familiaCargo: datos.familiaCargo,
            origen: datos.origen,
          });
          candidatoCreado.current = { id: creado.id, correo: correoNormalizado };
        }
        candidatoId = candidatoCreado.current.id;
      }
      return agregarSolicitud({ ...datos, candidatoId });
    });
    if (!resultado.ok) return;
    const solicitud = resultado.valor;
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

      {error ? (
        <Mensaje tipo="danger" titulo="No se pudo enviar la solicitud" alCerrar={limpiarError}>
          {error}
        </Mensaje>
      ) : null}

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
