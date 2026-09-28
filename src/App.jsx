import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './componentes/layout/Layout';
import Dashboard from './paginas/Dashboard';
import Candidatos from './paginas/Candidatos';
import NuevoCandidato from './paginas/NuevoCandidato';
import EditarCandidato from './paginas/EditarCandidato';
import Solicitudes from './paginas/Solicitudes';
import NuevaSolicitud from './paginas/NuevaSolicitud';
import DetalleSolicitud from './paginas/DetalleSolicitud';
import NoEncontrada from './paginas/NoEncontrada';

/** Definición de rutas de la aplicación. */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/candidatos" element={<Candidatos />} />
        <Route path="/candidatos/nuevo" element={<NuevoCandidato />} />
        <Route path="/candidatos/:id/editar" element={<EditarCandidato />} />
        <Route path="/solicitudes" element={<Solicitudes />} />
        <Route path="/solicitudes/nueva" element={<NuevaSolicitud />} />
        <Route path="/solicitudes/:id" element={<DetalleSolicitud />} />
        <Route path="/candidatos-inexistente" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </Routes>
  );
}
