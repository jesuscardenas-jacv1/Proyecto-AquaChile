import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
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

  it.each(['evaluador', 'analista', 'admin'])('%s abre la carpeta desde la insignia del proveedor', async (rol) => {
    render(
      <ProveedorAuth usuarioInicial={{ id: 2, nombre: 'Usuario', rol }}>
        <PanelDocumentos solicitud={solicitud} api={crearApi(datosConArchivos)} />
      </ProveedorAuth>,
    );
    const enlace = await screen.findByRole('link', { name: 'Abrir la carpeta en OneDrive' });
    expect(enlace).toHaveAttribute('href', 'https://onedrive.test/c1');
    expect(enlace).toHaveAttribute('target', '_blank');
  });

  it('la jefatura ve el proveedor, pero sin enlace a la carpeta', async () => {
    render(
      <ProveedorAuth usuarioInicial={{ id: 4, nombre: 'Jefatura', rol: 'jefatura' }}>
        <PanelDocumentos solicitud={solicitud} api={crearApi(datosConArchivos)} />
      </ProveedorAuth>,
    );
    expect(await screen.findByText('OneDrive')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /abrir la carpeta/i })).toBeNull();
  });

  describe('solicitud sin carpeta en la nube', () => {
    const sinCarpeta = { proveedor: 'drive', carpeta: null, permisos: [], archivos: [] };
    const enlace = 'https://drive.google.com/drive/folders/nueva';

    afterEach(() => vi.restoreAllMocks());

    it('crea la carpeta y la abre en una pestaña nueva', async () => {
      const pestana = { location: {}, opener: {}, close: vi.fn() };
      const abrir = vi.spyOn(window, 'open').mockReturnValue(pestana);
      const api = {
        ...crearApi(sinCarpeta),
        obtenerCarpeta: vi.fn().mockResolvedValue({ id: 'n1', nombre: 'S0007 - Ana Pérez', webUrl: enlace }),
      };
      const usuario = userEvent.setup();
      render(<PanelDocumentos solicitud={solicitud} nombreCandidato="Ana Pérez" api={api} />);

      await usuario.click(await screen.findByRole('button', { name: 'Abrir la carpeta en Google Drive' }));

      expect(abrir).toHaveBeenCalledWith('', '_blank');
      expect(api.obtenerCarpeta).toHaveBeenCalledWith(7, 'Ana Pérez');
      await waitFor(() => expect(pestana.location.href).toBe(enlace));
      expect(pestana.opener).toBeNull();
      expect(api.listar).toHaveBeenCalledTimes(2);
    });

    it('si falla, cierra la pestaña y lo avisa', async () => {
      const pestana = { location: {}, opener: {}, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(pestana);
      const api = { ...crearApi(sinCarpeta), obtenerCarpeta: vi.fn().mockRejectedValue(new Error('Drive no responde')) };
      const usuario = userEvent.setup();
      render(<PanelDocumentos solicitud={solicitud} api={api} />);

      await usuario.click(await screen.findByRole('button', { name: 'Abrir la carpeta en Google Drive' }));

      expect(await screen.findByText(/no se pudo abrir la carpeta: drive no responde/i)).toBeInTheDocument();
      expect(pestana.close).toHaveBeenCalled();
    });

    it('la jefatura no puede crearla', async () => {
      render(
        <ProveedorAuth usuarioInicial={{ id: 4, nombre: 'Jefatura', rol: 'jefatura' }}>
          <PanelDocumentos solicitud={solicitud} api={crearApi(sinCarpeta)} />
        </ProveedorAuth>,
      );
      expect(await screen.findByText('Google Drive')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /abrir la carpeta/i })).toBeNull();
    });
  });

  it('sin enlace en la nube la insignia no es un enlace', async () => {
    render(
      <PanelDocumentos
        solicitud={solicitud}
        api={crearApi({ ...datosConArchivos, proveedor: 'local', carpeta: { id: 'c1', nombre: 'S0007 - Ana Pérez', webUrl: null } })}
      />,
    );
    expect(await screen.findByText('Almacenamiento local')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /abrir la carpeta/i })).toBeNull();
  });

  it('muestra la carpeta de OneDrive y los archivos agrupados por categoría', async () => {
    render(<PanelDocumentos solicitud={solicitud} api={crearApi(datosConArchivos)} />);

    expect(await screen.findByText('S0007 - Ana Pérez')).toBeInTheDocument();
    await abrirCarpeta();
    expect(screen.getByText('OneDrive')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir la carpeta en OneDrive' })).toHaveAttribute(
      'href',
      'https://onedrive.test/c1',
    );
    expect(screen.getByRole('button', { name: 'CV - ana.pdf' })).toBeInTheDocument();
    expect(screen.getByText('200 KB · 15-10-2026')).toBeInTheDocument();
    expect(screen.getByText('2,0 MB · 16-10-2026')).toBeInTheDocument();
    // El descriptor aún no tiene archivos.
    expect(screen.getByText(/esta solicitud no tiene descriptor de cargo/i)).toBeInTheDocument();
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
    expect(screen.getByText(/falta el archivo/i)).toHaveTextContent('Súbelo aquí.');
  });

  it('avisa con la carpeta cerrada si falta el descriptor', async () => {
    render(<PanelDocumentos solicitud={solicitud} api={crearApi(datosConArchivos)} />);
    expect(await screen.findByText(/falta el descriptor de cargo en esta carpeta/i)).toBeInTheDocument();
  });

  it('sin permiso para subirlo indica quién debe hacerlo', async () => {
    render(<PanelDocumentos solicitud={solicitud} api={crearApi({ ...datosConArchivos, permisos: [] })} />);
    await abrirCarpeta();
    expect(screen.getByText(/esta solicitud no tiene descriptor/i)).toHaveTextContent(/debe subirlo el analista/i);
  });

  describe('descriptor del catálogo sin copia en la carpeta', () => {
    const conCatalogo = { ...solicitud, descriptorCargo: 'DC_Jefe_de_Centro.pdf' };
    const sinCarpeta = { proveedor: 'drive', carpeta: null, permisos: ['descriptor'], archivos: [] };

    it('lo cuenta como documento y no avisa que falta', async () => {
      render(<PanelDocumentos solicitud={conCatalogo} api={crearApi(sinCarpeta)} />);
      expect(await screen.findByRole('button', { name: /: 1 documento$/ })).toBeInTheDocument();
      expect(screen.queryByText(/falta el descriptor/i)).toBeNull();
    });

    it('se puede ver y descargar', async () => {
      const blob = new Blob(['%PDF'], { type: 'application/pdf' });
      const respuesta = { ok: true, headers: new Headers({ 'content-type': 'application/pdf' }), blob: async () => blob };
      const pedir = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respuesta);
      render(<PanelDocumentos solicitud={conCatalogo} api={crearApi(sinCarpeta)} />);
      const usuario = await abrirCarpeta();

      expect(screen.getByText('Del catálogo')).toBeInTheDocument();
      expect(screen.queryByText(/súbelo aquí/i)).toBeNull();
      expect(screen.getByRole('button', { name: 'Descargar DC_Jefe_de_Centro.pdf' })).toBeInTheDocument();

      await usuario.click(screen.getByRole('button', { name: 'DC_Jefe_de_Centro.pdf' }));
      expect(screen.getByRole('dialog', { name: 'DC_Jefe_de_Centro.pdf' })).toBeInTheDocument();
      await waitFor(() => expect(pedir).toHaveBeenCalled());
      pedir.mockRestore();
    });

    it('si ya hay copia en la carpeta, muestra solo esa', async () => {
      const conCopia = {
        ...sinCarpeta,
        carpeta: { id: 'c1', nombre: 'S0007 - Ana Pérez', webUrl: null },
        archivos: [{ id: 'f9', nombre: 'Descriptor - DC_Jefe_de_Centro.pdf', categoria: 'descriptor', tamano: 1024, puedeEliminar: true }],
      };
      render(<PanelDocumentos solicitud={conCatalogo} api={crearApi(conCopia)} />);
      await abrirCarpeta();
      expect(screen.getByRole('button', { name: 'Descriptor - DC_Jefe_de_Centro.pdf' })).toBeInTheDocument();
      expect(screen.queryByText('Del catálogo')).toBeNull();
    });
  });

  it('con Google Drive muestra su nombre y el enlace para abrir la carpeta', async () => {
    const datosDrive = {
      ...datosConArchivos,
      proveedor: 'drive',
      carpeta: { id: 'c1', nombre: 'S0007 - Ana Pérez', webUrl: 'https://drive.google.com/drive/folders/c1' },
    };
    render(<PanelDocumentos solicitud={solicitud} api={crearApi(datosDrive)} />);

    expect(await screen.findByText('Google Drive')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir la carpeta en Google Drive' })).toHaveAttribute(
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
