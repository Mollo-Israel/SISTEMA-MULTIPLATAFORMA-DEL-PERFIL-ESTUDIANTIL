# Correcciones al documento de Proyecto de Grado

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)

Este documento lista las correcciones que hay que aplicar **a mano en el archivo
Word**, con el texto exacto de reemplazo. No se editó el `.docx` de forma
automática: pesa 22 MB, contiene 43 figuras incrustadas, índices y numeración
automática, y cualquier reescritura programática arriesga corromper estilos,
referencias cruzadas o imágenes. **El software ya está alineado; lo que falta es
el documento.**

> **Respaldo creado:** `docs/respaldo-documento/Documento_Proyecto_Grado_v2_RESPALDO_2026-08-31.docx`
> (integridad verificada: 77 partes, ZIP sin errores). No se versiona por tamaño.

Cada corrección indica sección, texto actual, texto corregido, motivo y RF afectado.

---

## 1. Figura 2.3 — Diagrama de Casos de Uso de Actividades, Participación y Evidencias

**Sección:** 2.1.5 Diagramas de Casos de Uso
**RF afectados:** RF7, RF8, RF9, RF10, RF11, RF12
**Motivo:** el diagrama contradice sus propias especificaciones (Tablas 2.16 – 2.21) y las reglas de negocio RN-08 y RN-11.

### 1.1 Los casos de uso que debe contener

El diagrama debe tener **exactamente seis óvalos**, con los nombres literales de
las especificaciones:

| Óvalo (nombre literal) | Actores conectados | RF |
|---|---|---|
| Gestionar actividades académicas y extracurriculares | Director de Carrera · Sociedad Científica | RF7 |
| Consultar actividades disponibles | Estudiante | RF8 |
| Registrar interés o inscripción en actividad | Estudiante | RF9 |
| Registrar asistencia y participación | Director de Carrera · Sociedad Científica | RF10 |
| Gestionar evidencias y certificados externos | Estudiante | RF11 |
| Registrar constancia interna autorizada | Director de Carrera | RF12 |

### 1.2 Qué se elimina

**Eliminar por completo el óvalo «Validar y aprobar evidencias».**

Motivo: las expresiones «validar evidencias», «aprobar evidencias» y
«verificación de evidencias» aparecen **cero veces** en el texto del documento.
No existe RF, ni especificación de caso de uso, ni diagrama de secuencia, ni
regla de negocio, ni mención en el alcance. RF11 asigna la gestión de evidencias
**únicamente al Estudiante**.

### 1.3 Qué se corrige en el trazado

- El **Estudiante** debe quedar conectado solo a: *Consultar actividades
  disponibles*, *Registrar interés o inscripción en actividad* y *Gestionar
  evidencias y certificados externos*.
- El Estudiante **no** debe tener línea hacia *Registrar asistencia y
  participación*: RN-08 dice que la participación «solo podrá ser registrada por
  el actor responsable o autorizado para gestionar la actividad».
- Añadir el óvalo de **RF7**, que hoy falta pese a tener su Tabla 2.16 y su
  Figura 2.19 de secuencia.

### 1.4 Párrafo bajo la figura

**Texto actual:**

> La Figura 2.3 representa las funcionalidades relacionadas con la gestión de actividades académicas y extracurriculares, así como el registro, validación y certificación de la participación estudiantil. El Estudiante puede explorar actividades, inscribirse y participar, registrar evidencias y consultar el estado de sus registros. El Director de Carrera tiene responsabilidades de creación de actividades, gestión de asistencias, validación de evidencias y emisión de constancias internas. La Sociedad Científica participa en la gestión de asistencias y en la verificación de evidencias.

**Texto corregido:**

> La Figura 2.3 representa las funcionalidades relacionadas con la gestión de actividades académicas y extracurriculares, el registro de participación y la incorporación de evidencias a la trayectoria del estudiante. El Estudiante puede consultar las actividades disponibles, registrar su interés o inscripción y gestionar sus evidencias y certificados externos. El Director de Carrera gestiona las actividades académicas, registra la asistencia y participación en las actividades bajo su responsabilidad y emite las constancias internas autorizadas. La Sociedad Científica gestiona las actividades extracurriculares y registra la asistencia y participación correspondiente a las actividades que organiza.

---

## 2. Figura 2.11 — Diagrama de componentes del sistema

**Sección:** 2.2.1.3 Diagrama de Componentes
**RF afectados:** ninguno (el servicio dibujado no corresponde a ningún RF)
**Motivo:** el diagrama incluye un servicio que el documento no define en ninguna parte.

