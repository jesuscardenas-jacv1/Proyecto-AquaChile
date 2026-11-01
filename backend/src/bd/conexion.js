/**
 * Conexión única y compartida a la base de datos SQLite.
 * Usa node:sqlite (módulo nativo oficial de Node.js, síncrono y de alto rendimiento).
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

// En Azure App Service la BD va en el disco persistente (p. ej. BD_RUTA=/home/data/datos.sqlite).
const RUTA_BD = process.env.BD_RUTA || path.join(__dirname, '..', '..', 'datos.sqlite');
fs.mkdirSync(path.dirname(RUTA_BD), { recursive: true });

const db = new DatabaseSync(RUTA_BD);

// Activar claves foráneas y modo WAL para mejor concurrencia e integridad referencial
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

module.exports = db;
