import { useId } from 'react';

/**
 * Logo de Marea: círculo en el azul pizarra de AquaChile con dos ondas (la marea) y una chispa
 * naranja (el acento de la marca), que lo identifica como agente de IA. Es decorativo.
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
        <linearGradient id={`${id}-fondo`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b7586" />
          <stop offset="0.55" stopColor="#425563" />
          <stop offset="1" stopColor="#1f2b34" />
        </linearGradient>
        <radialGradient id={`${id}-brillo`} cx="0.3" cy="0.22" r="0.6">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${id}-fondo)`} />
      <circle cx="20" cy="20" r="20" fill={`url(#${id}-brillo)`} />
      <path d="M8.5 24.5c2.6-3.2 5.1-3.2 7.7 0s5.1 3.2 7.7 0 5.1-3.2 7.7 0" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M8.5 30.5c2.6-3.2 5.1-3.2 7.7 0s5.1 3.2 7.7 0 5.1-3.2 7.7 0" fill="none" stroke="#9cc9d8" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
      <path d="M27 6.5l1.5 3.8 3.8 1.5-3.8 1.5-1.5 3.8-1.5-3.8-3.8-1.5 3.8-1.5z" fill="#fe5000" />
    </svg>
  );
}
