import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Booking, BookingCreate } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class BookingsApi {
  private readonly api = inject(ApiClient);

  /** El cuerpo lleva `date` (hoy local del cliente) para no depender del día UTC del servidor. */
  create(booking: BookingCreate, context?: HttpContext): Observable<Booking> {
    return this.api.post<Booking>('/bookings', booking, { context });
  }

  list(context?: HttpContext): Observable<Booking[]> {
    return this.api.get<Booking[]>('/bookings', { context });
  }

  /** `date` en formato yyyy-MM-dd (obligatoria en el backend actual). */
  listByTrainerAndDate(trainerEmail: string, date: string): Observable<Booking[]> {
    return this.api.get<Booking[]>(`/trainers/${encodeURIComponent(trainerEmail)}/bookings`, {
      params: { date },
    });
  }

  cancel(id: number, context?: HttpContext): Observable<void> {
    return this.api.delete(`/bookings/${id}`, { context });
  }
}
