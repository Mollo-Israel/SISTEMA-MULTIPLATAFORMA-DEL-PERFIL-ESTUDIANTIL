# Plan de batches — Afinia V3.1

**Fuente:** `AFINIA_ESPECIFICACION_MAESTRA_FINAL_V3_1_2026-10-06.md` §72
**Base:** `AUDITORIA_GAP_AFINIA_V3.md` (Batch 0, commit `9c95580`)

## Reglas que se aplican a todos los batches (V3 §2, §73)

- Se trabaja sobre la arquitectura existente: monolito modular, sin microservicios ni reescrituras.
- Antes de tocar un módulo se lee su implementación real, sus entidades, migraciones, servicios, endpoints, UI, contratos de `shared` y pruebas.
- Solo migraciones nuevas con `up` y `down`; nunca se editan las aplicadas, nunca `synchronize`, nunca `db:reset` como arreglo. Copia de seguridad de la base antes de cada migración que transforme datos.
- No se avanza con la compilación rota. Cada batch cierra con: build de `shared`, `api`, `web` y `mobile`; pruebas unitarias; las suites de integración que toca; regresión completa cuando cambia un contrato compartido.
- Las suites corren con el correo simulado (`MAIL_TRANSPORT=console`), nunca con el SMTP real.
- Reporte por batch en el formato de §73. Nada se declara completo si algo relevante falla.
- Los scripts `scripts/demo-60.ps1` y `scripts/demo-objetivo-6.mjs` no se versionan.

## Orden y alcance

El orden es el de §72. Donde la auditoría muestra que un batch ya está cubierto, se verifica, se completa lo que falte y se reporta igual.

