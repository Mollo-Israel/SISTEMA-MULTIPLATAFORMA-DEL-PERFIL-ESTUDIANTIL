# Afinia — Reporte de batches del cierre final V3.2

Fuente de verdad: `AFINIA_CIERRE_FINAL_V3_2_AJUSTES_CLAUDE_CODE_2026-10-12.md`.

Rama: `feat/afinia-v3-2`.

Formato de cada reporte: §76.

---

## BATCH 0 — Baseline y matriz de gaps

**ESTADO:** completo

**Objetivo:** contrastar el repositorio con V3.2 sin modificar código, verificando antes de cambiar (§75), y dejar el GAP y el plan.

**Hallazgos** (detalle en [`AUDITORIA_GAP_CIERRE_V3_2.md`](../AUDITORIA_GAP_CIERRE_V3_2.md)):
- Se reprodujeron contra la API real con PostgreSQL:
  - **C5:** `aws → Redes`, por la regla canónica que se aplica antes que el catálogo.
  - **C6:** un 500 por `activity_id NULL` al editar con 3 áreas, sin transacción.
  - **C9:** el borrador de un docente es visible para otro docente, para Dirección y para Administración.
  - **C10:** el creador edita después de la aprobación.
  - **C3:** a una cuenta activa se le responde «te enviamos un mensaje».
  - **C2:** el historial muestra previsualizaciones y descartados.
  - No existe «Cancelar envío».
- **C1**, con la causa real en la web: la API devuelve conteos y estados en minúsculas y la web los lee en mayúsculas. «Aplicar» queda en 0 y deshabilitado siempre.
- **C11:** la API conserva el instante. El desfase lo produce el formulario web: `slice(0,16)` de UTC en un `datetime-local`, que suma 4 h por guardado. Además, la web no pide la fecha de fin.
- **C12 ya estaba restaurado** (V3.1 B20). Dos cambios de V3.1 contradicen V3.2 y se retiran: «Crear actividad» en el menú de Sociedad (§58) y el selector de resultado en las externas (§29).

**Ya estaba correcto:** importación idempotente con plantillas diferenciadas, activación (enlace, código, token usado o reemplazado, suspendida, cooldown), taxonomía con `code`, `aliases` y área principal, oportunidades internas y externas, proyectos, GitHub, respaldo, equipos, notificaciones, recomendaciones sin afinidad, afinidad V4 sin multiplicar por skill, currículo en dos niveles, QR y paneles por actor.

**Cambios:** ninguno en el código. Se agregan `AUDITORIA_GAP_CIERRE_V3_2.md`, `PLAN_EJECUCION_CIERRE_V3_2.md` y este reporte.

**Migraciones:** ninguna. 81 aplicadas y 0 pendientes.

**Archivos modificados:** solo documentación.

**Pruebas ejecutadas:**
- `shared` build, API `tsc`, web build y móvil `tsc`: todos sin errores.
- Unitarias: 99/99.
- `migration:show`: 0 pendientes.
- Sondas de C2, C3, C5, C6, C7, C8, C9, C10 y C11 contra la API.
- Regresión completa.

**Resultados:**
- Regresión completa: **1821 correctas, 1 fallo**. El fallo, B10.36, es un artefacto de la prueba: un tope fijo de 900 estudiantes cuando la base de desarrollo ya tiene 916.

**Regresiones:** ninguna funcional.

**Pendientes:** batches 1 a 22 según [`PLAN_EJECUCION_CIERRE_V3_2.md`](../PLAN_EJECUCION_CIERRE_V3_2.md).

**Riesgos:** no están en el repositorio `corregir v2.docx` ni `corregir v3.docx`. Se toman las observaciones tal como las consolida V3.2.

---

## BATCH 1 — Importación y usuarios

**ESTADO:** completo

**Objetivo:** que la importación aplique lo válido aunque haya filas con problemas (§7.3), que el historial muestre solo lo aplicado o fallido (§7.5), validar columnas y codificación del CSV (§7.6) y dejar las grillas de usuarios e importación con 10 filas, orden y contador (§6.1, §6.2, §7.7, §8.6).

**Hallazgos verificados antes de cambiar (§75):**
- **C1:** la API ya aplicaba en forma parcial. El bloqueo estaba en la web: leía `counts.NEW` y `counts.UPDATE` cuando la API devuelve `new` y `update`. Por eso «Aplicar» quedaba en 0 y deshabilitado, y los estados del historial salían sin traducir.
- **C2:** el historial listaba también lotes `previewed` y `discarded`, y cada previsualización generaba un evento `IMPORT_PREVIEWED`.
- Una fila con una columna de menos o de más se leía por posición: el correo podía terminar en el apellido.

**Cambios:**
- **API:**
  - Nuevo estado `failed` con `failure_reason`. Si la transacción de aplicar falla, el lote queda FAILED con su motivo; los correos se enmascaran como `[correo]`.
  - La respuesta de aplicar trae `summary`: `inserted`, `updated`, `unchanged`, `skippedConflict` e `invalid`.
  - Las previsualizaciones son temporales:
    - Descartar borra el lote, y sus filas caen en cascada.
    - Las previsualizaciones que nadie aplica en `IMPORT_PREVIEW_TTL_HOURS` (24 por omisión) se borran solas.
    - El historial solo lista `applied` y `failed`.
    - Previsualizar ya no se audita; aplicar sigue auditado como `IMPORT_APPLIED`.
  - CSV:
    - Cada fila guarda cuántas columnas traía; con más o menos que la cabecera queda INVALID con un mensaje en español.
    - Un archivo que no es UTF-8 se rechaza con `IMPORT_ENCODING`.
    - Esto rige para estudiantes y para docentes.
  - Listado de usuarios:
    - La búsqueda incluye el código universitario.
    - Cada invitación pendiente informa `expiresAt` y `expired`, leídos en una sola consulta del último token de activación vigente.
- **Web:**
  - Los conteos y estados de importación se normalizan en `importsService` (C1).
  - Etiqueta «Falló» con el motivo.
  - Confirmar avisa cuántas filas quedan fuera y el aviso final muestra el resumen completo.
  - Componentes compartidos `usePaginacion`, `useOrden`, `ThOrden` y `Paginacion` (10 filas, anterior/siguiente, páginas, contador), aplicados a:
    - el listado de usuarios;
    - la previsualización;
    - el historial;
    - el detalle de un lote.
  - Usuarios:
    - Búsqueda con debounce, sin Enter, y «Limpiar» siempre visible.
    - Estado Pendiente / Caducada / Activa.
    - «Invitación enviada · Expira: …».
  - `.table-scroll` pasa a ser posicionado, para que el texto solo para lectores de pantalla no ensanche la página a 375 px.
- **Pruebas:**
  - B10.36 compara contra el total real de la carrera en lugar del tope fijo de 900.

**Migraciones:** `1780600000000-V32ImportHistory`. Agrega el valor de enum `failed` y la columna `failure_reason`. El `down` recrea el enum sin `failed` (los lotes fallidos pasan a `discarded`). Probada en orden `run → revert → run`. Respaldo previo: `pg_dump` en el scratchpad (17 MB).

**Archivos modificados:**
- `shared/src/enums/identity.enum.ts`
- `api/src/entities/import-batch.entity.ts`
- `api/src/imports/{csv.parser,imports.service,teacher-import.service}.ts`
- `api/src/users/{users.service.ts,types/public-user.ts}`
- `api/src/database/migrations/1780600000000-V32ImportHistory.ts`
- `api/test/unit/imports.test.ts`
- `web/src/components/ui.tsx`, `web/src/index.css`
- `web/src/pages/admin/{Imports,Users}.tsx`
- `web/src/services/{index,types}.ts`
- `scripts/e2e-v3-2.mjs` (nuevo), `scripts/e2e-batch-10.mjs`
- `.env.example`

