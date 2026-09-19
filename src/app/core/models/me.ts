import { Role } from '../auth/roles';

/** Perfil del usuario autenticado (contrato de `GET /me`, pendiente B2 del backend). */
export interface Me {
  email: string;
  role: Role;
  profile_complete: boolean;
}

export interface OnboardingInput {
  name: string;
  email: string;
  age: number;
  dni: string;
}
