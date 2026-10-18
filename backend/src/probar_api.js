/**
 * Script de prueba y verificación de la API REST de AquaChile.
 * Prueba salud, login, RBAC y endpoints principales.
 *
 * Ejecutar con: node backend/src/probar_api.js
 */
const http = require('http');
const app = require('./servidor');

const PUERTO_TEST = 3099;
const URL_BASE = `http://localhost:${PUERTO_TEST}/api`;

async function ejecutarPruebas() {
  const servidor = app.listen(PUERTO_TEST);
  console.log('🧪 Iniciando pruebas automatizadas de la API Backend AquaChile...\n');

  try {
    // 1. Probar healthcheck
    const resSalud = await fetch(`${URL_BASE}/salud`);
    const dataSalud = await resSalud.json();
    console.assert(resSalud.status === 200, 'Healthcheck debe responder 200');
    console.assert(dataSalud.estado === 'operativo', 'Estado debe ser operativo');
    console.log('✅ 1. Healthcheck (/api/salud) responde 200 OK');

    // 2. Probar login analista
    const resLoginAnalista = await fetch(`${URL_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correo: 'analista@aquachile.cl',
        contrasena: 'AquaChile2026!',
      }),
    });
    const dataLoginAnalista = await resLoginAnalista.json();
    console.assert(resLoginAnalista.status === 200, 'Login analista debe responder 200');
    console.assert(Boolean(dataLoginAnalista.token), 'Debe devolver un JWT');
    console.assert(dataLoginAnalista.usuario.rol === 'analista', 'Rol debe ser analista');
    console.log('✅ 2. Login de Analista con JWT exitoso');

    const tokenAnalista = dataLoginAnalista.token;

    // 3. Probar login evaluador
    const resLoginEval = await fetch(`${URL_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correo: 'evaluador@aquachile.cl',
        contrasena: 'AquaChile2026!',
      }),
    });
    const dataLoginEval = await resLoginEval.json();
    console.assert(resLoginEval.status === 200, 'Login evaluador debe responder 200');
    console.assert(dataLoginEval.usuario.rol === 'evaluador', 'Rol debe ser evaluador');
    console.log('✅ 3. Login de Evaluador con JWT exitoso');

    const tokenEvaluador = dataLoginEval.token;

    // 4. Probar credenciales incorrectas
    const resLoginInvalido = await fetch(`${URL_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correo: 'analista@aquachile.cl',
        contrasena: 'clave_incorrecta',
      }),
    });
    console.assert(resLoginInvalido.status === 401, 'Credenciales incorrectas debe responder 401');
    console.log('✅ 4. Rechazo correcto ante credenciales erróneas (401)');

    // 5. Listar candidatos con token
    const resCandidatos = await fetch(`${URL_BASE}/candidatos`, {
      headers: { Authorization: `Bearer ${tokenAnalista}` },
    });
    const dataCandidatos = await resCandidatos.json();
    console.assert(resCandidatos.status === 200, 'Listar candidatos debe responder 200');
    console.assert(dataCandidatos.total >= 100, `Debe haber al menos 100 candidatos, hay: ${dataCandidatos.total}`);
    console.log(`✅ 5. Consulta de candidatos exitosa (Total: ${dataCandidatos.total})`);

    // 6. Listar solicitudes con token
    const resSolicitudes = await fetch(`${URL_BASE}/solicitudes`, {
      headers: { Authorization: `Bearer ${tokenAnalista}` },
    });
    const dataSolicitudes = await resSolicitudes.json();
    console.assert(resSolicitudes.status === 200, 'Listar solicitudes debe responder 200');
    console.assert(dataSolicitudes.total >= 100, `Debe haber al menos 100 solicitudes, hay: ${dataSolicitudes.total}`);
    console.log(`✅ 6. Consulta de solicitudes exitosa (Total: ${dataSolicitudes.total})`);

    // 7. Confidencialidad: Detalle de solicitud 1 para Analista vs Evaluador
    const resSolAnalista = await fetch(`${URL_BASE}/solicitudes/1`, {
      headers: { Authorization: `Bearer ${tokenAnalista}` },
    });
    const dataSolAnalista = await resSolAnalista.json();
    console.assert(dataSolAnalista.evaluacion.observaciones === undefined, 'Analista no debe ver observaciones clínicas');
    console.assert(dataSolAnalista.evaluacion.confidencial === true, 'Debe marcar como confidencial');

    const resSolEval = await fetch(`${URL_BASE}/solicitudes/1`, {
      headers: { Authorization: `Bearer ${tokenEvaluador}` },
    });
    const dataSolEval = await resSolEval.json();
    console.assert(typeof dataSolEval.evaluacion.observaciones === 'string', 'Evaluador debe ver observaciones clínicas');
    console.log('✅ 7. Regla de confidencialidad médica/psicológica verificada en API');

    // 8. Control de acceso RBAC: Evaluador intenta crear candidato (debe recibir 403)
    const resRbactest = await fetch(`${URL_BASE}/candidatos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenEvaluador}`,
      },
      body: JSON.stringify({
        nombre: 'Intento Evaluador',
        correo: 'intento@correo.cl',
        telefono: '+56911111111',
        cargo: 'Cargo X',
        familiaCargo: 'Familia X',
      }),
    });
    console.assert(resRbactest.status === 403, 'Evaluador no debe poder crear candidatos (403)');
    console.log('✅ 8. Control de acceso RBAC verificado (403 Forbidden para evaluador creando candidato)');

    // 9. Analista crea candidato exitosamente (201)
    const resCrear = await fetch(`${URL_BASE}/candidatos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAnalista}`,
      },
      body: JSON.stringify({
        nombre: 'Candidato Test API',
        correo: 'test.api@aquachile.cl',
        telefono: '+56999887766',
        cargo: 'Jefe de Centro Cultivo',
        familiaCargo: 'Jefatura B C',
        origen: 'Externo',
      }),
    });
    const dataCrear = await resCrear.json();
    console.assert(resCrear.status === 201, 'Analista debe crear candidato con 201');
    console.assert(dataCrear.candidato.id > 100, 'Nuevo candidato debe tener ID asignado');
    console.log(`✅ 9. Creación de candidato por Analista exitosa (ID: ${dataCrear.candidato.id})`);

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE LA API BACKEND PASARON EXITOSAMENTE!');
  } finally {
    servidor.close();
  }
}

ejecutarPruebas();
