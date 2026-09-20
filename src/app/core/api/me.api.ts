import { HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SKIP_ERROR_TOAST } from '../http/error.interceptor';
import { Me, OnboardingInput } from '../models';
import { ApiClient } from './api-client';

/** Perfil del usuario autenticado: rol, DNI y estado del perfil, según el backend. */
@Injectable({ providedIn: 'root' })
export class MeApi {
  private readonly api = inject(ApiClient);

  /**
   * `GET /me`. Sin toast automático: quien lo llama (el `AuthService` y sus guards)
   * decide qué mostrar según el tipo de fallo.
   */
  getMe(): Observable<Me> {
    return this.api.get<Me>('/me', {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  /**
   * `POST /me/onboarding`: crea el cliente y vincula el DNI. Sin toast automático: el
   * formulario muestra el 400 y el 409 junto al campo y avisa por sí mismo del resto.
   */
  completeOnboarding(input: OnboardingInput): Observable<Me> {
    return this.api.post<Me>('/me/onboarding', input, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }
}
