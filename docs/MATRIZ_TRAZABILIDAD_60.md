# Matriz de trazabilidad — 60 % del Proyecto de Grado

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

> **Vigente.** El avance del 70 % la continúa en
> [`MATRIZ_TRAZABILIDAD_70.md`](MATRIZ_TRAZABILIDAD_70.md), que cubre RF1 – RF18.
> Las 493 verificaciones de este documento siguen pasando sin regresiones.

**Alcance del 60 %:** los seis primeros objetivos específicos del documento, que
corresponden a **RF1 – RF17**. El documento define 10 objetivos específicos y 25
requerimientos funcionales.

**Verificación automatizada, sobre base recreada desde cero y en dos corridas
consecutivas:**

| Suite | Comando | Resultado |
|---|---|---|
| Objetivos 1 – 4 | `npm run test:40` | **235 OK · 0 fallos** |
| Objetivo 5 | `npm run test:50` | **109 OK · 0 fallos** |
| Objetivo 6 | `npm run test:60` | **82 OK · 0 fallos** |
| Validaciones de backend | `npm run test:api` | **42 OK · 0 fallos** |
| Flujo de 14 pasos | `npm run demo:e2e` | **25 OK · 0 fallos** |
| **Total** | | **493 verificaciones · 0 fallos** |

Un requisito se marca **CUMPLIDO** solo si tiene modelo de datos, migración,
backend con permisos y validaciones, endpoint, pantalla que consume la API real,
persistencia comprobada, flujos de éxito y de fallo, y prueba automatizada que
pasa.

---

## Objetivos 1 – 5 (RF1 – RF16 · heredados del 50 %)

Su detalle completo está en
[`MATRIZ_TRAZABILIDAD_50.md`](MATRIZ_TRAZABILIDAD_50.md), que sigue vigente.

| Objetivo | RF | Verificaciones | Estado |
|---|---|---|---|
| 1 — Usuarios, autenticación, roles y acceso | RF1 – RF4 | 63 | **CUMPLIDO** |
| 2 — Perfil estudiantil dinámico | RF5, RF6 | 59 | **CUMPLIDO** |
| 3 — Actividades académicas y extracurriculares | RF7 – RF9 | 47 | **CUMPLIDO** |
| 4 — Participación, evidencias y constancias | RF10 – RF12 | 66 | **CUMPLIDO** |
| 5 — Portafolio de proyectos estudiantiles | RF13 – RF16 | 109 | **CUMPLIDO** |

**Sin regresiones.** Las 411 verificaciones anteriores siguen pasando. Un solo
cambio del Objetivo 6 alcanzó a código anterior, y fue una mejora de rendimiento
sin cambio de contrato: `basicMap()` pasó a agregar en SQL en lugar de traer
toda la tabla a memoria. Se verificó que `/reports/director/affinity-map`
devuelve exactamente la misma forma que antes.

---

## Objetivo 6 — Motor de afinidad estudiantil

### RF17 · Consultar afinidades académicas

| Campo | Contenido |
|---|---|
| **Objetivo** | 6 — Motor de afinidad estudiantil |
| **Reglas de negocio** | RN-14, RN-15, RN-23 |
| **Actor** | Estudiante (Docente y Director, dentro de su alcance) |
| **Entidades** | `affinity_results`, `affinity_weights` (nueva), `affinity_contributions` (nueva), `affinity_snapshots` (nueva), `affinity_snapshot_items` (nueva) |
| **Migración** | `1780260000000-Objective6AffinityEngine` |
| **Controlador** | `AffinityController` |
| **Servicio** | `AffinityEngineService` + `TeacherScopeService` |
| **Endpoints** | `GET /affinity/me` · `GET /affinity/me/summary` · `GET /affinity/me/areas/:areaId/breakdown` · `GET /affinity/me/history` · `GET /affinity/weights` · `POST /affinity/recalculate/me` · `GET /affinity/student/:id` · `GET /affinity/student/:id/summary` · `GET /affinity/student/:id/areas/:areaId/breakdown` · `POST /affinity/recalculate/:id` · `GET /affinity/map/basic` |
| **Interfaz** | Móvil · **«Mis afinidades»** (áreas, desglose, evolución, reglas) · Web · *Mis afinidades* del estudiante y bloque de afinidad en *Estudiantes* del docente |
| **Prueba** | 17.1 – 17.75 |
| **Caso de uso** | Figura 2.5 · **Tabla 2.26** |
| **Secuencia** | Figura 2.29 |
| **Estado** | **CUMPLIDO** |

