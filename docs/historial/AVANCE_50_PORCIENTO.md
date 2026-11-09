# Avance del 50 % — informe de implementación

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

Este informe explica qué existía, qué faltaba y qué se construyó para completar
el **quinto objetivo específico**: el portafolio de proyectos estudiantiles.

---

## 1. Estado heredado del 40 %

La base validada traía los cuatro primeros objetivos completos y verificados con
302 verificaciones automatizadas. Del Objetivo 5 ya existían piezas heredadas de
la versión del 30 %:

- Entidades `projects`, `project_members` y `project_evidences`.
- `ProjectsService` con alta, edición, listado propio y evidencias.
- Almacenamiento real de archivos (`StoragePort` + `LocalStorageDriver`).
- `TeacherScopeService`, con el alcance académico del docente por semestres.
- Motor de afinidad con el puerto `AFFINITY_RECALCULATION`.

**Nada de eso se rehízo.** El Objetivo 5 se construyó encima.

---

## 2. Diagnóstico inicial del Objetivo 5

Auditoría de RF13 – RF16 antes de escribir una línea de código:

| RF | Estado inicial | Detalle |
|---|---|---|
| RF13 | **PARCIAL** | Existía todo salvo el **nivel de visibilidad**, que el requerimiento pide explícitamente y del que depende RF15. |
| RF14 | **INCONSISTENTE** | `POST /projects/:id/members` insertaba al integrante **directamente**. La Tabla 2.23 exige que el invitado acepte o rechace *antes* de quedar asociado. |
| RF15 | **PARCIAL e INSEGURO** | El estudiante veía su portafolio, pero no existía consulta docente. Y `findOneForUser` dejaba a docente, director y administrador abrir **cualquier** proyecto por su ID, sin visibilidad ni alcance. |
| RF16 | **NO IMPLEMENTADO** | No existía ninguna entidad de retroalimentación. |

Se detectó además una brecha de integración: **el motor de afinidad solo
consideraba los proyectos creados por el estudiante**, ignorando aquellos en los
que participa como integrante.

---

## 3. Brechas encontradas y cómo se cerraron

| # | Brecha | Cierre |
|---|---|---|
| 1 | Sin nivel de visibilidad | `projects.visibility` con tres niveles y su migración |
| 2 | La pertenencia se insertaba sin consentimiento | Entidad `project_invitations`; la pertenencia nace solo al aceptar |
| 3 | Sin consulta docente del portafolio | `GET /projects/institutional` con filtros y alcance |
| 4 | Cualquier rol institucional abría cualquier proyecto | `assertCanView` con visibilidad + `TeacherScopeService` |
| 5 | Sin retroalimentación docente | Entidad `project_feedback`, módulo y pantallas |
| 6 | La afinidad ignoraba los proyectos colaborativos | El motor considera también las pertenencias aceptadas |
| 7 | **Fallo preexistente:** editar el área del proyecto no persistía | La actualización carga el proyecto sin la relación `academicArea` |
| 8 | **Fallo preexistente:** el filtro de fechas de RF8 corría un día | Las fechas sin hora se construyen como fecha local |

Los fallos 7 y 8 son **defectos reales que las pruebas nuevas destaparon**, no
funcionalidad nueva. El 7 llevaba en el código desde el 30 %: TypeORM prioriza
la relación cargada sobre la clave foránea, de modo que cambiar el área del
proyecto se guardaba con el valor anterior, en silencio.

---

## 4. RF13 · Gestionar proyecto del portafolio

**Estado: CUMPLIDO** · 25 verificaciones (13.1 – 13.25)

El estudiante crea, consulta y edita proyectos con nombre, descripción, área
académica, tecnologías, estado, repositorio, demostración, evidencias y nivel de
visibilidad. Se reutilizó el modelo existente sin duplicar campos.

**Visibilidad**, el concepto que faltaba:

| Nivel | Quién ve el proyecto |
|---|---|
| `private` | Solo el responsable y los integrantes aceptados. |
| `profile` | Aparece además en el perfil dinámico y en la vista permitida. |
| `teachers` | Además, el docente de su alcance lo abre y lo comenta. |

