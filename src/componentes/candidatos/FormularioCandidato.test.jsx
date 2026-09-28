import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FormularioCandidato from './FormularioCandidato';

const candidatoExistente = {
  id: 7,
  nombre: 'María González',
  correo: 'maria.gonzalez@correo.cl',
  telefono: '+56912345678',
  cargo: 'Técnico de Planta',
  familiaCargo: 'Operaciones',
};

const completarFormulario = async (usuario) => {
  await usuario.type(screen.getByLabelText(/nombre completo/i), 'Ana Torres');
  await usuario.type(screen.getByLabelText(/correo electrónico/i), 'ana.torres@correo.cl');
  await usuario.type(screen.getByLabelText(/teléfono/i), '+56911112222');
  await usuario.type(screen.getByLabelText(/^cargo/i), 'Operario');
  await usuario.selectOptions(screen.getByLabelText(/familia de cargo/i), 'Operaciones');
};

describe('FormularioCandidato', () => {
  it('muestra los errores de validación al enviar el formulario vacío', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    render(<FormularioCandidato alGuardar={alGuardar} />);

    await usuario.click(screen.getByRole('button', { name: /registrar candidato/i }));

    expect(screen.getByRole('alert')).toHaveClass('alert-danger');
    expect(screen.getByText('El nombre del candidato es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('El correo es obligatorio.')).toBeInTheDocument();
    expect(alGuardar).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/nombre completo/i)).toHaveClass('is-invalid');
  });

  it('no muestra los errores antes de intentar enviar', () => {
    render(<FormularioCandidato alGuardar={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText(/correo electrónico/i)).not.toHaveClass('is-invalid');
  });

  it('rechaza un correo con formato incorrecto', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    render(<FormularioCandidato alGuardar={alGuardar} />);

    await usuario.type(screen.getByLabelText(/correo electrónico/i), 'correo-sin-arroba');
    await usuario.click(screen.getByRole('button', { name: /registrar candidato/i }));

    expect(screen.getByText(/formato válido/i)).toBeInTheDocument();
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it('envía los datos normalizados cuando la validación es correcta', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    render(<FormularioCandidato alGuardar={alGuardar} />);

    await completarFormulario(usuario);
    await usuario.click(screen.getByRole('button', { name: /registrar candidato/i }));

    expect(alGuardar).toHaveBeenCalledWith({
      nombre: 'Ana Torres',
      correo: 'ana.torres@correo.cl',
      telefono: '+56911112222',
      cargo: 'Operario',
      familiaCargo: 'Operaciones',
    });
  });

  it('precarga los datos del candidato en modo edición', () => {
    render(<FormularioCandidato candidato={candidatoExistente} titulo="Editar" alGuardar={vi.fn()} />);

    expect(screen.getByLabelText(/nombre completo/i)).toHaveValue('María González');
    expect(screen.getByLabelText(/familia de cargo/i)).toHaveValue('Operaciones');
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it('limpia el error de un campo al volver a escribir en él', async () => {
    const usuario = userEvent.setup();
    render(<FormularioCandidato alGuardar={vi.fn()} />);

    await usuario.click(screen.getByRole('button', { name: /registrar candidato/i }));
    expect(screen.getByLabelText(/nombre completo/i)).toHaveClass('is-invalid');

    await usuario.type(screen.getByLabelText(/nombre completo/i), 'A');
    expect(screen.getByLabelText(/nombre completo/i)).not.toHaveClass('is-invalid');
  });

  it('permite cancelar mediante la función entregada', async () => {
    const usuario = userEvent.setup();
    const alCancelar = vi.fn();
    render(<FormularioCandidato alGuardar={vi.fn()} alCancelar={alCancelar} />);

    await usuario.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(alCancelar).toHaveBeenCalledTimes(1);
  });
});
