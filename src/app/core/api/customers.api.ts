import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Customer, CustomerCreate } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly api = inject(ApiClient);

  create(customer: CustomerCreate): Observable<Customer> {
    return this.api.post<Customer>('/customers', customer);
  }

  getByEmail(email: string): Observable<Customer> {
    return this.api.get<Customer>(`/customers/${encodeURIComponent(email)}`);
  }

  getByDni(dni: string): Observable<Customer> {
    return this.api.get<Customer>(`/customers/by-dni/${encodeURIComponent(dni)}`);
  }
}
