# Auditoría de brechas — Afinia frente a la Especificación Maestra V3.1

**Fecha:** 06/10/2026 · **Rama:** `feat/afinia-v2` · **Commit base:** `9c95580`
**Fuente de verdad:** `AFINIA_ESPECIFICACION_MAESTRA_FINAL_V3_1_2026-10-06.md` (V3.1)
**Batch:** 0 — Baseline V3 (sin cambios funcionales)

Clasificación de cada punto (V3 §2.6):

| Etiqueta | Significado |
|---|---|
| **IMPLEMENTADO** | Coincide con V3. |
| **INCORRECTO** | Existe, pero hace otra cosa que V3. |
| **PARCIAL** | Existe una parte; falta otra. |
| **FALTANTE** | No existe. |
| **OBSOLETO** | Existe y V3 pide retirarlo o reemplazarlo. |

---

## 1. Línea base técnica (ejecutada)

| Comprobación | Resultado |
|---|---|
| `git status` | Limpio salvo la especificación V3.1 (sin versionar) y los dos scripts de demostración que no se versionan por decisión del propietario. |
| Build `shared` | OK |
| `tsc` + build `api` | OK |
| `tsc` + build `web` | OK |
| `tsc` `mobile` | OK |
| Migraciones | 38 archivos, 38 aplicadas, **0 pendientes** |
| Pruebas unitarias (`npm run test:unit`) | **36 / 36** |
| Regresión de integración sobre este mismo commit (`9c95580`, 05/10/2026) | **1421 comprobaciones, 0 fallos**, 19 suites |

Inventario: **66 tablas** (46 entidades), **28 controladores**, **52 rutas web**, **15 pantallas móviles** (solo Estudiante).

### Fuentes

- `corregir v2.docx`, citado en V3 §1, **no está en el repositorio**. Existe `corregir.docx`, que es la auditoría anterior (etapa 70 %/V2: activación, padrón, semestre, bienvenida) y ya está atendida. V3 declara que integra `corregir v2.docx`; se toma V3 como fuente única.
- Contradicciones V2 ↔ V3 detectadas y resueltas a favor de V3 (§1): pesos de recomendación (35/25/20/10/10 → 40/30/15/10/5, sin afinidad como factor), fuentes de afinidad (V3 sumaba SUPPORTED; V4 no), estados de visibilidad de proyecto, repositorio obligatorio para activar un proyecto (V2 lo hacía opcional).

---

## 2. Brechas por sección de V3

### §6–§8 Actores, código universitario, importación, semestre

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| 5 actores fijos | IMPLEMENTADO | `RolNombre` | — |
| §7 `university_code` en todos los roles, prefijos | IMPLEMENTADO | Migración `1780460000000`, `shared/university-code.ts` (EST/DOC/DIR/ADM) | — |
| §7.1 Importación de **Estudiantes** con preview NEW/UPDATE/UNCHANGED/CONFLICT/INVALID e idempotente | IMPLEMENTADO | `imports.service.ts` | — |
| §7.1 Importación de **Docentes** (`authorized_semesters[]`) | **FALTANTE** | El importador solo conoce estudiantes | 2 |
| §8.1 `current_semester` | IMPLEMENTADO | `users.semester` + copia en perfil | — |
| §8.1 `academic_scope_semesters[]` (arrastre/repetición) | **FALTANTE** | — | 2 |
| §8.2 TeacherScope dentro de Usuarios, sin pantalla aparte | IMPLEMENTADO | Menú «Alcance docente» → `/admin?role=TEACHER` | 2 (quitar entrada duplicada del menú) |

### §9 Taxonomía

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| Área con `code`, `tags`, `description`, estado | IMPLEMENTADO | `academic_areas` | — |
| Skill con `code`, área obligatoria, `aliases[]`, nombres técnicos | IMPLEMENTADO | `skills` | — |
| §9.3 Sugerencia de área **dinámica** (tags de áreas + aliases + skills ya clasificadas) | **PARCIAL** | `classifySkill` usa reglas canónicas fijas + tags; no consulta las skills ya clasificadas | 4 |
| §9.4 Colisiones de tags entre áreas, tags genéricas, confirmación | **PARCIAL** | Bloquea duplicados exactos; no muestra áreas que comparten tags ni advierte genéricas | 4 |
| §4 Área → solo skills de esa área (formularios) | **PARCIAL** | Existe en algunos formularios; no en actividad, proyecto ni necesidad de equipo con multiárea | 4, 6, 10, 17 |

