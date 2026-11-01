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
| **Psicóloga Evaluadora** | `ignacia.valdes@aquachile.cl` | `evaluador@aquachile.cl` | `AquaChile2026!` | `evaluador` |

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
* `PATCH /api/solicitudes/:id`: Corrige los datos de la solicitud (cargo, familia, ubicación, CECO, referencias, reclutador, fecha y aspectos a indagar); solo cambia los campos enviados (**Analista y Evaluador**).

### Evaluaciones Psicolaborales (`/api/evaluaciones`)
* `GET /api/evaluaciones`: Listado de evaluaciones realizadas.
* `GET /api/evaluaciones/solicitud/:solicitudId`: Evaluación de una solicitud.
* `POST /api/evaluaciones`: Registro de informe y dictamen (**Exclusivo Evaluador**). Pasa la solicitud a `Finalizada` automáticamente mediante transacción. Acepta `competencias` opcionales: `[{ competencia, nivel, fortalezas, oportunidades }]` (catálogo en `src/bd/competencias.js`); las competencias las ve también el analista, las observaciones clínicas no.
* `PUT /api/evaluaciones/:id`: Modificación de evaluación, incluidas las competencias (**Exclusivo Evaluador**).

### Administración (`/api/admin`, **exclusivo Administrador**)
* `GET /api/admin/usuarios`: Usuarios de prueba (sin contraseñas).
* `POST /api/admin/usuarios`: Crea un usuario `{ nombre, correo, rol, cargo, unidad, contrasena }` (contraseña de al menos 8 caracteres; correo único).
* `PUT /api/admin/usuarios/:id`: Edita un usuario; si viene `contrasena`, la cambia.
* `DELETE /api/admin/usuarios/:id`: Elimina un usuario. No permite eliminarse a sí mismo, quitarse el rol de administrador ni dejar el sistema sin administrador.
* `POST /api/admin/reiniciar`: Restablece los datos de demostración, incluidos los 4 usuarios de prueba originales.

### Documentos de la solicitud (`/api/solicitudes/:id/documentos`)
Cada solicitud tiene su carpeta (`S0001 - Nombre Candidato`) con el CV, el descriptor de cargo y el informe psicolaboral. Los archivos llevan un prefijo según su categoría (`CV - `, `Descriptor - `, `Informe - `), así la carpeta se entiende igual al abrirla directo en OneDrive.
* `GET /api/solicitudes/:id/documentos`: Carpeta, archivos y categorías que el usuario puede gestionar.
* `POST /api/solicitudes/:id/documentos?categoria=cv|descriptor|informe|pauta&nombre=archivo.pdf`: Sube el archivo (cuerpo binario, máx. 10 MB) y crea la carpeta si no existe. CV y descriptor: **Analista**; informe y pauta de entrevista: **Evaluador**. La **pauta es confidencial**: para analista y jefatura no aparece en el listado ni se puede descargar.
* `GET /api/solicitudes/:id/documentos/:archivoId/contenido`: Descarga el archivo.
* `DELETE /api/solicitudes/:id/documentos/:archivoId`: Elimina el archivo (mismo perfil que puede subirlo).

---

## 📁 Almacenamiento de documentos: local, Google Drive u OneDrive

La variable `ALMACENAMIENTO` elige dónde viven las carpetas (copie `.env.example` como `.env`):

| Valor | Destino | Uso |
|---|---|---|
| `local` (por defecto) | `backend/documentos/` | Desarrollo y demo, sin Microsoft 365 |
| `drive` | Google Drive (API v3) | Opción recomendada para el proyecto: basta una cuenta de Google |
| `graph` | OneDrive o biblioteca de SharePoint vía Microsoft Graph | Producción en el tenant de AquaChile |

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

## ☁️ Despliegue en Azure App Service (Hito 3)

Backend publicado en **https://aquachile-psicolaboral-api.azurewebsites.net/api** (grupo `rg-aquachile-chile`, plan **B1 Linux**, Node 22, región East US 2: la única que permiten las políticas de la suscripción Azure for Students de Duoc). El frontend de GitHub Pages se compila con `VITE_API_URL` apuntando ahí (`.github/workflows/pages.yml`).

**Configuración del App Service** (Variables de entorno): `NODE_ENV=production`, `JWT_SECRETO`, `BD_RUTA=/home/data/datos.sqlite`, `SEMILLA_DATOS=/home/site/wwwroot/datos-semilla`, `CORS_ORIGENES=https://jesuscardenas-jacv1.github.io`, `ALMACENAMIENTO=drive`, `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, `GDRIVE_REFRESH_TOKEN`, `GDRIVE_CARPETA_RAIZ=Evaluaciones Psicolaborales (producción)` y `SCM_DO_BUILD_DURING_DEPLOYMENT=true`. Comando de inicio: `node src/servidor.js`.

Al arrancar, el servidor aplica las migraciones y, si la BD está vacía, carga los datos de demostración. La BD vive en `/home/data`, que es persistente entre reinicios y despliegues.

**Publicar una nueva versión** (con la Azure CLI y `az login`):
```bash
bash backend/scripts/empaquetar-azure.sh
az webapp deploy -g rg-aquachile-chile -n aquachile-psicolaboral-api --src-path backend/despliegue-azure.zip --type zip
```

