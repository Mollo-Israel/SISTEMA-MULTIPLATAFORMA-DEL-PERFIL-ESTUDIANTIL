# Reporte por batch — Afinia V2

Formato de la especificación V2 §87. Un bloque por batch, en orden.

---

## BATCH 0 — Baseline

**Estado:** completo

**Objetivo:** rama nueva, línea base, inventario y auditoría de brechas.

**Cambios:**
- Rama `feat/afinia-v2` desde `feat/afinia-100` (`6e679cf`).
- `AUDITORIA_GAP_AFINIA_V2.md`: clasificación de cada requisito, 13 contradicciones registradas (C1–C13) y plan por batches.

**Migraciones:** ninguna.

**Pruebas / resultados:** línea base 16 suites, 1213 comprobaciones, 0 fallos; API, web y móvil compilan.

**Pendientes:** los batches 1–17.

**Riesgos:** Docker Desktop se detiene solo en esta máquina; los scripts de base lo detectan y lo dicen.

---

## BATCH 1 — Configuración y reproducibilidad

**Estado:** completo

**Objetivo:** que el entorno se levante igual en cualquier máquina (§10) y que los valores de identidad sean los de §15.3.

**Cambios:**
- Scripts de Docker con `--env-file .env` explícito; nuevos `db:wait` (espera a `pg_isready`, avisa si Docker no corre) y `db:rebuild` (reset → espera → migraciones → seed).
- `.env.example`: `POSTGRES_PORT=5435`, TTL 48 h / 30 min, `ACTIVATION_RESEND_MAX_PER_DAY`, `ACTIVATION_CODE_MAX_ATTEMPTS=10`, bloque `AI_*`, `TEAM_NAME_FORBIDDEN_TERMS`, `HELP_VIDEO_URL`.
- Defaults en código iguales a §15.3; intentos del código configurables (antes constante 5). El nombre anterior `ACCOUNT_EMAILS_MAX_PER_DAY` se sigue aceptando.
- Validación de entorno: `AI_PROVIDER` y sus variables (error en producción, aviso en desarrollo).
- README: scripts, puerto, credenciales del admin desde `.env` (antes contradecía a `.env.example`).

**Migraciones:** ninguna.

**Archivos:** `package.json`, `scripts/db-wait.mjs`, `.env.example`, `README.md`, `api/src/config/identity.config.ts`, `api/src/config/environment.check.ts`, `api/src/identity/account-tokens.service.ts`, `scripts/e2e-qa.mjs`, `docs/CORRECCIONES_QA.md`.

**Pruebas:** `npm run db:wait`; `e2e-qa` (QA.10 48 h; QA.11b 9 intentos no anulan; QA.12 el 10.º sí); `e2e-batch-1`.

**Resultados:** QA 72/72, B1 56/56.

**Regresiones:** ninguna.

**Pendientes:** `db:rebuild` no se ejecutó sobre la base de desarrollo porque borra sus datos; sus pasos (`db:reset`, `db:wait`, `api:migrate`, `seed`) se probaron por separado.

**Riesgos:** el `.env` local sigue con `POSTGRES_PORT=5432` porque su contenedor ya publica ese puerto; cambiarlo exige recrear el contenedor.

---

## BATCH 2 — Identidad, activación y correo

**Estado:** completo

**Objetivo:** §12, §15–§19.

**Cambios:**
- Alta manual de estudiante: código universitario obligatorio y único (DTO + servicio); al editar no se puede dejar vacío. Formulario web con el campo obligatorio y error en su campo.
- Contraseña: la web y el móvil aplican también «no contener el correo» cuando lo conocen (activación con código); el servidor sigue siendo la autoridad y rechaza además el código universitario (que no viaja al navegador).
- Sesión web: refresh token en cookie HttpOnly, SameSite configurable, `Path=/api/auth`, Secure en producción; el access token vive solo en memoria y una recarga renueva con la cookie. El móvil no cambia (refresh en el cuerpo, guardado en SecureStore). Logout borra la cookie y revoca la sesión.
- Estado del intento de correo expuesto como `QUEUED` / `SENT_TO_SMTP` / `FAILED` (§19).
- `docs/CORREO_REAL.md`: SPF, DKIM, DMARC, remitente verificado, rebotes, reputación y prueba con Outlook.

**Migraciones:** ninguna.

**Archivos:** `api/src/users/dto/create-user.dto.ts`, `api/src/users/users.service.ts`, `api/src/users/types/public-user.ts`, `api/src/auth/refresh-cookie.ts` (nuevo), `api/src/auth/auth.controller.ts`, `api/src/auth/dto/refresh.dto.ts`, `web/src/api/client.ts`, `web/src/auth/AuthContext.tsx`, `web/src/services/*`, `web/src/pages/admin/Users.tsx`, `web/src/lib/validators.ts`, `web/src/pages/auth/*`, `mobile/src/screens/LoginScreen.tsx`, `.env.example`, `docs/CORREO_REAL.md`, `scripts/e2e-v2.mjs` (nueva), `scripts/lib/fixtures.mjs`, `scripts/e2e-objectives-40.mjs`, `scripts/e2e-qa.mjs`.

