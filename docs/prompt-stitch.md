# Prompts para Google Stitch — Rediseño completo AquaChile · Gestión Psicolaboral

Cubre **todas las pantallas de la app**, desde el login: 13 prompts.

Cómo usarlos:
1. Crea un proyecto nuevo en Stitch, en modo **Web**.
2. Pega el **Prompt 1 (Login + sistema de diseño)**. Define los colores, la tipografía y los componentes de todo el proyecto.
3. En el **mismo proyecto**, pega los prompts 2 al 13 en orden, uno por vez. Cada uno empieza con *"Same AquaChile design system…"* para que Stitch mantenga el estilo.
4. Si alguna pantalla queda muy cargada, pídele en Stitch: *"More whitespace, fewer borders, simplify"*.

Los prompts están en inglés porque Stitch da resultados más consistentes así. Todo el texto visible de la interfaz ya está escrito en español.

---

## 1. Login + sistema de diseño (pegar primero)

```
Design system and first screen for "Gestión Psicolaboral", an internal HR web app (desktop 1440px) of AquaChile, a Chilean salmon-farming company. Recruitment analysts and occupational psychologists use it to manage psychological evaluations of job candidates. All UI copy in Spanish (Chile).

STYLE: modern, minimalist, professional, airy. Generous whitespace, few borders, soft shadows, clear hierarchy. Linear / Stripe Dashboard level of polish. Corporate, not playful. One primary action per screen.

COLORS (exact): primary slate #425563; dark slate #2E3D48 (sidebar, headings); deepest #24303A; accent orange #FE5000 used sparingly (active nav marker, highlights); background #F5F3F0; cards #FFFFFF; subtle fill #EEE9E4; borders #D7D2CB; muted text #6E6259. Status pills, soft tinted: Recomendado green, Recomendado con observaciones amber, No recomendado red, Pendiente gray, En proceso slate-blue, Finalizada green.

TYPE: Montserrat 600/700 for headings, Open Sans for body. Page title 28px, section 18px, body 14–15px, meta 12–13px.

COMPONENTS: cards 12px radius, 24px padding, very soft shadow; buttons 40px tall, 8px radius (primary solid #425563, secondary white with light border, ghost); inputs 40px with icon slots and slate focus ring; thin outline icons.

APP SHELL (used on every screen after login): fixed left sidebar 240px in #2E3D48 with white "AquaChile" logo, small muted "Gestión Psicolaboral", nav with outline icons: Dashboard, Solicitudes, Candidatos, Planner, Informes enviados (active = lighter background + 3px orange left bar); at the bottom user initials avatar, name, role chip and logout icon. Content max-width 1280px, 32px padding, page header = breadcrumb, title + one-line subtitle on the left, primary button on the right.

THIS SCREEN — LOGIN: split layout. Left 55%: full-height dark slate panel with a very subtle abstract water/wave pattern, white AquaChile logo, headline "Módulo de Evaluaciones Psicolaborales", subline "Reclutamiento y Selección · Gestión de Personas". Right 45%: #F5F3F0 background with a centered white card (max 400px): title "Iniciar sesión", subtitle "Ingresa con tu cuenta corporativa", field "Correo corporativo" (mail icon, placeholder usuario@aquachile.cl), field "Contraseña" (lock icon, show/hide eye), full-width primary button "Ingresar al sistema →", small footer text "Acceso restringido a personal autorizado de AquaChile."
```

## 2. Dashboard

