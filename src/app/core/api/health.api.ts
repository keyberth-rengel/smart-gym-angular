import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Health } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class HealthApi {
  private readonly api = inject(ApiClient);

  check(context?: HttpContext): Observable<Health> {
    return this.api.get<Health>('/health', { context });
  }
}
