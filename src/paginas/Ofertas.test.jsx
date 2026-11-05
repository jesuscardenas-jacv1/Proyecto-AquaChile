import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CARGOS } from '../datos/catalogos';
import { apiDocumentos } from '../servicios/apiDocumentos';
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

  it('exige el descriptor para publicar un cargo fuera del catálogo y lo muestra al subirlo', async () => {
    const usuario = userEvent.setup();
    renderOfertas('/ofertas/nueva');

    await completar(usuario, 'Operario Nuevo');
    await usuario.click(screen.getByRole('button', { name: 'Publicar oferta' }));
    expect(screen.getByText('Sube el descriptor de cargo para publicar la oferta.')).toBeInTheDocument();

    const archivo = new File(['pdf'], 'descriptor-operario.pdf', { type: 'application/pdf' });
    await usuario.upload(screen.getByLabelText(/descriptor de cargo/i), archivo);
    await usuario.click(screen.getByRole('button', { name: 'Publicar oferta' }));

    expect(await screen.findByText('Oferta publicada en el portal.')).toBeInTheDocument();
    const fila = screen.getByText('Operario Nuevo').closest('tr');
    expect(within(fila).getByText('Publicada')).toBeInTheDocument();
    expect(within(fila).getByText('descriptor-operario.pdf')).toBeInTheDocument();
  });

  it('un cargo del catálogo completa la familia y ya trae su descriptor', async () => {
    const usuario = userEvent.setup();
    const cargo = CARGOS[0];
    renderOfertas('/ofertas/nueva');

    await usuario.type(screen.getByLabelText(/^cargo/i), cargo.nombre);

    expect(screen.getByLabelText(/familia de cargo/i)).toHaveValue(cargo.familiaCargo);
    expect(screen.getByText(cargo.descriptorCargo)).toBeInTheDocument();
    expect(screen.getByText(/asociado al cargo/i)).toBeInTheDocument();
  });

  it('si no se puede subir el descriptor, la oferta queda como borrador', async () => {
    const usuario = userEvent.setup();
    const espia = vi.spyOn(apiDocumentos, 'conectado').mockReturnValue(true);
    const subir = vi.spyOn(apiDocumentos, 'subirDescriptorOferta').mockRejectedValue(new Error('Sin servicio.'));
    renderOfertas('/ofertas/nueva');

    await completar(usuario, 'Operario Sin Archivo');
    await usuario.upload(screen.getByLabelText(/descriptor de cargo/i), new File(['pdf'], 'd.pdf'));
    await usuario.click(screen.getByRole('button', { name: 'Publicar oferta' }));

    expect(await screen.findByText(/no se pudo subir el descriptor: sin servicio\. quedó como borrador/i)).toBeInTheDocument();
    expect(within(screen.getByText('Operario Sin Archivo').closest('tr')).getByText('Borrador')).toBeInTheDocument();
    espia.mockRestore();
    subir.mockRestore();
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