```
Same AquaChile design system and left sidebar as the previous screen (active item: Dashboard; user "Carolina Muñoz", role chip "Analista").

DASHBOARD. Header: title "Dashboard", subtitle "Resumen del proceso de evaluación psicolaboral de AquaChile", primary button "+ Nueva solicitud".
- Row of 4 KPI cards (big number, small label, small icon in a soft tinted circle): "Solicitudes totales 108 · Histórico completo", "Pendientes 3 · Sin profesional asignado", "En proceso 5 · En evaluación", "Finalizadas 100 · 93% del total".
- Section header "Candidatos evaluados · 100 evaluaciones con resultado" with two compact filter selects on the right: "Mes: Todos", "Tipo de evaluación: Todas".
- Grid row 1: donut card "Categoría de candidatos evaluados" (Recomendado 63 · 63%, Recomendado con observaciones 23 · 23%, No recomendado 14 · 14%, center "100 evaluados", legend with values) | horizontal stacked bar card "Evaluados por familia de cargo", Interna in slate, Externa in orange: Profesional B C 22, Técnico B C 19, Supervisor B 14, Jefatura 13, Profesional A 13, Técnico A 13, Operario Calificado 6.
- Grid row 2: stacked column chart "Evaluados por mes" from abr 2025 to abr 2026 (2/3 width) | gauge card "Promedio de timing: 6,5 días hábiles" with caption "Desde la solicitud hasta el envío del informe" (1/3).
- Grid row 3: ranking card "Evaluados por reclutador" with thin progress bars (Carolina Muñoz 23, Macarena Vidal 23, Javiera Soto 20, Fernanda Rojas 18, Daniela Contreras 16) | table card "Solicitudes recientes" with link "Ver todas" (Candidato, Cargo, Fecha, Estado): Constanza Vera Millán · Analista de Control de Gestión · 12-10-2026 · Pendiente; Tomás Barrientos Leal · Operador Grúa Horquilla · 09-10-2026 · Pendiente; Valentina Ríos Ojeda · Monitor Producción · 07-10-2026 · Pendiente; Matías Gallardo Pinto · Prevencionista de Riesgos · 05-10-2026 · En proceso; Francisca Oyarzún Díaz · Supervisor Centro de Cultivo · 02-10-2026 · En proceso.
```

## 3. Solicitudes (listado)

```
Same AquaChile design system and left sidebar (active: Solicitudes).

SOLICITUDES list. Header: title "Solicitudes", subtitle "108 solicitudes registradas", primary button "+ Nueva solicitud".
- Status tabs with counts above the table: "Todas 108", "Pendientes 3", "En proceso 5", "Finalizadas 100".
- One-line filter toolbar: search input "Buscar candidato, cargo o profesional", select "Estado", select "Familia", ghost button "Limpiar". Small muted text "Mostrando 108 de 108 solicitudes".
- Clean table, 56px rows, no vertical lines, light header: N°, Candidato (initials avatar + name), Cargo, Familia (subtle tag), Fecha, Estado (pill), Profesional (small avatar + name or "Sin asignar" in muted italic), and a "Gestionar" ghost button with chevron at the end of the row.
- Rows: 1 Jorge Alvarado Uribe · Coordinador Servicios Generales · Profesional B C · 25-04-2025 · Finalizada · Daniela Contreras; 2 Manuel González Cárcamo · Líder Desarrollo Producción · Profesional A · 11-04-2025 · Finalizada · Daniela Contreras; 3 Catalina Sepúlveda Alvarado · Monitor Producción · Técnico B C · 23-04-2025 · Finalizada · Carolina Muñoz; 4 Héctor Cárcamo Pizarro · Jefe de Centro · Jefatura · 09-04-2025 · Finalizada · Javiera Soto; 5 Constanza Vera Millán · Analista de Control de Gestión · Profesional B C · 12-10-2026 · Pendiente · Sin asignar; 6 Matías Gallardo Pinto · Prevencionista de Riesgos · Profesional B C · 05-10-2026 · En proceso · Fernanda Rojas.
- Pagination at the bottom: "1–15 de 108".
```

## 4. Nueva solicitud (formulario)

