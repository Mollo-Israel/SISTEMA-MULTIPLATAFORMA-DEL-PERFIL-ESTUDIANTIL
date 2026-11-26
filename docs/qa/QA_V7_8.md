# Informe BATCH V7-8 — Afinidad, respaldos y recomendador explicados

Formato del contrato V7.1 §17.

## BATCH / rama / commit base / commit resultante

V7-8 · `feature/afinia-v7-cierre-final`. Base: `c20eacb` (V7-7). El commit resultante es el que contiene este informe.

## Requisitos y páginas

- **Contrato:** §9 (perfil: tecnologías respaldadas y explicación de afinidad) y §10 (recomendador), pp. 17–20 y 24. Trazabilidad 17, 18 y 19.
- **Matriz:** M01–M09.
- **Hallazgos GAP:** PERF-02, 03, 05, 07 y 08; REC-01 a REC-04. PERF-01 y PERF-04 ya se cerraron en V7-2 (D04) y la parte de credenciales de PERF-02 en V7-4 (D01).

## Decisiones Dxx confirmadas

- **D06 (límite):** no se cambió ningún peso, tope, escala ni la fórmula del ranking. Se documentó la fórmula **real** con ejemplos ejecutados y se reportan los defectos del ranking para decisión (REC-H1 a REC-H4).
- **D04 / D01:** la elegibilidad de las tecnologías respaldadas se alinea con la que ya usa la afinidad. No cambia la afinidad ni sus snapshots, así que no hace falta recalcular.

## Estado previo y reproducción

Contra V7-7 (`c20eacb`), en la API y la web aisladas:

| Escenario | Antes (V7-7) |
|---|---|
| PERF-05 | «Cómo se calcula» abría directamente la tabla técnica «Ponderaciones del motor» (buscador, códigos, señales de 0 puntos). No había explicación en palabras ni ejemplos |
| PERF-08 | Vista docente › Estudiantes: «Área · prioridad 1» |
| PERF-07 | El chip de tecnología respaldada solo mostraba «Tecnología · N»; la procedencia estaba en un `title` que rotulaba «actividad» también a las credenciales |
| §10.1 móvil | El selector de intereses del móvil ofrecía «1 2 3 4 5» y el texto decía «Prioridad de 1 a 5» |
| PERF-03 | Un chip de proyecto salía de cualquier tecnología marcada por el integrante, aunque el proyecto fuera borrador o la tecnología no tuviera ninguna señal técnica |
| PERF-02 / M08 | Una credencial con respaldo solo automático (`supported`) daba chips aunque no sumara afinidad |

`e2e-v7-web.mjs batch8` contra la web de V7-7: **3 / 7** (fallan W7.8.1, W7.8.2, W7.8.5 con «Webafarea … · prioridad 1» y W7.8.7).

## Ya estaba correcto (sin cambios)

- **M04 / REC-01:** favoritos, guardar, clics e inscripción no intervienen en el ranking (`ranking.feedback = 0`) ni en la afinidad.
- **M01 / REC-02:** las tres intensidades ya ordenaban: 40 / 32 / 24.
- **M06 y M07:** rendimiento decreciente, tope de 25 por actividades y recálculo con auditoría al corregir.
- **M02 / M03:** con solo una tecnología de interés, o solo una de mejora, se recomienda y la razón la nombra.
- Sin preferencias declaradas no se recomienda ninguna actividad: no se inventan intereses.
- **PERF-06:** las tecnologías respaldadas no se editan a mano.

## Cambios exactos y archivos

**API**
- `backed-skills/backed-skills.service.ts`:
  - proyecto: exige que no sea borrador y que esa tecnología tenga señal técnica **en ese proyecto** (`project_skills.evidence_status <> 'declared'`), además de la contribución confirmada (PERF-03);
  - credencial: solo `corroborated` y sin revisión pendiente, observada ni rechazada, la misma regla con la que suma afinidad (PERF-02, M08).

**Web**
- `components/ComoSeCalculaAfinidad.tsx` (nuevo): qué es la afinidad, qué la sube con los números reales del motor, qué no la cambia, cuándo puede bajar, qué significa el tope y ejemplos con las áreas propias del estudiante.
- `student/Affinity.tsx`: la pestaña «Cómo se calcula» muestra primero esa explicación; la tabla técnica queda en «Detalle técnico del motor», cerrado (PERF-05).
- `teacher/Students.tsx`: «mucho / bastante / un poco» en lugar de «prioridad N» (PERF-08).
- `student/Profile.tsx` y `services/types.ts`: cada chip dice «relacionada con tu proyecto / tu participación en una actividad / una credencial aprobada» (PERF-07). El texto de la tarjeta explica que no indica dominio.
- `index.css`: estilos de la explicación y del detalle plegable.

**Móvil**
- `components/PriorityPicker.tsx`: tres intensidades con nombre (Mucho, Bastante, Un poco), igual que la web. Por dentro siguen siendo las prioridades 1, 3 y 5, así que el orden no cambia; una prioridad heredada 2 o 4 se muestra en la intensidad más cercana.
- `screens/student/InterestsScreen.tsx`: textos «con interés» en lugar de «con prioridad».

**Documentación**
- `docs/AFINIDAD_Y_RECOMENDADOR_V7.md` (nuevo): fórmula real de la afinidad y del ranking, con nombres de variables, escalas, topes, redondeo y desempate; ejemplos ejecutados; hallazgos para decisión; diferencias con la propuesta §10.3 (no implementada).

**Pruebas**
- `scripts/e2e-v7.mjs batch8`: 9 comprobaciones y la observación M05.
- `scripts/e2e-v7-web.mjs batch8`: 7 comprobaciones.

