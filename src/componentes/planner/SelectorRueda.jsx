import { useEffect, useRef } from 'react';
import { MESES, componerFecha, componerHora, descomponerFecha, descomponerHora, textoFecha } from '../../dominio/fechaHora';
import { hoyIso } from '../../dominio/planner';

/** Alto de cada opción y cantidad de opciones visibles a la vez (debe ser impar). */
const ALTO = 36;
const VISIBLES = 5;
/** Distancia de rueda que equivale a un paso (evita saltar varias opciones con trackpad). */
const UMBRAL_RUEDA = 40;
/** Tiempo sin moverse la rueda para considerar que el usuario terminó de desplazarla. */
const PAUSA_DESPLAZAMIENTO = 120;

const indiceDe = (opciones, valor) => Math.max(0, opciones.findIndex((opcion) => opcion.valor === valor));

/**
 * Columna de rueda (estilo selector de hora del iPhone). Se desplaza con la rueda del mouse,
 * con las flechas del teclado, arrastrando o haciendo clic en una opción.
 */
function RuedaColumna({ etiqueta, opciones, valor, alCambiar, pendiente = false, refInicial }) {
  const refLista = useRef(null);
  const indice = indiceDe(opciones, valor);
  const indiceRef = useRef(indice);
  indiceRef.current = indice;
  const opcionesRef = useRef(opciones);
  opcionesRef.current = opciones;
  const alCambiarRef = useRef(alCambiar);
  alCambiarRef.current = alCambiar;
  const montado = useRef(false);
  const acumuladoRueda = useRef(0);
  const desplazandoSolo = useRef(false);
  const temporizadorSolo = useRef(null);

  const irA = (nuevoIndice) => {
    const limite = opcionesRef.current.length - 1;
    const seguro = Math.min(Math.max(nuevoIndice, 0), limite);
    alCambiarRef.current(opcionesRef.current[seguro].valor);
  };

  // Sincroniza la posición de la lista cuando el valor cambia desde fuera (clic, teclado o rueda).
  // Al montar se posiciona de inmediato; después se anima. Mientras la lista se mueve sola,
  // los eventos de desplazamiento no cambian el valor.
  useEffect(() => {
    const elemento = refLista.current;
    if (!elemento) return;
    const destino = indice * ALTO;
    desplazandoSolo.current = true;
    clearTimeout(temporizadorSolo.current);
    temporizadorSolo.current = setTimeout(() => {
      desplazandoSolo.current = false;
    }, 500);
    if (!montado.current || typeof elemento.scrollTo !== 'function') {
      elemento.scrollTop = destino;
    } else {
      elemento.scrollTo({ top: destino, behavior: 'smooth' });
    }
    montado.current = true;
  }, [indice, valor]);

  // Al terminar de arrastrar la lista, se toma la opción más cercana al centro.
  useEffect(() => {
    const elemento = refLista.current;
    if (!elemento) return undefined;
    let pausa = null;
    const alDesplazar = () => {
      if (desplazandoSolo.current) return;
      clearTimeout(pausa);
      pausa = setTimeout(() => {
        const cercano = Math.round(elemento.scrollTop / ALTO);
        if (cercano !== indiceRef.current) irA(cercano);
      }, PAUSA_DESPLAZAMIENTO);
    };
    elemento.addEventListener('scroll', alDesplazar, { passive: true });
    return () => {
      clearTimeout(pausa);
      clearTimeout(temporizadorSolo.current);
      elemento.removeEventListener('scroll', alDesplazar);
    };
  }, []);

  // La rueda del mouse avanza una opción por cada paso, en vez de un desplazamiento libre.
  useEffect(() => {
    const elemento = refLista.current;
    if (!elemento) return undefined;
    const alRueda = (evento) => {
      evento.preventDefault();
      acumuladoRueda.current += evento.deltaY;
      if (Math.abs(acumuladoRueda.current) < UMBRAL_RUEDA) return;
      const paso = Math.sign(acumuladoRueda.current);
      acumuladoRueda.current = 0;
      irA(indiceRef.current + paso);
    };
    elemento.addEventListener('wheel', alRueda, { passive: false });
    return () => elemento.removeEventListener('wheel', alRueda);
  }, []);

  const alTeclear = (evento) => {
    const saltos = { ArrowDown: 1, ArrowUp: -1, PageDown: 3, PageUp: -3 };
    if (saltos[evento.key]) {
      evento.preventDefault();
      irA(indiceRef.current + saltos[evento.key]);
    } else if (evento.key === 'Home') {
      evento.preventDefault();
      irA(0);
    } else if (evento.key === 'End') {
      evento.preventDefault();
      irA(opcionesRef.current.length - 1);
    }
  };

  const margen = ALTO * ((VISIBLES - 1) / 2);

  return (
    <div className={`selector-rueda ${pendiente ? 'selector-rueda-pendiente' : ''}`.trim()}>
      <div
        ref={(elemento) => {
          refLista.current = elemento;
          if (refInicial) refInicial.current = elemento;
        }}
        className="selector-rueda-lista"
        role="listbox"
        tabIndex={0}
        aria-label={etiqueta}
        style={{ height: ALTO * VISIBLES, paddingTop: margen, paddingBottom: margen }}
        onKeyDown={alTeclear}
      >
        {opciones.map((opcion, posicion) => {
          const seleccionada = posicion === indice;
          return (
            <div
              key={opcion.valor}
              role="option"
              aria-selected={seleccionada}
              className={`selector-rueda-opcion ${seleccionada ? 'selector-rueda-activa' : ''}`.trim()}
              style={{ height: ALTO, lineHeight: `${ALTO}px` }}
              onClick={() => irA(posicion)}
            >
              {opcion.texto}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const rango = (desde, hasta) => Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

/**
 * Selector de fecha con tres ruedas: día, mes y año. Si todavía no hay fecha elegida,
 * las ruedas muestran la fecha de hoy y el resumen indica que falta elegirla.
 */
export function SelectorFecha({ valor, onChange, anioMinimo, anioMaximo, refInicial, etiqueta = 'Fecha de la entrevista' }) {
  const hoy = descomponerFecha(hoyIso());
  const actual = descomponerFecha(valor) ?? hoy;
  const anioInicial = Math.min(anioMinimo ?? hoy.anio - 1, actual.anio);
  const anioFinal = Math.max(anioMaximo ?? hoy.anio + 1, actual.anio);

  const dias = rango(1, new Date(actual.anio, actual.mes, 0).getDate()).map((n) => ({ valor: n, texto: String(n) }));
  const meses = MESES.map((nombre, indice) => ({ valor: indice + 1, texto: nombre }));
  const anios = rango(anioInicial, anioFinal).map((n) => ({ valor: n, texto: String(n) }));

  const cambiar = (cambio) => onChange(componerFecha({ ...actual, ...cambio }));

  return (
    <div role="group" aria-label={etiqueta}>
      <div className="selector-rueda-grupo">
        <RuedaColumna
          etiqueta="Día"
          opciones={dias}
          valor={actual.dia}
          pendiente={!valor}
          refInicial={refInicial}
          alCambiar={(dia) => cambiar({ dia })}
        />
        <RuedaColumna
          etiqueta="Mes"
          opciones={meses}
          valor={actual.mes}
          pendiente={!valor}
          alCambiar={(mes) => cambiar({ mes })}
        />
        <RuedaColumna
          etiqueta="Año"
          opciones={anios}
          valor={actual.anio}
          pendiente={!valor}
          alCambiar={(anio) => cambiar({ anio })}
        />
      </div>
      <p className="selector-resumen small mb-0 mt-2">{valor ? textoFecha(valor) : 'Elija día, mes y año'}</p>
    </div>
  );
}

/**
 * Selector de hora con dos ruedas (hora y minuto). Solo ofrece el horario de entrevistas
 * (08:00 a 20:00), así no se puede elegir una hora que la validación rechazaría.
 */
const HORA_MINIMA = 8;
const HORA_MAXIMA = 20;
const HORAS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const PERIODOS = [
  { valor: 'AM', texto: 'AM' },
  { valor: 'PM', texto: 'PM' },
];

/** Convierte hora de 12 h + periodo a 24 h, sin limitar al rango de la entrevista. */
function aHora24(hora12, periodo) {
  return (hora12 % 12) + (periodo === 'PM' ? 12 : 0);
}

/** Horas de 12 h que caen dentro del rango 08:00–20:00 para el periodo indicado. */
function horasDelPeriodo(periodo) {
  return HORAS_12.filter((hora12) => {
    const hora24 = aHora24(hora12, periodo);
    return hora24 >= HORA_MINIMA && hora24 <= HORA_MAXIMA;
  });
}

function ajustarHora(hora24) {
  return Math.min(Math.max(hora24, HORA_MINIMA), HORA_MAXIMA);
}

export function SelectorHora({ valor, onChange, etiqueta = 'Hora de la entrevista' }) {
  const actual = descomponerHora(valor) ?? { hora: 9, minuto: 0 };
  const hora12 = actual.hora % 12 === 0 ? 12 : actual.hora % 12;
  const periodo = actual.hora < 12 ? 'AM' : 'PM';

  const horas = horasDelPeriodo(periodo).map((n) => ({ valor: n, texto: String(n).padStart(2, '0') }));
  const minutos = rango(0, actual.hora === 20 ? 0 : 59).map((n) => ({ valor: n, texto: String(n).padStart(2, '0') }));

  const cambiar = (cambio) => onChange(componerHora({ ...actual, ...cambio }));

  const cambiarHoraEn = (nuevaHora12, nuevoPeriodo) => {
    const hora = ajustarHora(aHora24(nuevaHora12, nuevoPeriodo));
    cambiar({ hora, minuto: hora === HORA_MAXIMA ? 0 : actual.minuto });
  };

  return (
    <div role="group" aria-label={etiqueta}>
      <div className="selector-rueda-grupo selector-rueda-grupo-hora">
        <RuedaColumna
          etiqueta="Hora"
          opciones={horas}
          valor={hora12}
          pendiente={!valor}
          alCambiar={(nuevaHora12) => cambiarHoraEn(nuevaHora12, periodo)}
        />
        <RuedaColumna
          etiqueta="Minuto"
          opciones={minutos}
          valor={minutos.some((opcion) => opcion.valor === actual.minuto) ? actual.minuto : 0}
          pendiente={!valor}
          alCambiar={(minuto) => cambiar({ minuto })}
        />
        <RuedaColumna
          etiqueta="AM o PM"
          opciones={PERIODOS}
          valor={periodo}
          pendiente={!valor}
          alCambiar={(nuevoPeriodo) => cambiarHoraEn(hora12, nuevoPeriodo)}
        />
      </div>
      <p className="selector-resumen small mb-0 mt-2">
        {valor
          ? `${String(hora12).padStart(2, '0')}:${String(actual.minuto).padStart(2, '0')} ${periodo}`
          : 'Elija hora, minuto y AM/PM'}
      </p>
    </div>
  );
}
