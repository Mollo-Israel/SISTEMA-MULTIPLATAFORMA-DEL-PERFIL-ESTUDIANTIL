# Matriz de trazabilidad — Cierre V3.2

Relaciona cada parte del *Cierre Final V3.2* con el batch que la resolvió, lo que cambió en la API y las pantallas, y las pruebas que lo comprueban.

- **Fuente de las secciones:** las que citan las propias pruebas en su nombre (`scripts/e2e-v3-2.mjs`). Las pruebas web van en `scripts/e2e-web.mjs`; las unitarias, en `api/test/unit/`.
- **Detalle de cada batch:** [`V3_2_REPORTE_BATCHES.md`](V3_2_REPORTE_BATCHES.md).
- **Resultado de las pruebas:** [`V3_2_QA.md`](V3_2_QA.md).

| Batch | Secciones | API / datos | Web / móvil | Pruebas |
|---|---|---|---|---|
| 1 · Importación y usuarios | §6.2, §7.3, §7.5, §7.6, §8.6 | Aplicación parcial de filas válidas, estado FAILED, historial solo aplicado/fallido; migración `V32ImportHistory` | Grillas paginadas y ordenables (`usePaginacion`, `useOrden`) | V32.1.x (25) |
| 2 · Activación | §8.1, §8.3, §8.4, §8.6, §12 | `ALREADY_ACTIVE`, espera real persistente, el token anterior se invalida | Pestaña «pegar enlace» solo en desarrollo (`VITE_ACTIVATION_PASTE_LINK`) | V32.2.x (12), QA.13–17 |
| 3 · Taxonomía | §10.1–§10.6, §11–§11.3, §11.5 | `skill-classification.ts`, áreas secundarias (`skill_area_relations`), etiquetas semánticas; migraciones `V32SkillSecondaryAreas`, `V32SemanticAreaTags` | `AreaSkillPicker` con «Relacionadas» | V32.3.x (20) |
| 4 · Actividad multiárea | §4, §11.4 | Alta y edición transaccionales; `activity_skills.academic_area_id`; migración `V32ActivitySkillContext` | Contexto área + habilidad en el formulario | V32.4.x (14) |
| 5 · Formulario y ciclo | §6.3, §6.4, §16–§21, §28, §29, §37, §38 | Reunión, enlaces, imagen, cancelación, responsables y contactos, ciclo automático, política de resultado; migración `V32ActivityFields` | `PersonPicker`, fechas America/La_Paz, botones explícitos, modal de cancelación | V32.5.x (34) |
| 6 · Revisión y propiedad | §23–§26, §47 | Borrador privado (404 a terceros), retirar envío, aprobada bloqueada para el creador (409); migración `V32ReviewCancelSubmission` | Pestañas de Dirección | V32.6.x (28) |
| 7 · Tarjeta y detalle | §16, §37, §64, §80 | El listado trae habilidades, personas e imagen | `ActivityCard`, `ActivityDetail`, participantes paginados | V32.7.x (8) |
| 8 · Certificado institucional | §6.5, §28.3, §47 | `certificate_issuer`, `institution_certificate`, entrega a confirmados; migración `V32InstitutionCertificate` | Entrega desde Participantes | V32.8.x (14) |
| 9 · Biblioteca | §6.3, §35, §61 | Módulo `library` (búsqueda, facetas, favoritos); migración `V32ResourceLibrary` | `Library.tsx`; móvil `LibraryScreen` (B20) | V32.9.x (10) |
| 10 · Recomendaciones | §35.2, §36 | Favorito de recurso como señal secundaria (5%); «Me interesa» sin modelo | «Guardar» en actividades pasadas | V32.10.x (8) |
| 11 · Proyectos | §11.4 | `project_skills.academic_area_id`; migración `V32ProjectSkillContext` | Contexto por tecnología | V32.11.x (5) |
| 12 · GitHub y respaldo | §41–§44 | Verificación (sin cambios de código) | — | V3.11.x, B5.17b, B5.30 |
| 13 · Notificaciones | §47 | Nombres `PROJECT_CONFIRMATION_REQUIRED` y `ACTIVITY_APPROVED`; migración `V32NotificationNames` | Rutas de avisos en el móvil (B20) | V3.16.x (V3.16.14), V32.6.18 |
| 14 · Credenciales externas | §33, §50.1 | Varias áreas y contexto por tecnología; migración `V32CertificateContext` | Selector de áreas y habilidades en Evidencias | V32.14.x (4) |
| 15 · Afinidad V5 | §11.5, §12.3, §50 | Contexto explícito; sin inferencia por etiquetas ni por texto | — | V32.15.x (5), unitarias de versión |
| 16 · Docente | §25, §56, §62 | (permisos ya existentes) | Menú con Actividades de la carrera y las funciones del panel | V32.16.x (3), WEB.12c–12d |
| 17 · Dirección y Sociedad | §57, §58 | — | Sin vista «Crear actividad» aparte | WEB.22b–22c |
| 18 · Administración | §59, §60, §61 | `GET /audit/log` y `/audit/log/catalog`; `MailDiagnosticsGuard` | Auditoría legible; correo técnico oculto; ayuda por tema con ilustraciones | V32.18.x (11), WEB.22d–22j, unitarias `admin-surface` |
| 19 · Currículo y archivos | §42, §54, §55 | Emisor real en la línea de la actividad | `ImagenProtegida`, `BotonArchivo` | V32.19.x (5), WEB.22k |
| 20 · Móvil | §35, §16–§19, §38 | — | Biblioteca, detalle completo, hora de Bolivia, archivos con sesión | `tsc`, `expo-doctor` 18/18, export Android |
| 21 · QA | §BATCH 21, §73 | — | — | unitarias `fallbacks` (7); ver `V3_2_QA.md` |
| 22 · Limpieza y documentación | §BATCH 22 | Etiquetas descritas como metadata en DTO y Swagger | Textos de etiquetas corregidos | este documento, README, diagramas |

## Decisiones de §74 y dónde quedan

| Decisión | Dónde se aplica |
|---|---|
| Las etiquetas de área son metadata, no motor | `skill-classification.ts`; motor V5 sin `inferAreasByTech` ni `matchAreasByText` |
| Habilidad con 1 área principal y 0..N secundarias | `skill_area_relations` |
| La afinidad de una habilidad multiárea usa el contexto explícito | `activity_skills`, `project_skills` y `external_certificate_skills`, cada una con `academic_area_id` |
| «Me interesa» es favorito o aviso, no perfil | B10 |
| Recursos: biblioteca permanente, favorito como señal secundaria | B9, B10 |
| El estudiante responsable es un contacto operativo, no una autoridad | B5 (V32.5.17–5.18) |
| Publicar no ocurre al guardar: acción explícita | B5 |
| OCR extrae, no autentica; IA asiste, no decide | `ocr.port.ts`; unitarias `fallbacks` |
| GitHub: lenguaje y manifiestos, no dominio; demo: disponibilidad | V3.11.x |
