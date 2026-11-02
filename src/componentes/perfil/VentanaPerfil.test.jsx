import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProveedorAuth, leerFotoLocal, useAuth } from '../../datos/AuthContext';
import VentanaPerfil from './VentanaPerfil';

vi.mock('../../servicios/imagen', async (original) => ({
  ...(await original()),
  reducirFoto: vi.fn().mockResolvedValue('data:image/jpeg;base64,Rk9UTw=='),
}));

const analista = {
  id: 1,
  nombre: 'Carolina Muñoz',
  correo: 'carolina.munoz@aquachile.cl',
  alias: 'analista@aquachile.cl',
  rol: 'analista',
  cargo: 'Analista de Reclutamiento',
  unidad: 'Gestión de Personas',
};

/** Muestra si el usuario del contexto tiene foto, para ver que el cambio llega a toda la app. */
function FotoActual() {
  const { usuarioActual } = useAuth();
  return <span data-testid="foto-actual">{usuarioActual?.foto ?? 'sin foto'}</span>;
}

const crearApi = () => ({
  guardarFoto: vi.fn(async (foto) => foto),
  quitarFoto: vi.fn().mockResolvedValue({}),
  cambiarContrasena: vi.fn().mockResolvedValue({}),
});

const abrir = ({ conServidor = true, api = crearApi(), usuario = analista } = {}) => {
  const acciones = { alCerrar: vi.fn(), alCerrarSesion: vi.fn() };
  render(
    <ProveedorAuth usuarioInicial={usuario}>
      <VentanaPerfil conServidor={conServidor} api={api} {...acciones} />
      <FotoActual />
    </ProveedorAuth>,
  );
  return { api, ...acciones };
};

const subirImagen = (usuario, tipo = 'image/png') =>
  usuario.upload(screen.getByLabelText('Elegir foto de perfil'), new File(['img'], 'foto.png', { type: tipo }));

describe('VentanaPerfil', () => {
  beforeEach(() => localStorage.clear());

  it('muestra los datos del usuario y lo que permite su rol', () => {
    abrir();
    const ventana = screen.getByRole('dialog', { name: 'Mi perfil' });
    expect(within(ventana).getByText('Carolina Muñoz')).toBeInTheDocument();
    expect(within(ventana).getByText('Analista de Reclutamiento', { selector: 'span' })).toBeInTheDocument();
    expect(within(ventana).getByText('carolina.munoz@aquachile.cl')).toBeInTheDocument();
    expect(within(ventana).getByText('Gestión de Personas')).toBeInTheDocument();
    expect(within(ventana).getByText('Crear solicitudes')).toBeInTheDocument();
  });

  it('con servidor sube la foto, se ve en toda la app y se puede quitar', async () => {
    const usuario = userEvent.setup();
    const { api } = abrir();

    await subirImagen(usuario);
    expect(api.guardarFoto).toHaveBeenCalledWith('data:image/jpeg;base64,Rk9UTw==');
    expect(await screen.findByText('Tu foto de perfil se actualizó.')).toBeInTheDocument();
    expect(screen.getByTestId('foto-actual')).toHaveTextContent('data:image/jpeg;base64,Rk9UTw==');

    await usuario.click(screen.getByRole('button', { name: 'Quitar foto' }));
    expect(api.quitarFoto).toHaveBeenCalled();
    expect(await screen.findByText('Se quitó tu foto de perfil.')).toBeInTheDocument();
    expect(screen.getByTestId('foto-actual')).toHaveTextContent('sin foto');
  });

  it('rechaza archivos que no son imagen', async () => {
    const usuario = userEvent.setup({ applyAccept: false });
    const { api } = abrir();
    await subirImagen(usuario, 'application/pdf');
    expect(await screen.findByText('La foto debe ser una imagen JPG, PNG o WebP.')).toBeInTheDocument();
    expect(api.guardarFoto).not.toHaveBeenCalled();
  });

  it('sin servidor guarda la foto en el navegador y no permite cambiar la contraseña', async () => {
    const usuario = userEvent.setup();
    const { api } = abrir({ conServidor: false });
    await subirImagen(usuario);
    expect(await screen.findByText('Tu foto de perfil se actualizó.')).toBeInTheDocument();
    expect(api.guardarFoto).not.toHaveBeenCalled();
    expect(leerFotoLocal(1)).toBe('data:image/jpeg;base64,Rk9UTw==');
    expect(screen.queryByRole('button', { name: 'Cambiar contraseña' })).toBeNull();
    expect(screen.getByText('El cambio de contraseña necesita el servidor.')).toBeInTheDocument();
  });

  it('cambia la contraseña validando y muestra el error del servidor', async () => {
    const usuario = userEvent.setup();
    const api = crearApi();
    api.cambiarContrasena.mockRejectedValueOnce(new Error('La contraseña actual no es correcta.'));
    abrir({ api });

    await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    const formulario = screen.getByRole('form', { name: 'Cambiar contraseña' });
    await usuario.click(within(formulario).getByRole('button', { name: 'Guardar contraseña' }));
    expect(within(formulario).getByText('Ingrese su contraseña actual.')).toBeInTheDocument();
    expect(api.cambiarContrasena).not.toHaveBeenCalled();

    await usuario.type(within(formulario).getByLabelText('Contraseña actual'), 'Equivocada1');
    await usuario.type(within(formulario).getByLabelText(/^Nueva contraseña/), 'NuevaClave2026');
    await usuario.type(within(formulario).getByLabelText('Repite la nueva contraseña'), 'NuevaClave2026');
    await usuario.click(within(formulario).getByRole('button', { name: 'Guardar contraseña' }));
    expect(await within(formulario).findByText('La contraseña actual no es correcta.')).toBeInTheDocument();

    await usuario.clear(within(formulario).getByLabelText('Contraseña actual'));
    await usuario.type(within(formulario).getByLabelText('Contraseña actual'), 'AquaChile2026!');
    await usuario.click(within(formulario).getByRole('button', { name: 'Guardar contraseña' }));
    expect(api.cambiarContrasena).toHaveBeenLastCalledWith('AquaChile2026!', 'NuevaClave2026');
    expect(await screen.findByText(/tu contraseña se actualizó/i)).toBeInTheDocument();
  });

  it('cierra con Escape y cierra la sesión desde la ventana', async () => {
    const usuario = userEvent.setup();
    const { alCerrar, alCerrarSesion } = abrir();
    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(alCerrarSesion).toHaveBeenCalled();
    await usuario.keyboard('{Escape}');
    expect(alCerrar).toHaveBeenCalled();
  });
});
