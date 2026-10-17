# Auditoría de brechas — Afinia V4.1 (BATCH V4.1-0)

**Contrato:** `AFINIA_CONTRATO_UNICO_CONSOLIDADO_V4_V4_1_CLAUDE_2026-10-16.md`

**Fecha de la auditoría:** 16/10/2026

**Alcance de este batch:** solo auditoría. No se cambió código funcional (§0.2, §22).

## 1. Estado Git y base elegida (§0.2)

| Dato | Valor |
|---|---|
| Rama al empezar | `feat/afinia-v3-2` (`8110245`), sincronizada con `origin/feat/afinia-v3-2` (0/0) |
| Archivos sin seguimiento | El contrato `AFINIA_CONTRATO_UNICO_…md` y `scripts/demo-60.ps1` y `scripts/demo-objetivo-6.mjs`. Son del usuario y se conservan; nunca se commitean los dos scripts. No hay cambios rastreados sin guardar. |
| Ramas V4 | **No existe** `feature/afinia-v4-cierre`, ni local ni remota. Tampoco hay otra rama con trabajo V4. |
| `origin/main` | Recibió `28ce3ca backups` de otro integrante (Valdivia Rodriguez Rolando): un `.sql` de respaldo y un `.bundle`. **No contiene** la V3.2. |
| `origin/qa/capitulo-iii-pruebas` | Rama nueva del mismo integrante: pruebas Jest de integración y evidencia del Capítulo III, sobre la base vieja `afinia-100`. Le faltan 61 commits de V3.2 y tiene 2 propios. **Riesgo de conflicto** al integrar (modifica `api/package.json` y `package-lock.json`). |
| **Base verificada** | `feat/afinia-v3-2` (`8110245`): es la versión íntegra más avanzada. |
| **Rama de trabajo creada** | `feature/afinia-v4-1-cierre`, local y sin push, desde `8110245`. |

Nota sobre nombres: el contrato dice `feature/afinia-v3-2`, pero la rama real se llama `feat/afinia-v3-2`. Se preserva sin cambios.

**Documento no disponible:** la auditoría de 90 páginas `corregir v4(1).docx` no está en el repositorio (ruta esperada: la raíz, junto a `corregir.docx`). El contrato dice que ya está interpretada y que no es requisito (§0.1). Si alguna corrección depende de una captura concreta, se pedirá.

## 2. Método y evidencia

- **Sondas contra la API real**: NestJS en `localhost:3010` con PostgreSQL 16 en Docker y correo simulado.
  - Scripts: `probe-b0.mjs`, `probe-b0b.mjs` y `probe-b0c.mjs` (en el scratchpad de la sesión). Crean actores reales de cada rol y prueban cada caso con su propio token.
  - Dejan datos de prueba en la base de desarrollo con el prefijo «V41 Sonda» / «Sonda…».
- **Lectura del código**, con la ruta y la línea de la causa.
- **Línea base de pruebas en esta rama**: unitarias **130/130**. La última regresión completa sobre el mismo commit (`8110245`, 13/10/2026) dio **21 suites, 2040 correctas, 0 fallos** (`docs/V3_2_QA.md`). Sirve de base contra la que medir las regresiones.

Clasificación del §0.3: `PRESERVE_PASS`, `IMPLEMENTED_UNTESTED`, `PARTIAL`, `DEFECT_CONFIRMED`, `REGRESSION`, `MISSING`, `OBSOLETE`, `BLOCKED`.

## 3. Hallazgos A41-001 … A41-030

