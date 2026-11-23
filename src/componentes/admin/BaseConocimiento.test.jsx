import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import BaseConocimiento from './BaseConocimiento';

const datos = (extra = {}) => ({
  perfiles: 8, sinPerfil: 2, habilidades: 21, eventos: 40, cola: { pendientes: 1, errores: 0, omitidos: 0 }, errores: [],
  fueraDeCatalogo: [{ habilidad: 'Filmación con dron', categoria: 'tecnica', total: 3 }],
  gemini: { configurado: true, disponible: true, gastoUsd: 0.2, topeUsd: 60 }, ...extra,
});

describe('BaseConocimiento', () => {
  it('resume los perfiles y las habilidades por sumar al catálogo', async () => {
    render(<BaseConocimiento api={{ conocimiento: vi.fn().mockResolvedValue(datos()) }} />);
    expect(await screen.findByText('21 habilidades distintas')).toBeInTheDocument();
    expect(screen.getByText('Filmación con dron (3)')).toBeInTheDocument();
    expect(screen.getByText(/Gemini está activo/)).toBeInTheDocument();
  });

  it('explica por qué Gemini no está disponible', async () => {
    const { unmount } = render(<BaseConocimiento api={{ conocimiento: vi.fn().mockResolvedValue(datos({ gemini: { configurado: false, disponible: false } })) }} />);
    expect(await screen.findByText(/no está configurado/)).toBeInTheDocument();
    unmount();
    render(<BaseConocimiento api={{ conocimiento: vi.fn().mockResolvedValue(datos({ gemini: { configurado: true, disponible: false } })) }} />);
    expect(await screen.findByText(/tope de gasto/)).toBeInTheDocument();
  });

  it('encola los CV pendientes', async () => {
    const api = {
      conocimiento: vi.fn().mockResolvedValue(datos()),
      procesarConocimiento: vi.fn().mockResolvedValue({ encolados: 2, conocimiento: datos({ sinPerfil: 0 }) }),
    };
    render(<BaseConocimiento api={api} />);
    const boton = await screen.findByRole('button', { name: 'Leer CV pendientes' });
    await userEvent.click(boton);
    expect(await screen.findByText(/2 CV quedaron en la cola/)).toBeInTheDocument();
    expect(boton).toBeDisabled();
  });

  it('muestra los CV que no se pudieron leer y los errores de carga', async () => {
    const { unmount } = render(<BaseConocimiento api={{ conocimiento: vi.fn().mockResolvedValue(datos({ errores: [{ motivo: 'Archivo vacío', total: 1 }] })) }} />);
    expect(await screen.findByText('Archivo vacío (1)')).toBeInTheDocument();
    unmount();
    render(<BaseConocimiento api={{ conocimiento: vi.fn().mockRejectedValue(new Error('Sin permiso')) }} />);
    expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
  });
});
