/**
 * Conexión única y compartida a la base de datos SQLite.
 * Usa node:sqlite (módulo nativo oficial de Node.js, síncrono y de alto rendimiento).
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const RUTA_BD = path.join(__dirname, '..', '..', 'datos.sqlite');

const db = new DatabaseSync(RUTA_BD);

// Activar claves foráneas y modo WAL para mejor concurrencia e integridad referencial
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

module.exports = db;
