const express = require('express');
const cors = require('cors');
const { rutaNoEncontrada, manejadorErrores } = require('./middlewares/errores');

const rutaAuth = require('./rutas/auth');
const rutaCandidatos = require('./rutas/candidatos');
const rutaSolicitudes = require('./rutas/solicitudes');
const rutaEvaluaciones = require('./rutas/evaluaciones');
const rutaDocumentos = require('./rutas/documentos');
const rutaPostulaciones = require('./rutas/postulaciones');
const rutaOfertas = require('./rutas/ofertas');
const rutaAdmin = require('./rutas/admin');

const app = express();
const PUERTO = process.env.PORT || 3001;

// 1. Middlewares globales
// Detrás del proxy de Azure App Service la IP real llega en X-Forwarded-For (límite por IP).
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// CORS_ORIGENES: orígenes permitidos separados por coma (p. ej. la página de GitHub Pages).
// Sin definir (desarrollo) se acepta cualquier origen.
const origenes = (process.env.CORS_ORIGENES || '')
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);
app.use(cors(origenes.length ? { origin: origenes } : undefined));
app.use(express.json());

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
app.use('/api/solicitudes/:id/documentos', rutaDocumentos);
app.use('/api/postulaciones', rutaPostulaciones);
app.use('/api/ofertas', rutaOfertas);
app.use('/api/admin', rutaAdmin);
app.use('/api/solicitudes', rutaSolicitudes);
app.use('/api/evaluaciones', rutaEvaluaciones);

// 4. Manejadores de rutas no encontradas y errores
app.use(rutaNoEncontrada);
app.use(manejadorErrores);

// 5. Iniciar escucha del servidor si se ejecuta directamente
/**
 * Prepara la BD antes de escuchar: crea o actualiza las tablas (idempotente) y, si está
 * vacía (primer arranque en un servidor nuevo), carga los datos de demostración.
 */
async function prepararBaseDatos() {
  require('./bd/migrar').migrar();
  const db = require('./bd/conexion');
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get();
  if (total === 0) {
    const totales = await require('./bd/semilla').sembrar({ silencioso: true });
    console.log('🌱 BD vacía: se cargaron los datos de demostración', totales);
  }
}

if (require.main === module) {
  prepararBaseDatos()
    .then(() =>
      app.listen(PUERTO, () => {
        console.log(`🚀 Servidor backend AquaChile iniciado en http://localhost:${PUERTO}`);
        console.log(`   - Endpoint salud:        http://localhost:${PUERTO}/api/salud`);
        console.log(`   - Autenticación:         http://localhost:${PUERTO}/api/auth/login`);
        console.log(`   - Candidatos:            http://localhost:${PUERTO}/api/candidatos`);
        console.log(`   - Solicitudes:           http://localhost:${PUERTO}/api/solicitudes`);
        console.log(`   - Evaluaciones:          http://localhost:${PUERTO}/api/evaluaciones`);
        console.log(`   - Documentos:            http://localhost:${PUERTO}/api/solicitudes/:id/documentos`);
        console.log(`   - Almacenamiento:        ${process.env.ALMACENAMIENTO || 'local'}`);
      }),
    )
    .catch((error) => {
      console.error('❌ No se pudo preparar la base de datos:', error);
      process.exit(1);
    });
}

module.exports = app;
