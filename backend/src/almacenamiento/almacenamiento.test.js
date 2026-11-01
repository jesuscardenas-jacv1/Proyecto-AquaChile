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

describe('portal de postulación: CV público y paso a evaluación', () => {
  const app = require('../servidor');
  const { JWT_SECRETO } = require('../middlewares/auth');
  let servidor;
  let raiz;
  let base;

  const cabeceras = (rol) => ({
    Authorization: `Bearer ${jwt.sign({ id: 1, nombre: 'Prueba', rol }, JWT_SECRETO)}`,
    'Content-Type': 'application/json',
  });
  const subirCv = (postulacionId, nombre, cuerpo = Buffer.from('%PDF cv')) =>
    fetch(`${base}/postulaciones/${postulacionId}/cv?nombre=${encodeURIComponent(nombre)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf', 'X-Candidato': encodeURIComponent('Camilo Fuentealba') },
      body: cuerpo,
    });

  let postulacionId;
  let otraPostulacionId;
  const postular = async (correo) => {
    const respuesta = await fetch(`${base}/postulaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ofertaId: 1,
        nombre: 'Camilo Fuentealba',
        correo,
        telefono: '+56911112222',
        ciudad: 'Calbuco',
        origen: 'Externo',
        consentimiento: true,
        cvNombre: 'mi cv.pdf',
      }),
    });
    return (await respuesta.json()).postulacion.id;
  };

  before(async () => {
    raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'aquachile-portal-'));
    establecerAlmacenamiento(new AlmacenamientoLocal({ raiz }));
    servidor = app.listen(0);
    base = `http://localhost:${servidor.address().port}/api`;
    postulacionId = await postular(`prueba.portal.${Date.now()}@correo.cl`);
    otraPostulacionId = await postular(`prueba.portal.otra.${Date.now()}@correo.cl`);
  });

  after(async () => {
    servidor.close();
    establecerAlmacenamiento(null);
    await fs.rm(raiz, { recursive: true, force: true });
  });

  it('recibe el CV sin sesión y lo guarda en la carpeta de la postulación', async () => {
    const respuesta = await subirCv(postulacionId, 'mi cv.pdf');
    assert.equal(respuesta.status, 201);
    const clave = `P${String(postulacionId).padStart(4, '0')}`;
    assert.deepEqual(await fs.readdir(path.join(raiz, `${clave} - Camilo Fuentealba`)), ['CV - mi cv.pdf']);
  });

  it('solo acepta PDF o Word', async () => {
    assert.equal((await subirCv(otraPostulacionId, 'foto.png')).status, 400);
    assert.equal((await subirCv(otraPostulacionId, 'programa.exe')).status, 400);
  });

  it('rechaza el CV de una postulación que no existe', async () => {
    assert.equal((await subirCv(999999, 'cv.pdf')).status, 404);
  });

  it('el analista copia el CV a la carpeta de la solicitud; el evaluador no puede', async () => {
    const ruta = `${base}/solicitudes/9101/documentos/desde-postulacion`;
    const cuerpo = JSON.stringify({ postulacionId, nombreCandidato: 'Camilo Fuentealba' });

    const delEvaluador = await fetch(ruta, { method: 'POST', headers: cabeceras('evaluador'), body: cuerpo });
    assert.equal(delEvaluador.status, 403);

    const delAnalista = await fetch(ruta, { method: 'POST', headers: cabeceras('analista'), body: cuerpo });
    const datos = await delAnalista.json();
    assert.equal(delAnalista.status, 201);
    assert.equal(datos.carpeta.nombre, 'S9101 - Camilo Fuentealba');
    assert.deepEqual(datos.archivos.map((a) => a.nombre), ['CV - mi cv.pdf']);
  });

  it('avisa si la postulación no tiene CV en el servidor', async () => {
    const respuesta = await fetch(`${base}/solicitudes/9102/documentos/desde-postulacion`, {
      method: 'POST',
      headers: cabeceras('analista'),
      body: JSON.stringify({ postulacionId: 7999 }),
    });
    assert.equal(respuesta.status, 404);
  });

  it('limita los envíos públicos por IP', async () => {
    const estados = [];
    for (let i = 0; i < 10; i += 1) estados.push((await subirCv(7100 + i, 'cv.pdf')).status);
    assert.ok(estados.includes(429));
  });
});