**Pruebas ejecutadas:**
- `shared` build, `tsc` de API y web, build de la web.
- Unitarias: **107/107**. Hay 8 nuevas: columnas, codificación, comillas, resumen, lote FAILED sin correos y recorte del motivo.
- Suite `e2e-v3-2 batch1`: **25/25**. Cubre:
  - 200 existentes + 10 nuevos;
  - un conflicto que no bloquea a la fila nueva;
  - columna faltante o sobrante, en estudiantes y docentes;
  - duplicados de correo y de código dentro del archivo;
  - CSV que no es UTF-8;
  - previsualización fuera del historial, descarte que borra y nueva subida del mismo archivo;
  - historial solo `applied`/`failed`, con auditoría solo al aplicar;
  - búsqueda por código y vencimiento de la invitación;
  - 403 para un estudiante.

**Resultados:**
- Regresión completa: **1846 correctas y 1 fallo**.
- El fallo, WEB.22 (la grilla de usuarios a 375 px), se corrigió con `.table-scroll` posicionado. Al repetir `e2e-web` dio 38/38.
- Total final: **1847 correctas, 0 fallos**.

**Regresiones:** ninguna.

**Pendientes:** los estados FAILED solo se provocan en las pruebas unitarias; forzarlos de punta a punta exigiría romper la base. La paginación del resto de grillas se hace en los batches de cada módulo.

**Riesgos:** `IMPORT_PREVIEW_TTL_HOURS` borra las previsualizaciones viejas al abrir la pantalla o al subir otro archivo, no con un temporizador. Una previsualización de hace 23 h sigue disponible.

---

## BATCH 2 — Activación de cuentas

**ESTADO:** completo

**Objetivo:** que una cuenta activa no reciba otra activación (§8.3), que la espera entre correos venga del servidor (§8.4), retirar la pestaña «Tengo el enlace» en producción (§8.2) y mostrar a Administración el envío, el vencimiento y el estado (§8.6). Se conserva todo lo de §8.1 y la protección de §8.5.

**Hallazgos verificados antes de cambiar (§75):**
- **C3:** para una cuenta ACTIVE la API respondía 200 «te enviamos un mensaje». No encolaba nada, pero afirmaba un envío.
- `retryAfterSeconds` era siempre la configuración (120). Al volver a pedir, la cuenta atrás se reiniciaba aunque el servidor no hubiera enviado nada.
- La pestaña «Tengo el enlace» aparecía siempre.

**Cambios:**
- **API:**
  - Cuenta ACTIVE: `status: 'ALREADY_ACTIVE'` con un mensaje que orienta a iniciar sesión o recuperar. No crea token, no encola correo y no audita una solicitud que no hubo.
  - `retryAfterSeconds` es lo que realmente falta:
    - Para una cuenta real manda el mayor entre el token vigente y la última solicitud pública.
    - La espera se lleva por correo escrito, exista o no la cuenta, así que el número no delata cuentas (§12).
    - Lo mismo rige en la recuperación de contraseña.
  - Las respuestas genéricas traen `status: 'REQUESTED'`.
- **Web:**
  - Pantalla «Tu cuenta ya está activa» con «Iniciar sesión» y «Olvidé mi contraseña».
  - La cuenta atrás usa el valor del servidor.
  - La pestaña para pegar el enlace solo existe en desarrollo, o con `VITE_ACTIVATION_PASTE_LINK=true`. Quien llega desde el botón del correo trae el token en la URL y solo elige la contraseña.
- **Móvil:** con ALREADY_ACTIVE vuelve a «Iniciar sesión» con el aviso; la espera usa el valor del servidor.
- El estado Pendiente / Caducada / Activa y «Expira» en Administración (§8.6) se entregaron en el BATCH 1.
- **Documentación:**
  - `docs/DEMO_MULTIACTOR.md` (§9): un perfil del navegador equivale a una cuenta; para la demo se usan perfiles, incógnito o navegadores distintos.
  - `web/.env.example` documenta `VITE_ACTIVATION_PASTE_LINK`.

**Decisión de seguridad (para revisión):** §8.3 pide decir que la cuenta ya está activa. Esto revela que un correo institucional tiene cuenta activa, algo que antes la respuesta genérica ocultaba. Se implementa porque la especificación lo pide de forma explícita. Lo mitigan el límite de peticiones de `/activation` y que solo se aceptan correos institucionales. Las cuentas pendientes, suspendidas o inexistentes siguen indistinguibles.

**Migraciones:** ninguna.

**Archivos modificados:**
- `api/src/identity/activation.service.ts`
- `web/src/pages/auth/{RequestTokenPage,SetPasswordPage}.tsx`
- `mobile/src/screens/LoginScreen.tsx`, `mobile/src/services/index.ts`
- `web/.env.example`
- `docs/DEMO_MULTIACTOR.md`
- `scripts/e2e-v3-2.mjs`

**Pruebas ejecutadas:**
- `tsc` de API, web y móvil; build de la web.
- Suite `e2e-v3-2 batch2`: **12/12**. Cubre:
  - ALREADY_ACTIVE sin envío, sin auditoría y con el login intacto;
  - una espera que baja entre dos pedidos y no se reinicia;
  - la misma respuesta y la misma cuenta atrás para un correo inexistente;
  - el vencimiento a 48 h visible para Administración;
  - una cuenta suspendida no delatada;
  - la recuperación con espera real.

**Resultados:** regresión completa con **1859 correctas y 0 fallos** (21 suites).

**Regresiones:** ninguna. QA.13–QA.15 y 1.14, las pruebas previas de anti-enumeración y de ráfaga, siguen pasando.

**Pendientes:** ninguno del batch.

**Riesgos:** la última solicitud por correo se guarda en memoria del proceso. Si la API se reinicia, la espera de un correo inexistente vuelve a 0. La de una cuenta real sigue saliendo de sus tokens.

---

## BATCH 3 — Taxonomía: sugeridor, áreas secundarias y etiquetas semánticas

**ESTADO:** completo

**Objetivo:**
- Corregir el sugeridor de área (§10.5): AWS tiene que ir a Nube, no a Redes; sin subcadenas ni reglas fijas.
- Que una habilidad tenga una área principal y 0..N secundarias (§11).
- Que las etiquetas sean vocabulario del área y no copias de habilidades (§10.3).
- Crear «Computación en la nube» (§10.1).
- Avisar los riesgos al crear áreas y etiquetas (§10.6).

**Hallazgos verificados antes de cambiar (§75):**
- **C5:** `aws` iba a Redes. La causa son dos fallas juntas:
  - `SKILL_CANONICAL_RULES` (`aws → infraestructura`) se aplicaba antes que el catálogo.
  - Redes resolvía a `infraestructura` por su etiqueta homónima.
- La regla fija además bloqueaba guardar AWS en otra área.
- Las etiquetas de la semilla repetían habilidades: `sql|postgresql|mongodb`, `react|node|html|css`, `python`, `linux`.
- No existía el área de nube ni AWS, Docker o Kubernetes en el catálogo.

**Cambios:**
- **Sugeridor nuevo**, determinista y sin tablas en el código. Usa el catálogo vigente con la prioridad de §10.5:
  1. nombre o alias **exacto** de una habilidad;
  2. etiqueta de área, como palabras completas;
  3. habilidad relacionada (gana la más específica: «React Native Kit» es de Móvil y no de Web);
  4. coincidencia débil por vocabulario;
  5. nada.
- Sin subcadenas brutas: los términos cortos («C», «JS», «AS») solo coinciden completos.
- Al guardar ya no hay bloqueos duros:
  - Una sugerencia de confianza alta o media que no incluya ninguna de las áreas elegidas (principal o secundarias) pide un motivo, que se audita.
  - La sugerencia débil solo orienta.
  - Administración decide (§10.6).
