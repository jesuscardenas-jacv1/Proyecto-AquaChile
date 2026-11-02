/**
 * Impresión del informe psicolaboral en una sola hoja A4, igual en cualquier navegador.
 * A 96 ppp una hoja A4 mide 210 × 297 mm ≈ 794 × 1123 px.
 */
export const ANCHO_A4_PX = 794;
export const ALTO_A4_PX = 1123;

/**
 * Escala (entre `minima` y 1) para que un contenido de `alto` px quepa en una hoja.
 * Se deja un pequeño margen porque cada navegador redondea distinto.
 */
export function escalaParaUnaHoja(alto, { altoHoja = ALTO_A4_PX, holgura = 0.98, minima = 0.5 } = {}) {
  if (!Number.isFinite(alto) || alto <= 0) return 1;
  const escala = (altoHoja * holgura) / alto;
  return Math.round(Math.min(1, Math.max(minima, escala)) * 1000) / 1000;
}
