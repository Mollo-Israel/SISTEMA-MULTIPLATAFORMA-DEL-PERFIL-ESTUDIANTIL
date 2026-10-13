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
