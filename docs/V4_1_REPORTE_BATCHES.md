# Afinia V4.1 — Reporte por batch

Formato del §25 del contrato `AFINIA_CONTRATO_UNICO_CONSOLIDADO_V4_V4_1_CLAUDE_2026-10-16.md`.

- **Hallazgos:** [`AUDITORIA_GAP_AFINIA_V4_1.md`](../AUDITORIA_GAP_AFINIA_V4_1.md)
- **Plan:** [`PLAN_BATCHES_AFINIA_V4_1.md`](../PLAN_BATCHES_AFINIA_V4_1.md)

---

## BATCH V4.1-0 — Inspección Git, baseline, comparación

| | |
|---|---|
| **Rama real** | `feature/afinia-v4-1-cierre`, creada desde `feat/afinia-v3-2` |
| **Commit base** | `8110245` |
| **Estado Git antes** | Limpio en archivos rastreados. Sin seguimiento: el contrato y `scripts/demo-60.ps1` y `scripts/demo-objetivo-6.mjs` (del usuario; no se commitean). |
| **Commit** | `3f8c8fe docs(v4.1-batch-0): …` |

- **Gaps verificados:** los 30 ajustes A41 clasificados con evidencia (sondas contra la API real y código con rutas), en `AUDITORIA_GAP_AFINIA_V4_1.md`.
- **Pruebas:** unitarias 130/130 sobre la base.
- **Cambios de código:** ninguno.

---

## BATCH V4.1-1 — Activación, validaciones, grillas y UX básica

| | |
|---|---|
| **Rama real** | `feature/afinia-v4-1-cierre` |
| **Commit base** | `3f8c8fe` |
| **Estado Git antes** | Limpio en archivos rastreados; los mismos tres archivos sin seguimiento. |

**Gaps verificados:**

| ID | Antes | Después |
|---|---|---|
| A41-001 | DEFECT_CONFIRMED (código) | Corregido |
| A41-002 | DEFECT_CONFIRMED | Corregido |
| A41-003 | PARTIAL | Corregido |
| A41-004 | DEFECT_CONFIRMED (sonda: `123123` / `!@#$%^&` / `____` → 201) | Corregido |

**Preservado (sin tocar):**
- política de activación y recuperación, cooldown, tokens, correo y sesión;
- la pestaña «Tengo el enlace» (A.2);
- búsqueda, alta, baja y reactivación de Categorías y Recursos;
- paginación existente de la gestión de actividades;
- el bloqueo de URL duplicada.

**Archivos modificados:**

| Archivo | Cambio |
|---|---|
| `web/src/App.tsx` | `key` distinta en `/activar/solicitar` – `/recuperar` y en `/activar` – `/restablecer`, para que React no reutilice la instancia con el estado anterior (A41-001) |
| `web/src/pages/admin/AreasSkills.tsx` | Se quitó «(V3.2 §10)» del texto de ayuda (A41-002) |
| `web/src/pages/admin/ActivityCategories.tsx` | Orden por columna y 10 por página (A41-003) |
| `web/src/pages/director/LearningResources.tsx` | Igual, en la vista de recursos de Dirección y Admin (A41-003) |
| `web/src/components/ActivityManager.tsx` | Orden por columna en la gestión, que ya paginaba (A41-003); validación del aula debajo del campo, también en borrador (A41-004) |
| `web/src/lib/validators.ts` | `placeName`, la misma regla que la API (A41-004) |
| `web/src/index.css` | `.scroll-x` con `position: relative` (ver «Fallo → causa → corrección») |
| `api/src/common/validation.ts` | `IsPlaceName`: al menos una letra Unicode; letras, números y puntuación razonable (A41-004) |
| `api/src/activities/dto/create-activity.dto.ts` | `@IsPlaceName()` en `location`; crear y editar comparten el DTO (A41-004) |
| `api/src/audit/audit.service.ts` | Filtro de fechas de la auditoría en hora de Bolivia (ver «Fallo → causa → corrección», punto 3) |
| `scripts/e2e-v4-1.mjs` | Suite nueva de la API para V4.1 |
| `scripts/e2e-web.mjs` | Casos WEB.41.1–41.10 |
| `package.json` | Script `test:v41`, incluido en `test:all` |

**Migraciones:** ninguna.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs` → **13/13**:
  - B03: «Aula 201», «Laboratorio B-12», «Auditorio Principal», «Torre Académica, piso 4» y «Salón Ñandú» se aceptan;
  - B04: «123123», «!@#$%^&», «____» y «12-34» se rechazan en su campo, y solo espacios no se guarda;
  - la misma regla al editar;
  - una actividad virtual no necesita aula.
- `node scripts/e2e-web.mjs` → **60/60**, incluidos:
  - WEB.41.1 (B01): «Olvidé mi contraseña» desde una cuenta activa abre `/recuperar` limpio;
  - WEB.41.2: sin nombres internos;
  - WEB.41.3–41.6 (B02): Categorías de a 10, orden que invierte, página 2 desde el registro 11, filtro que vuelve a la página 1;
  - WEB.41.7 y 41.8: Recursos y Actividades ordenables;
  - WEB.41.9 (B04): error del aula debajo del campo;
  - WEB.41.10: sin errores de JavaScript.
- **Regresión completa (22 suites):** 2062 correctas, 1 fallo (V32.18.7). Corregido el defecto y repetida su sección (14/14): **2063 correctas, 0 fallos**.

**Fallo → causa → corrección → regresión:**
1. **WEB.22, Sociedad en 375 px → FAIL** (la página se desbordaba 447 px).
   - *Causa:* el `<span className="sr-only">` nuevo de la columna de acciones es `position: absolute`, y el contenedor `.scroll-x` no tenía `position: relative`, así que el span escapaba del desplazamiento.
   - *Corrección:* `.scroll-x { position: relative }`, como ya hacía `.table-scroll`.
   - *Regresión:* WEB.22 PASS en los tres actores.
2. **WEB.41.4 → FAIL** por el tutorial de bienvenida, que tapaba la página en un perfil de navegador nuevo. Era un error de la prueba, no del producto.
   - *Corrección:* la prueba lo cierra con «Omitir», como las demás.
   - *Regresión:* PASS.
3. **V32.18.7, filtro de fechas de la auditoría → FAIL** en la regresión (0 eventos «de hoy»). Es un defecto del V3.2 (B18) que dependía de la hora: apareció al correr a las 23:36 de Bolivia.
   - *Causa:* `:desde::date AT TIME ZONE 'America/La_Paz'`. Con un `date`, Postgres lo convierte primero a `timestamptz` en UTC y después a hora local, así que la ventana del día quedaba corrida 8 horas. Verificado en la base: daba `2026-10-15 20:00` en lugar de `2026-10-16 04:00 UTC`.
   - *Corrección:* `(:desde::date)::timestamp AT TIME ZONE 'America/La_Paz'`, y lo mismo en `hasta`. No hay otras ocurrencias del patrón en la API.
   - *Regresión:* `e2e-v3-2 batch16` 14/14 a la misma hora.

**Efecto:**
- **Backend:** validación nueva en `location`. Ningún dato existente se modifica. Las suites y semillas solo usan lugares válidos (verificado).
- **Frontend:** las grillas y el formulario cambian como se describe arriba.
- **Móvil:** sin cambios (no edita actividades).

**Seguridad y permisos:** sin cambios. La regla del aula se aplica en la API, no solo en la web.

**Contrato y documentación:**
- `400` con `fields.location` para un aula sin letras;
- `test:v41`;
- este reporte.

**Pendientes:** ninguno de A41-001…004.

**Riesgos:**
- Si una actividad antigua tiene un lugar sin letras y alguien la edita, tendrá que corregirlo antes de guardar.
- En la base de desarrollo hay **3** actividades así, y son las creadas por las sondas del BATCH 0 («V41 Sonda …»). No hay datos reales afectados.
- No se modifican los datos guardados.

**Commit propuesto:** `fix(v4.1-batch-1): recuperar desde cuenta activa, grillas ordenables de 10 y aula con contenido reconocible`

---

## BATCH V4.1-2 — Formulario de actividad e imágenes

| | |
|---|---|
| **Rama real** | `feature/afinia-v4-1-cierre` |
| **Commit base** | `764fa0c` |
| **Estado Git antes** | Limpio en archivos rastreados; solo los dos scripts de demo del usuario sin seguimiento. |

**Decisión aplicada** (el usuario pidió seguir con criterio propio, sin detenerse): máximo **5 imágenes** por actividad, el tope propuesto en A.5.

**Gaps verificados:**

| ID | Antes | Después |
|---|---|---|
| A41-005 | DEFECT_CONFIRMED (sonda: `managed.activitySkills = null`) | Corregido |
| A41-006 | MISSING | Implementado |
| A41-007 | DEFECT_CONFIRMED (sonda: Admin, borrador sin responsable → 400) | Corregido |
| V41-01 | DEFECT_CONFIRMED (sonda: charla sin skill → 400) | Corregido |

**Preservado:**
- validación de que las habilidades pertenecen a sus áreas;
- contexto área + habilidad;
- responsable obligatorio **al publicar**: V3.6.10 sigue pasando;
- `image_file_id` como portada, que es lo que usan la app móvil y los clientes anteriores;
- autorización de archivos: la imagen de un borrador solo la ve quien la gestiona.

**Archivos modificados:**

| Archivo | Cambio |
|---|---|
| `api/src/entities/activity-image.entity.ts` (nuevo) y `entities/index.ts` | `ActivityImage`: hasta 5 imágenes con su posición |
| `api/src/database/migrations/1780700000000-V41ActivityImages.ts` (nueva) | Tabla `activity_images`; copia como portada la imagen que ya tenía cada actividad |
| `api/src/activities/dto/create-activity.dto.ts` | `imageFileIds` (máximo 5, sin repetidos) |
| `api/src/activities/activities.service.ts` | Ver detalle abajo |
| `api/src/storage/file-access.service.ts` | Autoriza cualquiera de las imágenes de la actividad, no solo la portada |
| `web/src/components/ActivityManager.tsx` | Hasta 5 imágenes (miniaturas, portada, quitar); la edición se hidrata con las habilidades del detalle; la habilidad no es obligatoria y el responsable de Admin se pide al publicar |
| `web/src/components/ActivityCard.tsx` | Carrusel accesible en el detalle: botones, flechas del teclado y «Imagen n de N» con `aria-live` |
| `web/src/services/types.ts` | `images` en `Activity` |
| `web/src/index.css` | Estilos del carrusel y de las miniaturas |
| `scripts/e2e-v4-1.mjs` | Casos V41.2.1 a V41.2.20 |
| `scripts/e2e-web.mjs` | Casos WEB.42.1 a WEB.42.5 |
| `scripts/e2e-v3-2.mjs` | V32.5.4 actualizado a la regla V4.1 (la habilidad ya no se exige al publicar) |

Cambios en `activities.service.ts`:
- `findManagedBy` carga `activitySkills` (A41-005);
- `resolverResponsables` admite un borrador de Admin sin responsable;
- `assertCompleta` exige el responsable al publicar y deja de exigir habilidad (A41-007, V41-01);
- `resolverImagenes`, `replaceImagenes` e `images[]` en las respuestas (A41-006). Solo se validan las imágenes nuevas, así que quien edita una actividad ajena conserva las imágenes que subió otra persona. Un cliente antiguo que envía solo `imageFileId` cambia la portada sin borrar el resto.

**Migraciones:**
- `V41ActivityImages1780700000000`: aditiva.
- `pg_dump` previo en `pre-v41-b2.dump`.
- Probada `run → revert → run`: 24 imágenes existentes copiadas como portada; `revert` quita solo la tabla nueva.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs batch2` → **20/20**:
  - B05: la gestión trae las habilidades con su área, y editar otro campo no las borra;
  - B07: sin habilidad duplicada;
  - B06: charla general sin habilidad, aunque el área sigue siendo obligatoria;
  - B10: borrador de Admin sin responsable; publicarlo así se rechaza y con responsable se publica;
  - B08: 0, 1, 3 y 5 imágenes, 6 se rechaza; cambiar la portada, quitar una y el cliente antiguo conservan el resto; un archivo ajeno se rechaza; la segunda imagen de un borrador no se sirve a un estudiante y, publicada, sí.
