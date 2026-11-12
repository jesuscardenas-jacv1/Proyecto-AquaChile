import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import UsoIa from './UsoIa';

const fila = (clave, extra = {}) => ({ clave, llamadas: 2, tokensEntrada: 20000, tokensSalida: 4000, tokensCache: 0, segundosAudio: 0, costoUsd: 0.16, ...extra });

const uso = {
  total: { llamadas: 3, costoUsd: 0.16 },
  claude: { llamadas: 2, tokensEntrada: 20000, tokensSalida: 4000, costoUsd: 0.16 },
  voz: { llamadas: 1, segundosAudio: 90, minutosMes: 1.5, minutosGratisMes: 300 },
  porDia: [fila('2026-11-12')],
  porTarea: [fila('analizarCv'), fila('transcripcion', { llamadas: 1, tokensEntrada: 0, tokensSalida: 0, segundosAudio: 90, costoUsd: 0 })],
  porModelo: [fila('claude-opus-5-5')],
  porUsuario: [fila('Analista Demo')],
  ultimas: [
    { id: 2, fecha: '2026-11-12 10:00:00', proveedor: 'anthropic', tarea: 'analizarCv', modelo: 'claude-opus-5-5', usuario: 'Analista Demo', tokensEntrada: 10000, tokensSalida: 2000, segundosAudio: 0, costoUsd: 0.08, resultado: 'ok' },
    { id: 1, fecha: '2026-11-12 09:00:00', proveedor: 'azure-speech', tarea: 'transcripcion', modelo: 'fast-transcription es-CL', usuario: '', tokensEntrada: 0, tokensSalida: 0, segundosAudio: 90, costoUsd: 0, resultado: 'refusal' },
  ],
};

describe('UsoIa', () => {
  it('muestra el costo estimado, los tokens y la cuota de voz del mes', async () => {
    const api = { usoIa: vi.fn().mockResolvedValue(uso) };
    render(<UsoIa api={api} />);

    expect(await screen.findByText('USD 0,1600', { selector: '.h5' })).toBeInTheDocument();
    expect(screen.getByText('2 llamadas')).toBeInTheDocument();
    expect(screen.getByText('1,5 de 300 min')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Cuota gratis de voz usada' })).toHaveAttribute('aria-valuenow', '1');

    const porTarea = screen.getByRole('table', { name: 'Por ayuda de IA' });
    expect(within(porTarea).getByText('Análisis de CV')).toBeInTheDocument();
    expect(within(porTarea).getByText('1 min 30 s')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Últimas llamadas' })).getByText('refusal')).toBeInTheDocument();
    expect(api.usoIa).toHaveBeenCalledWith(expect.objectContaining({ desde: expect.stringMatching(/-01$/) }));
  });

  it('vuelve a consultar al cambiar el rango de fechas', async () => {
    const usuario = userEvent.setup();
    const api = { usoIa: vi.fn().mockResolvedValue(uso) };
    render(<UsoIa api={api} />);
    await screen.findByText('2 llamadas');

    const desde = screen.getByLabelText('Desde');
    await usuario.clear(desde);
    await usuario.type(desde, '2026-10-01');
    await waitFor(() => expect(api.usoIa).toHaveBeenLastCalledWith(expect.objectContaining({ desde: '2026-10-01' })));
  });

  it('muestra el error del servidor', async () => {
    const api = { usoIa: vi.fn().mockRejectedValue(new Error('Acceso denegado.')) };
    render(<UsoIa api={api} />);
    expect(await screen.findByText('Acceso denegado.')).toBeInTheDocument();
  });
});
