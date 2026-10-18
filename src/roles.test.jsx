import { render, renderHook, act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { ProveedorDatos } from './datos/DatosContext';
import { ProveedorAuth, useAuth } from './datos/AuthContext';
import { ROLES, USUARIOS } from './datos/usuarios';
import { datosDePrueba } from './pruebas/utilidades';

const usuarioDe = (rol) => {
  const { contrasena: _contrasena, ...usuario } = USUARIOS.find((u) => u.rol === rol);
  return usuario;
};

const renderComo = (rol, ruta) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAuth usuarioInicial={usuarioDe(rol)}>
        <ProveedorDatos datosIniciales={structuredClone(datosDePrueba)}>
          <App />
        </ProveedorDatos>
      </ProveedorAuth>
    </MemoryRouter>,
  );

describe('Roles del caso académico', () => {
  it('existen los 4 roles con un usuario de prueba cada uno', () => {
    expect(Object.keys(ROLES)).toEqual(['admin', 'analista', 'evaluador', 'jefatura']);
    Object.keys(ROLES).forEach((rol) => {
      expect(USUARIOS.filter((u) => u.rol === rol)).toHaveLength(1);
    });
  });

  it.each([
    ['admin@aquachile.cl', { esAdmin: true, esAnalista: true, esEvaluador: true, soloLectura: false }],
    ['jefatura@aquachile.cl', { esAdmin: false, esAnalista: false, esEvaluador: false, soloLectura: true }],
  ])('%s inicia sesión con los permisos de su rol', (alias, permisos) => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <ProveedorAuth>{children}</ProveedorAuth>,
    });
    act(() => {
      expect(result.current.iniciarSesion(alias, 'AquaChile2026!').ok).toBe(true);
    });
    expect(result.current).toMatchObject(permisos);
  });

  it('la barra muestra el rol y solo el admin ve Administración', () => {
    renderComo('jefatura', '/');
    expect(screen.getByText('Jefatura')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Administración' })).toBeNull();
  });
});

describe('Jefatura en modo solo lectura', () => {
  it('no ve las acciones de creación en el dashboard ni en solicitudes', () => {
    renderComo('jefatura', '/');
    expect(screen.queryByRole('button', { name: /nueva solicitud/i })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Nueva solicitud' })).toBeNull();
  });

  it('consulta el detalle sin poder cambiar estado ni responsable, y ve solo el dictamen', () => {
    renderComo('jefatura', '/solicitudes/1');

    expect(screen.getByLabelText('Estado')).toBeDisabled();
    expect(screen.getByLabelText('Profesional responsable')).toBeDisabled();
    expect(screen.getByText(/solo puede consultar/i)).toBeInTheDocument();

    expect(screen.getByText('Dictamen de la evaluación:')).toBeInTheDocument();
    expect(screen.queryByText('Perfil estable y buen trabajo en equipo.')).toBeNull();
    expect(screen.queryByRole('button', { name: /registrar evaluación|actualizar evaluación/i })).toBeNull();
  });

  it('no puede entrar a las rutas de creación ni a Administración', () => {
    renderComo('jefatura', '/candidatos/nuevo');
    expect(screen.getByRole('heading', { name: 'Solicitudes', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/no tiene permisos/i)).toBeInTheDocument();
  });

  it('el informe oficial no le muestra las observaciones clínicas', () => {
    renderComo('jefatura', '/solicitudes/1/informe');
    expect(screen.getByText(/resguardadas bajo secreto/i)).toBeInTheDocument();
    expect(screen.queryByText('Perfil estable y buen trabajo en equipo.')).toBeNull();
  });
});

describe('Administrador académico', () => {
  it('entra a Administración desde la barra', () => {
    renderComo('admin', '/administracion');
    expect(screen.getByRole('heading', { name: 'Administración', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Administración' })).toBeInTheDocument();
  });

  it('el analista no puede entrar a Administración', () => {
    renderComo('analista', '/administracion');
    const alerta = screen.getByRole('alert');
    expect(within(alerta).getByText(/no tiene permisos/i)).toBeInTheDocument();
  });
});