- `node scripts/e2e-web.mjs` → **65/65**:
  - WEB.42.1: al editar aparecen marcadas las habilidades guardadas;
  - WEB.42.2: las 3 miniaturas con la portada;
  - WEB.42.3 (B09): la imagen de la tarjeta está en su propia región;
  - WEB.42.4: carrusel con botones y teclado, imagen cargada con la sesión;
  - WEB.42.5: sin errores de JavaScript.
- **Regresión completa (22 suites):** 2087 correctas, 1 fallo (V32.5.4). Actualizado ese caso: **2088 correctas, 0 fallos**.

**Fallo → causa → corrección → regresión:**
1. **V32.5.4 → FAIL.** La prueba de V3.2 exigía `skillIds` entre los faltantes al publicar. *Causa:* el contrato V4.1 (V41-01, §3.1, 23.1) quita esa exigencia. *Corrección:* la prueba ahora verifica que la habilidad **no** se exija. *Regresión:* `e2e-v3-2 batch5` 34/34.
2. **WEB.42.4 → FAIL** por el tutorial de bienvenida del estudiante, que tapaba la página en un perfil de navegador nuevo. Era un error de la prueba. *Corrección:* la prueba lo cierra con «Omitir». *Regresión:* PASS.

**Efecto:**
- **Backend:** tabla nueva y respuestas con `images[]`; `imageUrl` se conserva.
- **Frontend:** formulario y detalle.
- **Móvil:** sigue usando `imageUrl` (la portada), sin cambios.

**Seguridad y permisos:**
- solo se usan imágenes subidas por quien edita (o por Admin);
- la descarga de cualquier imagen pasa por la misma autorización que la portada.

**Pendientes:** ninguno de A41-005…007.

**Riesgos:** los borradores de Admin pueden quedar sin responsable hasta publicarse; el aviso aparece al intentar publicar.

**Commit propuesto:** `feat(v4.1-batch-2): edición con habilidades guardadas, charla sin habilidad, responsable al publicar y hasta 5 imágenes con carrusel`


---

## BATCH V4.1-3 — Estados, revisión, propiedad, alcance y tipos

| | |
|---|---|
| **Rama real** | `feature/afinia-v4-1-cierre` |
| **Commit base** | `5d30626` |
| **Estado Git antes** | Limpio en archivos rastreados (los scripts de demo del usuario, sin seguimiento). |

**Gaps verificados:**

| ID | Antes | Después |
|---|---|---|
| A41-008 | DEFECT_CONFIRMED (sondas: el docente asignado veía el borrador de Admin; lo PENDING aparecía en la gestión del Director) | Corregido |
| A41-009 | PARTIAL | Corregido: el responsable asignado solo opera y la unión de alcances se valida al publicar |
| A41-010 | DEFECT_CONFIRMED (sonda: publicar con inicio ayer → 201) | Corregido; además, causa al reabrir y «Duplicar» |
| A41-012 | PARTIAL | Tres pestañas por origen × carácter |
| A41-013 | PARTIAL | Opción redundante oculta en las internas |

**Preservado:**
- Dirección ve lo enviado en su bandeja y aprueba, observa o rechaza;
- el bloqueo de contenido de lo aprobado para el creador (409);
- `created_by` no cambia al aprobar;
- el borrador de la Sociedad sigue visible para sus responsables (§20);
- el ciclo automático (CLOSED / FINISHED);
- la cancelación con motivo.

**Archivos modificados:**

| Archivo | Cambio |
|---|---|
| `api/src/activities/activities.service.ts` | Ver detalle abajo |
| `api/src/activities/activities.controller.ts` | `POST /activities/:id/duplicate` |
| `api/src/audit/audit.service.ts`, `audit-labels.ts` | Evento `ACTIVITY_DUPLICATED`, con etiqueta |
| `api/src/storage/file-access.service.ts` | Permiso de imágenes: ver «Fallo → causa → corrección», punto 1 |
| `web/src/pages/student/Activities.tsx` | Pestañas «Académicas internas», «Extracurriculares internas» y «Oportunidades externas» |
| `web/src/pages/teacher/Activities.tsx` | Las mismas tres opciones en «Actividades de la carrera» |
| `web/src/components/ActivityManager.tsx` | Botón «Duplicar»; sin «Credencial externa esperada» en internas (salvo una actividad antigua que ya la tiene); aviso de los semestres que cubren los docentes responsables, con validación local |
| `web/src/services/index.ts`, `types.ts` | `duplicate`, `originType` en el listado y `semesters` de los candidatos |
| `scripts/e2e-v4-1.mjs` | V41.3.1 a V41.3.22 |
| `scripts/e2e-web.mjs` | WEB.43.1 a WEB.43.4 |
| `scripts/e2e-v3-2.mjs` | Tres pruebas de V3.2 actualizadas a las reglas V4.1 (ver «Fallo → causa → corrección», punto 2) |

Cambios en `activities.service.ts`:
- `veBorrador`: el borrador de una autoridad es solo de quien lo crea (A41-008, 23.3);
- `filtrarGestionables`: lo ajeno en revisión queda en la bandeja y no en la gestión del Director (A41-008);
- `assertSoloOperacion`: el responsable asignado por una autoridad solo cambia el estado operativo; no edita contenido, no cancela ni vuelve a borrador (A41-009, §4.4);
- `assertCobertura`: con solo docentes como responsables, los semestres tienen que estar dentro de la unión de sus alcances; con Dirección o Sociedad no hay límite (A41-009, §4.5, B13);
- `assertInicioFuturo`: una actividad nueva no se publica con un inicio pasado (A41-010, 23.5);
- reabrir un CLOSED dice la causa, `ACTIVITY_REOPEN_STARTED` o `ACTIVITY_REOPEN_FULL` (B14, B15);
- `duplicate` (B16);
- los candidatos docentes traen sus semestres.