### 2.1 Qué se elimina

**Eliminar el contenedor externo «Servicio de notificaciones (Email / Push)»** y
la flecha de dependencia que sale del *Módulo de Paneles y Analítica* hacia él.

Motivo: la palabra «notificación» aparece **cero veces** en el documento
completo. El servicio no está en los objetivos, ni en el alcance, ni en los RF,
ni en los RNF, ni en la sección de tecnologías, ni en el diagrama de
contenedores (Figura 2.10), ni en la implementación.

### 2.2 Erratas dentro de la imagen

| Dice | Debe decir |
|---|---|
| `Figura 2.39. Diagrama de componentes del sistema` (rótulo impreso dentro de la imagen) | `Figura 2.11. Diagrama de componentes del sistema` |
| `Aplicación web (Reat1)` | `Aplicación web (React)` |
| `Aplicación móvil (React Native + Eepo)` | `Aplicación móvil (React Native + Expo)` |

**Pie de figura correcto:** `Figura 2.11. Diagrama de componentes del sistema`

> Recomendación: corregir solo esos elementos. No hace falta rehacer la figura.

### 2.3 Errata equivalente en la Figura 2.3

La imagen de la Figura 2.3 lleva impresas su propia cabecera
(«2.1.5. DIAGRAMAS DE CASOS DE USO»), su título y su pie de figura, que se
duplican con los que el documento ya coloca fuera de la imagen. Al redibujarla
según el punto 1, conviene dejar solo el marco del sistema con los actores y los
óvalos.

---

## 3. Figura 2.12 — Diagrama de clases

**Sección:** 2.2.2 Diagrama de Clases
**Motivo:** alinear el modelo estático con la implementación real. En estos
puntos **no se degradó el software**: el diagrama es el que hay que actualizar.

### 3.1 Renombrar `InternalCertificate` → `ConstanciaInterna`

**RF afectado:** RF12 · **Regla:** RN-11

El texto, RF12 y RN-11 hablan siempre de **constancia interna** y subrayan que
no sustituye a un certificado oficial. Llamar `InternalCertificate` a la clase
trabaja en contra de ese límite. En la implementación la tabla es
`internal_constancies`.

- Clase: `InternalCertificate` → **`ConstanciaInterna`**
- En la Figura 2.24 (secuencia de RF12): `InternalCertificateController` →
  **`ControladorConstancias`**, `InternalCertificateService` →
  **`ServicioConstancias`**, `InternalCertificateRepository` →
  **`RepositorioConstancias`**.
- Título de la Figura 2.24: «Diagrama de Secuencia de Registrar Constancia
  Interna Autorizada» (hoy la imagen dice *Register Authorized Internal
  Certificate*).

### 3.2 Separar `Interest` de las áreas de preferencia

**RF afectado:** RF5

El software ahora implementa los dos conceptos por separado, tal como los
enumera RF5. El diagrama debe reflejarlo:

- **`Interest`** — interés en texto libre. Atributos: `name: String`,
  `description: String`, `createdAt: DateTime`. Relación
  `StudentProfile 1 ── 0..* Interest` (composición).
  Implementación: tabla `student_free_interests`.
- **`PreferredArea`** — área de preferencia. Atributos: `priority: int (1..5)`.
  Relación `StudentProfile 1 ── 0..* PreferredArea 0..* ── 1 AcademicArea`.
  Implementación: tabla `student_interests` (nombre físico heredado, conservado
  para no arriesgar los datos existentes).
- **Quitar** el atributo `preferredAreas: String` de `StudentProfile`: ya no es
  una cadena, es una relación.
- **Conservar** `improvementAreas` en `StudentProfile` (arreglo de IDs de área).

### 3.3 Nueva clase `ActivityCategory`

**RF afectado:** RF4

- Clase **`ActivityCategory`**: `code: String`, `name: String`,
  `description: String`, `appliesTo: String`, `isActive: boolean`.
  Operaciones: `create()`, `update()`, `activate()`, `deactivate()`.
- Relación `ActivityCategory 1 ── 0..* Activity`.
- En `Activity`, el atributo `category: String` pasa a ser la **asociación** con
  `ActivityCategory`.
- Implementación: tabla `activity_categories`.

### 3.4 Fusionar `ActivityRegistration` y `ActivityParticipation`

**RF afectados:** RF9, RF10

El software usa **una sola entidad** con un ciclo de vida por estados. Separarla
en dos tablas duplicaría la persistencia sin beneficio funcional: un estudiante
no puede tener participación sin inscripción previa, y RF10 las trata como un
continuo.

