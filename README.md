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
| `/cliente` | Dashboard: 4 tarjetas (rutina de hoy, próxima reserva, progreso, asistencia) y acceso rápido a asistencia | `GET /routines/history/{dni}`, `GET /bookings`, `GET /trainers`, `GET /progress/{dni}`, `GET /attendance/{dni}` |
| `/cliente/rutina` | Mi Rutina: plan activo por día e historial | `GET /routines/history/{dni}` (una sola llamada; la última rutina es la activa) |
| `/cliente/progreso` | Mi Progreso: métricas, gráfica, historial y registro | `GET /progress/{dni}`, `POST /progress` |
| `/cliente/reservas` | Reservas: nueva reserva con un entrenador y "Mis reservas" | `GET /trainers`, `GET /trainers/{email}/availability`, `GET /bookings`, `POST /bookings` |
| `/cliente/asistencia` | Asistencia: marcar ingreso e historial | `POST /access`, `GET /attendance/{dni}` |

Cada pantalla tiene estados de carga (esqueleto), vacío y error con "Reintentar". `ApiError.isNotFound` cubre el
404 actual y el 422 de versiones anteriores del backend, y se trata como vacío. El domingo no tiene plan y no se
consulta al API. En el registro de progreso el 409 (un registro por día) se muestra dentro del diálogo.

### Reservas y Dashboard

- **Horas:** chips cada 30 minutos de 06:00 a 21:30 (`SLOT_START`, `SLOT_END`, `SLOT_STEP_MIN` en
  `core/util/booking-slots.ts`). Las horas pasadas se ocultan según el reloj del navegador (el backend rechaza con
  422 una hora anterior al instante actual, en la zona horaria del servidor) y se refrescan cada 30 s. Las ocupadas
  vienen de `availability`, que solo devuelve horas y no expone datos de otros clientes.
- **Fecha:** la fija el servidor (hoy); la pantalla solo la muestra.
- **Errores al crear:** 409 (horario ocupado) y 422 (hora pasada) los avisa el interceptor con un toast y la pantalla
  recarga la disponibilidad; 404 (el entrenador ya no existe) muestra un aviso y recarga la lista de entrenadores.
- **Dashboard:** cada tarjeta carga y falla por separado (`StatCard` con `status`: esqueleto, "No disponible" con
  "Reintentar"). Los toasts idénticos se funden en uno, para que un backend caído no apile cuatro avisos.

## Módulo Entrenador

| Ruta | Pantalla | Endpoints |
|---|---|---|
| `/entrenador` | Dashboard: citas de hoy, clientes asociados, próxima cita, agenda de hoy y "Marcar asistencia" | `GET /trainers/{email}/bookings?date=`, `GET /trainers/{email}/customers`, `POST /access` |
| `/entrenador/citas` | Mis citas: tira semanal (lunes a domingo, con semana anterior/siguiente) y las citas del día elegido | `GET /trainers/{email}/bookings?from=&to=` (una llamada por semana), `GET /trainers/{email}/customers` (solo para los nombres) |
| `/entrenador/clientes` | Mis clientes: tabla con búsqueda y detalle (último progreso y rutina activa) | `GET /trainers/{email}/customers`, `GET /progress/by-email/{email}`, `GET /routines/by-email/{email}/history` |
| `/entrenador/rutinas` | Rutinas: elegir un cliente, ver su rutina activa e historial y asignar una nueva | `GET /trainers/{email}/customers`, `GET /routines/by-email/{email}/history`, `POST /routines/assign` (`{customer_email}`) |

- **Quién es el entrenador:** el correo sale de la sesión (`AuthService.email()`), y el backend solo deja consultar
  los endpoints del propio entrenador (otro o un cliente recibe **403**; el rol se valida antes que la existencia).
  "Cliente asociado" es quien tiene al menos una reserva con él.
- **Nombres:** las reservas solo traen correos; los nombres se resuelven con `GET /trainers/{email}/customers`. Si
  esa lista no carga, se muestran los correos y la pantalla sigue funcionando.
