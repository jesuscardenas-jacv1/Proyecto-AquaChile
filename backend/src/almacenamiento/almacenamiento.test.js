/**
 * Pruebas de la capa de almacenamiento de documentos (node:test, sin dependencias).
 * Ejecutar con: npm run test:almacenamiento
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const jwt = require('jsonwebtoken');

const comun = require('./comun');
const { AlmacenamientoLocal } = require('./local');
const { AlmacenamientoGraph } = require('./graph');
const { crearAlmacenamiento, establecerAlmacenamiento } = require('./index');
const { generarInformePdf, nombreArchivoInforme } = require('./informePdf');

describe('reglas comunes', () => {
  it('nombra la carpeta con clave estable y nombre del candidato', () => {
    assert.equal(comun.nombreCarpeta(7, 'Jorge Alvarado Uribe'), 'S0007 - Jorge Alvarado Uribe');
    assert.equal(comun.nombreCarpeta(7, ''), 'S0007');
    assert.ok(comun.esCarpetaDeSolicitud('S0007 - Otro nombre', 'S0007'));
    assert.ok(!comun.esCarpetaDeSolicitud('S00071 - X', 'S0007'));
  });

  it('limpia caracteres reservados y rutas relativas', () => {
    assert.equal(comun.limpiarNombre('../a/b:c*?.pdf'), 'a b c .pdf');
    assert.equal(comun.limpiarNombre('  CV  final.pdf  '), 'CV final.pdf');
  });

  it('prefija el archivo según su categoría y la deduce al listar', () => {
    const nombre = comun.nombreArchivo('cv', 'curriculum.pdf');
    assert.equal(nombre, 'CV - curriculum.pdf');
    assert.equal(comun.categoriaDeArchivo(nombre), 'cv');
    assert.equal(comun.categoriaDeArchivo('Informe - final.pdf'), 'informe');
    assert.equal(comun.categoriaDeArchivo('notas.txt'), 'otro');
  });

  it('valida categoría, extensión y tamaño', () => {
    assert.throws(() => comun.validarArchivo({ categoria: 'x', nombre: 'a.pdf', tamano: 1 }), {
      status: 400,
    });
    assert.throws(() => comun.validarArchivo({ categoria: 'cv', nombre: 'a.exe', tamano: 1 }), {
      status: 400,
    });
    assert.throws(
      () => comun.validarArchivo({ categoria: 'cv', nombre: 'a.pdf', tamano: 11 * 1024 * 1024 }),
      { status: 413 },
    );
    assert.doesNotThrow(() => comun.validarArchivo({ categoria: 'cv', nombre: 'a.pdf', tamano: 1 }));
  });
});

describe('proveedor local', () => {
  let raiz;
  let almacenamiento;

  before(async () => {
    raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'aquachile-docs-'));
    almacenamiento = new AlmacenamientoLocal({ raiz });
  });

  after(() => fs.rm(raiz, { recursive: true, force: true }));

  it('crea la carpeta una sola vez y la encuentra por su clave', async () => {
    assert.equal(await almacenamiento.obtenerCarpeta('S0001', null), null);
    const creada = await almacenamiento.obtenerCarpeta('S0001', 'S0001 - Ana Pérez', { crear: true });
    const encontrada = await almacenamiento.obtenerCarpeta('S0001', 'S0001 - Otro', { crear: true });
    assert.equal(encontrada.id, creada.id);
    assert.equal(encontrada.nombre, 'S0001 - Ana Pérez');
  });

  it('sube, lista, descarga y elimina archivos', async () => {
    const carpeta = await almacenamiento.obtenerCarpeta('S0001', null);
    await almacenamiento.subirArchivo(carpeta, 'CV - ana.pdf', Buffer.from('pdf'));

    const archivos = await almacenamiento.listarArchivos(carpeta);
    assert.deepEqual(
      archivos.map(({ nombre, categoria, tamano }) => ({ nombre, categoria, tamano })),
      [{ nombre: 'CV - ana.pdf', categoria: 'cv', tamano: 3 }],
    );

    const descarga = await almacenamiento.descargarArchivo(carpeta, 'CV - ana.pdf');
    assert.equal(descarga.contenido.toString(), 'pdf');
    assert.equal(descarga.tipo, 'application/pdf');

    await almacenamiento.eliminarArchivo(carpeta, 'CV - ana.pdf');
    assert.deepEqual(await almacenamiento.listarArchivos(carpeta), []);
  });

  it('rechaza nombres que intentan salir de la carpeta', async () => {
    const carpeta = await almacenamiento.obtenerCarpeta('S0001', null);
    await assert.rejects(almacenamiento.descargarArchivo(carpeta, '../S0001'), { status: 400 });
    await assert.rejects(almacenamiento.descargarArchivo(carpeta, 'no-existe.pdf'), {
      status: 404,
    });
  });
});

/** Simula Graph: responde según método + ruta y registra cada llamada. */
function crearFetchFalso(respuestas) {
  const llamadas = [];
  const fetchFalso = async (url, opciones = {}) => {
    const metodo = opciones.method ?? 'GET';
    llamadas.push({ metodo, url, opciones });
    if (url.includes('login.microsoftonline.com')) {
      return Response.json({ access_token: 'token-falso', expires_in: 3600 });
    }
    const coincidencia = respuestas.find(
      ([m, fragmento]) => m === metodo && decodeURIComponent(url).includes(fragmento),
    );
    if (!coincidencia) return Response.json({ error: { message: 'no simulado' } }, { status: 404 });
    const respuesta = coincidencia[2];
    return typeof respuesta === 'function' ? respuesta(url, opciones) : respuesta.clone();
  };
  return { fetchFalso, llamadas };
}

