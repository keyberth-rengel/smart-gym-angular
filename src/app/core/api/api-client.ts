import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response';

export interface ApiRequestOptions {
  params?: Record<string, string | number | boolean>;
  context?: HttpContext;
}

/** Cliente HTTP base: antepone `apiBase` y devuelve directamente `data` del envoltorio. */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  get<T>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    return this.http
      .get<ApiResponse<T>>(this.url(path), options)
      .pipe(map((res) => this.unwrap<T>(res)));
  }

  post<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(this.url(path), body, options)
      .pipe(map((res) => this.unwrap<T>(res)));
  }

  /** DELETE tolera respuestas sin cuerpo (204). */
  delete(path: string, options: ApiRequestOptions = {}): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown> | null>(this.url(path), options)
      .pipe(map(() => undefined));
  }

  private url(path: string): string {
    return `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private unwrap<T>(res: ApiResponse<T> | null): T {
    return res?.data as T;
  }
}
