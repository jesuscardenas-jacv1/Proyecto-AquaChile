import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FormularioEvaluacion from './FormularioEvaluacion';

const borrador = {
  competencias: [
    {
      competencia: 'Trabajo en equipo',
      nivel: 'Esperado',
      fortalezas: 'Coordina tareas con su turno.',
      oportunidades: 'Delegar más.',
      evidencia: 'Relata que organiza el turno con su equipo.',
    },
  ],
  observaciones: 'Persona colaborativa, ordenada y con buen manejo de la presión.',
  resultadoSugerido: 'Recomendado',
  fundamento: 'La evidencia es consistente con lo que pide el cargo.',
  faltantes: ['Liderazgo: no hay ejemplos.'],
};
const notas = 'Relata que organiza el turno con su equipo y mantiene la calma ante fallas de equipos.';

const renderFormulario = (props = {}) =>
  render(<FormularioEvaluacion alGuardar={vi.fn()} {...props} />);

describe('FormularioEvaluacion: borrador con IA', () => {
  afterEach(() => vi.restoreAllMocks());

  it('no aparece si la IA no está disponible', () => {
    renderFormulario();
    expect(screen.queryByLabelText(/notas de la entrevista/i)).toBeNull();
  });

  it('pide notas suficientes antes de llamar a la IA', async () => {
    const usuario = userEvent.setup();
    const alGenerarBorrador = vi.fn();
    renderFormulario({ alGenerarBorrador });

    await usuario.type(screen.getByLabelText(/notas de la entrevista/i), 'corto');
    await usuario.click(screen.getByRole('button', { name: /generar borrador/i }));
    expect(alGenerarBorrador).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/al menos unas líneas/i);
  });

  it('carga competencias y observaciones, sugiere el resultado sin marcarlo y muestra la evidencia', async () => {
    const usuario = userEvent.setup();
    const alGenerarBorrador = vi.fn().mockResolvedValue(borrador);
    const alGuardar = vi.fn();
    renderFormulario({ alGenerarBorrador, alGuardar });

    await usuario.type(screen.getByLabelText(/notas de la entrevista/i), notas);
    await usuario.click(screen.getByRole('button', { name: /generar borrador/i }));

    expect(alGenerarBorrador).toHaveBeenCalledWith(notas);
    expect(await screen.findByText(/se cargaron 1 competencias/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^observaciones/i)).toHaveValue(borrador.observaciones);
    expect(screen.getByRole('checkbox', { name: 'Trabajo en equipo' })).toBeChecked();
    expect(screen.getByText(/relata que organiza el turno con su equipo\./i)).toBeInTheDocument();
    expect(screen.getByText(/liderazgo: no hay ejemplos/i)).toBeInTheDocument();
    expect(screen.getByText(/el resultado lo eliges tú/i)).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();

    // Sin elegir resultado no se puede guardar: la decisión es de la psicóloga.
    await usuario.click(screen.getByRole('button', { name: /registrar evaluación/i }));
    expect(alGuardar).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole('radio', { name: 'Recomendado' }));
    await usuario.click(screen.getByRole('button', { name: /registrar evaluación/i }));
    expect(alGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        resultado: 'Recomendado',
        observaciones: borrador.observaciones,
        competencias: [{ competencia: 'Trabajo en equipo', nivel: 'Esperado', fortalezas: 'Coordina tareas con su turno.', oportunidades: 'Delegar más.' }],
      }),
    );
    expect(alGuardar.mock.calls[0][0]).not.toHaveProperty('notas');
  });

  it('pregunta antes de reemplazar lo ya escrito', async () => {
    const usuario = userEvent.setup();
    const alGenerarBorrador = vi.fn().mockResolvedValue(borrador);
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderFormulario({ alGenerarBorrador, evaluacion: { observaciones: 'Ya escribí algo propio.', competencias: [] } });

    await usuario.type(screen.getByLabelText(/notas de la entrevista/i), notas);
    await usuario.click(screen.getByRole('button', { name: /generar borrador/i }));
    expect(confirmar).toHaveBeenCalled();
    expect(alGenerarBorrador).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^observaciones/i)).toHaveValue('Ya escribí algo propio.');
  });

  it('muestra el error si la IA falla', async () => {
    const usuario = userEvent.setup();
    const alGenerarBorrador = vi.fn().mockRejectedValue(new Error('El servicio de IA no respondió. Intenta de nuevo.'));
    renderFormulario({ alGenerarBorrador });

    await usuario.type(screen.getByLabelText(/notas de la entrevista/i), notas);
    await usuario.click(screen.getByRole('button', { name: /generar borrador/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio de IA no respondió.');
  });

  it('recibe las notas de la entrevista con IA y las deja listas para generar', async () => {
    const usuario = userEvent.setup();
    const alGenerarBorrador = vi.fn().mockResolvedValue(borrador);
    const { rerender } = render(<FormularioEvaluacion alGuardar={vi.fn()} alGenerarBorrador={alGenerarBorrador} />);
    expect(screen.getByLabelText(/notas de la entrevista/i)).toHaveValue('');

    rerender(<FormularioEvaluacion alGuardar={vi.fn()} alGenerarBorrador={alGenerarBorrador} notasEntrevista={notas} />);
    expect(screen.getByLabelText(/notas de la entrevista/i)).toHaveValue(notas);
    expect(screen.getByLabelText(/notas de la entrevista/i)).toHaveFocus();
    await usuario.click(screen.getByRole('button', { name: /generar borrador/i }));
    expect(alGenerarBorrador).toHaveBeenCalledWith(notas);
  });
});
