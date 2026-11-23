/**
 * Lee con Gemini los CV del portal que aún no tienen perfil en la base de conocimiento, de a uno y
 * respetando el tope de gasto (GEMINI_TOPE_USD). Uso: npm run perfiles:extraer
 * En producción también se puede lanzar desde Administración → Base de conocimiento.
 */
require('../src/bd/migrar').migrar();
const { geminiDisponible } = require('../src/ia/gemini');
const { encolarPendientes, procesarSiguiente } = require('../src/ia/colaPerfiles');

async function ejecutar() {
  if (!geminiDisponible()) {
    console.error('Gemini no está disponible: falta GEMINI_API_KEY o se alcanzó el tope de gasto.');
    process.exit(1);
  }
  console.log(`CV encolados: ${encolarPendientes()}`);
  const totales = {};
  for (;;) {
    const { estado, id, mensaje } = await procesarSiguiente();
    if (['vacia', 'pausada', 'limite', 'sin-gemini'].includes(estado)) {
      console.log(`Fin (${estado}).`, totales);
      return;
    }
    totales[estado] = (totales[estado] ?? 0) + 1;
    console.log(`Candidato #${id}: ${estado}${mensaje ? ` (${mensaje})` : ''}`);
  }
}

ejecutar();
