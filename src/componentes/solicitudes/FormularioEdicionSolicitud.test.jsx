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

    await usuario.selectOptions(screen.getByLabelText(/^ceco/i), 'A170021102');
    await usuario.selectOptions(screen.getByLabelText(/referido/i), 'Sí');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(alGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        cargo: otroCargo.nombre,
        familiaCargo: otroCargo.familiaCargo,
        ceco: 'A170021102',
        requiereReferencias: false,
        referido: true,
        ubicacion: 'Planta Calbuco',
        descriptorCargo: otroCargo.descriptorCargo,
      }),
      null,
    );
  });

  describe('descriptor al cambiar el cargo', () => {
    const cambiarCargo = async (usuario, nombre) => {
      await usuario.clear(screen.getByLabelText(/nombre del cargo/i));
      await usuario.type(screen.getByLabelText(/nombre del cargo/i), nombre);
    };

    it('no toca el descriptor si el cargo no cambia, aunque cambien tildes o mayúsculas', async () => {
      const usuario = userEvent.setup();
      const alGuardar = vi.fn().mockResolvedValue({});
      renderFormulario({ alGuardar });
      await cambiarCargo(usuario, 'tecnico de planta');
      expect(screen.queryByText(/el descriptor pasará a ser/i)).toBeNull();

      await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(alGuardar.mock.calls[0][0]).not.toHaveProperty('descriptorCargo');
    });

    it('usa el descriptor guardado para el cargo, antes que pedirlo', async () => {
      const usuario = userEvent.setup();
      const alGuardar = vi.fn().mockResolvedValue({});
      renderFormulario({
        alGuardar,
        puedeSubirDescriptor: true,
        cargosGuardados: [{ id: 1, nombre: 'Buzo Ficticio', familiaCargo: 'Operario', descriptorNombre: 'dc-buzo.pdf' }],
      });
      await cambiarCargo(usuario, 'buzo ficticio');
      expect(screen.getByText(/el descriptor pasará a ser dc-buzo\.pdf/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/adjuntar descriptor/i)).toBeNull();

      await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(alGuardar.mock.calls[0][0].descriptorCargo).toBe('dc-buzo.pdf');
    });

    it('el analista debe adjuntarlo si el cargo nuevo no tiene descriptor', async () => {
      const usuario = userEvent.setup();
      const alGuardar = vi.fn().mockResolvedValue({});
      renderFormulario({ alGuardar, puedeSubirDescriptor: true });
      await cambiarCargo(usuario, 'Cargo Inventado');

      await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(screen.getByText(/este cargo no tiene descriptor: adjúntalo/i)).toBeInTheDocument();
      expect(alGuardar).not.toHaveBeenCalled();

      const archivo = new File(['dc'], 'dc-inventado.pdf', { type: 'application/pdf' });
      await usuario.upload(screen.getByLabelText(/adjuntar descriptor/i), archivo);
      await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(alGuardar).toHaveBeenCalledWith(expect.objectContaining({ descriptorCargo: 'dc-inventado.pdf' }), archivo);
    });

    it('la psicóloga no adjunta: guarda y el descriptor queda pendiente', async () => {
      const usuario = userEvent.setup();
      const alGuardar = vi.fn().mockResolvedValue({});
      renderFormulario({ alGuardar });
      await cambiarCargo(usuario, 'Cargo Inventado');
      expect(screen.getByText(/quedará pendiente hasta que lo suba el analista/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/adjuntar descriptor/i)).toBeNull();

      await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(alGuardar.mock.calls[0][0].descriptorCargo).toBe('');
    });
  });

  it('conserva un CECO antiguo que no está en la lista', () => {
    renderFormulario({ solicitud: { ...solicitud, ceco: 'B123456789' } });
    expect(screen.getByLabelText(/^ceco/i)).toHaveValue('B123456789');
  });

  it('valida campos obligatorios y el formato del CECO', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    renderFormulario({ alGuardar, solicitud: { ...solicitud, ceco: '123' } });

    await usuario.clear(screen.getByLabelText(/nombre del cargo/i));
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
