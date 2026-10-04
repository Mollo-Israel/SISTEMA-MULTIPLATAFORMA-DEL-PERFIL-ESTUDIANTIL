# AUDITORÍA DE BRECHAS — AFINIA ESPECIFICACIÓN MAESTRA FINAL V2

**Fecha:** 03/10/2026  
**Rama:** `feat/afinia-v2` (creada desde `feat/afinia-100`, commit `6e679cf`)  
**Fuente de verdad:** `AFINIA_ESPECIFICACION_MAESTRA_FINAL_V2_2026-10-03.md` (en adelante, «V2»)  
**Método:** §2 de la V2. Inspección de código, migraciones, entidades, datos reales de
la base de desarrollo, web y móvil. Cada requisito se clasifica como:

| Estado | Significado |
|---|---|
| **IMPLEMENTADO** | Existe y cumple la V2. |
| **INCORRECTO** | Existe, pero contradice la V2. |
| **PARCIAL** | Existe una parte. |
| **FALTANTE** | No existe. |
| **OBSOLETO** | Existe y la V2 lo retira. |

---

## 1. Línea base

| Comprobación | Resultado |
|---|---|
| `git status` | limpio salvo `scripts/demo-60.ps1` y `scripts/demo-objetivo-6.mjs` (no se commitean por decisión del propietario) y la propia V2 |
| Rama de partida / último commit | `feat/afinia-100` / `6e679cf` |
| Arquitectura real | Monolito modular NestJS 10 + TypeORM 0.3 + PostgreSQL 16 (Docker), web React 18 + Vite, móvil Expo SDK 54 / RN 0.81.5 / React 19.1, paquete `@perfil/shared` con enums y reglas comunes |
| Migraciones | 27, todas aplicadas; `synchronize=false` |
| Pruebas existentes | 16 suites e2e contra la API (`npm run test:all`): **1213 comprobaciones, 0 fallos** en el último commit |
| Compilación | API `tsc` limpio, web `vite build` correcto, móvil `tsc` limpio |
| Datos de desarrollo | 2803 usuarios, 1496 perfiles, 1397 actividades, 824 proyectos, 930 certificados, 3243 resultados de afinidad (todos `engine_version=2`), 396 filas en `student_skills`, **24 conversaciones y 108 mensajes de chat** |

---

## 2. Contradicciones detectadas entre lo existente y la V2

Según §1, se registran aquí y se resuelven aplicando la V2.

| # | Regla anterior / estado actual | Regla V2 | Resolución |
|---|---|---|---|
| C1 | Afinidad V2: intereses (hasta 10) y habilidades autodeclaradas (hasta 4) suman puntos; escala sobre 60 | §21, §45.1: lo declarado **no** aporta afinidad; escala directa sobre 100 (25/50/25) | Motor V3 nuevo; V2 se conserva como historia (`engine_version=2`) — BATCH 9 |
| C2 | El estudiante declara nivel BÁSICO/INTERMEDIO/AVANZADO por habilidad | §22: se elimina como competencia; solo interés en tecnologías | Nueva tabla `student_skill_interests`, migración de datos, retiro de la UI — BATCH 3 |
| C3 | Activación 72 h, recuperación 60 min, 5 intentos de código | §15.3: 48 h, 30 min, **10** intentos | Configuración y defaults — BATCH 1/2 |
| C4 | Código universitario opcional en el alta manual | §12: obligatorio | BATCH 2 |
| C5 | Bienvenida: perfil → disponibilidad → intereses → habilidades (con nivel) → cuestionario | §20.1: perfil base → preferencias e intereses → áreas de mejora → disponibilidad y colaboración (+ privacidad básica) → orientación opcional | BATCH 3 |
| C6 | Actividades de Docente y Sociedad se publican directamente | §27: requieren aprobación de Dirección (`review_status`) | BATCH 5 |
| C7 | Chat interno con endpoints y pantallas | §57, §83: se retira; datos existentes se conservan sin acceso funcional | BATCH 11 |
| C8 | App móvil con pantallas de Docente, Director, Sociedad y Admin | §8.2, §67: solo Estudiante | BATCH 15 |
| C9 | Gamificación: criterios globales + retos docentes + recompensas canjeables (correcciones de QA) | §31: catálogo global + **reglas por actividad** revisadas por Dirección; RF22: eventos, puntos, insignias, historial | Se implementan las reglas por actividad. Retos y recompensas **no contradicen** la V2 (no tocan afinidad ni nota, los disparadores de §31.2 se listan «por ejemplo») y salen de `corregir.docx`, que la V2 integra: se conservan como extensión y se registran para que el propietario la confirme |
| C10 | Menú del docente: «Reportes del curso» | §62: renombrar («Panel académico») | BATCH 13 |
| C11 | `.env.example` con `POSTGRES_PORT=5432`; scripts Docker sin `--env-file` | §10: sugerir 5435; `--env-file .env` explícito; `db:wait` y `db:rebuild` | BATCH 1 |
| C12 | Refresh token de la web en `localStorage` | §18: refresh HttpOnly/Secure/SameSite en producción «cuando sea viable» | BATCH 2: cookie HttpOnly para la web; el móvil sigue con SecureStore |
| C13 | Variable `ACCOUNT_EMAILS_MAX_PER_DAY` | §15.3: `ACTIVATION_RESEND_MAX_PER_DAY` | Se adopta el nombre V2 y se acepta el anterior como respaldo |

