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

**Resultados:** V2 15/15; objectives-40, B2, B11 y QA sin fallos; web compila; móvil `tsc` limpio. **Corrección posterior:** B1 se reportó aquí «sin fallos» por contar solo las comprobaciones fallidas; en realidad se interrumpía en su preparación (su alta propia de estudiantes no enviaba el código universitario). Se detectó y corrigió en el BATCH 4 (56/56). Desde entonces la regresión cuenta también las correctas y el código de salida.

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

---

## BATCH 4 — Catálogos

**Estado:** completo

**Objetivo:** §23, §24, §73.

**Cambios:**
- `skills.aliases[]`: otros nombres de la misma tecnología; un alias no puede ser el nombre ni el alias de otra habilidad.
- Validación semántica de la clasificación (§23.3), en `skill-classification.ts`:
  - reglas canónicas para tecnologías inequívocas (React Native → Desarrollo Móvil, PostgreSQL → Datos, Docker → Infraestructura, etc.); si el catálogo tiene el área canónica, guardar en otra se **bloquea** (409 `CLASSIFICATION_BLOCKED`), también cuando la tecnología llega por un alias, y ni un motivo lo permite;
  - para el resto, sugerencia por etiquetas de las áreas; guardar en otra pide **confirmación con motivo** (409 `CLASSIFICATION_CONFIRMATION_REQUIRED` con las áreas sugeridas) y, con motivo, se guarda y se audita (`SKILL_CLASSIFICATION_OVERRIDE`);
  - `GET /skills/classify` para que la pantalla avise antes de guardar.
