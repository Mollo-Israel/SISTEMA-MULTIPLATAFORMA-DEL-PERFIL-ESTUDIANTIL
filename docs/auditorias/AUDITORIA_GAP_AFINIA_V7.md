# Auditoría de brechas — Afinia V7.1 (BATCH V7-0)

- **Fecha:** 25/11/2026.
- **Contrato:** [`AFINIA_CONTRATO_FINAL_V7_1_CLAUDE_CODE_2026-11-25.md`](../contratos/AFINIA_CONTRATO_FINAL_V7_1_CLAUDE_CODE_2026-11-25.md). Sustituye al MD V7 anterior.
- **Base verificada:** `feature/afinia-validacion-reforzada` @ `141d768` (V9). Es la rama con los cambios más recientes (23/11) y está igual en `origin`. Contiene a V8, V7-rediseño y V6.
- **Rama de trabajo:** `feature/afinia-v7-cierre-final`, creada desde `141d768`.
- **Alcance de este batch:** solo auditoría. **No se modificó código funcional, datos ni migraciones.**
- **Clasificación:** `ALREADY_CORRECT | INCORRECT | PARTIAL | MISSING | REGRESSION | NEEDS_TEST | NEEDS_DECISION`.

**Método.** La auditoría combina tres fuentes:
1. Lectura del código, con ruta y línea.
2. Consultas **de solo lectura** a la base de desarrollo.
3. Una línea base de compilación y pruebas.

No se ejecutaron sondas HTTP. Según §0.6, **cada batch reproduce su defecto antes de corregirlo**. Por eso, cuando el código ya explica la causa, la clasificación dice «causa en código» y deja la reproducción pendiente para su batch.

---

## 0. Git, protección y línea base

| Escenario | Comprobación | Resultado real |
|---|---|---|
| — | `git branch --show-current` (antes) | `feature/afinia-validacion-reforzada` |
| — | `git log -5 --oneline` | `141d768` V9 · `f822e75` V8 · `f2709e0` seguridad · `1910b7d` auditoría · `f98d54e` calidad |
| — | Remoto y `git fetch origin` | Sin novedades de compañeros. Local y `origin` iguales (`0 0`). `origin/main` (`28ce3ca`, 01/06) es un respaldo antiguo y no es ancestro |
| G01 | `git status --short` | Ningún archivo versionado modificado. Hay 3 archivos sin seguimiento: el propio contrato y `scripts/demo-60.ps1` / `scripts/demo-objetivo-6.mjs`, que por acuerdo no se suben. No se tocaron |
| G02 | Rama nueva desde base verificada | `git switch -c feature/afinia-v7-cierre-final` en `141d768`. La rama base sigue en `141d768`, sin commits nuevos |
| — | Protección adicional | Etiqueta **local** `base-v7-1-cierre-final` → `141d768` (no publicada). La copia en `origin` es la protección principal |

**Línea base (25/11/2026, rama nueva = base)**

| Paso | Comando | Resultado |
|---|---|---|
| Paquete compartido | `npm run shared:build` | OK |
| Tipos API | `npx tsc --noEmit -p api/tsconfig.json` | OK |
| Tipos web | `tsc --noEmit -p web/tsconfig.json` | OK |
| Tipos móvil | `npm run mobile:typecheck` | OK |
| Unitarias | `npm run test:unit` | **167 / 167** (42 suites) |
| Jest + SuperTest (BD aislada `afinia_test`) | `npm --prefix api run test -- --forceExit` | **214 / 214** (18 suites) |

Jest reescribe evidencia versionada de la tesis (`pruebas/02-jest-supertest/reporte/reporte-jest.html`). Se restauró ese único archivo y el árbol volvió a quedar limpio.

No se corrieron en V7-0 las suites de navegador ni las e2e de API (`e2e-*`, Playwright, Maestro). Se corren en V7-13, o en cada batch para lo que toque. Hay un fallo previo conocido: `e2e-web` WEB.44.2 depende del tiempo y fallaba ya antes de V7-rediseño.

---

## 1. Inventario

### 1.1 Sistema

| Elemento | Cantidad / dato |
|---|---|
| Entidades TypeORM | 64 |
| Migraciones | 83 (última `1780890000000-V9VerifiedEmails`) |
| Módulos API / controladores / endpoints | 36 / 36 / 324 |
| Rutas web (`web/src/App.tsx`) | 72 |
| Pantallas móviles (solo estudiante) | 18 en `mobile/src/screens/student` + Login |

### 1.2 Estados lógicos del contrato (§5.4) frente a los enums reales

