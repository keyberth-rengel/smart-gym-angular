import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Identity, IdentityLinkRequest } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class IdentityApi {
  private readonly api = inject(ApiClient);

  linkCustomer(req: IdentityLinkRequest): Observable<Identity> {
    return this.api.post<Identity>('/identity/customer', req);
  }

  linkTrainer(req: IdentityLinkRequest): Observable<Identity> {
    return this.api.post<Identity>('/identity/trainer', req);
  }

  resolve(dni: string): Observable<Identity> {
    return this.api.get<Identity>(`/identity/${encodeURIComponent(dni)}`);
  }
}
