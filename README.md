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

## Puesta en marcha (desarrollo)

Requisitos: Node 18+, Docker. Los tres clientes (API, web, móvil) consumen la **misma API** con el **mismo JWT**.

```bash
# 1. Variables de entorno
cp .env.example .env

# 2. Base de datos (PostgreSQL en Docker)
npm run db:up

# 3. Dependencias del backend (workspaces: shared + api)
npm install

# 4. Migraciones + seeds base (roles, áreas, habilidades, admin inicial)
npm run shared:build
npm run api:migrate
npm run seed

# 5. API
npm run api:dev          # http://localhost:3000/api  ·  Swagger: /api/docs

# 6. Web (otra terminal)
npm install --prefix web
npm run web:dev          # http://localhost:5173

# 7. Móvil (otra terminal)
npm install --prefix mobile
npm run mobile:start     # Expo Go / emulador  (ver mobile/README.md)
```

Admin inicial (seed): `admin@univalle.edu` / `Admin123*`.

## Verificación e2e + datos de demo

Con la API corriendo, ejecuta el flujo completo del 30% (14 pasos) de punta a punta.
Crea datos de demo reales y verifica roles, participación, afinidad y reportes:

```bash
npm run demo:e2e
```

Deja en la base: docente, sociedad científica y director de demo, dos estudiantes
con perfil/intereses/habilidades, actividades académica y extracurricular,
participación confirmada, un proyecto con evidencia y áreas de afinidad calculadas.

Cuentas de demo (contraseña `Demo123*`): `demo.docente@`, `demo.sociedad@`,
`demo.director@`, `demo.est1@`, `demo.est2@` (`@univalle.edu`).

### Datos de demo para defensa (`seed:demo`)

Genera un conjunto realista con **nombres neutros** (sin datos reales) pensado para
la sustentación. Reutiliza el **motor de afinidad real** (no inventa puntajes):

```bash
npm run seed:demo        # requiere BD arriba y migraciones aplicadas
```

Crea: usuarios por rol (Estudiante 1/2, Docente 1, Director, Sociedad Científica;
Administrador del seed base), las 8 áreas, 9 habilidades, 4 actividades (taller web,
clase espejo de IA, reto de BD, actividad de sociedad científica), 3 proyectos con
evidencias (repositorio y demo ficticios), certificados externos ficticios,
participaciones confirmadas, y afinidades calculadas con niveles **alto/medio/bajo**.

Cuentas (contraseña `Demo123*`): `estudiante1@demo.univalle.edu`,
`estudiante2@demo.univalle.edu`, `docente1@demo.univalle.edu`,
`director@demo.univalle.edu`, `sociedad@demo.univalle.edu`.

Para la defensa se puede mostrar: perfil del estudiante, actividades, proyectos,
evidencias, afinidad alta/media/baja, reporte docente y reporte de director.

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
| `npm run api:build` / `api:dev` | Compila / ejecuta la API |
| `npm run api:migrate` | Aplica migraciones TypeORM |
| `npm run seed` | Seeds base (roles, áreas, habilidades, admin) |
| `npm run seed:demo` | Datos de demo realistas para defensa (afinidad alta/media/baja) |
| `npm run demo:e2e` | Flujo e2e del 30% + datos de demo |
| `npm run web:dev` | Servidor de desarrollo web |
| `npm run mobile:start` | Inicia Expo |

## Alcance del 30% inicial

Incluye: autenticación con roles, perfil dinámico, intereses/habilidades/áreas,
proyectos con evidencias, actividades y participación, certificados externos y
constancias internas básicas, motor de afinidad inicial, reportes básicos, y
clientes web + móvil sobre la misma API.

No incluye todavía: chat, QR de contactos, equipos avanzados, recomendación
completa, gamificación completa, analítica avanzada, predicción de rendimiento,
certificados oficiales, ni integración real con SIU/Teams.
