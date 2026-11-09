# Avance del 70 % — informe de implementación

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

Este informe explica qué existía, qué faltaba y qué se construyó para completar
el **séptimo objetivo específico**: el módulo de recomendaciones académicas
ligeras.

> **Objetivo 7, textual del documento:** «Desarrollar un módulo de
> recomendaciones académicas ligeras para la sugerencia de actividades, cursos
> externos, recursos y posibles compañeros de equipo en función del perfil
> estudiantil dinámico y las afinidades detectadas.»
>
> Corresponde a **RF18** y a la regla **RN-16**.

---

## 1. Estado heredado del 60 %

**No existía nada.** Ni una línea de recomendaciones en la API, la web o el
móvil. A diferencia del Objetivo 6, donde había un motor que solo necesitaba
cerrarse, aquí se construyó desde cero.

Lo que sí existía y se reutilizó:

- El **motor de afinidad** del Objetivo 6, con sus resultados por área y nivel.
- Las **actividades** del Objetivo 3, con su catálogo administrable de RF4.
- El **perfil dinámico** del Objetivo 2: áreas de preferencia, áreas de mejora,
  intereses en texto libre y habilidades.
- El **portafolio** del Objetivo 5, para saber con quién ya trabaja el
  estudiante.

---

## 2. Diagnóstico

| # | Hueco | Gravedad |
|---|---|---|
| 1 | **RF18 sin implementar por completo**: no existía el módulo | **Alta** |
| 2 | **Defecto del Objetivo 5**: la pantalla de invitar pedía el directorio institucional y un estudiante recibía 403, con lo que la lista de candidatos salía siempre vacía | **Alta** |
| 3 | **Sin datos que recomendar**: cero cursos externos y ningún catálogo de recursos de apoyo | Media |
| 4 | **Ninguna actividad tenía enlace externo** | Media |
| 5 | Nada permitía a un estudiante decidir si aparece ante otros | Media |

El hueco 2 se descubrió al diseñar «posibles compañeros de equipo»: las dos
cosas necesitaban lo mismo, un directorio entre estudiantes seguro.

---

## 3. Trabajo por fases

| Fase | Contenido |
|---|---|
| 1 | Modelo de datos, migración, directorio entre estudiantes y datos de orientación |
| 2 | Motor de recomendación y API |
| 3 | Pantalla móvil «Recomendaciones» y arreglo de la pantalla de invitar |
| 4 | Panel web del estudiante |
| 5 | Suite `test:70`, regresión y documentación |

---

## 4. RF18 · Consultar recomendaciones académicas

**Estado: CUMPLIDO** · 84 verificaciones (18.1 – 18.76)

### 4.1 Seis generadores, uno por cada elemento de RN-16

RN-16 enumera qué puede incluir una recomendación. Hay un generador por cada
uno, y ninguno más:

| Tipo | De dónde sale |
|---|---|
| **Actividades** | Actividades abiertas, relacionadas con el perfil |
| **Oportunidades** | Convocatorias, retos y hackatones |
| **Cursos externos** | Categoría «Curso externo recomendado», con su enlace |
| **Recursos de apoyo** | Categoría «Recurso de apoyo», con su enlace |
| **Áreas de fortalecimiento** | Áreas que el estudiante declaró y donde aún no tiene trayectoria, o la tiene baja |
| **Posibles compañeros** | Estudiantes con trayectoria compartida, o fuertes donde el estudiante quiere crecer |

**Cursos y recursos se publican como actividades**, con la categoría que
corresponde. No se inventó ninguna entidad: el Objetivo 3 ya incluía los cursos
externos dentro de la gestión de actividades, y «Recurso de apoyo» se agregó
como una categoría más del catálogo administrable de RF4.

### 4.2 Cada recomendación explica por qué

El puntaje de una recomendación **es exactamente la suma de sus motivos**. Los
motivos son legibles y se guardan junto a la recomendación:

```
Taller de canalizacion de datos
  +6   Ingenieria de Datos es un área de tu preferencia
  +6   Tienes afinidad alta con Ingenieria de Datos
  +3   Coincide con tu interés «Canalizacion de datos»
  +1   Se realiza pronto: 29 de septiembre de 2026
  ─────
   16
```

**Nada se recomienda sin al menos un motivo de relevancia.** La fecha próxima
solo refuerza algo que ya es relevante; por sí sola nunca basta.

La coincidencia de texto es por palabra completa y sin tildes, e ignora las
palabras que aparecen en casi todas las actividades de la carrera. Si
«sistemas» o «ingeniería» contaran, cualquier interés coincidiría con todo.

### 4.3 Lo que NO se recomienda

- Actividades en las que el estudiante ya se inscribió, marcó interés o
  participó.
- Actividades cuya fecha ya pasó, en borrador, o sin plazas confirmables. El
  criterio de cupo es el mismo que aplica la API al confirmar.
- Elementos de áreas sin ninguna relación con el perfil.
- Compañeros que ya trabajan con el estudiante en un proyecto.
- Compañeros que desactivaron aparecer en sugerencias.

