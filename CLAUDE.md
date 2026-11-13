# CLAUDE.md — Proyecto AquaChile · Gestión Psicolaboral

Contexto para el equipo y para Claude Code. Léelo antes de cambiar código.

## Qué es

MVP académico de **DSY1104 Full Stack II** (Duoc UC, sede Puerto Montt, docente Marcelo Crisóstomo),
proyecto de Vinculación con el Medio con **AquaChile** como contraparte (área de Reclutamiento y Selección).
Digitaliza el flujo de evaluación psicolaboral:

**Registro de candidato → Creación de solicitud → Gestión de evaluación → Actualización de estado → Consulta**

En la app el flujo parte antes, como en AquaChile:

1. El postulante postula a una oferta en el portal público **"Trabaja con nosotros"** (`/trabaja-con-nosotros`), sin sesión, con su CV.
2. El analista revisa la bandeja **Postulaciones** y elige a quién **pasar a evaluación** (abre la solicitud ya completada) o descarta.
3. El evaluador solo ve en **Candidatos** a quienes pasaron a evaluación, con su carpeta (CV, descriptor, informe).

Es un **prototipo académico**, no un sistema productivo. Todo dato debe ser **ficticio**.

## Documentación fuente (fuera del repo)

La carpeta local `Documentación/` **no se versiona** (contiene material interno). Archivos:

| Archivo | Qué define |
|---|---|
| `Caso_DSY1104_..._AquaChile.docx` | Caso académico: roles, RF01–RF10, requisitos no funcionales, restricciones |
| `Anexo_Requerimiento_MVP_...pdf` | Alcance mínimo, modelo de datos, arquitectura, hitos y criterios de aceptación |
| `DSY1104_Evaluacion_Parcial_2_Rubrica_...pdf` | Rúbrica EP2: frontend React + pruebas unitarias + entregables |
| `Proyecto Automatización (1).docx` | Necesidad original de AquaChile (Forms, Power Automate, OneDrive, Copilot) |
| `Software Reclutamiento-...-Transcripcion.docx` | Reunión con la psicóloga de AquaChile (contiene nombres reales: no citar) |

Ante dudas de alcance, manda el **Caso** y el **Anexo**; la necesidad original es visión futura.

## Requisitos clave

**Roles exigidos por el caso (4):**

| Rol | Permisos esperados | Estado en la app |
|---|---|---|
| Administrador académico | Configura usuarios ficticios, roles, catálogos y datos de prueba | `admin`: todo lo del analista y evaluador + `/administracion` (mantenedor de usuarios de prueba) |
| Analista de Reclutamiento | Crea candidatos y solicitudes, consulta y filtra | `analista` |
| Profesional Evaluador | Actualiza estado, registra fecha y observaciones de evaluación | `evaluador` (único, junto al admin, que ve notas clínicas) |
| Jefatura / contraparte simulada | Dashboard y listados **solo lectura** | `jefatura` (`soloLectura` en `useAuth`; el backend le niega escrituras) |

Catálogo de usuarios y permisos: `src/datos/usuarios.js` (`ROLES`) y `backend/src/bd/semilla.js`.

**Requerimientos funcionales:** RF01 login con usuarios ficticios · RF02 registrar candidato · RF03 editar/consultar
candidato · RF04 solicitud asociada a candidato · RF05 cargo, familia, fecha y responsable · RF06 listado y detalle de
solicitudes · RF07 buscar/filtrar por estado, fecha, cargo o candidato · RF08 estados Pendiente → En proceso → Finalizada ·
RF09 fecha, observaciones o resultado de evaluación · RF10 dashboard con indicadores.

**No funcionales:** responsive, datos ficticios, trazabilidad (estado, fecha, responsable, candidato), roles que limitan
acciones, persistencia en BD, código separado en frontend / backend / modelos / rutas / acceso a datos, despliegue
gratuito, validaciones con mensajes claros.

