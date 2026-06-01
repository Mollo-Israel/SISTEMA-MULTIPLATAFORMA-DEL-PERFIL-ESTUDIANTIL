# Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico

Ingeniería en Sistemas Informáticos – Univalle. Implementación del **30% inicial**.

Plataforma complementaria (no reemplaza SIU, Teams, notas ni certificados oficiales) que construye un perfil estudiantil dinámico a partir de intereses, habilidades, proyectos, actividades, participación, evidencias, constancias y áreas de afinidad.

## Stack

| Capa | Tecnología |
|------|-----------|
| API central | NestJS + TypeScript + TypeORM |
| Base de datos | PostgreSQL (vía Docker) |
| Frontend web | React + Vite |
| App móvil | React Native + Expo |
| Tipos compartidos | Paquete `shared/` |
| Autenticación | JWT + control de acceso por roles |

## Estructura del monorepo

```
.
├── api/      API central NestJS (consumida por web y móvil)
├── web/      Frontend React
├── mobile/   App React Native + Expo
├── shared/   Tipos, enums y DTOs compartidos
├── docker/   docker-compose para PostgreSQL
└── docs/     Documentación y diagnóstico técnico
```

## Roles

Estudiante · Docente · Director de carrera · Representante de sociedad científica · Administrador.

## Guía rápida para colaboradores

Requisitos previos:
- **Node 18+** y **npm**
- **Docker Desktop** (para PostgreSQL) — debe estar abierto
- Para la app móvil: **Expo Go** (Play Store / App Store) o un emulador

Los tres clientes (API, web, móvil) consumen la **misma API** con el **mismo JWT**.

### Paso 1 — Preparación (una sola vez)

```bash
# En la raíz del proyecto:
cp .env.example .env          # variables de entorno (valores por defecto sirven)

npm install                   # dependencias backend (workspaces: shared + api)
npm install --prefix web      # dependencias web
npm install --prefix mobile   # dependencias móvil (Expo)

npm run db:up                 # levanta PostgreSQL en Docker
npm run shared:build          # compila tipos compartidos
npm run api:migrate           # crea las tablas (migraciones)
npm run seed:populate         # POBLA la base con datos institucionales realistas
```

`seed:populate` deja la base lista con **21 usuarios** (1 administrador, 2 docentes,
1 director, 1 sociedad científica y 16 estudiantes), 9 actividades, 8 proyectos con
evidencias, 6 certificados externos, constancias internas, participaciones en sus tres
estados y **áreas de afinidad calculadas** con el motor real.

### Paso 2 — Levantar los 3 servicios (una terminal cada uno)

```bash
# Terminal 1 — API (backend)
npm run api:dev        # http://localhost:3000/api   ·   Swagger: http://localhost:3000/api/docs

# Terminal 2 — Web
npm run web:dev        # http://localhost:5173

# Terminal 3 — Móvil (Expo)
npm run mobile:start   # abre Expo; escanea el QR con Expo Go
```

> **Móvil:** la app necesita alcanzar la API por red. Edita `mobile/.env`:
> - Emulador Android: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api`
> - Celular físico (misma Wi‑Fi): `EXPO_PUBLIC_API_URL=http://TU_IP_LAN:3000/api` (averígua tu IP con `ipconfig`)
> Si el celular no conecta por firewall, usa `cd mobile && npx expo start --tunnel`.

### Cuentas para iniciar sesión

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Administrador (único) | `admin@univalle.edu` | `Admin123*` |
| Docente | `carlos.perez@univalle.edu` | `Univalle2026*` |
| Docente | `maria.gutierrez@univalle.edu` | `Univalle2026*` |
| Director de carrera | `jorge.vargas@univalle.edu` | `Univalle2026*` |
| Sociedad científica | `lucia.fernandez@univalle.edu` | `Univalle2026*` |
| Estudiante (ejemplo) | `ana.quispe@est.univalle.edu` | `Univalle2026*` |

Hay 16 estudiantes con el patrón `nombre.apellido@est.univalle.edu` y contraseña
`Univalle2026*`. Los estudiantes nuevos también pueden **registrarse** desde la web
(requieren correo terminado en `univalle.edu`).

> Si reinicias el PC, basta con `npm run db:up` para recuperar la base (los datos persisten).
> Para reconstruir la base desde cero: `npm run db:reset && npm run api:migrate && npm run seed:populate`.

## Pruebas automáticas (opcional)

```bash
npm run api:dev      # en una terminal
npm run test:api     # en otra: 39 validaciones de backend (deben dar 0 fallos)
```

## Flujo principal (end-to-end)

1. Admin confirma roles y áreas académicas (y puede crear áreas/habilidades).
2. Estudiante se registra e inicia sesión.
3. Estudiante crea su perfil dinámico.
4. Estudiante registra intereses (por área) y habilidades (con nivel).
5. Docente publica actividad académica; sociedad científica, extracurricular.
6. Estudiante consulta actividades (web o móvil).
7. Estudiante registra interés o inscripción.
8. Docente/sociedad confirma participación (el estudiante no puede confirmar la suya).
9. Estudiante registra proyecto académico.
10. Estudiante adjunta evidencia (enlace o archivo).
11. El motor de afinidad recalcula tras cada cambio relevante (backend).
12. Estudiante visualiza sus áreas de afinidad.
13. Docente consulta el perfil permitido (sin datos sensibles ni notas).
14. Director consulta reportes básicos y mapa de afinidad.

## Scripts útiles (raíz)

| Script | Descripción |
|--------|-------------|
| `npm run db:up` / `db:down` | Levanta/apaga PostgreSQL (Docker) |
| `npm run db:reset` | Reinicia PostgreSQL desde cero (borra el volumen) |
| `npm run api:build` / `api:dev` | Compila / ejecuta la API |
| `npm run api:migrate` | Aplica migraciones TypeORM |
| `npm run seed` | Seeds base (roles, áreas, habilidades, admin) |
| `npm run seed:populate` | Pobla la base con cuentas institucionales y datos amplios |
| `npm run test:api` | 39 validaciones de backend contra la API |
| `npm run web:dev` | Servidor de desarrollo web |
| `npm run mobile:start` | Inicia Expo (app móvil) |

## Alcance del 30% inicial

Incluye: autenticación con roles, perfil dinámico, intereses/habilidades/áreas,
proyectos con evidencias, actividades y participación, certificados externos y
constancias internas básicas, motor de afinidad inicial, reportes básicos, y
clientes web + móvil sobre la misma API.

No incluye todavía: chat, QR de contactos, equipos avanzados, recomendación
completa, gamificación completa, analítica avanzada, predicción de rendimiento,
certificados oficiales, ni integración real con SIU/Teams.
