/**
 * Consultas de la base de conocimiento: búsqueda de candidatos, conteos e historial. Todo es SQL con
 * parámetros: la IA nunca escribe consultas, solo propone valores para estos filtros.
 * Cada consulta parte por lo que el usuario puede ver: la psicóloga, solo los candidatos de sus
 * solicitudes (asignadas a ella o sin asignar); los demás roles, todos.
 */
const db = require('../bd/conexion');
const { TIPOS_EVENTO } = require('../bd/eventos');
const { normalizar } = require('../agente/identidad');
const { geminiConfigurado, geminiDisponible } = require('../ia/gemini');
const { gastoGemini, topeGemini } = require('../ia/presupuesto');
const { enCatalogo, normalizarHabilidad } = require('./habilidades');
const { normalizarCiudad } = require('./ciudades');

const ESTADOS = ['Recibida', 'En evaluación', 'Descartada', 'Pendiente', 'En proceso', 'Finalizada'];
const AGRUPACIONES = ['ciudad', 'habilidad', 'cargo', 'estado'];
const VACIAS = new Set(['con', 'que', 'los', 'las', 'del', 'para', 'por', 'una', 'uno', 'sus', 'han', 'experiencia', 'candidatos', 'personas']);

const solicitudesVisibles = (usuario) =>
  usuario.rol === 'evaluador'
    ? { donde: "(profesional_responsable = ? OR profesional_responsable = '')", parametros: [usuario.nombre ?? ''] }
    : { donde: '1 = 1', parametros: [] };

/** Candidatos visibles con su ciudad, cargo y estado más recientes (una fila por candidato). */
function baseDe(usuario) {
  const { donde, parametros } = solicitudesVisibles(usuario);
  return {
    sql: `WITH post AS (
        SELECT p.*, o.cargo AS cargo_oferta, ROW_NUMBER() OVER (PARTITION BY p.candidato_id ORDER BY p.id DESC) AS n
        FROM postulaciones p JOIN ofertas o ON o.id = p.oferta_id
      ), sol AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY candidato_id ORDER BY id DESC) AS n FROM solicitudes WHERE ${donde}
      ), base AS (
        SELECT c.id, c.nombre, lower(c.correo) AS correo, post.id AS postulacion_id, sol.id AS solicitud_id,
          COALESCE(sol.cargo, post.cargo_oferta, c.cargo) AS cargo,
          COALESCE(NULLIF(post.ciudad_normalizada, ''), f.ciudad, '') AS ciudad,
          CASE WHEN sol.motivo_cierre <> '' THEN 'Cerrada sin evaluación'
               ELSE COALESCE(sol.estado, post.estado, 'Registrado') END AS estado,
          COALESCE(post.estado, '') AS estado_postulacion,
          MAX(COALESCE(post.fecha_postulacion, ''), COALESCE(sol.fecha_solicitud, '')) AS fecha,
          f.candidato_id IS NOT NULL AS con_perfil
        FROM candidatos c
        LEFT JOIN post ON post.candidato_id = c.id AND post.n = 1
        LEFT JOIN sol ON sol.candidato_id = c.id AND sol.n = 1
        LEFT JOIN perfiles_candidato f ON f.candidato_id = c.id
        ${usuario.rol === 'evaluador' ? 'WHERE sol.id IS NOT NULL' : ''}
      )`,
    parametros,
  };
}

/** Frase libre → consulta FTS5 segura: cada palabra entre comillas y por su comienzo. '' si no queda nada. */
function consultaLibre(texto) {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter((palabra) => palabra.length > 2 && !VACIAS.has(palabra))
    .slice(0, 6)
    .map((palabra) => `"${palabra}"*`)
    .join(' ');
}

const sinComodines = (texto) => String(texto).replace(/[%_]/g, '');

/** Filtros limpios y con los nombres del catálogo. */
function normalizarFiltros({ ciudad = '', habilidades = [], cargo = '', estado = '', desde = '', textoLibre = '' } = {}) {
  return {
    ciudad: ciudad ? normalizarCiudad(ciudad).ciudad : '',
    habilidades: [...new Set(habilidades.map((h) => normalizarHabilidad(h).nombre).filter(Boolean))].slice(0, 5),
    cargo: sinComodines(cargo).trim(),
    estado: ESTADOS.find((item) => normalizar(item) === normalizar(estado)) ?? '',
    desde,
    textoLibre: consultaLibre(textoLibre),
  };
}

const hayFiltros = (f) => Boolean(f.ciudad || f.habilidades.length || f.cargo || f.estado || f.desde || f.textoLibre);

