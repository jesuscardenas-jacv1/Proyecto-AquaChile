import { useDatos } from '../../datos/DatosContext';

const ORIGEN_DATOS = {
  api: 'Datos guardados en la base de datos del servidor',
  local: 'Sin servidor: datos de demostración en este navegador',
  conectando: 'Conectando con el servidor…',
};

export default function PiePagina() {
  const { modo } = useDatos();
  return (
    <footer className="pie-pagina text-white-50 py-4 mt-auto">
      <div className="container d-flex flex-column flex-md-row justify-content-between gap-2">
        <small>AquaChile · Módulo de Reclutamiento y Selección</small>
        <small>Proyecto académico DSY1104 · {ORIGEN_DATOS[modo]}</small>
      </div>
    </footer>
  );
}