- **Eliminar** la clase `ActivityParticipation`.
- **`ActivityRegistration`** queda con: `status: String`, `registeredAt: DateTime`,
  `confirmedBy: User`, `updatedAt: DateTime`. Operaciones: `register()`,
  `cancel()`, `confirm()`, `markAbsent()`.
- Añadir una nota de estados en el diagrama:
  `INTERESTED → REGISTERED → CONFIRMED | ABSENT`.
- Implementación: tabla `activity_registrations`.

### 3.5 Quitar la herencia entre `Evidence` y los certificados

**RF afectado:** RF11

La implementación usa entidades independientes pero relacionadas, no herencia.

- **Quitar** las relaciones de herencia `Evidence ◁── ExternalCertificate` y
  `Evidence ◁── InternalCertificate`.
- Dejar las tres clases asociadas a `StudentProfile`:
  `StudentProfile 1 ── 0..* Evidence`,
  `StudentProfile 1 ── 0..* ExternalCertificate`,
  `StudentProfile 1 ── 0..* ConstanciaInterna`.
- `Evidence` mantiene sus asociaciones opcionales con `Project`, `Activity` y
  `AcademicArea`.

### 3.6 Atributos que se retiran del diagrama

Ninguno de estos es requerido por RF1 – RF12 y ninguno tiene uso funcional en el
alcance actual. Se retiran del diagrama en vez de crear columnas muertas:

| Clase · atributo | Acción | Motivo |
|---|---|---|
| `StudentProfile.visibilityLevel` | Retirar del modelo actual | La visibilidad la resuelven hoy el rol y los semestres habilitados del docente. Si se necesita para RF13 (portafolio), pertenece al Objetivo 5. |
| `Evidence.title` | Retirar | `description` cubre la función. Ningún RF pide un título aparte. |
| `ExternalCertificate.verificationNote` | Retirar | Ningún RF lo pide; RN-10 dice justamente que la plataforma no verifica. |
| `Skill.description` | Retirar | El catálogo de habilidades usa nombre y área. |
| `Student.totalPoints` | **Marcar como fase posterior** | Es gamificación (Objetivo 9). Puede quedar en el modelo objetivo si se rotula «implementación posterior». |

### 3.7 Modelo de usuario y semestre

**RF afectados:** RF1, RF3

La implementación es mejor que el diagrama en estos tres puntos; se actualiza el
diagrama:

| Diagrama actual | Corrección | Motivo |
|---|---|---|
| `User.fullName: String` | `User.firstName: String` y `User.lastName: String` | Permite ordenar y buscar por apellido, cosa que el panel de administración ya hace (RF3). |
| `Student.semester: int` | Mover a `StudentProfile.semester: int` | El perfil es 1:1 con el usuario y concentra los datos declarativos (RF5). |
| `Teacher.enabledSemesters: List<int>` | Relación `Teacher 1 ── 0..* TeacherSemesterAccess`, con `semester: int (1..8)` y `grantedBy: User` | Relación normalizada con restricción de rango y auditoría de quién la otorgó, en lugar de una lista dentro de la clase (RF3). |

### 3.8 Nueva clase para los criterios de gamificación

`GamificationCriterion` ya existe en el diagrama. Ajustar sus atributos a la
implementación: `code: String`, `name: String`, `description: String`,
`trigger: String`, `points: int`, `isActive: boolean`, y asociación opcional
`0..1 AcademicArea`. Rotular la clase como **administrable en el 40 %, consumida
en la fase de gamificación**.

---

## 4. Figura 2.22 — Secuencia de Registrar Asistencia y Participación

**Sección:** 2.2.3 · **RF afectado:** RF10
**Motivo:** alinear los participantes con la implementación. **El flujo no
cambia**: los pasos y las ramas `alt` del diagrama son correctos.

| Participante actual | Corrección |
|---|---|
| `ParticipationController` | `ActivitiesController` |
| `ParticipationService` | `ActivitiesService` |
| `ParticipationRepository` | `ActivityRegistrationRepository` |
| `StudentProfileService` | `AffinityEngineService` |

La rama «UPDATE student profile (add participation)» corresponde en la
implementación al recálculo de afinidad que dispara la participación confirmada,
a través del puerto `AFFINITY_RECALCULATION`.

Título en español, coherente con el resto del documento: «Diagrama de Secuencia
de Registrar Asistencia y Participación».

---

## 5. Figura 2.24 — Secuencia de Registrar Constancia Interna Autorizada

**Sección:** 2.2.3 · **RF afectado:** RF12
**Motivo:** nombres de participantes y precisión de la rama de autorización.

