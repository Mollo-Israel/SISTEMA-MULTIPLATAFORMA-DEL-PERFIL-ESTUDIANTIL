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
