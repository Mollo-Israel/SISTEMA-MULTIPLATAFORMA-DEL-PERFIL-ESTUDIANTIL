# Matriz de trazabilidad — 50 % del Proyecto de Grado

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

**Alcance del 50 %:** los cinco primeros objetivos específicos del documento, que
corresponden a **RF1 – RF16**. El documento define 10 objetivos específicos y 25
requerimientos funcionales.

**Verificación automatizada, sobre base recreada desde cero y en dos corridas
consecutivas:**

| Suite | Comando | Resultado |
|---|---|---|
| Objetivos 1 – 4 | `npm run test:40` | **235 OK · 0 fallos** |
| Objetivo 5 | `npm run test:50` | **109 OK · 0 fallos** |
| Validaciones de backend | `npm run test:api` | **42 OK · 0 fallos** |
| Flujo de 14 pasos | `npm run demo:e2e` | **25 OK · 0 fallos** |
| **Total** | | **411 verificaciones · 0 fallos** |

Un requisito se marca **CUMPLIDO** solo si tiene modelo de datos, migración,
backend con permisos y validaciones, endpoint, pantalla que consume la API real,
persistencia comprobada, flujos de éxito y de fallo, y prueba automatizada que
pasa.

---

## Objetivos 1 – 4 (RF1 – RF12 · heredados del 40 %)

Su detalle completo está en
[`MATRIZ_TRAZABILIDAD_40.md`](MATRIZ_TRAZABILIDAD_40.md), que sigue vigente. El
resumen:

| Objetivo | RF | Verificaciones | Estado |
|---|---|---|---|
| 1 — Usuarios, autenticación, roles y acceso | RF1 – RF4 | 63 | **CUMPLIDO** |
| 2 — Perfil estudiantil dinámico | RF5, RF6 | 59 | **CUMPLIDO** |
| 3 — Actividades académicas y extracurriculares | RF7 – RF9 | 47 | **CUMPLIDO** |
| 4 — Participación, evidencias y constancias | RF10 – RF12 | 66 | **CUMPLIDO** |

**Sin regresiones:** las 235 verificaciones del 40 % siguen pasando tras el
Objetivo 5. Dos cambios del cierre tocaron código del 40 % y ambos fueron
correcciones, no funcionalidad nueva:

- **Filtro de fechas de RF8:** `"2026-09-12"` se interpretaba como medianoche
  UTC, lo que corría el rango un día en zonas con desfase negativo (Bolivia es
  UTC−4). Ahora una fecha sin hora se construye componente a componente.
- **Detalle de proyecto:** `findOneForUser` permitía a docente, director y
  administrador abrir *cualquier* proyecto por su ID. Ver el Objetivo 5.

---

## Objetivo 5 — Portafolio de proyectos estudiantiles

### RF13 · Gestionar proyecto del portafolio

| Campo | Contenido |
|---|---|
| **Objetivo** | 5 — Portafolio de proyectos estudiantiles |
| **Regla de negocio** | RN-12 |
| **Actor** | Estudiante |
| **Entidad** | `projects` (+ `projects.visibility`), `project_evidences` |
| **Migración** | `1780230000000-Objective5Portfolio` |
| **Controlador** | `ProjectsController` |
| **Servicio** | `ProjectsService` |
| **Endpoints** | `POST /projects` · `PATCH /projects/:id` · `GET /projects/:id` · `POST /projects/:id/evidences` · `DELETE /projects/:id/evidences/:evidenceId` |
| **Interfaz** | Móvil · *Portafolio* → *Nuevo proyecto* y *Proyecto* → *Editar* |
| **Prueba** | 13.1 – 13.25 |
| **Caso de uso** | Figura 2.4 · Tabla 2.22 |
| **Secuencia** | Figura 2.25 |
| **Estado** | **CUMPLIDO** |

Cubre nombre, descripción, área académica, tecnologías, estado, repositorio,
demostración, evidencias y **nivel de visibilidad**. Las evidencias usan el
almacenamiento real del Objetivo 4: `POST /uploads` valida tipo y tamaño, y el
nombre en disco lo genera el sistema.

### RF14 · Gestionar integrantes de proyecto

| Campo | Contenido |
|---|---|
| **Objetivo** | 5 |
| **Regla de negocio** | RN-12 |
| **Actor** | Estudiante (responsable e invitado) |
| **Entidad** | `project_invitations` (nueva), `project_members` |
| **Migración** | `1780230000000-Objective5Portfolio` |
| **Controlador** | `ProjectsController` |
| **Servicio** | `ProjectMembersService` |
| **Endpoints** | `POST /projects/:id/invitations` · `GET /projects/:id/invitations` · `PATCH /projects/:id/invitations/:invitationId/cancel` · `GET /projects/:id/members` · `DELETE /projects/:id/members/:memberId` · `GET /projects/invitations/mine` · `PATCH /projects/invitations/:invitationId` |
| **Interfaz** | Móvil · *Proyecto* → *Integrantes* e *Invitaciones enviadas*; *Portafolio* → pestaña *Invitaciones* |
| **Prueba** | 14.1 – 14.29 |
| **Caso de uso** | Figura 2.4 · Tabla 2.23 |
| **Secuencia** | Figura 2.26 |
| **Estado** | **CUMPLIDO** |

