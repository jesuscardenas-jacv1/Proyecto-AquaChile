import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InformePsicolaboral from './InformePsicolaboral';
import { datosDePrueba } from '../pruebas/utilidades';
import { ProveedorDatos } from '../datos/DatosContext';
import { ProveedorAuth } from '../datos/AuthContext';

function renderInforme(id = '1', usuario = { id: 2, rol: 'evaluador', nombre: 'María Victoria' }) {
  return render(
    <MemoryRouter initialEntries={[`/solicitudes/${id}/informe`]}>
      <ProveedorAuth usuarioInicial={usuario}>
        <ProveedorDatos datosIniciales={structuredClone(datosDePrueba)}>
          <Routes>
            <Route path="/solicitudes/:id/informe" element={<InformePsicolaboral />} />
            <Route path="/solicitudes/:id" element={<h1>Detalle de la solicitud</h1>} />
            <Route path="/solicitudes" element={<h1>Bandeja de solicitudes</h1>} />
          </Routes>
        </ProveedorDatos>
      </ProveedorAuth>
    </MemoryRouter>,
  );
}

describe('InformePsicolaboral', () => {
  it('muestra la cabecera institucional, antecedentes y dictamen de la evaluación', () => {
    renderInforme('1');

    // Cabecera institucional
    expect(screen.getByRole('heading', { name: /informe psicolaboral/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'AquaChile' })).toBeInTheDocument();
    expect(screen.getByText(/folio-apl-0001/i)).toBeInTheDocument();

    // Antecedentes del postulante
    expect(screen.getByText('María González')).toBeInTheDocument();
    expect(screen.getAllByText('Técnico de Planta').length).toBeGreaterThan(0);
    expect(screen.getByText('Técnico B C')).toBeInTheDocument();

    // Dictamen
    expect(screen.getAllByText('Recomendado').length).toBeGreaterThan(0);
    expect(screen.getByText(/desempeñar exitosamente las funciones del cargo/i)).toBeInTheDocument();

    // Firmas y antecedentes
    expect(screen.getAllByText('Carolina Muñoz').length).toBeGreaterThan(0);
    expect(screen.getByText('Dirección de Personas')).toBeInTheDocument();
  });

  it('permite accionar el comando de impresión del navegador', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const usuario = userEvent.setup();
    renderInforme('1');

    const botonImprimir = screen.getByRole('button', { name: /imprimir \/ guardar en pdf/i });
    await usuario.click(botonImprimir);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('permite volver al detalle de la solicitud', async () => {
    const usuario = userEvent.setup();
    renderInforme('1');

    const enlaceVolver = screen.getByRole('link', { name: /volver al detalle/i });
    await usuario.click(enlaceVolver);

    expect(screen.getByRole('heading', { name: 'Detalle de la solicitud' })).toBeInTheDocument();
  });

  it('muestra las observaciones clínicas al profesional evaluador', () => {
    renderInforme('1', { id: 2, rol: 'evaluador', nombre: 'María Victoria' });

    expect(screen.getByText('Perfil estable y buen trabajo en equipo.')).toBeInTheDocument();
  });

  it('muestra nota de confidencialidad y oculta observaciones clínicas al analista', () => {
    renderInforme('1', { id: 1, rol: 'analista', nombre: 'Carolina' });

    expect(screen.getByText(/confidencialidad profesional/i)).toBeInTheDocument();
    expect(screen.queryByText('Perfil estable y buen trabajo en equipo.')).toBeNull();
  });

  it('informa amigablemente cuando la solicitud no cuenta con evaluación', () => {
    // Solicitud 3 está pendiente y sin evaluación
    renderInforme('3');

    expect(screen.getByText('Evaluación pendiente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver al detalle/i })).toBeInTheDocument();
  });

  it('informa cuando la solicitud no existe', () => {
    renderInforme('999');

    expect(screen.getByText('Solicitud no encontrada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver a solicitudes/i })).toBeInTheDocument();
  });
});
