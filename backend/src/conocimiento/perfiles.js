/**
 * Perfil profesional de un candidato: se guarda normalizado en perfiles_candidato,
 * habilidades_candidato y el índice busqueda_cv.
 *
 * Segunda barrera de privacidad (la primera es el esquema de la IA, que no tiene campos sensibles):
 * antes de guardar se quitan correos, teléfonos y RUT, y se descartan las líneas con datos personales
 * sensibles (edad, estado civil, nacionalidad, salud…). El CV completo nunca se guarda aquí.
 */
const db = require('../bd/conexion');
const { normalizarCiudad } = require('./ciudades');
const { normalizarHabilidad } = require('./habilidades');

const SENSIBLES =
  /\b(estado civil|solter[oa]|casad[oa]|divorciad[oa]|viud[oa]|nacionalidad|fecha de nacimiento|nacid[oa] (el|en)|religi[oó]n|cat[oó]lic[oa]|evang[eé]lic[oa]|embarazad[oa]|discapacidad|enfermedad|licencia m[eé]dica|orientaci[oó]n sexual|g[eé]nero|\d{2} a[nñ]os de edad|edad ?:|sexo ?:|hij[oa]s)\b/i;

/** Texto corto sin correos, teléfonos ni RUT; '' si la frase trae un dato sensible. */
function limpiar(valor, maximo = 300) {
  const texto = String(valor ?? '')
    .replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, '')
    .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g, '')
    .replace(/\+?\d(?:[\s-]?\d){8,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return SENSIBLES.test(texto) ? '' : texto.slice(0, maximo);
}

/** Para textos de varias frases: se quita solo la frase con el dato sensible. */
const limpiarFrases = (valor, maximo) =>
  String(valor ?? '')
    .split(/(?<=[.;])\s+/)
    .map((frase) => limpiar(frase, maximo))
    .filter(Boolean)
    .join(' ')
    .slice(0, maximo);

const lista = (valor) => (Array.isArray(valor) ? valor : []);

/** Deja el perfil (de la IA o de la demostración) con forma segura, limpio y normalizado. */
function normalizarPerfil(perfil = {}) {
  const { ciudad, region } = normalizarCiudad(limpiar(perfil.ciudad, 60));
  const habilidades = new Map();
  const sumar = ({ habilidad, categoria, evidencia }) => {
    const { nombre, categoria: tipo } = normalizarHabilidad(limpiar(habilidad, 60), categoria);
    if (nombre && !habilidades.has(nombre)) habilidades.set(nombre, { habilidad: nombre, categoria: tipo, evidencia: limpiar(evidencia, 160) });
  };
  lista(perfil.habilidades).forEach((item) => item && sumar(item));
  const idiomas = lista(perfil.idiomas)
    .map((item) => ({ idioma: limpiar(item?.idioma, 40), nivel: limpiar(item?.nivel, 40) }))
    .filter((item) => item.idioma);
  idiomas.forEach(({ idioma, nivel }) => sumar({ habilidad: idioma, categoria: 'idioma', evidencia: nivel ? `Nivel ${nivel}` : '' }));
  const anios = Number(perfil.aniosExperiencia);

  return {
    ciudad,
    region,
    resumen: limpiarFrases(perfil.resumen, 600),
    formacion: lista(perfil.formacion)
      .slice(0, 10)
      .map((item) => ({
        titulo: limpiar(item?.titulo, 120),
        institucion: limpiar(item?.institucion, 120),
        nivel: limpiar(item?.nivel, 60),
        estado: limpiar(item?.estado, 40),
      }))
      .filter((item) => item.titulo),
    experiencia: lista(perfil.experiencia)
      .slice(0, 15)
      .map((item) => ({
        cargo: limpiar(item?.cargo, 120),
        empresa: limpiar(item?.empresa, 120),
        rubro: limpiar(item?.rubro, 80),
        desde: limpiar(item?.desde, 20),
        hasta: limpiar(item?.hasta, 20),
        funciones: limpiarFrases(item?.funciones, 400),
      }))
      .filter((item) => item.cargo),
    aniosExperiencia: Number.isFinite(anios) && anios >= 0 && anios <= 60 ? Math.round(anios * 10) / 10 : null,
    idiomas,
    habilidades: [...habilidades.values()].slice(0, 40),
  };
}

/** Texto del índice de búsqueda: solo el extracto profesional. */
const textoDeBusqueda = (perfil) =>
  [
    perfil.resumen,
    ...perfil.formacion.map((f) => `${f.titulo} ${f.institucion}`),
    ...perfil.experiencia.map((e) => `${e.cargo} ${e.empresa} ${e.rubro} ${e.funciones}`),
    ...perfil.habilidades.map((h) => `${h.habilidad} ${h.evidencia}`),
  ].join('\n');

/** Escribe el perfil y reemplaza el anterior. Sin transacción propia: la abre quien llama. */
function escribirPerfil(candidatoId, datos, { postulacionId = null, modelo = 'demostración' } = {}) {
  const perfil = normalizarPerfil(datos);
  db.prepare(
    `INSERT INTO perfiles_candidato (candidato_id, postulacion_id, ciudad, region, resumen, formacion, experiencia, anios_experiencia, idiomas, modelo, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(candidato_id) DO UPDATE SET postulacion_id = excluded.postulacion_id, ciudad = excluded.ciudad,
       region = excluded.region, resumen = excluded.resumen, formacion = excluded.formacion, experiencia = excluded.experiencia,
       anios_experiencia = excluded.anios_experiencia, idiomas = excluded.idiomas, modelo = excluded.modelo, creado_en = excluded.creado_en`,
  ).run(
    candidatoId, postulacionId, perfil.ciudad, perfil.region, perfil.resumen, JSON.stringify(perfil.formacion),
    JSON.stringify(perfil.experiencia), perfil.aniosExperiencia, JSON.stringify(perfil.idiomas), modelo,
  );
  db.prepare('DELETE FROM habilidades_candidato WHERE candidato_id = ?').run(candidatoId);
  const habilidad = db.prepare('INSERT INTO habilidades_candidato (candidato_id, habilidad, categoria, evidencia) VALUES (?, ?, ?, ?)');
  perfil.habilidades.forEach((h) => habilidad.run(candidatoId, h.habilidad, h.categoria, h.evidencia));
  db.prepare('DELETE FROM busqueda_cv WHERE rowid = ?').run(candidatoId);
  db.prepare('INSERT INTO busqueda_cv (rowid, texto) VALUES (?, ?)').run(candidatoId, textoDeBusqueda(perfil));
  return perfil;
}

function guardarPerfil(candidatoId, datos, opciones) {
  db.exec('BEGIN TRANSACTION;');
  try {
    const perfil = escribirPerfil(candidatoId, datos, opciones);
    db.exec('COMMIT;');
    return perfil;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

function obtenerPerfil(candidatoId) {
  const fila = db.prepare('SELECT * FROM perfiles_candidato WHERE candidato_id = ?').get(candidatoId);
  if (!fila) return null;
  return {
    ciudad: fila.ciudad,
    region: fila.region,
    resumen: fila.resumen,
    formacion: JSON.parse(fila.formacion),
    experiencia: JSON.parse(fila.experiencia),
    aniosExperiencia: fila.anios_experiencia,
    idiomas: JSON.parse(fila.idiomas),
    modelo: fila.modelo,
    creadoEn: fila.creado_en,
    habilidades: db
      .prepare('SELECT habilidad, categoria, evidencia FROM habilidades_candidato WHERE candidato_id = ? ORDER BY categoria, habilidad')
      .all(candidatoId)
      .map((h) => ({ ...h })),
  };
}

module.exports = { escribirPerfil, guardarPerfil, limpiar, normalizarPerfil, obtenerPerfil };
