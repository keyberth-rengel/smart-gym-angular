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
- `clerkPublishableKey`: clave pública de Clerk (se completa en la fase F2).

## Estructura de estilos

Tema oscuro con Bootstrap 5 (CSS compilado) y overrides propios en `src/styles/`:
`_tokens.scss` (variables `--sg-*`), `_bootstrap-overrides.scss` y `_base.scss`.
La vista `features/dev/theme-preview` es temporal y sirve para validar el tema; se elimina al llegar las pantallas reales.