---

## 3. Clasificación por sección

### Configuración (§10)

| Requisito | Estado | Observación |
|---|---|---|
| Puerto interno 5432, host por `POSTGRES_PORT` | IMPLEMENTADO | `docker-compose.yml` |
| `.env.example` sugiere 5435 | INCORRECTO | sugiere 5432 |
| Scripts con `--env-file .env` | FALTANTE | |
| `db:wait`, `db:rebuild` | FALTANTE | existen `db:up/down/reset/logs` |
| Sin hardcodes (puertos, dominios, TTL, IA, GitHub) | PARCIAL | faltan `AI_*`, `HELP_VIDEO_URL` |

### Identidad, activación, recuperación, sesiones, SMTP (§11–§19)

| Requisito | Estado | Observación |
|---|---|---|
| Sin registro público; padrón, alta manual, seed admin | IMPLEMENTADO | |
| Estados PENDING_ACTIVATION/ACTIVE/SUSPENDED/INACTIVE, sin hard delete | IMPLEMENTADO | |
| Alta manual con semestre obligatorio | IMPLEMENTADO | corrección de QA |
| Alta manual con código universitario obligatorio | INCORRECTO | opcional (C4) |
| Padrón CSV con NEW/UPDATE/UNCHANGED/CONFLICT/INVALID, idempotente, sin desactivar ausentes | IMPLEMENTADO | `imports.service.ts` |
| Dominios institucionales configurables; admin sin códigos | IMPLEMENTADO | |
| Enlace + código, solo hashes, 1 uso, nuevo invalida anterior | IMPLEMENTADO | |
| TTL 48 h / 30 min / 10 intentos | INCORRECTO | C3 |
| Reenvío: genérico, cooldown, límite diario, rate limit, auditoría | IMPLEMENTADO | |
| Recuperación revoca sesiones | IMPLEMENTADO | |
| Política de contraseña igual en servidor y web; barra completa | PARCIAL | falta «no contener el código universitario» y máximo 128 explícito en la web |
| Access 15 min + refresh rotatorio, revocación por cambio de clave/suspensión, logout | IMPLEMENTADO | |
| Refresh HttpOnly en web | FALTANTE | C12 |
| `MailPort`, SMTP real, variables, estado de intento | IMPLEMENTADO | estados internos `pending/sending/sent/failed`: se exponen como QUEUED/SENT_TO_SMTP/FAILED |
| Documentación SPF/DKIM/DMARC, rebotes, Outlook | PARCIAL | `docs/CORREO_REAL.md` cubre SPF/DKIM; ampliar DMARC, rebotes y prueba con Outlook |

