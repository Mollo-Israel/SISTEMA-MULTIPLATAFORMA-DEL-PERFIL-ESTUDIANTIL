# Auditoría final del 50 %

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

Auditoría estricta de los objetivos específicos **1 a 5** (RF1 – RF16) sobre la
rama `feat/avance-50-porciento`.

**Criterio.** Un requisito se aprueba solo si cumple **todo** esto:

1. modelo de datos y migración reversible;
2. backend con validaciones y control de acceso real;
3. endpoint expuesto y documentado;
4. pantalla que consume la API verdadera, no datos de ejemplo;
5. persistencia comprobada tras recargar;
6. flujo de éxito **y** flujos de rechazo verificados;
7. prueba automatizada que pasa.

Si falla uno solo, el requisito **no** se aprueba.

---

## 1. Veredicto

| Objetivo | RF | Verificaciones | Veredicto |
|---|---|---|---|
| 1 — Usuarios, autenticación, roles y acceso | RF1 – RF4 | 63 | **APROBADO** |
| 2 — Perfil estudiantil dinámico | RF5, RF6 | 59 | **APROBADO** |
| 3 — Actividades académicas y extracurriculares | RF7 – RF9 | 47 | **APROBADO** |
| 4 — Participación, evidencias y constancias | RF10 – RF12 | 66 | **APROBADO** |
| 5 — Portafolio de proyectos estudiantiles | RF13 – RF16 | 109 | **APROBADO** |

**16 de 25 requerimientos funcionales cumplidos → 50 % de avance funcional.**

---

## 2. Evidencia de ejecución

Base de datos **recreada desde cero** (`db:reset` → `api:migrate` →
`seed:populate`) y suites ejecutadas **dos veces consecutivas**, con resultado
idéntico:

| Suite | Cobertura | 1.ª | 2.ª |
|---|---|---|---|
| `npm run test:40` | Objetivos 1 – 4 | 235 OK · 0 fallos | 235 OK · 0 fallos |
| `npm run test:50` | Objetivo 5 | 109 OK · 0 fallos | 109 OK · 0 fallos |
| `npm run test:api` | Validaciones y permisos | 42 OK · 0 fallos | 42 OK · 0 fallos |
| `npm run demo:e2e` | Flujo completo de 14 pasos | 25 OK · 0 fallos | 25 OK · 0 fallos |
| **Total** | | **411 · 0 fallos** | **411 · 0 fallos** |

La repetición importa: descarta pruebas que solo pasan sobre una base limpia y
descarta dependencias del orden de ejecución.

**Compilación:** `shared` OK · `api` OK · `web` OK · `mobile typecheck` OK.
Sin errores y sin advertencias nuevas.

---

## 3. Objetivo 5 — verificación requisito por requisito

### RF13 · Gestionar proyecto del portafolio — **APROBADO**

| Criterio | Evidencia |
|---|---|
| Modelo y migración | `projects.visibility` en `1780230000000-Objective5Portfolio`, con `down` |
| Backend | `ProjectsService.create` / `update` con `assertIsOwner` |
| Endpoints | `POST /projects`, `PATCH /projects/:id`, `GET /projects/:id`, evidencias |
| Interfaz | Móvil · *Portafolio* → alta; *Proyecto* → edición |
| Persistencia | 13.6, 13.13, 13.16 releen tras escribir |
| Rechazos | 13.18 – 13.25: título corto, enlace inválido, visibilidad inexistente, editor ajeno (403), docente sin permiso |
| Prueba | 13.1 – 13.25 · **25 OK** |

**Defecto real encontrado y corregido.** La prueba 13.13 destapó que editar el
área del proyecto **no persistía**: la actualización cargaba la relación
`academicArea` y TypeORM escribía de vuelta el identificador antiguo, en
silencio. El fallo venía del 30 %. Corregido cargando el proyecto sin esa
relación.

### RF14 · Gestionar integrantes de proyecto — **APROBADO**