**Migraciones:** ninguna.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs batch3` → **22/22**:
  - 23.3 / B10 / B11: borrador de Admin invisible para el docente asignado; publicado, lo opera, pero no edita, cancela ni reenvía;
  - B12 / 23.4: el borrador del docente no lo ve Dirección; enviado, está en la bandeja y no en su gestión; aprobado, la gestiona, el autor no cambia y no edita;
  - B13: candidatos con semestres; cobertura válida, semestre sin cubrir nombrado, toda la carrera rechazada con solo docentes y aceptada con Dirección; el borrador se guarda igual;
  - 23.5: inicio pasado rechazado; el borrador se guarda pero no se publica; borrador sin fecha;
  - B14 / B15: causa al reabrir y reapertura tras ampliar el cupo;
  - B16: duplicar una finalizada.
- `node scripts/e2e-web.mjs` → **69/69**, incluidos WEB.43.1–43.4: pestañas visibles, cada una con su filtro de origen, «Duplicar» y sin la opción redundante.
- Unitarias: **130/130**.
- **Regresión completa (22 suites):** 2072 correctas, 7 fallos, analizados abajo. Corregidos y repetidas las suites afectadas (`e2e-v3-2` batch5 34/34 y batch6 28/28, `e2e-v4-1` 55/55, `e2e-batch-1` 59/59): **2113 correctas, 0 fallos**.

**Fallo → causa → corrección → regresión:**
1. **V41.2.20 → FAIL, defecto del BATCH 2** (permiso de imágenes).
   - *Causa:* la consulta usaba `LIMIT 1`. Un mismo archivo puede ilustrar varias actividades; si tocaba primero un borrador, se negaba la imagen aunque otra actividad publicada la usara.
   - *Corrección:* se autoriza si **alguna** actividad que la contiene es visible para quien pide.
   - *Regresión:* `e2e-v4-1` 55/55.
2. **V32.5.13, V32.5.32, V32.5.33 y V32.6.28 → FAIL.** Pruebas de V3.2 que esperaban lo que el V4.1 cambia:
   - V32.5.13: el responsable asignado editaba el aula, y ahora solo opera (A41-009);
   - V32.5.32 y 33: publicaban actividades nuevas ya empezadas (A41-010); ahora se publican en el futuro y luego se ajusta la fecha;
   - V32.6.28: el responsable veía el borrador de Admin (A41-008).
   - *Corrección:* las pruebas verifican la regla V4.1.
   - *Regresión:* PASS.
3. **`e2e-batch-1` B2.2b → FAIL intermitente**, ya conocido: un 401 y el correo que no llega a tiempo, por la pausa entre reenvíos. No está relacionado con este batch. Repetida la suite: 59/59.
4. **Pruebas nuevas mal armadas:**
   - V41.3.5: el motivo de cancelación «Prueba» era demasiado corto y no llegaba al guard;
   - V41.3.19: el cupo solo lo ocupa lo confirmado (`OCCUPYING_STATUSES`), así que la prueba ahora confirma;
   - WEB.43.3: contaba antes de que cargara la grilla.
   - Corregidas: PASS.

**Efecto:**
- **Backend:** reglas de visibilidad, operación y publicación.
- **Frontend:** pestañas, «Duplicar», resultado y cobertura.
- **Móvil:** sin cambios. Las actividades externas siguen visibles en «Todas».

**Seguridad y permisos:** todo se valida en la API, que responde 403 o 404 con cada actor; la interfaz solo acompaña.

**Pendientes:** la finalización anticipada con motivo (§4.6). Hoy se puede pasar a FINISHED sin motivo; queda para cuando se defina si el motivo es obligatorio.

**Riesgos:** cambia lo que ve un docente responsable de borradores ajenos y lo que puede editar, porque ahora solo opera.

**Commit propuesto:** `feat(v4.1-batch-3): borradores privados, bandeja de Dirección, responsable que solo opera, cobertura de semestres, fecha futura al publicar, duplicar y pestañas por origen`


---

## BATCH V4.1-4 — Asistencia y derivados

| | |
|---|---|
| **Rama real** | `feature/afinia-v4-1-cierre` |
| **Commit base** | `99c61a9` |
| **Estado Git antes** | Limpio en archivos rastreados (los scripts de demo del usuario, sin seguimiento). |

**Decisión aplicada** (el usuario pidió seguir con criterio propio): el acta se cierra **solo a mano** («Cerrar asistencia»). No hay plazo ni cierre automático: el contrato (§5) prohíbe inventar un cierre universal de N horas.

**Gaps verificados:**

| ID | Antes | Después |
|---|---|---|
| A41-011, confirmar pendientes tras FINISHED | PRESERVE_PASS (sonda) | Conservado |
| A41-011, pasar un CONFIRMED a ABSENT libremente | DEFECT_CONFIRMED (sonda: 200) | Bloqueado |
| A41-011, «Cerrar asistencia» | MISSING | Implementado |
| A41-011, corrección excepcional con reconciliación | MISSING | Implementada |

**Preservado:**
- el estudiante nunca se autoconfirma;
- Administración no confirma participación;
- el cupo y la constancia automática al confirmar;
- recalcular trayectoria y afinidad al confirmar o deshacer;
- durante el evento y sin constancia, el responsable puede corregir un error propio.

**Archivos modificados:**

| Archivo | Cambio |
|---|---|
| `api/src/database/migrations/1780710000000-V41AttendanceSettlement.ts` (nueva) | `attendance_status` (`open` / `locked`), `attendance_closed_at` y `attendance_closed_by` |
| `api/src/database/migrations/1780710000001-V41PointsReversal.ts` (nueva) | Admite puntos negativos solo en filas de reverso (`dedupe_key` que empieza con `reverso:`) |
| `api/src/entities/activity.entity.ts` | Campos del acta |
| `api/src/activities/activities.service.ts` | Ver detalle abajo |
| `api/src/activities/activities.controller.ts` | `POST /activities/:id/attendance/close` y `POST /activities/:id/participation-correction` |
| `api/src/activities/dto/confirm-participation.dto.ts` | `CorrectParticipationDto` (motivo entre 10 y 400 caracteres) |
| `api/src/audit/audit.service.ts`, `audit-labels.ts` | `PARTICIPATION_CORRECTED` y `ATTENDANCE_CLOSED`, con etiqueta |
| `web/src/components/ActivityManager.tsx` | En Participantes: aviso del acta, «Cerrar asistencia» tras terminar, «Marcar ausente» solo si no está consolidada, «Corregir» con motivo para Dirección y Administración, acciones ordinarias deshabilitadas con el acta cerrada |
| `web/src/services/types.ts`, `index.ts` | Campos del acta, `closeAttendance` y `correctParticipation` |
| `scripts/e2e-v4-1.mjs` | V41.4.1 a V41.4.16 |
| `scripts/e2e-web.mjs` | WEB.44.1 a WEB.44.3 |
| `scripts/e2e-v3.mjs`, `scripts/e2e-v3-2.mjs` | V3.7.10–11 y V32.10.7 actualizados a las reglas V4.1 |

Cambios en `activities.service.ts`:
- **Guards en `confirmParticipation`:**
  - con el acta cerrada, 409 `ATTENDANCE_LOCKED`;
  - en una actividad cancelada no se otorga asistencia (`ACTIVITY_CANCELLED`);
  - un CONFIRMED consolidado (actividad FINISHED o constancia emitida) no pasa a otro estado (`PARTICIPATION_CONSOLIDATED`).
- **`closeAttendance`:** solo con la actividad FINISHED y por el responsable; Administración no, porque es operación del responsable.
- **`correctParticipation`:** Dirección o Administración, con motivo. Vale aunque el acta esté cerrada. Reconcilia:
  - la constancia (queda rechazada; no se borra);
  - la trayectoria y la afinidad (recálculo);
  - los puntos: un **reverso** o una **restitución** auditables en `gamification_events`, sin borrar nada;
  - además, queda en la auditoría con antes, después y motivo, y avisa al estudiante.

**Migraciones:**
- `V41AttendanceSettlement`: aditiva; las 8121 actividades existentes quedan `open`, así que nadie pierde la regularización.
- `V41PointsReversal`: amplía la regla de puntos. `down` restaura la anterior como `NOT VALID` para no destruir reversos que ya existan.
- `pg_dump` previo en `pre-v41-b4.dump`. Ambas probadas `run → revert → run`.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs batch4` → **16/16**:
  - corrección propia sin constancia;
  - con constancia, bloqueada (B18);
  - no se cierra antes de terminar;
  - B17: tras FINISHED se confirma un pendiente;
  - B18: tras FINISHED no se pasa a ausente;
  - B19: cierre por el responsable (Admin no), bloqueo posterior e historial preservado;
  - corrección: solo Dirección o Admin y con motivo; vale con el acta cerrada; la constancia deja de estar vigente; reverso de puntos auditable; auditoría con antes, después y motivo; restitución única al volver a confirmar;
  - actividad cancelada sin asistencia;
  - un estudiante no se autoconfirma.
- `node scripts/e2e-web.mjs` → **72/72**:
  - WEB.44.1: el docente ve «Cerrar asistencia», no ve «Marcar ausente» en lo consolidado y cierra el acta;
  - WEB.44.2: Dirección corrige con motivo;
  - WEB.44.3: sin errores de JavaScript.
- Unitarias: **130/130**.
- **Regresión completa (22 suites):** 2131 correctas, 2 fallos. Actualizadas esas pruebas (`e2e-v3 batch7` 13/13, `e2e-v3-2 batch10` 8/8): **2133 correctas, 0 fallos**.

**Fallo → causa → corrección → regresión:**
1. **V41.4.10 → FAIL (500).**
   - *Causa:* la base solo admitía puntos entre 0 y 1000 (`chk_gamification_event_points`), así que el reverso negativo fallaba. Además, la corrección quedaba a medias: la inscripción y la constancia cambiaban sin reverso ni auditoría.
   - *Corrección:*
     - migración `V41PointsReversal`;
     - el movimiento de puntos se registra **antes** de tocar la inscripción, de modo que si falla no queda nada a medias.
   - *Regresión:* 16/16.
2. **V3.7.10 → FAIL.** La prueba de V3 retiraba con el responsable una participación con constancia, y ahora eso está consolidado (B18). *Corrección:* la prueba usa la corrección excepcional de Dirección y verifica lo mismo: la constancia queda rechazada sin borrarse y vuelve a valer al reconfirmar. *Regresión:* PASS.
3. **V32.10.7 → FAIL.** La prueba creaba una actividad nueva ya terminada, lo que contradice A41-010. *Corrección:* la publica en el futuro y luego la termina. *Regresión:* PASS.

**Efecto:**
- **Backend:** acta, guards y corrección.
- **Frontend:** panel de Participantes.
- **Móvil:** sin cambios; el estudiante no gestiona asistencia.

**Seguridad y permisos:**
- la corrección solo la hacen Dirección y Administración, con motivo auditado;
- el cierre lo hace el responsable;
- todo se valida en la API.

**Pendientes:** la afinidad y la trayectoria se recalculan con el mecanismo existente (`requestRecalculation`). No hay snapshots aparte que reconciliar.

**Riesgos:**
- un docente que solía «desconfirmar» tarde ahora tiene que pedírselo a Dirección;
- quedan 8121 actas abiertas hasta que cada responsable las cierre.

**Commit propuesto:** `feat(v4.1-batch-4): acta de asistencia independiente de FINISHED, cerrar asistencia y corrección excepcional con reconciliación`


---

## BATCH V4.1-5 — Recursos y Biblioteca

