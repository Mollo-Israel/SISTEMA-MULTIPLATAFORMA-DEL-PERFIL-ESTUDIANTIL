# Informe BATCH V7-2 — Aprobar = publicar y abrir; lectura de Admin; asistencia; D04

Formato del contrato V7.1 §17.

## BATCH / rama / commit base / commit resultante

V7-2 · `feature/afinia-v7-cierre-final`. Base: `a794060` (V7-1). El commit resultante es el que contiene este informe.

## Requisitos y páginas

- **Contrato:** §4.2 (pp. 6), §6.1 y §6.2 (pp. 3, 15), D02 y D04.
- **Matriz:** A01–A06, A10–A16, I01, I10, I11.
- **Hallazgos:** PUB-01…09, ASI-02, PERF-01, PERF-04 (regla D04; la explicación es de V7-8).

## Decisiones Dxx confirmadas

- **D02 (25/11):** aprobar publica y abre si el inicio es futuro y hay cupo; cierra al inicio o por cupo y finaliza al fin.
- **D04 (25/11):** «Sin resultado» es asistencia operativa, sin trayectoria, afinidad ni documento.
- **Constancia interna histórica:** el usuario delegó elegir la opción conservadora del contrato. Se lee como «Solo participación», que es lo que ya decía la interfaz.

## Estado previo y reproducción

La API anterior (`a794060`) se compiló **aparte** (`api/.repro-v72`, ya borrada) y se levantó en el entorno aislado. Contra ella se corrió la suite nueva `e2e-v7.mjs batch2`.

**Resultado: 5 de 15 correctas, 10 fallidas.** Los defectos quedaron reproducidos:

| Escenario | Antes (versión anterior) |
|---|---|
| A03 / A13 | Aprobar dejaba la actividad en `draft` («Ya puedes publicarla») |
| A16 | Se aprobaban propuestas ya empezadas o vencidas (200 y en `draft`) |
| A01 | Administración no veía las propuestas en su gestión |
| A02 | Administración **canceló** la propuesta ajena y editó su título (200) |
| A10 | Con FINISHED y la lista abierta, corregir era 409 `PARTICIPATION_CONSOLIDATED` |
| I01 | La actividad «Sin resultado» sumaba **7 puntos** de afinidad |
| I10 | Sus tecnologías salían como respaldadas y la actividad era exportable |

Las 5 correctas eran comportamiento que debía conservarse y se conservó:
- A04: observar o rechazar no publica;
- el borrador privado no existe para Administración;
- A14 / A15: lo propio se publica abierto y la inscripción se cierra al inicio;
- A06: el trabajador cierra y finaliza solo;
- A11: con la lista cerrada, se bloquea la corrección ordinaria.

## Ya estaba correcto (sin cambios)

- **Trabajador de ciclo de vida** (`activity-lifecycle.worker.ts`): cierra al inicio y finaliza al fin, sin navegador.
- **«Publicar» de Dirección y Administración** en la web ya enviaba `open`.
- **Constancias y certificados:** no crean un segundo evento de afinidad; su `base` ya era 0 (I11).
- **Cierre de la lista:** bloquea al responsable (`ATTENDANCE_LOCKED`) y la corrección excepcional de Dirección sigue separada.

## Cambios exactos y archivos

**API**

`activities.service.ts`:
- **`review()`**
  - Aprobar comprueba primero lo que exige publicar: datos completos, inicio futuro y responsables que cubren la audiencia.
  - Después, en **una transacción** con la fila bloqueada (`FOR UPDATE`), deja `approved` y pasa de `draft` a `open`. Registra la decisión y el cambio de estado (`automatico: 'aprobacion'`) en la auditoría.
  - Si la actividad ya empezó o terminó responde 409 (`ACTIVITY_APPROVAL_STARTED` / `ACTIVITY_APPROVAL_EXPIRED`), la propuesta sigue pendiente y el motivo lo dice.
  - El aviso al docente dice «ya está publicada y con las inscripciones abiertas». Su clave de deduplicación es el id de la revisión, así que una sola decisión produce un solo aviso.
