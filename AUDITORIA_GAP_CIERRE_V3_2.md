# Auditoría de brechas — Cierre final V3.2

**Fecha:** 12 de octubre de 2026.

**Rama:** `feat/afinia-v3-2`, creada desde `feat/afinia-v3` (`bd338c7`, cierre de V3.1).

**Fuente de verdad:** `AFINIA_CIERRE_FINAL_V3_2_AJUSTES_CLAUDE_CODE_2026-10-12.md`.

**Método (§75):** «verificar primero → cambiar después».
- Cada punto se contrastó con el código y, cuando era posible, con la **API en marcha**.
- Las sondas de los defectos críticos se ejecutaron contra la API real con PostgreSQL. Están en `scripts/` del scratchpad de la sesión y se reproducen en las pruebas del batch correspondiente.

**Fuentes:** de los documentos citados en §0 solo `corregir.docx` (v1) está en el repositorio. `corregir v2.docx` y `corregir v3.docx` no lo están; sus observaciones se toman tal como las resume V3.2.

**Estados usados:** `IMPLEMENTED` (preservar), `INCORRECT`, `PARTIAL`, `MISSING`, `OBSOLETE` (retirar), `REGRESSION`.

---

## 1. Línea base técnica (ejecutada)

| Comprobación | Resultado |
|---|---|
| `shared` build | correcto |
| API `tsc --noEmit` | sin errores |
| Web `vite build` | correcto |
| Móvil `tsc --noEmit` | sin errores |
| Unitarias | 99/99 |
| Migraciones pendientes | 0 (81 aplicadas; la última es `V3TeamApplications1780590000000`) |
| Regresión completa (20 suites) | **1821 correctas, 1 fallo** (B10.36: la prueba tiene un tope fijo de 900 estudiantes y la base de desarrollo ya tiene 916; es un artefacto de la prueba, no un defecto; se corrige en B1) |

---

## 2. Defectos críticos de §68 — verificados con la API real

