import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DetalleSolicitud from './DetalleSolicitud';
import { datosDePrueba } from '../pruebas/utilidades';
import { ProveedorDatos } from '../datos/DatosContext';
import { ProveedorAuth } from '../datos/AuthContext';
import { apiDocumentos } from '../servicios/apiDocumentos';

const renderDetalle = (id = '3') =>
  render(
    <MemoryRouter initialEntries={[`/solicitudes/${id}`]}>
      <ProveedorDatos datosIniciales={structuredClone(datosDePrueba)}>
        <Routes>
          <Route path="/solicitudes/:id" element={<DetalleSolicitud />} />
          <Route path="/solicitudes" element={<h1>Listado de solicitudes</h1>} />
        </Routes>
      </ProveedorDatos>
    </MemoryRouter>,
  );

describe('DetalleSolicitud', () => {
  it('muestra los datos de la solicitud y del candidato', () => {
    renderDetalle('3');
    expect(screen.getByRole('heading', { name: /solicitud #3/i })).toBeInTheDocument();
    expect(screen.getAllByText('Técnico de Planta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0);
    expect(screen.getByText('maria.gonzalez@correo.cl')).toBeInTheDocument();
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
  });

  it('informa cuando la solicitud no existe', () => {
    renderDetalle('99');
    expect(screen.getByText('Solicitud no encontrada')).toBeInTheDocument();
  });

  it('asigna la psicóloga responsable', async () => {
    const usuario = userEvent.setup();
    renderDetalle('3');

    await usuario.selectOptions(
      screen.getByLabelText(/psicóloga responsable/i),
      'Tomás Riquelme Soto',
    );

    expect(screen.getByLabelText(/psicóloga responsable/i)).toHaveValue('Tomás Riquelme Soto');
  });

  it('cambia el estado de la solicitud a En proceso', async () => {
    const usuario = userEvent.setup();
    renderDetalle('3');

    await usuario.selectOptions(screen.getByLabelText(/^estado$/i), 'En proceso');

    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('En proceso');
  });

  it('no permite evaluar una solicitud en estado Pendiente', () => {
    renderDetalle('3');
    expect(screen.getByText(/debe estar en estado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar evaluación/i })).toBeNull();
  });

  it('muestra el formulario de evaluación cuando la solicitud está en proceso', async () => {
    const usuario = userEvent.setup();
    renderDetalle('2');

    expect(screen.getByRole('button', { name: /registrar evaluación/i })).toBeInTheDocument();
    await usuario.click(screen.getByRole('radio', { name: 'Recomendado' }));
  });

  it('muestra la solicitud como Finalizada tras registrar la evaluación', async () => {
    const usuario = userEvent.setup();
    renderDetalle('2');

    await usuario.click(screen.getByRole('radio', { name: 'Recomendado' }));
    await usuario.type(
      screen.getByLabelText(/^observaciones/i),
      'Perfil adecuado para el cargo evaluado.',
    );
    await usuario.click(screen.getByRole('button', { name: /registrar evaluación/i }));

    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('Finalizada');
    expect(screen.queryByRole('button', { name: /guardar cambios/i })).toBeNull();
  });

  it('permite volver al listado de solicitudes', async () => {
    const usuario = userEvent.setup();
    renderDetalle('3');

    await usuario.click(screen.getByRole('button', { name: /volver a solicitudes/i }));
    expect(screen.getByRole('heading', { name: /listado de solicitudes/i })).toBeInTheDocument();
  });

  it('para un analista muestra solo el dictamen y oculta las observaciones por confidencialidad', () => {
    render(
      <MemoryRouter initialEntries={['/solicitudes/1']}>
        <ProveedorAuth usuarioInicial={{ id: 1, rol: 'analista', nombre: 'Carolina' }}>
          <ProveedorDatos datosIniciales={structuredClone(datosDePrueba)}>
            <Routes>
              <Route path="/solicitudes/:id" element={<DetalleSolicitud />} />
            </Routes>
          </ProveedorDatos>
        </ProveedorAuth>
      </MemoryRouter>,
    );

    // Muestra la tarjeta de dictamen
    expect(screen.getByText(/dictamen de la evaluación/i)).toBeInTheDocument();
    expect(screen.getByText(/confidencial/i)).toBeInTheDocument();
    // La observación cualitativa 'Perfil estable y buen trabajo en equipo.' NO debe mostrarse al analista
    expect(screen.queryByText('Perfil estable y buen trabajo en equipo.')).toBeNull();
    // No debe mostrar el formulario de evaluación al analista
    expect(screen.queryByRole('button', { name: /registrar evaluación/i })).toBeNull();
  });
  describe('informe en la carpeta de la solicitud', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const registrarRecomendado = async (usuario) => {
      await usuario.click(screen.getByRole('radio', { name: 'Recomendado' }));
      await usuario.type(screen.getByLabelText(/^observaciones/i), 'Nota clínica reservada.');
      await usuario.click(screen.getByRole('button', { name: /registrar evaluación/i }));
    };

    it('guarda el informe en la carpeta al registrar la evaluación y recarga los documentos', async () => {
      vi.spyOn(apiDocumentos, 'conectado').mockReturnValue(true);
      const listar = vi
        .spyOn(apiDocumentos, 'listar')
        .mockResolvedValue({ proveedor: 'local', carpeta: null, archivos: [], permisos: ['informe'] });
      const generarInforme = vi.spyOn(apiDocumentos, 'generarInforme').mockResolvedValue({ ok: true });
      const usuario = userEvent.setup();
      renderDetalle('2');
      await screen.findByText(/la carpeta se crea al subir/i);

      await registrarRecomendado(usuario);

      expect(
        await screen.findByText(/el informe psicolaboral se guardó en la carpeta/i),
      ).toBeInTheDocument();
      const [solicitudId, datos] = generarInforme.mock.calls[0];
      expect(solicitudId).toBe(2);
      expect(datos.candidato.nombre).toBe('Juan Pérez');
      expect(datos.solicitud.cargo).toBe('Analista de Datos');
      expect(datos.evaluacion.resultado).toBe('Recomendado');
      expect(listar).toHaveBeenCalledTimes(2);
    });

    it('registra la evaluación aunque el servicio de documentos no esté conectado', async () => {
      const generarInforme = vi.spyOn(apiDocumentos, 'generarInforme');
      const usuario = userEvent.setup();
      renderDetalle('2');

      await registrarRecomendado(usuario);

      expect(screen.getByLabelText(/^estado$/i)).toHaveValue('Finalizada');
      expect(screen.getByText(/el informe no se guardó en la carpeta/i)).toBeInTheDocument();
      expect(generarInforme).not.toHaveBeenCalled();
    });

    it('avisa si el backend no pudo guardar el informe', async () => {
      vi.spyOn(apiDocumentos, 'conectado').mockReturnValue(true);
      vi.spyOn(apiDocumentos, 'listar').mockResolvedValue({
        proveedor: 'local',
        carpeta: null,
        archivos: [],
        permisos: ['informe'],
      });
      vi.spyOn(apiDocumentos, 'generarInforme').mockRejectedValue(new Error('Error de Microsoft Graph (503)'));
      const usuario = userEvent.setup();
      renderDetalle('2');
      await screen.findByText(/la carpeta se crea al subir/i);

      await registrarRecomendado(usuario);

      expect(
        await screen.findByText(/no se pudo guardar el informe en la carpeta: error de microsoft graph/i),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/^estado$/i)).toHaveValue('Finalizada');
    });
  });
  describe('editar datos de la solicitud', () => {
    it('corrige el cargo y los datos se ven actualizados', async () => {
      const usuario = userEvent.setup();
      renderDetalle('2');

      await usuario.click(screen.getByRole('button', { name: 'Editar' }));
      await usuario.selectOptions(screen.getByLabelText(/reclutador/i), 'Carolina Muñoz');
      await usuario.clear(screen.getByLabelText(/nombre del cargo/i));
      await usuario.type(screen.getByLabelText(/nombre del cargo/i), 'Analista de Sistemas');
      await usuario.type(screen.getByLabelText(/ubicación del cargo/i), 'Oficina Central');
      await usuario.type(screen.getByLabelText(/^ceco/i), 'A170010311');
      await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByText('Datos de la solicitud actualizados.')).toBeInTheDocument();
      expect(screen.getByText(/analista de sistemas · /i)).toBeInTheDocument();
      expect(screen.getByText('A170010311')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
    });

    it('la jefatura (solo lectura) no puede editar', () => {
      render(
        <MemoryRouter initialEntries={['/solicitudes/2']}>
          <ProveedorAuth usuarioInicial={{ id: 4, rol: 'jefatura', nombre: 'Jefatura' }}>
            <ProveedorDatos datosIniciales={structuredClone(datosDePrueba)}>
              <Routes>
                <Route path="/solicitudes/:id" element={<DetalleSolicitud />} />
              </Routes>
            </ProveedorDatos>
          </ProveedorAuth>
        </MemoryRouter>,
      );
      expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    });
  });
});
