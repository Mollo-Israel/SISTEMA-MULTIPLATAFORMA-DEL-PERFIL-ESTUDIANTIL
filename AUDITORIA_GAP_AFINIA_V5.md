# Auditoría de brechas — Afinia V5 (BATCH V5-0)

**Contrato:** `AFINIA_CONTRATO_UNICO_V5_CORRECCIONES_CLAUDE_CODE_2026-10-26.md`
**Fecha de la auditoría:** 27/10/2026
**Alcance de este batch:** solo auditoría. **No se cambió código funcional** (§0.2, §23).

---

## 1. Estado Git y base elegida (§0.1)

| Dato | Valor |
|---|---|
| Rama al empezar | `feature/pruebas-calidad` (`153cc3b`), sincronizada con `origin/feature/pruebas-calidad` |
| Cambios rastreados sin guardar | **Ninguno**. |
| Archivos sin seguimiento | Solo tres, todos del usuario: el contrato V5, `scripts/demo-60.ps1` y `scripts/demo-objetivo-6.mjs`. Se conservan; los dos scripts nunca se commitean. |
| Relación entre ramas | `git rev-list` confirma que **todas** las ramas locales y remotas del producto están contenidas en `feature/pruebas-calidad`. |
| `origin/main` | Tiene 1 commit ajeno a la línea del producto: `28ce3ca backups` (01/06/2026, otro integrante: un `.sql` y un `.bundle`). No contiene V2–V4.1. |
| `origin/qa/capitulo-iii-pruebas` | Tiene 2 commits de otro integrante (28/09/2026): pruebas Jest y evidencia del Capítulo III sobre una base vieja. No contiene V3.2–V4.1. |
| **Base verificada** | `feature/pruebas-calidad` (`153cc3b`) = V4.1 completa (`80447c6`) + la corrección de rendimiento y la batería de pruebas de calidad. |
| **Rama de trabajo creada** | `feature/afinia-v5-cierre`, local y sin push, desde `153cc3b`. No existía antes. |

Las ramas base (`feature/afinia-v4-1-cierre`, `feature/pruebas-calidad`, `main`) quedan intactas.

## 2. Método y evidencia

- **Lectura del código**, con ruta y línea de cada causa.
- **Sondas reales contra la API** en el **entorno de pruebas aislado**:
  - base `afinia_test`, reconstruida para esta auditoría; API en `:3020`; correo por consola;
  - cada actor entra con su propia cuenta sembrada;
  - scripts `sonda-v5.mjs` y `sonda-v5b.mjs`, en el scratchpad de la sesión;
  - los datos de sonda llevan el prefijo «V5 Sonda» y viven solo en `afinia_test`. **La base de desarrollo no se modificó.**
- **Conteos de solo lectura** en la base de desarrollo (`perfil_estudiantil`), para medir el riesgo de cada migración (§4 de este documento).
- **Línea base de pruebas sobre el mismo commit** (`153cc3b`, 21/10/2026), con evidencia en `pruebas/INFORME.md`:

| Batería | Resultado |
|---|---|
| Suites propias del proyecto (22) | 2254 ok · 0 fallos |
| Jest + SuperTest | 30/30 |
| Playwright | 39/39 en Chromium, Firefox y WebKit |
| Newman | 24 peticiones · 49/49 aserciones |

Es la línea contra la que se medirán las regresiones de cada batch.

Estados de §0.2: `PRESERVE_PASS`, `IMPLEMENTED_UNTESTED`, `DEFECT_CONFIRMED`, `PARTIAL`, `MISSING`, `REGRESSION`, `OBSOLETE`, `NEEDS_DECISION`, `BLOCKED_EXTERNAL`.

---

## 3. Hallazgos V5-01 … V5-31

### 3.1 Actividades: vista docente, filtros y trazabilidad

