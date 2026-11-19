import { useEffect, useRef } from 'react';

/** Ondas suaves de fondo del panel (decorativas). Con movimiento reducido se dibujan quietas. */
export default function OndasMarea({ tema }) {
  const refCanvas = useRef(null);

  useEffect(() => {
    // Navegadores sin matchMedia (o las pruebas, sin canvas): las ondas son decorativas y se omiten.
    if (!window.matchMedia) return undefined;
    const canvas = refCanvas.current;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return undefined;
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const color = getComputedStyle(canvas).getPropertyValue('--m-onda').trim() || '16, 117, 144';
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, width * dpr);
    canvas.height = Math.max(1, height * dpr);

    let t = 0;
    let animacion = 0;
    const cuadro = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      for (let k = 0; k < 4; k += 1) {
        ctx.beginPath();
        const base = h * (0.62 + k * 0.1);
        for (let x = 0; x <= w; x += 8 * dpr) {
          const y = base + Math.sin(x / (200 * dpr) + t * 0.5 + k) * 9 * dpr + Math.sin(x / (80 * dpr) - t * 0.35) * 2.5 * dpr;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${color}, ${0.05 + k * 0.012})`;
        ctx.lineWidth = dpr;
        ctx.stroke();
      }
      t += 0.012;
      if (!reducido) animacion = requestAnimationFrame(cuadro);
    };
    cuadro();
    return () => cancelAnimationFrame(animacion);
  }, [tema]);

  return <canvas ref={refCanvas} className="marea-ondas" aria-hidden="true" />;
}