- **Áreas secundarias:**
  - Tabla `skill_area_relations` (`relation_type = 'SECONDARY'`); `academic_area_id` sigue siendo la principal (§11.2).
  - Alta, edición y listado con `secondaryAreaIds`; no se repiten ni incluyen la principal.
  - La guardia área→habilidad acepta la principal o una secundaria.
  - El selector de los formularios muestra «Relacionadas con esta área» (§11.3).
- **Duplicados:** un nombre que ya es alias de otra habilidad se rechaza (§10.4).
- **Análisis de etiquetas:** avisa las que repiten una habilidad (`skillDuplicates`).
- **Datos:**
  - Las etiquetas de las 8 áreas base pasan a vocabulario semántico, solo si seguían como en la semilla.
  - Se crea «Computación en la nube» con AWS, Microsoft Azure, Google Cloud, Docker y Kubernetes.
  - Alias de las habilidades base: Postgres, ReactJS, Node, JS, TS, ML y Linux.
  - Secundarias de §11.1: Linux en Ciberseguridad y Nube; Python en Web; Docker en Ingeniería de Software.
  - Semillas actualizadas para instalaciones nuevas.
- **Web (Áreas y habilidades):**
  - Burbujas de áreas secundarias.
  - El nivel del sugeridor con su nombre.
  - La IA se ofrece cuando no hay sugerencia o es débil.
  - Las grillas de áreas y habilidades con 10 filas, orden y contador.
- **IA:** si el catálogo ya conoce la tecnología (nombre o alias exacto) no se consulta a la IA.

**Migraciones:**
- `1780610000000-V32SkillSecondaryAreas` (tabla).
- `1780610000001-V32SemanticAreaTags` (datos). El `up` registra en `v32_catalog_seed_log` lo que hizo. El `down` revierte solo eso:
  - lo creado se borra si nadie lo usa y, si ya se usa, se desactiva;
  - las etiquetas y alias vuelven a su estado previo.
- Probadas en orden `run → revert → revert → run`. Respaldo previo: `pre-v32-b3.dump`.

**Archivos modificados:**
- `api/src/catalogs/{skill-classification,catalogs.service,catalogs.controller,catalogs.module,area-skill.guard}.ts`
- `api/src/catalogs/dto/{create,update}-skill.dto.ts`
- `api/src/entities/{skill,skill-area-relation,index}.ts`
- `api/src/ai/ai.service.ts`
- `api/src/database/seeds/{academic-areas,skills}.seed.ts`
- 2 migraciones
- `web/src/pages/admin/AreasSkills.tsx`, `web/src/components/AreaSkillPicker.tsx`, `web/src/services/types.ts`, `web/src/index.css`
- Pruebas: `api/test/unit/rules.test.ts`, `scripts/e2e-v3-2.mjs`, `scripts/e2e-v2.mjs`, `scripts/e2e-v3.mjs`

**Pruebas ejecutadas:**
- Unitarias: **117/117**. Hay 11 nuevas del sugeridor: los cinco niveles, el bug de AWS, tokens cortos, la más específica, la secundaria y el aviso de etiqueta-habilidad.
- Suite `e2e-v3-2 batch3`: **20/20**. Cubre:
  - el catálogo semántico;
  - AWS en Nube;
  - Linux con dos secundarias;
  - cada nivel del sugeridor contra la API;
  - el duplicado por alias;
  - alta y edición de secundarias, y la secundaria inexistente;
  - un proyecto de Ciberseguridad que acepta Linux y uno de Web que no;
  - 403 para un docente.

**Pruebas ajustadas:** V3.2 reemplaza explícitamente las reglas canónicas («No adaptar el modelo al bug»).
- V2.4.1–V2.4.4 verifican ahora el comportamiento del catálogo.
- V3.4.9 usa un nombre que no contiene una etiqueta, porque §10.5 pone la etiqueta antes que la relacionada.
- V3.17.1 elige como «habilidad de otra área» una que no la tenga ni como secundaria.

**Resultados:**
- Regresión completa: **1878 correctas y 1 fallo**. El fallo fue V3.17.1, un artefacto de la prueba por §11. Corregido, `e2e-v3 batch17` da 31/31.
- Total final: **1879 correctas, 0 fallos**.

**Regresiones:** ninguna funcional.

**Pendientes:**
- El motor de afinidad todavía usa las etiquetas para deducir el área de un proyecto sin tecnologías o de un certificado sin área (`inferAreasByTech`, `matchAreasByText`). §12.3 lo prohíbe; se retira en el BATCH 15 (afinidad V5).
- El contexto área+habilidad de las experiencias se hace en los BATCH 4 (actividades) y 11 (proyectos).

**Riesgos:** las etiquetas nuevas cambian lo que esos dos respaldos por texto encuentran hasta el BATCH 15. Se eligieron sin términos cortos que casen dentro de otras palabras (se quitaron `ios` y `api`).

---

## BATCH 4 — Actividad multiárea transaccional y contexto área + habilidad

**ESTADO:** completo

**Objetivo:**
- Corregir el 500 al editar una actividad con varias áreas (C6).
- Que las habilidades persistan al editar (C7).
- Que todo se escriba en una transacción (§19).
- Guardar en qué área se trabaja cada habilidad (§11.4).

**Hallazgos verificados antes de cambiar (§75):** `update` cargaba la actividad con sus relaciones (`activityAreas`, `activitySkills`, `academicArea`, `category`), reemplazaba las áreas y después guardaba la entidad con la lista vieja. Eso tenía tres efectos:
- TypeORM intentaba «sincronizar» esa lista y escribía `activity_id = NULL`: el 500 de C6.
- Las habilidades se perdían.
- No había transacción: quedaban áreas a medias.

Además, con una prueba directa contra la base se encontró un efecto que el 500 tapaba. `repository.create({...actividad})` toma el id de la relación cargada y **pisa** `academicAreaId` y `categoryId` recién cambiados. El área principal y la categoría nunca cambiaban al editar.

**Cambios:**
- **API:**
  - `create` y `update` escriben la actividad, sus áreas, sus habilidades, sus reglas y la auditoría en **una transacción**.
  - Se guarda solo la fila, sin relaciones; se quitan **antes** de `create` (`soloFila`).
  - Primero se valida todo; si algo falla, no se escribe nada.
- **Contexto (§11.4):**
  - `activity_skills.academic_area_id` y `skillContexts` en el DTO (`{ skillId, areaId }`).
  - Se valida que el área esté entre las elegidas y que la habilidad pertenezca a ella (principal o secundaria). Si no se indica, se deduce: la principal si está elegida, si no la primera secundaria.
  - Al editar otra cosa el contexto se conserva. Si se quita su área, vuelve a la principal.
  - `resolveSkillContexts` queda en `area-skill.guard.ts` para reutilizarla en proyectos (BATCH 11).
- **Web:**
  - `AreaSkillPicker` guarda el contexto. Si una habilidad aparece en dos áreas elegidas, queda marcada en una y punteada en la otra; pulsarla en la otra cambia su área.
  - `ActivityManager` envía y recupera `skillContexts`.

**Migraciones:** `1780620000000-V32ActivitySkillContext`. Agrega la columna con su FK (`ON DELETE SET NULL`) y rellena lo existente con esta prioridad: principal elegida → secundaria elegida → área principal de la actividad. 579 de 581 filas quedaron con contexto; las 2 restantes son de actividades sin área. Probada en orden `run → revert → run`. Respaldo previo: `pre-v32-b4.dump`.

