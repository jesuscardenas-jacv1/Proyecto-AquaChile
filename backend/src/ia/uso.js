/**
 * Registro del consumo de IA (tabla uso_ia) para el panel del administrador.
 *
 * - Claude: tokens de entrada, salida y caché que informa la API en `response.usage`.
 * - Azure Speech: segundos de audio transcritos.
 *
 * El costo es una ESTIMACIÓN con precios de lista (USD). La factura real está en la consola
 * de Anthropic y en Azure Cost Management. Registrar nunca debe romper la ayuda de IA:
 * si falla la escritura, solo se informa en el log.
 *
 * Quién hizo la llamada se toma del contexto de la petición (AsyncLocalStorage), que la
 * ruta /api/ia fija con `conContextoUso` después de autenticar.
 */
const { AsyncLocalStorage } = require('node:async_hooks');
const db = require('../bd/conexion');

const contexto = new AsyncLocalStorage();

// USD por millón de tokens. La caché escrita cuesta 1,25× la entrada y la leída 0,1×.
const PRECIOS_CLAUDE = [
  { prefijo: 'claude-opus', entrada: 4, salida: 20 },
  { prefijo: 'claude-sonnet', entrada: 2, salida: 10 },
  { prefijo: 'claude-haiku', entrada: 0.1, salida: 0.5 },
  { prefijo: 'claude-fable', entrada: 4, salida: 20 },
];
// Azure Speech F0 (gratis) incluye 5 horas de audio al mes. En S0 se define AZURE_SPEECH_USD_HORA.
const HORAS_GRATIS_VOZ = 5;
const usdPorHoraVoz = () => Number(process.env.AZURE_SPEECH_USD_HORA) || 0;

const precioDe = (modelo = '') => PRECIOS_CLAUDE.find((precio) => modelo.startsWith(precio.prefijo)) ?? PRECIOS_CLAUDE[0];

/** Costo estimado en USD de una llamada a Claude. */
function costoClaude({ modelo, entrada = 0, salida = 0, cacheEscritura = 0, cacheLectura = 0 }) {
  const precio = precioDe(modelo);
  const tokensEquivalentes = entrada + cacheEscritura * 1.25 + cacheLectura * 0.1;
  return (tokensEquivalentes * precio.entrada + salida * precio.salida) / 1_000_000;
}

const costoVoz = (segundos = 0) => (segundos / 3600) * usdPorHoraVoz();

/** Ejecuta `siguiente` con el usuario de la petición como contexto del registro. */
function conContextoUso(req, res, siguiente) {
  contexto.run({ usuario: req.usuario?.nombre ?? '', rol: req.usuario?.rol ?? '' }, siguiente);
}

