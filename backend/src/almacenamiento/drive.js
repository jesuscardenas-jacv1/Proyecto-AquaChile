/**
 * Proveedor Google Drive: guarda la carpeta de cada solicitud y de cada postulación en
 * Google Drive, con la API REST v3 (sin SDK).
 *
 * Dos formas de autenticarse (GDRIVE_MODO):
 *   - "oauth" (por defecto): una cuenta de Google autoriza la app una vez
 *     (`npm run drive:autorizar`) y el backend usa su refresh token. Alcance `drive.file`:
 *     la app solo ve las carpetas y archivos que ella misma creó. Sirve con cualquier
 *     cuenta de Gmail o de Google Workspace.
 *   - "cuenta-servicio": una cuenta de servicio de Google Cloud con su llave JSON. Solo
 *     sirve dentro de una unidad compartida (Shared Drive) de Google Workspace: las
 *     cuentas de servicio no tienen cuota propia para guardar archivos.
 *
 * Documentación: https://developers.google.com/drive/api/reference/rest/v3/files
 */
const crypto = require('crypto');
const fs = require('fs');
const {
  ErrorAlmacenamiento,
  categoriaDeArchivo,
  esCarpetaDeSolicitud,
  tipoMime,
} = require('./comun');

const URL_DRIVE = 'https://www.googleapis.com/drive/v3';
const URL_CARGA = 'https://www.googleapis.com/upload/drive/v3';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const ALCANCE_OAUTH = 'https://www.googleapis.com/auth/drive.file';
const ALCANCE_CUENTA_SERVICIO = 'https://www.googleapis.com/auth/drive';
const TIPO_CARPETA = 'application/vnd.google-apps.folder';
const CAMPOS = 'id,name,mimeType,size,modifiedTime,webViewLink,parents';
/** La carga "multipart" admite hasta 5 MB; sobre eso se usa una carga reanudable. */
const LIMITE_CARGA_SIMPLE = 5 * 1024 * 1024;
/** Parámetros para que todo funcione igual en "Mi unidad" y en unidades compartidas. */
const TODAS_LAS_UNIDADES = 'supportsAllDrives=true';
const LISTAR_TODAS = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

