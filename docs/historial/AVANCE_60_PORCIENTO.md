# Avance del 60 % — informe de implementación

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

Este informe explica qué existía, qué faltaba y qué se construyó para completar
el **sexto objetivo específico**: el motor de afinidad estudiantil.

> **Objetivo 6, textual del documento:** «Desarrollar un motor de afinidad
> estudiantil para la identificación de áreas de interés y orientación académica
> mediante reglas, etiquetas, puntuación y coincidencias basadas en intereses,
> participación, proyectos y evidencias.»
>
> Corresponde a **RF17** y a las reglas **RN-14** y **RN-15**. RF18
> (recomendaciones) pertenece al Objetivo 7 y **no** entra en este avance,
> aunque la Tabla 2.5 los agrupe.

---

## 1. Estado heredado del 50 %

Existía un motor real, no un esqueleto: `AffinityEngineService` con 301 líneas
que ya puntuaba sobre once señales, deducía áreas por etiquetas y por texto, y
se recalculaba automáticamente desde siete módulos a través del puerto
`AFFINITY_RECALCULATION`.

**Nada de eso se rehízo.** El trabajo consistió en cerrarle los huecos que le
impedían ser defendible.

---

## 2. Diagnóstico

| # | Hueco | Gravedad |
|---|---|---|
| 1 | **Sin explicabilidad.** El estudiante veía «Redes · 14 · alto» y no sabía por qué. RN-15 dice que la afinidad es orientación, y una orientación que no se explica es una caja negra | **Alta** |
| 2 | **`persist()` sin transacción.** Borraba los resultados y después insertaba los nuevos: un fallo intermedio dejaba al estudiante sin ninguna afinidad | **Alta** |
| 3 | **Umbrales absolutos.** `≤4 bajo, ≤10 medio, resto alto`. Medido sobre los datos: **13 de 28 estudiantes no tenían ni un área alta** | **Alta** |
| 4 | **Sin suite de pruebas** para el objetivo | **Alta** |
| 5 | **Ponderaciones incrustadas en el código.** RN-14 pide «mecanismos de ponderación definidos para el sistema»; eran una constante invisible | Media |
| 6 | **Sin el camino de fallo de RF17.** El flujo alternativo 3a exige informar que no hay información suficiente; solo se mostraba una lista vacía | Media |
| 7 | **Sin historial.** RF17 pide «calcular, *actualizar* y consultar»; sin historial, actualizar es sobrescribir | Media |
| 8 | **Pantalla móvil de 38 líneas**, siendo el medio oficial de RF17 | Media |
| 9 | **`basicMap()` cargaba la tabla entera en memoria** para contarla en JavaScript | Baja |

---

## 3. Trabajo por fases

| Fase | Contenido |
|---|---|
| 1 | Ponderaciones como configuración, desglose, historial y transacción |
| 2 | Niveles relativos, camino de fallo de RF17 y API de consulta |
| 3 | Pantalla móvil «Mis afinidades» |
| 4 | Panel web para estudiante y docente |
| 5 | Suite `test:60`, regresión completa y documentación |

---

## 4. RF17 · Consultar afinidades académicas

**Estado: CUMPLIDO** · 82 verificaciones (17.1 – 17.75)

### 4.1 Las ponderaciones son ahora configuración del sistema

RN-14 exige que el cálculo use «mecanismos de ponderación definidos para el
sistema». Las 13 ponderaciones pasaron de constante en el código fuente a filas
de `affinity_weights`, sembradas por la migración con **exactamente los mismos
valores** que ya usaba el motor.

| Señal | Puntos | Por qué ese peso |
|---|---|---|
| Proyecto propio | 5 | La señal individual más fuerte: implica trabajo sostenido y verificable |
| Proyecto como integrante | 5 | Participación aceptada en un proyecto ajeno |
| Certificado externo | 4 | Proviene de una entidad ajena a la plataforma |
| Habilidad avanzada (nivel 4-5) | 3 | Competencia declarada de alto nivel |
| Participación confirmada | 3 | Verificada por el responsable, no solo declarada |
| Constancia interna | 3 | Emitida por el director sobre participación confirmada |
| Habilidad intermedia (nivel 3) | 2 | |
| Inscripción en actividad | 2 | Compromiso, aún no verificado |
| Interés declarado | 2 | |
| Evidencia académica | 2 | |
| Habilidad básica (nivel 1-2) | 1 | |
| Interés en actividad | 1 | La señal más débil de participación |
| Área en la que desea mejorar | 1 | Expresa una intención, no una trayectoria |