Las **evidencias** usan el almacenamiento real del Objetivo 4: se sube el
archivo a `POST /uploads`, que valida tipo (PDF, PNG, JPG, WEBP) y tamaño
(5 MB), y genera el nombre en disco. No se volvió a las URLs escritas a mano.

Validaciones verificadas: título corto, enlace inválido, visibilidad
inexistente, tecnologías duplicadas depuradas, edición por un estudiante ajeno
rechazada con 403, y el docente sin permiso para registrar proyectos.

---

## 5. RF14 · Gestionar integrantes de proyecto

**Estado: CUMPLIDO** · 29 verificaciones (14.1 – 14.29)

El cambio de fondo del objetivo. Antes se insertaba al integrante directamente;
ahora existe el ciclo que pide la Tabla 2.23:

```
El responsable invita  →  PENDIENTE  →  el invitado acepta   →  ProjectMember
                                     →  el invitado rechaza  →  sin pertenencia
                                     →  el responsable cancela
```

**Mientras la invitación está pendiente no existe pertenencia:** el proyecto no
aparece en el portafolio del invitado, no cuenta en su perfil y no influye en su
afinidad (pruebas 14.9, 14.10 y 15.29).

Reglas verificadas: no invitarse a sí mismo, no invitar a una cuenta que no sea
de estudiante, no invitar a una cuenta inactiva, no duplicar una invitación
pendiente, no invitar a quien ya es integrante, no aceptar una invitación ajena,
no responder dos veces, y que un estudiante ajeno no invite a un proyecto que no
es suyo.

**Rol del integrante:** texto acotado de 3 a 80 caracteres, saneado. No es un
enum cerrado porque el documento no fija un catálogo de roles; la interfaz
sugiere valores frecuentes y admite escribir uno propio.

**Datos heredados:** los integrantes que ya existían se conservan intactos y se
tratan como pertenencias aceptadas heredadas de la versión anterior. No se les
fabricó historial de invitaciones. Verificado con una fila insertada antes de
migrar: 1 integrante antes, 1 después, con su rol intacto.

---

## 6. RF15 · Consultar portafolio de proyectos

**Estado: CUMPLIDO** · 29 verificaciones (15.1 – 15.29)

**Para el estudiante:** `GET /projects/my` devuelve sus proyectos propios y
aquellos donde es integrante aceptado, marcando cuál es cuál (`isOwner`) y con
qué rol participa (`myRole`). La app móvil los separa en tres secciones: *Mis
proyectos*, *Participo* e *Invitaciones*.

**Para el docente:** `GET /projects/institutional` aplica **dos condiciones a la
vez**, y ambas deben cumplirse:

1. el proyecto está marcado como visible para docentes; **y**
2. el estudiante responsable pertenece a un semestre de su alcance.

Filtros: estado, área académica, semestre, tecnología y búsqueda por nombre del
estudiante o título.

**El hueco de seguridad que se cerró.** Antes, `findOneForUser` devolvía el
proyecto sin más a cualquier rol institucional. Ahora hay una sola función,
`assertCanView`, que decide, y reutiliza `TeacherScopeService`: **una sola
fuente de verdad para el alcance académico en todo el sistema.** Un docente
fuera de alcance recibe 403 aunque escriba el ID directamente (prueba 15.18).

**El director de carrera pierde el detalle individual.** Ningún RF se lo
concede: RF15 nombra como actores al Estudiante y al Docente. Sus reportes
agregados de RF25 siguen intactos. Es un cambio de comportamiento deliberado y
está anotado para el documento.

---

## 7. RF16 · Registrar retroalimentación sobre proyecto

**Estado: CUMPLIDO** · 21 verificaciones (16.1 – 16.21)

Entidad `project_feedback` con lo mínimo que pide RN-13: comentario, autor y
fechas. **Sin nota, sin puntaje, sin rúbrica y sin estado de aprobación**, y eso
es deliberado: el documento excluye expresamente la evaluación académica formal.
La interfaz lo dice con todas sus letras en web y en móvil.

- La escribe **solo el docente**, y solo sobre proyectos que puede ver.
- La leen el estudiante responsable y los integrantes aceptados.
- El autor puede corregir su propio comentario; queda registrada la edición.
- Otro docente no edita comentarios ajenos.
- Varios docentes del mismo alcance pueden comentar el mismo proyecto.

