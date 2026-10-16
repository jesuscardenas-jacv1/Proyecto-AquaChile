/**
 * Punto de entrada de la capa de almacenamiento de documentos.
 *
 * ALMACENAMIENTO=local (por defecto) → carpetas en disco (backend/documentos).
 * ALMACENAMIENTO=graph               → carpetas en OneDrive / SharePoint vía Microsoft Graph.
 *
 * Ambos proveedores exponen la misma interfaz:
 *   obtenerCarpeta(clave, nombre, { crear }) → { id, nombre, webUrl } | null
 *   listarArchivos(carpeta)                  → [{ id, nombre, categoria, tamano, modificado, webUrl }]
 *   subirArchivo(carpeta, nombre, buffer)    → archivo
 *   obtenerArchivo(carpeta, archivoId)       → archivo
 *   descargarArchivo(carpeta, archivoId)     → { nombre, tipo, contenido }
 *   eliminarArchivo(carpeta, archivoId)
 */
const path = require('path');
const { AlmacenamientoLocal } = require('./local');
const { AlmacenamientoGraph } = require('./graph');

const RAIZ_LOCAL_POR_DEFECTO = path.join(__dirname, '..', '..', 'documentos');

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

  if (tipo === 'local') {
    return new AlmacenamientoLocal({ raiz: entorno.ALMACENAMIENTO_LOCAL_RUTA || RAIZ_LOCAL_POR_DEFECTO });
  }

  throw new Error(`ALMACENAMIENTO desconocido: "${tipo}". Use "local" o "graph".`);
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
