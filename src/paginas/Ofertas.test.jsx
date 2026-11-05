import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Ofertas from './Ofertas';
import NuevaOferta from './NuevaOferta';
import EditarOferta from './EditarOferta';
import PortalOfertas from './portal/PortalOfertas';
import { datosPortal, renderConContexto } from '../pruebas/utilidades';

const analista = { id: 1, nombre: 'Analista Demo', rol: 'analista' };
const jefatura = { id: 4, nombre: 'Jefatura Demo', rol: 'jefatura' };

const renderOfertas = (ruta = '/ofertas', usuario = analista) =>
  renderConContexto(
    <Routes>
      <Route path="/ofertas" element={<Ofertas />} />
      <Route path="/ofertas/nueva" element={<NuevaOferta />} />
      <Route path="/ofertas/:id/editar" element={<EditarOferta />} />
      <Route path="/trabaja-con-nosotros" element={<PortalOfertas />} />
    </Routes>,
    { ruta, datosIniciales: structuredClone(datosPortal), usuario },
  );

const completar = async (usuario, titulo) => {
  await usuario.type(screen.getByLabelText(/título de la oferta/i), titulo);
  await usuario.selectOptions(screen.getByLabelText(/^área/i), 'Producción');
  await usuario.selectOptions(screen.getByLabelText(/familia de cargo/i), 'Operario');
  await usuario.type(screen.getByLabelText(/^cargo/i), 'Operario');
  await usuario.type(screen.getByLabelText(/ubicación/i), 'Calbuco');
  await usuario.type(screen.getByLabelText(/región/i), 'Los Lagos');
  await usuario.type(screen.getByLabelText(/descripción del cargo/i), 'Apoyo en la línea.');
};

describe('Ofertas (gestión del analista)', () => {
  it('guarda un borrador solo con el título, sin mostrarlo en el portal', async () => {
    const usuario = userEvent.setup();
    renderOfertas('/ofertas/nueva');

    await usuario.type(screen.getByLabelText(/título de la oferta/i), 'Oferta en preparación');
    await usuario.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    expect(await screen.findByText('Borrador guardado.')).toBeInTheDocument();
    const fila = screen.getByText('Oferta en preparación').closest('tr');
    expect(within(fila).getByText('Borrador')).toBeInTheDocument();
  });

  it('no publica una oferta incompleta y explica qué falta', async () => {
    const usuario = userEvent.setup();
    renderOfertas('/ofertas/nueva');

    await usuario.type(screen.getByLabelText(/título de la oferta/i), 'Oferta incompleta');
    await usuario.click(screen.getByRole('button', { name: 'Publicar oferta' }));

    expect(screen.getByText('Selecciona el área.')).toBeInTheDocument();
    expect(screen.getByText('Describe el cargo.')).toBeInTheDocument();
  });

  it('publica una oferta nueva con la fecha del día', async () => {
    const usuario = userEvent.setup();
    renderOfertas('/ofertas/nueva');

    await completar(usuario, 'Operario Nuevo');
    await usuario.click(screen.getByRole('button', { name: 'Publicar oferta' }));

    expect(await screen.findByText('Oferta publicada en el portal.')).toBeInTheDocument();
    const fila = screen.getByText('Operario Nuevo').closest('tr');
    expect(within(fila).getByText('Publicada')).toBeInTheDocument();
  });

  it('edita una oferta publicada, y la cierra y reabre desde el listado', async () => {
    const usuario = userEvent.setup();
    const oferta = datosPortal.ofertas[0];
    renderOfertas(`/ofertas/${oferta.id}/editar`);

    const titulo = screen.getByLabelText(/título de la oferta/i);
    await usuario.clear(titulo);
    await usuario.type(titulo, 'Título corregido');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Oferta actualizada.')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Cerrar Título corregido' }));
    expect(within(screen.getByText('Título corregido').closest('tr')).getByText('Cerrada')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Reabrir Título corregido' }));
    expect(within(screen.getByText('Título corregido').closest('tr')).getByText('Publicada')).toBeInTheDocument();
  });

  it('avisa si se intenta publicar desde el listado un borrador incompleto', async () => {
    const usuario = userEvent.setup();
    renderOfertas('/ofertas/nueva');

    await usuario.type(screen.getByLabelText(/título de la oferta/i), 'Borrador corto');
    await usuario.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await usuario.click(await screen.findByRole('button', { name: 'Publicar Borrador corto' }));

    expect(screen.getByText(/completa "borrador corto" antes de publicarla/i)).toBeInTheDocument();
    expect(within(screen.getByText('Borrador corto').closest('tr')).getByText('Borrador')).toBeInTheDocument();
  });

  it('la jefatura consulta el listado sin acciones', () => {
    renderOfertas('/ofertas', jefatura);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nueva oferta' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Editar/ })).toBeNull();
  });

  it('avisa si la oferta a editar no existe', () => {
    renderOfertas('/ofertas/999/editar');
    expect(screen.getByText('Oferta no encontrada')).toBeInTheDocument();
  });
});
