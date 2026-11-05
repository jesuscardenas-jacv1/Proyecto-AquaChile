/**
 * Genera los descriptores de cargo ficticios de la demostración en public/descriptores,
 * uno por cada cargo del catálogo (src/datos/bdSimulada.json).
 * Ejecutar con: npm --prefix backend run descriptores:generar
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const contenidos = require('./datos-descriptores');

const RAIZ = path.join(__dirname, '..', '..');
const DESTINO = path.join(RAIZ, 'public', 'descriptores');
const COLORES = { primario: '#2E3D48', acento: '#FE5000', texto: '#24303A', secundario: '#6E6259' };
const AVISO = 'Documento ficticio, creado para la demostración de un proyecto académico (DSY1104, Duoc UC).';

/** Nombre en disco sin tildes: evita diferencias de codificación entre sistemas de archivos. */
const archivoEnDisco = (nombre) => nombre.normalize('NFD').replace(/[̀-ͯ]/g, '');

function cargosDelCatalogo() {
  const { solicitudes } = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'datos', 'bdSimulada.json'), 'utf8'));
  const cargos = new Map();
  solicitudes.forEach(({ cargo, familiaCargo, descriptorCargo }) => {
    const nombre = cargo?.trim();
    if (nombre && !cargos.has(nombre.toLowerCase())) cargos.set(nombre.toLowerCase(), { nombre, familiaCargo, descriptorCargo });
  });
  return [...cargos.values()];
}

function seccion(doc, titulo) {
  doc.moveDown(0.9).font('Helvetica-Bold').fontSize(11).fillColor(COLORES.primario).text(titulo);
  doc.moveDown(0.25).font('Helvetica').fontSize(10.5).fillColor(COLORES.texto);
}

function generar({ nombre, familiaCargo, descriptorCargo }) {
  const contenido = contenidos[nombre];
  if (!contenido) throw new Error(`Falta el contenido del descriptor de "${nombre}".`);

  return new Promise((resolver, rechazar) => {
    // CreationDate fijo: volver a generar no cambia los archivos si no cambió el contenido.
    const doc = new PDFDocument({
      size: 'A4',
      margin: 56,
      info: { Title: `Descriptor de cargo - ${nombre}`, CreationDate: new Date('2026-11-05T00:00:00Z') },
    });
    const salida = fs.createWriteStream(path.join(DESTINO, archivoEnDisco(descriptorCargo)));
    doc.pipe(salida);
    salida.on('finish', resolver);
    salida.on('error', rechazar);

    const ancho = doc.page.width;
    doc.rect(0, 0, ancho, 92).fill(COLORES.primario);
    doc.rect(0, 92, ancho, 4).fill(COLORES.acento);
    doc.font('Helvetica').fontSize(10).fillColor('#FFFFFF').text('DESCRIPTOR DE CARGO', 56, 26);
    doc.font('Helvetica-Bold').fontSize(19).text(nombre, 56, 44, { width: ancho - 112 });

    doc.y = 116;
    doc.x = 56;
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORES.texto).text('Familia de cargo: ', { continued: true });
    doc.font('Helvetica').text(familiaCargo ?? '');
    doc.font('Helvetica-Bold').text('Reporta a: ', { continued: true });
    doc.font('Helvetica').text(contenido.reportaA);

    seccion(doc, 'Objetivo del cargo');
    doc.text(contenido.objetivo);
    seccion(doc, 'Funciones principales');
    doc.list(contenido.funciones, { bulletRadius: 1.8, textIndent: 12, paragraphGap: 2 });
    seccion(doc, 'Requisitos');
    doc.list(contenido.requisitos, { bulletRadius: 1.8, textIndent: 12, paragraphGap: 2 });
    seccion(doc, 'Competencias clave');
    doc.list(contenido.competencias, { bulletRadius: 1.8, textIndent: 12, paragraphGap: 2 });

    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(COLORES.secundario);
    doc.text(AVISO, 56, doc.page.height - 74, { width: ancho - 112, align: 'center', lineBreak: false });
    doc.end();
  });
}

async function principal() {
  fs.mkdirSync(DESTINO, { recursive: true });
  const cargos = cargosDelCatalogo();
  await Promise.all(cargos.map(generar));
  console.log(`${cargos.length} descriptores en ${path.relative(RAIZ, DESTINO)}`);
}

principal().catch((error) => {
  console.error(error);
  process.exit(1);
});