```
Same AquaChile design system and left sidebar (active: Solicitudes).

NUEVA SOLICITUD form. Breadcrumb "Solicitudes / Nueva solicitud". Title "Solicitud de evaluación psicolaboral", subtitle "Los campos marcados con * son obligatorios".
Centered single column, max 760px, split into white section cards with small uppercase section labels and generous spacing:
1. "Reclutador/a": radio group shown as selectable chips: Carolina Muñoz, Daniela Contreras, Fernanda Rojas, Javiera Soto, Macarena Vidal.
2. "Candidato/a": Nombre del candidato/a *, Correo del candidato/a *, Teléfono del candidato/a * (placeholder +56912345678) in a 2-column grid; "Origen del candidato/a" segmented control Interno / Externo; "¿El candidato/a es referido/a?" segmented Sí / No.
3. "Cargo": Nombre del cargo * (searchable select), Familia del cargo * (select, helper "Completada según el cargo seleccionado"), Ubicación del cargo * (select, e.g. Planta Magallanes · Industrial), CECO * (placeholder A170010311), "¿Requiere referencias?" segmented Sí / No.
4. "Antecedentes": drag-and-drop zone "Adjuntar CV" (hint "Word, Excel, PPT, PDF, imagen, video o audio · máx. 10 MB"), read-only file chip "Descriptor de cargo" with helper "Asociado automáticamente al cargo", textarea "Aspectos a indagar" (placeholder "Funciones del cargo, si es confidencial para el candidato, énfasis en alguna competencia, indagar en liderazgo, etc.").
Sticky bottom action bar: ghost "Cancelar", primary "Enviar solicitud".
```

## 5. Detalle de solicitud (vista analista)

```
Same AquaChile design system and left sidebar (active: Solicitudes; user Carolina Muñoz, Analista).

SOLICITUD DETAIL, analyst view. Breadcrumb "Solicitudes / Solicitud #1". Header: initials avatar + "Jorge Alvarado Uribe", meta line "Coordinador Servicios Generales · Profesional B C · 25-04-2025", status pill "Finalizada", secondary button "Ver informe oficial".
Two columns (2/3 + 1/3):
LEFT
- Card "Datos del candidato" as a clean two-column definition list: Correo jorge.alvarado@correo.cl, Teléfono +56910007919, Cargo Coordinador Servicios Generales, Familia Profesional B C, Origen Interno.
- Card "Datos de la solicitud": Ubicación Planta Magallanes · Industrial, CECO —, Requiere referencias No, CV —, Descriptor de cargo as a file chip "DC_Coordinador_Servicios_Generales.pdf", and "Aspectos a indagar" as a soft quoted block: "Énfasis en orientación a resultados y trabajo colaborativo."
- Card "Evaluación psicolaboral" with status pill "Realizada": highlighted verdict panel in soft amber "Dictamen: Recomendado con observaciones", "Fecha de informe 02-05-2025", and a small muted lock note "Las notas clínicas y la pauta de entrevista son confidenciales del profesional evaluador."
RIGHT (sticky)
- Card "Gestión de la solicitud": select "Estado" (Pendiente / En proceso / Finalizada), select "Profesional responsable" (Sin asignar, Carolina Muñoz, Daniela Contreras, Fernanda Rojas, Javiera Soto, Macarena Vidal), helper with check icon "Los cambios se guardan automáticamente".
- Card "Seguimiento": vertical timeline Evaluación recibida → Entrevista agendada → Entrevista realizada → Informe enviado, each with a date.
```

## 6. Detalle de solicitud (vista psicóloga, registrar evaluación)

```
Same AquaChile design system and left sidebar (active: Solicitudes; user "María Victoria Bustamante", role chip "Evaluadora").

SOLICITUD DETAIL, evaluator view, for a request still in progress. Breadcrumb "Solicitudes / Solicitud #105". Header: "Francisca Oyarzún Díaz", meta "Supervisor Centro de Cultivo · Supervisor B · 02-10-2026", status pill "En proceso".
Same left cards as the analyst view (Datos del candidato, Datos de la solicitud) but the right column shows a read-only summary of "Gestión de la solicitud".
Main highlight: card "Registrar evaluación psicolaboral" with:
- Date picker "Fecha de evaluación *".
- "Resultado *" as three large selectable option cards side by side, each with icon and soft color: "Recomendado" (green), "Recomendado con observaciones" (amber), "No recomendado" (red); one selected state shown.
- Textarea "Observaciones *" (placeholder "Conclusiones de la evaluación"), 5 rows, with a small lock note "Visible solo para el equipo de psicólogos".
- Footer right: primary button "Registrar evaluación".
```

## 7. Informe psicolaboral (imprimible)

