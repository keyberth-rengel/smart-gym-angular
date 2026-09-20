import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Trainer, TrainerAvailability, TrainerCreate } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class TrainersApi {
  private readonly api = inject(ApiClient);

  create(trainer: TrainerCreate): Observable<Trainer> {
    return this.api.post<Trainer>('/trainers', trainer);
  }

  /** Entrenadores ordenados por nombre; cualquier usuario autenticado. */
  list(): Observable<Trainer[]> {
    return this.api.get<Trainer[]>('/trainers');
  }

  /** Horas ocupadas del entrenador; `date` (yyyy-MM-dd) por defecto es hoy en el servidor. */
  availability(email: string, date?: string): Observable<TrainerAvailability> {
    return this.api.get<TrainerAvailability>(`/trainers/${encodeURIComponent(email)}/availability`, {
      params: date ? { date } : undefined,
    });
  }

  getByEmail(email: string): Observable<Trainer> {
    return this.api.get<Trainer>(`/trainers/${encodeURIComponent(email)}`);
  }
}