| | |
|---|---|
| **Rama real** | `feature/afinia-v4-1-cierre` |
| **Commit base** | `7dbca20` |
| **Estado Git antes** | Limpio en archivos rastreados (los scripts de demo del usuario, sin seguimiento). |

**Gaps verificados:**

| ID | Antes | Después |
|---|---|---|
| A41-014, título «123456» / quién publica «!!!!» | DEFECT_CONFIRMED (sonda: aceptados; solo se rechazaba la URL) | Corregido, en la API y en la web |
| A41-014, propuesta del docente | MISSING (sonda: 403) | Implementada, con revisión de Dirección |
| A41-014, «Para ti» en la Biblioteca | MISSING | Implementado |
| B21, URL duplicada | PRESERVE_PASS | Conservado |

**Preservado:**
- búsqueda en vivo, facetas, favoritos, retirar y reponer, la URL única;
- Dirección y Administración siguen creando directo;
- recursos sin responsables (no son actividades);
- consultar o guardar un recurso no da afinidad.

**Archivos modificados:**

| Archivo | Cambio |
|---|---|
| `api/src/database/migrations/1780720000000-V41ResourceReview.ts` (nueva) | `review_status`, `semester_scope`, `review_comment`, `reviewed_by` y `reviewed_at` en `learning_resources` |
| `api/src/entities/learning-resource.entity.ts` | Esos campos |
| `api/src/common/validation.ts` | `IsMeaningfulText`: al menos dos letras Unicode (A.4) |
| `api/src/catalogs/dto/learning-resource.dto.ts` | Validación significativa de título y quién publica al crear y al editar; `semesterScope`; `ReviewLearningResourceDto` |
| `api/src/catalogs/catalogs.service.ts`, `catalogs.controller.ts`, `catalogs.module.ts` | Ver detalle abajo |
| `api/src/library/library.service.ts`, `library.controller.ts` | Ver detalle abajo |
| `api/src/audit/*` | `RESOURCE_PROPOSED` y `RESOURCE_REVIEWED`, con etiqueta |
| `web/src/pages/student/Library.tsx` | Pestañas «Todos los recursos», «Para ti» y «Mis favoritos»; motivos en cada tarjeta de «Para ti» |
| `web/src/pages/director/LearningResources.tsx` | Modo docente («Proponer recursos», sus semestres, «Enviar propuesta», solo edita su propuesta pendiente u observada); bandeja «Pendientes de revisión» con Aprobar, Observar y Rechazar para Dirección; estado de revisión en la grilla; error inline de título y quién publica |
| `web/src/App.tsx`, `navigation.ts`, `components/Layout.tsx` | Ruta y menú «Proponer recursos» del docente |
| `web/src/services/*`, `web/src/index.css` | `pending`, `review`, `forMe`, `reasons` y estilos |
| `scripts/e2e-v4-1.mjs` | V41.5.1 a V41.5.18 |
| `scripts/e2e-web.mjs` | WEB.45.1 a WEB.45.5 |
| `scripts/e2e-batch-7.mjs`, `scripts/e2e-v2.mjs` | B7.2 y V2.14.7 actualizados a la regla V4.1 |

Detalle de la API:
- **`catalogs.service.ts` y `catalogs.controller.ts`:**
  - el docente crea con `review_status = pending`, solo para sus semestres;
  - edita solo su propuesta pendiente u observada (corregir una observada la reenvía);
  - no retira ni edita lo ya revisado;
  - Dirección y Administración tienen `GET /learning-resources/reviews/pending` y `POST /learning-resources/:id/review` (observar o rechazar exige comentario);
  - el listado del catálogo oculta a los demás lo pendiente.
- **`library.service.ts` y `library.controller.ts`:**
  - la Biblioteca solo muestra `not_required` o `approved`, para toda la carrera o el semestre del estudiante;
  - `forMe=true` es «Para ti»: cruza áreas y tecnologías de interés y de mejora declaradas y explica cada coincidencia («Coincide con tus intereses: …», «Coincide con lo que quieres mejorar: …»). No usa favoritos, clics ni afinidad.

**Migraciones:**
- `V41ResourceReview`: aditiva; los 634 recursos existentes quedan `not_required`, así que no cambia nada de lo publicado.
- `pg_dump` previo en `pre-v41-b5.dump`. Probada `run → revert → run`.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs batch5` → **18/18**:
  - B20: tres errores, cada uno en su campo, y la misma regla al editar;
  - B21: URL duplicada;
  - propuesta: solo para sus semestres, pendiente e invisible en la Biblioteca, sin edición ajena;
  - bandeja: el docente no la ve; observar exige comentario; corregida vuelve a la bandeja; aprobada, la ve el estudiante de su semestre y no el de otro; aprobada, el docente ya no la cambia ni retira recursos;
  - B23: «Para ti» por área de interés y por tecnología a mejorar, con motivo; nada sin relación;
  - B22: un favorito no vuelve un recurso «para ti».
- `node scripts/e2e-web.mjs` → **77/77**, incluidos WEB.45.1–45.5.
- Unitarias: **130/130**.
- **Regresión completa (22 suites):** 2154 correctas, 2 fallos (B7.2, V2.14.7). Actualizados: `e2e-batch-7` 57/57 y `e2e-v2 batch14` 7/7. **2156 correctas, 0 fallos**.

**Fallo → causa → corrección → regresión:**
- **B7.2 y V2.14.7 → FAIL.** Las pruebas exigían que un docente **no** pudiera crear recursos. *Causa:* el contrato V4.1 (§7) le permite proponerlos. *Corrección:* las pruebas verifican que la propuesta queda pendiente y no se publica sola. *Regresión:* PASS.

**Efecto:**
- **Backend:** revisión y «Para ti».
- **Frontend:** Biblioteca y página de recursos.
- **Móvil:** la Biblioteca móvil sigue mostrando lo publicado (la API ya filtra lo pendiente); «Para ti» en el móvil queda para el BATCH 12, en el informe de impacto móvil.

**Seguridad y permisos:**
- el docente no ve la bandeja (403), no edita lo ajeno (404) ni lo revisado (409), y no retira;
- todo se valida en la API.

**Pendientes:**
- El favorito de recurso todavía figura en el recomendador de actividades. Se retira en el V4.1-6, junto con «Guardar».
- La gamificación ligada a recursos (hito externo verificable) queda para el V4.1-7. Mientras tanto, los recursos no dan puntos.

**Riesgos:** ninguno nuevo.

**Commit propuesto:** `feat(v4.1-batch-5): recursos con contenido válido, propuesta docente con revisión de Dirección y «Para ti» en la Biblioteca`

---

## BATCH V4.1-6 — Recomendaciones: «Me interesa» en lugar de «Guardar»

**Hallazgos:** A41-015 (B24, B25; §8, A.9).

**Archivos modificados:**
- **`shared/src/enums/recommendation.enum.ts`:** nuevo motivo `ACTIVITY_INTERESTED = 'activity_interested'`.
- **`api/src/recommendations/recommendations.engine.ts`:**
  - el 5 % que antes daban «Guardar una recomendación parecida» y los recursos favoritos ahora sale de «Me interesa» en **otras** actividades (mismas áreas o tecnologías);
  - la señal es explícita, secundaria y reversible: no crea una recomendación sola, no cuenta la propia actividad y desaparece al quitar «Me interesa»;
  - «Guardar» queda como acceso rápido: no cambia el puntaje. Lo descartado sigue bajando lo parecido;
  - los motivos dicen «Coincide con tus intereses: …» o «Coincide con lo que quieres mejorar: …».
- **`recommendation.rules.ts` y `recommendations.service.ts`:** el reparto publicado nombra `activity_interested` (40 / 30 / 15 / 10 / 5).
- **Web:**
  - `Activities.tsx`: el botón de una actividad pasada es siempre «Me interesa» / «Te interesa»;
  - `Recommendations.tsx`: muestra «Coincidencia con lo que declaraste: N de 100» con el reparto, en lugar de un porcentaje que parecía certeza.

**Migraciones:** ninguna (usa `activity_registrations` con estado `interested`, que ya existía).

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs batch6` → **8/8**:
  - B25: los motivos distinguen intereses y mejora;
  - B24: «Me interesa» en otra actividad del área suma el 5 %, una sola vez; la actividad marcada no se recomienda a sí misma por esa señal; quitarlo quita la señal; no reescribe lo declarado en el perfil;
  - A.9: «Guardar» no cambia el puntaje de lo parecido;
  - el reparto publicado nombra «Me interesa»;
  - §8: nadie llega a 100 por una sola coincidencia.
- Unitarias: **130/130**.
- **Regresión completa (22 suites):** 2163 correctas, 1 fallo (V2.10.3). Tras corregirlo, `e2e-v2` 162/162. **2164 correctas, 0 fallos**.

**Fallo → causa → corrección → regresión:**
- **V2.10.3 → FAIL.** La prueba buscaba el texto antiguo «te interesa» en el motivo. *Causa:* el contrato pide «Coincide con tus intereses». *Corrección:* la prueba busca el texto nuevo; el puntaje no cambió. *Regresión:* PASS.
- También se actualizaron a la regla V4.1: B7.53 (`e2e-batch-7`), V3.15.12 (`e2e-v3`), V32.10.2, V32.10.3 y V32.10.6 (`e2e-v3-2`). Esas pruebas esperaban que «Guardar» o un favorito sumaran puntaje.

**Efecto:**
- **Backend:** motor de recomendaciones.
- **Frontend:** Actividades y Recomendaciones.
- **Móvil:** consume los mismos motivos desde la API; el texto nuevo llega sin cambios de código.

**Seguridad y permisos:** sin cambios; la señal solo usa las marcas del propio estudiante.

**Pendientes:** ninguno.

**Riesgos:** quien había guardado recomendaciones pierde ese 5 % de empuje. Es el comportamiento que pide el contrato.

**Commit propuesto:** `feat(v4.1-batch-6): «Me interesa» como señal reversible, «Guardar» sin efecto en el puntaje y motivos por intereses o mejora`

