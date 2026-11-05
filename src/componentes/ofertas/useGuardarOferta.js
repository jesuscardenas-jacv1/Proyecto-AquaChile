import { useDatos } from '../../datos/DatosContext';
import { apiDocumentos } from '../../servicios/apiDocumentos';

/**
 * Guarda una oferta y su descriptor interno. Si hay que subir un archivo, la oferta nueva
 * se publica recién después de subirlo: una falla no deja publicada una oferta sin descriptor.
 * Devuelve { tipo, mensaje }, o null si el servidor rechazó la oferta (el motivo queda en errorOperacion).
 */
export function useGuardarOferta(api = apiDocumentos) {
  const { agregarOferta, editarOferta, cambiarEstadoOferta, registrarDescriptorOferta } = useDatos();

  return async (oferta, datos, { publicar = false, descriptor = null } = {}) => {
    const publicarAlFinal = publicar && Boolean(descriptor);
    const opciones = { publicar: publicar && !descriptor };
    const guardada = oferta ? await editarOferta(oferta.id, datos, opciones) : await agregarOferta(datos, opciones);
    if (!guardada) return null;

    if (descriptor) {
      try {
        if (api.conectado()) await api.subirDescriptorOferta(guardada.id, descriptor);
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
    // Al final: publicar reemplaza la oferta en pantalla por la versión guardada.
    if (descriptor) registrarDescriptorOferta(guardada.id, descriptor.name);

    if (publicar) return { tipo: 'success', mensaje: 'Oferta publicada en el portal.' };
    return { tipo: 'success', mensaje: oferta ? 'Oferta actualizada.' : 'Borrador guardado.' };
  };
}
