# Correcciones al documento — Objetivo 7 (Recomendaciones académicas)

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)

Correcciones que hay que aplicar **a mano en el archivo Word**. No se editó el
`.docx` automáticamente: pesa 22 MB, tiene las figuras incrustadas, índices y
numeración automática, y una reescritura programática arriesga corromper
estilos, referencias o imágenes.

> Continúa a [`CORRECCIONES_DOCUMENTO_FINAL_40.md`](CORRECCIONES_DOCUMENTO_FINAL_40.md)
> (17), [`CORRECCIONES_DOCUMENTO_FINAL_50.md`](CORRECCIONES_DOCUMENTO_FINAL_50.md)
> (6) y [`CORRECCIONES_DOCUMENTO_FINAL_60.md`](CORRECCIONES_DOCUMENTO_FINAL_60.md)
> (5). **Todas siguen pendientes de aplicar.**

Como en el Objetivo 6, **el caso de uso y su tabla son correctos**: la Figura
2.5 y la **Tabla 2.27** se implementaron al pie de la letra, incluidos sus tres
flujos alternativos. Las correcciones son **6**, y solo una es de fondo.

---

## 1. Figura 2.5 y Tabla 2.27 · SIN CAMBIOS

Verificadas línea por línea contra la implementación.

| Tabla 2.27 dice | Implementación | Prueba |
|---|---|---|
| Actor principal: Estudiante | Solo el estudiante consulta; docente y director reciben 403 | 18.53, 18.54 |
| Previa: sesión iniciada e información utilizable en el perfil | Sin perfil responde 404; sin información, flujo 2a | 18.59 |
| Posterior: las recomendaciones **no representan decisiones obligatorias ni evaluaciones** | Sin nota, sin aprobación, y el estudiante puede descartarlas | 18.45, 18.47 |
| Flujo 1: pantalla **«Recomendaciones»** | Nombre exacto de la pantalla móvil | — |
| Flujo 2: obtiene perfil y afinidades | El motor lee afinidades, preferencias, mejora, intereses y habilidades | 18.15, 18.16, 18.17 |
| Flujo 3: compara con actividades, oportunidades, recursos y demás elementos | Cuatro tipos salen de actividades abiertas, clasificadas por su categoría de RF4 | 18.9 – 18.12 |
| Flujo 4: identifica sugerencias relacionadas | Nada se recomienda sin al menos un motivo de relevancia | 18.4 |
| Flujo 5: organiza por tipo | Seis grupos con su nombre, ordenados por relevancia | 18.6, 18.7 |
| Flujo 6: muestra las recomendaciones | Pantalla móvil y panel web | — |
| Flujo 7: accede al detalle del elemento | `GET /recommendations/me/:id`, que además la marca como vista | 18.31, 18.32 |
| Alternativo **2a**: informar que no hay datos suficientes | Estado `insufficient_profile` con su mensaje | 18.59 – 18.61 |
| Alternativo **3a**: informar que no hay recomendaciones disponibles | Estado `no_matches`, **distinto** del anterior | 18.62 – 18.64 |
| Alternativo 6a: informar si ocurre un error | Estado de error en la interfaz | — |

**No se requiere ninguna corrección.**

---

## 2. Figura 2.30 — La rama `alt` está invertida

**RF afectado:** RF18 · **Prioridad: ALTA** — es un error lógico, no de forma.

### Situación

El diagrama de secuencia tiene un fragmento `alt` etiquetado:

```
alt  [Insufficient data / no matching recommendations]
        Match profile with available elements
        Build orientative recommendations
```

Dentro de la rama «no hay datos ni coincidencias» está dibujado **el camino de
éxito**. Leído literalmente, el sistema construye las recomendaciones
justamente cuando no tiene con qué construirlas.

Es exactamente el mismo error que la Figura 2.29 del Objetivo 6, y contradice
al texto que acompaña a la propia figura, que dice: *«cuando no existen datos o
coincidencias suficientes, el sistema informa que todavía no se encuentran
disponibles recomendaciones adecuadas»*.

### Corrección

El fragmento necesita **tres ramas**, porque la Tabla 2.27 define dos fallos
distintos y no uno solo:

```
alt  [Información suficiente en el perfil y con coincidencias]
        Recommendation Service -> Recommendation Service : comparar perfil y afinidades
                                                           con los elementos disponibles
        Recommendation Service -> Recommendation Service : construir recomendaciones
                                                           orientativas con sus motivos
        Recommendation Service -> Repositorio             : guardar recomendaciones
        Recommendation Service --> Controlador            : recomendaciones agrupadas

else [Sin información suficiente en el perfil]      // flujo 2a
        Recommendation Service --> Controlador : estado "información insuficiente"

else [Con información, pero sin coincidencias]      // flujo 3a
        Recommendation Service --> Controlador : estado "sin recomendaciones disponibles"
```

---

## 3. Figura 2.30 — Participantes y persistencia

**RF afectado:** RF18 · **Prioridad:** Media

| Participante actual | Corrección |
|---|---|
| `Recommendation Controller` | `RecommendationsController` |
| `Recommendation Service` | `RecommendationsService` y `RecommendationsEngine` |
| `Available Elements Service` | **No existe.** El motor consulta directamente los repositorios de actividades, áreas académicas y perfiles |

