# Matriz de trazabilidad — 40 % del Proyecto de Grado

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

> **Vigente.** El avance del 50 % la continúa en
> [`MATRIZ_TRAZABILIDAD_50.md`](MATRIZ_TRAZABILIDAD_50.md), que cubre RF1 – RF16.
> Las 235 verificaciones de este documento siguen pasando sin regresiones.

**Alcance del 40 %:** los cuatro primeros objetivos específicos del documento,
que corresponden exactamente a **RF1 – RF12**. El documento define 10 objetivos
específicos y 25 requerimientos funcionales.

**Verificación automatizada, sobre base recreada desde cero y en dos corridas
consecutivas:**

| Suite | Comando | Resultado |
|---|---|---|
| Objetivos del 40 % | `npm run test:40` | **235 OK · 0 fallos** |
| Validaciones de backend | `npm run test:api` | **42 OK · 0 fallos** |
| Flujo de 14 pasos | `npm run demo:e2e` | **25 OK · 0 fallos** |
| **Total** | | **302 verificaciones · 0 fallos** |

Un requisito se marca **CUMPLIDO** solo si tiene modelo de datos, migración,
backend con permisos y validaciones, endpoint, pantalla que consume la API real,
persistencia comprobada, flujos de éxito y de fallo, y prueba automatizada que
pasa.

---

## Objetivo 1 — Usuarios, autenticación, roles y control de acceso

| RF | Regla | Actor | Entidad / modelo | Controlador | Servicio | Endpoint | Pantalla | Prueba | Figura / Tabla | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| RF1 | RN-01 | Estudiante | `users`, `roles` | `AuthController` | `AuthService.register` | `POST /auth/register` | Móvil · Registro | 1.1–1.9 | Fig. 2.1 · Tabla 2.10 · Fig. 2.13 | **CUMPLIDO** |
| RF2 | RN-02 | Los 5 roles | `users.status`, `roles` | `AuthController` | `AuthService.login`, `JwtStrategy` | `POST /auth/login`, `GET /auth/me` | Web y móvil · Inicio de sesión | 2.1–2.7, 3.15–3.19 | Fig. 2.1 · Tabla 2.11 · Fig. 2.14 | **CUMPLIDO** |
| RF3 | RN-01, RN-02 | Administrador | `users`, `roles`, `teacher_semester_access` | `UsersController` | `UsersService` | `GET/POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status`, `GET/PUT /users/:id/semesters` | Web · Gestión de usuarios | 3.1–3.19 | Fig. 2.1 · Tabla 2.12 · Fig. 2.15 | **CUMPLIDO** |
| RF4 | RN-21 | Administrador | `activity_categories`, `academic_areas`, `skills`, `gamification_criteria` | `CatalogsController` | `CatalogsService` | `GET/POST/PATCH /activity-categories`, `/academic-areas`, `/skills`, `/gamification-criteria` | Web · Categorías de actividad, Áreas, Habilidades, Criterios | 4.1–4.10, 5.1–5.18 | Fig. 2.1 · Tabla 2.13 · Fig. 2.16 | **CUMPLIDO** |

**Nota sobre RF4 y gamificación.** Las categorías de actividad, las áreas
académicas y las habilidades son catálogos administrables **y consumidos** por el
sistema. Los criterios de gamificación se administran y persisten de verdad, pero
**ningún módulo los aplica todavía**: el motor que otorga puntos e insignias
pertenece al Objetivo 9. No se generan puntos ficticios y la pantalla lo dice.

**Punto fuerte del Objetivo 1.** `JwtStrategy` consulta la base en cada petición:
un usuario desactivado pierde el acceso de inmediato aunque su token siga vigente
(prueba 3.17), y un rol manipulado dentro del token no surte efecto (prueba 2.7).

---

## Objetivo 2 — Perfil estudiantil dinámico

