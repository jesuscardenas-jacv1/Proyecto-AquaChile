/**
 * Cliente de la API de documentos del backend (/api/solicitudes/:id/documentos).
 * La página nunca habla directo con la nube: el backend decide si los archivos
 * viven en disco local, en Google Drive o en OneDrive / SharePoint.
 */

import { ErrorApi, URL_API, guardarToken, obtenerToken } from './api';

// Se re-exportan para quien ya los importaba desde aquí.
export { ErrorApi, URL_API, obtenerToken };

/**
 * Obtiene un JWT del backend con las mismas credenciales del login.
 * Si el backend no está levantado no falla: la app sigue funcionando sin documentos.
 */
export async function conectarApi(correo, contrasena) {
  try {
    const respuesta = await fetch(`${URL_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena }),
    });
    const datos = await respuesta.json();
    guardarToken(respuesta.ok ? datos.token : null);
    return respuesta.ok;
  } catch {
    guardarToken(null);
    return false;
  }
}

export function desconectarApi() {
  guardarToken(null);
}

async function llamar(ruta, { metodo = 'GET', cuerpo, cabeceras = {} } = {}) {
  const token = obtenerToken();
  if (!token) {
    throw new ErrorApi('Sin conexión con el servicio de documentos.', { noDisponible: true });
  }

  let respuesta;
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, ...cabeceras },
      body: cuerpo,
    });
  } catch {
    throw new ErrorApi('No se pudo conectar con el servicio de documentos.', { noDisponible: true });
  }

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    if (respuesta.status === 401) guardarToken(null);
    throw new ErrorApi(datos.error ?? `Error ${respuesta.status} del servicio de documentos.`, {
      status: respuesta.status,
      noDisponible: respuesta.status === 401,
    });
  }
  return respuesta;
}

const rutaDocumentos = (solicitudId) => `/solicitudes/${solicitudId}/documentos`;

export async function listarDocumentos(solicitudId) {
  return (await llamar(rutaDocumentos(solicitudId))).json();
}

export async function subirDocumento(solicitudId, { categoria, archivo, nombreCandidato }) {
  const parametros = new URLSearchParams({ categoria, nombre: archivo.name });
  const respuesta = await llamar(`${rutaDocumentos(solicitudId)}?${parametros}`, {
    metodo: 'POST',
    cuerpo: archivo,
    cabeceras: {
      'Content-Type': archivo.type || 'application/octet-stream',
      'X-Candidato': encodeURIComponent(nombreCandidato ?? ''),
    },
  });
  return respuesta.json();
}

/** Descarga el archivo con el token y lo entrega al navegador como descarga. */
export async function descargarDocumento(solicitudId, archivo) {
  const respuesta = await llamar(
    `${rutaDocumentos(solicitudId)}/${encodeURIComponent(archivo.id)}/contenido`,
  );
  const url = URL.createObjectURL(await respuesta.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = archivo.nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function eliminarDocumento(solicitudId, archivoId) {
  await llamar(`${rutaDocumentos(solicitudId)}/${encodeURIComponent(archivoId)}`, {
    metodo: 'DELETE',
  });
}

/**
 * Pide al backend generar el PDF oficial del informe y guardarlo en la carpeta de la
 * solicitud. Solo viajan los datos del dictamen: las observaciones clínicas no se envían,
 * porque el PDF de la carpeta también lo ve el analista.
 */
export async function generarInforme(solicitudId, { candidato, solicitud, evaluacion }) {
  const cuerpo = {
    candidato: {
      nombre: candidato?.nombre ?? '',
      correo: candidato?.correo ?? '',
      telefono: candidato?.telefono ?? '',
      origen: candidato?.origen ?? '',
    },
    solicitud: {
      cargo: solicitud.cargo,
      familiaCargo: solicitud.familiaCargo,
      fechaSolicitud: solicitud.fechaSolicitud,
      reclutador: solicitud.reclutador ?? '',
      profesionalResponsable: solicitud.profesionalResponsable ?? '',
      ubicacion: solicitud.ubicacion ?? '',
      unidad: solicitud.unidad ?? '',
      ceco: solicitud.ceco ?? '',
    },
    evaluacion: {
      fechaEvaluacion: evaluacion.fechaEvaluacion,
      resultado: evaluacion.resultado,
    },
  };
  const respuesta = await llamar(`${rutaDocumentos(solicitudId)}/informe`, {
    metodo: 'POST',
    cuerpo: JSON.stringify(cuerpo),
    cabeceras: { 'Content-Type': 'application/json' },
  });
  return respuesta.json();
}

/**
 * Sube el CV de una postulación desde el portal público (sin sesión).
 * Devuelve false si el backend no está disponible: la postulación queda igual
 * registrada y el analista puede subir el CV después.
 */
export async function subirCvPostulacion(postulacionId, archivo, nombreCandidato) {
  const parametros = new URLSearchParams({ nombre: archivo.name });
  try {
    const respuesta = await fetch(`${URL_API}/postulaciones/${postulacionId}/cv?${parametros}`, {
      method: 'POST',
      headers: {
        'Content-Type': archivo.type || 'application/octet-stream',
        'X-Candidato': encodeURIComponent(nombreCandidato ?? ''),
      },
      body: archivo,
    });
    return respuesta.ok;
  } catch {
    return false;
  }
}

/** Copia el CV de la postulación a la carpeta de la solicitud recién creada. */
export async function traerCvDePostulacion(solicitudId, postulacionId, nombreCandidato) {
  const respuesta = await llamar(`${rutaDocumentos(solicitudId)}/desde-postulacion`, {
    metodo: 'POST',
    cuerpo: JSON.stringify({ postulacionId, nombreCandidato }),
    cabeceras: { 'Content-Type': 'application/json' },
  });
  return respuesta.json();
}

export const apiDocumentos = {
  conectado: () => Boolean(obtenerToken()),
  listar: listarDocumentos,
  subir: subirDocumento,
  descargar: descargarDocumento,
  eliminar: eliminarDocumento,
  generarInforme,
  traerCvDePostulacion,
};
