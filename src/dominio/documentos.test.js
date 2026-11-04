import { describe, expect, it } from 'vitest';
import { nombreCarpetaSolicitud, visorDeArchivo } from './documentos';

describe('visorDeArchivo', () => {
  it('reconoce lo que se puede ver en el portal, sin importar mayúsculas', () => {
    expect(visorDeArchivo('CV - ana.PDF')).toEqual({ visor: 'pdf', tipo: 'application/pdf' });
    expect(visorDeArchivo('foto.jpg').visor).toBe('imagen');
    expect(visorDeArchivo('CV - ana.docx').visor).toBe('word');
    expect(visorDeArchivo('entrevista.mp3').visor).toBe('audio');
    expect(visorDeArchivo('entrevista.mp4').visor).toBe('video');
  });

  it('lo demás se descarga', () => {
    expect(visorDeArchivo('planilla.xlsx')).toBeNull();
    expect(visorDeArchivo('antiguo.doc')).toBeNull();
    expect(visorDeArchivo('sin-extension')).toBeNull();
  });
});

describe('nombreCarpetaSolicitud', () => {
  it('sigue el formato de la carpeta del backend', () => {
    expect(nombreCarpetaSolicitud(7, 'Ana Pérez')).toBe('S0007 - Ana Pérez');
    expect(nombreCarpetaSolicitud(123)).toBe('S0123');
  });
});