```
Same AquaChile design system, without the sidebar (print preview).

INFORME PSICOLABORAL printable page. Gray #EEE9E4 background, top toolbar outside the sheet with ghost button "← Volver al detalle" and primary button "Imprimir / Guardar en PDF". Centered white A4 sheet with lots of whitespace:
- Header band in dark slate: white AquaChile logo, title "Informe Psicolaboral", subline "Gestión de Personas · Reclutamiento y Selección", document number "Solicitud N° 1" and date on the right.
- "1. Antecedentes del candidato/a": two-column grid with Nombre completo, Cargo postulado, Familia de cargo, Origen, Correo de contacto, Teléfono.
- "2. Antecedentes de la solicitud": Fecha de solicitud, Reclutador/a solicitante, Ubicación / Planta, Centro de Costo (CECO).
- "3. Síntesis de evaluación y competencias": short paragraph plus a small badge "Evaluación por Competencias Certificada".
- "4. Dictamen oficial": large bordered verdict box "RECOMENDADO CON OBSERVACIONES" in amber tones.
- Two signature blocks at the bottom: "María Victoria Bustamante · Psicóloga Evaluadora · Psicología Laboral" and "Dirección de Personas · Gestión del Talento".
- Footer: "Documento confidencial — uso exclusivo de Gestión de Personas AquaChile".
Section titles small uppercase in slate with a thin rule underneath. Formal and clean.
```

## 8. Candidatos (listado)

```
Same AquaChile design system and left sidebar (active: Candidatos).

CANDIDATOS list. Header: title "Candidatos", subtitle "Registro de postulantes de AquaChile · 108 registrados", primary button "+ Nuevo candidato".
Toolbar: search "Buscar por nombre, correo o cargo" and select "Familia".
Table, 56px rows, roomy: # | Candidato (initials avatar, name, email below in muted text) | Teléfono | Cargo | Familia (subtle tag) | actions "⋯" menu with "Editar" and "Eliminar" (Eliminar in red inside the menu, never as a visible button on the row).
Rows: Jorge Alvarado Uribe · jorge.alvarado@correo.cl · +56910007919 · Coordinador Servicios Generales · Profesional B C; Manuel González Cárcamo · manuel.gonzalez@correo.cl · +56910015838 · Líder Desarrollo Producción · Profesional A; Catalina Sepúlveda Alvarado · catalina.sepulveda@correo.cl · +56910023757 · Monitor Producción · Técnico B C; Héctor Cárcamo Pizarro · hector.carcamo@correo.cl · +56910031676 · Jefe de Centro · Jefatura; Pedro Mansilla Contreras · pedro.mansilla@correo.cl · +56910039595 · Jefe Área Piscicultura · Jefatura.
Pagination "1–15 de 108".
Also show a small centered confirmation dialog example on the side: "¿Eliminar candidato?" with text "Esta acción no se puede deshacer" and buttons "Cancelar" / "Eliminar" (red).
```

## 9. Nuevo / editar candidato

```
Same AquaChile design system and left sidebar (active: Candidatos).

NUEVO CANDIDATO form. Breadcrumb "Candidatos / Nuevo candidato". Title "Registrar candidato", subtitle "Los campos marcados con * son obligatorios".
Single centered white card, max 640px, generous spacing, two-column grid:
- Nombre completo * (placeholder "Ej: María González")
- Correo electrónico * (placeholder nombre@dominio.cl, mail icon)
- Teléfono * (placeholder +56912345678, phone icon)
- Cargo * (placeholder "Ej: Técnico de Planta")
- Familia de cargo * (select "Seleccione una familia": Operario, Operario Calificado, Operario Calificado AM, Administrativo, Técnico B C, Técnico A, Profesional B C, Profesional A, Supervisor B, Supervisor A, Jefatura)
Show one field in an error state with a red helper message, inside a soft red alert at the top "Revisa los datos del formulario".
Footer actions aligned right: ghost "Cancelar", primary "Registrar candidato". (The edit version uses the title "Editar candidato" and the button "Guardar cambios".)
```

## 10. Planner de evaluaciones (kanban)

