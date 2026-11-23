/**
 * Herramientas de Marea sobre la base de conocimiento: buscar candidatos, ver un perfil, la actividad
 * reciente y los conteos. Deterministas, como las demás: reciben parámetros y consultan con SQL.
 * Nunca recomiendan ni descartan. La jefatura solo ve números.
 *
 * Reciben por parámetro las piezas comunes de herramientas.js (así no se importan en círculo).
 */
const { AGRUPACIONES, buscarCandidatos, cobertura, contar, hayFiltros, listarEventos } = require('../conocimiento/consultas');
const { obtenerPerfil } = require('../conocimiento/perfiles');
const { frase } = require('./frases');
const { nombresEnTexto } = require('./identidad');
const db = require('../bd/conexion');

const MAXIMO_OPCIONES = 3;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** "de Puerto Montt, con Power BI y SQL": cómo se lee lo que se buscó. */
function descripcionFiltros({ ciudad, habilidades, cargo, estado, desde, textoLibre }) {
  return [
    ciudad && `de ${ciudad}`,
    habilidades.length && `con ${habilidades.join(' y ')}`,
    cargo && `para ${cargo}`,
    estado && `en estado ${estado}`,
    desde && `desde el ${desde.split('-').reverse().join('-')}`,
    textoLibre && `con "${textoLibre.replace(/["*]/g, '')}" en su CV`,
  ]
    .filter(Boolean)
    .join(', ');
}

const conFiltros = (p) => Boolean(p.ciudad || p.habilidades?.length || p.cargo || p.estado || p.desde || p.textoLibre);

/** Cargo real nombrado en el texto. Si lo propuso la IA o un botón y no calza con ninguno, se busca tal cual. */
function resolverCargo({ parametros, mensaje }) {
  if (!parametros.cargo) return '';
  const cargos = db.prepare("SELECT cargo FROM ofertas UNION SELECT cargo FROM solicitudes").all().map((f) => f.cargo);
  return nombresEnTexto(cargos, parametros.cargo)[0] ?? (parametros.cargo === mensaje ? '' : parametros.cargo);
}

