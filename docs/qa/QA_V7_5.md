# Informe BATCH V7-5 — Documentos institucionales: general / individual y abrir lo recibido

Formato del contrato V7.1 §17.

## BATCH / rama / commit base / commit resultante

V7-5 · `feature/afinia-v7-cierre-final`. Base: `3abd8d1` (V7-4). El commit resultante es el que contiene este informe.

## Requisitos y páginas

- **Contrato:** §6.3 (general e individual; entrega, reintento y reemplazo) y §6.4 (abrir el certificado recibido), pp. 14–15.
- **Matriz:** I02–I09.
- **Hallazgos GAP:** DOC-01…04. DOC-05 y DOC-06 ya estaban correctos y se prueban aquí.

## Decisiones Dxx confirmadas

- **D05 (25/11):**
  - **General:** un archivo real común, entregado de forma automática a los asistentes confirmados al terminar la actividad y cerrar la lista.
  - **Individual:** un archivo por estudiante. Un documento con nombre no se reparte a todos.
- **D04:** el certificado institucional respalda la participación confirmada; no agrega otra experiencia ni otro evento de afinidad (I11, ya cubierto en V7-2 y B6).
- **Lo anterior a V7.1** (actividades sin tipo de certificado): conserva la entrega manual, ahora con las mismas garantías:
  - solo con la actividad terminada;
  - sin duplicados;
  - sin reemplazo silencioso.

## Estado previo y reproducción

Contra la API de V7-4 (`3abd8d1`) en `afinia_test`:

| Escenario | Antes (V7-4) |
|---|---|
| DOC-01 / I02 / I09 | No existía el tipo general o individual (`certificateMode` rechazado) ni la entrega automática |
| DOC-03 | Se entregó un certificado con la actividad todavía **abierta** (201) |
| I05 / DOC-02 | Reentregar con otro archivo y sin motivo **cambió el archivo en silencio** (201) |
| I06 / DOC-04 | «Ver certificado» era un `<a href>` suelto hacia `/api/files/...`: sin la sesión del estudiante y apuntando al origen de la web (defecto de la p. 14) |

Evidencia: `e2e-v7.mjs batch5` contra V7-4 se interrumpe en la creación (`certificateMode no es un campo admitido`). La sonda `sonda-v75.mjs` reproduce DOC-03 e I05.

## Ya estaba correcto (sin cambios)

- **DOC-05:** la API entrega el archivo solo a su titular, a quien lo entregó, a Dirección y a Administración. Probado: otro estudiante recibe 403/404 y sin sesión, 401.
- **DOC-06:** Administración no entrega documentos académicos (403).
- **El móvil** ya abría los archivos con la sesión (`abrirArchivo`).

## Cambios exactos y archivos

**Migración aditiva** `1780920000000-V71InstitutionCertificates`:
- `activities.certificate_mode` (`general` | `individual` | `null`) y `general_certificate_file_id`;
- `internal_constancies.version`, `previous_versions` y `delivered_at`.

No modifica filas.

**API**
- `constancies/certificado-general.service.ts` (módulo `CertificadoGeneralModule`, nuevo):
  - entrega el archivo común a los CONFIRMED **una sola vez por estudiante**, con un bloqueo por inscripción para que dos disparadores simultáneos no dupliquen;
  - solo si se cumplen `FINISHED` y la lista cerrada; nunca a ausentes, no admitidos ni externos;
  - si falta algo, lo dice (`falta_archivo`, `falta_fin_o_cierre`, `falta_emisor`) y **no fabrica ningún documento**.
- **Disparadores:**
  - el cierre de la lista (`closeAttendance`);
  - el fin automático (trabajador de ciclo de vida);
  - el fin manual;
  - la carga tardía del archivo.
- `constancies.service.ts`:
  - se entrega **solo con la actividad terminada** (`CERTIFICATE_ACTIVITY_NOT_FINISHED`);
  - **general:** «entregar» corre la misma entrega idempotente;
  - **individual:** un estudiante y su propio archivo por vez. El archivo de uno no se entrega a otro (`INDIVIDUAL_FILE_REUSED`);
  - reintentar sin cambios no duplica ni repite el aviso;
  - **reemplazar exige motivo** (`CERTIFICATE_ALREADY_DELIVERED`): sube la versión, la anterior queda en `previous_versions` y el estudiante recibe un aviso con el motivo;
  - `PUT …/institution-certificates/:id/general-file`: el archivo común, privado hasta la entrega. Si ya se entregó, no se cambia por ahí;
  - `GET …/status`: tipo, entregados sobre confirmados y qué falta;
  - la lista de confirmados incluye `deliveredAt` y `version` para mostrar «Entregado».
- DTO de actividad: `certificateMode`.

**Web**
- `components/CertificadoInstitucional.tsx` (nuevo), en el panel de participación:
  - general: el documento común, qué falta y cuántos lo recibieron;
  - individual: «Entregado» con su fecha o «Entregar certificado» por estudiante, y «Reemplazar» con motivo;
  - antes de terminar no se ofrece entregar.
