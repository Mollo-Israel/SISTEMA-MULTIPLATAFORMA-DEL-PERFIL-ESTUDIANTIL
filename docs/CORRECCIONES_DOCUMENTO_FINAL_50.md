# Correcciones al documento — Objetivo 5 (Portafolio de proyectos)

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)

Correcciones que hay que aplicar **a mano en el archivo Word**, con el texto
exacto de reemplazo. No se editó el `.docx` automáticamente: pesa 22 MB, tiene
43 figuras incrustadas, índices y numeración automática, y una reescritura
programática arriesga corromper estilos, referencias o imágenes.

> Continúa a [`CORRECCIONES_DOCUMENTO_FINAL_40.md`](CORRECCIONES_DOCUMENTO_FINAL_40.md),
> cuyas 17 correcciones **siguen pendientes de aplicar**.

**Buena noticia:** el Objetivo 5 está mucho mejor documentado que el Objetivo 3.
La Figura 2.4 y las Tablas 2.22 – 2.25 son correctas y coherentes entre sí, y la
Figura 2.26 ya describe el flujo de invitación con aceptación. Las correcciones
son **6**, todas de modelo o de nombres, ninguna de concepto.

---

## 1. Figura 2.4 — Diagrama de Casos de Uso del Portafolio · SIN CAMBIOS

Verificada contra RF13 – RF16. Contiene exactamente los cuatro casos de uso con
sus actores correctos:

| Óvalo | Actores | RF |
|---|---|---|
| Gestionar proyecto del portafolio | Estudiante | RF13 |
| Gestionar integrantes de proyecto | Estudiante | RF14 |
| Consultar portafolio de proyectos | Estudiante · Docente | RF15 |
| Registrar retroalimentación sobre proyecto | Docente | RF16 |

No hay casos de uso inventados («Aprobar proyecto», «Calificar proyecto») ni
actores de más. **No se requiere ninguna corrección.**

---

## 2. Figura 2.12 — Diagrama de clases: separar `ProjectInvitation`

**RF afectado:** RF14 · **Regla:** RN-12
**Prioridad:** Alta

### Situación

El diagrama modela el estado de la invitación **como un atributo de
`ProjectMember`**:

```
ProjectMember
  - role: String
  - joinedAt: DateTime
  - invitationStatus: String
  + acceptInvitation(): void
  + rejectInvitation(): void
```

Eso implica que existe una fila de «integrante» mientras la invitación está
pendiente. **Contradice la Tabla 2.23**, que dice que el estudiante invitado
«puede aceptar o rechazar la invitación **antes de quedar asociado al
proyecto**», y contradice la propia Figura 2.26, que dibuja la invitación como
un registro aparte que se inserta antes de que exista la pertenencia.

### Corrección

Separar en dos clases, como está implementado:

```
ProjectInvitation
  - proposedRole: String
  - status: String        // pending | accepted | rejected | cancelled
  - invitedBy: User
  - respondedAt: DateTime
  - createdAt: DateTime
  + send(): void
  + accept(): void
  + reject(): void
  + cancel(): void

ProjectMember
  - role: String
  - contribution: String
  - joinedAt: DateTime
  + remove(): void
```

Relaciones:

- `Project 1 ── 0..* ProjectInvitation`
- `ProjectInvitation 0..* ── 1 StudentProfile` (el invitado)
- `Project 1 ── 0..* ProjectMember`
- `ProjectMember 0..* ── 1 User`

Nota para el diagrama: **`ProjectMember` solo existe cuando la invitación fue
aceptada.** Implementación: tablas `project_invitations` y `project_members`.

---

## 3. Figura 2.12 — `Project.visibilityLevel` → `visibility` con valores

**RF afectado:** RF13 · **Prioridad:** Media

El diagrama tiene `visibilityLevel: String`, sin valores definidos. Ahora el
concepto está implementado con tres niveles y de él depende toda la consulta
docente de RF15.

**Corrección:** renombrar a `visibility` y anotar los valores admitidos:

| Valor | Significado |
|---|---|
| `private` | Solo el estudiante responsable y los integrantes aceptados. |
| `profile` | Aparece en el perfil dinámico y en la vista permitida. |
| `teachers` | Además, el docente de su alcance lo consulta y lo comenta. |

Conservar la operación `changeVisibility(level: String)`, que sí corresponde.

---

## 4. Figura 2.12 — `Project.relatedSubject` → asociación con `AcademicArea`

**RF afectado:** RF13 · **Prioridad:** Media

RF13 pide «área o materia relacionada». La implementación usa el catálogo de
áreas académicas, que ya existe y alimenta el motor de afinidad; no existe una
entidad «materia» en el sistema ni ningún RF la introduce.

**Corrección:** sustituir el atributo `relatedSubject: String` por la asociación
`Project 0..* ── 0..1 AcademicArea`, coherente con el resto del modelo.

---

## 5. Figura 2.12 — Completar `ProjectFeedback`