describe('proveedor Google Drive', () => {
  const crypto = require('crypto');
  const { AlmacenamientoDrive } = require('./drive');
  const configDrive = { modo: 'oauth', clientId: 'cliente', clientSecret: 'secreto', refreshToken: 'refresh-1' };

  /** Simula Google: token OAuth y respuestas por método + fragmento de URL. */
  function crearGoogleFalso(respuestas) {
    const llamadas = [];
    const fetchFalso = async (url, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      llamadas.push({ metodo, url, opciones });
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'token-google', expires_in: 3600 });
      }
      // Las consultas `q` viajan con espacios como "+": se decodifican antes de comparar.
      const legible = decodeURIComponent(url.replace(/\+/g, ' '));
      const coincidencia = respuestas.find(([m, fragmento]) => m === metodo && legible.includes(fragmento));
      if (!coincidencia) return Response.json({ error: { message: 'no simulado' } }, { status: 404 });
      const respuesta = coincidencia[2];
      return typeof respuesta === 'function' ? respuesta(url, opciones) : respuesta.clone();
    };
    return { fetchFalso, llamadas };
  }
  const consulta = (llamada) => new URL(llamada.url).searchParams.get('q');
  const creaciones = (llamadas) =>
    llamadas.filter((l) => l.metodo === 'POST' && l.url.startsWith('https://www.googleapis.com/drive/'));

  it('exige credenciales según el modo', () => {
    assert.throws(() => new AlmacenamientoDrive({ ...configDrive, clientSecret: '' }), /GDRIVE_CLIENT/);
    assert.throws(() => new AlmacenamientoDrive({ ...configDrive, refreshToken: null }), /drive:autorizar/);
    assert.throws(() => new AlmacenamientoDrive({ modo: 'cuenta-servicio', cuentaServicio: {} }), /GDRIVE_CREDENCIALES/);
    assert.throws(() => new AlmacenamientoDrive({ modo: 'otro' }), /GDRIVE_MODO/);
  });

  it('crea la carpeta raíz en Mi unidad y la carpeta de la solicitud dentro de ella', async () => {
    const { fetchFalso, llamadas } = crearGoogleFalso([
      ['GET', "'root' in parents", Response.json({ files: [] })],
      ['GET', "'raiz-1' in parents", Response.json({ files: [] })],
      [
        'POST',
        'drive/v3/files?fields',
        (url, opciones) => {
          const cuerpo = JSON.parse(opciones.body);
          return cuerpo.parents[0] === 'root'
            ? Response.json({ id: 'raiz-1', name: cuerpo.name })
            : Response.json({ id: 'c1', name: cuerpo.name, webViewLink: 'https://drive.google.com/drive/folders/c1' });
        },
      ],
    ]);
    const drive = new AlmacenamientoDrive({ ...configDrive, fetch: fetchFalso });

    const carpeta = await drive.obtenerCarpeta('S0001', 'S0001 - Ana Pérez', { crear: true });

    assert.deepEqual(carpeta, { id: 'c1', nombre: 'S0001 - Ana Pérez', webUrl: 'https://drive.google.com/drive/folders/c1' });
    assert.deepEqual(creaciones(llamadas).map((l) => JSON.parse(l.opciones.body)), [
      { name: 'Evaluaciones Psicolaborales', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] },
      { name: 'S0001 - Ana Pérez', mimeType: 'application/vnd.google-apps.folder', parents: ['raiz-1'] },
    ]);
    // El refresh token se canjea por un token de acceso que va en cada llamada.
    const canje = llamadas.find((l) => l.url.includes('oauth2.googleapis.com'));
    assert.match(canje.opciones.body, /grant_type=refresh_token/);
    assert.equal(llamadas.at(-1).opciones.headers.Authorization, 'Bearer token-google');
  });

  it('reutiliza la carpeta existente y escapa la clave en la consulta', async () => {
    const { fetchFalso, llamadas } = crearGoogleFalso([
      [
        'GET',
        "'raiz-9' in parents",
        Response.json({ files: [{ id: 'x', name: 'S00010 - Otro' }, { id: 'c7', name: "S0007 - Ana O'Higgins" }] }),
      ],
    ]);
    const drive = new AlmacenamientoDrive({ ...configDrive, carpetaRaizId: 'raiz-9', fetch: fetchFalso });

    const carpeta = await drive.obtenerCarpeta('S0007', null, { crear: true });

    assert.equal(carpeta.id, 'c7');
    assert.equal(creaciones(llamadas).length, 0);
    assert.match(consulta(llamadas.at(-1)), /name contains 'S0007'/);
  });

  it('sube archivos nuevos en multipart y reemplaza el contenido si el nombre ya existe', async () => {
    let existe = false;
    const { fetchFalso, llamadas } = crearGoogleFalso([
      ['GET', "name = 'CV - ana.pdf'", () => Response.json({ files: existe ? [{ id: 'f1', name: 'CV - ana.pdf' }] : [] })],
      ['POST', 'upload/drive/v3/files?uploadType=multipart', Response.json({ id: 'f1', name: 'CV - ana.pdf', size: '3' })],
      ['PATCH', 'upload/drive/v3/files/f1?uploadType=media', Response.json({ id: 'f1', name: 'CV - ana.pdf', size: '4' })],
    ]);
    const drive = new AlmacenamientoDrive({ ...configDrive, carpetaRaizId: 'raiz', fetch: fetchFalso });

    const nuevo = await drive.subirArchivo({ id: 'c1' }, 'CV - ana.pdf', Buffer.from('pdf'));
    assert.deepEqual([nuevo.id, nuevo.categoria, nuevo.tamano], ['f1', 'cv', 3]);
    const multipart = llamadas.find((l) => l.url.includes('uploadType=multipart'));
    assert.match(multipart.opciones.headers['Content-Type'], /^multipart\/related; boundary=/);
    assert.match(multipart.opciones.body.toString(), /"parents":\["c1"\]/);

    existe = true;
    const reemplazo = await drive.subirArchivo({ id: 'c1' }, 'CV - ana.pdf', Buffer.from('pdf2'));
    assert.equal(reemplazo.tamano, 4);
    assert.equal(llamadas.filter((l) => l.url.includes('uploadType=multipart')).length, 1);
  });

  it('usa carga reanudable sobre 5 MB', async () => {
    const contenido = Buffer.alloc(6 * 1024 * 1024, 1);
    const { fetchFalso, llamadas } = crearGoogleFalso([
      ['GET', 'in parents and name', Response.json({ files: [] })],
      [
        'POST',
        'uploadType=resumable',
        () => new Response(null, { status: 200, headers: { Location: 'https://www.googleapis.com/upload/sesion-1' } }),
      ],
      ['PUT', 'upload/sesion-1', Response.json({ id: 'f2', name: 'Informe - x.pdf', size: String(contenido.length) })],
    ]);
    const drive = new AlmacenamientoDrive({ ...configDrive, carpetaRaizId: 'raiz', fetch: fetchFalso });

    const archivo = await drive.subirArchivo({ id: 'c1' }, 'Informe - x.pdf', contenido);

    assert.equal(archivo.id, 'f2');
    assert.equal(llamadas.find((l) => l.metodo === 'PUT').opciones.body.length, contenido.length);
  });

  it('lista, descarga y envía a la papelera solo archivos de la carpeta', async () => {
    const { fetchFalso, llamadas } = crearGoogleFalso([
      ['GET', "'c1' in parents and mimeType !=", Response.json({ files: [{ id: 'f1', name: 'CV - ana.pdf', size: '3' }] })],
      ['GET', 'files/f1?alt=media', new Response('pdf')],
      ['GET', 'files/f1?fields', Response.json({ id: 'f1', name: 'CV - ana.pdf', parents: ['c1'], mimeType: 'application/pdf' })],
      ['GET', 'files/f9?fields', Response.json({ id: 'f9', name: 'CV - x.pdf', parents: ['otra'], mimeType: 'application/pdf' })],
      ['PATCH', 'drive/v3/files/f1?fields=id', Response.json({ id: 'f1' })],
    ]);
    const drive = new AlmacenamientoDrive({ ...configDrive, carpetaRaizId: 'raiz', fetch: fetchFalso });
    const carpeta = { id: 'c1' };

    assert.deepEqual((await drive.listarArchivos(carpeta)).map((a) => a.nombre), ['CV - ana.pdf']);
    const descarga = await drive.descargarArchivo(carpeta, 'f1');
    assert.equal(descarga.contenido.toString(), 'pdf');
    assert.equal(descarga.tipo, 'application/pdf');
    await assert.rejects(drive.descargarArchivo(carpeta, 'f9'), { status: 404 });

    await drive.eliminarArchivo(carpeta, 'f1');
    assert.deepEqual(JSON.parse(llamadas.at(-1).opciones.body), { trashed: true });
  });

  it('traduce errores de Google a 502 y avisa si la autorización fue revocada', async () => {
    const { fetchFalso } = crearGoogleFalso([
      ['GET', "'c1' in parents", Response.json({ error: { message: 'Insufficient Permission' } }, { status: 403 })],
    ]);
    const drive = new AlmacenamientoDrive({ ...configDrive, carpetaRaizId: 'raiz', fetch: fetchFalso });
    await assert.rejects(drive.listarArchivos({ id: 'c1' }), { status: 502, message: /Insufficient Permission/ });

    const revocado = new AlmacenamientoDrive({
      ...configDrive,
      fetch: async () => Response.json({ error: 'invalid_grant' }, { status: 400 }),
    });
    await assert.rejects(revocado.listarArchivos({ id: 'c1' }), { status: 502, message: /drive:autorizar/ });
  });

  it('con cuenta de servicio firma un JWT con su llave privada', async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const cuentaServicio = {
      client_email: 'aquachile@proyecto.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    };
    let asercion = null;
    const fetchFalso = async (url, opciones) => {
      if (url.includes('oauth2.googleapis.com')) {
        asercion = new URLSearchParams(opciones.body).get('assertion');
        return Response.json({ access_token: 't', expires_in: 3600 });
      }
      return Response.json({ files: [] });
    };
    const drive = new AlmacenamientoDrive({
      modo: 'cuenta-servicio',
      cuentaServicio,
      carpetaRaizId: 'unidad-compartida',
      fetch: fetchFalso,
    });

    await drive.listarArchivos({ id: 'c1' });

    const [encabezado, carga, firma] = asercion.split('.');
    const valida = crypto.verify('RSA-SHA256', Buffer.from(`${encabezado}.${carga}`), publicKey, Buffer.from(firma, 'base64url'));
    assert.ok(valida);
    const datos = JSON.parse(Buffer.from(carga, 'base64url').toString());
    assert.equal(datos.iss, cuentaServicio.client_email);
    assert.equal(datos.aud, 'https://oauth2.googleapis.com/token');
  });

  it('la fábrica crea el proveedor drive con el refresh token guardado', async () => {
    const carpeta = await fs.mkdtemp(path.join(os.tmpdir(), 'aquachile-drive-'));
    const archivoToken = path.join(carpeta, 'token.json');
    await fs.writeFile(archivoToken, JSON.stringify({ refresh_token: 'r' }));

    const drive = crearAlmacenamiento({
      ALMACENAMIENTO: 'drive',
      GDRIVE_CLIENT_ID: 'c',
      GDRIVE_CLIENT_SECRET: 's',
      GDRIVE_TOKEN_ARCHIVO: archivoToken,
    });
    assert.equal(drive.proveedor, 'drive');
    assert.throws(
      () => crearAlmacenamiento({ ALMACENAMIENTO: 'drive', GDRIVE_CLIENT_ID: 'c', GDRIVE_CLIENT_SECRET: 's', GDRIVE_TOKEN_ARCHIVO: path.join(carpeta, 'no.json') }),
      /drive:autorizar/,
    );
    await fs.rm(carpeta, { recursive: true, force: true });
  });
});

