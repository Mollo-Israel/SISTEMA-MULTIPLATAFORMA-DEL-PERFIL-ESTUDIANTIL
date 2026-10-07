# Afinia V3.1 — Reportes por batch

Formato de la Especificación Maestra V3.1 §73. Un batch no se declara completo si algo relevante falla.

---

## BATCH 0 — Baseline V3

**ESTADO:** completo

**Objetivo:**
- Inventariar el estado real sin modificar funcionalidad (§72 B0).

**Hallazgos iniciales:**
- Builds de `shared`, `api`, `web` y `mobile` en verde; 38/38 migraciones aplicadas; 36/36 unitarias; regresión de integración del commit base `9c95580`: 1421/0.
- `corregir v2.docx` no está en el repositorio; `corregir.docx` es la auditoría anterior, ya atendida. V3 se toma como fuente única.

**Cambios:**
- `AUDITORIA_GAP_AFINIA_V3.md`: 90 puntos de V3 contrastados con el código (36 implementados, 22 parciales, 11 incorrectos, 20 faltantes, 1 obsoleto) y 20 eventos de auditoría faltantes.
- `PLAN_BATCHES_V3.md`: alcance concreto de cada batch, migraciones probables y dependencias.
- Rama `feat/afinia-v3` creada desde `feat/afinia-v2`.

**Migraciones:** ninguna.

**Archivos:** `AFINIA_ESPECIFICACION_MAESTRA_FINAL_V3_1_2026-10-06.md`, `AUDITORIA_GAP_AFINIA_V3.md`, `PLAN_BATCHES_V3.md`.

**Pruebas ejecutadas:** builds de los cuatro paquetes, `migration:show`, `npm run test:unit`.

**Resultados:** todo en verde.

**Regresiones:** ninguna.

**Decisiones:**
- Contradicciones V2 ↔ V3 resueltas a favor de V3 y listadas en la auditoría (§1 de la V3).

**Pendientes:** batches 1 a 24.

**Riesgos:**
- B6 (modelo unificado de oportunidades) y B14 (Afinidad V4) transforman datos existentes: copia de seguridad antes de migrar y `down` probado.

---

## BATCH 1 — Configuración y reproducibilidad

**ESTADO:** completo

**Objetivo:**
- Que la configuración documentada coincida con la que el código usa, sin cambiar reglas de negocio (§72 B1, RNF08).

**Hallazgos iniciales:**
- 57 variables de entorno leídas por la API; todas documentadas en `.env.example` salvo un alias antiguo.
- `STORAGE_DRIVER=local` estaba documentada, pero el código no la leía: el driver estaba fijo.
- Los ejemplos de la web y del móvil, y el valor por defecto del cliente web, apuntaban a la API en el puerto 3000; la API escucha en `API_PORT=3010`.
- Ya cumplían: `db:wait`, `db:rebuild`, puertos configurables (`API_PORT`, `POSTGRES_PORT`), secretos JWT obligatorios y distintos en producción, `GITHUB_TOKEN` opcional, `AI_PROVIDER=none` por omisión, SMTP con adaptador, `ACTIVATION_CODE_MAX_ATTEMPTS=10`.
- Ningún archivo versionado contiene secretos; `.env`, `web/.env` y `mobile/.env` están ignorados.

**Cambios:**
- `STORAGE_DRIVER` se respeta: `local` es el único valor válido; uno desconocido detiene el arranque con un mensaje claro (`storage-driver.factory.ts`).
- `.env.example` documenta el alias `ACCOUNT_EMAILS_MAX_PER_DAY` y el comportamiento de `STORAGE_DRIVER`.
- `web/.env.example`, `mobile/.env.example` y el cliente web apuntan a `http://localhost:3010/api`.

**Migraciones:** ninguna.

**Archivos:** `api/src/storage/storage-driver.factory.ts`, `api/src/storage/storage.module.ts`, `api/test/unit/rules.test.ts`, `.env.example`, `web/.env.example`, `mobile/.env.example`, `web/src/api/client.ts`, `web/src/services/index.ts`.

**Pruebas ejecutadas:**
- `npm run test:unit`: 38/38 (2 nuevas: driver local y driver desconocido).
- Arranque real de la API con el nuevo selector.
- `scripts/e2e-batch-3.mjs` (almacenamiento y validación): 58/0.
- `tsc` de `api` y `web`.

**Resultados:** todo en verde.

**Regresiones:** ninguna.

**Decisiones:**
- Las suites de integración se corren con `MAIL_TRANSPORT=console`; con SMTP real se niegan a correr para no enviar cientos de correos a direcciones inventadas.

**Pendientes:** ninguno del batch.

**Riesgos:** ninguno nuevo.

---

## BATCH 2 — Identidad, códigos, importación y semestres

**ESTADO:** completo

**Objetivo:**
- Importar Estudiantes y Docentes en la misma experiencia, con alcance académico coherente (§7, §8, §72 B2).

**Hallazgos iniciales:**
- `university_code` en todos los roles y prefijos ya existían (commit `9c95580`).
- El importador solo conocía estudiantes; no existía `academic_scope_semesters`; el menú tenía «Alcance docente» como entrada aparte de «Usuarios».

**Cambios:**
- Padrón de **docentes** (`/imports/teachers/*`): columnas `university_code` (DOC-), `first_name`, `last_name`, `institutional_email`, `authorized_semesters` (`1;5`, `1|5`…). Preview NEW / UPDATE / UNCHANGED / CONFLICT / INVALID, idempotente; NEW crea la cuenta pendiente con su alcance y su invitación; UPDATE corrige datos y reemplaza semestres (auditoría `TEACHER_SCOPE_CHANGED`). Conflictos: correo o código de una cuenta que no es docente, código y correo de cuentas distintas, repetidos en el archivo.
- El padrón de estudiantes acepta `current_semester` como nombre de la columna y rechaza los lotes de docentes.
- `academic_scope_semesters` (arrastre o repetición): lo fija Administración al editar un estudiante; se normaliza (sin repetidos, ordenado, sin el semestre actual); el estudiante no puede tocarlo.
- Alcance docente = semestre actual **o** de arrastre, en el control de acceso y en los listados (`scopeSql`, `inTeacherScope`). Los conteos por semestre de los paneles siguen el semestre actual, para no contar dos veces a la misma persona.
- Web: Importar padrón con selector [Estudiantes] [Docentes], plantilla y ejemplo por tipo; Usuarios muestra y edita el arrastre; se retira «Alcance docente» del menú (vive en Usuarios → filtrar Docentes, §8.2).

**Migraciones:** `1780470000000-V3AcademicScopeAndTeacherImport` (`users.academic_scope_semesters` + copia en `student_profiles` con índice GIN, `import_batches.kind`, `import_batch_rows.semesters`). Copia de seguridad previa; `up` → `down` → `up` probado; los 306 lotes existentes quedan como `students`.

**Pruebas ejecutadas:** unitarias (`parseAuthorizedSemesters`, `effectiveSemesters`, `inTeacherScope`, `scopeSql`); `e2e-v3 batch2` (V3.2.1–V3.2.23); regresión completa.

**Decisiones:**
- Semestres autorizados de docente: 1 a 8, como en la pantalla de Usuarios.
- Los reportes agregados por semestre usan el semestre actual (explicado arriba).

**Riesgos:** ninguno nuevo.

---

## BATCH 3 — Activación, sesión y correo

**ESTADO:** completo (verificado; sin cambios de código)

**Hallazgos y evidencia:**
- Enlace + código de 6 dígitos como un mismo evento; usar uno marca el otro como usado: `QA.17`, `QA.18`.
- Activación manual por código obligatoria en pruebas: `QA.17`.
- Límite de intentos del código (`ACTIVATION_CODE_MAX_ATTEMPTS=10`) y bloqueo: `e2e-qa` (intentos fallidos repetidos).
- Recuperación de contraseña por código: `QA.20`–`QA.23`.
- Renovación sin carrera destructiva, cookie HttpOnly en la web: commit `710ab6f` (gracia de 60 s, Web Locks), `B3.3`–`B3.3d`, `V2.2.8`, `WEB.19c`–`WEB.19e`.
- SecureStore en el móvil: `mobile/src/api/client.ts`.
- SMTP real con adaptador, cola y errores explícitos: probado con Gmail (05/10/2026).

**Migraciones:** ninguna. **Regresiones:** ninguna.

---

## BATCH 4 — Taxonomía inteligente y UX relacional

**ESTADO:** completo

**Objetivo:** que el catálogo actual participe en las sugerencias y que el riesgo de etiquetas y la relación área → habilidades sean visibles (§4, §9).

