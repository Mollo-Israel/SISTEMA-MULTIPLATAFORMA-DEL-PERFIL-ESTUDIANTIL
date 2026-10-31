# Auditoría de brechas — Afinia V6 (BATCH V6-0)

**Fecha:** 31/10/2026.
**Contrato:** `AFINIA_CONTRATO_UNICO_V6_CLAUDE_CODE_2026-10-30.md`.
**Rama base verificada:** `feature/afinia-v5-cierre` @ `a3e55f8`. Es la de cambios más recientes (28/10) y está igual en `origin`; `main` es de junio.
**Rama de trabajo:** `feature/afinia-v6-cierre`, creada desde `a3e55f8`. Este batch no cambió código funcional.

**Clasificación:** `ALREADY_CORRECT | PARTIAL | INCORRECT | MISSING | REGRESSION | NEEDS_DECISION | NEEDS_TEST`.

## 0. Estado de Git y línea base

| Comprobación | Resultado real |
|---|---|
| Archivos versionados modificados | Ninguno |
| Sin seguimiento | El propio contrato V6; `scripts/demo-60.ps1` y `scripts/demo-objetivo-6.mjs`, que nunca se suben por acuerdo |
| `npm run shared:build` | OK |
| `tsc --noEmit` de api, web y móvil | OK, OK, OK |
| `e2e-v5` contra la API de desarrollo (31/10) | **135 / 135** |
| Última regresión completa (cierre V5, 28/10) | 23 suites, 2390 / 0; tras las correcciones de SonarQube, 683 / 0 en las suites afectadas, y Playwright 54 / 54 |

Las **sondas** de esta auditoría corrieron contra la API aislada (`:3020`, base `afinia_test`), con usuarios sintéticos `v6.*.<timestamp>`. No se tocó la base de desarrollo.

## 1. Actividades: responsables × semestres (V6 pp. 1–4)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| V6-SCOPE-01a | **INCORRECT** | `api/src/entities/activity-responsible.entity.ts:12-28` | `activity_responsibles (activity_id, user_id)`: **no hay asignación por semestre**. Solo existe la unión `activities.semester_scope`. |
| V6-SCOPE-01b | **INCORRECT** (sonda B2) | `activities.service.ts:1755-1770` | Admin crea una actividad publicada 1–8 con Carlos (1–4) y María (5–8) y luego quita a María: **200**, `semesterScope=[1..8]` con un solo responsable. La cobertura solo se valida en la transición a publicar. |
| V6-SCOPE-01c | **INCORRECT** (sonda B4) | `activities.service.ts:1728-1731` | Admin agrega el 8.º a una actividad publicada que solo tiene a Carlos: **200**. |
| V6-SCOPE-01d | PARTIAL (sonda B3) | `activities.service.ts:594-613` | En borrador, al **publicar** sí se rechaza (`ACTIVITY_SCOPE_NOT_COVERED`). Pero `assertCobertura` solo corre para Admin/Dirección y solo en académicas. |
| V6-SCOPE-01e | **ALREADY_CORRECT** (sonda B6) | `activities.service.ts:2719-2747` | El docente creador no dirige a semestres fuera de su alcance: **403** también por API. |
| V6-SCOPE-02 | **INCORRECT** (sonda B7) | `activities.service.ts:665-704` (`semesterScope` en 687) | Duplicar como Carlos una actividad que incluía 5–8: **403** «fuera de su alcance: 8». La copia hereda los semestres. |
| V6-ACT-01 | **ALREADY_CORRECT** (sonda B8) / **MISSING** (modal) | `web/src/pages/teacher/MyActivities.tsx` | El responsable no edita el material (**403**). Falta un «Ver detalles» de solo lectura dedicado en «Mis actividades». |
| ACT-10 | ALREADY_CORRECT | V5.3.2 | El borrador de Admin no aparece al docente responsable. |