**Archivos modificados:**
- `api/src/activities/activities.service.ts`, `api/src/activities/dto/create-activity.dto.ts`
- `api/src/catalogs/area-skill.guard.ts`, `api/src/entities/activity-skill.entity.ts`
- La migración
- `web/src/components/{AreaSkillPicker,ActivityManager}.tsx`, `web/src/services/types.ts`, `web/src/index.css`
- `scripts/e2e-v3-2.mjs`

**Pruebas ejecutadas:** suite `e2e-v3-2 batch4`, **14/14**. Cubre:
- editar con 3 áreas (antes 500) y conservar 3 habilidades;
- quitar un área con sus habilidades, y el rechazo por campo si aún tiene habilidades;
- una edición inválida que no cambia nada (ni el título ni las áreas);
- el contexto deducido, el explícito en una secundaria, el que se conserva y el inválido (400 por campo);
- la vuelta a la principal y el contexto al crear;
- el cambio de categoría, que ahora persiste.

**Resultados:** regresión completa con **1893 correctas y 0 fallos** (21 suites).

**Regresiones:** ninguna.

**Pendientes:** la afinidad todavía no usa el contexto; se cambia en el BATCH 15 (afinidad V5).

**Riesgos:** ninguno conocido.

---

## BATCH 5 — Formulario de actividad, responsables, modalidad, estados y resultado

**ESTADO:** completo

**Objetivo:** cumplir §16–§22, §28, §29 y §38:
- separar creador, responsables y contactos;
- campos mínimos con modalidad condicional;
- enlaces de apoyo e imagen;
- acciones explícitas (Guardar borrador / Publicar / Enviar a revisión);
- cierre y fin automáticos;
- cancelación con motivo;
- sin etiquetas manuales;
- las cinco opciones de resultado y ningún selector en las externas;
- hora correcta al editar (C11).

**Hallazgos verificados antes de cambiar (§75):**
- **C11:**
  - La API conserva el instante.
  - El formulario web cargaba `eventDate.slice(0,16)` (UTC) en un `datetime-local` y cada guardado sumaba 4 h.
  - No existía la fecha de fin en la web.
- **Responsables:**
  - Había un único `responsible_user_id`.
  - Solo Administración podía reasignarlo; Dirección no.
- **Ciclo de vida:**
  - Nada cerraba ni finalizaba las actividades por fecha.
  - Se publicaban actividades sin fechas, sin aula ni enlace y sin habilidades.
- **Formulario:**
  - Etiquetas manuales y un «Enlace externo» genérico.
  - Un selector de estado en el formulario, con el que guardar podía publicar.
  - Selector de resultado también en las externas.

**Cambios:**
- **API:**
  - **Responsables y contactos (§16–§17):**
    - `activity_responsibles` (1..N; el primero es el principal y queda en `responsible_user_id`) y `activity_contacts` (0..N).
    - Docente: responsable él mismo.
    - Sociedad: integrantes activos de Sociedad.
    - Dirección: docentes, Sociedad o Dirección.
    - Administración: tiene que nombrarlo.
    - Contactos: personal activo; un estudiante solo si lo asigna un docente y está en sus semestres. Ese estudiante no gestiona nada.
    - Cualquier responsable gestiona la actividad.
    - `GET /activities/people` busca candidatos (20, con búsqueda, acotados a lo que quien pregunta podría asignar).
  - **Campos (§18):**
    - `meeting_url`, `resource_links[]` (https), `image_file_id` (imagen propia PNG, JPG o WEBP, servida por `/api/files` con autorización y protegida de la limpieza de huérfanos), `cancellation_reason`, `cancelled_at` y `updated_by`.
    - Virtual borra el aula; presencial, el enlace.
  - **Completa para publicar (§18, §19, §21.1):** el borrador puede quedar incompleto. Publicar o enviar a revisión exige, con un error por campo:
    - inicio;
    - fin posterior al inicio;
    - aula y/o enlace según la modalidad;
    - al menos un área y una habilidad.
  - **Título:** un título solo de símbolos se rechaza en su campo.
  - **Cancelar (§21.6):** exige motivo; el estudiante lo ve y la auditoría lo guarda.
  - **Ciclo automático (§21.4–§21.5):**
    - `ActivityLifecycleWorker` (`ACTIVITY_LIFECYCLE_INTERVAL_MS`, 60 s).
    - Lo que empezó pasa a CLOSED; lo que terminó, a FINISHED, con aviso de elegibilidad si espera credencial.
    - Cada cambio queda auditado como automático.
  - **Búsqueda (§20):** `search_keywords` se derivan de áreas (nombre y etiquetas) y habilidades (nombre y alias). `tags` sigue aceptándose por compatibilidad, pero ya no se pide.
  - **Resultado (§28–§29):**
    - Se agregan `participation_only` e `institution_issued_certificate`.
    - `other_authorized_resource` ya no se acepta en escrituras nuevas.
    - Una externa siempre queda en `external_credential_expected`.
  - **Guardia área→habilidad:** una habilidad inexistente es 400 en su campo, no 404.
- **Web (`ActivityManager`):**
  - **Fechas:**
    - Inicio y fin en hora de Bolivia (`lib/fechas.ts`, `VITE_APP_TIMEZONE`).
    - La conversión es exacta aunque el navegador esté en otra zona (C11).
  - **Formulario:**
    - Aula y enlace según la modalidad.
    - Responsables y contactos con combobox de búsqueda (`PersonPicker`).
    - Enlaces de apoyo e imagen con vista previa.
    - Resultado solo en las internas, con las cinco opciones y su explicación.
  - **Acciones:** botones explícitos según el rol; editar algo publicado es «Guardar cambios».
  - **Cancelar:** pide el motivo en un modal.
  - **Errores:** cada uno queda debajo de su campo.
  - **Etiquetas:** desaparecen las etiquetas manuales y su sugerencia por IA.

**Migraciones:** `1780630000000-V32ActivityFields`.
- **Datos existentes:** se rellenaron 5920 responsables desde `responsible_user_id` y las palabras clave de 3946 actividades.
- **`down`:** recrea el enum sin los dos valores nuevos. Los pasa a `internal_constancy` o `none`, y eso pierde ese dato.
- **Verificación:** probada en orden `run → revert → run`. Respaldo previo: `pre-v32-b5.dump`.

**Pruebas:**
- **Suite `e2e-v3-2 batch5`, 34/34.** Cubre:
  - título solo de símbolos;
  - fin anterior al inicio;
  - borrador incompleto, y publicar incompleto con 5 campos señalados;
  - virtual, híbrida y presencial;
  - enlaces https;
  - palabras de búsqueda derivadas;
  - creador, responsables y principal; el responsable que gestiona; el docente que no nombra a otros;
  - contacto estudiante dentro y fuera del alcance, sin gestión;
  - buscador acotado;
  - las cinco opciones de resultado y la externa sin selector;
  - imagen propia visible y ajena rechazada;
  - cancelación con y sin motivo, auditada y visible al estudiante;
  - instante conservado (C11);
  - cierre y fin automáticos, y la inscripción rechazada después.
- **Fixtures:** `completarActividad` completa en las pruebas anteriores lo que una actividad mínima no traía (fechas, aula o enlace, área, habilidad neutra), sin pisar lo que la prueba envía. Las suites con su propio `req` usan `ajustarCuerpoActividad`.
- **Pruebas ajustadas por V3.2:**
  - V3.6.13: Dirección ahora reasigna responsables (§17).
  - B4.44, V2.10 y V3.15: escenarios con áreas sin habilidades; §19 exige una.
  - 18.28: un motivo de compañero puede nombrar una habilidad del catálogo.

**Resultados:**
- Regresión completa: **1926 correctas y 1 fallo**. El fallo fue 18.28, corregido en la prueba; al repetir, `e2e-objective-7` dio 89/89.
- Total final: **1927 correctas, 0 fallos**.

**Regresiones:** ninguna funcional.