- Web: alias, aviso en vivo con la regla o la sugerencia, botón «Usar …» y campo de motivo cuando hace falta.
- Unicidad de nombre normalizado en la base para áreas, habilidades y categorías (§73).
- El filtro de errores reenvía `details` estructurados construidos por el servicio (también lo usa la bienvenida para `missing`).
- Nombres técnicos (C++, C#, .NET, Node.js, CI/CD) verificados como válidos.

**Migraciones:** `1780400000000-V2CatalogSemantics` (alias e índices únicos normalizados; se comprobó antes que no hubiera duplicados). `down` probado.

**Archivos:** `api/src/catalogs/{skill-classification.ts,catalogs.service.ts,catalogs.controller.ts,dto/*-skill.dto.ts}`, `api/src/entities/skill.entity.ts`, `api/src/audit/audit.service.ts`, `api/src/common/http-exception.filter.ts`, `api/src/profiles/profiles.service.ts`, `web/src/pages/admin/AreasSkills.tsx`, `web/src/services/*`, `web/src/index.css`, `scripts/e2e-v2.mjs`, `scripts/e2e-batch-1.mjs`, `scripts/e2e-batch-7.mjs`.

**Pruebas:** `e2e-v2` batch4 (12): regla canónica, bloqueo por alias, sin excepción con motivo, sugerencia por etiquetas, confirmación con áreas sugeridas, guardado con motivo, auditoría, alias guardados, alias ajeno rechazado, nombres técnicos, unicidad normalizada, área obligatoria.

**Resultados:** regresión completa: 17 suites, 1243 comprobaciones correctas, 0 fallos (objectives-40 249, obj5 116, obj6 83, obj7 89, B1 56, B2 65, B3 58, B4 48, B5 49, B6 50, B7 57, B8 70, B9 49, B10 42, B11 46, QA 74, V2 52). Web compila, móvil `tsc` limpio.

**Regresiones:** B7 creaba «OpenGL» en un área sin la etiqueta `opengl` mientras otras áreas sí la tenían: la clasificación pedía motivo, como corresponde; se ajustó el escenario.

**Pendientes:** ninguno.

**Riesgos:** las reglas canónicas son una lista cerrada en código; ampliarla es un cambio versionado, no un parámetro.

## BATCH 5 — Actividades, revisión de Dirección, constancias y gamificación por actividad

**Estado:** completo

**Objetivo:** §26–§31 (C6, parte de C9).

**Cambios:**
- Revisión de Dirección (§27): Docente, Sociedad y Administración crean en borrador y envían a revisión; Dirección **aprueba**, **observa** (vuelve con comentario y se puede reenviar) o **rechaza** (queda inmutable salvo cancelar). El comentario es obligatorio para observar o rechazar. Lo que crea Dirección queda `not_required`.
- Publicar o abrir exige revisión `approved` o `not_required` (409 en la API, no solo en la pantalla). En revisión no se edita el contenido; si una aprobada aún en borrador cambia su contenido, vuelve a requerir revisión.
- Historia de revisión (`activity_reviews`) y auditoría `ACTIVITY_SUBMITTED/APPROVED/OBSERVED/REJECTED`.
- Constancias (§30): la actividad declara `internal_constancy_enabled`, aprobado con ella. Emite Dirección o el creador/responsable de la actividad; la Administración ya no. Cada constancia guarda `issued_by` (quien emite) y `authorized_by` (Dirección que aprobó).
- Gamificación por actividad (§31.2): `activity_gamification_rules`, solo para participación confirmada, con techo configurable `GAMIFICATION_ACTIVITY_MAX_POINTS` (50). Se aplican solo en actividades publicables; reemplazan los puntos del criterio general para esa actividad y pueden otorgar insignia.
- TeacherScope en la pantalla (§28): `GET /activities/my-scope`; el docente solo ve sus semestres habilitados.
- Web: columna «Revisión» con el comentario de Dirección y botón «Enviar a revisión/Reenviar»; los estados de publicación no aparecen hasta que esté aprobada; casilla de constancia y puntos por participar; nueva página **Aprobaciones** de Dirección (`/director/approvals`) con detalle, historia y decisión.
- Seguridad (hallazgo previo a V2): los listados de actividades devolvían el `passwordHash` del creador dentro de la relación `creator`. `User.toJSON()` lo excluye de toda respuesta; prueba de regresión V2.5.31.

**Migraciones:** `1780410000000-V2ActivityReview` (columnas de revisión en `activities`, las existentes quedan `not_required` con constancia habilitada para no cambiar su comportamiento; tablas `activity_reviews` y `activity_gamification_rules`), `1780410100000-V2ConstancyIssuer` (`issued_by`, rellenado con `authorized_by`). `down` y `up` probados sobre una copia respaldada; luego se restauró el respaldo.

**Archivos:** `shared/src/enums/activity.enum.ts`, `api/src/entities/{activity,activity-review,internal-constancy,user}.entity.ts`, `api/src/activities/*`, `api/src/constancies/*`, `api/src/gamification/*`, `api/src/audit/audit.service.ts`, `web/src/components/ActivityManager.tsx`, `web/src/pages/director/Approvals.tsx`, `web/src/{App.tsx,navigation.ts,components/Layout.tsx,services/*,index.css}`, `.env.example`, `scripts/lib/fixtures.mjs`, suites adaptadas.

**Pruebas:** `e2e-v2` batch5 (31): alcance del docente, borrador obligatorio, envío, sin publicar sin aprobación, solo Dirección decide, comentario obligatorio, observar/reenviar, rechazo inmutable, edición bloqueada en revisión, historia y auditoría, reglas de puntos en rango, constancia habilitada, emisor y autorizante, Administración sin constancias, sin fuga de hash.

**Resultados:** regresión completa: 17 suites, 1284 comprobaciones correctas, 0 fallos (objectives-40 249, obj5 116, obj6 83, obj7 89, B1 56, B2 65, B3 58, B4 48, B5 49, B6 50, B7 57, B8 70, B9 49, B10 42, B11 46, QA 74, V2 83). API y móvil `tsc` limpios; web compila en producción.

**Regresiones:** las suites que publicaban actividades de docente o sociedad directamente ahora pasan por `aprobarActividad`. La prueba 5.55 de objectives-40 (sociedad abre su actividad sin más) se invirtió: bajo V2 debe dar 409.

**Pendientes:** ninguno del batch.

**Riesgos:** la Administración también pasa por revisión al crear actividades; se eligió así porque §6.5 la deja fuera de las decisiones académicas.

## BATCH 6 — Evidencias y validación

**Estado:** completo (sin cambios de código)

**Objetivo:** §39–§42.

**Cambios:** ninguno. La auditoría ya los marcaba como implementados (evidencias por proyecto/actividad, archivo con autorización, validación asíncrona con niveles de respaldo, verificación externa de enlaces y repositorio). Se verifican en cada regresión: suites B3, B5, B6, B11 y objectives-40.

**Pendientes:** ninguno.

## BATCH 7 — Proyectos y asignación por `skills_used`

**Estado:** completo (entregado en el BATCH 9)

**Objetivo:** §32–§38.

**Cambios:** la única brecha (asignar el proyecto al área según las tecnologías confirmadas por cada integrante) se cerró dentro del BATCH 9, porque la necesitaba la afinidad V3. El responsable como integrante del proyecto también se entregó ahí.

**Pendientes:** ninguno.

## BATCH 8 — Asistente de IA y moderación de nombres de equipo

**Estado:** completo

**Objetivo:** §5.3, §43, §44, §84, RNF09.

**Cambios:**
- Puerto `AiAssistancePort` con dos adaptadores elegidos por entorno: `none` (por omisión; todo funciona igual y las pantallas no muestran la ayuda) y `openai_compatible` (`POST {AI_BASE_URL}/chat/completions`, Bearer opcional, tiempo límite `AI_TIMEOUT_MS`, entrada recortada a `AI_MAX_INPUT_CHARS`). Configuración incompleta ⇒ `none`.
- Seis tareas de §43.2, cada una con sus roles: etiquetas de actividad y área sugerida para una habilidad (Docente/Sociedad/Dirección/Administración), resumen de evidencias y explicación de inconsistencias (con el **mismo acceso** que ver el proyecto, TeacherScope incluido), ayuda de redacción del CV (Estudiante), narrativa de tendencias (Dirección) y moderación (interna, nadie la pide).
- Las reglas van antes que la IA: una regla canónica de habilidad o un proyecto sin inconsistencias se responden sin llamar al modelo, incluso con la IA apagada.
- Validación determinista de cada respuesta: etiquetas normalizadas; el área sugerida debe existir en el catálogo; el texto del CV y la narrativa se descartan si traen cifras que la fuente no tenía (§61.3, §63).
- Privacidad (§43.4): antes de salir se quitan correos, teléfonos, tokens, claves y parámetros de URL; de las evidencias solo viajan metadatos (tipo, descripción, nombre de archivo, dominio del enlace). Se guarda la **huella** SHA-256 de la entrada, no la entrada.
- `ai_assistance_runs`: proveedor, modelo, tarea, huella, resultado, estado, error, latencia, objetivo, quién pidió y quién aceptó. Aceptar (`POST /ai/runs/:id/accept`) solo registra la adopción: no aplica nada; el formulario guarda por su camino normal. Auditoría `AI_SUGGESTION_CREATED/ACCEPTED` sin contenido. Tope de pedidos por persona y minuto (`AI_RATE_LIMIT_PER_MINUTE`).
- Moderación de nombres de equipo (§44): primero reglas (3–60 caracteres, caracteres permitidos, sin enlaces/correos/teléfonos, sin repeticiones, términos prohibidos por palabra completa —también con números por letras, letras separadas y plurales—, lista base + `TEAM_NAME_FORBIDDEN_TERMS`); luego la IA opcional marca lo ambiguo. Marcado ⇒ no se puede invitar y las invitaciones pendientes dejan de mostrarse hasta corregir el nombre (`PATCH /teams/:id`). Si la IA falla, no bloquea. Sin falsos positivos con «Computación» ni con nombres técnicos como «C# y .NET».
- Web: componente `AiAssist` (no aparece sin proveedor) en etiquetas de actividad, área sugerida de una habilidad, explicación y resumen del proyecto, y lectura narrativa de Tendencias. En Equipos se agregó lo que faltaba en la pantalla: **formar el equipo**, **invitar** desde los candidatos, aviso de nombre marcado y renombrar.
- Seguridad/operación encontrados en la regresión:
  - La cola de correo encolaba con la hora de Node y reclamaba con `now()` de PostgreSQL: con el reloj de la VM de Docker unos milisegundos atrasado, el envío recién encolado no era elegible y esperaba al siguiente encolado o al temporizador (B11/QA fallaron por un correo que tardó 18 s). Ahora la hora la pone la base en el encolado y en los reintentos.
  - La prueba de QA usaba un nombre de área con solo 676 variantes y chocó con una corrida anterior; ahora usa cinco letras.

**Migraciones:** `1780420000000-V2AiAssistant` (`ai_assistance_runs` con checks de estado, tarea y aceptación; `teams.name_status` y `name_flag_reason`). `down`/`up` probados con respaldo y restauración.

**Archivos:** `shared/src/enums/ai.enum.ts`, `api/src/ai/*` (puerto, adaptadores, `ai-text.ts`, servicio, controlador, módulo), `api/src/entities/ai-assistance-run.entity.ts`, `api/src/collaboration/{team-name.rules.ts,teams.service.ts,collaboration.controller.ts,collaboration.module.ts}`, `api/src/reports/reports.module.ts`, `api/src/audit/audit.service.ts`, `api/src/identity/account-mail.service.ts`, `web/src/components/AiAssist.tsx`, `web/src/components/ActivityManager.tsx`, `web/src/pages/{admin/AreasSkills,student/Projects,student/Collaboration,director/Trends}.tsx`, `web/src/services/index.ts`, `.env.example`, `package.json`, `api/package.json` (`build:e2e`), `scripts/e2e-v2.mjs`, `scripts/e2e-ai-provider.mjs`, `scripts/e2e-batch-8.mjs`, `scripts/e2e-qa.mjs`.

**Pruebas:**
- `e2e-v2` batch8 (15), con `AI_PROVIDER=none`: arranque sin IA, «no disponible» sin error ni registro, roles por tarea, tarea fuera de lista, regla antes que IA, acceso al proyecto aun sin IA, aceptación ajena, registro solo para Administración y sin contenido, nueve rechazos de nombre, sin falsos positivos, nombres técnicos, renombrar, auditoría sin el nombre.
- `e2e-ai-provider` (32), nueva: levanta un proveedor simulado y una segunda API con `openai_compatible` (en `dist-e2e`, sin tocar la API de desarrollo). Verifica protocolo, Bearer y modelo; que correo y teléfono no salen; instrucción contra inventar; registro con huella y sin entrada; aceptación; que aceptar no toca la afinidad; descarte de cifras inventadas; etiquetas; área del catálogo y rechazo de área inventada; resumen con solo metadatos; TeacherScope; explicación sin cambiar el respaldo; narrativa con cifras verificables; tiempo agotado; proveedor caído sin filtrar la clave; moderación con IA, bloqueo de invitaciones, corrección y caída de la IA sin bloquear.

**Resultados:** regresión completa: 18 suites, 1331 comprobaciones correctas, 0 fallos (objectives-40 249, obj5 116, obj6 83, obj7 89, B1 56, B2 65, B3 58, B4 48, B5 49, B6 50, B7 57, B8 70, B9 49, B10 42, B11 46, QA 74, V2 98, IA 32). API y móvil `tsc` limpios; web compila en producción.

**Regresiones:** B8 antigua usaba `Equipo del panel <timestamp de 13 dígitos>`: la regla nueva lo toma, con razón, por teléfono; se acortó el sufijo. Lo demás está en «Seguridad/operación».

**Pendientes:** ninguno del batch. La ayuda de redacción del CV ya existe en la API; su pantalla llega con el BATCH 12.

**Riesgos:** la lista base de términos prohibidos es corta a propósito (palabra completa, sin falsos positivos); cada institución la amplía con `TEAM_NAME_FORBIDDEN_TERMS`. La calidad de las sugerencias depende del modelo configurado; las reglas deterministas no.

## BATCH 11 — Retiro del chat, canales de contacto y nota por contacto

**Estado:** completo

**Objetivo:** §56, §57, §58, §59 (C7).

**Cambios:**
- Chat retirado (§57): `MessagingService` eliminado; las rutas `conversations*` responden **410 Gone** con `CHAT_RETIRED` y un motivo que orienta a los canales de contacto; crear un equipo o aceptar una invitación ya no abre conversación. La pestaña «Mensajes» desaparece de la web (el móvil no la tenía).
- Datos históricos: las tablas `conversations`, `conversation_members` y `messages` se conservan sin acceso funcional y con un `COMMENT` que explica por qué siguen ahí (no hay hard drop sin auditoría). Hoy guardan 51 conversaciones y 189 mensajes.
- Canales de contacto (§59): Teams (cuenta o enlace de teams.microsoft.com), WhatsApp (con código de país), LinkedIn (`linkedin.com/in/…`), correo de contacto y otro enlace (solo `https`). Cada valor se valida y normaliza, y se deriva un único enlace seguro (`https:`/`mailto:`). Uno por tipo, todos opcionales. Los ven los contactos aceptados; en el perfil público solo los marcados y sin el valor crudo (§58). El correo institucional no aparece si el estudiante no lo escribe.
- Nota por contacto (§56): alias, contexto y canal preferido, **personal** de quien la escribe; el canal preferido debe ser uno que el otro comparte.
- Web: tarjeta «Cómo contactarte» en Colaboración, columna «Contactar» con los canales (el preferido primero), edición de la nota, y canales públicos en el perfil compartible. Se corrigió el tipo del perfil público (`skills` ya no tiene nivel autodeclarado).

**Migraciones:** `1780430000000-V2ContactChannelsAndChatRetirement` (`student_contact_channels`, `contact_notes`, comentarios en las tablas del chat). `down`/`up` probados con respaldo: los mensajes históricos se conservan en ambos sentidos.

**Archivos:** `shared/src/enums/collaboration.enum.ts`, `api/src/entities/contact-channel.entity.ts`, `api/src/collaboration/{contact-channel.rules.ts,contacts.service.ts,public-profile.service.ts,teams.service.ts,collaboration.controller.ts,collaboration.module.ts,dto/collaboration.dto.ts}`, `api/src/collaboration/messaging.service.ts` (eliminado), `web/src/pages/student/Collaboration.tsx`, `web/src/pages/PublicProfile.tsx`, `web/src/services/index.ts`, `scripts/e2e-v2.mjs`, `scripts/e2e-batch-8.mjs`.

**Pruebas:** `e2e-v2` batch11 (12): rutas de chat en 410; seis formatos inseguros o inválidos rechazados; normalización y enlaces; un canal por tipo; visibilidad solo para contactos; sin correo institucional; nota con canal válido y solo entre contactos; nota personal; perfil público solo con los marcados; deshacer el contacto oculta los canales; quitar todos. La suite B8 antigua cambió su sección de mensajería por la verificación del retiro (410 en las cuatro rutas, motivo, autenticación, contactos y equipos siguen funcionando).

**Resultados:** regresión completa tras B11: 18 suites, 1336 comprobaciones correctas, 0 fallos (objectives-40 249, obj5 116, obj6 83, obj7 89, B1 56, B2 65, B3 58, B4 48, B5 49, B6 50, B7 57, B8 63, B9 49, B10 42, B11 46, QA 74, V2 110, IA 32). API y móvil `tsc` limpios; web compila en producción.

**Regresiones:** ninguna fuera de las pruebas de mensajería, reescritas a propósito.

**Pendientes:** ninguno.

**Riesgos:** quien tenga un cliente antiguo verá 410 en lugar de su chat; es el comportamiento buscado.

## BATCH 12 — CV: plantillas, presentación asistida y descargo

**Estado:** completo

**Objetivo:** §60, §61, RF23; «Mi progreso» (§66, ya existente).

**Cambios:**
- Tres plantillas estáticas (§61.2): **clásica** (Helvetica, negro), **moderna** (títulos en bordó y líneas bajo cada sección) y **compacta** (Times, menos espacio). El escritor PDF propio recibe un tema (tipografía, acento, escala, margen, línea, mayúsculas); el contenido es el mismo en las tres.
- Secciones nuevas (§61.1): **insignias** (con la aclaración de que no tienen valor académico) y **contacto autorizado** (los canales que el estudiante comparte; el correo institucional no entra).
- Presentación del CV: el estudiante puede escribir una propia (reemplaza la biografía del perfil dinámico, §60) o pedir ayuda de redacción (mejorar, resumir o tres alternativas). Si el texto viene de una sugerencia, el CV exige que sea **suya, de redacción de CV y aceptada**; si no, 409 `CV_TEXT_NOT_APPROVED` (§61.3). Las alternativas con cifras que el texto original no tenía ya se descartaban en el BATCH 8.
- Descargo: se verificó que es el texto exacto de §61.4 y va dentro del PDF en las tres plantillas.
- `POST /trajectory-summary/pdf` (la presentación no cabe bien en una URL); el `GET` existente se mantiene y acepta `template`.
- Web: elección de plantilla con muestra, presentación con ayuda de IA y elección entre alternativas, y una **vista previa con el aspecto de la plantilla** en lugar del JSON crudo que se mostraba.
- «Mi progreso» ya cumplía: puntos, insignias con avance, criterios e historial.

**Migraciones:** ninguna.

**Archivos:** `shared/src/enums/gamification.enum.ts`, `api/src/trajectory/{pdf-writer.ts,trajectory-summary.service.ts}`, `api/src/gamification/{gamification.controller.ts,gamification.module.ts}`, `web/src/components/AiAssist.tsx`, `web/src/pages/student/Progress.tsx`, `web/src/services/index.ts`, `web/src/index.css`, `scripts/e2e-v2.mjs`, `scripts/e2e-ai-provider.mjs`, `scripts/e2e-batch-9.mjs`.

**Pruebas:** `e2e-v2` batch12 (14): secciones nuevas, tres plantillas, descargo exacto, presentación propia, contacto sin correo institucional, biografía por defecto, PDF de las tres plantillas, descargo dentro del PDF, tipografía y color por plantilla, escape de paréntesis, rechazo de sugerencia no aceptada, largo máximo y plantilla inexistente, descarga por enlace con plantilla, solo el estudiante. `e2e-ai-provider` (+2): la sugerencia entra al CV solo aceptada, y la aceptación de otro no sirve.

**Resultados:** ver BATCH 13 (regresión conjunta).

**Regresiones:** B9.30 contaba exactamente doce secciones; ahora son catorce por §61.1 y la prueba lo dice.

**Pendientes:** ninguno.

**Riesgos:** las plantillas usan las tipografías estándar del formato PDF (sin incrustar): se ven igual en cualquier lector, pero no admiten caracteres fuera de WinAnsi.

## BATCH 13 — Paneles y analítica

**Estado:** completo

**Objetivo:** §62, §63, §64, §65 (C10).

**Cambios:**
- Docente (§62): «Reportes del curso» pasa a **Panel académico** (Afinia no tiene datos de una asignatura oficial) y suma el **resumen por semestre** de su alcance: estudiantes, perfiles activos, participaciones confirmadas, proyectos abiertos a docentes y necesidades de equipo abiertas. Sin semestres habilitados, no muestra a nadie.
- Dirección (§63): **recursos más consultados**, contando personas que abrieron o guardaron cada recurso o curso recomendado (no clics).
- Sociedad (§64): **ausencias**, **estudiantes que volvieron** (confirmados en dos o más de sus actividades) y **métricas por categoría**; el estado de cada actividad se muestra en palabras. Solo sobre sus actividades y con el umbral de privacidad de §65.
- Narrativa de IA opcional también para la Sociedad, con las cifras de sus actividades únicamente; el docente no la tiene.

**Migraciones:** ninguna.

**Archivos:** `api/src/reports/{reports.service.ts,analytics.service.ts}`, `api/src/ai/ai.service.ts`, `web/src/pages/teacher/Reports.tsx`, `web/src/pages/director/Trends.tsx`, `web/src/pages/society/Metrics.tsx`, `web/src/navigation.ts`, `web/src/services/index.ts`, `scripts/e2e-v2.mjs`, `scripts/e2e-ai-provider.mjs`.

**Pruebas:** `e2e-v2` batch13 (9): agrupación por semestre solo del alcance, campos del resumen, suma igual al total, docente sin alcance, recursos consultados, tendencias solo para Dirección, ausentes y repetición, por categoría, solo actividades propias. `e2e-ai-provider` (+2): narrativa de Sociedad solo con sus cifras; el docente no la pide.

**Resultados (B12 + B13):** regresión completa: 18 suites, 1363 comprobaciones correctas, 0 fallos (objectives-40 249, obj5 116, obj6 83, obj7 89, B1 56, B2 65, B3 58, B4 48, B5 49, B6 50, B7 57, B8 63, B9 49, B10 42, B11 46, QA 74, V2 133, IA 36). API y móvil `tsc` limpios; web compila en producción.

**Regresiones:** ninguna.

**Pendientes:** la pantalla móvil del docente aún dice «Reporte del curso»; el BATCH 15 retira del móvil todo lo que no es del Estudiante.

**Riesgos:** ninguno nuevo.

## BATCH 14 — UX web: modales, movimiento, ayuda y navegación por actor

**Estado:** completo

**Objetivo:** §65, §66, §77.

**Cambios:**
- Modales sin parpadeo (§66.2): `Modal`, la confirmación y el perfil del menú se montan en `<body>` con un portal. Antes quedaban bajo contenedores animados con `transform` (listas con `Stagger`, la barra superior), y un `position: fixed` dentro de un ancestro transformado se recoloca mientras ese ancestro anima: esa era la causa del parpadeo y de la superposición incorrecta. Transición de 180 ms en lugar de un resorte; foco atrapado y devuelto al cerrar; scroll del fondo bloqueado; `onClose` leído por referencia (un padre que pasa una función nueva en cada render ya no re-registra los manejadores).
- Movimiento reducido (§66.3): `MotionConfig` con `reducedMotion="user"` en la raíz; el CSS ya lo respetaba.
- Centro de ayuda (§65): `/ayuda` para todos los roles, con preguntas frecuentes por actor, el recorrido de lo que cada uno puede hacer y el video de `HELP_VIDEO_URL` (YouTube se inserta desde `youtube-nocookie.com`; otros proveedores, como enlace; valores no `https` se ignoran con aviso al arrancar). `GET /help` es público para que la ayuda sirva también antes de iniciar sesión.
- Tutorial de primer uso por actor: aparece una vez por persona y navegador, se omite en cualquier paso y se reabre desde Ayuda o desde el menú de usuario; nunca bloquea.
- Navegación por actor (§77): el estudiante suma accesos directos a **Preferencias**, **Equipos**, **CV / Exportar** y **Ayuda** (las pestañas viajan en la URL y el menú marca solo el ítem correcto); el docente, **Necesidades de equipo** (vista de solo lectura de su alcance, `GET /reports/teacher/team-needs`); Administración, **Alcance docente** (usuarios filtrados por rol, donde se editan los semestres), **Recursos** y **Auditoría** (vista de `/audit/events`).
- Sin terminología interna visible (`backing_tier`, `support_score`…): revisado.

**Migraciones:** ninguna.

**Archivos:** `api/src/help/*`, `api/src/app.module.ts`, `api/src/config/environment.check.ts`, `api/src/reports/{reports.controller.ts,reports.service.ts}`, `web/src/{App.tsx,navigation.ts,index.css}`, `web/src/components/{ui.tsx,feedback.tsx,UserMenu.tsx,Layout.tsx,Tutorial.tsx}`, `web/src/help/content.ts`, `web/src/pages/{help/Help.tsx,admin/Audit.tsx,admin/Users.tsx,teacher/TeamNeeds.tsx,student/Collaboration.tsx,student/Progress.tsx}`, `web/src/services/index.ts`, `scripts/e2e-v2.mjs`, `scripts/e2e-ai-provider.mjs`.

**Pruebas:** `e2e-v2` batch14 (7): ayuda sin sesión; necesidades solo del alcance; sin alcance no ve nada y un estudiante no entra; sin correos; auditoría solo para Administración y sin datos sensibles; recursos para Administración y no para un docente. `e2e-ai-provider` (+1): el video de YouTube se inserta sin cookies. Las comprobaciones de navegador (portal, foco, movimiento reducido, tutorial, menú, ancho de teléfono) están en la suite de Playwright del BATCH 16.

**Regresiones:** la prueba de recursos usaba una URL fija y chocaba con una corrida anterior (la API rechaza enlaces repetidos, como corresponde); ahora es única.

**Pendientes:** capturas de pantalla dentro de la ayuda: el contenido usa iconos; agregar imágenes reales es contenido, no código.

## BATCH 15 — Móvil solo Estudiante

**Estado:** completo (sin prueba en emulador: no hay SDK de Android en esta máquina)

**Objetivo:** §67, C8.

**Cambios:**
- La app se identifica con `X-Afinia-Client: mobile`. La API **no emite sesión** a otro rol desde el móvil (`403 MOBILE_STUDENT_ONLY`, con un mensaje que lo orienta a la web) y tampoco renueva desde el móvil una sesión de personal. No es una barrera de seguridad —quien omite la cabecera es la web, donde cada rol tiene su lugar—: es la regla de producto aplicada en el servidor antes de crear la sesión, no ocultando botones.
- Se retiraron del móvil las pantallas, pestañas y servicios de Docente, Dirección, Sociedad y Administración (14 archivos). Una sesión antigua de personal ve un aviso con «Cerrar sesión».
- Paridad del flujo del estudiante: el móvil suma «Cómo contactarte» (canales, con la validación del servidor) y abre los canales de cada contacto (el preferido resaltado). El resto del flujo ya existía (bienvenida V2, intereses por tecnología, actividades, proyectos, evidencias, afinidad, recomendaciones, progreso).
- Auditoría Expo: SDK 54 confirmado; no corresponde migrar de SDK. `expo-doctor` daba 15/18: faltaba `expo-font` (dependencia par de `@expo/vector-icons`; la app podía caerse fuera de Expo Go), había dos versiones de `expo-font` y `expo` estaba un parche atrás. Con `npx expo install expo-font expo@~54.0.37`: **18/18**.

**Migraciones:** ninguna.

**Archivos:** `api/src/auth/{auth.controller.ts,auth.service.ts}`, `api/src/identity/auth-sessions.service.ts`, `mobile/src/{api/client.ts,navigation/RootNavigator.tsx,components/icons.tsx,services/index.ts,screens/student/CollaborationScreen.tsx}`, pantallas de personal eliminadas, `mobile/{package.json,package-lock.json,app.json}`, `scripts/e2e-v2.mjs`.

**Pruebas:** `e2e-v2` batch15 (7): el estudiante entra en el móvil; docente y Administración no obtienen sesión; el mensaje orienta a la web; desde la web el docente entra; su sesión no se renueva desde el móvil y sí desde la web. Móvil `tsc` limpio; `expo-doctor` 18/18.

**Resultados (B14 + B15):** regresión completa: 18 suites, 1378 comprobaciones correctas, 0 fallos (objectives-40 249, obj5 116, obj6 83, obj7 89, B1 56, B2 65, B3 58, B4 48, B5 49, B6 50, B7 57, B8 63, B9 49, B10 42, B11 46, QA 74, V2 147, IA 37). Web compila en producción.

**Regresiones:** ninguna.

**Pendientes:** prueba en emulador Android y en dispositivo físico (no hay SDK de Android ni `adb` en esta máquina). Procedimiento: instalar Android Studio, crear un AVD con API 34, `npm --prefix mobile run android` y recorrer bienvenida → actividad → proyecto → contacto; con Maestro, el mismo recorrido como flujo (ver BATCH 16).

**Riesgos:** ninguno nuevo.

## BATCH 7 (complemento) — Tecnologías del certificado externo

**Estado:** completo

**Objetivo:** §41 (`skills[]` del certificado), que había quedado pendiente.

**Cambios:** tabla `external_certificate_skills` (clave compuesta, sin repetir); el alta y la edición aceptan `skillIds` (solo tecnologías activas del catálogo, hasta 15) y el listado las devuelve. Un certificado **con respaldo** (`SUPPORTED`/`CORROBORATED`) suma sus tecnologías a las «tecnologías respaldadas» con procedencia `certificate`; uno solo declarado, no (§22). Web: buscador de tecnologías en el formulario y su lista en cada certificado; móvil: la lista en cada certificado.

**Migraciones:** `1780440000000-V2CertificateSkills`; `down`/`up` probados con respaldo.

**Pruebas:** `e2e-v2` batch7 (6).

## BATCH 16 — Pruebas, seguridad, rendimiento y calidad

**Estado:** completo, con pendientes de herramientas que esta máquina no tiene (emulador Android, Firefox de Playwright, personas para SUS)

**Objetivo:** §79, §86.

**Cambios y resultados:**
- **Unitarias** (`npm run test:unit`, runner nativo de Node con `ts-node`, sin Jest): 33 pruebas de reglas puras — afinidad V3 (topes, puntos, rendimiento decreciente), reparto de recomendaciones, política de contraseña, nombres de equipo, canales de contacto, saneamiento y validación de IA, video de ayuda, clasificación de habilidades, regla de cliente móvil y estructura del PDF por plantilla. **Encontraron un hueco real**: la validación de cifras de la IA ignoraba números de un dígito («Trabajé 2 años» pasaba); corregido.
- **Navegador** (`npm run test:web`, Playwright con Edge, sin descargar navegadores): 22 comprobaciones — diálogo en portal, foco atrapado, Escape sin fondos huérfanos, movimiento reducido, tutorial y ayuda, menú por actor, pestañas por URL, sin errores de JavaScript, y 19 pantallas en 375 px. **Encontró un error real de maquetación**: en teléfonos el menú lateral oculto seguía ocupando 256 px (una regla `sticky` posterior pisaba el `fixed` del breakpoint) y el contenido quedaba con ~120 px; corregido, junto con dos tablas sin contenedor desplazable.
- **Carga** (k6 en Docker, `node scripts/k6/run-k6.mjs`): login, listados, perfiles, recomendaciones y reportes con 25 estudiantes y 2 de Dirección. **Encontró un problema real**: el listado de actividades del estudiante pesaba 3 MB y traía datos que no le corresponden (correo, rol y estado del creador; comentario interno de la revisión de Dirección). Se agregó una **vista mínima del estudiante** y **compresión HTTP** (3 MB → 125 KB transferidos). Resultado: CRUD p95 1,76 s (≤ 3 s), login 0,49 s, reportes 0,86 s (≤ 5 s), 0 % de errores — cumple RNF05.
- **OWASP ZAP** (Docker, escaneo activo autenticado con la sesión de un estudiante sobre la definición OpenAPI): 0 FAIL, 0 WARN, 118 reglas pasan; 4 alertas informativas analizadas en `docs/SEGURIDAD_V2.md`. Base respaldada antes y restaurada después.
- **SonarQube** (Docker, servidor y escáner): primer análisis: 16 bugs y 2 vulnerabilidades; tras corregir los reales (cuatro ordenamientos sin comparador, dos botones de envío sin `type`, enlaces de la portada inalcanzables con teclado, `Math.random` como identificador, una condición constante y un `map` con índice no deseado): **0 bugs** (fiabilidad A), 1 vulnerabilidad que es un falso positivo documentado (SMTP con STARTTLS obligatorio), mantenibilidad A, duplicación 1,3 %.
- **Dependencias**: web corregida sin cambios de versión mayor (`axios`, `form-data`); en la API las correcciones exigen NestJS 12 y Swagger 12 (mayores): documentado con mitigaciones y recomendación de migración planificada.
- **Móvil**: el flujo de Maestro queda listo (`mobile/.maestro/flujo-estudiante.yaml`) para cuando haya emulador.
- Documento `docs/SEGURIDAD_V2.md` con la revisión completa de §79.6, hallazgos corregidos, resultados y procedimientos de lo pendiente.

**Migraciones:** ninguna (salvo la de certificados, arriba).

**Archivos:** `api/test/{register.js,unit/rules.test.ts}`, `api/package.json` (`test:unit`, `build:e2e`), `api/src/main.ts` (compresión), `api/src/activities/activities.service.ts` (vista del estudiante), `api/src/ai/ai-text.ts`, `api/src/affinity-recalc/affinity.engine.ts`, `api/src/mail/mail-capture.ts`, `web/src/index.css`, `web/src/components/{ui.tsx,affinity.tsx,ActivityManager.tsx}`, `web/src/pages/{LandingPage.tsx,admin/Users.tsx,student/Evidences.tsx,student/Progress.tsx,teacher/Reports.tsx}`, `web/package-lock.json`, `scripts/{e2e-web.mjs,k6/*,zap/run-zap.mjs}`, `mobile/.maestro/flujo-estudiante.yaml`, `sonar-project.properties`, `package.json`, `.gitignore`, `docs/SEGURIDAD_V2.md`.

**Resultados:** regresión completa: 19 suites, 1406 comprobaciones correctas, 0 fallos (objectives-40 249, obj5 116, obj6 83, obj7 89, B1 56, B2 65, B3 58, B4 48, B5 49, B6 50, B7 57, B8 63, B9 49, B10 42, B11 46, QA 74, V2 153, IA 37, WEB 22), más 33 unitarias. API, web y móvil compilan; `expo-doctor` 18/18.

**Regresiones:** ninguna.

**Pendientes:** prueba en emulador/dispositivo Android con Maestro; Firefox en Playwright (`npx playwright install firefox`); SUS con usuarios reales; migraciones de versión mayor de NestJS y React Router.

**Riesgos:** el listado de actividades no está paginado en el servidor; con los volúmenes reales (decenas por semestre) no es problema, y la vista mínima con compresión lo deja en una fracción. Si creciera, paginar con `limit`/`offset` y llevar la búsqueda de la web al servidor.
