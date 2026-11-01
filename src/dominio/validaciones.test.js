import { describe, expect, it } from 'vitest';
import {
  hayErrores,
  validarCandidato,
  validarEdicionSolicitud,
  validarEvaluacion,
  validarSolicitud,
} from './validaciones';

const candidatoValido = {
  nombre: 'María González',
  correo: 'maria.gonzalez@correo.cl',
  telefono: '+56912345678',
  cargo: 'Técnico de Planta',
  familiaCargo: 'Técnico B C',
};

describe('validarCandidato', () => {
  it('no devuelve errores con datos válidos', () => {
    expect(validarCandidato(candidatoValido)).toEqual({});
    expect(hayErrores(validarCandidato(candidatoValido))).toBe(false);
  });

  it('exige todos los campos obligatorios', () => {
    const errores = validarCandidato({});
    expect(Object.keys(errores).sort()).toEqual(
      ['cargo', 'correo', 'familiaCargo', 'nombre', 'telefono'].sort(),
    );
  });

  it('detecta correo y teléfono inválidos', () => {
    const errores = validarCandidato({ ...candidatoValido, correo: 'correo-malo', telefono: 'abc' });
    expect(errores.correo).toMatch(/formato válido/i);
    expect(errores.telefono).toMatch(/solo números/i);
  });

  it('acepta teléfono con espacios y guiones', () => {
    expect(validarCandidato({ ...candidatoValido, telefono: '+56 9 1234 5678' }).telefono).toBeUndefined();
  });

  it('rechaza nombres demasiado cortos', () => {
    expect(validarCandidato({ ...candidatoValido, nombre: 'Jo' }).nombre).toMatch(/3 caracteres/);
  });
});

describe('validarSolicitud', () => {
  const solicitudValida = {
    candidatoId: 1,
    cargo: 'Técnico de Planta',
    familiaCargo: 'Técnico B C',
    fechaSolicitud: '2026-01-10',
  };

  it('acepta una solicitud válida', () => {
    expect(validarSolicitud(solicitudValida, [{ id: 1 }])).toEqual({});
  });

  it('rechaza fechas futuras', () => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const errores = validarSolicitud(
      { ...solicitudValida, fechaSolicitud: manana.toISOString().slice(0, 10) },
      [{ id: 1 }],
    );
    expect(errores.fechaSolicitud).toMatch(/no puede ser futura/);
  });

  it('rechaza un candidato que no existe', () => {
    const errores = validarSolicitud({ ...solicitudValida, candidatoId: 99 }, [{ id: 1 }]);
    expect(errores.candidatoId).toMatch(/no existe en el registro/);
  });
});

describe('validarEvaluacion', () => {
  const evaluacionValida = {
    fechaEvaluacion: '2026-02-01',
    resultado: 'Recomendado',
    observaciones: 'Perfil estable para el cargo evaluado.',
  };

  it('acepta una evaluación válida', () => {
    expect(validarEvaluacion(evaluacionValida)).toEqual({});
  });

  it('exige resultado y observaciones mínimas', () => {
    const errores = validarEvaluacion({ fechaEvaluacion: '2026-02-01', resultado: '', observaciones: 'corto' });
    expect(errores.resultado).toBeTruthy();
    expect(errores.observaciones).toMatch(/al menos 10 caracteres/);
  });
});

describe('validarEdicionSolicitud', () => {
  const valida = {
    reclutador: 'Carolina Muñoz',
    cargo: 'Técnico de Planta',
    familiaCargo: 'Técnico B C',
    ubicacion: 'Planta Calbuco',
    ceco: 'A170010311',
    fechaSolicitud: '2026-08-03',
  };

  it('acepta una edición completa', () => {
    expect(hayErrores(validarEdicionSolicitud(valida))).toBe(false);
  });

  it('exige los campos obligatorios, el formato del CECO y una fecha no futura', () => {
    const errores = validarEdicionSolicitud({ ...valida, cargo: ' ', ceco: 'X1', fechaSolicitud: '2999-01-01', reclutador: '' });
    expect(Object.keys(errores).sort()).toEqual(['cargo', 'ceco', 'fechaSolicitud', 'reclutador']);
  });
});

describe('validarEvaluacion con competencias', () => {
  const base = { fechaEvaluacion: '2026-03-05', resultado: 'Recomendado', observaciones: 'Perfil adecuado al cargo.' };

  it('las competencias son opcionales', () => {
    expect(hayErrores(validarEvaluacion({ ...base, competencias: [] }))).toBe(false);
  });

  it('cada competencia evaluada necesita nivel y al menos un comentario', () => {
    const errores = validarEvaluacion({
      ...base,
      competencias: [
        { competencia: 'Liderazgo', nivel: '', fortalezas: 'Guía al equipo', oportunidades: '' },
        { competencia: 'Trabajo en equipo', nivel: 'Esperado', fortalezas: ' ', oportunidades: '' },
        { competencia: 'Comunicación efectiva', nivel: 'Esperado', fortalezas: '', oportunidades: 'Escucha activa' },
      ],
    });
    expect(errores).toEqual({
      'competencia:Liderazgo': 'Indique el nivel de "Liderazgo".',
      'competencia:Trabajo en equipo': 'Indique fortalezas u oportunidades de desarrollo en "Trabajo en equipo".',
    });
  });
});
