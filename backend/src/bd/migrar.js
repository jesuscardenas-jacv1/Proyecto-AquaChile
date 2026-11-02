/**
 * Script de migración: crea todas las tablas de la base de datos si no existen.
 * Ejecutar con: npm run db:migrar
 *
 * Modelo relacional:
 *   usuarios ← (sin FK, tabla base de autenticación)
 *   candidatos ← tabla independiente
 *   solicitudes → candidatos (candidato_id FK)
 *   evaluaciones → solicitudes (solicitud_id FK, relación 1:1)
 *   ofertas ← tabla independiente (portal "Trabaja con nosotros")
 *   postulaciones → ofertas, candidatos y solicitudes (al pasar a evaluación)
 */
const db = require('./conexion');

/** Los 4 roles del caso académico (sección 4.3). */
const ROLES = ['admin', 'analista', 'evaluador', 'jefatura'];

function tablaUsuarios(nombre) {
  return `CREATE TABLE IF NOT EXISTS ${nombre} (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre           TEXT    NOT NULL,
      correo           TEXT    NOT NULL UNIQUE,
      alias            TEXT    UNIQUE,
      contrasena_hash  TEXT    NOT NULL,
      rol              TEXT    NOT NULL CHECK(rol IN (${ROLES.map((rol) => `'${rol}'`).join(', ')})),
      cargo            TEXT,
      unidad           TEXT,
      creado_en        TEXT    NOT NULL DEFAULT (datetime('now'))
    );`;
}

/**
 * SQLite no permite cambiar un CHECK: si la tabla usuarios viene de una versión
 * con menos roles, se recrea conservando sus filas.
 */
