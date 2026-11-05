import { describe, expect, it } from 'vitest';
import {
  aplicarEdicionOferta,
  contarPostulacionesPorOferta,
  crearOferta,
  filtrarGestionOfertas,
  requisitosDesdeTexto,
  validarOferta,
} from './ofertas';

const completa = {
  titulo: 'Operario de Planta',
  area: 'Producción',
  cargo: 'Operario',
  familiaCargo: 'Operario',
  ubicacion: 'Calbuco',
  region: 'Los Lagos',
  descripcion: 'Apoyo en la línea de proceso.',
};

describe('ofertas', () => {
  it('un borrador solo exige título; publicar exige todos los datos', () => {
    expect(validarOferta({ titulo: 'Op' })).toHaveProperty('titulo');
    expect(validarOferta({ titulo: 'Operario' })).toEqual({});
    expect(Object.keys(validarOferta({ titulo: 'Operario' }, { completa: true }))).toEqual([
      'area',
      'cargo',
      'familiaCargo',
      'ubicacion',
      'region',
      'descripcion',
    ]);
    expect(validarOferta(completa, { completa: true })).toEqual({});
  });

  it('convierte los requisitos en una lista, sin líneas vacías', () => {
    expect(requisitosDesdeTexto(' Licencia B \n\n  Turnos\n')).toEqual(['Licencia B', 'Turnos']);
  });

  it('crea borradores sin fecha y publicadas con la fecha del día', () => {
    expect(crearOferta(9, completa)).toMatchObject({ id: 9, estado: 'Borrador', fechaPublicacion: '' });
    expect(crearOferta(9, completa, { publicar: true, fecha: '2026-11-05' })).toMatchObject({
      estado: 'Abierta',
      fechaPublicacion: '2026-11-05',
    });
  });

  it('editar publica solo un borrador y conserva la fecha original', () => {
    const borrador = crearOferta(1, completa);
    expect(aplicarEdicionOferta(borrador, completa, { publicar: true, fecha: '2026-11-05' })).toMatchObject({
      estado: 'Abierta',
      fechaPublicacion: '2026-11-05',
    });

    const cerrada = { ...crearOferta(2, completa), estado: 'Cerrada', fechaPublicacion: '2026-01-01' };
    expect(aplicarEdicionOferta(cerrada, completa, { publicar: true, fecha: '2026-11-05' })).toMatchObject({
      estado: 'Cerrada',
      fechaPublicacion: '2026-01-01',
    });
  });

  it('lista borradores primero y filtra por estado y texto, sin distinguir tildes', () => {
    const ofertas = [
      { id: 1, titulo: 'Técnico', estado: 'Abierta', fechaPublicacion: '2026-01-01' },
      { id: 2, titulo: 'Analista', estado: 'Abierta', fechaPublicacion: '2026-02-01' },
      { id: 3, titulo: 'Operario', estado: 'Borrador', fechaPublicacion: '' },
    ];
    expect(filtrarGestionOfertas(ofertas).map((o) => o.id)).toEqual([3, 2, 1]);
    expect(filtrarGestionOfertas(ofertas, { estado: 'Borrador' }).map((o) => o.id)).toEqual([3]);
    expect(filtrarGestionOfertas(ofertas, { busqueda: 'tecnico' }).map((o) => o.id)).toEqual([1]);
  });

  it('cuenta las postulaciones por oferta', () => {
    expect(contarPostulacionesPorOferta([{ ofertaId: 1 }, { ofertaId: 1 }, { ofertaId: 2 }])).toEqual({ 1: 2, 2: 1 });
  });
});
