import { useState } from 'react';
import { useDatos } from '../../datos/DatosContext';
import Mensaje from './Mensaje';

/**
 * Avisos de la conexión con el servidor: carga de datos, errores de las operaciones
 * (p. ej. un candidato que no se puede eliminar porque tiene solicitudes) y el modo
 * local cuando hay servidor configurado pero no responde.
 */
export default function EstadoServidor() {
  const { cargando, errorOperacion, limpiarError, modo, servidorConfigurado, reconectar } = useDatos();
  const [reintentando, setReintentando] = useState(false);
  const [sinRespuesta, setSinRespuesta] = useState(false);

  const reintentar = async () => {
    setReintentando(true);
    setSinRespuesta(false);
    try {
      setSinRespuesta(!(await reconectar()));
    } finally {
      setReintentando(false);
    }
  };

  return (
    <>
      {servidorConfigurado && modo === 'local' ? (
        <Mensaje tipo="warning" titulo="Sin conexión con el servidor">
          Estás viendo los datos de demostración de este navegador: los cambios no se guardan en la base
          de datos y los documentos no están disponibles. Se reintenta solo cada 30 segundos.{' '}
          <button
            type="button"
            className="btn btn-sm btn-outline-dark ms-1"
            onClick={reintentar}
            disabled={reintentando}
          >
            {reintentando ? 'Reintentando…' : 'Reintentar ahora'}
          </button>
          {sinRespuesta ? <span className="d-block small mt-1">El servidor sigue sin responder.</span> : null}
        </Mensaje>
      ) : null}
      {cargando ? (
        <p className="small text-secondary mb-3" role="status">
          <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          Cargando datos del servidor…
        </p>
      ) : null}
      {errorOperacion ? (
        <Mensaje tipo="danger" titulo="El servidor no pudo completar la operación" alCerrar={limpiarError}>
          {errorOperacion}
        </Mensaje>
      ) : null}
    </>
  );
}
