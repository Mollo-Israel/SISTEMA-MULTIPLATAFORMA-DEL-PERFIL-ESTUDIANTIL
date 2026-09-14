# Matriz de trazabilidad — 70 % del Proyecto de Grado

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Univalle

**Alcance del 70 %:** los siete primeros objetivos específicos del documento,
que corresponden a **RF1 – RF18**. El documento define 10 objetivos específicos
y 25 requerimientos funcionales.

**Verificación automatizada, sobre base recreada desde cero y en dos corridas
consecutivas:**

| Suite | Comando | Resultado |
|---|---|---|
| Objetivos 1 – 4 | `npm run test:40` | **235 OK · 0 fallos** |
| Objetivo 5 | `npm run test:50` | **109 OK · 0 fallos** |
| Objetivo 6 | `npm run test:60` | **82 OK · 0 fallos** |
| Objetivo 7 | `npm run test:70` | **84 OK · 0 fallos** |
| Validaciones de backend | `npm run test:api` | **42 OK · 0 fallos** |
| Flujo de 14 pasos | `npm run demo:e2e` | **25 OK · 0 fallos** |
| **Total** | | **577 verificaciones · 0 fallos** |

Un requisito se marca **CUMPLIDO** solo si tiene modelo de datos, migración,
backend con permisos y validaciones, endpoint, pantalla que consume la API real,
persistencia comprobada, flujos de éxito y de fallo, y prueba automatizada que
pasa.

---

## Objetivos 1 – 6 (RF1 – RF17 · heredados del 60 %)

Su detalle completo está en
[`MATRIZ_TRAZABILIDAD_60.md`](MATRIZ_TRAZABILIDAD_60.md), que sigue vigente.

| Objetivo | RF | Verificaciones | Estado |
|---|---|---|---|
| 1 — Usuarios, autenticación, roles y acceso | RF1 – RF4 | 63 | **CUMPLIDO** |
| 2 — Perfil estudiantil dinámico | RF5, RF6 | 59 | **CUMPLIDO** |
| 3 — Actividades académicas y extracurriculares | RF7 – RF9 | 47 | **CUMPLIDO** |
| 4 — Participación, evidencias y constancias | RF10 – RF12 | 66 | **CUMPLIDO** |
| 5 — Portafolio de proyectos estudiantiles | RF13 – RF16 | 109 | **CUMPLIDO** |
| 6 — Motor de afinidad estudiantil | RF17 | 82 | **CUMPLIDO** |

**Sin regresiones.** Las 493 verificaciones anteriores siguen pasando. Los
cambios de este objetivo sobre código anterior fueron dos, y ninguno alteró
comportamiento existente:

- **`profiles`**: se agregó la búsqueda de compañeros entre estudiantes y la
  preferencia de aparecer en sugerencias. El directorio institucional de RF3 no
  cambió.
- **Catálogo de RF4**: se agregó la categoría «Recurso de apoyo». Las 14
  categorías originales quedaron intactas.

### Defecto del Objetivo 5 corregido en este avance

La pantalla móvil de invitar integrantes pedía el directorio institucional de
estudiantes, reservado a docente, director y administrador. Un estudiante
recibía **403**, el error se tragaba en silencio y **la lista de candidatos
salía siempre vacía**: desde la app no se podía invitar a nadie. La suite
`test:50` no lo detectaba porque invita por identificador contra la API.

Se corrigió con `GET /profiles/peers` y la pantalla ahora busca por nombre.
Verificado en las pruebas 18.65 – 18.74.

---

## Objetivo 7 — Recomendaciones académicas ligeras

### RF18 · Consultar recomendaciones académicas

| Campo | Contenido |
|---|---|
| **Objetivo** | 7 — Módulo de recomendaciones académicas ligeras |
| **Reglas de negocio** | RN-16 (y RN-15 sobre el carácter orientativo) |
| **Actor** | Estudiante |
| **Entidades** | `recommendations` (nueva), `student_profiles.peer_discoverable` (nueva columna), `activity_categories` (categoría «Recurso de apoyo») |
| **Migración** | `1780270000000-Objective7Recommendations` |
| **Controlador** | `RecommendationsController` |
| **Servicios** | `RecommendationsEngine` + `RecommendationsService` |
| **Endpoints** | `GET /recommendations/me` · `GET /recommendations/me/:id` · `PATCH /recommendations/me/:id` · `GET /recommendations/me/history` · `GET /recommendations/rules` · `GET /profiles/peers` |
| **Interfaz** | Móvil · **«Recomendaciones»** (pestaña Sugerencias) · Web · *Recomendaciones* del estudiante |
| **Prueba** | 18.1 – 18.76 |
| **Caso de uso** | Figura 2.5 · **Tabla 2.27** |
| **Secuencia** | Figura 2.30 |
| **Estado** | **CUMPLIDO** |