| # | Defecto | Estado | Evidencia |
|---|---|---|---|
| C1 | La importación bloquea filas válidas por inválidas | **INCORRECT (causa hallada en la web)** | La API sí aplica parcialmente: `ImportsService.apply` toca solo NEW y UPDATE. Pero la API devuelve los conteos y estados en minúsculas (`{"new": 1, ...}`) y la web los lee en mayúsculas (`counts.NEW`, `ESTADO_LOTE.APPLIED`). Por eso «Aplicar (n)» calcula **0 y queda deshabilitado siempre**: ningún padrón se aplica desde la web, y los veredictos y estados se muestran sin traducir. Falta además el resumen completo de §7.3. |
| C2 | La previsualización llena el historial de basura | **INCORRECT** | `GET /imports/students` devuelve `previewed: 6, discarded: 3, applied: 11`. Las previsualizaciones descartadas o abandonadas quedan como historial y no hay limpieza por TTL. |
| C3 | Activación pedida para una cuenta ACTIVE | **INCORRECT** | Para una cuenta activa responde 200 con «te enviamos un mensaje». No encola nada (bien), pero afirma un envío y no orienta a Login o Recuperación. |
| C4 | Tags y skills con responsabilidades confusas | **INCORRECT** | Las etiquetas sembradas repiten habilidades (`Bases de Datos: sql, postgresql, mongodb`; `Desarrollo Web: react, node, html, css`; `IA: python`; `Redes: linux, infraestructura`), justo lo que §10.3 pide evitar. |
| C5 | El sugeridor propone `aws → Redes` | **INCORRECT (reproducido)** | `GET /skills/classify?name=Amazon Web Services&aliases=aws` devuelve `rule: canonical, Redes`. Causa: la tabla fija `aws → infraestructura` se aplica **antes** que el catálogo, y `tagOfArea(Redes)` resuelve a `infraestructura` por la etiqueta del área. Además la regla canónica **bloquea** guardar en otra área, contra §10.6 («Admin decide»). |
| C6 | Actividad multiárea falla con `activity_id NULL` | **INCORRECT (reproducido)** | Un `PATCH /activities/:id` con 3 áreas devuelve **500** `null value in column "activity_id" of relation "activity_areas"` en `ActivitiesService.update` (línea 912): se guarda la actividad con la relación vieja cargada. No es transaccional: quedan áreas escritas a medias. |
| C7 | Las skills no persisten en la actividad | **PARTIAL** | Al crear sí persisten las dos habilidades. Al editar se pierden por el 500 de C6. Falta el contexto área+skill (§11.4). |
| C8 | Ownership Admin/Director/Docente mezclado | **PARTIAL** | La API exige que Administración nombre un responsable y conserva `creator_id`. Falta separar creador, responsable(s) y contacto (§16): hay un único `responsible_user_id`. «Mis actividades» del Docente incluye lo que solo gestiona. Se completa en B5 y B6. |
| C9 | Borrador del Docente visible antes de enviarlo | **INCORRECT (reproducido)** | Un borrador de un docente aparece en `GET /activities` de **otro docente** y de **Dirección**, y en `GET /activities/managed` de Dirección y Administración. |
| C10 | El creador edita después de APPROVED | **INCORRECT (reproducido)** | El `PATCH` del docente creador sobre una actividad aprobada devuelve 200. |
| C11 | La fecha y hora cambian al editar | **INCORRECT (causa hallada)** | La API conserva el instante exacto (16:45Z → 16:45Z). El error está en la web: al editar, `eventDate.slice(0,16)` (UTC) se carga en un `datetime-local` (hora local) y cada guardado suma el desfase (UTC−4 → +4 h). Además el formulario **no tiene fecha de fin**. |
| C12 | Funciones del Docente retiradas | **IMPLEMENTED** | Ya restaurado en V3.1 B20: «Inicio / Panel académico» con Resumen, Por semestre, Estudiantes (alcance), Proyectos visibles, Actividades, Necesidades/equipos; «Mis actividades»; retroalimentación en proyectos. Falta verificar el nombre «Actividades de la carrera» y que no incluya borradores ajenos (depende de C9). |
| C13 | La UI de auditoría es demasiado técnica | **INCORRECT** | `admin/Audit.tsx` muestra y filtra por `eventType`/`entityType` crudos (`USER_PROVISIONED`, `import_batch`). No hay Actor, Módulo, Acción ni Resultado traducidos. |
| C14 | Configuración técnica SMTP visible | **INCORRECT** | El menú de Administración incluye «Correo (configuración técnica)» (`/admin/mail`). No muestra la contraseña (bien), pero es parte del menú ordinario. |
| C15 | Recursos sin propósito claro | **PARTIAL** | Existe el catálogo (`learning_resources`, administrado por Dirección y Administración) y el recomendador puede sugerir recursos. No hay vista **Biblioteca** para el estudiante, ni favorito, ni habilidades del recurso en el estudiante. |
| C16 | Cards desiguales por la descripción | **INCORRECT** | Las cards de actividades muestran la descripción completa (`<p>{a.description}</p>`) sin truncar. |
| C17 | Participantes no responsive | **PARTIAL** | Se verificará a 375 px. La tabla de participantes no tiene paginación ni filtros por estado (§64). |

---

## 3. Matriz por sección

### §5–§6 UX transversal

| Punto | Estado | Nota |
|---|---|---|
| Área → habilidades relacionadas | IMPLEMENTED | `AreaSkillPicker` (B4). Falta mostrar las «Relacionadas con esta área» de las secundarias (§11.3). |
| §6.1 Grids de 10 filas con paginación, orden y contador | **MISSING** | Ninguna de las 23 páginas con tabla pagina. Usuarios, Auditoría, Constancias, Recursos, Categorías, Áreas y skills, Participantes, Imports y otras muestran todo en una página vertical. |
| §6.2 Búsqueda con debounce, sin Enter | **PARTIAL** | Usuarios exige Enter (`setApplied` al enviar el formulario); otras pantallas filtran al teclear. |
| §6.3 Combobox grandes con búsqueda | **PARTIAL** | Hay chips para áreas y habilidades. El responsable de una actividad es un `<select>` sin búsqueda. |
| §6.4 Validación por campo | IMPLEMENTED (V3.1 B21) | Falta «el título no puede contener solo símbolos» y que la fecha final sea posterior a la inicial en la web. |
| §6.5 Modales | IMPLEMENTED | Foco, `prefers-reduced-motion`, columna acotada (V3.1 B21). Se revisará el parpadeo. |
| §6.6 Botones visibles | PARTIAL | «Descargar plantilla» es un enlace de texto en Importar. |

### §7 Usuarios y padrón