Rechazos verificados: comentario vacío, demasiado corto, demasiado largo,
escrito por el estudiante, por un docente fuera de alcance, sobre un proyecto
privado, y por el director de carrera.

---

## 8. Modelo de datos

| Tabla | Cambio | Preservación |
|---|---|---|
| `projects` | Nueva columna `visibility` (enum, indexada, por defecto `profile`) | **12 proyectos antes, 12 después**, todos en `profile`: el comportamiento previo se mantiene |
| `project_invitations` | **Nueva.** `project_id`, `invited_profile_id`, `proposed_role`, `status`, `invited_by`, `responded_at` | Tabla nueva |
| `project_feedback` | **Nueva.** `project_id`, `teacher_user_id`, `comment`, `edited_at`, con `CHECK` de longitud mínima | Tabla nueva |
| `project_members` | **Sin cambios** | **1 integrante heredado antes, 1 después**, con su rol intacto |

**Integridad:**

- Índice único **parcial** `uq_pending_invitation` sobre `(project_id,
  invited_profile_id) WHERE status = 'pending'`: una sola invitación pendiente
  por estudiante y proyecto, pero se puede volver a invitar tras un rechazo.
- `project_feedback.teacher_user_id` con **`ON DELETE RESTRICT`**: borrar a un
  docente con retroalimentación falla de forma visible en vez de dejar historia
  académica huérfana.
- `project_invitations` y `project_feedback` en `CASCADE` respecto del proyecto:
  si el proyecto desaparece, sus invitaciones y comentarios no quedan sueltos.

Total del proyecto: **10 migraciones, 21 tablas.** `synchronize: false` se
mantiene.

---

## 9. Migraciones

| Archivo | Contenido |
|---|---|
| `1780230000000-Objective5Portfolio.ts` | `projects.visibility` con su enum e índice; tabla `project_invitations` con su enum, índices, índice único parcial y tres claves foráneas; tabla `project_feedback` con su `CHECK`, índices y claves foráneas |

El `down` revierte las tres partes en orden inverso. No toca `project_members`.

---

## 10. Backend

**Nuevo**

- `ProjectMembersService` — invitaciones y pertenencias (RF14).
- `ProjectFeedbackModule` con su servicio y controlador (RF16). Importa
  `ProjectsModule` para reutilizar el control de visibilidad y alcance en lugar
  de duplicarlo.
- `ProjectsService.findForTeacher` — portafolio institucional con filtros.
- `ProjectsService.assertCanView` — una sola definición de quién ve un proyecto.

**Modificado**

- `ProjectsController`: invitaciones, integrantes, portafolio institucional. Se
  retiró `POST /projects/:id/members`, que insertaba sin consentimiento.
- `ProjectsModule` importa `AccessModule` para `TeacherScopeService`.
- `AffinityEngineService`: cuenta los proyectos donde el estudiante es
  integrante aceptado. Se conservó su arquitectura y el puerto.
- `ProfilesService`: el resumen distingue proyecto propio de colaborativo, y la
  vista permitida oculta los privados.

---

## 11. Aplicación móvil

| Pantalla | Estado | Contenido |
|---|---|---|
| *Portafolio* | Rehecha | Tres secciones: *Mis proyectos*, *Participo* e *Invitaciones*, con contadores. Alta de proyecto con área, estado, visibilidad, tecnologías y enlaces |
| *Proyecto* (detalle) | **Nueva** | Información, edición (solo responsable), integrantes, invitaciones enviadas, evidencias y retroalimentación docente |

La navegación pasó a una pila: *Portafolio → Proyecto*. La pantalla distingue
visualmente al **responsable** del **integrante**: solo el responsable ve editar,
visibilidad, invitar y gestión de invitaciones. El backend aplica la misma regla.

---

## 12. Aplicación web

| Pantalla | Estado | Contenido |
|---|---|---|
| *Proyectos estudiantiles* (docente) | **Nueva** | Listado con filtros por estado, área, semestre, tecnología y búsqueda; detalle con tecnologías, enlaces e integrantes; registro y edición de retroalimentación |

Incluye el aviso de alcance («solo se muestran proyectos de sus semestres
habilitados»), estado vacío explicado, estados de carga y confirmación de
operación.

