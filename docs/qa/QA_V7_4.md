# Informe BATCH V7-4 — Revisión humana obligatoria de credenciales externas (D01)

Formato del contrato V7.1 §17.

## BATCH / rama / commit base / commit resultante

V7-4 · `feature/afinia-v7-cierre-final`. Base: `d7a002b` (V7-3). El commit resultante es el que contiene este informe.

## Requisitos y páginas

- **Contrato:** §5.1 (cambio respecto de V6 y permisos), §5.3 fase 3 (revisión de Dirección) y §5.4 (estados) (pp. 7–11, 13, 28–29).
- **Matriz:** C10–C12, C14, C17, C20–C24 y C28.
- **Hallazgos GAP:** CRED-01…05 y 12. CRED-15 se resuelve con la propuesta conservadora: no se tocan las 271. CRED-16 ya estaba correcto.

## Decisiones Dxx confirmadas

- **D01 (25/11):** Dirección es la única autoridad de revisión. Administración consulta la bandeja y el historial en solo lectura y no decide ni por la web ni por la API.
- **CRED-15 / C23:** las credenciales anteriores a la revisión obligatoria (sin pedido de revisión) **no se revocan ni se reabren**. Conservan su estado y su respaldo, incluidas las 271 corroboradas por la máquina. Si se quisiera revisarlas, hace falta una decisión explícita y un informe de impacto.
- **D06:** los pesos no cambian. Una credencial aprobada revisando solo el documento queda con respaldo parcial (`SUPPORTED`): con los pesos vigentes aporta **respaldo**, no puntos de afinidad. Solo la aprobación con prueba externa (`CORROBORATED`) suma afinidad, como siempre.

## Estado previo y reproducción

`e2e-v7.mjs batch4` contra el código de V7-3 (`d7a002b`), en la API aislada: **8 de 15 correctas**.

| Escenario | Antes (V7-3) |
|---|---|
| C24 | Administración **aprobó** por API (200): la credencial quedó corroborada y auditada como decisión |
| C21 | No existía «observada»: la decisión `observed` no se aceptaba |
| C22 | No existía «aprobada revisando el documento»; solo «inconclusa» |
| Fase 3 | La bandeja listaba solo las pendientes, sin su estado de revisión ni sus fases |
| C14 (regresión de V7-3) | Una fuente oficial que coincide dejaba la credencial **corroborada sin decisión humana** (V41.8.1: `corroborated` con revisión pedida) |

## Ya estaba correcto (sin cambios)

- C17: la API rechaza con 400 los campos que no son del formulario (`backingTier`, `validationStatus`, `manualReviewStatus`).
- C28: con decisión de Dirección no se vuelve a comprobar (V7-3).
- CRED-16: los correos comprobados ayudan a reconocer al titular y no aprueban nada.
- La corrección y el reenvío ya archivaban la decisión anterior (V7-3).

## Cambios exactos y archivos

**Migración aditiva** `1780910000000-V71CredentialReview`: `validation_manual_review_enum` gana `observed` y `approved`. No modifica filas.

**shared**
- `ManualReviewStatus.OBSERVED` y `APPROVED`; `CredentialValidationStatus.OBSERVED` y `APPROVED`.
- Etiquetas sin promesas de autenticidad: «Pendiente de revisión de Dirección», «Aprobada por Dirección con una prueba externa», «Aprobada por Dirección (revisión del documento, respaldo parcial)», «Observada: corrígela y vuelve a enviarla», «Rechazada por Dirección». La corroborada por la máquina antes de V7.1 dice que es «anterior a la revisión obligatoria».
- Regla única `credencialCuenta(revisión)`: pendiente, observada o rechazada no cuenta. Aprobada, o sin revisión (anterior a V7.1), sí.
- Motor de afinidad **v7**: misma fórmula y mismos pesos; cambia la elegibilidad. El arranque no recalcula a nadie (umbral 5, igual que en V7-2).

**API**
- `validation.controller.ts`:
  - decidir solo `CAREER_DIRECTOR` (Administración: 403);
  - la bandeja (`GET /validation/manual-reviews?estado=pendientes|observadas|decididas|todas`) la consultan Dirección y Administración.
