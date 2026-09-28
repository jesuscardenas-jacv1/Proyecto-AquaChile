import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ListaCandidatos from './ListaCandidatos';

const candidatos = [
  { id: 1, nombre: 'María González', correo: 'maria@correo.cl', telefono: '+56912345678', cargo: 'Técnico de Planta', familiaCargo: 'Operaciones' },
  { id: 2, nombre: 'Juan Pérez', correo: 'juan@correo.cl', telefono: '+56987654321', cargo: 'Analista de Datos', familiaCargo: 'Tecnología' },
];

const renderLista = (props = {}) =>
  render(
    <MemoryRouter>
      <ListaCandidatos candidatos={candidatos} alEditar={vi.fn()} {...props} />
    </MemoryRouter>,
  );

describe('ListaCandidatos', () => {
  it('muestra una fila por candidato con sus datos', () => {
    renderLista();
    const tabla = within(screen.getByRole('table'));

    // 1 fila de encabezado + 2 candidatos (la vista responsive de tarjetas no usa tablas)
    expect(tabla.getAllByRole('row')).toHaveLength(3);
    expect(tabla.getByText('maria@correo.cl')).toBeInTheDocument();
    expect(tabla.getByText('Analista de Datos')).toBeInTheDocument();
  });

  it('filtra los candidatos según el texto de búsqueda', async () => {
    const usuario = userEvent.setup();
    renderLista();
    const tabla = within(screen.getByRole('table'));

    await usuario.type(screen.getByLabelText(/buscar candidato/i), 'tecnolog');
    expect(tabla.queryByText('maria@correo.cl')).toBeNull();
    expect(tabla.getByText('juan@correo.cl')).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando la búsqueda no tiene coincidencias', async () => {
    const usuario = userEvent.setup();
    renderLista();

    await usuario.type(screen.getByLabelText(/buscar candidato/i), 'zzzz');
    expect(screen.getByText('Sin candidatos')).toBeInTheDocument();
    expect(screen.getByText(/Ningún candidato coincide/i)).toBeInTheDocument();
  });

  it('invoca alEditar con el candidato seleccionado', async () => {
    const usuario = userEvent.setup();
    const alEditar = vi.fn();
    renderLista({ alEditar });

    await usuario.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    expect(alEditar).toHaveBeenCalledWith(candidatos[0]);
  });

  it('ofrece eliminar solo si se entrega la función', async () => {
    const usuario = userEvent.setup();
    const alEliminar = vi.fn();
    renderLista({ alEliminar });

    await usuario.click(screen.getAllByRole('button', { name: 'Eliminar' })[1]);
    expect(alEliminar).toHaveBeenCalledWith(candidatos[1]);
  });

  it('indica cuántos candidatos se están mostrando', async () => {
    const usuario = userEvent.setup();
    renderLista();
    expect(screen.getByText('2 de 2 registrados')).toBeInTheDocument();

    await usuario.type(screen.getByLabelText(/buscar candidato/i), 'maría');
    expect(screen.getByText('1 de 2 registrados')).toBeInTheDocument();
  });
});
