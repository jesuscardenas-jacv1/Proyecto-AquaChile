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
Crea las tablas relacionales y carga los 100 registros históricos de candidatos, solicitudes y evaluaciones desde la base simulada:
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
* `PATCH /api/solicitudes/:id/estado`: Transición de estado (`Pendiente`, `En proceso`, `Finalizada`) y asignación de psicólogo/a.

### Evaluaciones Psicolaborales (`/api/evaluaciones`)
* `GET /api/evaluaciones`: Listado de evaluaciones realizadas.
* `GET /api/evaluaciones/solicitud/:solicitudId`: Evaluación de una solicitud.
* `POST /api/evaluaciones`: Registro de informe y dictamen (**Exclusivo Evaluador**). Pasa la solicitud a `Finalizada` automáticamente mediante transacción.
* `PUT /api/evaluaciones/:id`: Modificación de evaluación (**Exclusivo Evaluador**).