### Cómo se cubre cada paso de la Tabla 2.27

| Tabla 2.27 | Implementación | Prueba |
|---|---|---|
| Flujo 1 · pantalla «Recomendaciones» | Título exacto de la pantalla móvil | — |
| Flujo 2 · obtiene perfil y afinidades | Afinidades, áreas de preferencia, áreas de mejora, intereses libres y habilidades | 18.15 – 18.17 |
| Flujo 3 · compara con actividades, oportunidades, recursos y demás elementos | Actividades abiertas clasificadas por su categoría de RF4 | 18.9 – 18.12 |
| Flujo 4 · identifica sugerencias relacionadas | Nada se recomienda sin un motivo de relevancia | 18.4 |
| Flujo 5 · organiza por tipo | Seis grupos con nombre, ordenados y con límite | 18.6 – 18.8 |
| Flujo 6 · muestra las recomendaciones | Pantalla móvil y panel web | — |
| Flujo 7 · accede al detalle del elemento | `GET /recommendations/me/:id`, que la marca como vista | 18.31 – 18.33 |
| Alternativo **2a** · informar que no hay datos suficientes | Estado `insufficient_profile` | 18.59 – 18.61 |
| Alternativo **3a** · informar que no hay recomendaciones disponibles | Estado `no_matches`, distinto del anterior | 18.62 – 18.64 |
| Alternativo 6a · informar si ocurre un error | Estado de error en móvil y web | — |
| Posterior · **no son decisiones obligatorias ni evaluaciones** | Sin nota ni aprobación; el estudiante puede descartar | 18.45, 18.47 |

### Los seis elementos que enumera RN-16

| Elemento de RN-16 | De dónde sale | Prueba |
|---|---|---|
| Actividades | Actividades abiertas de su área | 18.9 |
| Oportunidades | Convocatorias, retos y hackatones | 18.12 |
| Enlaces a cursos externos | Categoría «Curso externo recomendado», con su enlace | 18.10 |
| Recursos | Categoría «Recurso de apoyo», con su enlace | 18.11 |
| Áreas de fortalecimiento | Áreas declaradas sin trayectoria o con afinidad baja | 18.13 |
| Posibles compañeros de equipo | Estudiantes con trayectoria compartida o complementaria | 18.14 |

### El invariante del objetivo

**El puntaje de una recomendación es exactamente la suma de sus motivos.** El
motor produce primero la lista completa de motivos y solo después agrega, de
modo que el número y su explicación provienen del mismo cálculo. Verificado en
la prueba **18.5** sobre todas las recomendaciones generadas, y comprobado
también en SQL sobre la tabla entera durante el desarrollo.

---

## Reglas de negocio del Objetivo 7

| Regla | Enunciado del documento | Verificación |
|---|---|---|
| RN-16 | Las recomendaciones se producen a partir del perfil y de las afinidades identificadas | 18.15 – 18.19 |
| RN-16 | Pueden incluir actividades, oportunidades, cursos externos, recursos, áreas de fortalecimiento y compañeros | 18.9 – 18.14 |
| RN-16 | **No son obligatorias y el estudiante conserva la decisión sobre su utilización** | 18.34 – 18.42 |
| RN-15 | Los resultados del motor y las recomendaciones son orientativos, no evaluativos | Sin nota ni aprobación; 18.47 |
| RN-23 | El docente accede solo a la información permitida de su contexto | RF18 no concede vista institucional; 18.53, 18.54 |

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
| 7 — Recomendaciones académicas ligeras | RF18 | 84 | **100 %** |
| **Avance total** | **7 de 10 objetivos · RF1 – RF18 de 25** | **577** | **70 %** |

---

## Alineación con el documento

**El software se alineó al documento.** La Tabla 2.27 se implementó paso por
paso, incluidos sus dos flujos alternativos, que son distintos entre sí y se
informan distinto.

**El documento debe alinearse al software** en seis puntos, detallados en
[`CORRECCIONES_DOCUMENTO_FINAL_70.md`](CORRECCIONES_DOCUMENTO_FINAL_70.md). El
único de fondo es la Figura 2.30, cuyo fragmento `alt` coloca el camino de éxito
bajo la etiqueta de fallo, el mismo error que ya tenía la Figura 2.29.

**Estas 6 correcciones, más las 17 del 40 %, las 6 del 50 % y las 5 del 60 %,
siguen pendientes de aplicar en el archivo Word.**