- **Administración en solo lectura sobre propuestas ajenas** (pendientes, observadas o rechazadas):
  - `canManage` y `assertCanManage` responden 403 `ACTIVITY_PROPOSAL_READ_ONLY` (editar, publicar, cancelar, asistencia, referencia);
  - `findManagedBy` le muestra esas propuestas con `soloLectura: true`;
  - un borrador no enviado sigue sin existir para ella.
- **`participacionConsolidada`:** pasa a ser «lista cerrada o documento entregado», en lugar de «actividad terminada».
- **Inscripción:** se rechaza desde el instante de inicio (`<=`), con el mensaje «La actividad ya empezó: no admite inscripciones nuevas».

D04, con la regla única `cuentaComoTrayectoria(outcomePolicy)` en `shared/src/enums/activity.enum.ts`:
- **`affinity.engine.ts`** (motor v6): la confirmada «Sin resultado» queda como señal de 0, con su motivo en el desglose, y no ocupa lugar en los rendimientos decrecientes. Además, `simulate()` calcula sin guardar, y lo usa el informe de impacto.
- **`backed-skills.service.ts`** y `respaldadasEnActividades`: no respaldan tecnologías desde «Sin resultado».
- **`cv-eligibility.rules.ts`** y **`trajectory-summary.service.ts`**: ni trayectoria ni ítem exportable desde «Sin resultado».
- **`shared/src/enums/affinity-engine.ts`:** `AFFINITY_ENGINE_VERSION = 6`, y `AFFINITY_BOOT_BACKFILL_BELOW_VERSION = 5` (al arrancar solo se migra estructura).
- **`affinity-backfill.service.ts`:** el arranque ya no recalcula a todos por un cambio de reglas; el endpoint de Administración sí, cuando se autorice.

**Web**

- **`ActivityManager.tsx`:**
  - las filas `soloLectura` llevan la marca «Solo lectura · la decide Dirección» y solo «Ver detalles»; no tienen selector de estado, reenvío, duplicar ni participación;
  - «consolidada» pasa a significar **lista cerrada**;
  - «Ver detalles» descarta la respuesta del detalle si el diálogo ya se cerró (ver «Regresión web»).
- **`director/Approvals.tsx`:** el aviso al aprobar dice «Actividad aprobada y publicada».
- **`services/types.ts`:** campo `soloLectura`.

**Pruebas y herramientas**

- `scripts/e2e-v7.mjs batch2` (15), `scripts/e2e-v7-web.mjs batch2` (6), `api/test/unit/v7-d04.test.ts` (10).
- `scripts/e2e-web.mjs` WEB.44.1 adaptada a §6.1: con la lista abierta el docente todavía marca ausente; al cerrar el acta, ya no.
- `rules.test.ts` ahora fija la versión 6.
- `scripts/v7/impacto-d04.cjs`: informe de impacto de solo lectura.
- `scripts/lib/fixtures.mjs`: una actividad interna sin resultado declarado se completa como «Solo participación», solo en las suites anteriores que no lo indican. Nunca se pisa lo que la prueba envía.

## Migraciones / datos preservados / compatibilidad web-móvil

- **Sin migraciones.** No se borra ninguna asistencia, participación ni instantánea.
- **Datos históricos:**
  - las **76 aprobadas en borrador** están todas vencidas, así que no se abre ninguna;
  - las participaciones «Sin resultado» siguen guardadas;
  - la afinidad guardada **no se recalculó en masa**, porque eso espera autorización (ver abajo).
- **Móvil:** no usa estos flujos de gestión. La asistencia y la trayectoria le llegan ya filtradas por la API.

## Informe de impacto D04 (antes del recálculo autorizado)

Detalle en [`IMPACTO_D04_AFINIDAD.md`](IMPACTO_D04_AFINIDAD.md). Base de desarrollo, en gran parte sintética, medida sin escribir nada:
- 2.116 estudiantes afectados, de los que 1.951 cambian;
- bajada media de 11,6 puntos por área (máximo 25);
- baja → sin afinidad: 1.637 áreas · media → baja: 147 · media → sin afinidad: 41;
- ningún «Alta» cambia;
- salen 1.447 pares de tecnologías respaldadas y 3.207 ítems exportables.

**El recálculo masivo no se ejecutó: es una decisión reservada al usuario.**

