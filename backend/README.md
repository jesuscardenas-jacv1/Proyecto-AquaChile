# AquaChile - API REST Backend (Evaluaciones Psicolaborales)

Backend desarrollado con **Node.js**, **Express** y **SQLite** (usando el módulo nativo `node:sqlite`), diseñado para soportar el flujo del MVP de Evaluación Psicolaboral de AquaChile bajo el modelo relacional del curso FullStack II (DSY1104).

---

## 🚀 Guía de Inicio Rápido

### 1. Instalación de dependencias
Dentro de la carpeta `backend`:
```bash
npm install
```

### 2. Migración y siembra de la Base de Datos
Crea las tablas y carga los datos de demostración: 116 candidatos, 108 solicitudes, 8 ofertas y 8 postulaciones.
```bash
npm run db:migrar
npm run db:semilla
```

### 3. Iniciar el servidor
Modo desarrollo (con recarga automática de Node.js):
```bash
npm run dev
```
Modo producción:
```bash
npm start
```
El servidor quedará escuchando en `http://localhost:3001`.

### 4. Ejecutar pruebas automatizadas de la API
```bash
npm test                     # prueba rápida de la API
npm run test:almacenamiento  # documentos
npm run test:auth            # clave de sesiones (JWT_SECRETO)
npm run test:roles           # permisos de los 4 roles (requiere BD sembrada)
npm run test:integracion     # API usada por el frontend (requiere BD sembrada)
npm run test:ia              # ayudas de IA con un cliente simulado (sin costo)
npm run test:reuniones       # Google Calendar y Teams con respuestas simuladas
```

---

## 👥 Credenciales de Prueba

| Perfil | Correo Nominal | Alias | Contraseña | Rol RBAC |
|---|---|---|---|---|
| **Analista de Reclutamiento** | `carolina.munoz@aquachile.cl` | `analista@aquachile.cl` | `AquaChile2026!` | `analista` |
| **Psicóloga Evaluadora** | `ignacia.valdes@aquachile.cl` | `evaluador@aquachile.cl` | `AquaChile2026!` | `evaluador` |
| **Administrador académico** | `andres.valdivia@aquachile.cl` | `admin@aquachile.cl` | `AquaChile2026!` | `admin` |
| **Jefatura / contraparte** | `patricia.saavedra@aquachile.cl` | `jefatura@aquachile.cl` | `AquaChile2026!` | `jefatura` |

---

## 📡 Catálogo de Endpoints REST

El administrador puede usar también lo indicado para los demás perfiles.

### Salud del Servicio
* `GET /api/salud`: Estado y versión de la API.

### Autenticación (`/api/auth`)
* `POST /api/auth/login`: Inicia sesión, valida clave encriptada con bcrypt y genera token JWT.
* `GET /api/auth/perfil`: Datos del usuario autenticado (requiere cabecera `Authorization: Bearer <token>`).
* `PUT /api/auth/perfil/foto`: Guarda la foto de perfil del usuario `{ foto }`.
* `DELETE /api/auth/perfil/foto`: Quita la foto de perfil.
* `PUT /api/auth/contrasena`: Cambia la contraseña `{ actual, nueva }`.

### Candidatos (`/api/candidatos`)
* `GET /api/candidatos`: Listado de postulantes (permite `?busqueda=nombre`).
* `GET /api/candidatos/:id`: Ficha de un candidato específico.
* `POST /api/candidatos`: Crear nuevo candidato (**Exclusivo Analista**).
* `PUT /api/candidatos/:id`: Actualizar datos de candidato (**Exclusivo Analista**).
* `DELETE /api/candidatos/:id`: Eliminar candidato sin solicitudes (**Exclusivo Analista**).

### Solicitudes de Evaluación (`/api/solicitudes`)
* `GET /api/solicitudes`: Bandeja de solicitudes (permite `?estado=Pendiente&tipoEvaluacion=interna&busqueda=...`).
* `GET /api/solicitudes/:id`: Detalle completo, candidato y evaluación asociada.
  * **Regla de confidencialidad:** Si el usuario es Analista, las observaciones clínicas se ocultan y el campo `confidencial: true`.
