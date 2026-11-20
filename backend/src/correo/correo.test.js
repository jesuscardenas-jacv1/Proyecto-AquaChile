/**
 * Pruebas de los correos con Resend (con un cliente simulado: nunca se llama a Resend real).
 * Correos internos: solicitud nueva y asignación. Correos al postulante: confirmación de la
 * postulación (portal, al terminar de subir el CV) y del registro manual de un candidato.
 * Requiere la BD migrada y sembrada; al final restablece los datos de demostración.
 * Ejecutar con: npm run test:correo
 */
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const app = require('../servidor');
const db = require('../bd/conexion');
const { JWT_SECRETO } = require('../middlewares/auth');
const { establecerAlmacenamiento } = require('../almacenamiento');
const { AlmacenamientoLocal } = require('../almacenamiento/local');
const { establecerReuniones } = require('../reuniones');
const {
  REMITENTE_POR_DEFECTO,
  correoDisponible,
  enviarCorreo,
  esperarCorreosPendientes,
  establecerClienteCorreo,
} = require('./index');
const { correoAsignacion, correoConfirmacionPostulacion, correoSolicitudNueva } = require('./plantillas');

/** Cliente simulado con la misma forma que el SDK de Resend: `emails.send` → `{ data, error }`. */
function clienteSimulado({ falla = false } = {}) {
  const enviados = [];
  return {
    enviados,
    emails: {
      send: async (correo) => {
        enviados.push(correo);
        return falla ? { data: null, error: { message: 'Resend no disponible' } } : { data: { id: `c${enviados.length}` }, error: null };
      },
    },
  };
}

const VARIABLES = ['RESEND_API_KEY', 'CORREO_DESTINO_PRUEBA', 'CORREO_REMITENTE', 'APP_URL'];
let respaldo = {};
beforeEach(() => {
  respaldo = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));
  VARIABLES.forEach((v) => delete process.env[v]);
});
afterEach(() => {
  establecerClienteCorreo(null);
  VARIABLES.forEach((v) => (respaldo[v] === undefined ? delete process.env[v] : (process.env[v] = respaldo[v])));
});

