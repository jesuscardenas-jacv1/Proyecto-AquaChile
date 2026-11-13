import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TranscripcionEnVivo from './TranscripcionEnVivo';

const segmentos = [
  { hablante: 'Guest-1', inicioMs: 1000, texto: '¿Ha tenido personas a su cargo?' },
  { hablante: 'Guest-2', inicioMs: 5000, texto: 'No directamente, pero coordino turnos.' },
];

describe('TranscripcionEnVivo', () => {
  it('pide el consentimiento antes de grabar', async () => {
    const usuario = userEvent.setup();
    const alComenzar = vi.fn();
    const alCambiarConsentimiento = vi.fn();
    const { rerender } = render(
      <TranscripcionEnVivo disponible alComenzar={alComenzar} alCambiarConsentimiento={alCambiarConsentimiento} />,
    );
    expect(screen.getByText(/no se guarda/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /comenzar a grabar/i })).toBeDisabled();
    await usuario.click(screen.getByRole('checkbox', { name: /aceptó que se grabe/i }));
    expect(alCambiarConsentimiento).toHaveBeenCalledWith(true);

    rerender(<TranscripcionEnVivo disponible consentimiento alComenzar={alComenzar} />);
    await usuario.click(screen.getByRole('button', { name: /comenzar a grabar/i }));
    expect(alComenzar).toHaveBeenCalled();
  });

  it('muestra la conversación por hablante, permite asignar roles y citar', async () => {
    const usuario = userEvent.setup();
    const alAsignarHablante = vi.fn();
    const alCitar = vi.fn();
    const alPausar = vi.fn();
    render(
      <TranscripcionEnVivo
        disponible
        estado="grabando"
        segmentos={segmentos}
        parcial={{ hablante: 'Guest-2', texto: 'y además' }}
        hablantes={{ 'Guest-2': 'Postulante' }}
        alAsignarHablante={alAsignarHablante}
        alCitar={alCitar}
        alPausar={alPausar}
        nivel={0.6}
      />,
    );
    expect(screen.getByText('[00:01]')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Conversación transcrita' })).not.toHaveClass('compacta');
    expect(screen.getByText('No directamente, pero coordino turnos.')).toBeInTheDocument();
    expect(screen.getAllByText('Postulante').length).toBeGreaterThan(0);
    expect(screen.getByText('y además …')).toBeInTheDocument();

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Rol de Hablante 1' }), 'Psicóloga');
    expect(alAsignarHablante).toHaveBeenCalledWith('Guest-1', 'Psicóloga');
    await usuario.click(screen.getAllByRole('button', { name: /citar en mis notas/i })[1]);
    expect(alCitar).toHaveBeenCalledWith(segmentos[1]);
    await usuario.click(screen.getByRole('button', { name: /pausar/i }));
    expect(alPausar).toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Fuente de audio' })).toBeDisabled();
  });

  it('en pausa permite reanudar y muestra el error', async () => {
    const usuario = userEvent.setup();
    const alReanudar = vi.fn();
    render(<TranscripcionEnVivo disponible estado="pausado" segmentos={segmentos} alReanudar={alReanudar} error="Se perdió la conexión." />);
    await usuario.click(screen.getByRole('button', { name: /reanudar/i }));
    expect(alReanudar).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Se perdió la conexión.');
  });

  it('sin voz en el servidor invita a tomar notas a mano, en una caja compacta', () => {
    render(<TranscripcionEnVivo disponible={false} />);
    expect(screen.getByRole('list', { name: 'Conversación transcrita' })).toHaveClass('compacta');
    expect(screen.getByText(/no está configurada en el servidor/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /comenzar/i })).toBeNull();
  });

  it('mientras conecta muestra el estado y el texto de espera', () => {
    render(<TranscripcionEnVivo disponible estado="iniciando" consentimiento />);
    expect(screen.getByRole('button', { name: /conectando/i })).toBeDisabled();
    expect(screen.getByText(/Escuchando/)).toBeInTheDocument();
  });
});
