# Plan · Marea con Gemini y base de conocimiento

> Estado: **plan aprobado para codificar** (21-11-2026). Nada de esto está programado todavía.
> Objetivo principal: **una base de conocimiento sólida** construida desde los **currículos** y desde **todo lo que
> pasa en el portal**, para que Marea responda preguntas como
> *"¿Quiénes son de Puerto Montt y saben Power BI?"*.

---

## 1. Qué queremos lograr

1. **Marea entiende lenguaje natural** con Gemini (hoy usa palabras clave). Si Gemini falla o se acaba el crédito,
   vuelve sola al intérprete actual: Marea nunca deja de funcionar.
2. **Marea "conoce" a cada candidato**: ciudad, habilidades, herramientas, formación, experiencia, idiomas,
   licencias y certificaciones, sacados del CV una sola vez y guardados en la base de datos.
3. **Marea conoce lo que pasa en el portal**: postulaciones, solicitudes, entrevistas, cambios de etapa,
   evaluaciones (solo el resultado, nunca notas clínicas), ofertas abiertas.
4. **Gasto controlado**: crédito disponible de **USD 70** en Google. Cada llamada queda registrada en `uso_ia` y hay
   un tope de gasto configurable.

## 2. Cómo está hoy (revisado en el código)

| Pieza | Estado |
|---|---|
| Backend Node + Express + SQLite (`node:sqlite`) | ✅ Existe. FTS5 (búsqueda de texto completo) está disponible en el SQLite de Node 22 |
| Marea (`backend/src/agente/`) | ✅ Funciona **sin IA**: `interprete.js` (palabras clave) → RBAC → `herramientas.js` (11 herramientas) |
| IA del proyecto (`backend/src/ia/`) | ✅ Existe, pero **con Claude (Anthropic)**: análisis de CV, extraer datos del CV, ofertas, borradores |
| Cola automática al postular (`ia/colaAnalisis.js`) | ✅ Analiza el CV cuando llega una postulación (persistente, con reintentos y cupos) |
| Registro de costos (`uso_ia`, `ia/uso.js`) | ✅ Existe; hoy conoce a Claude y Azure Speech |
| Ciudad del postulante | ⚠️ Se guarda en `postulaciones.ciudad` como **texto libre** ("pto montt", "Puerto Montt", "PMontt"...) |
| Habilidades del candidato | ❌ **No se guardan**. El análisis de CV solo evalúa los requisitos de *ese* cargo |
| Historial de lo que pasa en la plataforma | ⚠️ Disperso (fechas en `solicitudes`, `postulaciones`, `notificaciones`). No hay una tabla de eventos |
| Versión anterior de Marea con IA | Commit `4db230b`: Claude solo clasificaba el mensaje (`interpretarMensaje` en `ia/tareas.js`). Sirve de modelo |

## 3. Decisiones de diseño (las importantes)

1. **Gemini no consulta la base de datos directamente ni escribe SQL.** Solo elige una *herramienta* de una lista
   cerrada y le pasa parámetros (esto se llama *function calling*). El backend valida el rol y ejecuta. Se mantienen
   intactos los pasos 2 (RBAC) y 3 (herramientas) de Marea.
2. **El conocimiento se guarda ordenado en tablas**, no "dentro de la IA". La IA solo ayuda a *llenarlas* (leyendo el
   CV) y a *entender la pregunta*. El filtrado lo hace SQL, que es exacto y gratis.
3. **Un CV se procesa una vez**, al llegar (o con un script para los que ya existen). Preguntar no vuelve a leer CVs.
4. **Gemini se agrega como un proveedor nuevo** (`backend/src/ia/gemini.js`), sin tocar el cliente de Claude. El
   análisis de CV con Claude sigue igual.
5. **Sin IA también se puede buscar.** El intérprete local aprende a reconocer "de <ciudad>" y "con / sabe <habilidad>"
   usando los catálogos de ciudades y habilidades. Gemini mejora la comprensión, pero no es indispensable.
6. **Una llamada a Gemini por mensaje escrito.** Los botones (chips, «Confirmar») nunca llaman a la IA. La respuesta
   final la arman las herramientas y `frases.js` (como hoy), así no se paga una segunda llamada.

## 4. La base de conocimiento

### 4.1 Fuentes