**Hallazgos iniciales:**
- La sugerencia de área usaba reglas fijas y etiquetas, no las habilidades ya clasificadas.
- Las etiquetas repetidas en una misma área se quitaban en silencio; no había aviso de etiquetas genéricas ni compartidas.
- El formulario de necesidad de equipo ofrecía las primeras 40 habilidades del catálogo, sin áreas ni agrupación.

**Cambios:**
- §9.3 Sugerencia **dinámica**: además de las reglas canónicas y las etiquetas, compara por palabra completa con el nombre y los alias de las habilidades ya clasificadas («React Router» ⊃ «React»). Determinista, sin IA. Afecta también a la validación al guardar: un área incoherente pide confirmación con motivo (auditado).
- §9.4 Etiquetas: se normalizan (minúsculas, espacios) y una repetida en la misma área se **bloquea**; nuevo `POST /academic-areas/tag-analysis` (Administración) que devuelve genéricas y áreas que comparten cada etiqueta; la pantalla exige confirmar antes de guardar si hay riesgo (al editar, solo por las etiquetas nuevas).
- §4 Componente `AreaSkillPicker`: áreas primero, luego solo sus habilidades agrupadas por área; quitar un área quita sus habilidades. Usado en la necesidad de equipo (que ahora guarda también sus áreas).
- §67 Servidor: `assertSkillsBelongToAreas` rechaza «pertenece a otra área» por campo; aplicado a necesidades de equipo y disponible para actividades, proyectos y equipos (B6, B10, B17).

**Migraciones:** ninguna.

**Pruebas ejecutadas:** unitarias de taxonomía (5); `e2e-v3 batch4` (V3.4.1–V3.4.13); regresión completa.

**Decisiones:**
- Una etiqueta compartida entre áreas sigue siendo válida (§9.4 «no significa que una tag jamás pueda repetirse»): se confirma, no se prohíbe; así las suites existentes, que crean áreas con etiquetas comunes, siguen siendo válidas.

**Riesgos:** la sugerencia dinámica puede pedir confirmación en casos que antes pasaban; es el comportamiento que pide §74 («skill no puede guardar área incoherente silenciosamente»).

---

### Resultados comunes de los batches 2, 3 y 4

- `npm run test:unit`: **47/47**.
- Regresión completa (20 suites, correo simulado, sin cambios de código durante la ejecución): **1458 correctas, 0 fallos**. Incluye `e2e-v3` (37: B2 24 + B4 13).
- Una ejecución anterior marcó un fallo pasajero en `WEB.19b` porque la API se estaba recompilando por ediciones en curso; repetida con la API estable, pasó dos veces seguidas y en la regresión limpia.
- Builds de `api`, `web` y `mobile` en verde.

---

## BATCH 5 — Perfil y onboarding

**ESTADO:** completo

**Objetivo:** Mi Perfil por pestañas, sin entradas duplicadas en el menú, con avatares de catálogo (§11).

**Hallazgos iniciales:**
- Mi Perfil tenía «Sobre mí» (que mezclaba biografía, áreas a mejorar y disponibilidad), «Intereses y habilidades» y «Cuestionario»; Privacidad era otra pantalla.
- El menú del estudiante repetía «Preferencias» (pestaña de intereses) y «Privacidad».
- No había avatar.

**Cambios:**
- Mi Perfil en cuatro pestañas (§11.1): **Sobre mí** (avatar y biografía), **Intereses y objetivos** (áreas a mejorar, intereses por área, tecnologías de interés y a mejorar, tecnologías respaldadas y el cuestionario opcional), **Disponibilidad** (cómo le gusta colaborar) y **Visibilidad** (la configuración de privacidad, incrustada). Cada pestaña guarda solo lo suyo; errores por campo.
- Enlaces antiguos redirigen: `?tab=cuestionario` → Intereses y objetivos; `/student/privacy` → Visibilidad; `/student/interests` y `/student/onboarding` siguen funcionando.
- Menú del estudiante sin «Preferencias» ni «Privacidad».
- Avatares de catálogo (§11.2): 12 ilustraciones (`AVATAR_KEYS` en `shared`); la API rechaza cualquier otra clave o URL; sin avatar se muestran las iniciales. No hay fotos que moderar.
- **Sesión (corrección encontrada en la regresión):** cinco F5 muy seguidos podían cerrar la sesión, porque cada recarga cortaba la renovación anterior y el servidor rotaba varias veces sin que el navegador recibiera ninguna cookie. Ahora, cuando un token entra por la gracia, la sesión rota pero conserva ese token como «anterior» con la ventana anclada a la primera rotación (no se alarga). Tras una renovación normal con el token nuevo, el anterior responde 401.

**Migraciones:** `1780480000000-V3ProfileAvatar` (`student_profiles.avatar_key`).

**Pruebas ejecutadas:** `e2e-v3 batch5` (V3.5.1–V3.5.5); `e2e-web` WEB.15–WEB.15d (menú y pestañas) y WEB.19c–e (tres ejecuciones seguidas); `e2e-batch-1` B3.3–B3.3e (nuevo: F5 repetido); `e2e-v2` V2.2.8–V2.2.10; unitarias; regresión completa.

**Decisiones:**
- Pruebas ajustadas a la regla nueva: `WEB.15` exigía «Preferencias» y «Privacidad» en el menú (V3 los retira); `B3.3c` y `V2.2.8b` exigían que el token anterior sirviera «una sola vez» (ahora: durante la ventana, hasta la siguiente renovación normal).

**Riesgos:** ninguno nuevo; la ventana de reutilización sigue acotada a 60 s desde la primera rotación.

**Resultados:** unitarias 47/47; regresión completa **1467 correctas, 0 fallos** (20 suites, `e2e-v3` 42).

---

## BATCH 6 — Modelo unificado de oportunidades

**ESTADO:** completo

**Objetivo:** un único universo de oportunidades, internas y externas, con multiárea, revisión por actor y responsable real (§12, §6.5).

**Hallazgos iniciales:**
- Las oportunidades externas vivían como categorías (curso externo recomendado, recurso de apoyo); no existía `origin_type` ni campos de proveedor.
- Una sola área por actividad; el formulario no permitía elegir habilidades.
- **Hallazgo nuevo (no estaba en la auditoría):** Administración pasaba por revisión de Dirección (V3: `NOT_REQUIRED`) y el responsable era siempre quien creaba (V3: Administración debe nombrar un responsable académico real).
- Administración no tenía pantalla de oportunidades operativas (§54).

**Cambios:**
- `origin_type` interno/externo; el `type` existente (académica / extracurricular) es el `internal_type`.
- Externas: `provider` y `externalUrl` obligatorios (errores por campo), `credential_expected`, `expected_issuer_domains` (normalizados: sin esquema ni ruta, en minúsculas, validados) y `expected_keywords`. Una interna no conserva datos de proveedor.
- Multiárea (`activity_areas`, `areaIds`); `academic_area_id` queda como área principal para no romper los motores actuales (afinidad y recomendaciones migran en B14 y B15). Las habilidades deben pertenecer a las áreas elegidas.
- Revisión: Docente y Sociedad proponen (internas y externas) y decide Dirección; Dirección y Administración publican con `NOT_REQUIRED`.
- Administración: responsable obligatorio (docente o Dirección para académicas; Sociedad o Dirección para extracurriculares; cuenta activa); solo Administración puede reasignarlo; auditoría con `responsibleUserId` y `viaAdmin`.
- Listados: filtro por origen y por **cualquiera** de las áreas.
- Web: selector de origen, `AreaSkillPicker`, bloque de datos externos, selector de responsable para Administración, distintivo «Externa · proveedor» en gestión y en la vista del estudiante; nueva pantalla **Administración → Oportunidades** (académicas y extracurriculares).

**Migraciones:** `1780490000000-V3OpportunityModel`. Copia de seguridad previa; 77 actividades de cursos externos y recursos de apoyo pasan a externas; 2124 filas de `activity_areas` desde el área existente; `up` → `down` → `up` probado.

**Pruebas ejecutadas:** `e2e-v3 batch6` (V3.6.1–V3.6.16); unitarias; regresión completa.

**Decisiones:**
- Se conserva `academic_area_id` como área principal en lugar de eliminarlo: los motores lo leen y cambiarlos es alcance de B14/B15.
- Los recursos de aprendizaje (`learning_resources`) siguen siendo el catálogo de Dirección/Administración (§52, §54 «Recursos»); las oportunidades externas con fecha, aceptación y credencial son actividades de origen externo.

**Pendientes:** aceptación y elegibilidad de evidencia de externas (B8); referencia de validación (B8).

**Riesgos:** un `down` de la migración pierde la marca «externa» de las oportunidades creadas después (el `up` solo la deduce de la categoría); por eso se exige copia de seguridad antes de revertir en un entorno con datos.

