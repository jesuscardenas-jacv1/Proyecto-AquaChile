/**
 * Prepara la foto de perfil en el navegador: la recorta al centro en un cuadrado y la
 * reduce a `lado` píxeles en JPEG. Así se envía al servidor una imagen liviana (~20 KB).
 */
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
export const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024;

/** Valida el archivo elegido; devuelve el mensaje de error o null. */
export function validarArchivoFoto(archivo) {
  if (!archivo) return 'Seleccione una imagen.';
  if (!TIPOS_FOTO.includes(archivo.type)) return 'La foto debe ser una imagen JPG, PNG o WebP.';
  if (archivo.size > TAMANO_MAXIMO_FOTO) return 'La imagen no puede superar los 5 MB.';
  return null;
}

function cargarImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolver(imagen);
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No se pudo leer la imagen.'));
    };
    imagen.src = url;
  });
}

export async function reducirFoto(archivo, lado = 192) {
  const imagen = await cargarImagen(archivo);
  const corte = Math.min(imagen.naturalWidth, imagen.naturalHeight);
  const lienzo = document.createElement('canvas');
  lienzo.width = lado;
  lienzo.height = lado;
  lienzo
    .getContext('2d')
    .drawImage(
      imagen,
      (imagen.naturalWidth - corte) / 2,
      (imagen.naturalHeight - corte) / 2,
      corte,
      corte,
      0,
      0,
      lado,
      lado,
    );
  return lienzo.toDataURL('image/jpeg', 0.85);
}
