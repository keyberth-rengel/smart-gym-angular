import {
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ApiError } from './api-error';

/** Con `true` la petición no muestra toast automático ante errores. */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/** Contexto para una petición cuyos errores muestra el propio componente (sin toast automático). */
export const skipErrorToast = (): HttpContext => new HttpContext().set(SKIP_ERROR_TOAST, true);

/** Toast que corresponde a un error del API (el mismo que muestra el interceptor). */
export function notify(toast: ToastService, error: ApiError): void {
  if (error.isNetwork || error.isServer) {
    toast.error(error.message, 'Servicio no disponible');
  } else if (error.status === 401 || error.status === 403) {
    toast.error(error.message, 'Sin permisos');
  } else if (error.status === 409) {
    toast.error(error.message, 'Conflicto');
  } else if (error.status === 422 && !error.isNotFound) {
    toast.warning(error.message, 'No se pudo completar');
  }
  // 400 y "no existe" (404, o 422 de no encontrado) los muestra el componente junto al campo.
}

/** Normaliza los errores del API a `ApiError` y muestra el toast que corresponda. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBase)) return next(req);

  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);
      const apiError = ApiError.from(err);
      if (!req.context.get(SKIP_ERROR_TOAST)) notify(toast, apiError);
      return throwError(() => apiError);
    }),
  );
};
