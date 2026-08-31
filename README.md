# Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico

Ingeniería en Sistemas Informáticos – Univalle. Implementación del **40 %**:
los cuatro primeros objetivos específicos, completos de extremo a extremo.

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

## Roles y responsabilidades

| Rol | Qué hace en el sistema |
|-----|------------------------|
| **Estudiante** | Se registra, construye su perfil dinámico, se inscribe en actividades, registra proyectos, evidencias y certificados externos |
| **Docente** | Consulta la oferta de actividades y los perfiles de **los semestres que el administrador le habilita** |
| **Director de carrera** | Gestiona las **actividades académicas**, registra participación y emite las **constancias internas** |
| **Sociedad científica** | Gestiona las **actividades extracurriculares** y registra participación |
| **Administrador** | Usuarios institucionales, roles y estados, semestres habilitados, catálogos y criterios de gamificación |

## Guía rápida para colaboradores

Requisitos previos:
- **Node 18+** y **npm**
- **Docker Desktop** (para PostgreSQL) — debe estar abierto
- Para la app móvil: **Expo Go** (Play Store / App Store) o un emulador

Los tres clientes (API, web, móvil) consumen la **misma API** con el **mismo JWT**.

### Paso 1 — Preparación (una sola vez)

```bash
# En la raíz del proyecto:
cp .env.example .env          # variables de entorno (valores por defecto sirven en desarrollo)

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
| Docente (semestres 1–4) | `carlos.perez@univalle.edu` | `Univalle2026*` |
| Docente (semestres 5–8) | `maria.gutierrez@univalle.edu` | `Univalle2026*` |
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

# en otra terminal:
npm run test:40      # 179 verificaciones de los 4 objetivos  -> 0 fallos
npm run test:api     # 42 validaciones de backend             -> 0 fallos
npm run demo:e2e     # flujo completo de 14 pasos             -> 0 fallos
```

En total **246 verificaciones** contra la API real, sobre una base recreada desde cero.

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
| `npm run test:40` | **179 verificaciones de los 4 objetivos del 40 %** |
| `npm run test:api` | 42 validaciones de backend contra la API |
| `npm run demo:e2e` | Flujo completo de 14 pasos |
| `npm run web:dev` | Servidor de desarrollo web |
| `npm run mobile:start` | Inicia Expo (app móvil) |

## Alcance del 40 %

Los cuatro primeros objetivos específicos están implementados de extremo a extremo:

1. **Usuarios, autenticación, roles y control de acceso.** Registro de estudiante
   con rol asignado por el servidor, sesión por rol, alta de usuarios
   institucionales, activación y desactivación efectiva (un usuario desactivado
   pierde acceso de inmediato, aunque su token siga vigente), **semestres
   habilitados por docente**, y catálogos con estado.
2. **Perfil estudiantil dinámico.** Semestre, áreas de interés con prioridad,
   habilidades con nivel, áreas de mejora, completitud automática y un resumen que
   integra la trayectoria real. El docente solo consulta los semestres que tiene
   habilitados.
3. **Actividades académicas y extracurriculares.** El director de carrera gestiona
   las académicas y la sociedad científica las extracurriculares, con estados,
   cupos, filtros, detalle e inscripción desde la app móvil.
4. **Participación, evidencias y certificados.** Registro de asistencia por el
   responsable, **subida real de archivos** (PDF/PNG/JPG/WEBP, hasta 5 MB),
   evidencias asociadas a proyecto, actividad o área, certificados externos con
   archivo, y constancia interna emitida solo por el director sobre participación
   confirmada y sin duplicados.

Documentación del avance:

- [`docs/MATRIZ_TRAZABILIDAD_40.md`](docs/MATRIZ_TRAZABILIDAD_40.md) — requisito por requisito
- [`docs/AVANCE_40_PORCIENTO.md`](docs/AVANCE_40_PORCIENTO.md) — qué se corrigió y qué se agregó
- [`docs/DEMO_40_PORCIENTO.md`](docs/DEMO_40_PORCIENTO.md) — guion de demostración de 10–15 minutos

**Fuera del 40 %:** chat, contactos por QR, equipos avanzados, recomendación
completa, motor de gamificación (los criterios ya se administran, pero todavía no
se aplican), analítica avanzada, predicción de rendimiento, certificados oficiales
e integración real con SIU y Teams.
