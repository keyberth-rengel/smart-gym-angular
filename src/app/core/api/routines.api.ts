import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ActiveRoutineBlock, RoutineHistoryItem, RoutinePlan, WeekdayKey } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class RoutinesApi {
  private readonly api = inject(ApiClient);

  /** Asigna un plan semanal aleatorio (lunes a sábado). */
  assign(dni: string): Observable<RoutinePlan> {
    return this.api.post<RoutinePlan>('/routines/assign', { dni });
  }

  /** Historial ordenado de más antiguo a más reciente: la última es la activa. */
  history(dni: string): Observable<RoutineHistoryItem[]> {
    return this.api.get<RoutineHistoryItem[]>(`/routines/history/${encodeURIComponent(dni)}`);
  }

  /** El backend falla (500) con el domingo: no llamar con `sunday`. */
  activeForDay(dni: string, day: Exclude<WeekdayKey, 'sunday'>): Observable<ActiveRoutineBlock> {
    return this.api.get<ActiveRoutineBlock>(`/routines/active/${encodeURIComponent(dni)}`, {
      params: { day },
    });
  }
}