---

## 13. Seguridad y permisos

| Verificación | Dónde |
|---|---|
| Propiedad del proyecto para editar, invitar y gestionar | `assertIsOwner`, `requireOwnedProject` |
| Visibilidad del proyecto | `assertCanView` |
| Alcance académico del docente | `TeacherScopeService` (**única fuente de verdad**) |
| Propiedad de la invitación al responder | `ProjectMembersService.respond` |
| Autoría de la retroalimentación al editar | `ProjectFeedbackService.update` |
| Rol para registrar retroalimentación | `assertIsTeacher` + guard `@Roles` |
| Tipo y tamaño de archivo | `UploadsController` |
| Campos no declarados | `ValidationPipe` global con `forbidNonWhitelisted` |

Ninguna autorización depende de ocultar un botón: cada regla está probada contra
la API. El listado institucional nunca devuelve proyectos sin filtrar.

---

## 14. Pruebas

**Nueva suite:** `npm run test:50` → `scripts/e2e-objective-5.mjs`, **109
verificaciones**.

El escenario monta actores propios para no depender del seed: dos estudiantes de
4.º semestre, uno de 7.º, un docente habilitado en 4.º, otro habilitado solo en
2.º, un tercer docente del mismo alcance y un director de carrera.

| Bloque | Verificaciones |
|---|---|
| RF13 · Gestión del proyecto | 25 |
| RF14 · Integrantes e invitaciones | 29 |
| RF15 · Consulta del portafolio | 29 |
| RF16 · Retroalimentación | 21 |
| Preparación de actores | 5 |

---

## 15. Resultados

Base recreada desde cero (`db:reset` → `api:migrate` → `seed:populate`), dos
corridas consecutivas:

| Suite | 1.ª corrida | 2.ª corrida |
|---|---|---|
| `test:40` | **235 OK · 0 fallos** | **235 OK · 0 fallos** |
| `test:50` | **109 OK · 0 fallos** | **109 OK · 0 fallos** |
| `test:api` | **42 OK · 0 fallos** | **42 OK · 0 fallos** |
| `demo:e2e` | **25 OK · 0 fallos** | **25 OK · 0 fallos** |
| **Total** | **411 · 0 fallos** | **411 · 0 fallos** |

Compilación: `shared` OK · `api` OK · `web` OK · `mobile typecheck` OK.

**Datos de demostración:** 8 integrantes aceptados, 8 invitaciones pendientes,
3 rechazadas y 5 retroalimentaciones docentes, sobre proyectos académicos
realistas con visibilidad variada (incluido uno privado).

---

## 16. Correcciones documentales necesarias

Seis correcciones, detalladas en
[`CORRECCIONES_DOCUMENTO_FINAL_50.md`](CORRECCIONES_DOCUMENTO_FINAL_50.md).

**La Figura 2.4 y las Tablas 2.22 – 2.25 son correctas y no requieren cambios**,
a diferencia de lo que ocurría con la Figura 2.3 del Objetivo 3. La Figura 2.26
ya describe correctamente el flujo de invitación.

La única corrección de prioridad alta: la Figura 2.12 modela
`ProjectMember.invitationStatus`, lo que implicaría que existe una fila de
integrante mientras la invitación está pendiente — y eso contradice su propia
Tabla 2.23. Hay que separar `ProjectInvitation` de `ProjectMember`.

---

## 17. Funcionalidades que siguen fuera del 50 %

Objetivos 6 a 10 del documento (RF17 – RF25):

- Motor de afinidad completo y recomendaciones (RF17, RF18). *El motor existe y
  ahora también considera los proyectos colaborativos, pero su objetivo propio
  es el 6.*
- Contactos por QR, chat privado, equipos y chat grupal (RF19 – RF22).
- Gamificación: puntos, insignias y progreso (RF23). *Los criterios ya se
  administran desde el 40 %; falta el motor que los aplique.*
- Paneles, mapa de afinidad y estimación de tendencias (RF24, RF25). *Los
  reportes básicos existen, heredados del 30 %.*

Estos módulos siguen apareciendo como **«Próximamente»** en la navegación.
Dentro de RF1 – RF16 no queda ningún marcador de pendiente.