| Dimensión lógica | Enum real (`shared/src/enums`) | Observación |
|---|---|---|
| Ciclo de vida de actividad | `ActivityStatus`: draft, published, open, closed, finished, cancelled (`activity.enum.ts:107`) | Transiciones en `ACTIVITY_TRANSITIONS` (`activity.enum.ts:135`). `DRAFT → OPEN` ya existe |
| Revisión de actividad | `ActivityReviewStatus`: not_required, pending, observed, approved, rejected; `null` = no enviada (`activity.enum.ts:200`) | Eje separado del ciclo de vida |
| Resultado de actividad (D04) | `ActivityOutcomePolicy`: none, participation_only, internal_constancy (histórica), institution_issued_certificate, external_credential_expected, other_authorized_resource (histórica) (`activity.enum.ts:15`) | No hay tipo GENERAL/INDIVIDUAL (D05) |
| Inscripción / asistencia | `RegistrationStatus`: interested, registered, accepted, rejected, confirmed, absent, cancelled | `attendance_status` = open/locked en `activities` |
| Procesamiento técnico de credencial | `ValidationStatus`: pending, processing, completed, inconclusive, failed (`validation.enum.ts:23`) | Falta «no aplica» como estado explícito |
| Revisión humana de credencial | `ManualReviewStatus`: requested, corroborated, not_corroborated (legado), inconclusive, rejected (`validation.enum.ts:100`) | Hoy solo existe para **históricas** sin verificador (`validation.enum.ts:97`). Falta «observada / solicitar corrección» |
| Respaldo de credencial | `BackingTier`: declared, supported, corroborated, flagged (`validation.enum.ts:43`) | No hay «revisado» para credenciales (sí para proyectos) |
| Estado derivado mostrado | `CredentialValidationStatus`: PENDING, **AUTO_VERIFIED**, MANUAL_REVIEW_REQUIRED, MANUALLY_VERIFIED, INCONCLUSIVE, REJECTED (`validation.enum.ts:139`) | `AUTO_VERIFIED` («Verificada por la fuente oficial») contradice §5.1 |
| Respaldo de proyecto | `ProjectBackingTier`: declared, supported, corroborated, reviewed, flagged | — |
| Documento institucional | `internal_constancies.kind`: institution_certificate / internal_constancy; `ConstancyStatus` | Sin versión ni historial de reemplazo |
| Cuenta | `UserStatus`: pending_activation, active, suspended, inactive | Base para el filtro excluyente (§4.1) |

### 1.3 Destinos de Admin y soporte de filtros por URL (para V7-11)

| Ruta existente | Filtro por URL hoy |
|---|---|
| `/admin/users` | `?role=` sí. `?status=` no existe |
| `/admin/imports`, `/admin/audit`, `/admin/activity-categories`, `/admin/gamification`, `/admin/points`, `/admin/resources`, `/admin/skill-requests` | Ninguno |
| `/admin/areas` | `?tab=skills` |
| `/admin/activities` | Solo `?nuevo=1` y `?actividad=<id>`. No hay tipo, estado ni revisión |
| `/admin/credential-reviews` | Ninguno. Monta la **misma página de decisión** que Dirección (`App.tsx:229`) |
| `/admin/verifiable-credentials` | Se retira (§7) |
| `/admin/mail` | Fuera del menú, operativa por URL (`App.tsx:218`) |
| `/proyectos` | `q`, `areaId`, `skillId`, `page` en la API |

### 1.4 Datos (base de desarrollo, solo lectura, 25/11)

Son datos de desarrollo, en buena parte sintéticos de las suites. **Antes de cualquier batch que toque datos hay que repetir estas consultas sobre la base real** que se vaya a usar.

| Consulta | Resultado |
|---|---|
| Actividades por estado | draft 3.080 · open 3.190 · closed 1.549 · finished 6.621 · cancelled 524 |
| **Aprobadas que siguen en borrador** (defecto §4.2) | **76**, aprobadas entre el 17/10 y el 12/11. **0 con inicio futuro y 76 ya vencidas**: ninguna es elegible para abrirse |
| Participaciones CONFIRMED por resultado | **none 3.207 (2.116 estudiantes)** · internal_constancy 1.481 · participation_only 184 · institution_issued_certificate 93 · external_credential_expected 79 |
| Actividades finalizadas con lista abierta / cerrada | 6.515 / 106 |
| Credenciales externas | 4.978 en total. Vinculadas: declared 81 · supported 158 · **corroborated 271 (sin decisión humana)** · flagged 228. Históricas: declared 2.601 · supported 331 · corroborated 111 (todas por revisión de Dirección) · flagged 1.159 · sin registro de validación 38 |
| Vinculadas **sin archivo** | **504** |
| Certificados institucionales entregados | 93 (53 con archivo, 53 archivos distintos) · constancias internas históricas 996 (sin archivo) |
| Modelos de referencia de externas | 738 |
| Registros verificables propios (V8) | 2 vigentes · 4 entradas en el libro · política de emisión **activada** |
| Cuentas | ADMIN activo 1 · suspendidas: 62 estudiantes y 14 docentes · pendientes de activación 1.635 |

---

## 2. Decisiones D01–D08

