import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PanelMarea from './PanelMarea';

const evaluadora = { id: 2, nombre: 'Ignacia Valdés Ortiz', rol: 'evaluador' };
const crearApi = (respuesta = { texto: 'Agendemos. ¿A quién entrevistas?', tarjetas: [], opciones: [], foco: null }) => ({
  enviar: vi.fn().mockResolvedValue(respuesta),
});
const renderPanel = (props = {}) => {
  const api = props.api ?? crearApi();
  const alCerrar = vi.fn();
  const alCambiarTema = vi.fn();
  render(
    <PanelMarea usuario={evaluadora} modulo="Planner" tema="claro" api={api} alCerrar={alCerrar} alCambiarTema={alCambiarTema} {...props} />,
  );
  return { api, alCerrar, alCambiarTema };
};

describe('PanelMarea', () => {
  it('da la bienvenida con el nombre, el módulo y las funciones del rol', () => {
    renderPanel();
    expect(screen.getByRole('dialog', { name: 'Marea' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Hola, Ignacia\. Soy Marea/ })).toBeInTheDocument();
    expect(screen.getByText('leyendo: Planner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agenda y Google Meet/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Análisis de CV/ })).toBeNull();
    expect(screen.getByText('Nuevo módulo')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Escribe a Marea' })).toHaveFocus();
  });

  it('Enter envía el mensaje con el foco y muestra la respuesta', async () => {
    const usuario = userEvent.setup();
    const api = crearApi({ texto: 'Encontré a Valentina Ríos Ojeda. Solo me falta su RUT.', tarjetas: [], opciones: [], foco: { candidatoId: 101, pendiente: 'rut' } });
    renderPanel({ api });
    await usuario.type(screen.getByRole('textbox', { name: 'Escribe a Marea' }), 'agenda a Valentina Ríos{Enter}');

    expect(await screen.findByText(/Solo me falta su RUT/)).toBeInTheDocument();
    expect(screen.getByText('agenda a Valentina Ríos')).toBeInTheDocument();
    expect(api.enviar).toHaveBeenCalledWith({ mensaje: 'agenda a Valentina Ríos', foco: null, accion: null });

    await usuario.type(screen.getByRole('textbox', { name: 'Escribe a Marea' }), '11.111.111-1{Enter}');
    await waitFor(() => expect(api.enviar).toHaveBeenLastCalledWith(expect.objectContaining({ foco: { candidatoId: 101, pendiente: 'rut' } })));
  });

  it('una tarjeta de conexión envía su acción sin escribir', async () => {
    const { api } = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Agenda y Google Meet/ }));
    expect(api.enviar).toHaveBeenCalledWith({ mensaje: '', foco: null, accion: { tipo: 'agendar' } });
    expect(screen.getByRole('button', { name: /Agenda y Google Meet/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('Agendemos. ¿A quién entrevistas?')).toBeInTheDocument();
  });

  it('la campana pide los avisos y muestra cuántos hay sin revisar', async () => {
    const { api } = renderPanel({ noLeidas: 2 });
    await userEvent.click(screen.getByRole('button', { name: 'Avisos, 2 sin revisar' }));
    expect(api.enviar).toHaveBeenCalledWith(expect.objectContaining({ accion: { tipo: 'avisos' } }));
  });

  it('cambia el tema, empieza una conversación nueva y se cierra con Esc', async () => {
    const usuario = userEvent.setup();
    const { alCambiarTema, alCerrar } = renderPanel();
    await usuario.click(screen.getByRole('button', { name: /Oscuro/ }));
    expect(alCambiarTema).toHaveBeenCalledWith('oscuro');

    await usuario.type(screen.getByRole('textbox', { name: 'Escribe a Marea' }), 'hola{Enter}');
    await screen.findByText('Agendemos. ¿A quién entrevistas?');
    await usuario.click(screen.getByRole('button', { name: 'Nueva conversación' }));
    expect(screen.getByRole('heading', { name: /Hola, Ignacia/ })).toBeInTheDocument();

    await usuario.keyboard('{Escape}');
    await waitFor(() => expect(alCerrar).toHaveBeenCalled());
  });

  it('mantiene el foco dentro del panel con Tab', async () => {
    const usuario = userEvent.setup();
    renderPanel();
    screen.getByRole('button', { name: 'Avisos' }).focus();
    await usuario.tab({ shift: true });
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('si el servidor falla, lo dice en la conversación', async () => {
    const api = { enviar: vi.fn().mockRejectedValue(new Error('No se pudo conectar con el servidor.')) };
    renderPanel({ api });
    await userEvent.type(screen.getByRole('textbox', { name: 'Escribe a Marea' }), 'hola{Enter}');
    expect(await screen.findByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
  });
});