**Pendientes:**
- Las tarjetas del estudiante con imagen, fin, enlaces y motivo: BATCH 7.
- El flujo del certificado institucional: BATCH 8.
- Las acciones de revisión: BATCH 6.

**Riesgos:**
- **Actividades antiguas:** las que se publicaron incompletas siguen visibles. Solo se exige completarlas si se edita lo mínimo o se vuelven a publicar.
- **Ciclo automático:** cierra las actividades antiguas que ya empezaron; es el comportamiento pedido.

---

## BATCH 6 — Revisión, propiedad y permisos de actividades

**ESTADO:** completo

**Objetivo:**
- Borradores privados (C9, §24).
- «Cancelar envío» (§23.1).
- Aprobada sin cambios del creador (C10, §23.3).
- «Mis actividades» frente a «Actividades de la carrera» (C8, §25).
- Seguimiento de Dirección con filtro Académica / Extracurricular / Externa (§26).
- Avisos de revisión (§47).

**Hallazgos verificados antes de cambiar (§75):**
- **C9:**
  - El borrador de un docente lo veían otros docentes del mismo semestre, Dirección (en el listado y en gestión) y Administración (en gestión).
  - El detalle por URL no filtraba nada: bastaba con conocer el id.
- **C10:** con la actividad aprobada, el creador seguía editando el contenido.
- **`cancel-submission`:** respondía 404.
- **C8:** `canManage` daba gestión a cualquier docente cuyo semestre se cruzara con el de la actividad, incluidos los borradores ajenos.
- **Avisos:** la revisión no avisaba a nadie.

**Cambios:**
- **API:**
  - **Visibilidad de un borrador (`veBorrador`):** lo ven quien lo creó y sus responsables. Dirección y Administración, solo desde que se envía a revisión. Ningún otro docente, y nunca un estudiante.
  - **Dónde se aplica:**
    - en el listado y en «gestionadas»;
    - en el detalle por URL, que responde 404 aunque se cambie el id;
    - en la edición y en participantes;
    - en el resto de rutas que pasan por `canManage`.
  - **Gestión:** la tienen el creador, los responsables, Administración y Dirección (§26). El docente ya no gestiona lo de un colega por compartir semestre (§25); lo consulta en «Actividades de la carrera».
  - **Retirar el envío:** `POST /activities/:id/cancel-submission`.
    - Solo quien la propuso y mientras esté PENDING.
    - Vuelve a borrador y sale de la bandeja.
    - Queda en la historia (`cancelled`) y en la auditoría (`ACTIVITY_SUBMISSION_CANCELLED`).
  - **Aprobada (C10):** el creador recibe 409 `ACTIVITY_APPROVED_LOCKED` si intenta cambiar el contenido. Puede publicarla y gestionar la participación. Dirección la ajusta, con auditoría.
  - **Avisos:** `ACTIVITY_REVIEW_SUBMITTED` a Dirección; `ACTIVITY_REVIEW_OBSERVED`, `_APPROVED` y `_REJECTED` a quien la propuso.
- **Web:**
  - «Cancelar envío» en la fila pendiente.
  - Sin «Editar» para Docente y Sociedad cuando la actividad está aprobada.
  - Dirección tiene «Actividades de la carrera» con pestañas Académicas, Extracurriculares (seguimiento, sin crear) y Externas (de cualquier tipo).

**Migraciones:** `1780640000000-V32ReviewCancelSubmission`. Agrega `cancelled` a la restricción de acciones de revisión. El `down` borra esas filas de la historia para poder restaurarla. Probada en orden `run → revert → run`. Respaldo previo: `pre-v32-b6.dump`.

**Pruebas:**
- **Suite `e2e-v3-2 batch6`, 28/28,** cruzando los cinco roles:
  - borrador invisible para otro docente (listas, URL y edición), para Dirección, para Administración y para el estudiante;
  - «Mis actividades»;
  - envío, bandeja y aviso; retiro ajeno rechazado y retiro propio; vuelta a privada; nada que retirar; historia;
  - observada (aviso, corrección, reenvío) y aprobada (aviso);
  - contenido bloqueado para el creador; publicación y ajuste de Dirección, auditados;
  - el otro docente consulta pero no gestiona;
  - el estudiante la ve publicada;
  - Sociedad: el borrador de un integrante no lo ve otro;
  - Dirección sigue lo extracurricular aprobado;
  - los borradores de Dirección y de Administración no los ven los demás, pero sí el responsable.
- **Pruebas ajustadas por V3.2:**
  - B4.12: un docente del mismo semestre ya no gestiona la actividad de otro (§25).
  - 3.13: el panel de Dirección incluye la extracurricular aprobada (§26).

**Resultados:**
- Regresión completa: **1953 correctas y 2 fallos**. Los dos fallos eran B4.12 y 3.13, los cambios de regla pedidos. Corregidas esas pruebas, `e2e-batch-4` y `e2e-objectives-40` dieron 48/48 y 249/249.
- Total final: **1955 correctas, 0 fallos**.

**Regresiones:** ninguna funcional.

**Pendientes:** las tarjetas y la lista de participantes: BATCH 7.

**Riesgos:** un docente que antes confirmaba la participación en actividades de colegas por compartir semestre ya no puede hacerlo. Es lo que pide §25: para gestionarlas tiene que ser responsable.

---

## BATCH 7 — Tarjetas y detalle de actividad, participantes y UX

**ESTADO:** completo

**Objetivo:**
- Tarjetas de alto fijo con la descripción truncada y el detalle completo (C16, §37).
- Participantes paginados y legibles en el teléfono (C17, §64).
- Grillas de 10 filas (§6.1).
- Combobox grandes acotados y con búsqueda (§6.3).
- Modales sin parpadeo (§6.5).

**Hallazgos verificados antes de cambiar (§75):**
- La tarjeta del estudiante mostraba la descripción completa y deformaba la grilla.
- La tarjeta no traía imagen, fin, habilidades ni enlaces.
- El listado no cargaba habilidades ni personas.
- Los participantes salían en una tabla sin paginar y de ancho fijo.
- La grilla de gestión usaba «Ver más».
- Al verificar en pantalla (capturas con Playwright a 1280 y 375 px) aparecieron tres cosas más:
  - El selector de áreas desplegaba más de 2000 burbujas en la base de desarrollo.
  - La «X» de **todos** los modales quedaba en la esquina de la pantalla, porque `.modal` no era posicionado.
  - Al abrir un modal, ocultar la barra de desplazamiento corría la página hacia un lado (el «parpadeo»).

**Cambios:**
- **API:** el listado y «Mis actividades» traen las habilidades (con su nombre), los responsables, los contactos y la imagen. La vista del estudiante sigue siendo la mínima: sin correo de los responsables y sin datos de revisión.
- **Web:**
  - **`ActivityCard` (alto fijo):** imagen, título, tipo, estado, inicio–fin en hora de Bolivia, modalidad, aula, áreas y habilidades resumidas («Bases de Datos, Redes +2»), cupo, enlace de reunión y primer enlace útil. La descripción se trunca a 3 líneas; si fue cancelada, muestra el motivo.
  - **`ActivityDetail`:** muestra todo lo de la tarjeta y además:
    - la descripción completa;
    - responsables y contactos (con correo);
    - el proveedor;
    - el enlace oficial y los recursos;
    - el resultado al terminar.
  - **Participantes:** 10 por página, con contador por grupo, apilados en pantallas angostas. La grilla de gestión también va de a 10.
  - **Selector de áreas:** con más de 10 áreas muestra las elegidas y hasta 12 más, con búsqueda y el número de las que no se muestran.
  - **Modal:** se compensa el ancho de la barra de desplazamiento, se respeta `prefers-reduced-motion` y la «X» queda dentro del modal.

**Migraciones:** ninguna.

