import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Administracion from './Administracion';
import { USUARIOS } from '../datos/usuarios';
import { datosDePrueba, renderConContexto } from '../pruebas/utilidades';

const admin = { id: 3, nombre: 'Andrés Valdivia', rol: 'admin' };

describe('Administracion', () => {
  it('lista los usuarios de prueba con su rol, sin mostrar contraseñas', () => {
    renderConContexto(<Administracion />, { usuario: admin, datosIniciales: datosDePrueba });

    const tabla = screen.getByRole('table');
    expect(within(tabla).getAllByRole('row')).toHaveLength(USUARIOS.length + 1);
    expect(within(tabla).getByText('jefatura@aquachile.cl')).toBeInTheDocument();
    expect(within(tabla).getByText('Jefatura')).toBeInTheDocument();
    expect(screen.queryByText('AquaChile2026!')).toBeNull();
  });

  it('describe los 4 roles con sus permisos', () => {
    renderConContexto(<Administracion />, { usuario: admin, datosIniciales: datosDePrueba });

    ['Administrador académico', 'Analista de Reclutamiento', 'Profesional Evaluador', 'Jefatura / contraparte'].forEach(
      (rol) => expect(screen.getByRole('article', { name: rol })).toBeInTheDocument(),
    );
  });

  it('muestra los catálogos del sistema', () => {
    renderConContexto(<Administracion />, { usuario: admin, datosIniciales: datosDePrueba });

    expect(screen.getByText('Familias de cargo')).toBeInTheDocument();
    expect(screen.getByText('Operario Calificado AM')).toBeInTheDocument();
    expect(screen.getByText('Teams')).toBeInTheDocument();
  });

  it('restablece los datos de demostración solo tras confirmar', async () => {
    const usuario = userEvent.setup();
    renderConContexto(<Administracion />, { usuario: admin, datosIniciales: datosDePrueba });

    const totales = () => within(screen.getByText('Candidatos').closest('div')).getByRole('definition');
    expect(totales()).toHaveTextContent('2');

    await usuario.click(screen.getByRole('button', { name: /restablecer datos de demostración/i }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(totales()).toHaveTextContent('2');

    await usuario.click(screen.getByRole('button', { name: /restablecer datos de demostración/i }));
    await usuario.click(screen.getByRole('button', { name: 'Sí, restablecer' }));

    expect(screen.getByText('Se restablecieron los datos de demostración.')).toBeInTheDocument();
    expect(Number(totales().textContent)).toBeGreaterThan(2);
  });
});
