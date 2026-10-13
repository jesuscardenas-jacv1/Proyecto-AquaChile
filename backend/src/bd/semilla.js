/**
 * Script de siembra (seed) de la base de datos SQLite.
 * Inserta los usuarios corporativos iniciales y carga los 100 registros históricos
 * de candidatos, solicitudes y evaluaciones desde la base simulada de AquaChile.
 *
 * Ejecutar con: npm run db:semilla (o node src/bd/semilla.js)
 */
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./conexion');

// Ruta a los datos simulados existentes en el proyecto
const RUTA_BD_SIMULADA = path.join(__dirname, '..', '..', '..', 'src', 'datos', 'bdSimulada.json');

function sembrar() {
  console.log('🌱 Iniciando siembra de datos en SQLite...');

  const datosSimulados = require(RUTA_BD_SIMULADA);
  const passwordHash = bcrypt.hashSync('AquaChile2026!', 10);

  db.exec('BEGIN TRANSACTION;');

  try {
    // 1. Limpiar tablas existentes en orden inverso por claves foráneas
    db.exec('DELETE FROM evaluaciones;');
    db.exec('DELETE FROM solicitudes;');
    db.exec('DELETE FROM candidatos;');
    db.exec('DELETE FROM usuarios;');

    // 2. Insertar usuarios corporativos
    const stmtUsuario = db.prepare(`
      INSERT INTO usuarios (id, nombre, correo, alias, contrasena_hash, rol, cargo, unidad)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmtUsuario.run(
      1,
      'Carolina Muñoz',
      'carolina.munoz@aquachile.cl',
      'analista@aquachile.cl',
      passwordHash,
      'analista',
      'Analista de Reclutamiento',
      'Gestión de Personas',
    );

    stmtUsuario.run(
      2,
      'María Victoria Bustamante',
      'mvictoria.bustamante@aquachile.cl',
      'evaluador@aquachile.cl',
      passwordHash,
      'evaluador',
      'Psicóloga Evaluadora',
      'Reclutamiento y Selección',
    );

    console.log('   👤 2 usuarios corporativos sembrados.');

    // 3. Insertar candidatos
    const stmtCandidato = db.prepare(`
      INSERT INTO candidatos (id, nombre, correo, telefono, cargo, familia_cargo, origen)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of datosSimulados.candidatos) {
      stmtCandidato.run(
        c.id,
        c.nombre,
        c.correo,
        c.telefono,
        c.cargo,
        c.familiaCargo,
        c.origen || 'Externo',
      );
    }
    console.log(`   👥 ${datosSimulados.candidatos.length} candidatos sembrados.`);

    // 4. Insertar solicitudes
    const stmtSolicitud = db.prepare(`
      INSERT INTO solicitudes (
        id, candidato_id, cargo, familia_cargo, fecha_solicitud, estado,
        profesional_responsable, observaciones, tipo_evaluacion, ubicacion,
        unidad, ceco, requiere_referencias, referido, cv, descriptor_cargo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of datosSimulados.solicitudes) {
      stmtSolicitud.run(
        s.id,
        s.candidatoId,
        s.cargo,
        s.familiaCargo,
        s.fechaSolicitud,
        s.estado,
        s.profesionalResponsable || '',
        s.observaciones || '',
        s.tipoEvaluacion || '',
        s.ubicacion || '',
        s.unidad || '',
        s.ceco || '',
        s.requiereReferencias ? 1 : 0,
        s.referido ? 1 : 0,
        s.cv || '',
        s.descriptorCargo || '',
      );
    }
    console.log(`   📋 ${datosSimulados.solicitudes.length} solicitudes sembradas.`);

    // 5. Insertar evaluaciones
    const stmtEvaluacion = db.prepare(`
      INSERT INTO evaluaciones (
        id, solicitud_id, fecha_evaluacion, resultado, observaciones,
        estado, fecha_informe, dias_respuesta
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const e of datosSimulados.evaluaciones) {
      stmtEvaluacion.run(
        e.id,
        e.solicitudId,
        e.fechaEvaluacion,
        e.resultado,
        e.observaciones || '',
        e.estado || 'Realizada',
        e.fechaInforme || null,
        e.diasRespuesta ?? null,
      );
    }
    console.log(`   📝 ${datosSimulados.evaluaciones.length} evaluaciones sembradas.`);

    db.exec('COMMIT;');
    console.log('✅ Base de datos sembrada con éxito en SQLite.');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('❌ Error al sembrar base de datos:', err);
    process.exit(1);
  }
}

sembrar();
