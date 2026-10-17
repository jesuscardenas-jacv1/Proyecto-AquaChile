import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import PortalOfertas from './PortalOfertas';
import PortalOferta from './PortalOferta';
import { datosPortal, renderConContexto } from '../../pruebas/utilidades';

const renderPortal = (ruta, subirCv = vi.fn().mockResolvedValue(true)) =>
  renderConContexto(
    <Routes>
      <Route path="/trabaja-con-nosotros" element={<PortalOfertas />} />
      <Route path="/trabaja-con-nosotros/ofertas/:id" element={<PortalOferta subirCv={subirCv} />} />
    </Routes>,
    { ruta, datosIniciales: structuredClone(datosPortal), usuario: null },
  );

async function completarFormulario(usuario, cambios = {}) {
  const datos = {
    nombre: 'Ana Pérez',
    correo: 'ana.perez@correo.cl',
    telefono: '+56911112222',
    ciudad: 'Puerto Montt',
    ...cambios,
  };
  await usuario.type(screen.getByLabelText(/nombre completo/i), datos.nombre);
  await usuario.type(screen.getByLabelText(/correo electrónico/i), datos.correo);
  await usuario.type(screen.getByLabelText(/^teléfono/i), datos.telefono);
  await usuario.type(screen.getByLabelText(/ciudad de residencia/i), datos.ciudad);
  await usuario.click(screen.getByLabelText('No'));
  await usuario.upload(
    screen.getByLabelText(/currículum \(cv\)/i),
    new File(['%PDF'], 'cv_ana.pdf', { type: 'application/pdf' }),
  );
  await usuario.click(screen.getByLabelText(/acepto que aquachile/i));
}

describe('Portal "Trabaja con nosotros"', () => {
  it('lista las ofertas abiertas y filtra por área', async () => {
    const usuario = userEvent.setup();
    renderPortal('/trabaja-con-nosotros');

    expect(screen.getAllByRole('article')).toHaveLength(2);
    await usuario.selectOptions(screen.getByLabelText('Área'), 'Industrial');
    const ofertas = screen.getAllByRole('article');
    expect(ofertas).toHaveLength(1);
    expect(within(ofertas[0]).getByText('Monitor Producción - Planta Calbuco')).toBeInTheDocument();
  });

  it('abre el detalle de una oferta', async () => {
    const usuario = userEvent.setup();
    renderPortal('/trabaja-con-nosotros');

    await usuario.click(screen.getByRole('link', { name: /ver oferta técnico eléctrico/i }));
    expect(screen.getByRole('heading', { level: 1, name: 'Técnico Eléctrico - Puerto Natales' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Postula a esta oferta' })).toBeInTheDocument();
  });

  it('muestra los errores si el formulario está incompleto', async () => {
    const usuario = userEvent.setup();
    renderPortal('/trabaja-con-nosotros/ofertas/1');

    await usuario.click(screen.getByRole('button', { name: /enviar postulación/i }));
    expect(screen.getByText('Revisa los datos del formulario')).toBeInTheDocument();
    expect(screen.getByText('Adjunta tu currículum.')).toBeInTheDocument();
    expect(screen.getByText(/debes aceptar/i)).toBeInTheDocument();
  });

  it('registra la postulación, envía el CV y confirma', async () => {
    const usuario = userEvent.setup();
    const subirCv = vi.fn().mockResolvedValue(true);
    renderPortal('/trabaja-con-nosotros/ofertas/1', subirCv);

    await completarFormulario(usuario);
    await usuario.click(screen.getByRole('button', { name: /enviar postulación/i }));

    expect(await screen.findByText(/gracias por postular, ana/i)).toBeInTheDocument();
    // Nueva postulación (id 3) con el nombre del postulante para la carpeta.
    expect(subirCv).toHaveBeenCalledWith(3, expect.any(File), 'Ana Pérez');
  });

  it('confirma la postulación aunque el CV no llegue al servidor', async () => {
    const usuario = userEvent.setup();
    renderPortal('/trabaja-con-nosotros/ofertas/1', vi.fn().mockResolvedValue(false));

    await completarFormulario(usuario);
    await usuario.click(screen.getByRole('button', { name: /enviar postulación/i }));

    expect(await screen.findByText(/tu currículum quedó registrado/i)).toBeInTheDocument();
  });

  it('avisa si la oferta no existe', () => {
    renderPortal('/trabaja-con-nosotros/ofertas/99');
    expect(screen.getByText('Oferta no disponible')).toBeInTheDocument();
  });
});
