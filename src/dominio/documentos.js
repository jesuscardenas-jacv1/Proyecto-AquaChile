/** Cómo se puede mostrar cada tipo de archivo dentro del portal, según su extensión. */
const VISORES = {
  pdf: { visor: 'pdf', tipo: 'application/pdf' },
  png: { visor: 'imagen', tipo: 'image/png' },
  jpg: { visor: 'imagen', tipo: 'image/jpeg' },
  jpeg: { visor: 'imagen', tipo: 'image/jpeg' },
  gif: { visor: 'imagen', tipo: 'image/gif' },
  webp: { visor: 'imagen', tipo: 'image/webp' },
  mp4: { visor: 'video', tipo: 'video/mp4' },
  mov: { visor: 'video', tipo: 'video/quicktime' },
  mp3: { visor: 'audio', tipo: 'audio/mpeg' },
  wav: { visor: 'audio', tipo: 'audio/wav' },
  m4a: { visor: 'audio', tipo: 'audio/mp4' },
  docx: {
    visor: 'word',
    tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
};

/** { visor, tipo } del archivo, o null si el navegador no puede mostrarlo (se ofrece descargar). */
export function visorDeArchivo(nombre = '') {
  const extension = nombre.includes('.') ? nombre.split('.').pop().toLowerCase() : '';
  return VISORES[extension] ?? null;
}

/** Nombre de la carpeta de una solicitud, igual al que crea el backend: "S0007 - Ana Pérez". */
export function nombreCarpetaSolicitud(id, candidato = '') {
  const clave = `S${String(id).padStart(4, '0')}`;
  return candidato ? `${clave} - ${candidato}` : clave;
}
