import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClerk } from 'ngx-clerk';

import { routes } from './app.routes';
import { clerkOptions } from './core/auth/clerk.config';
import { authTokenInterceptor } from './core/http/auth-token.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClerk(clerkOptions()),
    // El token va primero; el de errores envuelve la respuesta.
    provideHttpClient(withInterceptors([authTokenInterceptor, errorInterceptor])),
  ],
};