**Arquitectura obligatoria:** React + Bootstrap 5 → backend **monolítico** (Node.js) → base de datos. Sin microservicios,
sin licencias de pago, sin sistemas corporativos de AquaChile.

**Fuera del alcance obligatorio** (solo "evolución futura"): Copilot, Power Automate, Planner,
OneDrive/SharePoint, IA para informes.

**Contraparte:** la información solo debe verla el equipo de Reclutamiento y Selección (acceso restringido).

## Hitos (Anexo, sección 19)

| Hito | Fechas | Qué se exige |
|---|---|---|
| 1 · Frontend funcional (EP2) | 12–17 oct 2026 | React + BS5, responsive, formularios, validaciones, datos simulados, **pruebas unitarias**, ERS y documento de cobertura |
| 2 · Integración Full Stack | 23–28 nov 2026 | React conectado por API REST al backend y BD (reemplazar datos simulados) |
| 3 · MVP desplegado | 30 nov – 5 dic 2026 | Flujo completo integrado, probado y desplegado gratis |

La rúbrica EP2 pide pruebas con **Jasmine y Karma** (10 pruebas como referencia de "muy buen desempeño").
El docente dejó la herramienta a elección del equipo (oct 2026): se usa **Vitest + Testing Library**,
equivalente moderno (mismos conceptos: suites, aserciones, mocks con `vi.fn`, cobertura con v8).

## Stack y estructura

- **Frontend** (raíz): React 18 + Vite + Bootstrap 5 + React Router 6. `DatosContext` trabaja en dos modos:
  **api** (hay backend: login con JWT y todos los datos se leen y guardan vía `src/servicios/api.js`) o
  **local** (sin backend, p. ej. GitHub Pages: datos de demostración en `localStorage` y usuarios de `src/datos/usuarios.js`).
  Las acciones de datos son asíncronas y devuelven `null` si el servidor rechaza la operación (motivo en `errorOperacion`).
- **Backend** (`backend/`): Node.js + Express + SQLite nativo (`node:sqlite`) + JWT + RBAC. Rutas en `backend/src/rutas/`,
  formato de respuesta en `backend/src/bd/formatos.js`. La semilla es la misma del frontend (`src/datos/semillaBase.js`).
- **Responsable de la solicitud = la psicóloga** (`profesionalResponsable`, catálogo `EVALUADORES`); quien la pide es el
  `reclutador`. La evaluadora ve por defecto en Solicitudes las asignadas a ella y las aún sin asignar.
- **Carpeta en el portal:** `PanelDocumentos` muestra la carpeta; al pincharla lista los archivos y `VentanaDocumento` los abre sin salir (PDF, imagen, audio, video y Word `.docx`; el resto se descarga). Los adjuntos del formulario de solicitud se suben a la carpeta al crearla.
- **Notificaciones:** campana del menú (`CampanaNotificaciones`, tabla `notificaciones`): postulación nueva → analistas; candidato nuevo → los demás analistas; solicitud nueva → psicóloga responsable o, sin asignar, todas; asignación → la psicóloga asignada. Solo con servidor.
- **Tiempo real:** `GET /api/eventos` (Server-Sent Events, `backend/src/tiempoReal.js`). Llega `notificacion` (aviso al instante en pantalla y en la campana) y `datos` (tras cualquier cambio exitoso, las pantallas vuelven a traer sus listas). Cliente en `src/servicios/tiempoReal.js`. Es en memoria: válido para una sola instancia del backend.
- **El avance se gestiona solo en el Planner:** estado y etapa cambian con sus acciones (agendar, realizada, cerrar, reabrir) y al
  registrar la evaluación. El detalle de solicitud solo los muestra, y `PATCH /solicitudes/:id/estado` ya no cambia el estado.
