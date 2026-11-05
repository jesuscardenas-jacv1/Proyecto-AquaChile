import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import NuevaSolicitud from './NuevaSolicitud';
import Solicitudes from './Solicitudes';
import { ProveedorDatos, useDatos } from '../datos/DatosContext';
import { ProveedorAuth } from '../datos/AuthContext';
import { apiDocumentos } from '../servicios/apiDocumentos';
import { datosDePrueba, datosVacios } from '../pruebas/utilidades';

const DetalleFalso = () => {
  const { id } = useParams();
  const { obtenerSolicitud, obtenerCandidato } = useDatos();
  const candidato = obtenerCandidato(obtenerSolicitud(id)?.candidatoId);
  const { state } = useLocation();
  return (
    <>
      <h1>Detalle de solicitud #{id}</h1>
      <p>{state?.mensaje}</p>
      <p>Candidato: {candidato?.nombre}</p>
    </>
  );
};

// Sin usuario indicado se usa el de pruebas por defecto (administrador).
const renderNueva = (datosIniciales, usuario) =>
  render(
    <MemoryRouter initialEntries={['/solicitudes/nueva']}>
      <ProveedorAuth usuarioInicial={usuario}>
        <ProveedorDatos datosIniciales={structuredClone(datosIniciales)}>
          <Routes>
            <Route path="/solicitudes/nueva" element={<NuevaSolicitud />} />
            <Route path="/solicitudes/:id" element={<DetalleFalso />} />
            <Route path="/candidatos/nuevo" element={<h1>Formulario nuevo candidato</h1>} />
          </Routes>
        </ProveedorDatos>
      </ProveedorAuth>
    </MemoryRouter>,
  );

const administrador = { id: 9, nombre: 'Administrador Demo', rol: 'admin' };

const renderListado = (datosIniciales = datosDePrueba, ruta = '/solicitudes') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorDatos datosIniciales={structuredClone(datosIniciales)}>
        <Routes>
          <Route path="/solicitudes" element={<Solicitudes />} />
          <Route path="/solicitudes/nueva" element={<h1>Formulario nueva solicitud</h1>} />
        </Routes>
      </ProveedorDatos>
    </MemoryRouter>,
  );

const elegir = (usuario, nombreGrupo, opcion) =>
  usuario.click(
    within(screen.getByRole('group', { name: nombreGrupo })).getByRole('radio', { name: opcion }),
  );

async function completarSolicitud(usuario, nombreCandidato) {
  await elegir(usuario, /reclutador/i, 'Carolina Muñoz');
  await usuario.type(screen.getByLabelText('Candidato/a *'), nombreCandidato);
  await usuario.type(screen.getByLabelText(/ubicación del cargo/i), 'Oficina Central');
  await usuario.selectOptions(screen.getByLabelText(/^ceco/i), 'A170010311');
  await usuario.selectOptions(screen.getByLabelText(/psicóloga responsable/i), 'Ignacia Valdés Ortiz');
  await elegir(usuario, /requiere referencias/i, 'Sí');
}

// El cargo de María González no está en el catálogo: hay que adjuntar su descriptor.
const adjuntarDescriptor = (usuario) =>
  usuario.upload(
    screen.getByLabelText(/adjuntar descriptor de cargo/i),
    new File(['dc'], 'dc-tecnico.pdf', { type: 'application/pdf' }),
  );