| Criterio | Evidencia |
|---|---|
| Modelo y migración | Tabla `project_invitations` con índice único parcial |
| Backend | `ProjectMembersService`, 7 operaciones |
| Endpoints | 7 rutas de invitación y pertenencia |
| Interfaz | Móvil · *Proyecto* → *Integrantes* / *Invitaciones enviadas*; *Portafolio* → *Invitaciones* |
| Persistencia | 14.11, 14.20, 14.26 releen tras responder |
| Rechazos | Autoinvitación, no estudiante, cuenta inactiva, duplicado (409), ya integrante (409), invitación ajena (403), doble respuesta (400), proyecto ajeno (403) |
| Prueba | 14.1 – 14.29 · **29 OK** |

**La regla del documento se cumple literalmente.** Pruebas 14.9 y 14.10: con la
invitación pendiente, el proyecto **no** aparece en el portafolio del invitado y
**no** existe la pertenencia. La pertenencia se crea únicamente al aceptar
(14.19).

### RF15 · Consultar portafolio de proyectos — **APROBADO**

| Criterio | Evidencia |
|---|---|
| Modelo | `projects.visibility` + `teacher_semester_access` |
| Backend | `assertCanView` y `findForTeacher`, con `TeacherScopeService` |
| Endpoints | `GET /projects/my`, `GET /projects/institutional`, `GET /projects/:id` |
| Interfaz | Móvil · tres secciones · Web · *Proyectos estudiantiles* con 5 filtros |
| Rechazos | 15.17 – 15.25 |
| Prueba | 15.1 – 15.29 · **29 OK** |

**Hueco de seguridad cerrado.** `findOneForUser` devolvía **cualquier** proyecto
por su ID a docente, director o administrador, sin comprobar visibilidad ni
alcance. Corregido: hoy un docente fuera de alcance recibe 403 aunque escriba el
ID a mano (**prueba 15.18**), y el proyecto privado de otro estudiante es
inaccesible (15.19).

### RF16 · Registrar retroalimentación sobre proyecto — **APROBADO**

| Criterio | Evidencia |
|---|---|
| Modelo y migración | Tabla `project_feedback` con `CHECK` de longitud y `ON DELETE RESTRICT` sobre el docente |
| Backend | `ProjectFeedbackService`, acceso delegado en `ProjectsService` |
| Endpoints | 3 rutas |
| Interfaz | Web · detalle del proyecto · Móvil · lectura |
| Rechazos | 16.10 – 16.21 |
| Prueba | 16.1 – 16.21 · **21 OK** |

**Conforme a RN-13:** la entidad no tiene nota, puntaje, rúbrica ni estado de
aprobación. La interfaz declara explícitamente que es orientación, no
evaluación.

---

## 4. Objetivos 1 a 4 — sin regresiones

Las **235 verificaciones** del 40 % siguen pasando íntegras.

Dos cambios del Objetivo 5 tocaron código anterior, y ambos fueron
**correcciones de defectos**, no funcionalidad nueva:

| Cambio | Motivo |
|---|---|
| `activities.service.ts` — fechas sin hora | `"2026-09-12"` se leía como medianoche **UTC**, lo que en UTC−4 caía el día anterior y corría el rango. Destapado por la prueba 5.42 |
| `projects.service.ts` — `findOneForUser` | Devolvía cualquier proyecto a cualquier rol institucional |

**Único cambio de comportamiento del 40 %:** el director de carrera ya no abre
el detalle individual de un proyecto ajeno. Es intencional — ningún RF se lo
concede, RF15 nombra solo a Estudiante y Docente — y sus reportes agregados de
RF25 siguen intactos. Queda anotado para el documento.

---

## 5. Preservación de datos, comprobada

No se dio por supuesta: se midió.

| Verificación | Antes | Después |
|---|---|---|
| Proyectos existentes tras la migración | 12 | **12**, todos en visibilidad `profile` |
| Integrante heredado insertado a propósito antes de migrar | 1, rol «Backend» | **1, rol «Backend»** |
| Actividades tras la migración del 40 % | 32 | **32**, ninguna sin categoría |

La visibilidad por defecto es `profile` precisamente para que los proyectos que
ya existían mantengan su comportamiento anterior en lugar de desaparecer del
perfil.

