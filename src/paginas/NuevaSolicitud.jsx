import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { apiDocumentos } from '../servicios/apiDocumentos';
import FormularioSolicitud from '../componentes/solicitudes/FormularioSolicitud';
import Mensaje from '../componentes/comunes/Mensaje';

/**
 * Página de creación de solicitud de evaluación.
 * Si el candidato/a no está registrado/a, se registra junto con la solicitud.
 * Con ?postulacion=ID parte con los datos del postulante y de la oferta, y al guardar
 * la postulación pasa a "En evaluación" (y su CV se copia a la carpeta de la solicitud).
 */
export default function NuevaSolicitud() {
  const {
    candidatos,
    agregarCandidato,
    agregarSolicitud,
    obtenerPostulacion,
    obtenerOferta,
    obtenerCandidato,
    actualizarPostulacion,
  } = useDatos();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();

  const postulacion = obtenerPostulacion(parametros.get('postulacion'));
  const postulacionPendiente = postulacion?.estado === 'Recibida' ? postulacion : null;
  const oferta = postulacionPendiente ? obtenerOferta(postulacionPendiente.ofertaId) : null;
  const postulante = postulacionPendiente ? obtenerCandidato(postulacionPendiente.candidatoId) : null;
  const valoresIniciales = postulante
    ? {
        candidatoId: String(postulante.id),
        nombreCandidato: postulante.nombre,
        origen: postulante.origen ?? '',
        cargo: oferta?.cargo ?? postulante.cargo,
        familiaCargo: oferta?.familiaCargo ?? postulante.familiaCargo,
        ubicacion: oferta?.ubicacion ?? '',
        cv: postulacionPendiente.cvNombre ?? '',
      }
    : {};

  const guardar = async ({ nombreCandidato, correo, telefono, ...datos }) => {
    const candidatoId =
      datos.candidatoId ||
      (
        await agregarCandidato({
          nombre: nombreCandidato,
          correo,
          telefono,
          cargo: datos.cargo,
          familiaCargo: datos.familiaCargo,
          origen: datos.origen,
        })
      )?.id;
    if (!candidatoId) return;
    const solicitud = await agregarSolicitud({ ...datos, candidatoId });
    // Si el servidor la rechaza, el motivo se muestra arriba y se queda en el formulario.
    if (!solicitud) return;

    let mensaje = datos.candidatoId
      ? 'Solicitud enviada correctamente. Queda pendiente de agendar la entrevista.'
      : 'Solicitud enviada y candidato/a registrado/a correctamente.';

    if (postulacionPendiente) {
      await actualizarPostulacion(postulacionPendiente.id, { estado: 'En evaluación', solicitudId: solicitud.id });
      mensaje = 'El postulante pasó a evaluación y la solicitud quedó pendiente de agendar.';
      if (apiDocumentos.conectado()) {
        try {
          await apiDocumentos.traerCvDePostulacion(solicitud.id, postulacionPendiente.id, nombreCandidato);
          mensaje += ' Su CV se copió a la carpeta de la solicitud.';
        } catch {
          mensaje += ' No se pudo copiar el CV de la postulación; súbelo desde Documentos.';
        }
      }
    }

    navegar(`/solicitudes/${solicitud.id}`, { state: { mensaje, tipo: 'success' } });
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header>
        <h1 className="h4 mb-1">Solicitud de evaluación psicolaboral</h1>
        <p className="text-secondary mb-0">
          Completa los datos del candidato/a y del cargo para solicitar su evaluación.
        </p>
      </header>

      {postulacionPendiente && postulante ? (
        <Mensaje tipo="info" titulo="Pasando a evaluación desde una postulación">
          {postulante.nombre} postuló a <strong>{oferta?.titulo}</strong>. Revisa los datos y completa lo que falta.
        </Mensaje>
      ) : null}

      <div className="row">
        <div className="col-12 col-xl-10">
          <FormularioSolicitud
            key={postulacionPendiente?.id ?? 'nueva'}
            candidatos={candidatos}
            valoresIniciales={valoresIniciales}
            alGuardar={guardar}
            alCancelar={() => navegar(postulacionPendiente ? '/postulaciones' : '/solicitudes')}
          />
        </div>
      </div>
    </div>
  );
}