### §10 Autenticación y correo

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| Flujo provisión → activación (enlace + código) | IMPLEMENTADO | `activation.service.ts` | — |
| TTL y cooldown (48 h, 30 min, 120 s, 5/día) | IMPLEMENTADO | `.env.example` | — |
| `ACTIVATION_CODE_MAX_ATTEMPTS=10` | **PARCIAL** | Verificar valor y variable de entorno | 3 |
| Enlace y código = mismo evento, hashes | IMPLEMENTADO | `account_tokens` | — |
| SMTP real, cola, errores explícitos | IMPLEMENTADO | `mail_jobs`, Gmail probado | — |
| Refresh sin carrera destructiva | IMPLEMENTADO | `710ab6f` (gracia de 60 s, Web Locks) | — |

### §11 Onboarding y perfil

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| Secuencia de bienvenida | IMPLEMENTADO | `Welcome.tsx`, `onboarding` | — |
| §11.1 Perfil en pestañas (Sobre mí / Intereses / Disponibilidad / Visibilidad) | **PARCIAL** | `Profile.tsx` tiene pestañas, pero la privacidad es pantalla aparte (`/student/privacy`) | 5 |
| No duplicar «Intereses» en el menú | **INCORRECTO** | El menú tiene «Preferencias» (`/student/profile?tab=intereses`), además de la ruta `/student/interests` | 5 |
| §11.2 Avatares de catálogo | **FALTANTE** | — | 5 |

### §12–§15 Actividades y oportunidades

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| Universo único INTERNAL / EXTERNAL | **INCORRECTO** | Las externas viven en `learning_resources` y en la categoría `curso_externo_recomendado`; no hay `origin_type` | 6 |
| `internal_type` ACADEMIC / EXTRACURRICULAR | PARCIAL | `ActivityType` mezcla tipo y categoría (ACADEMICA, TALLER_ACADEMICO, CHARLA…) | 6 |
| Multiárea `areas[]` | **FALTANTE** | Un solo `academic_area_id` | 6 |
| `skills[]` | IMPLEMENTADO | `activity_skills` | — |
| Campos de externa (`provider`, `credential_expected`, dominios, keywords) | **FALTANTE** | Solo `external_url` | 6, 8 |
| Revisión: Docente/Sociedad → Director; Director/Admin `NOT_REQUIRED` | IMPLEMENTADO | `requiereRevision(role)`, `ActivityReviewStatus` | 6 (verificar Admin + responsable) |
| §6.5/§12.2 Admin crea de forma excepcional **con responsable registrado** | PARCIAL | Existe `responsible_user_id`; no se exige al crear como Admin | 6 |
| Lifecycle DRAFT…CANCELLED | IMPLEMENTADO | `ActivityStatus` | — |
| §13 Participación INTERESTED…CANCELLED | IMPLEMENTADO | `RegistrationStatus` | — |
| §13.1 **No** pedir evidencia de asistencia al estudiante | **OBSOLETO** (a retirar) | `evidence_required` en actividades, `activity_evidence` en validación y `/student/evidences` | 7 |
| §14 Política de resultado (NONE / INTERNAL_CONSTANCY / EXTERNAL_CREDENTIAL_EXPECTED / OTHER) | **PARCIAL** | Solo `internal_constancy_enabled` | 7 |
| §14.1 Constancia **automática** al confirmar, emitida por el responsable | **PARCIAL** | Constancia manual con autorización de Dirección | 7 |
| §15 Externa: ACCEPTED → finalizada → EVIDENCE_ELIGIBLE | **FALTANTE** | — | 8 |

