/**
 * Perfiles FICTICIOS de los postulantes de ejemplo de la semilla (candidatos 201-208). Permiten
 * probar la búsqueda de Marea sin IA. Los postulantes reales del portal se procesan con Gemini.
 */
const h = (habilidad, evidencia, categoria = 'tecnica') => ({ habilidad, evidencia, categoria });

const PERFILES_DEMO = [
  {
    candidatoId: 201, ciudad: 'Puerto Montt', aniosExperiencia: 3,
    resumen: 'Técnico en procesos industriales con tres años en plantas de proceso de salmón.',
    formacion: [{ titulo: 'Técnico en Procesos Industriales', institucion: 'Instituto de ejemplo', nivel: 'Técnico superior', estado: 'Titulado' }],
    experiencia: [{ cargo: 'Operador de línea', empresa: 'Planta de ejemplo', rubro: 'Salmonicultura', desde: '2023', hasta: '2026', funciones: 'Control de línea de fileteo y registro de producción.' }],
    habilidades: [h('HACCP', 'Aplicó HACCP en línea de fileteo'), h('Excel intermedio', 'Planillas de control de producción', 'herramienta'), h('Innova', 'Registro de lotes en Innova', 'herramienta')],
  },
  {
    candidatoId: 202, ciudad: 'Calbuco', aniosExperiencia: 5,
    resumen: 'Monitora de producción con experiencia en turnos y control de calidad.',
    formacion: [{ titulo: 'Técnico en Alimentos', institucion: 'Instituto de ejemplo', nivel: 'Técnico superior', estado: 'Titulado' }],
    experiencia: [{ cargo: 'Monitora de producción', empresa: 'Planta de ejemplo', rubro: 'Salmonicultura', desde: '2021', hasta: '2026', funciones: 'Coordinación de equipos de turno y trazabilidad.' }],
    habilidades: [h('Control de calidad', 'Monitoreo de parámetros de planta'), h('Liderazgo', 'Coordinó equipos de turno', 'blanda'), h('Trazabilidad', 'Registro de lotes')],
  },
  {
    candidatoId: 203, ciudad: 'Puerto Natales', aniosExperiencia: 4,
    resumen: 'Técnico eléctrico con experiencia en mantención industrial.',
    formacion: [{ titulo: 'Técnico Eléctrico', institucion: 'Liceo de ejemplo', nivel: 'Técnico medio', estado: 'Titulado' }],
    experiencia: [{ cargo: 'Mantenedor eléctrico', empresa: 'Servicios de ejemplo', rubro: 'Mantención', desde: '2022', hasta: '2026', funciones: 'Mantención preventiva de tableros y motores.' }],
    habilidades: [h('Electricidad industrial', 'Mantención de tableros y motores'), h('Licencia SEC', 'Licencia SEC clase D', 'licencia'), h('Automatización', 'Programación básica de PLC')],
  },
  {
    candidatoId: 204, ciudad: 'Castro', aniosExperiencia: 6,
    resumen: 'Supervisora de centro de cultivo con foco en bienestar animal y seguridad.',
    formacion: [{ titulo: 'Técnico en Acuicultura', institucion: 'Instituto de ejemplo', nivel: 'Técnico superior', estado: 'Titulado' }],
    experiencia: [{ cargo: 'Asistente de centro', empresa: 'Cultivos de ejemplo', rubro: 'Salmonicultura', desde: '2020', hasta: '2026', funciones: 'Operación diaria de centro de mar y alimentación.' }],
    habilidades: [h('Acuicultura', 'Seis años en centros de mar'), h('Licencia clase B', 'Licencia vigente', 'licencia'), h('Liderazgo', 'A cargo de cuatro operarios', 'blanda')],
  },
  {
    candidatoId: 205, ciudad: 'Chonchi', aniosExperiencia: 2,
    resumen: 'Operario de centro de cultivo con credencial de patrón de nave menor.',
    formacion: [{ titulo: 'Enseñanza media completa', institucion: 'Liceo de ejemplo', nivel: 'Media', estado: 'Completa' }],
    experiencia: [{ cargo: 'Operario de centro', empresa: 'Cultivos de ejemplo', rubro: 'Salmonicultura', desde: '2024', hasta: '2026', funciones: 'Apoyo en cosecha y recambio de redes.' }],
    habilidades: [h('Patrón de nave menor', 'Credencial vigente', 'certificacion'), h('Cosecha', 'Apoyo en faenas de cosecha')],
  },
  {
    candidatoId: 206, ciudad: 'Puerto Montt', aniosExperiencia: 4,
    resumen: 'Ingeniera en control de gestión con experiencia en tableros e indicadores.',
    formacion: [{ titulo: 'Ingeniería en Control de Gestión', institucion: 'Universidad de ejemplo', nivel: 'Profesional', estado: 'Titulada' }],
    experiencia: [{ cargo: 'Analista de control de gestión', empresa: 'Empresa de ejemplo', rubro: 'Alimentos', desde: '2022', hasta: '2026', funciones: 'Construcción de indicadores y análisis de costos.' }],
    habilidades: [h('Power BI', 'Construyó tableros de indicadores de costos', 'herramienta'), h('SQL', 'Consultas para reportes', 'herramienta'), h('Excel avanzado', 'Modelos de costos', 'herramienta'), h('SAP', 'Uso diario de SAP', 'herramienta')],
    idiomas: [{ idioma: 'Inglés', nivel: 'intermedio' }],
  },
  {
    candidatoId: 207, ciudad: 'Puerto Varas', aniosExperiencia: 7,
    resumen: 'Operador de grúa horquilla con experiencia en bodega y despacho.',
    formacion: [{ titulo: 'Enseñanza media completa', institucion: 'Liceo de ejemplo', nivel: 'Media', estado: 'Completa' }],
    experiencia: [{ cargo: 'Gruero', empresa: 'Logística de ejemplo', rubro: 'Logística', desde: '2019', hasta: '2026', funciones: 'Carga y descarga de camiones y control de bodega.' }],
    habilidades: [h('Operador de grúa horquilla', 'Siete años como gruero', 'certificacion'), h('Licencia clase D', 'Licencia vigente', 'licencia'), h('Logística', 'Control de bodega')],
  },
  {
    candidatoId: 208, ciudad: 'Puerto Montt', aniosExperiencia: 3,
    resumen: 'Analista de sistemas con experiencia en reportería y bases de datos.',
    formacion: [{ titulo: 'Analista Programador', institucion: 'Instituto de ejemplo', nivel: 'Técnico superior', estado: 'Titulada' }],
    experiencia: [{ cargo: 'Analista de datos', empresa: 'Tecnología de ejemplo', rubro: 'Servicios', desde: '2023', hasta: '2026', funciones: 'Reportes para operaciones y soporte a usuarios.' }],
    habilidades: [h('Power BI', 'Reportes mensuales para operaciones', 'herramienta'), h('SQL', 'Modelado de bases de datos', 'herramienta'), h('Python', 'Automatización de reportes', 'herramienta')],
    idiomas: [{ idioma: 'Inglés', nivel: 'avanzado' }],
  },
];

module.exports = { PERFILES_DEMO };
