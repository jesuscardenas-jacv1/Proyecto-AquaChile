const express = require('express');
const db = require('../bd/conexion');
const { autenticar } = require('../middlewares/auth');
const { obtenerAlmacenamiento } = require('../almacenamiento');
const {
  CATEGORIAS,
  TAMANO_MAXIMO_BYTES,
  ErrorAlmacenamiento,
  claveCarpeta,
  nombreArchivo,
  nombreCarpeta,
  validarArchivo,
} = require('../almacenamiento/comun');

/**
 * Documentos de una solicitud (CV, descriptor de cargo e informe psicolaboral).
 * Se monta en /api/solicitudes/:id/documentos. La carpeta vive en el proveedor
 * configurado (disco local u OneDrive/SharePoint) y la página solo ve esta API.
 */
const router = express.Router({ mergeParams: true });

const leerArchivo = express.raw({ type: () => true, limit: TAMANO_MAXIMO_BYTES + 1024 });

function idSolicitud(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErrorAlmacenamiento('Id de solicitud inválido.', 400);
  }
  return id;
}

/**
 * Nombre del candidato para nombrar la carpeta. Se toma de la BD; si la solicitud aún no
 * existe en ella (la página trabaja con datos locales) se usa la cabecera X-Candidato.
 */
function nombreCandidato(req, id) {
  try {
    const fila = db
      .prepare(
        `SELECT c.nombre FROM solicitudes s JOIN candidatos c ON c.id = s.candidato_id WHERE s.id = ?`,
      )
      .get(id);
    if (fila?.nombre) return fila.nombre;
  } catch {
    // BD sin migrar: se usa el dato enviado por el cliente.
  }
  try {
    return decodeURIComponent(req.get('X-Candidato') ?? '');
  } catch {
    return '';
  }
}

function puedeGestionar(usuario, categoria) {
  if (usuario.rol === 'admin') return true;
  return (CATEGORIAS[categoria]?.roles ?? []).includes(usuario.rol);
}

async function carpetaExistente(id) {
  const carpeta = await obtenerAlmacenamiento().obtenerCarpeta(claveCarpeta(id), null);
  if (!carpeta) throw new ErrorAlmacenamiento('La solicitud aún no tiene documentos.', 404);
  return carpeta;
}

const manejar = (fn) => (req, res, next) => fn(req, res).catch(next);

/**
 * GET /api/solicitudes/:id/documentos
 * Carpeta de la solicitud y sus archivos. Si la carpeta no existe aún, lista vacía.
 */
router.get(
  '/',
  autenticar,
  manejar(async (req, res) => {
    const id = idSolicitud(req);
    const almacenamiento = obtenerAlmacenamiento();
    const carpeta = await almacenamiento.obtenerCarpeta(claveCarpeta(id), null);
    const archivos = carpeta ? await almacenamiento.listarArchivos(carpeta) : [];

    res.json({
      ok: true,
      proveedor: almacenamiento.proveedor,
      carpeta,
      archivos: archivos.map((archivo) => ({
        ...archivo,
        puedeEliminar: puedeGestionar(req.usuario, archivo.categoria),
      })),
      permisos: Object.keys(CATEGORIAS).filter((categoria) =>
        puedeGestionar(req.usuario, categoria),
      ),
    });
  }),
);

/**
 * POST /api/solicitudes/:id/documentos?categoria=cv&nombre=archivo.pdf
 * Cuerpo: el archivo en binario. Crea la carpeta de la solicitud si no existe.
 */
router.post(
  '/',
  autenticar,
  leerArchivo,
  manejar(async (req, res) => {
    const id = idSolicitud(req);
    const { categoria, nombre } = req.query;
    const contenido = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    validarArchivo({ categoria, nombre, tamano: contenido.length });
    if (!puedeGestionar(req.usuario, categoria)) {
      throw new ErrorAlmacenamiento(
        `Su perfil no puede subir documentos de tipo "${CATEGORIAS[categoria].etiqueta}".`,
        403,
      );
    }

    const almacenamiento = obtenerAlmacenamiento();
    const carpeta = await almacenamiento.obtenerCarpeta(
      claveCarpeta(id),
      nombreCarpeta(id, nombreCandidato(req, id)),
      { crear: true },
    );
    const archivo = await almacenamiento.subirArchivo(
      carpeta,
      nombreArchivo(categoria, nombre),
      contenido,
    );

    res.status(201).json({ ok: true, carpeta, archivo: { ...archivo, puedeEliminar: true } });
  }),
);

/**
 * GET /api/solicitudes/:id/documentos/:archivoId/contenido
 * Descarga el archivo a través del backend (el navegador nunca habla con Graph).
 */
router.get(
  '/:archivoId/contenido',
  autenticar,
  manejar(async (req, res) => {
    const carpeta = await carpetaExistente(idSolicitud(req));
    const { nombre, tipo, contenido } = await obtenerAlmacenamiento().descargarArchivo(
      carpeta,
      req.params.archivoId,
    );

    res.set({
      'Content-Type': tipo,
      'Content-Length': contenido.length,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    });
    res.send(contenido);
  }),
);

/**
 * DELETE /api/solicitudes/:id/documentos/:archivoId
 * Solo quien gestiona esa categoría (analista: CV y descriptor; evaluador: informe).
 */
router.delete(
  '/:archivoId',
  autenticar,
  manejar(async (req, res) => {
    const carpeta = await carpetaExistente(idSolicitud(req));
    const almacenamiento = obtenerAlmacenamiento();
    const archivo = await almacenamiento.obtenerArchivo(carpeta, req.params.archivoId);

    if (!puedeGestionar(req.usuario, archivo.categoria)) {
      throw new ErrorAlmacenamiento('Su perfil no puede eliminar este documento.', 403);
    }

    await almacenamiento.eliminarArchivo(carpeta, archivo.id);
    res.json({ ok: true, mensaje: 'Documento eliminado.' });
  }),
);

module.exports = router;