| Punto | Estado | Nota |
|---|---|---|
| §7.1 Código universitario único con prefijos | IMPLEMENTED | V3.1 B2 |
| §7.2 Plantillas Estudiantes/Docentes | IMPLEMENTED | V3.1 B2 |
| §7.3 Aplicación parcial | **INCORRECT** (web) | Ver C1 |
| §7.4 Idempotencia | IMPLEMENTED | B2 |
| §7.5 Previsualización temporal e historial limpio | **INCORRECT** | Ver C2 |
| §7.6 CSV inválido (columnas, encabezados, codificación, desplazamiento) | **VERIFY** | Se valida que estén los encabezados; falta comprobar que una fila con menos columnas no desplace valores y que se avise la codificación. |
| §7.7 Buscador automático y «Limpiar» | **INCORRECT** | Ver §6.2 |

### §8 Activación

| Punto | Estado | Nota |
|---|---|---|
| §8.1 Envío, reenvío, enlace, código, expiración, token usado o reemplazado, suspendida | IMPLEMENTED | Cubierto por B1, B2, QA y V2.2 |
| §8.2 Retirar la pestaña «Tengo el enlace» en producción | **INCORRECT** | `SetPasswordPage` muestra las dos pestañas siempre. Debe quedar «Tengo el código» y, cuando llega desde el botón, el token de la URL. |
| §8.3 Cuenta ya activa | **INCORRECT** | Ver C3 |
| §8.4 Cooldown con el estado del servidor | **PARTIAL** | `retryAfterSeconds` es la configuración fija (120), no lo que queda. Cerrar y reabrir reinicia la cuenta atrás en la pantalla. |
| §8.5 Sin prohibición de 48 h | IMPLEMENTED | Cooldown, máximo diario, invalidación del anterior y auditoría |
| §8.6 Admin: enviada, expira y estado | **PARTIAL** | Muestra cuándo se envió, pero **no la expiración** ni «Caducada». |

### §9 Sesión y demo multiactor

| Punto | Estado | Nota |
|---|---|---|
| No hay sesión por pestaña | IMPLEMENTED (decisión) | Se documenta usar perfiles de navegador separados. |
| `created_by`, `updated_by`, `responsible`, `reviewed_by` reales | **PARTIAL** | Faltan `updated_by` en actividades y los responsables múltiples. |

### §10–§12 Taxonomía

| Punto | Estado | Nota |
|---|---|---|
| Área: `code`, `name`, `description`, `tags`, estado | IMPLEMENTED | |
| Skill: `code`, `name`, área principal, `aliases`, estado | IMPLEMENTED | `skills.academic_area_id` como área principal |
| §10.3 Tags solo como metadata semántica, sin duplicar skills | **INCORRECT** | Ver C4: corregir los datos sembrados, avisar en la UI, cambiar textos de ayuda |
| §10.5 Sugeridor dinámico (exacto → tag → relacionadas → débil → nada), sin subcadenas, tokens cortos solo exactos | **INCORRECT** | Ver C5. Hoy la tabla fija va primero y bloquea. |
| §10.6 Protección al crear áreas | PARTIAL | Avisa etiquetas genéricas y compartidas (B4). Falta avisar cuando una etiqueta **duplica una skill**. |
| §11 Áreas secundarias de una skill | **MISSING** | No hay relación skill↔área secundaria |
| §11.3 Formularios: «Relacionadas con esta área» | **MISSING** | |
| §11.4 Contexto área+skill por experiencia | **MISSING** | `activity_skills`, `project_skills` y `external_certificate_skills` no guardan el área de contexto |
| §11.5 / §50.1 La afinidad usa el área del contexto | **PARTIAL** | Un proyecto aporta una vez por área (sin multiplicar, bien). Pero el área sale del área principal de cada skill, no del contexto elegido. |
| §12.2 Recomendador sin tags ni afinidad | IMPLEMENTED | V3.1 B15 |
| §12.3 Afinidad sin tags, alias ni intereses | IMPLEMENTED | V4 (B14). Verificar que no use `area.tags` en ninguna ruta del motor. |

### §13–§28 Actividades

