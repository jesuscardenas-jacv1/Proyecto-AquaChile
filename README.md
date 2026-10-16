# AquaChile · Módulo de Evaluaciones Psicolaborales

MVP web desarrollado para el proyecto académico **DSY1104 – Desarrollo Full Stack II**
(Evaluación Parcial 2), para la empresa **AquaChile** (Reclutamiento y Selección).

Aplicación **full stack**: el frontend (React) consume la **API REST** de `backend/`
(Express + SQLite + JWT, ver [`backend/README.md`](backend/README.md)). El inicio de sesión, las
reglas de negocio y la confidencialidad de las notas clínicas se aplican en el servidor.

Además existe un **modo demo** sin backend (datos simulados en el navegador), que es el que se
publica en GitHub Pages.

## Stack

| Tecnología | Versión | Uso |
| --- | --- | --- |
| React + Vite (JavaScript) | 18.3 / 5.4 | SPA y herramientas de build |
| Bootstrap 5 | 5.3 | Estilos, grilla, diseño responsive, tablas y formularios |
| bootstrap-icons | 1.11 | Iconografía |
| react-router-dom | 6.26 | Navegación entre vistas |
| Vitest + React Testing Library + jsdom | 2.1 / 16.0 | Pruebas unitarias |
| @vitest/coverage-v8 | 2.1 | Reporte de cobertura |

## Instalación y ejecución

Requiere **Node.js 22.5 o superior** (el backend usa `node:sqlite`).

### Primera vez

```bash
npm install                    # dependencias del frontend
npm install --prefix backend   # dependencias del backend
npm run backend:migrar         # crea las tablas en backend/datos.sqlite
npm run backend:semilla        # carga los datos simulados (100 del Excel + 8 del Planner)
```

### Ejecutar (dos terminales)

```bash
npm run backend:dev   # terminal 1: API en http://localhost:3001
npm run dev           # terminal 2: app en http://localhost:5173
```

En desarrollo, Vite redirige las peticiones a `/api` hacia `http://localhost:3001` (proxy en
`vite.config.js`), así que no hay que configurar CORS ni URLs. Si la API no está en ejecución, la
app muestra *"No se pudieron cargar los datos"* con un botón para reintentar.

### Modos de datos

| Modo | Cómo se activa | Datos y login |
| --- | --- | --- |
| **API** (por defecto) | — | API REST del backend, login con JWT |
| **Demo** | `VITE_MODO_DEMO=true` | `localStorage` del navegador, login local (`usuarios.js`) |

Para apuntar a una API publicada en otro servidor, se define `VITE_API_URL` al construir
(ver [`.env.example`](.env.example)); el backend debe permitir ese origen en `CORS_ORIGENES`.

### Otros comandos

```bash
npm run dev           # servidor de desarrollo en http://localhost:5173
npm run build         # build de producción en dist/
npm run preview       # previsualizar el build
npm test              # ejecutar las pruebas una vez
npm run test:watch    # pruebas en modo watch
npm run test:coverage # pruebas + reporte de cobertura
npm run importar:bd   # regenera los datos semilla desde el Excel de bd/
```

El reporte de cobertura se genera en `cobertura/index.html` (abrir en el navegador).

## Publicación en GitHub Pages

El workflow `.github/workflows/pages.yml` ejecuta las pruebas, construye la app y la publica en
GitHub Pages en cada push a `main` (también se puede lanzar a mano desde la pestaña *Actions*).
GitHub Pages solo sirve archivos estáticos (no puede ejecutar el backend), por eso esa versión se
construye en **modo demo** (`VITE_MODO_DEMO=true`).
Queda disponible en `https://<usuario>.github.io/<repositorio>/`.

Requisito (una sola vez, lo hace quien administra el repositorio):
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

La app usa como base la ruta del repositorio (`--base=/<repositorio>/`) y se copia `index.html`
como `404.html` para que las rutas de React Router funcionen al recargar la página.