* `POST /api/solicitudes`: Crear solicitud (**Exclusivo Analista**).
* `PATCH /api/solicitudes/:id/estado`: Asigna la psicóloga responsable `{ profesionalResponsable }` (**Exclusivo Analista**). **No cambia el estado:** responde `409` si se intenta.
* `PATCH /api/solicitudes/:id/etapa`: Mueve la solicitud en el Planner `{ etapa, fechaEntrevista, horaEntrevista, modalidadEntrevista, enlaceReunion }` y ajusta su estado (**Exclusivo Evaluador**). Etapas: `recibida`, `agendada`, `realizada`, `informe`. Modalidades: `Teams`, `Google Meet`, `Presencial`, `Telefónica`. Con `Google Meet` se crea o actualiza el evento en Google Calendar; con `Teams` se acepta `enlaceReunion` (solo `https://` de Teams o Meet; otro valor responde `400`). Si el calendario falla, la agenda se guarda y la respuesta trae `avisoReunion`. Volver a `recibida` cancela el evento.
* `POST /api/solicitudes/:id/cierre`: Cierra sin evaluación `{ motivo, comentario, cancelarReunion }` (**Analista y Evaluador**). Con `cancelarReunion: true` también cancela el evento del calendario.
* Cada solicitud devuelve `enlaceReunion` (`''` si no hay) y `reunionEnCalendario` (la app creó un evento que puede cancelar).
* `DELETE /api/solicitudes/:id/cierre`: Reabre en la etapa en que estaba (**Analista y Evaluador**).
* `PATCH /api/solicitudes/:id`: Corrige los datos de la solicitud (cargo, familia, descriptor, ubicación, CECO, referencias, reclutador, fecha y aspectos a indagar); solo cambia los campos enviados (**Analista y Evaluador**).

### Evaluaciones Psicolaborales (`/api/evaluaciones`)
* `GET /api/evaluaciones`: Listado de evaluaciones realizadas.
* `GET /api/evaluaciones/solicitud/:solicitudId`: Evaluación de una solicitud.
* `POST /api/evaluaciones`: Registro de informe y dictamen (**Exclusivo Evaluador**). Exige la entrevista realizada y pasa la solicitud a `Finalizada` mediante transacción. Acepta `competencias` opcionales: `[{ competencia, nivel, fortalezas, oportunidades }]` (catálogo en `src/bd/competencias.js`); las competencias las ve también el analista, las observaciones clínicas no.
* `PUT /api/evaluaciones/:id`: Modificación de evaluación, incluidas las competencias (**Exclusivo Evaluador**).

### Ofertas (`/api/ofertas`)
* `GET /api/ofertas`: Ofertas abiertas del portal (público).
* `GET /api/ofertas/:id`: Detalle de una oferta abierta (público).
* `GET /api/ofertas/gestion`: Todas las ofertas, incluidos borradores y cerradas (**Analista y Jefatura**).
* `POST /api/ofertas`: Crea una oferta (**Exclusivo Analista**).
* `PUT /api/ofertas/:id`: Edita una oferta (**Exclusivo Analista**).
* `PATCH /api/ofertas/:id/estado`: Publica, cierra o reabre `{ estado }` (**Exclusivo Analista**).
* `GET /api/ofertas/:id/descriptor`: Descriptor subido antes de guardarse por cargo (**Exclusivo Analista**).

### Postulaciones (`/api/postulaciones`)
* `POST /api/postulaciones`: Registra una postulación (público, limitado por IP).
* `POST /api/postulaciones/:id/cv?nombre=cv.pdf`: Sube el CV en binario, PDF o Word de hasta 5 MB (público, limitado por IP).
* `GET /api/postulaciones`: Bandeja de postulaciones (**Analista y Jefatura**).
* `GET /api/postulaciones/:id/cv`: Descarga el CV (**Analista y Jefatura**).
* `PATCH /api/postulaciones/:id`: Cambia el estado de la postulación (**Exclusivo Analista**).

### Cargos (`/api/cargos`)
Cada cargo guarda un descriptor en su carpeta (`C0001 - Cargo`), para reutilizarlo en sus ofertas y solicitudes.
* `GET /api/cargos`: Cargos con descriptor guardado (**Analista, Evaluador y Jefatura**).
* `POST /api/cargos/descriptor?cargo=Nombre&familiaCargo=Familia&nombre=archivo.pdf`: Crea el cargo si no existe y reemplaza su descriptor; cuerpo binario (**Exclusivo Analista**).
* `GET /api/cargos/:id/descriptor`: Descarga el descriptor (**Exclusivo Analista**).