- `ActivityManager.tsx`: «Tipo de certificado» (general o individual) con su explicación. Se retiraron «Entregar a todos los confirmados» y el diálogo antiguo.
- `student/Evidences.tsx`: «Ver certificado» usa `BotonArchivo` (abre con la sesión) y muestra «Entregado el …».

## Migraciones / datos preservados / compatibilidad web-móvil

- Migración aditiva, probada en `afinia_test`. **Desarrollo:** `npm --prefix api run migration:run` aplica las de V7-3, V7-4 y V7-5.
- Lo ya entregado conserva su archivo y su código. Pasa a versión 1 con `delivered_at` vacío, y la interfaz muestra su fecha de registro.
- **Móvil:** solo recibe y abre. Ya lo hacía con la sesión.

## Pruebas ejecutadas (comando, resultado, evidencia)

| Comando | Resultado |
|---|---|
| `e2e-v7.mjs batch5` contra V7-4 / `sonda-v75.mjs` | Reproducción (ver arriba) |
| `e2e-v7.mjs batch5` | **9 / 9** |
| `e2e-v7-web.mjs batch5` | **5 / 5** |
| `e2e-v7.mjs` completo | **89 / 0** |

## PASS / FAIL / BLOCKED / NE

| Escenario | Resultado | Evidencia |
|---|---|---|
| I02 General con archivo real y lista cerrada | **PASS** (automática, una vez) | V7.5.2 · V7.5.4 |
| I03 General sin archivo | **PASS** (pendiente explicado, sin fabricar) | V7.5.1 · W7.5.1 |
| I04 Individual con dos personas | **PASS** (dos archivos; ni masivo ni el de otro) | V7.5.6 |
| I05 Repetir la entrega | **PASS** (sin duplicar; «Entregado»; reemplazo con motivo y versión) | V7.5.3 · V7.5.7 · W7.5.2 |
| I06 El estudiante abre su certificado | **PASS** (PDF, autenticado) | V7.5.8 · W7.5.4 |
| I07 Otro estudiante pide el archivo | **PASS** (403/404; sin sesión, 401) | V7.5.8 · V32.8.10 |
| I08 Falla el almacenamiento | **NE** en e2e: la entrega no lee el almacenamiento (registra la referencia). Al abrir, `BotonArchivo` muestra el error y no simula un archivo | — |
| I09 General con presentes y ausentes | **PASS** (solo confirmados) | V7.5.2 |
| DOC-03 Entregar antes de terminar | **PASS** (409) | V7.5.5 · V32.8.5b |
| DOC-06 Administración entrega | **PASS** (403) | V7.5.9 · V32.8.14 |

## Regresiones verificadas

**Corrida limpia** (base reconstruida). Las fallas nuevas fueron **cambios de contrato** y se adaptaron las pruebas:

| Suite | Falla | Adaptación |
|---|---|---|
| `e2e-v3` V3.18.0…25 | Entregaba el certificado con la actividad sin terminar | La actividad termina antes (DOC-03) |
| `e2e-v3-2` V32.8.6–14 | Igual; y reentregar cambiaba el código sin motivo | Termina antes; nueva V32.8.5b (409 antes de terminar); V32.8.13 exige motivo para cambiar lo entregado (I05) |
| `e2e-batch-6` B6.17, B6.20 | Entregaba con la actividad sin terminar | La actividad termina antes |

Resultados finales:
- `e2e-v7` **89 / 0** · `e2e-v6` **98 / 0** · `e2e-v5` **135 / 0** · `e2e-v2` **162 / 0** · `e2e-qa` **68 / 0**.
- Objetivos y `batch-1…11`: sin fallas, salvo B6.47.
- Jest **214 / 214** · unitarias **220 / 220**.
- Web: `e2e-web` **106 / 0** · `e2e-v6-web` **63 / 0** · `e2e-v7-web` **34 / 0** · `e2e-web-gestion` **47 / 0**.
- `tsc` sin errores en API, web y móvil.

Fallas que quedan, todas previas o de datos (las mismas de V7-2 a V7-4):
- V41.10.1–2, V3.2.15, `e2e-v3-2` (9) y B6.47;
- V3.9.12 y 9.17 solo si se repite sobre la misma base.

**Observación:** V7.4.1 falló una vez dentro de la regresión completa y pasó en las dos corridas siguientes (15/15 y 89/0). Queda anotada como intermitente para vigilarla en V7-13.

## Riesgos o limitaciones

- **Reemplazar el general ya entregado** se hace estudiante por estudiante, con motivo. A propósito, no hay un «cambiar el documento a todos».
- **I08:** no se simuló una caída del almacenamiento en e2e.

## Pendientes y siguiente batch propuesto

- **Decisiones del usuario:** migrar la base de desarrollo y autorizar o no el recálculo D04.
- **Siguiente batch: V7-6**, retirar los registros verificables propios de Afinia (§7).
