const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');
const { formatearOferta, formatearOfertaGestion } = require('../bd/formatos');
const { obtenerAlmacenamiento } = require('../almacenamiento');
const { ErrorAlmacenamiento, categoriaDeArchivo, claveCarpetaOferta } = require('../almacenamiento/comun');

/**
 * Ofertas del portal "Trabaja con nosotros".
 * - Lectura pública (sin sesión): solo las ofertas publicadas y abiertas.
 * - Con sesión: el analista crea, edita, publica y cierra; la jefatura solo consulta.
 * Una oferta es un borrador (no publicada), o está abierta o cerrada una vez publicada.
 * El descriptor se guarda por cargo (rutas/cargos.js); una oferta antigua puede tener el suyo.
 */
const router = express.Router();

const manejar = (fn) => (req, res, next) => fn(req, res).catch(next);

const CAMPOS_PARA_PUBLICAR = {
  area: 'Selecciona el área.',
  cargo: 'Indica el cargo.',
  familiaCargo: 'Selecciona la familia de cargo.',
  ubicacion: 'Indica la ubicación.',
  region: 'Indica la región.',
  descripcion: 'Describe el cargo.',
};

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const hoy = () => new Date().toISOString().slice(0, 10);
const obtener = (id) => db.prepare('SELECT * FROM ofertas WHERE id = ?').get(id);

const limpiarRequisitos = (requisitos) =>
  Array.isArray(requisitos) ? requisitos.map(texto).filter(Boolean) : [];

/** Campos editables, limpios y con los nombres del cliente. */
function leerCampos(cuerpo = {}) {
  return {
    titulo: texto(cuerpo.titulo),
    area: texto(cuerpo.area),
    cargo: texto(cuerpo.cargo),
    familiaCargo: texto(cuerpo.familiaCargo),
    ubicacion: texto(cuerpo.ubicacion),
    region: texto(cuerpo.region),
    descripcion: texto(cuerpo.descripcion),
    requisitos: limpiarRequisitos(cuerpo.requisitos),
    jornada: texto(cuerpo.jornada) || 'Jornada completa',
  };
}

/** Un borrador solo necesita título; lo que ve el público debe estar completo. */
function validar(campos, { completa }) {
  if (campos.titulo.length < 3) return 'El título debe tener al menos 3 caracteres.';
  if (!completa) return null;
  const faltante = Object.keys(CAMPOS_PARA_PUBLICAR).find((campo) => !campos[campo]);
  return faltante ? CAMPOS_PARA_PUBLICAR[faltante] : null;
}

/** GET /api/ofertas — ofertas publicadas y abiertas, las más recientes primero. */
router.get('/', (req, res) => {
  const ofertas = db
    .prepare(
      "SELECT * FROM ofertas WHERE estado = 'Abierta' AND publicada = 1 ORDER BY fecha_publicacion DESC, id DESC",
    )
    .all()
    .map(formatearOferta);
  res.json({ ok: true, total: ofertas.length, ofertas });
});

/** GET /api/ofertas/gestion — todas las ofertas, también borradores y cerradas. */
router.get('/gestion', autenticar, requerirRol('analista', 'jefatura'), (req, res) => {
  const ofertas = db
    .prepare('SELECT * FROM ofertas ORDER BY publicada ASC, fecha_publicacion DESC, id DESC')
    .all()
    .map(formatearOfertaGestion);
  res.json({ ok: true, total: ofertas.length, ofertas });
});

/** GET /api/ofertas/:id — detalle público de una oferta publicada y abierta. */
router.get('/:id', (req, res) => {
  const oferta = db
    .prepare("SELECT * FROM ofertas WHERE id = ? AND estado = 'Abierta' AND publicada = 1")
    .get(Number(req.params.id));
  if (!oferta) {
    return res.status(404).json({ error: 'La oferta no existe o ya cerró su proceso de postulación.' });
  }
  res.json({ ok: true, oferta: formatearOferta(oferta) });
});

/**
 * POST /api/ofertas
 * Crea una oferta como borrador, o publicada si llega `publicar: true`.
 */
