# Matriz de trazabilidad — 40 % del Proyecto de Grado

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

Verificación automatizada: `npm run test:40` → **179 verificaciones, 0 fallos**
(más `npm run test:api` → 42 OK y `npm run demo:e2e` → 25 OK; **246 en total**).

Un requisito se marca **CUMPLIDO** solo si tiene modelo de datos, migración,
backend con permisos y validaciones, endpoint, interfaz que consume la API real,
persistencia comprobada, flujos de éxito y de fallo, y prueba automatizada que pasa.

> **Nota sobre la fuente de verdad.** El documento del Proyecto de Grado no está
> versionado en este repositorio. Esta matriz se construyó con las reglas
> enunciadas explícitamente en la especificación de la iteración (responsables de
> cada tipo de actividad, semestres habilitados del docente, subida real de
> archivos, constancia solo del director). Las interpretaciones que tomé donde el
> texto admitía más de una lectura están marcadas y listadas al final.

---

## Objetivo 1 — Usuarios, autenticación, roles y control de acceso

| RF | Actor | Regla de negocio | Backend | Entidad | Endpoint | Web / Móvil | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| RF1 | Estudiante | El rol STUDENT se asigna siempre por el servidor; nadie se autootorga rol | `AuthService.register` | `users`, `roles` | `POST /auth/register` | Móvil: pantalla de registro | 1.1–1.9 | **CUMPLIDO** |
| RF1 | Estudiante | Correo institucional, contraseña fuerte, sin duplicados, sin campos extra | `RegisterDto` + `ValidationPipe` global | `users` | `POST /auth/register` | Móvil | 1.5–1.9 | **CUMPLIDO** |
| RF2 | Todos | Login, logout, cuenta activa/inactiva, credenciales inválidas | `AuthService.login`, `JwtStrategy` | `users` | `POST /auth/login`, `GET /auth/me` | Web + Móvil | 2.1–2.4 | **CUMPLIDO** |
| RF2 | Todos | Redirección y permisos por rol; el backend es la autoridad final | `JwtAuthGuard` + `RolesGuard` globales | `roles` | Todas | Web: `ProtectedRoute`, `HOME_BY_ROLE`; Móvil: `RootNavigator` | 2.5–2.7 | **CUMPLIDO** |
| RF2 | Todos | **El usuario desactivado no puede usar el sistema, ni con un token vigente** | `JwtStrategy.validate` consulta la BD en cada petición | `users.status` | Todas | Web + Móvil (interceptor 401 → cierra sesión) | 3.15–3.19 | **CUMPLIDO** |
| RF3 | Administrador | Listar y buscar usuarios | `UsersService.findAll` | `users` | `GET /users?search=` | Web: Gestión de usuarios | 3.6, 3.7 | **CUMPLIDO** |
| RF3 | Administrador | Crear usuarios **institucionales**; no crea STUDENT ni otro ADMIN | `CreateUserDto` + `INSTITUTIONAL_ROLES` | `users`, `roles` | `POST /users` | Web | 3.1–3.5 | **CUMPLIDO** |
| RF3 | Administrador | Editar información y asignar rol | `UsersService.update` | `users` | `PATCH /users/:id` | Web: diálogo de edición | 3.8 | **CUMPLIDO** |
| RF3 | Administrador | Activar / desactivar cuenta | `UsersService.setActive` | `users.status` | `PATCH /users/:id/status` | Web (con confirmación) | 3.15, 3.18 | **CUMPLIDO** |
| RF3 | Administrador | **Semestres habilitados para consulta del docente** | `UsersService.setTeacherSemesters` | `teacher_semester_access` (nueva) | `GET/PUT /users/:id/semesters` | Web: selector de semestres | 3.9–3.13 | **CUMPLIDO** |
| RF4 | Administrador | Gestión de áreas académicas (alta, edición, estado) | `CatalogsService` | `academic_areas.is_active` | `GET/POST/PATCH /academic-areas` | Web: Áreas académicas | 4.1–4.5 | **CUMPLIDO** |
| RF4 | Administrador | Gestión de habilidades (alta, edición, estado) | `CatalogsService` | `skills.is_active` | `GET/POST/PATCH /skills` | Web: Catálogo de habilidades | 4.6, 4.7 | **CUMPLIDO** |
| RF4 | Administrador | Administración persistente del criterio de gamificación | `CatalogsService` | `gamification_criteria` (nueva) | `GET/POST/PATCH /gamification-criteria` | Web: Criterios de gamificación | 4.8–4.10 | **CUMPLIDO (soporte)** |

