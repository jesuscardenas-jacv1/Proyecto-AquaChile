import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Mensaje from '../comunes/Mensaje';
import EstadoVacio from '../comunes/EstadoVacio';
import EtiquetaEstado from '../comunes/EtiquetaEstado';
import TarjetaIndicador from '../comunes/TarjetaIndicador';

describe('EtiquetaEstado', () => {
  it('muestra el estado de la solicitud con el color correspondente', () => {
    render(<EtiquetaEstado valor="Finalizada" />);
    expect(screen.getByText('Finalizada')).toHaveClass('bg-success');
  });

  it('usa otro color para "En proceso"', () => {
    render(<EtiquetaEstado valor="En proceso" />);
    expect(screen.getByText('En proceso')).toHaveClass('bg-warning');
  });

  it('colorea el resultado de la evaluación', () => {
    render(<EtiquetaEstado valor="Reprobado" contexto="resultado" />);
    expect(screen.getByText('Reprobado')).toHaveClass('bg-danger');
  });

  it('usa un color por defecto para estados desconocidos', () => {
    render(<EtiquetaEstado valor="Otro" />);
    expect(screen.getByText('Otro')).toHaveClass('bg-dark');
  });
});

describe('Mensaje', () => {
  it('renderiza el tipo de alerta y el contenido', () => {
    render(<Mensaje tipo="danger" titulo="Error">Revisa los datos</Mensaje>);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveClass('alert-danger');
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Revisa los datos')).toBeInTheDocument();
  });

  it('permite cerrar el mensaje con el botón de cierre', async () => {
    const alCerrar = vi.fn();
    render(<Mensaje alCerrar={alCerrar}>Mensaje</Mensaje>);
    await userEvent.click(screen.getByRole('button', { name: /cerrar mensaje/i }));
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it('no muestra botón de cierre si no se entrega la función', () => {
    render(<Mensaje>Mensaje</Mensaje>);
    expect(screen.queryByRole('button', { name: /cerrar mensaje/i })).toBeNull();
  });
});

describe('EstadoVacio', () => {
  it('muestra el estado vacío con acción opcional', async () => {
    const alAccion = vi.fn();
    render(
      <EstadoVacio titulo="Sin candidatos" descripcion="No hay registros" textoBoton="Crear" alAccion={alAccion} />,
    );
    expect(screen.getByText('Sin candidatos')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(alAccion).toHaveBeenCalled();
  });

  it('oculta el botón cuando no hay texto de acción', () => {
    render(<EstadoVacio />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('TarjetaIndicador', () => {
  it('muestra título, valor y descripción', () => {
    render(
      <TarjetaIndicador
        titulo="Solicitudes totales"
        valor={5}
        descripcion="Histórico completo"
        variante="info"
      />,
    );
    expect(screen.getByText('Solicitudes totales')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Histórico completo')).toBeInTheDocument();
  });

  it('permite navegar cuando la tarjeta tiene enlace', async () => {
    const alNavegar = vi.fn();
    render(<TarjetaIndicador titulo="Candidatos" valor={2} enlace="Ver listado" alNavegar={alNavegar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver listado' }));
    expect(alNavegar).toHaveBeenCalled();
  });
});
