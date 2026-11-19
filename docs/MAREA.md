# Marea · guía rápida para el equipo

Marea es el agente de reclutamiento de la app. Funciona **sin IA y sin costo**: no usa claves ni servicios pagados.

## Cómo funciona (3 pasos)

```
mensaje o botón → 1. entender → 2. revisar rol → 3. herramienta → respuesta (texto + tarjetas + opciones)
```

1. **Entender** (`backend/src/agente/interprete.js`): reglas de palabras clave. "Agenda a Valentina mañana a las 9"
   da la intención `agendar`, la fecha y la hora. Los botones (chips) mandan la acción lista y se saltan este paso.
2. **Revisar rol** (`herramientas.js`, `HERRAMIENTAS`): cada herramienta dice qué roles pueden usarla.
   Se valida en el backend, no solo en la pantalla.
3. **Herramienta** (`herramientas.js`): código normal que lee la BD y arma la respuesta.

| Archivo | Para qué |
|---|---|
| `agente/index.js` | Orquesta los 3 pasos |
| `agente/interprete.js` | Entiende el mensaje (palabras clave) |
| `agente/herramientas.js` | Una función por intención + permisos |
| `agente/horarios.js` | Horas libres (bloques de 45 min, lunes a viernes) |
| `agente/identidad.js` | Buscar personas y validar el RUT |
| `agente/frases.js` | Frases de Marea (no repite la última) |
| `rutas/agente.js` | `POST /api/agente/mensaje` y `GET /api/agente/avisos` |

**Reglas que no se cambian:** Marea sugiere y no decide (nunca "contratar" ni "descartar"). Solo guarda algo cuando
el usuario pulsa **Confirmar**. Nunca muestra notas clínicas ni la pauta.

**Pruebas:** `npm --prefix backend run test:agente`.

## Agregar algo nuevo

- **Una frase:** agrégala en `frases.js`.
- **Una palabra que no entiende:** agrégala a la regla de su intención en `interprete.js` y suma un caso a la prueba
  "reconoce cada intención".
- **Una función nueva:** crea la función en `herramientas.js`, regístrala en `HERRAMIENTAS` con sus roles y agrega su
  regla en `interprete.js`.

## ¿Se le puede poner IA a Marea más adelante?

Sí. Solo cambia el **paso 1 (entender)**: los pasos 2 y 3 quedan iguales, así que los permisos y las reglas no se tocan.

1. En `index.js`, si hay `ANTHROPIC_API_KEY`, se le pide a Claude que clasifique el mensaje en lugar de `interpretar(...)`.
   Si no hay clave o la IA falla, se usa el intérprete local.
2. Claude solo devuelve `{ intencion, parametros }` con un esquema JSON. No consulta datos ni decide nada.
3. Se registra como una tarea más en `backend/src/ia/catalogo.js` y aparece en la Configuración de IA del admin.

Esta versión con Claude ya se programó y probó una vez: está en el commit `4db230b`
(`git show 4db230b -- backend/src/agente backend/src/ia`). Se retiró para no tener costos.
**Ojo:** con IA, cada mensaje escrito se cobra en la cuenta de Anthropic (poco, pero se cobra).

## ¿Y el análisis de CV, Google Drive y Calendar?

Son piezas del proyecto que **ya existen** y Marea solo las usa:

| Pieza | Dónde | ¿Usa IA? | ¿Cobra? |
|---|---|---|---|
| Análisis de CV con % de cumplimiento (también automático al postular) | `backend/src/ia/` (`analizarCv`, `cumplimiento.js`, `colaAnalisis.js`) | Sí (Claude) | Sí, si hay `ANTHROPIC_API_KEY` (~USD 0,08 por CV) |
| Documentos en Google Drive | `backend/src/almacenamiento/` | No | No (cuota gratis de Google) |
| Reuniones con Google Meet (Google Calendar) | `backend/src/reuniones/` | No | No (cuota gratis de Google) |
| **Marea** | `backend/src/agente/` | **No** | **No** |

- Marea **lee** el análisis de CV ya guardado (tabla `analisis_cv`) y muestra su %. No vuelve a analizar.
- Al agendar con modalidad "Google Meet", Marea usa el mismo flujo del Planner (`backend/src/bd/planner.js`), que
  crea el evento en Google Calendar.
- **Un "agente real" para analizar CV ya existe:** es el análisis de CV con Claude. Si se quiere que Marea lo
  dispare, basta con que una herramienta llame a `analizarYGuardar` (`backend/src/ia/analisisPostulacion.js`).
  Eso sí tiene costo.
- **Sin cobros en ninguna parte:** no definir `ANTHROPIC_API_KEY` en `backend/.env` ni en Azure. La app oculta
  sola las opciones de IA y Marea sigue funcionando.
