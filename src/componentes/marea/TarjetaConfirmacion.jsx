import { useState } from 'react';

/**
 * Propuesta de un cambio (agendar): nada se guarda hasta pulsar «Confirmar». Se puede pulsar una
 * sola vez; «Elegir otra hora» vuelve a la lista de horas libres.
 */
export default function TarjetaConfirmacion({ tarjeta, alElegir, desactivado = false }) {
  const [enviada, setEnviada] = useState(false);
  const bloqueada = desactivado || enviada;

  return (
    <div className="marea-confirmar">
      <h4>{tarjeta.titulo}</h4>
      <ul className="marea-detalle">
        {tarjeta.detalle.map((linea) => (
          <li key={linea}>{linea}</li>
        ))}
      </ul>
      <div className="marea-acciones">
        <button
          type="button"
          className="marea-boton-principal"
          disabled={bloqueada}
          onClick={() => {
            setEnviada(true);
            alElegir(tarjeta.accion, 'Confirmar');
          }}
        >
          Confirmar
        </button>
        <button
          type="button"
          className="marea-boton-secundario"
          disabled={bloqueada}
          onClick={() => alElegir({ tipo: 'agendar', solicitudId: tarjeta.accion.solicitudId }, 'Elegir otra hora')}
        >
          Elegir otra hora
        </button>
      </div>
    </div>
  );
}
