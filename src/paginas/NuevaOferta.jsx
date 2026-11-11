import { useNavigate } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import FormularioOferta from '../componentes/ofertas/FormularioOferta';
import { useGuardarOferta } from '../componentes/ofertas/useGuardarOferta';
import { apiIa, useIaDisponible } from '../servicios/apiIa';

/** Crea una oferta como borrador o publicada, y vuelve al listado. */
export default function NuevaOferta() {
  const { cargos } = useDatos();
  const guardarOferta = useGuardarOferta();
  const navegar = useNavigate();
  const iaDisponible = useIaDisponible();

  const guardar = async (datos, opciones) => {
    // Si el servidor rechaza la oferta, el motivo se muestra arriba y no se navega.
    const resultado = await guardarOferta(null, datos, opciones);
    if (resultado) navegar('/ofertas', { state: resultado });
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header>
        <h1 className="h4 mb-1">Nueva oferta</h1>
        <p className="text-secondary mb-0">Guárdala como borrador o publícala en "Trabaja con nosotros".</p>
      </header>
      <div className="row">
        <div className="col-12 col-xl-9">
          <FormularioOferta
            alGuardar={guardar}
            alCancelar={() => navegar('/ofertas')}
            cargosGuardados={cargos}
            alRedactar={iaDisponible ? apiIa.redactarOferta : null}
          />
        </div>
      </div>
    </div>
  );
}
