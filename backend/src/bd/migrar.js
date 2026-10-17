/**
 * Script de migración: crea todas las tablas de la base de datos si no existen.
 * Ejecutar con: npm run db:migrar
 *
 * Modelo relacional:
 *   usuarios ← (sin FK, tabla base de autenticación)
 *   candidatos ← tabla independiente
 *   solicitudes → candidatos (candidato_id FK)
 *   evaluaciones → solicitudes (solicitud_id FK, relación 1:1)
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

  actualizarRolesUsuarios();
  console.log('✅ Migración completada: tablas creadas exitosamente.');
}

migrar();
