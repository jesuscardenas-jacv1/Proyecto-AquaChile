/**
 * Genera el PDF oficial del informe psicolaboral que se guarda en la carpeta de la solicitud.
 *
 * Es la misma estructura de la página "Informe Psicolaboral" del frontend, en su versión
 * para el analista: la carpeta la pueden abrir analistas y evaluadores, así que el PDF
 * NUNCA incluye las observaciones clínicas, solo el dictamen oficial.
 */
const PDFDocument = require('pdfkit');
const { ErrorAlmacenamiento, claveCarpeta, limpiarNombre } = require('./comun');

const COLORES = {
  primario: '#2E3D48',
  acento: '#FE5000',
  texto: '#24303A',
  secundario: '#6E6259',
  borde: '#D7D2CB',
  fondo: '#F5F3F0',
};

const COLOR_DICTAMEN = {
  Recomendado: '#198754',
  'Recomendado con observaciones': '#B26A00',
  'No recomendado': '#B02A37',
};

/** Mismos textos que DESCRIPCIONES_DICTAMEN de src/paginas/InformePsicolaboral.jsx. */
const DESCRIPCIONES_DICTAMEN = {
  Recomendado:
    'El/La postulante evidencia las competencias, habilidades y motivación requeridas para desempeñar exitosamente las funciones del cargo, demostrando alineamiento con la cultura y estándares operativos de AquaChile.',
  'Recomendado con observaciones':
    'El/La postulante cumple con el perfil general requerido, sugiriéndose instancias de inducción reforzada, acompañamiento inicial o nivelación en los focos específicos señalados en la evaluación.',
  'No recomendado':
    'El/La postulante no se ajusta en este momento a los requerimientos conductuales o competencias críticas definidas para la posición en la compañía.',
};

const NOTA_CONFIDENCIAL =
  'Las observaciones clínicas detalladas se encuentran resguardadas bajo secreto y confidencialidad profesional por el equipo de psicólogos evaluadores. El dictamen técnico oficial se presenta a continuación.';

const texto = (valor) => String(valor ?? '').trim();

/** yyyy-mm-dd → dd-mm-yyyy, igual que formatearFecha del frontend. */
function formatearFecha(fecha) {
  const [anio, mes, dia] = texto(fecha).slice(0, 10).split('-');
  return anio && mes && dia ? `${dia}-${mes}-${anio}` : texto(fecha) || '—';
}

/** Valida los datos mínimos del informe. Lanza ErrorAlmacenamiento (400). */
function validarDatosInforme({ candidato, solicitud, evaluacion } = {}) {
  if (!texto(candidato?.nombre)) {
    throw new ErrorAlmacenamiento('Falta el nombre del candidato para el informe.', 400);
  }
  if (!texto(solicitud?.cargo)) {
    throw new ErrorAlmacenamiento('Falta el cargo de la solicitud para el informe.', 400);
  }
  if (!DESCRIPCIONES_DICTAMEN[evaluacion?.resultado]) {
    throw new ErrorAlmacenamiento('El resultado de la evaluación no es válido.', 400);
  }
  if (!texto(evaluacion?.fechaEvaluacion)) {
    throw new ErrorAlmacenamiento('Falta la fecha de la evaluación.', 400);
  }
}

/** Nombre fijo por solicitud: al actualizar la evaluación el informe se reemplaza. */
function nombreArchivoInforme(solicitudId, nombreCandidato) {
  const candidato = limpiarNombre(nombreCandidato, 80);
  return `${claveCarpeta(solicitudId)}${candidato ? ` - ${candidato}` : ''}.pdf`;
}

function seccion(doc, titulo) {
  doc.moveDown(1.2);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORES.primario).text(titulo.toUpperCase());
  const y = doc.y + 3;
  doc.moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(0.75)
    .strokeColor(COLORES.borde)
    .stroke();
  doc.moveDown(0.6);
}

/** Grilla de dos columnas con pares etiqueta / valor. */
function campos(doc, pares) {
  const izquierda = doc.page.margins.left;
  const ancho = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 2;

  for (let i = 0; i < pares.length; i += 2) {
    const yFila = doc.y;
    let yMaximo = yFila;
    pares.slice(i, i + 2).forEach(([etiqueta, valor], columna) => {
      const x = izquierda + columna * ancho;
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORES.secundario)
        .text(etiqueta, x, yFila, { width: ancho - 12 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORES.texto)
        .text(texto(valor) || '—', x, doc.y + 1, { width: ancho - 12 });
      yMaximo = Math.max(yMaximo, doc.y);
    });
    doc.y = yMaximo + 8;
  }
  doc.x = izquierda;
}

/**
 * @param {{ solicitudId: number, candidato: object, solicitud: object, evaluacion: object }} datos
 * @returns {Promise<Buffer>}
 */