| RF | Regla | Actor | Entidad / modelo | Controlador | Servicio | Endpoint | Pantalla | Prueba | Figura / Tabla | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| RF5 | RN-03, RN-04 | Estudiante | `student_profiles` | `ProfilesController` | `ProfilesService` | `POST/GET/PATCH /profiles/me` | Móvil · Perfil | 2.1–2.4, 2.10–2.13 | Fig. 2.2 · Tabla 2.14 · Fig. 2.17 | **CUMPLIDO** |
| RF5 · intereses | RN-03 | Estudiante | `student_free_interests` | `ProfilesController` | `ProfilesService` | `GET/POST/PATCH/DELETE /profiles/me/free-interests` | Móvil · Intereses y áreas de preferencia | 5.19–5.28, 5.30 | Tabla 2.14 | **CUMPLIDO** |
| RF5 · áreas de preferencia | RN-03 | Estudiante | `student_interests` (nombre físico heredado) | `ProfilesController` | `ProfilesService` | `POST/PUT /profiles/me/preferred-areas` | Móvil · Intereses y áreas de preferencia | 2.5–2.7, 5.29, 5.31, 5.32 | Tabla 2.14 | **CUMPLIDO** |
| RF5 · habilidades | RN-03 | Estudiante | `student_skills`, `skills` | `ProfilesController` | `ProfilesService` | `POST/PUT /profiles/me/skills` | Móvil · Habilidades | 2.8, 2.9 | Tabla 2.14 | **CUMPLIDO** |
| RF5 · áreas de mejora | RN-03 | Estudiante | `student_profiles.improvement_area_ids` | `ProfilesController` | `ProfilesService` | `PATCH /profiles/me` | Móvil · Perfil | 2.13, 2.19 | Tabla 2.14 | **CUMPLIDO** |
| RF6 | RN-03, RN-04 | Estudiante | 12 tablas integradas | `ProfilesController` | `ProfilesService.buildSummary` | `GET /profiles/me/summary` | Móvil · Inicio · Web · Panel | 2.16–2.26, 4.53–4.57, 5.30–5.32 | Fig. 2.2 · Tabla 2.15 · Fig. 2.18 | **CUMPLIDO** |
| RF6 · privacidad | RN-23 | Docente, Director | `teacher_semester_access` | `ProfilesController` | `TeacherScopeService` | `GET /profiles/students`, `GET /profiles/:id/allowed` | Web · Perfil de estudiante · Móvil | 2.28–2.43, 4.58 | Tabla 2.15 | **CUMPLIDO** |

**Los cuatro datos declarativos del documento están separados en el software,**
tal como los enumera RF5: intereses en texto libre (`student_free_interests`),
habilidades con nivel (`student_skills`), áreas de preferencia con prioridad
(`student_interests`) y áreas de mejora (`improvement_area_ids`).

**Completitud:** 20 % por cada uno de semestre, biografía, al menos un área de
preferencia, al menos una habilidad y al menos un área de mejora. Los intereses
en texto libre no son obligatorios y no alteran la fórmula.

---

## Objetivo 3 — Actividades académicas y extracurriculares

| RF | Regla | Actor | Entidad / modelo | Controlador | Servicio | Endpoint | Pantalla | Prueba | Figura / Tabla | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| RF7 | RN-05, RN-06 | Director de Carrera · Sociedad Científica | `activities`, `activity_categories` | `ActivitiesController` | `ActivitiesService` | `POST /activities`, `PATCH /activities/:id`, `GET /activities/managed` | Web · Actividades académicas · Actividades extracurriculares · Móvil | 3.1–3.14, 5.10–5.13 | Fig. 2.3 · Tabla 2.16 · Fig. 2.19 | **CUMPLIDO** |
| RF8 | RN-07 | Estudiante | `activities` | `ActivitiesController` | `ActivitiesService.findAll` | `GET /activities?categoryId&areaId&modality&fromDate&toDate` | Móvil · Actividades · Web · Actividades del programa | 3.15–3.22, 5.35–5.48 | Fig. 2.3 · Tabla 2.17 · Fig. 2.20 | **CUMPLIDO** |
| RF9 | RN-07 | Estudiante | `activity_registrations` | `ActivitiesController` | `ActivitiesService` | `POST /:id/register-interest`, `POST /:id/register`, `GET /activities/my-registrations` | Móvil · Detalle de actividad · Mis actividades | 3.23–3.33 | Fig. 2.3 · Tabla 2.18 · Fig. 2.21 | **CUMPLIDO** |

