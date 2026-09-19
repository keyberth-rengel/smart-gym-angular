import { Component } from '@angular/core';
import { ClerkSignInComponent, SignInProps } from 'ngx-clerk';
import { AuthLayout } from '../auth-layout/auth-layout';

/** Rutas con path routing: Clerk usa subrutas internas bajo `/auth/sign-in/**`. */
const props: SignInProps = {
  routing: 'path',
  path: '/auth/sign-in',
  signUpUrl: '/auth/sign-up',
};

@Component({
  selector: 'app-sign-in',
  imports: [AuthLayout, ClerkSignInComponent],
  template: `<app-auth-layout><clerk-sign-in [props]="props" /></app-auth-layout>`,
})
export class SignIn {
  protected readonly props = props;
}
