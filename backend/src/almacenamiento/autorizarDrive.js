/**
 * Autoriza una vez la cuenta de Google donde se guardarán las carpetas (modo "oauth").
 * Ejecutar con: npm run drive:autorizar   (requiere GDRIVE_CLIENT_ID y GDRIVE_CLIENT_SECRET en .env)
 *
 * Abre un servidor local temporal, muestra el enlace de consentimiento de Google y guarda
 * el refresh token en backend/.gdrive-token.json (o en GDRIVE_TOKEN_ARCHIVO). Ese archivo es
 * una credencial: no se versiona y no se comparte.
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ALCANCE_OAUTH, URL_TOKEN } = require('./drive');

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
  scope: ALCANCE_OAUTH,
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
    responder('Listo: Google Drive quedó autorizado. Ya puedes cerrar esta pestaña.');
    console.log(`✅ Google Drive autorizado. Token guardado en ${archivoToken}`);
    console.log('   Configure ALMACENAMIENTO=drive en backend/.env y reinicie el backend.');
  } catch (error) {
    responder('No se pudo completar la autorización. Revisa la terminal.');
    console.error('❌', error.message);
    process.exitCode = 1;
  } finally {
    servidor.close();
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log('Abra este enlace con la cuenta de Google donde se guardarán las carpetas:\n');
  console.log(enlace);
  console.log('\nEsperando la autorización…');
});
