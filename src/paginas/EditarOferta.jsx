import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import Mensaje from '../componentes/comunes/Mensaje';
import FormularioOferta from '../componentes/ofertas/FormularioOferta';
import { useGuardarOferta } from '../componentes/ofertas/useGuardarOferta';
import { apiDocumentos } from '../servicios/apiDocumentos';

/** Edita una oferta; si es un borrador, también permite publicarla. */
export default function EditarOferta() {
  const { id } = useParams();
  const { obtenerOferta, cargos } = useDatos();
  const guardarOferta = useGuardarOferta();
  const [errorDescarga, setErrorDescarga] = useState(null);
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

  const guardar = async (datos, opciones) => {
    const resultado = await guardarOferta(oferta, datos, opciones);
    if (resultado) navegar('/ofertas', { state: resultado });
  };

  const descargarDescriptor = async () => {
    setErrorDescarga(null);
    try {
      await apiDocumentos.descargarDescriptorOferta(oferta);
    } catch (error) {
      setErrorDescarga(error.message);
    }
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header>
        <h1 className="h4 mb-1">Editar oferta</h1>
        <p className="text-secondary mb-0">{oferta.titulo}</p>
      </header>
      {errorDescarga ? (
        <Mensaje tipo="danger" alCerrar={() => setErrorDescarga(null)}>
          {errorDescarga}
        </Mensaje>
      ) : null}
      <div className="row">
        <div className="col-12 col-xl-9">
          <FormularioOferta
            key={oferta.id}
            inicial={oferta}
            alGuardar={guardar}
            alCancelar={() => navegar('/ofertas')}
            alDescargarDescriptor={descargarDescriptor}
            cargosGuardados={cargos}
          />
        </div>
      </div>
    </div>
  );
}
