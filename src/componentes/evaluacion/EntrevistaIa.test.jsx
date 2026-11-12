import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EntrevistaIa, { formatearDuracion } from './EntrevistaIa';

const resultado = {
  transcripcion: '[00:00:03] Hablante 2: Yo coordino el turno con mi equipo.',
  notas: {
    competencias: [
      {
        competencia: 'Trabajo en equipo',
        observacion: 'Coordina el turno.',
        citas: ['yo coordino el turno con mi equipo'],
      },
    ],
    temasPendientes: ['Liderazgo: sin ejemplos.'],
    notas: 'Trabajo en equipo: coordina el turno ("yo coordino el turno con mi equipo").',
  },
  errorNotas: null,
  hablantes: 2,
  archivo: { nombre: 'Pauta - Transcripción entrevista 2026-11-11 16.30.txt' },
};

const crearApi = (respuesta = resultado) => ({
  transcribirAudio: vi.fn().mockResolvedValue(respuesta),
  subirTranscripcion: vi.fn().mockResolvedValue(respuesta),
});

const renderPanel = (props = {}) => {
  const alUsarNotas = vi.fn();
  const alGuardarPauta = vi.fn();
  const api = props.api ?? crearApi();
  render(
    <EntrevistaIa
      solicitudId={7}
      vozDisponible
      iaDisponible
      puedeUsarEnBorrador
      alUsarNotas={alUsarNotas}
      alGuardarPauta={alGuardarPauta}
      grabacionPosible={() => true}
      {...props}
      api={api}
    />,
  );
  return { alUsarNotas, alGuardarPauta, api, usuario: userEvent.setup() };
};

const aceptar = (usuario) => usuario.click(screen.getByLabelText(/el postulante aceptó que se grabe/i));