---

## BATCH V4.1-7 — Gamificación simplificada: criterios, extras de temporada y propuestas docentes

**Hallazgos:** A41-016, A41-017, A41-027 (§9.1–§9.6, A.10).

**Archivos modificados:**
- **Migración `1780730000000-V41GamificationCriteria`** (aditiva):
  - `gamification_criteria` gana `valid_from`, `valid_until` e `is_bonus`, con un control de vigencia;
  - nueva tabla `gamification_proposals`, con un índice único parcial que impide repetir la misma propuesta mientras no se rechace.
- **Entidades:** `GamificationProposal` (nueva) y campos de vigencia y de bono en `GamificationCriterion`.
- **`catalogs.service.ts`, `catalogs.controller.ts` y su DTO:**
  - Dirección y Administración configuran los criterios;
  - un extra de temporada exige fechas, y que termine después de empezar;
  - `GET /gamification-criteria/available?trigger=` lista solo los criterios vigentes que se pueden elegir (participación o proyecto), sin extras de temporada.
- **`activities.service.ts` y `create-activity.dto.ts`:** la regla de puntos de una actividad nombra un `criterionId` y los puntos salen del criterio. Escribir puntos a mano se rechaza, con el error en su campo.
- **`gamification.service.ts`:**
  - los extras de temporada vigentes (hora de Bolivia) suman aparte, una vez por hecho y en su área;
  - los proyectos ya no dan puntos solos: «primer proyecto respaldado» y «proyecto corroborado» dejan de otorgarse automáticamente;
  - lo ya otorgado se conserva en el historial.
- **`gamification-proposals.service.ts` (nuevo) y `gamification-extras.controller.ts`:**
  - el docente propone un criterio sobre un proyecto, con estas condiciones:
    - visible para docentes;
    - respaldo SUPPORTED o mayor;
    - de un estudiante de su alcance: dueño, o integrante con su contribución confirmada;
    - con un motivo;
    - sin duplicados;
    - sobre un hecho que no haya recibido ya puntos.
  - Dirección (o Administración) aprueba, o rechaza con motivo. Al aprobar, los puntos entran una vez, con la clave `criterio:<id>:project:<id>`.
  - Crear retos o recompensas, premiar a mano y canjear responde **410**. Los históricos se siguen consultando.
- **`gamification-extras.service.ts`:** la tabla de puntos por estudiante tiene filtro por nombre, y cada consulta queda auditada (`GAMIFICATION_SCOPE_VIEWED`).
- **`projects.service.ts`:** el portafolio institucional expone `studentProfileId` y `backingTier` para el formulario de propuesta.
- **Auditoría:** `GAMIFICATION_PROPOSED`, `GAMIFICATION_PROPOSAL_REVIEWED` y `GAMIFICATION_SCOPE_VIEWED`.
- **Web:**
  - página nueva «Puntos de estudiantes» (`/teacher|director|admin/points`):
    - tabla por alcance, con búsqueda;
    - el docente propone desde la pestaña «Mis propuestas»;
    - Dirección tiene su bandeja.
  - «Retos y recompensas» sale del menú; su ruta antigua redirige y se retiró `Recognitions.tsx`;
  - Aprobaciones de Dirección es una sola bandeja con «Pendientes — Actividades / Recursos / Gamificación»;
  - Dirección tiene «Criterios de puntos»;
  - la página de criterios gana «Extras de temporada» con fechas;
  - el formulario de actividad elige un criterio en lugar de escribir puntos;
  - el estudiante ya no tiene la pestaña «Recompensas» y ve su saldo en el Perfil, con enlace al historial.

**Migraciones:**
- `V41GamificationCriteria`: aditiva. Los criterios existentes quedan sin vigencia y no son bonos.
- `pg_dump` previo en `pre-v41-b7.dump`. Probada `run → revert → run`.
- Las 70 reglas de actividad existentes ya tenían `criterion_id`, así que editarlas no pierde puntos.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs batch7` → **20/20**:
  - retos y recompensas devuelven 410;
  - puntos libres rechazados; criterios elegibles; los puntos vienen del criterio;
  - el extra exige vigencia; Dirección lo crea, el estudiante no;
  - el extra vigente suma una vez y no se repite al recalcular;
  - un proyecto solo declarado no se propone;
  - el estudiante no se premia; un docente fuera de alcance no propone; motivo y criterio válidos;
  - la propuesta queda pendiente y no se duplica;
  - la bandeja muestra proyecto, estudiante, respaldo y motivo; otro docente no la ve;
  - el docente no aprueba; rechazar exige motivo;
  - al aprobar entran los puntos del criterio; una decisión no se repite;
  - propuesta y decisión quedan auditadas;
  - puntos por alcance, sin acceso del estudiante, y la consulta queda auditada;
  - el saldo coincide con el historial.
- `node scripts/e2e-web.mjs` → **82/82**, incluidos WEB.46.1–46.5:
  - la ruta antigua lleva a «Puntos de estudiantes»;
  - el docente propone;
  - la bandeja de Dirección tiene la pestaña de gamificación;
  - el estudiante no tiene «Recompensas»;
  - sin errores de JavaScript.
- Unitarias: **130/130** (sin cambios en este batch).
- **Regresión completa (22 suites):** 2182 correctas, 1 fallo (V2.5.26). Tras corregirlo, `e2e-v2` 162/162. **2183 correctas, 0 fallos**.

**Fallo → causa → corrección → regresión:**
- **QA.59 → FAIL** en una corrida parcial. *Causa real:* la tabla de puntos tiene un tope de 200 filas, ordenadas por puntos, así que un estudiante con 0 puntos quedaba fuera cuando el alcance era grande. *Corrección:* filtro por nombre en la API y en la web (§9.5: detalle por estudiante con filtros), y un apellido único por corrida en la prueba. *Regresión:* PASS.
- **V2.5.26 → FAIL.** La prueba esperaba los 20 puntos escritos a mano. *Causa:* §9.2 prohíbe los puntos libres. *Corrección:* la prueba espera los puntos del criterio elegido. *Regresión:* PASS.
- **Pruebas antiguas actualizadas a la regla V4.1:**
  - QA.54–QA.67: retos y recompensas devuelven 410;
  - V2.5.4 y V2.5.13: la regla de la actividad usa `criterionId`;
  - V3.19.3, V3.19.4, B9.10, B9.11 y B9.15: el respaldo del propio proyecto ya no da puntos (§9.3: el estudiante no se da puntos; un docente propone y Dirección decide).
- **Error de arranque:** «Cannot access 'ProposeGamificationDto' before initialization». *Causa:* los DTO estaban declarados después del controlador. *Corrección:* se movieron arriba.

**Efecto:**
- **Backend:** criterios, ledger, propuestas y la tabla por alcance.
- **Frontend:** menú, puntos, aprobaciones, criterios, actividad, progreso y perfil.
- **Móvil:** si muestra «Recompensas», los canjes devolverán 410. Queda para el informe de impacto móvil del BATCH 12.

**Seguridad y permisos:**
- el estudiante no crea criterios (403) ni ve la tabla (403);
- el docente no aprueba (403) ni propone fuera de su alcance (404);
- toda propuesta, decisión y consulta de puntos de otros queda auditada.

**Pendientes:**
- «Recursos» sigue sin dar puntos: no existe un hito externo verificable. Es la alternativa de menor alcance que el §9.3 permite.
- Las insignias históricas se conservan y no se crean nuevas.

**Riesgos:**
- Antes, un proyecto propio con respaldo daba puntos automáticamente; ahora solo los da una propuesta aprobada.
- Los puntos ya otorgados no se retiraron.

**Commit propuesto:** `feat(v4.1-batch-7): puntos por criterios configurados, extras de temporada, propuestas docentes con decisión de Dirección y sin retos ni recompensas`

---

## BATCH V4.1-8 — Credenciales externas: estado de validación aparte del respaldo

**Hallazgos:** A41-018 (§6.1–§6.4, A.8; B29, B30, B31, B32, 23.9).

**Archivos modificados:**
- **`shared/src/enums/validation.enum.ts`:**
  - `CredentialValidationStatus` (PENDING · AUTO_VERIFIED · MANUAL_REVIEW_REQUIRED · MANUALLY_VERIFIED · INCONCLUSIVE · REJECTED) con sus etiquetas en español;
  - `ManualReviewMethod` y `INDEPENDENT_REVIEW_METHODS`;
  - `ManualReviewStatus` gana `inconclusive` y `rejected`.
- **`credential-check.rules.ts`** (reglas puras):
  - `pageRecipientName` lee el titular solo si la página lo declara con una etiqueta («issued to», «otorgado a»…). Un titular oculto no cuenta como otro titular;
  - `decideCredentialCheck` devuelve MISMATCH si la fuente oficial nombra a otra persona (B30);
  - `deriveCredentialValidationStatus` calcula el estado de validación a partir de lo ya registrado: indisponibilidad no es falsedad, y una revisión que solo miró el documento no verifica;
  - `PROVIDER_ADAPTERS` y `providerSupportFor` declaran Credly/IBM, Cisco y Huawei **no integrados**, con el motivo.
- **`validation.service.ts`:**
  - `VALIDATOR_VERSION = 3`;
  - nueva contradicción `official_holder_mismatch`;
  - la revisión manual tiene tres decisiones:
    - verificada: exige un método con prueba externa independiente y la prueba, que no puede ser la URL del propio certificado;
    - inconclusa: el respaldo no sube de SUPPORTED;
    - rechazada: queda FLAGGED.
  - La auditoría guarda decisión, motivo, método, prueba, rol de quien decide, respaldo y estado de validación.
- **`validation.controller.ts`:**
  - el veredicto incluye `validationStatus` (estado y etiqueta), `providerSupport`, y el método y la prueba de la revisión;
  - Administración puede revisar como soporte excepcional auditado.
- **`manual-review.dto.ts`:** `decision`, `method` y `proof`; la antigua `not_corroborated` se registra como inconclusa.
- **Entidad `ValidationRecord`:** `manualReviewMethod` y `manualReviewProof`.
- **Web:**
  - «Revisión de credenciales»: método, prueba externa y tres botones; «Verificada» queda deshabilitado si solo se revisó el documento;
  - entrada para Administración;
  - Evidencias del estudiante muestra el estado de validación aparte de «Respaldo: …», la nota del proveedor y el motivo de un rechazo.

**Migraciones:**
- `V41CredentialValidation`: aditiva. Agrega los dos valores al enum y las dos columnas.
- `down` quita las columnas. PostgreSQL no permite quitar valores de un enum, así que se conservan (sin filas, no cambian nada).
- `pg_dump` previo en `pre-v41-b8.dump`. Probada `run → revert → run`.
- Las 38 corroboraciones manuales anteriores (datos de prueba) no se tocaron.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs batch8` → **12/12**, contra un verificador oficial simulado:
  - fuente oficial con titular y código: AUTO_VERIFIED y CORROBORATED;
  - B29: el enlace abre el curso general, así que no es AUTO_VERIFIED;
  - B30 y 23.9: otro titular da REJECTED y FLAGGED, y la credencial no se borra;
  - B31: proveedor caído da INCONCLUSIVE; una página que necesita JavaScript queda para revisión;
  - §6.3: Huawei no se da por integrado;
  - SSRF: una URL a la red interna se bloquea;
  - B32: «parece genuino» sin prueba da 400, sin prueba 400, y la misma URL del certificado 400; la revisión inconclusa se registra;
  - verificada con prueba externa: MANUALLY_VERIFIED;
  - rechazo documentado por Administración: REJECTED y FLAGGED; el docente recibe 403;
  - la auditoría guarda método, prueba y rol.