/** Escapa un texto para usarlo entre comillas simples en una consulta `q` de Drive. */
const literal = (texto) => `'${String(texto).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const base64url = (valor) => Buffer.from(valor).toString('base64url');

/** Lee el refresh token guardado por `npm run drive:autorizar`. */
function leerRefreshToken(archivo) {
  try {
    return JSON.parse(fs.readFileSync(archivo, 'utf8')).refresh_token ?? null;
  } catch {
    return null;
  }
}

class AlmacenamientoDrive {
  constructor({
    modo = 'oauth',
    clientId,
    clientSecret,
    refreshToken,
    cuentaServicio,
    carpetaRaizId,
    carpetaRaiz = 'Evaluaciones Psicolaborales',
    fetch = globalThis.fetch,
    ahora = () => Date.now(),
  }) {
    if (modo === 'oauth') {
      if (!clientId || !clientSecret) {
        throw new Error('Faltan GDRIVE_CLIENT_ID o GDRIVE_CLIENT_SECRET para usar Google Drive.');
      }
      if (!refreshToken) {
        throw new Error('Google Drive no está autorizado: ejecute `npm run drive:autorizar` en backend/.');
      }
    } else if (modo === 'cuenta-servicio') {
      if (!cuentaServicio?.client_email || !cuentaServicio?.private_key) {
        throw new Error('GDRIVE_CREDENCIALES debe apuntar a la llave JSON de una cuenta de servicio.');
      }
      if (!carpetaRaizId) {
        throw new Error(
          'Con cuenta de servicio defina GDRIVE_CARPETA_RAIZ_ID: una carpeta de una unidad compartida.',
        );
      }
    } else {
      throw new Error(`GDRIVE_MODO desconocido: "${modo}". Use "oauth" o "cuenta-servicio".`);
    }

    this.proveedor = 'drive';
    this.modo = modo;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.cuentaServicio = cuentaServicio;
    this.carpetaRaiz = carpetaRaiz;
    this.idRaiz = carpetaRaizId || null;
    this.fetch = fetch;
    this.ahora = ahora;
    this.token = null;
  }

  /* ------------------------------ API pública ------------------------------ */

  async obtenerCarpeta(clave, nombre, { crear = false } = {}) {
    const idRaiz = await this.#asegurarRaiz();
    const candidatas = await this.#buscar(
      `${literal(idRaiz)} in parents and mimeType = '${TIPO_CARPETA}' and trashed = false and name contains ${literal(clave)}`,
    );
    const existente = candidatas.find((item) => esCarpetaDeSolicitud(item.name, clave));

    if (existente) return this.#carpeta(existente);
    if (!crear) return null;

    return this.#carpeta(await this.#crearCarpeta(idRaiz, nombre));
  }

  async listarArchivos(carpeta) {
    const items = await this.#buscar(
      `${literal(carpeta.id)} in parents and mimeType != '${TIPO_CARPETA}' and trashed = false`,
    );
    return items.map((item) => this.#archivo(item)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  /** Si ya hay un archivo con ese nombre en la carpeta se reemplaza su contenido (Drive guarda versiones). */
  async subirArchivo(carpeta, nombre, contenido) {
    const [existente] = await this.#buscar(
      `${literal(carpeta.id)} in parents and name = ${literal(nombre)} and trashed = false`,
    );
    const tipo = tipoMime(nombre);

    if (existente) {
      const item = await this.#llamar(
        'PATCH',
        `${URL_CARGA}/files/${encodeURIComponent(existente.id)}?uploadType=media&fields=${CAMPOS}&${TODAS_LAS_UNIDADES}`,
        { cuerpo: contenido, cabeceras: { 'Content-Type': tipo } },
      );
      return this.#archivo(item);
    }

    const metadatos = { name: nombre, parents: [carpeta.id], mimeType: tipo };
    if (contenido.length <= LIMITE_CARGA_SIMPLE) {
      const limite = `aquachile-${crypto.randomBytes(8).toString('hex')}`;
      const cuerpo = Buffer.concat([
        Buffer.from(
          `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadatos)}\r\n` +
            `--${limite}\r\nContent-Type: ${tipo}\r\n\r\n`,
        ),
        contenido,
        Buffer.from(`\r\n--${limite}--`),
      ]);
      const item = await this.#llamar(
        'POST',
        `${URL_CARGA}/files?uploadType=multipart&fields=${CAMPOS}&${TODAS_LAS_UNIDADES}`,
        { cuerpo, cabeceras: { 'Content-Type': `multipart/related; boundary=${limite}` } },
      );
      return this.#archivo(item);
    }

    // Carga reanudable: primero los metadatos (devuelve la URL de carga), luego el contenido.
    const sesion = await this.#llamar(
      'POST',
      `${URL_CARGA}/files?uploadType=resumable&fields=${CAMPOS}&${TODAS_LAS_UNIDADES}`,
      { json: metadatos, cabeceras: { 'X-Upload-Content-Type': tipo }, crudo: true },
    );
    const urlCarga = sesion.headers.get('location');
    if (!urlCarga) throw new ErrorAlmacenamiento('Google Drive no entregó la URL de carga.', 502);
    const item = await this.#llamar('PUT', urlCarga, { cuerpo: contenido, cabeceras: { 'Content-Type': tipo } });
    return this.#archivo(item);
  }

  async obtenerArchivo(carpeta, archivoId) {
    const item = await this.#llamar(
      'GET',
      `${URL_DRIVE}/files/${encodeURIComponent(archivoId)}?fields=${CAMPOS},trashed&${TODAS_LAS_UNIDADES}`,
    );
    // Impide leer o borrar archivos de otra carpeta adivinando su id.
    if (item.mimeType === TIPO_CARPETA || item.trashed || !(item.parents ?? []).includes(carpeta.id)) {
      throw new ErrorAlmacenamiento('Archivo no encontrado.', 404);
    }
    return this.#archivo(item);
  }

  async descargarArchivo(carpeta, archivoId) {
    const archivo = await this.obtenerArchivo(carpeta, archivoId);
    const respuesta = await this.#llamar(
      'GET',
      `${URL_DRIVE}/files/${encodeURIComponent(archivoId)}?alt=media&${TODAS_LAS_UNIDADES}`,
      { crudo: true },
    );
    const contenido = Buffer.from(await respuesta.arrayBuffer());
    return { nombre: archivo.nombre, tipo: tipoMime(archivo.nombre), contenido };
  }

  /** Se envía a la papelera (recuperable 30 días desde Drive), no se borra definitivamente. */
  async eliminarArchivo(carpeta, archivoId) {
    await this.obtenerArchivo(carpeta, archivoId);
    await this.#llamar(
      'PATCH',
      `${URL_DRIVE}/files/${encodeURIComponent(archivoId)}?fields=id&${TODAS_LAS_UNIDADES}`,
      { json: { trashed: true } },
    );
  }

  /* ------------------------------- Internos -------------------------------- */

  async #obtenerToken() {
    if (this.token && this.token.expira > this.ahora() + 60_000) return this.token.valor;

    const parametros =
      this.modo === 'oauth'
        ? {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            refresh_token: this.refreshToken,
            grant_type: 'refresh_token',
          }
        : {
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: this.#firmarJwtCuentaServicio(),
          };

    const respuesta = await this.fetch(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(parametros).toString(),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !datos.access_token) {
      const motivo = datos.error === 'invalid_grant'
        ? 'la autorización expiró o fue revocada; ejecute `npm run drive:autorizar` de nuevo'
        : datos.error_description || datos.error || respuesta.status;
      throw new ErrorAlmacenamiento(`No se pudo autenticar con Google Drive: ${motivo}.`, 502);
    }

    this.token = { valor: datos.access_token, expira: this.ahora() + datos.expires_in * 1000 };
    return this.token.valor;
  }

  /** JWT firmado con la llave de la cuenta de servicio (RS256), válido una hora. */
  #firmarJwtCuentaServicio() {
    const ahora = Math.floor(this.ahora() / 1000);
    const encabezado = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const carga = base64url(
      JSON.stringify({
        iss: this.cuentaServicio.client_email,
        scope: ALCANCE_CUENTA_SERVICIO,
        aud: URL_TOKEN,
        iat: ahora,
        exp: ahora + 3600,
      }),
    );
    const firma = crypto.createSign('RSA-SHA256').update(`${encabezado}.${carga}`).sign(this.cuentaServicio.private_key);
    return `${encabezado}.${carga}.${firma.toString('base64url')}`;
  }

  async #llamar(metodo, url, { json, cuerpo, cabeceras = {}, crudo = false } = {}) {
    const respuesta = await this.fetch(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${await this.#obtenerToken()}`,
        ...(json ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
        ...cabeceras,
      },
      body: json ? JSON.stringify(json) : cuerpo,
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.json().catch(() => ({}));
      if (respuesta.status === 404) {
        throw new ErrorAlmacenamiento('Elemento no encontrado en Google Drive.', 404);
      }
      throw new ErrorAlmacenamiento(
        `Error de Google Drive (${respuesta.status}): ${detalle.error?.message ?? 'sin detalle'}`,
        502,
      );
    }

    if (crudo) return respuesta;
    return respuesta.status === 204 ? null : respuesta.json();
  }

  /** Busca con una consulta `q` y recorre todas las páginas. */
  async #buscar(consulta) {
    const items = [];
    let pagina = null;
    do {
      const parametros = new URLSearchParams({
        q: consulta,
        fields: `nextPageToken,files(${CAMPOS})`,
        pageSize: '200',
        ...(pagina ? { pageToken: pagina } : {}),
      });
      const datos = await this.#llamar('GET', `${URL_DRIVE}/files?${parametros}&${LISTAR_TODAS}`);
      items.push(...(datos.files ?? []));
      pagina = datos.nextPageToken ?? null;
    } while (pagina);
    return items;
  }

  /**
   * Carpeta raíz: la indicada por GDRIVE_CARPETA_RAIZ_ID o, en modo OAuth, una carpeta con
   * el nombre configurado en "Mi unidad" (se crea la primera vez).
   */
  async #asegurarRaiz() {
    if (this.idRaiz) return this.idRaiz;

    const [existente] = await this.#buscar(
      `'root' in parents and mimeType = '${TIPO_CARPETA}' and trashed = false and name = ${literal(this.carpetaRaiz)}`,
    );
    this.idRaiz = existente ? existente.id : (await this.#crearCarpeta('root', this.carpetaRaiz)).id;
    return this.idRaiz;
  }

  async #crearCarpeta(idPadre, nombre) {
    return this.#llamar('POST', `${URL_DRIVE}/files?fields=${CAMPOS}&${TODAS_LAS_UNIDADES}`, {
      json: { name: nombre, mimeType: TIPO_CARPETA, parents: [idPadre] },
    });
  }

  #carpeta(item) {
    return { id: item.id, nombre: item.name, webUrl: item.webViewLink ?? null };
  }

  #archivo(item) {
    return {
      id: item.id,
      nombre: item.name,
      categoria: categoriaDeArchivo(item.name),
      tamano: Number(item.size ?? 0),
      modificado: item.modifiedTime ?? null,
      webUrl: item.webViewLink ?? null,
    };
  }
}

module.exports = { AlmacenamientoDrive, ALCANCE_OAUTH, URL_TOKEN, leerRefreshToken };