- `validation.service.ts`:
  - `decideManualReview`:
    - también rechaza a quien no es Dirección (`CREDENTIAL_REVIEW_DIRECTION_ONLY`), aunque llegue por otra vía;
    - decisiones: aprobar con prueba externa → `CORROBORATED`; aprobar revisando el documento → `SUPPORTED`; observar; rechazar → `FLAGGED`;
    - aviso al estudiante con el motivo.
  - Pendiente u observada, la máquina **no corrobora**: un resultado favorable queda como hallazgo con respaldo a lo sumo parcial. La decisión de Dirección manda sobre cualquier resultado tardío.
  - La bandeja trae **todas** las presentadas, las pendientes primero (y entre ellas la más antigua). Por cada una: origen, oportunidad, áreas, tecnologías, discrepancias, las tres fases, la decisión anterior y los envíos previos.
- `affinity.engine.ts`, `backed-skills.service.ts`, `cv-eligibility.rules.ts`: aplican `credencialCuenta`. Pendiente, observada o rechazada: sin afinidad, sin respaldo, sin tecnologías respaldadas, «inconclusa» en la trayectoria y fuera de la exportación. Aprobada: «revisada» y exportable.
- `credential-phases.rules.ts`: fase 3 «observada» con el motivo, y «aprobada» con su alcance.
- Etiquetas de auditoría para las tres acciones de V7-3 que faltaban.

**Web**
- `director/CredentialReviews.tsx`:
  - pestañas Pendientes, Observadas, Decididas y Todas;
  - cada tarjeta muestra estado, origen, oportunidad, áreas y tecnologías, discrepancias, comprobaciones (ayuda), documento y enlace;
  - cuatro decisiones: aprobar con prueba externa, aprobar revisando el documento, observar y rechazar;
  - con el rol de Administración, la página queda en **solo lectura**.
- `student/Evidences.tsx`: estados «Observada» y «Aprobada».

## Migraciones / datos preservados / compatibilidad web-móvil

- Una migración aditiva. **Desarrollo necesita `npm --prefix api run migration:run`**, que aplica también la de V7-3.
- **Impacto en datos existentes** (consulta de solo lectura sobre la base de desarrollo del 26/11):

| Revisión | Respaldo | Credenciales | Efecto de V7-4 |
|---|---|---|---|
| sin revisión | corroborated | 271 | Ninguno: siguen contando (C23) |
| sin revisión | declared / supported / flagged | 2.679 / 489 / 1.350 | Ninguno |
| corroborated (Dirección) | corroborated | 111 | Ninguno |
| inconclusive | declared | 37 | Ninguno |
| rejected | flagged | 37 | Ninguno (ya no sumaban) |
| requested / observed | — | **0** | No hay ninguna: la regla nueva no cambia la afinidad de nadie hoy |

  No hace falta recálculo masivo por V7-4. La afinidad guardada pasa a la versión 7 cuando cambia la trayectoria de cada estudiante.
- **Móvil:** no tiene la bandeja de Dirección. La vista de credenciales del estudiante la arma la API.

## Pruebas ejecutadas (comando, resultado, evidencia)

| Comando | Resultado |
|---|---|
| `e2e-v7.mjs batch4` contra V7-3 (reproducción) | 8 / 15 |
| `e2e-v7.mjs batch4` | **15 / 15** |
| `e2e-v7-web.mjs batch4` | **7 / 7** |
| `api/test/unit/v7-revision.test.ts` | **12 / 12** |
| Regresión completa | ver «Regresiones verificadas» |

## PASS / FAIL / BLOCKED / NE

