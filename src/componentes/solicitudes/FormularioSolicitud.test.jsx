import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FormularioSolicitud from './FormularioSolicitud';

const candidatos = [
  {
    id: 1,
    nombre: 'María González',
    correo: 'maria@correo.cl',
    telefono: '+56912345678',
    cargo: 'Jefe de Centro',
    familiaCargo: 'Jefatura',
    origen: 'Interno',
  },
];

const renderFormulario = (props = {}) =>
  render(<FormularioSolicitud candidatos={candidatos} alGuardar={vi.fn()} {...props} />);

const grupo = (nombre) => screen.getByRole('group', { name: nombre });

const elegir = (usuario, nombreGrupo, opcion) =>
  usuario.click(within(grupo(nombreGrupo)).getByRole('radio', { name: opcion }));

async function completarCargo(usuario) {
  await usuario.type(screen.getByLabelText(/ubicación del cargo/i), 'Planta Calbuco');
  await usuario.type(screen.getByLabelText(/^ceco/i), 'a170010311');
  await elegir(usuario, /requiere referencias/i, 'No');
}

describe('FormularioSolicitud', () => {
  it('exige los campos obligatorios del formulario', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    renderFormulario({ alGuardar });

    await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(screen.getByText('Debe seleccionar el reclutador/a.')).toBeInTheDocument();
    expect(screen.getByText('El nombre del candidato es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('Debe indicar el origen del candidato/a.')).toBeInTheDocument();
    expect(screen.getByText('El cargo es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('La ubicación del cargo es obligatoria.')).toBeInTheDocument();
    expect(screen.getByText('El CECO es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('Debe indicar si requiere referencias.')).toBeInTheDocument();
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it('completa origen, cargo, familia y descriptor al escribir un candidato registrado', async () => {
    const usuario = userEvent.setup();
    renderFormulario();

    await usuario.type(screen.getByLabelText(/nombre del candidato/i), 'maría gonzález');

    expect(screen.getByText(/candidato\/a registrado\/a: maria@correo\.cl/i)).toBeInTheDocument();
    expect(within(grupo(/origen/i)).getByRole('radio', { name: 'Interno' })).toBeChecked();
    expect(screen.getByLabelText(/nombre del cargo/i)).toHaveValue('Jefe de Centro');
    expect(screen.getByLabelText(/familia del cargo/i)).toHaveValue('Jefatura');
    expect(screen.getByText('DC_Jefe_de_Centro.pdf')).toBeInTheDocument();
    expect(screen.queryByLabelText(/correo del candidato/i)).toBeNull();
  });

  it('completa la unidad según la ubicación', async () => {
    const usuario = userEvent.setup();
    renderFormulario();

    await usuario.type(screen.getByLabelText(/ubicación del cargo/i), 'Planta Calbuco');
    expect(screen.getByText('Unidad: Industrial')).toBeInTheDocument();
  });

  it('pide adjuntar el descriptor cuando el cargo no está en el catálogo', async () => {
    const usuario = userEvent.setup();
    renderFormulario();

    await usuario.type(screen.getByLabelText(/nombre del cargo/i), 'Cargo nuevo');
    const archivo = new File(['contenido'], 'descriptor.pdf', { type: 'application/pdf' });
    await usuario.upload(screen.getByLabelText(/adjuntar descriptor de cargo/i), archivo);

    expect(screen.getByText('descriptor.pdf')).toBeInTheDocument();
  });

  it('rechaza archivos de más de 10 MB', async () => {
    const usuario = userEvent.setup();
    renderFormulario();

    const archivo = new File(['x'], 'cv.pdf', { type: 'application/pdf' });
    Object.defineProperty(archivo, 'size', { value: 11 * 1024 * 1024 });
    await usuario.upload(screen.getByLabelText(/adjuntar cv/i), archivo);

    expect(screen.getByText(/supera el límite de 10 MB/i)).toBeInTheDocument();
  });

  it('solo pregunta si es referido para candidatos externos', async () => {
    const usuario = userEvent.setup();
    renderFormulario();

    await elegir(usuario, /origen/i, 'Interno');
    expect(screen.queryByRole('group', { name: /referido/i })).toBeNull();

    await elegir(usuario, /origen/i, 'Externo');
    expect(grupo(/referido/i)).toBeInTheDocument();
  });

  it('valida el formato del CECO', async () => {
    const usuario = userEvent.setup();
    renderFormulario();

    await usuario.type(screen.getByLabelText(/^ceco/i), '12345');
    await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(screen.getByText(/letra seguida de 9 dígitos/i)).toBeInTheDocument();
  });

  it('entrega la solicitud de un candidato registrado', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    renderFormulario({ alGuardar });

    await elegir(usuario, /reclutador/i, 'Carolina Muñoz');
    await usuario.type(screen.getByLabelText(/nombre del candidato/i), 'María González');
    await completarCargo(usuario);
    await usuario.type(screen.getByLabelText(/aspectos a indagar/i), 'Indagar en liderazgo');
    await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(alGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        candidatoId: '1',
        profesionalResponsable: 'Carolina Muñoz',
        origen: 'Interno',
        tipoEvaluacion: 'interna',
        cargo: 'Jefe de Centro',
        familiaCargo: 'Jefatura',
        descriptorCargo: 'DC_Jefe_de_Centro.pdf',
        ubicacion: 'Planta Calbuco',
        unidad: 'Industrial',
        ceco: 'A170010311',
        requiereReferencias: false,
        referido: null,
        observaciones: 'Indagar en liderazgo',
      }),
    );
  });

  it('exige correo y teléfono para un candidato nuevo y los entrega al guardar', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    renderFormulario({ alGuardar });

    await elegir(usuario, /reclutador/i, 'Javiera Soto');
    await usuario.type(screen.getByLabelText(/nombre del candidato/i), 'Pedro Soto');
    expect(screen.getByText(/se creará junto con la solicitud/i)).toBeInTheDocument();
    await elegir(usuario, /origen/i, 'Externo');
    await elegir(usuario, /referido/i, 'Sí');
    await usuario.type(screen.getByLabelText(/nombre del cargo/i), 'Jefe de Centro');
    await completarCargo(usuario);

    await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));
    expect(screen.getByText('El correo es obligatorio.')).toBeInTheDocument();
    expect(alGuardar).not.toHaveBeenCalled();

    await usuario.type(screen.getByLabelText(/correo del candidato/i), 'pedro@correo.cl');
    await usuario.type(screen.getByLabelText(/teléfono del candidato/i), '+56911112222');
    await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(alGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        candidatoId: '',
        nombreCandidato: 'Pedro Soto',
        correo: 'pedro@correo.cl',
        telefono: '+56911112222',
        origen: 'Externo',
        tipoEvaluacion: 'externa',
        referido: true,
        familiaCargo: 'Jefatura',
      }),
    );
  });

  it('informa que la solicitud quedará en estado Pendiente', () => {
    renderFormulario();
    expect(screen.getByText(/queda en estado/i)).toBeInTheDocument();
  });
});