**No hay pantalla de administración de pesos**, y es deliberado: ningún
requerimiento funcional la concede. Son configuración, no un catálogo editable
como los de RF4. Se consultan de solo lectura en `GET /affinity/weights`.

### 4.2 El motor ahora se explica

Cada cálculo escribe su **desglose**: qué señal sumó, cuántos puntos, a qué área
y **cómo se determinó esa área** — declarada por el estudiante, deducida por
coincidencia con las etiquetas del área, deducida por texto, o heredada de la
actividad o proyecto que la respalda. Son las «reglas, etiquetas y
coincidencias» que nombra RN-14, hechas visibles.

Ejemplo real de la base de demostración:

```
Bases de Datos = 18 (alto)
  +5   Proyecto propio: Sistema de monitoreo IoT para laboratorios   (declarada)
  +3   Habilidad declarada: SQL (nivel 4)                            (declarada)
  +3   Habilidad declarada: PostgreSQL (nivel 5)                     (declarada)
  +2   Interes declarado: Bases de Datos                             (declarada)
  +2   Evidencia: Repositorio del proyecto                           (declarada)
  +2   Evidencia: Demostración desplegada                            (declarada)
  +1   Interes en actividad: Reto de Bases de Datos                  (heredada)
  ─────
   18
```

**La suma del desglose es exactamente el puntaje.** No por casualidad: el motor
produce primero la lista completa de contribuciones y solo después agrega, así
que el número y su explicación salen de la misma pasada y no pueden discrepar.

### 4.3 El nivel dejó de ser una escala fija

Los umbrales absolutos no discriminaban. Un estudiante de octavo semestre
acumula puntos en todo y termina con todo en «alto»; al de primero le sale todo
«bajo». Si todo es alto, nada lo es.

El nivel ahora **compara cada área con la más fuerte del propio estudiante**, y
exige además un piso absoluto para que un perfil de 2 puntos no genere un «alto»
sin trayectoria detrás. Hacen falta las dos condiciones.

**Medido sobre los mismos datos:**

| | Estudiantes sin ninguna área «alta» |
|---|---|
| Regla anterior (umbral absoluto) | **13 de 28** |
| Regla nueva (relativa al perfil) | **5 de 28** |

Los 5 restantes son perfiles genuinamente sin sustancia. Eso es el flujo
alternativo 3a de la Tabla 2.26, no un defecto.

### 4.4 RF17 distingue sus dos salidas

La Tabla 2.26 define un flujo básico y un flujo alternativo 3a: *«Si todavía no
existe información suficiente para determinar afinidades, el sistema informa al
Estudiante que no se cuenta con datos suficientes.»* Una lista vacía no dice
eso.

Ahora el estado viaja explícito, con un mensaje que además dice qué hacer:

```
status:  insufficient_data
message: Todavia no hay informacion suficiente para orientarte. Declara
         intereses y habilidades, registra proyectos o participa en
         actividades y vuelve a consultar.
```

### 4.5 Historial de cálculos

RF17 pide «calcular, **actualizar** y consultar». Cada recálculo deja una
instantánea con sus totales, su ranking por área y la **huella de las reglas**
usadas. Con eso se puede distinguir después una variación de puntaje causada por
la actividad del estudiante de una causada por un ajuste de las reglas.

El mecanismo se demostró solo durante el desarrollo: al cambiar los umbrales de
nivel entre dos cálculos, las instantáneas quedaron con huellas distintas
(`bc136b95…` y `a0bd8bca…`) pese al mismo puntaje.

Se conservan las últimas 30 instantáneas por estudiante. El historial debe
permitir ver evolución, no crecer sin límite.

---

## 5. Modelo de datos

| Tabla | Cambio | Preservación |
|---|---|---|
| `affinity_results` | **Sin cambios** | **77 filas antes, 77 después**, con puntajes idénticos |
| `affinity_weights` | **Nueva.** 13 reglas sembradas por la migración | Tabla nueva |
| `affinity_contributions` | **Nueva.** El desglose del cálculo vigente | Tabla nueva |
| `affinity_snapshots` | **Nueva.** Encabezado del historial | Tabla nueva |
| `affinity_snapshot_items` | **Nueva.** Ranking por área de cada instantánea | Tabla nueva |

Total del proyecto: **11 migraciones, 25 tablas.** `synchronize: false` se
mantiene.

**Integridad:**

