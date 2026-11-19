/**
 * Horas libres para la entrevista psicolaboral (reglas de agenda de Marea, docs/marea/marea-cerebro.md):
 *
 * - Bloques de 45 min: 09:00, 10:00, 11:00, 12:00, 14:30, 15:30 y 16:30, de lunes a viernes.
 * - Hoy solo valen los bloques que empiezan al menos 30 min después de ahora.
 * - Un bloque está ocupado si se cruza con otra entrevista agendada de la psicóloga.
 * - Si un día no tiene bloques libres se pasa al siguiente día hábil, hasta 15 días.
 *
 * Lógica pura: recibe la hora actual y las entrevistas ya agendadas. Las fechas y horas son las
 * de Chile (el servidor en Azure corre en UTC).
 */

const BLOQUES = ['09:00', '10:00', '11:00', '12:00', '14:30', '15:30', '16:30'];
const DURACION_MIN = 45;
const MARGEN_MIN = 30;
const DIAS_MAXIMOS = 15;
const ZONA = 'America/Santiago';

const minutos = (hora) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

/** Fecha (yyyy-mm-dd) y minutos del día de `fecha` en la hora de Chile. */
function ahoraEnChile(fecha = new Date()) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(fecha)
      .map(({ type, value }) => [type, value]),
  );
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, minutos: Number(partes.hour) * 60 + Number(partes.minute) };
}

/** Suma días a una fecha yyyy-mm-dd (sin depender de la zona horaria del servidor). */
function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const esDiaHabil = (fecha) => {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return dia >= 1 && dia <= 5;
};

/** El bloque [hora, hora + 45) se cruza con alguna entrevista de ese día. */
const ocupado = (hora, entrevistasDelDia) =>
  entrevistasDelDia.some((otra) => Math.abs(minutos(otra) - minutos(hora)) < DURACION_MIN);

/**
 * Primer día hábil con horas libres, desde hoy (o desde `desde`, yyyy-mm-dd).
 * @param {{ ahora?: Date, ocupadas?: Array<{ fecha: string, hora: string }>, desde?: string }} opciones
 * @returns {{ fecha: string, bloques: Array<{ hora: string, primera: boolean }> } | null}
 */
function horasLibres({ ahora = new Date(), ocupadas = [], desde = '' } = {}) {
  const hoy = ahoraEnChile(ahora);
  let fecha = desde && desde > hoy.fecha ? desde : hoy.fecha;

  for (let i = 0; i < DIAS_MAXIMOS; i += 1, fecha = sumarDias(fecha, 1)) {
    if (!esDiaHabil(fecha)) continue;
    const delDia = ocupadas.filter((entrevista) => entrevista.fecha === fecha).map((entrevista) => entrevista.hora);
    const libres = BLOQUES.filter(
      (hora) => (fecha !== hoy.fecha || minutos(hora) >= hoy.minutos + MARGEN_MIN) && !ocupado(hora, delDia),
    );
    if (libres.length) return { fecha, bloques: libres.map((hora, indice) => ({ hora, primera: indice === 0 })) };
  }
  return null;
}

/** Si una hora concreta sigue libre (se revisa de nuevo al confirmar). */
function horaDisponible({ fecha, hora, ahora = new Date(), ocupadas = [] }) {
  const libre = horasLibres({ ahora, ocupadas, desde: fecha });
  return Boolean(libre && libre.fecha === fecha && libre.bloques.some((bloque) => bloque.hora === hora));
}

module.exports = { BLOQUES, DIAS_MAXIMOS, DURACION_MIN, ahoraEnChile, horaDisponible, horasLibres, sumarDias };