### 4.4 Los dos flujos alternativos, separados

La Tabla 2.27 define dos fallos que no son lo mismo, y la interfaz los dice
distinto:

| Situación | Estado | Qué se le dice al estudiante |
|---|---|---|
| El perfil no tiene información utilizable | `insufficient_profile` | Todavía no hay datos suficientes; declara preferencias, intereses o habilidades |
| Hay perfil, pero nada disponible coincide | `no_matches` | No existen recomendaciones disponibles ahora; vuelve cuando se publiquen nuevas |

Al primero se le puede pedir algo. Al segundo no: no hay oferta relacionada, y
pedirle que complete su perfil sería engañarlo.

### 4.5 La decisión es del estudiante (RN-16)

RN-16 dice que las recomendaciones **no son obligatorias y que el estudiante
conserva la decisión sobre su utilización**. Cada recomendación tiene estado:
nueva, vista, guardada o descartada.

- Abrir el detalle la marca como vista. Es la operación `markAsViewed()` que el
  diagrama de clases ya modelaba.
- Lo descartado **no vuelve a proponerse**, aunque el motor lo genere otra vez.
- Lo guardado sigue guardado.
- Todo se puede deshacer desde las pestañas de guardadas y descartadas.

Un elemento que deja de aplicar se conserva marcado como no vigente si el
estudiante lo había abierto o decidido algo sobre él, y se elimina si no. No se
guarda ruido, pero tampoco se borra una decisión.

---

## 5. El defecto del Objetivo 5, corregido

La pantalla móvil de invitar integrantes llamaba al directorio institucional de
estudiantes, que solo admite docente, director y administrador. Verificado
contra la API real:

```
Estudiante -> GET /profiles/students: 403
```

El error se capturaba en silencio y la lista de candidatos quedaba vacía: **un
estudiante no podía invitar a nadie desde la app**. La suite `test:50` no lo veía
porque invita por identificador contra la API, no por la interfaz.

La corrección es `GET /profiles/peers`, pensado para estudiantes:

- Devuelve solo identificador, nombre y semestre. **Nunca el correo.**
- Exige al menos 2 caracteres y devuelve como máximo 20 resultados.
- **Escapa los comodines**: buscar `%%` no lista a todos.
- Excluye al propio estudiante y a las cuentas inactivas.

La preferencia de aparecer en sugerencias **no se aplica aquí**: gobierna lo que
el sistema propone por su cuenta. Una invitación es una acción dirigida y sigue
requiriendo que el invitado acepte.

---

## 6. Modelo de datos

| Tabla | Cambio | Preservación |
|---|---|---|
| `recommendations` | **Nueva.** Tipo, estado, destino, motivos, puntaje, vigencia y versión de reglas | Tabla nueva |
| `student_profiles` | Nueva columna `peer_discoverable`, activa por defecto | **46 perfiles antes, 46 después** |
| `activity_categories` | Categoría «Recurso de apoyo», sirve para ambos tipos de actividad | **16 antes, 17 después**, ninguna modificada |

Total del proyecto: **12 migraciones, 26 tablas.** `synchronize: false` se
mantiene.

**Integridad:**

- Índice único `(perfil, tipo, destino)`: una recomendación por elemento y
  estudiante, lo que hace que regenerar sea idempotente.
- `CHECK` de puntaje no negativo y `CHECK` de que los motivos son siempre un
  arreglo.
- `CASCADE` respecto del perfil y `SET NULL` respecto del área.
- `target_id` **sin clave foránea a propósito**: apunta a una actividad, a un
  área o a un perfil según el tipo, y la vigencia la controla el motor.

---

## 7. Migración

`1780270000000-Objective7Recommendations.ts`. El `down` revierte la tabla, los
dos tipos enumerados y la columna.

**Reversibilidad comprobada, no supuesta:** se ejecutó el `down` y se verificó
que no quedan tabla, tipos ni columna, que los datos existentes siguen intactos
y que la categoría nueva **se conserva si alguna actividad la usa**, porque
borrarla destruiría datos. Al reaplicar el `up`, la categoría no se duplica.

---

## 8. Backend

**Nuevo**

- `RecommendationsEngine`: los seis generadores, las exclusiones, los motivos y
  la persistencia transaccional.
- `RecommendationsService`: consulta, detalle, decisiones e historial.
- `RecommendationsController`: cinco rutas, todas del estudiante.
- `recommendation.rules.ts`: las reglas en un solo lugar, con su huella de
  versión.
- `ProfilesService.searchPeers` y `GET /profiles/peers`.

**Modificado**

- `StudentProfile` y su DTO, para la preferencia de aparecer en sugerencias.
- Seed: 5 cursos externos, 4 recursos de apoyo y 1 convocatoria con enlaces
  públicos reales, en un arreglo aparte para no alterar los datos que ya usan
  los guiones de demostración anteriores.

---

## 9. Aplicación móvil

