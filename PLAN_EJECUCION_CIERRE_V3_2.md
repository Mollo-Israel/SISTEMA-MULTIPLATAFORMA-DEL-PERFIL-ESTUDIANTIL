# Plan de ejecución — Cierre final V3.2

Rama `feat/afinia-v3-2`. Un commit por batch, siempre después de una regresión completa. Migraciones con `up` y `down` y respaldo `pg_dump` previo cuando transforman datos. Nunca `synchronize`. Todo lo que ya funciona se **preserva** y se cubre con regresión (§72: auditar → preservar → corregir → migrar → probar → documentar).

Cada batch deja su reporte en `docs/V3_2_REPORTE_BATCHES.md`, con el formato de §76, y sus pruebas en `scripts/e2e-v3-2.mjs` (`batchN`).

| Batch | Qué se hace | Archivos y migraciones previstos |
|---|---|---|
| **0** Baseline | Este GAP y este plan; builds, unitarias, migraciones y regresión de base | `AUDITORIA_GAP_CIERRE_V3_2.md`, `PLAN_EJECUCION_CIERRE_V3_2.md` |
| **1** Importación y usuarios | Previsualización temporal: el historial muestra APPLIED/FAILED; las previsualizaciones se limpian por TTL y al descartar (C2). Resumen completo al aplicar (§7.3). Validación de filas con menos o más columnas (§7.6). Usuarios con búsqueda al teclear y «Limpiar» (§7.7). Componente común de **paginación de 10 filas** con orden y contador (§6.1), aplicado primero a Usuarios e Importaciones. Expiración visible de la invitación (§8.6). | `api/src/imports/*`, `csv.parser.ts`; `web/src/components/ui.tsx` (`Paginacion`, `usePaginacion`); `pages/admin/Users.tsx`, `Imports.tsx`; `users.service` (expiración) |
| **2** Activación y sesión | ACTIVE: estado controlado sin correo (C3). Cooldown con lo que queda en el servidor (§8.4). Sin pestaña «Tengo el enlace» en producción (§8.2). Demo multirrol documentada. | `identity/activation.service.ts`, `account-mail.service.ts`; `pages/auth/SetPasswordPage.tsx`, `RequestTokenPage.tsx`; `.env.example` |
| **3** Taxonomía | Sugeridor V3.2 (exacto → tag → relacionadas → débil), sin regla fija que bloquee (C5). Tokens cortos solo exactos. Aviso de etiqueta que duplica una skill (C4). **Áreas secundarias** de una skill. Etiquetas sembradas reemplazadas por vocabulario semántico. Área «Computación en la nube». Textos de ayuda de §B3. | Migración `V32SkillSecondaryAreas` (`skill_area_relations`) y migración de datos `V32SemanticAreaTags` (con respaldo); `catalogs/skill-classification.ts`, `catalogs.service.ts`; `pages/admin/AreasSkills.tsx`; `AreaSkillPicker` (relacionadas) |
| **4** Actividades: integridad | Edición multiárea sin `NULL` y en transacción (C6). Skills que se conservan (C7). Contexto área+skill (§11.4). | Migración `V32ActivitySkillContext` (`activity_skills.academic_area_id`); `activities.service.ts` (create y update transaccionales) |
| **5** Formulario y estados | Inicio y fin; título no solo símbolos; modalidad condicional (`location` / `meeting_url`); `resource_links[]`; imagen; responsables múltiples y contactos con combobox buscable; cupo; acciones **Guardar borrador / Publicar / Enviar a revisión**; motivo de cancelación; cierre y fin automáticos; sin etiquetas manuales (`search_keywords` derivadas); resultado PARTICIPATION_ONLY e INSTITUTION_ISSUED_CERTIFICATE; externa sin selector de resultado; zona horaria (C11). | Migración `V32ActivityFields` (`meeting_url`, `resource_links`, `image_file_id`, `cancellation_reason`, `updated_by`, `activity_responsibles`, `activity_contacts`, valores de `outcome_policy`); `activities.service.ts`, DTO; `ActivityManager.tsx`; tarea de ciclo de vida |
| **6** Revisión, ownership, permisos | Borradores privados (C9), cancelar envío, aprobada inmutable para el creador (C10), gestión de Dirección con filtro por tipo, «Mis actividades» vs «de la carrera», avisos `ACTIVITY_REVIEW_*`. Pruebas cruzadas con los cinco roles. | `activities.service.ts` (`filtrarGestionables`, `findAll`), `activities.controller.ts` (`cancel-submission`); `director/Activities.tsx` |
| **7** Cards, participantes, UX | Cards de alto fijo con descripción truncada, imagen, fin, áreas «+2» y detalle (C16); participantes paginados y filtrables (C17); parpadeo de modales; fechas. | `student/Activities.tsx`, `ActivityManager.tsx`, `index.css` |
| **8** Resultados internos y externos | Constancia, certificado emitido por la institución (emisor real), credencial esperada; flujo externo fijo. | `constancies/*`, `activities.service.ts`, `credential-eligibility.*` |
| **9** Biblioteca | Recursos para el estudiante: buscar, filtrar por área o skill, abrir, favorito; recomendados; proveedor e imagen; sin afinidad. | Migración `V32ResourceLibrary` (`learning_resource_favorites`, `provider`, `image`); `catalogs` y `recommendations`; `student/Library.tsx`; móvil |
| **10** Perfil y recomendaciones | Favorito de recurso con peso bajo; «Me interesa» no alimenta el modelo; favorito en una actividad pasada. | `recommendation.rules.ts`, `recommendations.engine.ts` |
| **11** Proyectos y contexto | Contexto área+skill en proyectos; mensajes de validación. | Migración `V32ProjectSkillContext`; `projects.service.ts`; formulario de proyecto |
| **12** GitHub, demo, respaldo | Procedencia de skills; verificar lo existente; sin rastreador. | `projects/*` (verificación) |
| **13** Equipos y notificaciones | Verificar y completar; alinear `PROJECT_CONFIRMATION_REQUIRED`. | `notifications`, `projects` |
| **14** Credenciales externas | OCR o fallo → INCONCLUSIVE, PDF nativo, revisión manual histórica; contexto área+skill. | `validation/*`; migración de contexto en `external_certificate_skills` |
| **15** Afinidad V4 contextual | El área sale del contexto de la experiencia; nada de etiquetas; sin multiplicar; explicabilidad; instantáneas versionadas. | `affinity-recalc/affinity.engine.ts`; `AFFINITY_ENGINE_VERSION` 5 |
| **16** Docente | Verificar el nombre «Actividades de la carrera» y que no haya duplicados. | `navigation.ts`, `teacher/Panel.tsx` |
| **17** Dirección y Sociedad | Gestión de aprobadas; Sociedad sin «Crear actividad» aparte; profundizar en métricas; edición bloqueada tras aprobar. | `navigation.ts`, `society/*`, `director/*` |
| **18** Administración | Auditoría humana (Actor, Módulo, Acción, Fecha, Resultado; filtros que funcionan); correo técnico fuera del menú; ayuda por rol con imágenes y video; grids y botones globales. | `admin/Audit.tsx`, `audit.controller`, `navigation.ts`, `help/content.ts` |
| **19** Trayectoria, privacidad, QR, currículo | Verificación (V3.1 B18) más los ajustes de contexto. | — |
| **20** Móvil | Biblioteca, actividades con fin, imagen y enlaces; `expo-doctor`. | `mobile/src/*` |
| **21** QA final | Unitarias, integración, e2e, permisos negativos, CORS y sesión, archivos, SSRF, fallos de GitHub, SMTP y OCR, pantallas angostas, usabilidad. No se afirma lo que no se ejecute. | `scripts/*`, `docs/V3_2_QA.md` |
| **22** Limpieza y documentación | Retirar lo redundante; Swagger, README, `.env.example`, diagramas, guía de los capítulos II y III, trazabilidad. | `docs/*` |

**Orden de dependencias:**
- B3 (secundarias) antes de B4, B11, B14 y B15 (contexto).
- B4 antes de B5 y B6.
- B5 (responsables) antes de B6 (ownership).
- B9 antes de B10 (favoritos).

**Compatibilidad:** sin borrar datos.
- `activities.tags` se conserva como columna histórica y deja de pedirse.
- `external_url` sigue siendo el enlace oficial de las externas.
- `responsible_user_id` pasa a ser el «responsable principal», y la tabla nueva suma los demás.
