/**
 * Reglas compartidas por todos los proveedores de almacenamiento de documentos.
 *
 * Cada solicitud tiene una carpeta propia (ej. "S0001 - Jorge Alvarado Uribe") donde se
 * guardan el CV, el descriptor de cargo y el informe psicolaboral. La categoría de cada
 * archivo se refleja en un prefijo del nombre, así la carpeta se entiende igual al
 * abrirla directamente en OneDrive / SharePoint.
 */

const CATEGORIAS = {
  cv: { prefijo: 'CV', etiqueta: 'CV del candidato', roles: ['analista'] },
  descriptor: { prefijo: 'Descriptor', etiqueta: 'Descriptor de cargo', roles: ['analista'] },
  informe: { prefijo: 'Informe', etiqueta: 'Informe psicolaboral', roles: ['evaluador'] },
};

/** Mismas restricciones que el formulario de solicitud (Microsoft Forms original). */
const EXTENSIONES_PERMITIDAS = [
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic',
  'mp4', 'mov', 'avi', 'mp3', 'wav', 'm4a',
];
const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024;

const TIPOS_MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** Error con código HTTP para que las rutas respondan con el estado correcto. */
class ErrorAlmacenamiento extends Error {
  constructor(mensaje, status = 500) {
    super(mensaje);
    this.name = 'ErrorAlmacenamiento';
    this.status = status;
  }
}

/**
 * Deja un nombre apto para carpetas y archivos de OneDrive / SharePoint y del disco local:
 * quita caracteres reservados, rutas relativas y espacios sobrantes.
 */
function limpiarNombre(nombre, largoMaximo = 120) {
  const limpio = String(nombre ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f"*:<>?/\\|#%]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, largoMaximo)
    .trim();
  return limpio;
}

/** Clave estable de la carpeta de una solicitud: no cambia aunque cambie el nombre. */
function claveCarpeta(solicitudId) {
  return `S${String(solicitudId).padStart(4, '0')}`;
}

/** Carpeta de una postulación del portal (antes de pasar a evaluación). */
function claveCarpetaPostulacion(postulacionId) {
  return `P${String(postulacionId).padStart(4, '0')}`;
}

function nombreCarpetaPostulacion(postulacionId, nombreCandidato) {
  const candidato = limpiarNombre(nombreCandidato, 80);
  const clave = claveCarpetaPostulacion(postulacionId);
  return candidato ? `${clave} - ${candidato}` : clave;
}

/** El CV del portal acepta solo documentos (PDF o Word), hasta 5 MB. */
const EXTENSIONES_CV_PORTAL = ['pdf', 'doc', 'docx'];
const TAMANO_MAXIMO_CV_PORTAL = 5 * 1024 * 1024;

function validarCvPortal({ nombre, tamano }) {
  if (!limpiarNombre(nombre)) throw new ErrorAlmacenamiento('Debe indicar el nombre del archivo.', 400);
  if (!EXTENSIONES_CV_PORTAL.includes(extensionDe(nombre))) {
    throw new ErrorAlmacenamiento('El currículum debe ser PDF o Word.', 400);
  }
  if (!tamano) throw new ErrorAlmacenamiento('El archivo está vacío.', 400);
  if (tamano > TAMANO_MAXIMO_CV_PORTAL) {
    throw new ErrorAlmacenamiento('El currículum supera el máximo de 5 MB.', 413);
  }
}

function nombreCarpeta(solicitudId, nombreCandidato) {
  const candidato = limpiarNombre(nombreCandidato, 80);
  return candidato ? `${claveCarpeta(solicitudId)} - ${candidato}` : claveCarpeta(solicitudId);
}

/** ¿El nombre de una carpeta corresponde a la clave de la solicitud? */
function esCarpetaDeSolicitud(nombre, clave) {
  return nombre === clave || nombre.startsWith(`${clave} - `);
}

function extensionDe(nombre) {
  const partes = String(nombre).split('.');
  return partes.length > 1 ? partes.pop().toLowerCase() : '';
}

function tipoMime(nombre) {
  return TIPOS_MIME[extensionDe(nombre)] ?? 'application/octet-stream';
}

/** Nombre final del archivo dentro de la carpeta: "<Prefijo> - <nombre original>". */
function nombreArchivo(categoria, nombreOriginal) {
  const { prefijo } = CATEGORIAS[categoria];
  const base = limpiarNombre(nombreOriginal) || 'archivo';
  return base.startsWith(`${prefijo} - `) ? base : `${prefijo} - ${base}`;
}

/** Categoría deducida del prefijo del nombre; 'otro' si se subió a mano en OneDrive. */
function categoriaDeArchivo(nombre) {
  const encontrada = Object.entries(CATEGORIAS).find(([, { prefijo }]) =>
    nombre.startsWith(`${prefijo} - `),
  );
  return encontrada ? encontrada[0] : 'otro';
}

/** Valida categoría, extensión y tamaño antes de subir. Lanza ErrorAlmacenamiento (400). */
function validarArchivo({ categoria, nombre, tamano }) {
  if (!CATEGORIAS[categoria]) {
    throw new ErrorAlmacenamiento(
      `Categoría inválida. Use una de: ${Object.keys(CATEGORIAS).join(', ')}.`,
      400,
    );
  }
  if (!limpiarNombre(nombre)) {
    throw new ErrorAlmacenamiento('Debe indicar el nombre del archivo.', 400);
  }
  if (!EXTENSIONES_PERMITIDAS.includes(extensionDe(nombre))) {
    throw new ErrorAlmacenamiento(
      'Tipo de archivo no permitido. Se aceptan Word, Excel, PPT, PDF, imagen, video o audio.',
      400,
    );
  }
  if (!tamano) {
    throw new ErrorAlmacenamiento('El archivo está vacío.', 400);
  }
  if (tamano > TAMANO_MAXIMO_BYTES) {
    throw new ErrorAlmacenamiento('El archivo supera el máximo de 10 MB.', 413);
  }
}

module.exports = {
  CATEGORIAS,
  EXTENSIONES_PERMITIDAS,
  TAMANO_MAXIMO_BYTES,
  ErrorAlmacenamiento,
  limpiarNombre,
  claveCarpeta,
  nombreCarpeta,
  claveCarpetaPostulacion,
  nombreCarpetaPostulacion,
  validarCvPortal,
  TAMANO_MAXIMO_CV_PORTAL,
  esCarpetaDeSolicitud,
  extensionDe,
  tipoMime,
  nombreArchivo,
  categoriaDeArchivo,
  validarArchivo,
};
