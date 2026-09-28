import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FormularioSolicitud from './FormularioSolicitud';

const candidatos = [
  { id: 1, nombre: 'María González', correo: 'maria@correo.cl', telefono: '+56912345678', cargo: 'Técnico de Planta', familiaCargo: 'Técnico B C' },
];

const renderFormulario = (props = {}) =>
  render(<FormularioSolicitud candidatos={candidatos} alGuardar={vi.fn()} {...props} />);

describe('FormularioSolicitud', () => {
  it('exige candidato, cargo, familia y fecha', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    renderFormulario({ alGuardar });

    await usuario.clear(screen.getByLabelText(/fecha de solicitud/i));
    await usuario.click(screen.getByRole('button', { name: /crear solicitud/i }));

    expect(screen.getByText('Debe seleccionar un candidato.')).toBeInTheDocument();
    expect(screen.getByText('El cargo es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('La fecha de solicitud es obligatoria.')).toBeInTheDocument();
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it('completa cargo y familia al seleccionar un candidato', async () => {
    const usuario = userEvent.setup();
    renderFormulario();

    await usuario.selectOptions(screen.getByLabelText(/candidato/i), '1');

    expect(screen.getByLabelText(/cargo evaluado/i)).toHaveValue('Técnico de Planta');
    expect(screen.getByLabelText(/familia de cargo/i)).toHaveValue('Técnico B C');
  });

  it('no acepta una fecha futura', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    renderFormulario({ alGuardar });

    const manana = new Date();
    manana.setDate(manana.getDate() + 2);
    await usuario.selectOptions(screen.getByLabelText(/candidato/i), '1');
    await usuario.clear(screen.getByLabelText(/fecha de solicitud/i));
    await usuario.type(screen.getByLabelText(/fecha de solicitud/i), manana.toISOString().slice(0, 10));
    await usuario.click(screen.getByRole('button', { name: /crear solicitud/i }));

    expect(screen.getByText(/no puede ser futura/i)).toBeInTheDocument();
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it('entrega la solicitud válida al guardar', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    renderFormulario({ alGuardar });

    await usuario.selectOptions(screen.getByLabelText(/candidato/i), '1');
    await usuario.selectOptions(screen.getByLabelText(/profesional responsable/i), 'Carolina Muñoz');
    await usuario.type(screen.getByLabelText(/observaciones/i), 'Requiere turno noche');
    await usuario.click(screen.getByRole('button', { name: /crear solicitud/i }));

    expect(alGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        candidatoId: '1',
        cargo: 'Técnico de Planta',
        familiaCargo: 'Técnico B C',
        profesionalResponsable: 'Carolina Muñoz',
        observaciones: 'Requiere turno noche',
      }),
    );
  });

  it('permite modificar el cargo autocompletado', async () => {
    const usuario = userEvent.setup();
    renderFormulario();

    await usuario.selectOptions(screen.getByLabelText(/candidato/i), '1');
    await usuario.clear(screen.getByLabelText(/cargo evaluado/i));
    await usuario.type(screen.getByLabelText(/cargo evaluado/i), 'Operario de planta');

    expect(screen.getByLabelText(/cargo evaluado/i)).toHaveValue('Operario de planta');
  });

  it('informa que la solicitud quedará en estado Pendiente', () => {
    renderFormulario();
    expect(screen.getByText(/queda en estado/i)).toBeInTheDocument();
  });
});
