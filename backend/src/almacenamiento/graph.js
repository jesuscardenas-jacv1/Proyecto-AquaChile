/**
 * Proveedor Microsoft Graph: guarda las carpetas de cada solicitud en OneDrive o en una
 * biblioteca de documentos de SharePoint del tenant de AquaChile.
 *
 * Autenticación "app-only" (client credentials) con un registro de aplicación en
 * Microsoft Entra ID. Permisos de aplicación recomendados:
 *   - Sites.Selected (biblioteca de SharePoint concreta), o
 *   - Files.ReadWrite.All (si se usa el OneDrive de una cuenta de servicio).
 *
 * Documentación: https://learn.microsoft.com/graph/api/resources/driveitem
 */
const {
  ErrorAlmacenamiento,
  categoriaDeArchivo,
  esCarpetaDeSolicitud,
  tipoMime,
} = require('./comun');

const URL_GRAPH = 'https://graph.microsoft.com/v1.0';
const CAMPOS = 'id,name,size,lastModifiedDateTime,webUrl,file,folder,parentReference';
/** Graph acepta PUT directo hasta 4 MB; sobre eso se usa una sesión de carga. */
const LIMITE_CARGA_SIMPLE = 4 * 1024 * 1024;
/** Los fragmentos de una sesión de carga deben ser múltiplos de 320 KiB. */
const TAMANO_FRAGMENTO = 320 * 1024 * 12;

const segmento = (texto) => encodeURIComponent(texto);

class AlmacenamientoGraph {
  constructor({
    tenantId,
    clientId,
    clientSecret,
    driveId,
    usuario,
    carpetaRaiz = 'Evaluaciones Psicolaborales',
    fetch = globalThis.fetch,
  }) {
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error(
        'Faltan GRAPH_TENANT_ID, GRAPH_CLIENT_ID o GRAPH_CLIENT_SECRET para usar Microsoft Graph.',
      );
    }
    if (!driveId && !usuario) {
      throw new Error('Defina GRAPH_DRIVE_ID (SharePoint) o GRAPH_USUARIO (OneDrive) para Graph.');
    }