| Ref. | Estado | Evidencia | Causa / qué falta |
|---|---|---|---|
| **V5-01** Docente → Actividades de la carrera | **PARTIAL** | `web/src/pages/teacher/Activities.tsx:23` llama a `activityService.list()` y pinta una **lista de texto** (`:131-180`). No tiene tarjetas con imagen, detalle, paginación ni favoritos. Bien: no ofrece «Me interesa» ni inscripción. | La vista descarga **todas** las actividades sin paginar. Con 10 272 actividades en desarrollo es el mismo listado que las pruebas de k6 midieron en ≈4 s y 27 MB (`pruebas/05-k6/DIAGNOSTICO.md`). Hay que reutilizar `ActivityCard`/`ActivityDetail` (`components/ActivityCard.tsx`) con la paginación del servidor (`activityService.page`). **No existen favoritos de actividades**: en la base solo hay favoritos de la Biblioteca (`learning_resource_library`). |
| **V5-02** Filtro por responsable | **MISSING** | `api/src/activities/dto/query-activities.dto.ts` no tiene `responsibleId`. Ni la vista del estudiante ni la del docente lo ofrecen. | Falta el filtro en el backend, con la búsqueda de personas existente (`GET /activities/people`), y en las dos vistas. |
| **V5-03** Docente → fuentes de la afinidad | **MISSING** | `web/src/components/affinity.tsx:206-215`: cada contribución muestra `reason` y familia como **texto**. No hay enlace aunque exista `sourceId` / `sourceEntityType`. | Faltan enlaces a la entidad real (participación, proyecto, credencial) que respeten `TeacherScope`. **No** se enlaza a archivos privados por ruta pública (§16). |

### 3.2 Identidad y padrón

| Ref. | Estado | Evidencia | Causa / qué falta |
|---|---|---|---|
| **V5-04** Admin → Usuarios: apellidos | **MISSING** | `api/src/entities/user.entity.ts:34`: un solo campo `lastName`. Hay 103 usos en la API, 38 en la web, 5 en móvil y 221 en scripts. | Falta separar «primer apellido (obligatorio)» y «segundo apellido (opcional)». **En desarrollo, 784 de 18 848 usuarios** tienen un apellido con espacio: no se pueden partir automáticamente (A02). Plan: columnas nuevas **nullable** y `last_name` conservado como texto legado y de presentación. |
| **V5-05** Padrón CSV | **MISSING** | `imports.service.ts:32` y `teacher-import.service.ts:30` esperan la columna `last_name`. | Falta la plantilla nueva (`first_surname`, `second_surname`) **aceptando también la vieja** (`last_name`) sin desplazar columnas (A03). Preview, aplicación parcial e idempotencia: `PRESERVE` (suites `e2e-batch-*`, `e2e-v4-1`). |

### 3.3 Actividades: formulario, fechas, borradores y permisos