| ID | Estado | Situación real hoy | Brecha |
|---|---|---|---|
| D01 | CONFIRMADA | Admin **puede decidir** revisiones (`validation.controller.ts:85-97`, `@Roles(CAREER_DIRECTOR, ADMIN)`). La web le muestra los botones (`/admin/credential-reviews` → `CredentialReviewsPage`, sin control de rol). El verificador **corrobora solo** (`credential-check.rules.ts:564`, `validation.service.ts:341`) | INCORRECT → V7-4 |
| D02 | CONFIRMADA | Aprobar deja la actividad en `draft` y avisa «Ya puedes publicarla» (`activities.service.ts:1304-1371`, texto en `:1351`). El cierre al inicio y el fin automáticos ya funcionan en el backend | INCORRECT (apertura) / ALREADY_CORRECT (cierre y fin) → V7-2 |
| D03 | CONFIRMADA | El modelo es opcional. Pero lo edita **el responsable** en cualquier momento, también después de aprobada o finalizada, y sin versión (`activities.service.ts:2672-2700`, `assertCanManage`). No hay acción acotada de Dirección | INCORRECT → V7-3 |
| D04 | CONFIRMADA | Afinidad, tecnologías respaldadas y trayectoria cuentan toda participación CONFIRMED **sin mirar el resultado** (`affinity.engine.ts:483-530`, `backed-skills.service.ts:63-70`, `cv-eligibility.rules.ts:26-27`) | INCORRECT → V7-2/5/8, con impacto en datos (§15) |
| D05 | CONFIRMADA | No existe el tipo GENERAL/INDIVIDUAL. La entrega es manual, a los confirmados que elija el responsable, con un archivo opcional común (`constancies.service.ts:266-326`) | MISSING → V7-5 |
| D06 | LÍMITE | Fórmula real documentada en §10. No se recalibra | Solo presentación → V7-8 |
| D07 | LÍMITE | El original del padrón **no se conserva**; solo el resumen de importación | Mostrar resumen; no inventar descarga → V7-11 |
| D08 | LÍMITE | La histórica no exige archivo; basta una URL o nada. Las notas privadas de contactos existen (`contact_notes`: alias, contexto, canal preferido) | Documentado en §5 y §12. Conservar |

---

## 3. Inicio de Admin (§3; V7-11)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| ADM-01 | **INCORRECT** | `web/src/pages/admin/Home.tsx:71-80` | Las tarjetas son enlaces «Ir» directos. No hay «Detalles» ni modal de solo lectura con los últimos 10 y el total real |
| ADM-02 | **INCORRECT** | `Home.tsx:24` | «Cuentas sin activar» lleva a `/admin/users` **sin filtro**: se ven todas las cuentas (H02) |
| ADM-03 | **INCORRECT** | `Home.tsx:26` | «Credenciales en revisión manual» lleva a **`/admin/audit`**, no a la revisión |
| ADM-04 | PARTIAL | `Home.tsx:29-45` | «Cuentas por rol»: la fila enlaza a `?role=`, pero no hay modal ni filtro por métrica (activas / sin activar) |
| ADM-05 | PARTIAL | `Home.tsx:48-55` | Padrón y Auditoría solo muestran la última importación y un contador. No listan las 10 últimas |
| ADM-06 | **MISSING** | — | Faltan A05–A15: áreas y tecnologías, pedidos, categorías, académicas, extracurriculares, externas con cobertura, recursos, puntos, gamificación y proyectos de la carrera |
| ADM-07 | **INCORRECT** | `Home.tsx:56-62` | La tarjeta «Correo» sigue en Inicio. `/admin/mail` ya está fuera del menú (`App.tsx:217-218`): ALREADY_CORRECT |
| ADM-08 | **INCORRECT** | `web/src/navigation.ts:173-190` | El menú de Admin es una sola sección plana, sin subtítulos (Identidad, Catálogos, Gestión, Seguimiento) |
| ADM-09 | **INCORRECT** | `navigation.ts:187` | El menú incluye «Registros verificables» (se retira en V7-6) |
| ADM-10 | ALREADY_CORRECT | `imports.module.ts:19` (`memoryStorage`); `imports.service.ts:147`; `import-batch.entity.ts:29` | El padrón se procesa en memoria. Solo se guardan su SHA-256, el nombre original y el resumen; el archivo no. D07: mostrar el resumen y no inventar descarga (H04) |
| ADM-11 | NEEDS_TEST | `api/src/reports/home-overview.service.ts` | Sin pruebas 0/1/11 ni de error independiente por tarjeta (H01, H13) |

## 4. Filtros y revisión de actividades (§4; V7-1, V7-2)

### 4.1 Filtros excluyentes

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| FIL-01 | **INCORRECT** | `web/src/pages/admin/Users.tsx:534-542,566` | Casilla «Mostrar también las suspendidas». No se puede ver **solo** suspendidas ni **solo** pendientes de activación (F01, F02) |
| FIL-02 | **INCORRECT** | `api/src/users/users.controller.ts:38-44`, `users.service.ts:251-271` | `GET /users` no filtra por estado ni pagina: devuelve todas las cuentas (~28 mil en desarrollo) y la web filtra y pagina en el navegador. Incumple «filtrar antes de paginar» |
| FIL-03 | **INCORRECT** | `AreasSkills.tsx:279,728`, `ActivityCategories.tsx:224` | Casilla «Mostrar también las dadas de baja». Falta el selector Vigentes / Retirados (F03) |
| FIL-04 | PARTIAL | `director/LearningResources.tsx:297,673` | Recursos usa `includeInactive`, que sí filtra en el servidor, pero también es casilla («Ver también los retirados») |
| FIL-05 | **MISSING** | `components/ActivityManager.tsx:198,238,1524` | Actividades solo filtra por estado del ciclo de vida, en el navegador. No hay filtro de estado de revisión ni de tipo por URL |
| FIL-06 | PARTIAL | `activities.controller.ts:77`, `activities.service.ts:1776` | `GET /activities/managed` no pagina (≈5 s con 14 mil actividades, ver la nota sobre WEB.44.2) |
| FIL-07 | NEEDS_TEST | `ActivityManager.tsx` | Volver a la página 1 al cambiar de filtro y conservar los filtros tras recargar (F04, F05) |

