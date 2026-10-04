# Afinia — Matriz de trazabilidad V2 (§80)

Cada requisito de la Especificación Maestra V2 (§75, §76) enlazado con el módulo que lo implementa, sus rutas, sus pantallas y las pruebas que lo demuestran. La regla de §80 aplica: aquí no figura nada que no exista.

Suites (todas contra la API real con PostgreSQL; `npm run test:all` las corre en orden):

| Abreviatura | Script | Qué cubre |
|---|---|---|
| O40, O5, O6, O7 | `scripts/e2e-objectives-40.mjs`, `e2e-objective-5/6/7.mjs` | objetivos 1–7 del sistema base |
| B1 … B11 | `scripts/e2e-batch-1.mjs` … `e2e-batch-11.mjs` | los once batches de AFINIA 100 |
| QA | `scripts/e2e-qa.mjs` | correcciones de QA |
| V2.n | `scripts/e2e-v2.mjs` (sección `batchN`) | los batches de la V2 |
| IA | `scripts/e2e-ai-provider.mjs` | IA con proveedor `openai_compatible` simulado |
| WEB | `scripts/e2e-web.mjs` | navegador (Playwright + Edge) |
| UNIT | `api/test/unit/rules.test.ts` | reglas puras |
| K6, ZAP, SONAR | `scripts/k6`, `scripts/zap`, `sonar-project.properties` | rendimiento, seguridad dinámica, calidad |

Resultado de la última corrida completa: ver `docs/V2_REPORTE_BATCHES.md` (BATCH 16) y `docs/SEGURIDAD_V2.md`.

## Requisitos funcionales