- `node scripts/e2e-web.mjs` → **85/85**, incluidos WEB.47.1–47.3.
- Unitarias: **139/139** (+9: titular nombrado, estado de validación y proveedores).
- **Regresión completa (22 suites):** **2198 correctas, 0 fallos**.

**Fallo → causa → corrección → regresión:**
- **Prueba unitaria «compara la página oficial» → FAIL.** *Causa:* `comparePage` ahora devuelve `otherHolder`. *Corrección:* la prueba espera el campo nuevo. *Regresión:* PASS.
- **Pruebas antiguas actualizadas a la regla V4.1:**
  - V3.9.3: la página oficial de otra persona ahora contradice (B30), ya no queda «sin prueba»;
  - V3.9.24: Administración entra como excepción;
  - V3.9.28 y la corroboración de `e2e-v3` en la línea 1513: verificar exige método y prueba externa (B32).

**Efecto:**
- **Backend:** validación de credenciales.
- **Frontend:** revisión de credenciales y Evidencias.
- **Móvil:** recibe `validationStatus` en el veredicto; mostrarlo queda para el BATCH 12.

**Seguridad y permisos:**
- el docente y el estudiante no revisan (403);
- Administración sí, y queda auditado con su rol;
- la protección SSRF (red interna, IP privadas) no cambió y se volvió a probar;
- no se registran secretos.

**Pendientes (BLOCKED):** los verificadores reales de Credly/IBM, Cisco NetAcad y Huawei. No se pudo comprobar con un caso legítimo su acceso, licencia, ausencia de CAPTCHA ni que muestren al titular. Quedan declarados «sin verificador integrado» y las credenciales pasan por el verificador genérico o la revisión manual. No se automatiza ningún CAPTCHA.

**Riesgos:** los registros validados con la versión 2 conservan su veredicto hasta que Administración los reprocese (`POST /validation/reprocess-outdated`). Hasta entonces no se puede pedir para ellos la revisión excepcional.

**Commit propuesto:** `feat(v4.1-batch-8): estado de validación de credenciales aparte del respaldo, revisión con prueba externa y proveedores declarados sin integrar`

---

## BATCH V4.1-9 — Proyectos: borrador, edición y readiness

**Hallazgos:** A41-019 (§10.1–§10.3; B33, 23.2).

**Reproducción (§10.1):**
- La API ya permitía editar el título y el repositorio, pero la **web no tenía forma de editar un proyecto**: solo crearlo y cambiar su visibilidad. Ese es el «al volver no se podía editar».
- *Defecto confirmado:* readiness pedía una tecnología **en total**, no una por cada área alegada.

**Archivos modificados:**
- **`project-readiness.rules.ts`:** nuevo requisito `skill_per_area`. Su mensaje nombra las áreas sin tecnología («falta en Redes»). Solo bloquea al activar: el borrador sigue guardándose incompleto.
- **`projects.service.ts`:**
  - `readinessOf` calcula qué áreas no tienen tecnología, según el área de contexto de cada una o, si no hay, su área principal;
  - en un ACTIVE, una edición no puede dejar un área sin tecnología (`PROJECT_ACTIVE_REQUIREMENT`);
  - si un ACTIVE quita una tecnología que un integrante confirmó como suya, ese integrante vuelve a confirmar su contribución: se le avisa, queda en la bitácora y se recalcula su afinidad. El proyecto **sigue activo**, sin downgrade destructivo.
- **Web `Projects.tsx`:**
  - botón «Editar proyecto» en cada tarjeta del dueño;
  - el mismo formulario edita título, descripción, áreas, tecnologías con su contexto, repositorio, demo y visibilidad;
  - en un ACTIVE, un aviso explica qué se revalida y qué lo bloquea.

**Migraciones:** ninguna.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs batch9` → **13/13**:
  - B33: un borrador sin repositorio se guarda; título, descripción y repositorio se editan;
  - publicar queda bloqueado con una lista explicable;
  - con dos áreas y tecnología de una sola, la lista nombra la otra; el borrador se sigue guardando; con una tecnología por área, se cumple;
  - activar no lo vuelve CORROBORATED;
  - el activo se edita; no puede quedar un área sin tecnología;
  - quitar una tecnología confirmada pide reconfirmar, queda en la bitácora y el proyecto sigue activo;
  - cambiar el repositorio lo vuelve a comprobar;
  - un integrante no edita el proyecto del responsable.
- `node scripts/e2e-web.mjs` → **87/87**, incluido WEB.48.1: el dueño edita título y repositorio desde la tarjeta.
- Unitarias: **140/140** (+1: una tecnología por área).
- **Regresión completa (22 suites):** 2104 correctas, 17 fallos. Tras las correcciones: `e2e-objective-5` 116/116, `e2e-batch-5` 50/50 y `e2e-v3-2` 206/206. **2213 correctas, 0 fallos**.

**Fallo → causa → corrección → regresión:**
- **13.11–13.13 (`e2e-objective-5`), B5.17b, B5.18 y B5.23 (`e2e-batch-5`), V32.15.2 (`e2e-v3-2`) → FAIL.** *Causa:* esos proyectos alegaban un área sin ninguna tecnología usada en ella. *Corrección:* las pruebas cumplen la regla:
  - el área nueva llega con una tecnología suya;
  - el proyecto queda en el área de su tecnología, y el desglose se consulta en esa área;
  - el proyecto multiárea alega solo el área de contexto. V32.15.3 sigue probando que no suma en el área principal.
  *Regresión:* PASS.
- El fixture `crearProyectoActivo` elige una tecnología por cada área.
- **`e2e-v3-2`, 401 en cadena (batch 6 en adelante, en la corrida completa).** *Causa probable:* la sesión de Administración caducó a mitad de la suite. No se reprodujo: al repetirla, 206/206.

**Efecto:**
- **Backend:** readiness y edición de un activo.
- **Frontend:** edición de proyectos.
- **Móvil:** sin cambios. La lista de readiness llega con el código nuevo y su mensaje ya legible.

**Seguridad y permisos:** solo el dueño edita (403 al integrante); la reconfirmación la hace cada integrante.

**Pendientes:** el respaldo que da CORROBORATED solo por cumplir readiness (A41-021) se corrige en el V4.1-10.

**Riesgos:** los proyectos activos que ya alegan un área sin tecnología siguen activos: la regla actúa al activar o al editar. Se informan en el recálculo del V4.1-10.

**Commit propuesto:** `feat(v4.1-batch-9): editar proyectos desde la web, una tecnología por área para activar y reconfirmación al quitar tecnologías confirmadas`

---

## BATCH V4.1-10 — GitHub con procedencia y respaldo honesto (recálculo auditado)

**Hallazgos:** A41-020, A41-021 (§11.1–§11.5, §12; B34, B35, 23.6, 23.7).

**Defecto confirmado (A41-021):**
- `decideProjectBacking` contaba **cualquier evidencia** como «señal independiente».
- Activar ya exige una evidencia, así que readiness ≈ CORROBORATED.
- Un segundo estudiante con el **mismo repositorio** también quedaba CORROBORATED.

**Archivos modificados:**
- **`project-backing.rules.ts`:**
  - CORROBORATED exige señal técnica (lenguaje o manifiesto del mismo repositorio, que cuentan como **una** fuente), más una fuente independiente de otro tipo (demo accesible u otra persona que confirmó su contribución), más atribución no disputada;
  - la captura apoya (SUPPORTED), pero no es independiente.
- **`project-backing.service.ts`:**
  - `computar` separa el cálculo del guardado;
  - `atribucionDisputada` detecta el mismo repositorio normalizado en el proyecto de otra persona que no integra este (B35);
  - nuevas razones legibles («no son una fuente independiente», «el mismo repositorio figura en el proyecto de otra persona»);
  - `recalculateAll(apply)` devuelve el informe antes / después.
- **`projects-admin.controller.ts` (nuevo):**
  - `POST /project-backing/recalculate`: sin `apply` solo informa; queda auditado (`PROJECT_BACKING_RECALCULATED`);
  - `GET /skill-requests` y `POST /skill-requests/:id/decision`: Administración vincula la tecnología del catálogo, o rechaza con motivo.
- **`projects.service.ts`:**
  - `suggestions`: las señales DETECTED se cotejan con el catálogo por nombre o alias **exactos**, con su porqué («requirements.txt», «lenguaje del repositorio») y sus áreas, principal y secundarias;
  - `acceptSuggestion`: el estudiante elige el área y queda **su** afirmación, con `provenance` («sugerida: …»). El respaldo lo decide la regla, no el clic;
  - `dismissSuggestion`;
  - `requestSkill`: «Tecnología no catalogada». Avisa a Administración y queda auditado (`SKILL_REQUESTED`). No se crea nada solo;
  - las URL de GitHub con `/tree/rama`, `/blob`, `.git` o barra final se guardan como la raíz del repositorio.
- **`repository-inspector.service.ts`:** diagnóstico honesto:
  - un 404 «puede no existir, haber cambiado de nombre o ser privado; no se concluye cuál»;
  - un 403 o 429 es límite de consultas o acceso denegado;
  - un tiempo agotado o un error de red: no se concluye nada.
- **Entidades y migración:** `project_skills.provenance`, `projects.dismissed_suggestions` y la tabla `skill_requests`.
- **Web:**
  - «Validación técnica» muestra las sugerencias con su porqué, «La usé» con la elección de área, «Descartar», «Tecnología no catalogada → Pedir que la evalúen» y el diagnóstico del repositorio;
  - las etiquetas dicen «Señal detectada…», no «Corroborada»;
  - página nueva de Administración «Pedidos de tecnologías».

**Migraciones:**
- `V41GithubProvenance`: aditiva.
- `pg_dump` previo en `pre-v41-b10.dump`. Probada `run → revert → run`.

**Recálculo auditado (§12) — informe antes / después:**
- 3541 proyectos, 535 cambiaron. Primero se ejecutó en seco (`b10-dryrun.json`), luego se aplicó (`b10-apply.json`); una segunda pasada en seco da 0 pendientes.

| Nivel | Antes | Después |
|---|---|---|
| declared | 1743 | 2053 |
| supported | 1056 | 1041 |
| corroborated | 229 | **44** |
| reviewed | 298 | 251 |
| flagged | 215 | 152 |

- **Transiciones:**
  - **corroborated → supported: 185.** Es la corrección de A41-021: tenían solo capturas, o un repositorio compartido.
  - **supported → declared: 240, reviewed → declared: 47, flagged → declared: 23 y flagged → supported: 40.** Son niveles **anteriores** que nunca se habían recalculado con la regla V3 vigente: «sin repositorio comprobado, DECLARED»; y una marca que ya no tiene contradicción.
- Son datos de prueba. Los proyectos afectados pidieron el recálculo de la afinidad de sus integrantes.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs batch10` → **11/11**:
  - B34: FastAPI aparece como sugerencia con su procedencia; aceptarla da área y procedencia, sin CORROBORATED; lo descartado no vuelve;
  - la tecnología no catalogada se pide una vez y no se crea sola; Administración decide; rechazar exige motivo;
  - 23.7: con captura queda SUPPORTED, con su razón; con otra persona que confirma, CORROBORATED;
  - `/tree/main` se guarda como la raíz;
  - B35 y 23.6: el repositorio ajeno queda SUPPORTED, con su razón;
  - el diagnóstico de 404 y 403 no concluye «privado»;
  - el informe de recálculo es solo para Administración.