function guardar(fila) {
  const quien = contexto.getStore() ?? {};
  try {
    db.prepare(
      `INSERT INTO uso_ia (proveedor, tarea, modelo, usuario, rol, tokens_entrada, tokens_salida,
         tokens_cache_escritura, tokens_cache_lectura, segundos_audio, costo_usd, resultado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      fila.proveedor,
      fila.tarea,
      fila.modelo ?? '',
      quien.usuario ?? '',
      quien.rol ?? '',
      fila.entrada ?? 0,
      fila.salida ?? 0,
      fila.cacheEscritura ?? 0,
      fila.cacheLectura ?? 0,
      fila.segundos ?? 0,
      fila.costo ?? 0,
      fila.resultado ?? 'ok',
    );
  } catch (error) {
    console.error('⚠️ No se pudo registrar el consumo de IA:', error.message);
  }
}

/** Registra una respuesta de Claude (también las rechazadas o incompletas: igual se cobran). */
function registrarClaude({ tarea, respuesta }) {
  const uso = respuesta?.usage ?? {};
  const fila = {
    proveedor: 'anthropic',
    tarea,
    modelo: respuesta?.model ?? '',
    entrada: uso.input_tokens ?? 0,
    salida: uso.output_tokens ?? 0,
    cacheEscritura: uso.cache_creation_input_tokens ?? 0,
    cacheLectura: uso.cache_read_input_tokens ?? 0,
    resultado: respuesta?.stop_reason === 'refusal' || respuesta?.stop_reason === 'max_tokens' ? respuesta.stop_reason : 'ok',
  };
  guardar({ ...fila, costo: costoClaude(fila) });
}

/** Registra una transcripción de Azure Speech. */
function registrarVoz({ segundos, idioma }) {
  guardar({ proveedor: 'azure-speech', tarea: 'transcripcion', modelo: `fast-transcription ${idioma ?? ''}`.trim(), segundos, costo: costoVoz(segundos) });
}

const redondear = (valor, decimales = 4) => Number(Number(valor ?? 0).toFixed(decimales));

/**
 * Resumen del consumo entre dos fechas (YYYY-MM-DD, ambas incluidas).
 * Devuelve totales, agrupaciones por día, tarea, modelo y usuario, y las últimas llamadas.
 */
function resumenUso({ desde, hasta, ultimas = 50 }) {
  const filtro = `WHERE date(creado_en) BETWEEN ? AND ?`;
  const parametros = [desde, hasta];
  const columnas = `COUNT(*) AS llamadas, SUM(tokens_entrada) AS entrada, SUM(tokens_salida) AS salida,
    SUM(tokens_cache_escritura + tokens_cache_lectura) AS cache, SUM(segundos_audio) AS segundos, SUM(costo_usd) AS costo`;
  const formatear = (fila) => ({
    llamadas: fila.llamadas ?? 0,
    tokensEntrada: fila.entrada ?? 0,
    tokensSalida: fila.salida ?? 0,
    tokensCache: fila.cache ?? 0,
    segundosAudio: redondear(fila.segundos, 1),
    costoUsd: redondear(fila.costo),
  });
  const agrupar = (campo, orden = 'costo DESC') =>
    db
      .prepare(`SELECT ${campo} AS clave, ${columnas} FROM uso_ia ${filtro} GROUP BY ${campo} ORDER BY ${orden}`)
      .all(...parametros)
      .map((fila) => ({ clave: fila.clave || '—', ...formatear(fila) }));

  const porProveedor = Object.fromEntries(agrupar('proveedor').map(({ clave, ...resto }) => [clave, resto]));
  // La cuota gratis de Azure es mensual: se mide en el mes calendario actual, no en el filtro.
  const segundosMes =
    db.prepare(`SELECT SUM(segundos_audio) AS s FROM uso_ia WHERE proveedor = 'azure-speech' AND strftime('%Y-%m', creado_en) = strftime('%Y-%m', 'now')`).get().s ?? 0;

  return {
    desde,
    hasta,
    total: formatear(db.prepare(`SELECT ${columnas} FROM uso_ia ${filtro}`).get(...parametros)),
    claude: porProveedor.anthropic ?? formatear({}),
    voz: {
      ...(porProveedor['azure-speech'] ?? formatear({})),
      minutosMes: redondear(segundosMes / 60, 1),
      minutosGratisMes: HORAS_GRATIS_VOZ * 60,
    },
    porDia: agrupar('date(creado_en)', 'clave'),
    porTarea: agrupar('tarea'),
    porModelo: agrupar('modelo'),
    porUsuario: agrupar('usuario'),
    ultimas: db
      .prepare(`SELECT * FROM uso_ia ${filtro} ORDER BY id DESC LIMIT ?`)
      .all(...parametros, ultimas)
      .map((fila) => ({
        id: fila.id,
        fecha: fila.creado_en,
        proveedor: fila.proveedor,
        tarea: fila.tarea,
        modelo: fila.modelo,
        usuario: fila.usuario,
        rol: fila.rol,
        tokensEntrada: fila.tokens_entrada,
        tokensSalida: fila.tokens_salida,
        tokensCache: fila.tokens_cache_escritura + fila.tokens_cache_lectura,
        segundosAudio: fila.segundos_audio,
        costoUsd: redondear(fila.costo_usd),
        resultado: fila.resultado,
      })),
    precios: { claude: PRECIOS_CLAUDE, vozUsdHora: usdPorHoraVoz() },
  };
}

module.exports = { conContextoUso, costoClaude, costoVoz, registrarClaude, registrarVoz, resumenUso, HORAS_GRATIS_VOZ };
