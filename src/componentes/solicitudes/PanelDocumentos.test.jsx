import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import PanelDocumentos from './PanelDocumentos';
import { ProveedorAuth } from '../../datos/AuthContext';
import { ErrorApi } from '../../servicios/apiDocumentos';

const solicitud = { id: 7 };

function crearApi(datos) {
  return {
    listar: vi.fn().mockResolvedValue(datos),
    subir: vi.fn().mockResolvedValue({ ok: true }),
    descargar: vi.fn().mockResolvedValue(undefined),
    contenido: vi.fn().mockResolvedValue(new Blob(['pdf'])),
    eliminar: vi.fn().mockResolvedValue(undefined),
  };
}

const datosConArchivos = {
  proveedor: 'graph',
  carpeta: { id: 'c1', nombre: 'S0007 - Ana Pérez', webUrl: 'https://onedrive.test/c1' },
  permisos: ['cv', 'descriptor'],
  archivos: [
    {
      id: 'f1',
      nombre: 'CV - ana.pdf',
      categoria: 'cv',
      tamano: 204800,
      modificado: '2026-10-15T12:00:00Z',
      puedeEliminar: true,
    },
    {
      id: 'f2',
      nombre: 'Informe - ana.pdf',
      categoria: 'informe',
      tamano: 2 * 1024 * 1024,
      modificado: '2026-10-16T12:00:00Z',
      puedeEliminar: false,
    },
  ],
};

const abrirCarpeta = async (usuario = userEvent.setup()) => {
  await usuario.click(await screen.findByRole('button', { name: /^Carpeta / }));
  return usuario;
};

