import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './estilos/estilos.css';
import App from './App';
import { ProveedorDatos } from './datos/DatosContext';
import { ProveedorAuth } from './datos/AuthContext';

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ProveedorAuth>
        <ProveedorDatos>
          <App />
        </ProveedorDatos>
      </ProveedorAuth>
    </BrowserRouter>
  </StrictMode>,
);
