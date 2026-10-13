import { describe, expect, it } from 'vitest';
import {
  accionesDisponibles,
  agruparPorEtapa,
  diasEntre,
  estadoDeEtapa,
  etapaAnterior,
  etapaDeSolicitud,
  etapaSiguiente,
  fechaCorta,
  hoyIso,
  textoEntrevista,
  validarAgenda,
} from './planner';

describe('etapas del Planner', () => {
  it('relaciona cada etapa con su estado oficial', () => {
    expect(estadoDeEtapa('recibida')).toBe('Pendiente');
    expect(estadoDeEtapa('agendada')).toBe('En proceso');
    expect(estadoDeEtapa('realizada')).toBe('En proceso');
    expect(estadoDeEtapa('informe')).toBe('Finalizada');
  });

  it('usa la etapa guardada cuando calza con el estado', () => {
    expect(etapaDeSolicitud({ estado: 'En proceso', etapa: 'realizada' })).toBe('realizada');
  });

  it('deduce la etapa desde el estado si no existe o quedó desfasada', () => {
    expect(etapaDeSolicitud({ estado: 'Pendiente' })).toBe('recibida');
    expect(etapaDeSolicitud({ estado: 'En proceso' })).toBe('agendada');
    expect(etapaDeSolicitud({ estado: 'Finalizada', etapa: 'realizada' })).toBe('informe');
    expect(etapaDeSolicitud({ estado: 'Pendiente', etapa: 'inventada' })).toBe('recibida');
    expect(etapaDeSolicitud(null)).toBe('recibida');
  });

  it('navega entre etapas sin salirse de los extremos', () => {
    expect(etapaSiguiente('recibida')).toBe('agendada');
    expect(etapaSiguiente('informe')).toBeNull();
    expect(etapaAnterior('realizada')).toBe('agendada');
    expect(etapaAnterior('recibida')).toBeNull();
  });

  it('indica las acciones permitidas por etapa', () => {
    expect(accionesDisponibles('recibida')).toMatchObject({ requiereAgenda: true, retroceder: false });
    expect(accionesDisponibles('agendada')).toMatchObject({ reagendar: true, retroceder: true });
    expect(accionesDisponibles('realizada')).toMatchObject({ registrarInforme: true, avanzar: false });
    expect(accionesDisponibles('informe')).toEqual({
      avanzar: false,
      requiereAgenda: false,
      registrarInforme: false,
      reagendar: false,
      retroceder: false,
    });
  });
});

describe('agruparPorEtapa', () => {
  const solicitudes = [
    { id: 1, estado: 'Pendiente', fechaSolicitud: '2026-10-09' },
    { id: 2, estado: 'Pendiente', fechaSolicitud: '2026-10-01' },
    { id: 3, estado: 'En proceso', etapa: 'agendada', fechaEntrevista: '2026-10-15', horaEntrevista: '09:00' },
    { id: 4, estado: 'En proceso', etapa: 'agendada', fechaEntrevista: '2026-10-14', horaEntrevista: '15:00' },
    { id: 5, estado: 'En proceso', etapa: 'realizada', fechaEntrevista: '2026-10-08' },
    { id: 6, estado: 'Finalizada', fechaSolicitud: '2026-01-01' },
    { id: 7, estado: 'Finalizada', fechaSolicitud: '2026-02-01' },
  ];
  const evaluaciones = [
    { solicitudId: 6, fechaInforme: '2026-03-10' },
    { solicitudId: 7, fechaEvaluacion: '2026-02-20' },
  ];

  it('reparte las solicitudes en las cuatro columnas', () => {
    const grupos = agruparPorEtapa(solicitudes, evaluaciones);
    expect(Object.keys(grupos)).toEqual(['recibida', 'agendada', 'realizada', 'informe']);
    expect(grupos.realizada.map((s) => s.id)).toEqual([5]);
  });

  it('ordena cada columna según lo que se atiende primero', () => {
    const grupos = agruparPorEtapa(solicitudes, evaluaciones);
    expect(grupos.recibida.map((s) => s.id)).toEqual([2, 1]);
    expect(grupos.agendada.map((s) => s.id)).toEqual([4, 3]);
    expect(grupos.informe.map((s) => s.id)).toEqual([6, 7]);
  });

  it('devuelve columnas vacías sin datos', () => {
    expect(agruparPorEtapa()).toEqual({ recibida: [], agendada: [], realizada: [], informe: [] });
  });
});

describe('textos y fechas', () => {
  it('formatea la fecha corta como en Microsoft Planner', () => {
    expect(fechaCorta('2026-09-09')).toBe('9/09');
    expect(fechaCorta('2026-10-14')).toBe('14/10');
    expect(fechaCorta('')).toBe('');
  });

  it('arma el texto de la entrevista', () => {
    expect(textoEntrevista({ fechaEntrevista: '2026-09-09', horaEntrevista: '12:30' })).toBe(
      'Entrevista coordinada para 9/09 a las 12:30',
    );
    expect(textoEntrevista({})).toBe('Entrevista por coordinar');
  });

  it('calcula los días entre dos fechas', () => {
    expect(diasEntre('2026-10-01', '2026-10-13')).toBe(12);
    expect(diasEntre('2026-10-13', '2026-10-13')).toBe(0);
    expect(diasEntre('', '2026-10-13')).toBeNull();
  });

  it('entrega la fecha de hoy en formato ISO', () => {
    expect(hoyIso(new Date(2026, 9, 13, 23, 30))).toBe('2026-10-13');
  });
});

describe('validarAgenda', () => {
  const solicitud = { fechaSolicitud: '2026-10-07' };
  const valida = { fechaEntrevista: '2026-10-14', horaEntrevista: '09:30', modalidadEntrevista: 'Teams' };

  it('acepta una agenda completa', () => {
    expect(validarAgenda(valida, solicitud)).toEqual({});
  });

  it('exige fecha, hora y modalidad', () => {
    const errores = validarAgenda({}, solicitud);
    expect(Object.keys(errores).sort()).toEqual([
      'fechaEntrevista',
      'horaEntrevista',
      'modalidadEntrevista',
    ]);
  });

  it('no permite una entrevista anterior a la solicitud', () => {
    expect(validarAgenda({ ...valida, fechaEntrevista: '2026-10-01' }, solicitud).fechaEntrevista).toMatch(
      /anterior a la fecha de la solicitud/,
    );
  });

  it('limita la hora al horario laboral y valida el formato', () => {
    expect(validarAgenda({ ...valida, horaEntrevista: '07:30' }, solicitud).horaEntrevista).toMatch(
      /entre las 08:00 y las 20:00/,
    );
    expect(validarAgenda({ ...valida, horaEntrevista: '9.30' }, solicitud).horaEntrevista).toMatch(
      /formato HH:MM/,
    );
  });

  it('rechaza una modalidad fuera del catálogo', () => {
    expect(validarAgenda({ ...valida, modalidadEntrevista: 'Zoom' }, solicitud)).toHaveProperty(
      'modalidadEntrevista',
    );
  });
});