describe('EntrevistaIa', () => {
  it('formatea la duración de la grabación', () => {
    expect(formatearDuracion(65)).toBe('01:05');
    expect(formatearDuracion(3725)).toBe('1:02:05');
  });

  it('exige el consentimiento antes de grabar o subir una transcripción', async () => {
    const { usuario } = renderPanel();
    const botones = screen.getAllByRole('button', { name: /grabar|subir transcripción/i });
    expect(botones).toHaveLength(3);
    botones.forEach((boton) => expect(boton).toBeDisabled());
    expect(screen.getByText(/marca el consentimiento/i)).toBeInTheDocument();

    await aceptar(usuario);
    botones.forEach((boton) => expect(boton).toBeEnabled());
  });

  it('sin voz en el servidor solo ofrece subir la transcripción', () => {
    renderPanel({ vozDisponible: false });
    expect(screen.queryByRole('button', { name: /grabar/i })).toBeNull();
    expect(screen.getByRole('button', { name: /subir transcripción/i })).toBeInTheDocument();
  });

  it('graba el micrófono, transcribe y lleva las notas al borrador', async () => {
    const audio = new Blob(['a'], { type: 'audio/webm' });
    const control = { detener: vi.fn().mockResolvedValue(audio), cancelar: vi.fn() };
    const grabar = vi.fn().mockResolvedValue(control);
    const { usuario, api, alUsarNotas, alGuardarPauta } = renderPanel({ grabar });

    await aceptar(usuario);
    await usuario.click(screen.getByRole('button', { name: /grabar entrevista presencial/i }));
    await usuario.click(screen.getByRole('button', { name: /comenzar a grabar/i }));
    expect(grabar).toHaveBeenCalledWith(expect.objectContaining({ modo: 'microfono' }));
    expect(screen.getByText(/grabando 00:00/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/el postulante aceptó/i)).toBeDisabled();

    await usuario.click(screen.getByRole('button', { name: /detener y transcribir/i }));
    expect(api.transcribirAudio).toHaveBeenCalledWith(7, audio, 'microfono');
    expect(await screen.findByText(/transcripción guardada como pauta/i)).toHaveTextContent('2 voces');
    expect(alGuardarPauta).toHaveBeenCalledWith(resultado.archivo);
    expect(screen.getByText(/coordina el turno\./i)).toBeInTheDocument();
    expect(screen.getByText('«yo coordino el turno con mi equipo»')).toBeInTheDocument();
    expect(screen.getByText('Liderazgo: sin ejemplos.')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /usar en el borrador/i }));
    expect(alUsarNotas).toHaveBeenCalledWith(resultado.notas.notas);
  });

  it('graba la reunión con instrucciones para compartir el audio de la pestaña y se detiene si se deja de compartir', async () => {
    const audio = new Blob(['a'], { type: 'audio/webm' });
    let alTerminar;
    const grabar = vi.fn(async (opciones) => {
      alTerminar = opciones.alTerminar;
      return { detener: vi.fn().mockResolvedValue(audio), cancelar: vi.fn() };
    });
    const { usuario, api } = renderPanel({ grabar });

    await aceptar(usuario);
    await usuario.click(screen.getByRole('button', { name: /grabar reunión en línea/i }));
    expect(screen.getByText(/compartir audio de la pestaña/i)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: /comenzar a grabar/i }));
    await act(async () => alTerminar());
    await waitFor(() => expect(api.transcribirAudio).toHaveBeenCalledWith(7, audio, 'reunion'));
  });

  it('muestra el error del navegador o del servidor y permite descartar la grabación', async () => {
    const control = { detener: vi.fn(), cancelar: vi.fn().mockResolvedValue() };
    const grabar = vi
      .fn()
      .mockRejectedValueOnce(new Error('No se otorgó permiso para usar el micrófono.'))
      .mockResolvedValue(control);
    const { usuario } = renderPanel({ grabar });

    await aceptar(usuario);
    await usuario.click(screen.getByRole('button', { name: /grabar entrevista presencial/i }));
    await usuario.click(screen.getByRole('button', { name: /comenzar a grabar/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/no se otorgó permiso/i);

    await usuario.click(screen.getByRole('button', { name: /comenzar a grabar/i }));
    await usuario.click(screen.getByRole('button', { name: /descartar/i }));
    expect(control.cancelar).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /grabar entrevista presencial/i })).toBeInTheDocument();
  });

  it('avisa si la grabación quedó vacía', async () => {
    const control = { detener: vi.fn().mockResolvedValue(new Blob([])), cancelar: vi.fn() };
    const { usuario, api } = renderPanel({ grabar: vi.fn().mockResolvedValue(control) });
    await aceptar(usuario);
    await usuario.click(screen.getByRole('button', { name: /grabar entrevista presencial/i }));
    await usuario.click(screen.getByRole('button', { name: /comenzar a grabar/i }));
    await usuario.click(screen.getByRole('button', { name: /detener y transcribir/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/quedó vacía/i);
    expect(api.transcribirAudio).not.toHaveBeenCalled();
  });

  it('sube un .vtt exportado o el texto pegado', async () => {
    const { usuario, api } = renderPanel();
    await aceptar(usuario);
    await usuario.click(screen.getByRole('button', { name: /subir transcripción/i }));

    const archivo = new File(['WEBVTT'], 'reunion.vtt', { type: 'text/vtt' });
    await usuario.upload(screen.getByLabelText(/archivo de transcripción/i), archivo);
    expect(api.subirTranscripcion).toHaveBeenCalledWith(7, archivo);
    await screen.findByText(/transcripción guardada/i);

    await usuario.click(screen.getByRole('button', { name: /subir transcripción/i }));
    await usuario.type(screen.getByLabelText(/pega el texto/i), 'corto');
    await usuario.click(screen.getByRole('button', { name: /procesar texto/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/al menos unas líneas/i);

    const texto = 'Entrevistadora: ¿Cómo trabaja en equipo? Postulante: coordino el turno.';
    await usuario.clear(screen.getByLabelText(/pega el texto/i));
    await usuario.type(screen.getByLabelText(/pega el texto/i), texto);
    await usuario.click(screen.getByRole('button', { name: /procesar texto/i }));
    expect(api.subirTranscripcion).toHaveBeenLastCalledWith(7, texto);
  });

  it('si las notas fallan, muestra la transcripción y la usa en el borrador', async () => {
    const api = crearApi({
      ...resultado,
      notas: null,
      errorNotas: 'La IA no puede procesar este contenido.',
      hablantes: 0,
    });
    const { usuario, alUsarNotas } = renderPanel({ api });
    await aceptar(usuario);
    await usuario.click(screen.getByRole('button', { name: /subir transcripción/i }));
    await usuario.upload(
      screen.getByLabelText(/archivo de transcripción/i),
      new File(['x'], 'a.txt', { type: 'text/plain' }),
    );

    expect(await screen.findByText(/no se pudieron generar las notas/i)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: /usar en el borrador/i }));
    expect(alUsarNotas).toHaveBeenCalledWith(resultado.transcripcion);
  });

  it('con la entrevista solo agendada no lleva las notas al borrador, y sin IA no ofrece el botón', async () => {
    const { usuario } = renderPanel({ puedeUsarEnBorrador: false });
    await aceptar(usuario);
    await usuario.click(screen.getByRole('button', { name: /subir transcripción/i }));
    await usuario.upload(
      screen.getByLabelText(/archivo de transcripción/i),
      new File(['x'], 'a.txt', { type: 'text/plain' }),
    );
    expect(await screen.findByRole('button', { name: /usar en el borrador/i })).toBeDisabled();
    expect(screen.getByText(/marca la entrevista como realizada/i)).toBeInTheDocument();
  });

  it('informa el error del servidor al procesar', async () => {
    const api = {
      transcribirAudio: vi.fn(),
      subirTranscripcion: vi
        .fn()
        .mockRejectedValue(new Error('La transcripción debe ser un archivo .vtt, .docx o .txt.')),
    };
    const { usuario } = renderPanel({ api, iaDisponible: false });
    await aceptar(usuario);
    await usuario.click(screen.getByRole('button', { name: /subir transcripción/i }));
    await usuario.upload(
      screen.getByLabelText(/archivo de transcripción/i),
      new File(['x'], 'a.txt', { type: 'text/plain' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/debe ser un archivo/i);
  });
});