**Archivos modificados:**
- `api/src/activities/activities.service.ts`
- `web/src/components/{ActivityCard (nuevo),ActivityManager,AreaSkillPicker,ui}.tsx`
- `web/src/pages/student/Activities.tsx`, `web/src/index.css`
- `scripts/e2e-v3-2.mjs`

**Pruebas:**
- **Suite `e2e-v3-2 batch7`, 8/8.** Cubre:
  - la tarjeta con imagen, fin, reunión y primer enlace;
  - 4 áreas y 4 habilidades con nombre;
  - responsables sin correo y vista mínima del estudiante;
  - «Mis actividades» del responsable;
  - 12 inscritos visibles para el responsable, sin datos de más.
- **Verificación visual:** capturas del estudiante (1280 y 375 px), del detalle y del formulario de Dirección, antes y después de corregir.
- **`e2e-web`:** 38/38 después del cambio en el selector de áreas, que también usan Proyectos y Colaboración.

**Resultados:**
- Regresión completa: **1963 correctas y 0 fallos** (21 suites).
- Tras los ajustes visuales, `e2e-web` dio 38/38.

**Regresiones:** ninguna.

**Pendientes:** el favorito de una actividad terminada (§36) llega con la Biblioteca y las recomendaciones (BATCH 9–10).

**Riesgos:** ninguno conocido.

---

## BATCH 8 — Resultados internos y externos

**ESTADO:** completo

**Objetivo:**
- El certificado emitido por la institución, con su emisor real y sin que Afinia se atribuya la autoría (§28.3).
- Mantener la constancia interna (§28.2) y la credencial externa esperada con su flujo fijo (§28.4, §29–§34).
- Verificar que un fallo técnico de lectura dé INCONCLUSIVE (§31).

**Hallazgos verificados antes de cambiar (§75):**
- `institution_issued_certificate` existía desde el BATCH 5 solo como opción. No había dónde guardar el emisor real ni cómo entregar el certificado.
- La constancia interna automática y el flujo externo (aceptación → fin → elegibilidad → evidencia → validación) ya funcionaban (V3.1 B8–B9).
- El OCR sin motor o sin resultado ya deja el recurso en INCONCLUSIVE y no en FAILED (`ocr.port.ts`).
- **Hallazgo de seguridad:** `GET /constancies/internal/eligible/:activityId` listaba los confirmados de **cualquier** actividad a cualquier docente que conociera el id.

**Cambios:**
- **Actividad:**
  - `certificate_issuer` (emisor real).
  - Publicar con INSTITUTION_ISSUED_CERTIFICATE exige el emisor, con error en su campo.
- **Entrega:** `POST /constancies/internal/institution-certificates/:activityId`.
  - **Quién entrega:** Dirección, el creador o un responsable. Administración no entrega documentos académicos (§6.5).
  - **A quién:** solo a confirmados.
  - **Archivo y código:** el archivo es opcional y tiene que haberlo subido quien entrega; el código de verificación del emisor también es opcional.
  - **Registro:**
    - Afinia lo guarda como `institution_certificate` con `issuer_name`.
    - Volver a entregar actualiza el archivo o el código, sin duplicar.
    - La entrega queda auditada (`CONSTANCY_ISSUED`).
  - **Aviso y trayectoria:** el estudiante recibe `CERTIFICATE_DELIVERED` y se recalcula su trayectoria.
- **Constancias:** `kind`, `issuer_name`, `stored_file_id` y `certificate_code`. Lo existente queda como `internal_constancy`.
- **Seguridad:** `eligible` responde 404 a quien no gestiona la actividad.
- **Archivos:** el certificado lo descargan su titular, quien lo entregó, Dirección y Administración; para cualquier otro, 404. Está protegido de la limpieza de huérfanos.
- **Trayectoria:** el certificado se muestra como «Emitido por <emisor>», no como algo de Afinia.
- **Web:**
  - Campo «Emisor del certificado» en el formulario.
  - En participación: «Entregar certificado», por persona o a todos los confirmados, con archivo y código opcionales.
  - El estudiante ve «Constancias y certificados recibidos», con el emisor, el código y «Ver certificado».

**Migraciones:** `1780650000000-V32InstitutionCertificate`. El `down` quita los certificados institucionales, que no existían antes, y las columnas. Probada en orden `run → revert → run`. Respaldo previo: `pre-v32-b8.dump`.

**Pruebas:**
- **Suite `e2e-v3-2 batch8`, 14/14.** Cubre:
  - el emisor obligatorio para publicar y el que queda guardado;
  - que confirmar no fabrica el certificado;
  - el `eligible` ajeno con 404 y el propio;
  - el rechazo a quien no está confirmado y a un docente ajeno;
  - la entrega con archivo y código;
  - el estudiante que lo recibe con el emisor real;
  - la descarga del titular y el 404 a otro estudiante;
  - el aviso y la trayectoria «Emitido por…»;
  - la reentrega sin duplicar;
  - Administración con 403.

**Resultados:** regresión completa con **1977 correctas y 0 fallos** (21 suites). Unitarias: 117/117.

**Regresiones:** ninguna.

**Pendientes:** ninguno del batch. Las credenciales históricas (§33) ya existen y se revisan en el BATCH 14.

**Riesgos:** ninguno conocido.

---

## BATCH 9 — Biblioteca de recursos

**ESTADO:** completo

**Objetivo:** cerrar la ambigüedad de «Recursos» (§35).
- **Qué es:** material permanente, sin fechas, inscripción, asistencia, certificado ni afinidad.
- **Qué hace el estudiante:** lo busca, lo filtra por área o habilidad, lo abre y lo guarda como favorito.
- **Qué hace Dirección:** lo carga con varias áreas, sus habilidades y una imagen.

**Hallazgos verificados antes de cambiar (§75):**
- El catálogo de recursos existía (§61, Dirección y Administración), pero con una sola área, sin imagen y sin favoritos.
- El estudiante no tenía dónde verlo, salvo en las recomendaciones.
- La afinidad no usa recursos (correcto, §35.3).

**Cambios:**
- **API:**
  - **Tablas nuevas:** `learning_resource_areas` (varias áreas; la principal sigue en `academic_area_id`), `image_file_id` y `learning_resource_favorites`.
  - **Biblioteca (`GET /library`):** búsqueda por título, descripción o fuente; filtros por área (cualquiera de las suyas), habilidad, tipo y «favoritos»; paginada.
  - **Cada recurso devuelve:**
    - el tipo con su etiqueta;
    - las áreas y habilidades con nombre;
    - la imagen;
    - si es favorito.
  - **Facetas:** solo áreas y habilidades con recursos vigentes, 30 como máximo (§6.3).
  - **Favoritos:** `PUT/DELETE /library/:id/favorite`, idempotentes y solo para estudiantes.
  - **Catálogo:** alta y edición con `areaIds` e imagen (PNG, JPG o WEBP del que la sube).
  - **Imagen:** la ve cualquiera con sesión y está protegida de la limpieza de huérfanos.
- **Web:**
  - **Estudiante:** nueva pantalla «Biblioteca» (menú Comunidad) con:
    - pestañas «Todos los recursos» y «Mis favoritos»;
    - búsqueda sin Enter y «Limpiar»;
    - filtros de área y habilidad acotados;
    - tarjetas de alto fijo con «Abrir» y «Guardar»;
    - 12 por página.
  - **Dirección:** el formulario de recursos usa el selector de áreas y habilidades y admite imagen.

**Migraciones:** `1780660000000-V32ResourceLibrary`. Copió 519 áreas principales a la tabla nueva. Probada en orden `run → revert → run`. Respaldo previo: `pre-v32-b9.dump`.

