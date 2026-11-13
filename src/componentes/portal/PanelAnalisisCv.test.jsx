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
    criterios: [
      { requisito: 'Técnico de nivel medio o superior', tipo: 'obligatorio', nivel: 'cumple', evidencia: 'Técnico en procesos industriales' },
      { requisito: '2 años de experiencia en plantas de proceso', tipo: 'obligatorio', nivel: 'parcial', evidencia: '1 año en planta' },
      { requisito: 'Deseable licencia de grúa horquilla', tipo: 'deseable', nivel: 'sin-evidencia', evidencia: 'No la menciona' },
      { requisito: 'Disponibilidad para turnos rotativos', tipo: 'obligatorio', nivel: 'no-evaluable', evidencia: '' },
    ],
    cumplimiento: { porcentaje: 60, evaluados: 3, total: 4, obligatoriosCumplidos: 1, obligatoriosTotal: 3, fuente: 'oferta' },
    preguntasSugeridas: ['¿Ha operado grúa horquilla?'],
    alertas: ['Hay un período de 2024 sin información.'],
  },
};

const crearApi = (cambios = {}) => ({
  conectado: () => true,
  estado: vi.fn().mockResolvedValue({ disponible: true }),
  obtenerAnalisis: vi.fn().mockResolvedValue(null),
  obtenerAnalisisSolicitud: vi.fn().mockResolvedValue(null),
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

  it('el analista analiza el CV y ve el porcentaje de cumplimiento, cada requisito, preguntas y el aviso de que es una sugerencia', async () => {
    const api = crearApi();
    const usuario = userEvent.setup();
    render(<PanelAnalisisCv postulacion={postulacion} puedeAnalizar api={api} />);

    await usuario.click(await screen.findByRole('button', { name: /analizar cv/i }));

    expect(api.analizarPostulacion).toHaveBeenCalledWith(7);
    expect(await screen.findByText('Técnico con tres años en plantas de proceso.')).toBeInTheDocument();
    expect(screen.getByText('60 %')).toBeInTheDocument();
    expect(screen.getByText(/de cumplimiento de los requisitos de la oferta según el CV/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /cumplimiento de requisitos/i })).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByText(/Obligatorios cumplidos: 1 de 3/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Requisitos que respalda el CV/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Brechas para el cargo/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Confirmar en la entrevista/ })).toBeInTheDocument();
    expect(screen.getByText('2 años de experiencia en plantas de proceso')).toBeInTheDocument();
    expect(screen.getByText('1 año en planta')).toBeInTheDocument();
    expect(screen.getByText('Deseable')).toBeInTheDocument();
    expect(screen.getByText(/· Parcial/)).toBeInTheDocument();
    expect(screen.getByText(/¿Cómo se calcula\?/)).toBeInTheDocument();
    expect(screen.getByText('¿Ha operado grúa horquilla?')).toBeInTheDocument();
    expect(screen.getByText('Hay un período de 2024 sin información.')).toBeInTheDocument();
    expect(screen.getByText(/comparando con DC_Monitor_Produccion\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/ni debe usarse por sí sola para descartar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver a analizar/i })).toBeInTheDocument();
  });

  it('sin requisitos evaluables no muestra un porcentaje', async () => {
    const sinNumero = {
      ...analisis,
      resultado: { ...analisis.resultado, criterios: [], cumplimiento: { porcentaje: null, fuente: null } },
    };
    render(<PanelAnalisisCv postulacion={postulacion} api={crearApi({ obtenerAnalisis: vi.fn().mockResolvedValue(sinNumero) })} />);
    expect(await screen.findByText(/Sin porcentaje/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('un análisis guardado antes de los criterios se sigue viendo con coincidencias y brechas', async () => {
    const antiguo = {
      ...analisis,
      resultado: {
        resumen: 'Análisis antiguo.',
        coincidencias: [{ requisito: 'Experiencia en producción', evidencia: '3 años en planta' }],
        brechas: [{ requisito: 'Licencia de grúa', detalle: 'No la menciona' }],
        preguntasSugeridas: [],
        alertas: [],
      },
    };
    render(<PanelAnalisisCv postulacion={postulacion} api={crearApi({ obtenerAnalisis: vi.fn().mockResolvedValue(antiguo) })} />);
    expect(await screen.findByText(/3 años en planta/)).toBeInTheDocument();
    expect(screen.getByText(/No la menciona/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('desde una solicitud, la psicóloga ve el análisis de la postulación de origen, sin poder pedir otro', async () => {
    const api = crearApi({ obtenerAnalisisSolicitud: vi.fn().mockResolvedValue(analisis) });
    render(<PanelAnalisisCv solicitudId={12} puedeAnalizar api={api} />);

    expect(await screen.findByText('60 %')).toBeInTheDocument();
    expect(api.obtenerAnalisisSolicitud).toHaveBeenCalledWith(12);
    expect(api.obtenerAnalisis).not.toHaveBeenCalled();
    expect(screen.getByText('No la menciona')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /analizar/i })).toBeNull();
  });

  it('desde una solicitud sin análisis lo indica', async () => {
    render(<PanelAnalisisCv solicitudId={12} api={crearApi()} />);
    expect(await screen.findByText(/no tiene análisis de CV/)).toBeInTheDocument();
  });

  it('sin brechas lo dice en lugar de dejar la sección vacía', async () => {
    const completo = {
      ...analisis,
      resultado: {
        ...analisis.resultado,
        criterios: [{ requisito: 'Título técnico', tipo: 'obligatorio', nivel: 'cumple', evidencia: 'Técnico' }],
        cumplimiento: { porcentaje: 100, obligatoriosCumplidos: 1, obligatoriosTotal: 1, fuente: 'oferta' },
      },
    };
    render(<PanelAnalisisCv postulacion={postulacion} api={crearApi({ obtenerAnalisis: vi.fn().mockResolvedValue(completo) })} />);
    expect(await screen.findByText(/No se detectaron brechas/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Confirmar en la entrevista/ })).toBeNull();
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
