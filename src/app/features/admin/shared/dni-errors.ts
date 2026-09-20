import { ApiError } from '../../../core/http/api-error';

export const NOT_LINKED_MESSAGE = 'Este DNI no está vinculado a ninguna cuenta de SmartGym.';
export const NOT_A_CUSTOMER_MESSAGE =
  'Ese DNI pertenece a una cuenta que no es de cliente: solo los clientes tienen rutina.';
export const NO_PROFILE_MESSAGE =
  'Ese DNI está vinculado a un correo sin perfil de cliente ni de entrenador.';

export interface DniNotFound {
  /** `field`: bajo el campo del DNI; `alert`: aviso general sobre los resultados. */
  target: 'field' | 'alert';
  text: string;
}

/**
 * Traduce un "no encontrado" de las consultas por DNI (el backend usa 404 con textos en inglés):
 * DNI sin vincular (campo), cuenta que no es cliente o vínculo sin perfil (aviso).
 */
export function dniNotFound(err: ApiError): DniNotFound {
  const raw = err.rawMessage;
  if (/not linked/i.test(raw)) return { target: 'field', text: NOT_LINKED_MESSAGE };
  if (/identity not recognized/i.test(raw)) return { target: 'alert', text: NO_PROFILE_MESSAGE };
  if (/customer/i.test(raw)) return { target: 'alert', text: NOT_A_CUSTOMER_MESSAGE };
  return { target: 'field', text: NOT_LINKED_MESSAGE };
}