function condiciones(filtros) {
  const donde = [];
  const parametros = [];
  const sumar = (sql, ...valores) => {
    donde.push(sql);
    parametros.push(...valores);
  };
  if (filtros.ciudad) sumar('ciudad = ?', filtros.ciudad);
  // "Excel" también encuentra "Excel avanzado".
  filtros.habilidades.forEach((h) =>
    sumar(
      'EXISTS (SELECT 1 FROM habilidades_candidato h WHERE h.candidato_id = base.id AND (h.habilidad = ? COLLATE NOCASE OR h.habilidad LIKE ?))',
      h,
      `${sinComodines(h)} %`,
    ),
  );
  if (filtros.cargo) sumar('cargo LIKE ?', `%${filtros.cargo}%`);
  if (filtros.estado) sumar('(estado = ? OR estado_postulacion = ?)', filtros.estado, filtros.estado);
  // Los descartados no aparecen salvo que se pidan (o que sigan en otro proceso).
  if (filtros.estado !== 'Descartada') sumar("NOT (estado = 'Descartada')");
  if (filtros.desde) sumar('fecha >= ?', filtros.desde);
  if (filtros.textoLibre) sumar('id IN (SELECT rowid FROM busqueda_cv WHERE busqueda_cv MATCH ?)', filtros.textoLibre);
  return { donde: donde.length ? `WHERE ${donde.join(' AND ')}` : '', parametros };
}