| Ref. | Estado | Evidencia | Causa / qué falta |
|---|---|---|---|
| **V5-06** Duplicar / borrar borrador | **PARTIAL** | Duplicar existe (`activities.service.ts:613`, V4.1 A41-010): la copia es un DRAFT nuevo creado con `create()`, sin inscripciones, puntos ni constancias. **Sonda B07:** `DELETE /activities/:id` sobre un DRAFT propio → **404** (la ruta no existe). | Falta «Borrar borrador»: solo un DRAFT propio, sin inscripciones, revisiones ni referencias; con modal y auditoría. Lo publicado **nunca** se borra: se cancela con motivo (ya existe). |
| **V5-07** Fecha «ahora» rechazada | **DEFECT_CONFIRMED** | **Sonda B04:** publicar con inicio = el minuto actual (18:33:00, a los 23 s de ese minuto) → **400 `ACTIVITY_START_IN_PAST`**. **Sonda B05:** hoy 08:00 → 400 (correcto, `PRESERVE`). | `activities.service.ts:572`: `eventDate.getTime() <= Date.now()` compara al milisegundo, y la interfaz trabaja al minuto. Corrección: comparar al minuto con una tolerancia acotada y configurable (1–2 min). **No** aceptar cualquier hora pasada del día (B8). |
| **V5-08** Responsables → semestres | **PARTIAL** | El backend valida la cobertura por la unión de alcances (`assertCobertura`, `:587`, V4.1) y la web repite el error (`ActivityManager.tsx:266`). | Falta la cascada visible: al elegir responsables, mostrar qué semestres cubre cada uno y avisar al quitar uno. No se amplía el `TeacherScope`. |
| **V5-09** Edición visible que luego falla | **DEFECT_CONFIRMED** | **Sonda B08b:** Admin publica una actividad con Carlos como responsable; Carlos intenta editar el título → **403 `ACTIVITY_RESPONSIBLE_OPERATION_ONLY`** (backend correcto, `PRESERVE`). Pero `ActivityManager.tsx:512`: `editable(a)` solo mira la revisión y **no** si el usuario creó la actividad, así que el botón «Editar» aparece (`:1480`). | La web debe ocultar «Editar contenido» a quien solo es responsable y dejarle las acciones operativas. **B08a `PRESERVE`:** el DRAFT de Admin ya no es visible para el docente asignado. |
| **V5-10** Interna ↔ externa contamina el formulario | **DEFECT_CONFIRMED** (código) | `ActivityManager.tsx:801-805`: pasar a Externa fija `outcomePolicy = 'external_credential_expected'`; volver a Interna **conserva** ese valor. La caja de proveedor se muestra con `originType === 'external' \|\| outcomePolicy === 'external_credential_expected'` (`:957`). El combo interno sigue ofreciendo «Credencial externa esperada» si ya estaba elegida (`:1265`). | Es la causa exacta de las págs. 16–24 del Word. Corrección: tres pestañas (Académicas / Extracurriculares / Externas), cada una con un formulario tipado y estado propio; sin selector de origen dentro del formulario; el origen se deriva de la pestaña y lo valida el backend. **Datos:** 115 actividades internas en desarrollo usan `external_credential_expected`; se conservan y se editan en su pestaña (§5.1). |
| **V5-11** Validación de externas | **DEFECT_CONFIRMED** | **Sondas:** externa *virtual sin enlace ni lugar* → **201 publicada**; la misma interna → 400 «Indica el enlace de la reunión». Híbrida interna → 400 con los dos campos (correcto). Lugar «1234» en externa → 400 (**`PRESERVE`**, V4.1). | `activities.service.ts:664`: las reglas de modalidad están dentro de `if (activity.originType !== ActivityOrigin.EXTERNAL)`. Hay **9 externas virtuales sin enlace** en desarrollo, que se conservan (la regla se aplica al publicar o editar). |

### 3.4 Inscripción, admisión, asistencia y constancias

