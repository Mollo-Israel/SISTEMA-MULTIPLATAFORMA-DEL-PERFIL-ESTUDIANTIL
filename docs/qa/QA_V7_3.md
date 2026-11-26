# Informe BATCH V7-3 — Credenciales: formulario, origen y procesamiento técnico

Formato del contrato V7.1 §17.

## BATCH / rama / commit base / commit resultante

V7-3 · `feature/afinia-v7-cierre-final`. Base: `058d580` (V7-2). El commit resultante es el que contiene este informe.

## Requisitos y páginas

- **Contrato:** §5.2 (tipos y formulario), §5.3 (fases 1 y 2), §5.4 (estados y vista), §5.5 (modelo recibido después de la aprobación), D03 y D08 (pp. 7–11, 13).
- **Matriz:** C01–C09, C13–C19, C25–C27.
- **Hallazgos GAP:** CRED-06, 08, 09, 10, 13 y 14. CRED-07 ya estaba correcto y se conserva.

## Decisiones Dxx confirmadas

- **D03 (25/11):** el certificado modelo es opcional. Después de la aprobación lo adjunta **solo Dirección**, con una versión que guarda hash, autor, fecha y motivo. El docente no lo cambia.
- **D08 (límite conservador):** no cambia la evidencia mínima de la histórica. Basta un archivo o un enlace individual; sin ninguno de los dos queda declarada y no llega a Dirección. La vinculada exige archivo.
- **CRED-10 (§5.2):** el contrato dice «sin prohibir certificados legítimos distintos solo por título común». Por eso el bloqueo por nombre repetido pasa a ser **contextual**: es la misma credencial si coinciden nombre, emisor y fecha (sin distinguir tildes ni mayúsculas), o si es el mismo archivo (SHA-256) del mismo estudiante. Es más estrecho que antes; no endurece nada.

## Estado previo y reproducción

La API de V7-2 (`058d580`) se compiló aparte (`api/.repro-v73`, ya borrada) y se levantó contra `afinia_test`.

| Escenario | Antes (V7-2) |
|---|---|
| C03 | La oportunidad elegible no traía nombre esperado, emisor, áreas, tecnologías ni si había modelo |
| C04 | El servidor guardaba el nombre, el emisor, las áreas y las tecnologías **que mandaba el cuerpo** («Nombre inventado», área ajena) |
| C06 | Una vinculada se creaba sin archivo (en la corrida, el 400 vino de que el nombre seguía siendo obligatorio, no de la falta del archivo) |
| C18 | Reintentar sin nombre era 400 de validación, no un 409 de duplicado |
| C01 | La histórica pasó por la lectura del PDF (`completed`, fuente `pdf_text`) y **no** quedó pedida a Dirección |
| C27 | El docente responsable cambió el modelo de una oportunidad **publicada** (200), sin versión |
| C19 / C28 | Por código: el worker guardaba la entidad completa leída al reclamar. Un resultado tardío podía devolver la revisión a su estado anterior y aplicarse a un archivo reemplazado |
| §5.3 fase 1 | Por código: `sample_stored_file_id` no se usaba en ninguna comparación |

Desde V7.3.5, la suite usa columnas que el esquema viejo no tiene. C01 y C27 se reprodujeron con una sonda aparte (`sonda-v73-c01-c27.mjs`).

## Ya estaba correcto (sin cambios)

- **CRED-07:** la elegibilidad la decide el servidor; otra cuenta o un estudiante no aceptado no adjunta (C05, V7.3.23).
- **SSRF:** el verificador de enlaces ya bloqueaba direcciones internas (C16, V7.3.9).
- **Fase 2** (QR, enlace, Credly, Open Badges): se reutiliza el trabajador de V9 sin cambios de lógica.

## Cambios exactos y archivos

**Migración aditiva** `1780900000000-V71CredentialProcessing`:
- `validation_status_enum` gana `not_applicable`;
- `validation_records` gana `file_sha256`, `skipped_reason`, `reference_version_id` y `previous_results` (historial de intentos);
- tabla nueva `validation_reference_versions` (D03).
- No modifica ni borra datos. Se probó en `afinia_test`; **la base de desarrollo no se migró**.