Además del renombrado del punto 3.1, precisar la rama `alt`
**[Unauthorized activity]**. En la implementación, «actividad autorizada» es una
**condición derivada**, no un trámite aparte: se cumple cuando la actividad no
está en borrador ni cancelada **y** la gestiona el actor institucional que
corresponde a su tipo (académica → Director de Carrera; extracurricular →
Sociedad Científica).

**Etiqueta sugerida para esa rama:**

> `[Actividad no autorizada: en borrador, cancelada o fuera del flujo institucional de su tipo]`

Conviene añadir una línea al párrafo explicativo de la figura:

> La verificación de actividad autorizada no corresponde a un trámite
> independiente: se deriva del estado de la actividad y del actor institucional
> que la gestiona, de acuerdo con las reglas RN-05 y RN-06.

---

## 6. RF4 — Precisar el texto del requerimiento

**Sección:** 2.1.3, Tabla 2.1 · **RF afectado:** RF4

El texto actual ya menciona «categorías de actividades», y ahora el software lo
cumple. Solo conviene precisar el campo **Entrada** para que refleje lo que la
pantalla pide:

**Entrada actual:**

> Tipo de configuración, nombre, descripción, estado y criterios correspondientes.

**Entrada corregida:**

> Tipo de configuración; para categorías de actividad: código, nombre, descripción, tipo de actividad al que aplica y estado; para áreas académicas: nombre, descripción, etiquetas y estado; para criterios de gamificación: código, nombre, hecho que lo otorga, puntos, área opcional y estado.

---

## 7. RF5 — Precisar la distinción entre intereses y áreas de preferencia

**Sección:** 2.1.3, Tabla 2.2 · **RF afectado:** RF5

El requerimiento ya enumera los cinco datos declarativos. Conviene explicitar la
diferencia entre los dos que se confunden con facilidad, porque ahora el software
los trata como conceptos distintos:

**Añadir al campo Descripción de RF5:**

> Los intereses se registran en texto libre y no dependen del catálogo de áreas académicas; las áreas de preferencia se seleccionan del catálogo de áreas y llevan una prioridad de 1 a 5.

Y en la Tabla 2.14 (especificación del caso de uso «Gestionar Perfil
Estudiantil»), añadir al flujo básico, después del paso 3:

> 3a. (Estudiante): Los intereses se ingresan como texto libre; las áreas de preferencia y las áreas de mejora se seleccionan del catálogo de áreas académicas.

---

## 8. Resumen de correcciones

| # | Elemento | Tipo | RF | Prioridad |
|---|---|---|---|---|
| 1 | Figura 2.3: quitar «Validar y aprobar evidencias» | Eliminar | RF11 | **Alta** |
| 2 | Figura 2.3: corregir conexiones del Estudiante | Corregir | RF10 | **Alta** |
| 3 | Figura 2.3: añadir el óvalo de RF7 | Añadir | RF7 | **Alta** |
| 4 | Figura 2.3: párrafo explicativo | Reemplazar | RF10, RF11 | **Alta** |
| 5 | Figura 2.11: quitar servicio de notificaciones | Eliminar | — | **Alta** |
| 6 | Figura 2.11: erratas «Figura 2.39», «Reat1», «Eepo» | Corregir | — | Media |
| 7 | Figura 2.12: `InternalCertificate` → `ConstanciaInterna` | Renombrar | RF12 | **Alta** |
| 8 | Figura 2.12: separar `Interest` de `PreferredArea` | Modificar | RF5 | **Alta** |
| 9 | Figura 2.12: añadir `ActivityCategory` | Añadir | RF4 | **Alta** |
| 10 | Figura 2.12: fusionar registro y participación | Modificar | RF9, RF10 | Media |
| 11 | Figura 2.12: quitar herencia de certificados | Modificar | RF11 | Media |
| 12 | Figura 2.12: retirar 4 atributos sin uso | Eliminar | — | Media |
| 13 | Figura 2.12: `fullName`, `semester`, `enabledSemesters` | Modificar | RF1, RF3 | Media |
| 14 | Figura 2.22: nombres de participantes | Renombrar | RF10 | Media |
| 15 | Figura 2.24: nombres y rama de autorización | Renombrar | RF12 | Media |
| 16 | RF4: precisar campo Entrada | Reemplazar | RF4 | Baja |
| 17 | RF5 y Tabla 2.14: precisar intereses vs. preferencia | Añadir | RF5 | Baja |

Las de prioridad **Alta** son las que un jurado detectaría comparando el
diagrama con su propia especificación, o el diagrama con el código.