### Notificaciones y tiempo real
* `GET /api/notificaciones`: Avisos del usuario con sesión.
* `POST /api/notificaciones/leidas`: Marca todos como leídos.
* `PATCH /api/notificaciones/:id/leida`: Marca uno como leído.
* `GET /api/eventos`: Conexión abierta con Server-Sent Events. Envía `notificacion` cuando hay un aviso nuevo y `datos` cuando alguien cambia información. Funciona en memoria, para una sola instancia del servidor.

### Administración (`/api/admin`, **exclusivo Administrador**)
* `GET /api/admin/usuarios`: Usuarios de prueba (sin contraseñas).
* `POST /api/admin/usuarios`: Crea un usuario `{ nombre, correo, rol, cargo, unidad, contrasena }` (contraseña de al menos 8 caracteres; correo único).
* `PUT /api/admin/usuarios/:id`: Edita un usuario; si viene `contrasena`, la cambia.
* `DELETE /api/admin/usuarios/:id`: Elimina un usuario. No permite eliminarse a sí mismo, quitarse el rol de administrador ni dejar el sistema sin administrador.
* `POST /api/admin/reiniciar`: Restablece los datos de demostración, incluidos los 4 usuarios de prueba originales.
* `GET /api/admin/uso-ia?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`: Consumo de IA del período (por defecto, el mes actual): totales, tokens de Claude y minutos de Azure Speech, costo estimado en USD por día, ayuda, modelo y usuario, y las últimas 50 llamadas. El registro (`uso_ia`) no se borra al restablecer los datos de demostración.
* `GET /api/admin/config-ia`: Configuración de cada ayuda de IA: partes fijas (rol, reglas comunes, límites, campos de salida), editables vigentes (`indicaciones`, `modelo`, `esfuerzo`), valores originales e historial de cambios.
* `PUT /api/admin/config-ia/:tarea`: Guarda `{ indicaciones (20 a 4000 caracteres), modelo ('' = el del servidor, o claude-opus-5-5 / claude-sonnet-5-5 / claude-haiku-5-5), esfuerzo (low, medium, high) }`. Se aplica desde la próxima llamada.
* `POST /api/admin/config-ia/:tarea/restablecer`: Vuelve a los valores originales (queda en el historial).

