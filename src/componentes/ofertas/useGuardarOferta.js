import { useDatos } from '../../datos/DatosContext';
import { apiDocumentos } from '../../servicios/apiDocumentos';

/**
 * Guarda una oferta y el descriptor de su cargo. Si hay que subir un archivo, la oferta nueva
 * se publica recién después de subirlo: una falla no deja publicada una oferta sin descriptor.
 * Devuelve { tipo, mensaje }, o null si el servidor rechazó la oferta (el motivo queda en errorOperacion).
 */
export function useGuardarOferta(api = apiDocumentos) {
  const { agregarOferta, editarOferta, cambiarEstadoOferta, registrarCargo } = useDatos();

  return async (oferta, datos, { publicar = false, descriptor = null } = {}) => {
    const publicarAlFinal = publicar && Boolean(descriptor);
    const opciones = { publicar: publicar && !descriptor };
    const guardada = oferta ? await editarOferta(oferta.id, datos, opciones) : await agregarOferta(datos, opciones);
    if (!guardada) return null;

    if (descriptor) {
      try {
        registrarCargo(
          api.conectado()
            ? await api.subirDescriptorCargo({
                cargo: datos.cargo,
                familiaCargo: datos.familiaCargo,
                archivo: descriptor,
              })
            : { nombre: datos.cargo.trim(), familiaCargo: datos.familiaCargo, descriptorNombre: descriptor.name },
        );
      } catch (error) {
        return {
          tipo: 'warning',
          mensaje: `La oferta se guardó, pero no se pudo subir el descriptor: ${error.message}${
            publicarAlFinal ? ' Quedó como borrador.' : ''
          }`,
        };
      }
    }
    if (publicarAlFinal && !(await cambiarEstadoOferta(guardada.id, 'Abierta'))) return null;

    if (publicar) return { tipo: 'success', mensaje: 'Oferta publicada en el portal.' };
    return { tipo: 'success', mensaje: oferta ? 'Oferta actualizada.' : 'Borrador guardado.' };
  };
}