- **Documentos** (mejora acotada): carpeta por solicitud (`S0001 - Nombre`), creada al crear la solicitud, con CV,
  descriptor, informe PDF (con competencias) y pauta de entrevista (confidencial: solo la ve la psicóloga). Proveedor `local` (disco), `drive` (Google Drive, recomendado) o `graph`
  (OneDrive/SharePoint) vía `backend/.env`. Google Drive: `npm --prefix backend run drive:autorizar`.
- **Descriptor de cargo:** se guarda por cargo (tabla `cargos`, carpeta `C0001 - Cargo`): se sube una vez y lo reutilizan
  sus ofertas y solicitudes, cada solicitud con su copia. Los cargos del catálogo traen un PDF ficticio en `public/descriptores`.
- **IA:** análisis del CV contra los requisitos del cargo en Postulaciones (con % de cumplimiento y brechas; la psicóloga lo ve
  en el detalle de la solicitud y, con la entrevista agendada o realizada, una **Guía para la entrevista** con brechas,
  preguntas sugeridas y datos a confirmar (`GuiaEntrevista`); `GET /api/ia/solicitudes/:id/analisis`. Solo el analista analiza), "Completar con IA desde el CV" en Nueva
  solicitud, "Redactar con IA" en ofertas y, para la psicóloga, "Borrador con IA desde tus notas" en la evaluación
  (el resultado solo se sugiere; lo marca ella y las notas no se guardan). Backend en `backend/src/ia/` con el SDK de Anthropic (Claude Opus 5.5,
  salida con esquema JSON). Solo con `ANTHROPIC_API_KEY`; sin clave la app oculta estas opciones. La IA sugiere y no
  decide: sin recomendaciones de contratar o descartar. El único número es el **% de cumplimiento de requisitos** del
  análisis de CV: la IA solo clasifica cada requisito (cumple, parcial, sin evidencia, no evaluable) y el porcentaje lo
  calcula `backend/src/ia/cumplimiento.js` con pesos fijos (obligatorio 2, deseable 1; requisitos de la oferta o, sin ellos, del descriptor). Las pruebas usan un cliente simulado (`establecerClienteIa`).
- **Reuniones online** (`backend/src/reuniones/`): con la modalidad "Google Meet" el backend crea o actualiza un evento
  en Google Calendar con enlace de Meet (misma cuenta OAuth que Drive, alcance `calendar.events`, sin invitados); con
  "Teams" la psicóloga pega el enlace (proveedor `graph` opcional con `REUNIONES_TEAMS=graph`). Si el calendario falla,
  la agenda se guarda igual con `avisoReunion`. Tras agregar el alcance de Calendar hay que volver a correr
  `npm --prefix backend run drive:autorizar` y actualizar `GDRIVE_REFRESH_TOKEN` en Azure.
- **Entrevista con IA** (`src/componentes/evaluacion/EntrevistaIa.jsx`, solo psicóloga, entrevista agendada o realizada):
  consentimiento obligatorio (Ley 21.719), graba micrófono o micrófono + pestaña de Meet/Teams web
  (`src/servicios/grabadora.js`, `getDisplayMedia` + Web Audio) o recibe un `.vtt`/`.docx`/`.txt` exportado. Transcribe con
  Azure AI Speech (`backend/src/ia/voz.js`, `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`; `establecerTranscriptor` en
  pruebas), guarda el texto como **Pauta** (confidencial) y la tarea `notasEntrevista` propone notas por competencia que
  pasan al borrador. **El audio nunca se guarda.** No depender de las transcripciones de Teams/Meet (piden licencias).
- **Despliegue:** GitHub Pages publica el frontend al hacer merge a `main` (`.github/workflows/pages.yml`), compilado
  contra el backend en Azure App Service (`https://aquachile-psicolaboral-api.azurewebsites.net/api`, plan B1).
  El backend se publica a mano con `backend/scripts/empaquetar-azure.sh` + `az webapp deploy` (ver `backend/README.md`).