- **Dashboard:** la tercera tarjeta es "Próxima cita" y no "Rutinas activas" del diseño: no existe un endpoint
  agregado y obtenerlo implicaría una llamada por cliente. "Marcar asistencia" usa el DNI de `/me`; si es `null`, el
  botón queda deshabilitado con el aviso "Tu DNI no está vinculado; pídelo en recepción".
- **Mis clientes:** el detalle carga el progreso y la rutina por separado con `SKIP_ERROR_TOAST` (cada bloque muestra
  su propio error, "Sin acceso a este cliente" en 403 y "Reintentar"). Elegir otro cliente cancela las peticiones del
  anterior. En pantallas < 992 px se oculta la columna del correo.
- **Rutinas:** `?cliente=<correo>` preselecciona al cliente (solo si es suyo). Si ya tiene una rutina activa, se pide
  confirmación (`ConfirmService`) porque la nueva reemplaza a la activa; el botón sigue habilitado mientras el
  diálogo está abierto, para que este devuelva el foco a un control activo. 403 y 404 se muestran en pantalla; 5xx y
  red caída, como toast.
- **Componentes compartidos nuevos:** `PlanGrid` (plan lunes a sábado en 3 x 2) y `RoutineHistory` (historial con
  Activa/Anterior), que también usa Mi Rutina del cliente.

Los roles de las pruebas con navegador se simularon interceptando `GET /me` (los JWT de la cuenta de prueba
traen `role: null`). Con un entrenador real de Clerk falta comprobar los datos reales de los endpoints del entrenador.

## Módulo Admin

| Ruta | Pantalla | Endpoints |
|---|---|---|
| `/admin` | Dashboard: estado del servicio, 5 accesos a módulos y reservas de hoy | `GET /health`, `GET /bookings`, `GET /customers` y `GET /trainers` (solo para los nombres) |
| `/admin/clientes` | Clientes: registrar un cliente (DNI opcional) y consultar el padrón con búsqueda | `GET /customers`, `POST /customers` (`{name,email,age,dni?}`) |
| `/admin/entrenadores` | Entrenadores: registrar e invitar por Clerk, consultar el equipo y reenviar invitaciones | `GET /trainers`, `POST /trainers` (`{name,email,age,specialty?,dni?}`), `POST /trainers/{email}/invite` |
| `/admin/reservas` | Reservas: consultar con filtros (entrenador y fecha) y cancelar | `GET /bookings`, `DELETE /bookings/{id}`, `GET /customers` y `GET /trainers` (solo nombres) |
| `/admin/rutinas` | Rutinas: asignar un plan semanal por DNI y ver la rutina activa y el historial | `POST /routines/assign` (`{dni}`), `GET /routines/history/{dni}`, `GET /identity/{dni}` (correo), `GET /customers/by-dni/{dni}` |
| `/admin/asistencia` | Control de asistencia: registrar el ingreso de un socio o entrenador por DNI y ver su historial | `POST /access` (`{dni}`), `GET /attendance/{dni}` |

- **Acceso:** el rol `admin` viene del claim `role` del token de Clerk (se fija en `public_metadata.role` del usuario).
  Los endpoints de admin responden **403** a clientes y entrenadores; la pantalla lo muestra como error con
  "Reintentar" (listas) o como toast "Sin permisos" (registro), sin perder lo escrito en el formulario.
- **Estado del servicio:** `GET /health` se consulta sin toast; un fallo (red, 5xx o `status` distinto de `UP`) se
  muestra como "Sin conexión" y un clic vuelve a comprobarlo.
- **Reservas de hoy:** solo las de la fecha de hoy, por hora. Los nombres salen de `/customers` y `/trainers`; si
  alguna de las dos llamadas falla, la tabla muestra los correos (sin error propio). Cada bloque carga por separado.
