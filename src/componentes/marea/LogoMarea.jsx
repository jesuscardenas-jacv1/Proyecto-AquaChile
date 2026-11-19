import { useId } from 'react';

/**
 * Logo de Marea ("Marea líquida"): círculo negro con una ola de luz (turquesa → blanco → violeta) y
 * una luna naranja, el acento de AquaChile, que late suave como señal de agente vivo. Es decorativo.
 */
export default function LogoMarea({ tamano = 34, className = '' }) {
  const id = useId();
  return (
    <svg
      className={`marea-logo ${className}`.trim()}
      width={tamano}
      height={tamano}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-ola`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#2fd3c6" />
          <stop offset="0.6" stopColor="#e9fffd" />
          <stop offset="1" stopColor="#7a5cff" />
        </linearGradient>
        <radialGradient id={`${id}-fondo`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#151b1f" />
          <stop offset="1" stopColor="#050607" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${id}-fondo)`} />
      <circle cx="20" cy="20" r="19.3" fill="none" stroke="#22292d" />
      <path d="M8 23c3-4 6-4 8 0s5 4 8 0 5-4 8 0" fill="none" stroke={`url(#${id}-ola)`} strokeWidth="2.6" strokeLinecap="round" />
      <circle className="marea-luna" cx="27.5" cy="12.5" r="2.2" fill="#fe5000" />
    </svg>
  );
}
