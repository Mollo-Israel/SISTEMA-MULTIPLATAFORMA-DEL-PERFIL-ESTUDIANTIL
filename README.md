# Afinia — Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico

Ingeniería en Sistemas Informáticos – Universidad Privada del Valle. Implementa la
*Especificación Maestra Final V3.1* (`AFINIA_ESPECIFICACION_MAESTRA_FINAL_V3_1_2026-10-06.md`),
sobre la base de la V2.

Plataforma **complementaria** —no reemplaza al SIU, a Teams, las notas ni los
certificados oficiales— que construye el perfil de cada estudiante a partir de
lo que **hizo y está respaldado**: actividades con participación confirmada,
proyectos activos y corroborados y credenciales externas corroboradas. De ahí
salen su **afinidad** por área (motor V4), su **respaldo**, una **trayectoria**
con el nivel de cada cosa y un **currículo** que solo afirma lo verificable.
Las **recomendaciones** se guían por lo que quiere explorar o mejorar, no por lo
que ya sabe.

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
| **Estudiante** (web y móvil) | Completa la bienvenida; consulta «Para ti» y se inscribe en actividades; registra proyectos en borrador y los activa al cumplir lo mínimo; adjunta credenciales externas; recibe **avisos**; postula a **necesidades de equipo** de su semestre; ve su **trayectoria** con niveles y arma un **currículo** eligiendo secciones e ítems |
| **Docente** (web) | Propone actividades académicas, confirma participación y usa un único **Panel académico** con pestañas (resumen, por semestre, estudiantes, proyectos visibles, actividades, necesidades) **de sus semestres habilitados**; su retroalimentación eleva un proyecto a «revisado» |
| **Dirección de carrera** (web) | **Inicio** con lo pendiente; aprueba, observa o rechaza actividades; constancias; revisión manual excepcional de credenciales; **Analítica** (Panorama, Afinidad, Participación, Demanda, Evolución) |
| **Sociedad científica** (web) | Propone actividades extracurriculares (las aprueba Dirección), ve **Participantes** y **Métricas** filtrables con comparación entre periodos |
| **Administración** (web) | **Inicio** operativo; provisiona cuentas e importa el padrón; roles, estados y alcance docente; catálogos, recursos, gamificación y auditoría |

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

Todas están documentadas en `.env.example`. Las de la V2 y la V3:

| Variable | Para qué |
|---|---|
| `ACTIVATION_TOKEN_TTL_HOURS`, `PASSWORD_RESET_TOKEN_TTL_MINUTES`, `ACTIVATION_CODE_MAX_ATTEMPTS` | Vigencias (48 h / 30 min) e intentos (10) |
| `REFRESH_COOKIE_SAMESITE`, `REFRESH_COOKIE_SECURE` | Cookie del refresh en la web |
| `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_INPUT_CHARS`, `AI_RATE_LIMIT_PER_MINUTE` | Asistente de IA (con `none` todo funciona) |
| `TEAM_NAME_FORBIDDEN_TERMS` | Términos prohibidos adicionales en nombres de equipo |
| `GAMIFICATION_ACTIVITY_MAX_POINTS` | Tope de puntos por actividad |
| `HELP_VIDEO_URL` | Video del centro de ayuda |
| `REPOSITORY_CHECK_ENABLED`, `GITHUB_API_BASE_URL`, `GITHUB_CACHE_TTL_SECONDS` | Corroboración de repositorios (V3 §24), con caché y ETag |
| `NOTIFICATION_REMINDERS_ENABLED`, `NOTIFICATION_REMINDERS_INTERVAL_MINUTES` | Recordatorios de actividades (V3 §33.1) |
| `ANALYTICS_MIN_GROUP_SIZE` | Tamaño mínimo de grupo para publicar un agregado (§65) |

## Pruebas

Las suites hablan HTTP con la API en marcha y una base real.

```bash
npm run api:dev          # en una terminal
npm run test:all         # en otra: unitarias + 18 suites de API (incluida V3) + IA simulada + navegador
```

| Script | Qué prueba |
|--------|-----------|
| `npm run test:unit` | Reglas puras (afinidad V4, recomendaciones 40/30/15/10/5, respaldo, credenciales, currículo, transiciones de estado…) |
| `npm run test:v3` | Los batches de la V3 (`node scripts/e2e-v3.mjs batch17` corre uno) |
| `npm run test:v2` | Los batches de la V2 (`node scripts/e2e-v2.mjs batch5` corre uno) |
| `npm run test:ai` | Asistente de IA contra un proveedor `openai_compatible` simulado |
| `npm run test:web` | Web con Playwright en Edge (o `E2E_BROWSER=chrome`), sin descargar navegadores |
| `npm run test:40` … `test:70`, `test:b1` … `test:b11`, `test:qa` | Suites de regresión de las etapas anteriores |
| `npm run test:load` | Carga con k6 en Docker (V3 RNF09) |
| `npm run test:security` | OWASP ZAP en Docker: **escaneo activo**, solo contra una base de desarrollo respaldada |