describe('pauta de entrevista (documento confidencial)', () => {
  const app = require('../servidor');
  const { JWT_SECRETO } = require('../middlewares/auth');
  let servidor;
  let raiz;
  let base;
  const cabeceras = (rol) => ({ Authorization: `Bearer ${jwt.sign({ id: 1, nombre: 'Prueba', rol }, JWT_SECRETO)}` });
  const listar = async (rol) => (await (await fetch(base, { headers: cabeceras(rol) })).json()).archivos;
  const id = encodeURIComponent('Pauta - pauta.pdf');

  before(async () => {
    raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'aquachile-pauta-'));
    establecerAlmacenamiento(new AlmacenamientoLocal({ raiz }));
    servidor = app.listen(0);
    base = `http://localhost:${servidor.address().port}/api/solicitudes/9002/documentos`;
  });

  after(async () => {
    servidor.close();
    establecerAlmacenamiento(null);
    await fs.rm(raiz, { recursive: true, force: true });
  });

  it('solo la psicóloga la sube', async () => {
    const subir = (rol) =>
      fetch(`${base}?categoria=pauta&nombre=pauta.pdf`, { method: 'POST', headers: cabeceras(rol), body: Buffer.from('notas') });
    assert.equal((await subir('analista')).status, 403);
    assert.equal((await subir('evaluador')).status, 201);
  });

  it('la psicóloga y el admin la ven; analista y jefatura no la ven en el listado', async () => {
    assert.deepEqual((await listar('evaluador')).map((a) => a.nombre), ['Pauta - pauta.pdf']);
    assert.deepEqual((await listar('admin')).map((a) => a.nombre), ['Pauta - pauta.pdf']);
    assert.deepEqual(await listar('analista'), []);
    assert.deepEqual(await listar('jefatura'), []);
  });

  it('para el analista no existe: ni descarga ni eliminación (404)', async () => {
    assert.equal((await fetch(`${base}/${id}/contenido`, { headers: cabeceras('analista') })).status, 404);
    assert.equal((await fetch(`${base}/${id}`, { method: 'DELETE', headers: cabeceras('analista') })).status, 404);
    const descarga = await fetch(`${base}/${id}/contenido`, { headers: cabeceras('evaluador') });
    assert.equal(await descarga.text(), 'notas');
  });
});

describe('informe en PDF con competencias', () => {
  const competencias = [
    { competencia: 'Trabajo en equipo', nivel: 'Esperado', fortalezas: 'Coordina con su turno.', oportunidades: '' },
    { competencia: 'Liderazgo', nivel: 'En desarrollo', fortalezas: '', oportunidades: 'Delegar tareas.' },
  ];
  const datos = {
    solicitudId: 5,
    candidato: { nombre: 'Ana Pérez' },
    solicitud: { cargo: 'Jefe de Centro', familiaCargo: 'Jefatura' },
    evaluacion: { fechaEvaluacion: '2026-10-10', resultado: 'Recomendado', competencias },
  };

  it('genera el PDF con las competencias evaluadas', async () => {
    const pdf = await generarInformePdf(datos);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  });

  it('rechaza competencias inválidas con 400', () => {
    assert.throws(
      () => generarInformePdf({ ...datos, evaluacion: { ...datos.evaluacion, competencias: [{ competencia: 'Magia', nivel: 'Esperado', fortalezas: 'x' }] } }),
      { status: 400, message: /Competencia desconocida/ },
    );
  });
});