**API**
- `validation/credential-route.rules.ts` (reglas puras): ruta de la credencial, evidencia mínima D08, vigencia de un resultado (C19/C28) y foto e historial de intentos.
- `validation/document-comparison.rules.ts` — **fase 1**: compara las líneas **estables** del modelo con el texto del archivo. Excluye el titular del modelo, las fechas y los códigos. Devuelve coincidencias, variaciones y faltantes, sin porcentaje. El titular del archivo se compara con el estudiante.
- `validation/credential-phases.rules.ts` — las tres fases que ve el estudiante: «no aplica», «omitida», «pendiente», resultado, «inconclusa», «error técnico», «sin solicitud» o «decidida». Sin checks ficticios ni códigos internos.
- `validation/reference-model.ts`: modelo vigente y versiones. Un modelo cargado antes del versionado recibe la versión «previo» la primera vez que se usa.
- `validation.service.ts`:
  - `encaminarCredencial`: histórica o sin modelo → `not_applicable`, sin leer el archivo. Con modelo → en cola, con el hash del archivo y la versión del modelo. Con la evidencia mínima, queda **pedida a Dirección** en los tres casos. Lo anterior se archiva.
  - `recomprobarCredencial`: «Comprobar información» y la recomprobación de Dirección. Solo para vinculadas con modelo y sin decisión; el intento anterior se conserva.
  - El worker no procesa una histórica ni una sin modelo, aunque esté en la cola.
  - `aplicarSiVigente`: el resultado se escribe con la fila bloqueada y solo si el trabajo sigue siendo suyo (mismo worker y mismo archivo). Nunca escribe la revisión humana. Un resultado descartado queda auditado (`VALIDATION_RESULT_DISCARDED`).
  - `enqueue(force)` sobre una credencial ya no borra la decisión de Dirección (lo usaba el cambio de correos de V9).
  - `reprocess-outdated` excluye las históricas y las vinculadas sin modelo.
- `certificates.service.ts`:
  - **vinculada:** nombre, emisor, áreas y tecnologías salen de la oportunidad; el cuerpo se ignora; el archivo es obligatorio (`CREDENTIAL_FILE_REQUIRED`). Al editarla tampoco se tocan esos datos y el archivo no se puede quitar;
  - duplicados contextuales (CRED-10);
  - `POST /certificates/external/:id/check`.
- `credential-eligibility.service.ts`: `expectedName`, `expectedIssuer`, `areas`, `skills` y `hasModel`.
- `activities.service.ts`:
  - `PUT /activities/:id/validation-reference/model`: solo Dirección, con motivo (≥ 10 caracteres). Registra una versión con hash, autor y motivo; no cambia datos materiales y no reprocesa nada;
  - la referencia queda **bloqueada** para el responsable ordinario después de aprobada o publicada (`VALIDATION_REFERENCE_LOCKED`);
  - quien la creó y publicó sin revisión sigue siendo su autoridad;
  - Dirección registra el primer modelo por la vía general; para reemplazarlo usa la acción (`VALIDATION_MODEL_USE_ACTION`).
- `validation.controller.ts`: `phases`, `canRecheck` y `skippedReason` en la vista; `errorCode` oculto al estudiante; `POST /validation/manual-reviews/:id/recheck` (Dirección).
- DTO: en la vinculada, nombre y emisor no son obligatorios (los pone el servidor).

**Web**
- `student/Evidences.tsx`:
  - formulario de la vinculada con los datos de la oportunidad en solo lectura y el archivo obligatorio;
  - enlace y código plegados en «Si tu certificado incluye enlace o código de verificación»;
  - en cada credencial, la **revisión de Dirección arriba** y el detalle desplegable de las tres fases, con fecha, resultado y limitaciones;
  - «Comprobar información»;
  - se actualiza sola mientras hay una comprobación en curso.
- `components/ModeloDeReferencia.tsx` (nuevo): «Certificado modelo» de Dirección, con el vigente, las versiones y el motivo obligatorio.
- `ActivityManager.tsx`: la acción «Modelo» solo para Dirección; los campos de la referencia en solo lectura cuando está bloqueada.

**Móvil**
- `EvidencesScreen.tsx`: misma regla que la web. Datos de la oportunidad en solo lectura, archivo obligatorio en la vinculada, enlace y código opcionales, y qué pasa después de enviar.

## Migraciones / datos preservados / compatibilidad web-móvil

