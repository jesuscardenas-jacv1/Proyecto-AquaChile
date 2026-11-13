import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TarjetaPlanner, { iniciales } from './TarjetaPlanner';

const solicitud = {
  id: 12,
  cargo: 'Operario de Planta',
  familiaCargo: 'Operario',
  fechaSolicitud: '2026-11-01',
  reclutador: 'Carolina Muñoz',
  fechaEntrevista: '2026-11-20',
  horaEntrevista: '10:00',
  modalidadEntrevista: 'Google Meet',
  enlaceReunion: 'https://meet.google.com/abc-defg-hij',
};
const candidato = { nombre: 'Ana Pérez' };

const montar = (props = {}) =>
  render(
    <MemoryRouter>
      <TarjetaPlanner solicitud={solicitud} candidato={candidato} etapa="agendada" hoy="2026-11-11" {...props} />
    </MemoryRouter>,
  );

describe('TarjetaPlanner', () => {
  it('calcula las iniciales del solicitante', () => {
    expect(iniciales('Carolina Muñoz Pérez')).toBe('CM');
    expect(iniciales('')).toBe('');
  });

  it('con una entrevista online agendada muestra "Unirse a la reunión"', () => {
    montar({ editable: true });
    expect(screen.getByRole('link', { name: /unirse a la reunión/i })).toHaveAttribute(
      'href',
      'https://meet.google.com/abc-defg-hij',
    );
    expect(screen.getByText('Google Meet')).toBeInTheDocument();
  });

  it('con la entrevista agendada, la psicóloga abre el panel de entrevista', () => {
    montar({ editable: true });
    expect(screen.getByRole('link', { name: /abrir panel de entrevista/i })).toHaveAttribute('href', '/planner/entrevista/12');
    expect(screen.getByRole('link', { name: 'Ana Pérez' })).toHaveAttribute('href', '/planner/entrevista/12');
  });

  it('sin permiso de edición o en otra etapa, el nombre lleva a la solicitud y no hay panel', () => {
    const { unmount } = montar({ editable: false });
    expect(screen.queryByRole('link', { name: /panel de entrevista/i })).toBeNull();
    expect(screen.getByRole('link', { name: 'Ana Pérez' })).toHaveAttribute('href', '/solicitudes/12');
    unmount();
    montar({ editable: true, etapa: 'realizada' });
    // Ya realizada, el panel sigue a mano para procesar lo que se grabó después.
    expect(screen.queryByRole('link', { name: /abrir panel de entrevista/i })).toBeNull();
    expect(screen.getByRole('link', { name: /ver panel de entrevista/i })).toHaveAttribute('href', '/planner/entrevista/12');
  });

  it('para la jefatura (solo lectura) no muestra el enlace ni acciones', () => {
    montar({ editable: false, soloLectura: true });
    expect(screen.queryByRole('link', { name: /unirse/i })).toBeNull();
    expect(screen.getByText('Reunión online por Google Meet')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('no muestra el botón en otras etapas ni sin enlace', () => {
    const { unmount } = montar({ etapa: 'realizada' });
    expect(screen.queryByRole('link', { name: /unirse/i })).toBeNull();
    unmount();
    montar({ solicitud: { ...solicitud, enlaceReunion: '', modalidadEntrevista: 'Presencial' } });
    expect(screen.queryByRole('link', { name: /unirse/i })).toBeNull();
  });

  it('la psicóloga puede reagendar y marcar como realizada', async () => {
    const usuario = userEvent.setup();
    const alReagendar = vi.fn();
    const alMarcarRealizada = vi.fn();
    montar({ editable: true, alReagendar, alMarcarRealizada });
    await usuario.click(screen.getByRole('button', { name: /reagendar entrevista de ana pérez/i }));
    await usuario.click(screen.getByRole('button', { name: /realizada: marcar entrevista/i }));
    expect(alReagendar).toHaveBeenCalled();
    expect(alMarcarRealizada).toHaveBeenCalled();
  });
});
