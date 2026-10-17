import { describe, expect, it } from 'vitest';
import {
  candidatosVisibles,
  filtrarOfertas,
  filtrarPostulaciones,
  resumenPostulaciones,
  validarPostulacion,
} from './postulaciones';
import { datosPortal } from '../pruebas/utilidades';

const valida = {
  nombre: 'Camilo Fuentealba',
  correo: 'camilo@correo.cl',
  telefono: '+56 9 1234 5678',
  ciudad: 'Puerto Montt',
  origen: 'Externo',
  cv: { name: 'cv.pdf' },
  consentimiento: true,
};

describe('validarPostulacion', () => {
  it('acepta una postulación completa', () => {
    expect(validarPostulacion(valida)).toEqual({});
  });

  it('exige todos los campos, CV y consentimiento', () => {
    expect(Object.keys(validarPostulacion({})).sort()).toEqual(
      ['ciudad', 'consentimiento', 'correo', 'cv', 'nombre', 'origen', 'telefono'].sort(),
    );
  });

  it('valida el formato del correo y del teléfono', () => {
    const errores = validarPostulacion({ ...valida, correo: 'camilo@', telefono: 'abc' });
    expect(errores.correo).toMatch(/formato/);
    expect(errores.telefono).toMatch(/números/);
  });
});

describe('filtrarOfertas', () => {
  const ofertas = [...datosPortal.ofertas, { ...datosPortal.ofertas[0], id: 3, estado: 'Cerrada' }];

  it('muestra solo ofertas abiertas, las más recientes primero', () => {
    expect(filtrarOfertas(ofertas).map((o) => o.id)).toEqual([2, 1]);
  });

  it('filtra por área y por texto sin importar tildes', () => {
    expect(filtrarOfertas(ofertas, { area: 'Industrial' }).map((o) => o.id)).toEqual([1]);
    expect(filtrarOfertas(ofertas, { busqueda: 'electrico' }).map((o) => o.id)).toEqual([2]);
  });
});

describe('postulaciones', () => {
  it('une oferta y candidato y filtra por estado, oferta y texto', () => {
    const contexto = { ofertas: datosPortal.ofertas, candidatos: datosPortal.candidatos };
    const recibidas = filtrarPostulaciones(datosPortal.postulaciones, contexto, { estado: 'Recibida' });
    expect(recibidas).toHaveLength(1);
    expect(recibidas[0].candidato.nombre).toBe('Camilo Fuentealba');
    expect(recibidas[0].oferta.titulo).toMatch(/Monitor/);

    expect(filtrarPostulaciones(datosPortal.postulaciones, contexto, { ofertaId: '2' })).toHaveLength(1);
    expect(filtrarPostulaciones(datosPortal.postulaciones, contexto, { busqueda: 'josefa' })).toHaveLength(1);
  });

  it('cuenta las postulaciones por estado', () => {
    expect(resumenPostulaciones(datosPortal.postulaciones)).toEqual({
      Recibida: 1,
      'En evaluación': 0,
      Descartada: 1,
    });
  });
});

describe('candidatosVisibles', () => {
  it('el evaluador solo ve candidatos con solicitud; el resto ve a todos', () => {
    const { candidatos, solicitudes } = datosPortal;
    expect(candidatosVisibles(candidatos, solicitudes)).toHaveLength(4);
    expect(candidatosVisibles(candidatos, solicitudes, { soloEnEvaluacion: true }).map((c) => c.id)).toEqual([1, 2]);
  });
});
