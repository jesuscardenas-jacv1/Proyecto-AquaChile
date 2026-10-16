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

function migrar() {
  db.exec(`
    -- -------------------------------------------------------
    -- Tabla: usuarios (autenticación y control de acceso)
    -- -------------------------------------------------------
    CREATE TABLE IF NOT EXISTS usuarios (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre           TEXT    NOT NULL,
      correo           TEXT    NOT NULL UNIQUE,
      alias            TEXT    UNIQUE,
      contrasena_hash  TEXT    NOT NULL,
      rol              TEXT    NOT NULL CHECK(rol IN ('analista', 'evaluador')),
      cargo            TEXT,
      unidad           TEXT,
      creado_en        TEXT    NOT NULL DEFAULT (datetime('now'))
    );

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

}

if (require.main === module) {
  migrar();
  console.log('✅ Migración completada: tablas creadas exitosamente.');
}

module.exports = { migrar };
