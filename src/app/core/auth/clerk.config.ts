import { ClerkInitOptions } from 'ngx-clerk';
import { esES } from '@clerk/localizations';
import { environment } from '../../../environments/environment';
import { SIGN_IN_PATH } from './roles';

/** Apariencia oscura de los componentes de Clerk, acorde al tema de SmartGym. */
const appearance = {
  variables: {
    colorPrimary: '#34d399',
    colorPrimaryForeground: '#04150d',
    colorTextOnPrimaryBackground: '#04150d',
    colorBackground: '#121d18',
    colorForeground: '#eaf3ee',
    colorText: '#eaf3ee',
    colorMutedForeground: '#9fb5aa',
    colorTextSecondary: '#9fb5aa',
    colorInput: '#0b1310',
    colorInputBackground: '#0b1310',
    colorInputForeground: '#eaf3ee',
    colorInputText: '#eaf3ee',
    colorNeutral: '#eaf3ee',
    colorDanger: '#ff9a9a',
    borderRadius: '12px',
    fontFamily: "'Barlow', system-ui, sans-serif",
    fontFamilyButtons: "'Barlow', system-ui, sans-serif",
  },
  elements: {
    cardBox: { boxShadow: 'none', border: '1px solid #25382f', borderRadius: '20px' },
    headerTitle: {
      fontFamily: "'Barlow Condensed', 'Barlow', sans-serif",
      fontWeight: 700,
      fontSize: '2rem',
    },
    formFieldInput: { borderColor: '#587566' },
    footer: { background: 'transparent' },
  },
};

export function clerkOptions(): ClerkInitOptions {
  return {
    publishableKey: environment.clerkPublishableKey,
    signInUrl: SIGN_IN_PATH,
    signUpUrl: '/auth/sign-up',
    // Tras iniciar sesión o registrarse, "/" decide el destino según el rol.
    signInFallbackRedirectUrl: '/',
    signUpFallbackRedirectUrl: '/',
    afterSignOutUrl: SIGN_IN_PATH,
    localization: esES,
    appearance,
  };
}
