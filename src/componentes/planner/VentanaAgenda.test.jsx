import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import VentanaAgenda from './VentanaAgenda';

const base = {
  id: 7,
  cargo: 'Operario de Planta',
  fechaSolicitud: '2026-10-01',
  fechaEntrevista: '2026-12-10',
  horaEntrevista: '10:00',
};
const candidato = { nombre: 'Ana Pérez' };

const abrir = (solicitud = {}) => {
  const acciones = { alGuardar: vi.fn(), alCerrar: vi.fn() };
  render(<VentanaAgenda solicitud={{ ...base, ...solicitud }} candidato={candidato} reagendar {...acciones} />);
  return acciones;
};

describe('VentanaAgenda', () => {
  it('ofrece Google Meet entre las modalidades e indica que el enlace se crea solo', async () => {
    const usuario = userEvent.setup();
    const { alGuardar } = abrir({ modalidadEntrevista: 'Presencial' });
    const modalidad = screen.getByLabelText('Modalidad');
    expect(screen.getByRole('option', { name: 'Google Meet' })).toBeInTheDocument();

    await usuario.selectOptions(modalidad, 'Google Meet');
    expect(screen.getByText(/el enlace de google meet se crea solo/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/enlace de la reunión de teams/i)).toBeNull();

    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }));
    expect(alGuardar).toHaveBeenCalledWith({
      fechaEntrevista: '2026-12-10',
      horaEntrevista: '10:00',
      modalidadEntrevista: 'Google Meet',
    });
  });

  it('al reagendar una entrevista con Meet avisa que el enlace se mantiene', () => {
    abrir({ modalidadEntrevista: 'Google Meet', enlaceReunion: 'https://meet.google.com/abc-defg-hij' });
    expect(screen.getByText(/el enlace de meet se mantiene/i)).toBeInTheDocument();
  });

  it('con Teams pide pegar el enlace y lo envía sin espacios', async () => {
    const usuario = userEvent.setup();
    const { alGuardar } = abrir({ modalidadEntrevista: 'Teams' });
    await usuario.type(
      screen.getByLabelText(/enlace de la reunión de teams/i),
      '  https://teams.microsoft.com/l/meetup-join/123  ',
    );
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }));
    expect(alGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ modalidadEntrevista: 'Teams', enlaceReunion: 'https://teams.microsoft.com/l/meetup-join/123' }),
    );
  });

  it('rechaza un enlace de Teams que no es https de Teams o Meet', async () => {
    const usuario = userEvent.setup();
    const { alGuardar } = abrir({ modalidadEntrevista: 'Teams' });
    await usuario.type(screen.getByLabelText(/enlace de la reunión de teams/i), 'http://otro-sitio.cl/reunion');
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }));
    expect(alGuardar).not.toHaveBeenCalled();
    expect(screen.getByText(/pegue el enlace https:\/\/ de la reunión de teams/i)).toBeInTheDocument();
  });

  it('precarga el enlace de Teams ya guardado', () => {
    abrir({ modalidadEntrevista: 'Teams', enlaceReunion: 'https://teams.microsoft.com/l/1' });
    expect(screen.getByLabelText(/enlace de la reunión de teams/i)).toHaveValue('https://teams.microsoft.com/l/1');
  });

  it('se cierra con Cancelar sin guardar', async () => {
    const usuario = userEvent.setup();
    const { alGuardar, alCerrar } = abrir({ modalidadEntrevista: 'Teams' });
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(alCerrar).toHaveBeenCalled();
    expect(alGuardar).not.toHaveBeenCalled();
  });
});
