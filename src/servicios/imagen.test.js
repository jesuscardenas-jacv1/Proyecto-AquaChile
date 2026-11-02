import { describe, expect, it } from 'vitest';
import { TAMANO_MAXIMO_FOTO, validarArchivoFoto } from './imagen';

const archivo = (tipo, tamano = 1000) => {
  const resultado = new File(['x'], 'foto', { type: tipo });
  Object.defineProperty(resultado, 'size', { value: tamano });
  return resultado;
};

describe('validarArchivoFoto', () => {
  it('acepta JPG, PNG y WebP de hasta 5 MB', () => {
    expect(validarArchivoFoto(archivo('image/jpeg'))).toBeNull();
    expect(validarArchivoFoto(archivo('image/png'))).toBeNull();
    expect(validarArchivoFoto(archivo('image/webp'))).toBeNull();
  });

  it('rechaza otros formatos, archivos grandes o vacíos', () => {
    expect(validarArchivoFoto(archivo('application/pdf'))).toMatch(/JPG, PNG o WebP/);
    expect(validarArchivoFoto(archivo('image/png', TAMANO_MAXIMO_FOTO + 1))).toMatch(/5 MB/);
    expect(validarArchivoFoto(null)).toBe('Seleccione una imagen.');
  });
});
