import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';
import { ProveedorAuth } from '../../datos/AuthContext';

const ENLACES = [
  { nombre: 'Dashboard', ruta: '/' },
  { nombre: 'Candidatos', ruta: '/candidatos' },
  { nombre: 'Solicitudes', ruta: '/solicitudes' },
  { nombre: 'Planner', ruta: '/planner' },
];

const renderNavbar = (ruta = '/') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Navbar />
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

  it('muestra el menú siempre visible en escritorio y el botón solo en pantallas pequeñas', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: /alternar navegación/i })).toHaveClass('d-lg-none');
    expect(document.getElementById('menu-principal')).toHaveClass('d-lg-block');
  });

  it('incluye el enlace para crear una nueva solicitud', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: 'Nueva solicitud' })).toHaveAttribute(
      'href',
      '/solicitudes/nueva',
    );
  });
});

describe('Navbar · enlaces según el rol', () => {
  const renderComo = (rol) =>
    render(
      <MemoryRouter>
        <ProveedorAuth usuarioInicial={{ id: 9, nombre: 'Prueba', rol }}>
          <Navbar />
        </ProveedorAuth>
      </MemoryRouter>,
    );

  it('el analista no ve el Planner (lo gestiona la psicóloga)', () => {
    renderComo('analista');
    expect(screen.queryByRole('link', { name: 'Planner' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Postulaciones' })).toBeInTheDocument();
  });

  it('el avatar abre la ventana Mi perfil', async () => {
    const usuario = userEvent.setup();
    renderComo('analista');
    await usuario.click(screen.getByRole('button', { name: 'Mi perfil: Prueba' }));
    expect(screen.getByRole('dialog', { name: 'Mi perfil' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['evaluador', 'jefatura', 'admin'])('%s ve el Planner', (rol) => {
    renderComo(rol);
    expect(screen.getByRole('link', { name: 'Planner' })).toHaveAttribute('href', '/planner');
  });
});

describe('Navbar · menú lateral contraíble', () => {
  it('se contrae a solo íconos y vuelve a expandirse', async () => {
    const usuario = userEvent.setup();
    renderNavbar();
    const barra = screen.getByRole('complementary', { name: 'Navegación principal' });

    await usuario.click(screen.getByRole('button', { name: 'Contraer menú' }));
    expect(barra).toHaveClass('barra-colapsada');
    // Los nombres siguen disponibles para lectores de pantalla y como tooltip.
    expect(screen.getByRole('link', { name: 'Solicitudes' })).toHaveAttribute('title', 'Solicitudes');

    await usuario.click(screen.getByRole('button', { name: 'Expandir menú' }));
    expect(barra).not.toHaveClass('barra-colapsada');
    expect(screen.getByRole('link', { name: 'Solicitudes' })).not.toHaveAttribute('title');
  });

  it('recuerda la preferencia en el navegador', async () => {
    const usuario = userEvent.setup();
    const { unmount } = renderNavbar();
    await usuario.click(screen.getByRole('button', { name: 'Contraer menú' }));
    expect(localStorage.getItem('aquachile_menu_colapsado')).toBe('si');
    unmount();

    renderNavbar();
    expect(screen.getByRole('complementary', { name: 'Navegación principal' })).toHaveClass('barra-colapsada');
    expect(screen.getByRole('button', { name: 'Expandir menú' })).toHaveAttribute('aria-expanded', 'false');
  });
});