| Escenario | Resultado | Evidencia |
|---|---|---|
| C10 QR o enlace a la página general del curso | **PASS** (revisión pendiente, sin corroborar) | V41.8.2 · V7.4.1 |
| C11 / C14 Fuente individual que coincide | **PASS** (hallazgo favorable; revisión pendiente; sin CORROBORATED ni AUTO_VERIFIED) | V7.4.1 · unit |
| C12 Fuente de otra persona | **PASS** (discrepancia visible; decide Dirección) | V7.4.13 · V3.9.3 |
| C17 Forzar AUTO_VERIFIED en el cuerpo | **PASS** (400, sin cambios) | V7.4.5 |
| C20 Dirección aprueba con fuente suficiente | **PASS** (método, prueba, fases conservadas; cuenta) | V7.4.6 · V7.4.7 |
| C21 Observar o rechazar | **PASS** (motivo visible, aviso, reenvío con historial; no suma) | V7.4.9–11 · W7.4.3–6 |
| C22 Aprobación sin prueba concluyente | **PASS** (respaldo parcial, etiqueta con alcance) | V7.4.12 · unit |
| C23 Credencial antigua aprobada | **PASS** (no se revoca) | V7.4.15 · impacto 0 |
| C24 Admin decide por API | **PASS** (403, sin mutación ni auditoría de decisión) | V7.4.3 · W7.4.1 · V41.8.11 |
| C28 Modelo o resultado tardío tras la decisión | **PASS** | V7.4.8 · V7-3 C19 |
| Afinidad con pendiente o rechazada | **PASS** (sin puntos ni respaldo) | V7.4.2 · V7.4.9 · V7.4.11 |

## Regresiones verificadas

**Corrida limpia** (base reconstruida). Las fallas nuevas fueron **cambios de contrato** y las pruebas se adaptaron:

| Suite | Falla | Clasificación y adaptación |
|---|---|---|
| `e2e-v4-1` V41.8.11 | Administración rechazaba como «excepción auditada» | **Contrato** (D01): Administración recibe 403 y decide Dirección. La auditoría guarda el rol `CAREER_DIRECTOR` |
| `e2e-v3` V3.9.1, 9.11, 9.13 | La fuente oficial, el QR o la insignia dejaban la credencial **corroborada por la máquina** | **Contrato** (§5.1): el hallazgo favorable queda; la credencial sigue pendiente de Dirección, sin corroborar |
| `e2e-web` WEB.47.1–2 | Administración tenía «Revisar» | **Contrato** (D01): solo lectura. La regla de prueba externa (B32) sigue cubierta en `e2e-v4-1` batch8 |
| `e2e-v7` V7.2.13 | Fijaba el motor en la versión 6 | **Contrato**: el motor es v7 (D01 cambia la elegibilidad); la prueba acepta la 6 o posterior |

Resultados:
- `e2e-v7` **80 / 0** · `e2e-v6` **98 / 0** · `e2e-v5` **135 / 0** · `e2e-v2` **162 / 0** · `e2e-qa` **68 / 0**.
- Objetivos 40, 5, 6 y 7, y `batch-1…11`: sin fallas, salvo `batch-6`.
- Jest **214 / 214** · unitarias **220 / 220**.
- Web: `e2e-web` **106 / 0** · `e2e-v6-web` **63 / 0** · `e2e-v7-web` **29 / 0** · `e2e-web-gestion` **47 / 0**.
- `tsc` sin errores en API, web y móvil.

Fallas que quedan, todas previas o de datos (las mismas de V7-2 y V7-3):
- `e2e-v4-1` V41.10.1–2 (FastAPI no está en la semilla);
- `e2e-v3` V3.2.15 (lotes de importación);
- `e2e-v3-2` (10, datos de desarrollo);
- `batch-6` B6.47.

Si se repite `e2e-v3` sobre la misma base, aparecen V3.9.12 y V3.9.17: son las marcas de V9 por archivos de contenido fijo, ya explicadas en V7-3.

## Riesgos o limitaciones

- **Respaldo parcial sin puntos de afinidad.** Con los pesos vigentes, «aprobada revisando el documento» respalda pero no suma afinidad. Cambiarlo es una recalibración de pesos (D06) y necesita autorización.
- **La aprobación con prueba externa conserva el control de V4.1:** la prueba debe ser independiente del propio archivo y de su enlace.

## Pendientes y siguiente batch propuesto

- **Decisión del usuario:** migrar la base de desarrollo. Sigue pendiente la autorización del recálculo D04 (de V7-2).
- **Siguiente batch: V7-5**, documentos institucionales: certificado general o individual, entrega automática y abrir el certificado recibido (D04 y D05).
