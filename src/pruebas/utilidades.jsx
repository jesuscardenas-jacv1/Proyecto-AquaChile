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
      familiaCargo: 'Técnico B C',
    },
    {
      id: 2,
      nombre: 'Juan Pérez',
      correo: 'juan.perez@correo.cl',
      telefono: '+56987654321',
      cargo: 'Analista de Datos',
      familiaCargo: 'Profesional A',
    },
  ],
  solicitudes: [
    {
      id: 1,
      candidatoId: 1,
      cargo: 'Técnico de Planta',
      familiaCargo: 'Técnico B C',
      fechaSolicitud: '2026-08-03',
      estado: 'Finalizada',
      profesionalResponsable: 'Carolina Muñoz',
      observaciones: 'Perfil orientado a turnos rotativos.',
    },
    {
      id: 2,
      candidatoId: 2,
      cargo: 'Analista de Datos',
      familiaCargo: 'Profesional A',
      fechaSolicitud: '2026-08-17',
      estado: 'En proceso',
      profesionalResponsable: 'Macarena Vidal',
      observaciones: '',
    },
    {
      id: 3,
      candidatoId: 1,
      cargo: 'Técnico de Planta',
      familiaCargo: 'Técnico B C',
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
      resultado: 'Recomendado',
      observaciones: 'Perfil estable y buen trabajo en equipo.',
      estado: 'Realizada',
    },
  ],
};

/** Conjunto pequeño para las pruebas del contexto (4 candidatos, 4 solicitudes, 1 evaluación). */
export const datosDemo = {
  candidatos: [
    {
      id: 1,
      nombre: 'María González',
      correo: 'maria.gonzalez@correo.cl',
      telefono: '+56912345678',
      cargo: 'Técnico de Planta',
      familiaCargo: 'Técnico B C',
    },
    {
      id: 2,
      nombre: 'Juan Pérez',
      correo: 'juan.perez@correo.cl',
      telefono: '+56987654321',
      cargo: 'Analista de Datos',
      familiaCargo: 'Profesional A',
    },
    {
      id: 3,
      nombre: 'Carla Fuentes',
      correo: 'carla.fuentes@correo.cl',
      telefono: '+56955667788',
      cargo: 'Asistente Administrativa',
      familiaCargo: 'Profesional B C',
    },
    {
      id: 4,
      nombre: 'Diego Navarro',
      correo: 'diego.navarro@correo.cl',
      telefono: '+56933445566',
      cargo: 'Supervisor de Turno',
      familiaCargo: 'Técnico B C',
    },
  ],
  solicitudes: [
    {
      id: 1,
      candidatoId: 1,
      cargo: 'Técnico de Planta',
      familiaCargo: 'Técnico B C',
      fechaSolicitud: '2026-08-03',
      estado: 'Finalizada',
      profesionalResponsable: 'Carolina Muñoz',
      observaciones: 'Perfil orientado a trabajo en turnos rotativos.',
    },
    {
      id: 2,
      candidatoId: 2,
      cargo: 'Analista de Datos',
      familiaCargo: 'Profesional A',
      fechaSolicitud: '2026-08-17',
      estado: 'En proceso',
      profesionalResponsable: 'Macarena Vidal',
      observaciones: 'Entrevista inicial aprobada, falta prueba técnica.',
    },
    {
      id: 3,
      candidatoId: 3,
      cargo: 'Asistente Administrativa',
      familiaCargo: 'Profesional B C',
      fechaSolicitud: '2026-08-24',
      estado: 'Pendiente',
      profesionalResponsable: '',
      observaciones: '',
    },
    {
      id: 4,
      candidatoId: 4,
      cargo: 'Supervisor de Turno',
      familiaCargo: 'Técnico B C',
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
      resultado: 'Recomendado',
      observaciones:
        'Perfil estable, buena capacidad de trabajo en equipo y adaptación a horarios de turnada.',
      estado: 'Realizada',
    },
  ],
};