### Ayudas de IA (`/api/ia`)
Requieren `ANTHROPIC_API_KEY` en el servidor; sin ella, `estado` responde `disponible: false` y las demás `503`. Son sugerencias: no cambian ningún dato del proceso. Limitadas por IP (20 cada 10 minutos).
* `GET /api/ia/estado`: Si la IA está disponible, con qué modelo, y si la transcripción de voz (`voz`) está configurada.
* `GET /api/ia/postulaciones/:id/analisis`: Último análisis guardado del CV (**Analista y Jefatura**).
* `GET /api/ia/solicitudes/:id/analisis`: Último análisis del CV de la postulación que originó la solicitud (porcentaje, requisitos que cumple, brechas y por confirmar), para que la psicóloga prepare la entrevista. 404 si la solicitud no viene del portal o no se analizó (Analista, Evaluador y Jefatura).
* `POST /api/ia/postulaciones/:id/analisis`: Analiza el CV del portal contra el descriptor del cargo (guardado, de la oferta o de demostración) y guarda el resultado: resumen, `criterios` (cada requisito de la oferta, o del descriptor si la oferta no tiene, con nivel `cumple`/`parcial`/`sin-evidencia`/`no-evaluable` y evidencia), `cumplimiento` (porcentaje calculado en `src/ia/cumplimiento.js`: obligatorio pesa 2, deseable 1; los no evaluables no cuentan), preguntas sugeridas y datos a confirmar. Sin recomendación de contratar o descartar (**Exclusivo Analista**).
* `POST /api/ia/extraer-cv?nombre=cv.pdf`: Devuelve nombre, correo, teléfono, ciudad y un resumen del CV en binario (PDF o Word); no lo guarda (**Exclusivo Analista**).
* `POST /api/ia/solicitudes/:id/borrador-evaluacion`: Borrador de la evaluación desde `{ notas }` de la entrevista (30 a 20.000 caracteres), con el descriptor del cargo y los aspectos a indagar: competencias con nivel, fortalezas, oportunidades y evidencia, observaciones, resultado sugerido con fundamento y temas sin evidencia. Las notas no se guardan (**Exclusivo Evaluador**).
* `POST /api/ia/solicitudes/:id/transcripcion/audio?consentimiento=si&origen=microfono|reunion`: Cuerpo: el audio grabado en el navegador (webm, ogg, wav o mp3, hasta 50 MB). Lo transcribe con Azure AI Speech (`es-CL`, si no `es-MX` o `es-ES`, con separación de hablantes), guarda la transcripción como **pauta de entrevista** (`Pauta - Transcripción entrevista <fecha>.txt`, con el consentimiento: quién lo confirmó y cuándo) y devuelve `{ transcripcion, notas, errorNotas, archivo, consentimiento, idioma, hablantes }`. Sin `consentimiento=si` responde 400. **El audio no se guarda.** Requiere `AZURE_SPEECH_KEY` y `AZURE_SPEECH_REGION` (si no, 503) (**Exclusivo Evaluador**).
* `POST /api/ia/solicitudes/:id/transcripcion?consentimiento=si&nombre=reunion.vtt[&origen=texto]`: Cuerpo: transcripción exportada de Teams o Meet (`.vtt`, `.docx` o `.txt`, hasta 2 MB) o el texto pegado. La guarda como pauta y devuelve lo mismo que la ruta de audio. `notas` (por competencia del catálogo, con citas breves, temas pendientes y un texto listo para el borrador) es `null` sin `ANTHROPIC_API_KEY`; si la IA falla, la pauta se guarda igual y `errorNotas` explica el motivo (**Exclusivo Evaluador**).
* `GET /api/ia/solicitudes/:id/transcripcion/ultima`: Última transcripción guardada como pauta, con las notas y temas pendientes que trae: `{ transcripcion, notas, archivo }` (`notas` es `null` si la pauta no las tiene). Solo lectura: no llama a la IA. Permite pasar las notas al borrador después de marcar la entrevista como realizada (**Exclusivo Evaluador**).
* `POST /api/ia/redactar-oferta`: Borrador `{ titulo, descripcion, requisitos }` a partir del descriptor del cargo `{ cargo, familiaCargo, area, ubicacion, jornada, ofertaId? }` (**Exclusivo Analista**).

### Documentos de la solicitud (`/api/solicitudes/:id/documentos`)
Cada solicitud tiene su carpeta (`S0001 - Nombre Candidato`) con el CV, el descriptor de cargo, el informe psicolaboral y la pauta de entrevista. Los archivos llevan un prefijo según su categoría (`CV - `, `Descriptor - `, `Informe - `, `Pauta - `), así la carpeta se entiende igual al abrirla directo en Google Drive u OneDrive.
* `GET /api/solicitudes/:id/documentos`: Carpeta, archivos y categorías que el usuario puede gestionar.
* `POST /api/solicitudes/:id/documentos?categoria=cv|descriptor|informe|pauta&nombre=archivo.pdf`: Sube el archivo (cuerpo binario, máx. 10 MB) y crea la carpeta si no existe. CV y descriptor: **Analista**; informe y pauta de entrevista: **Evaluador**. La **pauta es confidencial**: para analista y jefatura no aparece en el listado ni se puede descargar.
* `POST /api/solicitudes/:id/documentos/informe`: Genera y guarda el informe PDF, sin observaciones clínicas (**Exclusivo Evaluador**).
* `POST /api/solicitudes/:id/documentos/desde-postulacion`: Copia el CV del portal `{ postulacionId, nombreCandidato }` (**Exclusivo Analista**).
* `POST /api/solicitudes/:id/documentos/desde-cargo`: Copia el descriptor del cargo `{ cargoId, nombreCandidato }` (**Exclusivo Analista**).
* `POST /api/solicitudes/:id/documentos/desde-oferta`: Copia el descriptor de una oferta antigua (**Exclusivo Analista**).
* `POST /api/solicitudes/:id/documentos/carpeta`: Devuelve la carpeta y la crea si no existe, para abrirla en la nube (**Analista y Evaluador**).
* `POST /api/solicitudes/:id/documentos/sincronizar-descriptor`: Tras cambiar el cargo, copia el descriptor guardado y quita los anteriores (**Analista y Evaluador**).
* `GET /api/solicitudes/:id/documentos/:archivoId/contenido`: Descarga el archivo.
* `DELETE /api/solicitudes/:id/documentos/:archivoId`: Elimina el archivo (mismo perfil que puede subirlo).