## 2. Admisión, cupo y externas (V6 pp. 5–8)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| V6-ACT-02 | **ALREADY_CORRECT** en la API | V5-4: `registration.rules.ts` (`admisionAutomatica`), V5.4.1–4.17 | `capacity` y `registrationMode` son ejes independientes. Admisión con bloqueo `pessimistic_write` (V5.4.5–4.6). |
| V6-ACT-02b | NEEDS_TEST | — | Falta probar «cupo + abierta» con 3 solicitudes simultáneas (ADM-02). Hoy un cupo sin aprobación ¿admite automáticamente? Según `admisionAutomatica`, solo cuando es abierta **y sin cupo**. V6 pide abierta+cupo = adjudicación por orden. **Cambio de regla.** |
| V6-ACT-03 | **MISSING** en la web | `web/src/components/ActivityManager.tsx:1244` (`{!externa && (`) | La API acepta `capacity` y `registrationMode` en externas (sonda B9: **201**, cap=2, approval), pero el formulario de **Externas oculta el selector de Admisión**. |
| ADM-07/08 | PARTIAL | `shared/src/enums/gamification.enum.ts:115-123` | No hay constancia automática (V5-5), pero se otorga la **insignia `PRIMERA_PARTICIPACION`** y `CINCO_PARTICIPACIONES` por asistencia. V6 pide no dar insignia automática. |

## 3. Formularios y grids (V6 pp. 7–9, 17)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| V6-UX-01 | **PARTIAL** | `web/src/components/ActivityTabs.tsx:32-50` | Solo pide confirmar al **cambiar de pestaña** con el formulario **abierto** (aunque no haya cambios). No hay estado *dirty*, ni guardia al navegar o recargar (`beforeunload`: 0 usos en `web/src`), ni en otros formularios. |
| V6-GRID-01 | **MISSING** | `web/src/pages/admin/AreasSkills.tsx:196-334`, `ActivityCategories.tsx:140-273`, `Users.tsx:450` | Áreas, tecnologías, categorías y usuarios muestran bajas y suspendidos mezclados (con insignia). Recursos ya tiene «Ver también los retirados» (`LearningResources.tsx:98`): ALREADY_CORRECT. |
| V6-USER-01 | **PARTIAL** | `web/src/pages/admin/Users.tsx:450,477`; `api/src/users/surnames.ts` | El botón «Apellidos por separar (n)» filtra a quienes tienen `surnamesPending` (migración V5-1). Siempre visible, aunque sea 0. |

## 4. Identidad (V6 pp. 15–17)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| V6-USER-02 | **PARTIAL** | `Users.tsx:245-251` | El correo es un campo libre con pista de dominio. No hay composición «parte local + dominio por rol» con vista previa. El código universitario es independiente del correo (`UNIVERSITY_CODE_PATTERN`): ALREADY_CORRECT, no se toca. |
| V6-USER-03 | **MISSING** | `api/src/users/dto/create-user.dto.ts` (solo `academicScopeSemesters` de estudiante); `users.service.ts:642` | Los semestres del docente solo se asignan **después**, con `PUT /users/:id/semesters`. |

## 5. Proyectos: contribución (V6 pp. 10–14)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| V6-PROJ-01 | **INCORRECT** (causa confirmada en datos) | `api/src/projects/dto/invite-member.dto.ts:21` (`proposedRole` libre); `project-members.service.ts:410,417` (`member.role = invitation.proposedRole`); `web/src/components/ProjectContribution.tsx:79` (precarga `[propia.role]`); `contribution.dto.ts:41` (`IsIn PROJECT_ROLES`) | El integrante **invitado** hereda un rol libre («Desarrollador Backend»). El formulario lo reenvía en `roles` y la API responde **400 `VALIDATION_ERROR`**. En desarrollo hay **34** integrantes con roles fuera del catálogo («Desarrollador Backend» 28, «Analista de datos» 2…). Explica por qué falla Luis (invitado) y no Ana (dueña). Se reproducirá en V6-7. |
| V6-PROJ-02 | **ALREADY_CORRECT** (V5-12) | V5.12.1–12.4 | Varios roles (hasta 4), tecnologías del proyecto, misma tecnología para varios integrantes. Los roles no puntúan. |

