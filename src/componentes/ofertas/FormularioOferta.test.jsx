import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FormularioOferta from './FormularioOferta';

const borrador = {
  titulo: 'Gruero - Calbuco',
  descripcion: 'Operarás grúas en la planta de Calbuco.',
  requisitos: ['Licencia clase D', 'Experiencia de 2 años'],
};

const renderFormulario = (props = {}) =>
  render(<FormularioOferta alGuardar={vi.fn()} alCancelar={vi.fn()} {...props} />);

describe('FormularioOferta: redactar con IA', () => {
  afterEach(() => vi.restoreAllMocks());

  it('no ofrece la opción si la IA no está disponible', () => {
    renderFormulario();
    expect(screen.queryByRole('button', { name: /redactar con ia/i })).toBeNull();
  });

  it('pide el cargo antes de redactar', async () => {
    const usuario = userEvent.setup();
    const alRedactar = vi.fn();
    renderFormulario({ alRedactar });

    await usuario.click(screen.getByRole('button', { name: /redactar con ia/i }));
    expect(alRedactar).not.toHaveBeenCalled();
    expect(screen.getByText(/indica el cargo para redactar la oferta con ia/i)).toBeInTheDocument();
  });

  it('completa título, descripción y requisitos con el borrador', async () => {
    const usuario = userEvent.setup();
    const alRedactar = vi.fn().mockResolvedValue(borrador);
    renderFormulario({ alRedactar });
    await usuario.type(screen.getByLabelText(/^cargo/i), 'Grúero');
    await usuario.type(screen.getByLabelText(/^ubicación/i), 'Calbuco');

    await usuario.click(screen.getByRole('button', { name: /redactar con ia/i }));

    expect(alRedactar).toHaveBeenCalledWith(expect.objectContaining({ cargo: 'Grúero', ubicacion: 'Calbuco' }));
    expect(await screen.findByText(/revísalo y ajústalo antes de publicar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/título de la oferta/i)).toHaveValue('Gruero - Calbuco');
    expect(screen.getByLabelText(/descripción del cargo/i)).toHaveValue('Operarás grúas en la planta de Calbuco.');
    expect(screen.getByLabelText(/requisitos/i)).toHaveValue('Licencia clase D\nExperiencia de 2 años');
  });

  it('pregunta antes de reemplazar lo ya escrito y respeta el título', async () => {
    const usuario = userEvent.setup();
    const alRedactar = vi.fn().mockResolvedValue(borrador);
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderFormulario({
      alRedactar,
      inicial: { titulo: 'Mi título', cargo: 'Grúero', descripcion: 'Texto propio', requisitos: [] },
    });

    await usuario.click(screen.getByRole('button', { name: /redactar con ia/i }));
    expect(confirmar).toHaveBeenCalled();
    expect(alRedactar).not.toHaveBeenCalled();

    confirmar.mockReturnValue(true);
    await usuario.click(screen.getByRole('button', { name: /redactar con ia/i }));
    expect(await screen.findByText(/revísalo y ajústalo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/título de la oferta/i)).toHaveValue('Mi título');
  });

  it('muestra el error si la IA falla', async () => {
    const usuario = userEvent.setup();
    const alRedactar = vi.fn().mockRejectedValue(new Error('El servicio de IA no respondió. Intenta de nuevo.'));
    renderFormulario({ alRedactar, inicial: { cargo: 'Grúero', requisitos: [] } });

    await usuario.click(screen.getByRole('button', { name: /redactar con ia/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio de IA no respondió.');
  });
});