| Punto | Estado | Nota |
|---|---|---|
| §13 Categorías con `applies_to`, sin motor | IMPLEMENTED | |
| §14 Interna (académica o extracurricular) y externa | IMPLEMENTED | V3.1 B6 |
| §15 Quién crea qué | IMPLEMENTED | Docente académica y externa en su alcance; Sociedad extracurricular; Dirección; Administración con responsable |
| §16–§17 Creador ≠ responsable(s) ≠ contacto | **MISSING** | Un solo `responsible_user_id`; no hay responsables múltiples ni contactos (estudiante de contexto sin permisos) |
| §18 Inicio y fin | **PARTIAL** | La API tiene `end_at`; la web no lo pide (C11) |
| §18.1 Modalidad condicional (presencial: ubicación; virtual: enlace; híbrida: ambos) | **MISSING** | No hay `meeting_url` ni validación condicional |
| §18.2 `meeting_url` + `resource_links[]` | **MISSING** | Un único `external_url` |
| §18.3 Imagen | **MISSING** | |
| §19 Varias áreas y varias skills | **INCORRECT** | Ver C6 y C7 |
| §20 Sin etiquetas manuales; `search_keywords` derivadas | **OBSOLETE** | El formulario pide «Etiquetas (separadas por coma)» |
| §21 Ciclo de vida: cierre automático al comenzar, FINISHED automático al terminar, motivo de cancelación | **PARTIAL** | Bloquea la inscripción si la fecha pasó, pero no cambia el estado a CLOSED ni a FINISHED, y no exige motivo al cancelar |
| §22 Acciones explícitas (Guardar borrador / Publicar / Enviar a revisión) | **PARTIAL** | Dirección y Administración publican eligiendo «Estado» en un select del formulario |
| §23 Enviar, aprobar, observar, rechazar | IMPLEMENTED | V2 §27 |
| §23.1 Cancelar envío | **MISSING** | `POST /activities/:id/cancel-submission` responde 404 |
| §23.3 / §63 El creador no edita tras aprobar | **INCORRECT** | Ver C10 |
| §24 Borradores privados del creador | **INCORRECT** | Ver C9 |
| §25 «Mis actividades» vs «Actividades de la carrera» | PARTIAL | Existen las dos vistas para el Docente; la de la carrera muestra borradores ajenos (C9) |
| §26 Dirección: gestión de aprobadas, filtro Académica/Extracurricular/Externa | **PARTIAL** | «Actividades» de Dirección es el gestor de académicas; las extracurriculares aprobadas de Sociedad no tienen ese filtro |
| §27 Participación (solo CONFIRMED es experiencia) | IMPLEMENTED | |
| §28 Resultado: NONE, PARTICIPATION_ONLY, INTERNAL_CONSTANCY, INSTITUTION_ISSUED_CERTIFICATE, EXTERNAL_CREDENTIAL_EXPECTED | **PARTIAL** | Faltan `PARTICIPATION_ONLY` e `INSTITUTION_ISSUED_CERTIFICATE`; `OTHER_AUTHORIZED_RESOURCE` no está en V3.2 |
| §29 Externa sin el selector «Al terminar genera» | **INCORRECT** | El selector aparece también en las externas |
| §30–§34 Inscripción externa, evidencia, validación, históricas, respaldo | IMPLEMENTED | V3.1 B8 y B9. OCR detrás de un puerto (`ocr.port`); verificar que un fallo dé INCONCLUSIVE |
| §36 «Me interesa» = favorito o recordatorio, no perfil ni recomendador | IMPLEMENTED | El recomendador no usa INTERESTED. En una actividad terminada no ofrece inscribirse, pero falta permitir Guardar. |
| §37 Cards de tamaño constante y detalle completo | **INCORRECT** | Ver C16. Faltan imagen, fin, áreas «+2» y vista de detalle. |
| §38 Zona horaria | **INCORRECT** | Ver C11 |

### §35 Recursos

| Punto | Estado | Nota |
|---|---|---|
| Biblioteca permanente para el estudiante (buscar, filtrar, abrir, favorito) | **MISSING** | Ver C15 |
| Recurso con áreas, skills, tipo, url, proveedor, imagen | PARTIAL | Tiene áreas y skills; faltan proveedor e imagen |
| Recomendación por perfil + favorito con peso bajo | PARTIAL | Recomienda por perfil; no existe favorito de recurso |
| Sin afinidad | IMPLEMENTED | |

### §39–§46 Proyectos, GitHub, equipos

| Punto | Estado | Nota |
|---|---|---|
| Borrador → Activo con requisitos | IMPLEMENTED | V3.1 B10 |
| Varias áreas y skills; skill multiárea con contexto | **PARTIAL** | Hay varias áreas y skills, pero no el contexto área+skill (§11.4) |
| GitHub: lenguajes, manifiestos, caché, cuota, reintentos | IMPLEMENTED | V3.1 B11 |
| Demo sin rastreador; capturas como contexto | IMPLEMENTED | |
| Respaldo de proyecto | IMPLEMENTED | V3.1 B13 |
| Confirmación por integrante | IMPLEMENTED | V3.1 B12 |
| Necesidades → postulaciones → equipo → proyecto | IMPLEMENTED | V3.1 B17 |