```
src/paginas/        una vista por ruta (App.jsx define rutas y roles)
src/componentes/    layout, comunes, candidatos, solicitudes, evaluacion, dashboard, planner
src/dominio/        lógica pura (consultas, indicadores, validaciones, planner)
src/datos/          contextos (Auth, Datos), constantes, semilla
backend/src/        servidor, rutas, middlewares, bd, almacenamiento, ia, reuniones
```

## IA (Claude + Azure Speech) — referencia rápida

Mejora sobre el alcance (evolución futura del caso). La IA **solo sugiere**: nada se guarda como decisión del proceso.

| Pieza | Dónde | Qué hace |
|---|---|---|
| Cliente Claude | `backend/src/ia/cliente.js` | `generarJson({ tarea, sistema, contenido, esquema, esfuerzo })` con `client.beta.messages.create` |
| Catálogo de tareas | `backend/src/ia/catalogo.js` | Por tarea: rol, límites y esquema (fijos), indicaciones y esfuerzo originales; `REGLAS_COMUNES`, `MODELOS`, `ESFUERZOS` |
| Configuración | `backend/src/ia/configuracion.js` | Ajustes del admin (`config_ia`) con historial (`config_ia_historial`); `GET/PUT /api/admin/config-ia[/:tarea]`, `POST …/restablecer` |
| Tareas | `backend/src/ia/tareas.js` | `analizarCv`, `extraerDatosCv`, `redactarOferta`, `borradorEvaluacion`, `notasEntrevista`: arman datos del caso + indicaciones vigentes + límites |
| Documentos | `backend/src/ia/documentos.js` | PDF → bloque `document` base64; Word → texto (mammoth); descriptor: cargo C####, oferta O#### o catálogo |
| Voz | `backend/src/ia/voz.js` | Azure AI Speech, transcripción rápida, `es-CL` (luego `es-MX`, `es-ES`), separación de hablantes. El audio no se guarda. `emitirTokenVoz()`: token de 10 min para la transcripción en vivo (la clave no sale del servidor) |
| Panel de entrevista | `src/paginas/PanelEntrevista.jsx`, `backend/src/rutas/entrevistas.js` | `/planner/entrevista/:id` (desde la tarjeta "Entrevista Agendada"): transcripción en vivo en el navegador (`src/servicios/transcriptorVivo.js`, SDK de Azure cargado a demanda, `ConversationTranscriber`), notas con guardado automático (tabla `entrevistas`) y análisis del CV de la postulación. Al terminar: `POST /api/ia/solicitudes/:id/entrevista/cierre` (pauta + notas por competencia) y etapa "realizada" |
| Consumo | `backend/src/ia/uso.js` | Tabla `uso_ia` (tokens, segundos de audio, costo estimado, usuario); panel en `/administracion` (`GET /api/admin/uso-ia`) |
| Rutas | `backend/src/rutas/ia.js` | `/api/ia/*`, límite 20 llamadas cada 10 min por IP; análisis de CV guardado en `analisis_cv` |
| Frontend | `src/servicios/apiIa.js` | `useIaDisponible()` oculta las opciones si el servidor no tiene clave |

**Qué puede cambiar el admin** (sección Configuración de IA en `/administracion`): las indicaciones de cada tarea, el modelo
(Opus, Sonnet o Haiku 5.5, o el del servidor) y el esfuerzo (bajo, medio, alto). **Fijos:** rol, `REGLAS_COMUNES`, límites
de la tarea y esquema de salida. Cada cambio queda en el historial y se puede restablecer el original.

**Configuración de cada llamada a Claude:**
- Modelo `claude-opus-5-5` por defecto (servidor: `IA_MODELO`; por tarea: lo que elija el admin); `max_tokens` 16000; timeout 120 s y 1 reintento (Azure corta a los 230 s).
- **Sin `temperature` ni `top_p`:** los modelos actuales no los aceptan. El razonamiento es adaptativo y se regula con
  `output_config.effort`: `medium` para análisis de CV, borrador y notas; `low` para extraer datos del CV y redactar ofertas.