Última corrida completa: 20 suites sin fallos, más 99 unitarias; k6 dentro de
los umbrales y ZAP sin fallos. Detalle en [`docs/V3_REPORTE_BATCHES.md`](docs/V3_REPORTE_BATCHES.md)
y [`docs/V3_QA_HARDENING.md`](docs/V3_QA_HARDENING.md).

## Flujo principal

1. Administración provisiona la cuenta (o importa el padrón).
2. El titular la activa desde el correo y elige su contraseña.
3. El estudiante completa la bienvenida: confirma sus datos, declara intereses por área y tecnología, decide su disponibilidad y su privacidad.
4. Docente o sociedad proponen una actividad; Dirección la aprueba y se publica.
5. El estudiante ve «Para ti» (40/30/15/10/5, sin afinidad), se inscribe y recibe recordatorios; el responsable confirma su participación (y, si está habilitada, se emite la constancia).
6. Registra un proyecto en borrador y lo activa con repositorio, evidencia e integrantes confirmados; GitHub corrobora tecnologías y la retroalimentación docente lo eleva a revisado.
7. Adjunta credenciales externas, que se validan por niveles (URL oficial, QR, Open Badge).
8. El motor de afinidad V4 recalcula solo con lo corroborado, con desglose y respaldo aparte.
9. Publica o postula a necesidades de equipo de su semestre; el responsable acepta o rechaza con motivo.
10. Consulta su trayectoria con niveles y arma un currículo eligiendo ítems elegibles; descarga el PDF.
11. Docente, Dirección, Sociedad y Administración consultan su Inicio y paneles descriptivos, con umbral de privacidad.

## Documentación

- [`docs/EL_SISTEMA_COMPLETO.md`](docs/EL_SISTEMA_COMPLETO.md) — el sistema explicado con diagramas.
- [`docs/AFINIA_FLUJO_COMPLETO_Y_MOTORES.md`](docs/AFINIA_FLUJO_COMPLETO_Y_MOTORES.md) — el flujo completo y, en detalle, cómo están construidos el motor de afinidad V3 y el asistente de IA.
- [`docs/MATRIZ_TRAZABILIDAD_V3.md`](docs/MATRIZ_TRAZABILIDAD_V3.md) — RF01–RF30 y RNF01–RNF10 → módulo → rutas → pantallas → pruebas.
- [`docs/V3_REPORTE_BATCHES.md`](docs/V3_REPORTE_BATCHES.md) — qué se hizo en cada batch de la V3, con pruebas y resultados.
- [`docs/V3_QA_HARDENING.md`](docs/V3_QA_HARDENING.md) — pruebas, seguridad (ZAP), rendimiento (k6), dependencias, compatibilidad y protocolo SUS.
- [`docs/DIAGRAMAS_V3.md`](docs/DIAGRAMAS_V3.md) — arquitectura, estados, secuencias y modelo de datos V3.
- [`docs/CAMBIOS_DOCUMENTO_GRADO_V3.md`](docs/CAMBIOS_DOCUMENTO_GRADO_V3.md) — qué cambiar en el documento de grado (capítulos 2 y 3) para que describa la V3; complementa la guía V2.
- [`AUDITORIA_GAP_AFINIA_V3.md`](AUDITORIA_GAP_AFINIA_V3.md) y [`PLAN_BATCHES_V3.md`](PLAN_BATCHES_V3.md) — la auditoría inicial de la V3 y su plan.
- [`docs/CAMBIOS_DOCUMENTO_GRADO_V2.md`](docs/CAMBIOS_DOCUMENTO_GRADO_V2.md), [`docs/MATRIZ_TRAZABILIDAD_V2.md`](docs/MATRIZ_TRAZABILIDAD_V2.md), [`docs/V2_REPORTE_BATCHES.md`](docs/V2_REPORTE_BATCHES.md), [`docs/SEGURIDAD_V2.md`](docs/SEGURIDAD_V2.md) — la V2, base de la V3.
- [`docs/CORREO_REAL.md`](docs/CORREO_REAL.md) — envío real de correo y entregabilidad.

Los documentos `AVANCE_*`, `MATRIZ_TRAZABILIDAD_40…70`, `BATCH_*` y
`CHECKLIST_FINAL_AFINIA_100.md` son el registro de etapas anteriores, no la
descripción del sistema actual.

## Fuera del alcance, a propósito

- Predecir rendimiento, abandono o éxito profesional.
- Emitir certificados oficiales o acreditar competencias.
- Reemplazar al SIU o a Teams; chat interno; registro público.
- Inferir el stack de un proyecto con OCR de capturas o recorriendo su demo (V3 §75); un puntaje de «dominio» por habilidad.
- Que la IA decida algo: solo sugiere.
