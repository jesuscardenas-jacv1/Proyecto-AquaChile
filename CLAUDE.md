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
| Administrador académico | Configura usuarios ficticios, roles, catálogos y datos de prueba | `admin`: todo lo del analista y evaluador + `/administracion` |
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

- **Frontend** (raíz): React 18 + Vite + Bootstrap 5 + React Router 6. Hoy los datos viven en `localStorage`
  (`src/datos/DatosContext.jsx`, semilla en `src/datos/bdSimulada.json`) y el login es local (`src/datos/usuarios.js`).
- **Backend** (`backend/`): Node.js + Express + SQLite nativo (`node:sqlite`) + JWT + RBAC. Rutas en `backend/src/rutas/`.
  El frontend **solo** lo usa para documentos (`src/servicios/apiDocumentos.js`); el resto aún no está integrado.
- **Documentos** (mejora acotada): carpeta por solicitud (`S0001 - Nombre`) con CV, descriptor e informe PDF.
  Proveedor `local` (disco) o `graph` (OneDrive/SharePoint, modo aplicación o delegado) vía `backend/.env`.
- **Despliegue:** GitHub Pages publica el frontend al hacer merge a `main` (`.github/workflows/pages.yml`).
  El backend aún no está desplegado (opción evaluada: Azure for Students / App Service).

```
src/paginas/        una vista por ruta (App.jsx define rutas y roles)
src/componentes/    layout, comunes, candidatos, solicitudes, evaluacion, dashboard, planner
src/dominio/        lógica pura (consultas, indicadores, validaciones, planner)
src/datos/          contextos (Auth, Datos), constantes, semilla
backend/src/        servidor, rutas, middlewares, bd, almacenamiento
```

## Comandos

```bash
npm install && npm --prefix backend install
npm run dev                  # frontend en http://localhost:5173
npm run backend:migrar && npm run backend:semilla
npm run backend:dev          # API en http://localhost:3001
npm test                     # pruebas frontend (Vitest)
npm run test:coverage        # cobertura (umbral 80 % líneas)
npm --prefix backend run test:almacenamiento   # pruebas backend (node:test)
npm --prefix backend run test:roles            # permisos de los 4 roles (BD sembrada)
```

Usuarios de prueba: ver `README.md` (contraseñas de demo, nunca reales).

## Convenciones

- Código, nombres, comentarios y textos de UI **en español** (`agregarCandidato`, `ListaSolicitudes`).
- Componentes funcionales con hooks; lógica de negocio en `src/dominio/` y no en los componentes.
- Cada componente o página nueva lleva su `*.test.jsx` al lado.
- Ramas `feature/...` o `fix/...` y PR a `main`; no hacer push directo a `main` (dispara el despliegue).

## Privacidad (obligatorio)

- Solo datos ficticios. No usar nombres, RUT, correos, CV ni informes reales.
- **No subir a GitHub** material interno de AquaChile: la carpeta `Documentación/`, capturas del Power BI real,
  transcripciones ni planillas reales. El repo es público.
- No commitear `.env`, `backend/.graph-token.json` ni bases `*.sqlite`.
