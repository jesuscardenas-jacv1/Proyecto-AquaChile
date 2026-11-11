import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PanelAnalisisCv from './PanelAnalisisCv';

const postulacion = { id: 7, cvNombre: 'cv.pdf' };
const analisis = {
  postulacionId: 7,
  modelo: 'claude-opus-5-5',
  descriptor: 'DC_Monitor_Produccion.pdf',
  creadoEn: '2026-11-11 10:00:00',
  resultado: {
    resumen: 'Técnico con tres años en plantas de proceso.',
    coincidencias: [{ requisito: 'Experiencia en producción', evidencia: '3 años en planta' }],
    brechas: [{ requisito: 'Licencia de grúa', detalle: 'No la menciona' }],
    preguntasSugeridas: ['¿Ha operado grúa horquilla?'],
    alertas: ['Hay un período de 2024 sin información.'],
  },
};

const crearApi = (cambios = {}) => ({
  conectado: () => true,
  estado: vi.fn().mockResolvedValue({ disponible: true }),
  obtenerAnalisis: vi.fn().mockResolvedValue(null),
  analizarPostulacion: vi.fn().mockResolvedValue(analisis),
  ...cambios,
});

describe('PanelAnalisisCv', () => {
  it('no aparece si el servidor no tiene la IA configurada', async () => {
    const api = crearApi({ estado: vi.fn().mockResolvedValue({ disponible: false }) });
    const { container } = render(<PanelAnalisisCv postulacion={postulacion} puedeAnalizar api={api} />);
    await vi.waitFor(() => expect(api.estado).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('el analista analiza el CV y ve coincidencias, brechas, preguntas y el aviso de que es una sugerencia', async () => {
    const api = crearApi();
    const usuario = userEvent.setup();
    render(<PanelAnalisisCv postulacion={postulacion} puedeAnalizar api={api} />);

    await usuario.click(await screen.findByRole('button', { name: /analizar cv/i }));

    expect(api.analizarPostulacion).toHaveBeenCalledWith(7);
    expect(await screen.findByText('Técnico con tres años en plantas de proceso.')).toBeInTheDocument();
    expect(screen.getByText(/3 años en planta/)).toBeInTheDocument();
    expect(screen.getByText(/No la menciona/)).toBeInTheDocument();
    expect(screen.getByText('¿Ha operado grúa horquilla?')).toBeInTheDocument();
    expect(screen.getByText('Hay un período de 2024 sin información.')).toBeInTheDocument();
    expect(screen.getByText(/comparando con DC_Monitor_Produccion\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/ni debe usarse por sí sola para descartar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver a analizar/i })).toBeInTheDocument();
  });

  it('muestra el error del servidor si el análisis falla', async () => {
    const api = crearApi({ analizarPostulacion: vi.fn().mockRejectedValue(new Error('La IA no pudo procesar este documento.')) });
    const usuario = userEvent.setup();
    render(<PanelAnalisisCv postulacion={postulacion} puedeAnalizar api={api} />);

    await usuario.click(await screen.findByRole('button', { name: /analizar cv/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La IA no pudo procesar este documento.');
  });

  it('la jefatura ve el último análisis guardado, sin poder pedir otro', async () => {
    const api = crearApi({ obtenerAnalisis: vi.fn().mockResolvedValue(analisis) });
    render(<PanelAnalisisCv postulacion={postulacion} api={api} />);

    expect(await screen.findByText('Técnico con tres años en plantas de proceso.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /analizar/i })).toBeNull();
    expect(api.analizarPostulacion).not.toHaveBeenCalled();
  });

  it('sin análisis guardado, la jefatura lo ve indicado', async () => {
    render(<PanelAnalisisCv postulacion={postulacion} api={crearApi()} />);
    expect(await screen.findByText('Esta postulación aún no tiene análisis.')).toBeInTheDocument();
  });
});