| Fuente | Qué aporta | Cómo entra |
|---|---|---|
| **CV** (PDF o Word del portal) | Ciudad, habilidades, herramientas, formación, experiencia, idiomas, licencias, certificaciones, resumen | Gemini lo lee una vez con un **esquema JSON fijo** → tablas `perfiles_candidato` y `habilidades_candidato`. El texto completo va a `busqueda_cv` (FTS5) |
| **Formulario del portal** | Ciudad declarada, oferta postulada, fecha | Ya existe (`postulaciones`). Se normaliza la ciudad |
| **Análisis de CV con Claude** | % de cumplimiento por cargo, brechas | Ya existe (`analisis_cv`). Marea lo lee como hoy |
| **Proceso** (solicitudes, Planner, evaluaciones) | Estado, etapa, fechas de entrevista, responsable, resultado | Ya existe en sus tablas. Marea lo consulta con herramientas |
| **Lo que pasa en la plataforma** | Quién hizo qué y cuándo | Tabla nueva `eventos`, llenada desde las rutas |

### 4.2 Lo que **nunca** entra a la base de conocimiento ni a Gemini

- Notas clínicas, pauta de entrevista, transcripciones y notas por competencia (son confidenciales de la psicóloga).
- Datos sensibles: edad, fecha de nacimiento, género, estado civil, nacionalidad, religión, salud, foto. El esquema de
  extracción **no tiene esos campos**, y las instrucciones fijas (`REGLAS_COMUNES`) le prohíben mencionarlos.
- RUT, correo y teléfono **no se envían a Gemini** al preguntar (el CV sí los contiene al extraer; el esquema no los
  pide porque ya están en `candidatos`).

### 4.3 Tablas nuevas (en `backend/src/bd/migrar.js`)

```sql
-- Perfil del candidato extraído del CV (uno por candidato; se reemplaza si sube un CV nuevo).
CREATE TABLE IF NOT EXISTS perfiles_candidato (
  candidato_id     INTEGER PRIMARY KEY REFERENCES candidatos(id) ON DELETE CASCADE,
  postulacion_id   INTEGER REFERENCES postulaciones(id) ON DELETE SET NULL, -- de qué CV salió
  ciudad           TEXT NOT NULL DEFAULT '',   -- normalizada con el catálogo (p. ej. "Puerto Montt")
  region           TEXT NOT NULL DEFAULT '',
  resumen          TEXT NOT NULL DEFAULT '',   -- 2-3 líneas, profesional
  formacion        TEXT NOT NULL DEFAULT '[]', -- JSON: [{ titulo, institucion, nivel, estado }]
  experiencia      TEXT NOT NULL DEFAULT '[]', -- JSON: [{ cargo, empresa, rubro, desde, hasta }]
  anios_experiencia REAL,
  idiomas          TEXT NOT NULL DEFAULT '[]', -- JSON: [{ idioma, nivel }]
  modelo           TEXT NOT NULL DEFAULT '',
  creado_en        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Una fila por habilidad: así "Power BI" se filtra con SQL exacto.
CREATE TABLE IF NOT EXISTS habilidades_candidato (
  candidato_id INTEGER NOT NULL REFERENCES candidatos(id) ON DELETE CASCADE,
  habilidad    TEXT NOT NULL,              -- normalizada: "Power BI", "Excel avanzado", "Licencia clase B"
  categoria    TEXT NOT NULL,              -- herramienta | tecnica | blanda | licencia | certificacion | idioma
  evidencia    TEXT NOT NULL DEFAULT '',   -- frase corta del CV que lo respalda
  PRIMARY KEY (candidato_id, habilidad)
);
CREATE INDEX IF NOT EXISTS idx_habilidades ON habilidades_candidato (habilidad);

-- Texto completo del CV para búsquedas libres ("salmonicultura", "centro de cultivo").
CREATE VIRTUAL TABLE IF NOT EXISTS busqueda_cv USING fts5(
  candidato_id UNINDEXED, texto, tokenize = 'unicode61 remove_diacritics 2'
);

-- Historial de la plataforma: lo que pasó, quién y cuándo.
CREATE TABLE IF NOT EXISTS eventos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo       TEXT NOT NULL,          -- postulacion_recibida, pasada_a_evaluacion, descartada, solicitud_creada,
                                     -- asignada, entrevista_agendada, entrevista_realizada, evaluacion_registrada,
                                     -- solicitud_cerrada, oferta_publicada, perfil_extraido...
  entidad    TEXT NOT NULL,          -- postulacion | solicitud | candidato | oferta
  entidad_id INTEGER NOT NULL,
  usuario    TEXT NOT NULL DEFAULT '',
  detalle    TEXT NOT NULL DEFAULT '', -- texto corto, sin datos clínicos
  creado_en  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos (creado_en);

-- Cola para extraer perfiles (mismo patrón que cola_analisis_cv).
CREATE TABLE IF NOT EXISTS cola_perfiles ( ...igual a cola_analisis_cv, con candidato_id/postulacion_id... );
```

### 4.4 Catálogos para normalizar (en `backend/src/bd/` o `src/datos/catalogos.js`)

