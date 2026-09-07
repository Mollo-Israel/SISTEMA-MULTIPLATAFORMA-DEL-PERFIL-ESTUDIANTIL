# Correcciones al documento — Objetivo 6 (Motor de afinidad estudiantil)

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)

Correcciones que hay que aplicar **a mano en el archivo Word**. No se editó el
`.docx` automáticamente: pesa 22 MB, tiene 43 figuras incrustadas, índices y
numeración automática, y una reescritura programática arriesga corromper
estilos, referencias o imágenes.

> Continúa a [`CORRECCIONES_DOCUMENTO_FINAL_40.md`](CORRECCIONES_DOCUMENTO_FINAL_40.md)
> (17 correcciones) y [`CORRECCIONES_DOCUMENTO_FINAL_50.md`](CORRECCIONES_DOCUMENTO_FINAL_50.md)
> (6 correcciones). **Todas siguen pendientes de aplicar.**

**Lo primero, y es lo más importante de este objetivo:** la **Figura 2.5** y la
**Tabla 2.26** son **correctas y completas**. Se implementaron al pie de la
letra, incluidos sus flujos alternativos. El documento fue aquí más exigente que
la implementación anterior, y varias cosas que se construyeron en este avance
—el estado de información insuficiente, la organización por niveles, la
imposibilidad de modificar los resultados— **ya estaban escritas y no estaban
hechas**.

Las correcciones son **5**, y solo una es de fondo.

---

## 1. Figura 2.5 y Tabla 2.26 · SIN CAMBIOS

Verificadas línea por línea contra la implementación.

| Tabla 2.26 dice | Implementación |
|---|---|
| Actor principal: Estudiante | `@Roles(RolNombre.STUDENT)` en `/affinity/me/*` |
| Previa: sesión iniciada y perfil asociado | `resolveProfileIdByUser` responde 404 sin perfil |
| Posterior: visualiza **sin modificar directamente los resultados** | No existe endpoint para fijar una afinidad. Verificado en la prueba 17.74 |
| Flujo 1: accede a la pantalla **«Mis afinidades»** | Título exacto de la pantalla móvil |
| Flujo 3: considera intereses, participación confirmada, proyectos, evidencias, certificados y áreas | Las 8 familias de señal del motor |
| Flujo 4: aplica reglas y **criterios de ponderación definidos** | Tabla `affinity_weights`, 13 reglas |
| Flujo 5: **organiza los resultados por áreas y niveles** | Ranking con `rank`, `level` y `share` |
| Alternativo 3a: si no hay información suficiente, informa | Estado `insufficient_data` con mensaje accionable |
| Alternativo 4a: si hay error, informa que no fue posible | Estado de error en la pantalla; la transacción revierte sin dejar datos a medias |

**No se requiere ninguna corrección.** Conviene decirlo en la defensa: este
objetivo es el mejor especificado del documento.

---

## 2. Figura 2.29 — La rama `alt` está invertida

**RF afectado:** RF17 · **Prioridad: ALTA** — es un error lógico, no de forma.

### Situación

El diagrama de secuencia tiene un fragmento `alt` etiquetado:

```
alt  [Insufficient information to determine affinities]
        Apply rules, tags and configured weights
        Calculate affinity levels by academic area
```

Es decir: **dentro de la rama «no hay información suficiente» está dibujado el
camino de éxito.** Leído literalmente, el diagrama dice que el sistema calcula
los niveles de afinidad justamente cuando no tiene datos para calcularlos.

Contradice a su propio texto explicativo (línea que acompaña a la figura), que
dice correctamente: *«Cuando la información disponible no es suficiente para
realizar el cálculo, el sistema informa esta situación en lugar de generar un
resultado sin respaldo suficiente.»*

### Corrección

El fragmento tiene que tener **dos ramas**:

```
alt  [Información suficiente]
        Affinity Service -> Affinity Service : aplicar reglas, etiquetas y ponderaciones
        Affinity Service -> Affinity Service : calcular niveles por área académica
        Affinity Service -> Repositorio      : guardar resultados, desglose e instantánea
        Affinity Service --> Controlador     : afinidades calculadas

else [Información insuficiente]
        Affinity Service --> Controlador     : estado "información insuficiente"
        App móvil --> Estudiante             : informar que aún no hay con qué orientar
```

Así el diagrama refleja las dos salidas que la propia Tabla 2.26 ya define en su
flujo básico y en su flujo alternativo 3a.

---

## 3. Figura 2.29 — Participantes y persistencia

**RF afectado:** RF17 · **Prioridad:** Media

| Participante actual | Corrección |
|---|---|
| `Affinity Controller` | `AffinityController` |
| `Affinity Service` | `AffinityEngineService` |
| `Profile Data Service` | **No existe.** El motor consulta directamente los repositorios de intereses, habilidades, inscripciones, proyectos, evidencias, certificados y constancias |

Falta además un paso que sí ocurre y que conviene mostrar, porque es lo que
permite explicar y auditar el resultado:

> `guardar resultados, desglose e instantánea` — en **una sola transacción**.

Título en español, coherente con el resto del documento: «Diagrama de Secuencia
de Consultar Afinidades Académicas».

---

## 4. Figura 2.12 — `StudentAffinity` no está asociada a `AcademicArea`

**RF afectado:** RF17 · **Prioridad:** Media

### Situación

El diagrama de clases modela:

```
StudentAffinity
  - score: float
  - level: String
  - lastCalculated: DateTime
  + calculate(): void
  + update(): void
```

con la relación `StudentProfile 1 ── 1..* StudentAffinity`, **pero sin ninguna
asociación con `AcademicArea`**. Tal como está, una afinidad no pertenece a
ningún área, cuando toda la definición de RF17 es *«niveles de afinidad **por
áreas académicas** o tecnológicas»*.

### Corrección

Añadir la asociación:

- `StudentAffinity 0..* ── 1 AcademicArea`

Y renombrar `lastCalculated` a `calculatedAt`, con `updatedAt` como segundo
atributo, que es como está implementado en `affinity_results`.

---

## 5. Figura 2.12 — Faltan las clases que hacen auditable el motor

**RF afectado:** RF17 · **Reglas:** RN-14, RN-15 · **Prioridad:** Media

RN-14 exige que el cálculo use *«mecanismos de ponderación definidos para el
sistema»*, y RF17 pide *«calcular, **actualizar** y consultar»*. Ninguna de las
dos cosas es representable con la sola clase `StudentAffinity`.

Añadir al diagrama:

```
AffinityWeight
  - code: String            // 13 codigos definidos
  - signalType: String
  - points: Decimal
  - label: String
  - description: String
  - isActive: Boolean

AffinityContribution
  - signalType: String
  - weightCode: String
  - matchType: String       // declared | tag | text | inherited
  - points: Decimal
  - sourceLabel: String
  - sourceId: UUID

AffinitySnapshot
  - status: String          // calculated | insufficient_data
  - totalScore: Decimal
  - areasCount: Integer
  - signalsCount: Integer
  - rulesVersion: String
  - calculatedAt: DateTime

AffinitySnapshotItem
  - score: Decimal
  - level: String
  - rank: Integer
```

Relaciones:

- `StudentProfile 1 ── 0..* AffinityContribution`
- `AffinityContribution 0..* ── 1 AcademicArea`
- `StudentProfile 1 ── 0..* AffinitySnapshot`
- `AffinitySnapshot 1 ── 0..* AffinitySnapshotItem`
- `AffinitySnapshotItem 0..* ── 1 AcademicArea`

**Anotar en el diagrama** que `AffinityWeight` es configuración del sistema y no
un catálogo administrable como los de RF4: ningún requerimiento funcional
concede su edición.

---

## 6. Aclaración recomendada en RF17 y la Tabla 2.26

**Prioridad:** Baja

Dos cosas que la implementación decide y el documento no dice, y que un tribunal
puede preguntar:

**a) Cómo se determina el nivel.** El documento habla de «niveles de afinidad»
sin definir el criterio. La implementación clasifica **comparando cada área con
la más fuerte del propio estudiante**, exigiendo además un puntaje mínimo
absoluto. Conviene añadirlo a las Condiciones Posteriores o a una nota:

> El nivel de afinidad es relativo al propio perfil del estudiante: compara cada
> área con la de mayor puntaje del mismo estudiante y exige un mínimo absoluto,
> de modo que el nivel oriente dentro de su trayectoria y no respecto de una
> escala fija de la carrera.

**b) Quién más consulta las afinidades.** El actor de RF17 es el Estudiante,
pero el documento describe en el rol Docente que este *«podrá consultar
información permitida sobre intereses, habilidades, **afinidades**,
participación y proyectos visibles»*. La implementación lo permite dentro del
alcance académico del docente. Conviene que la Tabla 2.26 lo mencione o que se
señale que esa consulta se apoya en RN-23, para que no parezca alcance añadido.

---

## 7. Resumen de correcciones del Objetivo 6

| # | Elemento | Tipo | RF | Prioridad |
|---|---|---|---|---|
| 1 | Figura 2.5 y Tabla 2.26 | **Sin cambios** | RF17 | — |
| 2 | Figura 2.29: la rama `alt` contiene el camino de éxito bajo la etiqueta de fallo | Corregir | RF17 | **Alta** |
| 3 | Figura 2.29: nombres de participantes, `Profile Data Service` inexistente, falta el guardado | Modificar | RF17 | Media |
| 4 | Figura 2.12: `StudentAffinity` sin asociación a `AcademicArea` | Añadir | RF17 | Media |
| 5 | Figura 2.12: faltan `AffinityWeight`, `AffinityContribution`, `AffinitySnapshot` y sus ítems | Añadir | RF17 | Media |
| 6 | Tabla 2.26: definir el criterio de nivel y la consulta docente | Añadir | RF17 | Baja |

La única de fondo es la **2**: el diagrama de secuencia dice lo contrario de lo
que dice su propio texto.
