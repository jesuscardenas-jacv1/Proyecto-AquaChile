import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ResumenCvLateral from './ResumenCvLateral';

const analisis = {
  oferta: 'Prevencionista de Riesgos - Chiloé',
  resultado: {
    resumen: 'Técnica en prevención con cuatro años en centros de cultivo.',
    criterios: [
      { requisito: 'Título de prevencionista', tipo: 'obligatorio', nivel: 'cumple', evidencia: 'Técnico en Prevención de Riesgos' },
      { requisito: 'Liderazgo de equipos', tipo: 'obligatorio', nivel: 'parcial', evidencia: 'Sin personas a cargo' },
      { requisito: 'Turnos rotativos', tipo: 'obligatorio', nivel: 'no-evaluable', evidencia: '' },
    ],
    cumplimiento: { porcentaje: 72, obligatoriosCumplidos: 1, obligatoriosTotal: 3 },
    preguntasSugeridas: ['¿Ha liderado equipos?', '¿Cómo vivió el cambio a reportes digitales?'],
    alertas: ['Período 2022 sin información.'],
  },
};

describe('ResumenCvLateral', () => {
  it('muestra el cumplimiento, fortalezas, brechas y el pedido del reclutador', () => {
    render(<ResumenCvLateral analisis={analisis} observaciones="Indagar manejo de conflictos" />);
    expect(screen.getByText('72 % de cumplimiento')).toBeInTheDocument();
    expect(screen.getByText('1 de 3 obligatorios')).toBeInTheDocument();
    expect(screen.getByText('Sugerencia de IA – revisar')).toBeInTheDocument();
    expect(screen.getByText('Título de prevencionista')).toBeInTheDocument();
    expect(screen.getByText('Liderazgo de equipos')).toBeInTheDocument();
    expect(screen.getByText('Turnos rotativos')).toBeInTheDocument();
    expect(screen.getByText('Período 2022 sin información.')).toBeInTheDocument();
    expect(screen.getByText(/Indagar manejo de conflictos/)).toBeInTheDocument();
    expect(screen.getByText('Oferta: Prevencionista de Riesgos - Chiloé')).toBeInTheDocument();
  });

  it('marca las preguntas hechas y permite plegar el panel', async () => {
    const usuario = userEvent.setup();
    const alMarcarPregunta = vi.fn();
    const alPlegar = vi.fn();
    render(
      <ResumenCvLateral
        analisis={analisis}
        preguntasHechas={['¿Ha liderado equipos?']}
        alMarcarPregunta={alMarcarPregunta}
        alPlegar={alPlegar}
      />,
    );
    expect(screen.getByRole('checkbox', { name: '¿Ha liderado equipos?' })).toBeChecked();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    await usuario.click(screen.getByRole('checkbox', { name: /reportes digitales/ }));
    expect(alMarcarPregunta).toHaveBeenCalledWith('¿Cómo vivió el cambio a reportes digitales?');
    await usuario.click(screen.getByRole('button', { name: /plegar el resumen/i }));
    expect(alPlegar).toHaveBeenCalled();
  });

  it('explica cuando no hay análisis', () => {
    const { rerender } = render(<ResumenCvLateral analisis={null} tienePostulacion />);
    expect(screen.getByText(/aún no analizó el CV/)).toBeInTheDocument();
    rerender(<ResumenCvLateral analisis={null} />);
    expect(screen.getByText(/no viene del portal/)).toBeInTheDocument();
  });

  it('sin requisitos comprobables no inventa un porcentaje', () => {
    render(
      <ResumenCvLateral
        analisis={{ resultado: { ...analisis.resultado, criterios: [], cumplimiento: { porcentaje: null }, preguntasSugeridas: [] } }}
      />,
    );
    expect(screen.getByText(/Sin porcentaje/)).toBeInTheDocument();
    expect(screen.getByText(/no trae preguntas sugeridas/)).toBeInTheDocument();
  });
});