| ID | Estado | Evidencia (reproducción o código) | Causa / qué falta |
|---|---|---|---|
| **A41-001** Activación → recuperar | **DEFECT_CONFIRMED** (código) | `web/src/App.tsx:114-115`: `/activar/solicitar` y `/recuperar` renderizan el mismo `RequestTokenPage` en la misma posición | React conserva la instancia y su estado `yaActiva` al navegar. En `/recuperar` sigue «Tu cuenta ya está activa». Corrección mínima: `key={mode}`. |
| **A41-002** Textos internos «V3.2» | **DEFECT_CONFIRMED** | `web/src/pages/admin/AreasSkills.tsx:117`: hint «…(V3.2 §10)» visible al Admin. El resto de las referencias «§» están en comentarios JSX. | Lo introdujo el batch 22 de V3.2. Correos, plantillas, notificaciones y ayuda están limpios. |
| **A41-003** Grillas | **PARTIAL** | Categorías (`ActivityCategories.tsx`): sin paginación ni orden. Actividades (`ActivityManager.tsx`): paginación sí, orden no. Recursos (`LearningResources.tsx`): sin paginación ni orden. Usuarios, Áreas e Importación ya tienen las tres cosas. | Reutilizar `usePaginacion`, `useOrden`, `ThOrden` y `Paginacion` (de `ui.tsx`). |
| **A41-004** Aula/lugar | **DEFECT_CONFIRMED** | Sonda: `123123`, `!@#$%^&` y `____` → **201 aceptados** (y `Aula 201`, `Laboratorio B-12` → 201) | `create-activity.dto.ts:133-138` solo limita la longitud. La web solo exige que no esté vacío. |
| **A41-005** Editar hidrata skills | **DEFECT_CONFIRMED** | Sonda: `GET /activities/managed` → `activitySkills = null`, mientras el detalle trae 1 | `activities.service.ts:1147-1150` (`findManagedBy`) no carga `activitySkills`. `ActivityManager.tsx:358-372` hidrata desde esa fila y la recarga posterior del detalle (`:409-414`) no repone las habilidades. **Riesgo:** guardar la edición puede vaciarlas. |
| **A41-006** 0..5 imágenes y carrusel | **MISSING** | `activity.entity.ts:190`: un solo `imageFileId` | Hay una imagen, en tarjeta y detalle (V3.2 B5/B7). Faltan varias imágenes, portada, carrusel y la compatibilidad `cover_image` + `images[]`. |
| **A41-007** DRAFT sin responsable | **DEFECT_CONFIRMED** | Sonda: Admin guarda un borrador sin responsable → **400** «indica quién es el responsable…» | La validación de responsable se aplica al guardar, no al publicar o enviar a revisión. |
| **A41-008** Borrador privado, PENDING solo en bandeja, APPROVED congela | **PARTIAL / DEFECT_CONFIRMED** | Sonda: (a) docente asignado por Admin **ve el DRAFT de Admin** en su `managed` y en el detalle (200); (b) DRAFT de docente → Director no lo ve (OK); (c) tras SUBMIT aparece en `reviews/pending` (OK) **y también en `managed` del Director** | (a) `veBorrador` (`activities.service.ts:755-761`) deja ver el borrador a cualquier responsable; el contrato (§4.3, 23.3) lo prohíbe para los asignados por la autoridad. (c) Se mezcla con lo «suyo». La congelación tras aprobar ya existe (V3.2 B6, 409): PRESERVE. |
| **A41-009** Responsable ≠ creador, unión de alcances | **PARTIAL** | `created_by` y `responsibles[]` están separados (V3.2 B5). No hay unión de los semestres de los docentes responsables para limitar los elegibles (no hay código de `union`). | Falta mostrar y limitar semestres por la unión de alcances y avisar al quitar o añadir responsables (§4.5). Hay que verificar la alternativa «carrera completa». |
| **A41-010** Guards de estado y fecha | **DEFECT_CONFIRMED / PRESERVE parcial** | Sonda: publicar una actividad **nueva con inicio ayer** → **201 `open`**. DRAFT sin fecha → 201 (OK). Reabrir CLOSED con fecha futura → 200 (control OK). | Falta `start_at > now` al publicar. Hay que verificar el mensaje específico al reabrir un CLOSED por fecha pasada o cupo lleno (B14/B15), y faltan «Duplicar actividad» y la finalización anticipada con motivo. |
| **A41-011** Asistencia ≠ FINISHED | **PARTIAL + DEFECT_CONFIRMED + MISSING** | Sonda: tras `finished`, el responsable confirma un pendiente → 200 (**PRESERVE B17**); el responsable pasa un CONFIRMED a **ABSENT libremente → 200** (DEFECT B18) | No existen `attendance_status` ni «Cerrar asistencia» (MISSING B19). La corrección excepcional de Dirección/Admin con motivo y reconciliación tampoco existe. |
| **A41-012** Tres pestañas | **PARTIAL** | Estudiante: «Todas / Académicas / Extracurriculares» (`student/Activities.tsx:218-220`); las externas se mezclan. Gestión: existe el filtro de origen interno/externo. | Faltan las pestañas «Académicas internas / Extracurriculares internas / Oportunidades externas» con los ejes `origin` × `character`. |
| **A41-013** Resultado redundante | **PARTIAL** | `ActivityManager.tsx:90`: «Credencial externa esperada» se ofrece en el formulario interno | Quitarla de la interfaz interna sin borrar datos ni el flujo externo. Hay que verificar si hay actividades internas que la usan. |
| **A41-014** Recursos | **PARTIAL + DEFECT_CONFIRMED + MISSING** | Sonda: título `123456` y quién publica `!!!!` → **solo** rechaza la URL (DEFECT B20). URL duplicada → 409 (**PRESERVE B21**). Docente propone → **403** (MISSING). Biblioteca sin pestaña «Para ti» (`Library.tsx:85`). | Faltan la validación del contenido significativo, la propuesta del docente con revisión de Dirección y «Para ti». |
| **A41-015** Recomendaciones | **PARTIAL + DEFECT_CONFIRMED** | Las 4 dimensiones existen (`recommendations.engine.ts:342-375`). **El favorito de recurso suma** (`:404`, `RESOURCE_FAVORITE_AREA`) y **«Guardar» suma** (`:395`, `SIMILAR_SAVED`). No existe la señal `ACTIVITY_INTERESTED`. La web muestra «Encaje con tu perfil: N de 100» (`Recommendations.tsx:199`). | El contrato (§7, §8, A.9) prohíbe que el favorito o «Guardar» alimenten el recomendador; lo que V3.2 B10 hizo **contradice** el V4.1. Falta `ACTIVITY_INTERESTED` idempotente y reversible. El porcentaje debe decir su fórmula o volverse razones textuales. (La sonda B22 no lo mostró porque el perfil de prueba no tuvo recomendaciones: confirmado por código.) |
| **A41-016** Gamificación por criterios | **PARTIAL** | Existen `gamification_criteria` (con `trigger`, `points`, `academic_area_id`, `is_active`) y un ledger idempotente (`uq_gamification_event` sobre `student_profile_id, dedupe_key`): PRESERVE. | Faltan la vigencia de temporada (`valid_from` / `valid_until`), los reversos auditables (no hay código de reverso), la bandeja de propuestas en Dirección y reemplazar los «puntos» libres del formulario de actividad (`ActivityManager.tsx:393`) por un criterio. |
| **A41-017** Retirar retos, recompensas e insignias nuevas | **OBSOLETE** | Menú «Retos y recompensas» para Docente, Dirección y Admin (`navigation.ts:73,94,131`). Endpoints `challenges`, `rewards` y `redemptions` (`gamification-extras.controller.ts:184-266`). En la base: 68 retos, 136 recompensas, 7 insignias, 3746 insignias otorgadas. | Retirar del menú y bloquear la creación, **conservando los históricos**. Reubicar la tabla de puntos por alcance (`scope-points`, ya existe) en Gamificación, sin ranking público. |
| **A41-018** Credenciales: dos ejes | **PARTIAL + BLOCKED** | Hay estado del trabajo (`ValidationStatus`), estado de la comprobación (`CredentialCheckStatus`) y respaldo, aparte. La revisión manual (`DecideManualReviewDto`) permite `CORROBORATED` con un motivo, **sin exigir prueba externa independiente**. Dominios por proveedor sin subcadena (`credential-check.rules.ts:72`). | Falta el eje `validation_status` del contrato y la regla de que una revisión sin fuente independiente queda INCONCLUSIVE / SUPPORTED (B32). **BLOCKED:** los adaptadores reales de Credly, Cisco y Huawei requieren comprobar su disponibilidad real con conexión a internet, licencia y CAPTCHA; no se afirma ninguna integración. |
| **A41-019** Proyecto DRAFT y ACTIVE | **PRESERVE_PASS (API)** | Sonda: DRAFT sin repo → 201; editar título y repo de un DRAFT → 200; activar sin repo → 400 con lista de faltantes; readiness explicable; editar un ACTIVE (título, repo) → 200; cambiar el repo de un ACTIVE → **se revalida** (pasa a `flagged` con el motivo). | No se reproduce por API «no se pudo editar». Falta verificarlo en la **web** (si el formulario deja editar título y repo), pedir reconfirmación al cambiar integrantes y que la exigencia de skill por cada área solo aplique al activar. |
| **A41-020** GitHub: mapeo con procedencia | **PARTIAL** | Mapa controlado sin subcadenas (`dependency-map.ts`; `fastapi`, `pymongo`, `pytest` y `mongo` mapeados); lo detectado y no declarado se informa sin añadirlo (V3.11.7). | Faltan las sugerencias aceptar/rechazar con su procedencia, «Tecnología no catalogada» con pedido al Admin y el diagnóstico 404 / 403 / rate-limit sin concluir «privado». El estado por skill se llama `CORROBORATED_BY_MANIFEST` (`project-backing.rules.ts:54`), cuando el contrato pide «señal detectada». |
| **A41-021** Readiness ≠ CORROBORATED | **DEFECT_CONFIRMED** | Sonda: activar con los mínimos (repo + **1 captura**) → `backingTier=corroborated`. **Repo ajeno:** un segundo estudiante con el **mismo repositorio** → también `corroborated` (23.6/B35). | `project-backing.rules.ts:33-36`: cualquier evidencia cuenta como «independiente», y la activación ya exige una, así que readiness ≈ CORROBORATED. No se comprueba la atribución ni la autoría. **Datos afectados hoy:** 145 proyectos `corroborated` y 183 `reviewed` activos. Cualquier recálculo necesita un plan auditado (§12). |
| **A41-022** Equipo opcional y contactos | **PARTIAL** | Hay que vincular un equipo e invitar a todos (`projects.controller.ts:55-66`, `Projects.tsx:328`, `<select>` sin búsqueda); hay invitación individual (`POST /projects/:id/invitations`); la confirmación es individual (V3). | Falta precargar a los miembros como candidatos editables antes de invitar, y un combobox con búsqueda. |
| **A41-023** Excluir integrante con motivo | **MISSING** | No hay código de exclusión con motivo en `project-members.service.ts`. | Excluir del proyecto (no del equipo), con motivo y aviso respetuoso, y dejar el historial. |
| **A41-024** Privacidad de proyectos | **PARTIAL** | 5 opciones reales (`ProjectVisibility`), con etiquetas en `services/types.ts:784-790`. | No se aclara que la visibilidad en Afinia ≠ la del repositorio en GitHub, ni si «Enlace público» exige sesión, ni que un DRAFT nunca se publica. |
| **A41-025** Pestañas de evidencias | **PARTIAL** | `Evidences.tsx`: secciones en tarjetas («Mis certificados externos», «Constancias y certificados recibidos», «Adjuntar credencial externa», «Evidencias registradas antes»), sin pestañas | Faltan las pestañas del §15 sobre el mismo origen de datos. |
| **A41-026** QR en Mi perfil → Privacidad | **MISSING** | `Profile.tsx` no tiene QR; el QR está en Colaboración (pestaña «Mi enlace y QR») | Moverlo a Mi perfil → Visibilidad (una sola fuente de verdad) y dejar un acceso rápido en Colaboración. |
| **A41-027** Saldo e historial de puntos | **PARTIAL** | En «Mi progreso → Puntos e insignias» sí; en el Perfil no hay saldo | Mostrar el saldo en el Perfil con enlace al historial y separarlo de afinidad y respaldo. |
| **A41-028** Afinidad | **PRESERVE_PASS con dependencia** | Motor V5: contexto explícito, sin etiquetas, intereses ni gamificación (V3.2 B15; V32.15.x). | Hereda el defecto A41-021: proyectos marcados `corroborated` de más alimentan la afinidad. Se corrige al arreglar el respaldo, sin tocar la fórmula. |
| **A41-029** Currículo | **PRESERVE_PASS con dependencia** | Secciones + ítems, elegibilidad y vista previa = PDF (V3.18.x, V32.19.x). | Igual que A41-028: la elegibilidad de proyectos depende de un respaldo correcto. |
| **A41-030** Calidad | **IMPLEMENTED_UNTESTED (para V4.1)** | Hay 21 suites y 130 unitarias, en verde sobre la base. | Faltan pruebas de los casos 23.1–23.11 y B01–B40 del contrato. |