### §16–§20 Credenciales externas y validación

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| §16 Credencial histórica sin oportunidad previa, `source = HISTORICAL_EXTERNAL` | PARCIAL | Se registra, pero sin `source` | 8 |
| §17 Referencia de validación para nuevas externas | **FALTANTE** | — | 8 |
| §18.1 QR opcional | IMPLEMENTADO | `metadata.extractor` | — |
| §18.2 URL/QR: estados VERIFIED_MATCH / REACHABLE_NO_STRUCTURED_PROOF / MISMATCH / INCONCLUSIVE / UNREACHABLE | **PARCIAL** | Hoy: `available/unavailable/blocked` + coincidencia de titular | 9 |
| §18.3 Open Badges / VC | **FALTANTE** (opcional) | — | 9 |
| §18.4–18.5 PDF nativo y OCR | IMPLEMENTADO | `pdf-text.ts`, `ocr.port.ts` | — |
| §19 Backing de credencial con **FLAGGED** | **PARCIAL** | `BackingTier` sin FLAGGED | 9 |
| §19/§74 CORROBORATED exige señal verificable fuerte | **INCORRECTO** | Hoy basta con que un enlace responda y la metadata sea coherente | 9 |
| §74 Revisión manual excepcional (histórica sin verificador) | **FALTANTE** | — | 9 |
| §49 SSRF en todas las URL | IMPLEMENTADO | `link-checker.service.ts` (localhost, privados, metadata cloud, DNS) | 9 (extender a QR y credenciales) |

### §21–§30 Proyectos, GitHub, backing, integrantes

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| Estados DRAFT / ACTIVE / ARCHIVED | IMPLEMENTADO | `ProjectStatus` | — |
| §21.2 Multiárea + skills agrupadas por área | **FALTANTE** | Un solo `academic_area_id`; tecnologías como texto | 10 |
| §22 Requisitos para ACTIVE (repo, área, skill, confirmaciones, evidencia contextual) | **FALTANTE** | Hoy un proyecto se activa sin requisitos | 10 |
| §23 Evidencias dentro del proyecto, sin bandeja genérica | **INCORRECTO** | Existe `/student/evidences` como bandeja | 10, 24 |
| §24.2 Languages API | IMPLEMENTADO | `repository-inspector.service.ts` | — |
| §24.3 Leer el contenido de los manifiestos (dependencias → skill) | **PARCIAL** | Solo detecta que el archivo existe | 11 |
| §24.4 Estado por skill (DECLARED / CORROBORATED_BY_…) | **FALTANTE** | — | 11, 13 |
| §24.6 Caché, ETag, rate limit, token opcional | PARCIAL | Token opcional sí; sin caché ni ETag | 11 |
| §26 Demo: accesibilidad y metadata, sin crawler de backend | IMPLEMENTADO | `project_link_checks` | — |
| §27 Capturas: SHA-256, tipo real, duplicados | IMPLEMENTADO | `stored_files` | — |
| §28 Backing de proyecto con REVIEWED y FLAGGED | IMPLEMENTADO | `ProjectBackingTier` | 13 (alinear la regla de CORROBORATED) |
| §30 Confirmación individual de contribución | IMPLEMENTADO | `contribution_confirmed_at` | — |
| §30 Bloquear activación hasta que confirmen todos | **FALTANTE** | — | 12 |
| §30.1 Catálogo controlado de roles de proyecto | **FALTANTE** | — | 12 |
| §31 Usar un equipo al crear el proyecto | **FALTANTE** | Sin `teamId` en el proyecto | 12 |
| §40 Visibilidad PRIVATE / TEAM / TEACHERS / PROFILE / PUBLIC_LINK | **PARCIAL** | Solo private / profile / teachers | 10 |

### §33 Notificaciones

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| Módulo de notificaciones (centro, leído/no leído, dedupe, recordatorios) | **FALTANTE** | No existe tabla ni servicio | 16 |

### §34 Recomendaciones

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| Ponderación 40/30/15/10/5 sin afinidad como factor principal | **INCORRECTO** | 35/25/20/10/10 con afinidad 10 % | 15 |
| `RECOMMENDATION_DISMISSED` reduce lo similar | **PARCIAL** | El estado `dismissed` existe; el motor no lo usa para bajar lo similar | 15 |
| Dentro de Actividades con pestañas [Para ti] [Todas] [Interesadas] [Inscritas] [Historial] | **INCORRECTO** | Pantalla aparte `/student/recommendations` | 15 |

