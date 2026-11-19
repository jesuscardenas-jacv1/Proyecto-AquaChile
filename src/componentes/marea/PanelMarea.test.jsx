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

  it('la campana abre los avisos; usar uno lo marca leído y se lo pide a Marea', async () => {
    const usuario = userEvent.setup();
    const aviso = {
      id: 9,
      mensaje: 'Te asignaron la solicitud #104',
      leida: false,
      acciones: [{ etiqueta: 'Resumen', accion: { tipo: 'resumen_solicitud', solicitudId: 104 } }],
    };
    const api = { ...crearApi(), avisos: vi.fn().mockResolvedValue({ noLeidas: 1, avisos: [aviso] }), marcarLeido: vi.fn().mockResolvedValue({}) };
    const alCambiarAvisos = vi.fn();
    renderPanel({ api, noLeidas: 1, alCambiarAvisos });

    await usuario.click(screen.getByRole('button', { name: 'Avisos, 1 sin revisar' }));
    await usuario.click(await screen.findByRole('button', { name: 'Resumen' }));
    expect(api.marcarLeido).toHaveBeenCalledWith(9);
    expect(alCambiarAvisos).toHaveBeenCalled();
    expect(api.enviar).toHaveBeenCalledWith(expect.objectContaining({ accion: { tipo: 'resumen_solicitud', solicitudId: 104 } }));
    expect(screen.queryByRole('region', { name: 'Avisos recientes' })).toBeNull();
  });

  it('agenda con tarjetas: hora → confirmación → aviso en la esquina; solo la última respuesta queda activa', async () => {
    const usuario = userEvent.setup();
    const horas = {
      texto: 'Te dejo los espacios disponibles para Valentina:\nFuente: Planner',
      tarjetas: [{ tipo: 'horas', solicitudId: 101, nombre: 'Valentina Ríos Ojeda', cargo: 'Monitor', fecha: '2026-11-23', bloques: [{ hora: '11:00', primera: true }], modalidades: ['Google Meet', 'Teams', 'Presencial'], modalidad: 'Google Meet' }],
      opciones: [{ etiqueta: 'Otro día', accion: { tipo: 'agendar', solicitudId: 101, desde: '2026-11-24' } }],
      foco: { candidatoId: 101, solicitudId: 101, nombre: 'Valentina Ríos Ojeda', verificado: true },
    };
    const accionConfirmar = { tipo: 'confirmar_agenda', solicitudId: 101, fecha: '2026-11-23', hora: '11:00', modalidad: 'Google Meet' };
    const propuesta = { texto: 'Revisa los datos y confirma:', tarjetas: [{ tipo: 'confirmacion', titulo: 'Entrevista con Valentina', detalle: ['lunes 23-11 · 11:00'], accion: accionConfirmar }], opciones: [], foco: horas.foco };
    const hecho = { texto: 'Listo, la entrevista de Valentina quedó agendada.', tarjetas: [{ tipo: 'resumen', titulo: 'Entrevista con Valentina', lineas: ['Etapa: Entrevista agendada'] }], opciones: [], foco: horas.foco };
    const api = { enviar: vi.fn().mockResolvedValueOnce(horas).mockResolvedValueOnce(propuesta).mockResolvedValueOnce(hecho) };
    const alAgendar = vi.fn();
    renderPanel({ api, alAgendar });

    await usuario.click(screen.getByRole('button', { name: /Agenda y Google Meet/ }));
    expect(await screen.findByText('Fuente: Planner')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: '11:00, primera libre' }));
    await usuario.click(await screen.findByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(alAgendar).toHaveBeenCalledWith('Listo, la entrevista de Valentina quedó agendada.'));
    expect(api.enviar).toHaveBeenLastCalledWith({ mensaje: '', foco: horas.foco, accion: accionConfirmar });
    expect(screen.getByRole('button', { name: 'Otro día' })).toBeDisabled();
  });

  it('al cambiar de función con alguien en el foco pregunta «¿Seguimos con…?»', async () => {
    const usuario = userEvent.setup();
    const foco = { candidatoId: 104, solicitudId: 104, nombre: 'Ignacio Paredes Soto', verificado: true };
    const api = { enviar: vi.fn().mockResolvedValue({ texto: 'Así va la solicitud de Ignacio:', tarjetas: [], opciones: [], foco }) };
    renderPanel({ api });

    await usuario.type(screen.getByRole('textbox', { name: 'Escribe a Marea' }), 'resumen de Ignacio Paredes{Enter}');
    await screen.findByText('Así va la solicitud de Ignacio:');
    await usuario.click(screen.getByRole('button', { name: /Guía de entrevista/ }));
    expect(screen.getByText('¿Seguimos con Ignacio Paredes Soto?')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Sí, con Ignacio' }));
    expect(api.enviar).toHaveBeenLastCalledWith({ mensaje: '', foco, accion: { tipo: 'guia_entrevista', solicitudId: 104 } });

    await usuario.click(screen.getByRole('button', { name: /Agenda y Google Meet/ }));
    // La pregunta anterior queda en la conversación con sus botones desactivados: se usa la última.
    await usuario.click(screen.getAllByRole('button', { name: 'Otra persona' }).at(-1));
    expect(api.enviar).toHaveBeenLastCalledWith({ mensaje: '', foco: null, accion: { tipo: 'agendar' } });
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
