import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './componentes/layout/Layout';
import Dashboard from './paginas/Dashboard';
import Candidatos from './paginas/Candidatos';
import NuevoCandidato from './paginas/NuevoCandidato';
import EditarCandidato from './paginas/EditarCandidato';
import Solicitudes from './paginas/Solicitudes';
import NuevaSolicitud from './paginas/NuevaSolicitud';
import DetalleSolicitud from './paginas/DetalleSolicitud';
import InformePsicolaboral from './paginas/InformePsicolaboral';
import Login from './paginas/Login';
import NoEncontrada from './paginas/NoEncontrada';
import RutaProtegida from './componentes/comunes/RutaProtegida';

/** Definición de rutas de la aplicación con control de acceso por roles. */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/candidatos" element={<Candidatos />} />
          <Route
            path="/candidatos/nuevo"
            element={
              <RutaProtegida rolesPermitidos={['analista']}>
                <NuevoCandidato />
              </RutaProtegida>
            }
          />
          <Route
            path="/candidatos/:id/editar"
            element={
              <RutaProtegida rolesPermitidos={['analista']}>
                <EditarCandidato />
              </RutaProtegida>
            }
          />
          <Route path="/solicitudes" element={<Solicitudes />} />
          <Route
            path="/solicitudes/nueva"
            element={
              <RutaProtegida rolesPermitidos={['analista']}>
                <NuevaSolicitud />
              </RutaProtegida>
            }
          />
          <Route path="/solicitudes/:id" element={<DetalleSolicitud />} />
          <Route path="/solicitudes/:id/informe" element={<InformePsicolaboral />} />
          <Route path="/candidatos-inexistente" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  );
}
