# Avance del 40 % — informe de implementación

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

Este documento explica qué existía, qué se corrigió y qué se agregó para poder
afirmar que **los primeros cuatro objetivos específicos están implementados de
extremo a extremo**. Complementa a `MATRIZ_TRAZABILIDAD_40.md` (qué cumple cada
requisito) y a `DEMO_40_PORCIENTO.md` (cómo demostrarlo).

---

## 1. Punto de partida

La versión previa (30 %) traía una base sólida que se conservó íntegra:

- API NestJS 10 + TypeORM 0.3 + PostgreSQL 16, con `synchronize: false` y
  migraciones.
- Autenticación JWT con guards globales y `ValidationPipe` con `whitelist` y
  `forbidNonWhitelisted`.
- 15 entidades, 59 rutas, motor de afinidad con puerto `AFFINITY_RECALCULATION`.
- Web React + Vite y móvil React Native + Expo, ambos organizados por rol.
- Seeds y dos scripts de verificación contra la API real.

**No se cambió** el framework, el ORM, la base de datos, la arquitectura ni la
organización por roles. Todo el trabajo es incremental sobre esa base.

---

## 2. Inconsistencias encontradas y corregidas

| # | Hallazgo | Riesgo | Corrección |
|---|---|---|---|
| 1 | **`JwtStrategy` no consultaba la base**: el rol y el estado salían del token. Un usuario desactivado seguía operando con normalidad hasta que su token expirara (30 días) | Alto — incumplía RF2 | `validate()` consulta el usuario en cada petición y rechaza si no está activo. El rol también se lee de la base, así que un rol manipulado no tiene efecto |
| 2 | Las **actividades académicas las publicaba el docente** | Contradecía el documento vigente | Ahora las publica el **director de carrera**; las extracurriculares, la **sociedad científica**. El docente pasa a consulta |
| 3 | **El director podía publicar extracurriculares** y la sociedad no tenía exclusividad | idem | `OWNER_ROLE_BY_TYPE` deriva el responsable del tipo de actividad |
| 4 | La **participación la confirmaban docente y sociedad** | Contradecía RF10 | La registran **director y sociedad**, cada uno sobre las actividades que gestiona |
| 5 | La **constancia interna la emitían cuatro roles** (docente, director, sociedad, admin), sin exigir participación confirmada y sin control de duplicados | Contradecía RF12 | **Solo el director**. Exige participación **CONFIRMADA**, queda anclada al registro concreto y un índice único parcial impide duplicados |
| 6 | **No existía la noción de semestres habilitados del docente** | RF3 sin implementar | Nueva entidad `teacher_semester_access` con administración desde la web y aplicación efectiva en perfiles, afinidad y constancias |
| 7 | **No había subida real de archivos**: una evidencia de tipo `file` solo guardaba una URL escrita a mano | RF11 sin implementar | `StoragePort` + `LocalStorageDriver` + `POST /uploads`, con validación de tipo y tamaño |
| 8 | La **evidencia colgaba del proyecto**, sin poder asociarse a una actividad o a un área | RF11 incompleto | La evidencia pertenece al perfil y se asocia a proyecto, actividad o área según corresponda |
| 9 | El **secreto JWT tenía un valor por defecto** presente en el repositorio, y **CORS aceptaba cualquier origen** | Alto al desplegar | Validados por entorno: en producción la API no arranca con valores de ejemplo ni sin `CORS_ORIGINS` |
| 10 | El **administrador podía crear usuarios con cualquier rol**, incluido otro ADMIN | Contradecía RF3 | Restringido a los tres roles institucionales |
| 11 | El catálogo **no tenía estado ni edición** | RF4 incompleto | `is_active` y `PATCH` en áreas y habilidades |
| 12 | El motor de afinidad consultaba **una vez por proyecto** las evidencias (N+1) | Rendimiento | Una sola consulta por perfil |
| 13 | `scripts/api-tests.mjs` **fallaba 9 de 39 asertos** por las reglas nuevas y por apellidos con guion bajo que la validación de nombres rechaza | Regresión | Actualizado; 42 OK, 0 fallos |

