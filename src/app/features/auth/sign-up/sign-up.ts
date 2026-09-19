import { Component } from '@angular/core';
import { ClerkSignUpComponent, SignUpProps } from 'ngx-clerk';
import { AuthLayout } from '../auth-layout/auth-layout';

const props: SignUpProps = {
  routing: 'path',
  path: '/auth/sign-up',
  signInUrl: '/auth/sign-in',
};

@Component({
  selector: 'app-sign-up',
  imports: [AuthLayout, ClerkSignUpComponent],
  template: `<app-auth-layout><clerk-sign-up [props]="props" /></app-auth-layout>`,
})
export class SignUp {
  protected readonly props = props;
}
