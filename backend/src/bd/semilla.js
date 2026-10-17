/**
 * Script de siembra (seed) de la base de datos SQLite.
 * Inserta los 4 usuarios de prueba y los mismos datos simulados que usa el frontend:
 * candidatos, solicitudes, evaluaciones, ofertas y postulaciones (src/datos/semillaBase.js).
 *
 * Ejecutar con: npm run db:semilla (o node src/bd/semilla.js).
 * El administrador también puede restablecer los datos desde POST /api/admin/reiniciar.
 */
const path = require('path');
const { pathToFileURL } = require('url');
const bcrypt = require('bcryptjs');
const db = require('./conexion');
const { migrar } = require('./migrar');

const RAIZ_DATOS = path.join(__dirname, '..', '..', '..', 'src', 'datos');
const CONTRASENA_DEMO = 'AquaChile2026!';

const USUARIOS = [
  [1, 'Carolina Muñoz', 'carolina.munoz@aquachile.cl', 'analista@aquachile.cl', 'analista', 'Analista de Reclutamiento', 'Gestión de Personas'],
  [2, 'Ignacia Valdés Ortiz', 'ignacia.valdes@aquachile.cl', 'evaluador@aquachile.cl', 'evaluador', 'Psicóloga Evaluadora', 'Reclutamiento y Selección'],
  [3, 'Andrés Valdivia', 'andres.valdivia@aquachile.cl', 'admin@aquachile.cl', 'admin', 'Administrador Académico', 'Proyecto DSY1104'],
  [4, 'Patricia Saavedra', 'patricia.saavedra@aquachile.cl', 'jefatura@aquachile.cl', 'jefatura', 'Jefa de Reclutamiento y Selección', 'Gestión de Personas'],
];

/** Carga la semilla compartida con el frontend (módulo ESM) y la base simulada. */
async function cargarSemilla() {
  const { construirSemilla } = await import(pathToFileURL(path.join(RAIZ_DATOS, 'semillaBase.js')).href);
  return construirSemilla(require(path.join(RAIZ_DATOS, 'bdSimulada.json')));
}

const sinNulo = (valor) => valor ?? '';
const booleano = (valor) => (valor === null || valor === undefined ? null : valor ? 1 : 0);

/** Borra todo y vuelve a insertar los datos de demostración. Devuelve los totales. */
async function sembrar({ silencioso = false } = {}) {
  const log = silencioso ? () => {} : console.log;
  log('🌱 Iniciando siembra de datos en SQLite...');

  migrar();
  const datos = await cargarSemilla();
  const hash = bcrypt.hashSync(CONTRASENA_DEMO, 10);

  db.exec('BEGIN TRANSACTION;');
  try {
    // Orden inverso por claves foráneas.
    ['postulaciones', 'evaluaciones', 'solicitudes', 'ofertas', 'candidatos', 'usuarios'].forEach((tabla) =>
      db.exec(`DELETE FROM ${tabla};`),
    );

    const usuario = db.prepare(`
      INSERT INTO usuarios (id, nombre, correo, alias, contrasena_hash, rol, cargo, unidad)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    USUARIOS.forEach(([id, nombre, correo, alias, rol, cargo, unidad]) =>
      usuario.run(id, nombre, correo, alias, hash, rol, cargo, unidad),
    );

    const candidato = db.prepare(`
      INSERT INTO candidatos (id, nombre, correo, telefono, cargo, familia_cargo, origen)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    datos.candidatos.forEach((c) =>
      candidato.run(c.id, c.nombre, c.correo, c.telefono, c.cargo, c.familiaCargo, c.origen || 'Externo'),
    );

    const solicitud = db.prepare(`
      INSERT INTO solicitudes (
        id, candidato_id, cargo, familia_cargo, fecha_solicitud, estado, etapa, reclutador,
        profesional_responsable, observaciones, tipo_evaluacion, ubicacion, unidad, ceco,
        requiere_referencias, referido, cv, descriptor_cargo,
        fecha_entrevista, hora_entrevista, modalidad_entrevista
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    datos.solicitudes.forEach((s) =>
      solicitud.run(
        s.id, s.candidatoId, s.cargo, s.familiaCargo, s.fechaSolicitud, s.estado, sinNulo(s.etapa),
        sinNulo(s.reclutador), sinNulo(s.profesionalResponsable), sinNulo(s.observaciones),
        sinNulo(s.tipoEvaluacion), sinNulo(s.ubicacion), sinNulo(s.unidad), sinNulo(s.ceco),
        s.requiereReferencias ? 1 : 0, booleano(s.referido), sinNulo(s.cv), sinNulo(s.descriptorCargo),
        sinNulo(s.fechaEntrevista), sinNulo(s.horaEntrevista), sinNulo(s.modalidadEntrevista),
      ),
    );

    const evaluacion = db.prepare(`
      INSERT INTO evaluaciones (
        id, solicitud_id, fecha_evaluacion, resultado, observaciones, estado, fecha_informe, dias_respuesta
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    datos.evaluaciones.forEach((e) =>
      evaluacion.run(
        e.id, e.solicitudId, e.fechaEvaluacion, e.resultado, sinNulo(e.observaciones),
        e.estado || 'Realizada', e.fechaInforme || null, e.diasRespuesta ?? null,
      ),
    );

    const oferta = db.prepare(`
      INSERT INTO ofertas (
        id, titulo, area, cargo, familia_cargo, ubicacion, region, fecha_publicacion,
        descripcion, requisitos, jornada, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    datos.ofertas.forEach((o) =>
      oferta.run(
        o.id, o.titulo, o.area, o.cargo, o.familiaCargo, sinNulo(o.ubicacion), sinNulo(o.region),
        o.fechaPublicacion, sinNulo(o.descripcion), JSON.stringify(o.requisitos ?? []),
        o.jornada || 'Jornada completa', o.estado || 'Abierta',
      ),
    );

    const postulacion = db.prepare(`
      INSERT INTO postulaciones (
        id, oferta_id, candidato_id, fecha_postulacion, estado, ciudad, cv_nombre, solicitud_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    datos.postulaciones.forEach((p) =>
      postulacion.run(
        p.id, p.ofertaId, p.candidatoId, p.fechaPostulacion, p.estado, sinNulo(p.ciudad),
        sinNulo(p.cvNombre), p.solicitudId ?? null,
      ),
    );

    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }

  const totales = {
    usuarios: USUARIOS.length,
    ...Object.fromEntries(
      ['candidatos', 'solicitudes', 'evaluaciones', 'ofertas', 'postulaciones'].map((coleccion) => [
        coleccion,
        datos[coleccion].length,
      ]),
    ),
  };
  log('✅ Base de datos sembrada con éxito en SQLite:', totales);
  return totales;
}

if (require.main === module) {
  sembrar().catch((error) => {
    console.error('❌ Error al sembrar base de datos:', error);
    process.exitCode = 1;
  });
}

module.exports = { sembrar };
