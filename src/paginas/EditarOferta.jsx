import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import Mensaje from '../componentes/comunes/Mensaje';
import FormularioOferta from '../componentes/ofertas/FormularioOferta';

/** Edita una oferta; si es un borrador, también permite publicarla. */
export default function EditarOferta() {
  const { id } = useParams();
  const { obtenerOferta, editarOferta } = useDatos();
  const navegar = useNavigate();
  const oferta = obtenerOferta(id);

  if (!oferta) {
    return (
      <div className="d-flex flex-column gap-3">
        <Mensaje tipo="warning" titulo="Oferta no encontrada">
          La oferta que buscas no existe.
        </Mensaje>
        <Link to="/ofertas" className="btn btn-link align-self-start px-0">
          Volver a Ofertas
        </Link>
      </div>
    );
  }

  const guardar = async (datos, { publicar }) => {
    if (!(await editarOferta(oferta.id, datos, { publicar }))) return;
    navegar('/ofertas', {
      state: { mensaje: publicar ? 'Oferta publicada en el portal.' : 'Oferta actualizada.', tipo: 'success' },
    });
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header>
        <h1 className="h4 mb-1">Editar oferta</h1>
        <p className="text-secondary mb-0">{oferta.titulo}</p>
      </header>
      <div className="row">
        <div className="col-12 col-xl-9">
          <FormularioOferta key={oferta.id} inicial={oferta} alGuardar={guardar} alCancelar={() => navegar('/ofertas')} />
        </div>
      </div>
    </div>
  );
}
