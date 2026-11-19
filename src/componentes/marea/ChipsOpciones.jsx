/**
 * Opciones como botones ("ofrecer antes que pedir"): solicitudes recientes, otro día, analizar…
 * Cada chip envía su acción a Marea sin escribir.
 */
export default function ChipsOpciones({ opciones = [], alElegir, desactivado = false }) {
  if (!opciones.length) return null;
  return (
    <div className="marea-opciones">
      {opciones.map((opcion) => (
        <button
          key={`${opcion.etiqueta}-${JSON.stringify(opcion.accion)}`}
          type="button"
          className="marea-opcion"
          disabled={desactivado}
          onClick={() => alElegir(opcion.accion, opcion.etiqueta, opcion)}
        >
          {opcion.etiqueta}
        </button>
      ))}
    </div>
  );
}
