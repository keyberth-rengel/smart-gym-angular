import { Me } from '../core/models';

/** Perfil de `GET /me` de un cliente con perfil completo, para pruebas. */
export function testMe(over: Partial<Me> = {}): Me {
  return {
    role: 'cliente',
    email: 'ana@correo.com',
    name: 'Ana Pérez',
    dni: '12345678',
    profile_complete: true,
    profile: { email: 'ana@correo.com', name: 'Ana Pérez', age: 28 },
    ...over,
  };
}
