import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AttendanceRecord } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class AttendanceApi {
  private readonly api = inject(ApiClient);

  /** Registra el ingreso; devuelve el mensaje de bienvenida del backend. */
  access(dni: string): Observable<string> {
    return this.api.post<string>('/access', { dni });
  }

  list(dni: string): Observable<AttendanceRecord[]> {
    return this.api.get<AttendanceRecord[]>(`/attendance/${encodeURIComponent(dni)}`);
  }
}