**Corrección de rol aplicada.** Según RN-05 y RN-06, el **Director de Carrera**
gestiona las actividades académicas y la **Sociedad Científica** las
extracurriculares. El docente ya no publica: su rol es de consulta. Verificado en
las pruebas 3.3, 3.5, 3.6 y 3.7.

**Filtros completos del RF8:** categoría (del catálogo), área académica,
modalidad y rango de fechas, más tipo y estado que ya existían. Combinables y con
limpieza. Rango invertido, fecha inválida y modalidad inexistente devuelven 400.

---

## Objetivo 4 — Participación, evidencias y constancias

| RF | Regla | Actor | Entidad / modelo | Controlador | Servicio | Endpoint | Pantalla | Prueba | Figura / Tabla | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| RF10 | RN-08 | Director de Carrera · Sociedad Científica | `activity_registrations` | `ActivitiesController` | `ActivitiesService.confirmParticipation` | `PATCH /:id/confirm-participation`, `GET /:id/participants` | Web · Participación · Móvil | 4.1–4.15 | Fig. 2.3 · Tabla 2.19 · Fig. 2.22 | **CUMPLIDO** |
| RF11 · evidencias | RN-09 | Estudiante | `project_evidences` | `EvidencesController`, `UploadsController` | `EvidencesService`, `LocalStorageDriver` | `POST /uploads`, `POST /evidences`, `GET /evidences/my`, `DELETE /evidences/:id` | Web y móvil · Evidencias y certificados | 4.16–4.33 | Fig. 2.3 · Tabla 2.20 · Fig. 2.23 | **CUMPLIDO** |
| RF11 · certificados | RN-10 | Estudiante | `external_certificates` | `CertificatesController` | `CertificatesService` | `POST/GET/PATCH/DELETE /certificates/external` | Web y móvil · Evidencias y certificados | 4.34–4.40 | Tabla 2.20 | **CUMPLIDO** |
| RF12 | RN-11 | Director de Carrera | `internal_constancies` | `ConstanciesController` | `ConstanciesService` | `POST /constancies/internal`, `GET /constancies/internal/eligible/:id`, `/my`, `/activity/:id` | Web · Constancias internas · Móvil | 4.41–4.52, 5.49–5.56 | Fig. 2.3 · Tabla 2.21 · Fig. 2.24 | **CUMPLIDO** |

**Subida real de archivos (RF11).** `StoragePort` + `LocalStorageDriver`:
`POST /uploads` valida tipo (PDF, PNG, JPG, WEBP) y tamaño (5 MB). El nombre en
disco lo genera el sistema (`uuid` + extensión derivada del MIME), nunca el
cliente. La prueba 4.21–4.22 sube un PDF real, lo descarga por su URL y lo
compara byte a byte.

**Regla de actividad autorizada (RF12).** El documento exige que la constancia
solo se emita sobre una actividad autorizada, pero no define un trámite de
autorización ni un actor que lo conceda. Se implementó como **condición
derivada**, no como módulo nuevo: la actividad no está en borrador ni cancelada
**y** la gestiona el actor institucional que corresponde a su tipo. Publicar una
actividad siendo el responsable de su tipo *es* el acto de autorización dentro del
alcance del sistema. Verificado en 5.49, 5.50, 5.51 y 5.53.

---

