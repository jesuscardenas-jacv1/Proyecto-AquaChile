/**
 * Plantillas de los correos de aviso. Solo llevan datos del proceso (número, candidato,
 * cargo y enlace): nunca notas clínicas ni resultados de la evaluación.
 */
const COLORES = { noche: '#0e1a22', acento: '#fe5000', acentoBoton: '#b83a00', texto: '#10202a', suave: '#3b4b57', fondo: '#e2eaef' };

const escapar = (valor) =>
  String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** URL pública del frontend (sin barra final). */
const urlApp = () => (process.env.APP_URL || 'http://localhost:5173').trim().replace(/\/+$/, '');

const PIE_INTERNO =
  'Aviso automático del sistema de evaluaciones psicolaborales (proyecto académico DSY1104, datos ficticios). No respondas a este correo.';

/**
 * Correo de aviso genérico.
 * @param {{ saludo: string, titulo: string, intro: string, filas: [string, string][],
 *   boton?: { texto: string, enlace: string } | null, cierre?: string, pie?: string }} datos
 *   `boton.enlace` es una ruta de la app (se le antepone APP_URL).
 */
function plantillaAviso({ saludo, titulo, intro, filas, boton = null, cierre = '', pie = PIE_INTERNO }) {
  const url = boton ? `${urlApp()}${boton.enlace}` : '';
  const filasHtml = filas
    .map(
      ([etiqueta, valor]) =>
        `<tr><td style="padding:6px 0;color:${COLORES.suave};font-size:13px;width:120px">${escapar(etiqueta)}</td>` +
        `<td style="padding:6px 0;color:${COLORES.texto};font-size:14px;font-weight:600">${escapar(valor)}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:${COLORES.fondo};font-family:'Open Sans','Segoe UI',Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORES.fondo};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:${COLORES.noche};padding:18px 24px;border-bottom:4px solid ${COLORES.acento}">
<span style="color:#ffffff;font-family:Montserrat,Arial,sans-serif;font-weight:700;font-size:18px;letter-spacing:1px">AQUACHILE</span><br>
<span style="color:#b6c9dc;font-size:11px;letter-spacing:2px">GESTIÓN PSICOLABORAL</span>
</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 6px;color:${COLORES.suave};font-size:14px">${escapar(saludo)}</p>
<h1 style="margin:0 0 12px;color:${COLORES.texto};font-family:Montserrat,Arial,sans-serif;font-size:20px">${escapar(titulo)}</h1>
<p style="margin:0 0 16px;color:${COLORES.texto};font-size:14px;line-height:1.5">${escapar(intro)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px">${filasHtml}</table>
${cierre ? `<p style="margin:0 0 16px;color:${COLORES.texto};font-size:14px;line-height:1.5">${escapar(cierre)}</p>` : ''}
${boton ? `<a href="${escapar(url)}" style="display:inline-block;background:${COLORES.acentoBoton};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:8px">${escapar(boton.texto)}</a>` : ''}
</td></tr>
<tr><td style="padding:14px 24px;background:#f2f6f8;color:${COLORES.suave};font-size:12px;line-height:1.5">
${escapar(pie)}
</td></tr>
</table></td></tr></table></body></html>`;

  const texto = [
    saludo,
    '',
    titulo,
    intro,
    '',
    ...filas.map(([e, v]) => `${e}: ${v}`),
    ...(cierre ? ['', cierre] : []),
    ...(boton ? ['', `${boton.texto}: ${url}`] : []),
    '',
    pie,
  ].join('\n');
  return { html, texto };
}

/** Datos comunes de una solicitud para el correo. */
const filasSolicitud = ({ id, candidato, cargo }) => [
  ['Solicitud', `#${id}`],
  ['Candidato/a', candidato],
  ['Cargo', cargo],
];

function correoSolicitudNueva(solicitud, nombreDestinatario) {
  return {
    asunto: `Nueva solicitud #${solicitud.id} · ${solicitud.cargo}`,
    ...plantillaAviso({
      saludo: `Hola, ${nombreDestinatario}:`,
      titulo: 'Tienes una nueva solicitud de evaluación',
      intro: 'Se registró una solicitud de evaluación psicolaboral que requiere tu gestión.',
      filas: filasSolicitud(solicitud),
      boton: { texto: 'Ver solicitud', enlace: `/solicitudes/${solicitud.id}` },
    }),
  };
}

function correoAsignacion(solicitud, nombreDestinatario) {
  return {
    asunto: `Te asignaron la solicitud #${solicitud.id} · ${solicitud.cargo}`,
    ...plantillaAviso({
      saludo: `Hola, ${nombreDestinatario}:`,
      titulo: 'Te asignaron una solicitud',
      intro: 'Quedaste como psicóloga responsable de esta solicitud de evaluación.',
      filas: filasSolicitud(solicitud),
      boton: { texto: 'Ver solicitud', enlace: `/solicitudes/${solicitud.id}` },
    }),
  };
}

/** Fecha yyyy-mm-dd como dd-mm-aaaa. */
const fechaChilena = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso ?? '') ? iso.slice(0, 10).split('-').reverse().join('-') : iso);

/**
 * Confirmación al postulante: desde el portal (con la oferta) o registrado a mano por el analista.
 * Sin datos internos (ids, analistas, notas) y sin enlace a la app interna: el postulante no tiene sesión.
 * @param {{ nombre: string, cargo: string, oferta?: string, fecha: string, origen: 'portal' | 'manual' }} datos
 */
function correoConfirmacionPostulacion({ nombre, cargo, oferta, fecha, origen }) {
  const filas = [['Cargo', cargo]];
  if (oferta && oferta !== cargo) filas.push(['Oferta', oferta]);
  filas.push(['Fecha', fechaChilena(fecha)]);
  return {
    asunto: `Recibimos tu postulación · ${cargo}`,
    ...plantillaAviso({
      saludo: `Hola, ${nombre}:`,
      titulo: origen === 'portal' ? 'Recibimos tu postulación' : 'Registramos tu postulación',
      intro:
        origen === 'portal'
          ? 'Gracias por postular a AquaChile. Tu postulación y tu currículum quedaron registrados correctamente.'
          : 'El equipo de Reclutamiento y Selección de AquaChile registró tu postulación para el siguiente cargo.',
      filas,
      cierre:
        'Nuestro equipo revisará tu postulación. Si avanzas a la siguiente etapa, te contactaremos por este medio o por teléfono.',
      boton: origen === 'portal' ? { texto: 'Ver otras ofertas', enlace: '/trabaja-con-nosotros' } : null,
      pie: 'Correo automático: no respondas a este mensaje. Tus datos se usan solo para este proceso de selección (proyecto académico DSY1104).',
    }),
  };
}

module.exports = { correoAsignacion, correoConfirmacionPostulacion, correoSolicitudNueva, plantillaAviso, urlApp };