---

## 3. Qué se agregó, por objetivo

### Objetivo 1 — Usuarios, autenticación, roles y acceso

- Verificación de rol y estado contra la base en **cada** petición autenticada.
- `security.config.ts`: validación de `JWT_ACCESS_SECRET` y `CORS_ORIGINS` por
  entorno, con aviso en desarrollo y fallo al arrancar en producción.
- Alta de usuarios restringida a roles institucionales; edición de usuario y
  búsqueda por nombre, apellido o correo.
- **`teacher_semester_access`**: relación normalizada entre docente y semestre,
  con `CHECK` de rango 1–8, único por par y auditoría de quién la otorgó.
- Catálogos con estado y edición; un elemento dado de baja deja de ofrecerse a
  los demás roles pero conserva su historial.
- **`gamification_criteria`**: administración real y persistente del criterio.
  Ningún módulo lo consume; el motor pertenece a una fase posterior.

### Objetivo 2 — Perfil estudiantil dinámico

- **`TeacherScopeService`**: una sola definición del alcance por semestre,
  aplicada de forma idéntica en perfiles, afinidad y constancias.
- `GET /profiles/students` devuelve `{ scope, students }`: la interfaz puede
  explicar por qué la lista está vacía en lugar de mostrarla sin motivo.
- La vista permitida verifica el alcance y sigue sin exponer correo,
  constancias internas ni identificadores internos.
- El resumen dinámico lee las evidencias por perfil (antes por proyecto) e
  incluye actividad y área de cada una.

### Objetivo 3 — Actividades

- Responsable derivado del tipo de actividad, no de una lista histórica de roles.
- `GET /activities/managed` (panel del responsable, con sus borradores) y
  `GET /activities/my-registrations` (estado del estudiante).
- El detalle para el estudiante trae su propio estado, los cupos restantes y el
  **motivo** por el que no admite inscripción, para que la interfaz lo explique.
- Reglas nuevas: no inscribirse en borrador, cerrada, cancelada, finalizada ni
  con fecha pasada; interés e inscripción duplicados con mensaje propio; una
  actividad con participación confirmada no vuelve a borrador.
- Conteos de inscritos y confirmados con una sola consulta agrupada.

### Objetivo 4 — Participación, evidencias y certificados

- **Almacenamiento desacoplado.** `StoragePort` define el contrato;
  `LocalStorageDriver` lo resuelve en disco para que el sistema funcione completo
  sin depender de un servicio externo. Cambiar de proveedor es implementar el
  mismo puerto y sustituir un `useExisting`.
- `POST /uploads`: valida tipo (PDF, PNG, JPG, WEBP) y tamaño (5 MB). El nombre
  en disco lo genera el sistema —`uuid` más la extensión derivada del MIME—, de
  modo que nada de lo que envía el cliente llega a la ruta del archivo. Los
  archivos se sirven en `/api/files`. Al borrar una evidencia o reemplazar el
  archivo de un certificado, el anterior se elimina del almacenamiento.
- Módulo `/evidences`: la evidencia pertenece al perfil y se asocia a proyecto,
  actividad o área. Solo se adjunta evidencia de actividades en las que el
  estudiante participa y de proyectos propios o donde es integrante.
- Certificados externos con archivo, área y descripción, tratados explícitamente
  como **evidencia externa**: el sistema no los certifica ni los valida.
- Constancia interna con las tres reglas del RF12: solo el director,
  participación confirmada y sin duplicados.

---

## 4. Migraciones agregadas

| Archivo | Contenido |
|---|---|
| `1780200000000-Objective1AccessAndCatalogs.ts` | `teacher_semester_access` (con `CHECK` 1–8, único por par, FKs con `CASCADE` y `SET NULL`), `gamification_criteria` (con su enum y `CHECK` de puntos), `is_active` en `academic_areas` y `skills` |
| `1780210000000-Objective4EvidenceAndConstancies.ts` | `project_evidences`: `student_profile_id` **con backfill desde el proyecto**, `project_id` pasa a nullable, `activity_id`, `academic_area_id` y metadatos del archivo. `external_certificates`: `description`, `academic_area_id`, `file_url`, `file_name`, `mime_type`, `file_size`. `internal_constancies`: índice único parcial `uq_constancy_student_activity` |

