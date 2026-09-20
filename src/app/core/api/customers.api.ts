import { Injectable, inject } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Customer, CustomerCreate } from '../models';
import { ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly api = inject(ApiClient);

  /** Solo ADMIN; con `dni` también vincula el DNI al correo. */
  create(customer: CustomerCreate, context?: HttpContext): Observable<Customer> {
    return this.api.post<Customer>('/customers', customer, { context });
  }

  /** Clientes ordenados por nombre; solo ADMIN (otros roles reciben 403). */
  list(context?: HttpContext): Observable<Customer[]> {
    return this.api.get<Customer[]>('/customers', { context });
  }

  getByEmail(email: string): Observable<Customer> {
    return this.api.get<Customer>(`/customers/${encodeURIComponent(email)}`);
  }

  getByDni(dni: string): Observable<Customer> {
    return this.api.get<Customer>(`/customers/by-dni/${encodeURIComponent(dni)}`);
  }
}