**Resultados:** unitarias 47/47; `e2e-v3` 58 (B6: 16/16). Regresión completa: 1479 correctas y 4 fallos, todos en `e2e-batch-4` (B4.22–B4.26), porque la suite V2 declaraba habilidades de otra área; es la regla nueva de §4/§67. Corregida la suite para declarar las áreas de esas habilidades: `e2e-batch-4` 48/48. Total efectivo **1483/0**.

---

## BATCH 7 — Participación interna y resultados

**ESTADO:** completo

**Objetivo:** que la participación interna la confirme el responsable sin evidencia del estudiante, con una política de resultado explícita y constancia automática (§13, §14).

**Hallazgos iniciales:**
- El estudiante podía subir evidencia de una actividad (web, móvil y API), y la actividad tenía `evidence_required`.
- Solo existía `internal_constancy_enabled`; la constancia se emitía a mano.
- La inscripción no quedaba auditada (`ACTIVITY_REGISTERED`).

**Cambios:**
- Política de resultado `outcome_policy`: NONE / INTERNAL_CONSTANCY / EXTERNAL_CREDENTIAL_EXPECTED / OTHER_AUTHORIZED_RESOURCE. `internal_constancy_enabled` y `credential_expected` quedan sincronizados con ella (compatibilidad). Una externa no puede emitir constancia interna; una interna sí puede conducir a una credencial de un tercero y conserva su proveedor (§14.2).
- **Constancia automática (§14.1):** al confirmar la participación en una oportunidad publicada y aprobada (o sin revisión) con política de constancia, se emite sola, a nombre de quien confirmó y autorizada por quien aprobó; auditada como `CONSTANCY_ISSUED` (`automatica: true`). Si la confirmación se corrige a ausente, la constancia queda `rejected` (no se borra) y vuelve a `authorized` si se confirma de nuevo. Pedirla a mano no la duplica: devuelve la existente.
- **Sin evidencia de asistencia (§13.1):** `POST /evidences` con `activityId` responde 400 `ACTIVITY_EVIDENCE_NOT_REQUIRED`; `evidence_required` se ignora; se quita el selector de actividad en web y móvil. Las evidencias históricas se conservan.
- `ACTIVITY_REGISTERED` auditado al inscribirse.
- Web: «Al terminar, genera» reemplaza la casilla de constancia; el bloque de proveedor aparece también para internas que conducen a una credencial.

**Migraciones:** `1780500000000-V3OutcomePolicy` (enum + columna, deducida de los datos: 1841 con constancia, 1 con credencial, 1198 sin resultado). Copia de seguridad previa; `up` → `down` → `up` probado.

**Pruebas ejecutadas:** `e2e-v3 batch7` (V3.7.1–V3.7.13); `batch6` repetido; unitarias; regresión completa.

**Decisiones:**
- La emisión manual de constancias se mantiene (Dirección o responsable) pero es idempotente; `4.50` de `e2e-objectives-40` se actualizó: ya no espera 409, sino que no se duplique.
- Corrección encontrada en este batch: el proveedor de una interna con credencial esperada se perdía al crear (B6); ahora se conserva.

**Riesgos:** ninguno nuevo.

**Pruebas adaptadas a las reglas V3:** `e2e-objectives-40` 4.26 (una actividad ya no admite evidencia de asistencia → 400), 4.27 (los metadatos se comprueban con una evidencia propia), 4.42 (la constancia ya existe al confirmar), 5.54/5.55 (pedirla otra vez devuelve la misma); `e2e-batch-6` B6.9/B6.11 (el respaldo suma ahora la constancia automática: 12 y tope 20).

**Resultados:** unitarias 47/47; `e2e-v3` 71 (B7 13/13). Regresión completa: **1496 correctas, 0 fallos** (20 suites). `e2e-ai-provider` levanta su propia API: el script de regresión ahora fuerza `MAIL_TRANSPORT=console` para que nunca herede el SMTP real del `.env` (la suite lo detecta y se niega a correr, que es lo que pasó en la primera vuelta).

**Pendientes:** aceptación de externas, elegibilidad y referencia de validación (B8).

---

## BATCH 8 — Oportunidades externas y credenciales

**ESTADO:** completo

**Objetivo:** separar «aceptado por el proveedor» de «obtuvo la credencial», habilitar adjuntarla solo cuando la oportunidad terminó, distinguir credenciales de oportunidad e históricas y permitir una referencia de validación (§15, §16, §17).

**Hallazgos iniciales:**
- No existía el estado ACCEPTED: una externa solo podía «confirmarse» como si fuera asistencia interna.
- El estudiante registraba cualquier certificado sin vínculo con la oportunidad y sin `source`.
- No había referencia de validación ni un punto de emisión de notificaciones.

**Cambios:**
- **Aceptación (§15):** nuevo estado de inscripción `accepted` con `accepted_at`. En una externa el responsable registra la aceptación (`confirmed` → 400 `EXTERNAL_USES_ACCEPTANCE`); en una interna no existe (`ACCEPTANCE_ONLY_EXTERNAL`). La aceptación ocupa cupo, no alimenta la trayectoria ni la afinidad, y el estudiante ya no se da de baja solo. Auditoría `EXTERNAL_OPPORTUNITY_ACCEPTED`.
- **Elegibilidad (§15):** `CredentialEligibilityService` con reglas puras (`credential-eligibility.rules.ts`): externa aceptada, o interna con credencial de un tercero (§14.2) confirmada, y oportunidad terminada (`end_at`/fecha pasada o FINISHED; cancelada nunca). Se calcula al consultar: no depende de ninguna tarea programada. `GET /certificates/external/eligible-opportunities`; `myRegistration.evidenceEligible` y `participants[].evidenceEligible`.
- **Credencial con origen (§15/§16):** `external_certificates.source` (`opportunity` / `historical_external`) y `activity_id`. Lo decide el servidor: con `activityId` solo si es elegible para ese estudiante (400 `CREDENTIAL_OPPORTUNITY_NOT_ELIGIBLE`), una por oportunidad (409, índice único parcial). El origen no se edita (el DTO de edición lo omite). Las 1467 credenciales existentes quedan `historical_external`. Auditoría `EXTERNAL_CREDENTIAL_CREATED`.
- **Referencia de validación (§17):** tabla `external_opportunity_validation_references` (curso esperado, patrón del código, certificado de ejemplo, notas). Proveedor, dominios y palabras clave siguen en la oportunidad (§12) y se devuelven junto, sin duplicarse. `GET/PUT /activities/:id/validation-reference` solo para quien gestiona la oportunidad y solo si espera credencial. El patrón usa comodines (`#` dígito, `@` letra, `*` varios), nunca una expresión regular libre (sin ReDoS). El ejemplo debe ser un archivo propio; lo abren responsable, creador, Dirección y administración, nunca un estudiante; la limpieza de huérfanos lo respeta. Los responsables pueden subir archivos para esto. Auditoría `VALIDATION_REFERENCE_UPDATED`.
- **Punto de notificación (B16):** puerto `NOTIFICATION_EMITTER` con `dedupe_key`; la implementación provisional solo registra. Se emite `EXTERNAL_EVIDENCE_ENABLED` (también auditado) al aceptar en una oportunidad ya terminada y al darla por finalizada.
- **Web:** «Adjuntar credencial externa» con «¿De dónde viene?» (oportunidades elegibles o histórica) que precarga nombre y emisor; la lista muestra la procedencia. En Actividades, el estudiante ve «aceptado» y cuándo puede adjuntar. En la gestión, una externa muestra «Registrar aceptación» y el grupo «Aceptados»; el bloque externo suma la referencia de validación con el ejemplo.
- **Móvil:** el mismo selector de origen, el estado «aceptado» en Actividades y en Mis actividades.

**Migraciones:** `1780510000000-V3ExternalCredentials` (valor `accepted` del enum, `accepted_at`, `source` + `activity_id` con índice único parcial, tabla de referencias). Copia de seguridad previa (`pre-v3-b8.dump`); `up` → `down` → `up` probado (el `down` recrea el enum sin `accepted` y devuelve esas inscripciones a `registered`).

**Pruebas ejecutadas:** `e2e-v3 batch8` (V3.8.1–V3.8.36); unitarias nuevas de elegibilidad y patrón (56/56); regresión completa.

**Decisiones:**
- La comparación de la credencial contra la referencia (dominio, curso, patrón) es parte de la validación escalonada de B9; aquí queda guardada y expuesta.
- La notificación por fecha cumplida sin acción de nadie (recordatorio) la programa B16; la elegibilidad ya es correcta sin ella porque se calcula al consultar.

**Riesgos:** ninguno nuevo. Abrir `POST /uploads` a los roles de gestión no da acceso a archivos ajenos: el archivo queda del que lo sube y solo él puede enlazarlo.

