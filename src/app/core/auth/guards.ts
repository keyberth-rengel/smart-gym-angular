import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AuthService } from './auth.service';
import { ONBOARDING_PATH, ROLE_HOME, Role, SIGN_IN_PATH, UNAVAILABLE_PATH } from './roles';

/** Espera a que Clerk termine de cargar antes de decidir nada. */
async function whenLoaded(auth: AuthService): Promise<void> {
  if (auth.isLoaded()) return;
  await firstValueFrom(toObservable(auth.isLoaded).pipe(filter(Boolean)));
}

/** Perfil completo o, si el backend falla, el destino de "no pudimos cargar tu perfil". */
async function profileState(auth: AuthService): Promise<boolean | 'error'> {
  try {
    return await auth.loadProfile();
  } catch {
    return 'error'; // el interceptor ya mostró el toast del error
  }
}

/** Solo con sesión iniciada. */
export const authGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await whenLoaded(auth);
  return auth.isSignedIn() ? true : router.parseUrl(SIGN_IN_PATH);
};

/** Páginas de acceso (inicio de sesión y registro): con sesión se va al inicio del rol. */
export const guestGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await whenLoaded(auth);
  return auth.isSignedIn() ? router.parseUrl(auth.home()) : true;
};

/** Ruta "/": lleva al inicio del rol, o al inicio de sesión. */
export const homeGuard: CanActivateFn = async (): Promise<UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await whenLoaded(auth);
  return router.parseUrl(auth.home());
};

/** Solo los roles indicados; el resto vuelve a su propio inicio con un aviso. */
export function roleGuard(allowed: readonly Role[]): CanActivateFn {
  return async (): Promise<boolean | UrlTree> => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const toast = inject(ToastService);
    await whenLoaded(auth);
    const role = auth.role();
    if (!role) return router.parseUrl(SIGN_IN_PATH);
    if (allowed.includes(role)) return true;
    toast.warning('No tienes permisos para acceder a esa sección.', 'Sin permisos');
    return router.parseUrl(ROLE_HOME[role]);
  };
}

/** Un cliente sin perfil (DNI y edad) debe completar el onboarding antes de entrar. */
export const profileCompleteGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await whenLoaded(auth);
  if (auth.role() !== 'cliente') return true;
  const state = await profileState(auth);
  if (state === 'error') return router.parseUrl(UNAVAILABLE_PATH);
  return state ? true : router.parseUrl(ONBOARDING_PATH);
};

/** Onboarding: solo clientes con el perfil pendiente; los demás van a su inicio. */
export const onboardingGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await whenLoaded(auth);
  if (auth.role() !== 'cliente') return router.parseUrl(auth.home());
  const state = await profileState(auth);
  if (state === 'error') return router.parseUrl(UNAVAILABLE_PATH);
  return state ? router.parseUrl(auth.home()) : true;
};
