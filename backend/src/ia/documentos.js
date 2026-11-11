/**
 * Prepara los archivos para enviarlos a la IA y encuentra el descriptor de un cargo.
 * Un PDF va tal cual (Claude lo lee como documento); un Word (.docx) se convierte a texto.
 */
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const db = require('../bd/conexion');
const { obtenerAlmacenamiento } = require('../almacenamiento');
const {
  categoriaDeArchivo,
  claveCarpetaCargo,
  claveCarpetaOferta,
  claveDeCargo,
  extensionDe,
} = require('../almacenamiento/comun');
const { ErrorIa } = require('./cliente');

const MEGABYTE = 1024 * 1024;
const TAMANO_MAXIMO = 10 * MEGABYTE;

/**
 * Bloque de documento para la IA.
 * @param {{ nombre: string, contenido: Buffer }} archivo
 * @param {string} titulo cómo se llama el documento en las instrucciones ("CV del postulante")
 */
async function bloqueDocumento(archivo, titulo) {
  const extension = extensionDe(archivo.nombre);
  if (!archivo.contenido?.length) throw new ErrorIa(`El archivo "${archivo.nombre}" está vacío.`, 400);
  if (archivo.contenido.length > TAMANO_MAXIMO) {
    throw new ErrorIa(`"${archivo.nombre}" supera los 10 MB que la IA puede leer.`, 413);
  }

  if (extension === 'pdf') {
    return {
      type: 'document',
      title: titulo,
      source: { type: 'base64', media_type: 'application/pdf', data: archivo.contenido.toString('base64') },
    };
  }
  if (extension === 'docx') {
    let texto;
    try {
      ({ value: texto } = await mammoth.extractRawText({ buffer: archivo.contenido }));
    } catch {
      throw new ErrorIa(`No se pudo leer "${archivo.nombre}". Verifica que sea un Word válido.`, 422);
    }
    if (!texto?.trim()) throw new ErrorIa(`"${archivo.nombre}" no tiene texto que la IA pueda leer.`, 422);
    return { type: 'document', title: titulo, source: { type: 'text', media_type: 'text/plain', data: texto } };
  }
  throw new ErrorIa('La IA solo lee archivos PDF o Word (.docx).', 415);
}

/** Carpeta de los descriptores de demostración: junto al paquete en Azure, o en public/ del repositorio. */
function carpetaCatalogo() {
  return [path.join(__dirname, '..', '..', 'descriptores'), path.join(__dirname, '..', '..', '..', 'public', 'descriptores')].find(
    (ruta) => fs.existsSync(ruta),
  );
}

/** "DC_Jefe_de_Centro.pdf" corresponde al cargo "Jefe de Centro" (sin importar tildes ni mayúsculas). */
function descriptorDelCatalogo(cargo) {
  const carpeta = carpetaCatalogo();
  if (!carpeta || !cargo) return null;
  const clave = claveDeCargo(cargo);
  const archivo = fs
    .readdirSync(carpeta)
    .find((nombre) => nombre.endsWith('.pdf') && claveDeCargo(nombre.replace(/^DC_/, '').replace(/\.pdf$/, '').replace(/_/g, ' ')) === clave);
  return archivo ? { nombre: archivo, contenido: fs.readFileSync(path.join(carpeta, archivo)) } : null;
}

async function descriptorEnCarpeta(clave) {
  const almacenamiento = obtenerAlmacenamiento();
  const carpeta = await almacenamiento.obtenerCarpeta(clave, null);
  const archivo = carpeta
    ? (await almacenamiento.listarArchivos(carpeta)).find((item) => categoriaDeArchivo(item.nombre) === 'descriptor')
    : null;
  if (!archivo) return null;
  const { nombre, contenido } = await almacenamiento.descargarArchivo(carpeta, archivo.id);
  return { nombre, contenido };
}

/**
 * Descriptor de un cargo, en el mismo orden que usa la app: el guardado para el cargo,
 * el que subió una oferta antigua y, por último, el de demostración del catálogo.
 * @returns {Promise<{ nombre: string, contenido: Buffer } | null>}
 */
async function buscarDescriptor({ cargo, ofertaId } = {}) {
  const guardado = cargo
    ? db.prepare("SELECT id FROM cargos WHERE clave = ? AND descriptor_nombre <> ''").get(claveDeCargo(cargo))
    : null;
  return (
    (guardado ? await descriptorEnCarpeta(claveCarpetaCargo(guardado.id)) : null) ??
    (ofertaId ? await descriptorEnCarpeta(claveCarpetaOferta(ofertaId)) : null) ??
    descriptorDelCatalogo(cargo)
  );
}

module.exports = { bloqueDocumento, buscarDescriptor, descriptorDelCatalogo };
