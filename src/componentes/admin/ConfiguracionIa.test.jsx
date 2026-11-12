import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConfiguracionIa from './ConfiguracionIa';

const tarea = (id, nombre, vigente = {}) => ({
  id,
  nombre,
  usadoPor: 'Analista',
  entrada: 'El CV del postulante.',
  sistema: `Rol de ${nombre}.`,
  limites: 'No recomiendes contratar ni descartar.',
  campos: ['resumen: texto', 'brechas: lista de { requisito, detalle }'],
  original: { indicaciones: 'Indicaciones originales del análisis.', esfuerzo: 'medium' },
  vigente: { indicaciones: 'Indicaciones originales del análisis.', modelo: '', esfuerzo: 'medium', personalizada: false, ...vigente },
  historial: [],
});

const configuracion = (vigente) => ({
  reglasComunes: 'Nunca consideres datos personales sensibles.',
  modeloServidor: 'claude-opus-5-5',
  largoMaximo: 4000,
  modelos: [
    { id: 'claude-opus-5-5', nombre: 'Claude Opus 5.5', detalle: 'Mejor calidad.' },
    { id: 'claude-haiku-5-5', nombre: 'Claude Haiku 5.5', detalle: 'Barato.' },
  ],
  esfuerzos: [
    { id: 'low', nombre: 'Bajo', detalle: 'Rápido.' },
    { id: 'medium', nombre: 'Medio', detalle: 'Equilibrio.' },
    { id: 'high', nombre: 'Alto', detalle: 'Razona más.' },
  ],
  tareas: [tarea('analizarCv', 'Análisis de CV', vigente), tarea('redactarOferta', 'Redactar oferta')],
});

const crearApi = (vigente) => ({
  configIa: vi.fn().mockResolvedValue(configuracion(vigente)),
  guardarConfigIa: vi.fn().mockResolvedValue({}),
  restablecerConfigIa: vi.fn().mockResolvedValue({}),
});

describe('ConfiguracionIa', () => {
  it('muestra las partes fijas en solo lectura y las editables en el formulario', async () => {
    render(<ConfiguracionIa api={crearApi()} />);

    expect(await screen.findByText('Rol de Análisis de CV.')).toBeInTheDocument();
    expect(screen.getByText('Nunca consideres datos personales sensibles.')).toBeInTheDocument();
    expect(screen.getByText('No recomiendes contratar ni descartar.')).toBeInTheDocument();
    expect(screen.getByText('brechas: lista de { requisito, detalle }')).toBeInTheDocument();
    expect(screen.getByLabelText('Indicaciones')).toHaveValue('Indicaciones originales del análisis.');
    expect(screen.getByLabelText('Modelo')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Del servidor (claude-opus-5-5)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /restablecer original/i })).toBeNull();
  });

  it('guarda las indicaciones, el modelo y el esfuerzo editados', async () => {
    const usuario = userEvent.setup();
    const api = crearApi();
    render(<ConfiguracionIa api={api} />);
    const indicaciones = await screen.findByLabelText('Indicaciones');

    await usuario.clear(indicaciones);
    await usuario.type(indicaciones, 'corto');
    expect(screen.getByText(/al menos 20 caracteres/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();

    await usuario.type(indicaciones, ' y con foco en seguridad laboral');
    await usuario.selectOptions(screen.getByLabelText('Modelo'), 'claude-haiku-5-5');
    await usuario.selectOptions(screen.getByLabelText('Esfuerzo'), 'low');
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(api.guardarConfigIa).toHaveBeenCalledWith('analizarCv', {
      indicaciones: 'corto y con foco en seguridad laboral',
      modelo: 'claude-haiku-5-5',
      esfuerzo: 'low',
    });
    expect(await screen.findByText(/configuración guardada/i)).toBeInTheDocument();
    expect(api.configIa).toHaveBeenCalledTimes(2);
  });

  it('restablece los valores originales solo tras confirmar', async () => {
    const usuario = userEvent.setup();
    const api = crearApi({ personalizada: true, actualizadoPor: 'Admin Demo', modelo: 'claude-haiku-5-5' });
    render(<ConfiguracionIa api={api} />);

    expect(await screen.findByText('Personalizada por Admin Demo')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: /restablecer original/i }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.restablecerConfigIa).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole('button', { name: /restablecer original/i }));
    await usuario.click(screen.getByRole('button', { name: 'Sí, restablecer' }));
    await waitFor(() => expect(api.restablecerConfigIa).toHaveBeenCalledWith('analizarCv'));
  });

  it('cambia de ayuda y muestra el error de carga', async () => {
    const usuario = userEvent.setup();
    render(<ConfiguracionIa api={crearApi()} />);
    await usuario.click(await screen.findByRole('tab', { name: 'Redactar oferta' }));
    expect(screen.getByText('Rol de Redactar oferta.')).toBeInTheDocument();

    render(<ConfiguracionIa api={{ configIa: vi.fn().mockRejectedValue(new Error('Acceso denegado.')) }} />);
    expect(await screen.findByText('Acceso denegado.')).toBeInTheDocument();
  });
});