| Batch | Alcance concreto (según la auditoría) | Migración probable |
|---|---|---|
| **0** Baseline | Este plan y la auditoría. | — |
| **1** Configuración | Verificar `.env.example` contra el código (variables usadas sin documentar y al revés), `db:rebuild`, `GITHUB_TOKEN`, IA opcional. Sin cambios de negocio. | — |
| **2** Identidad e importación | Importación de **Docentes** (`authorized_semesters[]`) en la misma pantalla, con preview e idempotencia; `academic_scope_semesters[]` del estudiante (gestión solo de Admin, usada por TeacherScope); quitar del menú la entrada duplicada «Alcance docente». | Columna de alcance de estudiante; discriminador de rol en el lote de importación |
| **3** Activación y sesión | Verificar `ACTIVATION_CODE_MAX_ATTEMPTS=10`, prueba obligatoria del código manual, SecureStore móvil; el resto ya cumple (refresh `710ab6f`). | — |
| **4** Taxonomía | Sugerencia de área **dinámica** (tags + aliases + skills ya clasificadas, no solo reglas fijas); aviso de colisiones de tags y tags genéricas con confirmación; componente reutilizable «áreas → skills agrupadas por área». | — |
| **5** Perfil | Perfil en pestañas (Sobre mí, Intereses y objetivos, Disponibilidad, Visibilidad) absorbiendo Privacidad; quitar «Preferencias» y `/student/interests` del menú; avatares de catálogo. | Avatar elegido en el perfil |
| **6** Oportunidades | Modelo único `origin_type` INTERNAL/EXTERNAL + `internal_type`; multiárea; campos de externa (`provider`, `credential_expected`, dominios, keywords); Admin excepcional con responsable obligatorio; migrar actividades y recursos externos actuales sin perder historia. | `activity_areas`; columnas de origen y de externa; migración de datos |
| **7** Participación interna | Retirar la evidencia self-service de actividades internas (`evidence_required`, `activity_evidence`); política de resultado (NONE / INTERNAL_CONSTANCY / EXTERNAL_CREDENTIAL_EXPECTED / OTHER); constancia **automática** al confirmar cuando la política lo indica; auditoría `ACTIVITY_REGISTERED`. | Columna de política de resultado |
| **8** Externas y credenciales | Estado ACCEPTED y elegibilidad al finalizar; selector «Adjuntar credencial» solo con oportunidades elegibles; `source = HISTORICAL_EXTERNAL`; referencia de validación para nuevas externas; notificación de evidencia disponible (se conecta en B16). | Columnas de aceptación y de origen; `external_opportunity_validation_references` |
| **9** Validación de credenciales | Orden PDF nativo → QR/URL → OCR → comparación → IA opcional → backing determinista; estados VERIFIED_MATCH / REACHABLE_NO_STRUCTURED_PROOF / MISMATCH / INCONCLUSIVE / UNREACHABLE; FLAGGED en credenciales; CORROBORATED solo con señal verificable fuerte; revisión manual excepcional autorizada para históricas sin verificador; SSRF también en QR; detección opcional de Open Badges. | `external_credential_checks` o columnas en `validation_records`; FLAGGED en el enum |
| **10** Proyectos | Multiárea + skills por área; requisitos para ACTIVE (repo público válido, ≥1 área, ≥1 skill, confirmaciones, evidencia contextual); visibilidad TEAM y PUBLIC_LINK; evidencias dentro del proyecto. | `project_areas`; valores de visibilidad |
| **11** GitHub y demo | Leer el contenido de los manifiestos (dependencias → skill), lockfiles, mapeo determinista, caché con timestamp y ETag, rate limit y reintentos; demo sin crawler. | Caché de la comprobación del repositorio |
| **12** Equipos y contribuciones | Usar un equipo al crear el proyecto; catálogo de roles de proyecto; bloquear la activación hasta que confirmen todos; notificación de confirmación requerida. | `team_id` en proyecto; rol de integrante |
| **13** Backing de proyecto | Regla de CORROBORATED de §28 (técnica + independiente); estado por skill (DECLARED / CORROBORATED_BY_GITHUB_LANGUAGE / _MANIFEST / _ACADEMIC_REVIEW) sin penalizar lo no detectado; explicación en la UI. | `project_skill_evidence` |
| **14** Afinidad V4 | `ENGINE_VERSION=4`; solo actividades confirmadas, proyectos CORROBORATED/REVIEWED con skills corroboradas del integrante y credenciales CORROBORATED; conservar instantáneas V2/V3; habilidades respaldadas por área sin porcentaje; recálculo masivo. | Pesos V4 en `affinity_weights` |
| **15** Recomendaciones | Ponderación 40/30/15/10/5 sin afinidad como factor; «No me interesa» baja lo similar sin tocar el perfil; recomendaciones dentro de Actividades con pestañas. | `recommendation_feedback` si el estado actual no basta |
| **16** Notificaciones | Centro de notificaciones, leído/no leído, `dedupe_key`, recordatorios de actividad con frecuencia controlada, eventos de equipo, contacto, proyecto, feedback y evidencia. | `notifications` |
| **17** Colaboración | Necesidad con semestres objetivo, áreas → skills, cupos, postulación, motivos de rechazo controlados; equipo reutilizable en proyecto; chat sigue retirado. | Semestres objetivo y motivo de rechazo |
| **18** Trayectoria y currículo | Currículo en dos niveles (secciones + ítems), solo ítems elegibles, vista previa con orden, PDF, texto IA aprobado, disclaimer de §43.6. | — (opcional `trajectory_exports`) |
| **19** Gamificación | Verificar independencia de afinidad, idempotencia y criterios. | — |
| **20** Paneles por actor | Docente sin paneles repetidos; Director con Analítica en pestañas (Panorama, Afinidad, Participación, Demanda, Evolución); Sociedad con resumen + métricas interactivas; Admin. | — |
| **21** UX web | Formularios, estados vacíos, validación por campo, etiquetas asociadas a sus campos (accesibilidad), terminología. | — |
| **22** Móvil | Notificaciones, perfil, oportunidades, proyectos, trayectoria; `expo-doctor`. | — |
| **23** Calidad | Unitarias de §71, integración, Playwright, seguridad (SSRF, CORS, archivos, sesión), k6, ZAP, Sonar, auditoría de dependencias. | — |
| **24** Limpieza y documentación | Rutas y pantallas obsoletas, Swagger V3, README, diagramas, matriz de trazabilidad V3, guía de cambios del documento de grado (el `.docx` no se toca sin copia de seguridad). | — |

## Dependencias entre batches

- B6 (modelo de oportunidades) antes de B7, B8 y B15.
- B8 y B9 antes de B14: la Afinidad V4 consume el backing de credencial.
- B10 → B11 → B12 → B13 antes de B14: la Afinidad V4 consume el backing de proyecto y el estado por skill.
- B16 (notificaciones) conecta eventos de B7, B8, B12 y B17; esos batches dejan el punto de emisión listo.
- B24 al final.

## Rama y entrega

El trabajo V3 se hace en la rama `feat/afinia-v3`, creada desde `feat/afinia-v2` (`9c95580`), para conservar intacta la línea V2. Commit al cerrar cada batch con su reporte; push cuando el propietario lo pida. `main` no se toca.
