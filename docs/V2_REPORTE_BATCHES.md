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

---

## BATCH 9 — Afinidad V3 (adelantado; incluye la parte de BATCH 7 que necesita)

**Estado:** completo (B7 y obj-7, que prueban recomendaciones, se adaptan en el BATCH 10 siguiente)

**Objetivo:** §45–§52, §81; y de §33/§34/§48 lo necesario para atribuir proyectos al integrante correcto.

**Por qué se adelantó:** el BATCH 3 retiró el nivel autodeclarado y las suites de afinidad antigua dejaron de tener sentido; reescribirlas para V2 y luego para V3 era trabajo doble.

**Cambios:**
- Motor V3 (`AFFINITY_ENGINE_VERSION = 3`): lo declarado (intereses, áreas de mejora, tecnologías de interés) se registra con 0 y motivo; actividades confirmadas 10 con multiplicadores 1/0,7/0,5/0,3 y tope 25; proyectos 0/10/18/22/0 con 1/0,75/0,5/0,25 y tope 50; certificados 0/8/15 con tope 25; `score = round(min(100, suma))`, sin normalizar. Respaldo sin cambios (ya era el de §49). Textos de web y móvil sobre la afinidad actualizados.
- §48: el proyecto suma afinidad en las áreas de las `skills_used` que el propio integrante confirmó; sin ellas, 0 de afinidad (con motivo) y el respaldo cuenta en el área del proyecto.
- El responsable de cada proyecto tiene ahora su fila de integrante (`is_owner`) para confirmar sus tecnologías; no cuenta como «integrante aceptado» para el respaldo (§36) ni como colaboración en gamificación; no se puede retirar. La semilla también la crea.
- §81: las instantáneas de versiones anteriores no se podan (la retención solo actúa sobre la versión vigente). El recálculo de arranque llevó los resultados vigentes a V3; las 5380 instantáneas V2 siguen intactas.

**Migraciones:** `1780390000000-V2ProjectOwnerMembership` (855 filas de responsable), `1780390100000-V3AffinityWeights` (pesos V3; `down` restaura los V2). Ambas revertidas y reaplicadas.

**Archivos:** `shared/src/enums/affinity-engine.ts`, `api/src/affinity-recalc/affinity.engine.ts`, `api/src/entities/project-member.entity.ts`, `api/src/projects/{projects,project-backing,project-members}.service.ts`, `api/src/gamification/gamification.service.ts`, `api/src/database/seeds/populate.seed.ts`, `web/src/components/affinity.tsx`, `web/src/pages/student/{Affinity,Recommendations}.tsx`, `web/src/pages/LandingPage.tsx`, `mobile/src/screens/student/AffinityScreen.tsx`.

**Pruebas:** `e2e-batch-6` reescrita como suite de afinidad V3 (50): lo declarado no suma, escala 100, 10/22/25 con tope, respaldo 8/18/20, constancia sin doble conteo, proyecto vacío 0, SUPPORTED sin tecnologías 0 de afinidad y 8 de respaldo, con tecnologías 10, evidencias que no multiplican, integrante que suma en el área de SU tecnología y no en la del responsable, certificado declarado 0, diversidad, determinismo, pesos publicados, historia V2 conservada junto a la V3. `e2e-objective-6` §17 reescrita a V3 (83). Ajustes: obj-5 (la fila del responsable no es un integrante invitado), objectives-40 2.26, B10 (la afinidad del escenario sale de participaciones confirmadas).

**Resultados:** B6 50/50, obj-6 83/83, obj-5 116/116, B10 42/42, objectives-40 sin fallos.

**Regresiones:** B7 (6) y obj-7 (4) esperan sugerencias de compañeros y recomendaciones basadas en afinidad producida por intereses declarados; se rehacen en el BATCH 10 con los pesos de §54.

**Pendientes:** certificados con `skills[]` (§41) — se conserva el área del certificado como destino.

**Riesgos:** los perfiles sin trayectoria respaldada ya no tienen áreas de afinidad (antes las tenían por sus intereses); es la regla V2, pero cambia lo que ven los usuarios existentes.

---

## BATCH 10 — Recomendaciones

**Estado:** completo

**Objetivo:** §53–§54.

**Cambios:**
- Reparto V2: 35 % interés explícito (áreas con prioridad, tecnologías «me interesa», intereses libres), 25 % área a fortalecer (área o tecnología «quiero mejorar»), 20 % orientación confirmada (áreas sugeridas por el cuestionario y confirmadas), 10 % afinidad y respaldo contextual, 10 % contexto. Cada componente tiene su techo; los motivos suman exactamente el puntaje.
- La tecnología cuenta más si la actividad o el recurso la declaran (vínculo directo) que si solo aparece en el texto. Motivos nuevos: `improve_skill_match`, `orientation_confirmed`.
- Filtro duro de semestre (§54): las actividades dirigidas a otros semestres no se recomiendan.
- Refuerzos: solo el de oportunidades avanzadas cuando afinidad Y respaldo son altos (§54). Se retiró el refuerzo de «construir experiencia», que la V2 no contempla.
- Sin una señal de lo que el estudiante quiere, la afinidad no basta para recomendar algo.
- Reglas publicadas (`GET /recommendations/rules`) actualizadas.

**Migraciones:** ninguna.

**Archivos:** `shared/src/enums/recommendation.enum.ts`, `api/src/recommendations/{recommendation.rules,recommendations.engine,recommendations.service}.ts`, `scripts/e2e-batch-7.mjs`, `scripts/e2e-objective-7.mjs`, `scripts/e2e-v2.mjs`.

**Pruebas:** `e2e-v2` batch10 (9): 35 por interés de prioridad 1, 25 por área a fortalecer, tecnología de interés y a mejorar con su motivo, filtro de semestre, sin refuerzos ajenos, invariante de suma, 20 por orientación confirmada, reglas publicadas. B7 y obj-7 adaptados a las reglas V2 (y con trayectoria respaldada real en sus escenarios).

**Resultados:** V2 40/40, B7 57/57, obj-7 89/89, web compila.

**Regresiones:** ninguna pendiente.

**Pendientes:** el filtro de «visibilidad» por estado de revisión de la actividad llega con el BATCH 5.

**Riesgos:** ninguno conocido.
