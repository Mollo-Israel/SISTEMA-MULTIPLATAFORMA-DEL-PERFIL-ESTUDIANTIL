# Afinia — Matriz de trazabilidad V3

Cada requisito de la Especificación Maestra V3.1 (§69, §70) está enlazado con el módulo que lo implementa, sus rutas, sus pantallas y las pruebas que lo demuestran. Como en V2, aquí no figura nada que no exista en el código.

## Suites

Todas corren contra la API real con PostgreSQL 16; `regress.sh` ejecuta las 20.

| Abreviatura | Script | Qué cubre |
|---|---|---|
| O40, O5–O7 | `scripts/e2e-objectives-40.mjs`, `e2e-objective-5/6/7.mjs` | Objetivos del sistema base |
| B1–B11 | `scripts/e2e-batch-1.mjs` … `e2e-batch-11.mjs` | Batches de AFINIA 100 |
| QA | `scripts/e2e-qa.mjs` | Correcciones de QA |
| V2.n | `scripts/e2e-v2.mjs` | Batches V2 |
| **V3.n** | `scripts/e2e-v3.mjs` (`batch2` … `batch23`) | **Batches V3**: V3.2.x … V3.23.x |
| IA | `scripts/e2e-ai-provider.mjs` | IA con proveedor simulado |
| WEB | `scripts/e2e-web.mjs` | Navegador (Playwright; Edge y Chrome) |
| UNIT | `api/test/unit/rules.test.ts` | Reglas puras (99) |
| K6, ZAP | `scripts/k6`, `scripts/zap` | Rendimiento y seguridad dinámica (Docker) |
| MAESTRO | `mobile/.maestro/flujo-estudiante.yaml` | Flujo móvil (preparado; requiere emulador) |

**Última corrida completa:** ver `docs/V3_REPORTE_BATCHES.md` (BATCH 23) y `docs/V3_QA_HARDENING.md`.

## Requisitos funcionales

