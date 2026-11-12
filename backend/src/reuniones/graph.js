/**
 * Proveedor Microsoft Graph (opcional, para la TI de AquaChile): crea la reunión de Teams
 * como un evento en el calendario de un buzón de Microsoft 365, con `isOnlineMeeting`.
 *
 * Se activa con REUNIONES_TEAMS=graph. Requiere un registro de aplicación en Microsoft
 * Entra ID con el permiso de aplicación `Calendars.ReadWrite` y el consentimiento de un
 * administrador del tenant; se recomienda limitarlo al buzón de Reclutamiento con una
 * directiva de acceso de aplicación de Exchange (ver backend/README.md).
 * Sin esto, la psicóloga pega a mano el enlace de Teams en la ventana de agenda.
 *
 * Documentación: https://learn.microsoft.com/graph/api/user-post-events
 */
const { ErrorReunion, ZONA_HORARIA, horario } = require('./comun');

const URL_GRAPH = 'https://graph.microsoft.com/v1.0';
const SIN_PERMISO =
  'Microsoft Graph rechazó la reunión: falta el permiso Calendars.ReadWrite aprobado por un administrador.';

class ReunionesGraph {
  constructor({ tenantId, clientId, clientSecret, usuario, fetch = globalThis.fetch, ahora = () => Date.now() }) {
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error('REUNIONES_TEAMS=graph requiere GRAPH_TENANT_ID, GRAPH_CLIENT_ID y GRAPH_CLIENT_SECRET.');
    }
    if (!usuario) {
      throw new Error('Defina GRAPH_REUNIONES_USUARIO: el buzón que organiza las reuniones de Teams.');
    }
    this.proveedor = 'graph';
    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.eventos = `${URL_GRAPH}/users/${encodeURIComponent(usuario)}/events`;
    this.fetch = fetch;
    this.ahora = ahora;
    this.token = null;
  }

  /** Crea o actualiza la reunión de Teams y devuelve { eventoId, enlace }. */
  async guardarEvento({ eventoId, titulo, descripcion = '', fecha, hora }) {
    const { inicio, termino } = horario(fecha, hora);
    const datos = {
      subject: titulo,
      body: { contentType: 'text', content: descripcion },
      start: { dateTime: inicio, timeZone: ZONA_HORARIA },
      end: { dateTime: termino, timeZone: ZONA_HORARIA },
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
    };

    let evento = null;
    if (eventoId) {
      evento = await this.#llamar('PATCH', `${this.eventos}/${encodeURIComponent(eventoId)}`, {
        json: datos,
        noEncontradoEsNulo: true,
      });
    }
    evento ??= await this.#llamar('POST', this.eventos, { json: datos });

    const enlace = evento.onlineMeeting?.joinUrl ?? null;
    if (!enlace) throw new ErrorReunion('Microsoft Graph creó el evento, pero sin enlace de Teams.');
    return { eventoId: evento.id, enlace };
  }

  /** Cancela la reunión (los invitados, si los hubiera, reciben la cancelación). */
  async cancelarEvento(eventoId) {
    if (!eventoId) return;
    await this.#llamar('POST', `${this.eventos}/${encodeURIComponent(eventoId)}/cancel`, {
      json: { comment: 'Entrevista cancelada.' },
      noEncontradoEsNulo: true,
    });
  }

  /* ------------------------------- Internos -------------------------------- */

  async #obtenerToken() {
    if (this.token && this.token.expira > this.ahora() + 60_000) return this.token.valor;
    const respuesta = await this.fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }).toString(),
      },
    );
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !datos.access_token) {
      throw new ErrorReunion(`No se pudo autenticar con Microsoft Graph: ${datos.error_description || datos.error || respuesta.status}.`);
    }
    this.token = { valor: datos.access_token, expira: this.ahora() + (datos.expires_in ?? 3600) * 1000 };
    return this.token.valor;
  }

  async #llamar(metodo, url, { json, noEncontradoEsNulo = false } = {}) {
    const respuesta = await this.fetch(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${await this.#obtenerToken()}`,
        ...(json ? { 'Content-Type': 'application/json' } : {}),
      },
      body: json ? JSON.stringify(json) : undefined,
    });
    if (!respuesta.ok) {
      if (noEncontradoEsNulo && respuesta.status === 404) return null;
      const detalle = await respuesta.json().catch(() => ({}));
      if (respuesta.status === 401 || respuesta.status === 403) {
        throw new ErrorReunion(SIN_PERMISO, { status: respuesta.status, sinPermiso: true });
      }
      throw new ErrorReunion(`Error de Microsoft Graph (${respuesta.status}): ${detalle.error?.message ?? 'sin detalle'}`);
    }
    return respuesta.status === 202 || respuesta.status === 204 ? null : respuesta.json().catch(() => null);
  }
}

module.exports = { ReunionesGraph };