### §35–§38 Afinidad V4 y respaldo

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| `ENGINE_VERSION = 4`, conservar V2/V3 | **FALTANTE** | Versión 3 | 14 |
| Proyecto suma solo si CORROBORATED (18) o REVIEWED (22) | **INCORRECTO** | SUPPORTED suma 10 | 14 |
| Credencial suma solo si CORROBORATED (15) | **INCORRECTO** | SUPPORTED suma 8 | 14 |
| Proyecto: skills **confirmadas y corroboradas** del integrante | PARCIAL | Usa skills confirmadas, sin exigir corroboración | 14 |
| §36 Habilidades respaldadas por área, sin porcentaje | **FALTANTE** | — | 14 |
| §37 Support separado, HIGH exige diversidad | IMPLEMENTADO | `supportScore`, regla de familias | — |
| §38 Sin doble conteo | IMPLEMENTADO | Constancia y evidencia no suman | — |

### §39–§45 Bitácora, privacidad, perfil, trayectoria, currículo

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| §39 Bitácora del proyecto | IMPLEMENTADO | `project_events` | — |
| §41 Perfil resumen seleccionable | PARCIAL | Perfil público con campos configurables | 18 |
| §42 Trayectoria con Declarado / Con respaldo / Corroborado / Revisado / Inconcluso | PARCIAL | Muestra niveles, sin «Inconcluso» unificado | 18 |
| §43 Currículo en **dos niveles** (secciones + ítems concretos) | **INCORRECTO** | Solo secciones y plantillas | 18 |
| §43.3 Solo ítems elegibles | **FALTANTE** | — | 18 |
| §43.4 Vista previa y orden | PARCIAL | Plantillas sin vista previa de ítems | 18 |
| §43.6 Disclaimer | IMPLEMENTADO | `TRAJECTORY_DISCLAIMER` | 18 (alinear texto) |

### §47 IA

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| Adaptador opcional, fallback `none` | IMPLEMENTADO | `api/src/ai` | — |
| Tareas nuevas: AREA_SUGGESTION, EVIDENCE_FIELD_EXTRACTION, SCREENSHOT_CONTEXT_SUMMARY | **FALTANTE** | Hoy: 6 tareas | 9, 13 |

### §50–§54 Paneles por actor

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| §51 Docente: sin «Panel» y «Panel académico» repetidos | **INCORRECTO** | Menú con `Panel` (`/teacher`) y `Panel académico` (`/teacher/reports`) | 20 |
| §52 Director: Analítica con pestañas, sin Panel/Mapa/Tendencias repetidos | **INCORRECTO** | `Panel general`, `Mapa de afinidad`, `Tendencias` por separado | 20 |
| §53 Sociedad: Inicio breve + Métricas interactivas | PARCIAL | `Panel` + `Métricas` | 20 |
| §54 Admin: sin pantalla de Roles, catálogos con asistencia | IMPLEMENTADO (Roles ya no está) | — | 20 |

### §55–§60 Colaboración, gamificación, analítica, perfil público, móvil

| V3 | Estado | Evidencia | Batch |
|---|---|---|---|
| §55 Necesidad con semestres objetivo, áreas → skills, cupos, postulación, motivo de rechazo controlado | PARCIAL | Necesidades y equipos existen; sin semestres objetivo ni motivos controlados | 17 |
| §56 Recomendación de personas explicada | IMPLEMENTADO | `teammateCandidates` | 17 (usar skills corroboradas) |
| §57 Gamificación independiente de afinidad | IMPLEMENTADO | — | 19 (verificar) |
| §59 Perfil público opt-in, slug rotable | IMPLEMENTADO | `/p/:slug` | — |
| §60 Móvil solo Estudiante | IMPLEMENTADO | — | 22 (notificaciones, trayectoria) |

### §65 Auditoría

