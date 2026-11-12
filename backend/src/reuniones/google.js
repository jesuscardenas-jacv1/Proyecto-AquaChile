/**
 * Proveedor Google Calendar: crea el evento de la entrevista con un enlace de Google Meet,
 * con la API REST v3 de Calendar (sin SDK).
 *
 * Usa el mismo cliente OAuth y la misma cuenta de Google que Google Drive
 * (GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET y el refresh token de `npm run drive:autorizar`),
 * con el alcance `calendar.events`: la app solo crea, cambia y cancela eventos; no lee el
 * resto del calendario. El evento no lleva invitados: la psicóloga comparte el enlace.
 *
 * Documentación: https://developers.google.com/calendar/api/v3/reference/events
 */
const crypto = require('crypto');
const { ErrorReunion, ZONA_HORARIA, horario } = require('./comun');

const URL_CALENDAR = 'https://www.googleapis.com/calendar/v3';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const ALCANCE_CALENDAR = 'https://www.googleapis.com/auth/calendar.events';
const SIN_PERMISO =
  'La cuenta de Google no autorizó Google Calendar: ejecute `npm --prefix backend run drive:autorizar` de nuevo.';

class ReunionesGoogle {
  constructor({ clientId, clientSecret, refreshToken, calendarioId = 'primary', fetch = globalThis.fetch, ahora = () => Date.now() }) {
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Google Calendar requiere GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET y la autorización de la cuenta.');
    }
    this.proveedor = 'google';
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.calendario = encodeURIComponent(calendarioId);
    this.fetch = fetch;
    this.ahora = ahora;
    this.token = null;
  }

  /**
   * Crea el evento (o lo actualiza si se entrega `eventoId`) y devuelve { eventoId, enlace }.
   * Si el evento ya no existe (se borró a mano en Calendar) se crea uno nuevo.
   */
  async guardarEvento({ eventoId, titulo, descripcion = '', fecha, hora }) {
    const { inicio, termino } = horario(fecha, hora);
    const datos = {
      summary: titulo,
      description: descripcion,
      start: { dateTime: inicio, timeZone: ZONA_HORARIA },
      end: { dateTime: termino, timeZone: ZONA_HORARIA },
    };
    const conMeet = {
      conferenceData: {
        createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
      },
    };
    const eventos = `${URL_CALENDAR}/calendars/${this.calendario}/events`;

    let evento = null;
    if (eventoId) {
      evento = await this.#llamar('PATCH', `${eventos}/${encodeURIComponent(eventoId)}?conferenceDataVersion=1`, {
        json: { ...datos, status: 'confirmed' },
        noEncontradoEsNulo: true,
      });
      // Un evento sin Meet (creado a mano o con la reunión quitada) recibe un enlace nuevo.
      if (evento && !evento.hangoutLink) {
        evento = await this.#llamar('PATCH', `${eventos}/${encodeURIComponent(evento.id)}?conferenceDataVersion=1`, {
          json: conMeet,
        });
      }
    }
    evento ??= await this.#llamar('POST', `${eventos}?conferenceDataVersion=1`, { json: { ...datos, ...conMeet } });

    const enlace =
      evento.hangoutLink ??
      evento.conferenceData?.entryPoints?.find((punto) => punto.entryPointType === 'video')?.uri ??
      null;
    if (!enlace) throw new ErrorReunion('Google Calendar creó el evento, pero sin enlace de Meet.');
    return { eventoId: evento.id, enlace };
  }

  /** Cancela (borra) el evento. Si ya no existía no es un error. */
  async cancelarEvento(eventoId) {
    if (!eventoId) return;
    await this.#llamar('DELETE', `${URL_CALENDAR}/calendars/${this.calendario}/events/${encodeURIComponent(eventoId)}`, {
      noEncontradoEsNulo: true,
    });
  }

  /* ------------------------------- Internos -------------------------------- */

  async #obtenerToken() {
    if (this.token && this.token.expira > this.ahora() + 60_000) return this.token.valor;
    const respuesta = await this.fetch(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !datos.access_token) {
      if (datos.error === 'invalid_grant') throw new ErrorReunion(SIN_PERMISO, { sinPermiso: true });
      throw new ErrorReunion(`No se pudo autenticar con Google: ${datos.error_description || datos.error || respuesta.status}.`);
    }
    // El token dice qué alcances tiene: sin Calendar se avisa sin llamar a la API.
    if (datos.scope && !datos.scope.split(' ').includes(ALCANCE_CALENDAR)) {
      throw new ErrorReunion(SIN_PERMISO, { sinPermiso: true });
    }
    this.token = { valor: datos.access_token, expira: this.ahora() + (datos.expires_in ?? 3600) * 1000 };
    return this.token.valor;
  }

  async #llamar(metodo, url, { json, noEncontradoEsNulo = false } = {}) {
    const respuesta = await this.fetch(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${await this.#obtenerToken()}`,
        ...(json ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
      },
      body: json ? JSON.stringify(json) : undefined,
    });

    if (!respuesta.ok) {
      if (noEncontradoEsNulo && (respuesta.status === 404 || respuesta.status === 410)) return null;
      const detalle = await respuesta.json().catch(() => ({}));
      const motivo = detalle.error?.errors?.[0]?.reason ?? '';
      if (motivo === 'accessNotConfigured' || /has not been used|is disabled/i.test(detalle.error?.message ?? '')) {
        throw new ErrorReunion(
          'La Google Calendar API no está habilitada en el proyecto de Google Cloud: actívela en la consola (APIs y servicios).',
          { status: respuesta.status },
        );
      }
      if (respuesta.status === 401 || (respuesta.status === 403 && !/rateLimit/i.test(motivo))) {
        throw new ErrorReunion(SIN_PERMISO, { status: respuesta.status, sinPermiso: true });
      }
      throw new ErrorReunion(`Error de Google Calendar (${respuesta.status}): ${detalle.error?.message ?? 'sin detalle'}`);
    }
    return respuesta.status === 204 ? null : respuesta.json().catch(() => null);
  }
}

module.exports = { ReunionesGoogle, ALCANCE_CALENDAR };
