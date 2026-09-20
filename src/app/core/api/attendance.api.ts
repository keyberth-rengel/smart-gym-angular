import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AttendanceRecord } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class AttendanceApi {
  private readonly api = inject(ApiClient);

  /** Registra el ingreso; devuelve el mensaje de bienvenida del backend. */
  access(dni: string, context?: HttpContext): Observable<string> {
    return this.api.post<string>('/access', { dni }, { context });
  }

  list(dni: string, context?: HttpContext): Observable<AttendanceRecord[]> {
    return this.api.get<AttendanceRecord[]>(`/attendance/${encodeURIComponent(dni)}`, { context });
  }
}