## Modelo de datos

```js
Candidato  { id, nombre, correo, telefono, cargo, familiaCargo }

Solicitud  { id, candidatoId, cargo, familiaCargo, fechaSolicitud,
             estado, profesionalResponsable, observaciones }
// estado: Pendiente | En proceso | Finalizada

Evaluacion { id, solicitudId, fechaEvaluacion, resultado, observaciones, estado }
// resultado: Recomendado | Recomendado con observaciones | No recomendado
// estado: Pendiente | Realizada
```

Los datos se administran con `ProveedorDatos` (React Context), que delega cada operación en un
**servicio de datos** (ver *Arquitectura frontend ↔ backend*). En modo demo se guardan en
`localStorage` bajo la clave `aquachile_psicodelivery_v4`. En la primera visita se carga un conjunto de datos
semilla con la **base de datos simulada** de AquaChile (100 evaluaciones, abr-2025 a mar-2026).

### Base de datos simulada

La fuente es `bd/BD_Simulada_Evaluaciones_Psicolaborales_AquaChile.xlsx` (hoja `Candidatos`).
El script `scripts/importar-bd-simulada.mjs` la convierte en `src/datos/bdSimulada.json`, que
`semilla.js` usa como datos iniciales. Si se modifica el Excel, basta con ejecutar `npm run importar:bd`.

| Excel | Aplicación |
| --- | --- |
| Nombre del Candidato/a, Origen | `Candidato.nombre`, `Candidato.origen` |
| Nombre / Familia del Cargo | `cargo`, `familiaCargo` (candidato y solicitud) |
| Fecha de petición | `Solicitud.fechaSolicitud` |
| Reclutador/a | `Solicitud.profesionalResponsable` |
| Aspectos a indagar | `Solicitud.observaciones` |
| EV IN - EX, Ubicación, Unidad, CECO, Requiere Referencias, CV, Descriptor | campos extra de `Solicitud` |
| Fecha entrevista | `Evaluacion.fechaEvaluacion` |
| Categoría del evaluado | `Evaluacion.resultado` |
| Fecha de envío informe, Referencias | `Evaluacion.fechaInforme`, `diasRespuesta` (días corridos, mínimo 1) y `observaciones` |

Los catálogos de familias de cargo, resultados y reclutadoras (`constantes.js`) son los del Excel.
El Excel no incluye correo ni teléfono, así que el script genera valores ficticios.
Cada vez que cambia el formato de los datos se sube la versión de la clave de `localStorage`
(hoy `v4`, que pasó `diasRespuesta` a días corridos), para que los navegadores con datos antiguos
carguen la nueva semilla.

## Arquitectura frontend ↔ backend

```
Pantallas (paginas/, componentes/)
   │  useDatos() / useAuth()      ← acciones asíncronas; los errores se muestran con useAccion()
   ▼
ProveedorDatos / ProveedorAuth   (datos/DatosContext.jsx, datos/AuthContext.jsx)
   │  servicio de datos (misma interfaz en ambos casos)
   ├──▶ servicioApi      → fetch + JWT → API REST (backend/) → SQLite
   └──▶ servicioMemoria  → datos en memoria (+ localStorage en modo demo) · pruebas y GitHub Pages
```

- **Sesión:** `POST /api/auth/login` devuelve el usuario y un JWT de 8 horas, que se guarda en
  `sessionStorage` y se envía en cada petición (`Authorization: Bearer …`). Si la API responde 401
  (token vencido), la sesión se cierra y el login avisa que expiró.
- **Carga:** al iniciar sesión se piden candidatos, solicitudes y evaluaciones; si cambia el usuario
  se vuelven a pedir, porque la API filtra según el rol (la analista no recibe notas clínicas).
- **Acciones:** crear, editar o eliminar devuelven una promesa; si la API las rechaza (validación,
  regla de negocio, permisos) la pantalla muestra el motivo y no se pierde lo escrito.