## Reglas de negocio verificadas

| Regla | Enunciado del documento | Verificación |
|---|---|---|
| RN-01 | El estudiante se registra solo; los roles institucionales los crea el administrador | 1.2, 1.5, 3.1–3.5 |
| RN-02 | Cada usuario accede únicamente a lo autorizado para su rol | 2.5, 2.6, 2.7, 5.9 |
| RN-03 | Datos declarativos del perfil e incorporación progresiva de lo generado | 2.5–2.26, 5.19–5.32 |
| RN-04 | El perfil no almacena calificaciones ni información académica oficial | Sin campos de nota en el esquema |
| RN-05 | El Director de Carrera gestiona talleres, clases espejo, seminarios y charlas | 3.1, 3.3, 3.6 |
| RN-06 | La Sociedad Científica gestiona hackathons, retos, clubes y convocatorias | 3.4, 3.5 |
| RN-07 | El estudiante consulta y registra interés o inscripción cuando la actividad lo permite | 3.15–3.33 |
| RN-08 | La participación solo la registra el actor responsable de la actividad | 4.6, 4.7, 4.8, 4.9 |
| RN-09 | El estudiante adjunta archivos o enlaces asociados a su perfil | 4.16–4.33 |
| RN-10 | La plataforma no certifica la autenticidad legal del certificado externo | Texto explícito en API, web y móvil |
| RN-11 | Constancia interna: solo el Director, sobre actividad autorizada y participación confirmada | 4.43–4.50, 5.49–5.55 |
| RN-21 | El administrador gestiona los criterios de asignación de puntos e insignias | 4.8–4.10 |
| RN-23 | El docente accede únicamente a la información permitida | 2.34–2.43 |
| RN-27 | La plataforma es complementaria y no sustituye al SIU ni a Teams | Sin integración; declarado en el alcance |

---

## Resumen

| Objetivo | RF | Verificaciones | Estado |
|---|---|---|---|
| 1 — Usuarios, autenticación, roles y acceso | RF1, RF2, RF3, RF4 | 63 | **100 %** |
| 2 — Perfil estudiantil dinámico | RF5, RF6 | 59 | **100 %** |
| 3 — Actividades académicas y extracurriculares | RF7, RF8, RF9 | 47 | **100 %** |
| 4 — Participación, evidencias y constancias | RF10, RF11, RF12 | 66 | **100 %** |
| **Avance total** | **RF1 – RF12 de 25** | **235** | **40 %** |

---

## Alineación con el documento

Las divergencias que quedaban entre el documento y el software se resolvieron en
la dirección que correspondía a cada caso:

**El software se alineó al documento** (cuatro huecos cerrados en este pase):

1. **RF4** — las categorías de actividad pasaron de enum fijo a catálogo
   administrable, con migración que conservó las 32 actividades existentes.
2. **RF5** — se separaron los intereses en texto libre de las áreas de
   preferencia, como los enumera el requerimiento.
3. **RF8** — se agregaron los filtros de modalidad y fecha que faltaban.
4. **RF12** — se implementó la verificación de actividad autorizada.

**El documento se alinea al software** en los puntos donde un diagrama
desactualizado contradecía sus propios RF y reglas de negocio, o donde la
implementación es técnicamente mejor. Todas las correcciones, con su texto exacto
de reemplazo, están en
[`CORRECCIONES_DOCUMENTO_FINAL_40.md`](CORRECCIONES_DOCUMENTO_FINAL_40.md):
Figura 2.3 (caso de uso inexistente y conexiones erróneas), Figura 2.11 (servicio
no definido), Figura 2.12 (nombres, separación de conceptos y atributos sin uso) y
Figuras 2.22 y 2.24 (nombres de componentes).

**Estas correcciones documentales todavía no están aplicadas en el archivo Word.**
Hasta que se apliquen, la trazabilidad completa exige leer esta matriz junto al
documento de correcciones.