- `CHECK` sobre `affinity_weights.points` entre 0 y 100: son puntajes acotados,
  no escalas de nota.
- Todas las tablas nuevas en `CASCADE` respecto del perfil y del área: si el
  estudiante o el área desaparecen, no queda desglose huérfano.
- `affinity_contributions.source_id` **sin clave foránea a propósito**: apunta a
  tablas distintas según la señal, y el desglose debe sobrevivir aunque el
  registro de origen se elimine después.

---

## 6. Migraciones

`1780260000000-Objective6AffinityEngine.ts`. El `down` revierte las cuatro
tablas y los cuatro tipos enumerados en orden inverso.

**Reversibilidad comprobada, no supuesta:** se ejecutó el `down` y se verificó
que quedan **0 tablas** y **0 tipos enumerados** huérfanos, y que
`affinity_results` sale intacta. Después se volvió a aplicar el `up`.

---

## 7. Backend

**Modificado**

- `AffinityEngineService`: lee las ponderaciones de la base con respaldo a los
  valores conocidos si falta una fila; produce contribuciones; clasifica por
  nivel relativo; persiste resultados, desglose e instantánea **en una sola
  transacción**; poda el historial.
- `AffinityController`: seis endpoints nuevos de consulta, la mitad de ellos con
  variante institucional sujeta a `TeacherScopeService`.

**Corregido**

- `persist()` era un `DELETE` seguido de `INSERT` sin transacción. Un fallo
  intermedio dejaba al estudiante sin ninguna afinidad. Ahora o se aplica todo o
  no cambia nada.
- `basicMap()` traía todas las filas de `affinity_results` a memoria para
  contarlas en JavaScript. Ahora agrega en SQL. Se verificó que la respuesta es
  idéntica campo por campo.

`GET /affinity/me` **conserva su forma anterior** (arreglo simple). Las
pantallas y las suites del 40 y del 50 la consumen y no hay razón para
romperlas; la vista rica vive en `/affinity/me/summary`.

---

## 8. Aplicación móvil

| Pantalla | Estado | Contenido |
|---|---|---|
| **«Mis afinidades»** | Rehecha (38 → ~430 líneas) | Pestaña *Áreas*: ranking con nivel, puntaje, barra de peso relativo y desglose desplegable por área. Pestaña *Evolución*: instantáneas con su variación. Desplegable *Cómo se calcula*: las 13 ponderaciones con su justificación. Estado de información insuficiente con las cuatro acciones que más aportan |

El desglose se carga **solo al abrir el área**, no de golpe.

El nombre de la pantalla es el que fija RF17. La pestaña de la barra inferior
conserva la etiqueta corta porque son cinco.

---

## 9. Aplicación web

| Pantalla | Estado | Contenido |
|---|---|---|
| *Mis afinidades* (estudiante) | Rehecha | Tres pestañas: áreas con desglose, evolución con variación, y las reglas |
| *Estudiantes* (docente) | Bloque de afinidad rehecho | Pasó de etiquetas planas al mismo ranking con desglose, para un estudiante de su alcance |

Ambas usan el **mismo componente** (`components/affinity.tsx`). Es deliberado:
dos lecturas separadas del mismo puntaje acaban divergiendo con el tiempo, que
es justo lo que un motor de orientación no puede permitirse.

---

## 10. Seguridad y permisos

| Regla | Implementación | Prueba |
|---|---|---|
| El estudiante consulta solo lo suyo | `resolveProfileIdByUser` | 17.65 |
| El docente consulta dentro de su alcance | `TeacherScopeService` | 17.58, 17.59 |
| Fuera de alcance: resumen | 403 | 17.62 |
| Fuera de alcance: **desglose** | 403 | **17.63** |
| Fuera de alcance: recálculo ajeno | 403 | 17.64 |
| El mapa agregado es del director | 403 para estudiante y docente | 17.66, 17.67 |
| Nadie fija una afinidad a mano | No existe el endpoint | 17.74 |
| Las ponderaciones no se editan por API | No existe el endpoint | 17.75 |

Se cerró también el **desglose**, no solo el resumen: dejarlo abierto habría
sido una puerta trasera evidente al mismo dato.

---

## 11. Pruebas

**Nueva suite:** `npm run test:60` → `scripts/e2e-objective-6.mjs`, **82
verificaciones**.

La estrategia central es construir el perfil de un estudiante **señal por
señal**, comprobando el puntaje después de cada una:

```
17.5   Un interes declarado aporta 2 puntos
17.8   Una habilidad de nivel 5 aporta 3 puntos (2 + 3 = 5)
17.9   La misma habilidad en nivel 1 aporta solo 1 punto (2 + 1 = 3)
17.10  El area de mejora aporta 1 punto (5 + 1 = 6)
17.12  Un proyecto propio aporta 5 puntos (6 + 5 = 11)
17.14  Una evidencia aporta 2 puntos (11 + 2 = 13)
17.16  Un certificado externo aporta 4 puntos (13 + 4 = 17)
```

Eso demuestra que cada ponderación se aplica de verdad, en lugar de comprobar
que «sale un número». El escenario crea sus propias áreas y habilidades para que
los puntajes no dependan de lo que haya sembrado el seed.

| Bloque | Verificaciones |
|---|---|
| Preparación de actores y catálogos | 7 |
| RF17 · Cálculo, señal por señal | 21 |
| RN-14 · Explicabilidad | 14 |
| RF17 · Clasificación del nivel | 6 |
| RF17 · Historial | 8 |
| RF17 · Salida de fallo | 8 |
| RN-23 · Permisos y alcance | 13 |
| RN-15 · Carácter orientativo | 5 |

---

## 12. Resultados

Base recreada desde cero (`db:reset` → `api:migrate` → `seed:populate`), dos
corridas consecutivas:

| Suite | 1.ª corrida | 2.ª corrida |
|---|---|---|
| `test:40` | **235 OK · 0 fallos** | **235 OK · 0 fallos** |
| `test:50` | **109 OK · 0 fallos** | **109 OK · 0 fallos** |
| `test:60` | **82 OK · 0 fallos** | **82 OK · 0 fallos** |
| `test:api` | **42 OK · 0 fallos** | **42 OK · 0 fallos** |
| `demo:e2e` | **25 OK · 0 fallos** | **25 OK · 0 fallos** |
| **Total** | **493 · 0 fallos** | **493 · 0 fallos** |

Compilación: `shared` OK · `api` OK · `web` OK · `mobile typecheck` OK.

**Estado de la base tras el seed:** 13 ponderaciones, 77 afinidades, 186 líneas
de desglose y 16 instantáneas.

---

## 13. La prueba de que no se cambió ningún puntaje

El paso de ponderaciones en código a ponderaciones en base era un refactor, y se
verificó como tal en lugar de asumirlo:

1. Se capturaron las **77 filas** de `affinity_results` calculadas por el motor
   anterior.
2. Se aplicó la migración.
3. Se recalcularon los 16 estudiantes con el motor nuevo.
4. Se compararon las dos capturas.

```
referencia: 77 filas   nuevo: 77 filas
DIFERENCIAS: ninguna - los puntajes son identicos
```

Los cambios de nivel llegaron después, en la fase 2, y son deliberados.

---

## 14. Correcciones documentales necesarias

Cinco, detalladas en
[`CORRECCIONES_DOCUMENTO_FINAL_60.md`](CORRECCIONES_DOCUMENTO_FINAL_60.md).

**La Figura 2.5 y la Tabla 2.26 son correctas y no requieren cambios.** Es el
objetivo mejor especificado del documento, y merece decirse en la defensa:
varias de las cosas construidas en este avance —el estado de información
insuficiente, la organización por niveles, las ponderaciones definidas para el
sistema, la imposibilidad de modificar los resultados— **ya estaban escritas y
no estaban hechas**.

La única corrección de fondo: la **Figura 2.29** coloca el camino de éxito
—«aplicar reglas» y «calcular niveles»— **dentro del fragmento `alt` etiquetado
como información insuficiente**, contradiciendo a su propio texto explicativo.

---

## 15. Funcionalidades que siguen fuera del 60 %

Objetivos 7 a 10 del documento (RF18 – RF25):

- Recomendaciones académicas ligeras (RF18). *El motor de afinidad que las
  alimenta ya está completo; el módulo de recomendación es el Objetivo 7.*
- Contactos por QR, chat privado, equipos y chat grupal (RF19 – RF22).
- Gamificación aplicada: puntos, insignias y progreso (RF23). *Los criterios se
  administran desde el 40 %; falta el motor que los aplique.*
- Paneles avanzados, mapa de afinidad ampliado y estimación de tendencias
  (RF24, RF25). *Los reportes básicos y el mapa agregado ya existen.*

Siguen apareciendo como **«Próximamente»** en la navegación. Dentro de RF1 –
RF17 no queda ningún marcador de pendiente.