**Alcance declarado de RF4 / gamificación:** el criterio se administra y persiste
de verdad, pero **ningún módulo lo consume todavía**: el motor que otorga puntos
e insignias pertenece a una fase posterior. No se generan puntos falsos. La UI
lo dice explícitamente en pantalla.

---

## Objetivo 2 — Perfil estudiantil dinámico

| RF | Actor | Regla de negocio | Backend | Entidad | Endpoint | Web / Móvil | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| — | Estudiante | Crear perfil, uno por usuario | `ProfilesService.createMyProfile` | `student_profiles` (1:1 con `users`) | `POST /profiles/me` | Móvil: Perfil | 2.1–2.3 | **CUMPLIDO** |
| — | Estudiante | Consultar y editar su perfil; semestre 1–8 | `getOwnProfile`, `updateMyProfile` | `student_profiles` | `GET/PATCH /profiles/me` | Web + Móvil | 2.4, 2.10–2.13 | **CUMPLIDO** |
| — | Estudiante | Áreas de interés / preferencia con prioridad 1–5 | `addInterests`, `replaceInterests` | `student_interests` (`CHECK` 1–5) | `POST/PUT /profiles/me/interests` | Web + Móvil | 2.5–2.7 | **CUMPLIDO** |
| — | Estudiante | Habilidades con nivel 1–5 | `addSkills`, `replaceSkills` | `student_skills` (`CHECK` 1–5) | `POST/PUT /profiles/me/skills` | Web + Móvil | 2.8, 2.9 | **CUMPLIDO** |
| — | Estudiante | Áreas donde desea mejorar | `updateMyProfile` | `student_profiles.improvement_area_ids` | `PATCH /profiles/me` | Web + Móvil | 2.13, 2.19 | **CUMPLIDO** |
| — | Estudiante | Completitud automática (5 × 20 %) | `refreshCompletion` | `completion_percentage`, `status` | derivado | Web + Móvil: barra de progreso | 2.14, 2.15 | **CUMPLIDO** |
| — | Estudiante | Resumen dinámico que integra toda la trayectoria real | `buildSummary` | 10 tablas | `GET /profiles/me/summary` | Web: Inicio; Móvil: Inicio | 2.16–2.26 | **CUMPLIDO** |
| — | Estudiante | Sin datos inventados: las secciones vacías se muestran vacías | `buildSummary` | — | — | Estados vacíos explícitos en ambos clientes | 2.25 | **CUMPLIDO** |
| — | Docente | **Solo consulta los semestres habilitados** | `TeacherScopeService` | `teacher_semester_access` | `GET /profiles/students` | Web: aviso de alcance; Móvil: directorio | 2.28–2.33, 2.42, 2.43 | **CUMPLIDO** |
| — | Docente / Director | Vista permitida: sin correo, sin constancias internas, sin identificadores internos | `getAllowedView` | — | `GET /profiles/:id/allowed` | Web + Móvil | 2.34–2.40, 4.58 | **CUMPLIDO** |
| — | Estudiante | No accede al perfil de otro estudiante | `RolesGuard` | — | — | — | 2.41 | **CUMPLIDO** |
| — | Todos | No se exponen credenciales ni hashes | `toPublicUser`, `buildSummary` | — | — | — | 1.4, 2.27 | **CUMPLIDO** |

**Interpretación registrada.** El documento enumera «intereses» y «áreas de
preferencia» como ítems declarativos distintos. El modelo existente resuelve
ambos con una sola estructura correcta: `student_interests` asocia el perfil a un
**área académica** con una **prioridad de 1 a 5**, es decir, un interés declarado
*es* una preferencia por esa área, y la prioridad expresa el grado. **No se
duplicó una tabla** para separarlos. Si el documento pide un campo de intereses
libres (temas fuera del catálogo de áreas), es un añadido de un solo campo y está
señalado en `AVANCE_40_PORCIENTO.md` como punto a confirmar.

---

## Objetivo 3 — Actividades académicas y extracurriculares