| Ref. | Estado | Evidencia | Causa / qué falta |
|---|---|---|---|
| **V5-12** «Confirmar participación» mezcla admisión y asistencia | **DEFECT_CONFIRMED** (riesgo alto) | **C00–C01:** actividad abierta, cupo 1, `registrationMode=approval` → Ana y Camila se inscriben → las dos quedan `registered` (pendientes): no hay paso de admisión. **C02:** «aceptar» en una interna → 400 `ACCEPTANCE_ONLY_EXTERNAL`: la admisión no existe para internas. **C03:** el responsable registra `confirmed` («asistió») **48 h antes** de que ocurra el evento → **200**. **C05:** dos confirmaciones simultáneas con cupo 1 → **las dos 200** (2 de 1). | (1) `RegistrationStatus` es un solo eje: `registered` → `confirmed` sirve a la vez de «admitido» y de «asistió». (2) `registrationMode` **se guarda y no tiene ningún efecto** (solo aparece en `create`/`update`/`duplicate`) y la web no lo ofrece. (3) El cupo solo cuenta `confirmed` y `accepted`, así que la plaza se reserva cuando el estudiante «asiste». (4) `assertConfirmCapacity` (`:2250`) cuenta y después guarda **sin bloqueo**: es una condición de carrera. (5) Se puede marcar asistencia antes del evento. **Datos:** 868 inscripciones `registered` y 3941 `confirmed` en desarrollo; 1722 confirmadas con fecha de actualización anterior al inicio. Esto último puede venir de los datos sembrados, pero muestra que la regla no existe. |
| **V5-16** Constancias: ambigüedad acreditativa | **DEFECT_CONFIRMED** | **H02:** con `outcomePolicy=internal_constancy`, confirmar a Ana → en `afinia_test` aparece **1 constancia `authorized`** emitida en el acto (48 h antes del evento). | `activities.service.ts:260-305` (`sincronizarConstancia`, V3 §14.1): *«al confirmar la participación … el sistema la emite»*. La web lo anuncia: «**Al confirmar la participación, Afinia emite la constancia**» (`ActivityManager.tsx:93`). Contradice §1.2 y §7.2 («no emitir masivamente… no habilitar emisión de nuevos documentos oficiales por la aplicación»). **Datos:** 2497 actividades con esa política y 983 constancias emitidas por el sistema en desarrollo. **Se conservan** (§7.2, H03). **Bien:** la constancia aporta **0 a la afinidad** (`affinity.engine.ts:711`, `base: 0`), sin doble conteo (B2): `PRESERVE`. |
| **V5-31** «Currículum» | **PARTIAL** | El PDF ya lleva un aviso honesto (`TRAJECTORY_DISCLAIMER`: «No constituye historial académico oficial, certificación institucional ni acreditación profesional»), y la selección por ítem existe (V4.1 B13, `PRESERVE`). Pero el menú dice **«CV / Exportar»** (`navigation.ts:59`), la ayuda dice «Mi progreso y CV» y «descarga tu CV en PDF» (`help/content.ts:66`), y la vista previa se titula «Vista previa del CV» (`Progress.tsx:305`). | Reposicionar como «Resumen de trayectoria» o «Currículo estudiantil (borrador informativo)», con leyenda visible. **No** se elimina el generador (§1.1). |

### 3.5 Recursos

| Ref. | Estado | Evidencia | Causa / qué falta |
|---|---|---|---|
| **V5-13** Recurso por archivo | **MISSING** | `learning-resource.entity.ts:43`: `url varchar(500) NOT NULL`. **D03:** sin URL → 400 «El enlace…». No hay subida de archivo. | Falta «URL **o** archivo». Se reutiliza el puerto de almacenamiento existente (`storage/`: `local-storage.driver`, firma de archivo y lista de tipos permitidos) **sin** guardar binarios en PostgreSQL. Sin MP4 (§8.1). Requiere que `url` pase a nullable y un `file_id` nuevo. |
| **V5-14** «Curso externo» mezcla oportunidades | **PARTIAL** | `LearningResourceType.EXTERNAL_COURSE` (`learning-resource.enum.ts:25`). **140 de 860** recursos de desarrollo lo usan. | Cambiar la etiqueta a «Curso de autoaprendizaje (sin acreditación automática)», sin cambiar el valor del enum ni los datos. La oportunidad con credencial sigue siendo una actividad externa. |
| **V5-17** Director/Admin sin selector de semestres | **PARTIAL** | **D05:** la API **sí acepta** `semesterScope=[3,5]` de Dirección → 201 (backend correcto). Pero la web solo lo envía si es docente (`director/LearningResources.tsx:139`). | Falta el selector «Toda la carrera / Semestres específicos» para Dirección y Admin. |

### 3.6 Gobernanza y gamificación