| RF | Qué cubre | Módulo (API) | Rutas principales | Web / móvil | Pruebas |
|---|---|---|---|---|---|
| RF01 Provisionar e importar cuentas | Alta manual e importación del padrón, con código universitario y semestre | `users`, `imports` | `POST /users`, `POST /imports/*` | Admin → Usuarios, Importar padrón | O40, B1, B2, V2.2, V3.2 |
| RF02 Activar y recuperar | Enlace y código por correo (SMTP o simulado), TTL, intentos, reenvío | `identity`, `mail` | `POST /activation/*`, `/password-reset/*` | `/activar`, `/recuperar`; móvil: Login | B1, B2, QA, V2.2 |
| RF03 Sesión | Login, refresh rotatorio (cookie HttpOnly), logout, revocación | `auth` | `POST /auth/login`, `/auth/refresh`, `/auth/logout` | `/login` | B1, V2.15 |
| RF04 Usuarios y alcance | Roles fijos, estados, semestres del docente (TeacherScope dentro de Usuarios) | `users`, `access` | `PUT /users/:id/semesters`, `PATCH /users/:id/status` | Admin → Usuarios | B1, O6, V2.5, V3.2, **V3.20** (Inicio admin) |
| RF05 Taxonomía | Áreas, habilidades por área, alias y códigos; habilidad solo de su área | `catalogs` | `/academic-areas`, `/skills`, `/activity-categories` | Admin → Áreas y habilidades, Categorías | V3.4, **V3.17.1** (área → skill) |
| RF06 Onboarding y perfil | Intereses, áreas a mejorar, skills de interés, privacidad | `profiles`, `onboarding` | `/profiles/me/*` | Mi perfil (Sobre mí, Intereses, Disponibilidad, Visibilidad); móvil: Perfil | V3.5, WEB.15 |
| RF07 Oportunidades internas y externas | Creación, revisión de Dirección (aprobar, observar, rechazar), publicación | `activities` | `POST /activities`, `/activities/:id/submit`, `/review` | Gestor de actividades; Dirección → Aprobaciones | V3.6, V3.7, **V3.20.6** |
| RF08 Participación interna | Interés, inscripción, confirmación, ausencia; listado paginado | `activities` | `/activities/:id/register-interest`, `/register`, `/confirm-participation`; `GET /activities?limit=` | Actividades (Para ti, Todas, Interesadas, Inscritas, Historial); móvil igual | V3.7, **V3.23** (paginación), V3.22.5 |
| RF09 Resultados internos | Constancia automática o emitida por quien corresponde | `constancies` | `/constancies/internal*` | Dirección → Constancias | B4, V3.7, V3.18.14 |
| RF10 Oportunidad externa | Aceptación y elegibilidad para adjuntar credencial al terminar | `activities` | `confirm-participation` (accepted), `/certificates/external/eligible-opportunities` | Evidencias → Adjuntar credencial; móvil | V3.8 |
| RF11 Credencial histórica | Registro sin oportunidad previa | `certificates` | `POST /certificates/external` | Credenciales y constancias; móvil | V3.8 |
| RF12 Validar credencial | URL oficial, QR, Open Badge, emisor, revisión manual excepcional | `validation` | `/validation/*`, `/validation/manual-reviews` | Dirección → Revisión de credenciales | V3.9 |
| RF13 Proyecto | Borrador y activo, multiárea, skills, repositorio, demo, visibilidad | `projects` | `/projects`, `/projects/:id/readiness` | Proyectos; móvil: Portafolio | V3.10 |
| RF14 Equipo de proyecto | Integrantes, invitaciones, usar un equipo | `projects` | `/projects/:id/invitations`, `/invite-team` | Proyecto → Integrantes | V3.12, **V3.17.30** |
| RF15 Contribución individual | Rol, contribución, skills confirmadas, corrección | `projects` | `/projects/:id/my-contribution*` | Proyecto → Mi contribución | V3.12, V3.13 |
| RF16 Corroborar GitHub | Metadata, lenguajes, manifiestos, caché con ETag, cuota | `projects/repository-inspector` | `/projects/:id/checks` | Proyecto → Verificación técnica | V3.10, V3.11 |
| RF17 Verificar demo | Accesibilidad y metadata | `validation/link-checker` | (dentro de checks) | Proyecto | V3.10 |
| RF18 Evidencias de proyecto | Contextuales y dentro del proyecto (sin bandeja genérica) | `projects`, `evidences` | `/projects/:id/evidences` | Proyecto → Evidencias | V3.10, V3.13, **B24** |
| RF19 Backing | Proyecto (declarado → revisado) y credencial | `projects/project-backing`, `validation` | `/projects/admin/recompute-backing` | Etiquetas de nivel | V3.13, UNIT |
| RF20 Afinidad V4 | Solo trayectoria corroborada | `affinity-recalc` | `/affinity/me*` | Áreas de afinidad; móvil | V3.14, B5, B6, O6, UNIT |
| RF21 Support | Respaldo separado de la afinidad | `affinity-recalc` | `/affinity/me/summary` | Afinidad | V3.14 |
| RF22 Recomendaciones | 40/30/15/10/5 sin afinidad; «No me interesa» | `recommendations` | `/recommendations/me*` | Actividades → Para ti; Más sugerencias; móvil | V3.15, V3.22.4, UNIT |
| RF23 Notificaciones | Eventos, leído y no leído, deduplicación, recordatorios | `notifications` | `/notifications/me*`, `/notifications/:id/read` | Campana y `/notificaciones`; móvil: Avisos | **V3.16**, V3.17.11, **V3.22.1–3** |
| RF24 Contactos y QR | Sin chat (410) | `collaboration` | `/contacts*`, `/public/profiles/:slug` | Colaboración → Mi enlace y QR, Contactos | V2, V3.17.31 |
| RF25 Necesidades y equipos | Semestres objetivo, área → skills, postulaciones con motivo | `collaboration` | `/team-needs*`, `/team-applications*` | Colaboración → Equipos; móvil | **V3.17**, V3.22.7–9 |
| RF26 Gamificación | Independiente de la afinidad; sin puntos por borradores ni contactos | `gamification` | `/gamification/me`, `/gamification-criteria` | Mi progreso → Puntos, Recompensas | **V3.19**, B9 |
| RF27 Trayectoria y perfil | Histórico con niveles (Declarado … Inconcluso) | `trajectory` | `GET /trajectory/me` | Mi progreso → Mi trayectoria; móvil | **V3.18.1–9**, V3.22.6 |
| RF28 Currículo seleccionable | Secciones, ítems elegibles, orden, vista previa y PDF, descargo | `trajectory` | `/trajectory-summary/items`, `/preview`, `/pdf` | Mi progreso → Currículo | **V3.18.10–27**, B9, V2.12 |
| RF29 Panel docente | Alcance por semestre y drill-down | `reports` | `/reports/teacher/*` | Inicio / Panel académico (pestañas) | **V3.20.12**, WEB.10–12b |
| RF30 Analítica institucional | Dirección (Panorama … Evolución) y Sociedad (métricas filtrables), con umbral | `reports` | `/reports/director/*`, `/reports/society/activities` | Dirección → Analítica; Sociedad → Métricas | **V3.20.8–14**, B10 |

## Requisitos no funcionales

| RNF | Cómo se cumple | Evidencia |
|---|---|---|
| RNF01 Usabilidad | Pestañas, campos filtrados, mensajes por campo (§67), etiquetas asociadas, 375 px | WEB.15–25, B21 |
| RNF02 Seguridad | RBAC por rol y por recurso (404 en lo ajeno), contraseñas con hash, sesiones revocables, rate-limit, CORS, SSRF y archivos privados | B1, V2.15, permisos negativos en V3.n, **ZAP 0 fallos** |
| RNF03 Privacidad | Mínimo acceso, perfil opt-in, analítica agregada con umbral §65 | V3.20.9–10, B10 |
| RNF04 Integridad | FK, unique (postulación, deduplicación de avisos), transacciones, idempotencia; auditoría §65 con los 34 eventos mínimos, sin contenido ni secretos | V3.16.2, V3.17.28, V3.19.4, **V3.24** |
| RNF05 Explicabilidad | Desglose de afinidad, nivel de respaldo, motivos de recomendación, resultado de validación | V3.13–V3.15, V3.18 |
| RNF06 Resiliencia | GitHub, SMTP, URL e IA no derriban el núcleo: un aviso que falla no deshace la operación | V3.11 (cuota y reintentos), V3.16 |
| RNF07 Mantenibilidad | Monolito modular (NestJS), reglas puras con prueba unitaria | UNIT 99 |
| RNF08 Configuración | `.env.example` documentado, migraciones con `up` y `down`, sin `synchronize` | Reporte por batch |
| RNF09 Rendimiento | Validaciones asíncronas, caché de GitHub con ETag, listado paginado | **k6**: CRUD p95 1,56 s, login 1,57 s, reportes 0,66 s, 0 % errores |
| RNF10 Veracidad | El currículo solo afirma lo corroborado; la IA no inventa | V3.18.20–22, V3.18.26 |
