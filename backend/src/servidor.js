const express = require('express');
const cors = require('cors');
const { rutaNoEncontrada, manejadorErrores } = require('./middlewares/errores');

const rutaAuth = require('./rutas/auth');
const rutaCandidatos = require('./rutas/candidatos');
const rutaSolicitudes = require('./rutas/solicitudes');
const rutaEvaluaciones = require('./rutas/evaluaciones');

const app = express();
const PUERTO = process.env.PORT || 3001;

/**
 * Orígenes permitidos por CORS, separados por coma en CORS_ORIGENES.
 * Por defecto solo el servidor de desarrollo de Vite.
 */
const ORIGENES_PERMITIDOS = (process.env.CORS_ORIGENES || 'http://localhost:5173')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

// 1. Middlewares globales
app.disable('x-powered-by');
app.use(cors({ origin: ORIGENES_PERMITIDOS }));
app.use(express.json({ limit: '100kb' }));

// 2. Ruta de comprobación de salud (Healthcheck)
app.get('/api/salud', (req, res) => {
  res.json({
    ok: true,
    servicio: 'AquaChile - API de Evaluaciones Psicolaborales',
    version: '1.0.0',
    estado: 'operativo',
    fecha: new Date().toISOString(),
  });
});

// 3. Montaje de módulos de rutas de la API REST
app.use('/api/auth', rutaAuth);
app.use('/api/candidatos', rutaCandidatos);
app.use('/api/solicitudes', rutaSolicitudes);
app.use('/api/evaluaciones', rutaEvaluaciones);

// 4. Manejadores de rutas no encontradas y errores
app.use(rutaNoEncontrada);
app.use(manejadorErrores);

// 5. Iniciar escucha del servidor si se ejecuta directamente
if (require.main === module) {
  app.listen(PUERTO, () => {
    console.log(`🚀 Servidor backend AquaChile iniciado en http://localhost:${PUERTO}`);
    console.log(`   - Endpoint salud:        http://localhost:${PUERTO}/api/salud`);
    console.log(`   - Autenticación:         http://localhost:${PUERTO}/api/auth/login`);
    console.log(`   - Candidatos:            http://localhost:${PUERTO}/api/candidatos`);
    console.log(`   - Solicitudes:           http://localhost:${PUERTO}/api/solicitudes`);
    console.log(`   - Evaluaciones:          http://localhost:${PUERTO}/api/evaluaciones`);
  });
}

module.exports = app;
