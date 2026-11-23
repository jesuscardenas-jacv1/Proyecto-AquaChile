/**
 * Tope de gasto de Gemini. Suma el costo estimado de todas las llamadas registradas en uso_ia: el
 * crédito de Google es un monto único, no mensual, así que el contador no se reinicia cada mes.
 * - GEMINI_TOPE_USD (60): al llegar, Gemini se apaga y Marea vuelve al intérprete local.
 * - GEMINI_TOPE_DESDE (YYYY-MM-DD, opcional): cuenta desde esa fecha (p. ej. si se recarga el crédito).
 */
const db = require('../bd/conexion');

const TOPE_POR_DEFECTO = 60;

function topeGemini() {
  const valor = process.env.GEMINI_TOPE_USD;
  if (valor === undefined || valor === '') return TOPE_POR_DEFECTO;
  const tope = Number(valor);
  return Number.isFinite(tope) && tope >= 0 ? tope : TOPE_POR_DEFECTO;
}

function gastoGemini() {
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(process.env.GEMINI_TOPE_DESDE ?? '') ? process.env.GEMINI_TOPE_DESDE : '0000-01-01';
  return db.prepare("SELECT COALESCE(SUM(costo_usd), 0) AS total FROM uso_ia WHERE proveedor = 'gemini' AND date(creado_en) >= ?").get(desde).total;
}

const hayPresupuesto = () => gastoGemini() < topeGemini();

module.exports = { gastoGemini, hayPresupuesto, topeGemini };
