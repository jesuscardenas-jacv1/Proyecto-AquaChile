import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { useAuth } from '../datos/AuthContext';
import ListaCandidatos from '../componentes/candidatos/ListaCandidatos';
import Mensaje from '../componentes/comunes/Mensaje';

/** Listado de candidatos con buscador; cada uno abre su ficha con la carpeta de documentos. */
export default function Candidatos() {
  const { candidatos, eliminarCandidato } = useDatos();
  const { esAnalista } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [confirmando, setConfirmando] = useState(null);

  const mensaje = ubicacion.state?.mensaje;
  const tipo = ubicacion.state?.tipo ?? 'success';

  const confirmarEliminar = () => {
    eliminarCandidato(confirmando.id);
    setConfirmando(null);
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header className="d-flex flex-column flex-md-row justify-content-between gap-2 align-items-md-center">
        <div>
          <h1 className="h4 mb-1">Candidatos</h1>
          <p className="text-secondary mb-0">Registro de postulants de AquaChile.</p>
        </div>
        {esAnalista ? (
          <button
            type="button"
            className="btn btn-primary align-self-start"
            onClick={() => navegar('/candidatos/nuevo')}
          >
            <i className="bi bi-person-plus me-1" aria-hidden="true" />
            Nuevo candidato
          </button>
        ) : null}
      </header>

      {mensaje ? (
        <Mensaje tipo={tipo} alCerrar={() => navegar('/candidatos', { replace: true })}>
          {mensaje}
        </Mensaje>
      ) : null}

      {confirmando ? (
        <Mensaje tipo="warning" titulo="Confirmar eliminación">
          ¿Eliminar a {confirmando.nombre}? Esta acción no se puede deshacer.
          <div className="d-flex gap-2 mt-2">
            <button type="button" className="btn btn-sm btn-danger" onClick={confirmarEliminar}>
              Sí, eliminar
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setConfirmando(null)}
            >
              Cancelar
            </button>
          </div>
        </Mensaje>
      ) : null}

      <ListaCandidatos
        candidatos={candidatos}
        alEditar={esAnalista ? (candidato) => navegar(`/candidatos/${candidato.id}/editar`) : undefined}
        alEliminar={esAnalista ? (candidato) => setConfirmando(candidato) : undefined}
        mostrarNuevo={esAnalista}
      />
    </div>
  );
}
