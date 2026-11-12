/**
 * Autoriza una vez la cuenta de Google de la app (modo "oauth"): Google Drive para las
 * carpetas de documentos y Google Calendar para crear las entrevistas con enlace de Meet.
 * Ejecutar con: npm run drive:autorizar   (requiere GDRIVE_CLIENT_ID y GDRIVE_CLIENT_SECRET en .env)
 *
 * Abre un servidor local temporal, muestra el enlace de consentimiento de Google y guarda
 * el refresh token en backend/.gdrive-token.json (o en GDRIVE_TOKEN_ARCHIVO). Ese archivo es
 * una credencial: no se versiona y no se comparte.
 *
 * Alcances pedidos (los dos limitados a lo que crea la app):
 *   - drive.file       → solo las carpetas y archivos que crea la app.
 *   - calendar.events  → crear, cambiar y cancelar los eventos de las entrevistas.
 * Si la cuenta se autorizó antes solo con Drive, vuelva a ejecutar este comando y, en el
 * servidor, reemplace GDRIVE_REFRESH_TOKEN por el nuevo refresh token.
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ALCANCE_OAUTH, URL_TOKEN } = require('./drive');
const { ALCANCE_CALENDAR } = require('../reuniones/google');

const ALCANCES = [ALCANCE_OAUTH, ALCANCE_CALENDAR].join(' ');

const clientId = process.env.GDRIVE_CLIENT_ID;
const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
const archivoToken = process.env.GDRIVE_TOKEN_ARCHIVO || path.join(__dirname, '..', '..', '.gdrive-token.json');
const PUERTO = Number(process.env.GDRIVE_PUERTO_AUTORIZACION || 53682);
const redireccion = `http://127.0.0.1:${PUERTO}/oauth2callback`;

if (!clientId || !clientSecret) {
  console.error('❌ Defina GDRIVE_CLIENT_ID y GDRIVE_CLIENT_SECRET en backend/.env (cliente OAuth de tipo "Aplicación de escritorio").');
  process.exit(1);
}

// PKCE y estado: el código solo sirve para esta ejecución.
const verificador = crypto.randomBytes(32).toString('base64url');
const desafio = crypto.createHash('sha256').update(verificador).digest('base64url');
const estado = crypto.randomBytes(16).toString('hex');

const enlace = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: clientId,
  redirect_uri: redireccion,
  response_type: 'code',
  scope: ALCANCES,
  access_type: 'offline',
  prompt: 'consent',
  code_challenge: desafio,
  code_challenge_method: 'S256',
  state: estado,
})}`;

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, redireccion);
  if (url.pathname !== '/oauth2callback') {
    res.writeHead(404).end();
    return;
  }
  const responder = (mensaje) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<p style="font-family:sans-serif">${mensaje}</p>`);
  };

  if (url.searchParams.get('state') !== estado || !url.searchParams.get('code')) {
    responder('La autorización no se completó. Vuelve a la terminal.');
    console.error('❌ Autorización cancelada o inválida:', url.searchParams.get('error') ?? 'estado no coincide');
    servidor.close();
    process.exitCode = 1;
    return;
  }

  try {
    const respuesta = await fetch(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: url.searchParams.get('code'),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redireccion,
        grant_type: 'authorization_code',
        code_verifier: verificador,
      }).toString(),
    });
    const datos = await respuesta.json();
    if (!respuesta.ok || !datos.refresh_token) {
      throw new Error(datos.error_description || datos.error || 'Google no entregó un refresh token');
    }
    fs.writeFileSync(archivoToken, JSON.stringify({ refresh_token: datos.refresh_token, scope: datos.scope }, null, 2), {
      mode: 0o600,
    });
    const concedidos = (datos.scope || '').split(' ');
    const conCalendar = concedidos.includes(ALCANCE_CALENDAR);
    responder(
      conCalendar
        ? 'Listo: Google Drive y Google Calendar quedaron autorizados. Ya puedes cerrar esta pestaña.'
        : 'Google Drive quedó autorizado, pero no Google Calendar. Vuelve a la terminal.',
    );
    console.log(`✅ Google Drive autorizado. Token guardado en ${archivoToken}`);
    if (conCalendar) {
      console.log('✅ Google Calendar autorizado: las entrevistas con Google Meet crearán su evento y enlace.');
    } else {
      console.log('⚠️  No se concedió Google Calendar (casilla sin marcar): vuelva a ejecutar el comando si quiere Meet.');
    }
    console.log('   Configure ALMACENAMIENTO=drive en backend/.env y reinicie el backend.');
    console.log('   En Azure, reemplace la variable GDRIVE_REFRESH_TOKEN por el refresh_token de ese archivo.');
  } catch (error) {
    responder('No se pudo completar la autorización. Revisa la terminal.');
    console.error('❌', error.message);
    process.exitCode = 1;
  } finally {
    servidor.close();
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log('Abra este enlace con la cuenta de Google de la app (carpetas de Drive y calendario de entrevistas):\n');
  console.log(enlace);
  console.log('\nEsperando la autorización…');
});