### 4.2 Publicación al aprobar (D02)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| PUB-01 | **INCORRECT** | `activities.service.ts:1304-1371` | `review('approve')` solo cambia `reviewStatus`. El ciclo de vida sigue en `draft` y el aviso dice «Ya puedes publicarla» (`:1351`). Es el defecto reportado (A03, A13) |
| PUB-02 | ALREADY_CORRECT | `activities.service.ts:1310-1312` | Solo Dirección decide. Admin recibe 403 en la API (A02) |
| PUB-03 | ALREADY_CORRECT | `activities.service.ts:1314-1322` | Observar o rechazar exige comentario y no publica. Decidir dos veces da 409 (A04, A05) |
| PUB-04 | ALREADY_CORRECT | `activity-lifecycle.worker.ts`, `activities.service.ts:1035-1078` | Un trabajador del backend (cada 60 s) cierra por inicio (`event_date <= now()`) y finaliza por fin (`end_at <= now()`), con auditoría. No depende del navegador (A06, A15) |
| PUB-05 | ALREADY_CORRECT | `activities.service.ts:2870-2882` | La inscripción se rechaza en CLOSED, en FINISHED o con la fecha ya pasada. El cupo se controla con bloqueo de fila (`:2277-2278`, `:2839-2851`) |
| PUB-06 | PARTIAL | `activities.service.ts:2879` | Usa `<` en vez de `<=` frente a `start_at`: en el instante exacto de inicio aún admite. Se reproduce y ajusta en V7-2 |
| PUB-07 | **MISSING** | — | Para las propias de Dirección o Admin, «Publicar» no abre automáticamente cuando es elegible (A14) |
| PUB-08 | NEEDS_DECISION (datos) | §1.4 | 76 aprobadas en borrador, **todas vencidas**: no se pueden abrir de forma retroactiva. Propuesta: dejarlas como están y reportarlas |
| PUB-09 | PARTIAL | `activities.service.ts:1292-1293` | Admin ve propuestas enviadas y no ve borradores no enviados (A01): correcto. Falta probar edición o cancelación de propuestas ajenas por API (NEEDS_TEST) |

## 5. Credenciales externas e históricas (§5; V7-3, V7-4)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| CRED-01 | **INCORRECT** | `credential-check.rules.ts:564,594,623`; `validation.service.ts:341` | `VERIFIED_MATCH` del verificador → `CORROBORATED` y `AUTO_VERIFIED`, **sin decisión humana**. Hay 271 vinculadas así (§1.4) (C11, C14, C17) |
| CRED-02 | **INCORRECT** | `shared/src/enums/affinity-engine.ts:152-164` + `affinity.engine.ts` | Cada credencial CORROBORATED suma 15 de afinidad, también cuando la corroboró la máquina. SUPPORTED, que puede venir solo del parser, suma 8 de respaldo |
| CRED-03 | **INCORRECT** | `validation.controller.ts:85-97`; `web/src/pages/director/CredentialReviews.tsx:48`; `App.tsx:229` | Admin puede decidir por API y por web (C24, D01) |
| CRED-04 | **INCORRECT** | `validation.enum.ts:97-114`; `certificates.service.ts:212-216` | La revisión humana es «excepcional»: solo para históricas y solo si el estudiante la pide. Falta la bandeja de **todas** las presentadas (§5.3 fase 3) |
| CRED-05 | **MISSING** | `ManualReviewStatus` | No existe «observada / solicitar corrección» con reenvío (C21) |
| CRED-06 | **INCORRECT** | `certificates.service.ts:55-107` | En la vinculada, el **cuerpo** trae nombre, emisor, áreas y tecnologías. El servidor no los deriva de la oportunidad (C03, C04) |
| CRED-07 | ALREADY_CORRECT | `certificates.service.ts:72-84` | La elegibilidad de la oportunidad la decide el servidor y no permite repetir la misma oportunidad (C05, C18) |
| CRED-08 | **INCORRECT** | `certificates.service.ts:87-89` | El archivo es **opcional** también en la vinculada: hay 504 sin archivo (C06) |
| CRED-09 | **INCORRECT** | `certificates.service.ts:121-124` | Toda credencial, **histórica incluida**, entra a la cola automática (OCR, QR, fuente). §5.2 pide enviar la histórica directo a revisión, con las fases técnicas en «no aplica» (C01, C02) |
| CRED-10 | PARTIAL | `certificates.service.ts:57-62` | Bloquea dos credenciales del mismo estudiante con el mismo nombre. Puede impedir certificados legítimos distintos con título común (§5.2). Se revisa con D08 |
| CRED-11 | ALREADY_CORRECT | V9: `validation/fraud`, `forensics`, `link-checker.service.ts` | Lectura del PDF, QR, fuentes Credly/Cisco, SSRF y forense ya existen como **ayuda**. Nada acusa: una advertencia no rechaza (C10, C13, C16) |
| CRED-12 | NEEDS_TEST | `validation.worker.ts` | Que un resultado tardío no pise un veredicto humano ni se aplique a otro hash (C19, C28) |
| CRED-13 | **MISSING** | `web/src/pages/student/Evidences.tsx` | Falta la tabla de tres fases con «no aplica / omitida / pendiente» y sin checks verdes ficticios (§5.4) |
| CRED-14 | **INCORRECT** | `activities.service.ts:2672-2700` | El modelo lo cambia el responsable en cualquier estado y sobrescribe sin versión. Falta la acción acotada de Dirección (D03, C26, C27) |
| CRED-15 | NEEDS_DECISION | §1.4 | ¿Qué se hace con las 271 vinculadas corroboradas por la máquina? C23 prohíbe revocarlas en silencio. Propuesta en §15 |
| CRED-16 | ALREADY_CORRECT | `CorreosComprobados.tsx` / V9 | Correos personales comprobados: ayuda de identidad, sin aprobar nada |
| CRED-17 | **INCORRECT** | `mobile/src/screens/student/EvidencesScreen.tsx:455-504` | El móvil también registra vinculadas con el mismo contrato: el cuerpo trae los datos y el archivo es opcional. Se adapta en V7-3 |