### Onboarding y datos declarados (§20–§22)

| Requisito | Estado | Observación |
|---|---|---|
| Asistente guiado que bloquea hasta terminar | IMPLEMENTADO | web (`OnboardingGate`) y móvil |
| Secuencia de 5 pasos de §20.1 | INCORRECTO | C5 |
| Confirmación visual de datos institucionales | PARCIAL | se muestra el semestre; falta paso de confirmación explícito |
| Privacidad básica dentro de la bienvenida | FALTANTE | |
| Decisión de disponibilidad obligatoria | PARCIAL | paso existe pero no es obligatorio |
| Cuestionario opcional, guardar avance, repetir, adaptativo | IMPLEMENTADO | |
| Sugerencias confirmadas antes de ser preferencias | IMPLEMENTADO | `runs/:id/confirm` |
| Interés por tecnología | FALTANTE | C2 |
| Nivel autodeclarado de habilidad | OBSOLETO | C2 |
| Lo declarado no aporta afinidad | INCORRECTO | C1 |

### Catálogos (§23–§25)

| Requisito | Estado | Observación |
|---|---|---|
| Área: code, nombre, etiquetas obligatorias, descripción opcional, baja lógica | IMPLEMENTADO | corrección de QA |
| Nombre de área único normalizado | PARCIAL | se valida por `ILIKE`; falta índice único normalizado |
| Skill: área obligatoria, code único, baja lógica | IMPLEMENTADO | |
| Skill: `aliases[]` | FALTANTE | |
| Validación semántica (reglas canónicas que bloquean, aviso, sugerencia) | FALTANTE | |
| Nombres técnicos (C++, C#, .NET, Node.js, CI/CD) | PARCIAL | falta `/` en la regla de nombres |
| Categorías: code, name, applies_to obligatorio (BOTH por defecto) | IMPLEMENTADO | BOTH se guarda como `null`; se mantiene, documentado |
| Recursos externos (catálogo controlado) | IMPLEMENTADO | `learning_resources` |
| Sin pantalla de roles | IMPLEMENTADO | |

### Actividades, TeacherScope, participación, constancias (§26–§30)

| Requisito | Estado | Observación |
|---|---|---|
| Lifecycle DRAFT…CANCELLED | IMPLEMENTADO | |
| `review_status` y flujo Docente/Sociedad → Dirección (aprobar/observar/rechazar, reenviar) | IMPLEMENTADO | C6 · BATCH 5 |
| Director publica sin segunda autoridad | IMPLEMENTADO | (pasa a `NOT_REQUIRED`) |
| Publicación solo con `NOT_REQUIRED/APPROVED` | IMPLEMENTADO | BATCH 5 (409 en la API) |
| Sociedad solo extracurriculares | IMPLEMENTADO | |
| TeacherScope como fuente única; semestres seleccionables | IMPLEMENTADO | `TeacherScopeService` |
| Participación INTERESTED…CANCELLED, solo CONFIRMED es experiencia, confirmación transaccional con efectos | IMPLEMENTADO | |
| Constancia requiere CONFIRMED, no duplica afinidad | IMPLEMENTADO | |
| `internal_constancy_enabled` en la actividad, aprobado por Dirección | IMPLEMENTADO | BATCH 5 |
| `authorized_by` en constancia | IMPLEMENTADO | BATCH 5 (`authorized_by` = Dirección que aprobó; `issued_by` = quien emite) |

### Gamificación (§31)

| Requisito | Estado | Observación |
|---|---|---|
| Independiente de afinidad | IMPLEMENTADO | |
| Catálogo global (admin) | IMPLEMENTADO | |
| Reglas por actividad, revisadas por Dirección | IMPLEMENTADO | BATCH 5 (`activity_gamification_rules`) |
| Puntos positivos, rango configurable, idempotentes | IMPLEMENTADO | BATCH 5 (`GAMIFICATION_ACTIVITY_MAX_POINTS`) |
| Insignias sin valor oficial | IMPLEMENTADO | |
| Retos y recompensas | EXTENSIÓN | C9 |

### Proyectos, evidencias, GitHub, URL, archivos, OCR, certificados, validación (§32–§42)

| Requisito | Estado | Observación |
|---|---|---|
| Proyecto sin aprobación, estados y visibilidades | IMPLEMENTADO | |
| Integrantes con aceptación; rol, contribución y skills confirmados por el integrante | IMPLEMENTADO | |
| `skills_used` por integrante | IMPLEMENTADO | `project_member_skills` |
| Evidencia con propietario `student_profile_id` | IMPLEMENTADO | |
| Backing tiers de §36 | IMPLEMENTADO | `project-backing.service.ts` |
| GitHub limitado, manifiestos permitidos | IMPLEMENTADO | `repository-inspector.service.ts` |
| Comprobación de demo | IMPLEMENTADO | `link-checker.service.ts` |
| Storage privado, metadatos, SHA-256 | IMPLEMENTADO | |
| OCR con estados, resiliente | IMPLEMENTADO | |
| Certificados con backing | IMPLEMENTADO | |
| SSRF | IMPLEMENTADO | `link-checker.service.ts` (localhost, privadas, metadata, redirects, tamaño, timeout) |

### IA (§43, §44, §84)

| Requisito | Estado | Observación |
|---|---|---|
| `AiAssistancePort`, `AI_PROVIDER=none` funcional | FALTANTE | |
| Tareas, registro de ejecución, aceptación explícita | FALTANTE | |
| Moderación de nombres de equipo (reglas + lista configurable + IA opcional) | FALTANTE | |

### Afinidad, respaldo, recálculo (§45–§52, §81)

| Requisito | Estado | Observación |
|---|---|---|
| Motor determinista, versionado, explicable | IMPLEMENTADO | versión 2 |
| Fórmula V3 (25/50/25 directa, sin declarados) | FALTANTE | C1 |
| Asignación de proyecto a área por `skills_used` del integrante | PARCIAL | revisar y alinear en V3 |
| Support V3 (8/+4, 0/8/15/20, 0/8/15, otros 10; HIGH con 2 familias) | IMPLEMENTADO | mismos valores que la V2 |
| Contribuciones persistidas y snapshots | IMPLEMENTADO | |
| Recálculo central automático | IMPLEMENTADO | `TrajectoryRecalculationService` |
| Migración V2→V3 sin sobrescribir historia | FALTANTE | |

### Recomendaciones (§53–§55)

| Requisito | Estado | Observación |
|---|---|---|
| Determinista, explicable, filtros duros | IMPLEMENTADO | |
| Pesos 35/25/20/10/10 | INCORRECTO | pesos de AFINIA 100 |
| Uso de intereses por tecnología | FALTANTE | depende de C2 |
| Equipos: 50/20/15/15, sin popularidad, sin invitación automática | PARCIAL | revisar pesos |

### Colaboración (§56–§60)

| Requisito | Estado | Observación |
|---|---|---|
| Contactos con solicitud/aceptación | IMPLEMENTADO | |
| Alias, contexto, canal preferido en contacto | PARCIAL | |
| Chat | OBSOLETO | C7 |
| Perfil público opt-in, slug rotable, QR solo URL, sin datos sensibles | IMPLEMENTADO | |
| Canales de contacto (Teams, WhatsApp, LinkedIn, correo de contacto, enlace) | FALTANTE | |
| Perfil dinámico vs trayectoria separados | PARCIAL | revisar textos de UI |

### CV, paneles, ayuda, UX, móvil (§61–§67)

| Requisito | Estado | Observación |
|---|---|---|
| CV PDF con selección y disclaimer | IMPLEMENTADO | una sola plantilla |
| 2–3 plantillas | FALTANTE | |
| Asistencia IA de redacción con aprobación | FALTANTE | depende de §43 |
| Panel docente por semestre, sin datos oficiales de asignatura | PARCIAL | renombrar (C10) |
| Analítica de Dirección descriptiva, umbral de privacidad | IMPLEMENTADO | |
| Métricas de Sociedad solo de sus actividades | IMPLEMENTADO | |
| Tutorial reabrible, centro de ayuda por actor, `HELP_VIDEO_URL` | FALTANTE | |
| UX estudiante, sin parpadeo, validación por campo | IMPLEMENTADO | corrección de QA |
| `prefers-reduced-motion` | PARCIAL | CSS sí; framer-motion no |
| Móvil solo Estudiante | INCORRECTO | C8 |
| Auditoría Expo (`expo doctor`) | FALTANTE | |

### Auditoría, integridad, transacciones (§69–§74)

| Requisito | Estado | Observación |
|---|---|---|
| Eventos críticos sin datos sensibles | PARCIAL | faltan los de revisión de actividad, IA y perfil público |
| Constraints mínimos de §73 | PARCIAL | faltan nombres normalizados únicos de área/skill y unicidad de interés por tecnología |
| Transacciones de §74 | IMPLEMENTADO | |

### Pruebas (§79)

| Requisito | Estado | Observación |
|---|---|---|
| E2E de API (integración real con PostgreSQL) | IMPLEMENTADO | 16 suites |
| Unitarias de reglas (afinidad V3, review, password, cooldown, scoring) | FALTANTE | se añaden con el runner nativo de Node sobre `@perfil/shared` y servicios puros |
| Playwright (web) | FALTANTE | se intentará con el navegador Edge instalado |
| Maestro/emulador, ZAP, k6, SonarQube | FALTANTE | requieren herramientas externas no instaladas en esta máquina; se dejan scripts y procedimiento, y se reporta como pendiente |

---

## 4. Plan por batches

| Batch | Contenido | Prueba que lo cierra |
|---|---|---|
| 1 | Docker `--env-file`, `db:wait`, `db:rebuild`, `.env.example`, TTL V2, variables IA/ayuda, validación de entorno | `npm run db:wait`, arranque |
| 2 | Código universitario obligatorio, 10 intentos, política de contraseña completa, refresh HttpOnly web, estados de correo, docs entregabilidad | suite V2 nueva + regresión |
| 3 | Bienvenida V2 (5 pasos, privacidad, disponibilidad obligatoria), intereses por tecnología, migración de `student_skills`, retiro del nivel | suite V2 |
| 4 | Aliases, validación semántica, unicidad normalizada, nombres técnicos | suite V2 |
| 5 | Revisión de actividades por Dirección, constancia habilitada, reglas de gamificación por actividad, pantalla de aprobaciones | suite V2 |
| 7 | Alinear asignación por `skills_used` (resto de §32–§42 ya cumple) | suite V2 |
| 8 | Puerto de IA, adaptador `openai_compatible`, registro de ejecuciones, moderación de nombres de equipo | suite V2 (sin depender del modelo) |
| 9 | Afinidad V3, migración de versión, recálculo, UI | unitarias + suite V2 |
| 10 | Recomendaciones 35/25/20/10/10 con intereses por tecnología; pesos de equipos | suite V2 |
| 11 | Retiro del chat, canales de contacto, datos de contacto | suite V2 |
| 12 | Plantillas de CV, texto asistido con aprobación | suite V2 |
| 13 | Panel académico docente | regresión |
| 14 | Centro de ayuda y tutorial, movimiento reducido, navegación por actor (§77) | build + Playwright |
| 15 | Móvil solo estudiante, auditoría Expo | `tsc`, `expo doctor` |
| 16 | Unitarias, Playwright, revisión de seguridad | todas las suites |
| 17 | Limpieza, README, Swagger, matriz de trazabilidad, documento de cambios para el documento de grado | — |

El BATCH 6 no requiere cambios de código: §39–§42 están implementados (ver tabla). Se
verifica en la regresión.