| RF | Caso de uso | Módulo (API) | Rutas principales | Pantalla web / móvil | Pruebas |
|---|---|---|---|---|---|
| RF01 Provisionar e importar cuentas | Alta manual con semestre y código universitario; importación del padrón | `users`, `imports` | `POST /users`, `POST /imports/*` | Administración → Usuarios, Importar padrón | O40, B1, B2, V2.2 |
| RF02 Activar cuenta | Enlace y código por correo, TTL 48 h, 10 intentos, reenvío con espera | `identity`, `mail` | `POST /activation/activate`, `POST /activation/request` | `/activar`, `/activar/solicitar`; móvil: Login | B1, B2, QA, V2.2 |
| RF03 Acceso, sesión y recuperación | Login, refresh rotatorio (cookie HttpOnly en web), recuperación 30 min, revocación | `auth`, `identity` | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/password-reset/*` | `/login`, `/recuperar`, `/restablecer` | B1, B2, V2.2, V2.15 |
| RF04 Usuarios, roles, estados, TeacherScope | Roles fijos, estados, semestres del docente | `users`, `access` | `PUT /users/:id/semesters`, `PATCH /users/:id/status` | Administración → Usuarios, Alcance docente | B1, O6, V2.5.1, V2.13 |
| RF05 Catálogos y configuración | Áreas, habilidades con alias y clasificación semántica, categorías, recursos, criterios de gamificación | `catalogs`, `gamification` | `/academic-areas`, `/skills`, `/skills/classify`, `/activity-categories`, `/learning-resources`, `/gamification-criteria` | Administración → Áreas y habilidades, Categorías, Recursos, Puntos por logros | B4, QA, V2.4, V2.14.7 |
| RF06 Onboarding y preferencias | Bienvenida de 5 pasos con datos institucionales, intereses por tecnología, disponibilidad y privacidad; cuestionario opcional | `profiles`, `onboarding` | `/profiles/me/onboarding*`, `/profiles/me/skill-interests` | `/student/bienvenida`, Mi perfil → Preferencias; móvil: Bienvenida | B2, V2.3 |
| RF07 Perfil dinámico y evolución | Resumen con tecnologías respaldadas, intereses y evolución | `profiles`, `reports` | `GET /profiles/me/summary`, `GET /reports/me/evolution` | Inicio, Mi perfil; móvil: Inicio, Perfil | O40, B9, V2.3.10 |
| RF08 Actividades y aprobación | Docente/Sociedad proponen; Dirección aprueba, observa o rechaza; publicación solo aprobada | `activities` | `POST /activities`, `POST /activities/:id/submit`, `POST /activities/:id/review`, `GET /activities/reviews/pending` | Mis actividades, Aprobaciones | O40, B4, V2.5 |
| RF09 Consultar actividades y recursos | Listado con filtros; vista mínima del estudiante | `activities`, `catalogs` | `GET /activities`, `GET /activities/:id` | Actividades; móvil: Actividades | O40, B4, V2.5.31, K6 |
| RF10 Interés, inscripción y participación | Inscripción, confirmación solo por el responsable | `activities` | `POST /activities/:id/register`, `PATCH /activities/:id/confirm-participation` | Actividades, Mis actividades | O40, B4, V2.13.7 |
| RF11 Evidencias y certificados | Archivos privados, validación asíncrona, certificados con tecnologías | `evidences`, `certificates`, `storage`, `validation` | `/evidences`, `/certificates/external`, `/uploads`, `/validation/*` | Evidencias y certificados | B3, B11, V2.7 |
| RF12 Constancias internas | Solo con participación confirmada y constancia habilitada; emisor y autorizante | `constancies` | `POST /constancies/internal`, `GET /constancies/internal/eligible/:id` | Constancias internas | O40, B6, V2.5.27–29 |
| RF13 Portafolio de proyectos | Proyectos con visibilidad, enlaces y evidencias | `projects` | `/projects`, `/projects/my`, `/projects/:id/evidences` | Proyectos; móvil: Proyectos | O5, B5 |
| RF14 Integrantes, contribuciones y tecnologías | El responsable es integrante; cada integrante confirma sus tecnologías | `projects` | `/projects/:id/members`, `PUT /projects/:id/my-contribution` | Proyecto → Integrantes | O5, B5, B9 |
| RF15 Respaldo y retroalimentación | Nivel de respaldo por señales; retroalimentación docente | `projects`, `project-feedback` | `GET /projects/:id/checks`, `/projects/:id/feedback` | Proyecto → Respaldo | B5, B6, IA.21 |
| RF16 Consultar proyectos autorizados | Docente solo de su alcance y proyectos abiertos a docentes | `projects`, `access` | `GET /projects/institutional` | Proyectos estudiantiles | O5, O6, IA.20 |
| RF17 Afinidad y respaldo V3 | 25/50/25 sin lo declarado; desglose explicable | `affinity-recalc` | `GET /affinity/me/summary`, `GET /affinity/me/areas/:id/breakdown` | Áreas de afinidad; móvil: Afinidad | O6, B6, B9, UNIT |
| RF18 Recomendaciones | 35/25/20/10/10 con motivos | `recommendations` | `GET /recommendations/me`, `PATCH /recommendations/me/:id` | Recomendaciones; móvil: Sugerencias | O7, B7, B10, V2.10, UNIT |
| RF19 Perfil compartible y QR | Slug opaco rotable, opt-in, canales públicos marcados | `collaboration` | `GET /public/profiles/:slug`, `PUT /profiles/me/visibility` | Colaboración → Mi enlace; `/p/:slug` | B8, V2.11.10 |
| RF20 Contactos | Solicitud y aceptación; canales externos; nota personal; sin chat | `collaboration` | `/contacts/*`, `/profiles/me/contact-channels`, `PATCH /contacts/:id/note` | Colaboración → Contactos; móvil: Colaboración | B8, V2.11, UNIT |
| RF21 Equipos y sugerencias | Necesidades, candidatos complementarios, invitación manual, nombres moderados | `collaboration`, `ai` | `/team-needs/*`, `/teams/*` | Colaboración → Equipos; Necesidades de equipo (docente) | B8, V2.8, V2.14.2, IA.27–32 |
| RF22 Progreso y gamificación | Puntos e insignias de hechos reales; reglas por actividad aprobadas | `gamification` | `GET /gamification/me`, `/activities/:id` (reglas) | Mi progreso | B9, QA, V2.5.26 |
| RF23 Trayectoria y CV | Secciones elegidas, 3 plantillas, presentación aprobada, descargo | `trajectory`, `gamification` | `GET /trajectory-summary/sections`, `POST /trajectory-summary/preview`, `POST /trajectory-summary/pdf` | Mi progreso → CV / Exportar | B9, V2.12, IA.13b–c, UNIT |
| RF24 Panel académico docente | Resumen por semestre del alcance | `reports` | `GET /reports/teacher/overview`, `/reports/teacher/team-needs` | Panel académico | O6, V2.13 |
| RF25 Analítica institucional | Descriptiva con umbral de privacidad; narrativa IA opcional | `reports`, `ai` | `/reports/director/*`, `/reports/society/activities` | Tendencias, Mapa de afinidad, Métricas | B10, V2.13, IA.22–23b |

## Requisitos no funcionales

| RNF | Evidencia |
|---|---|
| RNF01 Usabilidad y accesibilidad | WEB (portal, foco, Escape, movimiento reducido, 375 px), ayuda y tutorial (V2.14), Sonar sin bugs de accesibilidad abiertos |
| RNF02 Multiplataforma | Misma API para web y móvil; móvil solo Estudiante (V2.15, `expo-doctor` 18/18) |
| RNF03 Seguridad | B1, B11, ZAP (0 FAIL/0 WARN), `docs/SEGURIDAD_V2.md` |
| RNF04 Privacidad | Perfil opt-in (B8), alcance docente (O6, V2.13), umbral de analítica (B10), vista mínima del estudiante, canales públicos solo marcados (V2.11) |
| RNF05 Rendimiento | K6: CRUD p95 1,76 s; reportes p95 0,86 s |
| RNF06 Integridad y trazabilidad | Migraciones con `up`/`down` probados, claves únicas y foráneas, auditoría (B5, V2.5, V2.14.6) |
| RNF07 Mantenibilidad | Monolito modular NestJS, `shared/`, Sonar con deuda técnica en «A» |
| RNF08 Explicabilidad | Desglose de afinidad (O6), motivos de recomendaciones (O7), procedencia de tecnologías respaldadas (V2.7.5), advertencia en sugerencias de IA |
| RNF09 Resiliencia | IA caída o lenta no rompe nada (IA.24–26, IA.32); cola de correo con reintentos; validación asíncrona |
| RNF10 Portabilidad | `docker compose --env-file`, `db:wait`, `db:rebuild`, `.env.example` completo (B1) |
