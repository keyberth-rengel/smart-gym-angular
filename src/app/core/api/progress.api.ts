import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ProgressCreate, ProgressItem, ProgressList } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class ProgressApi {
  private readonly api = inject(ApiClient);

  /** Se envía en camelCase; un solo registro por cliente y día (409 si ya existe). */
  add(progress: ProgressCreate): Observable<ProgressItem> {
    return this.api.post<ProgressItem>('/progress', progress);
  }

  list(dni: string): Observable<ProgressList> {
    return this.api.get<ProgressList>(`/progress/${encodeURIComponent(dni)}`);
  }
}
