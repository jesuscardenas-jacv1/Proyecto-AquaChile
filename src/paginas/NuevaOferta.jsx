import { useNavigate } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import FormularioOferta from '../componentes/ofertas/FormularioOferta';

/** Crea una oferta como borrador o publicada, y vuelve al listado. */
export default function NuevaOferta() {
  const { agregarOferta } = useDatos();
  const navegar = useNavigate();

  const guardar = async (datos, { publicar }) => {
    // Si el servidor rechaza la oferta, el motivo se muestra arriba y no se navega.
    if (!(await agregarOferta(datos, { publicar }))) return;
    navegar('/ofertas', {
      state: { mensaje: publicar ? 'Oferta publicada en el portal.' : 'Borrador guardado.', tipo: 'success' },
    });
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header>
        <h1 className="h4 mb-1">Nueva oferta</h1>
        <p className="text-secondary mb-0">Guárdala como borrador o publícala en "Trabaja con nosotros".</p>
      </header>
      <div className="row">
        <div className="col-12 col-xl-9">
          <FormularioOferta alGuardar={guardar} alCancelar={() => navegar('/ofertas')} />
        </div>
      </div>
    </div>
  );
}
