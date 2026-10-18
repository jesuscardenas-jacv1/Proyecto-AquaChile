import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProveedorDatos } from '../datos/DatosContext';
import { ProveedorAuth } from '../datos/AuthContext';

export const USUARIO_TEST_DEFAULT = {
  id: 1,
  nombre: 'Usuario Test',
  correo: 'test@aquachile.cl',
  rol: 'admin',
  cargo: 'Administrador Demo',
};

/**
 * Helper de pruebas: renderiza un componente dentro del router y de los
 * proveedores de datos y autenticación con datos controlados.
 */
export function renderConContexto(
  ui,
  { ruta = '/', datosIniciales, usuario = USUARIO_TEST_DEFAULT } = {},
) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorAuth usuarioInicial={usuario}>
        <ProveedorDatos datosIniciales={datosIniciales}>{ui}</ProveedorDatos>
      </ProveedorAuth>
    </MemoryRouter>,
  );
}

/**
 * Wrapper para renderHook: entrega ProveedorAuth y ProveedorDatos con datos controlados.
 */
export function crearWrapper(datosIniciales, usuario = USUARIO_TEST_DEFAULT) {
  return function Wrapper({ children }) {
    return (
      <ProveedorAuth usuarioInicial={usuario}>
        <ProveedorDatos datosIniciales={datosIniciales}>{children}</ProveedorDatos>
      </ProveedorAuth>
    );
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
      reclutador: 'Carolina Muñoz',
      profesionalResponsable: 'Ignacia Valdés Ortiz',
      observaciones: 'Perfil orientado a turnos rotativos.',
    },
    {
      id: 2,
      candidatoId: 2,
      cargo: 'Analista de Datos',
      familiaCargo: 'Profesional A',
      fechaSolicitud: '2026-08-17',
      estado: 'En proceso',
      reclutador: 'Macarena Vidal',
      profesionalResponsable: 'Tomás Riquelme Soto',
      observaciones: '',
    },
    {
      id: 3,
      candidatoId: 1,
      cargo: 'Técnico de Planta',
      familiaCargo: 'Técnico B C',
      fechaSolicitud: '2026-09-01',
      estado: 'Pendiente',
      reclutador: '',
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
      reclutador: 'Carolina Muñoz',
      profesionalResponsable: 'Ignacia Valdés Ortiz',
      observaciones: 'Perfil orientado a trabajo en turnos rotativos.',
    },
    {
      id: 2,
      candidatoId: 2,
      cargo: 'Analista de Datos',
      familiaCargo: 'Profesional A',
      fechaSolicitud: '2026-08-17',
      estado: 'En proceso',
      reclutador: 'Macarena Vidal',
      profesionalResponsable: 'Tomás Riquelme Soto',
      observaciones: 'Entrevista inicial aprobada, falta prueba técnica.',
    },
    {
      id: 3,
      candidatoId: 3,
      cargo: 'Asistente Administrativa',
      familiaCargo: 'Profesional B C',
      fechaSolicitud: '2026-08-24',
      estado: 'Pendiente',
      reclutador: '',
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
      reclutador: '',
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

/** Datos de prueba con el portal: 2 ofertas, una postulación recibida y una descartada. */
export const datosPortal = {
  ...datosDePrueba,
  candidatos: [
    ...datosDePrueba.candidatos,
    {
      id: 20,
      nombre: 'Camilo Fuentealba',
      correo: 'camilo.f@correo.cl',
      telefono: '+56930002201',
      cargo: 'Monitor Producción',
      familiaCargo: 'Técnico B C',
      origen: 'Externo',
    },
    {
      id: 21,
      nombre: 'Josefa Barría',
      correo: 'josefa.b@correo.cl',
      telefono: '+56930002204',
      cargo: 'Técnico Eléctrico',
      familiaCargo: 'Técnico A',
      origen: 'Externo',
    },
  ],
  ofertas: [
    {
      id: 1,
      titulo: 'Monitor Producción - Planta Calbuco',
      area: 'Industrial',
      cargo: 'Monitor Producción',
      familiaCargo: 'Técnico B C',
      ubicacion: 'Planta Calbuco',
      region: 'Los Lagos',
      fechaPublicacion: '2026-10-01',
      descripcion: 'Coordinar equipos de línea.',
      requisitos: ['Técnico de nivel medio'],
      jornada: 'Jornada completa',
      estado: 'Abierta',
    },
    {
      id: 2,
      titulo: 'Técnico Eléctrico - Puerto Natales',
      area: 'Producción',
      cargo: 'Técnico Eléctrico',
      familiaCargo: 'Técnico A',
      ubicacion: 'Planta Magallanes',
      region: 'Magallanes',
      fechaPublicacion: '2026-10-05',
      descripcion: 'Mantención eléctrica.',
      requisitos: [],
      jornada: 'Jornada completa',
      estado: 'Abierta',
    },
  ],
  postulaciones: [
    { id: 1, ofertaId: 1, candidatoId: 20, fechaPostulacion: '2026-10-02', estado: 'Recibida', ciudad: 'Calbuco', cvNombre: 'cv_camilo.pdf', solicitudId: null },
    { id: 2, ofertaId: 2, candidatoId: 21, fechaPostulacion: '2026-10-06', estado: 'Descartada', ciudad: 'Punta Arenas', cvNombre: 'cv_josefa.pdf', solicitudId: null },
  ],
};