**Resultados:** unitarias 56/56; `e2e-v3` 107 (B8 36/36). Regresión completa: **1532 correctas, 0 fallos** (20 suites; `e2e-ai-provider` 37/37 con correo simulado).

**Pendientes:** comparación de la credencial contra la referencia y validación escalonada (B9); centro de notificaciones (B16).

---

## BATCH 9 — Validación de credenciales externas

**ESTADO:** completo

**Objetivo:** validar las credenciales de forma escalonada y honesta: CORROBORATED solo con una señal verificable fuerte, FLAGGED ante contradicciones, inconcluso cuando no se puede concluir, y una revisión manual excepcional para históricas sin verificador (§18, §19, §20).

**Hallazgos iniciales:**
- Cualquier URL declarada que respondiera subía el certificado a CORROBORATED, sin mirar el dominio ni el contenido.
- No existía FLAGGED, ni estados de verificación oficial, ni comparación con la referencia de la oportunidad.
- El QR se leía después del OCR; no había detección de Open Badges ni revisión manual.

**Cambios:**
- **Orden §18:** PDF nativo → QR → OCR (solo si falta texto) → URL/QR oficial → comparación → IA (no se usa: nunca decide) → respaldo determinista. Queda registrado en `credential_check.pipeline`.
- **Verificación oficial (`CredentialVerifierService`, §18.2):** elige la URL (declarada, del QR, del documento o de la insignia), la consulta con la protección SSRF de siempre —también la del QR—, juzga el dominio contra los oficiales (los esperados por la oportunidad o un catálogo inicial de emisores y plataformas de insignias; comparación por dominio, nunca por subcadena) y compara la página. Estados: VERIFIED_MATCH, REACHABLE_NO_STRUCTURED_PROOF, MISMATCH, INCONCLUSIVE, UNREACHABLE y NO_VERIFIER.
- **Regla de corroboración:** dominio oficial y página que nombra al estudiante con el código o el curso. El código y la URL los escribe quien registra, así que la página de otra persona no corrobora. Un emisor desconocido nunca corrobora por URL (§20).
- **Open Badges (§18.3, opcional):** aserción OB 2.0 hosted en el dominio oficial con destinatario propio (hash `sha256$` con sal contra el correo del estudiante) → VERIFIED_MATCH; destinatario ajeno o revocada → MISMATCH. Insignias horneadas en PNG (`openbadges` en tEXt/iTXt). En credenciales verificables (OB 3.0/VC) se valida estructura, sujeto y estado; la prueba criptográfica se informa como presente pero no verificada, y por eso no corrobora por sí sola. No se simula lo que no se hace.
- **QR (§18.1):** `qr_present` / `qr_absent`; la ausencia no falla.
- **Respaldo (§19, reglas puras en `credential-check.rules.ts`):** FLAGGED si hay contradicción (nombre, código declarado distinto del leído, código fuera del patrón de la referencia, documento de otro curso o emisor que la oportunidad, verificación que no coincide o dirección bloqueada por SSRF); CORROBORATED solo con VERIFIED_MATCH; SUPPORTED con documento legible y coherente, contexto de oportunidad que coincide o página oficial que responde; si no, DECLARED. Las contradicciones solo se evalúan con texto legible: sin texto no se acusa a nadie.
- **Proveedor caído (§18.2):** UNREACHABLE y la validación queda INCONCLUSIVE, no «falsa».
- **FLAGGED:** nuevo nivel en el enum; no se borra nada, se avisa al estudiante por el punto de notificación y suma 0 de afinidad y respaldo (§35).
- **Revisión manual excepcional (§16):** solo para históricas, ya comprobadas, sin verificador que concluya, sin contradicciones y con archivo o enlace. La pide el estudiante (`POST /certificates/external/:id/manual-review`); la decide **solo Dirección** (`GET/POST /validation/manual-reviews`), con motivo obligatorio de al menos 20 caracteres; es la única vía para que una así llegue a CORROBORATED. Mientras exista la revisión, Dirección puede abrir el documento; antes no. Si el estudiante cambia lo declarado, la revisión anterior se anula y se vuelve a comprobar. Auditoría `EXTERNAL_CREDENTIAL_MANUAL_REVIEW_REQUESTED` y `EXTERNAL_CREDENTIAL_MANUAL_REVIEWED`; cada veredicto, `EXTERNAL_CREDENTIAL_CHECKED`.
- **Versión del validador 2** y `POST /validation/reprocess-outdated` (administración) para revalidar lo anterior sin borrar nada ni reiniciar revisiones.
- **Pruebas:** `LINK_CHECK_TEST_ORIGINS` permite a las suites simular un verificador local con un nombre de dominio (`nombre:puerto=ip:puerto`). Se ignora siempre con `NODE_ENV=production`, así que la protección SSRF no tiene excepciones en producción.
- **Web:** el respaldo muestra el nivel (también «Con inconsistencias»), el estado de la verificación, si se leyó QR, las contradicciones en lenguaje claro y el botón «Pedir revisión excepcional». Dirección tiene «Revisión de credenciales» con el documento, el enlace, la nota y la decisión motivada. **Móvil:** niveles y textos actualizados.

**Migraciones:** `1780520000000-V3CredentialValidation` (valor `flagged`, `credential_check` jsonb, columnas de revisión manual con índice parcial). Copia de seguridad previa (`pre-v3-b9.dump`); `up` → `down` → `up` probado (el `down` devuelve FLAGGED a DECLARED).

**Pruebas ejecutadas:** unitarias de dominio, estados, respaldo, Open Badges, PNG horneado y comparación de página (70/70); `e2e-v3 batch9` (V3.9.1–V3.9.31) contra un verificador simulado con página oficial, página de otra persona, página que requiere JavaScript, proveedor caído, insignias propia y ajena, QR a la red interna y QR oficial; regresión completa.

**Decisiones:**
- Dependencia de desarrollo `qrcode` (solo para generar QR en las pruebas).
- La revisión manual la decide Dirección, no Administración: §6.5 la define como técnica y §2 dice que no es emisora académica.
- El catálogo de dominios de emisores es inicial y se dice así en el código (§20: no se promete universalidad).

**Riesgos:** las credenciales ya validadas con la versión 1 conservan su nivel hasta que se revaliden con `reprocess-outdated`; algunas que antes eran CORROBORATED por una URL cualquiera bajarán. Es el comportamiento que pide §19.

**Pruebas adaptadas:** `e2e-batch-3` B3.31 (un certificado con el nombre de otra persona ahora queda FLAGGED, §19, en lugar de DECLARED); `e2e-qa` QA.32 (el nombre de la habilidad de prueba chocaba entre corridas: ahora es único).

**Resultados:** unitarias 70/70; `e2e-v3` 138 (B9 31/31). Regresión completa: **1563 correctas, 0 fallos** (20 suites). La API de desarrollo para las pruebas se arranca con `MAIL_TRANSPORT=console LINK_CHECK_TEST_ORIGINS=verificador.afinia-pruebas.org:3997=127.0.0.1:3997`.

**Pendientes:** revalidar en cada entorno las credenciales de la versión 1 (`POST /validation/reprocess-outdated`); notificaciones persistentes (B16).

---

## BATCH 10 — Proyectos: modelo, requisitos y privacidad

**ESTADO:** completo

**Objetivo:** que un proyecto pueda guardarse incompleto como borrador y solo pase a ACTIVE cumpliendo lo mínimo; multiárea con tecnologías del catálogo; visibilidad de cinco niveles; evidencias dentro del proyecto (§21, §22, §23, §40).

**Hallazgos iniciales:**
- Un proyecto se activaba sin ningún requisito; un solo `academic_area_id` y tecnologías como texto libre.
- Visibilidad solo PRIVATE / PROFILE / TEACHERS.
- La pantalla de Evidencias permitía adjuntar evidencias a un proyecto desde fuera de él.

