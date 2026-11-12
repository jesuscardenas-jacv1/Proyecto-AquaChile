/** Reglas de la configuración de IA que el administrador puede editar. */

export const LARGO_MINIMO_INDICACIONES = 20;

/** Devuelve el mensaje de error de las indicaciones, o null si son válidas. */
export function validarIndicaciones(indicaciones = '', largoMaximo = 4000) {
  const largo = indicaciones.trim().length;
  if (largo < LARGO_MINIMO_INDICACIONES) return `Las indicaciones deben tener al menos ${LARGO_MINIMO_INDICACIONES} caracteres.`;
  if (largo > largoMaximo) return `Las indicaciones no pueden superar ${largoMaximo} caracteres.`;
  return null;
}

/** ¿El formulario cambió respecto de la configuración vigente? */
export const hayCambios = (formulario, vigente) =>
  formulario.indicaciones.trim() !== vigente.indicaciones.trim() ||
  formulario.modelo !== vigente.modelo ||
  formulario.esfuerzo !== vigente.esfuerzo;

/** Nombre legible del modelo ('' = el que use el servidor). */
export function nombreModelo(id, modelos = [], modeloServidor = '') {
  if (!id) return `Del servidor${modeloServidor ? ` (${modeloServidor})` : ''}`;
  return modelos.find((modelo) => modelo.id === id)?.nombre ?? id;
}
