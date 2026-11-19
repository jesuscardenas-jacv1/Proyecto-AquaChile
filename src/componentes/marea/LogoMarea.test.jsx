import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LogoMarea from './LogoMarea';

describe('LogoMarea', () => {
  it('es decorativo, toma el tamaño pedido y no repite ids entre logos', () => {
    const { container } = render(
      <>
        <LogoMarea tamano={26} />
        <LogoMarea />
      </>,
    );
    const [chico, normal] = container.querySelectorAll('svg');
    expect(chico).toHaveAttribute('aria-hidden', 'true');
    expect(chico).toHaveAttribute('width', '26');
    expect(normal).toHaveAttribute('width', '34');
    const ids = [...container.querySelectorAll('[id]')].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
