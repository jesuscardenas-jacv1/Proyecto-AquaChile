import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PanelEntrevista from './PanelEntrevista';
import { ProveedorDatos } from '../datos/DatosContext';
import { ProveedorAuth } from '../datos/AuthContext';
import { datosDePrueba, USUARIO_TEST_DEFAULT } from '../pruebas/utilidades';

const EVALUADORA = { ...USUARIO_TEST_DEFAULT, rol: 'evaluador', nombre: 'Ignacia Valdés Ortiz' };

const analisis = {
  oferta: 'Analista de Datos',
  resultado: {
    resumen: 'Ingeniero con experiencia en reportes.',
    criterios: [{ requisito: 'Título profesional', tipo: 'obligatorio', nivel: 'cumple', evidencia: 'Ingeniero Civil' }],
    cumplimiento: { porcentaje: 80, obligatoriosCumplidos: 1, obligatoriosTotal: 1 },
    preguntasSugeridas: ['¿Ha liderado equipos?'],
    alertas: [],
  },
};

function crearApi({ entrevista = {}, conAnalisis = true } = {}) {
  return {
    conectado: () => true,
    obtener: vi.fn().mockResolvedValue({
      entrevista: { notas: '', transcripcion: [], preguntas: [], hablantes: {}, segundosAudio: 0, actualizadoEn: null, ...entrevista },
      analisis: conAnalisis ? analisis : null,
      tienePostulacion: conAnalisis,
    }),
    guardar: vi.fn(async (_, datos) => ({ ...datos, actualizadoEn: new Date().toISOString() })),
    tokenVoz: vi.fn().mockResolvedValue({ token: 't', region: 'eastus2' }),
    cerrar: vi.fn().mockResolvedValue({ notas: { notas: 'Liderazgo: coordina turnos (propuesta IA).' } }),
  };
}

/** Transcriptor simulado: guarda los callbacks para emitir frases desde la prueba. */
function crearTranscriptor() {
  const sesiones = [];
  const transcribir = vi.fn(async (opciones) => {
    const sesion = { opciones, detener: vi.fn().mockResolvedValue(), nivel: () => 0.5 };
    sesiones.push(sesion);
    return sesion;
  });
  return { transcribir, sesiones };
}

function DestinoSolicitud() {
  const { state } = useLocation();
  return (
    <div>
      <h1>Detalle de la solicitud</h1>
      <p>{state?.notasEntrevista}</p>
      <p data-testid="mensaje" data-tipo={state?.tipo}>
        {state?.mensaje}
      </p>
    </div>
  );
}

const montar = ({
  api = crearApi(),
  transcribir = vi.fn(),
  ruta = '/planner/entrevista/2',
  voz = true,
  datos = datosDePrueba,
  segundosSinFrases = 30,
} = {}) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAuth usuarioInicial={EVALUADORA}>
        <ProveedorDatos datosIniciales={structuredClone(datos)}>
          <Routes>
            <Route
              path="/planner/entrevista/:id"
              element={
                <PanelEntrevista
                  api={api}
                  transcribir={transcribir}
                  transcripcionPosible={() => true}
                  estadoIa={{ disponible: true, voz }}
                  retardoGuardado={10}
                  segundosSinFrases={segundosSinFrases}
                />
              }
            />
            <Route path="/solicitudes/:id" element={<DestinoSolicitud />} />
            <Route path="/planner" element={<h1>Planner de evaluaciones</h1>} />
          </Routes>
        </ProveedorDatos>
      </ProveedorAuth>
    </MemoryRouter>,
  );

afterEach(() => vi.restoreAllMocks());

