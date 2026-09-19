import { ROLE_HOME, parseRole } from './roles';

describe('parseRole', () => {
  it('acepta los tres roles válidos', () => {
    expect(parseRole('cliente')).toBe('cliente');
    expect(parseRole('entrenador')).toBe('entrenador');
    expect(parseRole('admin')).toBe('admin');
  });

  it('ignora mayúsculas y espacios', () => {
    expect(parseRole(' Admin ')).toBe('admin');
    expect(parseRole('ENTRENADOR')).toBe('entrenador');
  });

  it('sin metadata o con un valor desconocido es cliente', () => {
    expect(parseRole(undefined)).toBe('cliente');
    expect(parseRole(null)).toBe('cliente');
    expect(parseRole('')).toBe('cliente');
    expect(parseRole('superusuario')).toBe('cliente');
    expect(parseRole(42)).toBe('cliente');
    expect(parseRole({ role: 'admin' })).toBe('cliente');
  });

  it('cada rol tiene su inicio', () => {
    expect(ROLE_HOME).toEqual({ cliente: '/cliente', entrenador: '/entrenador', admin: '/admin' });
  });
});
