import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ChipsOpciones from './ChipsOpciones';

const opciones = [
  { etiqueta: 'Valentina Ríos Ojeda · Monitor Producción', accion: { tipo: 'agendar', solicitudId: 101 } },
  { etiqueta: 'Otra persona', accion: { tipo: 'agendar' }, sinFoco: true },
];

describe('ChipsOpciones', () => {
  it('cada chip envía su acción', async () => {
    const alElegir = vi.fn();
    render(<ChipsOpciones opciones={opciones} alElegir={alElegir} />);
    await userEvent.click(screen.getByRole('button', { name: 'Otra persona' }));
    expect(alElegir).toHaveBeenCalledWith({ tipo: 'agendar' }, 'Otra persona', opciones[1]);
  });

  it('sin opciones no muestra nada y desactivados no se pueden pulsar', () => {
    const { container, rerender } = render(<ChipsOpciones opciones={[]} alElegir={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ChipsOpciones opciones={opciones} alElegir={vi.fn()} desactivado />);
    expect(screen.getByRole('button', { name: 'Otra persona' })).toBeDisabled();
  });
});
