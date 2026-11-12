import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BotonReunion from './BotonReunion';

describe('BotonReunion', () => {
  it('abre la reunión en otra pestaña de forma segura', () => {
    render(<BotonReunion enlace="https://meet.google.com/abc-defg-hij" modalidad="Google Meet" />);
    const enlace = screen.getByRole('link', { name: /unirse a la reunión/i });
    expect(enlace).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
    expect(enlace).toHaveAttribute('target', '_blank');
    expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');
    expect(enlace).toHaveAccessibleName(/google meet/i);
  });

  it('deduce el servicio por el enlace si no se indica la modalidad', () => {
    render(<BotonReunion enlace="https://teams.microsoft.com/l/meetup-join/1" />);
    expect(screen.getByRole('link')).toHaveAccessibleName(/teams/i);
  });

  it('no muestra nada sin enlace o con un enlace que no es de Meet o Teams', () => {
    const { container, rerender } = render(<BotonReunion enlace="" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<BotonReunion enlace="javascript:alert(1)" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<BotonReunion enlace="http://meet.google.com/abc" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('en solo lectura (jefatura) indica la modalidad sin el enlace', () => {
    render(<BotonReunion enlace="https://meet.google.com/abc" modalidad="Google Meet" soloLectura />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Reunión online por Google Meet')).toBeInTheDocument();
  });
});
