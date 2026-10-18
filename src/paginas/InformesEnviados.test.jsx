import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InformesEnviados, { INFORMES_POR_PAGINA } from './InformesEnviados';
import { ProveedorDatos } from '../datos/DatosContext';
import { ProveedorAuth } from '../datos/AuthContext';
import { USUARIO_TEST_DEFAULT } from '../pruebas/utilidades';

const RESULTADOS = ['Recomendado', 'Recomendado con observaciones', 'No recomendado'];
const RECLUTADORES = ['Javiera Soto', 'Carolina Muñoz'];

/** 30 informes ficticios: alternan resultado y reclutador/a; el id mayor es el más reciente. */
const crearDatos = () => {
  const ids = Array.from({ length: 30 }, (_, i) => i + 1);
  return {
    candidatos: ids.map((id) => ({
      id,
      nombre: `Candidato ${String(id).padStart(2, '0')}`,
      correo: `c${id}@correo.cl`,
      telefono: '+56911112222',
      cargo: id === 7 ? 'Técnico Eléctrico' : 'Operario',
      familiaCargo: 'Operario',
    })),
    solicitudes: ids.map((id) => ({
      id,
      candidatoId: id,
      cargo: id === 7 ? 'Técnico Eléctrico' : 'Operario',
      familiaCargo: 'Operario',
      fechaSolicitud: '2026-01-01',
      estado: 'Finalizada',
      reclutador: RECLUTADORES[id % 2],
      observaciones: '',
    })),
    evaluaciones: ids.map((id) => ({
      id,
      solicitudId: id,
      fechaEvaluacion: `2026-02-${String(id % 28 || 28).padStart(2, '0')}`,
      fechaInforme: `2026-03-${String(id).padStart(2, '0')}`,
      resultado: RESULTADOS[id % 3],
      observaciones: 'Evaluación de prueba.',
      estado: 'Realizada',
    })),
  };
};

const renderInformes = (ruta = '/planner/informes') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAuth usuarioInicial={USUARIO_TEST_DEFAULT}>
        <ProveedorDatos datosIniciales={crearDatos()}>
          <Routes>
            <Route path="/planner/informes" element={<InformesEnviados />} />
            <Route path="/planner" element={<h1>Planner</h1>} />
          </Routes>
        </ProveedorDatos>
      </ProveedorAuth>
    </MemoryRouter>,
  );

const tarjetas = () => screen.getAllByRole('article');

describe('InformesEnviados', () => {
  beforeEach(() => {
    // jsdom no implementa el desplazamiento de la ventana.
    window.scrollTo = vi.fn();
  });

  it('muestra los informes en una grilla paginada, del más reciente al más antiguo', () => {
    renderInformes();

    expect(screen.getByRole('heading', { name: 'Informes enviados' })).toBeInTheDocument();
    expect(tarjetas()).toHaveLength(INFORMES_POR_PAGINA);
    expect(within(tarjetas()[0]).getByText('Candidato 30')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1–12 de 30 informes')).toBeInTheDocument();
  });

  it('cambia de página con la paginación', async () => {
    const usuario = userEvent.setup();
    renderInformes();

    await usuario.click(screen.getByRole('button', { name: 'Página 3' }));
    expect(tarjetas()).toHaveLength(6);
    expect(screen.getByText('Mostrando 25–30 de 30 informes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();

    await usuario.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page');
  });

  it('muestra el resumen por resultado y filtra al hacer clic', async () => {
    const usuario = userEvent.setup();
    renderInformes();

    const tarjetaResumen = screen.getByRole('button', { name: /^no recomendado 10/i });
    await usuario.click(tarjetaResumen);

    expect(tarjetaResumen).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Mostrando 1–10 de 10 informes')).toBeInTheDocument();
    tarjetas().forEach((tarjeta) => expect(within(tarjeta).getByText('No recomendado')).toBeInTheDocument());
  });

  it('busca por texto y por reclutador/a, y limpia los filtros', async () => {
    const usuario = userEvent.setup();
    renderInformes();

    await usuario.type(screen.getByLabelText('Buscar'), 'electrico');
    expect(tarjetas()).toHaveLength(1);
    expect(screen.getByText('Candidato 07')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /limpiar filtros/i }));
    await usuario.selectOptions(screen.getByLabelText('Solicitado por'), 'Carolina Muñoz');
    expect(screen.getByText('Mostrando 1–12 de 15 informes')).toBeInTheDocument();
  });

  it('ordena por nombre', async () => {
    const usuario = userEvent.setup();
    renderInformes();

    await usuario.selectOptions(screen.getByLabelText('Ordenar'), 'nombre');
    expect(within(tarjetas()[0]).getByText('Candidato 01')).toBeInTheDocument();
  });

  it('respeta los filtros recibidos en la URL', () => {
    renderInformes('/planner/informes?solicitante=Javiera%20Soto&pagina=2');
    expect(screen.getByLabelText('Solicitado por')).toHaveValue('Javiera Soto');
    expect(screen.getByText('Mostrando 13–15 de 15 informes')).toBeInTheDocument();
  });

  it('avisa cuando no hay coincidencias', async () => {
    const usuario = userEvent.setup();
    renderInformes();

    await usuario.type(screen.getByLabelText('Buscar'), 'zzz');
    expect(screen.getByText('No hay informes que coincidan')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /páginas/i })).not.toBeInTheDocument();
  });

  it('vuelve al Planner', async () => {
    const usuario = userEvent.setup();
    renderInformes();

    await usuario.click(screen.getByRole('link', { name: /volver al planner/i }));
    expect(screen.getByRole('heading', { name: 'Planner' })).toBeInTheDocument();
  });
});
