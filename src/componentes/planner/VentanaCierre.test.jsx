import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import VentanaCierre from './VentanaCierre';

const solicitud = { id: 5, cargo: 'Operario de Planta' };
const candidato = { nombre: 'Ana Pérez' };

const abrir = (props = {}) => {
  const acciones = { alConfirmar: vi.fn(), alCerrar: vi.fn(), ...props };
  render(<VentanaCierre solicitud={solicitud} candidato={candidato} {...acciones} />);
  return acciones;
};

describe('VentanaCierre', () => {
  it('entrega el motivo y el comentario sin espacios sobrantes', async () => {
    const usuario = userEvent.setup();
    const { alConfirmar } = abrir();
    await usuario.click(screen.getByRole('radio', { name: 'No cumple requisitos' }));
    await usuario.type(screen.getByLabelText(/comentario/i), '  Sin licencia vigente.  ');
    await usuario.click(screen.getByRole('button', { name: 'Cerrar solicitud' }));
    expect(alConfirmar).toHaveBeenCalledWith({ motivo: 'No cumple requisitos', comentario: 'Sin licencia vigente.' });
  });

  it('solo ofrece reagendar si no se presentó y hay entrevista que reagendar', async () => {
    const usuario = userEvent.setup();
    abrir();
    await usuario.click(screen.getByRole('radio', { name: 'No se presentó a la entrevista' }));
    expect(screen.queryByRole('button', { name: 'Reagendar' })).toBeNull();
  });

  it('si la app creó el evento en el calendario ofrece cancelarlo (marcado por defecto)', async () => {
    const usuario = userEvent.setup();
    const alConfirmar = vi.fn();
    render(
      <VentanaCierre
        solicitud={{ ...solicitud, reunionEnCalendario: true, modalidadEntrevista: 'Google Meet' }}
        candidato={candidato}
        alConfirmar={alConfirmar}
        alCerrar={vi.fn()}
      />,
    );
    const casilla = screen.getByRole('checkbox', { name: /cancelar también la reunión de google meet/i });
    expect(casilla).toBeChecked();
    await usuario.click(screen.getByRole('radio', { name: 'Desistió del proceso' }));
    await usuario.click(casilla);
    await usuario.click(screen.getByRole('button', { name: 'Cerrar solicitud' }));
    expect(alConfirmar).toHaveBeenCalledWith({ motivo: 'Desistió del proceso', comentario: '', cancelarReunion: false });
  });

  it('sin evento en el calendario no muestra la opción de cancelarlo', () => {
    abrir();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('se cierra con Escape sin confirmar', async () => {
    const usuario = userEvent.setup();
    const { alConfirmar, alCerrar } = abrir();
    await usuario.keyboard('{Escape}');
    expect(alCerrar).toHaveBeenCalled();
    expect(alConfirmar).not.toHaveBeenCalled();
  });
});
