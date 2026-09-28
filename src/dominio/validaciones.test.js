import { describe, expect, it } from 'vitest';
import { hayErrores, validarCandidato, validarEvaluacion, validarSolicitud } from './validaciones';

const candidatoValido = {
  nombre: 'María González',
  correo: 'maria.gonzalez@correo.cl',
  telefono: '+56912345678',
  cargo: 'Técnico de Planta',
  familiaCargo: 'Operaciones',
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
    familiaCargo: 'Operaciones',
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
    resultado: 'Aprobado',
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
