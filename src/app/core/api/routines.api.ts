import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ActiveRoutineBlock, RoutineHistoryItem, RoutinePlan, WeekdayKey } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class RoutinesApi {
  private readonly api = inject(ApiClient);

  /** Asigna un plan semanal aleatorio (lunes a sábado). */
  assign(dni: string, context?: HttpContext): Observable<RoutinePlan> {
    return this.api.post<RoutinePlan>('/routines/assign', { dni }, { context });
  }

  /** Asigna un plan semanal al cliente por su correo (entrenador: solo a sus clientes). */
  assignByEmail(customerEmail: string, context?: HttpContext): Observable<RoutinePlan> {
    return this.api.post<RoutinePlan>(
      '/routines/assign',
      { customer_email: customerEmail },
      { context },
    );
  }

  /** Historial de un cliente por correo (dueño, su entrenador o admin); la última es la activa. */
  historyByEmail(email: string, context?: HttpContext): Observable<RoutineHistoryItem[]> {
    return this.api.get<RoutineHistoryItem[]>(
      `/routines/by-email/${encodeURIComponent(email)}/history`,
      {
        context,
      },
    );
  }

  /** Historial ordenado de más antiguo a más reciente: la última es la activa. */
  history(dni: string, context?: HttpContext): Observable<RoutineHistoryItem[]> {
    return this.api.get<RoutineHistoryItem[]>(`/routines/history/${encodeURIComponent(dni)}`, {
      context,
    });
  }

  /** El backend falla (500) con el domingo: no llamar con `sunday`. */
  activeForDay(dni: string, day: Exclude<WeekdayKey, 'sunday'>): Observable<ActiveRoutineBlock> {
    return this.api.get<ActiveRoutineBlock>(`/routines/active/${encodeURIComponent(dni)}`, {
      params: { day },
    });
  }
}