const configGraph = {
  tenantId: 'tenant',
  clientId: 'cliente',
  clientSecret: 'secreto',
  driveId: 'drive-1',
  carpetaRaiz: 'Evaluaciones Psicolaborales',
};

describe('proveedor Microsoft Graph', () => {
  it('exige credenciales y destino', () => {
    assert.throws(() => new AlmacenamientoGraph({ ...configGraph, clientSecret: '' }));
    assert.throws(() => new AlmacenamientoGraph({ ...configGraph, driveId: '' }));
    assert.doesNotThrow(
      () => new AlmacenamientoGraph({ ...configGraph, driveId: '', usuario: 'rrhh@aquachile.cl' }),
    );
  });

  it('crea la carpeta raíz y la de la solicitud cuando no existen', async () => {
    const { fetchFalso, llamadas } = crearFetchFalso([
      ['POST', '/items/root/children', Response.json({ id: 'raiz', name: 'Evaluaciones Psicolaborales' })],
      ['GET', '/items/raiz/children', Response.json({ value: [] })],
      [
        'POST',
        '/items/raiz/children',
        Response.json({ id: 'c1', name: 'S0001 - Ana Pérez', webUrl: 'https://onedrive/c1' }),
      ],
    ]);
    const graph = new AlmacenamientoGraph({ ...configGraph, fetch: fetchFalso });

    const carpeta = await graph.obtenerCarpeta('S0001', 'S0001 - Ana Pérez', { crear: true });

    assert.deepEqual(carpeta, { id: 'c1', nombre: 'S0001 - Ana Pérez', webUrl: 'https://onedrive/c1' });
    const creacion = llamadas.find((l) => l.metodo === 'POST' && l.url.includes('/items/raiz/children'));
    assert.equal(JSON.parse(creacion.opciones.body).name, 'S0001 - Ana Pérez');
    assert.equal(creacion.opciones.headers.Authorization, 'Bearer token-falso');
  });

  it('encuentra la carpeta existente recorriendo páginas', async () => {
    const { fetchFalso } = crearFetchFalso([
      ['GET', ':/Evaluaciones Psicolaborales', Response.json({ id: 'raiz' })],
      [
        'GET',
        '/items/raiz/children?$top',
        Response.json({ value: [{ id: 'x', name: 'S0002', folder: {} }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/pagina-2' }),
      ],
      ['GET', '/pagina-2', Response.json({ value: [{ id: 'c1', name: 'S0001 - Ana', folder: {} }] })],
    ]);
    const graph = new AlmacenamientoGraph({ ...configGraph, fetch: fetchFalso });

    const carpeta = await graph.obtenerCarpeta('S0001', null);
    assert.equal(carpeta.id, 'c1');
  });

  it('sube con PUT simple los archivos pequeños y lista solo archivos', async () => {
    const { fetchFalso, llamadas } = crearFetchFalso([
      ['PUT', '/items/c1:/CV - ana.pdf:/content', Response.json({ id: 'f1', name: 'CV - ana.pdf', size: 3, file: {} })],
      [
        'GET',
        '/items/c1/children',
        Response.json({ value: [{ id: 'f1', name: 'CV - ana.pdf', size: 3, file: {} }, { id: 'sub', name: 'Notas', folder: {} }] }),
      ],
    ]);
    const graph = new AlmacenamientoGraph({ ...configGraph, fetch: fetchFalso });
    const carpeta = { id: 'c1' };

    const archivo = await graph.subirArchivo(carpeta, 'CV - ana.pdf', Buffer.from('pdf'));
    assert.equal(archivo.categoria, 'cv');
    assert.equal(llamadas.at(-1).opciones.headers['Content-Type'], 'application/pdf');

    const archivos = await graph.listarArchivos(carpeta);
    assert.deepEqual(archivos.map((a) => a.id), ['f1']);
  });

  it('usa sesión de carga por fragmentos sobre 4 MB, sin enviar el token a la URL firmada', async () => {
    const contenido = Buffer.alloc(5 * 1024 * 1024, 1);
    const { fetchFalso, llamadas } = crearFetchFalso([
      ['POST', ':/createUploadSession', Response.json({ uploadUrl: 'https://carga.sharepoint/sesion' })],
      [
        'PUT',
        'https://carga.sharepoint/sesion',
        (url, opciones) =>
          opciones.headers['Content-Range'].endsWith(`${contenido.length - 1}/${contenido.length}`)
            ? Response.json({ id: 'f2', name: 'Informe - grande.pdf', size: contenido.length, file: {} })
            : new Response(null, { status: 202 }),
      ],
    ]);
    const graph = new AlmacenamientoGraph({ ...configGraph, fetch: fetchFalso });

    const archivo = await graph.subirArchivo({ id: 'c1' }, 'Informe - grande.pdf', contenido);

    const fragmentos = llamadas.filter((l) => l.url === 'https://carga.sharepoint/sesion');
    assert.equal(fragmentos.length, 2);
    assert.ok(fragmentos.every((l) => !l.opciones.headers.Authorization));
    assert.equal(archivo.id, 'f2');
  });

  it('no entrega archivos de otra carpeta', async () => {
    const { fetchFalso } = crearFetchFalso([
      ['GET', '/items/f9?', Response.json({ id: 'f9', name: 'CV - x.pdf', file: {}, parentReference: { id: 'otra' } })],
    ]);
    const graph = new AlmacenamientoGraph({ ...configGraph, fetch: fetchFalso });
    await assert.rejects(graph.descargarArchivo({ id: 'c1' }, 'f9'), { status: 404 });
  });

  it('traduce errores de Graph a 502', async () => {
    const { fetchFalso } = crearFetchFalso([
      ['GET', '/items/c1/children', Response.json({ error: { message: 'Access denied' } }, { status: 403 })],
    ]);
    const graph = new AlmacenamientoGraph({ ...configGraph, fetch: fetchFalso });
    await assert.rejects(graph.listarArchivos({ id: 'c1' }), { status: 502, message: /Access denied/ });
  });
});

describe('selección de proveedor', () => {
  it('usa local por defecto y graph cuando se configura', () => {
    assert.equal(crearAlmacenamiento({}).proveedor, 'local');
    assert.equal(
      crearAlmacenamiento({
        ALMACENAMIENTO: 'graph',
        GRAPH_TENANT_ID: 't',
        GRAPH_CLIENT_ID: 'c',
        GRAPH_CLIENT_SECRET: 's',
        GRAPH_USUARIO: 'rrhh@aquachile.cl',
      }).proveedor,
      'graph',
    );
    assert.throws(() => crearAlmacenamiento({ ALMACENAMIENTO: 'dropbox' }));
  });
});

describe('API /api/solicitudes/:id/documentos', () => {
  const app = require('../servidor');
  const { JWT_SECRETO } = require('../middlewares/auth');
  let servidor;
  let raiz;
  let base;

  const token = (rol) => jwt.sign({ id: 1, nombre: 'Prueba', rol }, JWT_SECRETO);
  const cabeceras = (rol, extra = {}) => ({ Authorization: `Bearer ${token(rol)}`, ...extra });

  before(async () => {
    raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'aquachile-api-'));
    establecerAlmacenamiento(new AlmacenamientoLocal({ raiz }));
    servidor = app.listen(0);
    base = `http://localhost:${servidor.address().port}/api/solicitudes/9001/documentos`;
  });

  after(async () => {
    servidor.close();
    establecerAlmacenamiento(null);
    await fs.rm(raiz, { recursive: true, force: true });
  });

  it('exige autenticación', async () => {
    const respuesta = await fetch(base);
    assert.equal(respuesta.status, 401);
  });

  it('devuelve lista vacía si la solicitud aún no tiene carpeta', async () => {
    const datos = await (await fetch(base, { headers: cabeceras('analista') })).json();
    assert.equal(datos.carpeta, null);
    assert.deepEqual(datos.archivos, []);
    assert.deepEqual(datos.permisos, ['cv', 'descriptor']);
  });

  it('el analista sube el CV y se crea la carpeta con el nombre del candidato', async () => {
    const respuesta = await fetch(`${base}?categoria=cv&nombre=curriculum.pdf`, {
      method: 'POST',
      headers: cabeceras('analista', {
        'Content-Type': 'application/pdf',
        'X-Candidato': encodeURIComponent('Ana Pérez'),
      }),
      body: Buffer.from('contenido'),
    });
    const datos = await respuesta.json();

    assert.equal(respuesta.status, 201);
    assert.equal(datos.carpeta.nombre, 'S9001 - Ana Pérez');
    assert.equal(datos.archivo.nombre, 'CV - curriculum.pdf');
  });

  it('el evaluador no puede subir CV ni borrar el del analista, pero sí descargarlo', async () => {
    const subida = await fetch(`${base}?categoria=cv&nombre=otro.pdf`, {
      method: 'POST',
      headers: cabeceras('evaluador'),
      body: Buffer.from('x'),
    });
    assert.equal(subida.status, 403);

    const id = encodeURIComponent('CV - curriculum.pdf');
    const borrado = await fetch(`${base}/${id}`, { method: 'DELETE', headers: cabeceras('evaluador') });
    assert.equal(borrado.status, 403);

    const descarga = await fetch(`${base}/${id}/contenido`, { headers: cabeceras('evaluador') });
    assert.equal(descarga.status, 200);
    assert.equal(await descarga.text(), 'contenido');
    assert.match(descarga.headers.get('content-disposition'), /CV%20-%20curriculum\.pdf/);
  });

  it('el evaluador sube el informe en la misma carpeta', async () => {
    const respuesta = await fetch(`${base}?categoria=informe&nombre=informe.pdf`, {
      method: 'POST',
      headers: cabeceras('evaluador'),
      body: Buffer.from('informe'),
    });
    assert.equal(respuesta.status, 201);

    const datos = await (await fetch(base, { headers: cabeceras('evaluador') })).json();
    assert.deepEqual(
      datos.archivos.map(({ nombre, categoria, puedeEliminar }) => ({ nombre, categoria, puedeEliminar })),
      [
        { nombre: 'CV - curriculum.pdf', categoria: 'cv', puedeEliminar: false },
        { nombre: 'Informe - informe.pdf', categoria: 'informe', puedeEliminar: true },
      ],
    );
  });

  it('rechaza tipos de archivo no permitidos', async () => {
    const respuesta = await fetch(`${base}?categoria=cv&nombre=virus.exe`, {
      method: 'POST',
      headers: cabeceras('analista'),
      body: Buffer.from('x'),
    });
    assert.equal(respuesta.status, 400);
  });

  it('el analista elimina su CV', async () => {
    const id = encodeURIComponent('CV - curriculum.pdf');
    const respuesta = await fetch(`${base}/${id}`, { method: 'DELETE', headers: cabeceras('analista') });
    assert.equal(respuesta.status, 200);
  });
  const datosInforme = {
    candidato: { nombre: 'Ana Pérez', correo: 'ana@correo.cl', telefono: '+56911112222', origen: 'Interno' },
    solicitud: { cargo: 'Jefe de Centro', familiaCargo: 'Jefatura', fechaSolicitud: '2026-10-01' },
    evaluacion: { fechaEvaluacion: '2026-10-10', resultado: 'Recomendado con observaciones' },
  };
  const generar = (rol, cuerpo = datosInforme) =>
    fetch(`${base}/informe`, {
      method: 'POST',
      headers: cabeceras(rol, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(cuerpo),
    });

  it('el evaluador genera el informe en PDF dentro de la carpeta de la solicitud', async () => {
    const respuesta = await generar('evaluador');
    const datos = await respuesta.json();

    assert.equal(respuesta.status, 201);
    assert.equal(datos.carpeta.nombre, 'S9001 - Ana Pérez');
    assert.equal(datos.archivo.nombre, 'Informe - S9001 - Ana Pérez.pdf');
    assert.equal(datos.archivo.categoria, 'informe');

    const id = encodeURIComponent(datos.archivo.id);
    const descarga = await fetch(`${base}/${id}/contenido`, { headers: cabeceras('analista') });
    assert.equal(descarga.headers.get('content-type'), 'application/pdf');
    assert.equal((await descarga.text()).slice(0, 5), '%PDF-');
  });

  it('al actualizar la evaluación el informe se reemplaza, no se duplica', async () => {
    await generar('evaluador', {
      ...datosInforme,
      evaluacion: { ...datosInforme.evaluacion, resultado: 'Recomendado' },
    });
    const datos = await (await fetch(base, { headers: cabeceras('evaluador') })).json();
    const informes = datos.archivos.filter((a) => a.nombre.startsWith('Informe - S9001'));
    assert.equal(informes.length, 1);
  });

  it('solo el evaluador puede generar el informe y con datos válidos', async () => {
    assert.equal((await generar('analista')).status, 403);
    const invalido = await generar('evaluador', {
      ...datosInforme,
      evaluacion: { fechaEvaluacion: '2026-10-10', resultado: 'Excelente' },
    });
    assert.equal(invalido.status, 400);
  });
});

describe('informe psicolaboral en PDF', () => {
  const datos = {
    solicitudId: 12,
    candidato: { nombre: 'José Ñancupil Muñoz' },
    solicitud: { cargo: 'Operario', familiaCargo: 'Operario', profesionalResponsable: 'Javiera Soto' },
    evaluacion: { fechaEvaluacion: '2026-10-10', resultado: 'No recomendado', observaciones: 'Reservado' },
  };

  it('genera un PDF de una sola página', async () => {
    const pdf = await generarInformePdf(datos);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const paginas = pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? [];
    assert.equal(paginas.length, 1);
  });

  it('exige candidato, cargo, fecha y un resultado válido', async () => {
    assert.throws(() => generarInformePdf({ ...datos, candidato: {} }), { status: 400 });
    assert.throws(() => generarInformePdf({ ...datos, solicitud: {} }), { status: 400 });
    assert.throws(
      () => generarInformePdf({ ...datos, evaluacion: { resultado: 'Recomendado' } }),
      { status: 400 },
    );
    assert.throws(
      () => generarInformePdf({ ...datos, evaluacion: { fechaEvaluacion: '2026-10-10', resultado: 'Bueno' } }),
      { status: 400 },
    );
  });

  it('nombra el archivo con la clave de la solicitud y el candidato', () => {
    assert.equal(nombreArchivoInforme(12, 'José Ñancupil Muñoz'), 'S0012 - José Ñancupil Muñoz.pdf');
    assert.equal(nombreArchivoInforme(12, ''), 'S0012.pdf');
  });
});
