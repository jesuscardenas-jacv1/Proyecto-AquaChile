import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProveedorDatos, useDatos } from './DatosContext';
import { ProveedorAuth, useAuth } from './AuthContext';
import { ErrorApi } from '../servicios/api';
import { datosPortal } from '../pruebas/utilidades';

const analista = { id: 1, nombre: 'Carolina Muñoz', rol: 'analista' };

function crearApi(cambios = {}) {
  return {
    cargarPublico: vi.fn().mockResolvedValue({ ofertas: datosPortal.ofertas }),
    cargarTodo: vi.fn().mockResolvedValue(structuredClone(datosPortal)),
    crearCandidato: vi.fn(async (datos) => ({ id: 500, ...datos })),
    actualizarCandidato: vi.fn(),
    eliminarCandidato: vi.fn().mockRejectedValue(new ErrorApi('Tiene solicitudes asociadas.', { status: 409 })),
    crearSolicitud: vi.fn(),
    actualizarSolicitud: vi.fn(async (id, cambios) => ({ ...datosPortal.solicitudes[2], ...cambios })),
    moverEtapa: vi.fn(),
    guardarEvaluacion: vi.fn(async (solicitudId, datos) => ({ id: 77, solicitudId, ...datos })),
    postular: vi.fn().mockResolvedValue({ id: 900 }),
    actualizarPostulacion: vi.fn(),
    reiniciar: vi.fn(),
    ...cambios,
  };
}

function montar({ api = crearApi(), usuario = analista, servidor = true } = {}) {
  const comprobarServidor = vi.fn().mockResolvedValue(servidor);
  const wrapper = ({ children }) => (
    <ProveedorAuth usuarioInicial={usuario} apiHabilitada>
      <ProveedorDatos apiHabilitada api={api} comprobarServidor={comprobarServidor}>
        {children}
      </ProveedorDatos>
    </ProveedorAuth>
  );
  return { api, ...renderHook(() => ({ datos: useDatos(), auth: useAuth() }), { wrapper }) };
}

describe('DatosContext en modo API', () => {
  beforeEach(() => sessionStorage.clear());

  it('carga desde el servidor los datos del usuario con sesión', async () => {
    sessionStorage.setItem('aquachile_token_api', 'jwt');
    const { result, api } = montar();

    await waitFor(() => expect(result.current.datos.modo).toBe('api'));
    await waitFor(() => expect(result.current.datos.cargando).toBe(false));
    expect(api.cargarTodo).toHaveBeenCalledWith('analista');
    expect(result.current.datos.postulaciones).toHaveLength(2);
  });

  it('sin sesión carga solo las ofertas públicas', async () => {
    const { result, api } = montar({ usuario: null });
    await waitFor(() => expect(result.current.datos.ofertas).toHaveLength(2));
    expect(api.cargarTodo).not.toHaveBeenCalled();
    expect(result.current.datos.candidatos).toEqual([]);
  });

  it('guarda en el servidor y usa el registro que devuelve', async () => {
    sessionStorage.setItem('aquachile_token_api', 'jwt');
    const { result, api } = montar();
    await waitFor(() => expect(result.current.datos.cargando).toBe(false));

    let creado;
    await act(async () => {
      creado = await result.current.datos.agregarCandidato({
        nombre: ' Ana Torres ',
        correo: 'Ana@Correo.cl',
        telefono: '+56911112222',
        cargo: 'Operario',
        familiaCargo: 'Operario',
      });
    });

    expect(api.crearCandidato).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Ana Torres', correo: 'ana@correo.cl' }));
    expect(creado.id).toBe(500);
    expect(result.current.datos.obtenerCandidato(500).nombre).toBe('Ana Torres');
  });

  it('asigna la psicóloga y registra la evaluación a través de la API', async () => {
    sessionStorage.setItem('aquachile_token_api', 'jwt');
    const { result, api } = montar();
    await waitFor(() => expect(result.current.datos.cargando).toBe(false));

    await act(() => result.current.datos.asignarProfesional(3, 'Ignacia Valdés Ortiz'));
    expect(api.actualizarSolicitud).toHaveBeenCalledWith(3, { profesionalResponsable: 'Ignacia Valdés Ortiz' });
    expect(result.current.datos.obtenerSolicitud(3).profesionalResponsable).toBe('Ignacia Valdés Ortiz');

    await act(() =>
      result.current.datos.registrarEvaluacion(2, {
        fechaEvaluacion: '2026-10-20',
        resultado: 'Recomendado',
        observaciones: 'Buen perfil',
      }),
    );
    expect(api.guardarEvaluacion).toHaveBeenCalledWith(2, expect.objectContaining({ resultado: 'Recomendado' }), undefined);
    expect(result.current.datos.obtenerSolicitud(2).estado).toBe('Finalizada');
  });

  it('si el servidor rechaza la operación devuelve null y deja el motivo', async () => {
    sessionStorage.setItem('aquachile_token_api', 'jwt');
    const { result } = montar();
    await waitFor(() => expect(result.current.datos.cargando).toBe(false));

    let respuesta;
    await act(async () => {
      respuesta = await result.current.datos.eliminarCandidato(1);
    });
    expect(respuesta).toBeNull();
    expect(result.current.datos.errorOperacion).toBe('Tiene solicitudes asociadas.');
    expect(result.current.datos.obtenerCandidato(1)).not.toBeNull();

    act(() => result.current.datos.limpiarError());
    expect(result.current.datos.errorOperacion).toBeNull();
  });

  it('pasa a modo local si el servidor no responde', async () => {
    const { result, api } = montar({ servidor: false });
    await waitFor(() => expect(result.current.datos.modo).toBe('local'));
    expect(api.cargarTodo).not.toHaveBeenCalled();
    expect(result.current.datos.candidatos.length).toBeGreaterThan(0);
  });

  it('cierra la sesión si se inició sin servidor y ahora el servidor responde', async () => {
    const { result, api } = montar();
    await waitFor(() => expect(result.current.auth.estaAutenticado).toBe(false));
    await waitFor(() => expect(api.cargarPublico).toHaveBeenCalled());
    expect(api.cargarTodo).not.toHaveBeenCalled();
  });

  it('cierra la sesión si el servidor responde que venció', async () => {
    sessionStorage.setItem('aquachile_token_api', 'jwt');
    const api = crearApi({ cargarTodo: vi.fn().mockRejectedValue(new ErrorApi('Token inválido o expirado.', { status: 401 })) });
    const { result } = montar({ api });
    await waitFor(() => expect(result.current.auth.estaAutenticado).toBe(false));
  });
});