## Pruebas ejecutadas (comando, resultado, evidencia)

| Comando | Resultado |
|---|---|
| `e2e-v7.mjs batch2` contra la versión anterior | 5 / 15 (reproducción) |
| `e2e-v7.mjs batch1 batch2` contra el código nuevo | **42 / 42** |
| `e2e-v7-web.mjs batch2` (web `:5180`, API `:3020`) | **6 / 6** |
| `npm --prefix api run test:unit` | **186 / 186** |
| Regresión de suites de API anteriores | ver «Regresiones verificadas» |
| Suites web completas (web solo con V7-2, API `:3020`) | `e2e-web` **106 / 0** · `e2e-v6-web` **63 / 0** · `e2e-v7-web` **15 / 0** · `e2e-web-gestion` **47 / 0** |

## PASS / FAIL / BLOCKED / NE

| Escenario | Resultado | Evidencia |
|---|---|---|
| A01 Admin consulta la propuesta, no el borrador privado | **PASS** | V7.2.6 · V7.2.7 · W7.2.3 |
| A02 Admin intenta aprobar, cancelar o editar | **PASS** (403, sin cambios) | V7.2.8 |
| A03 / A13 Aprobar = publicar y abrir, atómico | **PASS** | V7.2.1 · W7.2.1 |
| A04 Observar o rechazar no publica | **PASS** | V7.2.3 |
| A05 Aprobación repetida | **PASS** (409, un solo aviso) | V7.2.2 |
| A06 / A15 Cierre al inicio y fin sin navegador; inscripción tardía | **PASS** | V7.2.9 · V7.2.10 |
| A10 FINISHED con la lista abierta | **PASS** | V7.2.11 · W7.2.5 |
| A11 Lista cerrada | **PASS** | V7.2.12 |
| A14 Propia de Dirección: borrador hasta publicar y abre | **PASS** | V7.2.9 (API) |
| A16 Propuesta empezada o vencida | **PASS** (409, sigue pendiente) | V7.2.4 · V7.2.5 |
| I01 / I10 / I11 D04 | **PASS** | V7.2.13–15 |
| A07–A09 (responsable × semestre, duplicación) | ver regresión `e2e-v6` | — |

## Regresiones verificadas

**Primera corrida** (base aislada con datos acumulados de muchas corridas): 22 suites de API.
- Pasaron sin fallas: `e2e-v6` 98/0 · `e2e-v5` 135/0 · `e2e-v2` 162/0 · `e2e-qa` 68/0 · objetivos 5, 6 y 7 · `batch-1…11` (salvo `batch-6`).
- Fallas, clasificadas así:

| Suite | Falla | Clasificación |
|---|---|---|
| `e2e-v4-1` | V41.4.5 / 4.8 | **Cambio de contrato** (V7.1 §6.1: con la lista abierta se corrige). Prueba adaptada; pasa con el código nuevo |
| `e2e-v4-1` | V41.10.1 / 10.2 (FastAPI) | **Entorno:** dependían de que el catálogo tuviera FastAPI; la misma suite lo crea, y en la corrida siguiente pasan |
| `e2e-v4-1` | V41.8.1 | **Entorno:** marca de V9 por enlaces repetidos entre corridas; falla igual con la versión anterior |
| `e2e-v3-2` | V32.15.1 | **Cambio de contrato** (motor v6). Prueba adaptada |
| `e2e-v3-2` | 9 de áreas secundarias de Linux y Python | **Previas o de entorno:** fallan igual con la versión anterior sobre la misma base |
| `e2e-v3` | 3 y después 13 de credenciales (FLAGGED) | **Entorno acumulativo:** marcas de V9 por archivos y enlaces repetidos. Con la base en el mismo estado, la versión anterior y la nueva fallan en **las mismas 13** |
| `e2e-objectives-40` | Aprobaba un «reto pasado» | **Cambio de contrato** (D02 no abre una actividad empezada). El ayudante de la prueba ahora aprueba con fecha futura y Administración mueve la fecha |
| `e2e-batch-6` | B6.47 (historial con instantáneas v2 y v3) | **Previa:** falla igual con la versión anterior; la ventana de 30 instantáneas ya no alcanza las viejas |