| Pantalla | Estado | Contenido |
|---|---|---|
| **«Recomendaciones»** | **Nueva** | Seis grupos, motivo visible, detalle desplegable con todos los motivos, guardar y descartar, pestañas de guardadas y descartadas, y los dos estados de fallo |
| *Proyecto* → Invitar | Corregida | Busca compañeros por nombre en lugar de pedir el directorio institucional |

La pestaña se llama «Sugerencias» porque son seis en la barra inferior; el
encabezado lleva el nombre que fija RF18.

---

## 10. Aplicación web

| Pantalla | Estado | Contenido |
|---|---|---|
| *Recomendaciones* (estudiante) | **Nueva** | Lo mismo que el móvil |

A diferencia del Objetivo 6 no se extrajo un componente compartido: RF18 no
concede vista institucional, así que la página del estudiante es su único
consumidor.

---

## 11. Seguridad y privacidad

| Regla | Implementación | Prueba |
|---|---|---|
| Solo el estudiante consulta sus recomendaciones | `@Roles(STUDENT)` | 18.53, 18.54 |
| Una recomendación ajena no existe para otro | 404, no 403 | 18.51, 18.52 |
| Nadie fija el puntaje a mano | Campo no declarado, rechazado | 18.47 |
| Tarjeta de compañero sin correo | Proyección mínima | 18.27 |
| Motivos de compañero solo nombran áreas | Plantillas fijas, validadas | 18.28 |
| Quien se excluye no aparece | `peer_discoverable` | 18.26 |
| El directorio no sirve como listado masivo | Mínimo 2 caracteres, tope 20, comodines escapados | 18.69 – 18.71 |

---

## 12. Pruebas

**Nueva suite:** `npm run test:70` → `scripts/e2e-objective-7.mjs`, **84
verificaciones**.

La suite **construye su propio escenario**: tres áreas, ocho actividades con sus
casos límite (fecha pasada, sin cupo, en borrador, de otra área) y seis
estudiantes con perfiles distintos. Así cada recomendación que aparece, y cada
una que no aparece, es consecuencia de algo que la prueba hizo.

| Bloque | Verificaciones |
|---|---|
| Preparación del escenario | 8 |
| RF18 · Generación y motivos | 20 |
| RF18 · Exclusiones y privacidad | 10 |
| RN-16 · Decisiones del estudiante | 14 |
| RF18 · Validaciones y permisos | 14 |
| RF18 · Flujos alternativos 2a y 3a | 6 |
| RF14 · Directorio entre estudiantes | 12 |

---

## 13. Resultados

Base recreada desde cero (`db:reset` → `api:migrate` → `seed:populate`), dos
corridas consecutivas:

| Suite | 1.ª corrida | 2.ª corrida |
|---|---|---|
| `test:40` | **235 OK · 0 fallos** | **235 OK · 0 fallos** |
| `test:50` | **109 OK · 0 fallos** | **109 OK · 0 fallos** |
| `test:60` | **82 OK · 0 fallos** | **82 OK · 0 fallos** |
| `test:70` | **84 OK · 0 fallos** | **84 OK · 0 fallos** |
| `test:api` | **42 OK · 0 fallos** | **42 OK · 0 fallos** |
| `demo:e2e` | **25 OK · 0 fallos** | **25 OK · 0 fallos** |
| **Total** | **577 · 0 fallos** | **577 · 0 fallos** |

Compilación: `shared` OK · `api` OK · `web` OK · `mobile typecheck` OK.

**Rendimiento y concurrencia.** Las recomendaciones se generan en cada consulta,
como describe la Tabla 2.27. Medido: entre **34 y 137 ms**. Con 60 consultas
simultáneas del mismo estudiante, todas respondieron 200 con el mismo total, sin
filas duplicadas y sin errores de base.

---

## 14. Correcciones documentales necesarias

Seis, detalladas en
[`CORRECCIONES_DOCUMENTO_FINAL_70.md`](CORRECCIONES_DOCUMENTO_FINAL_70.md).

**La Figura 2.5 y la Tabla 2.27 son correctas y no requieren cambios.**

La única de fondo: la **Figura 2.30** coloca el camino de éxito dentro del
fragmento etiquetado como falta de datos, igual que la Figura 2.29 del Objetivo
6, y además no separa los dos flujos alternativos que su propia tabla define.

---

## 15. Funcionalidades que siguen fuera del 70 %

Objetivos 8 a 10 del documento (RF19 – RF25):

- Contactos por código QR, chat privado, equipos y chat grupal (RF19 – RF22).
  *La sugerencia de compañeros de RF18 no los reemplaza: propone, no comunica.*
- Gamificación aplicada: puntos, insignias y progreso (RF23). *Los criterios se
  administran desde el 40 %.*
- Paneles avanzados, mapa de afinidad ampliado y estimación de tendencias
  (RF24, RF25).

Siguen apareciendo como **«Próximamente»** en la navegación. Dentro de RF1 –
RF18 no queda ningún marcador de pendiente.
