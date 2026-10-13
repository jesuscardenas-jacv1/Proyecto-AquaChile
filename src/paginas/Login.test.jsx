import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from './Login';
import { ProveedorAuth } from '../datos/AuthContext';

function renderLogin({ usuarioInicial = null, ruta = '/login' } = {}) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAuth usuarioInicial={usuarioInicial}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<h1>Dashboard Principal</h1>} />
        </Routes>
      </ProveedorAuth>
    </MemoryRouter>,
  );
}

describe('Login', () => {
  it('muestra la cabecera corporativa y los campos requeridos', () => {
    renderLogin();

    expect(screen.getByRole('img', { name: 'AquaChile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /módulo de evaluaciones/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/correo corporativo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar al sistema/i })).toBeInTheDocument();
  });

  it('exige correo y contraseña al enviar vacío', async () => {
    const usuario = userEvent.setup();
    renderLogin();

    await usuario.click(screen.getByRole('button', { name: /ingresar al sistema/i }));

    expect(
      screen.getByText(/por favor ingrese su correo corporativo y contraseña/i),
    ).toBeInTheDocument();
  });

  it('muestra error ante credenciales incorrectas', async () => {
    const usuario = userEvent.setup();
    renderLogin();

    await usuario.type(screen.getByLabelText(/correo corporativo/i), 'usuario.invalido@aquachile.cl');
    await usuario.type(screen.getByLabelText(/^contraseña$/i), 'claveErronea');
    await usuario.click(screen.getByRole('button', { name: /ingresar al sistema/i }));

    expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument();
  });

  it('inicia sesión exitosamente como analista con correo nominal', async () => {
    const usuario = userEvent.setup();
    renderLogin();

    await usuario.type(screen.getByLabelText(/correo corporativo/i), 'carolina.munoz@aquachile.cl');
    await usuario.type(screen.getByLabelText(/^contraseña$/i), 'AquaChile2026!');
    await usuario.click(screen.getByRole('button', { name: /ingresar al sistema/i }));

    expect(await screen.findByRole('heading', { name: 'Dashboard Principal' })).toBeInTheDocument();
  });

  it('inicia sesión exitosamente como evaluador con alias de rol', async () => {
    const usuario = userEvent.setup();
    renderLogin();

    await usuario.type(screen.getByLabelText(/correo corporativo/i), 'evaluador@aquachile.cl');
    await usuario.type(screen.getByLabelText(/^contraseña$/i), 'AquaChile2026!');
    await usuario.click(screen.getByRole('button', { name: /ingresar al sistema/i }));

    expect(await screen.findByRole('heading', { name: 'Dashboard Principal' })).toBeInTheDocument();
  });

  it('permite alternar la visibilidad de la contraseña', async () => {
    const usuario = userEvent.setup();
    renderLogin();

    const inputPassword = screen.getByLabelText(/^contraseña$/i);
    const botonOjo = screen.getByRole('button', { name: /ver contraseña/i });

    expect(inputPassword).toHaveAttribute('type', 'password');

    await usuario.click(botonOjo);
    expect(inputPassword).toHaveAttribute('type', 'text');

    await usuario.click(botonOjo);
    expect(inputPassword).toHaveAttribute('type', 'password');
  });
});