### §47 Notificaciones

| Punto | Estado | Nota |
|---|---|---|
| Centro, deduplicación, leído y no leído, recordatorios | IMPLEMENTED | V3.1 B16 |
| `ACTIVITY_REVIEW_SUBMITTED`, `ACTIVITY_REVIEW_OBSERVED`, `ACTIVITY_APPROVED` | **MISSING** | No se emiten |
| `PROJECT_CONFIRMATION_REQUIRED` | IMPLEMENTED (otro nombre) | Se emite como `PROJECT_MEMBER_CONFIRMATION_REQUIRED`; alinear el nombre |

### §48–§55 Perfil, recomendaciones, afinidad, support, gamificación, currículo, QR

| Punto | Estado |
|---|---|
| Perfil con pestañas, sin páginas duplicadas | IMPLEMENTED (V3.1 B5) |
| Recomendaciones sin afinidad, con «No me interesa» | IMPLEMENTED (V3.1 B15); falta el favorito de recurso con peso bajo |
| Afinidad V4 solo de fuentes autorizadas, sin multiplicar | IMPLEMENTED; contexto área+skill **PARTIAL** (§11.5) |
| Habilidades respaldadas en la UI de afinidad (sin «% dominio») | IMPLEMENTED (V3.1 B14) |
| Support separado | IMPLEMENTED |
| Gamificación independiente | IMPLEMENTED (V3.1 B19) |
| Currículo en dos niveles | IMPLEMENTED (V3.1 B18) |
| Privacidad y QR | IMPLEMENTED |

### §56–§61 Vistas por actor

| Punto | Estado | Nota |
|---|---|---|
| Docente | IMPLEMENTED | Ver C12 |
| Dirección: Inicio, Aprobaciones, Actividades aprobadas, Constancias, Recursos, Analítica | PARTIAL | Falta el filtro por tipo en la gestión de aprobadas (§26) |
| Sociedad: Inicio, Mis actividades, Participantes, Métricas, **sin** «Crear actividad» aparte | **INCORRECT** | V3.1 B20 agregó «Crear actividad» al menú; V3.2 §58 la retira |
| Auditoría humana | **INCORRECT** | Ver C13 |
| Correo técnico fuera del menú | **INCORRECT** | Ver C14 |
| Ayuda por rol (activar, perfil, actividades, proyecto, evidencias, afinidad, currículo, privacidad) con imágenes y video | **PARTIAL** | Hay pocas entradas por rol y un video configurable; faltan temas e imágenes |

### §64–§66

| Punto | Estado |
|---|---|
| Participantes responsive, paginados, con filtros | PARTIAL (C17) |
| Actividad pasada: sin inscripción ni recordatorios; permite favorito | PARTIAL (falta el favorito) |
| Móvil: además de lo hecho, Recursos y currículo si es viable | PARTIAL: falta la Biblioteca. `expo-doctor` 18/18. |

---

## 4. Regresiones (§67)

**No se detectó ninguna** de lo que la auditoría marcó como funcional: suspendidas, dominios institucionales, validaciones de usuario, activación por enlace y por código, token usado o caducado, invalidación del anterior, cooldown, plantillas diferenciadas, normalización de código, `applies_to`, aislamiento de borradores de Sociedad y no inscripción en una actividad pasada.

Dos cambios de V3.1 contradicen V3.2 y deben revertirse:
- el menú «Crear actividad» de Sociedad (§58);
- el selector de resultado en las externas (§29).

---

## 5. Regresión de base

La suite completa (20 suites) se ejecuta sobre la rama antes de tocar código. El resultado se agrega al reporte del BATCH 0 en `docs/V3_2_REPORTE_BATCHES.md`.

---

## 6. Resumen

| Estado | Puntos aproximados |
|---|---|
| IMPLEMENTED (preservar con regresión) | 45 |
| PARTIAL | 27 |
| INCORRECT | 23 (incluidos C1–C6, C9–C11, C13, C14, C16) |
| MISSING | 14 (secundarias, contexto área+skill, responsables y contactos, `meeting_url`/`resource_links`/imagen, cancelar envío, Biblioteca, avisos de revisión, paginación global) |
| OBSOLETE | 3 (etiquetas manuales en actividades, «Crear actividad» en Sociedad, menú de correo técnico) |
| REGRESSION | 0 |

El orden de ejecución y los archivos y migraciones previstos están en [`PLAN_EJECUCION_CIERRE_V3_2.md`](PLAN_EJECUCION_CIERRE_V3_2.md).
