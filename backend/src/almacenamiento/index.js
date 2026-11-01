/**
 * Punto de entrada de la capa de almacenamiento de documentos.
 *
 * ALMACENAMIENTO=local (por defecto) → carpetas en disco (backend/documentos).
 * ALMACENAMIENTO=graph               → carpetas en OneDrive / SharePoint vía Microsoft Graph.
 * ALMACENAMIENTO=drive               → carpetas en Google Drive (API v3).
 *
 * Todos los proveedores exponen la misma interfaz:
 *   obtenerCarpeta(clave, nombre, { crear }) → { id, nombre, webUrl } | null
 *   listarArchivos(carpeta)                  → [{ id, nombre, categoria, tamano, modificado, webUrl }]
 *   subirArchivo(carpeta, nombre, buffer)    → archivo
 *   obtenerArchivo(carpeta, archivoId)       → archivo
 *   descargarArchivo(carpeta, archivoId)     → { nombre, tipo, contenido }
 *   eliminarArchivo(carpeta, archivoId)
 */
const fs = require('fs');
const path = require('path');
const { AlmacenamientoLocal } = require('./local');
const { AlmacenamientoGraph } = require('./graph');
const { AlmacenamientoDrive, leerRefreshToken } = require('./drive');

const RAIZ_LOCAL_POR_DEFECTO = path.join(__dirname, '..', '..', 'documentos');
const TOKEN_DRIVE_POR_DEFECTO = path.join(__dirname, '..', '..', '.gdrive-token.json');

/** Lee la llave JSON de la cuenta de servicio desde la ruta de GDRIVE_CREDENCIALES. */
function leerCuentaServicio(ruta) {
  if (!ruta) return null;
  try {
    return JSON.parse(fs.readFileSync(path.resolve(ruta), 'utf8'));
  } catch (error) {
    throw new Error(`No se pudo leer GDRIVE_CREDENCIALES (${ruta}): ${error.message}`);
  }
}

function crearAlmacenamiento(entorno = process.env) {
  const tipo = (entorno.ALMACENAMIENTO || 'local').toLowerCase();

  if (tipo === 'graph') {
    return new AlmacenamientoGraph({
      tenantId: entorno.GRAPH_TENANT_ID,
      clientId: entorno.GRAPH_CLIENT_ID,
      clientSecret: entorno.GRAPH_CLIENT_SECRET,
      driveId: entorno.GRAPH_DRIVE_ID,
      usuario: entorno.GRAPH_USUARIO,
      carpetaRaiz: entorno.GRAPH_CARPETA_RAIZ,
    });
  }

  if (tipo === 'drive') {
    const modo = (entorno.GDRIVE_MODO || 'oauth').toLowerCase();
    return new AlmacenamientoDrive({
      modo,
      clientId: entorno.GDRIVE_CLIENT_ID,
      clientSecret: entorno.GDRIVE_CLIENT_SECRET,
      // En un servidor (Azure) el refresh token va como variable; en local, en .gdrive-token.json.
      refreshToken:
        modo === 'oauth'
          ? entorno.GDRIVE_REFRESH_TOKEN || leerRefreshToken(entorno.GDRIVE_TOKEN_ARCHIVO || TOKEN_DRIVE_POR_DEFECTO)
          : null,
      cuentaServicio: modo === 'cuenta-servicio' ? leerCuentaServicio(entorno.GDRIVE_CREDENCIALES) : null,
      carpetaRaizId: entorno.GDRIVE_CARPETA_RAIZ_ID,
      carpetaRaiz: entorno.GDRIVE_CARPETA_RAIZ || undefined,
    });
  }

  if (tipo === 'local') {
    return new AlmacenamientoLocal({ raiz: entorno.ALMACENAMIENTO_LOCAL_RUTA || RAIZ_LOCAL_POR_DEFECTO });
  }

  throw new Error(`ALMACENAMIENTO desconocido: "${tipo}". Use "local", "graph" o "drive".`);
}

let instancia = null;

/** Instancia única, creada al primer uso con la configuración del entorno. */
function obtenerAlmacenamiento() {
  instancia ??= crearAlmacenamiento();
  return instancia;
}

/** Permite a las pruebas inyectar un proveedor propio. */
function establecerAlmacenamiento(almacenamiento) {
  instancia = almacenamiento;
}

module.exports = { crearAlmacenamiento, obtenerAlmacenamiento, establecerAlmacenamiento };