describe('NuevaSolicitud', () => {
  it('el analista con sesión es quien solicita: no se le pregunta el reclutador', () => {
    renderNueva(datosDePrueba, { id: 1, nombre: 'Carolina Muñoz', rol: 'analista' });
    expect(screen.getByText('Carolina Muñoz', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /reclutador/i })).toBeNull();
    expect(screen.getByLabelText('Candidato/a *')).toHaveAttribute(
      'placeholder',
      'Buscar registrado o escribir uno nuevo',
    );
  });

  it('el administrador elige a nombre de qué reclutador/a la pide', () => {
    renderNueva(datosDePrueba, administrador);
    expect(screen.getByRole('group', { name: /reclutador\/a que solicita/i })).toBeInTheDocument();
  });

  it('crea la solicitud de un candidato registrado y navega al detalle', async () => {
    const usuario = userEvent.setup();
    renderNueva(datosDePrueba, administrador);

    await completarSolicitud(usuario, 'María González');
    await elegir(usuario, /origen/i, 'Interno');
    await adjuntarDescriptor(usuario);
    await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(screen.getByRole('heading', { name: /detalle de solicitud #4/i })).toBeInTheDocument();
    expect(screen.getByText('Candidato: María González')).toBeInTheDocument();
  });

  it('no crea la solicitud si el cargo no tiene descriptor', async () => {
    const usuario = userEvent.setup();
    renderNueva(datosDePrueba, administrador);

    await completarSolicitud(usuario, 'María González');
    await elegir(usuario, /origen/i, 'Interno');
    await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(screen.getByText(/este cargo no tiene descriptor/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /detalle de solicitud #4/i })).toBeNull();
  });

  describe('adjuntos del formulario', () => {
    afterEach(() => vi.restoreAllMocks());

    const completarConCv = async (usuario) => {
      await completarSolicitud(usuario, 'María González');
      await elegir(usuario, /origen/i, 'Interno');
      await usuario.upload(screen.getByLabelText('Adjuntar CV'), new File(['cv'], 'cv-maria.pdf', { type: 'application/pdf' }));
      await adjuntarDescriptor(usuario);
      await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));
    };

    it('sube a la carpeta el archivo elegido, no solo su nombre', async () => {
      vi.spyOn(apiDocumentos, 'conectado').mockReturnValue(true);
      const subir = vi.spyOn(apiDocumentos, 'subir').mockResolvedValue({ ok: true });
      const guardarEnCargo = vi
        .spyOn(apiDocumentos, 'subirDescriptorCargo')
        .mockResolvedValue({ id: 1, nombre: 'Técnico de Planta', familiaCargo: 'Técnico B C', descriptorNombre: 'dc-tecnico.pdf' });
      const usuario = userEvent.setup();
      renderNueva(datosDePrueba, administrador);
      await completarConCv(usuario);

      expect(await screen.findByText(/solicitud enviada/i)).toBeInTheDocument();
      // El CV y el descriptor quedan en la carpeta, y el descriptor además se guarda para el cargo.
      expect(subir.mock.calls.map(([, datos]) => datos.categoria).sort()).toEqual(['cv', 'descriptor']);
      expect(guardarEnCargo).toHaveBeenCalledTimes(1);
      const [, { archivo, nombreCandidato }] = subir.mock.calls.find(([, datos]) => datos.categoria === 'cv');
      expect(archivo.name).toBe('cv-maria.pdf');
      expect(nombreCandidato).toBe('María González');
    });

    it('si la subida falla la solicitud queda creada y lo avisa', async () => {
      vi.spyOn(apiDocumentos, 'conectado').mockReturnValue(true);
      vi.spyOn(apiDocumentos, 'subir').mockRejectedValue(new Error('Sin conexión'));
      const usuario = userEvent.setup();
      renderNueva(datosDePrueba, administrador);
      await completarConCv(usuario);
      expect(await screen.findByText(/vuelve a subirlo en documentos/i)).toBeInTheDocument();
    });
  });

  it('registra al candidato nuevo junto con la solicitud', async () => {
    const usuario = userEvent.setup();
    renderNueva(datosVacios);

    await completarSolicitud(usuario, 'Pedro Soto');
    await usuario.type(screen.getByLabelText(/correo del candidato/i), 'pedro@correo.cl');
    await usuario.type(screen.getByLabelText(/teléfono del candidato/i), '+56911112222');
    await elegir(usuario, /origen/i, 'Externo');
    await usuario.type(screen.getByLabelText(/nombre del cargo/i), 'Jefe de Centro');
    await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(screen.getByRole('heading', { name: /detalle de solicitud #1/i })).toBeInTheDocument();
    expect(screen.getByText('Candidato: Pedro Soto')).toBeInTheDocument();
  });
});

describe('Solicitudes', () => {
  it('muestra el total de solicitudes', () => {
    renderListado();
    expect(screen.getByText(/3 solicitudes registradas/)).toBeInTheDocument();
  });

  it('usa el singular cuando hay una sola solicitud', () => {
    renderListado({ ...datosDePrueba, solicitudes: [datosDePrueba.solicitudes[0]] });
    expect(screen.getByText(/1 solicitud registrada/)).toBeInTheDocument();
  });

  it('navega al formulario de nueva solicitud', async () => {
    const usuario = userEvent.setup();
    renderListado();

    await usuario.click(screen.getByRole('button', { name: /nueva solicitud/i }));
    expect(
      screen.getByRole('heading', { name: /formulario nueva solicitud/i }),
    ).toBeInTheDocument();
  });

  it('aplica el filtro de estado recibido en la URL', () => {
    renderListado(datosDePrueba, '/solicitudes?estado=En%20proceso');
    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('En proceso');
  });

  describe('con el perfil de la psicóloga', () => {
    const psicologa = { id: 2, nombre: 'Ignacia Valdés Ortiz', rol: 'evaluador' };
    const renderComoPsicologa = (ruta) =>
      render(
        <MemoryRouter initialEntries={[ruta]}>
          <ProveedorAuth usuarioInicial={psicologa}>
            <ProveedorDatos datosIniciales={structuredClone(datosDePrueba)}>
              <Routes>
                <Route path="/solicitudes" element={<Solicitudes />} />
              </Routes>
            </ProveedorDatos>
          </ProveedorAuth>
        </MemoryRouter>,
      );

    it('parte viendo las suyas y las sin asignar, no las de otra psicóloga', () => {
      renderComoPsicologa('/solicitudes');
      expect(screen.getByLabelText(/psicóloga responsable/i)).toHaveDisplayValue('Mías y sin asignar');
      // #1 es suya, #3 no tiene psicóloga y #2 es de otra.
      expect(screen.getByText(/mostrando 2 de 3 solicitudes/i)).toBeInTheDocument();
    });

    it('desde el dashboard (?estado=Pendiente) ve todas las pendientes, que aún no tienen psicóloga', () => {
      renderComoPsicologa('/solicitudes?estado=Pendiente');
      expect(screen.getByLabelText(/psicóloga responsable/i)).toHaveValue('');
      expect(screen.getByText(/mostrando 1 de 3 solicitudes/i)).toBeInTheDocument();
    });
  });

  it('ignora un estado desconocido en la URL', () => {
    renderListado(datosDePrueba, '/solicitudes?estado=Inventado');
    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('');
  });
});
