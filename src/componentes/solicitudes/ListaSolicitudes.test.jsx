import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ListaSolicitudes from './ListaSolicitudes';

const candidatos = [
  { id: 1, nombre: 'María González', correo: 'maria@correo.cl', telefono: '+56912345678', cargo: 'Técnico de Planta', familiaCargo: 'Operaciones' },
  { id: 2, nombre: 'Juan Pérez', correo: 'juan@correo.cl', telefono: '+56987654321', cargo: 'Analista de Datos', familiaCargo: 'Tecnología' },
];

const solicitudes = [
  { id: 1, candidatoId: 1, cargo: 'Técnico de Planta', familiaCargo: 'Operaciones', fechaSolicitud: '2026-08-03', estado: 'Finalizada', profesionalResponsable: 'Camila Rojas', observaciones: '' },
  { id: 2, candidatoId: 2, cargo: 'Analista de Datos', familiaCargo: 'Tecnología', fechaSolicitud: '2026-08-17', estado: 'En proceso', profesionalResponsable: 'Sebastián Muñoz', observaciones: '' },
  { id: 3, candidatoId: 1, cargo: 'Técnico de Planta', familiaCargo: 'Operaciones', fechaSolicitud: '2026-09-01', estado: 'Pendiente', profesionalResponsable: '', observaciones: '' },
];

const renderLista = (props = {}) =>
  render(
    <ListaSolicitudes solicitudes={solicitudes} candidatos={candidatos} alAbrir={vi.fn()} {...props} />,
  );

describe('ListaSolicitudes', () => {
  it('muestra las solicitudes con el nombre del candidato y la fecha formateada', () => {
    renderLista();
    const tabla = within(screen.getByRole('table'));

    expect(tabla.getAllByText('María González')).toHaveLength(2);

    expect(tabla.getByText('03-08-2026')).toBeInTheDocument();
    expect(tabla.getByText('Sin asignar')).toBeInTheDocument();
  });

  it('filtra por estado seleccionado', async () => {
    const usuario = userEvent.setup();
    renderLista();

    await usuario.selectOptions(screen.getByLabelText(/^estado/i), 'Pendiente');

    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Mostrando 1 de 3 solicitudes')).toBeInTheDocument();
  });

  it('filtra por familia de cargo', async () => {
    const usuario = userEvent.setup();
    renderLista();

    await usuario.selectOptions(screen.getByLabelText(/familia/i), 'Tecnología');
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.queryByText('03-08-2026')).toBeNull();
  });

  it('busca por nombre del candidato sin distinguir tildes', async () => {
    const usuario = userEvent.setup();
    renderLista();

    await usuario.type(screen.getByLabelText(/^buscar$/i), 'perez');
    expect(screen.getByText('Mostrando 1 de 3 solicitudes')).toBeInTheDocument();
  });

  it('muestra el estado vacío y permite limpiar los filtros', async () => {
    const usuario = userEvent.setup();
    renderLista();

    await usuario.type(screen.getByLabelText(/^buscar$/i), 'no-existe');
    expect(screen.getByText('Sin solicitudes')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Mostrando 3 de 3 solicitudes')).toBeInTheDocument();
  });

  it('entrega la solicitud seleccionada al gestor', async () => {
    const usuario = userEvent.setup();
    const alAbrir = vi.fn();
    renderLista({ alAbrir });

    await usuario.click(screen.getAllByRole('button', { name: 'Gestionar' })[1]);
    expect(alAbrir).toHaveBeenCalledWith(solicitudes[1]);
  });
});
