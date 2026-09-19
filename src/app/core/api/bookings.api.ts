import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Booking, BookingCreate } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class BookingsApi {
  private readonly api = inject(ApiClient);

  /** La fecha la asigna el servidor (hoy). */
  create(booking: BookingCreate, context?: HttpContext): Observable<Booking> {
    return this.api.post<Booking>('/bookings', booking, { context });
  }

  list(): Observable<Booking[]> {
    return this.api.get<Booking[]>('/bookings');
  }

  /** `date` en formato yyyy-MM-dd (obligatoria en el backend actual). */
  listByTrainerAndDate(trainerEmail: string, date: string): Observable<Booking[]> {
    return this.api.get<Booking[]>(`/trainers/${encodeURIComponent(trainerEmail)}/bookings`, {
      params: { date },
    });
  }

  cancel(id: number): Observable<void> {
    return this.api.delete(`/bookings/${id}`);
  }
}
