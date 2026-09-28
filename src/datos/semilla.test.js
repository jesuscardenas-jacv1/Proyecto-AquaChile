import { describe, expect, it } from 'vitest';
import { datosSemilla } from './semilla';
import {
  ESTADOS_EVALUACION,
  ESTADOS_SOLICITUD,
  FAMILIAS_CARGO,
  PROFESIONALES,
  RESULTADOS_EVALUACION,
} from './constantes';
import { validarCandidato, validarEvaluacion, validarSolicitud } from '../dominio/validaciones';

const { candidatos, solicitudes, evaluaciones } = datosSemilla;

describe('BD simulada (semilla)', () => {
  it('trae las 100 evaluaciones del Excel', () => {
    expect(candidatos).toHaveLength(100);
    expect(solicitudes).toHaveLength(100);
    expect(evaluaciones).toHaveLength(100);
  });

  it('cumple las validaciones de la aplicación', () => {
    candidatos.forEach((candidato) => expect(validarCandidato(candidato)).toEqual({}));
    solicitudes.forEach((solicitud) =>
      expect(validarSolicitud(solicitud, candidatos)).toEqual({}),
    );
    evaluaciones.forEach((evaluacion) => expect(validarEvaluacion(evaluacion)).toEqual({}));
  });

  it('usa solo valores de los catálogos', () => {
    solicitudes.forEach((solicitud) => {
      expect(FAMILIAS_CARGO).toContain(solicitud.familiaCargo);
      expect(ESTADOS_SOLICITUD).toContain(solicitud.estado);
      expect(PROFESIONALES).toContain(solicitud.profesionalResponsable);
    });
    evaluaciones.forEach((evaluacion) => {
      expect(RESULTADOS_EVALUACION).toContain(evaluacion.resultado);
      expect(ESTADOS_EVALUACION).toContain(evaluacion.estado);
    });
  });

  it('mantiene la integridad entre colecciones', () => {
    const idsCandidatos = new Set(candidatos.map((candidato) => candidato.id));
    const idsSolicitudes = new Set(solicitudes.map((solicitud) => solicitud.id));
    const correos = new Set(candidatos.map((candidato) => candidato.correo));

    expect(correos.size).toBe(candidatos.length);
    solicitudes.forEach((solicitud) => expect(idsCandidatos.has(solicitud.candidatoId)).toBe(true));
    evaluaciones.forEach((evaluacion) =>
      expect(idsSolicitudes.has(evaluacion.solicitudId)).toBe(true),
    );
  });
});
