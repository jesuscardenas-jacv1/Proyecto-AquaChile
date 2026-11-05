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

const renderComo = (rol, ruta, datos = datosDePrueba) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAuth usuarioInicial={usuarioDe(rol)}>
        <ProveedorDatos datosIniciales={structuredClone(datos)}>
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
  ])('%s inicia sesión con los permisos de su rol', async (alias, permisos) => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <ProveedorAuth>{children}</ProveedorAuth>,
    });
    await act(async () => {
      expect((await result.current.iniciarSesion(alias, 'AquaChile2026!')).ok).toBe(true);
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

    expect(screen.queryByRole('combobox', { name: 'Estado' })).toBeNull();
    // La psicóloga responsable solo se muestra: la asigna el analista.
    expect(screen.queryByRole('combobox', { name: 'Psicóloga responsable' })).toBeNull();
    expect(screen.getByText(/la asigna el analista/i)).toBeInTheDocument();
    expect(screen.getByText(/lo gestiona la psicóloga en su planner/i)).toBeInTheDocument();

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

describe('Psicóloga (evaluador)', () => {
  it('gestiona el avance en el Planner, y la psicóloga responsable la asigna el analista', () => {
    renderComo('evaluador', '/solicitudes/1');
    expect(screen.queryByRole('combobox', { name: 'Estado' })).toBeNull();
    expect(screen.getByRole('link', { name: /gestionar en el planner/i })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Psicóloga responsable' })).toBeNull();
    expect(screen.getByText(/la asigna el analista/i)).toBeInTheDocument();
  });
});

describe('Solicitud cerrada sin evaluación', () => {
  it('el detalle muestra el motivo y remite al Planner para reabrirla', () => {
    const datos = structuredClone(datosDePrueba);
    const solicitud = datos.solicitudes.find((item) => item.id === 2);
    Object.assign(solicitud, {
      estado: 'Finalizada',
      etapa: 'agendada',
      cierre: { motivo: 'No se presentó a la entrevista', comentario: '', fecha: '2026-10-20', responsable: 'Ignacia Valdés Ortiz' },
    });
    renderComo('evaluador', '/solicitudes/2', datos);

    expect(screen.getByText('Cerrada sin evaluación: No se presentó a la entrevista')).toBeInTheDocument();
    expect(screen.getByText('Cerrada sin informe')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar evaluación/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reabrir/i })).toBeNull();
    expect(screen.getByText(/se puede reabrir desde el planner/i)).toBeInTheDocument();
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
