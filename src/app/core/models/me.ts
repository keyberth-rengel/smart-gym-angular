import { Role } from '../auth/roles';

/** Perfil de un cliente o de un entrenador (`specialty` solo aplica a entrenadores). */
export interface MeProfile {
  email: string;
  name: string;
  age: number;
  specialty?: string;
}

/** Contrato de `GET /me` y de la respuesta de `POST /me/onboarding`. */
export interface Me {
  role: Role;
  email: string;
  name: string | null;
  dni: string | null;
  profile_complete: boolean;
  profile: MeProfile | null;
}

/** Cuerpo de `POST /me/onboarding`; el correo sale del token. */
export interface OnboardingInput {
  name: string;
  age: number;
  dni: string;
}
