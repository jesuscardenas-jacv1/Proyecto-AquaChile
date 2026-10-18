import { useDatos } from '../../datos/DatosContext';
import Mensaje from './Mensaje';

/**
 * Avisos de la conexión con el servidor: carga de datos y errores de las operaciones
 * (p. ej. un candidato que no se puede eliminar porque tiene solicitudes).
 */
export default function EstadoServidor() {
  const { cargando, errorOperacion, limpiarError } = useDatos();

  return (
    <>
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
