# Afinia — Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico

Ingeniería en Sistemas Informáticos – Universidad Privada del Valle. Implementa la
*Especificación Maestra Final V2* (`AFINIA_ESPECIFICACION_MAESTRA_FINAL_V2_2026-10-03.md`).

Plataforma **complementaria** —no reemplaza al SIU, a Teams, las notas ni los
certificados oficiales— que construye el perfil de cada estudiante a partir de
lo que **hizo y está respaldado**: actividades con participación confirmada,
proyectos con evidencias y certificados externos. De ahí salen su **afinidad**
por área, su **respaldo** y **recomendaciones** explicadas.

## Stack

| Capa | Tecnología |
|------|-----------|
| API central | NestJS 10 + TypeScript + TypeORM 0.3 (solo migraciones) |
| Base de datos | PostgreSQL 16 en Docker |
| Web (todos los roles) | React 18 + Vite |
| Móvil (solo Estudiante) | React Native 0.81 + Expo SDK 54 |
| Tipos compartidos | Paquete `shared/` |
| Autenticación | JWT corto + refresh rotatorio (cookie HttpOnly en la web) |
| IA (opcional) | Puerto `none` / `openai_compatible` |

## Estructura

```
.
├── api/      API central NestJS (web y móvil la consumen)
├── web/      Frontend React
├── mobile/   App React Native + Expo
├── shared/   Tipos, enumeraciones y escalas compartidas
├── docker/   docker-compose de PostgreSQL (y Mailpit opcional)
├── scripts/  Suites de verificación, k6 y ZAP
└── docs/     Documentación
```

## Roles

| Rol | Qué hace |
|-----|---------|
| **Estudiante** (web y móvil) | Completa la bienvenida, declara intereses por tecnología, se inscribe en actividades, registra proyectos, evidencias y certificados, consulta afinidad, respaldo y recomendaciones, comparte su perfil y sus canales de contacto, forma equipos y descarga su CV |
| **Docente** (web) | Propone actividades académicas, confirma participación y consulta estudiantes, proyectos, Panel académico y necesidades de equipo **de sus semestres habilitados** |
| **Dirección de carrera** (web) | **Aprueba, observa o rechaza** las actividades propuestas, publica las propias, autoriza constancias y consulta analítica descriptiva |
| **Sociedad científica** (web) | Propone actividades extracurriculares (las aprueba Dirección), confirma participación y ve métricas de sus actividades |
| **Administración** (web) | Provisiona cuentas e importa el padrón, gestiona roles, estados, alcance docente, catálogos, recursos, criterios de puntos y consulta la auditoría |

**No hay registro público**: la institución provisiona cada cuenta y su titular
la activa desde el correo. **La app móvil es del Estudiante**: la API no emite
sesión a otro rol desde el móvil. **No hay chat**: los estudiantes comparten sus
canales (Teams, WhatsApp, LinkedIn, correo o un enlace).

## Puesta en marcha

Requisitos: **Node 20+**, **npm**, **Docker Desktop** abierto y, para el móvil,
**Expo Go** o un emulador.

```bash
cp .env.example .env          # valores de desarrollo listos; ver comentarios en el archivo
npm install                   # workspaces: shared + api
npm install --prefix web
npm install --prefix mobile

npm run db:up                 # PostgreSQL en Docker (puerto POSTGRES_PORT, sugerido 5435)
npm run db:wait               # espera a que acepte conexiones
npm run shared:build
npm run api:migrate
npm run seed:populate         # datos institucionales de ejemplo
```

Luego, en tres terminales:

```bash
npm run api:dev        # http://localhost:3010/api   (Swagger en /api/docs con SWAGGER_ENABLED=true)
npm run web:dev        # http://localhost:5173
npm run mobile:start   # Expo
```

`npm run db:rebuild` reconstruye la base desde cero (borra el volumen, migra y
siembra lo mínimo).

> **Móvil.** La app deduce la dirección de la API del equipo que sirvió el
> paquete; el celular debe estar en la misma Wi‑Fi y la API en el puerto 3010.
> Si no conecta: `npx expo start --tunnel`, o `EXPO_PUBLIC_API_URL=http://TU_IP:3010/api`.
> Revise que `mobile/.env` no tenga una dirección vieja escrita a mano.

### Cuentas de ejemplo (tras `seed:populate`)

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Administración | `ADMIN_EMAIL` del `.env` | `ADMIN_PASSWORD` del `.env` |
| Docente (semestres 1–4) | `carlos.perez@univalle.edu` | `Univalle2026*` |
| Docente (semestres 5–8) | `maria.gutierrez@univalle.edu` | `Univalle2026*` |
| Dirección de carrera | `jorge.vargas@univalle.edu` | `Univalle2026*` |
| Sociedad científica | `lucia.fernandez@univalle.edu` | `Univalle2026*` |
| Estudiante | `ana.quispe@est.univalle.edu` | `Univalle2026*` |

Una cuenta nueva se crea desde **Administración → Usuarios** o importando el
padrón, y queda pendiente hasta que su titular la activa.