## Migraciones / datos preservados / compatibilidad web-móvil

- Sin migraciones y sin cambios de datos. Las tecnologías respaldadas se calculan al leer: el cambio afecta solo a lo que se muestra.
- Impacto medido en la base de **desarrollo** (consulta de solo lectura): los chips de proyecto pasan de 1.210 a 677. Se quitan 406 solo declarados sin señal técnica, 75 en borradores y 52 de tecnologías que no figuran en el proyecto. Los de credenciales siguen en 74.
- Nota: la consulta de credenciales compara con el valor `observed`, que agrega la migración `1780910000000` (V7-4). La base de desarrollo debe migrarse antes de usar este código, como ya estaba pendiente.
- Web y móvil usan los mismos nombres de intensidad y el mismo mapeo 1/3/5.

## Pruebas ejecutadas (comando, resultado, evidencia)

| Comando | Resultado |
|---|---|
| `e2e-v7-web.mjs batch8` contra la web de V7-7 | 3 / 7 (reproducción de PERF-05, 07 y 08) |
| `e2e-v7.mjs batch8` | **9 / 9** + observación M05 |
| `e2e-v7-web.mjs batch8` | **7 / 7** |
| Consulta de impacto `impacto-chips.sql` (solo lectura, desarrollo y prueba) | ver arriba |

Valores ejecutados del motor real:

| Prueba | Resultado |
|---|---|
| V7.8.1 M06 | 10 → 17 → 22 → 25 → 25 |
| V7.8.2 M07 | 17 → 10 al corregir a «ausente», con `PARTICIPATION_CORRECTED` |
| V7.8.4 / V7.8.6 M01 | Mucho 40 · Bastante 32 · Un poco 24; cambiar a «Mucho» lleva 24 → 40 |
| V7.8.5 M02 | solo tecnología de interés vinculada: 15 |
| M05 (observación) | área confirmada desde el test: **50 = 40 + 10** |

## PASS / FAIL / BLOCKED / NE

| Escenario | Resultado | Evidencia |
|---|---|---|
| M01 Mucho / Bastante / Un poco | **PASS** con la fórmula real (40 / 32 / 24). Difiere de §10.3, que no está aprobada | V7.8.4, V7.8.6 |
| M02 Solo tecnología de interés | **PASS** | V7.8.5 |
| M03 Solo mejora | **PASS**. La razón se ve solo en las recomendaciones propias | V7.8.5 |
| M04 Favorito / clic repetido | **PASS** | V7.8.3 |
| M05 Interés del test ya confirmado | **BLOCKED (D06)**: hay doble conteo (40 + 10). Se reporta como REC-H1 con propuesta; cambiar la fórmula requiere aprobación | observación de batch8 |
| M06 Afinidad al tope | **PASS** (explicación de saturación, no dominio) | V7.8.1, W7.8.1 |
| M07 Corregir respaldo | **PASS** | V7.8.2 |
| M08 Tecnologías respaldadas | **PASS** | V7.8.8, W7.8.7, consulta de impacto |
| M09 Actividad sin tecnología | **PASS** | V7.8.9 |
| PERF-05 | **PASS** | W7.8.1, W7.8.2 |
| PERF-07 | **PASS** | W7.8.7 |
| PERF-08 | **PASS** | W7.8.5 |

## Regresiones verificadas

Corrida limpia (base reconstruida) con la API y la web de V7-8, sin fallas nuevas:
- `e2e-v7` **107 / 0** · `e2e-v6` **98 / 0** · `e2e-v5` **135 / 0** · `e2e-v2` **162 / 0** · `e2e-qa` **68 / 0**.
- `e2e-v4-1` 171 / 2 (V41.10.1–2, previas) · `e2e-v3` 378 / 1 (V3.2.15, previa) · `e2e-v3-2` 197 / 10 (las mismas 10 de V7-7).
- Objetivos 5, 6, 7 y 40, y `batch-1…11`: sin fallas, salvo B6.47 (previa).
- Jest **197 / 197** · unitarias **224 / 224**.
- Web: `e2e-web` **106 / 0** · `e2e-v6-web` **63 / 0** · `e2e-v7-web` **48 / 0** · `e2e-web-gestion` **47 / 0**.
- `tsc` sin errores en API, web y móvil.

Prueba adaptada al cambio de contrato: `e2e-v2` V2.7.5 forzaba `supported` y esperaba el chip. Ahora comprueba que con `supported` **no** aparece y con `corroborated` sí (M08).

## Riesgos o limitaciones

- La explicación de la web cita los números del motor 7 en el texto. Si una versión futura cambia pesos (con D06), hay que actualizar ese componente. `e2e-v7-web` W7.8.1 lo detecta.
- La parte de proyecto de M08 se prueba con la consulta de impacto y la revisión del SQL, no con un proyecto armado de punta a punta en batch8 (un proyecto corroborado necesita el simulador de GitHub). Las suites de regresión que cubren tecnologías respaldadas (`e2e-v2`, `e2e-v3`, objetivos y batches) pasan con la regla nueva.

## Pendientes y siguiente batch propuesto

- **Decisiones del usuario (D06):**
  - REC-H1: quitar o redistribuir el +10 de orientación (M05);
  - REC-H2: coincidir tecnologías por frase completa o por ID;
  - REC-H3: corregir el comentario del 10 % de contexto;
  - adoptar o no la propuesta §10.3.
- **Siguen pendientes:** migrar la base de desarrollo; autorizar o no el recálculo D04.
- **Siguiente batch: V7-9.**