function crearHerramientas({ respuesta, opcion, identificar, focoDe, analisisDePersona, porcentajeDe }) {
  const EJEMPLOS = 'Por ejemplo: "¿quiénes son de Puerto Montt y saben Power BI?" o "candidatos con licencia clase B".';

  /** % del análisis de CV ya hecho (el más reciente con %), o null. */
  const porcentaje = (persona) => analisisDePersona(persona, persona.postulacionId).map(porcentajeDe).find(Number.isFinite) ?? null;

  function buscar(ctx) {
    const { usuario } = ctx;
    const parametros = { ...ctx.parametros, cargo: resolverCargo(ctx) };
    const resultado = buscarCandidatos(usuario, parametros);
    if (!hayFiltros(resultado.filtros)) return respuesta({ texto: `¿Qué buscas? Dime una ciudad, una habilidad o un cargo.\n${EJEMPLOS}` });

    const que = descripcionFiltros(resultado.filtros);
    if (!resultado.total) {
      const parciales = resultado.parciales.map((p) => `${p.total} ${p.etiqueta}`).join(', ');
      const { sinPerfil } = cobertura(usuario);
      return respuesta({
        texto: [
          `${frase(usuario.id, 'sinCandidatos')} (${que})`,
          resultado.parciales.length > 1 && `Por separado: ${parciales}.`,
          resultado.filtros.habilidades.length > 0 && sinPerfil > 0 && `Ojo: ${plural(sinPerfil, 'postulante aún no tiene', 'postulantes aún no tienen')} su CV leído.`,
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }

    const encabezado = `${plural(resultado.total, 'persona', 'personas')} ${que}.`;
    if (usuario.rol === 'jefatura') return respuesta({ texto: `${encabezado}\nFuente: Base de conocimiento` });
    return respuesta({
      texto: `${frase(usuario.id, 'candidatos')} ${encabezado}\nFuente: CV y postulaciones`,
      tarjetas: [
        {
          tipo: 'candidatos',
          titulo: `Personas ${que}`,
          total: resultado.total,
          candidatos: resultado.candidatos.map((c) => ({ ...c, porcentaje: porcentaje(c) })),
          nota: 'La decisión es tuya.',
        },
      ],
      opciones: resultado.candidatos
        .filter((c) => c.conPerfil)
        .slice(0, MAXIMO_OPCIONES)
        .map((c) => opcion(`Perfil de ${c.nombre.split(' ')[0]}`, { tipo: 'perfil_candidato', candidatoId: c.candidatoId })),
    });
  }

  function verPerfil(ctx) {
    const identificada = identificar(ctx, { tipo: 'perfil_candidato' });
    if (identificada.respuesta) return identificada.respuesta;
    const { persona } = identificada;
    const foco = focoDe(persona, persona.verificado);
    const perfil = obtenerPerfil(persona.candidatoId);
    if (!perfil) {
      return respuesta({
        texto: `${frase(ctx.usuario.id, 'sinPerfil', { nombre: persona.nombre })}`,
        opciones: [opcion('Análisis completo', { tipo: 'analizar_candidato', candidatoId: persona.candidatoId })],
        foco,
      });
    }
    return respuesta({
      texto: `${frase(ctx.usuario.id, 'perfil', { nombre: persona.nombre.split(' ')[0] })}\nFuente: CV`,
      tarjetas: [
        {
          tipo: 'perfil',
          nombre: persona.nombre,
          ciudad: perfil.ciudad,
          aniosExperiencia: perfil.aniosExperiencia,
          resumen: perfil.resumen,
          habilidades: perfil.habilidades,
          experiencia: perfil.experiencia.slice(0, 4).map(({ cargo, empresa, desde, hasta }) => ({ cargo, empresa, desde, hasta })),
          formacion: perfil.formacion.slice(0, 4).map(({ titulo, institucion, estado }) => ({ titulo, institucion, estado })),
          idiomas: perfil.idiomas,
          demostracion: perfil.modelo === 'demostración',
          nota: 'Extraído del CV: confírmalo en la entrevista.',
        },
      ],
      opciones: [opcion('Análisis completo', { tipo: 'analizar_candidato', candidatoId: persona.candidatoId })],
      foco,
    });
  }

  function actividad(ctx) {
    const { usuario, parametros } = ctx;
    const eventos = listarEventos(usuario, { desde: parametros.desde, tipo: parametros.tipoEvento });
    if (!eventos.length) return respuesta({ texto: frase(usuario.id, 'sinActividad') });
    return respuesta({
      texto: `${frase(usuario.id, 'actividad')}\nFuente: Historial de la plataforma`,
      tarjetas: [{ tipo: 'actividad', titulo: 'Actividad reciente', eventos }],
    });
  }

  function estadisticas(ctx) {
    const { usuario } = ctx;
    const parametros = { ...ctx.parametros, cargo: resolverCargo(ctx) };
    const agruparPor = AGRUPACIONES.includes(parametros.agruparPor) ? parametros.agruparPor : '';
    const { filtros, total, grupos } = contar(usuario, parametros, { agruparPor: agruparPor || (conFiltros(parametros) ? '' : 'ciudad') });
    const que = descripcionFiltros(filtros);
    const etiqueta = `${plural(total, 'persona', 'personas')}${que ? ` ${que}` : ' en total'}.`;
    const opciones = ['ciudad', 'habilidad', 'cargo', 'estado']
      .filter((grupo) => grupo !== (agruparPor || 'ciudad'))
      .slice(0, MAXIMO_OPCIONES)
      .map((grupo) => opcion(`Por ${grupo}`, { tipo: 'estadisticas', agruparPor: grupo, ciudad: filtros.ciudad, habilidades: filtros.habilidades, cargo: filtros.cargo }));
    return respuesta({
      texto: `${etiqueta}\nFuente: Base de conocimiento`,
      tarjetas: grupos.length ? [{ tipo: 'conteo', titulo: `Personas por ${agruparPor || 'ciudad'}`, total, grupos }] : [],
      opciones,
    });
  }

  return {
    buscar_candidatos: { roles: ['analista', 'evaluador', 'jefatura'], nombre: 'Buscar candidatos', ejecutar: buscar },
    perfil_candidato: { roles: ['analista', 'evaluador'], nombre: 'Perfil de un candidato', ejecutar: verPerfil },
    actividad_reciente: { roles: ['analista', 'evaluador', 'jefatura'], nombre: 'Actividad reciente', ejecutar: actividad },
    estadisticas: { roles: ['analista', 'evaluador', 'jefatura'], nombre: 'Conteos de candidatos', ejecutar: estadisticas },
  };
}

module.exports = { crearHerramientas, descripcionFiltros };