function generarInformePdf({ solicitudId, candidato, solicitud, evaluacion }) {
  validarDatosInforme({ candidato, solicitud, evaluacion });

  return new Promise((resolver, rechazar) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 0, bottom: 50, left: 56, right: 56 },
      info: {
        Title: `Informe Psicolaboral ${claveCarpeta(solicitudId)} - ${texto(candidato.nombre)}`,
        Author: 'AquaChile · Reclutamiento y Selección',
        Subject: 'Informe psicolaboral oficial (versión sin observaciones clínicas)',
      },
    });
    const partes = [];
    doc.on('data', (parte) => partes.push(parte));
    doc.on('end', () => resolver(Buffer.concat(partes)));
    doc.on('error', rechazar);

    const izquierda = doc.page.margins.left;
    const anchoUtil = doc.page.width - izquierda - doc.page.margins.right;
    const folio = `FOLIO-APL-${String(solicitudId).padStart(4, '0')}`;

    // Cabecera institucional
    doc.rect(0, 0, doc.page.width, 92).fill(COLORES.primario);
    doc.rect(0, 92, doc.page.width, 3).fill(COLORES.acento);
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#FFFFFF').text('AquaChile', izquierda, 26);
    doc.font('Helvetica').fontSize(9).fillColor('#D7D2CB')
      .text('Gestión de Personas · Reclutamiento y Selección', izquierda, 50);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF')
      .text('Informe Psicolaboral', izquierda, 26, { width: anchoUtil, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#D7D2CB')
      .text(folio, izquierda, 46, { width: anchoUtil, align: 'right' })
      .text(`Fecha: ${formatearFecha(evaluacion.fechaEvaluacion)}`, izquierda, 59, {
        width: anchoUtil,
        align: 'right',
      });
    doc.x = izquierda;
    doc.y = 110;

    seccion(doc, '1. Antecedentes del postulante');
    campos(doc, [
      ['Nombre completo', candidato.nombre],
      ['Cargo postulado', solicitud.cargo],
      ['Familia de cargo', solicitud.familiaCargo],
      ['Origen', candidato.origen || 'Externo'],
      ['Correo de contacto', candidato.correo],
      ['Teléfono', candidato.telefono],
    ]);

    seccion(doc, '2. Datos del proceso de selección');
    campos(doc, [
      ['Fecha de solicitud', formatearFecha(solicitud.fechaSolicitud)],
      ['Reclutador/a solicitante', solicitud.reclutador || 'AquaChile'],
      ['Ubicación / Planta', [solicitud.ubicacion, solicitud.unidad].filter(Boolean).join(' · ')],
      ['Centro de Costo (CECO)', solicitud.ceco],
    ]);

    seccion(doc, '3. Síntesis de evaluación y competencias');
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORES.texto)
      .text('Evaluación por Competencias Certificada');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORES.secundario)
      .text(NOTA_CONFIDENCIAL, { width: anchoUtil, align: 'justify' });

    seccion(doc, '4. Dictamen final y conclusión');
    const color = COLOR_DICTAMEN[evaluacion.resultado];
    const yCaja = doc.y;
    const descripcion = DESCRIPCIONES_DICTAMEN[evaluacion.resultado];
    doc.font('Helvetica').fontSize(9.5);
    const altoCaja = 44 + doc.heightOfString(descripcion, { width: anchoUtil - 28 });
    doc.roundedRect(izquierda, yCaja, anchoUtil, altoCaja, 6).fillAndStroke(COLORES.fondo, color);
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORES.secundario)
      .text('Categoría de recomendación', izquierda + 14, yCaja + 12);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(color)
      .text(evaluacion.resultado.toUpperCase(), izquierda + 14, doc.y + 1);
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORES.texto)
      .text(descripcion, izquierda + 14, doc.y + 4, { width: anchoUtil - 28 });
    doc.x = izquierda;
    doc.y = yCaja + altoCaja + 40;

    // Firmas
    const yFirma = doc.y;
    const anchoFirma = anchoUtil / 2 - 20;
    [
      [solicitud.profesionalResponsable || 'Profesional Evaluador', 'Psicología Laboral', 0],
      ['Dirección de Personas', 'Gestión del Talento', anchoUtil / 2 + 20],
    ].forEach(([nombre, area, desplazamiento]) => {
      const x = izquierda + desplazamiento;
      doc.moveTo(x, yFirma).lineTo(x + anchoFirma, yFirma).lineWidth(0.75)
        .strokeColor(COLORES.secundario).stroke();
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORES.texto)
        .text(nombre, x, yFirma + 6, { width: anchoFirma, align: 'center' });
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORES.secundario)
        .text(area, x, doc.y + 1, { width: anchoFirma, align: 'center' });
    });

    // El pie va bajo el margen inferior: sin esto pdfkit agregaría una página en blanco.
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORES.secundario).text(
      'Documento confidencial — uso exclusivo de Gestión de Personas AquaChile. Generado automáticamente al registrar la evaluación.',
      izquierda,
      doc.page.height - 40,
      { width: anchoUtil, align: 'center', lineBreak: false },
    );

    doc.end();
  });
}

module.exports = {
  DESCRIPCIONES_DICTAMEN,
  NOTA_CONFIDENCIAL,
  generarInformePdf,
  nombreArchivoInforme,
  validarDatosInforme,
};