**Cambios:**
- **Multiárea (§21.2):** `project_areas` y `project_skills`. Las tecnologías deben ser del catálogo y de las áreas elegidas (§4, mismo guardián que oportunidades). `academic_area_id` queda como el área principal y `technologies` conserva lo escrito (lo usan el cruce con GitHub y los filtros docentes); el filtro por área del portafolio docente mira todas las áreas.
- **Requisitos de ACTIVE (§22, reglas puras en `project-readiness.rules.ts`):** título, ≥1 área, ≥1 tecnología, repositorio con forma de repositorio (GitHub, GitLab, Bitbucket) y comprobado como público, invitaciones respondidas, integrantes con su contribución confirmada, contribución propia confirmada, y evidencia de funcionamiento o demo accesible. `GET /projects/:id/readiness` dice qué falta; activar sin cumplir responde 400 `PROJECT_NOT_READY` con la lista en `details.missing` (forma de error de §103). Pedir ACTIVE al crear se evalúa igual y, si no cumple, no deja un borrador a medias. Un ACTIVE no puede quedarse sin áreas, tecnologías ni repositorio.
- **Repositorio público (§20 aplicado):** un repositorio privado (visible con token) no es público; si GitHub no responde o la cuota se agota, queda «sin comprobar» y eso no bloquea (aviso), porque no poder comprobar no prueba que no exista. `GITHUB_API_BASE_URL` configurable (GitHub Enterprise; GitHub simulado en pruebas).
- **Activación:** evento `project_activated` en la bitácora y auditoría `PROJECT_ACTIVATED`. Cambiar el estado recalcula la afinidad de todos los integrantes, no solo la del responsable.
- **Privacidad (§40):** TEAM (el equipo de colaboración vinculado ve el proyecto) y PUBLIC_LINK (token aleatorio de 32 caracteres; `GET /projects/public/:token` sin sesión devuelve un resumen sin integrantes, archivos, bitácora, auditoría ni retroalimentación; al cambiar la visibilidad el enlace deja de funcionar; un borrador no se publica). `team_id` solo con un equipo del que el responsable forma parte.
- **Evidencias dentro del proyecto (§23):** la tarjeta del proyecto admite enlace o captura (archivo); el formulario genérico de evidencias ya no ofrece elegir proyecto (web y móvil). La API conserva la compatibilidad.
- **Web:** «Nuevo proyecto» se guarda como borrador, con selector de áreas → tecnologías agrupadas, repositorio, demo, visibilidad de cinco niveles y equipo; cada borrador muestra la lista de requisitos y el botón «Activar proyecto»; selector de visibilidad en la tarjeta con «copiar enlace público»; página pública `/proyecto/:token`. **Móvil:** alta como borrador con áreas y tecnologías por área, visibilidades nuevas y, en el detalle, requisitos y activación.

**Migraciones:** `1780530000000-V3ProjectModel` (tablas `project_areas` y `project_skills` sembradas desde los datos: 983 áreas y 456 tecnologías reconocidas desde el texto; valores `team` y `public_link`; `public_link_token`, `team_id`; evento `project_activated`). Copia de seguridad previa (`pre-v3-b10.dump`); `up` → `down` → `up` probado. Los 1176 proyectos ya activos se conservan como están: los requisitos rigen al activar.

**Pruebas ejecutadas:** unitarias de requisitos (74/74); `e2e-v3 batch10` (V3.10.1–V3.10.28); regresión completa.

**Decisiones:**
- **Suites adaptadas al camino V3:** las altas de proyectos ACTIVE pasan por el fixture `crearProyectoActivo` (borrador con áreas, tecnologías y repositorio → evidencia → activar), igual que un estudiante, contra un GitHub simulado (`scripts/lib/fixtures.mjs`, `GITHUB_API_BASE_URL=http://127.0.0.1:3996`). Los escenarios que miden cómo un proyecto vacío gana respaldo (B5, B6, B7, B9, Objetivo 6) parten de un borrador (`crearProyectoBorrador`): un ACTIVE ya nace con repositorio y evidencia. `e2e-objective-5` 15.28c: un activo ya no puede tener un repositorio inexistente.
- **Borradores y afinidad:** §21 dice que un DRAFT no es experiencia respaldada. Excluirlo del motor se hace en B14 (Afinidad V4, que rehace las fuentes de proyecto: solo CORROBORATED/REVIEWED); hacerlo aquí invalidaba las pruebas del motor V3 que B14 reemplaza.

**Riesgos:** ninguno nuevo.

**Resultados:** unitarias 74/74; `e2e-v3` 166 (B10 28/28). Regresión completa: **1592 correctas, 0 fallos** (20 suites). La API de pruebas se arranca además con `GITHUB_API_BASE_URL=http://127.0.0.1:3996`.

**Pendientes:** lectura del contenido de manifiestos, caché con ETag y reintentos (B11); catálogo de roles y bloqueo por confirmaciones con notificación (B12); regla de CORROBORATED del proyecto y estado por skill (B13); exclusión de borradores en afinidad (B14).

---

## BATCH 11 — GitHub y demo

**ESTADO:** completo

**Objetivo:** leer los manifiestos controlados y mapear dependencias a tecnologías de forma determinista, con caché, ETag, respeto de la cuota y reintentos; demo comprobada sin crawler (§24, §25, §26).

**Hallazgos iniciales:**
- Solo se detectaba la presencia de un manifiesto (`package.json` → «JavaScript»), sin leer dependencias; faltaban los lockfiles y `docker-compose`.
- Cada comprobación volvía a consultar GitHub: sin caché, sin ETag, sin reintentos; un fallo de red marcaba el repositorio como no disponible.
- La interfaz no explicaba de dónde salía cada señal.