## 6. Proyectos: OCR, activación, demo, evidencia (V6 pp. 18–22)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| V6-PROJ-03 | **INCORRECT** | `api/src/evidences/evidences.service.ts:85`, `projects.service.ts:1123` → `validation.service.ts:258` (`extraction.extract`, OCR de imágenes) | Toda evidencia de proyecto se encola y su archivo pasa por extracción y OCR. El texto extraído decide el respaldo `SUPPORTED`. El OCR de **credenciales** (`credential-check.rules.ts`, `ocr.port.ts`) se conserva. |
| V6-PROJ-04 | **ALREADY_CORRECT** | `api/src/projects/project-readiness.rules.ts:75-100` | ACTIVE pide `evidence OR demo accesible`. La galería es otra tabla (`project_images`) y no cuenta. Falta la prueba PRO-06/07/08: NEEDS_TEST. |
| V6-PROJ-05 | PARTIAL | `api/src/validation/link-checker.service.ts:192-320` (`assertSafe`, rangos prohibidos IPv4/IPv6) | Hay protección SSRF. Falta exigir `https://` a la demo y el aviso «sitio de terceros» al mostrarla. |
| V6-PROJ-06 | **INCORRECT** (causa probable) | `api/src/storage/files.controller.ts:68-72` (sin `Content-Type`, siempre `attachment`); `web/src/components/ArchivoProtegido.tsx:74` | El blob llega **sin tipo**: el visor no lo reconoce como imagen y lo descarga como archivo sin tipo (el «XML» del Word). Pendiente de confirmar en V6-9. |
| V6-PROJ-07 | PARTIAL | `api/src/projects/project-gallery.service.ts` (`community`); `projects.service.ts:1624` (`findPublic` expone `repositoryUrl`) | La galería no expone el repositorio ni evidencias (bien). Pero muestra solo al dueño y el **conteo** de integrantes, sin nombres ni roles. El **enlace público** sí expone `repositoryUrl`. No hay consentimiento por integrante: NEEDS_DECISION, propuesta en el plan. |
| 7.6 | PARTIAL | `uploads.service.ts` (10 MB, PDF/PNG/JPG/WEBP); `project-gallery.service.ts` (5 imágenes) | Galería 0..5: ok. Evidencias sin tope por proyecto (V6 propone 5 archivos y 8 enlaces). |

## 7. Perfil, contactos y equipos (V6 pp. 23–26, 31–33)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| V6-PROFILE-01 | **PARTIAL** | `web/src/pages/student/Profile.tsx:149-151` (`MiEnlace` en Visibilidad); `Collaboration.tsx:89` (pestaña «Mi enlace y QR» **duplicada**) | El QR ya está en Perfil → Visibilidad, pero sigue también en Colaboración. Falta la **vista previa pública fiel**. |
| V6-PROFILE-02 | **MISSING** | `api/src/entities/student-profile.entity.ts:53` (`avatar_key`) | Solo hay avatares predefinidos; no hay foto propia. |
| CONTACT | PARTIAL | `collaboration.controller.ts:124` (`POST contacts/requests` por `slug`) | La solicitud por enlace o QR existe y no agrega sola (V3 §45). **No hay búsqueda** por nombre entre perfiles descubribles. |
| TEAM-01 | **MISSING** | `collaboration.controller.ts:211-280`; `Collaboration.tsx:1109-1122` | Solo el responsable ve candidatos para su necesidad. No hay «Equipos → Para ti» para el estudiante. |