- **Ciudades/comunas**, empezando por Los Lagos, Aysén y Magallanes (donde opera AquaChile), con variantes:
  `"pto montt" | "pmontt" | "puerto montt" → "Puerto Montt"`.
- **Habilidades** con sinónimos: `"powerbi" | "power bi" | "pbi" → "Power BI"`, `"excel intermedio/avanzado"`,
  `"SAP"`, `"licencia B/A2/A4/D"`, certificaciones del rubro (buzo, patrón de nave, OS-10, primeros auxilios...).
  Lo que no está en el catálogo se guarda tal cual (normalizado a mayúscula inicial) y aparece en el panel del admin
  para sumarlo después.

## 5. Gemini en el backend

### 5.1 Archivos

| Archivo | Qué hace |
|---|---|
| `backend/src/ia/gemini.js` (nuevo) | Cliente: `generarJsonGemini(...)` y `elegirHerramienta(...)`. Usa `fetch` a la API REST de Gemini (`generateContent`) o el SDK oficial `@google/genai`. Clave en `GEMINI_API_KEY` (solo backend). `establecerClienteGemini()` para pruebas simuladas |
| `backend/src/ia/uso.js` | Agregar `registrarGemini()` → `uso_ia` con `proveedor = 'gemini'` y costo estimado |
| `backend/src/ia/presupuesto.js` (nuevo) | Suma `costo_usd` de Gemini del mes. Si pasa `GEMINI_TOPE_USD` (p. ej. 60), Gemini se apaga y Marea usa el intérprete local |
| `backend/src/ia/perfil.js` (nuevo) | Tarea `perfilCandidato`: CV → JSON con esquema fijo → normaliza → guarda en las 3 tablas + evento |
| `backend/src/ia/colaPerfiles.js` (nuevo) | Cola automática al recibir una postulación con CV (copiar el patrón de `colaAnalisis.js`) |
| `backend/scripts/extraer-perfiles.js` (nuevo) | Procesa los CVs que ya están cargados (una vez) |
| `backend/src/bd/eventos.js` (nuevo) | `registrarEvento({ tipo, entidad, entidadId, usuario, detalle })`, llamado desde las rutas tras cada cambio exitoso |
| `backend/src/agente/index.js` | Paso 1: si hay Gemini disponible y bajo el tope → `elegirHerramienta`; si no o si falla → `interpretar()` |
| `backend/src/agente/herramientas.js` | Herramientas nuevas (5.3) + declarar el esquema de parámetros de cada una (se usa para Gemini) |
| `backend/src/ia/catalogo.js` | Tareas `agenteMarea` y `perfilCandidato` visibles en Configuración de IA del admin |

**Variables nuevas** (en `backend/.env` y Azure): `GEMINI_API_KEY`, `GEMINI_MODELO` (un modelo **Flash**; confirmar
el nombre y el precio vigentes en Google AI Studio antes de codificar), `GEMINI_TOPE_USD`.

### 5.2 Flujo de un mensaje

```
"¿quiénes son de Puerto Montt y saben Power BI?"
   │
   ├─ 1. Entender ─ Gemini recibe: el mensaje + la fecha de hoy + la lista de herramientas QUE ESE ROL PUEDE USAR
   │                 (nombre, descripción, parámetros). Devuelve: buscar_candidatos({ ciudad: "Puerto Montt",
   │                 habilidades: ["Power BI"] }).   ← Si falla / sin clave / sobre el tope: interprete.js
   ├─ 2. Revisar rol ─ puedeUsar(rol, 'buscar_candidatos')  (igual que hoy)
   ├─ 3. Herramienta ─ SQL sobre perfiles_candidato + habilidades_candidato + postulaciones
   └─ Respuesta ─ texto (frases.js) + tarjetas (candidato, ciudad, habilidad con su evidencia, cargo, estado, % de
                  cumplimiento si existe) + opciones ("Ver análisis", "Pasar a evaluación"...)
```

### 5.3 Herramientas nuevas de Marea

| Herramienta | Parámetros | Roles (a confirmar) |
|---|---|---|
| `buscar_candidatos` | `ciudad`, `habilidades[]`, `cargo`, `estado`, `desde`, `texto_libre` | analista, admin. Evaluador: solo candidatos en evaluación. Jefatura: solo conteos |
| `perfil_candidato` | `persona` o `candidatoId` | analista, evaluador, admin |
| `actividad_reciente` | `desde`, `tipo`, `entidad` | todos (filtrado por lo que cada rol puede ver) |
| `estadisticas` | `agrupar_por` (ciudad, habilidad, cargo, estado), `desde` | todos (solo números) |

`texto_libre` usa `busqueda_cv` (FTS5) para lo que no calza con el catálogo: *"experiencia en centro de cultivo"*.