| Ref. | Estado | Evidencia | Causa / qué falta |
|---|---|---|---|
| **V5-15** Exenciones de Dirección por docente | **MISSING** | No hay modelo de política: la búsqueda de `ApprovalPolicy`, `DIRECT_ALLOWED`, `REQUIRE_REVIEW` u `override` no da resultados en `api/src` ni en `shared/src`. Hoy la revisión de Dirección es fija para docentes y sociedad. | Falta `ApprovalPolicy` por módulo y docente, revocable y auditada, con `REQUIRE_REVIEW` por omisión (§9.2). **`ACTIVITY` queda en revisión obligatoria** hasta la confirmación institucional (ver §5, ND-03). |
| **V5-18** Criterios docentes siempre revisados | **PARTIAL** | El docente propone puntos de proyecto y Dirección siempre decide (`staff/StudentPoints.tsx:44`, propuestas `PENDING`). | Depende de V5-15: con `DIRECT_ALLOWED` en `GAMIFICATION`, el reconocimiento entra directo y queda en el historial de Dirección (E02). |
| **V5-19** ¿Quién otorgó y por qué? | **PARTIAL** | El historial `gamification_events` guarda `trigger`, `points`, `reason`, `source_entity_type/id` y una clave idempotente (`uq_gamification_event`, `PRESERVE`). **No guarda** el criterio, quién otorgó, quién aprobó ni el estado (aplicado, pendiente o revertido). «Puntos de estudiantes» muestra solo el total (`StudentPoints.tsx:52`), sin detalle. | Falta el detalle por estudiante: fecha, ±puntos, criterio, origen con enlace autorizado, quién otorgó o aprobó, motivo y estado. Parte se puede derivar sin columnas nuevas: quien confirmó (`activity_registrations.confirmed_by`), quien propuso y quien revisó (`gamification_proposals`). |
| **V5-30** Solo 3 familias | **PARTIAL** | Activos: `participacion_confirmada`, `reconocimiento_docente`, y también **automáticos** `primer_proyecto_respaldado`, `proyecto_corroborado`, `colaboracion_aceptada` y `hito_trayectoria` (`gamification.enum.ts:20-36`). No existe «recurso completado atestiguado». | Dejar seleccionables solo las 3 familias del V5 (`ACTIVITY_PARTICIPATION_CONFIRMED`, `PROJECT_TEACHER_RECOGNITION`, `RESOURCE_COMPLETION_ATTESTED`). Los demás disparadores quedan **retirados para criterios nuevos**, con su historial intacto (7234 eventos en desarrollo). |

### 3.7 Proyectos, GitHub y catálogo

