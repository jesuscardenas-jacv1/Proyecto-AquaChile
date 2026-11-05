import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARGOS, esDescriptorCatalogo, rutaDescriptorCatalogo } from './catalogos';

describe('descriptores del catálogo', () => {
  it('cada cargo tiene su PDF de demostración publicado', () => {
    CARGOS.forEach(({ descriptorCargo }) => {
      const archivo = decodeURIComponent(rutaDescriptorCatalogo(descriptorCargo).split('/').pop());
      const ruta = path.join(process.cwd(), 'public', 'descriptores', archivo);
      expect(fs.existsSync(ruta), `falta ${archivo}`).toBe(true);
      expect(fs.readFileSync(ruta).subarray(0, 4).toString()).toBe('%PDF');
    });
    expect(CARGOS.length).toBeGreaterThan(0);
  });

  it('reconoce solo los nombres del catálogo', () => {
    expect(esDescriptorCatalogo('DC_Monitor_Producción.pdf')).toBe(true);
    expect(esDescriptorCatalogo('otro.pdf')).toBe(false);
    expect(esDescriptorCatalogo('')).toBe(false);
  });
});
