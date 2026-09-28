import { Link } from 'react-router-dom';

/** Vista para rutas no existentes. */
export default function NoEncontrada() {
  return (
    <div className="text-center py-5">
      <p className="display-6 fw-bold text-primary mb-2">404</p>
      <h1 className="h5 mb-3">Página no encontrada</h1>
      <p className="text-secondary">La ruta solicitada no existe en la aplicación.</p>
      <Link to="/" className="btn btn-primary">
        Volver al dashboard
      </Link>
    </div>
  );
}