**Pruebas:** `e2e-v2` batch2 (15 comprobaciones: código obligatorio y único, cookie HttpOnly con atributos, rotación, logout, móvil con token en cuerpo, contraseña con código/correo/longitud); preflight CORS con credenciales; regresión de objectives-40, B1, B2, B11, QA.

**Resultados:** V2 15/15; objectives-40, B1, B2, B11 y QA sin fallos; web compila; móvil `tsc` limpio.

**Regresiones:** objectives-40 3.5 fallaba por el código obligatorio (prueba actualizada, no el sistema).

**Pendientes:** prueba de la sesión con cookie en un navegador real (Playwright, BATCH 16).

**Riesgos:** si la web y la API se despliegan en sitios distintos hay que poner `REFRESH_COOKIE_SAMESITE=none` y HTTPS; sin `WEB_ORIGINS` configurado, CORS no admite credenciales y la web no puede iniciar sesión (en producción la API ya exige `WEB_ORIGINS`).

---

## BATCH 3 — Onboarding y preferencias

**Estado:** completo (con 9 aserciones obsoletas de afinidad antigua que se reescriben en el BATCH 9, adelantado; ver «Regresiones»)

**Objetivo:** §20–§22, §82.

**Cambios:**
- Bienvenida V2 de 5 pasos (perfil base con confirmación de datos institucionales → intereses → áreas y tecnologías a mejorar → disponibilidad, colaboración y privacidad → orientación opcional), en web y móvil. El servidor exige lo obligatorio de §20.2 y devuelve `missing` en palabras.
- Nuevas marcas en el perfil: `institutional_confirmed_at`, `privacy_reviewed_at`, `availability_decided_at` («prefiero no decirlo» cuenta como decisión).
- Intereses por tecnología (`student_skill_interests`: «me interesa» / «quiero mejorar», con procedencia). Endpoints `GET/PUT /profiles/me/skill-interests`.
- Nivel autodeclarado retirado: `POST/PUT /profiles/me/skills` responden **410**; UI de nivel eliminada en web y móvil (`LevelPicker` borrado); `student_skills` se conserva como histórico y el motor de afinidad deja de leerla.
- `BackedSkillsService` (global): tecnologías respaldadas = `skills_used` confirmadas en proyectos SUPPORTED o mejor + tecnologías de actividades CONFIRMED. Sustituye a la autoevaluación en perfil compartible, CV, vista docente, compañeros sugeridos, equipos (§55) y analítica de Dirección («tecnologías presentes en proyectos», §63).
- Recomendaciones propias usan los intereses por tecnología.

**Migraciones:** `1780380000000-V2OnboardingAndSkillInterests` (tabla y enums nuevos; 403 autoevaluaciones migradas como interés con procedencia `historical_self_assessment`; columnas de la bienvenida con backfill para los 451 perfiles que ya la habían terminado). `down` probado y reaplicado sin pérdida.

**Archivos:** `shared/src/enums/skill-interest.enum.ts`, `api/src/entities/student-skill-interest.entity.ts`, `api/src/backed-skills/*`, `api/src/profiles/*`, `api/src/collaboration/{public-profile,teams}.service.ts`, `api/src/recommendations/recommendations.engine.ts`, `api/src/reports/reports.service.ts`, `api/src/trajectory/trajectory-summary.service.ts`, `api/src/affinity-recalc/affinity.engine.ts`, `web/src/pages/student/{Welcome,Profile,Dashboard}.tsx`, `web/src/components/Declarations.tsx`, `web/src/pages/{PublicProfile,teacher/Students}.tsx`, `mobile/src/screens/student/{WelcomeScreen,SkillsScreen}.tsx`, suites.

**Pruebas:** `e2e-v2` batch3 (16): pendientes iniciales, datos visibles, cierre bloqueado con motivo, paso viejo inexistente, confirmación, 410, validación de tipo, sin duplicados, interés no cambia afinidad, resumen, disponibilidad «prefiero no decirlo», privacidad, cierre, basta un interés por tecnología, el estudiante no cambia su semestre. Suites antiguas adaptadas: B2 §21 reescrita a la regla V2; QA bienvenida con los requisitos V2; B7 y B8 preparan el respaldo real (participación confirmada en actividades con esas tecnologías).

**Resultados:** V2 31/31; objectives-40, obj5, obj7, B2, B3, B4, B5, B7, B8, B9, B10, B11, QA sin fallos.

**Regresiones:** obj-6 §17 (7 aserciones) y B6.6/B6.7 verifican la aritmética de la afinidad V2 antigua, donde el nivel autodeclarado sumaba puntos. La V2 lo prohíbe (§22, §45.1), así que son reglas obsoletas; se reescriben contra la fórmula V3 en el BATCH 9.

**Pendientes:** orientación académica en el móvil (BATCH 15).

**Riesgos:** los intereses por área siguen sumando afinidad en el motor antiguo hasta el BATCH 9.