## 8. Recomendador (V6 pp. 26–31)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| V6-REC-01 | **INCORRECT** según V6 | `web/src/pages/student/Activities.tsx:70,90,204,363-371` (pestaña «Interesadas», botón «Me interesa»); `ParaTi.tsx:18,83` y `Recommendations.tsx:108,142,286,394` («No me interesa», «Descartadas»); `recommendations.engine.ts:399-405,1139` (`ACTIVITY_INTERESTED`, 5 %) | V6 los retira de las actividades. El interés y la mejora del **perfil** se conservan. |
| V6-REC-02 | **INCORRECT** según V6 | `ParaTi.tsx:10,94`; `App.tsx:159` (`/student/recommendations`, «Más sugerencias») | Pantalla que mezcla áreas de fortalecimiento, equipos y oportunidades. |

## 9. Afinidad, respaldo, credenciales y resumen (V6 pp. 33–37)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| V6-CERT-01 | PARTIAL | Ver ADM-07/08 | Sin constancia automática (V5-5), pero hay insignias automáticas por participación. |
| V6-CERT-02 | **ALREADY_CORRECT** | `web/src/pages/student/Evidences.tsx:132-134` | Ya hay tres pestañas: evidencias de proyectos, credenciales externas y documentos institucionales. Ajustar el texto: «Constancias y…» → «Certificados institucionales recibidos». |
| HIST-02 | PARTIAL | `web/src/services/types.ts:958-970` (`BACKING_TIER_LABEL/HELP`) | Hay etiqueta y ayuda por credencial. Falta una explicación unificada de los estados en la trayectoria y los proyectos. |
| V6-TRAJ-01 | PARTIAL | `trajectory-summary.service.ts` (V5-15/16, `TRAJECTORY_SOURCES_NOTICE`) | Ya es selectivo e informativo. V6 pide separar «Participaciones registradas (sin documento)» de «Certificados institucionales recibidos», y el texto exacto de §10.4. |
| CRED-02/03/04 | ALREADY_CORRECT | V3.9.3, V3.9.4, V3.9.6 | QR de curso, titular ajeno y proveedor caído. |

## 10. Administración (V6 p. 38)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| V6-ADMIN-01 | **INCORRECT** según V6 | `web/src/navigation.ts:169` | Agrega «Correo (configuración técnica)» al menú de Admin. La ruta y la guardia de la API ya existen. |

## 11. Migraciones e históricos

- **Migraciones previstas, todas aditivas:**
  - `activity_responsibles.semesters smallint[]` (V6-1), con *backfill* a la intersección del alcance del docente con la audiencia;
  - `users` sin cambios;
  - `student_profiles.photo_file_id` (V6-11);
  - `project_members.show_in_gallery` (V6-10, si se decide el consentimiento por integrante).
- **Históricos que no se borran:**
  - inscripciones con estado `interested` (V6-12 deja de usarlas, no las elimina);
  - insignias ya otorgadas;
  - roles libres de integrantes (V6-7 los mapea en la vista, no reescribe la fila);
  - eventos de puntos.
- **Riesgo de privacidad:**
  - la galería y el enlace público con nombres de integrantes;
  - la foto de perfil;
  - la búsqueda de contactos (enumeración).
  Cada batch lleva una prueba de exposición.

## 12. Decisiones (NEEDS_DECISION) y lo que hace el plan mientras tanto

| Tema | Propuesta conservadora |
|---|---|
| Abierta + cupo (V6 §4.1) | Adjudicación automática por orden de solicitud, con bloqueo y sin sobrerreserva; al agotarse, «Cupo completo». Cambia la regla V5 (abierta+cupo = pendientes), que el propio V6 sustituye. |
| Nombres de integrantes en la galería | Mostrar nombre y roles solo de quien confirmó su contribución **y** no desmarcó «Mostrarme en Proyectos de la carrera» (nuevo, activado por omisión solo en proyectos de comunidad). Si se prefiere *opt-in* estricto, se cambia el valor por omisión. |
| Repositorio en el enlace público | Se oculta igual que en la galería, coherente con §7.5. |
| Insignias por participación | Dejar de otorgarlas desde ahora; las ya otorgadas se conservan como historia. |