Falta además un paso que sí ocurre y conviene mostrar, porque es lo que permite
que el estudiante conserve su decisión (RN-16):

> `guardar recomendaciones con sus motivos y su estado`

Título en español, coherente con el resto: «Diagrama de Secuencia de Consultar
Recomendaciones Académicas».

---

## 4. Figura 2.12 — Completar la clase `Recommendation`

**RF afectado:** RF18 · **Regla:** RN-16 · **Prioridad:** Media

### Situación

El diagrama de clases ya tiene la clase, con lo esencial:

```
Recommendation
  - recommendationType: String
  - title: String
  - description: String
  - targetLink: String
  - createdAt: DateTime
  + generate(): void
  + markAsViewed(): void
```

Le faltan los atributos que hacen cumplible a RN-16, que dice que *«las
recomendaciones no serán obligatorias y el estudiante conservará la decisión
sobre su utilización»*. Con solo `markAsViewed()` no hay dónde registrar esa
decisión.

### Corrección

```
Recommendation
  - recommendationType: String   // actividad | oportunidad | curso externo |
                                 // recurso | area de fortalecimiento | companero
  - status: String               // nueva | vista | guardada | descartada
  - title: String
  - description: String
  - targetLink: String
  - targetId: UUID               // actividad, area o perfil, segun el tipo
  - score: Decimal               // solo ordena la lista; no es una nota
  - reasons: JSON                // por que se recomienda: motivo y puntos
  - isCurrent: Boolean           // si el ultimo calculo la sigue produciendo
  - rulesVersion: String
  - createdAt: DateTime
  + generate(): void
  + markAsViewed(): void
  + save(): void
  + dismiss(): void
  + restore(): void
```

**Anotar en el diagrama** que `targetId` apunta a una actividad, a un área
académica o a un perfil de estudiante según el tipo, y que por eso no lleva una
asociación única dibujada. Conservar la asociación con `AcademicArea`, que sí
corresponde, y la de `StudentProfile 1 ── 0..* Recommendation`.

---

## 5. Figura 2.12 — `StudentProfile.visibilityLevel`

**RF afectado:** RF18 · **Prioridad:** Media

El diagrama pone `visibilityLevel: String` en `StudentProfile`, sin valores
definidos y sin que ningún requerimiento lo use. En este objetivo se le dio un
significado concreto y acotado: si el estudiante acepta **aparecer como posible
compañero de equipo** en las recomendaciones de otros.

**Corrección:** renombrarlo a `peerDiscoverable: Boolean`, con la nota de que
está activo por defecto, lo controla el propio estudiante y **no afecta** a lo
que ven docentes ni director, cuyo acceso gobierna el alcance académico
(RN-23).

---

## 6. Aclaración recomendada en la Tabla 2.27 y en RN-16

**Prioridad:** Baja

RN-16 y la Tabla 2.27 nombran «cursos externos» y «recursos» como elementos
recomendables, pero el documento no dice de dónde salen. Conviene aclararlo,
porque parece faltar una entidad que en realidad no hace falta:

> Los cursos externos y los recursos de apoyo se publican como actividades del
> catálogo administrable de RF4, con su enlace. «Curso externo recomendado» ya
> era una de las categorías del catálogo; se agrega «Recurso de apoyo».

---

## 7. Figura 2.39 — Componentes

**Prioridad:** Baja

El diagrama de componentes muestra un único **«Módulo de Afinidad y
Recomendaciones»**. En la implementación son dos módulos con dependencia en un
solo sentido: las recomendaciones leen los resultados de la afinidad, y la
afinidad no sabe nada de las recomendaciones.

Conviene dividir el bloque en dos, o anotar la dependencia, porque justifica por
qué el Objetivo 6 y el 7 son objetivos separados.

---

## 8. Resumen de correcciones del Objetivo 7

| # | Elemento | Tipo | RF | Prioridad |
|---|---|---|---|---|
| 1 | Figura 2.5 y Tabla 2.27 | **Sin cambios** | RF18 | — |
| 2 | Figura 2.30: la rama `alt` contiene el camino de éxito bajo la etiqueta de fallo, y falta separar 2a de 3a | Corregir | RF18 | **Alta** |
| 3 | Figura 2.30: nombres de participantes, `Available Elements Service` inexistente, falta el guardado | Modificar | RF18 | Media |
| 4 | Figura 2.12: completar `Recommendation` con estado, motivos y vigencia | Añadir | RF18 | Media |
| 5 | Figura 2.12: `StudentProfile.visibilityLevel` → `peerDiscoverable` | Renombrar | RF18 | Media |
| 6 | Tabla 2.27 y RN-16: aclarar de dónde salen cursos externos y recursos | Añadir | RF18 | Baja |
| 7 | Figura 2.39: separar afinidad de recomendaciones, o anotar la dependencia | Modificar | RF17, RF18 | Baja |

La única de fondo es la **2**, y es el mismo error que ya tenía la Figura 2.29:
el diagrama dice lo contrario de lo que dice su propio texto.
