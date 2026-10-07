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
