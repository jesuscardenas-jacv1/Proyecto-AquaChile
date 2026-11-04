import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VentanaDocumento from './VentanaDocumento';

vi.mock('mammoth/mammoth.browser', () => ({
  default: { convertToHtml: vi.fn().mockResolvedValue({ value: '<p>Experiencia laboral</p>' }) },
}));

const crearApi = () => ({
  contenido: vi.fn().mockResolvedValue(
    Object.assign(new Blob(['contenido']), { arrayBuffer: async () => new ArrayBuffer(1) }),
  ),
  descargar: vi.fn().mockResolvedValue(undefined),
});
const abrir = (nombre, api = crearApi(), alCerrar = vi.fn()) => {
  render(<VentanaDocumento solicitudId={7} archivo={{ id: 'f1', nombre }} api={api} alCerrar={alCerrar} />);
  return { api, alCerrar };
};

describe('VentanaDocumento', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:documento');
    URL.revokeObjectURL = vi.fn();
  });

  it('muestra un PDF dentro del portal', async () => {
    const { api } = abrir('CV - ana.pdf');
    expect(screen.getByRole('dialog', { name: 'CV - ana.pdf' })).toBeInTheDocument();
    expect(await screen.findByTitle('CV - ana.pdf')).toHaveAttribute('src', 'blob:documento');
    expect(api.contenido).toHaveBeenCalledWith(7, { id: 'f1', nombre: 'CV - ana.pdf' });
    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('application/pdf');
  });

  it('muestra una imagen', async () => {
    abrir('foto.png');
    expect(await screen.findByRole('img', { name: 'foto.png' })).toHaveAttribute('src', 'blob:documento');
  });

  it('muestra un Word en un marco aislado, sin scripts', async () => {
    abrir('CV - ana.docx');
    const marco = await screen.findByTitle('CV - ana.docx');
    expect(marco).toHaveAttribute('sandbox', '');
    expect(marco.getAttribute('srcdoc')).toContain('Experiencia laboral');
  });

  it('un formato que el navegador no muestra ofrece descargar', async () => {
    const usuario = userEvent.setup();
    const { api } = abrir('planilla.xlsx');
    expect(screen.getByText(/no se puede mostrar en el navegador/i)).toBeInTheDocument();
    expect(api.contenido).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole('button', { name: 'Descargar' }));
    expect(api.descargar).toHaveBeenCalled();
  });

  it('informa el error si no se puede abrir y se cierra con Escape', async () => {
    const usuario = userEvent.setup();
    const api = crearApi();
    api.contenido.mockRejectedValue(new Error('Archivo no encontrado.'));
    const { alCerrar } = abrir('CV - ana.pdf', api);
    expect(await screen.findByRole('alert')).toHaveTextContent('Archivo no encontrado.');
    await usuario.keyboard('{Escape}');
    expect(alCerrar).toHaveBeenCalled();
  });

  it('libera el archivo temporal al cerrar', async () => {
    const api = crearApi();
    const { unmount } = render(
      <VentanaDocumento solicitudId={7} archivo={{ id: 'f1', nombre: 'a.pdf' }} api={api} alCerrar={vi.fn()} />,
    );
    await screen.findByTitle('a.pdf');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:documento');
  });
});