- **Reglas en ambos lados:** las validaciones del frontend dan respuesta inmediata; las de la API
  son las que valen. `servicioMemoria` replica las reglas de la API para que el modo demo se
  comporte igual.

## Estructura del proyecto

```
src/
├── main.jsx                       # punto de entrada (Router + ProveedorAuth + ProveedorDatos)
├── App.jsx                        # definición de rutas
├── estilos/estilos.css            # estilos menores sobre Bootstrap
├── datos/
│   ├── constantes.js              # catálogos (estados, familias, profesionales)
│   ├── bdSimulada.json            # BD simulada generada desde el Excel (no editar)
│   ├── semilla.js                 # datos semilla (usa bdSimulada.json)
│   ├── demoPlanner.json           # solicitudes demo del Planner (también las siembra el backend)
│   ├── almacen.js                 # lectura/escritura en localStorage (modo demo)
│   ├── AuthContext.jsx            # sesión, login (API o local) y roles
│   ├── DatosContext.jsx           # estado global; delega las operaciones en un servicio
│   └── useAccion.js               # ejecuta acciones asíncronas y guarda su error
├── servicios/
│   ├── servicioApi.js             # cliente de la API REST (fetch + JWT)
│   ├── servicioMemoria.js         # misma interfaz, en memoria (pruebas y modo demo)
│   ├── configuracion.js           # elige el servicio según VITE_MODO_DEMO / VITE_API_URL
│   ├── sesion.js                  # sesión en sessionStorage y evento de sesión expirada
│   └── errores.js                 # ErrorApi y mensajes para el usuario
├── dominio/                       # lógica pura (fácilmente testeable)
│   ├── validaciones.js            # validaciones de candidato, solicitud y evaluación
│   ├── consultas.js               # búsquedas y filtros
│   ├── indicadores.js             # métricas del dashboard y reglas de negocio
│   ├── formateo.js, texto.js
│   └── *.test.js
├── componentes/
│   ├── layout/                    # Layout, Navbar (colapsable), PiePagina
│   ├── comunes/                   # Mensaje, EstadoVacio, EtiquetaEstado, TarjetaIndicador
│   ├── candidatos/                # ListaCandidatos, FormularioCandidato
│   ├── solicitudes/               # ListaSolicitudes, FormularioSolicitud, PanelGestion
│   └── evaluacion/                # FormularioEvaluacion
├── paginas/                       # un componente por vista
└── pruebas/                       # configuración y utilidades compartidas de pruebas
```

## Vistas y Control de Acceso (RBAC)

| Ruta | Vista | Acceso por Rol |
| --- | --- | --- |
| `/login` | Inicio de sesión corporativo | No autenticado |
| `/` | Dashboard con indicadores y KPIs generales | Analista y Evaluador |
| `/candidatos` | Directorio de candidatos con búsqueda | Analista y Evaluador |
| `/candidatos/nuevo` | Formulario de registro de candidato | Exclusivo Analista |
| `/candidatos/:id/editar` | Formulario de edición de candidato | Exclusivo Analista |
| `/solicitudes` | Bandeja de solicitudes con búsqueda y filtros | Analista y Evaluador |
| `/solicitudes/nueva` | Creación de nueva solicitud de evaluación | Exclusivo Analista |
| `/solicitudes/:id` | Ficha, panel de gestión y evaluación | Evaluador: notas clínicas y evaluación.<br>Analista: solo dictamen final (confidencial). |
| `/solicitudes/:id/informe` | Informe Psicolaboral Oficial imprimible (PDF) | Analista y Evaluador (con membrete oficial y firmas) |
| `*` | Página 404 con redirección al inicio | Cualquier ruta no reconocida |

## Usuarios de demostración (AquaChile)