**Cambios:**
- **Lectura de manifiestos (§24.3):** del listado de la raíz («tree limitado») se leen solo `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `requirements.txt`, `pyproject.toml`, `pom.xml`, `build.gradle`, `Dockerfile` y `docker-compose`, con tope de 1 MB. Reglas puras en `dependency-map.ts`: npm (react, @nestjs/core, pg, mongoose…), PyPI (fastapi, django, psycopg2…), JVM (spring-boot…), imágenes de compose (postgres, redis, mongo…) e imagen base del Dockerfile. De los lockfiles solo cuentan las dependencias directas, no las transitivas. Nada se clona, instala ni ejecuta (§25).
- **Cruce (§24.4, §29):** cada tecnología declarada queda corroborada (con su origen: `package.json (react)`, `docker-compose.yml (image: postgres:16)`, `languages`) o «Declarada» si no hay rastro, sin marcarla falsa ni restar. Lo encontrado y no declarado se informa sin añadirlo. Se cruza con las tecnologías del catálogo del proyecto (B10).
- **Resiliencia (§24.6):** tabla `github_api_cache` con ETag. Dentro de `GITHUB_CACHE_TTL_SECONDS` (600) no se pregunta; después se pregunta con `If-None-Match` (un 304 no gasta cuota). Si GitHub informa de cuota agotada, no se insiste hasta la hora de reinicio y se usa lo último guardado. 5xx y fallos de red se reintentan dos veces (300 y 900 ms). Si aun así no responde, queda «sin comprobar», que no bloquea la activación (B10). «Volver a comprobar» salta el plazo, pero sigue mandando el ETag. `GITHUB_TOKEN` sigue siendo opcional.
- **Metadata (§24.1):** último push, README, manifiestos, señales de dependencias y si vino de la caché.
- **Demo (§26):** además de accesibilidad, redirecciones seguras, HTTPS, estado y título, se guarda la metadata pública (descripción, nombre del sitio, URL final). No se infiere backend ni base de datos.
- **Web:** sección «Validación técnica» en cada proyecto: estado del repositorio, lenguajes, último cambio, cada tecnología con su estado y origen, la demo, el aviso de que «detectado» no es dominio, y «Volver a comprobar» para el responsable.
- **GitHub simulado (pruebas):** repositorios con contenido (Node con compose, Python), ETag/304, cuota agotada con reinicio corto, y uno inestable que falla dos veces antes de responder. Registra las peticiones para verificar el uso de la caché.

**Migraciones:** `1780540000000-V3GithubCache` (`github_api_cache`; `project_link_checks.metadata`). `up` → `down` → `up` probado; no transforma datos.

**Pruebas ejecutadas:** unitarias del mapeo (79/79); `e2e-v3 batch11` (V3.11.1–V3.11.17); regresión completa.

**Decisiones:** SBOM y grafo de dependencias quedan fuera del núcleo (§24.7). `yarn.lock` no distingue dependencias directas: solo se informa el gestor.

**Riesgos:** ninguno nuevo.

**Resultados:** unitarias 79/79; `e2e-v3` 183 (B11 17/17). Regresión completa: 1608 correctas y 1 fallo en V3.11.15 por tiempo de la prueba (esperaba 2,6 s y el reinicio simulado de la cuota puede llegar a 3 s); corregida la espera a 3,6 s y repetida dos veces sin fallos. Total efectivo **1609/0**.

**Pendientes:** estado por skill con CORROBORATED_BY_ACADEMIC_REVIEW y regla de CORROBORATED del proyecto (B13).

---

## BATCH 12 — Equipos y contribuciones

**ESTADO:** completo

**Objetivo:** confirmación individual de contribuciones con roles controlados, uso de un equipo al crear el proyecto y avisos de confirmación requerida (§30, §31).

**Hallazgos iniciales:**
- El rol era texto libre («Desarrollador Backend», «Líder Técnico»…).
- No había forma de usar un equipo de colaboración al crear un proyecto.
- El integrante solo podía confirmar o editar; no había forma de pedir al responsable que corrigiera lo que le propuso.
- El bloqueo de la activación hasta que todos confirmen ya estaba en los requisitos de B10.

**Cambios:**
- **Roles (§30.1):** catálogo `PROJECT_ROLES` en `shared` (Responsable, Frontend, Backend, Base de Datos, Mobile, QA, UX/UI, DevOps, Datos/IA, Documentación, Otro). Se exige al invitar, al proponer y al confirmar. Los roles ya guardados se conservan. El rol no es fuente de afinidad.
- **«Usar uno de mis equipos» (§31):** al crear el proyecto con `teamId` e `inviteTeamMembers`, o después con `POST /projects/:id/invite-team`, se invita a los integrantes del equipo (sin el responsable). Se conserva su rol de equipo si está en el catálogo; si no, «Otro». Quien ya es integrante o tiene invitación pendiente se omite, así que repetirlo no duplica. La bitácora registra `desdeEquipo`. Cada integrante acepta y confirma su contribución.
- **Corrección (§30):** `POST /projects/:id/my-contribution/correction` con una nota (al menos 10 caracteres). Deja la contribución sin confirmar —el proyecto no se activa con información que el integrante no reconoce—, queda en la bitácora (`contribution_correction_requested`) y se avisa al responsable. El responsable edita la suya directamente.
- **Avisos (punto de emisión para B16):** invitación a proyecto, `PROJECT_MEMBER_CONFIRMATION_REQUIRED` al aceptar, `PROJECT_CONTRIBUTION_CHANGED` cuando el responsable propone cambios, y corrección pedida.
- **Web:** el rol se elige del catálogo; botón «Pedir corrección al responsable»; al elegir un equipo en el alta, opción «Invitar a los integrantes del equipo». **Móvil:** roles del catálogo al invitar y al confirmar.

**Migraciones:** `1780550000000-V3ProjectTeams` (evento `contribution_correction_requested`). `up` → `down` → `up` probado.

**Pruebas ejecutadas:** `e2e-v3 batch12` (V3.12.1–V3.12.15); suites con roles libres adaptadas al catálogo (`e2e-objective-5`: «Desarrollador Backend» → «Backend», «Tester» → «QA», «Analista» → «Datos/IA», «Líder Técnico» → «Responsable»; `e2e-objective-7`); regresión completa.

**Riesgos:** ninguno nuevo.

**Resultados:** unitarias 79/79; `e2e-v3` 198 (B12 15/15). Regresión completa: 19 suites sin fallos; en `e2e-v3` el observador de la API de desarrollo se reinició a mitad de la suite (no hubo cambios en `api/src`; solo escrituras del buzón de correo simulado) y las secciones 6 a 12 no pudieron conectar. Repetida sola: 198/198. Total efectivo **1624/0**.

**Pendientes:** regla de CORROBORATED del proyecto y estado por skill (B13).

---

## BATCH 13 — Respaldo de proyecto

**ESTADO:** completo

**Objetivo:** aplicar la regla de §28 (CORROBORATED = corroboración técnica + señal independiente) y registrar el respaldo de cada tecnología del proyecto sin castigar lo que la automatización no detecta (§24.4, §29).

**Hallazgos iniciales:**
- CORROBORATED se alcanzaba con dos señales cualesquiera y un repositorio o demo que respondiera, sin exigir que el repositorio respaldara ninguna tecnología.
- SUPPORTED se alcanzaba sin repositorio (con una evidencia o un integrante).
- No había estado por tecnología ni forma de que un docente confirmara una.

**Cambios:**
- **Reglas puras (`project-backing.rules.ts`):** DECLARED sin repositorio público comprobado (el de la URL vigente); SUPPORTED con repositorio y al menos una señal técnica o contextual; CORROBORATED con repositorio, al menos una tecnología declarada respaldada por lenguaje o manifiesto, y al menos una señal independiente (demo accesible, integrante con contribución confirmada o evidencia de contexto); REVIEWED con retroalimentación docente sobre SUPPORTED o CORROBORATED; FLAGGED ante contradicción (manda). Los integrantes cuentan solo si confirmaron su contribución.
- **Estado por tecnología (§24.4):** columnas en `project_skills` (`evidence_status`, `evidence_source`, revisión académica): DECLARED, CORROBORATED_BY_GITHUB_LANGUAGE, CORROBORATED_BY_MANIFEST, CORROBORATED_BY_ACADEMIC_REVIEW. Se sincroniza tras cada comprobación del repositorio. Editar las tecnologías conserva el estado de las que se quedan. Lo no detectado queda DECLARED y no resta (§29).
- **Revisión docente (§29):** `POST /projects/:id/feedback/skills/:skillId`. Solo un docente que puede ver el proyecto (visibilidad y alcance), con retroalimentación específica (al menos 10 caracteres), y solo sobre una tecnología declarada en el proyecto. Queda como retroalimentación visible para el equipo y en la bitácora. No es la corroboración técnica de §28.
- **Explicación (§25):** los motivos del respaldo nombran las tecnologías respaldadas, la demo, los integrantes confirmados y las evidencias, o que falta un repositorio comprobado.
- **Recálculo:** `POST /projects/admin/recompute-backing` (administración), en tandas con `after`, sin volver a consultar GitHub.
- **Web:** cada tecnología del proyecto muestra si está respaldada y por qué. El docente ve las tecnologías con su estado y puede confirmar las declaradas.

**Migraciones:** `1780560000000-V3ProjectSkillEvidence`. `up` → `down` → `up` probado.

**Pruebas ejecutadas:** unitarias de las reglas (84/84); `e2e-v3 batch13` (V3.13.1–V3.13.17); regresión completa.

**Decisiones:**
- Las suites que miden cómo un borrador gana respaldo (B6, B9, Objetivo 6) declaran ahora un repositorio público genérico desde el fixture: bajo §28, sin repositorio no hay respaldo posible.
- Se usaron columnas en `project_skills` en lugar de la tabla `project_skill_evidence` prevista en el plan: hay un estado por tecnología del proyecto y esa fila ya existe.

**Riesgos:** los respaldos guardados con la regla anterior se actualizan al próximo cambio del proyecto o con el recálculo de administración.

**Resultados:** unitarias 84/84; `e2e-v3` 215 (B13 17/17). Regresión completa: **1641 correctas, 0 fallos** (20 suites). (La sesión anterior se cerró a mitad de la primera corrida; Docker y la API se levantaron de nuevo y la regresión se repitió completa.)

**Pendientes:** Afinidad V4 con fuentes endurecidas y exclusión de borradores (B14).

---

## BATCH 14 — Afinidad V4

**ESTADO:** completo

**Objetivo:** que la afinidad mida solo trayectoria corroborada (§35), con habilidades respaldadas por área sin porcentaje de dominio (§36) y el respaldo separado (§37).

**Hallazgos iniciales:**
- Motor v3: un proyecto o un certificado SUPPORTED sumaban 10 y 8 de afinidad; los borradores contaban; un proyecto atribuía al integrante todas las tecnologías que él confirmaba, estuvieran o no corroboradas.
- Las actividades puntuaban solo en su área principal.
- No había una vista de habilidades respaldadas por área.

**Cambios:**
- **`AFFINITY_ENGINE_VERSION = 4`.** Las instantáneas de V1, V2 y V3 se conservan: la poda solo actúa sobre la versión vigente. Al arrancar, el recálculo masivo pasó **1233 perfiles** al motor v4 sin errores (snapshots: v1 3604, v2 5380, v3 11115, v4 1233).
- **Fuentes (§35.1):** puntúan solo la participación interna confirmada, los proyectos CORROBORATED o REVIEWED y las credenciales CORROBORATED. No puntúan intereses, áreas de mejora, borradores, tecnologías solo declaradas, credenciales DECLARED/SUPPORTED, evidencias por cantidad ni IA. Todo eso aparece en el desglose con su motivo.
- **Actividades (§35.2):** 10, con rendimientos 1 / 0,7 / 0,5 / 0,3 y tope 25, en **todas** las áreas configuradas en la actividad.
- **Proyectos (§35.3):** CORROBORATED 18, REVIEWED 22, FLAGGED 0; rendimientos 1 / 0,75 / 0,5 / 0,25 y tope 50. Para cada integrante, solo las tecnologías que él confirmó **y** están corroboradas en el proyecto (repositorio o docente). Nunca se reparten las del proyecto. Un proyecto SUPPORTED no suma afinidad, pero sí respaldo (§37). Un borrador no cuenta para nada.
- **Credenciales (§35.4):** solo CORROBORATED, 15, con los mismos rendimientos y tope 25.
- **Pesos:** `AFFINITY_POINTS_V4` en `shared` y migración que deja `project_supported` y `certificate_supported` en 0 en `affinity_weights` (el `down` restaura 10 y 8 con sus descripciones originales).
- **Habilidades respaldadas (§36):** el resumen trae, por área, cada tecnología respaldada con sus orígenes (proyecto, credencial o actividad), sin puntaje ni porcentaje. Web («Habilidades respaldadas») y móvil.

**Migraciones:** `1780570000000-V3AffinityV4Weights`. Copia de seguridad previa (`pre-v3-b14.dump`); `up` → `down` → `up` probado.

**Pruebas ejecutadas:** unitarias (86/86, con los pesos y rendimientos V4); `e2e-v3 batch14` (V3.14.1–V3.14.13); suites del motor reescritas a V4 en lugar de borrarlas: `e2e-batch-6` (§47 → §35: el borrador no suma ni respaldo; el proyecto se activa con un repositorio que corrobora la tecnología y vale 18; un integrante solo suma con tecnologías corroboradas), `e2e-objective-6` (17.9 y siguientes: CORROBORATED 18/15; el borrador no aparece ni deducido por etiquetas), `e2e-batch-5` (el repositorio del proyecto corrobora React). El GitHub simulado suma repositorios `lenguaje-X`, que corroboran por lenguaje (§24.2).

**Riesgos:** las afinidades de los estudiantes bajan donde se sostenían en proyectos o certificados solo SUPPORTED; es el comportamiento que pide §35. El historial V3 sigue consultable.

**Resultados:** unitarias 86/86; `e2e-v3` 228 (B14 13/13). Regresión completa: **1659 correctas, 0 fallos** (20 suites).

**Pendientes:** recomendaciones sin afinidad como factor (B15).

---

## BATCH 15 — Recomendaciones

**ESTADO:** completo

**Objetivo:** recomendar lo que el estudiante quiere explorar o mejorar, sin encasillarlo por lo que ya sabe; «No me interesa» que baje lo parecido sin tocar el perfil; recomendaciones dentro de Actividades (§34).

**Hallazgos iniciales:**
- Reparto 35/25/20/10/10 con la afinidad como factor (10 %) y un refuerzo por régimen que también dependía de la afinidad.
- El descarte quitaba la recomendación, pero no bajaba la prioridad de lo parecido ni quedaba auditado.
- «Recomendaciones» era una pantalla aparte que duplicaba Actividades.

**Cambios:**
- **Reparto V3 (§34):** 40 % intereses explícitos (áreas declaradas y texto libre), 30 % áreas de mejora, 15 % tecnologías de interés o a mejorar, 10 % orientación confirmada y 5 % feedback (guardó algo parecido). La afinidad no es un factor y el refuerzo por régimen ya no se aplica. El contexto (fecha, semestre, modalidad, disponibilidad) queda como filtro duro y como explicación, sin puntos. Los motivos siguen sumando exactamente el puntaje.
- **Multiárea:** una oportunidad con varias áreas se puntúa por la que mejor encaja con el estudiante.
- **«No me interesa» (§34.1):** queda auditado (`RECOMMENDATION_DISMISSED`), lo descartado no vuelve, y cada descarte parecido (misma área y tipo) multiplica la prioridad por 0,6, con un motivo que lo dice. No modifica los intereses del perfil. Guardar y descartar reordenan al momento.
- **Reglas publicadas:** reparto, filtros duros y efecto del descarte.
- **Web (§34.2):** Actividades tiene las pestañas [Para ti] [Todas] [Interesadas] [Inscritas] [Historial]. «Para ti» muestra las oportunidades sugeridas con su motivo, «Guardar» y «No me interesa». La entrada «Recomendaciones» sale del menú; su página queda como «Más sugerencias» (recursos, áreas para fortalecer y compañeros), enlazada desde «Para ti». El tablero lleva a «Para ti».

**Migraciones:** ninguna (los motivos se guardan en JSON).

**Pruebas ejecutadas:** unitaria del reparto (86/86); `e2e-v3 batch15` (V3.15.1–V3.15.12); suites que verificaban el reparto V2 actualizadas al de V3 (`e2e-objective-7` 18.15, 18.16 y 18.57b; `e2e-v2` V2.10.1, .2, .8 y .9; `e2e-batch-7` B7.13, B7.25, B7.53 y B7.54); regresión completa.

**Pendientes:** las mismas pestañas en móvil (B22).

**Riesgos:** ninguno nuevo.

**Resultados:** unitarias 86/86; `e2e-v3` 240 (B15 12/12). Regresión completa: 1670 correctas y 1 fallo en `e2e-web` (WEB.19b: al volver a Actividades, «Para ti» volvía a cargar con esqueleto). Corregido con la memoria de sesión y el esqueleto diferido que usan las demás vistas; `e2e-web` 29/29. Total efectivo **1671/0**.

---

## BATCH 16 — Notificaciones

**ESTADO:** completo

**Objetivo:** que las notificaciones sean un módulo funcional (§33): persistidas, con leído/no leído, sin repetir la misma alerta y con recordatorios de actividades de frecuencia controlada (§33.1).

**Hallazgos iniciales:**
- El punto de emisión (`NOTIFICATION_EMITTER`) existía desde B8, pero solo escribía en el registro: no había bandeja, ni lectura, ni deduplicación persistente.
- Faltaban los eventos `CONTACT_REQUEST`, `TEAM_INVITATION`, `TEACHER_FEEDBACK_RECEIVED`, `PARTICIPATION_CONFIRMED`, `ACTIVITY_REGISTRATION_ACCEPTED`, `ACTIVITY_STARTING` y `ACTIVITY_INTEREST_REMINDER`. `EXTERNAL_EVIDENCE_ENABLED` no coincidía con el nombre de §33.

**Cambios:**
- **Tabla `notifications`** con `type`, `recipient_user_id`, `entity_type`, `entity_id`, `dedupe_key`, `created_at`, `read_at` y `delivered_at` (§33.1). La clave (destinatario, `dedupe_key`) es única y la inserción usa `ON CONFLICT DO NOTHING`, así que la misma alerta no se repite aunque el evento se emita dos veces o en paralelo. Una notificación que falla nunca deshace la operación que la originó.
- **API:**
  - `GET /notifications/me` (`?unread=true`) devuelve solo las propias; mostrarlas las marca como entregadas.
  - `GET /notifications/me/unread-count`.
  - `PATCH /notifications/:id/read` responde 404 si la notificación es de otra persona.
  - `POST /notifications/me/read-all`.
  - `POST /notifications/admin/run-reminders` (solo administración, para diagnóstico).
- **Eventos conectados:** solicitud de contacto, invitación a equipo, retroalimentación docente (al responsable y a cada integrante, también al confirmar una tecnología), participación confirmada o aceptada, credencial externa disponible (renombrado a `EXTERNAL_EVIDENCE_AVAILABLE`), además de los de proyecto y credenciales de B8, B9 y B12.
- **Recordatorios (§33.1):** una tarea cada 30 minutos (`NOTIFICATION_REMINDERS_ENABLED`, `NOTIFICATION_REMINDERS_INTERVAL_MINUTES`).
  - Inscritos o aceptados reciben un aviso el día antes y otro unas horas antes.
  - Interesados reciben un único aviso el día antes.
  - Cada aviso tiene su propia clave, así que correr la tarea varias veces no repite nada.
- **Web:** una campana en la barra superior con el número de no leídas. Se consulta al cambiar de página, cada minuto y al volver a la pestaña, nunca con la pestaña oculta. La página `/notificaciones` tiene las pestañas Todas / Sin leer y «Marcar todas como leídas»; abrir un aviso lo marca como leído y lleva a su enlace.

**Migraciones:** `1780580000000-V3Notifications`. Copia de seguridad previa (`pre-v3-b16.dump`); probado `up` → `down` → `up`.

**Pruebas ejecutadas:** `e2e-v3 batch16` (V3.16.1–V3.16.17): evento por evento, deduplicación, propiedad (404), filtro de no leídas, recordatorios del día antes, de unas horas antes y para interesados, y que la tarea corra dos veces sin duplicar. También unitarias y la regresión completa.

**Riesgos:** los enlaces de los avisos apuntan a las rutas web; la app móvil los mostrará en B22.

**Resultados:**
- Unitarias: 86/86.
- `e2e-v3`: 257 (B16 17/17).
- Regresión completa: 1677 correctas y 2 fallos en `e2e-batch-7` (B7.47 y B7.48: la recomendación del taller del área nueva no apareció).
- Al repetir esa suite sola: 57/57.
- Causa: el límite por tipo de recomendaciones compite con las actividades abiertas que dejan las demás suites, así que depende del orden de ejecución. B16 no toca recomendaciones. Queda anotado para el endurecimiento de B23.

**Pendientes:** notificaciones en móvil (B22); `TEAM_APPLICATION*` llegan con las postulaciones (B17).

---

## BATCH 17 — Colaboración, contactos y equipos

**ESTADO:** completo

**Objetivo:** el flujo de §31 y §55 completo: crear necesidad → semestres objetivo → áreas → skills faltantes → cupos → estudiantes ven y postulan → responsable acepta o rechaza → equipo constituido → usarlo en un proyecto. QR y contactos según §32, y sin chat.

**Hallazgos iniciales:**
- Las necesidades no tenían semestres objetivo. Cualquiera las veía y las sugerencias ignoraban el semestre (§56).
- No existían postulaciones: la única forma de entrar a un equipo era una invitación del responsable.
- La pantalla de Colaboración no mostraba las necesidades de otros, así que un estudiante no podía encontrar a qué sumarse.
- Ya estaban cubiertos:
  - Área → skills (`assertSkillsBelongToAreas`, B4).
  - Usar un equipo en un proyecto (B12).
  - QR con slug opaco y contacto por solicitud.
  - Chat retirado (410).

**Cambios:**
- **`team_needs.target_semesters`**: vacío significa cualquier semestre. Solo ve la necesidad, y puede postular, quien cursa uno de esos semestres. Quien no, recibe 404 aunque cambie el id a mano. Las sugerencias del motor también filtran por semestre (§56).
- **`team_applications`**: una fila por (necesidad, estudiante), con una presentación breve opcional de hasta 300 caracteres.
  - Retirarse permite volver a postular sin crear filas nuevas. Un rechazo no se reabre insistiendo.
  - El responsable ve quién postuló, su semestre, su disponibilidad y qué habilidades de las que faltan tiene respaldadas. No hay puntajes ni ranking.
  - Rechazar exige un motivo predefinido (§55):
    - Buscamos otras habilidades.
    - El equipo ya está completo.
    - La disponibilidad no coincide.
    - Elegimos otro perfil para este cupo.
    - Otro motivo (pide un comentario breve).
  - El comentario es opcional en los demás motivos y tiene un máximo de 200 caracteres.
- **Aceptar constituye el equipo** si todavía no existía, con el responsable dentro, y cancela una invitación pendiente a la misma persona. Al llenarse los cupos, la necesidad se cierra y las postulaciones pendientes reciben «El equipo ya está completo», para que nadie espere en silencio.
- **Notificaciones (§33):** `TEAM_APPLICATION` al responsable; `TEAM_APPLICATION_ACCEPTED` y `TEAM_APPLICATION_REJECTED` (con el motivo) a quien postuló.
- **API:**
  - `POST /team-needs/:id/applications`
  - `GET /team-needs/:id/applications` (solo el responsable)
  - `GET /team-applications/mine`
  - `PATCH /team-applications/:id` (decidir; 404 si no es su necesidad)
  - `DELETE /team-applications/:id` (retirar)
- **Web (Colaboración → Equipos):**
  - «Necesidades abiertas para ti», con semestres, áreas, skills y cupos, y los botones Postular y Retirar.
  - «Mis postulaciones», con la respuesta y el motivo.
  - En «Mis necesidades», «Ver postulaciones» con Aceptar o No aceptar (motivo en una lista y comentario).
  - El formulario de la necesidad suma semestres objetivo, integrantes en total y la disponibilidad que se pide, con etiquetas asociadas a cada campo.

**Migraciones:** `1780590000000-V3TeamApplications`. Copia de seguridad previa (`pre-v3-b17.dump`); probado `up` → `down` → `up`. Las necesidades existentes quedan sin semestres objetivo (sin cambio de comportamiento).

**Pruebas ejecutadas:**
- Unitarias de la elegibilidad por semestre (89/89).
- `e2e-v3 batch17` (V3.17.1–V3.17.31): área → skill, rango de semestres, visibilidad, el 404 por id manual, el propio responsable, doble postulación, límite de texto, notificaciones, propiedad de las postulaciones, motivos obligatorios, predefinidos y «otro» con comentario, aceptar constituye el equipo, cierre por cupos con respuesta a quien esperaba, retirar y volver, sugerencias por semestre, el equipo usado en un proyecto y el chat retirado.
- Regresión completa.

**Riesgos:** la invitación directa (§47) sigue disponible junto a la postulación. Cuando una invitación aceptada llena los cupos, la necesidad no se cierra sola; se cierra a mano o en la siguiente aceptación.

**Resultados:**
- Unitarias: 89/89.
- `e2e-v3`: 288 (B17 31/31).
- Regresión completa: **1719 correctas, 0 fallos** (20 suites).

**Pendientes:** postulaciones en móvil (B22).

---

## BATCH 18 — Trayectoria, perfil y currículo

**ESTADO:** completo

**Objetivo:** «Mi trayectoria» como histórico completo con niveles en lenguaje natural (§42), y un currículo que se elige en dos niveles con solo ítems elegibles, vista previa, PDF, plantillas, IA opcional y el descargo de V3 (§43 a §45, §64).

**Hallazgos iniciales:**
- El CV se elegía solo por secciones y metía todos los proyectos (incluidos borradores y solo declarados), todos los certificados y las constancias junto a sus actividades (duplicadas).
- No existía un histórico con niveles: Mi progreso mostraba puntos, recompensas y el CV.
- El descargo decía «registrada en Afinia» y no «registrada y respaldada».

**Cambios:**
- **Reglas puras** (`trajectory/cv-eligibility.rules.ts`):
  - Proyecto: ACTIVE y CORROBORATED o REVIEWED.
  - Actividad interna: participación CONFIRMED.
  - Credencial externa: CORROBORATED (§45: la inscripción o una credencial SUPPORTED no prueban que se terminó el curso).
  - Niveles §42: Declarado, Con respaldo, Corroborado, Revisado e Inconcluso. Un borrador es inconcluso; una revisión manual de Dirección es «Revisado»; una inscripción sin confirmar es inconclusa y dice qué le falta.
- **Paso 1 (§43.1):** nueve secciones en el orden de la especificación. Las actividades internas se separan en académicas y extracurriculares (nuevas secciones `academic_activities` y `extracurricular_activities`; las de V2 siguen aceptadas).
- **Paso 2 (§43.2):** `GET /trajectory-summary/items` devuelve los ítems elegibles por sección, junto con cuántos quedan fuera y por qué.
  - La vista previa y el PDF reciben `items` por sección, en el orden elegido.
  - Un id que no es elegible, que es de otra persona o que pertenece a una sección inventada se rechaza (`CV_ITEM_NOT_ELIGIBLE` / `CV_ITEMS_INVALID`) en lugar de colarse.
- **§44:** una participación confirmada sale como «Participación confirmada en …». Si tiene constancia, se indica «Constancia interna disponible» en la misma línea, y la constancia no se repite como otra experiencia.
- **§42:** `GET /trajectory/me` reúne:
  - Proyectos, actividades internas y oportunidades externas.
  - Constancias y credenciales.
  - Equipos y retroalimentación docente.
  - La evolución de afinidad y respaldo.
  
  Cada entrada indica su nivel, la explicación y si puede ir al currículo.
- **Descargo exacto de V3 §43.6.** La ayuda de IA solo mejora la redacción y debe aceptarse (§43.5); la pantalla dice que nunca agrega cargos, tecnologías, actividades, certificados ni fechas.
- **Web (Mi progreso):**
  - Pestañas: «Mi trayectoria» (por defecto), Puntos e insignias, Recompensas y «Currículo».
  - La trayectoria muestra la leyenda de niveles, un filtro por nivel y la marca «Puede ir al currículo».
  - El currículo tiene el Paso 1 con casillas etiquetadas y el Paso 2 con los ítems, flechas para ordenar y lo que queda fuera con su motivo.

**Migraciones:** ninguna (solo lectura y reglas).

**Pruebas ejecutadas:**
- Unitarias de elegibilidad y niveles (95/95).
- `e2e-v3 batch18` (V3.18.0–V3.18.27).
- `e2e-web` WEB.18b y WEB.18c.
- Suites V2 actualizadas a V3 sin borrar comprobaciones:
  - B9.30: dieciséis secciones y el paso de nueve.
  - B9.35: los proyectos sin corroborar quedan fuera con su motivo.
  - V2.12.3: el descargo exacto de V3.
- Regresión completa.

**Riesgos:** un estudiante con proyectos solo SUPPORTED verá menos en su currículo que antes. Es lo que pide §43.3, y la pantalla explica qué falta.

**Resultados:**
- Unitarias: 95/95.
- `e2e-v3`: 316 (B18 28/28).
- Regresión completa: **1749 correctas, 0 fallos** (20 suites).

**Pendientes:** trayectoria y currículo en móvil (B22).
