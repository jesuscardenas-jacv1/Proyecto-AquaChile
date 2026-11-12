/**
 * Configuración editable de las ayudas de IA (tabla config_ia) con su historial (config_ia_historial).
 * Solo se guarda lo que el administrador cambió; lo demás sale del catálogo (ver catalogo.js).
 */
const db = require('../bd/conexion');
const { ESFUERZOS, MODELOS, REGLAS_COMUNES, TAREAS } = require('./catalogo');

const LARGO_MINIMO = 20;
const LARGO_MAXIMO = 4000;

class ErrorConfiguracion extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const fila = (tarea) => db.prepare('SELECT * FROM config_ia WHERE tarea = ?').get(tarea);

function exigirTarea(tarea) {
  if (!Object.hasOwn(TAREAS, tarea)) throw new ErrorConfiguracion('Ayuda de IA desconocida.', 404);
  return TAREAS[tarea];
}

/**
 * Configuración vigente de una tarea: { indicaciones, modelo, esfuerzo, personalizada }.
 * `modelo` vacío significa "el del servidor" (IA_MODELO o Opus 5.5).
 */
function configuracionDe(tarea) {
  const base = exigirTarea(tarea);
  const guardada = fila(tarea);
  return {
    indicaciones: guardada?.indicaciones || base.indicaciones,
    modelo: guardada?.modelo || '',
    esfuerzo: guardada?.esfuerzo || base.esfuerzo,
    personalizada: Boolean(guardada),
    actualizadoPor: guardada?.actualizado_por ?? '',
    actualizadoEn: guardada?.actualizado_en ?? '',
  };
}

function registrarHistorial(tarea, accion, datos, usuario) {
  db.prepare(
    `INSERT INTO config_ia_historial (tarea, accion, indicaciones, modelo, esfuerzo, usuario)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(tarea, accion, datos.indicaciones, datos.modelo, datos.esfuerzo, usuario);
}

/** Valida y guarda los cambios del administrador. Devuelve la configuración vigente. */
function guardarConfiguracion(tarea, cuerpo = {}, usuario = '') {
  const base = exigirTarea(tarea);
  const indicaciones = typeof cuerpo.indicaciones === 'string' ? cuerpo.indicaciones.trim() : '';
  const modelo = typeof cuerpo.modelo === 'string' ? cuerpo.modelo : '';
  const esfuerzo = typeof cuerpo.esfuerzo === 'string' ? cuerpo.esfuerzo : base.esfuerzo;

  if (indicaciones.length < LARGO_MINIMO) {
    throw new ErrorConfiguracion(`Las indicaciones deben tener al menos ${LARGO_MINIMO} caracteres.`);
  }
  if (indicaciones.length > LARGO_MAXIMO) {
    throw new ErrorConfiguracion(`Las indicaciones no pueden superar ${LARGO_MAXIMO} caracteres.`);
  }
  if (modelo && !MODELOS.some((opcion) => opcion.id === modelo)) throw new ErrorConfiguracion('Modelo no permitido.');
  if (!ESFUERZOS.some((opcion) => opcion.id === esfuerzo)) throw new ErrorConfiguracion('Nivel de esfuerzo no permitido.');

  const datos = { indicaciones, modelo, esfuerzo };
  db.prepare(
    `INSERT INTO config_ia (tarea, indicaciones, modelo, esfuerzo, actualizado_por, actualizado_en)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (tarea) DO UPDATE SET indicaciones = excluded.indicaciones, modelo = excluded.modelo,
       esfuerzo = excluded.esfuerzo, actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en`,
  ).run(tarea, indicaciones, modelo, esfuerzo, usuario);
  registrarHistorial(tarea, 'editar', datos, usuario);
  return configuracionDe(tarea);
}

/** Vuelve a los valores originales del catálogo. */
function restablecerConfiguracion(tarea, usuario = '') {
  const base = exigirTarea(tarea);
  db.prepare('DELETE FROM config_ia WHERE tarea = ?').run(tarea);
  registrarHistorial(tarea, 'restablecer', { indicaciones: base.indicaciones, modelo: '', esfuerzo: base.esfuerzo }, usuario);
  return configuracionDe(tarea);
}

const historialDe = (tarea, limite = 10) =>
  db
    .prepare('SELECT * FROM config_ia_historial WHERE tarea = ? ORDER BY id DESC LIMIT ?')
    .all(tarea, limite)
    .map((h) => ({
      id: h.id,
      accion: h.accion,
      indicaciones: h.indicaciones,
      modelo: h.modelo,
      esfuerzo: h.esfuerzo,
      usuario: h.usuario,
      fecha: h.creado_en,
    }));

/** Campos del esquema de salida, en texto, para mostrarlos al administrador. */
function camposDelEsquema(esquema) {
  return Object.entries(esquema.properties).map(([campo, definicion]) => {
    if (definicion.type === 'array') {
      const item = definicion.items;
      return item.type === 'object' ? `${campo}: lista de { ${Object.keys(item.properties).join(', ')} }` : `${campo}: lista de textos`;
    }
    if (definicion.enum) return `${campo}: una de ${definicion.enum.join(' · ')}`;
    return `${campo}: texto`;
  });
}

/** Todo lo que ve el administrador: partes fijas, partes editables, valores originales e historial. */
function listarConfiguracion({ modeloServidor }) {
  return {
    reglasComunes: REGLAS_COMUNES,
    modeloServidor,
    modelos: MODELOS,
    esfuerzos: ESFUERZOS,
    largoMaximo: LARGO_MAXIMO,
    tareas: Object.entries(TAREAS).map(([id, tarea]) => ({
      id,
      nombre: tarea.nombre,
      usadoPor: tarea.usadoPor,
      entrada: tarea.entrada,
      sistema: tarea.sistema,
      limites: tarea.limites,
      campos: camposDelEsquema(tarea.esquema),
      original: { indicaciones: tarea.indicaciones, esfuerzo: tarea.esfuerzo },
      vigente: configuracionDe(id),
      historial: historialDe(id),
    })),
  };
}

module.exports = {
  ErrorConfiguracion,
  configuracionDe,
  guardarConfiguracion,
  listarConfiguracion,
  restablecerConfiguracion,
};
