/**
 * Convierte la base de datos simulada (Excel) en los datos semilla de la aplicación.
 *
 * Uso: npm run importar:bd [ruta-al-excel]
 * Por defecto lee bd/BD_Simulada_Evaluaciones_Psicolaborales_AquaChile.xlsx
 * y escribe src/datos/bdSimulada.json.
 *
 * Cada fila de la hoja "Candidatos" genera un candidato, una solicitud y una evaluación.
 * El Excel no trae correo ni teléfono, por lo que se generan valores ficticios
 * deterministas (la app los exige como obligatorios).
 */
import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rutaExcel = path.resolve(
  process.argv[2] ?? path.join(raiz, 'bd', 'BD_Simulada_Evaluaciones_Psicolaborales_AquaChile.xlsx'),
);
const rutaSalida = path.join(raiz, 'src', 'datos', 'bdSimulada.json');

/** Columnas de la hoja "Candidatos" (encabezado exacto del Excel). */
const COLUMNAS = {
  numero: 'N°',
  tipoEvaluacion: 'EV IN - EX',
  reclutador: 'Reclutador/a',
  nombre: 'Nombre del Candidato/a',
  origen: 'Origen del Candidato/a',
  familiaCargo: 'Familia del Cargo',
  cargo: 'Nombre del Cargo',
  ubicacion: 'Ubicación del cargo',
  unidad: 'Unidad',
  requiereReferencias: 'Requiere Referencias',
  ceco: 'CECO',
  cv: 'Adjuntar CV',
  descriptorCargo: 'Adjuntar Descriptor de Cargo',
  aspectosIndagar: 'Aspectos a indagar',
  referencias: 'Referencias (solo para externos)',
  fechaPeticion: 'Fecha de petición',
  fechaEntrevista: 'Fecha entrevista',
  fechaInforme: 'Fecha de envío informe',
  categoria: 'Categoría del evaluado',
};

const texto = (valor) => {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object' && 'richText' in valor) {
    return valor.richText.map((parte) => parte.text).join('').trim();
  }
  return String(valor).trim();
};

const fechaIso = (valor) => (valor instanceof Date ? valor.toISOString().slice(0, 10) : '');

const formatoChileno = (iso) => iso.split('-').reverse().join('-');

const sinTildes = (valor) =>
  valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Días hábiles (lunes a viernes) transcurridos entre dos fechas ISO. */
function diasHabiles(desde, hasta) {
  if (!desde || !hasta) return null;
  const actual = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  let dias = 0;
  while (actual < fin) {
    actual.setUTCDate(actual.getUTCDate() + 1);
    const diaSemana = actual.getUTCDay();
    if (diaSemana !== 0 && diaSemana !== 6) dias += 1;
  }
  return dias;
}

function crearGeneradorCorreos() {
  const usados = new Map();
  return (nombreCompleto) => {
    const [nombre, apellido = 'candidato'] = sinTildes(nombreCompleto).split(/\s+/);
    const base = `${nombre}.${apellido}`.replace(/[^a-z.]/g, '');
    const repeticiones = usados.get(base) ?? 0;
    usados.set(base, repeticiones + 1);
    return `${base}${repeticiones ? repeticiones + 1 : ''}@correo.cl`;
  };
}

const telefonoFicticio = (id) => `+569${String(10000000 + ((id * 7919) % 89999999)).padStart(8, '0')}`;

async function main() {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(rutaExcel);
  const hoja = libro.getWorksheet('Candidatos');
  if (!hoja) throw new Error('El Excel no tiene la hoja "Candidatos".');

  const indices = {};
  hoja.getRow(1).eachCell((celda, columna) => {
    const encabezado = texto(celda.value);
    Object.entries(COLUMNAS).forEach(([clave, nombre]) => {
      if (encabezado.startsWith(nombre)) indices[clave] = columna;
    });
  });
  const faltantes = Object.keys(COLUMNAS).filter((clave) => !indices[clave]);
  if (faltantes.length) throw new Error(`Faltan columnas en el Excel: ${faltantes.join(', ')}`);

  const correoPara = crearGeneradorCorreos();
  const candidatos = [];
  const solicitudes = [];
  const evaluaciones = [];

  hoja.eachRow((fila, numeroFila) => {
    if (numeroFila === 1) return;
    const valor = (clave) => fila.getCell(indices[clave]).value;
    const id = Number(valor('numero'));
    const nombre = texto(valor('nombre'));
    if (!id || !nombre) return;

    const fechaSolicitud = fechaIso(valor('fechaPeticion'));
    const fechaEvaluacion = fechaIso(valor('fechaEntrevista'));
    const fechaInforme = fechaIso(valor('fechaInforme'));
    const resultado = texto(valor('categoria'));
    const referencias = texto(valor('referencias'));
    const diasRespuesta = diasHabiles(fechaSolicitud, fechaInforme);

    candidatos.push({
      id,
      nombre,
      correo: correoPara(nombre),
      telefono: telefonoFicticio(id),
      cargo: texto(valor('cargo')),
      familiaCargo: texto(valor('familiaCargo')),
      origen: texto(valor('origen')),
    });

    solicitudes.push({
      id,
      candidatoId: id,
      cargo: texto(valor('cargo')),
      familiaCargo: texto(valor('familiaCargo')),
      fechaSolicitud,
      estado: resultado ? 'Finalizada' : fechaEvaluacion ? 'En proceso' : 'Pendiente',
      profesionalResponsable: texto(valor('reclutador')),
      observaciones: texto(valor('aspectosIndagar')),
      tipoEvaluacion: texto(valor('tipoEvaluacion')),
      ubicacion: texto(valor('ubicacion')),
      unidad: texto(valor('unidad')),
      ceco: texto(valor('ceco')),
      requiereReferencias: texto(valor('requiereReferencias')) === 'Sí',
      cv: texto(valor('cv')),
      descriptorCargo: texto(valor('descriptorCargo')),
    });

    if (fechaEvaluacion) {
      const detalle = [
        fechaInforme
          ? `Informe enviado el ${formatoChileno(fechaInforme)} (${diasRespuesta} días hábiles desde la petición).`
          : 'Informe pendiente de envío.',
        referencias ? `Resultado de referencias: ${referencias.toLowerCase()}.` : '',
      ];
      evaluaciones.push({
        id,
        solicitudId: id,
        fechaEvaluacion,
        resultado,
        observaciones: detalle.filter(Boolean).join(' '),
        estado: resultado ? 'Realizada' : 'Pendiente',
        fechaInforme,
        diasRespuesta,
      });
    }
  });

  await writeFile(
    rutaSalida,
    `${JSON.stringify({ candidatos, solicitudes, evaluaciones }, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `BD simulada importada: ${candidatos.length} candidatos, ${solicitudes.length} solicitudes, ` +
      `${evaluaciones.length} evaluaciones -> ${path.relative(raiz, rutaSalida)}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