describe('PanelEntrevista', () => {
  it('muestra al candidato, el análisis del CV y lo guardado, y guarda las notas solas', async () => {
    const usuario = userEvent.setup();
    const api = crearApi({ entrevista: { notas: 'Llegó puntual.', preguntas: ['¿Ha liderado equipos?'] } });
    montar({ api });

    expect(await screen.findByRole('heading', { name: 'Juan Pérez' })).toBeInTheDocument();
    expect(screen.getByText('80 % de cumplimiento')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '¿Ha liderado equipos?' })).toBeChecked();
    expect(screen.getByLabelText('Notas de la entrevista')).toHaveValue('Llegó puntual.');
    expect(api.obtener).toHaveBeenCalledWith(2);
    // Las notas van antes que la transcripción: es lo que la psicóloga escribe durante la entrevista.
    const [notas, transcripcion] = ['Mis notas', 'Transcripción en vivo'].map((titulo) => screen.getByRole('heading', { name: titulo }));
    expect(notas.compareDocumentPosition(transcripcion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await usuario.type(screen.getByLabelText('Notas de la entrevista'), ' Buena disposición.');
    await waitFor(() =>
      expect(api.guardar).toHaveBeenLastCalledWith(2, expect.objectContaining({ notas: 'Llegó puntual. Buena disposición.' })),
    );
    expect(await screen.findByText(/Guardado hace/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Liderazgo' }));
    expect(screen.getByText('1 de 6')).toBeInTheDocument();
  });

  it('transcribe en vivo con consentimiento, cita frases y pausa', async () => {
    const usuario = userEvent.setup();
    const { transcribir, sesiones } = crearTranscriptor();
    const api = crearApi();
    montar({ api, transcribir });

    await screen.findByRole('heading', { name: 'Juan Pérez' });
    expect(screen.getByRole('button', { name: /comenzar a grabar/i })).toBeDisabled();
    await usuario.click(screen.getByRole('checkbox', { name: /aceptó que se grabe/i }));
    await usuario.click(screen.getByRole('button', { name: /comenzar a grabar/i }));
    expect(transcribir).toHaveBeenCalledWith(expect.objectContaining({ modo: 'microfono', inicioMs: 0 }));
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent(/Grabando/);

    // El token se pide al backend, nunca con la clave en el navegador.
    await sesiones[0].opciones.obtenerToken();
    expect(api.tokenVoz).toHaveBeenCalled();

    act(() => {
      sesiones[0].opciones.alParcial({ hablante: 'Guest-2', texto: 'coordino' });
    });
    expect(screen.getByText('coordino …')).toBeInTheDocument();
    act(() => {
      sesiones[0].opciones.alSegmento({ hablante: 'Guest-2', inicioMs: 4000, texto: 'Coordino el turno con mi equipo.' });
    });
    expect(screen.getByText('Coordino el turno con mi equipo.')).toBeInTheDocument();
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Rol de Hablante 2' }), 'Postulante');
    await usuario.click(screen.getByRole('button', { name: /citar en mis notas/i }));
    expect(screen.getByLabelText('Notas de la entrevista')).toHaveValue('[00:04 · Postulante] "Coordino el turno con mi equipo."');

    await usuario.click(screen.getByRole('button', { name: /pausar/i }));
    expect(sesiones[0].detener).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /reanudar/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(api.guardar).toHaveBeenLastCalledWith(
        2,
        expect.objectContaining({ hablantes: { 'Guest-2': 'Postulante' }, transcripcion: [expect.objectContaining({ hablante: 'Guest-2' })] }),
      ),
    );
  });

  it('si la transcripción falla lo informa y deja la grabación en pausa', async () => {
    const usuario = userEvent.setup();
    const { transcribir, sesiones } = crearTranscriptor();
    montar({ transcribir });
    await screen.findByRole('heading', { name: 'Juan Pérez' });
    await usuario.click(screen.getByRole('checkbox', { name: /aceptó que se grabe/i }));
    await usuario.click(screen.getByRole('button', { name: /comenzar a grabar/i }));
    act(() => sesiones[0].opciones.alError('Se perdió la conexión con el servicio de transcripción.'));
    expect(await screen.findByText(/Se perdió la conexión/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reanudar/i })).toBeInTheDocument();

    const fallido = vi.fn().mockRejectedValue(new Error('No se otorgó permiso para usar el micrófono.'));
    sesiones.length = 0;
    transcribir.mockImplementationOnce(fallido);
    await usuario.click(screen.getByRole('button', { name: /reanudar/i }));
    expect(await screen.findByText(/No se otorgó permiso/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reanudar/i })).toBeInTheDocument();
  });

  it('al terminar guarda la pauta con IA, marca la entrevista como realizada y lleva las notas al borrador', async () => {
    const usuario = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const api = crearApi({
      entrevista: {
        notas: '[01:00 · Liderazgo] Coordina turnos.',
        transcripcion: [{ hablante: 'Guest-2', inicioMs: 4000, texto: 'Coordino el turno.' }],
        hablantes: { 'Guest-2': 'Postulante' },
        segundosAudio: 300,
      },
    });
    montar({ api });
    await screen.findByRole('heading', { name: 'Juan Pérez' });
    expect(screen.getByText('05:00')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /terminar y generar notas por competencia/i }));
    expect(await screen.findByRole('heading', { name: 'Detalle de la solicitud' })).toBeInTheDocument();
    expect(api.cerrar).toHaveBeenCalledWith(2, {
      transcripcion: '[00:00:04] Postulante: Coordino el turno.',
      notas: '[01:00 · Liderazgo] Coordina turnos.',
      segundosAudio: 300,
      consentimiento: true,
    });
    expect(screen.getByText('Liderazgo: coordina turnos (propuesta IA).')).toBeInTheDocument();
    expect(screen.getByTestId('mensaje')).toHaveTextContent(/La IA propuso notas por competencia/);
    expect(screen.getByTestId('mensaje')).toHaveAttribute('data-tipo', 'success');
  });

  it('avisa antes de terminar si se grabó audio sin ninguna frase, y lo informa después', async () => {
    const usuario = userEvent.setup();
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const api = crearApi({ entrevista: { segundosAudio: 152 } });
    api.cerrar.mockResolvedValue({ transcripcion: '', notas: null, errorNotas: null, archivo: null });
    montar({ api });
    await screen.findByRole('heading', { name: 'Juan Pérez' });
    await usuario.click(screen.getByRole('button', { name: /terminar y generar/i }));
    expect(confirmar).toHaveBeenCalledWith(expect.stringMatching(/Se grabaron 2 min 32 s pero no se transcribió ninguna frase/));
    expect(await screen.findByTestId('mensaje')).toHaveTextContent(/sin transcripción/);
    expect(screen.getByTestId('mensaje')).toHaveAttribute('data-tipo', 'warning');
  });

  it('si la IA no genera las notas, lo dice al llegar a la solicitud', async () => {
    const usuario = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const api = crearApi({ entrevista: { transcripcion: [{ hablante: 'Guest-2', inicioMs: 0, texto: 'Coordino el turno.' }] } });
    api.cerrar.mockResolvedValue({ notas: null, errorNotas: 'La IA no respondió.', archivo: { nombre: 'Pauta.txt' } });
    montar({ api });
    await screen.findByRole('heading', { name: 'Juan Pérez' });
    await usuario.click(screen.getByRole('button', { name: /terminar y generar/i }));
    expect(await screen.findByTestId('mensaje')).toHaveTextContent(/«Pauta\.txt».*no generó las notas por competencia: La IA no respondió\./);
  });

  it('con la entrevista ya realizada permite guardar lo grabado después sin mover la etapa', async () => {
    const usuario = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const datos = structuredClone(datosDePrueba);
    datos.solicitudes.find((s) => s.id === 2).etapa = 'realizada';
    const api = crearApi({ entrevista: { transcripcion: [{ hablante: 'Guest-2', inicioMs: 0, texto: 'Coordino el turno.' }] } });
    montar({ api, datos });
    expect(await screen.findByText(/guardar la transcripción y generar las notas con el botón de abajo/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Guardar transcripción y generar notas (IA)' }));
    expect(await screen.findByRole('heading', { name: 'Detalle de la solicitud' })).toBeInTheDocument();
    expect(api.cerrar).toHaveBeenCalledWith(2, expect.objectContaining({ transcripcion: '[00:00:00] Hablante 2: Coordino el turno.' }));
  });

  it('con la entrevista realizada y nada grabado ni anotado no ofrece cerrar', async () => {
    const datos = structuredClone(datosDePrueba);
    datos.solicitudes.find((s) => s.id === 2).etapa = 'realizada';
    montar({ datos });
    await screen.findByRole('heading', { name: 'Juan Pérez' });
    expect(screen.queryByRole('button', { name: /guardar transcripción/i })).toBeNull();
  });

  it('avisa arriba si la grabación no transcribe ninguna frase', async () => {
    const usuario = userEvent.setup();
    const { transcribir } = crearTranscriptor();
    montar({ transcribir, segundosSinFrases: 1 });
    await screen.findByRole('heading', { name: 'Juan Pérez' });
    await usuario.click(screen.getByRole('checkbox', { name: /aceptó que se grabe/i }));
    await usuario.click(screen.getByRole('button', { name: /comenzar a grabar/i }));
    expect(await screen.findByText(/no se ha transcrito ninguna frase/, {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('si el cierre falla se queda en el panel con el error', async () => {
    const usuario = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const api = crearApi({ entrevista: { notas: 'Notas.' } });
    api.cerrar.mockRejectedValue(new Error('El servicio de IA no respondió.'));
    montar({ api });
    await screen.findByRole('heading', { name: 'Juan Pérez' });
    await usuario.click(screen.getByRole('button', { name: /terminar y generar/i }));
    expect(await screen.findByText('El servicio de IA no respondió.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Juan Pérez' })).toBeInTheDocument();
  });

  it('no termina si la psicóloga cancela la confirmación', async () => {
    const usuario = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const api = crearApi();
    montar({ api });
    await screen.findByRole('heading', { name: 'Juan Pérez' });
    await usuario.click(screen.getByRole('button', { name: /terminar y generar/i }));
    expect(api.cerrar).not.toHaveBeenCalled();
  });

  it('guarda y vuelve al Planner para continuar después', async () => {
    const usuario = userEvent.setup();
    const api = crearApi();
    montar({ api, voz: false });
    await screen.findByRole('heading', { name: 'Juan Pérez' });
    expect(screen.getByText(/no está configurada en el servidor/)).toBeInTheDocument();
    await usuario.type(screen.getByLabelText('Notas de la entrevista'), 'Pendiente.');
    await usuario.click(screen.getByRole('button', { name: /guardar y continuar después/i }));
    expect(await screen.findByRole('heading', { name: 'Planner de evaluaciones' })).toBeInTheDocument();
    expect(api.guardar).toHaveBeenCalledWith(2, expect.objectContaining({ notas: 'Pendiente.' }));
  });

  it('pliega el resumen del CV y lo vuelve a mostrar', async () => {
    const usuario = userEvent.setup();
    montar({ api: crearApi({ conAnalisis: false }) });
    await screen.findByRole('heading', { name: 'Juan Pérez' });
    expect(screen.getByText(/aún no analizó el CV|no viene del portal/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: /plegar el resumen/i }));
    expect(screen.queryByRole('heading', { name: 'Resumen del CV' })).toBeNull();
    await usuario.click(screen.getByRole('button', { name: /ver resumen del cv/i }));
    expect(screen.getByRole('heading', { name: 'Resumen del CV' })).toBeInTheDocument();
  });

  it('avisa si la solicitud no existe o si la entrevista no se pudo cargar', async () => {
    const { unmount } = montar({ ruta: '/planner/entrevista/999' });
    expect(screen.getByText(/no existe/)).toBeInTheDocument();
    unmount();
    const api = crearApi();
    api.obtener.mockRejectedValue(new Error('sin conexión'));
    montar({ api });
    expect(await screen.findByText(/No se pudo cargar la entrevista: sin conexión/)).toBeInTheDocument();
  });

  it('en otra etapa permite revisar las notas, pero no terminar', async () => {
    montar({ ruta: '/planner/entrevista/1' });
    expect(await screen.findByText(/ya no está en «Entrevista Agendada»/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /terminar/i })).toBeNull();
  });
});