| RF | Actor | Regla de negocio | Backend | Entidad | Endpoint | Web / Móvil | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| — | Director de carrera | **Gestiona las actividades académicas** | `assertCanPublish`, `OWNER_ROLE_BY_TYPE` | `activities` | `POST /activities` | Web: Actividades académicas; Móvil: pestaña Actividades | 3.1, 3.2 | **CUMPLIDO** |
| — | Sociedad científica | **Gestiona las extracurriculares** | idem | `activities` | `POST /activities` | Web: Actividades extracurriculares; Móvil | 3.4 | **CUMPLIDO** |
| — | Docente | **Ya no publica actividades**: rol de consulta | `MANAGER_ROLES` en el controlador | — | — | Web: Actividades del programa (solo lectura); Móvil idem | 3.6 | **CUMPLIDO** |
| — | Cruzado | Cada rol solo publica su tipo | `assertCanPublish` | — | — | Categorías filtradas por tipo en el formulario | 3.3, 3.5, 3.7 | **CUMPLIDO** |
| — | Responsable | Editar, publicar y gestionar el estado | `ActivitiesService.update` | `activities.status` | `PATCH /activities/:id` | Web: selector de estado en línea; Móvil: chips | 3.8, 3.11, 3.14 | **CUMPLIDO** |
| — | Responsable | Datos completos: título, descripción, tipo, categoría, área, fecha, modalidad, ubicación, enlace, cupo, etiquetas, estado, responsable | `CreateActivityDto` | `activities` | `POST/PATCH /activities` | Formulario completo en web | 3.1, 3.8 | **CUMPLIDO** |
| — | Responsable | Panel con sus actividades, incluidos borradores | `findManagedBy` | — | `GET /activities/managed` | Web + Móvil | 3.12, 3.13 | **CUMPLIDO** |
| — | Estudiante | Listar actividades y aplicar filtros | `findAll` | — | `GET /activities?type&category&status&areaId` | Web (docente) + Móvil (estudiante) | 3.15–3.18 | **CUMPLIDO** |
| — | Estudiante | Abrir detalle con su propio estado y cupos | `findOneForStudent` | — | `GET /activities/:id` | Móvil: detalle desplegable | 3.19–3.22, 3.27 | **CUMPLIDO** |
| — | Estudiante | Registrar interés e inscribirse | `registerInterest`, `register` | `activity_registrations` | `POST /:id/register-interest`, `/register` | Móvil | 3.23, 3.25 | **CUMPLIDO** |
| — | Estudiante | No ve borradores ni se inscribe en ellos | `findAll`, `registrationBlockReason` | — | — | — | 3.9, 3.10 | **CUMPLIDO** |
| — | Estudiante | Rechazo de duplicados, actividad cerrada, cancelada, pasada e inexistente | `upsertRegistration`, `registrationBlockReason` | — | — | Botón deshabilitado + motivo en pantalla | 3.24, 3.26, 3.29–3.33 | **CUMPLIDO** |
| — | Estudiante | «Mis actividades» con el estado de cada una | `findMyRegistrations` | — | `GET /activities/my-registrations` | Móvil, agrupadas por estado | 3.28 | **CUMPLIDO** |

---

## Objetivo 4 — Participación, evidencias y certificados

