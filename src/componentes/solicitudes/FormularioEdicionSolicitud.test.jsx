import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FormularioEdicionSolicitud from './FormularioEdicionSolicitud';
import { CARGOS } from '../../datos/catalogos';

const solicitud = {
  id: 7,
  reclutador: 'Carolina Muñoz',
  fechaSolicitud: '2026-08-03',
  cargo: 'Técnico de Planta',
  familiaCargo: 'Técnico B C',
  ubicacion: 'Planta Calbuco',
  unidad: 'Industrial',
  ceco: 'A170010311',
  requiereReferencias: false,
  referido: null,
  observaciones: 'Perfil orientado a turnos rotativos.',
};

const renderFormulario = (props = {}) =>
  render(
    <FormularioEdicionSolicitud
      solicitud={solicitud}
      origenCandidato="Externo"
      alGuardar={vi.fn()}
      alCancelar={vi.fn()}
      {...props}
    />,
  );

describe('FormularioEdicionSolicitud', () => {
  it('parte con los datos actuales de la solicitud', () => {
    renderFormulario();
    expect(screen.getByLabelText(/reclutador/i)).toHaveValue('Carolina Muñoz');
    expect(screen.getByLabelText(/nombre del cargo/i)).toHaveValue('Técnico de Planta');
    expect(screen.getByLabelText(/familia del cargo/i)).toHaveValue('Técnico B C');
    expect(screen.getByLabelText(/^ceco/i)).toHaveValue('A170010311');
    expect(screen.getByLabelText(/requiere referencias/i)).toHaveValue('No');
    expect(screen.getByLabelText(/aspectos a indagar/i)).toHaveValue('Perfil orientado a turnos rotativos.');
  });

  it('al cambiar a un cargo del catálogo completa su familia y guarda los cambios normalizados', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn().mockResolvedValue({});
    const otroCargo = CARGOS.find((cargo) => cargo.familiaCargo !== 'Técnico B C');
    renderFormulario({ alGuardar });

    await usuario.clear(screen.getByLabelText(/nombre del cargo/i));
    await usuario.type(screen.getByLabelText(/nombre del cargo/i), otroCargo.nombre);
    expect(screen.getByLabelText(/familia del cargo/i)).toHaveValue(otroCargo.familiaCargo);

    await usuario.clear(screen.getByLabelText(/^ceco/i));
    await usuario.type(screen.getByLabelText(/^ceco/i), 'b123456789');
    await usuario.selectOptions(screen.getByLabelText(/referido/i), 'Sí');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(alGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        cargo: otroCargo.nombre,
        familiaCargo: otroCargo.familiaCargo,
        ceco: 'B123456789',
        requiereReferencias: false,
        referido: true,
        ubicacion: 'Planta Calbuco',
      }),
    );
  });

  it('valida campos obligatorios y el formato del CECO', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    renderFormulario({ alGuardar });

    await usuario.clear(screen.getByLabelText(/nombre del cargo/i));
    await usuario.clear(screen.getByLabelText(/^ceco/i));
    await usuario.type(screen.getByLabelText(/^ceco/i), '123');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(screen.getByText('El cargo es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText(/una letra seguida de 9 dígitos/i)).toBeInTheDocument();
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it('para un candidato interno no pregunta si es referido', () => {
    renderFormulario({ origenCandidato: 'Interno' });
    expect(screen.queryByLabelText(/referido/i)).toBeNull();
  });

  it('permite cancelar sin guardar', async () => {
    const usuario = userEvent.setup();
    const alCancelar = vi.fn();
    const alGuardar = vi.fn();
    renderFormulario({ alCancelar, alGuardar });

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(alCancelar).toHaveBeenCalled();
    expect(alGuardar).not.toHaveBeenCalled();
  });
});