- Una sola migración, aditiva y probada en `afinia_test`. **Para usarla en desarrollo hay que ejecutar `npm --prefix api run migration:run`.** Hasta entonces, la API de desarrollo falla en las consultas de credenciales, porque la entidad ya tiene las columnas nuevas.
- Credenciales existentes: **no se reprocesan ni se encaminan de nuevo**. Conservan su estado y su respaldo; las reglas nuevas rigen para lo que se envía o se corrige desde ahora.
- Móvil: usa los mismos endpoints. El servidor deriva los datos aunque una versión vieja de la app los envíe.

## Pruebas ejecutadas (comando, resultado, evidencia)

| Comando | Resultado |
|---|---|
| `e2e-v7.mjs batch3` contra V7-2 (reproducción) | 0 / 5, y se interrumpe por el esquema viejo |
| `sonda-v73-c01-c27.mjs` contra V7-2 | C01 y C27 reproducidos |
| `e2e-v7.mjs batch3` | **23 / 23** |
| `e2e-v7.mjs` (batch1, 2 y 3) | **65 / 0** |
| `e2e-v7-web.mjs batch3` (web `:5180`, API `:3020`) | **7 / 0** |
| `api/test/unit/v7-credenciales.test.ts` | **22 / 22** |
| Regresión completa (API, Jest, unitarias, web) | ver «Regresiones verificadas» |

## PASS / FAIL / BLOCKED / NE

| Escenario | Resultado | Evidencia |
|---|---|---|
| C01 Histórica con archivo sin QR | **PASS** (no aplica, sin lectura, pedida a Dirección) | V7.3.11 · W7.3.3 · unit |
| C02 Histórica solo con enlace (D08) | **PASS** (pide revisión; sin evidencia, sin solicitud) | V7.3.12 |
| C03 Datos de la oportunidad recuperados y bloqueados | **PASS** | V7.3.1 · W7.3.1 |
| C04 IDs cambiados en el cuerpo | **PASS** (se derivan de la oportunidad) | V7.3.3 |
| C05 Oportunidad no elegible u otra cuenta | **PASS** | V7.3.23 |
| C06 Vinculada sin archivo | **PASS** (API e inline; tampoco se puede quitar) | V7.3.2 · V7.3.16 · W7.3.2 |
| C07 / C25 Sin QR y sin modelo | **PASS** (omitidas, directo a Dirección) | V7.3.10 |
| C08 Modelo con otro titular | **PASS** | V7.3.6 · unit |
| C09 Otra versión del certificado | **PASS** (faltantes y variaciones, sin bloqueo) | V7.3.8 · unit |
| C13 Timeout, CAPTCHA o límite | **PASS** (unit: «inconclusa», revisión pendiente). La red real no se simula en e2e | unit |
| C14 Fases favorables | **PASS** (la revisión sigue pendiente) | V7.3.7 · unit |
| C15 Fases negativas o inconclusas | **PASS** (se envía igual) | V7.3.8 · V7.3.9 |
| C16 Host privado | **PASS** (bloqueado, se envía igual) | V7.3.9 |
| C17 Forzar AUTO_VERIFIED en el cuerpo | NE: es de V7-4 (revisión humana obligatoria) | — |
| C18 Reintento | **PASS** (409; mismo archivo o mismo nombre+emisor+fecha también) | V7.3.4 · V7.3.13 |
| C19 Reemplazo con el worker en curso | **PASS** (resultado viejo descartado, intento archivado) | V7.3.14 · V7.3.15 · unit |
| C26 Dirección agrega el modelo tras finalizar | **PASS** | V7.3.18–21 · W7.3.5 |
| C27 El docente intenta cambiar el modelo | **PASS** (403 por las dos vías, también Administración) | V7.3.22 · W7.3.7 |
| C28 Modelo tras una revisión aprobada | Parcial en V7-3: la decisión no se toca y solo una pendiente se recomprueba. Se cierra en V7-4 | V7.3.21 · unit |

## Regresiones verificadas

**Primera corrida** sobre una base reconstruida. Las fallas nuevas fueron todas **cambios de contrato de V7-3** y se adaptaron las pruebas:

