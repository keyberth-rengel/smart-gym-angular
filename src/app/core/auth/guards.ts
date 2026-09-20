import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { Me } from '../models';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AuthService } from './auth.service';
import { ONBOARDING_PATH, ROLE_HOME, Role, SIGN_IN_PATH, UNAVAILABLE_PATH } from './roles';

/** Tiempo máximo de espera a que cargue Clerk (su script viene de un CDN y puede no llegar). */
export const CLERK_LOAD_TIMEOUT_MS = 15000;

/**
 * Espera a que Clerk termine de cargar antes de decidir nada. Si no carga a tiempo devuelve la
 * pantalla "no disponible" (con el motivo `clerk`) en vez de dejar la app en blanco.
 */
async function whenLoaded(auth: AuthService, router: Router): Promise<UrlTree | null> {
  if (auth.isLoaded()) return null;
  const loaded = await Promise.race([
    firstValueFrom(toObservable(auth.isLoaded).pipe(filter(Boolean))).then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), CLERK_LOAD_TIMEOUT_MS)),
  ]);
  if (loaded) return null;
  auth.markClerkUnavailable();
  return router.parseUrl(UNAVAILABLE_PATH);
}

/**
 * Perfil del backend del usuario con sesión, o el destino al que hay que ir si no se pudo
 * cargar: 401 -> volver a iniciar sesión (se cierra la sesión de Clerk); el resto ->
 * "no disponible", que explica el motivo y permite reintentar.
 */
async function resolveMe(auth: AuthService, router: Router): Promise<Me | UrlTree> {
  try {
    return await auth.loadMe();
  } catch {
    if (auth.meError() === 'unauthorized') {
      await auth.expireSession();
      return router.parseUrl(SIGN_IN_PATH);
    }
    return router.parseUrl(UNAVAILABLE_PATH);
  }
}

/** Un entrenador sin perfil registrado no puede usar la app: se le explica en "no disponible". */
function trainerPending(auth: AuthService, me: Me): boolean {
  if (me.role !== 'entrenador' || me.profile_complete) return false;
  auth.markProfilePending();
  return true;
}

/** Solo con sesión iniciada. */
export const authGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const waiting = await whenLoaded(auth, router);
  if (waiting) return waiting;
  return auth.isSignedIn() ? true : router.parseUrl(SIGN_IN_PATH);
};

/** Páginas de acceso (inicio de sesión y registro): con sesión se va al inicio del rol. */
export const guestGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const waiting = await whenLoaded(auth, router);
  if (waiting) return waiting;
  if (!auth.isSignedIn()) return true;
  const me = await resolveMe(auth, router);
  return me instanceof UrlTree ? me : router.parseUrl(auth.home());
};

/** Ruta "/": lleva al inicio del rol, o al inicio de sesión. */
export const homeGuard: CanActivateFn = async (): Promise<UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const waiting = await whenLoaded(auth, router);
  if (waiting) return waiting;
  if (!auth.isSignedIn()) return router.parseUrl(SIGN_IN_PATH);
  const me = await resolveMe(auth, router);
  if (me instanceof UrlTree) return me;
  if (trainerPending(auth, me)) return router.parseUrl(UNAVAILABLE_PATH);
  return router.parseUrl(auth.home());
};

/** Solo los roles indicados; el resto vuelve a su propio inicio con un aviso. */
export function roleGuard(allowed: readonly Role[]): CanActivateFn {
  return async (): Promise<boolean | UrlTree> => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const toast = inject(ToastService);
    const waiting = await whenLoaded(auth, router);
    if (waiting) return waiting;
    if (!auth.isSignedIn()) return router.parseUrl(SIGN_IN_PATH);
    const me = await resolveMe(auth, router);
    if (me instanceof UrlTree) return me;
    const role = auth.role();
    if (!role) return router.parseUrl(SIGN_IN_PATH);
    if (allowed.includes(role)) return true;
    toast.warning('No tienes permisos para acceder a esa sección.', 'Sin permisos');
    return router.parseUrl(ROLE_HOME[role]);
  };
}

/**
 * Perfil pendiente: un cliente sin perfil (DNI y edad) completa el onboarding antes de
 * entrar; un entrenador sin perfil registrado ve la pantalla "no disponible".
 */
export const profileCompleteGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const waiting = await whenLoaded(auth, router);
  if (waiting) return waiting;
  if (!auth.isSignedIn()) return router.parseUrl(SIGN_IN_PATH);
  const me = await resolveMe(auth, router);
  if (me instanceof UrlTree) return me;
  if (trainerPending(auth, me)) return router.parseUrl(UNAVAILABLE_PATH);
  if (me.role === 'cliente' && !me.profile_complete) return router.parseUrl(ONBOARDING_PATH);
  return true;
};

/** Onboarding: solo clientes con el perfil pendiente; los demás van a su inicio. */
export const onboardingGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const waiting = await whenLoaded(auth, router);
  if (waiting) return waiting;
  if (!auth.isSignedIn()) return router.parseUrl(SIGN_IN_PATH);
  const me = await resolveMe(auth, router);
  if (me instanceof UrlTree) return me;
  if (me.role !== 'cliente' || me.profile_complete) return router.parseUrl(auth.home());
  return true;
};
