import { useDatos } from '../../datos/DatosContext';

const ORIGEN_DATOS = {
  api: 'Datos guardados en la base de datos del servidor',
  local: 'Sin servidor: datos de demostración en este navegador',
  conectando: 'Conectando con el servidor…',
};

export default function PiePagina() {
  const { modo } = useDatos();
  return (
    <footer className="pie-pagina py-3 mt-auto">
      <div className="d-flex flex-column flex-md-row justify-content-between gap-2 small text-secondary">
        <span>AquaChile · Módulo de Reclutamiento y Selección</span>
        <span>Proyecto académico DSY1104 · {ORIGEN_DATOS[modo]}</span>
      </div>
    </footer>
  );
}
