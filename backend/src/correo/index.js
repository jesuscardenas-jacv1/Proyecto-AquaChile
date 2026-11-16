/**
 * Envío de correos con Resend (complementa los avisos de la campana y el tiempo real).
 *
 * - Sin RESEND_API_KEY no se envía nada y la app funciona igual.
 * - Con CORREO_DESTINO_PRUEBA todos los correos van a esa dirección (los usuarios de demo
 *   son ficticios); el asunto indica a quién iba dirigido.
 * - La clave nunca sale del backend: Resend se llama solo desde Node.
 */
const REMITENTE_POR_DEFECTO = 'AquaChile Psicolaboral <onboarding@resend.dev>';

let clienteInyectado = null;
let clienteResend = null;
const pendientes = new Set();

/** Reemplaza el cliente de Resend (pruebas). `null` vuelve al cliente real. */
function establecerClienteCorreo(cliente) {
  clienteInyectado = cliente;
}

function obtenerCliente() {
  if (clienteInyectado) return clienteInyectado;
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return null;
  if (!clienteResend || clienteResend.clave !== clave) {
    const { Resend } = require('resend');
    clienteResend = { clave, cliente: new Resend(clave) };
  }
  return clienteResend.cliente;
}

/** Indica si hay un cliente configurado para enviar correos. */
function correoDisponible() {
  return Boolean(obtenerCliente());
}

/**
 * Envía un correo. Devuelve `{ omitido: true }` si no hay cliente configurado.
 * Lanza un error si Resend lo rechaza (quien llama decide si lo ignora).
 */
async function enviarCorreo({ para, asunto, html, texto }) {
  const cliente = obtenerCliente();
  if (!cliente) return { omitido: true };
  if (!para) throw new Error('El destinatario no tiene correo.');

  const destinoPrueba = (process.env.CORREO_DESTINO_PRUEBA || '').trim();
  const { data, error } = await cliente.emails.send({
    from: (process.env.CORREO_REMITENTE || '').trim() || REMITENTE_POR_DEFECTO,
    to: destinoPrueba || para,
    subject: destinoPrueba ? `[Para: ${para}] ${asunto}` : asunto,
    html,
    text: texto,
  });
  if (error) throw new Error(error.message || 'Resend rechazó el correo.');
  return { id: data?.id ?? null };
}

/**
 * Envía en segundo plano: no bloquea la respuesta ni la hace fallar.
 * El error solo se registra en la consola.
 */
function enviarEnSegundoPlano(correo) {
  if (!correoDisponible()) return;
  const envio = enviarCorreo(correo)
    .catch((error) => console.error(`No se pudo enviar el correo a ${correo.para}:`, error.message))
    .finally(() => pendientes.delete(envio));
  pendientes.add(envio);
}

/** Espera a que terminen los envíos en curso (pruebas y cierre ordenado). */
async function esperarCorreosPendientes() {
  while (pendientes.size) await Promise.allSettled([...pendientes]);
}

module.exports = {
  REMITENTE_POR_DEFECTO,
  correoDisponible,
  enviarCorreo,
  enviarEnSegundoPlano,
  esperarCorreosPendientes,
  establecerClienteCorreo,
};