```
Same AquaChile design system and left sidebar (active: Planner; user "María Victoria Bustamante", role chip "Evaluadora").

PLANNER kanban. Header: title "Planner de evaluaciones", subtitle "Seguimiento de cada solicitud desde que se recibe hasta el envío del informe psicolaboral", secondary button "Informes enviados →".
Toolbar: search "Candidato, cargo o familia", select "Todos los reclutadores".
Four columns on a soft #EEE9E4 board, each with icon, title and count badge, scrolling independently:
1. "Evaluación recibida" (3): cards Valentina Ríos Ojeda #101 · Monitor Producción · Técnico B C; Tomás Barrientos Leal #102 · Operador Grúa Horquilla · Operario Calificado; Constanza Vera Millán #103 · Analista de Control de Gestión · Profesional B C. Each card shows a muted line "Entrevista por coordinar", a soft orange warning "Recibida hace 8 días", recruiter avatar, and a small primary button "Agendar".
2. "Entrevista agendada" (2): Ignacio Paredes Soto #104 and Francisca Oyarzún Díaz #105, with a tag "14-10 · 10:30 · Teams", icon buttons "Reagendar" and "Volver a etapa anterior", and a button "Realizada".
3. "Entrevista realizada" (3): Antonia Cárdenas Vidal #107, Benjamín Navarro Uribe #108, with the line "Pendiente: registrar evaluación e informe" and a primary button "Registrar informe".
4. "Informe enviado" (100): compact cards with verdict pill (Recomendado / Recomendado con observaciones / No recomendado) and "Informe enviado el 06-04-2026", plus a link "Ver los 100 informes →" at the bottom.
Cards: white, 12px radius, roomy, name semibold, cargo · familia muted, small "#ID" top right, recruiter avatar + name in the footer.
```

## 11. Ventana "Agendar entrevista" (modal)

```
Same AquaChile design system. Show the PLANNER screen dimmed in the background with a centered modal on top.

MODAL "Agendar entrevista" (max 480px, 16px radius): subtitle with candidate "Valentina Ríos Ojeda · Monitor Producción", close icon top right.
Fields: date picker "Fecha de la entrevista", time picker "Hora", "Modalidad" as a segmented control with icons: Teams / Presencial / Telefónica.
Footer: secondary "Cancelar", primary "Agendar". (The reschedule version uses the title "Reagendar entrevista" and the button "Guardar cambios".)
```

## 12. Informes enviados

```
Same AquaChile design system and left sidebar (active: Informes enviados).

INFORMES ENVIADOS. Breadcrumb "Planner / Informes enviados". Title "Informes enviados", subtitle "100 evaluaciones finalizadas con su informe psicolaboral enviado al analista", secondary button "← Volver al Planner".
- Three clickable summary cards that work as filters, with soft colored icon and left accent: Recomendado 63 (green), Recomendado con observaciones 23 (amber), No recomendado 14 (red).
- Toolbar: search "Candidato, cargo, ubicación o N°", selects "Resultado: Todos", "Reclutador/a: Todos", "Ordenar: Más recientes". Muted text "Mostrando 1–12 de 100 informes".
- Grid of report cards, 4 per row, roomy: name + "#ID", cargo · familia, pin icon + location ("Planta Magallanes", "Planta Calbuco", "Oficina Central"), verdict pill, two meta lines "Informe enviado 06-04-2026" and "Tiempo: 7 días hábiles", footer with recruiter avatar + name and icon buttons "Ver informe" and "Imprimir".
Sample cards: Víctor Pérez Navarro #99 · Gruero · Operario Calificado · No recomendado; Natalia Sepúlveda Flores #100 · Asistente Bodega Planta · Técnico B C · Recomendado; Felipe Sepúlveda López #98 · Jefe de SSO · Jefatura · Recomendado; Paulina Araya Soto #97 · Jefe de Centro · Jefatura · Recomendado con observaciones.
- Pagination at the bottom.
```

## 13. Página no encontrada (404)

```
Same AquaChile design system and left sidebar (no active item).

404 PAGE. Centered, very minimal: a large light "404" in Montserrat in #D7D2CB, a simple line illustration of a fish or wave in slate with an orange accent, title "Página no encontrada", text "La ruta solicitada no existe en la aplicación.", primary button "Volver al dashboard". Lots of empty space.
```
