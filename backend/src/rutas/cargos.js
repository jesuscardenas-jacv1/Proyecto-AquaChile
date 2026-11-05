const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');
const { formatearCargo } = require('../bd/formatos');
const { obtenerAlmacenamiento } = require('../almacenamiento');
const {
  ErrorAlmacenamiento,
  TAMANO_MAXIMO_BYTES,
  categoriaDeArchivo,
  claveCarpetaCargo,
  nombreArchivo,
  nombreCarpetaCargo,
  validarArchivo,
} = require('../almacenamiento/comun');

/**
 * Cargos con su descriptor. El analista lo sube una vez (carpeta C0001 - Cargo) y queda
 * disponible para todas las ofertas y solicitudes de ese cargo. Es de uso interno: el portal
 * público no lo ve. Cada solicitud guarda su propia copia al pasar a evaluación.
 */
const router = express.Router();

const leerArchivo = express.raw({ type: () => true, limit: TAMANO_MAXIMO_BYTES + 1024 });
const manejar = (fn) => (req, res, next) => fn(req, res).catch(next);
const texto = (valor) => (typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '');

/** "Técnico  Eléctrico" y "tecnico electrico" son el mismo cargo. */
const claveDeCargo = (nombre) =>
  texto(nombre)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** GET /api/cargos — cargos con descriptor guardado. */
router.get('/', autenticar, requerirRol('analista', 'jefatura'), (req, res) => {
  const cargos = db
    .prepare("SELECT * FROM cargos WHERE descriptor_nombre <> '' ORDER BY nombre")
    .all()
    .map(formatearCargo);
  res.json({ ok: true, total: cargos.length, cargos });
});

/**
 * POST /api/cargos/descriptor?cargo=Nombre&familiaCargo=Familia&nombre=descriptor.pdf
 * Cuerpo: el archivo en binario. Crea el cargo si no existe y reemplaza su descriptor.
 */
router.post(
  '/descriptor',
  autenticar,
  requerirRol('analista'),
  leerArchivo,
  manejar(async (req, res) => {
    const nombre = texto(req.query.cargo);
    if (nombre.length < 2) throw new ErrorAlmacenamiento('Indica el cargo del descriptor.', 400);

    const contenido = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    validarArchivo({ categoria: 'descriptor', nombre: req.query.nombre, tamano: contenido.length });

    const clave = claveDeCargo(nombre);
    db.prepare(
      `INSERT INTO cargos (clave, nombre, familia_cargo) VALUES (?, ?, ?)
       ON CONFLICT(clave) DO UPDATE SET
         familia_cargo = CASE WHEN excluded.familia_cargo <> '' THEN excluded.familia_cargo ELSE familia_cargo END`,
    ).run(clave, nombre, texto(req.query.familiaCargo));
    const cargo = db.prepare('SELECT * FROM cargos WHERE clave = ?').get(clave);

    const almacenamiento = obtenerAlmacenamiento();
    const carpeta = await almacenamiento.obtenerCarpeta(
      claveCarpetaCargo(cargo.id),
      nombreCarpetaCargo(cargo.id, cargo.nombre),
      { crear: true },
    );
    const guardado = await almacenamiento.subirArchivo(carpeta, nombreArchivo('descriptor', req.query.nombre), contenido);

    // Solo queda el último, que es el que se copia a las próximas solicitudes.
    const anteriores = (await almacenamiento.listarArchivos(carpeta)).filter(
      (archivo) => categoriaDeArchivo(archivo.nombre) === 'descriptor' && archivo.id !== guardado.id,
    );
    await Promise.all(anteriores.map((archivo) => almacenamiento.eliminarArchivo(carpeta, archivo.id)));

    db.prepare('UPDATE cargos SET descriptor_nombre = ? WHERE id = ?').run(req.query.nombre, cargo.id);
    res
      .status(201)
      .json({ ok: true, cargo: formatearCargo(db.prepare('SELECT * FROM cargos WHERE id = ?').get(cargo.id)) });
  }),
);

/** GET /api/cargos/:id/descriptor — descarga el descriptor del cargo. */
router.get(
  '/:id/descriptor',
  autenticar,
  requerirRol('analista'),
  manejar(async (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM cargos WHERE id = ?').get(id)) {
      throw new ErrorAlmacenamiento(`Cargo #${req.params.id} no encontrado.`, 404);
    }
    const almacenamiento = obtenerAlmacenamiento();
    const carpeta = await almacenamiento.obtenerCarpeta(claveCarpetaCargo(id), null);
    const archivo = carpeta
      ? (await almacenamiento.listarArchivos(carpeta)).find((item) => categoriaDeArchivo(item.nombre) === 'descriptor')
      : null;
    if (!archivo) throw new ErrorAlmacenamiento('El cargo no tiene un descriptor guardado.', 404);

    const { nombre, tipo, contenido } = await almacenamiento.descargarArchivo(carpeta, archivo.id);
    res.set({
      'Content-Type': tipo,
      'Content-Length': contenido.length,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    });
    res.send(contenido);
  }),
);

module.exports = router;