## 4. Hallazgos V41 adicionales (§1) que no tienen número A41

| Ref. | Estado | Evidencia |
|---|---|---|
| V41-01 / 23.1 / B06 Actividad conceptual sin skill | **DEFECT_CONFIRMED** | Sonda: publicar con área IA y `skillIds: []` → **400** «Selecciona al menos una habilidad vinculada». El contrato permite charlas generales sin skill. |
| V41-07 Bandeja unificada de Dirección | **PARTIAL** | Existe `GET /activities/reviews/pending`. No hay propuestas de Recursos ni de Gamificación (§9.4). |

## 5. Funciones a preservar (§19, A.12) — verificadas en esta auditoría

| Función | Resultado |
|---|---|
| Cuenta ya activa: no se reactiva | PRESERVE_PASS (V32.2.x; código `RequestTokenPage.tsx:83`) |
| Responsable confirma participación | PRESERVE_PASS (sonda: 200) |
| Confirmar pendientes tras FINISHED | PRESERVE_PASS (sonda: 200) |
| URL duplicada de recurso rechazada | PRESERVE_PASS (sonda: 409) |
| DRAFT de proyecto editable sin repo; activar exige repo | PRESERVE_PASS (sonda) |
| El cambio de repositorio revalida | PRESERVE_PASS (sonda) |
| Skill multiárea, fechas, reunión HTTPS, contactos, enlaces, imagen | PRESERVE_PASS en la regresión base (V32.4.x, V32.5.x); se vuelve a probar en cada batch |
| GitHub detecta tecnologías | PRESERVE_PASS (V3.11.x) |
| CV por experiencia concreta | PRESERVE_PASS (V32.19.x) |

## 6. Riesgos

1. **Recálculo del respaldo (A41-021).** Arreglar la regla cambia el nivel de proyectos existentes (145 `corroborated`, 183 `reviewed` activos) y, con él, la afinidad y el currículo. Se propone un recálculo **con plan y auditoría**, nunca silencioso.
2. **Contradicción con V3.2 B10.** El favorito de recurso y «Guardar» como señal se implementaron en V3.2 y el V4.1 los prohíbe. Retirarlos cambia el ranking del recomendador; hay que actualizar las pruebas V32.10.x.
3. **Datos históricos de gamificación.** Hay 68 retos, 136 recompensas, insignias y canjes. Se retira la interfaz y la creación **sin borrar** nada.
4. **Rama paralela `qa/capitulo-iii-pruebas`.** Agrega Jest y cambia `package.json` sobre una base vieja. Integrarla después exige resolver conflictos; este trabajo no la toca.
5. **Proveedores de credenciales.** No se pueden comprobar sin acceso real (internet, licencias, CAPTCHA). Quedan BLOCKED hasta probar cada fuente.
6. **Datos de sonda.** Las sondas dejaron actividades, proyectos, recursos y cuentas con el prefijo «V41 Sonda» / «Sonda» en la base de desarrollo (no en producción).
