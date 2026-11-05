import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeAll } from 'vitest';
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
  await usuario.selectOptions(screen.getByLabelText(/^ceco/i), 'A170010311');
  await usuario.selectOptions(screen.getByLabelText(/psicóloga responsable/i), 'Ignacia Valdés Ortiz');
  await elegir(usuario, /requiere referencias/i, 'No');
}

describe('FormularioSolicitud', () => {
  // jsdom no trae estas funciones; el visor las usa para mostrar los archivos.
  beforeAll(() => {
    URL.createObjectURL = vi.fn(() => 'blob:doc');
    URL.revokeObjectURL = vi.fn();
  });

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
    expect(screen.getByText('Debe asignar la psicóloga responsable.')).toBeInTheDocument();
    expect(screen.getByText('Debe indicar si requiere referencias.')).toBeInTheDocument();
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it('completa origen, cargo, familia y descriptor al escribir un candidato registrado', async () => {
    const usuario = userEvent.setup();
    renderFormulario();

    await usuario.type(screen.getByLabelText('Candidato/a *'), 'maría gonzález');

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

  it('despliega cada sección al completar la anterior, sin volver a plegarla', async () => {
    const usuario = userEvent.setup();
    const cuerpo = (id) => document.querySelector(`#${id} .seccion-solicitud-cuerpo`);
    const postulante = { nombre: 'Ana Pérez', correo: 'ana@ejemplo.cl', telefono: '+56900000000', origen: 'Externo' };
    renderFormulario({
      reclutadorFijo: 'Carolina Muñoz',
      postulante,
      candidatos: [{ id: 1, ...postulante }],
      valoresIniciales: {
        candidatoId: '1',
        nombreCandidato: 'Ana Pérez',
        origen: 'Externo',
        cargo: 'Cargo de oferta',
        familiaCargo: 'Operario',
        ubicacion: 'Planta Calbuco',
      },
    });

    // El candidato viene completo: se abre Cargo y lo demás sigue plegado.
    expect(cuerpo('seccion-cargo')).not.toHaveClass('d-none');
    expect(cuerpo('seccion-evaluacion')).toHaveClass('d-none');
    expect(cuerpo('seccion-antecedentes')).toHaveClass('d-none');

    await usuario.selectOptions(screen.getByLabelText(/^ceco/i), 'A170010311');
    expect(cuerpo('seccion-evaluacion')).toHaveClass('d-none');
    await elegir(usuario, /requiere referencias/i, 'No');
    expect(cuerpo('seccion-evaluacion')).not.toHaveClass('d-none');

    await usuario.selectOptions(screen.getByLabelText(/psicóloga responsable/i), 'Ignacia Valdés Ortiz');
    expect(cuerpo('seccion-antecedentes')).not.toHaveClass('d-none');

    // Corregir un dato anterior no pliega lo ya desplegado.
    await usuario.selectOptions(screen.getByLabelText(/^ceco/i), '');
    expect(cuerpo('seccion-antecedentes')).not.toHaveClass('d-none');
  });

  it('al enviar incompleto despliega todo para mostrar los errores', async () => {
    const usuario = userEvent.setup();
    renderFormulario();
    expect(document.querySelector('#seccion-evaluacion .seccion-solicitud-cuerpo')).toHaveClass('d-none');

    await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(document.querySelector('#seccion-evaluacion .seccion-solicitud-cuerpo')).not.toHaveClass('d-none');
  });

  it('distingue lo heredado de la oferta, y al editarlo deja de verse heredado', async () => {
    const usuario = userEvent.setup();
    renderFormulario({
      postulante: { nombre: 'Ana Pérez', correo: 'ana@ejemplo.cl', telefono: '+56900000000', origen: 'Externo' },
      valoresIniciales: { cargo: 'Cargo de oferta', ubicacion: 'Planta Calbuco' },
    });

    const cargo = screen.getByLabelText(/nombre del cargo/i);
    expect(cargo).toHaveClass('dato-heredado');
    expect(cargo).toBeEnabled();
    expect(screen.getByLabelText(/^ceco/i)).not.toHaveClass('dato-heredado');

    await usuario.type(cargo, ' editado');
    expect(cargo).toHaveValue('Cargo de oferta editado');
    expect(cargo).not.toHaveClass('dato-heredado');
    expect(screen.getByLabelText(/ubicación del cargo/i)).toHaveClass('dato-heredado');
  });

  it('el ojo abre la vista previa de lo que viene de la postulación y de la oferta', async () => {
    const usuario = userEvent.setup();
    const cv = { contenido: vi.fn().mockResolvedValue(new Blob(['cv'])), descargar: vi.fn() };
    const descriptor = { contenido: vi.fn().mockResolvedValue(new Blob(['d'])), descargar: vi.fn() };
    renderFormulario({
      postulante: { nombre: 'Ana Pérez', origen: 'Externo' },
      valoresIniciales: { cargo: 'Cargo de oferta', cv: 'cv-ana.pdf' },
      oferta: { cargo: 'Cargo de oferta', descriptorNombre: 'descriptor.pdf' },
      documentosOrigen: { cv, descriptor },
    });

    await usuario.click(screen.getByRole('button', { name: 'Ver cv-ana.pdf' }));
    expect(cv.contenido).toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: /cv-ana\.pdf/ })).toBeInTheDocument();
    await usuario.keyboard('{Escape}');

    await usuario.click(await screen.findByRole('button', { name: 'Ver descriptor.pdf' }));
    expect(descriptor.contenido).toHaveBeenCalled();
  });

  it('el ojo abre el PDF de demostración del descriptor del catálogo, sin tildes en la ruta', async () => {
    const usuario = userEvent.setup();
    const pedir = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['pdf']), { headers: { 'content-type': 'application/pdf' } }),
    );
    renderFormulario();

    await usuario.type(screen.getByLabelText(/nombre del cargo/i), 'Monitor Producción');
    await usuario.click(screen.getByRole('button', { name: 'Ver DC_Monitor_Producción.pdf' }));

    expect(await screen.findByRole('dialog', { name: /DC_Monitor_Producción\.pdf/ })).toBeInTheDocument();
    expect(pedir.mock.calls[0][0]).toMatch(/descriptores\/DC_Monitor_Produccion\.pdf$/);
    pedir.mockRestore();
  });

  it('el ojo también muestra un archivo recién adjuntado', async () => {
    const usuario = userEvent.setup();
    renderFormulario();

    await usuario.upload(screen.getByLabelText(/adjuntar cv/i), new File(['cv'], 'mi-cv.pdf', { type: 'application/pdf' }));
    await usuario.click(screen.getByRole('button', { name: 'Ver mi-cv.pdf' }));

    expect(await screen.findByRole('dialog', { name: /mi-cv\.pdf/ })).toBeInTheDocument();
  });

  it('un cargo con descriptor guardado no lo pide, sin importar tildes ni mayúsculas', async () => {
    const usuario = userEvent.setup();
    renderFormulario({
      cargosGuardados: [{ id: 3, nombre: 'Buzo Único', familiaCargo: 'Técnico A', descriptorNombre: 'buzo.pdf' }],
    });

    expect(screen.getByLabelText(/adjuntar descriptor/i)).toBeInTheDocument();
    await usuario.type(screen.getByLabelText(/nombre del cargo/i), 'buzo unico');

    expect(screen.getByText('buzo.pdf')).toBeInTheDocument();
    expect(screen.queryByLabelText(/adjuntar descriptor/i)).toBeNull();
    expect(screen.getByLabelText(/familia del cargo/i)).toHaveValue('Técnico A');
  });

  it('el CECO se elige de una lista', () => {
    renderFormulario();
    expect(screen.getByRole('combobox', { name: /^ceco/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /A170010311 · Planta Calbuco/ })).toBeInTheDocument();
  });

  it('usa el descriptor de la oferta y no lo pide, salvo que cambie el cargo', async () => {
    const usuario = userEvent.setup();
    renderFormulario({
      valoresIniciales: { cargo: 'Cargo sin catálogo' },
      oferta: { cargo: 'Cargo sin catálogo', descriptorNombre: 'descriptor-oferta.pdf' },
    });

    expect(screen.getByText('descriptor-oferta.pdf')).toBeInTheDocument();
    expect(screen.queryByLabelText(/adjuntar descriptor/i)).toBeNull();

    await usuario.type(screen.getByLabelText(/nombre del cargo/i), ' otro');
    expect(screen.queryByText('descriptor-oferta.pdf')).toBeNull();
    expect(screen.getByLabelText(/adjuntar descriptor/i)).toBeInTheDocument();
  });

  it('entrega la solicitud de un candidato registrado', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    renderFormulario({ alGuardar });

    await elegir(usuario, /reclutador/i, 'Carolina Muñoz');
    await usuario.type(screen.getByLabelText('Candidato/a *'), 'María González');
    await completarCargo(usuario);
    await usuario.type(screen.getByLabelText(/aspectos a indagar/i), 'Indagar en liderazgo');
    await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(alGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        candidatoId: '1',
        reclutador: 'Carolina Muñoz',
        origen: 'Interno',
        tipoEvaluacion: 'interna',
        cargo: 'Jefe de Centro',
        familiaCargo: 'Jefatura',
        descriptorCargo: 'DC_Jefe_de_Centro.pdf',
        ubicacion: 'Planta Calbuco',
        unidad: 'Industrial',
        ceco: 'A170010311',
        profesionalResponsable: 'Ignacia Valdés Ortiz',
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
    await usuario.type(screen.getByLabelText('Candidato/a *'), 'Pedro Soto');
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

  it('con reclutador fijo no lo pregunta y lo entrega al guardar', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    render(<FormularioSolicitud candidatos={candidatos} alGuardar={alGuardar} reclutadorFijo="Daniela Contreras" />);

    expect(screen.getByText('Daniela Contreras', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /reclutador/i })).toBeNull();
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(screen.queryByText('Debe seleccionar el reclutador/a.')).toBeNull();
  });

  it('muestra al postulante del portal como ficha y no pide su nombre ni su origen', () => {
    render(
      <FormularioSolicitud
        candidatos={candidatos}
        alGuardar={vi.fn()}
        reclutadorFijo="Carolina Muñoz"
        valoresIniciales={{ candidatoId: '1', nombreCandidato: 'Ana Pérez', origen: 'Externo', cv: 'cv-ana.pdf' }}
        postulante={{ nombre: 'Ana Pérez', correo: 'ana.perez@correo.cl', telefono: '+56911112222', origen: 'Externo' }}
      />,
    );
    expect(screen.getByLabelText('Datos del postulante')).toHaveTextContent('ana.perez@correo.cl');
    expect(screen.queryByLabelText('Candidato/a *')).toBeNull();
    expect(screen.queryByRole('group', { name: /origen/i })).toBeNull();
    // El CV llegó con la postulación: no se pide adjuntarlo de nuevo.
    expect(screen.queryByLabelText('Adjuntar CV')).toBeNull();
    expect(screen.getByText('cv-ana.pdf')).toBeInTheDocument();
    // El referido sigue preguntándose para los externos.
    expect(screen.getByRole('group', { name: /referido/i })).toBeInTheDocument();
  });
});