| Rol | Correo / Alias | Contraseña | Funciones |
| --- | --- | --- | --- |
| **Analista de Reclutamiento** | `carolina.munoz@aquachile.cl`<br>`analista@aquachile.cl` | `AquaChile2026!` | Registra candidatos, crea solicitudes, consulta dictamen final. |
| **Profesional Evaluador** | `mvictoria.bustamante@aquachile.cl`<br>`evaluador@aquachile.cl` | `AquaChile2026!` | Toma solicitudes, pasa a 'En proceso', registra notas clínicas y dictamen. |

## Flujo principal a demostrar

1. **Registro de candidato** → `/candidatos/nuevo` (formulario con validaciones).
2. **Creación de solicitud** → `/solicitudes/nueva` (se selecciona el candidato y el cargo se completa
   automáticamente). La solicitud queda en estado `Pendiente`.
3. **Gestión** → asignar profesional responsable y cambiar el estado a `En proceso`.
4. **Registro de evaluación** → fecha, resultado (Aprobado / Reprobado / No concluyente) y observaciones.
5. **Actualización de estado** → al guardar una evaluación con resultado, la solicitud pasa automáticamente
   a `Finalizada` (regla implementada en `estadoSolicitudDesdeEvaluacion`).
6. **Consulta de información** → indicadores del dashboard y listados con filtros.

## Diseño responsive (Bootstrap 5)

- Navbar colapsable (`navbar-expand-lg` con toggler manejado por estado de React).
- Grilla de 12 columnas: indicadores `col-12 col-sm-6 col-xl-3`, formularios `col-12 col-md-6`, etc.
- Tablas dentro de `.table-responsive`; el listado de candidatos además muestra una vista de tarjetas
  en pantallas pequeñas (`d-none d-md-block` / `d-md-none`).
- Filtros y acciones se apilan verticalmente en móvil.

## Pruebas y cobertura

**Frontend: 247 pruebas en 31 archivos** (Vitest + React Testing Library), que cubren lógica,
comportamiento de componentes y manipulación del DOM. Las pantallas se prueban con `servicioMemoria`
(sin backend) y el cliente de la API con `fetch` simulado (`servicioApi.test.js`).

**Backend: 33 pruebas** (`npm run backend:test`, `node:test`) contra la API real sobre una base
SQLite temporal: autenticación, permisos por rol, validaciones, reglas de negocio, Planner y migración.

| Área | Qué se prueba |
| --- | --- |
| Formularios (candidato, solicitud, evaluación) | errores de validación, envío válido, precarga, recuperación de errores |
| Listados (candidatos, solicitudes) | renderizado, búsqueda, filtros, estados vacíos, callbacks |
| Dashboard | indicadores, solicitudes recientes, estado vacío (con `vi.mock` del contexto) |
| Detalle de solicitud | cambio de estado, asignación de profesional, reglas de evaluación |
| Navegación (App) | rutas entre vistas y 404 |
| Dominio y datos | validaciones, filtros, métricas, localStorage, acciones del contexto |
| Integración con la API | rutas y métodos HTTP, envío del JWT, errores 400/401/409, sin conexión, carga y reintento |

Cobertura actual (v8):

```
All files   | % Stmts | % Branch | % Funcs | % Lines
            |  97.29  |   88.93  |  90.35  |  97.29
```

Los umbrales están configurados en `vite.config.js` (sentencias/líneas 80, ramas 75, funciones 80);
`npm run test:coverage` falla si la cobertura baja de esos valores.

## Fuera de alcance

Almacenamiento real de adjuntos (CV y descriptor: hoy solo se guarda el nombre del archivo),
publicación del backend en un servidor, Copilot, Power Automate y Microsoft Planner.

> En **modo demo** las credenciales están en `src/datos/usuarios.js` y quedan visibles en el
> bundle publicado: es una autenticación **simulada**, no usar claves reales. En modo API las
> contraseñas se validan en el backend (bcrypt) y nunca llegan al navegador.