### 5.4 Fase opcional: búsqueda por significado (*embeddings*)

Solo si el catálogo + FTS5 se quedan cortos. Gemini genera un vector por CV (una vez); se guarda en una tabla
`vectores_cv` y se compara en JS (coseno). Sirve para *"alguien que sepa de análisis de datos"* → aparece quien puso
Power BI. Costo muy bajo, pero agrega complejidad: dejarlo para el final.

## 6. Fases de trabajo (en este orden)

| Fase | Entrega | Listo cuando... |
|---|---|---|
| **0. Preparar** | Clave de Gemini en AI Studio enlazada al proyecto con el crédito; confirmar modelo, precio y **vencimiento del crédito**; `.env` | Una llamada de prueba desde el backend responde |
| **1. Base de conocimiento** | Tablas 4.3, catálogos 4.4, `perfil.js`, `colaPerfiles.js`, script de los CVs existentes | Al postular con CV se llena `perfiles_candidato` y `habilidades_candidato`; los CVs de la semilla quedan procesados |
| **2. Eventos** | `eventos.js` + llamadas en rutas de postulaciones, solicitudes, Planner, evaluaciones, ofertas | Cada acción del flujo deja su evento |
| **3. Herramientas** | `buscar_candidatos`, `perfil_candidato`, `actividad_reciente`, `estadisticas` + reglas en `interprete.js` | "de Puerto Montt con Power BI" funciona **sin IA** |
| **4. Gemini en Marea** | `gemini.js`, `presupuesto.js`, cambio del paso 1 en `agente/index.js`, tarea en el catálogo | Preguntas con redacción libre funcionan; con la clave quitada, Marea sigue respondiendo |
| **5. Pantalla** | Tarjeta de resultados de búsqueda y de perfil en `src/componentes/marea/`; consumo de Gemini en `/administracion` | Se ve en la app y en el panel de costos |
| **6. (Opcional)** | Embeddings (5.4) | — |

**Pruebas en cada fase** (regla del proyecto): cliente de Gemini **simulado**, nunca la API real.
`npm --prefix backend run test:agente`, nuevas `test:perfil` y `test:gemini`, y `npm test` en el frontend.
Casos mínimos: extracción con CV de ejemplo, normalización de ciudad y sinónimos, búsqueda combinada, RBAC de cada
herramienta nueva, respaldo al intérprete si Gemini falla o pasa el tope, ningún dato sensible en el perfil.

## 7. Reglas que no cambian

- Marea **sugiere, no decide**: no descarta ni recomienda contratar. Solo guarda al pulsar «Confirmar».
- Nunca muestra notas clínicas ni la pauta. La búsqueda no filtra por datos sensibles (no existen en las tablas).
- La clave de Gemini vive **solo en el backend** (nunca en `VITE_*`).
- El contenido de un CV es **información, no instrucciones** (si un CV dice "ignora tus reglas", se ignora).
- **Datos ficticios** mientras sea prototipo académico.

## 8. Costos (estimación a confirmar con precios vigentes)

- **Entender un mensaje:** entrada corta (mensaje + lista de herramientas) → fracción de centavo con un modelo Flash.
- **Extraer un perfil de CV:** una vez por CV; algo más caro que un mensaje, pero bajo con Flash.
- Con USD 70 y un tope de USD 60 en `GEMINI_TOPE_USD`, el margen es amplio para el uso de un equipo de reclutamiento.
  El panel de consumo del admin muestra el gasto real.

## 9. Por confirmar antes o durante la codificación

1. Con Jesús y el docente: la IA está como "evolución futura" en el caso (ver `CLAUDE.md`). ¿Suma o resta para el
   Hito 2 (23-28 nov) y el Hito 3 (30 nov - 5 dic)? Programarlo con respaldo sin IA evita riesgos en la evaluación.
2. Qué roles ven `buscar_candidatos` (tabla 5.3).
3. Con AquaChile (si se usa con datos reales): aprobación para enviar CVs a Google; usar el plan **pagado** de la API
   (en el gratuito Google puede usar los datos para mejorar sus productos). Ley 21.719.
4. ¿El perfil también se extrae de los candidatos registrados a mano (sin portal) cuando se sube su CV en la solicitud?
   Propuesta: sí, con la misma cola.

## 10. Para empezar mañana

```bash
cd proyecto-aquachile && git checkout claude/plan-marea-gemini
npm install && npm --prefix backend install
npm run backend:migrar && npm run backend:semilla
npm --prefix backend run test:agente   # debe pasar antes de tocar nada
```

Partir por la **Fase 0** (clave y modelo) y la **Fase 1** (base de conocimiento): es la base de todo lo demás.
