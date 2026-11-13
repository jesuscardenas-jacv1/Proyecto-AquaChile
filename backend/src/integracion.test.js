/**
 * Pruebas de la API que usa el frontend integrado (Hito 2): ofertas y postulaciones,
 * solicitudes con reclutador, psicóloga responsable, etapas del Planner y filtros.
 * Requiere la BD migrada y sembrada; al final restablece los datos de demostración.
 * Ejecutar con: npm run test:integracion
 */
const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const app = require('./servidor');
const { JWT_SECRETO } = require('./middlewares/auth');
const { establecerAlmacenamiento } = require('./almacenamiento');
const { AlmacenamientoLocal } = require('./almacenamiento/local');
const { establecerClienteIa } = require('./ia/cliente');
const { establecerReuniones } = require('./reuniones');
const { establecerTranscriptor } = require('./ia/voz');

describe('API integrada (Hito 2)', () => {
  let servidor;
  let base;
  let raizDocumentos;
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

  before(async () => {
    // Las carpetas de documentos se crean en una carpeta temporal, no en backend/documentos.
    raizDocumentos = await fs.mkdtemp(path.join(os.tmpdir(), 'aquachile-integracion-'));
    establecerAlmacenamiento(new AlmacenamientoLocal({ raiz: raizDocumentos }));
    // Nunca se llama al Google Calendar real: sin proveedor salvo en las pruebas de reuniones.
    establecerReuniones({ motivos: { google: 'Google Meet no está configurado en las pruebas.' } });
    servidor = app.listen(0);
    base = `http://localhost:${servidor.address().port}/api`;
  });

  after(async () => {
    await pedir('/admin/reiniciar', { rol: 'admin', metodo: 'POST' });
    servidor.close();
    establecerAlmacenamiento(null);
    establecerReuniones(null);
    await fs.rm(raizDocumentos, { recursive: true, force: true });
  });

  describe('ayudas de IA (con un cliente simulado, sin costo)', () => {
    const llamadas = [];
    let respuesta;
    const cliente = {
      beta: {
        messages: {
          create: async (solicitud) => {
            llamadas.push(solicitud);
            return { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(respuesta) }] };
          },
        },
      },
    };
    const analisis = {
      resumen: 'Técnico con experiencia en plantas de proceso.',
      // Un criterio por requisito de la oferta 1 (Monitor Producción), en el mismo orden.
      criterios: [
        { requisito: 'Técnico de nivel medio', tipo: 'deseable', nivel: 'cumple', evidencia: 'Técnico en procesos industriales' },
        { requisito: 'Experiencia en plantas', tipo: 'obligatorio', nivel: 'parcial', evidencia: '1 año en planta' },
        { requisito: 'Turnos', tipo: 'obligatorio', nivel: 'no-evaluable', evidencia: 'El CV no lo indica' },
      ],
      preguntasSugeridas: ['¿Ha operado grúa horquilla?'],
      alertas: [],
    };

    afterEach(() => establecerClienteIa(null));

    it('sin clave la IA no está disponible y sus acciones responden 503', async () => {
      assert.equal((await pedir('/ia/estado')).status, 401);
      const estado = await pedir('/ia/estado', { rol: 'analista' });
      assert.deepEqual([estado.status, estado.datos.disponible], [200, false]);
      assert.equal((await pedir('/ia/postulaciones/1/analisis', { rol: 'analista', metodo: 'POST' })).status, 503);
      assert.equal((await pedir('/ia/redactar-oferta', { rol: 'analista', metodo: 'POST', cuerpo: { cargo: 'Gruero' } })).status, 503);
    });

    it('analiza el CV de una postulación contra el descriptor de su cargo y guarda el resultado', async () => {
      establecerClienteIa(cliente);
      respuesta = analisis;
      const creada = await pedir('/postulaciones', {
        metodo: 'POST',
        cuerpo: {
          ofertaId: 1,
          nombre: 'Postulante IA',
          correo: `ia.${Date.now()}@correo.cl`,
          telefono: '+56933334444',
          ciudad: 'Calbuco',
          origen: 'Externo',
          consentimiento: true,
          cvNombre: 'cv-ia.pdf',
        },
      });
      const id = creada.datos.postulacion.id;
      const ruta = `/ia/postulaciones/${id}/analisis`;

      assert.equal((await pedir(ruta, { rol: 'analista', metodo: 'POST' })).status, 404, 'sin CV no hay análisis');
      await fetch(`${base}/postulaciones/${id}/cv?nombre=cv-ia.pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf', 'X-Candidato': encodeURIComponent('Postulante IA') },
        body: Buffer.from('%PDF-1.4 CV de prueba IA'),
      });

      assert.equal((await pedir(ruta, { rol: 'jefatura', metodo: 'POST' })).status, 403);
      assert.equal((await pedir(ruta, { rol: 'analista' })).status, 404, 'aún no hay análisis guardado');
      llamadas.length = 0;
      const hecho = await pedir(ruta, { rol: 'analista', metodo: 'POST' });
      assert.equal(hecho.status, 201);
      const { resultado } = hecho.datos.analisis;
      assert.equal(resultado.resumen, analisis.resumen);
      // Los requisitos los pone la oferta (texto y tipo); la IA solo aporta nivel y evidencia.
      assert.deepEqual(
        resultado.criterios.map((c) => [c.requisito, c.tipo, c.nivel]),
        [
          ['Técnico de nivel medio o superior', 'obligatorio', 'cumple'],
          ['2 años de experiencia en plantas de proceso', 'obligatorio', 'parcial'],
          ['Disponibilidad para turnos rotativos', 'obligatorio', 'no-evaluable'],
        ],
      );
      // (2×1 + 2×0,5) / (2 + 2) = 75 %; el no evaluable queda fuera del cálculo.
      assert.deepEqual(
        [resultado.cumplimiento.porcentaje, resultado.cumplimiento.evaluados, resultado.cumplimiento.fuente],
        [75, 2, 'oferta'],
      );
      assert.match(llamadas[0].messages[0].content.at(-1).text, /1\. Técnico de nivel medio o superior/);
      // La oferta 1 es de Monitor Producción: se usa su descriptor de demostración.
      assert.equal(hecho.datos.analisis.descriptor, 'DC_Monitor_Produccion.pdf');
      const documentos = llamadas[0].messages[0].content.filter((bloque) => bloque.type === 'document');
      assert.deepEqual(documentos.map((bloque) => bloque.title), ['CV del postulante', 'Descriptor del cargo']);

      const guardado = await pedir(ruta, { rol: 'jefatura' });
      assert.deepEqual([guardado.status, guardado.datos.analisis.resultado.resumen], [200, analisis.resumen]);
      assert.equal((await pedir(ruta, { rol: 'evaluador' })).status, 403);

      // Al pasar a evaluación, la psicóloga ve el análisis desde la solicitud (solo lectura).
      const sinAnalisis = await pedir('/ia/solicitudes/1/analisis', { rol: 'evaluador' });
      assert.equal(sinAnalisis.status, 404);
      const pasada = await pedir(`/postulaciones/${id}`, {
        rol: 'analista',
        metodo: 'PATCH',
        cuerpo: { estado: 'En evaluación', solicitudId: 1 },
      });
      assert.equal(pasada.status, 200);
      const paraPsicologa = await pedir('/ia/solicitudes/1/analisis', { rol: 'evaluador' });
      assert.deepEqual(
        [paraPsicologa.status, paraPsicologa.datos.analisis.postulacionId, paraPsicologa.datos.analisis.resultado.cumplimiento.porcentaje],
        [200, id, 75],
      );
      assert.equal((await pedir('/ia/solicitudes/1/analisis', { rol: 'jefatura' })).status, 200);
      assert.equal((await pedir('/ia/solicitudes/1/analisis')).status, 401);
    });

    it('registra el consumo de cada llamada y el administrador lo ve en /admin/uso-ia', async () => {
      const db = require('./bd/conexion');
      establecerClienteIa({
        beta: {
          messages: {
            create: async () => ({
              model: 'claude-opus-5-5',
              stop_reason: 'end_turn',
              usage: { input_tokens: 10000, output_tokens: 2000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
              content: [{ type: 'text', text: JSON.stringify({ titulo: 'Gruero - Calbuco', descripcion: 'Texto', requisitos: ['Licencia'] }) }],
            }),
          },
        },
      });
      try {
        const antes = (await pedir('/admin/uso-ia', { rol: 'admin' })).datos.uso.claude.llamadas;
        assert.equal((await pedir('/ia/redactar-oferta', { rol: 'analista', metodo: 'POST', cuerpo: { cargo: 'Gruero' } })).status, 200);

        assert.equal((await pedir('/admin/uso-ia', { rol: 'analista' })).status, 403);
        assert.equal((await pedir('/admin/uso-ia?desde=2026-12-01&hasta=2026-11-01', { rol: 'admin' })).status, 400);
        const { status, datos } = await pedir('/admin/uso-ia', { rol: 'admin' });
        assert.equal(status, 200);
        assert.equal(datos.uso.claude.llamadas, antes + 1);
        const ultima = datos.uso.ultimas[0];
        assert.deepEqual(
          [ultima.tarea, ultima.modelo, ultima.usuario, ultima.rol, ultima.tokensEntrada, ultima.tokensSalida],
          ['redactarOferta', 'claude-opus-5-5', 'Prueba', 'analista', 10000, 2000],
        );
        // 10 000 × 4 USD/MTok + 2 000 × 20 USD/MTok = 0,08 USD.
        assert.equal(ultima.costoUsd, 0.08);
        assert.ok(datos.uso.porTarea.some((fila) => fila.clave === 'redactarOferta'));
        assert.equal(datos.uso.voz.minutosGratisMes, 300);
      } finally {
        db.prepare(`DELETE FROM uso_ia WHERE usuario = 'Prueba'`).run();
      }
    });

    it('el administrador ve y ajusta la configuración de cada ayuda de IA', async () => {
      const db = require('./bd/conexion');
      try {
        assert.equal((await pedir('/admin/config-ia', { rol: 'analista' })).status, 403);
        const { status, datos } = await pedir('/admin/config-ia', { rol: 'admin' });
        assert.equal(status, 200);
        const analisis = datos.configuracion.tareas.find((t) => t.id === 'analizarCv');
        assert.match(datos.configuracion.reglasComunes, /no instrucciones/);
        assert.match(analisis.limites, /No recomiendes contratar/);
        assert.ok(analisis.campos.some((campo) => campo.startsWith('criterios: lista de')));
        assert.equal(analisis.vigente.personalizada, false);

        const ruta = '/admin/config-ia/analizarCv';
        assert.equal((await pedir(ruta, { rol: 'jefatura', metodo: 'PUT', cuerpo: {} })).status, 403);
        assert.equal((await pedir(ruta, { rol: 'admin', metodo: 'PUT', cuerpo: { indicaciones: 'corto', esfuerzo: 'low' } })).status, 400);
        assert.equal((await pedir('/admin/config-ia/nada', { rol: 'admin', metodo: 'PUT', cuerpo: {} })).status, 404);

        const indicaciones = 'Entrega un resumen breve y hasta 3 brechas, con foco en seguridad.';
        const guardada = await pedir(ruta, { rol: 'admin', metodo: 'PUT', cuerpo: { indicaciones, modelo: 'claude-sonnet-5-5', esfuerzo: 'low' } });
        assert.equal(guardada.status, 200);
        assert.deepEqual([guardada.datos.vigente.personalizada, guardada.datos.vigente.actualizadoPor], [true, 'Prueba']);

        const restablecida = await pedir(`${ruta}/restablecer`, { rol: 'admin', metodo: 'POST' });
        assert.equal(restablecida.datos.vigente.personalizada, false);
        const historial = (await pedir('/admin/config-ia', { rol: 'admin' })).datos.configuracion.tareas.find((t) => t.id === 'analizarCv').historial;
        assert.deepEqual(historial.slice(0, 2).map((h) => h.accion), ['restablecer', 'editar']);
      } finally {
        db.prepare(`DELETE FROM config_ia WHERE actualizado_por = 'Prueba'`).run();
        db.prepare(`DELETE FROM config_ia_historial WHERE usuario = 'Prueba'`).run();
      }
    });

    it('extrae los datos de contacto de un CV sin guardarlo', async () => {
      establecerClienteIa(cliente);
      respuesta = { nombre: 'Ana Pérez', correo: 'ana@correo.cl', telefono: '+56911112222', ciudad: 'Osorno', resumen: 'Operaria.' };
      const enviar = (rol, nombre) =>
        fetch(`${base}/ia/extraer-cv?nombre=${nombre}`, {
          method: 'POST',
          headers: { ...cabeceras(rol), 'Content-Type': 'application/pdf' },
          body: Buffer.from('%PDF-1.4 CV'),
        });
      assert.equal((await enviar('evaluador', 'cv.pdf')).status, 403);
      assert.equal((await enviar('analista', 'cv.doc')).status, 415);
      const extraido = await enviar('analista', 'cv.pdf');
      assert.equal(extraido.status, 200);
      assert.deepEqual((await extraido.json()).datos, respuesta);
    });

    it('propone un borrador de la evaluación desde las notas de la psicóloga, sin guardarlas', async () => {
      establecerClienteIa(cliente);
      const largo = 'x'.repeat(900);
      respuesta = {
        competencias: [
          { competencia: 'Trabajo en equipo', nivel: 'Esperado', fortalezas: largo, oportunidades: 'Delegar más.', evidencia: 'Coordina el turno.' },
          { competencia: 'Trabajo en equipo', nivel: 'Esperado', fortalezas: 'Repetida', oportunidades: '', evidencia: '' },
        ],
        observaciones: 'Persona colaborativa y ordenada.',
        resultadoSugerido: 'Recomendado',
        fundamento: 'Evidencia consistente con el cargo.',
        faltantes: ['Liderazgo'],
      };
      const ruta = '/ia/solicitudes/2/borrador-evaluacion';
      const notas = 'Entrevista: coordina el turno con su equipo, ordena tareas y responde con calma ante fallas.';

      assert.equal((await pedir(ruta, { rol: 'analista', metodo: 'POST', cuerpo: { notas } })).status, 403);
      assert.equal((await pedir(ruta, { rol: 'evaluador', metodo: 'POST', cuerpo: { notas: 'muy corto' } })).status, 400);
      assert.equal((await pedir('/ia/solicitudes/99999/borrador-evaluacion', { rol: 'evaluador', metodo: 'POST', cuerpo: { notas } })).status, 404);

      const evaluacionAntes = (await pedir('/evaluaciones/solicitud/2', { rol: 'evaluador' })).datos;
      llamadas.length = 0;
      const borrador = await pedir(ruta, { rol: 'evaluador', metodo: 'POST', cuerpo: { notas } });
      assert.equal(borrador.status, 200);
      const { competencias, resultadoSugerido, faltantes } = borrador.datos.borrador;
      assert.equal(competencias.length, 1, 'sin competencias repetidas');
      assert.equal(competencias[0].fortalezas.length, 600, 'recortado al largo que acepta la evaluación');
      assert.equal(resultadoSugerido, 'Recomendado');
      assert.deepEqual(faltantes, ['Liderazgo']);

      const texto = llamadas[0].messages[0].content.at(-1).text;
      assert.match(texto, /coordina el turno con su equipo/);
      const esquema = llamadas[0].output_config.format.schema;
      assert.ok(esquema.properties.competencias.items.properties.competencia.enum.includes('Liderazgo'));
      // Las notas no quedan guardadas: la evaluación de la solicitud no cambia.
      assert.deepEqual((await pedir('/evaluaciones/solicitud/2', { rol: 'evaluador' })).datos, evaluacionAntes);
    });

    it('redacta una oferta a partir del descriptor del cargo', async () => {
      establecerClienteIa(cliente);
      respuesta = { titulo: 'Gruero - Calbuco', descripcion: 'Opera grúas.', requisitos: ['Licencia clase D'] };
      assert.equal((await pedir('/ia/redactar-oferta', { rol: 'analista', metodo: 'POST', cuerpo: {} })).status, 400);
      const redactada = await pedir('/ia/redactar-oferta', {
        rol: 'analista',
        metodo: 'POST',
        cuerpo: { cargo: 'Grúero', ubicacion: 'Calbuco' },
      });
      assert.equal(redactada.status, 200);
      assert.deepEqual(redactada.datos.oferta, respuesta);
      assert.equal(redactada.datos.descriptor, 'DC_Gruero.pdf');
    });

    describe('entrevista con IA: transcripción y notas', () => {
      const notas = {
        competencias: [
          { competencia: 'Trabajo en equipo', observacion: 'Coordina el turno con su equipo.', citas: ['yo coordino el turno con mi equipo'] },
          { competencia: 'Trabajo en equipo', observacion: 'Repetida', citas: [] },
        ],
        temasPendientes: ['Liderazgo: sin ejemplos.'],
        notas: 'Trabajo en equipo: coordina el turno ("yo coordino el turno con mi equipo").',
      };
      const azure = {
        durationMilliseconds: 9000,
        phrases: [
          { speaker: 1, offsetMilliseconds: 0, text: '¿Cómo trabaja con su equipo?' },
          { speaker: 2, offsetMilliseconds: 3000, text: 'Yo coordino el turno con mi equipo.' },
          { speaker: 2, offsetMilliseconds: 6000, text: 'Y reviso la seguridad cada mañana.' },
        ],
      };
      const subir = (ruta, rol, cuerpo, tipo) =>
        fetch(`${base}${ruta}`, {
          method: 'POST',
          headers: { Authorization: cabeceras(rol).Authorization, 'Content-Type': tipo },
          body: cuerpo,
        }).then(async (r) => ({ status: r.status, datos: await r.json().catch(() => ({})) }));
      const pautas = async (rol) =>
        (await pedir('/solicitudes/2/documentos', { rol })).datos.archivos?.filter((a) => a.categoria === 'pauta') ?? [];

      afterEach(() => establecerTranscriptor(null));

      it('el estado informa si la voz está disponible y sin ella el audio responde 503', async () => {
        const estado = await pedir('/ia/estado', { rol: 'evaluador' });
        assert.equal(estado.datos.voz, Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION));
        if (!estado.datos.voz) {
          const sinVoz = await subir('/ia/solicitudes/2/transcripcion/audio?consentimiento=si', 'evaluador', Buffer.from('a'), 'audio/webm');
          assert.equal(sinVoz.status, 503);
        }
        establecerTranscriptor(async () => azure);
        assert.equal((await pedir('/ia/estado', { rol: 'evaluador' })).datos.voz, true);
      });

      it('transcribe el audio con consentimiento, guarda la pauta confidencial y devuelve las notas', async () => {
        const recibidos = [];
        establecerTranscriptor(async (audio) => {
          recibidos.push(audio);
          if (audio.idioma === 'es-CL') throw Object.assign(new Error('locale'), { idiomaNoAdmitido: true });
          return azure;
        });
        establecerClienteIa(cliente);
        respuesta = notas;
        const ruta = '/ia/solicitudes/2/transcripcion/audio';
        const audio = Buffer.from('audio-ficticio');

        assert.equal((await subir(`${ruta}?consentimiento=si`, 'analista', audio, 'audio/webm')).status, 403);
        assert.equal((await subir(ruta, 'evaluador', audio, 'audio/webm')).status, 400, 'sin consentimiento no se transcribe');
        assert.equal((await subir(`${ruta}?consentimiento=si`, 'evaluador', audio, 'text/plain')).status, 415);
        assert.equal((await subir('/ia/solicitudes/99999/transcripcion/audio?consentimiento=si', 'evaluador', audio, 'audio/webm')).status, 404);

        llamadas.length = 0;
        const resultado = await subir(`${ruta}?consentimiento=si&origen=reunion`, 'evaluador', audio, 'audio/webm;codecs=opus');
        assert.equal(resultado.status, 201);
        assert.equal(resultado.datos.idioma, 'es-MX', 'si es-CL no está, prueba es-MX');
        assert.deepEqual(recibidos.map((r) => r.idioma), ['es-CL', 'es-MX']);
        assert.equal(recibidos.at(-1).contenido.toString(), 'audio-ficticio');
        assert.equal(resultado.datos.hablantes, 2);
        assert.match(resultado.datos.transcripcion, /\[00:00:03\] Hablante 2: Yo coordino el turno con mi equipo\. Y reviso/);
        assert.equal(resultado.datos.notas.competencias.length, 1, 'sin competencias repetidas');
        assert.deepEqual(resultado.datos.notas.temasPendientes, ['Liderazgo: sin ejemplos.']);
        assert.equal(resultado.datos.consentimiento.confirmadoPor, 'Prueba');
        assert.match(llamadas[0].messages[0].content[0].text, /<transcripcion_de_la_entrevista>[\s\S]*coordino el turno/);

        // La pauta queda en la carpeta: la ve la psicóloga, no el analista.
        const [pauta] = await pautas('evaluador');
        assert.match(pauta.nombre, /^Pauta - Transcripción entrevista .*\.txt$/);
        assert.equal((await pautas('analista')).length, 0);
        const descarga = await fetch(`${base}/solicitudes/2/documentos/${encodeURIComponent(pauta.id)}/contenido`, {
          headers: { Authorization: cabeceras('evaluador').Authorization },
        });
        const contenido = await descarga.text();
        assert.match(contenido, /Consentimiento: el postulante aceptó que se grabe la entrevista\. Lo confirmó Prueba/);
        assert.match(contenido, /El audio no se guardó/);
        assert.match(contenido, /NOTAS POR COMPETENCIA[\s\S]*TRANSCRIPCIÓN[\s\S]*Hablante 2/);
      });

      it('recibe una transcripción .vtt de Teams y la guarda aunque las notas fallen', async () => {
        establecerClienteIa({ beta: { messages: { create: async () => ({ stop_reason: 'refusal', content: [] }) } } });
        const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
<v Entrevistadora>¿Cómo enfrenta un cambio de turno imprevisto?</v>

2
00:00:05.000 --> 00:00:09.500
<v Postulante>Me organizo con mi jefatura y aviso al equipo con tiempo.</v>
`;
        const ruta = '/ia/solicitudes/2/transcripcion?consentimiento=si&nombre=reunion.vtt';
        assert.equal((await subir('/ia/solicitudes/2/transcripcion?consentimiento=si&nombre=x.pdf', 'evaluador', Buffer.from('%PDF'), 'application/pdf')).status, 415);
        const resultado = await subir(ruta, 'evaluador', Buffer.from(vtt), 'text/vtt');
        assert.equal(resultado.status, 201);
        assert.equal(
          resultado.datos.transcripcion,
          '[00:00:01] Entrevistadora: ¿Cómo enfrenta un cambio de turno imprevisto?\n\n[00:00:05] Postulante: Me organizo con mi jefatura y aviso al equipo con tiempo.',
        );
        assert.equal(resultado.datos.notas, null);
        assert.match(resultado.datos.errorNotas, /no puede procesar/);
        assert.ok((await pautas('evaluador')).length >= 1);
      });

      it('entrega la última transcripción guardada para usarla en el borrador, sin llamar a la IA', async () => {
        const llamadas = [];
        establecerClienteIa({ beta: { messages: { create: async (s) => llamadas.push(s) } } });
        const ruta = '/ia/solicitudes/2/transcripcion/ultima';
        assert.equal((await pedir(ruta)).status, 401);
        assert.equal((await pedir(ruta, { rol: 'analista' })).status, 403);
        assert.equal((await pedir('/ia/solicitudes/3/transcripcion/ultima', { rol: 'evaluador' })).status, 404);
        assert.equal((await pedir('/ia/solicitudes/99999/transcripcion/ultima', { rol: 'evaluador' })).status, 404);

        const ultima = await pedir(ruta, { rol: 'evaluador' });
        assert.equal(ultima.status, 200);
        // La última es la del .vtt, cuyas notas fallaron: trae la transcripción y no notas.
        assert.match(ultima.datos.transcripcion, /Me organizo con mi jefatura/);
        assert.equal(ultima.datos.notas, null);
        assert.match(ultima.datos.archivo.nombre, /^Pauta - Transcripción entrevista/);
        assert.equal(llamadas.length, 0, 'leer la pauta no llama a la IA');
      });
    });
  });

  it('publica las ofertas abiertas sin sesión', async () => {
    const { status, datos } = await pedir('/ofertas');
    assert.equal(status, 200);
    assert.equal(datos.ofertas.length, 8);
    assert.ok(Array.isArray(datos.ofertas[0].requisitos));
    assert.equal((await pedir('/ofertas/999')).status, 404);
  });

  it('registra una postulación pública y valida sus datos', async () => {
    const invalida = await pedir('/postulaciones', { metodo: 'POST', cuerpo: { ofertaId: 1, nombre: 'Al' } });
    assert.equal(invalida.status, 400);

    const valida = await pedir('/postulaciones', {
      metodo: 'POST',
      cuerpo: {
        ofertaId: 2,
        nombre: 'Postulante Integración',
        correo: `integracion.${Date.now()}@correo.cl`,
        telefono: '+56911112222',
        ciudad: 'Osorno',
        origen: 'Externo',
        consentimiento: true,
        cvNombre: 'cv.pdf',
      },
    });
    assert.equal(valida.status, 201);
    assert.deepEqual(Object.keys(valida.datos.postulacion), ['id']);
  });

  it('la bandeja de postulaciones es para analista y jefatura, no para el evaluador', async () => {
    assert.equal((await pedir('/postulaciones')).status, 401);
    assert.equal((await pedir('/postulaciones', { rol: 'evaluador' })).status, 403);
    const { status, datos } = await pedir('/postulaciones', { rol: 'jefatura' });
    assert.equal(status, 200);
    assert.ok(datos.postulaciones.length >= 8);
  });

  it('pasa una postulación a evaluación: crea la solicitud y la vincula', async () => {
    const nueva = await pedir('/solicitudes', {
      rol: 'analista',
      metodo: 'POST',
      cuerpo: {
        candidatoId: 201,
        cargo: 'Monitor Producción',
        familiaCargo: 'Técnico B C',
        fechaSolicitud: '2026-10-20',
        reclutador: 'Carolina Muñoz',
        referido: null,
      },
    });
    assert.equal(nueva.status, 201);
    assert.equal(nueva.datos.solicitud.reclutador, 'Carolina Muñoz');
    assert.equal(nueva.datos.solicitud.profesionalResponsable, '');
    assert.equal(nueva.datos.solicitud.etapa, 'recibida');
    assert.equal(nueva.datos.solicitud.referido, null);

    // Cada solicitud nace con su carpeta de documentos: "S0000 - Nombre del postulante".
    const id = nueva.datos.solicitud.id;
    const clave = `S${String(id).padStart(4, '0')}`;
    assert.equal(nueva.datos.avisoCarpeta, null);
    assert.match(nueva.datos.carpeta.nombre, new RegExp(`^${clave} - \\S`));
    assert.ok((await fs.readdir(raizDocumentos)).includes(nueva.datos.carpeta.nombre));
    const vinculada = await pedir('/postulaciones/1', {
      rol: 'analista',
      metodo: 'PATCH',
      cuerpo: { estado: 'En evaluación', solicitudId: id },
    });
    assert.equal(vinculada.status, 200);
    assert.deepEqual([vinculada.datos.postulacion.estado, vinculada.datos.postulacion.solicitudId], ['En evaluación', id]);

    assert.equal(
      (await pedir('/postulaciones/1', { rol: 'jefatura', metodo: 'PATCH', cuerpo: { estado: 'Descartada' } })).status,
      403,
    );
  });

  it('descarga el CV de una postulación solo con sesión de analista o jefatura', async () => {
    const nueva = await pedir('/postulaciones', {
      metodo: 'POST',
      cuerpo: {
        ofertaId: 1,
        nombre: 'Valentina Rojas Pérez',
        correo: 'valentina.cv@correo.cl',
        telefono: '+56911112222',
        ciudad: 'Puerto Montt',
        origen: 'Externo',
        consentimiento: true,
        cvNombre: 'cv-valentina.pdf',
      },
    });
    const id = nueva.datos.postulacion.id;
    assert.equal((await pedir(`/postulaciones/${id}/cv`, { rol: 'analista' })).status, 404);

    const subida = await fetch(`${base}/postulaciones/${id}/cv?nombre=cv-valentina.pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf', 'X-Candidato': encodeURIComponent('Valentina Rojas Pérez') },
      body: Buffer.from('%PDF-1.4 CV de prueba'),
    });
    assert.equal(subida.status, 201);

    assert.equal((await pedir(`/postulaciones/${id}/cv`)).status, 401);
    assert.equal((await pedir(`/postulaciones/${id}/cv`, { rol: 'evaluador' })).status, 403);
    const descarga = await fetch(`${base}/postulaciones/${id}/cv`, { headers: cabeceras('jefatura') });
    assert.equal(descarga.status, 200);
    assert.match(descarga.headers.get('content-disposition'), /cv-valentina\.pdf/);
    assert.equal(Buffer.from(await descarga.arrayBuffer()).toString(), '%PDF-1.4 CV de prueba');
    assert.equal((await pedir('/postulaciones/9999/cv', { rol: 'analista' })).status, 404);
  });

  it('el estado solo avanza en el Planner y la psicóloga no reasigna la responsable', async () => {
    const reasignar = await pedir('/solicitudes/101/estado', {
      rol: 'evaluador',
      metodo: 'PATCH',
      cuerpo: { profesionalResponsable: 'Tomás Riquelme Soto' },
    });
    assert.equal(reasignar.status, 403);
    for (const rol of ['evaluador', 'analista']) {
      for (const estado of ['En proceso', 'Finalizada']) {
        const cambio = await pedir('/solicitudes/101/estado', { rol, metodo: 'PATCH', cuerpo: { estado } });
        assert.equal(cambio.status, 409);
      }
    }
    const sinCambios = await pedir('/solicitudes/101', { rol: 'analista' });
    assert.equal(sinCambios.datos.solicitud.estado, 'Pendiente');

    // Tampoco se evalúa hasta que la entrevista esté realizada.
    const evaluarAntes = await pedir('/evaluaciones', {
      rol: 'evaluador',
      metodo: 'POST',
      cuerpo: { solicitudId: 101, resultado: 'Recomendado', observaciones: 'Prueba', fechaEvaluacion: '2026-12-01' },
    });
    assert.equal(evaluarAntes.status, 409);
  });

  it('cierra una solicitud sin evaluación con motivo y la reabre en su etapa', async () => {
    const agendar = await pedir('/solicitudes/102/etapa', {
      rol: 'evaluador',
      metodo: 'PATCH',
      cuerpo: { etapa: 'agendada', fechaEntrevista: '2026-12-01', horaEntrevista: '10:00', modalidadEntrevista: 'Teams' },
    });
    assert.equal(agendar.status, 200);

    const sinMotivo = await pedir('/solicitudes/102/cierre', { rol: 'evaluador', metodo: 'POST', cuerpo: { motivo: 'X' } });
    assert.equal(sinMotivo.status, 400);
    const otroSinComentario = await pedir('/solicitudes/102/cierre', { rol: 'evaluador', metodo: 'POST', cuerpo: { motivo: 'Otro' } });
    assert.equal(otroSinComentario.status, 400);
    assert.equal(
      (await pedir('/solicitudes/102/cierre', { rol: 'jefatura', metodo: 'POST', cuerpo: { motivo: 'Desistió del proceso' } })).status,
      403,
    );

    const cierre = await pedir('/solicitudes/102/cierre', {
      rol: 'evaluador',
      metodo: 'POST',
      cuerpo: { motivo: 'No se presentó a la entrevista', comentario: 'No respondió llamados.' },
    });
    assert.equal(cierre.status, 200);
    assert.equal(cierre.datos.solicitud.estado, 'Finalizada');
    assert.equal(cierre.datos.solicitud.cierre.motivo, 'No se presentó a la entrevista');
    assert.equal(cierre.datos.solicitud.cierre.comentario, 'No respondió llamados.');
    assert.equal(cierre.datos.solicitud.cierre.responsable, 'Prueba');

    // Cerrada: no se evalúa, no cambia de estado ni de etapa.
    const evaluar = await pedir('/evaluaciones', {
      rol: 'evaluador',
      metodo: 'POST',
      cuerpo: { solicitudId: 102, resultado: 'Recomendado', observaciones: 'Prueba', fechaEvaluacion: '2026-12-01' },
    });
    assert.equal(evaluar.status, 409);
    assert.equal(
      (await pedir('/solicitudes/102/estado', { rol: 'analista', metodo: 'PATCH', cuerpo: { estado: 'En proceso' } })).status,
      409,
    );
    assert.equal((await pedir('/solicitudes/102/etapa', { rol: 'evaluador', metodo: 'PATCH', cuerpo: { etapa: 'realizada' } })).status, 409);

    const reabrir = await pedir('/solicitudes/102/cierre', { rol: 'analista', metodo: 'DELETE' });
    assert.equal(reabrir.status, 200);
    assert.equal(reabrir.datos.solicitud.cierre, null);
    assert.deepEqual([reabrir.datos.solicitud.estado, reabrir.datos.solicitud.etapa], ['En proceso', 'agendada']);
    assert.equal((await pedir('/solicitudes/102/cierre', { rol: 'analista', metodo: 'DELETE' })).status, 409);

    // Con evaluación registrada no se puede cerrar sin evaluación.
    assert.equal(
      (await pedir('/solicitudes/1/cierre', { rol: 'evaluador', metodo: 'POST', cuerpo: { motivo: 'Desistió del proceso' } })).status,
      409,
    );
  });

  it('asigna y quita la psicóloga responsable', async () => {
    const asignada = await pedir('/solicitudes/101/estado', {
      rol: 'analista',
      metodo: 'PATCH',
      cuerpo: { profesionalResponsable: 'Tomás Riquelme Soto' },
    });
    assert.equal(asignada.datos.solicitud.profesionalResponsable, 'Tomás Riquelme Soto');
    assert.equal(asignada.datos.solicitud.estado, 'Pendiente');

    const sinAsignar = await pedir('/solicitudes/101/estado', {
      rol: 'analista',
      metodo: 'PATCH',
      cuerpo: { profesionalResponsable: '' },
    });
    assert.equal(sinAsignar.datos.solicitud.profesionalResponsable, '');
  });

  it('el evaluador mueve la etapa del Planner y el estado se sincroniza', async () => {
    const agendada = await pedir('/solicitudes/101/etapa', {
      rol: 'evaluador',
      metodo: 'PATCH',
      cuerpo: { etapa: 'agendada', fechaEntrevista: '2026-10-22', horaEntrevista: '10:30', modalidadEntrevista: 'Teams' },
    });
    assert.equal(agendada.status, 200);
    assert.deepEqual(
      [agendada.datos.solicitud.etapa, agendada.datos.solicitud.estado, agendada.datos.solicitud.modalidadEntrevista],
      ['agendada', 'En proceso', 'Teams'],
    );

    const devuelta = await pedir('/solicitudes/101/etapa', { rol: 'evaluador', metodo: 'PATCH', cuerpo: { etapa: 'recibida' } });
    assert.deepEqual([devuelta.datos.solicitud.estado, devuelta.datos.solicitud.fechaEntrevista], ['Pendiente', '']);

    assert.equal((await pedir('/solicitudes/101/etapa', { rol: 'analista', metodo: 'PATCH', cuerpo: { etapa: 'agendada' } })).status, 403);
    assert.equal((await pedir('/solicitudes/101/etapa', { rol: 'evaluador', metodo: 'PATCH', cuerpo: { etapa: 'otra' } })).status, 400);
  });

  describe('reuniones online (Google Calendar simulado)', () => {
    const registro = { guardados: [], cancelados: [] };
    const google = {
      proveedor: 'google',
      guardarEvento: async (datos) => {
        registro.guardados.push(datos);
        return { eventoId: datos.eventoId ?? 'evento-simulado', enlace: 'https://meet.google.com/abc-defg-hij' };
      },
      cancelarEvento: async (id) => registro.cancelados.push(id),
    };
    before(() => establecerReuniones({ google }));
    after(() => establecerReuniones({ motivos: { google: 'Google Meet no está configurado en las pruebas.' } }));
    const agendar = (cuerpo, rol = 'evaluador') =>
      pedir('/solicitudes/101/etapa', {
        rol,
        metodo: 'PATCH',
        cuerpo: { etapa: 'agendada', fechaEntrevista: '2026-12-03', horaEntrevista: '11:00', ...cuerpo },
      });

    it('con Google Meet crea el evento y devuelve enlaceReunion; al reagendar lo actualiza', async () => {
      const creada = await agendar({ modalidadEntrevista: 'Google Meet' });
      assert.equal(creada.status, 200);
      assert.equal(creada.datos.solicitud.enlaceReunion, 'https://meet.google.com/abc-defg-hij');
      assert.equal(creada.datos.solicitud.reunionEnCalendario, true);
      assert.equal(creada.datos.avisoReunion, null);
      assert.match(registro.guardados[0].titulo, /^Entrevista psicolaboral: /);
      assert.deepEqual([registro.guardados[0].fecha, registro.guardados[0].hora], ['2026-12-03', '11:00']);

      await agendar({ modalidadEntrevista: 'Google Meet', horaEntrevista: '12:30' });
      assert.equal(registro.guardados[1].eventoId, 'evento-simulado');

      // El detalle (que ve también la jefatura) trae el enlace.
      const detalle = await pedir('/solicitudes/101', { rol: 'jefatura' });
      assert.equal(detalle.datos.solicitud.enlaceReunion, 'https://meet.google.com/abc-defg-hij');
    });

    it('con Teams acepta el enlace pegado y rechaza enlaces que no son de Meet o Teams', async () => {
      const malo = await agendar({ modalidadEntrevista: 'Teams', enlaceReunion: 'http://teams.microsoft.com/l/1' });
      assert.equal(malo.status, 400);
      assert.match(malo.datos.error, /https:\/\//);
      assert.equal((await agendar({ modalidadEntrevista: 'Teams', enlaceReunion: 'https://zoom.us/j/1' })).status, 400);

      const teams = await agendar({ modalidadEntrevista: 'Teams', enlaceReunion: 'https://teams.microsoft.com/l/meetup-join/1' });
      assert.equal(teams.status, 200);
      assert.equal(teams.datos.solicitud.enlaceReunion, 'https://teams.microsoft.com/l/meetup-join/1');
      assert.equal(teams.datos.solicitud.reunionEnCalendario, false);
      // Al pasar de Meet a Teams se cancela el evento de Google.
      assert.deepEqual(registro.cancelados, ['evento-simulado']);
    });

    it('sin permiso de Calendar la agenda se guarda igual con un aviso', async () => {
      establecerReuniones({ motivos: { google: 'Falta autorizar Google Calendar.' } });
      const r = await agendar({ modalidadEntrevista: 'Google Meet' });
      establecerReuniones({ google });
      assert.equal(r.status, 200);
      assert.equal(r.datos.solicitud.etapa, 'agendada');
      assert.equal(r.datos.solicitud.enlaceReunion, '');
      assert.match(r.datos.avisoReunion, /Falta autorizar Google Calendar/);
    });

    it('al cerrar sin evaluación se puede cancelar el evento', async () => {
      await agendar({ modalidadEntrevista: 'Google Meet' });
      const cierre = await pedir('/solicitudes/101/cierre', {
        rol: 'evaluador',
        metodo: 'POST',
        cuerpo: { motivo: 'Desistió del proceso', cancelarReunion: true },
      });
      assert.equal(cierre.status, 200);
      assert.equal(cierre.datos.solicitud.enlaceReunion, '');
      assert.equal(registro.cancelados.at(-1), 'evento-simulado');

      await pedir('/solicitudes/101/cierre', { rol: 'evaluador', metodo: 'DELETE' });
      const recibida = await pedir('/solicitudes/101/etapa', { rol: 'evaluador', metodo: 'PATCH', cuerpo: { etapa: 'recibida' } });
      assert.equal(recibida.datos.solicitud.enlaceReunion, '');
    });
  });

  it('filtra solicitudes por fecha y por psicóloga responsable (RF07)', async () => {
    const rango = await pedir('/solicitudes?desde=2026-10-01&hasta=2026-10-31', { rol: 'jefatura' });
    assert.ok(rango.datos.solicitudes.length > 0);
    assert.ok(rango.datos.solicitudes.every((s) => s.fechaSolicitud >= '2026-10-01' && s.fechaSolicitud <= '2026-10-31'));

    const responsable = await pedir('/solicitudes?responsable=Ignacia%20Vald%C3%A9s%20Ortiz', { rol: 'jefatura' });
    assert.ok(responsable.datos.solicitudes.every((s) => s.profesionalResponsable === 'Ignacia Valdés Ortiz'));

    assert.equal((await pedir('/solicitudes?desde=17-10-2026', { rol: 'jefatura' })).status, 400);
  });

  it('el evaluador solo recibe candidatos que pasaron a evaluación', async () => {
    const todos = await pedir('/candidatos', { rol: 'analista' });
    const delEvaluador = await pedir('/candidatos', { rol: 'evaluador' });
    assert.ok(delEvaluador.datos.candidatos.length < todos.datos.candidatos.length);
    assert.equal(delEvaluador.datos.candidatos.some((c) => c.id === 202), false);
    assert.equal((await pedir('/candidatos/202', { rol: 'evaluador' })).status, 404);
  });

  it('solo el administrador restablece los datos de demostración', async () => {
    assert.equal((await pedir('/admin/reiniciar', { rol: 'analista', metodo: 'POST' })).status, 403);
    const { status, datos } = await pedir('/admin/reiniciar', { rol: 'admin', metodo: 'POST' });
    assert.equal(status, 200);
    assert.equal(datos.totales.solicitudes, 108);
  });
  it('analista y psicóloga corrigen los datos de una solicitud; la jefatura no', async () => {
    const editar = (rol, cuerpo) => pedir('/solicitudes/2', { rol, metodo: 'PATCH', cuerpo });

    const porAnalista = await editar('analista', { cargo: 'Analista de Sistemas', familiaCargo: 'Profesional B C', ceco: 'b123456789' });
    assert.equal(porAnalista.status, 200);
    assert.equal(porAnalista.datos.solicitud.cargo, 'Analista de Sistemas');
    assert.equal(porAnalista.datos.solicitud.ceco, 'B123456789');

    const porPsicologa = await editar('evaluador', { observaciones: 'Indagar liderazgo.', requiereReferencias: true });
    assert.equal(porPsicologa.status, 200);
    assert.equal(porPsicologa.datos.solicitud.observaciones, 'Indagar liderazgo.');
    assert.equal(porPsicologa.datos.solicitud.requiereReferencias, true);
    // Lo no enviado se conserva.
    assert.equal(porPsicologa.datos.solicitud.cargo, 'Analista de Sistemas');

    assert.equal((await editar('jefatura', { cargo: 'X' })).status, 403);
    assert.equal((await editar('analista', { cargo: '  ' })).status, 400);
    assert.equal((await editar('analista', { ceco: '123' })).status, 400);
    assert.equal((await editar('analista', { fechaSolicitud: '2999-01-01' })).status, 400);
    assert.equal((await editar('analista', {})).status, 400);
    assert.equal((await pedir('/solicitudes/99999', { rol: 'analista', metodo: 'PATCH', cuerpo: { cargo: 'X' } })).status, 404);
  });

  it('la evaluación guarda competencias, visibles para el analista sin las notas clínicas', async () => {
    const nueva = await pedir('/solicitudes', {
      rol: 'analista',
      metodo: 'POST',
      cuerpo: { candidatoId: 1, cargo: 'Monitor Producción', familiaCargo: 'Técnico B C', reclutador: 'Carolina Muñoz' },
    });
    const solicitudId = nueva.datos.solicitud.id;
    await pedir(`/solicitudes/${solicitudId}/etapa`, { rol: 'evaluador', metodo: 'PATCH', cuerpo: { etapa: 'realizada' } });
    const competencias = [
      { competencia: 'Trabajo en equipo', nivel: 'Esperado', fortalezas: 'Coordina con su turno.', oportunidades: '' },
    ];

    const invalida = await pedir('/evaluaciones', {
      rol: 'evaluador',
      metodo: 'POST',
      cuerpo: { solicitudId, resultado: 'Recomendado', observaciones: 'Nota clínica.', competencias: [{ competencia: 'Trabajo en equipo', nivel: 'Excelente', fortalezas: 'x' }] },
    });
    assert.equal(invalida.status, 400);

    const creada = await pedir('/evaluaciones', {
      rol: 'evaluador',
      metodo: 'POST',
      cuerpo: { solicitudId, resultado: 'Recomendado', observaciones: 'Nota clínica reservada.', competencias },
    });
    assert.equal(creada.status, 201);
    assert.deepEqual(creada.datos.evaluacion.competencias, competencias);

    const vistaAnalista = await pedir(`/evaluaciones/solicitud/${solicitudId}`, { rol: 'analista' });
    assert.deepEqual(vistaAnalista.datos.evaluacion.competencias, competencias);
    assert.equal(vistaAnalista.datos.evaluacion.observaciones, undefined);

    const actualizada = await pedir(`/evaluaciones/${creada.datos.evaluacion.id}`, {
      rol: 'evaluador',
      metodo: 'PUT',
      cuerpo: { competencias: [] },
    });
    assert.deepEqual(actualizada.datos.evaluacion.competencias, []);
  });
  it('el administrador gestiona usuarios de prueba; nadie más puede', async () => {
    assert.equal((await pedir('/admin/usuarios', { rol: 'analista' })).status, 403);
    assert.equal((await pedir('/admin/usuarios', { rol: 'jefatura' })).status, 403);

    const lista = await pedir('/admin/usuarios', { rol: 'admin' });
    assert.equal(lista.status, 200);
    assert.equal(lista.datos.usuarios.length, 4);
    assert.ok(lista.datos.usuarios.every((u) => !('contrasena_hash' in u) && !('contrasena' in u)));

    const datos = { nombre: 'Tomás Riquelme Soto', correo: 'Tomas.Riquelme@AquaChile.cl', rol: 'evaluador', contrasena: 'ClaveSegura2026' };
    assert.equal((await pedir('/admin/usuarios', { rol: 'admin', metodo: 'POST', cuerpo: { ...datos, contrasena: 'corta' } })).status, 400);
    const creado = await pedir('/admin/usuarios', { rol: 'admin', metodo: 'POST', cuerpo: datos });
    assert.equal(creado.status, 201);
    assert.equal(creado.datos.usuario.correo, 'tomas.riquelme@aquachile.cl');
    assert.equal((await pedir('/admin/usuarios', { rol: 'admin', metodo: 'POST', cuerpo: datos })).status, 409);

    // El usuario nuevo puede iniciar sesión con su contraseña.
    const login = await pedir('/auth/login', { metodo: 'POST', cuerpo: { correo: datos.correo, contrasena: datos.contrasena } });
    assert.equal(login.status, 200);
    assert.equal(login.datos.usuario.rol, 'evaluador');

    const id = creado.datos.usuario.id;
    const editado = await pedir(`/admin/usuarios/${id}`, {
      rol: 'admin',
      metodo: 'PUT',
      cuerpo: { ...creado.datos.usuario, cargo: 'Psicólogo Evaluador', contrasena: 'OtraClave2026' },
    });
    assert.equal(editado.datos.usuario.cargo, 'Psicólogo Evaluador');
    const loginNueva = await pedir('/auth/login', { metodo: 'POST', cuerpo: { correo: datos.correo, contrasena: 'OtraClave2026' } });
    assert.equal(loginNueva.status, 200);

    assert.equal((await pedir(`/admin/usuarios/${id}`, { rol: 'admin', metodo: 'DELETE' })).status, 200);
    assert.equal((await pedir(`/admin/usuarios/${id}`, { rol: 'admin', metodo: 'DELETE' })).status, 404);
  });

  it('no se puede dejar el sistema sin administrador ni eliminarse a sí mismo', async () => {
    const { datos } = await pedir('/admin/usuarios', { rol: 'admin' });
    const admin = datos.usuarios.find((u) => u.rol === 'admin');
    const comoAdmin = (ruta, opciones) =>
      fetch(`${base}${ruta}`, {
        method: opciones.metodo,
        headers: {
          Authorization: `Bearer ${jwt.sign({ id: admin.id, nombre: admin.nombre, rol: 'admin' }, JWT_SECRETO)}`,
          'Content-Type': 'application/json',
        },
        body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
      });

    assert.equal((await comoAdmin(`/admin/usuarios/${admin.id}`, { metodo: 'DELETE' })).status, 400);
    const degradarse = await comoAdmin(`/admin/usuarios/${admin.id}`, { metodo: 'PUT', cuerpo: { ...admin, rol: 'analista' } });
    assert.equal(degradarse.status, 400);
    // Con la sesión de otra persona tampoco se puede eliminar al único administrador.
    const otro = await fetch(`${base}/admin/usuarios/${admin.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt.sign({ id: 9999, nombre: 'Otro', rol: 'admin' }, JWT_SECRETO)}` },
    });
    assert.equal(otro.status, 400);
  });

  it('cada usuario cambia su foto de perfil y su contraseña', async () => {
    const foto = `data:image/jpeg;base64,${Buffer.from('foto de prueba').toString('base64')}`;
    assert.equal((await pedir('/auth/perfil/foto', { metodo: 'PUT', cuerpo: { foto } })).status, 401);
    assert.equal(
      (await pedir('/auth/perfil/foto', { rol: 'analista', metodo: 'PUT', cuerpo: { foto: 'data:text/html;base64,PGI+' } }))
        .status,
      400,
    );
    const guardada = await pedir('/auth/perfil/foto', { rol: 'analista', metodo: 'PUT', cuerpo: { foto } });
    assert.equal(guardada.status, 200);
    assert.equal((await pedir('/auth/perfil', { rol: 'analista' })).datos.usuario.foto, foto);

    const login = await pedir('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'analista@aquachile.cl', contrasena: 'AquaChile2026!' },
    });
    assert.equal(login.datos.usuario.foto, foto);

    assert.equal((await pedir('/auth/perfil/foto', { rol: 'analista', metodo: 'DELETE' })).status, 200);
    assert.equal((await pedir('/auth/perfil', { rol: 'analista' })).datos.usuario.foto, null);

    const incorrecta = await pedir('/auth/contrasena', {
      rol: 'analista',
      metodo: 'PUT',
      cuerpo: { actual: 'otra-clave', nueva: 'NuevaClave2026' },
    });
    assert.equal(incorrecta.status, 400);
    const corta = await pedir('/auth/contrasena', {
      rol: 'analista',
      metodo: 'PUT',
      cuerpo: { actual: 'AquaChile2026!', nueva: 'corta' },
    });
    assert.equal(corta.status, 400);
    const cambio = await pedir('/auth/contrasena', {
      rol: 'analista',
      metodo: 'PUT',
      cuerpo: { actual: 'AquaChile2026!', nueva: 'NuevaClave2026' },
    });
    assert.equal(cambio.status, 200);
    const conNueva = await pedir('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: 'analista@aquachile.cl', contrasena: 'NuevaClave2026' },
    });
    assert.equal(conNueva.status, 200);
  });

  it('un documento que sube el analista lo ven y abren la psicóloga y la jefatura', async () => {
    const contenido = Buffer.from('%PDF-1.4 CV subido por la analista');
    const subida = await fetch(`${base}/solicitudes/103/documentos?categoria=cv&nombre=cv-prueba.pdf`, {
      method: 'POST',
      headers: { Authorization: cabeceras('analista').Authorization, 'Content-Type': 'application/pdf' },
      body: contenido,
    });
    assert.equal(subida.status, 201);

    for (const rol of ['evaluador', 'jefatura']) {
      const { datos } = await pedir('/solicitudes/103/documentos', { rol });
      const archivo = datos.archivos.find((item) => item.categoria === 'cv');
      assert.equal(archivo.nombre, 'CV - cv-prueba.pdf');
      assert.equal(archivo.puedeEliminar, false);
      const abierto = await fetch(`${base}/solicitudes/103/documentos/${encodeURIComponent(archivo.id)}/contenido`, {
        headers: { Authorization: cabeceras(rol).Authorization },
      });
      assert.equal(abierto.status, 200);
      assert.equal(abierto.headers.get('content-type'), 'application/pdf');
      assert.deepEqual(Buffer.from(await abierto.arrayBuffer()), contenido);
    }
  });

  it('el analista crea, publica y cierra ofertas; el portal solo ve las abiertas', async () => {
    const completa = {
      titulo: 'Operario de prueba',
      area: 'Producción',
      cargo: 'Operario',
      familiaCargo: 'Operario',
      ubicacion: 'Calbuco',
      region: 'Los Lagos',
      descripcion: 'Oferta ficticia de prueba.',
      requisitos: [' Licencia B ', ''],
    };
    const postulante = {
      nombre: 'Postulante Ficticio',
      correo: 'postulante.oferta@ejemplo.cl',
      telefono: '+56900000000',
      ciudad: 'Puerto Montt',
      origen: 'Externo',
      consentimiento: true,
    };

    // Permisos: la jefatura consulta pero no escribe; el evaluador no entra; sin sesión tampoco.
    assert.equal((await pedir('/ofertas/gestion', { rol: 'jefatura' })).status, 200);
    assert.equal((await pedir('/ofertas/gestion', { rol: 'evaluador' })).status, 403);
    assert.equal((await pedir('/ofertas/gestion')).status, 401);
    assert.equal((await pedir('/ofertas', { rol: 'jefatura', metodo: 'POST', cuerpo: completa })).status, 403);
    assert.equal((await pedir('/ofertas', { metodo: 'POST', cuerpo: completa })).status, 401);

    // Un borrador solo necesita título y no se ve ni admite postulaciones.
    const borrador = await pedir('/ofertas', { rol: 'analista', metodo: 'POST', cuerpo: { titulo: 'Borrador de prueba' } });
    assert.equal(borrador.status, 201);
    assert.equal(borrador.datos.oferta.estado, 'Borrador');
    const id = borrador.datos.oferta.id;
    assert.equal((await pedir(`/ofertas/${id}`)).status, 404);
    assert.ok(!(await pedir('/ofertas')).datos.ofertas.some((o) => o.id === id));
    assert.ok((await pedir('/ofertas/gestion', { rol: 'analista' })).datos.ofertas.some((o) => o.id === id));
    assert.equal((await pedir('/postulaciones', { metodo: 'POST', cuerpo: { ...postulante, ofertaId: id } })).status, 404);

    // No se publica incompleta, y al completarla queda abierta con fecha.
    assert.equal((await pedir(`/ofertas/${id}/estado`, { rol: 'analista', metodo: 'PATCH', cuerpo: { estado: 'Abierta' } })).status, 400);
    assert.equal((await pedir(`/ofertas/${id}`, { rol: 'analista', metodo: 'PUT', cuerpo: { titulo: 'Solo título', publicar: true } })).status, 400);
    const publicada = await pedir(`/ofertas/${id}`, { rol: 'analista', metodo: 'PUT', cuerpo: { ...completa, publicar: true } });
    assert.equal(publicada.status, 200);
    assert.equal(publicada.datos.oferta.estado, 'Abierta');
    assert.ok(publicada.datos.oferta.fechaPublicacion);
    assert.deepEqual(publicada.datos.oferta.requisitos, ['Licencia B']);
    assert.equal((await pedir(`/ofertas/${id}`)).status, 200);

    // Publicada debe seguir completa y no vuelve a borrador.
    assert.equal((await pedir(`/ofertas/${id}`, { rol: 'analista', metodo: 'PUT', cuerpo: { titulo: 'Solo título' } })).status, 400);
    assert.equal((await pedir(`/ofertas/${id}/estado`, { rol: 'analista', metodo: 'PATCH', cuerpo: { estado: 'Borrador' } })).status, 400);

    // Cerrada sale del portal y deja de recibir postulaciones; se puede reabrir.
    assert.equal((await pedir(`/ofertas/${id}/estado`, { rol: 'analista', metodo: 'PATCH', cuerpo: { estado: 'Cerrada' } })).status, 200);
    assert.equal((await pedir(`/ofertas/${id}`)).status, 404);
    assert.equal((await pedir('/postulaciones', { metodo: 'POST', cuerpo: { ...postulante, ofertaId: id } })).status, 404);
    const reabierta = await pedir(`/ofertas/${id}/estado`, { rol: 'analista', metodo: 'PATCH', cuerpo: { estado: 'Abierta' } });
    assert.equal(reabierta.datos.oferta.fechaPublicacion, publicada.datos.oferta.fechaPublicacion);
    assert.equal((await pedir(`/ofertas/${id}`)).status, 200);

    // El administrador también gestiona; una oferta inexistente responde 404.
    assert.equal((await pedir('/ofertas/gestion', { rol: 'admin' })).status, 200);
    assert.equal((await pedir('/ofertas/999999', { rol: 'analista', metodo: 'PUT', cuerpo: completa })).status, 404);
  });

  it('crea la carpeta de la solicitud al pedirla para abrirla', async () => {
    const creada = await pedir('/solicitudes', {
      rol: 'analista',
      metodo: 'POST',
      cuerpo: { candidatoId: 1, cargo: 'Cargo Carpeta Prueba', familiaCargo: 'Operario' },
    });
    const id = creada.datos.solicitud.id;
    const ruta = `/solicitudes/${id}/documentos/carpeta`;

    assert.equal((await pedir(ruta, { metodo: 'POST', cuerpo: {} })).status, 401);
    assert.equal((await pedir(ruta, { rol: 'jefatura', metodo: 'POST', cuerpo: {} })).status, 403);
    const pedida = await pedir(ruta, { rol: 'evaluador', metodo: 'POST', cuerpo: {} });
    assert.equal(pedida.status, 200);
    assert.match(pedida.datos.carpeta.nombre, new RegExp(`^S${String(id).padStart(4, '0')}`));
    // Pedirla otra vez entrega la misma carpeta.
    const otra = await pedir(ruta, { rol: 'analista', metodo: 'POST', cuerpo: {} });
    assert.equal(otra.datos.carpeta.id, pedida.datos.carpeta.id);
    assert.equal((await pedir('/solicitudes/99999/documentos/carpeta', { rol: 'analista', metodo: 'POST', cuerpo: {} })).status, 404);
  });

  it('al cambiar el cargo de la solicitud, su carpeta queda con el descriptor del cargo nuevo', async () => {
    const subirCargo = (cargo, nombre) =>
      fetch(`${base}/cargos/descriptor?${new URLSearchParams({ cargo, familiaCargo: 'Operario', nombre })}`, {
        method: 'POST',
        headers: { ...cabeceras('analista'), 'Content-Type': 'application/pdf' },
        body: Buffer.from(`contenido de ${nombre}`),
      });
    await subirCargo('Cargo Viejo Sync', 'viejo.pdf');
    await subirCargo('Cargo Nuevo Sync', 'nuevo.pdf');
    const cargos = (await pedir('/cargos', { rol: 'evaluador' })).datos.cargos;
    const viejo = cargos.find((c) => c.nombre === 'Cargo Viejo Sync');

    const creada = await pedir('/solicitudes', {
      rol: 'analista',
      metodo: 'POST',
      cuerpo: { candidatoId: 1, cargo: 'Cargo Viejo Sync', familiaCargo: 'Operario', descriptorCargo: 'viejo.pdf' },
    });
    const id = creada.datos.solicitud.id;
    const ruta = `/solicitudes/${id}/documentos`;
    await pedir(`${ruta}/desde-cargo`, { rol: 'analista', metodo: 'POST', cuerpo: { cargoId: viejo.id } });
    const nombres = async () => (await pedir(ruta, { rol: 'evaluador' })).datos.archivos.map((a) => a.nombre);
    assert.deepEqual(await nombres(), ['Descriptor - viejo.pdf']);

    // La psicóloga corrige el cargo y la carpeta se actualiza, aunque ella no suba descriptores.
    const editada = await pedir(`/solicitudes/${id}`, {
      rol: 'evaluador',
      metodo: 'PATCH',
      cuerpo: { cargo: 'Cargo Nuevo Sync', descriptorCargo: 'nuevo.pdf' },
    });
    assert.equal(editada.datos.solicitud.descriptorCargo, 'nuevo.pdf');
    assert.equal((await pedir(`${ruta}/sincronizar-descriptor`, { metodo: 'POST', cuerpo: {} })).status, 401);
    assert.equal((await pedir(`${ruta}/sincronizar-descriptor`, { rol: 'jefatura', metodo: 'POST', cuerpo: {} })).status, 403);
    const sincronizada = await pedir(`${ruta}/sincronizar-descriptor`, { rol: 'evaluador', metodo: 'POST', cuerpo: {} });
    assert.equal(sincronizada.status, 200);
    assert.equal(sincronizada.datos.eliminados, 1);
    assert.deepEqual(await nombres(), ['Descriptor - nuevo.pdf']);

    // Un cargo sin descriptor guardado solo retira el anterior.
    await pedir(`/solicitudes/${id}`, { rol: 'analista', metodo: 'PATCH', cuerpo: { cargo: 'Cargo Sin Descriptor', descriptorCargo: '' } });
    const sinDescriptor = await pedir(`${ruta}/sincronizar-descriptor`, { rol: 'analista', metodo: 'POST', cuerpo: {} });
    assert.equal(sinDescriptor.datos.archivo, null);
    assert.deepEqual(await nombres(), []);

    assert.equal((await pedir('/solicitudes/99999/documentos/sincronizar-descriptor', { rol: 'analista', metodo: 'POST', cuerpo: {} })).status, 404);
  });

  it('el descriptor se guarda por cargo y se reutiliza en sus solicitudes', async () => {
    const subir = (nombre, { cargo = 'Cargo Único Prueba', rol = 'analista' } = {}) =>
      fetch(
        `${base}/cargos/descriptor?${new URLSearchParams({ cargo, familiaCargo: 'Operario', nombre })}`,
        {
          method: 'POST',
          headers: { ...cabeceras(rol), 'Content-Type': 'application/pdf' },
          body: Buffer.from(`contenido de ${nombre}`),
        },
      );

    // Permisos y validaciones.
    assert.equal((await subir('d.pdf', { rol: 'jefatura' })).status, 403);
    assert.equal((await subir('d.pdf', { rol: 'evaluador' })).status, 403);
    assert.equal((await subir('d.exe')).status, 400);
    assert.equal((await subir('d.pdf', { cargo: ' ' })).status, 400);
    assert.equal((await pedir('/cargos')).status, 401);
    assert.equal((await pedir('/cargos', { rol: 'evaluador' })).status, 200);

    // Al reemplazarlo sigue siendo un solo cargo, aunque cambien tildes o mayúsculas.
    const primero = await (await subir('primero.pdf')).json();
    const segundo = await (await subir('segundo.pdf', { cargo: 'cargo unico  prueba' })).json();
    assert.equal(segundo.cargo.id, primero.cargo.id);
    assert.equal(segundo.cargo.nombre, 'Cargo Único Prueba');
    assert.equal(segundo.cargo.familiaCargo, 'Operario');
    assert.equal(segundo.cargo.descriptorNombre, 'segundo.pdf');
    const lista = await pedir('/cargos', { rol: 'jefatura' });
    assert.equal(lista.datos.cargos.filter((c) => c.id === primero.cargo.id).length, 1);

    const id = primero.cargo.id;
    assert.equal((await pedir(`/cargos/${id}/descriptor`, { rol: 'evaluador' })).status, 403);
    const descarga = await fetch(`${base}/cargos/${id}/descriptor`, { headers: cabeceras('analista') });
    assert.equal(await descarga.text(), 'contenido de segundo.pdf');

    // Dos solicitudes del mismo cargo reciben su copia sin volver a subirlo.
    for (const candidatoId of [1, 2]) {
      const creada = await pedir('/solicitudes', {
        rol: 'analista',
        metodo: 'POST',
        cuerpo: { candidatoId, cargo: 'Cargo Único Prueba', familiaCargo: 'Operario', descriptorCargo: 'segundo.pdf' },
      });
      const ruta = `/solicitudes/${creada.datos.solicitud.id}/documentos`;
      assert.equal((await pedir(`${ruta}/desde-cargo`, { rol: 'evaluador', metodo: 'POST', cuerpo: { cargoId: id } })).status, 403);
      assert.equal((await pedir(`${ruta}/desde-cargo`, { rol: 'analista', metodo: 'POST', cuerpo: { cargoId: id } })).status, 201);
      const documentos = await pedir(ruta, { rol: 'evaluador' });
      assert.ok(JSON.stringify(documentos.datos).includes('Descriptor - segundo.pdf'));
    }

    // El portal no recibe el descriptor, y una oferta sin archivo propio lo informa.
    assert.ok((await pedir('/ofertas')).datos.ofertas.every((o) => !('descriptorNombre' in o)));
    assert.equal((await pedir('/ofertas/1/descriptor', { rol: 'analista' })).status, 404);
  });

  it('avisa a analistas y psicólogas, y cada usuario ve y marca solo sus notificaciones', async () => {
    const pedirComo = async (id, rol, ruta, metodo = 'GET') => {
      const respuesta = await fetch(`${base}${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${jwt.sign({ id, nombre: 'Prueba', rol }, JWT_SECRETO)}` },
      });
      return { status: respuesta.status, datos: await respuesta.json() };
    };
    const ANALISTA = 1;
    const PSICOLOGA = 2;
    assert.equal((await pedir('/notificaciones')).status, 401);
    await pedirComo(ANALISTA, 'analista', '/notificaciones/leidas', 'POST');
    await pedirComo(PSICOLOGA, 'evaluador', '/notificaciones/leidas', 'POST');

    // Postulación pública → analistas, no psicólogas.
    const postulacion = await pedir('/postulaciones', {
      metodo: 'POST',
      cuerpo: {
        ofertaId: 1,
        nombre: 'Rocío Aguilar Mena',
        correo: 'rocio.aguilar@correo.cl',
        telefono: '+56933334444',
        ciudad: 'Osorno',
        origen: 'Externo',
        consentimiento: true,
      },
    });
    assert.equal(postulacion.status, 201);
    const delAnalista = await pedirComo(ANALISTA, 'analista', '/notificaciones');
    assert.equal(delAnalista.datos.noLeidas, 1);
    assert.match(delAnalista.datos.notificaciones[0].mensaje, /Nueva postulación: Rocío Aguilar Mena/);
    assert.equal(delAnalista.datos.notificaciones[0].enlace, '/postulaciones');
    assert.equal((await pedirComo(PSICOLOGA, 'evaluador', '/notificaciones')).datos.noLeidas, 0);

    // Solicitud sin responsable → psicólogas.
    const solicitud = await pedir('/solicitudes', {
      rol: 'analista',
      metodo: 'POST',
      cuerpo: { candidatoId: 1, cargo: 'Cargo de aviso', familiaCargo: 'Técnico A' },
    });
    const id = solicitud.datos.solicitud.id;
    const dePsicologa = await pedirComo(PSICOLOGA, 'evaluador', '/notificaciones');
    assert.equal(dePsicologa.datos.noLeidas, 1);
    assert.match(dePsicologa.datos.notificaciones[0].mensaje, new RegExp(`Nueva solicitud #${id} .* Cargo de aviso`));
    assert.equal(dePsicologa.datos.notificaciones[0].enlace, `/solicitudes/${id}`);

    // Otro usuario no puede marcarla; su dueña sí.
    const idAviso = dePsicologa.datos.notificaciones[0].id;
    assert.equal((await pedirComo(ANALISTA, 'analista', `/notificaciones/${idAviso}/leida`, 'PATCH')).status, 404);
    assert.equal((await pedirComo(PSICOLOGA, 'evaluador', `/notificaciones/${idAviso}/leida`, 'PATCH')).status, 200);
    assert.equal((await pedirComo(PSICOLOGA, 'evaluador', '/notificaciones')).datos.noLeidas, 0);

    // Asignación → la psicóloga asignada; repetir la misma no vuelve a avisar.
    const asignar = () =>
      pedir(`/solicitudes/${id}/estado`, {
        rol: 'analista',
        metodo: 'PATCH',
        cuerpo: { profesionalResponsable: 'Ignacia Valdés Ortiz' },
      });
    await asignar();
    await asignar();
    const asignadas = await pedirComo(PSICOLOGA, 'evaluador', '/notificaciones');
    assert.equal(asignadas.datos.noLeidas, 1);
    assert.match(asignadas.datos.notificaciones[0].mensaje, /Te asignaron la solicitud/);

    await pedirComo(PSICOLOGA, 'evaluador', '/notificaciones/leidas', 'POST');
    assert.equal((await pedirComo(PSICOLOGA, 'evaluador', '/notificaciones')).datos.noLeidas, 0);
  });
});