router.post('/', autenticar, requerirRol('analista'), (req, res) => {
  const campos = leerCampos(req.body);
  const publicar = req.body?.publicar === true;
  const error = validar(campos, { completa: publicar });
  if (error) return res.status(400).json({ error });

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO ofertas (
        titulo, area, cargo, familia_cargo, ubicacion, region, fecha_publicacion,
        descripcion, requisitos, jornada, estado, publicada
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Abierta', ?)`,
    )
    .run(
      campos.titulo,
      campos.area,
      campos.cargo,
      campos.familiaCargo,
      campos.ubicacion,
      campos.region,
      publicar ? hoy() : '',
      campos.descripcion,
      JSON.stringify(campos.requisitos),
      campos.jornada,
      publicar ? 1 : 0,
    );
  res.status(201).json({ ok: true, oferta: formatearOfertaGestion(obtener(Number(lastInsertRowid))) });
});

/**
 * PUT /api/ofertas/:id
 * Edita los datos. Un borrador se publica al mismo tiempo si llega `publicar: true`;
 * una oferta ya publicada debe seguir completa.
 */
router.put('/:id', autenticar, requerirRol('analista'), (req, res) => {
  const id = Number(req.params.id);
  const actual = obtener(id);
  if (!actual) return res.status(404).json({ error: `Oferta #${req.params.id} no encontrada.` });

  const campos = leerCampos(req.body);
  const publicar = actual.publicada === 1 || req.body?.publicar === true;
  const error = validar(campos, { completa: publicar });
  if (error) return res.status(400).json({ error });

  db.prepare(
    `UPDATE ofertas SET
      titulo = ?, area = ?, cargo = ?, familia_cargo = ?, ubicacion = ?, region = ?,
      descripcion = ?, requisitos = ?, jornada = ?, publicada = ?, fecha_publicacion = ?
    WHERE id = ?`,
  ).run(
    campos.titulo,
    campos.area,
    campos.cargo,
    campos.familiaCargo,
    campos.ubicacion,
    campos.region,
    campos.descripcion,
    JSON.stringify(campos.requisitos),
    campos.jornada,
    publicar ? 1 : 0,
    actual.fecha_publicacion || (publicar ? hoy() : ''),
    id,
  );
  res.json({ ok: true, oferta: formatearOfertaGestion(obtener(id)) });
});

/**
 * PATCH /api/ofertas/:id/estado
 * Publica un borrador completo, cierra una oferta abierta o reabre una cerrada.
 * Una oferta publicada no vuelve a borrador: puede tener postulaciones.
 */
router.patch('/:id/estado', autenticar, requerirRol('analista'), (req, res) => {
  const id = Number(req.params.id);
  const actual = obtener(id);
  if (!actual) return res.status(404).json({ error: `Oferta #${req.params.id} no encontrada.` });

  const { estado } = req.body ?? {};
  const oferta = formatearOferta(actual);
  const permitidos = { Borrador: ['Abierta'], Abierta: ['Cerrada'], Cerrada: ['Abierta'] };
  if (!permitidos[oferta.estado].includes(estado)) {
    return res.status(400).json({ error: `Una oferta en estado ${oferta.estado} no puede pasar a ${estado}.` });
  }

  if (oferta.estado === 'Borrador') {
    const error = validar(leerCampos(oferta), { completa: true });
    if (error) return res.status(400).json({ error: `Completa la oferta antes de publicarla. ${error}` });
  }

  db.prepare('UPDATE ofertas SET estado = ?, publicada = 1, fecha_publicacion = ? WHERE id = ?').run(
    estado,
    actual.fecha_publicacion || hoy(),
    id,
  );
  res.json({ ok: true, oferta: formatearOfertaGestion(obtener(id)) });
});

/**
 * GET /api/ofertas/:id/descriptor — descriptor subido antes de que se guardaran por cargo.
 * Los nuevos se suben en /api/cargos/descriptor.
 */
router.get(
  '/:id/descriptor',
  autenticar,
  requerirRol('analista'),
  manejar(async (req, res) => {
    const id = Number(req.params.id);
    if (!obtener(id)) throw new ErrorAlmacenamiento(`Oferta #${req.params.id} no encontrada.`, 404);

    const almacenamiento = obtenerAlmacenamiento();
    const carpeta = await almacenamiento.obtenerCarpeta(claveCarpetaOferta(id), null);
    const archivo = carpeta
      ? (await almacenamiento.listarArchivos(carpeta)).find((item) => categoriaDeArchivo(item.nombre) === 'descriptor')
      : null;
    if (!archivo) throw new ErrorAlmacenamiento('La oferta no tiene un descriptor guardado.', 404);

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