## 6. Asistencia y documentos institucionales (§6; V7-2, V7-5)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| ASI-01 | ALREADY_CORRECT | `registration.rules.ts:65-73`; `activities.service.ts:2434-2460` | Con la lista cerrada, la API bloquea al responsable (`ATTENDANCE_LOCKED`). Admin no cierra listas (A11) |
| ASI-02 | **INCORRECT** | `ActivityManager.tsx:882-883,1894-1911`; `activities.service.ts:2367-2373` | `consolidada = finished OR acta cerrada`. Con la actividad FINISHED y la lista **abierta**, la web oculta «Marcar ausente» y la API no deja pasar un CONFIRMED a ausente. §6.1 pide corregir mientras la lista siga abierta (A10) |
| ASI-03 | ALREADY_CORRECT | `activities.service.ts:2464+` | Hay corrección excepcional de Dirección con motivo y recálculo, separada del botón normal |
| DOC-01 | **MISSING** | `shared/.../activity.enum.ts:15`; `constancies.service.ts:266-326` | No existe el tipo GENERAL/INDIVIDUAL ni la entrega automática al cumplirse `FINISHED` y la lista cerrada (I02, I09) |
| DOC-02 | **INCORRECT** | `constancies.service.ts:233,295-298` | Reentregar **cambia el archivo o el código en silencio**, sin versión (I05) |
| DOC-03 | PARTIAL | `constancies.service.ts:244` | Se puede entregar con la actividad solo publicada: no exige que haya terminado ni que la lista esté cerrada |
| DOC-04 | **INCORRECT** (causa en código) | `web/src/pages/student/Evidences.tsx:414-416` | «Ver certificado» es un `<a href>` simple hacia `/api/files/...`: no lleva la sesión y apunta al origen de la web. `components/ArchivoProtegido.tsx:7-12` documenta ese mismo fallo y su solución (`BotonArchivo`). Es el defecto de la p. 14 (I06) |
| DOC-05 | ALREADY_CORRECT | `storage/file-access.service.ts:170-190` | La API autoriza el archivo a su titular, a quien lo entregó, a Dirección y a Admin. Hay que probar el acceso cruzado (I07) |
| DOC-06 | ALREADY_CORRECT | `constancies.service.ts:239-241` | Admin no entrega documentos académicos |

## 7. Registros verificables propios (§7; V7-6)

Todo lo que sigue es **MISSING** (la retirada no se ha hecho) salvo donde se indica. El módulo está **aislado**: ningún otro módulo de la API lo llama.

