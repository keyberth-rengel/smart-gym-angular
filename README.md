# SmartGym · Frontend

Aplicación web para la gestión de un gimnasio: los **socios** consultan su rutina, registran su progreso, reservan con un
entrenador y marcan su asistencia; los **entrenadores** ven sus citas, sus clientes y les asignan rutinas; el
**personal de administración** gestiona clientes, entrenadores, reservas, rutinas y asistencia.

Proyecto del curso *Soluciones Web y Aplicaciones Distribuidas* (UPN). El diseño, el mapa de navegación y los wireframes
salen del informe del curso; el plan de trabajo y su estado están en [`PLAN.md`](PLAN.md).

## Arquitectura

```
 Navegador ── Angular 21 (este repo) ──┐            ┌── Clerk (login, registro, sesión, roles)
   Bootstrap 5, tema oscuro,           │  /api/v1   │
   mobile-first                        ├──────────► Spring Boot (backend Java, H2)
                                       │  Bearer JWT│   valida el JWT de Clerk (JWKS)
                                       └────────────┘   aplica permisos por rol
```

- **Frontend:** Angular 21 (componentes standalone, signals, `OnPush`), Bootstrap 5 + Bootstrap Icons con un tema oscuro
  propio (verde/azul), Reactive Forms.
- **Auth:** [Clerk](https://clerk.com) con el paquete comunitario [`ngx-clerk`](https://github.com/anagstef/ngx-clerk)
  (no hay SDK oficial para Angular). Clerk emite un JWT y el frontend lo envía en cada llamada al API.
- **Backend:** repositorio aparte (Java 17+, Spring Boot 3, Maven, H2). Es un *resource server* OAuth2: valida el JWT y
  decide qué puede ver cada rol. La UI **no es la barrera de seguridad**: oculta lo que no corresponde, pero el
  backend responde 403 a lo ajeno.
- **Sin NgRx:** el estado vive en signals dentro de servicios y componentes. La lógica se mantiene simple a propósito.

## Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | `^20.19`, `^22.12` o `>=24` (Angular 21) |
| npm | 10 o superior |
| Java (para el backend) | 17 o superior (probado con 25) |
| Cuenta de Clerk | instancia de desarrollo gratuita |

> **Angular 21 y no 22:** Angular 22 exige Node `>=24.15` (o `^22.22.3`). Con Node 24.14 no instala. Cuando actualices
> Node, se pasa a 22 con `ng update`.

## Cómo levantar todo

**1. Backend** (en el repo del backend, puerto 8080):

```bash
./mvnw spring-boot:run
# opcional: invitaciones reales a entrenadores
CLERK_SECRET_KEY=sk_test_... ./mvnw spring-boot:run
```

Propiedades relevantes del backend (todas con valor por defecto para desarrollo):

| Propiedad | Variable de entorno | Por defecto |
|---|---|---|
| `clerk.issuer` | `CLERK_ISSUER` | el issuer de la instancia de desarrollo |
| `smartgym.cors.allowed-origins` | `SMARTGYM_CORS_ALLOWED_ORIGINS` | `http://localhost:4200` |
| `clerk.secret-key` | `CLERK_SECRET_KEY` | vacía: las invitaciones quedan en `SKIPPED` |
| `clerk.invitation-redirect-url` | `CLERK_INVITATION_REDIRECT_URL` | `http://localhost:4200/auth/sign-up` |

**2. Frontend** (este repo, puerto 4200):

```bash
npm install
npm start          # ng serve; el proxy reenvía /api a http://localhost:8080
```

Abre <http://localhost:4200>. El proxy (`proxy.conf.json`) evita CORS en desarrollo.

## Configuración de Clerk, paso a paso

1. **Crear la aplicación** en el [Dashboard de Clerk](https://dashboard.clerk.com) y activar **solo correo + contraseña**
   como método de inicio de sesión. Si aparece **Google** activado, **desactívalo**: *User & authentication → Social
   connections* → apagar Google (el frontend no tiene lógica propia de Google; Clerk muestra solo lo que esté activo).
2. **Claves** (*API keys*): la *publishable key* (`pk_test_...`) va en `src/environments/environment.development.ts`
   (`clerkPublishableKey`). La *secret key* (`sk_test_...`) **solo** va en el backend, como variable de entorno.
3. **Session token**: en *Sessions → Customize session token* agregar

   ```json
   { "role": "{{user.public_metadata.role}}", "email": "{{user.primary_email_address}}" }
   ```

   El backend lee `email` para saber quién es y `role` para saber qué puede hacer. Sin este paso `/me` responde 403.
4. **Roles**: el rol vive en el `public_metadata` del usuario (`{"role": "entrenador"}` o `{"role": "admin"}`); sin rol
   se es **cliente**. Se cambia en *Users → usuario → Public metadata*. El rol viaja dentro del token, así que
   **el usuario debe cerrar sesión y volver a entrar** para que el cambio surta efecto.
5. **Usuarios de prueba**: los correos con `+clerk_test` (por ejemplo `sg-admin+clerk_test@example.com`) aceptan siempre el
   código de verificación `424242` en instancias de desarrollo. Los entrenadores se dan de alta desde el panel de
   administración (`Entrenadores → Registrar e invitar`) con el **mismo correo** de su cuenta de Clerk.

## Cuentas de prueba

Creadas en la instancia de desarrollo de Clerk para las pruebas de integración (login + dashboard) de cada rol,
usando los correos ya sembrados en `data.sql` del backend cuando aplica:

| Rol | Correo | Contraseña |
|---|---|---|
| Cliente | `alice@example.com` | `Smartgym2026Test!` |
| Entrenador | `mike@smartgym.com` | `Smartgym2026Test!` |
| Admin | `admin@smartgym.com` | `Smartgym2026Test!` |

> Son cuentas de una instancia de **desarrollo** de Clerk (`pk_test_...`), no de producción. Si este repo se publica,
> hay que rotar/eliminar estas cuentas y regenerar la Secret Key de Clerk (ver `PLAN.md` → Pendiente).

## Roles y permisos

| Rol | Rutas | Puede |
|---|---|---|
| **Cliente** | `/cliente`, `/cliente/rutina`, `/cliente/progreso`, `/cliente/reservas`, `/cliente/asistencia` | Ver su rutina y su historial, registrar y ver su progreso, reservar con un entrenador (solo para hoy), marcar su asistencia |
| **Entrenador** | `/entrenador`, `/entrenador/citas`, `/entrenador/clientes`, `/entrenador/rutinas` | Ver sus citas por semana, ver **sus** clientes (los que reservaron con él) con su progreso y rutina, asignarles rutina, marcar su asistencia |
| **Admin** | `/admin`, `/admin/clientes`, `/admin/entrenadores`, `/admin/reservas`, `/admin/rutinas`, `/admin/asistencia` | Todo: alta de clientes y entrenadores (con invitación), ver y cancelar reservas, asignar rutinas y registrar ingresos por DNI |

Un usuario que abre una ruta de otro rol vuelve a su inicio con el aviso "No tienes permisos para acceder a esa sección".
En el primer ingreso, un cliente pasa por **Completar perfil** (nombre, edad y DNI de 8 dígitos).

## Estructura del proyecto

```
src/
├── app/
│   ├── core/                 # lógica sin pantalla
│   │   ├── api/              # un servicio por recurso (customers, trainers, bookings, routines, progress, attendance, me, health)
│   │   ├── auth/             # AuthService (rol y perfil desde /me), guards, configuración de Clerk
│   │   ├── http/             # interceptores (token y errores → toasts), traducción de mensajes del backend
│   │   ├── models/           # tipos de las respuestas del API
│   │   ├── nav/              # menú por rol
│   │   ├── router/           # título de la pestaña por pantalla
│   │   └── util/             # fechas, bloques de rutina, horarios, validadores y vistas puras (semana, filtros)
│   ├── shared/
│   │   ├── layout/           # shell, navbar y menú (sidebar en escritorio, pestañas en móvil)
│   │   └── ui/               # badge, stat-card, empty-state, loading, day-pills, sparkline, plan-grid, toast, confirm...
│   ├── features/
│   │   ├── auth/             # inicio de sesión, registro, completar perfil, servicio no disponible
│   │   ├── cliente/          # dashboard, rutina, progreso, reservas, asistencia
│   │   ├── entrenador/       # dashboard, citas, clientes, rutinas
│   │   └── admin/            # dashboard, clientes, entrenadores, reservas, rutinas, asistencia (+ shared/)
│   └── testing/              # dobles de prueba (Clerk, /me, diálogos)
├── environments/             # environment.ts (producción) y environment.development.ts
└── styles/                   # tokens, overrides de Bootstrap y base del tema
```

Las rutas se cargan de forma diferida (un *chunk* por pantalla) y cada rama de rol usa `authGuard`, `roleGuard` y
`profileCompleteGuard`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo en :4200 con proxy a :8080 |
| `npm run build` | Build de producción en `dist/smartgym/browser` |
| `npm test` | Pruebas unitarias (Vitest) en modo interactivo; `npx ng test --watch=false` para una sola pasada |
| `npm run lint` | ESLint (`angular-eslint`) sobre TypeScript y plantillas |
| `npm run format` / `format:check` | Prettier sobre `src` |

## Pruebas y verificación

- **Unitarias:** 724 pruebas en 52 archivos (servicios, guards, interceptores, validadores, utilidades y componentes).
- **Navegador real** (Chrome con Playwright, backend real y JWT reales de Clerk con las tres cuentas de rol), fase por fase:
  escenarios de cada pantalla, errores del servidor (400/403/404/409/422/500 y red caída), estados vacío/cargando/error,
  teclado y foco, contraste AA, 1280/768/390 px sin scroll horizontal.
- **Barrido final (F7):** todas las rutas de los tres roles en los tres anchos con `axe-core` (WCAG 2 A/AA y buenas
  prácticas): 0 violaciones; títulos de pestaña únicos por pantalla; cada pantalla con datos probada con el API en 500,
  con listas vacías y con respuestas lentas; y un humo de extremo a extremo (el cliente reserva → el entrenador ve la
  cita → el admin la cancela → la hora queda libre).

## Despliegue

`npm run build` genera archivos estáticos en `dist/smartgym/browser`. Tamaño del build inicial: ~700 kB sin comprimir
(~137 kB transferidos); cada pantalla es un *chunk* aparte.

1. **Publishable key de producción:** completa `clerkPublishableKey` en `src/environments/environment.ts` con la clave
   `pk_live_...` de la instancia de producción de Clerk **antes** de compilar (es pública, no un secreto). Sin ella Clerk no inicia.
2. **API:** `apiBase` es `/api/v1` (relativo). Sirve el frontend y el backend bajo el **mismo dominio** con un proxy inverso que
   reenvíe `/api` al backend y devuelva `index.html` en cualquier otra ruta (es una SPA). Ejemplo con nginx:

   ```nginx
   server {
     listen 80;
     root /var/www/smartgym;            # contenido de dist/smartgym/browser
     location /api/ { proxy_pass http://127.0.0.1:8080; }
     location /      { try_files $uri /index.html; }
   }
   ```

   Si el backend vive en otro dominio, cambia `apiBase` por su URL completa y agrega ese origen del frontend en
   `smartgym.cors.allowed-origins` del backend.
3. **Backend en producción:** apunta `CLERK_ISSUER` al *Frontend API URL* de la instancia de producción y define
   `CLERK_SECRET_KEY` solo allí.
4. **Clerk en producción:** repite el session token con `role` y `email`, y agrega el dominio a los orígenes permitidos.

## Limitaciones conocidas

- **Las reservas son para hoy:** la fecha la fija el servidor (no hay agenda a futuro); los horarios pasados se ocultan.
- **Horario del servidor:** las horas pasadas se ocultan con el reloj del navegador y el backend usa su propia zona
  horaria (America/Lima); con zonas distintas puede haber desfase.
- **Invitaciones de entrenadores:** las invitaciones reales dependen de `CLERK_SECRET_KEY` en el backend; sin ella el alta
  funciona y la invitación queda como "no configurada". Los estados `INVITED`, `ROLE_UPDATED` y `FAILED` se probaron
  simulando la respuesta del backend, no contra Clerk.
- **Registro con Turnstile:** el registro de Clerk usa Cloudflare Turnstile, que bloquea los navegadores automatizados
  en modo *headless*; las pruebas automatizadas inician sesión con cuentas ya creadas.
- **Cambio de rol:** requiere cerrar y abrir sesión (el rol va dentro del token).
