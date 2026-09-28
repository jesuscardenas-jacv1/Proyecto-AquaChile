import { useNavigate } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import FormularioCandidato from '../componentes/candidatos/FormularioCandidato';

/** Página de registro de candidato (crea y vuelve al listado). */
export default function NuevoCandidato() {
  const { agregarCandidato } = useDatos();
  const navegar = useNavigate();

  const guardar = (datos) => {
    agregarCandidato(datos);
    navegar('/candidatos', {
      state: { mensaje: 'Candidato registrado correctamente.', tipo: 'success' },
    });
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header>
        <h1 className="h4 mb-1">Registrar candidato</h1>
        <p className="text-secondary mb-0">
          Completa los datos del postulante para poder generar una solicitud de evaluación.
        </p>
      </header>
      <div className="row">
        <div className="col-12 col-lg-8">
          <FormularioCandidato
            alGuardar={guardar}
            alCancelar={() => navegar('/candidatos')}
          />
        </div>
      </div>
    </div>
  );
}
