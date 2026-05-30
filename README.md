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

```bash
# 1. Variables de entorno
cp .env.example .env

# 2. Base de datos
npm run db:up

# 3. Dependencias
npm install

# 4. API en modo desarrollo
npm run api:dev
```

## Alcance del 30% inicial

Incluye: autenticación con roles, perfil dinámico, intereses/habilidades/áreas,
proyectos con evidencias, actividades y participación, certificados externos y
constancias internas básicas, motor de afinidad inicial, reportes básicos, y
clientes web + móvil sobre la misma API.

No incluye todavía: chat, QR de contactos, equipos avanzados, recomendación
completa, gamificación completa, analítica avanzada, predicción de rendimiento,
certificados oficiales, ni integración real con SIU/Teams.
