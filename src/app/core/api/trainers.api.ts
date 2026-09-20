import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Booking,
  BookingQuery,
  Trainer,
  TrainerAvailability,
  TrainerCreate,
  TrainerCreated,
  Invitation,
  TrainerCustomer,
} from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class TrainersApi {
  private readonly api = inject(ApiClient);

  /** Solo ADMIN: crea al entrenador (y vincula el DNI) y lo invita en Clerk; devuelve el resultado de la invitación. */
  create(trainer: TrainerCreate, context?: HttpContext): Observable<TrainerCreated> {
    return this.api.post<TrainerCreated>('/trainers', trainer, { context });
  }

  /** Solo ADMIN: reintenta la invitación de un entrenador existente. */
  invite(email: string, context?: HttpContext): Observable<Invitation> {
    return this.api.post<Invitation>(`/trainers/${encodeURIComponent(email)}/invite`, {}, { context });
  }

  /** Entrenadores ordenados por nombre; cualquier usuario autenticado. */
  list(context?: HttpContext): Observable<Trainer[]> {
    return this.api.get<Trainer[]>('/trainers', { context });
  }

  /** Horas ocupadas del entrenador; `date` (yyyy-MM-dd) por defecto es hoy en el servidor. */
  availability(email: string, date?: string): Observable<TrainerAvailability> {
    return this.api.get<TrainerAvailability>(
      `/trainers/${encodeURIComponent(email)}/availability`,
      {
        params: date ? { date } : undefined,
      },
    );
  }

  getByEmail(email: string): Observable<Trainer> {
    return this.api.get<Trainer>(`/trainers/${encodeURIComponent(email)}`);
  }

  /** Clientes con reservas con el entrenador (solo el propio entrenador o un admin; si no, 403). */
  customers(email: string, context?: HttpContext): Observable<TrainerCustomer[]> {
    return this.api.get<TrainerCustomer[]>(`/trainers/${encodeURIComponent(email)}/customers`, {
      context,
    });
  }

  /** Reservas del entrenador: un día (`date`), un rango (`from`/`to`) o todas. */
  bookings(email: string, query: BookingQuery = {}, context?: HttpContext): Observable<Booking[]> {
    const params: Record<string, string> = {};
    for (const key of ['date', 'from', 'to'] as const) {
      if (query[key]) params[key] = query[key]!;
    }
    return this.api.get<Booking[]>(`/trainers/${encodeURIComponent(email)}/bookings`, {
      params,
      context,
    });
  }
}
