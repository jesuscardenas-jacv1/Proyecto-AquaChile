# AquaChile · Módulo de Evaluaciones Psicolaborales

MVP web desarrollado para el proyecto académico **DSY1104 – Desarrollo Full Stack II**
(Evaluación Parcial 2), para la empresa **AquaChile** (Reclutamiento y Selección).

En esta etapa se construye **solo el frontend** con **datos simulados** persistidos en
`localStorage`. No hay backend, ni base de datos, ni autenticación real.

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

```bash
npm install           # instalar dependencias
npm run dev           # servidor de desarrollo en http://localhost:5173
npm run build         # build de producción en dist/
npm run preview       # previsualizar el build
npm test              # ejecutar las pruebas una vez
npm run test:watch    # pruebas en modo watch
npm run test:coverage # pruebas + reporte de cobertura
```

El reporte de cobertura se genera en `cobertura/index.html` (abrir en el navegador).

## Modelo de datos

```js
Candidato  { id, nombre, correo, telefono, cargo, familiaCargo }

Solicitud  { id, candidatoId, cargo, familiaCargo, fechaSolicitud,
             estado, profesionalResponsable, observaciones }
// estado: Pendiente | En proceso | Finalizada

Evaluacion { id, solicitudId, fechaEvaluacion, resultado, observaciones, estado }
// resultado: Aprobado | Reprobado | No concluyente
// estado: Pendiente | Realizada
```

Los datos se administran con `ProveedorDatos` (React Context) y se guardan en `localStorage`
bajo la clave `aquachile_psicodelivery_v1`. En la primera visita se carga un conjunto de datos
semilla (4 candidatos, 4 solicitudes, 1 evaluación) para poder demostrar el flujo de inmediato.

## Estructura del proyecto

```
src/
├── main.jsx                       # punto de entrada (Router + ProveedorDatos)
├── App.jsx                        # definición de rutas
├── estilos/estilos.css            # estilos menores sobre Bootstrap
├── datos/
│   ├── constantes.js              # catálogos (estados, familias, profesionales)
│   ├── semilla.js                 # datos semilla
│   ├── almacen.js                 # lectura/escritura en localStorage (funciones puras)
│   ├── DatosContext.jsx           # estado global y acciones de negocio
│   └── DatosContext.test.jsx
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

## Vistas

| Ruta | Vista |
| --- | --- |
| `/` | Dashboard con indicadores (totales por estado, % finalizadas, distribución por familia) |
| `/candidatos` | Listado de candidatos con búsqueda, edición y eliminación |
| `/candidatos/nuevo` | Formulario de registro de candidato |
| `/candidatos/:id/editar` | Formulario de edición de candidato |
| `/solicitudes` | Listado de solicitudes con búsqueda y filtros por estado y familia |
| `/solicitudes/nueva` | Formulario de nueva solicitud (completa el cargo desde el candidato) |
| `/solicitudes/:id` | Detalle: asignar profesional, cambiar estado, registrar/actualizar evaluación |
| `*` | Página 404 |

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

**127 pruebas en 19 archivos** (Vitest + React Testing Library), que cubren lógica, comportamiento de
componentes y manipulación del DOM, con mocks del contexto de datos y de `useNavigate`.

| Área | Qué se prueba |
| --- | --- |
| Formularios (candidato, solicitud, evaluación) | errores de validación, envío válido, precarga, recuperación de errores |
| Listados (candidatos, solicitudes) | renderizado, búsqueda, filtros, estados vacíos, callbacks |
| Dashboard | indicadores, solicitudes recientes, estado vacío (con `vi.mock` del contexto) |
| Detalle de solicitud | cambio de estado, asignación de profesional, reglas de evaluación |
| Navegación (App) | rutas entre vistas y 404 |
| Dominio y datos | validaciones, filtros, métricas, localStorage, acciones del contexto |

Cobertura actual (v8):

```
All files   | % Stmts | % Branch | % Funcs | % Lines
    99.13   |  99.13  |   91.44  |  88.23  |  99.13
```

Los umbrales están configurados en `vite.config.js` (sentencias/líneas 80, ramas 75, funciones 80);
`npm run test:coverage` falla si la cobertura baja de esos valores.

## Fuera de alcance

Backend, base de datos, autenticación real, Copilot, Power Automate y Planner.
