/** Detalle de un error de validación (400) devuelto por el backend. */
export interface ApiFieldError {
  field: string;
  error: string;
}

export interface ApiErrorBody {
  code: string;
  details?: ApiFieldError[];
}

/** Envoltorio estándar de todas las respuestas del backend. */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiErrorBody;
  timestamp: string;
  path: string;
  request_id?: string;
}