**Migración reversible:** el `down` revierte tabla de retroalimentación, tabla
de invitaciones y columna de visibilidad, en orden inverso. `synchronize: false`
se mantiene en toda la configuración.

---

## 6. Control de acceso

| Regla | Implementación | Prueba |
|---|---|---|
| Solo el responsable edita el proyecto | `assertIsOwner` | 13.22 |
| Solo el responsable invita y gestiona | `requireOwnedProject` | 14.24 |
| Solo el invitado responde su invitación | `ProjectMembersService.respond` | 14.16 |
| El docente ve solo proyectos habilitados de su alcance | `assertCanView` + `TeacherScopeService` | 15.17, 15.18 |
| El docente no salta el alcance escribiendo el ID | `assertCanAccessProfile` | 15.18 |
| Solo el docente registra retroalimentación | `assertIsTeacher` + `@Roles` | 16.16, 16.17 |
| Solo el autor edita su comentario | `ProjectFeedbackService.update` | 16.20 |
| Campos no declarados rechazados | `ValidationPipe` global | `test:api` |

**Ninguna autorización depende de ocultar un botón.** Cada regla de la interfaz
tiene su equivalente verificado contra la API directamente.

**Una sola fuente de verdad.** El alcance académico del docente vive únicamente
en `TeacherScopeService`, que ya usaban las actividades y los perfiles del 40 %.
El portafolio lo reutiliza en lugar de reimplementarlo, que es como aparecen las
discrepancias de permisos.

---

## 7. Hallazgos abiertos

| # | Hallazgo | Gravedad | Situación |
|---|---|---|---|
| 1 | Las 17 correcciones documentales del 40 % siguen sin aplicarse al Word | Media | Documentadas en `CORRECCIONES_DOCUMENTO_FINAL_40.md` |
| 2 | Las 6 correcciones del Objetivo 5 siguen sin aplicarse al Word | Media | `CORRECCIONES_DOCUMENTO_FINAL_50.md` |
| 3 | La Figura 2.12 contradice a la Tabla 2.23 sobre la invitación | Media | Corrección n.º 2 del Objetivo 5 |
| 4 | La Figura 2.3 incluye «Validar y aprobar evidencias», sin RF ni mención en el texto | Media | Hallazgo del 40 %, aún abierto |
| 5 | La Figura 2.11 incluye «Servicio de notificaciones», sin RF ni mención | Baja | Hallazgo del 40 %, aún abierto |
| 6 | El director de carrera pierde el detalle individual de proyecto | Baja | Decisión deliberada, anotada para el documento |

**Todos son documentales.** No hay ningún hallazgo abierto de código, seguridad
o datos dentro de RF1 – RF16.

Las figuras 2.3 y 2.11 no se «arreglaron» en el software: implementar una
funcionalidad que ningún requerimiento respalda sería inventar alcance. Se
reportan para que se decida en el documento.

---

## 8. Lo que este 50 % no incluye

Objetivos 6 a 10 (RF17 – RF25), fuera del alcance de este hito:

- Motor de afinidad como objetivo propio y recomendaciones (RF17, RF18)
- Contactos por QR, chat privado, equipos y chat grupal (RF19 – RF22)
- Gamificación aplicada: puntos, insignias y progreso (RF23)
- Paneles avanzados, mapa de afinidad y estimación de tendencias (RF24, RF25)

Aparecen como **«Próximamente»** en la navegación, sin pantallas vacías ni datos
de ejemplo. Dentro de RF1 – RF16 no queda ningún marcador de pendiente.

---

## 9. Conclusión

Los cinco primeros objetivos específicos están **implementados, integrados y
demostrables de extremo a extremo**, verificados por 411 comprobaciones
automatizadas sin un solo fallo, sobre base recreada desde cero y en dos
corridas consecutivas.

El Objetivo 5 no solo añadió el portafolio: **cerró un hueco de autorización**
que dejaba abierto cualquier proyecto a cualquier rol institucional y **corrigió
dos defectos reales** heredados de versiones anteriores, uno de ellos silencioso.

**Avance funcional: 16 de 25 requerimientos = 50 %.**