Ambas tienen `down` completo. El backfill garantiza que **ninguna evidencia
existente se pierde**: cada una hereda el perfil del creador de su proyecto.
Total del proyecto: **8 migraciones, 17 tablas**.

---

## 5. Endpoints nuevos o modificados

**Nuevos (15)**

```
GET    /users/:id/semesters              PUT  /users/:id/semesters
PATCH  /academic-areas/:id               PATCH /skills/:id
GET    /gamification-criteria            POST /gamification-criteria
PATCH  /gamification-criteria/:id
GET    /activities/managed               GET  /activities/my-registrations
POST   /uploads
POST   /evidences                        GET  /evidences/my
DELETE /evidences/:id
GET    /constancies/internal/eligible/:activityId
GET    /constancies/internal/activity/:activityId
```

**Modificados (10)**

| Endpoint | Cambio |
|---|---|
| `POST /users` | Solo roles institucionales |
| `GET /users` | Parámetro `search`; los docentes traen sus semestres |
| `GET /academic-areas`, `GET /skills` | Filtran los inactivos salvo para el admin |
| `POST /activities` | Responsable derivado del tipo; el docente ya no publica |
| `PATCH /activities/:id` | Verifica quién gestiona; controla la transición de estado |
| `GET /activities/:id` | El estudiante recibe su estado, cupos y motivo de bloqueo |
| `PATCH /activities/:id/confirm-participation` | Director y sociedad, solo sobre lo que gestionan |
| `GET /activities/:id/participants` | Solo el responsable; devuelve nombre y semestre |
| `GET /profiles/students` | Devuelve `{ scope, students }` con el alcance aplicado |
| `GET /profiles/:id/allowed`, `GET /affinity/student/:id`, `GET /constancies/internal/student/:id` | Verifican el alcance por semestre |
| `POST /constancies/internal` | Solo director; exige participación confirmada; sin duplicados |
| `POST/PATCH /certificates/external` | Archivo, área y descripción |

Total: **74 rutas** (antes 59). Documentación interactiva en `/api/docs`.

---

## 6. Pantallas

**Web — nuevas (4):** Actividades académicas (director), Constancias internas
(director), Evidencias y certificados (estudiante), Criterios de gamificación
(admin).

**Web — modificadas (5):** Gestión de usuarios (búsqueda, edición, activación con
confirmación y selector de semestres), Áreas académicas y Catálogo de habilidades
(edición y estado), Perfil de estudiante del docente (aviso de alcance y resumen
completo), Actividades del docente (pasa a consulta con filtros).

**Web — componente rehecho:** `ActivityManager`, ahora con el juego completo de
campos, edición, cambio de estado en línea y registro de participación agrupado
por estado.

**Móvil — nuevas (3):** Actividades del director, Constancias del director,
pestaña de constancias.

**Móvil — modificadas (5):** Actividades del estudiante (filtros, detalle
desplegable, cupos, estado propio y motivo de bloqueo), Mis actividades
(agrupadas por estado con explicación), Evidencias y certificados (subida real
de archivos con `expo-document-picker`, alta de certificados y constancias),
Perfil de estudiante del docente (deja de pedir un UUID a mano: lista su alcance
con búsqueda), Actividades del docente (consulta con filtros).

---

## 7. Pruebas ejecutadas y resultados

Todas contra la API real, sobre una base **recreada desde cero**
(`db:reset` → `api:migrate` → `seed:populate`):

| Suite | Comando | Resultado |
|---|---|---|
| Objetivos del 40 % | `npm run test:40` | **179 OK · 0 fallos** |
| Validaciones de backend | `npm run test:api` | **42 OK · 0 fallos** |
| Flujo de 14 pasos | `npm run demo:e2e` | **25 OK · 0 fallos** |
| **Total** | | **246 verificaciones, 0 fallos** |