### Cómo se cubre cada paso de la Tabla 2.26

| Tabla 2.26 | Implementación | Prueba |
|---|---|---|
| Flujo 1 · pantalla «Mis afinidades» | Título exacto de la pantalla móvil | — |
| Flujo 2 · obtiene la información del perfil | `AffinityEngineService.recalculate` | 17.3 – 17.16 |
| Flujo 3 · considera intereses, participación confirmada, proyectos, evidencias, certificados y áreas | 8 familias de señal, 13 ponderaciones | 17.25 |
| Flujo 4 · aplica reglas y criterios de ponderación definidos | Tabla `affinity_weights`, leída en cada cálculo | 17.32 – 17.35 |
| Flujo 5 · organiza por áreas y niveles | `rank`, `level` y `share` en el resumen | 17.20, 17.21, 17.40 |
| Flujo 6 · muestra las afinidades | Pantalla móvil y web | — |
| Alternativo 3a · informa si no hay información suficiente | Estado `insufficient_data` con mensaje accionable | 17.50 – 17.54 |
| Alternativo 4a · informa si ocurre un error | Estado de error en la interfaz; la transacción revierte | 17.55, 17.56 |
| Posterior · **sin modificar directamente los resultados** | No existe endpoint para fijar una afinidad | **17.74** |

### El invariante del objetivo

**La suma del desglose de un área es exactamente su puntaje.** No es una
coincidencia sino una consecuencia del diseño: el motor produce primero la lista
completa de contribuciones y solo después agrega los puntajes, de modo que el
número y su explicación salen de la misma pasada. Verificado en las pruebas
**17.24**, **17.31** y **17.60**, esta última desde la vista del docente.

---

## Reglas de negocio del Objetivo 6

| Regla | Enunciado del documento | Verificación |
|---|---|---|
| RN-14 | El motor usa intereses, participación, proyectos, evidencias, certificados y áreas relacionadas | 17.3 – 17.17, señal por señal |
| RN-14 | El cálculo se realiza mediante reglas, etiquetas, puntuaciones, coincidencias y **mecanismos de ponderación definidos para el sistema** | 17.30 (etiquetas), 17.32 – 17.35 (ponderaciones) |
| RN-15 | Los resultados tienen carácter **orientativo** | 17.71 – 17.73 |
| RN-15 | No se usan para evaluar rendimiento, calificar ni tomar decisiones institucionales formales | Sin campos de nota ni aprobación; 17.74, 17.75 |
| RN-23 | El docente accede solo a la información permitida de su contexto académico | 17.58 – 17.70 |

---

## Resumen

| Objetivo | RF | Verificaciones | Estado |
|---|---|---|---|
| 1 — Usuarios, autenticación, roles y acceso | RF1 – RF4 | 63 | **100 %** |
| 2 — Perfil estudiantil dinámico | RF5, RF6 | 59 | **100 %** |
| 3 — Actividades académicas y extracurriculares | RF7 – RF9 | 47 | **100 %** |
| 4 — Participación, evidencias y constancias | RF10 – RF12 | 66 | **100 %** |
| 5 — Portafolio de proyectos estudiantiles | RF13 – RF16 | 109 | **100 %** |
| 6 — Motor de afinidad estudiantil | RF17 | 82 | **100 %** |
| **Avance total** | **6 de 10 objetivos · RF1 – RF17 de 25** | **493** | **60 %** |

---

## Alineación con el documento

**El software se alineó al documento.** La Tabla 2.26 y la Figura 2.5 están
implementadas al pie de la letra, incluidos los dos flujos alternativos y la
condición posterior de que el estudiante no puede modificar los resultados. Tres
de las cosas que exigían y no estaban hechas —el estado de información
insuficiente, la organización por niveles y las ponderaciones definidas para el
sistema— se construyeron en este avance.

**El documento debe alinearse al software** en cinco puntos, detallados en
[`CORRECCIONES_DOCUMENTO_FINAL_60.md`](CORRECCIONES_DOCUMENTO_FINAL_60.md). El
único de fondo es la Figura 2.29, cuyo fragmento `alt` coloca el camino de éxito
dentro de la rama de fallo, contradiciendo a su propio texto explicativo.

**Estas 5 correcciones, más las 17 del 40 % y las 6 del 50 %, siguen pendientes
de aplicar en el archivo Word.**