- **Clientes y entrenadores comparten** `RegistryList` (tabla con búsqueda sin acentos ni mayúsculas, estados de
  carga/vacío/error y una acción opcional por fila) y los estilos de `features/admin/shared/`. Por debajo de 1200 px el
  formulario queda arriba y la tabla debajo.
- **Errores del registro:** un 409 se muestra junto al campo (correo repetido, o DNI ya vinculado a otro correo: el
  backend responde `DNI already linked to another email: <dni>` y no crea nada) y un 400 con `error.details` junto a cada
  campo; red caída, 5xx y 403 salen como toast. Sin doble envío.
- **Invitación de entrenadores:** `POST /trainers` devuelve `invitation.status` (`message` es un código estable, no
  un texto): `INVITED` y `ROLE_UPDATED` => toast de éxito (este último avisa de que la persona debe cerrar y abrir
  sesión), `SKIPPED` (el backend no tiene `CLERK_SECRET_KEY`) => aviso ámbar persistente en el formulario y `FAILED` =>
  aviso rojo; en ambos el entrenador queda registrado y se puede reenviar la invitación desde la tabla.

Verificado con las cuentas reales de Clerk (admin, entrenador y cliente) contra el backend real: `role` en el JWT,
`/me`, altas, 409 reales y la matriz de permisos. Como el backend de pruebas no tiene `CLERK_SECRET_KEY`, los estados
`INVITED`, `ROLE_UPDATED` y `FAILED` se comprobaron simulando solo esa respuesta.

### Reservas, Rutinas y Asistencia

- **Reservas:** una sola llamada a `GET /bookings` (el admin recibe todas; a clientes y entrenadores el backend
  les filtra las suyas) y los filtros se aplican en el navegador: entrenador (la lista sale de `/trainers`; si falla, de
  los correos de las reservas) y fecha (por defecto **hoy**; vaciarla muestra todas). "Filtrar" vuelve a pedir los
  datos. Más reciente primero; los nombres se resuelven con `/customers` y `/trainers` y, si fallan, se ven los correos.
  "Cancelar" abre una confirmación de peligro con el detalle ("Hoy 16:30 · Cliente con Entrenador"); Esc o "Volver" no
  cancelan. Un 404 (ya cancelada por otro) avisa y recarga; red caída y 5xx dejan la fila y avisan por toast. Tras
  cancelar, el foco pasa al título de la tarjeta. Un 403 en la carga habla de permisos, no de la conexión.
- **`DniPanel`** (`features/admin/shared`) lo comparten Rutinas y Asistencia: campo de DNI de 8 dígitos validado antes de
  enviar, dos acciones, indicador en la acción en curso y ambos botones deshabilitados mientras dura. El error del
  servidor para ese DNI llega bajo el campo. **Enter** ejecuta la acción principal, salvo en Rutinas, donde consulta el
  historial (para no asignar una rutina sin querer).
- **Rutinas:** "Asignar rutina" (`{dni}`; si ya se muestra una rutina activa de ese DNI pide confirmación, porque la
  reemplaza) y "Ver historial" (la última es la activa). El correo se resuelve con `/identity/{dni}` y, si no se puede,
  se muestra el DNI. Si el historial viene vacío se comprueba con `/customers/by-dni/{dni}` que el DNI sea de un
  cliente: el backend responde `200 []` también para el de un entrenador.
- **Asistencia:** "Registrar ingreso" muestra la bienvenida en español (se arma con el nombre y el correo que trae el
  texto en inglés del backend) y refresca el historial; el historial va más reciente primero con el rol (Cliente /
  Entrenador).
- **DNI no vinculado** (404) se marca bajo el campo; un DNI que no es de cliente, o un vínculo sin perfil, sale como
  aviso general. En ambos casos se limpia el resultado anterior: lo que se ve siempre corresponde al DNI consultado.
- **Tablas anchas:** `.table-responsive` es ahora el bloque contenedor de sus elementos absolutos (el `th` oculto de
  "Acciones"); sin eso una tabla más ancha que su tarjeta ensanchaba toda la página.