Faltan como evento de auditoría (algunos existen solo en `project_events`):
`ACTIVITY_REGISTERED`, `EXTERNAL_OPPORTUNITY_ACCEPTED`, `EXTERNAL_EVIDENCE_ENABLED`, `EXTERNAL_CREDENTIAL_CREATED`, `EXTERNAL_CREDENTIAL_CHECKED`, `EXTERNAL_CREDENTIAL_MANUAL_REVIEWED`, `PROJECT_CREATED`, `PROJECT_ACTIVATED`, `MEMBER_INVITED`, `MEMBER_ACCEPTED`, `CONTRIBUTION_CONFIRMED`, `PROJECT_EVIDENCE_ADDED`, `REPOSITORY_CHECKED`, `DEMO_CHECKED`, `PROJECT_BACKING_CHANGED`, `AFFINITY_RECALCULATED`, `CONTACT_ACCEPTED`, `TEAM_APPLICATION_CREATED`, `TEAM_MEMBER_ACCEPTED`, `CURRICULUM_EXPORTED`.
Se agregan en el batch del módulo que los produce.

---

## 3. Resumen

90 puntos de V3 contrastados con el código:

| Estado | Puntos |
|---|---|
| IMPLEMENTADO | 36 |
| PARCIAL | 22 |
| INCORRECTO | 11 |
| FALTANTE | 20 |
| OBSOLETO | 1 (evidencia self-service de actividad interna) |

Además, 20 eventos de auditoría de §65 (ver arriba).

Lo más grande, por impacto: el modelo unificado de oportunidades (B6), las oportunidades externas con elegibilidad y la validación de credenciales (B8–B9), los requisitos de proyecto y GitHub con dependencias (B10–B13), la Afinidad V4 (B14), las notificaciones (B16) y el currículo en dos niveles (B18).

---

## 4. Estado al cierre (BATCH 24, 2026-10-07)

Los 90 puntos de la tabla del §3 quedaron atendidos en los batches 1 a 24. El detalle, con pruebas y resultados, está en [`docs/V3_REPORTE_BATCHES.md`](docs/V3_REPORTE_BATCHES.md).

| Estado inicial | Puntos | Al cierre |
|---|---|---|
| IMPLEMENTADO | 36 | Conservado; las suites V1/V2 se actualizaron a V3 donde la especificación cambió el comportamiento, sin borrar comprobaciones |
| PARCIAL | 22 | Completado |
| INCORRECTO | 11 | Corregido. Ejemplos: afinidad V4, recomendaciones sin afinidad, gamificación sin borradores ni contactos, descargo del currículo |
| FALTANTE | 20 | Implementado. Ejemplos: notificaciones, postulaciones, currículo en dos niveles, trayectoria con niveles, analítica de evolución |
| OBSOLETO | 1 | Retirado: la evidencia autoservicio de actividad interna (B7) y la bandeja genérica de evidencias (B24, §23; los datos anteriores se conservan) |

**Eventos de auditoría de §65:** los 34 eventos mínimos existen y se registran.
- 13 se agregaron en el BATCH 24: `PROJECT_CREATED`, `MEMBER_INVITED`, `MEMBER_ACCEPTED`, `CONTRIBUTION_CONFIRMED`, `PROJECT_EVIDENCE_ADDED`, `REPOSITORY_CHECKED`, `DEMO_CHECKED`, `PROJECT_BACKING_CHANGED`, `AFFINITY_RECALCULATED`, `CONTACT_ACCEPTED`, `TEAM_APPLICATION_CREATED`, `TEAM_MEMBER_ACCEPTED`, `CURRICULUM_EXPORTED`.
- `FEEDBACK_ADDED` existía en el catálogo, pero solo se escribía en la bitácora del proyecto; ahora también va a la auditoría.

**Fuera del alcance por decisión de la especificación (§75):**
- OCR de capturas para certificar el stack.
- Recorrer una demo para inferir tecnologías.
- IA como autenticadora final.
- Puntaje de «dominio» por habilidad.
- Malla curricular.
- Chat.

**Pendientes que requieren algo externo al código:**
- Ejecutar el flujo Maestro en un dispositivo.
- La prueba SUS con participantes.
- La migración a NestJS 11/12 para cerrar 4 avisos «altos» de dependencias, hoy mitigados.
- Aplicar al `.docx` la guía [`docs/CAMBIOS_DOCUMENTO_GRADO_V3.md`](docs/CAMBIOS_DOCUMENTO_GRADO_V3.md).
