import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import DetalleCandidato from './DetalleCandidato';
import Candidatos from './Candidatos';
import { datosDePrueba, renderConContexto } from '../pruebas/utilidades';

const evaluador = { id: 2, nombre: 'Ignacia Valdés Ortiz', rol: 'evaluador' };
const analista = { id: 1, nombre: 'Carolina Muñoz', rol: 'analista' };

function renderFicha(ruta, usuario = evaluador) {
  return renderConContexto(
    <Routes>
      <Route path="/candidatos" element={<Candidatos />} />
      <Route path="/candidatos/:id" element={<DetalleCandidato />} />
      <Route path="/solicitudes/:id" element={<p>Detalle de solicitud</p>} />
    </Routes>,
    { ruta, datosIniciales: datosDePrueba, usuario },
  );
}

describe('DetalleCandidato', () => {
  it('muestra los datos del candidato y una carpeta de documentos por solicitud', () => {
    renderFicha('/candidatos/1');

    expect(screen.getByRole('heading', { level: 1, name: 'María González' })).toBeInTheDocument();
    expect(screen.getByText('maria.gonzalez@correo.cl')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evaluaciones y documentos (2)' })).toBeInTheDocument();

    const solicitudes = screen.getAllByRole('article');
    // La más reciente primero.
    expect(within(solicitudes[0]).getByText(/Solicitud #3/)).toBeInTheDocument();
    expect(within(solicitudes[1]).getByText(/Solicitud #1/)).toBeInTheDocument();
    expect(within(solicitudes[1]).getByText('Recomendado')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Documentos' })).toHaveLength(2);
  });

  it('el evaluador no ve la opción de editar; el analista sí', () => {
    renderFicha('/candidatos/1');
    expect(screen.queryByRole('link', { name: /editar/i })).toBeNull();
  });

  it('el analista puede ir a editar desde la ficha', () => {
    renderFicha('/candidatos/1', analista);
    expect(screen.getByRole('link', { name: /editar/i })).toHaveAttribute('href', '/candidatos/1/editar');
  });

  it('enlaza cada carpeta con su solicitud', async () => {
    const usuario = userEvent.setup();
    renderFicha('/candidatos/2');

    await usuario.click(screen.getByRole('link', { name: /ver solicitud/i }));
    expect(screen.getByText('Detalle de solicitud')).toBeInTheDocument();
  });

  it('avisa cuando el candidato no tiene solicitudes', () => {
    renderConContexto(
      <Routes>
        <Route path="/candidatos/:id" element={<DetalleCandidato />} />
      </Routes>,
      {
        ruta: '/candidatos/9',
        datosIniciales: {
          ...datosDePrueba,
          candidatos: [...datosDePrueba.candidatos, { ...datosDePrueba.candidatos[0], id: 9 }],
        },
        usuario: evaluador,
      },
    );
    expect(screen.getByText('Sin solicitudes de evaluación')).toBeInTheDocument();
  });

  it('informa si el candidato no existe', () => {
    renderFicha('/candidatos/999');
    expect(screen.getByText('Candidato no encontrado')).toBeInTheDocument();
  });
});

describe('Candidatos para el evaluador', () => {
  it('abre la ficha al pinchar el candidato y oculta las acciones del analista', async () => {
    const usuario = userEvent.setup();
    renderFicha('/candidatos');

    expect(screen.queryByRole('button', { name: /nuevo candidato/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /nuevo candidato/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).toBeNull();

    const tabla = screen.getByRole('table');
    await usuario.click(within(tabla).getByRole('link', { name: 'Juan Pérez' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Juan Pérez' })).toBeInTheDocument();
  });
});
