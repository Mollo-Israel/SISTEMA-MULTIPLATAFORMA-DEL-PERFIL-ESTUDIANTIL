# Matriz de trazabilidad · Afinia V5

Cada ítem de la auditoría (`AUDITORIA_GAP_AFINIA_V5.md`, V5-01 a V5-31) y cada escenario del contrato (§19, A01…I07) aparece con:

- el batch y el commit donde se cerró;
- dónde vive en el código;
- las pruebas que lo verifican.

Las pruebas `V5.N.x` están en `scripts/e2e-v5.mjs` (sección `batchN`). Las `WEB.x` están en `scripts/e2e-web.mjs` (Playwright). Las demás (`V41.*`, `V32.*`, `V3.*`, `B*.*`) son de suites anteriores que siguen en verde.

**Estados:**
- **CERRADO:** implementado y probado.
- **PRESERVADO:** ya cumplía; la regresión lo mantiene.

## 1. Ítems de la auditoría

| ID | Ajuste | Batch · commit | Código principal | Pruebas | Estado |
|---|---|---|---|---|---|
| V5-01 | Docente → Actividades de la carrera en tarjetas por páginas | 3 · `d229895` | `activities.service` (`findPage`), `web/pages/teacher/Activities.tsx` | V5.3.1, V5.3.6 | CERRADO |
| V5-02 | Filtro por responsable | 3 · `d229895` | `query-activities.dto` (`responsibleId`), `GET /activities/responsibles` | V5.3.4, V5.3.5 | CERRADO |
| V5-03 | Docente → fuentes de la afinidad | 14 · `78204d1` | `affinity.engine` (`fuentes`), `components/affinity.tsx` | V5.14.1–14.5 | CERRADO |
| V5-04 | Primer y segundo apellido | 1 · `8912394` | `users/surnames.ts`, migración `V5Surnames`, `admin/Users.tsx` | V5.1.1–1.5, `apellidos.spec` | CERRADO |
| V5-05 | Padrón CSV con apellidos | 1 · `8912394` | `csv.parser` (`columnasDeApellido`), importadores | V5.1.6, V5.1.7 | CERRADO |
| V5-06 | Duplicar y borrar borrador | 2 · `572d569` | `activities.service` (`deleteDraft`), `DELETE /activities/:id` | V5.2.7–2.12 | CERRADO |
| V5-07 | Fecha «ahora» rechazada | 2 · `572d569` | `registration.rules` (`ACTIVITY_START_TOLERANCE_MINUTES_DEFAULT`) | V5.2.1, V5.2.2 | CERRADO |
| V5-08 | Responsables → semestres | 3 · `d229895` | aviso de cobertura en `ActivityManager`; la API valida la unión de alcances (V4.1) | V41.3.10–3.12 | CERRADO |
| V5-09 | Edición visible que luego falla | 3 · `d229895` | `editable()` con `soloOpera` | V5.3.2 | CERRADO |
| V5-10 | Interna ↔ externa contamina el formulario | 2 · `572d569` | `components/ActivityTabs.tsx` (confirmación al cambiar de pestaña) | WEB.61.1, WEB.43.4 | CERRADO |
| V5-11 | Validación de externas por modalidad | 2 · `572d569` | `activities.service` (modalidad) | V5.2.3–2.6 | CERRADO |
| V5-12 | Solicitar, admitir y asistir | 4 · `19fa387`, `cd18f7a` | `registration.rules`, `confirmParticipation` (cupo con bloqueo) | V5.4.1–4.21 | CERRADO |
| V5-13 | Recurso por archivo | 6 · `6ec748f` | migración `V5ResourceFile`, `catalogs.service` (`assertResourceFile`) | V5.6.1–6.9, V5.6.13 | CERRADO |
| V5-14 | «Curso externo» mezcla oportunidades | 6 · `6ec748f` | `LEARNING_RESOURCE_TYPE_LABEL` | V5.6.14 | CERRADO |
| V5-15 | Exenciones de Dirección por docente | 7 · `6ee8230` | `approval_policies`, `access/approval-policies.*`, `director/TeacherAutonomy.tsx` | V5.7.1–7.15, `afinia-v5-gobernanza.spec` | CERRADO |
| V5-16 | Constancias: ambigüedad acreditativa | 5 · `8abb5b9`, `e1767cd` | `outcomePolicy`, `CONSTANCY_ISSUANCE_DISABLED` | V5.5.1–5.5, `afinia-no-certifica.spec` | CERRADO |
| V5-17 | Dirección y Administración sin selector de semestres | 6 · `6ec748f` | `director/LearningResources.tsx` («Para quién es») | V5.6.10, V5.6.11 | CERRADO |
| V5-18 | Criterios docentes siempre revisados | 7, 8 · `6ee8230`, `da9f546` | `gamification-proposals.service` | V5.7.10, V5.8.8 | CERRADO |
| V5-19 | ¿Quién otorgó y por qué? | 8 · `da9f546` | `gamification_events` (`criterion_id`, `awarded_by`, `approved_by`), `GET /gamification/students/:id/history` | V5.8.3, V5.8.4, V5.8.9, V5.8.11 | CERRADO |
| V5-20 | Contribución con todo el catálogo | 12 · `cd7664b` | `projects.service` (`assertSkillsDelProyecto`) | V5.12.1, B6.31 | CERRADO |
| V5-21 | Visibilidad confusa | 13 · `2164192` | `PROJECT_VISIBILITY_LABEL` (web y móvil) | WEB.60.2 | CERRADO |
| V5-22 | Excluir con `window.prompt` | 12 · `cd7664b` | modales en `ProjectContribution`, `StudentProjects`, `Evidences` | V41.11.1–11.4, e2e-web | CERRADO |
| V5-23 | Repo-first sin bloquear el DRAFT | 9 · `d0e1faf` | `POST /projects/repository/analyze`, `components/RepositoryAnalyzer.tsx` | V5.9.1–9.7, WEB.59.1 | CERRADO |
| V5-24 | Python aceptado sigue «no declarada» | 10/11 · `548216f` | `RepositoryInspectorService.recruzar`, `senalesVigentes` | V5.10.2 | CERRADO |
| V5-25 | FastAPI → «vincular con Python» | 10/11 · `548216f` | `decideSkillRequest` (`alias` / `new_skill`) | V5.11.1–11.5 | CERRADO |
| V5-26 | Imágenes del proyecto | 13 · `2164192` | `project_images`, `projects/project-gallery.*`, `components/ProjectImages.tsx` | V5.13.4–13.9 | CERRADO |
| V5-27 | Galería «Proyectos de la carrera» | 13 · `2164192` | `GET /projects/community`, `pages/CareerProjects.tsx` | V5.13.1–13.3, V5.13.10, WEB.60.1 | CERRADO |
| V5-28 | Equipo o contactos como origen | 12 · `cd7664b`, `232c8e8` | `student/Projects.tsx` (origen), `projectService.invite` | V41.11.3, e2e-web (selector de origen) | CERRADO |
| V5-29 | Roles relacionados con áreas y tecnologías | 12 · `cd7664b` | `project_members.roles[]`, `ProjectContribution` | V5.12.2–12.4 | CERRADO |
| V5-30 | Solo tres familias de puntos | 8 · `da9f546` | `ACTIVE_GAMIFICATION_TRIGGERS`, migración `V5GamificationFamilies` | V5.8.1, V5.8.2, V5.8.12, V3.19.6, B9.16 | CERRADO |
| V5-31 | «Currículum» | 5, 15/16 · `8abb5b9`, `2148de5` | `trajectory-summary.service`, `TRAJECTORY_SOURCES_NOTICE` | V5.5.5, V5.15.1–15.3 | CERRADO |

