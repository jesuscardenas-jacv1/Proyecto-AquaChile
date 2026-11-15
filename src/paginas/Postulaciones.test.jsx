import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import Postulaciones from './Postulaciones';
import NuevaSolicitud from './NuevaSolicitud';
import Candidatos from './Candidatos';
import { datosPortal, renderConContexto } from '../pruebas/utilidades';

const analista = { id: 1, nombre: 'Carolina Muñoz', rol: 'analista' };
const jefatura = { id: 4, nombre: 'Patricia Saavedra', rol: 'jefatura' };
const evaluador = { id: 2, nombre: 'Ignacia Valdés', rol: 'evaluador' };

const renderFlujo = (ruta, usuario = analista) =>
  renderConContexto(
    <Routes>
      <Route path="/postulaciones" element={<Postulaciones />} />
      <Route path="/solicitudes/nueva" element={<NuevaSolicitud />} />
      <Route path="/solicitudes/:id" element={<p>Detalle de la solicitud</p>} />
      <Route path="/candidatos" element={<Candidatos />} />
    </Routes>,
    { ruta, datosIniciales: structuredClone(datosPortal), usuario },
  );

describe('Postulaciones (bandeja del analista)', () => {
  it('muestra por defecto las postulaciones recibidas con su oferta', () => {
    renderFlujo('/postulaciones');

    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(1);
    expect(within(filas[0]).getByText('Camilo Fuentealba')).toBeInTheDocument();
    expect(within(filas[0]).getByText('Monitor Producción - Planta Calbuco')).toBeInTheDocument();
  });

  it('muestra el porcentaje del análisis del CV o que aún no se analiza', async () => {
    const datos = structuredClone(datosPortal);
    datos.postulaciones[0].analisisCv = { porcentaje: 80 };
    datos.postulaciones[1].analisisCv = { porcentaje: null };
    const usuario = userEvent.setup();
    renderConContexto(<Postulaciones />, { ruta: '/postulaciones', datosIniciales: datos, usuario: analista });

    expect(screen.getByRole('columnheader', { name: 'Análisis CV' })).toBeInTheDocument();
    const fila = screen.getAllByRole('row')[1];
    expect(within(fila).getByText('80 %')).toBeInTheDocument();
    expect(within(fila).getByRole('progressbar', { name: /cumplimiento de requisitos según el cv: 80 %/i })).toHaveAttribute(
      'aria-valuenow',
      '80',
    );

    // Analizado sin requisitos comprobables, y sin análisis.
    await usuario.click(screen.getByRole('button', { name: /^todas/i }));
    expect(screen.getByText('Sin porcentaje')).toBeInTheDocument();
  });

  it('una postulación sin análisis del CV aparece como "Sin analizar"', () => {
    renderFlujo('/postulaciones');
    expect(within(screen.getAllByRole('row')[1]).getByText('Sin analizar')).toBeInTheDocument();
  });

  it('abre el detalle del postulante al pinchar su nombre o su fila', async () => {
    const usuario = userEvent.setup();
    renderFlujo('/postulaciones');

    await usuario.click(screen.getByRole('button', { name: 'Ver detalle de Camilo Fuentealba' }));
    const ventana = screen.getByRole('dialog', { name: 'Camilo Fuentealba' });
    expect(within(ventana).getByText('Monitor Producción - Planta Calbuco')).toBeInTheDocument();
    await usuario.click(within(ventana).getAllByRole('button', { name: 'Cerrar' }).at(-1));
    expect(screen.queryByRole('dialog')).toBeNull();

    await usuario.click(screen.getAllByRole('row')[1].querySelector('td:nth-child(2)'));
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Descartar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(/se descartó la postulación de camilo/i)).toBeInTheDocument();
  });

  it('descarta y reactiva una postulación', async () => {
    const usuario = userEvent.setup();
    renderFlujo('/postulaciones');

    await usuario.click(screen.getByRole('button', { name: 'Descartar a Camilo Fuentealba' }));
    expect(screen.getByText(/se descartó la postulación de camilo/i)).toBeInTheDocument();
    expect(screen.getByText('Sin postulaciones')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /descartada/i }));
    await usuario.click(screen.getByRole('button', { name: 'Reactivar a Camilo Fuentealba' }));
    expect(screen.getByText(/volvió a recibidas/i)).toBeInTheDocument();
  });

  it('la jefatura consulta sin acciones', () => {
    renderFlujo('/postulaciones', jefatura);
    expect(screen.getByText('Camilo Fuentealba')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pasar a evaluación/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /descartar/i })).toBeNull();
  });

  it('pasa a evaluación con el formulario de solicitud ya completado', async () => {
    const usuario = userEvent.setup();
    renderFlujo('/postulaciones');

    await usuario.click(screen.getByRole('button', { name: 'Pasar a evaluación a Camilo Fuentealba' }));

    expect(screen.getByText('Pasando a evaluación desde una postulación')).toBeInTheDocument();
    // El postulante ya es conocido: se muestra como ficha, sin pedir su nombre ni el reclutador.
    const ficha = screen.getByLabelText('Datos del postulante');
    expect(within(ficha).getByText('Camilo Fuentealba')).toBeInTheDocument();
    expect(screen.queryByLabelText('Candidato/a *')).toBeNull();
    expect(screen.getByText('Carolina Muñoz', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /reclutador/i })).toBeNull();
    expect(screen.getByLabelText(/nombre del cargo/i)).toHaveValue('Monitor Producción');
    expect(screen.getByLabelText(/ubicación del cargo/i)).toHaveValue('Planta Calbuco');
  });
});

describe('Evaluador en Candidatos', () => {
  it('solo ve a los candidatos que pasaron a evaluación', () => {
    renderFlujo('/candidatos', evaluador);

    expect(screen.getByText(/pasó a evaluación psicolaboral/i)).toBeInTheDocument();
    const tabla = screen.getByRole('table');
    expect(within(tabla).queryByText('Camilo Fuentealba')).toBeNull();
    expect(within(tabla).getByText('María González')).toBeInTheDocument();
  });

  it('el analista ve a todos y distingue postulantes de candidatos en evaluación', () => {
    renderFlujo('/candidatos', analista);

    const tabla = screen.getByRole('table');
    const filaPostulante = within(tabla).getByText('Camilo Fuentealba').closest('tr');
    expect(within(filaPostulante).getByText('Postulante')).toBeInTheDocument();
    const filaEnEvaluacion = within(tabla).getByText('María González').closest('tr');
    expect(within(filaEnEvaluacion).getByText('En evaluación')).toBeInTheDocument();
  });
});