| RF | Actor | Regla de negocio | Backend | Entidad | Endpoint | Web / Móvil | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|
| RF10 | Director / Sociedad | **Registran asistencia en las actividades que gestionan** | `confirmParticipation` + `assertCanManage` | `activity_registrations` | `PATCH /:id/confirm-participation` | Web: `ActivityManager`; Móvil: `ManageActivities` | 4.6, 4.7, 4.9 | **CUMPLIDO** |
| RF10 | Responsable | Consultar participantes | `getParticipants` | — | `GET /:id/participants` | Web + Móvil | 4.1–4.5 | **CUMPLIDO** |
| RF10 | — | Estados pendiente / confirmado / ausente | `RegistrationStatus` | enum en BD | — | Agrupados en la interfaz | 4.9, 4.15 | **CUMPLIDO** |
| RF10 | — | Nadie registra su propia participación | `confirmParticipation` | — | — | — | 4.8 | **CUMPLIDO** |
| RF10 | — | Solo sobre quien se inscribió; el cupo lo controlan los confirmados | `assertConfirmCapacity` | — | — | Botón deshabilitado con cupo lleno | 4.10, 4.13, 4.14 | **CUMPLIDO** |
| RF10 | — | La participación confirmada alimenta perfil y afinidad | puerto `AFFINITY_RECALCULATION` | `affinity_results` | — | Visible en el perfil dinámico | 4.11, 4.12 | **CUMPLIDO** |
| RF11 | Estudiante | **Subida real de archivos** con validación de tipo y tamaño | `StoragePort` + `LocalStorageDriver` | archivo en disco | `POST /uploads` | Web: selector; Móvil: `expo-document-picker` | 4.16–4.25 | **CUMPLIDO** |
| RF11 | Estudiante | Evidencias por enlace o archivo | `EvidencesService` | `project_evidences` | `POST /evidences` | Web + Móvil | 4.26–4.30 | **CUMPLIDO** |
| RF11 | Estudiante | Asociar a proyecto, actividad o área | `EvidencesService` | `project_id`, `activity_id`, `academic_area_id` | — | Selectores en ambos clientes | 4.26, 4.28 | **CUMPLIDO** |
| RF11 | Estudiante | Solo evidencia de lo propio | `assertProjectAccess`, `assertActivityParticipation` | — | — | Solo se ofrecen sus actividades | 4.31, 4.33 | **CUMPLIDO** |
| RF11 | Estudiante | Listar y eliminar evidencias (también borra el archivo) | `findMine`, `remove` | — | `GET /evidences/my`, `DELETE /evidences/:id` | Web + Móvil | 4.32 | **CUMPLIDO** |
| — | Estudiante | Certificado externo: registrar, consultar, editar, eliminar | `CertificatesService` | `external_certificates` | `POST/GET/PATCH/DELETE /certificates/external` | Web + Móvil | 4.34–4.40 | **CUMPLIDO** |
| — | Estudiante | Nombre, emisor, fecha, área, archivo y descripción | `CreateExternalCertificateDto` | columnas nuevas | — | Formulario completo | 4.34–4.36 | **CUMPLIDO** |
| — | — | Fecha de emisión no futura | `IsNotFutureDate` | — | — | `max` en el campo de fecha | 4.37 | **CUMPLIDO** |
| — | — | El sistema **no certifica** el documento: es evidencia externa | copy explícito en API y UI | — | — | Texto en ambos clientes | — | **CUMPLIDO** |
| RF12 | **Solo Director de carrera** | Emitir constancia interna | `ConstanciesController` `@Roles` | `internal_constancies` | `POST /constancies/internal` | Web: Constancias internas; Móvil: pestaña Constancias | 4.43–4.45, 4.48 | **CUMPLIDO** |
| RF12 | — | Exige actividad existente y **participación CONFIRMADA** | `ConstanciesService.create` | — | — | Solo lista confirmados | 4.46, 4.47 | **CUMPLIDO** |
| RF12 | — | Vinculada a estudiante + actividad + participación | `activityRegistrationId` | FK | — | — | 4.49 | **CUMPLIDO** |
| RF12 | — | **Sin duplicados** | índice único parcial | `uq_constancy_student_activity` | — | Marca a quien ya la tiene | 4.50, 4.51 | **CUMPLIDO** |
| RF12 | Estudiante | La ve en su perfil dinámico | `buildSummary` | — | `GET /constancies/internal/my` | Web + Móvil | 4.52, 4.53 | **CUMPLIDO** |
| RF12 | — | No se presenta como certificado oficial | copy explícito | — | — | Texto en ambos clientes | — | **CUMPLIDO** |
| — | — | Integración final de toda la trayectoria en el perfil | `buildSummary` + motor de afinidad | — | — | Web + Móvil | 4.53–4.57 | **CUMPLIDO** |

---

## Resumen

| Objetivo | Requisitos verificados | Verificaciones E2E | Estado |
|---|---|---|---|
| 1 — Usuarios, autenticación, roles y acceso | 13 | 45 | **100 %** |
| 2 — Perfil estudiantil dinámico | 12 | 43 | **100 %** |
| 3 — Actividades académicas y extracurriculares | 13 | 33 | **100 %** |
| 4 — Participación, evidencias y certificados | 22 | 58 | **100 %** |
| **Total** | **60** | **179** | **0 fallos** |

## Interpretaciones que conviene confirmar contra el documento

1. **«Intereses» y «áreas de preferencia»** se resuelven con `student_interests`
   (área + prioridad 1–5). Ver la nota del Objetivo 2.
2. **«Actividades que gestionan»** (RF10) se implementó como: el creador, el
   administrador, o el rol responsable de ese tipo de actividad. Así la gestión
   no depende de que siga en el cargo la misma persona que publicó.
3. **Rol del administrador** en actividades y constancias: conserva funciones de
   soporte sobre ambos tipos, como autoriza la especificación de la iteración.
4. **Criterios de gamificación**: se administran de verdad pero no se consumen.
   Si el documento exige que ya otorguen puntos, eso pertenece al objetivo de
   gamificación y queda fuera de este 40 %.
