import { HttpErrorResponse } from '@angular/common/http';
import { ApiFieldError, ApiResponse } from '../models/api-response';
import { translateFieldError, translateMessage } from './error-messages';

/**
 * Error normalizado de cualquier llamada al API. `message` ya está en español y
 * listo para mostrar; `rawMessage` conserva el texto original del backend.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: Record<string, string> = {},
    readonly rawMessage = '',
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Sin respuesta del servidor (red caída, CORS, etc.). */
  get isNetwork(): boolean {
    return this.status === 0;
  }

  get isServer(): boolean {
    return this.status >= 500;
  }

  /**
   * "No existe": 404, o 422 con mensaje de no encontrado / DNI no vinculado. El backend
   * responde 422 en varios endpoints donde correspondería 404 (pendiente B9 del plan).
   */
  get isNotFound(): boolean {
    if (this.status === 404) return true;
    return this.status === 422 && /not found|not linked|does not exist/i.test(this.rawMessage);
  }

  static from(err: HttpErrorResponse): ApiError {
    const body = (typeof err.error === 'object' ? err.error : null) as ApiResponse<unknown> | null;
    const raw = body?.message ?? '';
    const details: ApiFieldError[] = Array.isArray(body?.error?.details)
      ? body!.error!.details!
      : [];
    const fieldErrors: Record<string, string> = {};
    for (const d of details) {
      if (d?.field && !(d.field in fieldErrors))
        fieldErrors[d.field] = translateFieldError(d.error);
    }
    const code = body?.error?.code ?? (err.status === 0 ? 'NETWORK_ERROR' : `HTTP_${err.status}`);
    return new ApiError(err.status, code, translateMessage(raw, err.status), fieldErrors, raw);
  }
}
