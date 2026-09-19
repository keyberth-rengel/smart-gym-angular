import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Trainer, TrainerCreate } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class TrainersApi {
  private readonly api = inject(ApiClient);

  create(trainer: TrainerCreate): Observable<Trainer> {
    return this.api.post<Trainer>('/trainers', trainer);
  }

  getByEmail(email: string): Observable<Trainer> {
    return this.api.get<Trainer>(`/trainers/${encodeURIComponent(email)}`);
  }
}
