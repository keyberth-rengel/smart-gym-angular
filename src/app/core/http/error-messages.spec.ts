import { translateMessage } from './error-messages';

describe('translateMessage', () => {
  it.each([
    'DNI already linked to another account',
    'DNI already linked to another email: 52970520',
  ])('DNI ya vinculado (%s)', (raw) => {
    expect(translateMessage(raw, 409)).toBe('Este DNI ya está vinculado a otra cuenta.');
  });

  it('cliente y entrenador repetidos', () => {
    expect(translateMessage('Customer already exists: a@x.com', 409)).toBe(
      'Ya existe un cliente con ese correo.',
    );
    expect(translateMessage('Trainer already exists: t@x.com', 409)).toBe(
      'Ya existe un entrenador con ese correo.',
    );
  });
});
