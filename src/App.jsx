import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './componentes/layout/Layout';
import Dashboard from './paginas/Dashboard';
import Candidatos from './paginas/Candidatos';
import NuevoCandidato from './paginas/NuevoCandidato';
import EditarCandidato from './paginas/EditarCandidato';
import DetalleCandidato from './paginas/DetalleCandidato';
import Solicitudes from './paginas/Solicitudes';
import NuevaSolicitud from './paginas/NuevaSolicitud';
import DetalleSolicitud from './paginas/DetalleSolicitud';
import InformePsicolaboral from './paginas/InformePsicolaboral';
import Planner from './paginas/Planner';
import InformesEnviados from './paginas/InformesEnviados';
import Login from './paginas/Login';
import Administracion from './paginas/Administracion';
import Postulaciones from './paginas/Postulaciones';
import PortalOfertas from './paginas/portal/PortalOfertas';
import PortalOferta from './paginas/portal/PortalOferta';
import LayoutPublico from './componentes/layout/LayoutPublico';
import NoEncontrada from './paginas/NoEncontrada';
import RutaProtegida from './componentes/comunes/RutaProtegida';

/** Definición de rutas de la aplicación con control de acceso por roles. */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Portal público de postulación (no requiere sesión) */}
      <Route element={<LayoutPublico />}>
        <Route path="/trabaja-con-nosotros" element={<PortalOfertas />} />
        <Route path="/trabaja-con-nosotros/ofertas/:id" element={<PortalOferta />} />
      </Route>

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
          <Route path="/candidatos/:id" element={<DetalleCandidato />} />
          <Route
            path="/candidatos/:id/editar"
            element={
              <RutaProtegida rolesPermitidos={['analista']}>
                <EditarCandidato />
              </RutaProtegida>
            }
          />
          <Route
            path="/postulaciones"
            element={
              <RutaProtegida rolesPermitidos={['analista', 'jefatura']}>
                <Postulaciones />
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
          <Route path="/planner" element={<Planner />} />
          <Route path="/planner/informes" element={<InformesEnviados />} />
          <Route
            path="/administracion"
            element={
              <RutaProtegida rolesPermitidos={['admin']}>
                <Administracion />
              </RutaProtegida>
            }
          />
          <Route path="/candidatos-inexistente" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  );
}
