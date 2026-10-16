import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';
import { ProveedorAuth } from '../../datos/AuthContext';
import { USUARIO_TEST_DEFAULT } from '../../pruebas/utilidades';

const ENLACES = [
  { nombre: 'Dashboard', ruta: '/' },
  { nombre: 'Candidatos', ruta: '/candidatos' },
  { nombre: 'Solicitudes', ruta: '/solicitudes' },
  { nombre: 'Planner', ruta: '/planner' },
];

const renderNavbar = (ruta = '/') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAuth usuarioInicial={USUARIO_TEST_DEFAULT}>
        <Navbar />
      </ProveedorAuth>
    </MemoryRouter>,
  );

describe('Navbar', () => {
  it('muestra el nombre de la empresa y los enlaces de navegación', () => {
    renderNavbar();
    expect(screen.getByRole('img', { name: 'AquaChile' })).toBeInTheDocument();
    ENLACES.forEach(({ nombre }) => expect(screen.getByRole('link', { name: nombre })).toBeInTheDocument());
  });

  it('marca como activo el enlace de la ruta actual', () => {
    renderNavbar('/solicitudes');
    expect(screen.getByRole('link', { name: 'Solicitudes' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: 'Candidatos' })).not.toHaveClass('active');
  });

  it('colapsa y expande el menú con el botón de la barra', async () => {
    const usuario = userEvent.setup();
    renderNavbar();

    const menu = document.getElementById('menu-principal');
    const boton = screen.getByRole('button', { name: /alternar navegación/i });

    expect(menu).not.toHaveClass('show');
    expect(boton).toHaveAttribute('aria-expanded', 'false');

    await usuario.click(boton);
    expect(menu).toHaveClass('show');
    expect(boton).toHaveAttribute('aria-expanded', 'true');

    await usuario.click(boton);
    expect(menu).not.toHaveClass('show');
  });

  it('expande solo el botón de menú en pantallas grandes', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: /alternar navegación/i })).toHaveClass('navbar-toggler');
  });

  it('incluye el enlace para crear una nueva solicitud', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: 'Nueva solicitud' })).toHaveAttribute(
      'href',
      '/solicitudes/nueva',
    );
  });
});