describe('módulo de correo', () => {
  it('sin RESEND_API_KEY ni cliente no envía nada', async () => {
    assert.equal(correoDisponible(), false);
    assert.deepEqual(await enviarCorreo({ para: 'a@b.cl', asunto: 'x', html: '<p>x</p>', texto: 'x' }), { omitido: true });
  });

  it('envía con el remitente por defecto y el destinatario real', async () => {
    const cliente = clienteSimulado();
    establecerClienteCorreo(cliente);
    const resultado = await enviarCorreo({ para: 'ignacia.valdes@aquachile.cl', asunto: 'Hola', html: '<p>h</p>', texto: 'h' });
    assert.equal(resultado.id, 'c1');
    assert.equal(cliente.enviados[0].from, REMITENTE_POR_DEFECTO);
    assert.equal(cliente.enviados[0].to, 'ignacia.valdes@aquachile.cl');
    assert.equal(cliente.enviados[0].subject, 'Hola');
    assert.equal(cliente.enviados[0].text, 'h');
  });

  it('con CORREO_DESTINO_PRUEBA redirige y el asunto indica el destinatario original', async () => {
    process.env.CORREO_DESTINO_PRUEBA = 'equipo.prueba@correo.cl';
    process.env.CORREO_REMITENTE = 'Pruebas <pruebas@dominio.cl>';
    const cliente = clienteSimulado();
    establecerClienteCorreo(cliente);
    await enviarCorreo({ para: 'ignacia.valdes@aquachile.cl', asunto: 'Nueva solicitud #102', html: '', texto: '' });
    assert.equal(cliente.enviados[0].to, 'equipo.prueba@correo.cl');
    assert.equal(cliente.enviados[0].subject, '[Para: ignacia.valdes@aquachile.cl] Nueva solicitud #102');
    assert.equal(cliente.enviados[0].from, 'Pruebas <pruebas@dominio.cl>');
  });

  it('un rechazo de Resend se informa como error', async () => {
    establecerClienteCorreo(clienteSimulado({ falla: true }));
    await assert.rejects(enviarCorreo({ para: 'a@b.cl', asunto: 'x', html: '', texto: '' }), /Resend no disponible/);
  });

  it('las plantillas llevan el enlace a la solicitud y escapan el HTML', () => {
    process.env.APP_URL = 'https://ejemplo.github.io/Proyecto-AquaChile/';
    const datos = { id: 7, candidato: 'Ana <b>Pérez</b>', cargo: 'Operario' };
    const nueva = correoSolicitudNueva(datos, 'Ignacia');
    assert.match(nueva.asunto, /Nueva solicitud #7/);
    assert.match(nueva.html, /https:\/\/ejemplo\.github\.io\/Proyecto-AquaChile\/solicitudes\/7/);
    assert.match(nueva.html, /Ana &lt;b&gt;Pérez&lt;\/b&gt;/);
    assert.match(nueva.texto, /Ver solicitud: https:\/\/ejemplo\.github\.io\/Proyecto-AquaChile\/solicitudes\/7/);
    assert.match(correoAsignacion(datos, 'Ignacia').asunto, /Te asignaron la solicitud #7/);
  });

  it('la confirmación al postulante no lleva datos internos y muestra la fecha en formato chileno', () => {
    process.env.APP_URL = 'https://ejemplo.github.io/Proyecto-AquaChile';
    const portal = correoConfirmacionPostulacion({
      nombre: 'Ana Pérez', cargo: 'Operario de Planta', oferta: 'Operario de Planta Calbuco', fecha: '2026-11-16', origen: 'portal',
    });
    assert.equal(portal.asunto, 'Recibimos tu postulación · Operario de Planta');
    assert.match(portal.html, /Recibimos tu postulación/);
    assert.match(portal.html, /16-11-2026/);
    assert.match(portal.html, /Operario de Planta Calbuco/);
    assert.match(portal.html, /\/trabaja-con-nosotros/);
    assert.doesNotMatch(portal.html, /solicitudes\/|Ver solicitud/);
    assert.match(portal.texto, /Ver otras ofertas: https:\/\/ejemplo\.github\.io\/Proyecto-AquaChile\/trabaja-con-nosotros/);

    const manual = correoConfirmacionPostulacion({ nombre: 'Ana', cargo: 'Operario', fecha: '2026-11-16', origen: 'manual' });
    assert.match(manual.html, /Registramos tu postulación/);
    assert.doesNotMatch(manual.html, /<a href/, 'el registro manual no lleva botón');
  });
});

describe('correos de la API (solo solicitud nueva y asignación)', () => {
  let servidor;
  let base;
  let raizDocumentos;
  let cliente;
  const cabeceras = (rol) => ({
    Authorization: `Bearer ${jwt.sign({ id: 1, nombre: 'Prueba', rol }, JWT_SECRETO)}`,
    'Content-Type': 'application/json',
  });
  const pedir = async (ruta, { rol, metodo = 'GET', cuerpo } = {}) => {
    const respuesta = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: rol ? cabeceras(rol) : { 'Content-Type': 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { status: respuesta.status, datos: await respuesta.json().catch(() => ({})) };
  };
  const evaluadora = db.prepare("SELECT nombre, correo FROM usuarios WHERE rol = 'evaluador' ORDER BY id LIMIT 1").get();
  const evaluadoras = db.prepare("SELECT correo FROM usuarios WHERE rol = 'evaluador'").all();
  const crearSolicitud = (extra = {}) =>
    pedir('/solicitudes', {
      rol: 'analista',
      metodo: 'POST',
      cuerpo: { candidatoId: 1, cargo: 'Operador Grúa Horquilla', familiaCargo: 'Operario', reclutador: 'Carolina Muñoz', ...extra },
    });
  /** Espera los envíos en segundo plano y devuelve los correos enviados. */
  const enviados = async () => {
    await esperarCorreosPendientes();
    return cliente.enviados;
  };

  let colaIaOriginal;
  before(async () => {
    // Subir el CV encola el análisis con IA: en estas pruebas la cola queda apagada.
    colaIaOriginal = process.env.IA_ANALISIS_AUTOMATICO;
    process.env.IA_ANALISIS_AUTOMATICO = 'no';
    raizDocumentos = await fs.mkdtemp(path.join(os.tmpdir(), 'aquachile-correo-'));
    establecerAlmacenamiento(new AlmacenamientoLocal({ raiz: raizDocumentos }));
    establecerReuniones({ motivos: { google: 'Google Meet no está configurado en las pruebas.' } });
    servidor = app.listen(0);
    base = `http://localhost:${servidor.address().port}/api`;
  });

  beforeEach(() => {
    cliente = clienteSimulado();
    establecerClienteCorreo(cliente);
  });

  after(async () => {
    await pedir('/admin/reiniciar', { rol: 'admin', metodo: 'POST' });
    servidor.close();
    establecerAlmacenamiento(null);
    establecerReuniones(null);
    await fs.rm(raizDocumentos, { recursive: true, force: true });
    if (colaIaOriginal === undefined) delete process.env.IA_ANALISIS_AUTOMATICO;
    else process.env.IA_ANALISIS_AUTOMATICO = colaIaOriginal;
  });

  it('la semilla tiene una psicóloga con correo para las pruebas', () => {
    assert.ok(evaluadora?.correo);
  });

  it('solicitud con responsable: un correo a ella, con el enlace a la solicitud', async () => {
    const { status, datos } = await crearSolicitud({ profesionalResponsable: evaluadora.nombre });
    assert.equal(status, 201);
    const correos = await enviados();
    assert.equal(correos.length, 1);
    assert.equal(correos[0].to, evaluadora.correo);
    assert.match(correos[0].subject, new RegExp(`Nueva solicitud #${datos.solicitud.id}`));
    assert.match(correos[0].html, new RegExp(`/solicitudes/${datos.solicitud.id}`));
  });

  it('solicitud sin responsable: un correo por cada evaluadora', async () => {
    assert.equal((await crearSolicitud()).status, 201);
    const correos = await enviados();
    assert.deepEqual(correos.map((c) => c.to).sort(), evaluadoras.map((e) => e.correo).sort());
  });

  it('asignación: un correo a la asignada; reasignar a la misma no envía otro', async () => {
    const id = (await crearSolicitud()).datos.solicitud.id;
    await esperarCorreosPendientes();
    cliente.enviados.length = 0;

    const asignar = () =>
      pedir(`/solicitudes/${id}/estado`, { rol: 'analista', metodo: 'PATCH', cuerpo: { profesionalResponsable: evaluadora.nombre } });
    assert.equal((await asignar()).status, 200);
    let correos = await enviados();
    assert.equal(correos.length, 1);
    assert.equal(correos[0].to, evaluadora.correo);
    assert.match(correos[0].subject, new RegExp(`Te asignaron la solicitud #${id}`));

    assert.equal((await asignar()).status, 200);
    correos = await enviados();
    assert.equal(correos.length, 1, 'misma responsable: sin correo nuevo');
  });

  const postular = (extra = {}) =>
    pedir('/postulaciones', {
      metodo: 'POST',
      cuerpo: {
        ofertaId: 9, // oferta real abierta en la semilla
        nombre: 'Postulante Correo',
        correo: `postulante.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@correo.cl`,
        telefono: '+56933334444',
        ciudad: 'Ancud',
        origen: 'Externo',
        consentimiento: true,
        ...extra,
      },
    });
  const subirCv = (id) =>
    fetch(`${base}/postulaciones/${id}/cv?nombre=cv.pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf', 'X-Candidato': encodeURIComponent('Postulante Correo') },
      body: Buffer.from('%PDF-1.4 CV de prueba'),
    });

  it('portal con CV: confirma al postulante cuando el CV termina de subirse, una sola vez', async () => {
    const creada = await postular({ cvNombre: 'cv.pdf' });
    assert.equal(creada.status, 201);
    assert.equal((await enviados()).length, 0, 'sin CV todavía no se confirma');

    assert.equal((await subirCv(creada.datos.postulacion.id)).status, 201);
    let correos = await enviados();
    assert.equal(correos.length, 1);
    assert.match(correos[0].to, /^postulante\./);
    assert.match(correos[0].subject, /^Recibimos tu postulación · /);
    assert.match(correos[0].html, /Postulante Correo/);

    assert.equal((await subirCv(creada.datos.postulacion.id)).status, 201);
    correos = await enviados();
    assert.equal(correos.length, 1, 'volver a subir el CV no repite el correo');
  });

  it('portal sin CV: confirma al registrar la postulación', async () => {
    const creada = await postular();
    assert.equal(creada.status, 201);
    const correos = await enviados();
    assert.equal(correos.length, 1);
    assert.match(correos[0].subject, /^Recibimos tu postulación/);
  });

  it('la postulación no envía correo a los analistas (siguen solo en la campana)', async () => {
    await postular();
    const correosAnalistas = db.prepare("SELECT correo FROM usuarios WHERE rol = 'analista'").all().map((u) => u.correo);
    assert.equal((await enviados()).some((c) => correosAnalistas.includes(c.to)), false);
  });

  it('registro manual de un candidato: le confirma su postulación al cargo', async () => {
    const candidato = await pedir('/candidatos', {
      rol: 'analista',
      metodo: 'POST',
      cuerpo: { nombre: 'Candidato Manual', correo: 'candidato.manual@correo.cl', telefono: '+56911112222', cargo: 'Operario de Planta', familiaCargo: 'Operario' },
    });
    assert.equal(candidato.status, 201);
    const correos = await enviados();
    assert.equal(correos.length, 1);
    assert.equal(correos[0].to, 'candidato.manual@correo.cl');
    assert.equal(correos[0].subject, 'Recibimos tu postulación · Operario de Planta');
    assert.match(correos[0].html, /Registramos tu postulación/);
  });

  it('sin RESEND_API_KEY no se intenta enviar y la solicitud se crea igual', async () => {
    establecerClienteCorreo(null);
    assert.equal(correoDisponible(), false);
    assert.equal((await crearSolicitud({ profesionalResponsable: evaluadora.nombre })).status, 201);
    assert.equal(cliente.enviados.length, 0);
  });

  it('si Resend falla, la solicitud se crea igual (201) y el aviso queda en la campana', async () => {
    const fallido = clienteSimulado({ falla: true });
    establecerClienteCorreo(fallido);
    const errores = [];
    const original = console.error;
    console.error = (...args) => errores.push(args.join(' '));
    try {
      const { status, datos } = await crearSolicitud({ profesionalResponsable: evaluadora.nombre });
      assert.equal(status, 201);
      await esperarCorreosPendientes();
      assert.equal(fallido.enviados.length, 1);
      assert.ok(errores.some((e) => /No se pudo enviar el correo/.test(e)));
      const aviso = db
        .prepare("SELECT id FROM notificaciones WHERE enlace = ? AND tipo = 'solicitud'")
        .get(`/solicitudes/${datos.solicitud.id}`);
      assert.ok(aviso, 'el aviso de la campana se guardó');
    } finally {
      console.error = original;
    }
  });

  it('con CORREO_DESTINO_PRUEBA el correo va a la dirección de prueba', async () => {
    process.env.CORREO_DESTINO_PRUEBA = 'equipo.prueba@correo.cl';
    await crearSolicitud({ profesionalResponsable: evaluadora.nombre });
    const correos = await enviados();
    assert.equal(correos[0].to, 'equipo.prueba@correo.cl');
    assert.match(correos[0].subject, new RegExp(`^\\[Para: ${evaluadora.correo.replace(/\./g, '\\.')}\\] Nueva solicitud`));
  });
});