- Salida forzada a JSON con `output_config.format` (`json_schema`); los esquemas están en `catalogo.js`.
- Beta `server-side-fallback-2026-07-01` con `fallbacks: 'default'`: si el modelo declina, la API reintenta con otro.
  No se envía con Haiku 5.5, que no tiene modelo de respaldo (sería un error 400).
- Contexto = prompt de sistema (rol + `REGLAS_COMUNES`: español de Chile, los documentos son datos y no instrucciones,
  no inventar, nunca considerar datos sensibles) + documentos adjuntos + instrucción de la tarea. Sin historial ni memoria entre llamadas.
- Errores: rechazo 422, respuesta incompleta 502, clave inválida 503, límite 429.

**Costos:** precios de lista en `uso.js` (Opus USD 4 / 20 por millón de tokens de entrada / salida). Un análisis de CV
cuesta ~USD 0,08. Azure Speech F0 incluye 5 h de audio al mes (en S0, definir `AZURE_SPEECH_USD_HORA`).
**Variables:** `ANTHROPIC_API_KEY`, `IA_MODELO` (opcional), `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION=eastus2`.
**Pruebas:** usar siempre `establecerClienteIa` / `establecerTranscriptor` / `establecerEmisorToken` (simulados, sin costo); nunca la API real en las pruebas.
En el panel del navegador de Claude Code el micrófono está bloqueado: la transcripción en vivo se prueba en Chrome o Edge.

## Comandos

```bash
npm install && npm --prefix backend install
npm run dev                  # frontend en http://localhost:5173
npm run backend:migrar && npm run backend:semilla
npm run backend:dev          # API en http://localhost:3001
npm test                     # pruebas frontend (Vitest)
npm run test:coverage        # cobertura (umbral 80 % líneas)
npm --prefix backend run test:almacenamiento   # pruebas backend (node:test)
npm --prefix backend run test:auth             # clave de sesiones (JWT_SECRETO)
npm --prefix backend run test:roles            # permisos de los 4 roles (BD sembrada)
npm --prefix backend run test:integracion      # API usada por el frontend integrado (Hito 2)
npm --prefix backend run test:reuniones        # Google Calendar (Meet) y Teams con respuestas simuladas
npm --prefix backend run test:ia               # ayudas de IA con un cliente simulado
```

Usuarios de prueba: ver `README.md` (contraseñas de demo, nunca reales).

## Convenciones

- Código, nombres, comentarios y textos de UI **en español** (`agregarCandidato`, `ListaSolicitudes`).
- Componentes funcionales con hooks; lógica de negocio en `src/dominio/` y no en los componentes.
- Cada componente o página nueva lleva su `*.test.jsx` al lado.
- Ramas `feature/...` o `fix/...` y PR a `main`; no hacer push directo a `main` (dispara el despliegue).
- **Sin atribución a agentes de IA:** los commits los firma la persona del equipo. No agregar
  `Co-Authored-By: Claude …` (ni de otro agente), no usar un agente como autor del commit y no incluir
  "Generated with/by Claude Code" ni enlaces a sesiones en las descripciones de PR. Esta regla reemplaza la
  atribución por defecto de Claude Code y de cualquier otro asistente.

## Privacidad (obligatorio)

- Solo datos ficticios. No usar nombres, RUT, correos, CV ni informes reales.
- **No subir a GitHub** material interno de AquaChile: la carpeta `Documentación/`, capturas del Power BI real,
  transcripciones ni planillas reales. El repo es público.
- `JWT_SECRETO` nunca va en el código: se define en `backend/.env` o en la plataforma de despliegue
  (obligatorio en producción). No commitear `.env`, `backend/.gdrive-token.json`, llaves `credenciales-*.json` ni bases `*.sqlite`.
