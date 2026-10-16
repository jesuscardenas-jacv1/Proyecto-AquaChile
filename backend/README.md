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
Crea las tablas relacionales y carga los mismos datos semilla que el frontend: los 100 registros históricos de la base simulada (`src/datos/bdSimulada.json`) y las 8 solicitudes en curso del Planner (`src/datos/demoPlanner.json`). `db:migrar` también agrega las columnas nuevas a una base creada con una versión anterior, sin perder datos:
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
npm test
```
Las pruebas (`node:test`) crean una base SQLite **temporal**, así que no modifican `datos.sqlite`.
Si alguna falla, el comando termina con error.

### Variables de entorno
Ver [`.env.example`](.env.example). Node no lee el archivo `.env` automáticamente: defínelas en la
terminal o usa `node --env-file=.env src/servidor.js`.

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `3001` | Puerto HTTP |
| `JWT_SECRETO` | valor de desarrollo | Firma de tokens. **Obligatoria si `NODE_ENV=production`** (el servidor no inicia sin ella) |
| `CORS_ORIGENES` | `http://localhost:5173` | Orígenes permitidos, separados por coma |
| `AQUACHILE_BD` | `backend/datos.sqlite` | Ruta del archivo SQLite |
| `NODE_ENV` | — | `production` activa la exigencia de `JWT_SECRETO` |

Requiere **Node.js 22.5 o superior** (módulo `node:sqlite`).

---

## 👥 Credenciales de Prueba

| Perfil | Correo Nominal | Alias | Contraseña | Rol RBAC |
|---|---|---|---|---|
| **Analista de Reclutamiento** | `carolina.munoz@aquachile.cl` | `analista@aquachile.cl` | `AquaChile2026!` | `analista` |
| **Psicóloga Evaluadora** | `mvictoria.bustamante@aquachile.cl` | `evaluador@aquachile.cl` | `AquaChile2026!` | `evaluador` |

---

## 📡 Catálogo de Endpoints REST

### Salud del Servicio
* `GET /api/salud`: Estado y versión de la API.

### Autenticación (`/api/auth`)
* `POST /api/auth/login`: Inicia sesión, valida clave encriptada con bcrypt y genera token JWT.
* `GET /api/auth/perfil`: Datos del usuario autenticado (requiere cabecera `Authorization: Bearer <token>`).

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
* `PATCH /api/solicitudes/:id/estado`: Transición de estado (`Pendiente`, `En proceso`, `Finalizada`) y asignación de psicólogo/a. Solo se puede pasar a `Finalizada` si ya existe una evaluación (si no, `409`). Si el nuevo estado no calza con la etapa del Planner, la etapa se ajusta.
* `PATCH /api/solicitudes/:id/etapa`: Mueve la solicitud en el Planner (**Exclusivo Evaluador**). Body: `{ etapa, fechaEntrevista?, horaEntrevista?, modalidadEntrevista? }`.
  * `recibida` (→ `Pendiente`): borra los datos de la entrevista.
  * `agendada` (→ `En proceso`): exige fecha (no anterior a la solicitud), hora entre 08:00 y 20:00 y modalidad (`Teams`, `Presencial`, `Telefónica`).
  * `realizada` (→ `En proceso`): requiere una entrevista agendada.
  * `informe` no se asigna a mano (`400`): se alcanza al registrar la evaluación. Una solicitud `Finalizada` no se reabre (`409`).
* Cada solicitud incluye `etapa` (`null` = se deduce del estado), `fechaEntrevista`, `horaEntrevista` y `modalidadEntrevista`.

### Evaluaciones Psicolaborales (`/api/evaluaciones`)
* `GET /api/evaluaciones`: Listado de evaluaciones realizadas.
* `GET /api/evaluaciones/solicitud/:solicitudId`: Evaluación de una solicitud.
* `POST /api/evaluaciones`: Registro de informe y dictamen (**Exclusivo Evaluador**). La solicitud debe estar `En proceso` (si está `Pendiente`, `409`). Pasa la solicitud a `Finalizada` automáticamente mediante transacción.
* `PUT /api/evaluaciones/:id`: Modificación de evaluación (**Exclusivo Evaluador**). Solo cambia los campos enviados, que se validan igual que al crear.

### Validaciones y errores
* Los datos se validan con las mismas reglas del frontend (correo, teléfono de 8 a 15 dígitos, nombre de 3+ caracteres, fechas `AAAA-MM-DD` no futuras, observaciones de 10+ caracteres, resultado del catálogo).
* Datos inválidos → `400` con `{ error, errores: { campo: mensaje } }`. IDs no numéricos → `400`.
* Errores internos → `500` con mensaje genérico; el detalle solo se registra en la consola del servidor.
* Login: tras 5 intentos fallidos por IP y correo se bloquea 15 minutos (`429`).
