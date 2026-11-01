const express = require('express');
const db = require('../bd/conexion');
const { autenticar, puedeVerNotasClinicas } = require('../middlewares/auth');
const { obtenerAlmacenamiento } = require('../almacenamiento');
const {
  CATEGORIAS,
  TAMANO_MAXIMO_BYTES,
  ErrorAlmacenamiento,
  claveCarpeta,
  claveCarpetaPostulacion,
  categoriaDeArchivo,
  nombreArchivo,
  nombreCarpeta,
  validarArchivo,
} = require('../almacenamiento/comun');
const { generarInformePdf, nombreArchivoInforme } = require('../almacenamiento/informePdf');

/**
 * Documentos de una solicitud (CV, descriptor de cargo, informe psicolaboral y pauta de
 * entrevista; la pauta es confidencial y solo la ven la psicóloga y el administrador).
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
 * existe en ella (la página trabaja con datos locales) se usa el respaldo enviado por el
 * cliente: el nombre del cuerpo o la cabecera X-Candidato.
 */
function nombreCandidato(req, id, respaldo) {
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
  if (respaldo) return respaldo;
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

/** Las categorías confidenciales (pauta de entrevista) solo las ve quien ve las notas clínicas. */
function puedeVer(usuario, categoria) {
  return !CATEGORIAS[categoria]?.confidencial || puedeVerNotasClinicas(usuario.rol);
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
      archivos: archivos
        .filter((archivo) => puedeVer(req.usuario, archivo.categoria))
        .map((archivo) => ({
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
 * POST /api/solicitudes/:id/documentos/informe
 * Genera el PDF oficial del informe psicolaboral y lo guarda en la carpeta de la solicitud
 * (reemplaza el anterior si la evaluación se actualiza). Exclusivo del evaluador.
 * Cuerpo JSON: { candidato, solicitud, evaluacion }. Las observaciones clínicas no se
 * incluyen: el PDF queda visible para el analista.
 */
router.post(
  '/informe',
  autenticar,
  manejar(async (req, res) => {
    const id = idSolicitud(req);
    if (!puedeGestionar(req.usuario, 'informe')) {
      throw new ErrorAlmacenamiento('Solo el profesional evaluador puede generar el informe.', 403);
    }

    const { candidato, solicitud, evaluacion } = req.body ?? {};
    const contenido = await generarInformePdf({ solicitudId: id, candidato, solicitud, evaluacion });
    const nombre = nombreCandidato(req, id, candidato?.nombre);

    const almacenamiento = obtenerAlmacenamiento();
    const carpeta = await almacenamiento.obtenerCarpeta(claveCarpeta(id), nombreCarpeta(id, nombre), {
      crear: true,
    });
    const archivo = await almacenamiento.subirArchivo(
      carpeta,
      nombreArchivo('informe', nombreArchivoInforme(id, nombre)),
      contenido,
    );

    res.status(201).json({ ok: true, carpeta, archivo: { ...archivo, puedeEliminar: true } });
  }),
);

/**
 * POST /api/solicitudes/:id/documentos/desde-postulacion
 * Cuerpo JSON: { postulacionId, nombreCandidato }. Copia el CV que el postulante subió
 * en el portal a la carpeta de la solicitud (al pasarlo a evaluación). Solo analista.
 */
router.post(
  '/desde-postulacion',
  autenticar,
  manejar(async (req, res) => {
    const id = idSolicitud(req);
    if (!puedeGestionar(req.usuario, 'cv')) {
      throw new ErrorAlmacenamiento('Solo el analista puede pasar postulaciones a evaluación.', 403);
    }
    const postulacionId = Number(req.body?.postulacionId);
    if (!Number.isInteger(postulacionId) || postulacionId <= 0) {
      throw new ErrorAlmacenamiento('Id de postulación inválido.', 400);
    }

    const almacenamiento = obtenerAlmacenamiento();
    const origen = await almacenamiento.obtenerCarpeta(claveCarpetaPostulacion(postulacionId), null);
    const archivosCv = origen
      ? (await almacenamiento.listarArchivos(origen)).filter((archivo) => categoriaDeArchivo(archivo.nombre) === 'cv')
      : [];
    if (archivosCv.length === 0) {
      throw new ErrorAlmacenamiento('La postulación no tiene un currículum guardado en el servidor.', 404);
    }

    const nombre = nombreCandidato(req, id, req.body?.nombreCandidato);
    const destino = await almacenamiento.obtenerCarpeta(claveCarpeta(id), nombreCarpeta(id, nombre), {
      crear: true,
    });
    const copiados = [];
    for (const archivo of archivosCv) {
      const { contenido } = await almacenamiento.descargarArchivo(origen, archivo.id);
      copiados.push(await almacenamiento.subirArchivo(destino, archivo.nombre, contenido));
    }

    res.status(201).json({ ok: true, carpeta: destino, archivos: copiados });
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
    const almacenamiento = obtenerAlmacenamiento();
    const archivo = await almacenamiento.obtenerArchivo(carpeta, req.params.archivoId);
    // Para quien no puede verla, la pauta "no existe" (no se confirma que esté ahí).
    if (!puedeVer(req.usuario, archivo.categoria)) {
      throw new ErrorAlmacenamiento('Archivo no encontrado.', 404);
    }
    const { nombre, tipo, contenido } = await almacenamiento.descargarArchivo(carpeta, archivo.id);

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

    if (!puedeVer(req.usuario, archivo.categoria)) {
      throw new ErrorAlmacenamiento('Archivo no encontrado.', 404);
    }
    if (!puedeGestionar(req.usuario, archivo.categoria)) {
      throw new ErrorAlmacenamiento('Su perfil no puede eliminar este documento.', 403);
    }

    await almacenamiento.eliminarArchivo(carpeta, archivo.id);
    res.json({ ok: true, mensaje: 'Documento eliminado.' });
  }),
);

module.exports = router;
