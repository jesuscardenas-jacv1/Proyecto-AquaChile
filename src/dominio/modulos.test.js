import { describe, expect, it } from 'vitest';
import { moduloDeRuta } from './modulos';

describe('moduloDeRuta', () => {
  it('asigna cada pantalla a su módulo', () => {
    expect(moduloDeRuta('/')).toBe('dashboard');
    expect(moduloDeRuta('/candidatos')).toBe('candidatos');
    expect(moduloDeRuta('/candidatos/12/editar')).toBe('candidatos');
    expect(moduloDeRuta('/solicitudes/3/informe')).toBe('solicitudes');
    expect(moduloDeRuta('/planner/informes')).toBe('planner');
    expect(moduloDeRuta('/postulaciones')).toBe('postulaciones');
    expect(moduloDeRuta('/ofertas/3/editar')).toBe('ofertas');
    expect(moduloDeRuta('/administracion')).toBe('administracion');
  });

  it('no confunde rutas que solo empiezan igual', () => {
    expect(moduloDeRuta('/candidatos-inexistente')).toBe('dashboard');
  });
});
