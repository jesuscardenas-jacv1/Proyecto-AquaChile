# 📋 Resumen Integral de Cambios y Estado del Proyecto AquaChile

**Fecha de registro:** 12 de Octubre de 2026  
**Proyecto:** MVP de Evaluación Psicolaboral AquaChile (DSY1104 - FullStack II)  
**Ramas activas:** `main` (sincronizada con GitHub: `jesuscardenas-jacv1/Proyecto-AquaChile`)

---

## 🌟 Resumen Ejecutivo de la Sesión

Durante esta jornada se desarrollaron e integraron 3 grandes componentes arquitectónicos:
1. **Sistema de Autenticación y Control de Acceso por Roles (RBAC) en Frontend:** Pantalla de Login, guardianes de rutas y resguardo de confidencialidad médica/psicológica.
2. **Módulo de Informe Psicolaboral Oficial Imprimible en PDF:** Vista oficial corporativa con membrete, folio, antecedentes del postulante, dictamen y firmas con soporte de impresión `@media print`.
3. **Backend API REST Completo con Node.js, Express y SQLite:** Modelo relacional con base de datos nativa, endpoints REST, JWT, encriptación con bcrypt y pruebas automáticas.

---

## 1. Frontend: Autenticación y Control de Acceso (RBAC)

### Componentes y archivos creados/modificados:
* **`src/datos/usuarios.js`**: Catálogo de usuarios simulados y función de autenticación local.
* **`src/datos/AuthContext.jsx`**: Proveedor de contexto con persistencia en `sessionStorage` (`aquachile_sesion_activa`), flags de rol (`esAnalista`, `esEvaluador`) y métodos `iniciarSesion` / `cerrarSesion`.
* **`src/componentes/comunes/RutaProtegida.jsx`**: Guardián de rutas que redirige a `/login` si no hay sesión, o a la bandeja con aviso de advertencia si el rol no tiene permisos.
* **`src/paginas/Login.jsx`**: Pantalla corporativa formal de acceso con membrete de AquaChile, selector de credenciales de prueba y mensajes de validación.
* **`src/componentes/layout/Navbar.jsx`**: Barra adaptativa que muestra badge del rol activo, nombre del colaborador, botón de cerrar sesión y oculta accesos restringidos (como *Nueva solicitud* a evaluadores).
* **`src/paginas/DetalleSolicitud.jsx`**: Implementa la **regla de confidencialidad clínica**: los analistas solo ven el dictamen final, mientras que los psicólogos evaluadores tienen acceso completo a las notas cualitativas.

### Credenciales Corporativas de Demostración:
| Rol | Correo Nominal | Alias | Contraseña | Permisos |
|---|---|---|---|---|
| **Analista de Reclutamiento** | `carolina.munoz@aquachile.cl` | `analista@aquachile.cl` | `AquaChile2026!` | Registra candidatos, crea solicitudes, consulta dictámenes. |
| **Psicóloga Evaluadora** | `ignacia.valdes@aquachile.cl` | `evaluador@aquachile.cl` | `AquaChile2026!` | Toma solicitudes, registra evaluaciones y observaciones clínicas. |

---

## 2. Frontend: Informe Psicolaboral Oficial Imprimible

### Componentes y archivos creados/modificados:
* **`src/paginas/InformePsicolaboral.jsx`**: Ruta `/solicitudes/:id/informe`. Genera el documento oficial con membrete corporativo, Folio único (`FOLIO-APL-000X`), antecedentes del candidato, parámetros del proceso, dictamen formal y firmas de responsabilidad (Psicología Laboral y Dirección de Personas).
* **`src/estilos/estilos.css`**: Reglas `@media print` optimizadas para imprimir en papel o guardar en PDF (oculta barras de navegación y botones, preserva colores corporativos con `print-color-adjust: exact`).
* **`src/paginas/DetalleSolicitud.jsx`**: Botón *"Ver Informe Oficial"* (`bi-printer`) habilitado cuando la evaluación ya ha sido realizada.

---

## 3. Backend: API REST con Node.js, Express y SQLite

Ubicado en el directorio independiente `backend/`:

### Arquitectura Técnica:
* **Motor SQLite Nativo (`node:sqlite`):** Se utilizó el módulo nativo de Node.js 22+, garantizando compatibilidad en Windows sin necesidad de compilar dependencias C++ (`node-gyp`).
* **Seguridad:** Encriptación de claves con `bcryptjs`, autenticación con tokens `jsonwebtoken` (JWT) de 8 horas.
* **Control de Acceso:** Middleware `requerirRol('analista')` y `requerirRol('evaluador')`.
* **Confidencialidad Médica:** Los endpoints sanitizan la respuesta según el rol del token (ocultan notas clínicas a analistas).

### Archivos del Backend:
* **`backend/package.json`**: Configuración de scripts (`start`, `dev`, `db:migrar`, `db:semilla`, `test`).
* **`backend/src/servidor.js`**: Servidor Express con CORS, healthcheck y montaje de rutas.
* **`backend/src/bd/conexion.js`**: Conexión compartida con `DatabaseSync` (`foreign_keys = ON`, `journal_mode = WAL`).
* **`backend/src/bd/migrar.js`**: Creación de tablas (`usuarios`, `candidatos`, `solicitudes`, `evaluaciones`).
* **`backend/src/bd/semilla.js`**: Siembra transaccional de los 2 usuarios y los 100 registros históricos desde `bdSimulada.json`.
* **`backend/src/middlewares/auth.js`**: Middleware para verificar JWT y roles RBAC.
* **`backend/src/middlewares/errores.js`**: Manejo de rutas 404 y errores 500 no controlados.
* **`backend/src/rutas/auth.js`**: `POST /api/auth/login`, `GET /api/auth/perfil`.
* **`backend/src/rutas/candidatos.js`**: CRUD completo de postulantes.
* **`backend/src/rutas/solicitudes.js`**: Listado, detalle con confidencialidad, creación y cambio de estado (`PATCH /:id/estado`).
* **`backend/src/rutas/evaluaciones.js`**: Registro de evaluación (finaliza la solicitud en una transacción).
* **`backend/src/probar_api.js`**: Suite de 9 pruebas de integración automatizadas.
* **`backend/README.md`**: Documentación técnica del backend y guía de endpoints.

---

## 4. Estado de Validación y Pruebas Automatizadas

* **Pruebas del Frontend (`vitest run`):**
  * **25 archivos de pruebas** pasando (100%).
  * **173 pruebas unitarias y de integración** pasando exitosamente.
* **Pruebas del Backend (`node src/probar_api.js`):**
  * **9 validaciones de integración** pasando exitosamente (Healthcheck, Auth JWT, RBAC, Confidencialidad, CRUD).

---

## 5. Comandos para Ejecutar el Proyecto

Desde la raíz del repositorio:
```bash
# 1. Frontend en modo desarrollo (puerto 5173):
npm run dev

# 2. Backend en modo desarrollo (puerto 3001 con auto-recarga):
npm run backend:dev

# 3. Correr pruebas de integración del backend:
npm run backend:test

# 4. Re-inicializar / sembrar base de datos SQLite:
npm run backend:semilla

# 5. Correr toda la suite de pruebas del frontend:
npm test
```

---
*Documento guardado automáticamente para sincronización entre sesiones de Antigravity.*
