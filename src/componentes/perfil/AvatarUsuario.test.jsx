import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AvatarUsuario from './AvatarUsuario';

describe('AvatarUsuario', () => {
  it('muestra las iniciales si no hay foto', () => {
    render(<AvatarUsuario usuario={{ nombre: 'Carolina Muñoz' }} />);
    expect(screen.getByText('CM')).toBeInTheDocument();
  });

  it('muestra la foto si existe', () => {
    const { container } = render(<AvatarUsuario usuario={{ nombre: 'Carolina Muñoz', foto: 'data:image/jpeg;base64,AA==' }} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/jpeg;base64,AA==');
    expect(screen.queryByText('CM')).toBeNull();
  });
});