**Comparación con la versión anterior** (`a794060`, levantada aparte sobre la misma base): ninguna falla aparece solo con el código nuevo. **V7-2 no introduce regresiones.**

**Jest:** 213/214. La única falla es D04 actuando sobre la **semilla de ejemplo**: el «Taller de Desarrollo Web» de Ana estaba en «Sin resultado» por omisión, porque la semilla es anterior a las políticas de resultado. Se corrigió la semilla (`populate.seed.ts`):
- talleres, seminario, reto, clase espejo y actividades de la sociedad pasan a «Solo participación»;
- la charla y la tutoría quedan «Sin resultado», para que la demostración muestre los dos casos.

Después se reconstruyó **solo la base aislada de pruebas** (`entorno.mjs reconstruir`). La base de desarrollo no se tocó: ajustar allí los datos de ejemplo sería un cambio de datos que debe autorizar el usuario.

**Corrida limpia** (base aislada recién reconstruida, código nuevo):
- Jest **214 / 214**.
- `e2e-v7` **42 / 0** · `e2e-v6` **98 / 0** · `e2e-v5` **135 / 0** · `e2e-v2` **162 / 0** · `e2e-qa` **68 / 0**.
- Objetivos 40, 5, 6 y 7, y `batch-1…11`: sin fallas, salvo `batch-6`.
- Fallas que quedan, todas previas o de datos (no aparecen por V7-2):
  - `e2e-v4-1` V41.10.1–2: FastAPI no está en la semilla.
  - `e2e-v3-2` (10): dependen de datos de desarrollo, como 200 estudiantes y áreas secundarias de Linux y Python configuradas a mano.
  - `e2e-v3` (3): lotes de importación y dos credenciales que V9 marca (corroboración automática, que V7-4 reemplaza por revisión humana).
  - `batch-6` B6.47: la semilla ya no trae instantáneas v2/v3.

**Regresión web.** La web se compiló solo con los cambios de V7-2 (sin el trabajo de V7-3, que va en su propio commit) y se sirvió en `:5180` contra la API aislada. Dos fallas en la primera corrida:

| Suite | Falla | Causa y corrección |
|---|---|---|
| `e2e-v6-web` | V6W.3.4 «Se cierra con Escape» | **Defecto real de la web.** «Ver detalles» abre el diálogo con lo que trae la lista y pide el detalle completo. La respuesta llegaba después de Escape y volvía a abrir el diálogo. Sonda: pedido a los 0 ms, Escape a los 16 ms, respuesta a los 37 ms, diálogo abierto 3 s después. La versión anterior pasaba la misma prueba; el defecto depende del orden de llegada, así que cualquier cambio de tiempos lo destapa. **Corrección:** la respuesta solo se aplica si ese diálogo sigue abierto (`ActivityManager.tsx`, `verDetalles` / `cerrarDetalle`) |
| `e2e-web` | WEB.44.1 | **Cambio de contrato** (§6.1): con FINISHED y la lista abierta, «Marcar ausente» ahora está disponible; desaparece al cerrar el acta. Prueba adaptada para comprobar las dos cosas |

Segunda corrida, con la corrección: **sin fallas** en las cuatro suites web (tabla de pruebas).

## Riesgos o limitaciones

- **La afinidad guardada sigue en v5** hasta que se autorice el recálculo. Mientras tanto, un estudiante pasa a v6 cuando su trayectoria cambia, y la «Evolución» de la analítica muestra solo lo recalculado.
- **Un `PUBLISHED` enviado directo por la API** (no por la web) se conserva como estado intermedio. En este sistema ya admite inscripciones (`REGISTRABLE_ACTIVITY_STATUSES`), así que no hay una ventana de «aprobada sin poder inscribirse».
- **Ventana de asistencia.** Con la lista abierta pero pasada la ventana de 7 días, el botón «Marcar ausente» sigue visible y la API responde con el motivo (`ATTENDANCE_WINDOW_CLOSED`).

## Pendientes y siguiente batch propuesto

- **Decisión del usuario:** autorizar o no el recálculo controlado de D04 (`POST /api/affinity/recalculate-all`).
- **Siguiente batch: V7-3**, formulario de credenciales, origen, datos bloqueados y procesamiento técnico.