function actualizarRolesUsuarios() {
  const { sql } = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'").get();
  if (ROLES.every((rol) => sql.includes(`'${rol}'`))) return;

  db.exec('BEGIN TRANSACTION;');
  try {
    db.exec(tablaUsuarios('usuarios_nueva'));
    db.exec('INSERT INTO usuarios_nueva SELECT * FROM usuarios;');
    db.exec('DROP TABLE usuarios;');
    db.exec('ALTER TABLE usuarios_nueva RENAME TO usuarios;');
    db.exec('COMMIT;');
    console.log('   🔄 Tabla usuarios actualizada con los roles admin y jefatura.');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

/** Agrega una columna si la tabla aún no la tiene (SQLite no tiene ADD COLUMN IF NOT EXISTS). */
function agregarColumna(tabla, columna, definicion) {
  const columnas = db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name);
  if (!columnas.includes(columna)) {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion};`);
  }
}

function migrar() {
  db.exec(`
    -- -------------------------------------------------------
    -- Tabla: usuarios (autenticación y control de acceso)
    -- -------------------------------------------------------
    ${tablaUsuarios('usuarios')}

    -- -------------------------------------------------------
    -- Tabla: candidatos
    -- -------------------------------------------------------
    CREATE TABLE IF NOT EXISTS candidatos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre        TEXT    NOT NULL,
      correo        TEXT    NOT NULL,
      telefono      TEXT    NOT NULL,
      cargo         TEXT    NOT NULL,
      familia_cargo TEXT    NOT NULL,
      origen        TEXT    NOT NULL DEFAULT 'Externo',
      creado_en     TEXT    NOT NULL DEFAULT (datetime('now')),
      actualizado_en TEXT   NOT NULL DEFAULT (datetime('now'))
    );

    -- -------------------------------------------------------
    -- Tabla: solicitudes (solicitudes de evaluación psicolaboral)
    -- -------------------------------------------------------
    CREATE TABLE IF NOT EXISTS solicitudes (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      candidato_id            INTEGER NOT NULL REFERENCES candidatos(id) ON DELETE RESTRICT,
      cargo                   TEXT    NOT NULL,
      familia_cargo           TEXT    NOT NULL,
      fecha_solicitud         TEXT    NOT NULL,
      estado                  TEXT    NOT NULL DEFAULT 'Pendiente'
                                CHECK(estado IN ('Pendiente', 'En proceso', 'Finalizada')),
      profesional_responsable TEXT    NOT NULL DEFAULT '',
      observaciones           TEXT    NOT NULL DEFAULT '',
      tipo_evaluacion         TEXT    NOT NULL DEFAULT '',
      ubicacion               TEXT    NOT NULL DEFAULT '',
      unidad                  TEXT    NOT NULL DEFAULT '',
      ceco                    TEXT    NOT NULL DEFAULT '',
      requiere_referencias    INTEGER NOT NULL DEFAULT 0,
      referido                INTEGER,
      cv                      TEXT    NOT NULL DEFAULT '',
      descriptor_cargo        TEXT    NOT NULL DEFAULT '',
      creado_en               TEXT    NOT NULL DEFAULT (datetime('now')),
      actualizado_en          TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- -------------------------------------------------------
    -- Tabla: evaluaciones (relación 1:1 con solicitudes)
    -- -------------------------------------------------------
    CREATE TABLE IF NOT EXISTS evaluaciones (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id      INTEGER NOT NULL UNIQUE REFERENCES solicitudes(id) ON DELETE CASCADE,
      fecha_evaluacion  TEXT    NOT NULL,
      resultado         TEXT    NOT NULL
                          CHECK(resultado IN ('Recomendado', 'Recomendado con observaciones', 'No recomendado')),
      observaciones     TEXT    NOT NULL DEFAULT '',
      estado            TEXT    NOT NULL DEFAULT 'Realizada'
                          CHECK(estado IN ('Pendiente', 'Realizada')),
      fecha_informe     TEXT,
      dias_respuesta    INTEGER,
      creado_en         TEXT    NOT NULL DEFAULT (datetime('now')),
      actualizado_en    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    -- -------------------------------------------------------
    -- Tabla: ofertas (portal "Trabaja con nosotros")
    -- -------------------------------------------------------
    CREATE TABLE IF NOT EXISTS ofertas (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo            TEXT    NOT NULL,
      area              TEXT    NOT NULL,
      cargo             TEXT    NOT NULL,
      familia_cargo     TEXT    NOT NULL,
      ubicacion         TEXT    NOT NULL DEFAULT '',
      region            TEXT    NOT NULL DEFAULT '',
      fecha_publicacion TEXT    NOT NULL,
      descripcion       TEXT    NOT NULL DEFAULT '',
      requisitos        TEXT    NOT NULL DEFAULT '[]',
      jornada           TEXT    NOT NULL DEFAULT 'Jornada completa',
      estado            TEXT    NOT NULL DEFAULT 'Abierta' CHECK(estado IN ('Abierta', 'Cerrada'))
    );

    -- -------------------------------------------------------
    -- Tabla: postulaciones (un candidato postula a una oferta)
    -- -------------------------------------------------------
    CREATE TABLE IF NOT EXISTS postulaciones (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      oferta_id         INTEGER NOT NULL REFERENCES ofertas(id) ON DELETE RESTRICT,
      candidato_id      INTEGER NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
      fecha_postulacion TEXT    NOT NULL,
      estado            TEXT    NOT NULL DEFAULT 'Recibida'
                          CHECK(estado IN ('Recibida', 'En evaluación', 'Descartada')),
      ciudad            TEXT    NOT NULL DEFAULT '',
      cv_nombre         TEXT    NOT NULL DEFAULT '',
      solicitud_id      INTEGER REFERENCES solicitudes(id) ON DELETE SET NULL,
      creado_en         TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Columnas agregadas después de la primera versión del esquema.
  agregarColumna('solicitudes', 'reclutador', "TEXT NOT NULL DEFAULT ''");
  agregarColumna('solicitudes', 'etapa', "TEXT NOT NULL DEFAULT ''");
  agregarColumna('solicitudes', 'fecha_entrevista', "TEXT NOT NULL DEFAULT ''");
  agregarColumna('solicitudes', 'hora_entrevista', "TEXT NOT NULL DEFAULT ''");
  agregarColumna('solicitudes', 'modalidad_entrevista', "TEXT NOT NULL DEFAULT ''");
  // Evaluación por competencias (lista JSON: competencia, nivel, fortalezas, oportunidades).
  agregarColumna('evaluaciones', 'competencias', "TEXT NOT NULL DEFAULT '[]'");

  actualizarRolesUsuarios();

  // Foto de perfil en una tabla aparte: así la tabla usuarios no cambia (se recrea al
  // actualizar sus roles). Sin FK por lo mismo; se borra junto con el usuario.
  db.exec(`
    CREATE TABLE IF NOT EXISTS fotos_usuario (
      usuario_id     INTEGER PRIMARY KEY,
      foto           TEXT    NOT NULL,
      actualizado_en TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
  console.log('✅ Migración completada: tablas creadas exitosamente.');
}

if (require.main === module) {
  migrar();
}

module.exports = { migrar };
