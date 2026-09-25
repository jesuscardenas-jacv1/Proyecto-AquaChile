// Capa de datos: solicitudes de evaluación psicolaboral.
const STORAGE_KEY = "aquachile_solicitudes";

let solicitudes = [];
let siguienteId = 1;

function cargarSolicitudes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const datos = JSON.parse(raw);
      solicitudes = Array.isArray(datos.solicitudes) ? datos.solicitudes : [];
      siguienteId = datos.siguienteId && datos.siguienteId > 0 ? datos.siguienteId : 1;
    }
  } catch (e) {
    solicitudes = [];
    siguienteId = 1;
  }
}

function guardarEnLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ solicitudes, siguienteId }));
}

function guardarSolicitud(obj) {
  const nueva = {
    id: siguienteId++,
    nombre: obj.nombre,
    familia: obj.familia,
    cargo: obj.cargo,
    cv: obj.cv || null,
    estado: "Solicitudes",
    creadaEn: new Date().toISOString()
  };
  solicitudes.push(nueva);
  guardarEnLocalStorage();
  return nueva;
}

cargarSolicitudes();

function leerSolicitudes() {
  cargarSolicitudes();
  return solicitudes.slice();
}

function actualizarEstado(id, nuevoEstado) {
  cargarSolicitudes();
  const solicitud = solicitudes.find(function (s) {
    return s.id === id;
  });
  if (!solicitud) return null;
  solicitud.estado = nuevoEstado;
  guardarEnLocalStorage();
  return solicitud;
}

function persistirSolicitudes() {
  guardarEnLocalStorage();
}

function eliminarSolicitud(id) {
  cargarSolicitudes();
  const indice = solicitudes.findIndex(function (s) {
    return s.id === id;
  });
  if (indice === -1) return false;
  solicitudes.splice(indice, 1);
  guardarEnLocalStorage();
  return true;
}

function marcarCarpetaPreparada(id) {
  cargarSolicitudes();
  const solicitud = solicitudes.find(function (s) {
    return s.id === id;
  });
  if (!solicitud) return null;
  solicitud.carpetaPreparada = true;
  guardarEnLocalStorage();
  return solicitud;
}