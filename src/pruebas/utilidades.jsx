import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProveedorDatos } from '../datos/DatosContext';

/**
 * Helper de pruebas: renderiza un componente dentro del router y del
 * proveedor de datos con datos controlados.
 */
export function renderConContexto(ui, { ruta = '/', datosIniciales } = {}) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorDatos datosIniciales={datosIniciales}>{ui}</ProveedorDatos>
    </MemoryRouter>,
  );
}

/**
 * Wrapper para renderHook: entrega el ProveedorDatos con datos controlados.
 */
export function crearWrapper(datosIniciales) {
  return function Wrapper({ children }) {
    return <ProveedorDatos datosIniciales={datosIniciales}>{children}</ProveedorDatos>;
  };
}

export const datosVacios = { candidatos: [], solicitudes: [], evaluaciones: [] };


export const datosDePrueba = {
  candidatos: [
    {
      id: 1,
      nombre: 'María González',
      correo: 'maria.gonzalez@correo.cl',
      telefono: '+56912345678',
      cargo: 'Técnico de Planta',
      familiaCargo: 'Operaciones',
    },
    {
      id: 2,
      nombre: 'Juan Pérez',
      correo: 'juan.perez@correo.cl',
      telefono: '+56987654321',
      cargo: 'Analista de Datos',
      familiaCargo: 'Tecnología',
    },
  ],
  solicitudes: [
    {
      id: 1,
      candidatoId: 1,
      cargo: 'Técnico de Planta',
      familiaCargo: 'Operaciones',
      fechaSolicitud: '2026-08-03',
      estado: 'Finalizada',
      profesionalResponsable: 'Camila Rojas',
      observaciones: 'Perfil orientado a turnos rotativos.',
    },
    {
      id: 2,
      candidatoId: 2,
      cargo: 'Analista de Datos',
      familiaCargo: 'Tecnología',
      fechaSolicitud: '2026-08-17',
      estado: 'En proceso',
      profesionalResponsable: 'Sebastián Muñoz',
      observaciones: '',
    },
    {
      id: 3,
      candidatoId: 1,
      cargo: 'Técnico de Planta',
      familiaCargo: 'Operaciones',
      fechaSolicitud: '2026-09-01',
      estado: 'Pendiente',
      profesionalResponsable: '',
      observaciones: '',
    },
  ],
  evaluaciones: [
    {
      id: 1,
      solicitudId: 1,
      fechaEvaluacion: '2026-08-10',
      resultado: 'Aprobado',
      observaciones: 'Perfil estable y buen trabajo en equipo.',
      estado: 'Realizada',
    },
  ],
};
