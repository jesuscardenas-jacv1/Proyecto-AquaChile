import { useRef, useState } from 'react';

/**
 * Colores de los gráficos (validados para daltonismo y contraste sobre fondo blanco).
 * El azul es una variante saturada del azul corporativo: el Pantone 7545 C se lee gris
 * como color de datos. El naranjo es el acento corporativo (Pantone 021 C).
 */
export const COLORES_TIPO = { externa: '#0B6A9A', interna: '#FE5000' };

export const COLORES_CATEGORIA = {
  Recomendado: '#0B6A9A',
  'Recomendado con observaciones': '#00A396',
  'No recomendado': '#FE5000',
};

const COLOR_PISTA = '#E3ECF1';
const COLOR_GRILLA = '#E9E4DF';

const formatoNumero = (valor) => valor.toLocaleString('es-CL');

/** Calcula un máximo "redondo" para el eje (1, 2 o 5 × 10^n) y sus marcas. */
function escalaEje(maximo, marcas = 4) {
  if (maximo <= 0) return { tope: 1, valores: [0, 1] };
  const pasoBruto = maximo / marcas;
  const magnitud = 10 ** Math.floor(Math.log10(pasoBruto));
  const paso = [1, 2, 5, 10].map((m) => m * magnitud).find((p) => p >= pasoBruto);
  const tope = Math.ceil(maximo / paso) * paso;
  const valores = [];
  for (let valor = 0; valor <= tope; valor += paso) valores.push(valor);
  return { tope, valores };
}

/** Tooltip que sigue al puntero dentro del contenedor del gráfico. */
function useTooltip() {
  const contenedor = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const mostrar = (evento, contenido) => {
    const caja = contenedor.current?.getBoundingClientRect();
    if (!caja) return;
    const origen =
      evento.clientX === undefined ? evento.currentTarget.getBoundingClientRect() : null;
    setTooltip({
      x: (origen ? origen.left + origen.width / 2 : evento.clientX) - caja.left,
      y: (origen ? origen.top : evento.clientY) - caja.top,
      ancho: caja.width,
      contenido,
    });
  };

  const eventos = (contenido) => ({
    onMouseEnter: (evento) => mostrar(evento, contenido),
    onMouseMove: (evento) => mostrar(evento, contenido),
    onMouseLeave: () => setTooltip(null),
    onFocus: (evento) => mostrar(evento, contenido),
    onBlur: () => setTooltip(null),
  });

  const elemento = tooltip ? (
    <div
      className="grafico-tooltip"
      role="presentation"
      style={{
        left: Math.min(Math.max(tooltip.x, 80), tooltip.ancho - 80),
        top: tooltip.y,
      }}
    >
      {tooltip.contenido}
    </div>
  ) : null;

  return { contenedor, eventos, elemento };
}

function FilaTooltip({ color, etiqueta, valor }) {
  return (
    <div className="d-flex align-items-center gap-2">
      {color ? <span className="grafico-muestra" style={{ background: color }} /> : null}
      <span className="flex-grow-1">{etiqueta}</span>
      <strong>{valor}</strong>
    </div>
  );
}

/** Leyenda con muestras de color; el texto siempre usa colores de texto. */
export function Leyenda({ elementos, titulo }) {
  return (
    <div className="d-flex flex-wrap align-items-center gap-3 small text-secondary">
      {titulo ? <span className="fw-semibold">{titulo}</span> : null}
      {elementos.map(({ etiqueta, color }) => (
        <span key={etiqueta} className="d-inline-flex align-items-center gap-1">
          <span className="grafico-muestra" style={{ background: color }} aria-hidden="true" />
          {etiqueta}
        </span>
      ))}
    </div>
  );
}