---

## 📁 Almacenamiento de documentos: local, Google Drive u OneDrive

La variable `ALMACENAMIENTO` elige dónde viven las carpetas (copie `.env.example` como `.env`):

| Valor | Destino | Uso |
|---|---|---|
| `local` (por defecto) | `backend/documentos/` | Desarrollo y demo, sin cuentas externas |
| `drive` | Google Drive (API v3) | Producción actual: basta una cuenta de Google |
| `graph` | OneDrive o biblioteca de SharePoint vía Microsoft Graph | Alternativa para un tenant de Microsoft 365 |

**Cada solicitud crea su carpeta** (`S0001 - Nombre del postulante`) al momento de crearse. Si el proveedor no responde, la solicitud se guarda igual y la respuesta trae `avisoCarpeta`; la carpeta se vuelve a intentar al subir el primer archivo.

### Google Drive (`ALMACENAMIENTO=drive`)
1. En [Google Cloud Console](https://console.cloud.google.com/) cree un proyecto, habilite la **Google Drive API** y configure la pantalla de consentimiento (tipo "Externo", en modo prueba, agregando la cuenta como usuario de prueba).
2. Cree un **ID de cliente OAuth** de tipo **Aplicación de escritorio** y copie su ID y secreto en `GDRIVE_CLIENT_ID` y `GDRIVE_CLIENT_SECRET`.
3. Ejecute `npm run drive:autorizar`, abra el enlace con la cuenta de Google donde vivirán las carpetas y acepte. El refresh token queda en `backend/.gdrive-token.json` (no se versiona).
4. Configure `ALMACENAMIENTO=drive` y reinicie el backend. La carpeta raíz `Evaluaciones Psicolaborales` se crea en "Mi unidad" de esa cuenta; ahí se comparte con el equipo.

La app usa el alcance `drive.file`: solo ve las carpetas y archivos que ella misma creó, no el resto del Drive de esa cuenta. Para una unidad compartida de Google Workspace también existe el modo `GDRIVE_MODO=cuenta-servicio` (ver `.env.example`).

### OneDrive / SharePoint (`ALMACENAMIENTO=graph`)

Para `graph`, TI de AquaChile debe:
1. Registrar una aplicación en **Microsoft Entra ID** y crear un secreto de cliente (`GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`).
2. Otorgar el permiso de aplicación **Sites.Selected** sobre el sitio de SharePoint de Reclutamiento (recomendado) o **Files.ReadWrite.All**, con consentimiento de administrador.
3. Indicar el destino: `GRAPH_DRIVE_ID` (biblioteca de SharePoint, recomendado) o `GRAPH_USUARIO` (OneDrive de una cuenta de servicio).

Se recomienda una biblioteca de SharePoint y no el OneDrive personal de una persona: si esa cuenta se da de baja, sus archivos se eliminan.

Pruebas de la capa de almacenamiento (Graph se prueba con respuestas simuladas):
```bash
npm run test:almacenamiento
```

---

## 🎥 Reuniones online de la entrevista (Google Meet y Teams)

Código en `src/reuniones/`: `google.js` (Google Calendar), `graph.js` (Teams vía Microsoft Graph) e `index.js`, que decide qué hacer al agendar, reagendar, devolver a "recibida" o cerrar sin evaluación. Guarda en la solicitud `enlace_reunion`, `evento_reunion_id` y `proveedor_reunion`.

| Modalidad | Qué pasa al agendar |
|---|---|
| Google Meet | Se crea un evento en Google Calendar con enlace de Meet (zona `America/Santiago`, 60 min, **sin invitados**). Reagendar actualiza el mismo evento. |
| Teams | La psicóloga pega el enlace de la reunión. Con `REUNIONES_TEAMS=graph`, la reunión se crea con Microsoft Graph. |
| Presencial / Telefónica | Sin enlace; si había un evento de Meet, se cancela. |

Si el proveedor no está configurado, no tiene permiso o no responde, **la entrevista se agenda igual** y la respuesta trae `avisoReunion`, que el Planner muestra.

### Google Meet (Google Calendar)
Usa el mismo cliente OAuth y la misma cuenta de Google que Google Drive, con el alcance `calendar.events` (crear, cambiar y cancelar eventos; no lee el resto del calendario). Para activarlo:
1. En Google Cloud Console, en el mismo proyecto de Drive, habilite la **Google Calendar API** y agregue el alcance `.../auth/calendar.events` en la pantalla de consentimiento.
2. Vuelva a autorizar la cuenta: `npm --prefix backend run drive:autorizar` (ahora pide Drive y Calendar; marque las dos casillas). Se reescribe `backend/.gdrive-token.json`.
3. **Producción:** reemplace la variable `GDRIVE_REFRESH_TOKEN` del App Service por el `refresh_token` nuevo de ese archivo y reinicie la app. Sin este paso, en Azure Meet sigue mostrando el aviso "no autorizó Google Calendar" (lo demás funciona igual).

Opcionales: `REUNIONES_CALENDARIO_ID` (otro calendario de la cuenta; por defecto `primary`) y `REUNIONES_GOOGLE=no` para desactivarlo.

### Teams con Microsoft Graph (opcional, para la TI de AquaChile)
Desactivado por defecto: sin él, la psicóloga pega el enlace de Teams. Para crear la reunión automáticamente, la TI debe:
1. Registrar una aplicación en **Microsoft Entra ID** con un secreto de cliente (`GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`; pueden ser los mismos de OneDrive/SharePoint).
2. Otorgar el permiso de aplicación **`Calendars.ReadWrite`** de Microsoft Graph, con **consentimiento de un administrador** del tenant.
3. Limitar ese permiso al buzón de Reclutamiento con una **directiva de acceso de aplicación** de Exchange Online (`New-ApplicationAccessPolicy -AccessRight RestrictAccess ...`), para que la app no pueda tocar otros calendarios.
4. Definir `REUNIONES_TEAMS=graph` y `GRAPH_REUNIONES_USUARIO` (el buzón que organiza las reuniones, con licencia de Teams).

La reunión se crea como evento del calendario de ese buzón con `isOnlineMeeting: true` y `onlineMeetingProvider: teamsForBusiness`; el enlace es `onlineMeeting.joinUrl`. Este proveedor está probado solo con respuestas simuladas (`npm run test:reuniones`).

---

## ☁️ Despliegue en Azure App Service (Hito 3)

Backend publicado en **https://aquachile-psicolaboral-api.azurewebsites.net/api** (grupo `rg-aquachile-chile`, plan **B1 Linux**, Node 22, región East US 2: la única que permiten las políticas de la suscripción Azure for Students de Duoc). El frontend de GitHub Pages se compila con `VITE_API_URL` apuntando ahí (`.github/workflows/pages.yml`).

**Configuración del App Service** (Variables de entorno): `NODE_ENV=production`, `JWT_SECRETO`, `BD_RUTA=/home/data/datos.sqlite`, `SEMILLA_DATOS=/home/site/wwwroot/datos-semilla`, `CORS_ORIGENES=https://jesuscardenas-jacv1.github.io`, `ALMACENAMIENTO=drive`, `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, `GDRIVE_REFRESH_TOKEN` (con los alcances de Drive y Calendar), `GDRIVE_CARPETA_RAIZ=Evaluaciones Psicolaborales (producción)`, `SCM_DO_BUILD_DURING_DEPLOYMENT=true` y, para activar la IA, `ANTHROPIC_API_KEY` (y `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` para grabar y transcribir la entrevista). Comando de inicio: `node src/servidor.js`.

Al arrancar, el servidor aplica las migraciones y, si la BD está vacía, carga los datos de demostración. La BD vive en `/home/data`, que es persistente entre reinicios y despliegues.

**Publicar una nueva versión** (con la Azure CLI y `az login`):
```bash
bash backend/scripts/empaquetar-azure.sh
az webapp deploy -g rg-aquachile-chile -n aquachile-psicolaboral-api --src-path backend/despliegue-azure.zip --type zip
```

Se ejecuta desde la raíz del repositorio. Si un cambio afecta también al frontend, despliega primero el backend y después fusiona a `main`.