| ID | Superficie | Evidencia |
|---|---|---|
| VER-01 | Rutas web públicas `/verificar` y `/verificar/:code` | `App.tsx:118-119`, `pages/VerifyCredential.tsx` |
| VER-02 | Enlaces de la landing | `LandingPage.tsx:203,509` |
| VER-03 | Menú de Dirección y de Admin | `navigation.ts:133,187`; `App.tsx:189,230`; `director/VerifiableCredentials.tsx` |
| VER-04 | Pestaña del estudiante | `student/Evidences.tsx:1,386`; `components/RegistrosVerificables.tsx` |
| VER-05 | Móvil | `mobile/src/screens/student/EvidencesScreen.tsx:30,346`; `mobile/src/components/RegistrosVerificables.tsx`; `mobile/src/services/index.ts` |
| VER-06 | API autenticada: emitir, política, registro, suspender, levantar, revocar, descargar PDF/QR/OB | `verifiable-credentials/credentials.controller.ts:35-118` |
| VER-07 | API pública: issuer, keys, status, ledger, OB2, verify, verify-file, verify-batch, `:code` | `public-credentials.controller.ts:53-175` |
| VER-08 | Datos | Tablas `verifiable_credentials`, `credential_ledger`, `credential_signing_keys`, `credential_issuance_policies` (2 registros vigentes, política activada). **Se conservan** |
| VER-09 | ALREADY_CORRECT | El QR del perfil, los tokens de activación y la lectura de QR externos (V9) no dependen del módulo |
| VER-10 | NEEDS_TEST | Respuesta neutra 410/404 en `/verificar` y en `public/credentials/:code` (V02) |

## 8. Proyectos (§8; V7-7)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| PROY-01 | **INCORRECT** (causa en código) | `project-readiness.rules.ts:81`; `components/ProjectReadiness.tsx:10-23` | La API puede exigir `skill_per_area`, pero la lista de la web no tiene esa fila ni la agrupa. Resultado: los 8 ítems salen en verde y el botón queda deshabilitado sin explicar por qué (p. 12, P01) |
| PROY-02 | **INCORRECT** (probable) | `ProjectReadiness.tsx:43-44` | La lista se carga solo al montar (`[projectId]`). Tras agregar evidencia, integrantes o contribución no se vuelve a pedir y queda desactualizada |
| PROY-03 | ALREADY_CORRECT | `project-readiness.rules.ts:72-103`; `projects.service.ts:645-725` | Mínimos V6, borrador incompleto permitido, GitHub caído = aviso que no bloquea (P03, P04, P05, P09) |
| PROY-04 | **INCORRECT** (causa en código) | `projects.service.ts:541-555` | `syncSkillEvidence` usa las señales **guardadas** sin `recruzar`. Si GitHub detectó Python antes de que se declarara, la señal queda «DETECTED» y el chip sigue gris hasta un escaneo nuevo (p. 26, P07) |
| PROY-05 | PARTIAL | `projects.service.ts:546-549` | El cruce compara solo el nombre normalizado de la tecnología, no sus alias del catálogo (P08) |
| PROY-06 | ALREADY_CORRECT | `repository-inspector.service.ts:115-213` | Estados declarada / detectada / ambas y «sin comprobar» sin acusar. Sugerencias con procedencia (P06, P09) |
| PROY-07 | **INCORRECT** | `student/Projects.tsx:932-934` | El enlace rojo «Abrir» de evidencias sigue en Proyectos (P11) |
| PROY-08 | ALREADY_CORRECT | `project-gallery.controller.ts:33-43` | Proyectos de la carrera lista solo ACTIVE visibles, sin evidencias (P12, H10) |

## 9. Perfil y explicación de Afinidad (§9; V7-8, V7-9)

**Fórmula real vigente** (motor V4, `affinity.engine.ts` + `shared/src/enums/affinity-engine.ts`):
- Por área: actividad confirmada 10 · proyecto corroborado 18 · proyecto revisado 22 · credencial corroborada 15. Lo declarado y lo SUPPORTED suman 0 (`affinity-engine.ts:160-164`).
- Repetición: actividades ×1 / 0,7 / 0,5 / 0,3; proyectos y credenciales ×1 / 0,75 / 0,5 / 0,25.
- Topes por familia 25 / 50 / 25. Afinidad = round(mín(100, suma)).
- Niveles: Baja 0–24 · Media 25–59 · Alta 60–100.
- Respaldo aparte: topes 20 / 45 / 25 / 10. Para «alto» se exigen al menos 2 familias.
- No hay decaimiento por tiempo.

V7-8 entrega esta tabla con ejemplos ejecutados.

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| PERF-01 | **INCORRECT** | `affinity.engine.ts:483-530` | No filtra por resultado: las 3.207 confirmadas en «Sin resultado» suman (D04, I01, I10) |
| PERF-02 | **INCORRECT** | `backed-skills.service.ts:63-70,72-81` | Tecnologías respaldadas: entran actividades «Sin resultado» y credenciales con respaldo solo automático (SUPPORTED o CORROBORATED). Falta exigir revisión humana (M08) |
| PERF-03 | PARTIAL | `backed-skills.service.ts:52-61` | En proyectos no exige que esa tecnología tenga señal técnica del repositorio, y no filtra por proyecto ACTIVE |
| PERF-04 | **INCORRECT** | `trajectory/cv-eligibility.rules.ts:26-27` | El resumen exportable incluye actividades «Sin resultado» (I10, R04) |
| PERF-05 | PARTIAL | `student/Affinity.tsx:248-280` | «Cómo se calcula» muestra la tabla técnica de reglas: buscador, códigos y señales de 0 puntos. Falta la explicación simple y ejemplos (p. 18-19, M06) |
| PERF-06 | ALREADY_CORRECT | `student/Profile.tsx:621-637` | Las tecnologías respaldadas no se editan a mano |
| PERF-07 | **INCORRECT** (menor) | `Profile.tsx:631` | La descripción de la fuente muestra «actividad» también para las credenciales |
| PERF-08 | **INCORRECT** (menor) | `teacher/Students.tsx:231` | Se ve «prioridad N» en la vista docente (§9 pide ocultarlo) |