/** Candidatos que cumplen todos los filtros, sin repetir a quien está registrado dos veces con el mismo correo. */
function filtrar(usuario, filtros) {
  const base = baseDe(usuario);
  const { donde, parametros } = condiciones(filtros);
  const vistos = new Set();
  return db
    .prepare(`${base.sql} SELECT * FROM base ${donde} ORDER BY con_perfil DESC, fecha DESC, id DESC`)
    .all(...base.parametros, ...parametros)
    .filter((fila) => {
      const clave = fila.correo || fila.id;
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
}

/** Evidencia del CV para cada habilidad pedida. */
function coincidencias(candidatoId, habilidades) {
  return habilidades.flatMap((h) =>
    db
      .prepare('SELECT habilidad, evidencia FROM habilidades_candidato WHERE candidato_id = ? AND (habilidad = ? COLLATE NOCASE OR habilidad LIKE ?) ORDER BY habilidad LIMIT 1')
      .all(candidatoId, h, `${sinComodines(h)} %`)
      .map((fila) => ({ ...fila })),
  );
}

/**
 * Busca candidatos. Devuelve { filtros, total, candidatos, parciales }: `parciales` dice cuántos
 * cumplen cada filtro por separado cuando ninguno cumple todos.
 */
function buscarCandidatos(usuario, filtrosCrudos, { limite = 8 } = {}) {
  const filtros = normalizarFiltros(filtrosCrudos);
  const filas = filtrar(usuario, filtros);
  const parciales = [];
  if (!filas.length) {
    const vacio = { ciudad: '', habilidades: [], cargo: '', estado: filtros.estado, desde: filtros.desde, textoLibre: '' };
    if (filtros.ciudad) parciales.push({ etiqueta: `de ${filtros.ciudad}`, total: filtrar(usuario, { ...vacio, ciudad: filtros.ciudad }).length });
    filtros.habilidades.forEach((h) => parciales.push({ etiqueta: `con ${h}`, total: filtrar(usuario, { ...vacio, habilidades: [h] }).length }));
    if (filtros.cargo) parciales.push({ etiqueta: `para ${filtros.cargo}`, total: filtrar(usuario, { ...vacio, cargo: filtros.cargo }).length });
  }
  return {
    filtros,
    total: filas.length,
    parciales,
    candidatos: filas.slice(0, limite).map((fila) => ({
      candidatoId: fila.id,
      solicitudId: fila.solicitud_id ?? null,
      postulacionId: fila.postulacion_id ?? null,
      nombre: fila.nombre,
      ciudad: fila.ciudad,
      cargo: fila.cargo,
      estado: fila.estado,
      conPerfil: Boolean(fila.con_perfil),
      coincidencias: coincidencias(fila.id, filtros.habilidades),
    })),
  };
}

/** Conteos por ciudad, habilidad, cargo o estado (solo números, sin nombres). */
function contar(usuario, filtrosCrudos, { agruparPor = '' } = {}) {
  const filtros = normalizarFiltros(filtrosCrudos);
  const filas = filtrar(usuario, filtros);
  const grupos = new Map();
  const sumar = (clave) => clave && grupos.set(clave, (grupos.get(clave) ?? 0) + 1);
  if (agruparPor === 'habilidad') {
    const ids = new Set(filas.map((fila) => fila.id));
    db.prepare('SELECT candidato_id, habilidad FROM habilidades_candidato')
      .all()
      .filter((h) => ids.has(h.candidato_id))
      .forEach((h) => sumar(h.habilidad));
  } else if (AGRUPACIONES.includes(agruparPor)) {
    filas.forEach((fila) => sumar(fila[agruparPor] || 'Sin registrar'));
  }
  return {
    filtros,
    total: filas.length,
    grupos: [...grupos].map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es')).slice(0, 10),
  };
}

/** Candidatos visibles con y sin perfil, para avisar cuánto cubre la búsqueda por habilidades. */
function cobertura(usuario) {
  const filas = filtrar(usuario, normalizarFiltros());
  const conPortal = filas.filter((fila) => fila.postulacion_id);
  return { conPerfil: filas.filter((fila) => fila.con_perfil).length, sinPerfil: conPortal.filter((fila) => !fila.con_perfil).length };
}

/** Historial reciente que el usuario puede ver: la psicóloga, solo lo de sus solicitudes. */
function listarEventos(usuario, { desde = '', tipo = '', limite = 10 } = {}) {
  const donde = [];
  const parametros = [];
  if (usuario.rol === 'evaluador') {
    const visibles = solicitudesVisibles(usuario);
    donde.push(`entidad = 'solicitud' AND entidad_id IN (SELECT id FROM solicitudes WHERE ${visibles.donde})`);
    parametros.push(...visibles.parametros);
  }
  if (desde) {
    donde.push("date(creado_en, '-3 hours') >= ?");
    parametros.push(desde);
  }
  if (TIPOS_EVENTO[tipo]) {
    donde.push('tipo = ?');
    parametros.push(tipo);
  }
  return db
    .prepare(`SELECT * FROM eventos ${donde.length ? `WHERE ${donde.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`)
    .all(...parametros, limite)
    .map((e) => ({ id: e.id, tipo: e.tipo, titulo: TIPOS_EVENTO[e.tipo] ?? e.tipo, detalle: e.detalle, usuario: e.usuario, fecha: e.creado_en }));
}

/** Estado de la base de conocimiento para el administrador. */
function resumenConocimiento() {
  const uno = (sql) => db.prepare(sql).get().total;
  const cola = Object.fromEntries(db.prepare('SELECT estado, COUNT(*) AS total FROM cola_perfiles GROUP BY estado').all().map((f) => [f.estado, f.total]));
  return {
    perfiles: uno('SELECT COUNT(*) AS total FROM perfiles_candidato'),
    sinPerfil: uno(
      "SELECT COUNT(DISTINCT p.candidato_id) AS total FROM postulaciones p WHERE p.cv_nombre <> '' AND NOT EXISTS (SELECT 1 FROM perfiles_candidato f WHERE f.candidato_id = p.candidato_id)",
    ),
    habilidades: uno('SELECT COUNT(DISTINCT habilidad) AS total FROM habilidades_candidato'),
    eventos: uno('SELECT COUNT(*) AS total FROM eventos'),
    cola: { pendientes: (cola.pendiente ?? 0) + (cola.procesando ?? 0), errores: cola.error ?? 0, omitidos: cola.omitido ?? 0 },
    errores: db
      .prepare("SELECT q.ultimo_error AS motivo, COUNT(*) AS total FROM cola_perfiles q WHERE q.estado IN ('error', 'omitido') GROUP BY 1 ORDER BY total DESC LIMIT 5")
      .all()
      .map((f) => ({ ...f })),
    fueraDeCatalogo: db
      .prepare('SELECT habilidad, categoria, COUNT(*) AS total FROM habilidades_candidato GROUP BY habilidad ORDER BY total DESC, habilidad')
      .all()
      .filter((f) => !enCatalogo(f.habilidad))
      .slice(0, 20)
      .map((f) => ({ ...f })),
    gemini: {
      configurado: geminiConfigurado(),
      disponible: geminiDisponible(),
      gastoUsd: Number(gastoGemini().toFixed(4)),
      topeUsd: topeGemini(),
    },
  };
}

module.exports = { AGRUPACIONES, ESTADOS, buscarCandidatos, cobertura, contar, hayFiltros, listarEventos, normalizarFiltros, resumenConocimiento };