Fuera de la auditoría, la regresión encontró y se corrigió en `2a07ef2` un defecto latente anterior a V5: el limpiador de huérfanos no respetaba la galería de actividades ni el material de los recursos.

## 2. Escenarios del contrato (§19)

| Escenario | Qué verifica | Pruebas | Estado |
|---|---|---|---|
| A01 | Alta con primer apellido, segundo vacío | V5.1.1, V5.1.2 | CERRADO |
| A02 | «Pérez García» no se parte | V5.1.4 | CERRADO |
| A03 | Plantilla CSV antigua sin desplazar columnas | V5.1.6, V5.1.7 | CERRADO |
| A04 | Padrón con existentes, nuevos y conflictos | B1.2–1.4, B1.20, V32.1.2 | PRESERVADO |
| A05 | Administración ve y separa apellidos | V5.1.5 | CERRADO |
| B01 | Académica → Externa → Académica sin campos ajenos | WEB.61.1 (pide confirmar; cada formulario con sus campos y sin restos) | CERRADO |
| B02, B03 | Externa: lugar con palabras; virtual con enlace | V5.2.3–2.6 | CERRADO |
| B04, B05 | Tolerancia de minuto; no publicar en el pasado | V5.2.1, V5.2.2 | CERRADO |
| B06 | Duplicar FINISHED → borrador limpio | V5.2.11 | CERRADO |
| B07 | Borrar borrador propio; lo publicado no | V5.2.7–2.10, V5.2.12 | CERRADO |
| B08 | El responsable no ve borradores ajenos; sin Editar si solo opera | V5.3.2 | CERRADO |
| B09 | Unión de alcances de los responsables | V41.3.10–3.12 | PRESERVADO |
| B10 | Charla con área y sin tecnologías | V5.2.13 | CERRADO |
| C01 | Solicitar no crea afinidad, puntos ni constancia | V5.4.3 | CERRADO |
| C02 | Admitir no crea asistencia | V5.4.2, V5.4.11 | CERRADO |
| C03 | Asistencia solo después de empezar | V5.4.4, V5.4.12 | CERRADO |
| C04 | Ausencia sin atribución | V5.4.14 | CERRADO |
| C05 | Cupo 1 con admisiones concurrentes | V5.4.5, V5.4.6 | CERRADO |
| C06 | Sin cupo: admisión inmediata, asistencia pendiente | V5.4.1, V5.4.2 | CERRADO |
| C07 | Ventana de 7 días para regularizar | V5.4.18–4.21 (dentro sí; fuera 409 `ATTENDANCE_WINDOW_CLOSED`; Dirección corrige con motivo y queda auditado), `inscripcion-admision-asistencia.spec` | CERRADO |
| C08 | Rechazo con motivo, distinto de ausencia | V5.4.7–4.10 | CERRADO |
| D01–D07 | Recursos: enlace o archivo, video por enlace, alcance, 403, favorito sin puntos | V5.6.1–6.15 | CERRADO |
| D08 | Recurso completado solo con declaración docente auditada | V5.8.7, V5.8.8, V5.8.9 | CERRADO |
| E01–E04 | Revisión por defecto, autonomía, revocación, historial filtrable | V5.7.1, V5.7.7–7.15 | CERRADO |
| E05 | Confirmar dos veces = un evento | V5.8.3 | CERRADO |
| E06 | El reconocimiento no cambia el respaldo | V5.7.11 | CERRADO |
| E07 | Descargar o guardar no es completar | V5.8.6, V5.6.15 | CERRADO |
| E08 | La sociedad no hereda excepciones | V5.7.4 | CERRADO |
| F01, F02, F05, F06, F12 | Análisis opcional, con fuente, idempotente, INCONCLUSIVE, sin atribuir | V5.9.1–9.7, WEB.59.1 | CERRADO |
| F03, F04 | PyMongo → MongoDB; Python aceptado deja de sugerirse | V5.9.2, V5.10.1, V5.10.2 | CERRADO |
| F07–F09 | FastAPI y Pytest como tecnologías nuevas; aviso fiel | V5.11.1–11.5 | CERRADO |
| F10 | Quitar la última tecnología de un área avisa; quitar un área pide confirmación | WEB.62.1 | CERRADO |
| F11 | Tecnología multiárea: elegir contexto | V32.4.7–4.11, selector de área en `RepositoryAnalyzer` | CERRADO |
| G01, G04, G05 | Contribución acotada al proyecto; multirol | V5.12.1–12.4 | CERRADO |
| G02, G03 | Equipo o contactos: invitados que deben aceptar | V41.11.3, V41.11.4 | PRESERVADO |
| G06 | Excluir con modal y motivo, sin sacar del equipo | V41.11.1–11.4 | CERRADO |
| G07–G09 | Galería solo ACTIVE y visible; 0–5 imágenes; sin correos ni evidencias | V5.13.1–13.10, WEB.60.x | CERRADO |
| H01, H02, H04 | Registro del responsable, sin constancia automática, PDF informativo | V5.5.2, V5.5.4, V5.5.5, V5.15.3 | CERRADO |
| H03 | Documento institucional con su emisor real | V32.8.1, V32.8.2, V32.8.9 | PRESERVADO |
| H05–H07 | QR de curso, proveedor caído, titular ajeno | V3.9.4, V3.9.6, V3.9.3 | PRESERVADO |
| H08 | La afinidad muestra fuentes reales; sin puntos, recursos ni roles | V5.14.1–14.3 | CERRADO |
| I01 | Sin `window.prompt` | V41.11.x, modales V5-12 | CERRADO |
| I02 | Grillas de 10, tarjetas de 6 | WEB.41.3, V5.3.1, V5.13.3 | CERRADO |
| I03 | Sin Editar si no se puede editar | V5.3.2 | CERRADO |
| I04 | Sin «V5» ni «certificado por Afinia» en la interfaz | revisión de textos (V5-15/16) | CERRADO |
| I05 | Móvil, web y `shared` compilan tras las migraciones | `tsc` de api, web y móvil en cada batch | CERRADO |
| I06 | Protección en el endpoint, con 403 para roles ajenos | V5.7.2, V5.6.12, V5.8.11, V5.13.5, V5.14.5 | CERRADO |
| I07 | Sin retos, chat, ML ni emisión de certificados | V41.7.1, V5.5.1–5.3, `afinia-no-certifica.spec` | CERRADO |