## 10. Recomendador (§10; V7-8, D06)

**Fórmula real vigente** (`recommendation.rules.ts:27-60`, `recommendations.engine.ts`):
- Intereses de área: 40 × factor de prioridad. «Mucho» = 1, «Bastante» = 0,8, «Un poco» = 0,6 (`Declarations.tsx:18-29`).
- Interés en texto libre: ×0,5.
- Áreas de mejora: 30. Tecnologías: 15 (vínculo ×0,6, texto ×0,4). Orientación confirmada: 10.
- Umbral mínimo 10. Sin ninguna señal declarada, el puntaje es 0 y no se recomienda nada (`engine:440`).
- Clics, favoritos e inscripciones = 0 (`feedback: 0`).
- El refuerzo por régimen basado en afinidad está **anulado** (`engine:501-514`): el orden no depende de la afinidad.

| ID | Clasif. | Detalle |
|---|---|---|
| REC-01 | ALREADY_CORRECT | No hay señal de clic. «Me interesa» se retiró de actividades en web y móvil (`student/Activities.tsx:341`, `ActivitiesScreen.tsx:494`) (M04) |
| REC-02 | ALREADY_CORRECT | Tres intensidades ordenan: Mucho > Bastante > Un poco (M01). La escala difiere de la propuesta §10.3, pero **no se cambia sin D06** |
| REC-03 | NEEDS_TEST | Fixtures de §10.4: solo tecnología, solo mejora, alias, sin preferencias, interés del test ya confirmado (M02, M03, M05) |
| REC-04 | NEEDS_DECISION (D06) | Hay que decidir si se adopta §10.3 (65 interés / 35 mejora) o se mantiene la fórmula actual y solo se explica mejor |

## 11. Filtros de Biblioteca y Proyectos de la carrera (§11; V7-9)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| FILT-01 | **MISSING** | `library/library.controller.ts:28-45` | No hay filtro por publicador (`created_by`) (B01) |
| FILT-02 | **MISSING** | `projects/project-gallery.controller.ts:33-43`; `pages/CareerProjects.tsx:148-173` | No hay filtro por responsable del proyecto (B02). Búsqueda, Limpiar y paginación del servidor ya existen |

## 12. Contactos, QR, canales y equipos (§12; V7-10)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| CONT-01 | **INCORRECT** | `collaboration/contacts.service.ts:335-352` | Busca con `ILIKE` sobre la cadena «nombre apellido» completa: «Quispe, Ana» no encuentra a Ana Quispe. No normaliza tildes (T01, T02). Ya cumple: mínimo 3 letras, 10 resultados, consentimiento y excluirse a sí mismo |
| CONT-02 | **INCORRECT** | `student/Collaboration.tsx:449-454,475` | La web mantiene «Nombre o identificador» y «Pega aquí el identificador» (T03) |
| CONT-03 | **MISSING** | `mobile/` (sin `expo-camera` ni lector de códigos) | No se puede escanear el QR con la cámara del móvil (T04, T05) |
| CONT-04 | ALREADY_CORRECT | `collaboration/contact-channel.rules.ts:32-63` | Los canales abren `mailto:`, `wa.me`, Teams y LinkedIn validados. Afinia no envía nada (T07, T08) |
| CONT-05 | ALREADY_CORRECT (D08) | `entities/contact-channel.entity.ts:53-83` | Las notas privadas (alias, contexto, canal preferido) se conservan |
| CONT-06 | PARTIAL | `Collaboration.tsx:862,895,1062,1237` | Las cuatro secciones de equipos están apiladas, sin pestañas ni paginación (T09) |

## 13. Inicio de Dirección (§13; V7-12)

| ID | Clasif. | Evidencia | Detalle |
|---|---|---|---|
| DIR-01 | **MISSING** | `director/Dashboard.tsx:24-37,70` | Las tarjetas son enlaces directos, sin modal de detalles ni filtros (H12) |
| DIR-02 | **INCORRECT** | `Dashboard.tsx:36`; `reports/home-overview.service.ts:58,81` | «Credenciales en revisión» cuenta solo la revisión excepcional. Con D01 debe contar todas las pendientes de decisión |
| DIR-03 | **INCORRECT** | `navigation.ts:133` | «Registros verificables» en el menú de Dirección (V7-6) |
| DIR-04 | ALREADY_CORRECT | `director/Analytics.tsx` | Las pestañas de analítica existen y aceptan `?tab=` |

---

## 14. Contradicciones y riesgos que se reportan (§0.8)