- `node scripts/e2e-web.mjs` → **89/89**, incluido WEB.49.1: el panel de sugerencias, con procedencia y «La usé».
- Unitarias: **141/141** (+1: una captura no es independiente; repo ajeno).
- **Regresión completa (22 suites):** 2212 correctas, 14 fallos. Tras las correcciones: `e2e-objective-6` 85, `e2e-batch-6` 53, `e2e-v3` 379, `e2e-v3-2` 206 y `e2e-web` 89. **2226 correctas, 0 fallos**.

**Fallo → causa → corrección → regresión:**
- **17.9b–17.12 (`e2e-objective-6`), B6.25b–B6.31b (`e2e-batch-6`), V3.13.5, V3.14.4, V3.14.5, V3.18.0 (`e2e-v3`), V32.15.2 (`e2e-v3-2`) → FAIL.** *Causa:* esperaban CORROBORATED con una captura como segunda señal; el contrato (§12) lo prohíbe. *Corrección:*
  - las pruebas agregan una fuente independiente real: una demo accesible (servida localmente por el origen de prueba) o un compañero que confirma su contribución;
  - V3.13.5 ahora verifica que con una captura queda SUPPORTED y lo explica.
  *Regresión:* PASS.
- **Mismo grupo (segunda causa):** el helper `repoQueCorrobora(nombre)` daba **la misma URL** a todos los estudiantes, así que la nueva regla B35 los veía como repositorio ajeno, tal como debe. *Corrección:* cada llamada da una URL única («lenguaje-react--…»); el GitHub simulado lee el lenguaje antes de «--». *Regresión:* PASS.
- **WEB.49.1 → FAIL.** *Causa:* `e2e-web` no levantaba el GitHub simulado. *Corrección:* lo levanta. *Regresión:* PASS.

**Efecto:**
- **Backend:** respaldo, GitHub y catálogo.
- **Frontend:** validación técnica y pedidos de Administración.
- **Móvil:** lee `backingTier` y razones sin cambios. Las sugerencias son solo web por ahora; queda anotado para el BATCH 12.
- **Afinidad:** la fórmula no cambió; cambian sus entradas, porque hay menos CORROBORATED.

**Seguridad y permisos:**
- sugerencias: dueño o integrante; aceptar o descartar: solo el dueño;
- pedidos y recálculo: solo Administración (403 al estudiante);
- todo queda auditado.

**Pendientes:**
- OAuth de GitHub y atribución por commits (§11.5) no se implementan: es opcional, no se improvisa su alcance. La atribución se apoya en la confirmación individual y en la regla del repositorio compartido.

**Riesgos:**
- Hay menos proyectos CORROBORATED (de 229 a 44 en estos datos). Es el comportamiento que pide el contrato, y queda el informe.

**Commit propuesto:** `feat(v4.1-batch-10): sugerencias de GitHub con procedencia, tecnologías no catalogadas a Administración y CORROBORATED solo con fuente independiente y atribución, con recálculo auditado`

---

## BATCH V4.1-11 — Equipos y confirmaciones

**Hallazgos:** A41-022, A41-023 (§13; B36, B37, 23.8).

**Antes:**
- Elegir un equipo invitaba automáticamente a **todos** sus miembros; no se podía dejar a alguien fuera de ese proyecto.
- El equipo se elegía con un `<select>` sin búsqueda.
- Retirar a un integrante no pedía motivo ni dejaba historial.

**Archivos modificados:**
- **`create-project.dto.ts`:** `excludedTeamMembers: [{ profileId, reason }]`. El motivo tiene al menos 10 caracteres.
- **`project-members.service.ts`:**
  - `inviteTeam` precarga a los miembros como **candidatos** y salta a los excluidos, que deben ser de ese equipo;
  - `registrarExclusion` deja en la bitácora quién excluyó, a quién, por qué, de qué equipo, y que el equipo no cambia;
  - avisa al excluido de forma respetuosa: su lugar en el equipo no cambia, y el motivo no se le envía como acusación. El aviso no se duplica;
  - `removeMember`: si el integrante viene del equipo, excluirlo exige motivo (`PROJECT_EXCLUSION_REASON_REQUIRED`). Nunca toca la membresía del equipo.
- **`projects.controller.ts`:** el alta pasa los excluidos; `DELETE …/members/:memberId` acepta `{ reason }`.
- **Web:**
  - `Projects.tsx`: el equipo se elige con búsqueda (combobox); sus miembros aparecen como candidatos con una casilla; quitar a uno pide su motivo, que viaja con el alta;
  - `ProjectContribution.tsx`: «Excluir del proyecto», con motivo, para el responsable.

