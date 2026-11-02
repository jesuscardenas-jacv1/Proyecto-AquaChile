import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import VentanaPostulante from './VentanaPostulante';

const postulacion = {
  id: 7,
  estado: 'Recibida',
  fechaPostulacion: '2026-10-20',
  ciudad: 'Puerto Varas',
  cvNombre: 'cv-camila.pdf',
  solicitudId: null,
  candidato: { nombre: 'Camila Soto Pérez', correo: 'camila.soto@correo.cl', telefono: '+56912345678', origen: 'Interno' },
  oferta: {
    titulo: 'Operario de Planta - Calbuco',
    cargo: 'Operario de Planta',
    area: 'Producción',
    familiaCargo: 'Operaciones',
    ubicacion: 'Calbuco',
    region: 'Los Lagos',
    jornada: 'Turnos rotativos',
  },
};

const abrir = (props = {}) => {
  const acciones = { alPasarAEvaluacion: vi.fn(), alCambiarEstado: vi.fn(), alCerrar: vi.fn() };
  render(
    <MemoryRouter>
      <VentanaPostulante postulacion={postulacion} {...acciones} {...props} />
    </MemoryRouter>,
  );
  return acciones;
};

describe('VentanaPostulante', () => {
  it('muestra los datos del postulante, la oferta y el CV', () => {
    abrir();
    expect(screen.getByRole('dialog', { name: 'Camila Soto Pérez' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'camila.soto@correo.cl' })).toHaveAttribute('href', 'mailto:camila.soto@correo.cl');
    expect(screen.getByText('+56912345678')).toBeInTheDocument();
    expect(screen.getByText('Puerto Varas')).toBeInTheDocument();
    expect(screen.getByText('Interno (trabaja en AquaChile)')).toBeInTheDocument();
    expect(screen.getByText('Calbuco, Los Lagos')).toBeInTheDocument();
    expect(screen.getByText('Turnos rotativos')).toBeInTheDocument();
    expect(screen.getByText('cv-camila.pdf')).toBeInTheDocument();
    expect(screen.getByText(/la descarga necesita el servidor/i)).toBeInTheDocument();
  });

  it('el analista decide desde la ventana y se cierra con Escape', async () => {
    const usuario = userEvent.setup();
    const acciones = abrir();
    await usuario.click(screen.getByRole('button', { name: 'Pasar a evaluación' }));
    expect(acciones.alPasarAEvaluacion).toHaveBeenCalledWith(postulacion);
    await usuario.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(acciones.alCambiarEstado).toHaveBeenCalledWith(postulacion, 'Descartada');
    await usuario.keyboard('{Escape}');
    expect(acciones.alCerrar).toHaveBeenCalled();
  });

  it('la jefatura solo consulta', () => {
    abrir({ soloLectura: true });
    expect(screen.queryByRole('button', { name: 'Pasar a evaluación' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Cerrar' })).toHaveLength(2);
  });

  it('con servidor descarga el CV y muestra el error si falla', async () => {
    const usuario = userEvent.setup();
    const api = { descargarCvPostulacion: vi.fn().mockRejectedValueOnce(new Error('El postulante no tiene un CV cargado.')) };
    abrir({ conServidor: true, api });
    await usuario.click(screen.getByRole('button', { name: 'Descargar CV' }));
    expect(api.descargarCvPostulacion).toHaveBeenCalledWith(postulacion);
    expect(await screen.findByRole('alert')).toHaveTextContent('El postulante no tiene un CV cargado.');
  });

  it('una postulación en evaluación enlaza a su solicitud', () => {
    abrir({ postulacion: { ...postulacion, estado: 'En evaluación', solicitudId: 12 } });
    expect(screen.getByRole('link', { name: 'Ver solicitud #12' })).toHaveAttribute('href', '/solicitudes/12');
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull();
  });
});