1. **V8 contra V7.1.** El 18/11 el usuario eligió «Registro verificable + interruptor» (ND-01), commit `f822e75`. V7.1, del 25/11, lo retira. Por la precedencia del contrato gana V7.1. El commit queda en la historia y las tablas se conservan.
2. **V9 contra «siempre revisión humana».** Las capas de V9 (forense, QR, Credly, correos comprobados) se quedan **como ayuda a la revisión**. Lo que cambia es que ya no deciden: no más `AUTO_VERIFIED` ni CORROBORATED automático para casos nuevos.
3. **Nombre «V7».** `feature/afinia-v7-redisenio` fue el rediseño visual. Esta es la V7.1 de correcciones. Los documentos se llaman V7 como pide §0.5.
4. **Datos.** Las cifras de §1.4 son de desarrollo. Si hay una base publicada (Railway) o la de un compañero, hay que inventariarla antes de V7-2, V7-4, V7-5 y V7-8.
5. **Documento de grado.** No se modifica (§17). Al cierre se entregará la lista de diferencias para que los autores decidan.

## 15. Puntos que necesitan autorización antes de su batch

| # | Batch | Pregunta | Propuesta conservadora |
|---|---|---|---|
| 1 | V7-2/8 | D04 cambia la afinidad de las participaciones confirmadas en actividades «Sin resultado» (3.207 en desarrollo). ¿Se autoriza un recálculo controlado? | Aplicar la regla al calcular, presentar antes un informe de impacto (antes y después por estudiante) y recalcular solo con permiso. Sin borrar nada |
| 2 | V7-2 | ¿Qué cuenta en D04 la política histórica `internal_constancy` (996 constancias)? | Tratarla como «Solo participación», que es lo que ya dice la UI («La asistencia registrada queda en tu trayectoria») |
| 3 | V7-4 | 271 vinculadas corroboradas por la máquina | No tocarlas (C23). La regla de revisión humana rige para las nuevas. Opcional: marcarlas «sin revisión humana» solo como etiqueta |
| 4 | V7-2 | 76 aprobadas en borrador, todas vencidas | No abrir ninguna. Solo reportarlas |
| 5 | V7-6 | Enlaces `/verificar/:code` ya compartidos | Responder 410 con un texto neutro, sin datos personales |
| 6 | V7-8 | D06: ¿fórmula §10.3 o mantener la actual? | Mantener la actual y mejorar la explicación |
| 7 | V7-3 | D08: ¿la histórica sigue sin exigir archivo? Y el bloqueo por nombre repetido (CRED-10) | Mantener la política actual. Documentarla en la ayuda |

## 16. Matriz de aceptación — estado inicial

Es el estado deducido del código. **No es un PASS**: cada escenario se ejecuta en su batch y se cierra en V7-13.

| IDs | Estado inicial | Hallazgos |
|---|---|---|
| G01, G02 | PASS (ejecutado en V7-0) | §0 |
| F01–F05 | FAIL esperado | FIL-01…07 |
| A01, A02, A04, A05 | Correcto en código; falta prueba | PUB-02/03/09 |
| A03, A13, A14 | FAIL esperado | PUB-01, PUB-07 |
| A06, A15 | Correcto en código; falta prueba | PUB-04/05 |
| A16 | Parcial | PUB-05/06 |
| A07–A09 | Correcto desde V6; regresión pendiente | V6-1/V6-2 |
| A10 | FAIL esperado | ASI-02 |
| A11, A12 | Correcto en código | ASI-01 |
| C01, C02, C07, C25 | FAIL esperado (procesamiento automático) | CRED-09 |
| C03, C04, C06 | FAIL esperado | CRED-06, CRED-08 |
| C05, C18 | Correcto en código | CRED-07 |
| C08–C13, C15, C16 | Ayudas V9 presentes; falta adaptarlas a «solo ayuda» | CRED-11 |
| C14, C17, C20–C24 | FAIL esperado | CRED-01…05 |
| C26–C28 | FAIL esperado | CRED-12, CRED-14 |
| I01, I10, I11 | FAIL esperado | PERF-01, PERF-04 |
| I02–I05, I09 | FAIL / MISSING | DOC-01…03 |
| I06 | FAIL esperado | DOC-04 |
| I07, I08 | Por probar | DOC-05 |
| V01–V03, V05 | FAIL esperado (sin retirar) | VER-01…08 |
| V04 | Correcto en código | VER-09 |
| P01 | FAIL esperado | PROY-01/02 |
| P02–P05, P09, P10, P12 | Correcto en código; falta prueba | PROY-03/06/08 |
| P06–P08 | FAIL / parcial | PROY-04/05 |
| P11 | FAIL esperado | PROY-07 |
| M01, M04 | Correcto | REC-01/02 |
| M02, M03, M05 | Por probar | REC-03 |
| M06, M07 | Parcial | PERF-05 |
| M08, M09 | FAIL esperado | PERF-02/03 |
| B01, B02 | MISSING | FILT-01/02 |
| T01–T03 | FAIL esperado | CONT-01/02 |
| T04, T05 | MISSING | CONT-03 |
| T06–T08, T10 | Correcto en código; falta prueba | CONT-04/05 |
| T09 | Parcial | CONT-06 |
| H01–H14 | MISSING / FAIL esperado | ADM-01…11, DIR-01…03 |
| R01–R05 | Regresión pendiente (V7-13) | Línea base §0 |