| Suite | Falla | Clasificación y adaptación |
|---|---|---|
| `e2e-v3` V3.8.27–31, `e2e-v4-1` batch8 | Vinculada sin archivo | **Contrato** (CRED-08): la prueba adjunta el archivo |
| `e2e-batch-3` B3.19–50, `e2e-v3` batch9, `e2e-v4-1` batch8, Jest `validacion-reforzada` | Esperaban que el worker leyera y consultara **históricas** | **Contrato** (CRED-09): esos casos van como vinculadas a una oportunidad con modelo (ayudante `credencialVinculada` en `scripts/lib/fixtures.mjs`), y las históricas reales esperan «no aplica» y la revisión pedida |
| `e2e-v3` V3.9.18–30 | La histórica se pedía a mano | **Contrato** (§5.2): llega pedida al enviarla; corregirla archiva la decisión anterior y la reenvía |
| `e2e-v4-1` V41.8.1, 8.3, 8.5 · `e2e-v3` V3.9.3 | Estado «verificada», «rechazada» o «inconclusa» decidido por la máquina | **Contrato** (§5.1): mientras Dirección no decide, el estado es «Necesita revisión». El resultado técnico, las contradicciones y el respaldo señalado se conservan |
| Jest V9 | El worker escribía sobre un trabajo sin reclamar | **Contrato** (C19): la prueba reclama el trabajo antes de procesarlo, como el worker |
| `admin-surface.test.ts` | Tres eventos de auditoría sin etiqueta | **Defecto** de este batch: se agregaron las etiquetas |

Dos defectos propios encontrados por la regresión y corregidos:
1. **Duplicados.** La regla contextual bloqueaba dos vinculadas de oportunidades distintas que esperan el mismo nombre. Para una vinculada, la identidad es la oportunidad; solo cuenta el mismo archivo.
2. **Ayudante de pruebas.** Subía un PDF con texto cuando el caso no tenía documento (B3.50). Ahora sube uno sin texto.

**Corrida limpia** (base reconstruida, código final):
- `e2e-v7` **65 / 0** · `e2e-v6` **98 / 0** · `e2e-v5` **135 / 0** · `e2e-v4-1` **173 / 0** · `e2e-v2` **162 / 0** · `e2e-qa` **68 / 0**.
- Objetivos 40, 5, 6 y 7, y `batch-1…11`: sin fallas, salvo `batch-6`.
- Jest **214 / 214** · unitarias **208 / 208**.
- Web: `e2e-web` **106 / 0** · `e2e-v6-web` **63 / 0** · `e2e-v7-web` **22 / 0** · `e2e-web-gestion` **47 / 0**.
- `tsc` sin errores en API, web y móvil.

Fallas que quedan, todas previas o de datos (las mismas de V7-2):
- `e2e-v3`: V3.2.15 (lotes de importación), y V3.9.1 y V3.9.11. Estas dos son la marca de V9 «la misma credencial en otro perfil»: el código `NA-2026-AB7` lo registra otro estudiante en V3.8.27 dentro de la misma corrida.
- `e2e-v3-2` (10): datos que solo tiene desarrollo.
- `batch-6` B6.47: instantáneas v2/v3.

**Nota sobre las bases reutilizadas.** Si las suites se repiten sobre la misma base, la detección de V9 marca como «compartidos» los archivos de contenido fijo que ya subió otro estudiante en la corrida anterior (B3.28, V3.9.12, V3.9.17). Eso hizo que la primera corrida de `e2e-batch-3` tardara horas. Con la base reconstruida, la suite termina en 8 s y esas marcas no aparecen.

## Riesgos o limitaciones

- **«Comprobar información» va después del envío, no antes.** El envío nunca depende de la comprobación (§5.3). Comprobar antes de enviar habría exigido un estado «borrador» de credencial que hoy no existe y que afectaría trayectoria y exportación. La comprobación corre al enviar, y el estudiante puede repetirla mientras Dirección no decida.
- **La fase 1 lee texto.** En un PDF escaneado depende del OCR, y la vista lo advierte. No es una prueba de autenticidad.
- **Bandeja de Dirección:** ya recibe las vinculadas y las históricas con su origen y estado técnico. Su rediseño (observar, Admin en solo lectura, sin autoverificación) es V7-4.

## Pendientes y siguiente batch propuesto

- **Decisión del usuario:** migrar la base de desarrollo (`npm --prefix api run migration:run`). Sigue pendiente la autorización del recálculo D04.
- **Siguiente batch: V7-4**, revisión humana obligatoria (D01).
