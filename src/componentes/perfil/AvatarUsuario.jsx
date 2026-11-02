import { inicialesDe } from '../../dominio/validaciones';

/** Foto de perfil del usuario o, si no tiene, sus iniciales. */
export default function AvatarUsuario({ usuario, tamano = 32, className = '' }) {
  const estilo = { width: tamano, height: tamano, fontSize: Math.round(tamano * 0.38) };
  return usuario?.foto ? (
    <img src={usuario.foto} alt="" className={`avatar-usuario ${className}`.trim()} style={estilo} />
  ) : (
    <span className={`avatar-usuario avatar-iniciales ${className}`.trim()} style={estilo} aria-hidden="true">
      {inicialesDe(usuario?.nombre)}
    </span>
  );
}