`scripts/e2e-objectives-40.mjs` cubre los cuatro flujos pedidos, incluidos los
rechazos: 403 por rol, 400 por regla de negocio, 409 por duplicado, 404 por
inexistente. La subida de archivos se prueba **con un archivo real**, que se
descarga después por su URL y se compara byte a byte con el original.

### Compilación

| Paquete | Comando | Resultado |
|---|---|---|
| `shared` | `npm run shared:build` | OK |
| `api` | `npm run api:build` | OK |
| `web` | `npm run web:build` | OK (825 kB) |
| `mobile` | `npm run mobile:typecheck` | OK |

---

## 8. Deuda técnica que no bloquea el 40 %

1. **Sin paginación** en `/users`, `/activities` y `/profiles/students`. Correcto
   con datos de demostración; necesario antes de escalar a la carrera completa.
2. **`jest` declarado sin instalar** en `api/package.json`: `npm test` falla. La
   cobertura real está en los scripts `.mjs`, que necesitan la API viva.
3. **Sin refresh token.** `JWT_REFRESH_SECRET` sigue declarado en `.env.example`
   pero no se usa; el acceso dura 30 días. El riesgo principal —que un usuario
   desactivado siguiera operando— ya está cerrado porque el estado se verifica en
   cada petición.
4. **Sin límite de intentos** en `/auth/login`.
5. **El recálculo de afinidad sigue siendo síncrono** y sin transacción en el
   `delete` + `insert`. El N+1 se eliminó. El puerto ya existente hace barato
   moverlo a una cola cuando haga falta.
6. **Emparejamiento por texto** para certificados sin área declarada: compara
   subcadenas en ambas direcciones y puede dar falsos positivos. Se mitigó dando
   prioridad al área declarada.
7. **El bundle web supera 500 kB**; conviene dividirlo por rutas.
8. **La jerarquía POO de `api/src/domain/`** sigue sin estar conectada a los
   guards: es el modelo conceptual del proyecto, no el mecanismo de autorización
   en ejecución. Conviene decirlo así en la defensa.
9. **Solo hay driver local de almacenamiento.** El puerto está listo para un
   proveedor remoto, pero no se implementó ninguno: habría añadido una dependencia
   externa y un punto de fallo sin aportar al alcance.

---

## 9. Fuera del 40 % (pendiente del 60 % restante)

- Chat privado y grupal · contactos por QR · equipos avanzados.
- Motor de gamificación que consuma los criterios ya administrables.
- Recomendación completa y analítica avanzada.
- Predicción de rendimiento académico.
- Certificados oficiales emitidos por la universidad y firma digital.
- Integración real con SIU Univalle y Microsoft Teams.

Estos módulos siguen apareciendo como **«Próximamente»** en la navegación, y
únicamente ellos: dentro de los cuatro objetivos declarados terminados no queda
ningún placeholder.

---

## 10. Puntos a confirmar contra el documento

1. **«Intereses» y «áreas de preferencia».** Se resolvieron con la estructura
   existente `student_interests` (área académica + prioridad 1–5), sin duplicar
   tablas: un interés declarado por área *es* una preferencia, y la prioridad
   expresa el grado. Si el documento pide además un campo de intereses libres
   (temas fuera del catálogo de áreas), es un añadido de un solo campo.
2. **«Actividades que gestionan» (RF10).** Se implementó como: el creador, el
   administrador, o el rol responsable de ese tipo de actividad. La alternativa
   —solo el creador— dejaría sin gestión las actividades de un director anterior.
3. **Rol de soporte del administrador** en actividades y constancias.
4. **Criterios de gamificación**: se administran pero no se aplican. Si el
   documento exige que ya otorguen puntos, eso pertenece al objetivo de
   gamificación, fuera de este 40 %.

**El documento del Proyecto de Grado no está versionado en el repositorio.** Esta
implementación siguió las reglas enunciadas explícitamente en la especificación
de la iteración. Conviene contrastar los cuatro puntos anteriores contra el texto
original antes de la defensa.
