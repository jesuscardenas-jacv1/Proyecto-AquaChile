import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import GestionUsuarios from './GestionUsuarios';
import { USUARIOS } from '../../datos/usuarios';

const usuariosServidor = [
  { id: 1, nombre: 'Administrador Demo', correo: 'admin@aquachile.cl', alias: '', rol: 'admin', cargo: 'Admin', unidad: '' },
  { id: 2, nombre: 'Ignacia Valdés Ortiz', correo: 'ignacia.valdes@aquachile.cl', alias: '', rol: 'evaluador', cargo: 'Psicóloga', unidad: '' },
];

const crearApi = () => ({
  listarUsuarios: vi.fn().mockResolvedValue(usuariosServidor),
  crearUsuario: vi.fn().mockResolvedValue({}),
  actualizarUsuario: vi.fn().mockResolvedValue({}),
  eliminarUsuario: vi.fn().mockResolvedValue({}),
});

describe('GestionUsuarios', () => {
  it('sin servidor muestra los usuarios de demostración en modo lectura', () => {
    render(<GestionUsuarios conServidor={false} />);
    expect(screen.getByText(/inicia el backend/i)).toBeInTheDocument();
    USUARIOS.forEach((usuario) => expect(screen.getByText(usuario.nombre)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /nuevo usuario/i })).toBeNull();
  });

  it('con servidor lista los usuarios y no deja eliminarse a uno mismo', async () => {
    render(<GestionUsuarios conServidor idUsuarioActual={1} api={crearApi()} />);
    expect(await screen.findByText('Ignacia Valdés Ortiz')).toBeInTheDocument();
    expect(screen.getByText('Tú')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar a Administrador Demo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminar a Ignacia Valdés Ortiz' })).toBeEnabled();
  });

  it('crea un usuario validando sus datos', async () => {
    const usuario = userEvent.setup();
    const api = crearApi();
    render(<GestionUsuarios conServidor idUsuarioActual={1} api={api} />);
    await screen.findByText('Ignacia Valdés Ortiz');

    await usuario.click(screen.getByRole('button', { name: /nuevo usuario/i }));
    const formulario = screen.getByRole('form', { name: 'Nuevo usuario' });
    await usuario.click(within(formulario).getByRole('button', { name: 'Crear usuario' }));
    expect(within(formulario).getByText('La contraseña es obligatoria.')).toBeInTheDocument();
    expect(api.crearUsuario).not.toHaveBeenCalled();

    await usuario.type(within(formulario).getByLabelText(/^nombre/i), 'Tomás Riquelme Soto');
    await usuario.type(within(formulario).getByLabelText(/^correo/i), 'Tomas.Riquelme@AquaChile.cl');
    await usuario.selectOptions(within(formulario).getByLabelText(/^rol/i), 'evaluador');
    await usuario.type(within(formulario).getByLabelText(/^contraseña/i), 'ClaveSegura2026');
    await usuario.click(within(formulario).getByRole('button', { name: 'Crear usuario' }));

    expect(api.crearUsuario).toHaveBeenCalledWith({
      nombre: 'Tomás Riquelme Soto',
      correo: 'tomas.riquelme@aquachile.cl',
      rol: 'evaluador',
      cargo: '',
      unidad: '',
      contrasena: 'ClaveSegura2026',
    });
    expect(await screen.findByText('Se creó el usuario Tomás Riquelme Soto.')).toBeInTheDocument();
    expect(api.listarUsuarios).toHaveBeenCalledTimes(2);
  });

  it('edita sin cambiar la contraseña si se deja vacía', async () => {
    const usuario = userEvent.setup();
    const api = crearApi();
    render(<GestionUsuarios conServidor idUsuarioActual={1} api={api} />);

    await usuario.click(await screen.findByRole('button', { name: 'Editar a Ignacia Valdés Ortiz' }));
    const campoCargo = screen.getByLabelText('Cargo');
    await usuario.clear(campoCargo);
    await usuario.type(campoCargo, 'Psicóloga Senior');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(api.actualizarUsuario).toHaveBeenCalled());
    const [id, datos] = api.actualizarUsuario.mock.calls[0];
    expect(id).toBe(2);
    expect(datos.cargo).toBe('Psicóloga Senior');
    expect(datos).not.toHaveProperty('contrasena');
  });

  it('elimina con confirmación y muestra el error del servidor si lo rechaza', async () => {
    const usuario = userEvent.setup();
    const api = crearApi();
    api.eliminarUsuario.mockRejectedValueOnce(new Error('Debe quedar al menos un administrador.'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<GestionUsuarios conServidor idUsuarioActual={99} api={api} />);

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar a Administrador Demo' }));
    expect(await screen.findByText('Debe quedar al menos un administrador.')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Eliminar a Ignacia Valdés Ortiz' }));
    expect(await screen.findByText('Se eliminó a Ignacia Valdés Ortiz.')).toBeInTheDocument();
    expect(api.eliminarUsuario).toHaveBeenLastCalledWith(2);
  });
});