/** Tabla oculta visualmente con los datos del gráfico (para lectores de pantalla). */
function TablaAccesible({ titulo, columnas, filas }) {
  return (
    <table className="visually-hidden">
      <caption>{titulo}</caption>
      <thead>
        <tr>
          {columnas.map((columna) => (
            <th key={columna} scope="col">
              {columna}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila[0]}>
            {fila.map((celda, indice) => (
              <td key={`${fila[0]}-${columnas[indice]}`}>{celda}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const SinDatos = () => (
  <p className="text-secondary small mb-0 py-4 text-center">
    Sin evaluaciones para los filtros seleccionados.
  </p>
);

/** Gráfico de dona: proporción de candidatos/as por categoría del resultado. */
export function GraficoDona({ titulo, datos, colores }) {
  const { contenedor, eventos, elemento } = useTooltip();
  const total = datos.reduce((suma, dato) => suma + dato.total, 0);
  if (total === 0) return <SinDatos />;

  const radio = 80;
  const grosor = 30;
  const centro = 100;
  let angulo = -Math.PI / 2;
  const punto = (a, r) => [centro + r * Math.cos(a), centro + r * Math.sin(a)];

  const segmentos = datos
    .filter((dato) => dato.total > 0)
    .map((dato) => {
      const barrido = (dato.total / total) * Math.PI * 2;
      const inicio = angulo;
      angulo += barrido;
      const fin = angulo;
      if (barrido >= Math.PI * 2 - 0.0001) {
        return { dato, ruta: null };
      }
      const exterior = radio;
      const interior = radio - grosor;
      const grande = barrido > Math.PI ? 1 : 0;
      const [x1, y1] = punto(inicio, exterior);
      const [x2, y2] = punto(fin, exterior);
      const [x3, y3] = punto(fin, interior);
      const [x4, y4] = punto(inicio, interior);
      return {
        dato,
        ruta: `M${x1} ${y1} A${exterior} ${exterior} 0 ${grande} 1 ${x2} ${y2} L${x3} ${y3} A${interior} ${interior} 0 ${grande} 0 ${x4} ${y4} Z`,
      };
    });

  return (
    <div ref={contenedor} className="position-relative">
      <div className="d-flex flex-column flex-sm-row align-items-center gap-4">
        <svg viewBox="0 0 200 200" className="grafico-dona" aria-hidden="true">
          {segmentos.map(({ dato, ruta }) => {
            const contenido = (
              <FilaTooltip
                color={colores[dato.etiqueta]}
                etiqueta={dato.etiqueta}
                valor={`${formatoNumero(dato.total)} (${dato.porcentaje}%)`}
              />
            );
            return ruta ? (
              <path
                key={dato.etiqueta}
                d={ruta}
                fill={colores[dato.etiqueta]}
                stroke="#fff"
                strokeWidth={2}
                {...eventos(contenido)}
              />
            ) : (
              <circle
                key={dato.etiqueta}
                cx={centro}
                cy={centro}
                r={radio - grosor / 2}
                fill="none"
                stroke={colores[dato.etiqueta]}
                strokeWidth={grosor}
                {...eventos(contenido)}
              />
            );
          })}
          <text x={centro} y={centro - 2} textAnchor="middle" className="grafico-dona-total">
            {formatoNumero(total)}
          </text>
          <text x={centro} y={centro + 18} textAnchor="middle" className="grafico-dona-etiqueta">
            evaluados
          </text>
        </svg>
        <ul className="list-unstyled mb-0 small flex-grow-1 w-100">
          {datos.map((dato) => (
            <li key={dato.etiqueta} className="d-flex align-items-center gap-2 py-1 border-bottom">
              <span
                className="grafico-muestra"
                style={{ background: colores[dato.etiqueta] }}
                aria-hidden="true"
              />
              <span className="flex-grow-1">{dato.etiqueta}</span>
              <span className="fw-semibold tabular">{formatoNumero(dato.total)}</span>
              <span className="text-secondary tabular grafico-porcentaje">{dato.porcentaje}%</span>
            </li>
          ))}
        </ul>
      </div>
      {elemento}
      <TablaAccesible
        titulo={titulo}
        columnas={['Categoría', 'Candidatos', 'Porcentaje']}
        filas={datos.map((dato) => [dato.etiqueta, dato.total, `${dato.porcentaje}%`])}
      />
    </div>
  );
}

const segmentosTipo = (fila) =>
  Object.keys(COLORES_TIPO)
    .map((tipo) => ({ tipo, valor: fila[tipo] }))
    .filter((segmento) => segmento.valor > 0);

const contenidoTooltipTipo = (fila) => (
  <>
    <div className="fw-semibold mb-1">{fila.etiquetaVisible ?? fila.etiqueta}</div>
    {Object.keys(COLORES_TIPO).map((tipo) => (
      <FilaTooltip key={tipo} color={COLORES_TIPO[tipo]} etiqueta={tipo} valor={fila[tipo]} />
    ))}
    <FilaTooltip etiqueta="Total" valor={fila.total} />
  </>
);

/** Barras horizontales apiladas por tipo de evaluación (ej: por familia de cargo). */
export function GraficoBarrasApiladas({ titulo, datos, etiquetaFilas }) {
  const { contenedor, eventos, elemento } = useTooltip();
  if (datos.length === 0) return <SinDatos />;
  const { tope, valores } = escalaEje(Math.max(...datos.map((fila) => fila.total)));

  return (
    <div ref={contenedor} className="position-relative">
      <div className="grafico-barras">
        {datos.map((fila) => (
          <div
            key={fila.etiqueta}
            className="grafico-barras-fila"
            tabIndex={0}
            aria-label={`${fila.etiqueta}: ${fila.total} (externa ${fila.externa}, interna ${fila.interna})`}
            {...eventos(contenidoTooltipTipo(fila))}
          >
            <span className="grafico-barras-etiqueta small text-truncate" title={fila.etiqueta}>
              {fila.etiqueta}
            </span>
            <span className="grafico-barras-pista">
              <span
                className="grafico-barras-barra"
                style={{ width: `${(fila.total / tope) * 100}%` }}
              >
                {segmentosTipo(fila).map(({ tipo, valor }) => (
                  <span
                    key={tipo}
                    className="grafico-segmento"
                    style={{ flexGrow: valor, background: COLORES_TIPO[tipo] }}
                  />
                ))}
              </span>
              <span className="grafico-barras-valor small tabular">{fila.total}</span>
            </span>
          </div>
        ))}
        <div className="grafico-barras-fila grafico-eje-x" aria-hidden="true">
          <span className="grafico-barras-etiqueta" />
          <span className="grafico-barras-pista">
            {valores.map((valor) => (
              <span
                key={valor}
                className="grafico-eje-x-marca small text-secondary"
                style={{ left: `${(valor / tope) * 100}%` }}
              >
                {valor}
              </span>
            ))}
          </span>
        </div>
      </div>
      {elemento}
      <TablaAccesible
        titulo={titulo}
        columnas={[etiquetaFilas, 'Externa', 'Interna', 'Total']}
        filas={datos.map((fila) => [fila.etiqueta, fila.externa, fila.interna, fila.total])}
      />
    </div>
  );
}

/** Columnas apiladas por tipo de evaluación a lo largo del tiempo (ej: por mes). */
export function GraficoColumnasApiladas({ titulo, datos, etiquetaColumnas, formatearEtiqueta }) {
  const { contenedor, eventos, elemento } = useTooltip();
  if (datos.length === 0) return <SinDatos />;
  const { tope, valores } = escalaEje(Math.max(...datos.map((fila) => fila.total)));

  return (
    <div ref={contenedor} className="position-relative">
      {/* Con muchos meses en pantallas angostas el gráfico se desplaza en horizontal. */}
      <div className="grafico-columnas-desplazable">
        <div
          className="grafico-columnas"
          style={{ minWidth: `calc(2rem + ${datos.length} * 2.25rem)` }}
        >
          <div className="grafico-columnas-eje-y small text-secondary tabular" aria-hidden="true">
            {[...valores].reverse().map((valor) => (
              <span key={valor} style={{ bottom: `${(valor / tope) * 100}%` }}>
                {valor}
              </span>
            ))}
          </div>
          <div className="grafico-columnas-area">
            {valores.map((valor) => (
              <span
                key={valor}
                className="grafico-columnas-grilla"
                style={{ bottom: `${(valor / tope) * 100}%`, background: COLOR_GRILLA }}
                aria-hidden="true"
              />
            ))}
            {datos.map((fila) => {
              const etiqueta = formatearEtiqueta(fila.etiqueta);
              return (
                <div
                  key={fila.etiqueta}
                  className="grafico-columnas-columna"
                  tabIndex={0}
                  aria-label={`${etiqueta}: ${fila.total} (externa ${fila.externa}, interna ${fila.interna})`}
                  {...eventos(contenidoTooltipTipo({ ...fila, etiquetaVisible: etiqueta }))}
                >
                  <span
                    className="grafico-columnas-pila"
                    style={{ height: `${(fila.total / tope) * 100}%` }}
                  >
                    {segmentosTipo(fila)
                      .reverse()
                      .map(({ tipo, valor }) => (
                        <span
                          key={tipo}
                          className="grafico-segmento"
                          style={{ flexGrow: valor, background: COLORES_TIPO[tipo] }}
                        />
                      ))}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="grafico-columnas-eje-x small text-secondary" aria-hidden="true">
            {datos.map((fila) => (
              <span key={fila.etiqueta}>{formatearEtiqueta(fila.etiqueta)}</span>
            ))}
          </div>
        </div>
      </div>
      {elemento}
      <TablaAccesible
        titulo={titulo}
        columnas={[etiquetaColumnas, 'Externa', 'Interna', 'Total']}
        filas={datos.map((fila) => [
          formatearEtiqueta(fila.etiqueta),
          fila.externa,
          fila.interna,
          fila.total,
        ])}
      />
    </div>
  );
}

/** Medidor semicircular para un valor promedio, con escala de 0 al doble del valor. */
export function Medidor({ valor, unidad, descripcion }) {
  if (valor === null || valor === undefined) return <SinDatos />;
  const maximo = Math.max(1, Math.ceil(valor * 2));
  const fraccion = Math.min(valor / maximo, 1);
  const radio = 80;
  const angulo = Math.PI * (1 - fraccion);
  const x = 100 + radio * Math.cos(angulo);
  const y = 100 - radio * Math.sin(angulo);
  const arcoPista = `M20 100 A${radio} ${radio} 0 0 1 180 100`;
  const arcoValor = `M20 100 A${radio} ${radio} 0 0 1 ${x} ${y}`;
  const valorTexto = valor.toLocaleString('es-CL', { maximumFractionDigits: 1 });

  return (
    <figure className="mb-0 text-center">
      <svg
        viewBox="0 0 200 118"
        className="grafico-medidor"
        role="img"
        aria-label={`${descripcion}: ${valorTexto} ${unidad} (escala de 0 a ${maximo})`}
      >
        <path d={arcoPista} fill="none" stroke={COLOR_PISTA} strokeWidth={26} />
        {fraccion > 0 ? (
          <path d={arcoValor} fill="none" stroke={COLORES_TIPO.externa} strokeWidth={26} />
        ) : null}
        <text x="100" y="94" textAnchor="middle" className="grafico-medidor-valor">
          {valorTexto}
        </text>
        <text x="20" y="116" textAnchor="middle" className="grafico-medidor-escala">
          0
        </text>
        <text x="180" y="116" textAnchor="middle" className="grafico-medidor-escala">
          {maximo}
        </text>
      </svg>
      <figcaption className="small text-secondary">{unidad}</figcaption>
    </figure>
  );
}