describe('PanelDocumentos', () => {
  it('la carpeta parte cerrada, indica cuántos documentos tiene y al pincharla los lista', async () => {
    const usuario = userEvent.setup();
    render(<PanelDocumentos solicitud={solicitud} api={crearApi(datosConArchivos)} />);

    const carpeta = await screen.findByRole('button', { name: 'Carpeta S0007 - Ana Pérez: 2 documentos' });
    expect(carpeta).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'CV - ana.pdf' })).toBeNull();

    await usuario.click(carpeta);
    expect(carpeta).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'CV - ana.pdf' })).toBeInTheDocument();

    await usuario.click(carpeta);
    expect(screen.queryByRole('button', { name: 'CV - ana.pdf' })).toBeNull();
  });

  it('al pinchar un documento lo abre dentro del portal, sin descargarlo', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:cv');
    URL.revokeObjectURL = vi.fn();
    const api = crearApi(datosConArchivos);
    render(<PanelDocumentos solicitud={solicitud} api={api} />);
    const usuario = await abrirCarpeta();

    await usuario.click(screen.getByRole('button', { name: 'CV - ana.pdf' }));
    expect(screen.getByRole('dialog', { name: 'CV - ana.pdf' })).toBeInTheDocument();
    expect(await screen.findByTitle('CV - ana.pdf')).toHaveAttribute('src', 'blob:cv');
    expect(api.contenido).toHaveBeenCalledWith(7, datosConArchivos.archivos[0]);
    expect(api.descargar).not.toHaveBeenCalled();
  });

  it('sin carpeta creada muestra el nombre que tendrá', async () => {
    render(
      <PanelDocumentos
        solicitud={solicitud}
        nombreCandidato="Ana Pérez"
        api={crearApi({ ...datosConArchivos, carpeta: null, archivos: [] })}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Carpeta S0007 - Ana Pérez: Sin documentos todavía' })).toBeInTheDocument();
  });

  it('solo el administrador ve el enlace a la nube; los demás trabajan en el portal', async () => {
    render(
      <ProveedorAuth usuarioInicial={{ id: 2, nombre: 'Psicóloga', rol: 'evaluador' }}>
        <PanelDocumentos solicitud={solicitud} api={crearApi(datosConArchivos)} />
      </ProveedorAuth>,
    );
    await screen.findByText('S0007 - Ana Pérez');
    expect(screen.queryByRole('link', { name: /abrir en/i })).toBeNull();
  });

  it('muestra la carpeta de OneDrive y los archivos agrupados por categoría', async () => {
    render(<PanelDocumentos solicitud={solicitud} api={crearApi(datosConArchivos)} />);

    expect(await screen.findByText('S0007 - Ana Pérez')).toBeInTheDocument();
    await abrirCarpeta();
    expect(screen.getByText('OneDrive')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir en onedrive/i })).toHaveAttribute(
      'href',
      'https://onedrive.test/c1',
    );
    expect(screen.getByRole('button', { name: 'CV - ana.pdf' })).toBeInTheDocument();
    expect(screen.getByText('200 KB · 15-10-2026')).toBeInTheDocument();
    expect(screen.getByText('2,0 MB · 16-10-2026')).toBeInTheDocument();
    // El descriptor aún no tiene archivos.
    expect(screen.getByText('Sin archivos.')).toBeInTheDocument();
  });

  it('si el descriptor indicado en la solicitud aún no está en la carpeta, lo dice', async () => {
    render(
      <PanelDocumentos
        solicitud={{ ...solicitud, descriptorCargo: 'DC_Analista.pdf' }}
        api={crearApi(datosConArchivos)}
      />,
    );
    await abrirCarpeta();
    expect(await screen.findByText('DC_Analista.pdf')).toBeInTheDocument();
    expect(screen.getByText(/súbelo aquí para guardarlo en la carpeta/i)).toBeInTheDocument();
  });

  it('con Google Drive muestra su nombre y el enlace para abrir la carpeta', async () => {
    const datosDrive = {
      ...datosConArchivos,
      proveedor: 'drive',
      carpeta: { id: 'c1', nombre: 'S0007 - Ana Pérez', webUrl: 'https://drive.google.com/drive/folders/c1' },
    };
    render(<PanelDocumentos solicitud={solicitud} api={crearApi(datosDrive)} />);

    expect(await screen.findByText('Google Drive')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir en google drive/i })).toHaveAttribute(
      'href',
      'https://drive.google.com/drive/folders/c1',
    );
  });

  it('solo ofrece subir y eliminar en las categorías permitidas', async () => {
    render(<PanelDocumentos solicitud={solicitud} api={crearApi(datosConArchivos)} />);
    await abrirCarpeta();

    expect(screen.getAllByRole('button', { name: /subir/i })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Eliminar CV - ana.pdf' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar Informe - ana.pdf' })).toBeNull();
  });

  it('sube el archivo elegido con su categoría y recarga la lista', async () => {
    const usuario = userEvent.setup();
    const api = crearApi({ ...datosConArchivos, carpeta: null, archivos: [] });
    render(<PanelDocumentos solicitud={solicitud} nombreCandidato="Ana Pérez" api={api} />);
    expect(await screen.findByText(/sin documentos todavía/i)).toBeInTheDocument();
    await abrirCarpeta(usuario);

    const archivo = new File(['pdf'], 'curriculum.pdf', { type: 'application/pdf' });
    await usuario.upload(screen.getByLabelText('Archivo para CV del candidato'), archivo);

    await waitFor(() =>
      expect(api.subir).toHaveBeenCalledWith(7, {
        categoria: 'cv',
        archivo,
        nombreCandidato: 'Ana Pérez',
      }),
    );
    expect(await screen.findByText(/se guardó en la carpeta/i)).toBeInTheDocument();
    expect(api.listar).toHaveBeenCalledTimes(2);
  });

  it('descarga y elimina (con confirmación)', async () => {
    const usuario = userEvent.setup();
    const api = crearApi(datosConArchivos);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PanelDocumentos solicitud={solicitud} api={api} />);

    await abrirCarpeta(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Descargar CV - ana.pdf' }));
    expect(api.descargar).toHaveBeenCalledWith(7, datosConArchivos.archivos[0]);

    await usuario.click(screen.getByRole('button', { name: 'Eliminar CV - ana.pdf' }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(api.eliminar).toHaveBeenCalledWith(7, 'f1'));
    expect(await screen.findByText('Documento eliminado.')).toBeInTheDocument();
  });

  it('muestra los errores de la API sin romper la página', async () => {
    const usuario = userEvent.setup();
    const api = crearApi(datosConArchivos);
    api.subir.mockRejectedValue(new ErrorApi('Tipo de archivo no permitido.', { status: 400 }));
    render(<PanelDocumentos solicitud={solicitud} api={api} />);
    await abrirCarpeta(usuario);

    await usuario.upload(
      screen.getByLabelText('Archivo para Descriptor de cargo'),
      new File(['x'], 'descriptor.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByText('Tipo de archivo no permitido.')).toBeInTheDocument();
  });

  it('avisa cuando el servicio de documentos no está disponible y permite reintentar', async () => {
    const usuario = userEvent.setup();
    const api = crearApi(datosConArchivos);
    api.listar.mockRejectedValueOnce(new ErrorApi('sin token', { noDisponible: true }));
    render(<PanelDocumentos solicitud={solicitud} api={api} />);

    const alerta = await screen.findByRole('alert');
    expect(within(alerta).getByText('Documentos no disponibles')).toBeInTheDocument();

    await usuario.click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('S0007 - Ana Pérez')).toBeInTheDocument();
  });
  it('la pauta de entrevista aparece, marcada como confidencial, solo para quien puede subirla', async () => {
    const { unmount } = render(
      <PanelDocumentos solicitud={solicitud} api={crearApi({ ...datosConArchivos, permisos: ['informe', 'pauta'] })} />,
    );
    await abrirCarpeta();
    expect(await screen.findByText('Pauta de entrevista')).toBeInTheDocument();
    expect(screen.getByText('Confidencial')).toBeInTheDocument();
    expect(screen.getByLabelText('Archivo para Pauta de entrevista')).toBeInTheDocument();
    unmount();

    render(<PanelDocumentos solicitud={solicitud} api={crearApi(datosConArchivos)} />);
    await abrirCarpeta();
    expect(screen.queryByText('Pauta de entrevista')).toBeNull();
  });
});