**RF afectado:** RF16 · **Regla:** RN-13 · **Prioridad:** Media

La clase ya existe en el diagrama con `comment` y `createdAt`. Completarla para
que refleje la implementación:

```
ProjectFeedback
  - comment: String        // 10 a 1000 caracteres
  - createdAt: DateTime
  - editedAt: DateTime     // solo si el docente edita su comentario
  + register(): void
  + edit(): void
```

Relaciones:

- `Project 1 ── 0..* ProjectFeedback`
- `ProjectFeedback 0..* ── 1 User` (el docente autor)

**Anotar explícitamente en el diagrama** que la clase no tiene nota, puntaje,
rúbrica ni estado de aprobación, porque RN-13 excluye la evaluación formal. Es
el tipo de detalle que un jurado pregunta.

---

## 6. Figura 2.26 — Nombres de participantes de la secuencia de RF14

**RF afectado:** RF14 · **Prioridad:** Media

**El flujo del diagrama es correcto** y no debe cambiarse: invitación → estado
pendiente → el invitado acepta o rechaza → la pertenencia se crea solo al
aceptar. Solo hay que alinear los nombres con la implementación real.

| Participante actual | Corrección |
|---|---|
| `Project Member Controller` | `ProjectsController` |
| `Project Member Service` | `ProjectMembersService` |
| `Project Member Repository` | `ProjectInvitationRepository` / `ProjectMemberRepository` |

Precisar además la rama `alt`, que hoy tiene una sola etiqueta:

> `[El estudiante ya es integrante o ya existe una invitación pendiente]`
> → el sistema informa y no genera una nueva invitación.

**Errata de composición:** en la imagen, las etiquetas «Verify not already
member» y «saveInvitation(invitation)» se superponen dentro del bloque `alt`.
Conviene separarlas al redibujar.

Título en español, coherente con el resto: «Diagrama de Secuencia de Gestionar
Integrantes de Proyecto».

---

## 7. Figuras 2.25, 2.27 y 2.28 — Nombres de participantes

**RF afectados:** RF13, RF15, RF16 · **Prioridad:** Baja

Los flujos son correctos. Alinear los nombres de los componentes:

| Figura | RF | Participante en el documento | En la implementación |
|---|---|---|---|
| 2.25 | RF13 | Project Controller / Service | `ProjectsController` / `ProjectsService` |
| 2.25 | RF13 | Storage Service | `StoragePort` → `LocalStorageDriver` |
| 2.27 | RF15 | Project Query Service | `ProjectsService.findForTeacher` + `TeacherScopeService` |
| 2.28 | RF16 | Feedback Controller / Service | `ProjectFeedbackController` / `ProjectFeedbackService` |

En la Figura 2.27 conviene añadir explícitamente el paso de verificación doble
que la implementación aplica, porque es la esencia de RF15:

> `verificar visibilidad del proyecto` **y** `verificar semestre del estudiante
> dentro del alcance del docente`

---

## 8. Aclaración recomendada en RF15 y en la Tabla 2.24

**Prioridad:** Baja

La Tabla 2.24 ya dice que el proyecto «debe ser visible para docentes y
pertenecer a un estudiante comprendido dentro de los semestres habilitados».
Conviene añadir una línea al campo **Condiciones Previas** que aclare el caso
del director de carrera, porque hoy el documento no dice nada al respecto y la
implementación toma una decisión:

> El director de carrera no accede al detalle individual de un proyecto: su
> información sobre el portafolio proviene de los reportes agregados de RF25.

Si esa lectura no es la deseada, hay que crear un RF que conceda al director la
consulta individual; mientras tanto, el software se atiene a lo que el documento
concede explícitamente.

---

## 9. Resumen de correcciones del Objetivo 5

| # | Elemento | Tipo | RF | Prioridad |
|---|---|---|---|---|
| 1 | Figura 2.4 | **Sin cambios** | RF13–RF16 | — |
| 2 | Figura 2.12: separar `ProjectInvitation` de `ProjectMember` | Modificar | RF14 | **Alta** |
| 3 | Figura 2.12: `visibilityLevel` → `visibility` con sus 3 valores | Renombrar | RF13 | Media |
| 4 | Figura 2.12: `relatedSubject` → asociación con `AcademicArea` | Modificar | RF13 | Media |
| 5 | Figura 2.12: completar `ProjectFeedback` y anotar que no es evaluación | Modificar | RF16 | Media |
| 6 | Figura 2.26: nombres de participantes y rama `alt`; errata de superposición | Renombrar | RF14 | Media |
| 7 | Figuras 2.25, 2.27, 2.28: nombres de participantes | Renombrar | RF13, RF15, RF16 | Baja |
| 8 | Tabla 2.24: aclarar el acceso del director de carrera | Añadir | RF15 | Baja |

La única de prioridad **Alta** es la 2: es donde el diagrama de clases
contradice a su propia especificación de caso de uso.