**Pruebas:**
- **Suite `e2e-v3-2 batch9`, 10/10.** Cubre:
  - el recurso con 2 áreas, habilidad e imagen;
  - la búsqueda del estudiante, sin fechas ni cupo;
  - el filtro por cualquier área y por habilidad;
  - las facetas acotadas;
  - favorito idempotente y «Mis favoritos»;
  - la afinidad intacta al guardar;
  - quitar el favorito;
  - el docente con 403;
  - el retirado, que sale de la Biblioteca.
- **`e2e-web`:** suma `/student/library` a las pantallas que caben en 375 px.

**Resultados:**
- La primera corrida se interrumpió porque Docker Desktop se detuvo y la base quedó sin servicio.
- Se reinició Docker y se comprobó que los datos estaban intactos (6668 actividades, última migración aplicada).
- Al repetir: **1987 correctas y 0 fallos** (21 suites).

**Regresiones:** ninguna.

**Pendientes:**
- El favorito como señal secundaria del recomendador: BATCH 10.
- La Biblioteca en el móvil: BATCH 20.

**Riesgos:** ninguno conocido.

---

## BATCH 10 — Recomendaciones y «Me interesa»

**ESTADO:** completo

**Objetivo:**
- El favorito de un recurso cuenta como señal secundaria, de peso bajo (§35.2, §49).
- «Me interesa» no alimenta el modelo ni la afinidad (§36).
- Una actividad que ya pasó se puede guardar, pero no inscribirse (§36).

**Hallazgos verificados antes de cambiar (§75):**
- El recomendador ya excluía la afinidad como factor principal y no usaba INTERESTED.
- La afinidad daba 0 a INTERESTED y los recordatorios solo salen para eventos futuros. Todo eso era correcto.
- **Faltaba:**
  - el favorito de recurso como señal;
  - poder guardar algo que ya cerró o terminó, que se rechazaba con el motivo de inscripción.
- El texto que compara intereses libres usaba las etiquetas manuales.

**Cambios:**
- **Recomendador:**
  - Si el estudiante guardó recursos de un área, las recomendaciones de esa área suman «Guardaste recursos de <área> en tu Biblioteca» (`RESOURCE_FAVORITE_AREA`). Usa el mismo 5 % de feedback y no se suma a «Guardaste una recomendación parecida»: nunca pasa de 5.
  - Por sí sola no crea una recomendación: antes se exige otra señal.
  - El texto de comparación incluye `search_keywords` (§20).
- **Actividades:** `register-interest` funciona en actividades cerradas o terminadas; `register` sigue rechazado.
- **Web:** en una actividad que ya pasó, el botón dice «Guardar» y desaparece «Solicitar inscripción».

**Migraciones:** ninguna.

**Pruebas:**
- **Suite `e2e-v3-2 batch10`, 8/8.** Cubre:
  - sin favoritos no hay señal;
  - con favorito, la señal de 5 puntos o menos con su motivo;
  - el puntaje sube 5 o menos;
  - el favorito solo no recomienda;
  - «Me interesa» sin afinidad ni efecto en el recomendador;
  - guardar una actividad pasada sí, inscribirse no.

**Resultados:**
- Regresión completa: **1959 correctas y 1 fallo**. El fallo estuvo en `e2e-batch-1` (401 y un correo que no llegó a tiempo durante una pausa de enfriamiento): fue transitorio y al repetirla sola dio 59/59.
- Total final: **1995 correctas, 0 fallos**.

**Regresiones:** ninguna.

**Pendientes:** ninguno del batch.

**Riesgos:** ninguno conocido.

---

## BATCH 11 — Proyectos: contexto área + habilidad

**ESTADO:** completo

**Objetivo:** que cada tecnología de un proyecto guarde el área en que se usó (§11.4, §40). Es «el dato real del motor».

**Hallazgos verificados antes de cambiar (§75):**
- Los proyectos ya tenían varias áreas y tecnologías validadas contra ellas; la guardia ya acepta las secundarias desde el BATCH 3.
- Faltaba el contexto: Python en un proyecto de IA y Web no decía en cuál se usó.
- La validación por campo de los proyectos ya existía (V3.1 B21).

**Cambios:**
- `project_skills.academic_area_id` y `skillContexts` en el DTO, con la misma regla que en las actividades (`resolveSkillContexts`):
  - el contexto indicado se valida contra las áreas elegidas;
  - el que no se indica se deduce;
  - el contexto previo se conserva al editar otra cosa;
  - si se quita su área, vuelve a la principal.
- Al cambiar el contexto, la tecnología conserva su respaldo (`evidence_status`).
- **Web:** el formulario de proyecto envía `skillContexts` desde el selector de áreas y habilidades.

**Migraciones:** `1780670000000-V32ProjectSkillContext`.
- **Datos:** 1633 de 1769 tecnologías quedaron con contexto; el resto son de proyectos sin área.
- **Verificación:** probada en orden `run → revert → run`. Respaldo previo: `pre-v32-b11.dump`.

**Pruebas:**
- **Suite `e2e-v3-2 batch11`, 5/5.** Cubre:
  - el contexto indicado y el deducido;
  - el contexto en un área ajena, con 400 en su campo;
  - que se conserve al editar;
  - la vuelta a la principal.
- **Ajuste en `e2e-qa`:** QA.45 elegía «las dos primeras áreas sin dígitos». Las áreas de prueba de letras que crea el BATCH 10 se ordenan antes y no tienen preguntas propias. Ahora toma las áreas base por su código.

**Resultados:**
- Regresión completa: **1998 correctas y 2 fallos**. Los fallos fueron QA.45 y QA.45b, el artefacto de datos de prueba descrito arriba. Corregidas, `e2e-qa` dio 74/74.
- Total final: **2000 correctas, 0 fallos**.

**Regresiones:** ninguna funcional.

**Pendientes:** la afinidad usará este contexto en el BATCH 15.

**Riesgos:** ninguno conocido.

---

## BATCH 12 — GitHub, demo y respaldo de proyecto

**ESTADO:** completo (verificación, sin cambios de código)

**Objetivo:** confirmar que lo que pide V3.2 en §41–§44 se cumple con lo existente y que no hay rastreador.

**Verificación contra la especificación** (pruebas de `e2e-v3`, que pasan en cada regresión de este cierre):

| V3.2 | Comportamiento | Pruebas |
|---|---|---|
| §41 Repositorio, metadata, lenguajes, árbol limitado, manifiestos | Raíz y manifiestos controlados; último push y README | V3.11.1, V3.11.8 |
| §41.2 Manifiestos → candidatos | `react`, `@nestjs/core`, `pg`, docker-compose, `fastapi`, `psycopg2-binary` | V3.11.2–V3.11.5, V3.11.9 |
| §41.3 Skill no detectada = DECLARED, sin penalizar | Redis sin rastro queda DECLARADA, no falsa ni restada | V3.11.6, V3.13.2 |
| §41 Caché, cuota y reintentos | ETag e If-None-Match, 304 sin gastar cuota, cuota agotada = «sin comprobar», reintento de fallos pasajeros | V3.11.10–V3.11.15 |
| §42 Demo sin rastreador | Accesible, HTTPS, título y metadata; no se deduce backend ni base de datos | V3.11.16, V3.11.17 |
| §43 Capturas como contexto | La evidencia de funcionamiento es contexto, no certifica el stack | V3.10.13, V3.10.14, V3.13.5 |
| §44 Respaldo DECLARED / SUPPORTED / CORROBORATED / REVIEWED | Repositorio + señal técnica + señal independiente = CORROBORATED; sin independiente, SUPPORTED; sin repositorio, DECLARED | V3.13.4–V3.13.8 |
| §45 Cada integrante confirma lo suyo | Sin votación por mayoría; corrección; no se activa hasta que todos confirman | V3.12.7–V3.12.15 |

