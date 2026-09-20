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
- **Rol**: lo devuelve el backend en `GET /me`, que lo toma del claim `role` del token de Clerk (es decir, de
  `public_metadata.role` del usuario: `cliente`, `entrenador` o `admin`). Sin valor es `cliente`: cualquiera
  puede registrarse; entrenadores y admins los asigna el administrador. El front no lee `public_metadata`.

Para asignar un rol: Clerk Dashboard -> *Users* -> el usuario -> *Public metadata* -> `{"role": "admin"}`.
**Un cambio de rol solo se ve al cerrar sesión y volver a entrar**, porque el rol viaja dentro del token de
sesión, que Clerk refresca al iniciar sesión.

### Token hacia el backend

`auth-token.interceptor` agrega `Authorization: Bearer <JWT de Clerk>` a las peticiones a `apiBase`, y el backend
lo valida (B1). Para que el token lleve el rol y el correo, en Clerk Dashboard -> *Sessions* -> *Customize
session token* debe estar:

```json
{ "role": "{{user.public_metadata.role}}", "email": "{{user.primary_email_address}}" }
```

### Usuarios de prueba

En la instancia de desarrollo, un correo con `+clerk_test` (por ejemplo `ana+clerk_test@example.com`) se verifica
con el código `424242` sin enviar correo ([doc](https://clerk.com/docs/guides/development/testing/test-emails-and-phones)).
El registro tiene protección contra bots (Cloudflare Turnstile): en pruebas automatizadas funciona con Chrome con
ventana, no en headless.

### Perfil desde el backend (`/me`)

`core/api/me.api.ts` usa `GET /me` y `POST /me/onboarding`. `AuthService` carga `/me` una vez tras iniciar sesión
(las llamadas simultáneas de los guards comparten una sola petición) y de ahí salen el **rol**, el **nombre**,
el **DNI** y `profile_complete`; el DNI ya no se guarda en Clerk.

| Respuesta de `/me` | Qué hace la app |
|---|---|
| Cliente con `profile_complete: false` | `/auth/onboarding` (nombre si falta, edad y DNI -> `POST /me/onboarding`) |
| Cliente completo / admin | Su inicio (`/cliente`, `/admin`) |
| Entrenador sin perfil registrado | `/auth/unavailable` ("Registro pendiente": lo registra el administrador) |
| 401 | Cierra la sesión de Clerk y vuelve a `/auth/sign-in` |
| 403 (el token no trae el correo) | `/auth/unavailable` ("Sesión incompleta") |
| 5xx o sin red | `/auth/unavailable` con "Reintentar" |
| Clerk no carga en 15 s (su script viene de un CDN) | `/auth/unavailable` ("No pudimos iniciar tu sesión"); "Reintentar" recarga la página. Antes los guards esperaban para siempre y la app quedaba en blanco |

En el onboarding, un 409 (DNI de otra cuenta, o cuenta con otro DNI) se muestra junto al campo DNI.

## Módulo Cliente

| Ruta | Pantalla | Endpoints |
|---|---|---|
| `/cliente/rutina` | Mi Rutina: plan activo por día e historial | `GET /routines/history/{dni}` (una sola llamada; la última rutina es la activa) |
| `/cliente/progreso` | Mi Progreso: métricas, gráfica, historial y registro | `GET /progress/{dni}`, `POST /progress` |
| `/cliente/asistencia` | Asistencia: marcar ingreso e historial | `POST /access`, `GET /attendance/{dni}` |

Cada pantalla tiene estados de carga (esqueleto), vacío y error con "Reintentar". El backend responde 422
(no 404) cuando no hay datos, y `ApiError.isNotFound` lo trata como vacío. El domingo no tiene plan y no se
consulta al API. En el registro de progreso el 409 (un registro por día) se muestra dentro del diálogo.