La regla central del documento se cumple literalmente: **la pertenencia nace
solo cuando el invitado acepta**. Verificado en 14.9, 14.10, 14.16, 14.17 y
14.19.

### RF15 · Consultar portafolio de proyectos

| Campo | Contenido |
|---|---|
| **Objetivo** | 5 |
| **Regla de negocio** | RN-12, RN-13, RN-23 |
| **Actores** | Estudiante y Docente |
| **Entidad** | `projects`, `project_members`, `teacher_semester_access` |
| **Migración** | `1780230000000` (visibilidad) · `1780200000000` (alcance docente) |
| **Controlador** | `ProjectsController` |
| **Servicio** | `ProjectsService` + `TeacherScopeService` |
| **Endpoints** | `GET /projects/my` · `GET /projects/institutional` · `GET /projects/:id` · `GET /projects/:id/members` |
| **Interfaz** | Móvil · *Portafolio* (tres secciones) · Web · *Proyectos estudiantiles* |
| **Prueba** | 15.1 – 15.29 |
| **Caso de uso** | Figura 2.4 · Tabla 2.24 |
| **Secuencia** | Figura 2.27 |
| **Estado** | **CUMPLIDO** |

El docente ve un proyecto solo si se cumplen **las dos condiciones**: el
proyecto está marcado como visible para docentes **y** el estudiante responsable
pertenece a un semestre de su alcance. No puede saltarse el alcance escribiendo
el ID (prueba 15.18).

### RF16 · Registrar retroalimentación sobre proyecto

| Campo | Contenido |
|---|---|
| **Objetivo** | 5 |
| **Regla de negocio** | RN-13 |
| **Actor** | Docente |
| **Entidad** | `project_feedback` (nueva) |
| **Migración** | `1780230000000-Objective5Portfolio` |
| **Controlador** | `ProjectFeedbackController` |
| **Servicio** | `ProjectFeedbackService` |
| **Endpoints** | `GET /projects/:projectId/feedback` · `POST /projects/:projectId/feedback` · `PATCH /projects/:projectId/feedback/:feedbackId` |
| **Interfaz** | Web · *Proyectos estudiantiles* → detalle · Móvil · *Proyecto* → *Retroalimentación docente* |
| **Prueba** | 16.1 – 16.21 |
| **Caso de uso** | Figura 2.4 · Tabla 2.25 |
| **Secuencia** | Figura 2.28 |
| **Estado** | **CUMPLIDO** |

La entidad no tiene nota, puntaje ni estado de aprobación, y eso es deliberado:
RN-13 excluye expresamente la evaluación académica formal.

---

## Reglas de negocio del Objetivo 5

| Regla | Enunciado del documento | Verificación |
|---|---|---|
| RN-12 | El estudiante registra y actualiza proyectos con integrantes, roles, tecnologías, enlaces, evidencias y estado | 13.1 – 13.25, 14.19 – 14.24 |
| RN-12 | El portafolio no gestiona propiedad intelectual, contratos, patrocinio ni incubación | Sin campos de esa naturaleza en el esquema |
| RN-13 | El docente comenta únicamente proyectos disponibles para su consulta según la visibilidad definida | 16.13, 16.14, 16.15 |
| RN-13 | La retroalimentación es orientación complementaria, no una nota ni una evaluación | Sin puntaje ni aprobación; texto explícito en web y móvil |
| RN-23 | El docente accede solo a la información permitida de su contexto académico | 15.17, 15.18, 15.20, 15.22 |

---

## Resumen

| Objetivo | RF | Verificaciones | Estado |
|---|---|---|---|
| 1 — Usuarios, autenticación, roles y acceso | RF1 – RF4 | 63 | **100 %** |
| 2 — Perfil estudiantil dinámico | RF5, RF6 | 59 | **100 %** |
| 3 — Actividades académicas y extracurriculares | RF7 – RF9 | 47 | **100 %** |
| 4 — Participación, evidencias y constancias | RF10 – RF12 | 66 | **100 %** |
| 5 — Portafolio de proyectos estudiantiles | RF13 – RF16 | 109 | **100 %** |
| **Avance total** | **RF1 – RF16 de 25** | **411** | **50 %** |

---

## Alineación con el documento

**El software se alineó al documento** en todo el Objetivo 5: se implementó la
visibilidad del proyecto, el flujo de invitación con aceptación explícita, la
consulta docente con doble condición y la retroalimentación.

**El documento debe alinearse al software** en seis puntos de modelo y
nomenclatura, detallados en
[`CORRECCIONES_DOCUMENTO_FINAL_50.md`](CORRECCIONES_DOCUMENTO_FINAL_50.md). El
único de prioridad alta es la separación de `ProjectInvitation` respecto de
`ProjectMember` en la Figura 2.12, donde el diagrama de clases contradice a su
propia Tabla 2.23.

**Estas correcciones documentales, y las 17 del 40 %, siguen pendientes de
aplicar en el archivo Word.**
