import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GuiaEntrevista from './GuiaEntrevista';

const analisis = {
  postulacionId: 4,
  resultado: {
    resumen: 'Técnico con un año en planta.',
    criterios: [
      { requisito: 'Técnico de nivel medio', tipo: 'obligatorio', nivel: 'cumple', evidencia: 'Técnico (2023)' },
      { requisito: '2 años en plantas de proceso', tipo: 'obligatorio', nivel: 'parcial', evidencia: 'Tiene 1 de los 2 años pedidos' },
      { requisito: 'Disponibilidad para turnos', tipo: 'obligatorio', nivel: 'no-evaluable', evidencia: '' },
    ],
    cumplimiento: { porcentaje: 75 },
    preguntasSugeridas: ['¿Ha trabajado en turnos rotativos?'],
    alertas: ['Hay un período de 2024 sin información.'],
  },
};

const crearApi = (cambios = {}) => ({
  conectado: () => true,
  estado: vi.fn().mockResolvedValue({ disponible: true }),
  obtenerAnalisisSolicitud: vi.fn().mockResolvedValue(analisis),
  ...cambios,
});

describe('GuiaEntrevista', () => {
  it('reúne brechas, lo que hay que confirmar, preguntas y datos del CV para la entrevista', async () => {
    const api = crearApi();
    render(<GuiaEntrevista solicitudId={2} api={api} />);

    expect(await screen.findByText(/Guía para la entrevista/)).toBeInTheDocument();
    expect(api.obtenerAnalisisSolicitud).toHaveBeenCalledWith(2);
    expect(screen.getByText(/75 % de cumplimiento/)).toBeInTheDocument();
    expect(screen.getByText(/Tiene 1 de los 2 años pedidos/)).toBeInTheDocument();
    expect(screen.getByText('Disponibilidad para turnos')).toBeInTheDocument();
    expect(screen.getByText('¿Ha trabajado en turnos rotativos?')).toBeInTheDocument();
    expect(screen.getByText('Hay un período de 2024 sin información.')).toBeInTheDocument();
    // Lo que el CV ya respalda no se repite en la guía.
    expect(screen.queryByText(/Técnico de nivel medio/)).toBeNull();
    expect(screen.queryByRole('button', { name: /analizar/i })).toBeNull();
  });

  it('sin análisis de CV no ocupa espacio', async () => {
    const api = crearApi({ obtenerAnalisisSolicitud: vi.fn().mockResolvedValue(null) });
    const { container } = render(<GuiaEntrevista solicitudId={2} api={api} />);
    await vi.waitFor(() => expect(api.obtenerAnalisisSolicitud).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('si falla la consulta tampoco se muestra (no interrumpe la entrevista)', async () => {
    const api = crearApi({ obtenerAnalisisSolicitud: vi.fn().mockRejectedValue(new Error('caído')) });
    const { container } = render(<GuiaEntrevista solicitudId={2} api={api} />);
    await vi.waitFor(() => expect(api.obtenerAnalisisSolicitud).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('sin IA en el servidor no consulta nada', async () => {
    const api = crearApi({ estado: vi.fn().mockResolvedValue({ disponible: false }) });
    const { container } = render(<GuiaEntrevista solicitudId={2} api={api} />);
    await vi.waitFor(() => expect(api.estado).toHaveBeenCalled());
    expect(api.obtenerAnalisisSolicitud).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
