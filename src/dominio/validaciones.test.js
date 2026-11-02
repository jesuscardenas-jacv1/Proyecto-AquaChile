import { describe, expect, it } from 'vitest';
import {
  inicialesDe,
  validarCambioContrasena,
  hayErrores,
  validarCandidato,
  validarEdicionSolicitud,
  validarEvaluacion,
  validarSolicitud,
  validarUsuario,
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

describe('validarUsuario', () => {
  const roles = ['admin', 'analista', 'evaluador', 'jefatura'];
  const valido = { nombre: 'Tomás Riquelme', correo: 'tomas@aquachile.cl', rol: 'evaluador', contrasena: 'ClaveSegura2026' };

  it('acepta un usuario nuevo completo y una edición sin contraseña', () => {
    expect(hayErrores(validarUsuario(valido, { esNuevo: true, roles }))).toBe(false);
    expect(hayErrores(validarUsuario({ ...valido, contrasena: '' }, { roles }))).toBe(false);
  });

  it('exige nombre, correo válido, rol y contraseña de 8 caracteres al crear', () => {
    const errores = validarUsuario({ nombre: 'Al', correo: 'malo', rol: 'otro', contrasena: '' }, { esNuevo: true, roles });
    expect(Object.keys(errores).sort()).toEqual(['contrasena', 'correo', 'nombre', 'rol']);
    expect(validarUsuario({ ...valido, contrasena: 'corta' }, { roles }).contrasena).toMatch(/8 caracteres/);
  });
});

describe('validarCambioContrasena', () => {
  it('exige la actual, 8 caracteres, que sea distinta y que coincida la confirmación', () => {
    expect(validarCambioContrasena({ nueva: 'corta', confirmacion: 'otra' })).toEqual({
      actual: 'Ingrese su contraseña actual.',
      nueva: 'La nueva contraseña debe tener al menos 8 caracteres.',
      confirmacion: 'Las contraseñas no coinciden.',
    });
    expect(validarCambioContrasena({ actual: 'Clave2026!', nueva: 'Clave2026!', confirmacion: 'Clave2026!' }).nueva).toMatch(
      /distinta/,
    );
    expect(validarCambioContrasena({ actual: 'Clave2026!', nueva: 'NuevaClave1', confirmacion: 'NuevaClave1' })).toEqual({});
  });
});

describe('inicialesDe', () => {
  it('toma el nombre y el primer apellido', () => {
    expect(inicialesDe('Carolina Muñoz Pérez')).toBe('CM');
    expect(inicialesDe('admin')).toBe('AD');
    expect(inicialesDe('')).toBe('?');
  });
});