| Ref. | Estado | Evidencia | Causa / qué falta |
|---|---|---|---|
| **V5-20** Contribución con todo el catálogo | **DEFECT_CONFIRMED** | **G01:** Ana confirma su contribución en un proyecto **sin tecnologías** con «UML» → **200 aceptada**. Web: `ProjectContribution.tsx:66` carga `catalogService.skills()` (todo el catálogo). | Backend: `confirmMyContribution` → `replaceMemberSkills` (`projects.service.ts:1026`) no comprueba `skillIds ⊆ project.skills`. Web: el selector debe listar solo las tecnologías del proyecto, agrupadas por área. |
| **V5-21** Visibilidad confusa | **PARTIAL** | `web/src/services/types.ts:815-819`: «Además, mi equipo…», «Además, docentes autorizados…» (el «Además» que el Word señala). La ACL del backend se conserva (V4.1 B12). | Cambiar las etiquetas a las de §13.4 sin tocar los valores del enum ni la ACL. |
| **V5-22** Excluir con `window.prompt` | **DEFECT_CONFIRMED** | `ProjectContribution.tsx:78`: `window.prompt('¿Por qué … no forma parte de este proyecto?…')`. Hay más diálogos nativos: `ProjectContribution.tsx:92`, `Evidences.tsx:742` (y un `window.alert` en `:752`) y `teacher/StudentProjects.tsx:104`. | V4.1 B11 añadió el motivo, pero con `prompt`. Hay que reemplazarlos por los componentes propios (`useConfirm` de `feedback.tsx` y `Modal` de `ui.tsx`) con motivo obligatorio y error en línea (I01). |
| **V5-23** Repo-first sin bloquear el DRAFT | **PARTIAL** | **F01:** DRAFT sin repositorio → 201 (**`PRESERVE`**). Ya existen «Volver a comprobar», sugerencias con procedencia, descartar y pedir a Administración (V4.1 B10). | Falta el orden guiado del §11.1: un CTA «Analizar repositorio» visible al crear, antes de las tecnologías, sin volverlo obligatorio. |
| **V5-24** Python aceptado sigue «no declarada» | **DEFECT_CONFIRMED** (código) | Web: `ProjectTechnicalCheck.tsx:43-55`: `aceptar()` refresca las sugerencias (`sug`) pero **no** las señales (`c`). API: `projects.service.ts:1317-1330` devuelve `repo.technologySignals` **tal como se guardaron** en la última comprobación, con el estado `detected` («Señal detectada, no declarada», color bordó). | El estado declarado o detectado es una foto del momento del análisis. Hay que recruzar las señales con las tecnologías **actuales** del proyecto al leerlas (sin llamar a GitHub) y refrescar la vista. Los colores deben pasar a los del §12.3. |
| **V5-25** FastAPI → «vincular con Python» | **DEFECT_CONFIRMED** (código) | `projects.service.ts:250-287` (`decideSkillRequest`): la única forma de «agregar» es asociar el pedido a una tecnología **existente** (`skillId`). La notificación dice «Tecnología agregada al catálogo… «FastAPI» ya está en el catálogo» aunque no se creó nada. Web: `admin/SkillRequests.tsx:88-94`, «Vincular con…». | Mezcla dos operaciones (§4.3). Falta distinguir **alias de la misma tecnología** (añadir alias o mapeo al skill existente) y **tecnología nueva** (crear el skill con área principal y secundarias). Además: notificación veraz, refresco de sugerencias e idempotencia. `dependency-map.ts:87-105` ya mapea `fastapi`, `pytest` y `pymongo` a nombres canónicos: falta que el catálogo pueda tenerlos. (En desarrollo: 6 pedidos, 0 vinculados.) |
| **V5-26** Imágenes del proyecto | **MISSING** | `project.entity.ts` no tiene imágenes. | Faltan 0..5 imágenes de presentación, distintas de las evidencias privadas, con portada y carrusel. Se reutiliza el patrón de `activity_images` (V4.1 `V41ActivityImages`). |
| **V5-27** Galería «Proyectos de la carrera» | **MISSING** | No hay ruta ni menú (`navigation.ts`: la sección «Comunidad» solo tiene Actividades y Biblioteca). | Falta la galería de proyectos ACTIVE visibles para la comunidad autenticada, con filtros por área y tecnología y 6 por página. |
| **V5-28** Equipo o contactos como origen | **PARTIAL** | Hoy hay «vincular equipo» con búsqueda, miembros precargados y exclusión (`Projects.tsx:404-424`, V4.1 B11), además de invitación individual. | Falta el selector explícito «Individual / Equipo existente / Contactos» (§13.1), excluyente como origen. La confirmación individual se conserva (`PRESERVE`). |
| **V5-29** Roles relacionados con áreas y tecnologías | **PARTIAL** | `PROJECT_ROLES` (`project-backing.enum.ts:116`): lista fija de 11 roles; `project_members.role` es **un solo texto**. | Faltan varios roles por integrante y la relación rol → áreas o tecnologías como **ayuda de filtro** (no como prohibición). Cambiar `role` a una lista exige migración (§4.4); se propone una tabla puente compatible que conserve `role` como rol principal. |

### 3.8 Credenciales externas (V5-15 del plan de batches)

| Tema | Estado | Evidencia |
|---|---|---|
| `validation_status` separado de `backing` | **PRESERVE_PASS** | `CredentialValidationStatus` tiene exactamente los 6 estados del §15.1 (`validation.enum.ts:139`). V4.1 B8, cubierto por `e2e-v4-1` (173/0 el 21/10). |
| Revisión manual sin prueba externa ≠ CORROBORATED | **PRESERVE_PASS** | V4.1 B8: «revisión con prueba externa». |
| Proveedores (Credly, Cisco, Huawei) | **BLOCKED_EXTERNAL** | Declarados sin integrar (V4.1 B8). No se afirma ninguna integración que no se haya probado (§15.1). |
| Copy «Afinia informa, no certifica» | **PARTIAL** | Ver V5-16 y V5-31. |

