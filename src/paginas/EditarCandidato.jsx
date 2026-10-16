import { useNavigate, useParams } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import FormularioCandidato from '../componentes/candidatos/FormularioCandidato';
import Mensaje from '../componentes/comunes/Mensaje';
import { useAccion } from '../datos/useAccion';

/** Página de edición de candidato. */
export default function EditarCandidato() {
  const { id } = useParams();
  const { obtenerCandidato, actualizarCandidato } = useDatos();
  const navegar = useNavigate();
  const { ejecutar, error, limpiarError } = useAccion();
  const candidato = obtenerCandidato(id);

  if (!candidato) {
    return (
      <Mensaje tipo="warning" titulo="Candidato no encontrado">
        El candidato solicitado no existe o fue eliminado.
        <div className="mt-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => navegar('/candidatos')}
          >
            Volver al listado
          </button>
        </div>
      </Mensaje>
    );
  }

  const guardar = async (datos) => {
    const resultado = await ejecutar(() => actualizarCandidato(candidato.id, datos));
    if (!resultado.ok) return;
    navegar('/candidatos', {
      state: { mensaje: 'Candidato actualizado correctamente.', tipo: 'success' },
    });
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header>
        <h1 className="h4 mb-1">Editar candidato</h1>
        <p className="text-secondary mb-0">Actualiza los datos de {candidato.nombre}.</p>
      </header>
      {error ? (
        <Mensaje tipo="danger" titulo="No se pudo actualizar el candidato" alCerrar={limpiarError}>
          {error}
        </Mensaje>
      ) : null}
      <div className="row">
        <div className="col-12 col-lg-8">
          <FormularioCandidato
            candidato={candidato}
            titulo={`Datos de ${candidato.nombre}`}
            alGuardar={guardar}
            alCancelar={() => navegar('/candidatos')}
          />
        </div>
      </div>
    </div>
  );
}