**Migraciones:** ninguna. El motivo vive en los metadatos del evento de la bitácora, que ya existían.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs batch11` → **11/11**:
  - 23.8: excluir exige motivo y solo se excluye a gente del equipo;
  - de 4, se invita a los 2 que quedan; el excluido sigue en el equipo;
  - el historial guarda quién, a quién y por qué;
  - el aviso es respetuoso y no expone el motivo;
  - B37: el creador no confirma por los demás; si uno discrepa, se bloquea (no se vota);
  - B36: excluir después exige motivo y no saca del equipo;
  - con la exclusión justificada, se activa;
  - B40: un integrante no excluye a otros.
- `node scripts/e2e-web.mjs` → **91/91**, incluido WEB.50.1: combobox con búsqueda, candidatos y motivo al quitar.
- **Regresión completa (22 suites):** **2239 correctas, 0 fallos** a la primera.

**Fallo → causa → corrección → regresión:**
- **WEB.50.1, durante su escritura (no en la regresión):**
  - claves con números en el apellido del fixture (la API las rechaza);
  - la búsqueda se escribía antes de que la página terminara de cargar.
  *Corrección:* claves solo con letras y una espera a la carga. *Regresión:* PASS.

**Efecto:**
- **Backend:** invitaciones de equipo y exclusiones.
- **Frontend:** alta de proyecto y contribuciones.
- **Móvil:** `DELETE …/members/:id` pide ahora un motivo si el integrante viene de un equipo; queda anotado en `docs/V4_1_IMPACTO_MOVIL.md`.

**Seguridad y permisos:**
- solo el responsable excluye (403 o 404 al integrante);
- la exclusión no toca el equipo;
- el aviso no comparte datos privados.

**Pendientes:** ninguno.

**Riesgos:** ninguno nuevo.

**Commit propuesto:** `feat(v4.1-batch-11): equipo con búsqueda y candidatos, excluir del proyecto con motivo sin tocar el equipo y confirmación individual`

---

## BATCH V4.1-12 — Privacidad, vistas de evidencias, QR en Mi perfil e impacto móvil

**Hallazgos:** A41-024, A41-025, A41-026 (§14, §15, §16), más el informe de impacto móvil.

**Defecto encontrado y corregido (§14):** el perfil público listaba los proyectos con visibilidad «perfil» **aunque siguieran en borrador**. El contrato exige que un borrador nunca se publique por haber elegido antes su visibilidad.

**Archivos modificados:**
- **API, `public-profile.service.ts`:** el perfil público y su QR solo muestran proyectos con visibilidad «perfil» que **no** sean borradores. El enlace público ya excluía los borradores; se volvió a probar.
- **Web, `services/types.ts`:**
  - nombres claros de las cinco visibilidades reales («Solo yo y los integrantes», «Además, mi equipo», «Docentes autorizados», «En mi perfil», «Público por enlace (sin iniciar sesión)»);
  - `PROJECT_VISIBILITY_HELP`, con lo que significa cada una;
  - una nota común: la visibilidad es del registro en Afinia, no del repositorio de GitHub; y un borrador nunca se publica.
- **Web, `Projects.tsx`:** la ayuda aparece bajo cada selector de visibilidad.
- **Web, `Evidences.tsx` (§15):** tres pestañas sobre los mismos datos, sin duplicar nada:
  - «Evidencias de proyectos»;
  - «Credenciales externas»: «Registrar credencial histórica o acreditar una oportunidad externa finalizada» y «Mis credenciales y su validación»;
  - «Constancias y certificados institucionales recibidos».
  Se aclara que las constancias internas llegan solas.
- **Web, `Profile.tsx` y `Collaboration.tsx` (§16):**
  - el enlace y el QR viven en **Mi perfil → Visibilidad**, junto a lo que decide qué se ve;
  - Colaboración conserva el mismo componente como **acceso rápido**, sin una segunda fuente de verdad, y aclara que compartir el QR no agrega contactos.
- **Web, `navigation.ts`:** nueva sección «Colaboración» con «Contactos» y «Equipos»; «Credenciales y constancias» pasa a llamarse «Evidencias y credenciales».
- **Móvil:**
  - se cambió «para canjear» por «saldo de puntos» (`ProgressScreen`);
  - en la Biblioteca se corrigió el texto «Guardar orienta tus recomendaciones», que desde el V4.1-6 sería falso.
- **Docs:** `docs/V4_1_IMPACTO_MOVIL.md`, con el impacto de cada batch en la app móvil y la prioridad sugerida.

**Migraciones:** ninguna.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs batch12` → **5/5**:
  - un borrador no aparece en el perfil público aunque tenga visibilidad «perfil»;
  - un activo con «perfil» sí aparece, y uno privado no;
  - «Público por enlace» se abre sin sesión cuando está activo; un borrador, no;
  - el resumen público no expone correo, código ni identificadores internos;
  - B40: sin sesión, 401; un ajeno no abre un proyecto privado.
- `node scripts/e2e-web.mjs` → **95/95**, incluidos:
  - WEB.51.1: las tres pestañas;
  - WEB.51.2: el QR en Mi perfil, el acceso rápido y la sección «Colaboración»;
  - WEB.51.3: la ayuda de visibilidad.
- `npx tsc --noEmit` en `mobile/`: sin errores.
- **Regresión completa (22 suites):** **2248 correctas, 0 fallos** a la primera.

**Fallo → causa → corrección → regresión:**
- **WEB.51.2, durante su escritura:** el enlace del acceso rápido se contaba antes de que la página terminara de cargar. *Corrección:* se espera al elemento. *Regresión:* PASS.

**Efecto:**
- **Backend:** perfil público.
- **Frontend:** proyectos, evidencias, perfil, colaboración y menú.
- **Móvil:** dos textos corregidos, más el informe.

**Seguridad y permisos:**
- el borrador ya no se filtra por el perfil público;
- el QR solo lleva el enlace público, sin datos privados.

**Pendientes:** las mejoras móviles del informe; no bloquean, porque la API ya protege.

**Riesgos:** ninguno nuevo.

**Commit propuesto:** `feat(v4.1-batch-12): un borrador nunca se publica, visibilidad con nombres claros, evidencias en pestañas, QR en Mi perfil e informe de impacto móvil`

---

## BATCH V4.1-13 — Afinidad, trayectoria y currículo

**Hallazgos:** A41-027, A41-028, A41-029 (§17.1–§17.4; B38).

**Diagnóstico:**
- La **fórmula** de afinidad (motor V5) y las **reglas de elegibilidad** del currículo (`cv-eligibility.rules.ts`) ya cumplían el contrato. No se tocaron, como pide el batch.
- Heredaban el defecto A41-021 (proyectos CORROBORATED de más), corregido en el V4.1-10 con su recálculo auditado.
- **Defecto propio:** el paso 2 del currículo marcaba por omisión **todos** los ítems elegibles. §17.4: «No incluir automáticamente TODAS las experiencias».

**Archivos modificados:**
- **Web `Progress.tsx`:** el paso 2 lista lo elegible **sin marcar nada**, y lo dice: «nada entra solo: marca los que quieres incluir». La API conserva su contrato: sin lista explícita, devuelve todo lo elegible para quien lo pida a propósito (V3.18.24).

**Migraciones:** ninguna. No hicieron falta.

**Verificación del checklist A41-027:**
- saldo en el Perfil con enlace al historial (V4.1-7);
- historial de puntos idempotente y reversos auditables en el ledger (V4.1-4 y V4.1-7);
- la trayectoria no mezcla puntos con respaldo.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs batch13` → **4/4**:
  - un proyecto SUPPORTED (solo con captura) no se ofrece al currículo;
  - pedirlo por id se rechaza (`CV_ITEM_NOT_ELIGIBLE`);
  - ni ese proyecto ni un interés declarado suman afinidad;
  - la trayectoria muestra su nivel real («Con respaldo»), no es elegible y no mezcla puntos.
- `node scripts/e2e-web.mjs` → **97/97**, incluido WEB.52.1: ningún ítem del paso 2 viene marcado.
- B38 ya lo cubría V3.18.10–V3.18.24, que siguen en verde: selección por sección e ítem, orden, constancia sin duplicar, rechazo de lo no elegible o ajeno.
- **Regresión completa (22 suites):** **2254 correctas, 0 fallos** a la primera.

**Fallo → causa → corrección → regresión:** ninguno.

**Efecto:**
- **Frontend:** el currículo.
- **Backend:** sin cambios.
- **Móvil:** sin cambios (el currículo se arma en la web).

**Seguridad y permisos:** sin cambios; la trayectoria sigue siendo solo del estudiante (V3.18.9).

**Pendientes:** la sección «Evidencias» del currículo solo existe en la API anterior; no se ofrece en el paso 1 de la web.

**Riesgos:** ninguno.

**Commit propuesto:** `feat(v4.1-batch-13): el currículo no marca nada por omisión; afinidad y trayectoria verificadas sobre el respaldo honesto`

---

## BATCH V4.1-14 — QA integral, seguridad y documentación

**Hallazgos:** A41-030 (BATCH 14 del contrato).

**Ejecutado:**
- **Compilación:**
  - `tsc --noEmit` de shared, API, web y **móvil (Expo)**: sin errores;
  - `build:e2e` de la API y `vite build` de la web: OK.
- **Unitarias:** **141/141**.
- **Regresión completa (22 suites, API real y Postgres):** **2254 comprobaciones correctas, 0 fallos** (18/10/2026).
- **Migraciones:** las 7 de V4.1 son aditivas, con `up` y `down`, `pg_dump` previo y `run → revert → run` (tabla en `docs/V4_1_QA.md`). El único recálculo de datos (respaldo de proyectos) quedó auditado, con su informe.
- **Rama:** `main` es ancestro de `feature/afinia-v4-1-cierre`, así que la fusión sería fast-forward, sin conflictos. **No se tocó `main` ni se hizo push.**
- **Configuración:** V4.1 no agregó variables de entorno (se revisaron los commits de V4.1); `.env.example` sigue vigente.
- **Seguridad:** rutas negativas (401, 403 y 404), SSRF, subidas protegidas, privacidad del perfil público y del enlace, auditoría de cada decisión nueva, correo en `console` durante las pruebas y GitHub sin conclusiones falsas. El detalle, en `docs/V4_1_QA.md` §4.

**Documentación nueva:**
- `docs/V4_1_QA.md`: QA integral.
- `docs/MATRIZ_TRAZABILIDAD_V4_1.md`: A41-001 a A41-030, cada uno con su batch, su código, sus pruebas y su estado.
- `docs/CAMBIOS_DOCUMENTO_GRADO_V4_1.md`: qué ajustar en los capítulos II a IV de la tesis. El `.docx` **no** se modificó: su SHA-256 sigue empezando por `bf5c0fb860e97e5b`, igual que el respaldo.
- `README.md`: el cierre V4.1, la última corrida y los documentos nuevos.
- Ya existentes de este cierre: `docs/V4_1_REPORTE_BATCHES.md` y `docs/V4_1_IMPACTO_MOVIL.md`.

**UI obsoleta retirada en el cierre:**
- «Retos y recompensas» y la pestaña «Recompensas»;
- los puntos libres de la actividad;
- la opción «credencial externa esperada»;
- la preselección total del currículo.

**Pendientes declarados (no bloquean):**
- **BLOCKED:** verificadores de Credly/IBM, Cisco y Huawei (§6.3). No se pudieron comprobar con un caso legítimo; quedan declarados «sin verificador integrado».
- OAuth de GitHub y atribución por commits (§11.5): es opcional.
- Las mejoras móviles de `docs/V4_1_IMPACTO_MOVIL.md`.
- La gamificación de recursos sigue desactivada hasta que exista un hito verificable (§9.3).

**Commit propuesto:** `docs(v4.1-batch-14): QA integral, matriz de trazabilidad A41, cambios para el documento de grado y README del cierre V4.1`