**Cambios:** ninguno. Lo nuevo del contexto área+habilidad quedó en el BATCH 11.

**Migraciones:** ninguna.

**Resultados:** cubierto por la regresión del BATCH 11 (2000 correctas, 0 fallos); las pruebas citadas pasan.

**Riesgos:** ninguno.

---

## BATCH 13 — Equipos y notificaciones

**ESTADO:** completo

**Objetivo:** que los eventos de §47 existan con su nombre; verificar equipos (§45–§46) y deduplicación.

**Hallazgos verificados antes de cambiar (§75):**
- **Ya existían:**
  - centro de avisos con deduplicación, leído/no leído y recordatorios (V3.1 B16);
  - `ACTIVITY_STARTING`, `ACTIVITY_REGISTRATION_ACCEPTED`, `PARTICIPATION_CONFIRMED`;
  - `EXTERNAL_EVIDENCE_AVAILABLE`, `PROJECT_CONTRIBUTION_CHANGED`, `TEACHER_FEEDBACK_RECEIVED`;
  - `CONTACT_REQUEST`, `TEAM_APPLICATION`, `TEAM_APPLICATION_ACCEPTED/REJECTED`.
- **Revisión de actividades:** los avisos `ACTIVITY_REVIEW_SUBMITTED` y `ACTIVITY_REVIEW_OBSERVED` se agregaron en el BATCH 6.
- **Nombres que no coincidían con la especificación:**
  - `PROJECT_MEMBER_CONFIRMATION_REQUIRED` en lugar de `PROJECT_CONFIRMATION_REQUIRED`;
  - `ACTIVITY_REVIEW_APPROVED` en lugar de `ACTIVITY_APPROVED`.
- **Equipos y necesidades** (necesidad → semestres → áreas → habilidades → cupos → postulación → equipo): ya estaban (V3.1 B17; pruebas V3.17.x).

**Cambios:**
- Se emiten `PROJECT_CONFIRMATION_REQUIRED` y `ACTIVITY_APPROVED`.
- Una migración renombra el tipo de los avisos ya enviados; su contenido no cambia.
- La web no dependía del tipo (muestra título y cuerpo).

**Migraciones:** `1780680000000-V32NotificationNames` (`UPDATE` reversible). Probada en orden `run → revert → run`. Respaldo previo: `pre-v32-b13.dump`.

**Pruebas:** V3.16.14 y V32.6.18 verifican los nombres nuevos; `e2e-v3 batch16` dio 17/17 y `e2e-v3-2 batch6` 28/28.

**Resultados:** regresión completa compartida con el BATCH 14 (aplicados juntos, cada uno con sus pruebas): **2004 correctas, 0 fallos**.

**Regresiones:** ninguna.

**Riesgos:** ninguno conocido.

---

## BATCH 14 — Credenciales externas

**ESTADO:** completo

**Objetivo:**
- Verificar §30–§34: inscripción externa, validación, OCR → INCONCLUSIVE, revisión manual histórica y respaldo.
- Agregar las áreas de la credencial y el contexto área + habilidad (§33, §50.1).

**Hallazgos verificados antes de cambiar (§75):**
- **Ya existía (V3.1 B8–B9; pruebas V3.8.x–V3.9.x):**
  - el flujo aceptado → terminado → elegible → evidencia;
  - la validación en orden (fuente oficial, URL o ID, QR opcional, PDF nativo, OCR, comparación, IA opcional, resultado determinista);
  - el fallo técnico como INCONCLUSIVE (`ocr.port.ts`);
  - la revisión manual excepcional con quién, cuándo, motivo y decisión;
  - el respaldo DECLARED / SUPPORTED / CORROBORATED / FLAGGED.
- **Faltaba:** la credencial tenía una sola área, y sus tecnologías no estaban ligadas a ella.

**Cambios:**
- **API:**
  - `external_certificate_areas` (varias áreas; la principal sigue en `academic_area_id`).
  - `external_certificate_skills.academic_area_id` (contexto).
  - `areaIds` y `skillContexts` en el DTO.
  - Si llegan `areaIds`, las tecnologías tienen que pertenecer a esas áreas (400 en su campo).
  - Con solo `academicAreaId` (clientes anteriores) sigue funcionando y deduce el contexto.
- **Web:** el formulario de credencial usa el selector de áreas y habilidades (varias áreas, tecnologías por área, contexto) en lugar de un área suelta y una búsqueda sin área.

**Migraciones:** `1780690000000-V32CertificateContext`. Copia la principal a la tabla nueva y rellena el contexto con esta prioridad: principal → secundaria → área de la credencial. Probada en orden `run → revert → run`.

**Pruebas:**
- **Suite `e2e-v3-2 batch14`, 4/4.** Cubre:
  - varias áreas con su principal;
  - el contexto por tecnología;
  - la tecnología de un área ajena, con 400;
  - la compatibilidad con `academicAreaId`.

**Resultados:** **2004 correctas, 0 fallos** (21 suites).

**Regresiones:** ninguna.

**Pendientes:** la afinidad usa estas áreas y contextos en el BATCH 15.

**Riesgos:** ninguno conocido.

---

## BATCH 15 — Afinidad V5: contexto explícito

**ESTADO:** completo

**Objetivo:**
- §11.5, §12.3, §50: que la experiencia sume en el área de su contexto explícito, no en todas las áreas posibles de una habilidad.
- Retirar las inferencias por etiquetas o por texto.

**Hallazgos verificados antes de cambiar (§75):**
- **Ya existía:**
  - el motor V4 con familias, topes y multiplicadores de §47;
  - el desglose explicable;
  - el recálculo determinista.
- **Faltaba:**
  - En proyectos, el área de cada tecnología salía del área principal de la habilidad, no del contexto guardado en el BATCH 11.
  - Un proyecto sin área explícita se ubicaba por etiquetas (`inferAreasByTech`).
  - Una credencial sin área se ubicaba por coincidencia de texto con el nombre del área (`matchAreasByText`).

**Cambios:**
- **Shared:** `AFFINITY_ENGINE_VERSION = 5`.
- **Motor (`affinity.engine.ts`):**
  - **Proyectos:** usan el contexto de `project_skills.academic_area_id`. Si no hay contexto, se toma el área principal de la habilidad. A falta de tecnologías, cuentan solo las áreas explícitas del proyecto.
  - **Credenciales:** usan su área y las de `external_certificate_areas`, con el contexto de cada tecnología.
  - **Constancias:** usan solo el área de la actividad.
  - Se eliminaron `inferAreasByTech` y `matchAreasByText`. Lo que no tiene área explícita no se reparte.
- **Pruebas actualizadas a la regla V3.2:**
  - `rules.test.ts` (versión 5);
  - `e2e-v3` V3.14.1 y `e2e-batch-6` B6.5, B6.41 y B6.43: aceptan la versión 4 o posterior.

**Migraciones:** ninguna. El cambio de versión del motor recalcula con la regla nueva.

**Pruebas:**
- **Suite `e2e-v3-2 batch15`, 5/5.** Cubre:
  - versión 5;
  - una tecnología corroborada suma 18 en el área de su contexto;
  - la misma tecnología suma 0 en su área principal;
  - una credencial sin área no se asigna por texto;
  - ni las etiquetas ni el texto aportan afinidad.
- **Unitarias:** 117/117.

**Resultados:** **2009 correctas, 0 fallos** (21 suites). `e2e-batch-6` se corrió de nuevo, 53/53, tras actualizar sus tres comprobaciones de versión.

**Regresiones:** ninguna. Los tres fallos de la primera corrida eran comprobaciones fijadas en la versión 4.

**Pendientes:** ninguno en este batch.

**Riesgos:** los perfiles con proyectos o credenciales sin área explícita pierden los puntos que antes se inferían. Es el comportamiento que pide §12.3.
