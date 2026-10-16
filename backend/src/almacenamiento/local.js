/**
 * Proveedor local: guarda las carpetas de cada solicitud en el disco del servidor.
 * Se usa en desarrollo y en la demo, cuando no hay acceso al tenant de Microsoft 365.
 * Replica la misma estructura que se crea en OneDrive / SharePoint.
 */
const fs = require('fs/promises');
const path = require('path');
const {
  ErrorAlmacenamiento,
  categoriaDeArchivo,
  esCarpetaDeSolicitud,
  tipoMime,
} = require('./comun');

class AlmacenamientoLocal {
  constructor({ raiz }) {
    this.proveedor = 'local';
    this.raiz = path.resolve(raiz);
  }

  async obtenerCarpeta(clave, nombre, { crear = false } = {}) {
    await fs.mkdir(this.raiz, { recursive: true });
    const entradas = await fs.readdir(this.raiz, { withFileTypes: true });
    const existente = entradas.find(
      (entrada) => entrada.isDirectory() && esCarpetaDeSolicitud(entrada.name, clave),
    );

    if (existente) return this.#carpeta(existente.name);
    if (!crear) return null;

    await fs.mkdir(path.join(this.raiz, nombre));
    return this.#carpeta(nombre);
  }

  async listarArchivos(carpeta) {
    const ruta = path.join(this.raiz, carpeta.id);
    const entradas = await fs.readdir(ruta, { withFileTypes: true });
    const archivos = await Promise.all(
      entradas
        .filter((entrada) => entrada.isFile() && !entrada.name.startsWith('.'))
        .map(async (entrada) => {
          const stats = await fs.stat(path.join(ruta, entrada.name));
          return this.#archivo(entrada.name, stats);
        }),
    );
    return archivos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  async subirArchivo(carpeta, nombre, contenido) {
    const ruta = this.#rutaArchivo(carpeta, nombre);
    await fs.writeFile(ruta, contenido);
    return this.#archivo(nombre, await fs.stat(ruta));
  }

  async descargarArchivo(carpeta, archivoId) {
    const ruta = this.#rutaArchivo(carpeta, archivoId);
    try {
      const contenido = await fs.readFile(ruta);
      return { nombre: archivoId, tipo: tipoMime(archivoId), contenido };
    } catch (error) {
      if (error.code === 'ENOENT') throw new ErrorAlmacenamiento('Archivo no encontrado.', 404);
      throw error;
    }
  }

  async obtenerArchivo(carpeta, archivoId) {
    try {
      return this.#archivo(archivoId, await fs.stat(this.#rutaArchivo(carpeta, archivoId)));
    } catch (error) {
      if (error.code === 'ENOENT') throw new ErrorAlmacenamiento('Archivo no encontrado.', 404);
      throw error;
    }
  }

  async eliminarArchivo(carpeta, archivoId) {
    try {
      await fs.unlink(this.#rutaArchivo(carpeta, archivoId));
    } catch (error) {
      if (error.code === 'ENOENT') throw new ErrorAlmacenamiento('Archivo no encontrado.', 404);
      throw error;
    }
  }

  #carpeta(nombre) {
    return { id: nombre, nombre, webUrl: null };
  }

  #archivo(nombre, stats) {
    return {
      id: nombre,
      nombre,
      categoria: categoriaDeArchivo(nombre),
      tamano: stats.size,
      modificado: stats.mtime.toISOString(),
      webUrl: null,
    };
  }

  /** Evita salir de la carpeta de la solicitud con nombres como "../otro". */
  #rutaArchivo(carpeta, nombre) {
    if (!nombre || /[/\\\u0000]/.test(nombre) || nombre.startsWith('.')) {
      throw new ErrorAlmacenamiento('Nombre de archivo inválido.', 400);
    }
    return path.join(this.raiz, carpeta.id, nombre);
  }
}

module.exports = { AlmacenamientoLocal };