---

## 4. Datos afectados en desarrollo (solo lectura, 27/10/2026)

| Dato | Cantidad | Decisión de compatibilidad |
|---|---|---|
| Usuarios | 18 848 | — |
| · con apellido que contiene un espacio | **784** | No se parten automáticamente. Quedan pendientes de corrección explícita (A02). |
| Actividades | 10 272 | — |
| · con política «constancia interna» | 2497 | Se conservan; sin emisión automática nueva (V5-16). |
| · internas con «credencial externa esperada» | 115 | Se conservan; no se ofrece la opción en el formulario interno nuevo. |
| · externas virtuales sin enlace | 9 | Se conservan; la regla se aplica al publicar o editar. |
| · con `registration_mode = approval` | 0 | El modo nunca tuvo efecto; no hay datos que migrar. |
| Inscripciones | 5713 | — |
| · `registered` | 868 | Pasan a «solicitud pendiente», sin perder historia. |
| · `confirmed` | 3941 | Siguen como «asistió». Su admisión se considera implícita (no se reescriben). |
| Constancias internas | 1009 (983 del sistema y 26 institucionales) | **No se borran ni se reasigna el emisor** (§7.2). |
| Recursos | 860 (140 «curso externo») | Solo cambia la etiqueta. |
| Eventos de puntos | 7234 | El historial es inmutable; las reversiones se registran en el propio historial. |
| Pedidos de tecnología | 6 (0 vinculados) | Sin riesgo de migración. |

## 5. Decisiones institucionales pendientes (`NEEDS_DECISION`)

No se programan como facultades concedidas (§1.2, §21, anexo B).

| ID | Pregunta | Decisión conservadora mientras tanto |
|---|---|---|
| **ND-01** | ¿Dirección autoriza documentos institucionales de asistencia y cómo se emiten o firman? | Sin emisión automática nueva. Se conservan las constancias históricas con su emisor y fecha. Se registran documentos emitidos de verdad por la institución (flujo «certificado emitido por la institución», V3.2 §28.3). |
| **ND-02** | ¿Pueden ir participaciones confirmadas sin documento a un currículo **formal**? | Solo en el «Resumen de trayectoria» informativo, con su aviso. |
| **ND-03** | ¿Dirección puede eximir de revisión a docentes concretos **también en Actividades**? | `ACTIVITY` queda con revisión obligatoria. El override se implementa solo para `RESOURCE` y `GAMIFICATION`. |
| **ND-04** | ¿Qué coordinación exige Dirección entre paralelos A/B/C para incentivos docentes? | No se inventa un módulo de malla ni de paralelos (no hay datos). Se registra como requisito. |
| **ND-05** | ¿Admisión automática por defecto en eventos abiertos sin cupo? | Configurable por actividad (`registrationMode`). Por omisión, el comportamiento menos sorprendente: **abierta** = admisión automática; **con cupo o «por aprobación»** = admisión del responsable. Nunca implica asistencia. |
| **ND-06** | Ventana para regularizar la asistencia después de `FINISHED` | Usar el «Cerrar asistencia» que ya existe (V4.1, `attendance/close`) y una ventana configurable, **7 días** por omisión. Vencida o cerrada, corrige Dirección con motivo (ya existe `participation-correction`). |

## 6. Mapa de permisos relevante para V5 (backend, verificado)

| Acción | Estudiante | Docente | Sociedad | Dirección | Admin |
|---|---|---|---|---|---|
| Ver DRAFT de otro (aunque sea responsable) | — | **No** (B08a) | No | Solo los propios; en revisión, desde la bandeja | Soporte |
| Editar contenido de una actividad ajena publicada | — | **403** (B08b) | 403 | Sí (excepcional) | Sí (auditado) |
| Confirmar participación | No | Responsable, dentro de su scope | Responsable | Responsable | **403** (V2 §6.5) |
| Confirmar la propia participación | — | **403** | — | — | — |
| `semesterScope` de un recurso | — | Solo sus semestres | — | **Libre (API)**; sin selector en la web | Libre (API) |
| Decidir pedidos de tecnología | — | — | — | — | Sí (solo «vincular») |
| Contribución en un proyecto | Solo la propia (`PUT my-contribution`) | — | — | — | Parche de soporte |

