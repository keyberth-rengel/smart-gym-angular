# SmartGym · Frontend

Aplicación Angular para SmartGym (clientes, entrenadores, rutinas, reservas, asistencia y progreso).
Plan de trabajo: [PLAN.md](PLAN.md).

## Requisitos

- Node.js 20.19+, 22.12+ o 24+ y npm
- Backend SmartGym corriendo en `http://localhost:8080` (repo `smartgym` en Java)

> Se usa **Angular 21** porque Angular 22 exige Node >= 24.15.

## Instalar

```bash
npm install
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo en http://localhost:4200. El proxy (`proxy.conf.json`) reenvía `/api` a `http://localhost:8080`, así que no hace falta CORS en desarrollo |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run build` | Build de producción en `dist/smartgym` |

## Configuración

Las variables están en `src/environments/`:

- `apiBase`: prefijo del API (`/api/v1`).
- `clerkPublishableKey`: publishable key de Clerk (`pk_test_...` en desarrollo, ya configurada; `pk_live_...` en producción, pendiente de completar en `environment.ts`).

## Estructura de estilos

Tema oscuro con Bootstrap 5 (CSS compilado) y overrides propios en `src/styles/`:
`_tokens.scss` (variables `--sg-*`), `_bootstrap-overrides.scss` y `_base.scss`.

## Layout y componentes compartidos

- `src/app/shared/layout/`: `Shell` (skip link + navbar + menú + `<main>`), `Navbar` y `NavMenu`. A partir de 768 px
  el menú es un sidebar de 240 px; por debajo pasa a una barra de pestañas con scroll y la activa siempre visible.
- `src/app/core/nav/nav-items.ts`: ítems de navegación por rol (cliente, entrenador, admin).
- `src/app/shared/ui/`: `PageHeader`, `StatCard`, `Badge`, `EmptyState`, `Loading`, `DayPills`, `ConfirmService`
  (diálogo sobre `<dialog>` nativo: `confirm({ title, message, danger }) -> Promise<boolean>`), toasts y
  `PlaceholderPage` (marca las secciones que se construyen en fases posteriores).
- Las tres ramas de rutas (`/cliente`, `/entrenador`, `/admin`) cuelgan de `Shell`; sus hijos aún sin construir usan
  `PlaceholderPage`.

## Autenticación (Clerk)

Login, registro y sesión los maneja [Clerk](https://clerk.com) con el paquete comunitario
[`ngx-clerk`](https://github.com/anagstef/ngx-clerk) (no existe SDK oficial para Angular). Los textos
de Clerk van en español (`@clerk/localizations`) y su apariencia sigue el tema oscuro
(`src/app/core/auth/clerk.config.ts`).

### Claves

| Clave | Dónde | Notas |
|---|---|---|
| Publishable key (`pk_...`) | `src/environments/*.ts` | **Es pública**, se puede versionar. |
| Secret key (`sk_...`) | Solo backend (variable de entorno) | **Nunca** en este repo ni en el frontend. |

### Rutas y roles

- `/` lleva al inicio del rol (o a `/auth/sign-in` sin sesión).
- `/auth/sign-in/**` y `/auth/sign-up/**`: Clerk con *path routing*. Usa subrutas internas (verificación de
  correo, `sso-callback` de Google...), por eso el matcher `catchAllRoute` consume todos los segmentos.
- `/auth/onboarding`: primer ingreso de un cliente (nombre si Clerk no lo tiene, edad y DNI).
- `/cliente`, `/entrenador`, `/admin`: cada una exige sesión, el rol correspondiente y, para clientes, el perfil
  completo. Un rol no permitido vuelve a su propio inicio con un aviso.
- **Rol** = `public_metadata.role` del usuario en Clerk (`cliente`, `entrenador` o `admin`). Sin metadata es
  `cliente`: cualquiera puede registrarse; entrenadores y admins los asigna el administrador.

Para asignar un rol: Clerk Dashboard -> *Users* -> el usuario -> *Public metadata* -> `{"role": "admin"}`.

### Token hacia el backend

`auth-token.interceptor` agrega `Authorization: Bearer <JWT de Clerk>` a las peticiones a `apiBase`. El backend
aún no valida el token (pendiente B1 del plan). Para que el token lleve el rol, en Clerk Dashboard ->
*Sessions* -> *Customize session token* agregar:

```json
{ "role": "{{user.public_metadata.role}}", "email": "{{user.primary_email_address}}" }
```

### Usuarios de prueba

En la instancia de desarrollo, un correo con `+clerk_test` (por ejemplo `ana+clerk_test@example.com`) se verifica
con el código `424242` sin enviar correo ([doc](https://clerk.com/docs/guides/development/testing/test-emails-and-phones)).
El registro tiene protección contra bots (Cloudflare Turnstile): en pruebas automatizadas funciona con Chrome con
ventana, no en headless.

### `MeApi` interino

El backend todavía no tiene `GET /me` ni `POST /me/onboarding` (B2). Mientras tanto `core/api/me.api.ts`
los compone con endpoints existentes: el rol sale de Clerk, "perfil completo" es que exista
`GET /customers/{email}`, y el onboarding vincula el DNI (`POST /identity/customer`) y luego crea el cliente
(`POST /customers`). Antes de vincular comprueba que el DNI no pertenezca a otra cuenta, porque el backend
actual lo sobrescribiría sin avisar. Cuando exista B2 solo se reemplaza el cuerpo de `getMe()` y
`completeOnboarding()`.

### DNI del cliente (interino)

Los endpoints de rutina, progreso y asistencia usan el DNI en la URL, y el front no lo puede deducir del
correo. Por eso el onboarding lo guarda también en `user.unsafeMetadata.dni` de Clerk y `AuthService.dni()`
lo expone. Las cuentas que ya tenían perfil pero no tienen ese dato pasan por `/auth/confirm-dni`, que solo
acepta un DNI ya vinculado a su propio correo (`MeApi.confirmDni`). Cuando exista `GET /me` (B2) el DNI vendrá
del backend y este paso desaparece. `unsafeMetadata` lo puede editar el propio usuario: la autorización real
debe hacerla el backend (B8).

## Módulo Cliente

| Ruta | Pantalla | Endpoints |
|---|---|---|
| `/cliente/rutina` | Mi Rutina: plan activo por día e historial | `GET /routines/history/{dni}` (una sola llamada; la última rutina es la activa) |
| `/cliente/progreso` | Mi Progreso: métricas, gráfica, historial y registro | `GET /progress/{dni}`, `POST /progress` |
| `/cliente/asistencia` | Asistencia: marcar ingreso e historial | `POST /access`, `GET /attendance/{dni}` |

Cada pantalla tiene estados de carga (esqueleto), vacío y error con "Reintentar". El backend responde 422
(no 404) cuando no hay datos, y `ApiError.isNotFound` lo trata como vacío. El domingo no tiene plan y no se
consulta al API. En el registro de progreso el 409 (un registro por día) se muestra dentro del diálogo.