### Variables de entorno destacadas

Todas están documentadas en `.env.example`. Las de la V2:

| Variable | Para qué |
|---|---|
| `ACTIVATION_TOKEN_TTL_HOURS`, `PASSWORD_RESET_TOKEN_TTL_MINUTES`, `ACTIVATION_CODE_MAX_ATTEMPTS` | Vigencias (48 h / 30 min) e intentos (10) |
| `REFRESH_COOKIE_SAMESITE`, `REFRESH_COOKIE_SECURE` | Cookie del refresh en la web |
| `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_INPUT_CHARS`, `AI_RATE_LIMIT_PER_MINUTE` | Asistente de IA (con `none` todo funciona) |
| `TEAM_NAME_FORBIDDEN_TERMS` | Términos prohibidos adicionales en nombres de equipo |
| `GAMIFICATION_ACTIVITY_MAX_POINTS` | Tope de puntos por actividad |
| `HELP_VIDEO_URL` | Video del centro de ayuda |

## Pruebas

Las suites hablan HTTP con la API en marcha y una base real.

```bash
npm run api:dev          # en una terminal
npm run test:all         # en otra: unitarias + 18 suites de API + IA simulada + navegador
```

| Script | Qué prueba |
|--------|-----------|
| `npm run test:unit` | Reglas puras (afinidad V3, recomendaciones, contraseña, moderación, canales, IA, PDF) |
| `npm run test:v2` | Los batches de la V2 (`node scripts/e2e-v2.mjs batch5` corre uno) |
| `npm run test:ai` | Asistente de IA contra un proveedor `openai_compatible` simulado |
| `npm run test:web` | Web en Microsoft Edge con Playwright (sin descargar navegadores) |
| `npm run test:40` … `test:70`, `test:b1` … `test:b11`, `test:qa` | Suites de regresión de las etapas anteriores |
| `npm run test:load` | Carga con k6 en Docker (RNF05) |
| `npm run test:security` | OWASP ZAP en Docker: **escaneo activo**, solo contra una base de desarrollo respaldada |

Última corrida completa: 19 suites y 1406 comprobaciones sin fallos, más 33
unitarias. Detalle en [`docs/V2_REPORTE_BATCHES.md`](docs/V2_REPORTE_BATCHES.md)
y [`docs/SEGURIDAD_V2.md`](docs/SEGURIDAD_V2.md).

## Flujo principal

1. Administración provisiona la cuenta (o importa el padrón).
2. El titular la activa desde el correo y elige su contraseña.
3. El estudiante completa la bienvenida: confirma sus datos, declara intereses por área y tecnología, decide su disponibilidad y su privacidad.
4. Docente o sociedad proponen una actividad; Dirección la aprueba y se publica.
5. El estudiante se inscribe; el responsable confirma su participación (y, si está habilitada, emite la constancia).
6. El estudiante registra proyectos, confirma qué tecnologías usó y adjunta evidencias; la validación asigna el respaldo.
7. El motor de afinidad V3 recalcula: 25 actividades + 50 proyectos + 25 certificados, sin lo declarado, con desglose.
8. Recibe recomendaciones explicadas (35/25/20/10/10), colabora con contactos y equipos y descarga su CV.
9. Docente, Dirección y sociedad consultan paneles descriptivos, con umbral de privacidad.

## Documentación

- [`docs/EL_SISTEMA_COMPLETO.md`](docs/EL_SISTEMA_COMPLETO.md) — el sistema explicado con diagramas.
- [`docs/MATRIZ_TRAZABILIDAD_V2.md`](docs/MATRIZ_TRAZABILIDAD_V2.md) — RF/RNF → módulo → rutas → pantallas → pruebas.
- [`docs/V2_REPORTE_BATCHES.md`](docs/V2_REPORTE_BATCHES.md) — qué se hizo en cada batch de la V2, con pruebas y resultados.
- [`AUDITORIA_GAP_AFINIA_V2.md`](AUDITORIA_GAP_AFINIA_V2.md) — la auditoría inicial y el estado final de cada punto.
- [`docs/SEGURIDAD_V2.md`](docs/SEGURIDAD_V2.md) — seguridad, rendimiento, calidad y pendientes.
- [`docs/CAMBIOS_DOCUMENTO_GRADO_V2.md`](docs/CAMBIOS_DOCUMENTO_GRADO_V2.md) — qué cambiar en el documento de grado para que describa este sistema.
- [`docs/CORREO_REAL.md`](docs/CORREO_REAL.md) — envío real de correo y entregabilidad.

Los documentos `AVANCE_*`, `MATRIZ_TRAZABILIDAD_40…70`, `BATCH_*` y
`CHECKLIST_FINAL_AFINIA_100.md` son el registro de etapas anteriores, no la
descripción del sistema actual.

## Fuera del alcance, a propósito

- Predecir rendimiento, abandono o éxito profesional.
- Emitir certificados oficiales o acreditar competencias.
- Reemplazar al SIU o a Teams; chat interno; registro público.
- Que la IA decida algo: solo sugiere.