## 7. Invariantes del §17 (conservar, no reimplementar)

| # | Invariante | Estado | Evidencia |
|---|---|---|---|
| 1 | Activación por enlace o código, expiración y cooldown | PRESERVE_PASS | Suites `e2e-batch-1`, `e2e-v2`; Jest `autenticacion.spec.ts` (21/10) |
| 2 | Auth con cookie HttpOnly y CORS con credenciales | PRESERVE_PASS | `e2e-web`, Playwright 39×3 |
| 3 | Padrón: preview, aplicación parcial e idempotencia | PRESERVE_PASS | `e2e-batch-*`, Playwright `03-15` |
| 4 | Áreas con código y tags; skill principal y secundarias | PRESERVE_PASS | `e2e-v3-2`, `e2e-v4-1` |
| 5 | Actividades multiárea y skills contextuales | PRESERVE_PASS | `e2e-v3-2` |
| 6 | Borrador de Admin privado aunque haya un docente asignado | **PRESERVE_PASS** | Sonda B08a |
| 7 | Creador ≠ operador | **PRESERVE_PASS** (backend) | Sonda B08b. La web es V5-09. |
| 8 | Interna y externa persistidas | PRESERVE_PASS (datos) | La contaminación de la UI es V5-10. |
| 9 | Semestres del docente restringidos | PRESERVE_PASS | Jest `autorizacion-alcance.spec.ts` |
| 10 | FINISHED no acepta inscripciones | PRESERVE_PASS | `e2e-v4-1` |
| 11 | Sin autoconfirmación de asistencia | **PRESERVE_PASS** | Código `:1758`; `e2e-v4-1` |
| 12 | Recursos: URL duplicada bloqueada, favoritos, «Para ti» | PRESERVE_PASS | `e2e-v4-1` |
| 13 | Proyectos: DRAFT editable y recheck | **PRESERVE_PASS** | Sonda F01; `e2e-v4-1` |
| 14 | Privacidad opt-in, QR, sin chat, resumen seleccionable | PRESERVE_PASS | Playwright `02-02`, `02-12` |
| 15 | Historial de puntos idempotente, sin ranking público | PRESERVE_PASS | `uq_gamification_event`; Playwright `03-04` |
| 16 | Estados de credenciales | PRESERVE_PASS | §3.8 |

## 8. Riesgos y conflictos detectados en el propio contrato

1. **Exenciones en Actividades** (§5.3 frente a §9.2): resuelto con ND-03.
2. **«Externa: validar exactamente como interna»** (§5.4) frente a cursos asíncronos de un proveedor (por ejemplo, NetAcad), que no tienen una «reunión». Se propone que una externa *virtual* exija un **enlace de acceso**: `meetingUrl`, o el `externalUrl` oficial como enlace de acceso, sin campos huérfanos. **Se aplica la regla más estricta posible sin inventar reuniones.**
3. **Cupo y admisión automática** (§6.1): la reserva tiene que ser atómica (bloqueo de fila de la actividad o `UPDATE … WHERE ocupados < cupo`), no un conteo previo. Hoy falla (C05).
4. **Constancias**: dejar de **emitir** automáticamente sin destruir el concepto (§7.1). Las actividades con `internal_constancy` pasan a **«solo participación»** a efectos de emisión nueva; su etiqueta histórica se conserva.
5. **Seguridad en las sondas**: ninguna sonda tocó la base de desarrollo. Las sondas de concurrencia (C05) se hicieron en `afinia_test`.

---

**Siguiente paso:** el plan está en `PLAN_BATCHES_AFINIA_V5.md`. **Me detengo hasta recibir autorización para comenzar BATCH V5-1** (§0.2, §23).