    this.proveedor = 'graph';
    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.unidad = driveId ? `/drives/${segmento(driveId)}` : `/users/${segmento(usuario)}/drive`;
    this.carpetaRaiz = carpetaRaiz.split('/').map((parte) => parte.trim()).filter(Boolean);
    this.fetch = fetch;
    this.token = null;
    this.idRaiz = null;
  }

  /* ------------------------------ API pública ------------------------------ */

  async obtenerCarpeta(clave, nombre, { crear = false } = {}) {
    const idRaiz = await this.#asegurarRaiz();
    const hijos = await this.#listarHijos(idRaiz);
    const existente = hijos.find((item) => item.folder && esCarpetaDeSolicitud(item.name, clave));

    if (existente) return this.#carpeta(existente);
    if (!crear) return null;

    const creada = await this.#crearCarpeta(idRaiz, nombre);
    return this.#carpeta(creada);
  }

  async listarArchivos(carpeta) {
    const hijos = await this.#listarHijos(carpeta.id);
    return hijos
      .filter((item) => item.file)
      .map((item) => this.#archivo(item))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  async subirArchivo(carpeta, nombre, contenido) {
    const destino = `${this.unidad}/items/${segmento(carpeta.id)}:/${segmento(nombre)}:`;

    if (contenido.length <= LIMITE_CARGA_SIMPLE) {
      const item = await this.#llamar('PUT', `${destino}/content`, {
        cuerpo: contenido,
        cabeceras: { 'Content-Type': tipoMime(nombre) },
      });
      return this.#archivo(item);
    }

    const sesion = await this.#llamar('POST', `${destino}/createUploadSession`, {
      json: { item: { '@microsoft.graph.conflictBehavior': 'replace' } },
    });
    return this.#archivo(await this.#subirPorFragmentos(sesion.uploadUrl, contenido));
  }

  async obtenerArchivo(carpeta, archivoId) {
    const item = await this.#llamar(
      'GET',
      `${this.unidad}/items/${segmento(archivoId)}?$select=${CAMPOS}`,
    );
    // Impide leer o borrar archivos de otra carpeta adivinando su id.
    if (!item.file || item.parentReference?.id !== carpeta.id) {
      throw new ErrorAlmacenamiento('Archivo no encontrado.', 404);
    }
    return this.#archivo(item);
  }

  async descargarArchivo(carpeta, archivoId) {
    const archivo = await this.obtenerArchivo(carpeta, archivoId);
    // Graph responde 302 hacia una URL de descarga pre-autenticada; fetch la sigue sola.
    const respuesta = await this.#llamar(
      'GET',
      `${this.unidad}/items/${segmento(archivoId)}/content`,
      { crudo: true },
    );
    const contenido = Buffer.from(await respuesta.arrayBuffer());
    return { nombre: archivo.nombre, tipo: tipoMime(archivo.nombre), contenido };
  }

  async eliminarArchivo(carpeta, archivoId) {
    await this.obtenerArchivo(carpeta, archivoId);
    await this.#llamar('DELETE', `${this.unidad}/items/${segmento(archivoId)}`, { crudo: true });
  }

  /* ------------------------------- Internos -------------------------------- */

  async #obtenerToken() {
    if (this.token && this.token.expira > Date.now() + 60_000) return this.token.valor;

    const respuesta = await this.fetch(
      `https://login.microsoftonline.com/${segmento(this.tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }).toString(),
      },
    );
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !datos.access_token) {
      throw new ErrorAlmacenamiento(
        `No se pudo autenticar con Microsoft Entra ID: ${datos.error_description || respuesta.status}`,
        502,
      );
    }

    this.token = { valor: datos.access_token, expira: Date.now() + datos.expires_in * 1000 };
    return this.token.valor;
  }

  async #llamar(metodo, ruta, { json, cuerpo, cabeceras = {}, crudo = false } = {}) {
    const url = ruta.startsWith('https://') ? ruta : `${URL_GRAPH}${ruta}`;
    const respuesta = await this.fetch(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${await this.#obtenerToken()}`,
        ...(json ? { 'Content-Type': 'application/json' } : {}),
        ...cabeceras,
      },
      body: json ? JSON.stringify(json) : cuerpo,
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.json().catch(() => ({}));
      if (respuesta.status === 404) {
        throw new ErrorAlmacenamiento('Elemento no encontrado en OneDrive.', 404);
      }
      throw new ErrorAlmacenamiento(
        `Error de Microsoft Graph (${respuesta.status}): ${detalle.error?.message ?? 'sin detalle'}`,
        502,
      );
    }

    if (crudo) return respuesta;
    return respuesta.status === 204 ? null : respuesta.json();
  }

  /** Crea (si falta) cada nivel de la carpeta raíz configurada y guarda su id. */
  async #asegurarRaiz() {
    if (this.idRaiz) return this.idRaiz;

    let idPadre = 'root';
    for (const parte of this.carpetaRaiz) {
      try {
        const item = await this.#llamar(
          'GET',
          `${this.unidad}/items/${idPadre}:/${segmento(parte)}?$select=id`,
        );
        idPadre = item.id;
      } catch (error) {
        if (error.status !== 404) throw error;
        idPadre = (await this.#crearCarpeta(idPadre, parte)).id;
      }
    }

    this.idRaiz = idPadre;
    return idPadre;
  }

  async #crearCarpeta(idPadre, nombre) {
    return this.#llamar('POST', `${this.unidad}/items/${idPadre}/children`, {
      json: { name: nombre, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' },
    });
  }

  async #listarHijos(idCarpeta) {
    const items = [];
    let siguiente = `${this.unidad}/items/${segmento(idCarpeta)}/children?$top=200&$select=${CAMPOS}`;
    while (siguiente) {
      const pagina = await this.#llamar('GET', siguiente);
      items.push(...pagina.value);
      siguiente = pagina['@odata.nextLink'] ?? null;
    }
    return items;
  }

  /** La URL de la sesión ya va firmada: no se envía el token de Graph. */
  async #subirPorFragmentos(urlCarga, contenido) {
    const total = contenido.length;
    for (let inicio = 0; inicio < total; inicio += TAMANO_FRAGMENTO) {
      const fin = Math.min(inicio + TAMANO_FRAGMENTO, total);
      const respuesta = await this.fetch(urlCarga, {
        method: 'PUT',
        headers: {
          'Content-Length': String(fin - inicio),
          'Content-Range': `bytes ${inicio}-${fin - 1}/${total}`,
        },
        body: contenido.subarray(inicio, fin),
      });
      if (!respuesta.ok) {
        throw new ErrorAlmacenamiento(`Falló la carga a OneDrive (${respuesta.status}).`, 502);
      }
      if (fin === total) return respuesta.json();
    }
    throw new ErrorAlmacenamiento('La carga a OneDrive no se completó.', 502);
  }

  #carpeta(item) {
    return { id: item.id, nombre: item.name, webUrl: item.webUrl ?? null };
  }

  #archivo(item) {
    return {
      id: item.id,
      nombre: item.name,
      categoria: categoriaDeArchivo(item.name),
      tamano: item.size ?? 0,
      modificado: item.lastModifiedDateTime ?? null,
      webUrl: item.webUrl ?? null,
    };
  }
}

module.exports = { AlmacenamientoGraph };
