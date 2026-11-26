# Afinidad y recomendador — fórmula real (V7.1, batch V7-8)

Documento técnico para la defensa. Describe **lo que el código ejecuta hoy** (motor de afinidad
versión 7, reglas del recomendador en `api/src/recommendations/recommendation.rules.ts`), no la
propuesta ilustrativa de §10.3 del contrato. Cada número citado se comprobó con fixtures en
`scripts/e2e-v7.mjs batch8` contra la API real.

D06: en este batch **no se cambió ningún peso, tope ni fórmula**. Solo se corrigió la presentación
y se documentaron los hallazgos para decisión.

---

## 1. Afinidad por área

Fuentes: `shared/src/enums/affinity-engine.ts` (constantes) y `api/src/affinity-recalc/affinity.engine.ts`
(cálculo). `AFFINITY_ENGINE_VERSION = 7`.

### 1.1 Qué suma

| Familia | Señal elegible | Puntos base | Rendimiento decreciente (orden: de mayor a menor base) | Tope por área |
|---|---|---|---|---|
| Actividades | Participación **confirmada** en actividad cuyo resultado no es «Sin resultado» (D04, `cuentaComoTrayectoria`) | 10 | ×1 · ×0,7 · ×0,5 · ×0,3 (y ×0,3 desde la cuarta) | 25 |
| Proyectos | Proyecto **corroborado** por repositorio | 18 | ×1 · ×0,75 · ×0,5 · ×0,25 | 50 |
| | Proyecto **revisado** por docente | 22 | (misma escala) | |
| | Proyecto solo declarado, «con respaldo» sin corroborar o marcado | 0 | — | |
| Credenciales externas | Credencial **corroborada** cuya revisión de Dirección no está pendiente, observada ni rechazada (D01, `credencialCuenta`) | 15 | ×1 · ×0,75 · ×0,5 · ×0,25 | 25 |
| | Credencial declarada, «con respaldo» sin prueba externa o marcada | 0 | — | |

```
afinidad(área) = round( min(100, Σ_familias min(tope_familia, Σ_i redondear2(base_i × factor_i))) )
```

- Cada aporte se redondea a 2 decimales antes de acumular; el total se redondea a entero.
- Si un aporte no cabe entero bajo el tope, entra la parte que cabe y la señal queda anotada
  «tope del área alcanzado».
- Niveles (misma escala que el respaldo): 0–24 baja, 25–59 media, 60–100 alta.
- La afinidad no se compara con el área más fuerte del propio estudiante.

### 1.2 Qué no suma (se explica, pero aporta 0)

Áreas de interés, áreas a mejorar y tecnologías declaradas (topes `PREFERENCE/INTEREST/SKILL = 0`);
inscripción sin asistencia confirmada; «Me interesa» de actividad; favoritos y guardados; constancias
internas (respaldan la participación ya contada, no la vuelven a contar); evidencias de proyecto
(mejoran el respaldo, no crean otro proyecto).

### 1.3 Cuándo baja

Solo cuando cambia un dato que la sustenta: corrección de participación, rechazo/observación de
una credencial, cambio de clasificación o de área de una actividad, revocación de evidencia, o
nueva versión de reglas. **No existe decaimiento temporal**: no baja por inactividad. El cambio
recalcula con las mismas reglas y queda auditado.

### 1.4 Ejemplos ejecutados (batch8)

| Prueba | Caso | Resultado del motor |
|---|---|---|
| V7.8.1 (M06) | 1, 2, 3, 4 y 5 asistencias confirmadas en la misma área | 10 → 17 → 22 → 25 → 25 |
| V7.8.2 (M07) | 2 asistencias; Dirección corrige una a «ausente» con motivo | 17 → 10, evento `PARTICIPATION_CORRECTED` registrado |
| V7.8.3 (M04) | Marcar/desmarcar favorita 10 veces | Afinidad 25 sin cambio; orden de recomendaciones idéntico |

Cálculo del segundo valor: 10×1 + 10×0,7 = 17. Cuarto: 10 + 7 + 5 + 3 = 25 (tope). Quinto: el tope
ya está alcanzado, aporta 0.

### 1.5 Elegibilidad afectada por V7-4 y V7-5

- **V7-4 (D01):** una credencial externa con revisión `requested`, `observed` o `rejected` aporta 0
  de afinidad y 0 de respaldo; la máquina ya no corrobora mientras la revisión está pendiente. Esto
  motivó subir el motor a versión 7. Los snapshots existentes no se reescribieron: el recálculo
  masivo sigue pendiente de autorización (D04).
- **V7-5:** el certificado institucional (general o individual) se entrega al cerrar la actividad;
  no es una señal nueva de afinidad. La participación confirmada que respalda ya se contó una vez.

### 1.6 Tecnologías respaldadas del perfil (`backed-skills.service.ts`)

No se editan a mano. Desde V7-8 usan la **misma elegibilidad que la afinidad**:

| Fuente | Entra si… | Chip |
|---|---|---|
| Proyecto | contribución del integrante confirmada · proyecto con respaldo y **no borrador** · esa tecnología tiene **señal técnica en ese proyecto** (lenguaje o manifiesto del repositorio, o revisión docente) | «relacionada con tu proyecto» |
| Actividad | participación confirmada · resultado distinto de «Sin resultado» · la actividad declara esa tecnología | «relacionada con tu participación en una actividad» |
| Credencial externa | `corroborated` y revisión de Dirección no pendiente, observada ni rechazada | «relacionada con una credencial aprobada» |

Una actividad sin tecnología no crea ninguna (M09). Se deduplica por tecnología y se conservan
todas sus procedencias.

Impacto medido en la base de desarrollo (solo lectura; no se modificó ningún dato): los chips de
proyecto pasan de 1.210 a 677 pares estudiante-tecnología (406 solo declarados sin señal técnica,
75 en borradores, 52 tecnologías que no están en el proyecto); los de credenciales no cambian (74).

---

## 2. Recomendador de actividades, oportunidades y recursos

Fuente: `recommendations.engine.ts` (`scoreElement`, `puntuarIntereses`, `puntuarTecnologias`,
`activityContext`, `limitByType`).

### 2.1 Filtros previos (no puntúan)

Actividad publicada y abierta, fecha no pasada, con cupo confirmable, dirigida a su semestre, en la
que el estudiante aún no participa. Los cursos y recursos de apoyo salen del catálogo de recursos,
no de actividades.

### 2.2 Puntaje (0–95 alcanzable)

Cada componente tiene un techo; las señales de un mismo componente lo comparten (la segunda solo
llena lo que dejó la primera).

| Componente | Techo | Señal | Factor |
|---|---|---|---|
| Interés explícito | 40 | Área declarada · «Mucho» (prioridad 1) | 1,0 → 40 |
| | | «Bastante» (prioridad 3) | 0,8 → 32 |
| | | «Un poco» (prioridad 5) | 0,6 → 24 |
| | | (prioridades heredadas 2 y 4) | 0,9 / 0,7 |
| | | Interés en texto libre que aparece en el texto del elemento | 0,5 |
| Área a mejorar | 30 | El área del elemento es una de sus áreas a mejorar | 1,0 |
| Tecnologías | 15 | Tecnología de interés o de mejora **vinculada** al elemento (por ID) | 1,0 |
| | | Tecnología que solo aparece en el texto | 0,4 |
| Orientación confirmada | 10 | El área viene del test de orientación y el estudiante la confirmó | 1,0 |
| Contexto | 0 | Fecha próxima, semestre, modalidad, disponibilidad | solo explica («Encaja con tu contexto…») |

- Si un elemento toca varias áreas, cuenta la que mejor puntúa.
- Sin ninguna señal declarada el elemento no se recomienda; por debajo de 10 tampoco.
- Orden: puntaje descendente; empate por fecha del evento (la más próxima primero) y luego título.
- Máximo por grupo: 8 actividades, 5 oportunidades, 5 cursos, 5 recursos.
- Favoritos, guardados, clics, inscripciones, «Me interesa» de actividad y puntos **no** intervienen
  (`ranking.feedback = 0`, V6 §9).
- La afinidad **no** es un factor del ranking: se recomienda lo que la persona quiere explorar o
  mejorar, no lo que ya hizo.

### 2.3 Ejemplos ejecutados (batch8)

| Prueba | Caso | Resultado |
|---|---|---|
| V7.8.4 / V7.8.6 (M01) | Tres talleres de tres áreas con Mucho / Bastante / Un poco | 40 / 32 / 24, en ese orden; razones «Coincide con tus intereses: …», sin «prioridad» |
| V7.8.6 | Cambiar «Un poco» por «Mucho» | el mismo taller pasa de 24 a 40 |
| V7.8.5 (M02/M03) | Solo tecnología de interés vinculada | 15 («Coincide con tus intereses: trabaja …») |
| | Solo tecnología de mejora vinculada | aparece con «Coincide con lo que quieres mejorar: trabaja …» |
| V7.8.7 | Estudiante sin ninguna declaración | ninguna actividad recomendada |
| V7.8.3 (M04) | 10 veces favorito | orden idéntico |

Por qué dos áreas pueden recomendarse a la vez y cuál va primero: ambas superan el mínimo de 10; la
de mayor intensidad declarada aporta más al componente de interés (40 frente a 24) y queda arriba.

---

## 3. Hallazgos para decisión (D06 — no se cambió la fórmula)

| ID | Hallazgo | Evidencia | Propuesta |
|---|---|---|---|
| REC-H1 | **Doble conteo del test de orientación.** Un área confirmada desde el test se guarda como interés declarado (fuente `onboarding`) y recibe el componente de interés (hasta 40) **y además** +10 de «orientación confirmada». §10.1 pide no sumar dos veces el mismo interés por venir del test y del perfil. | `engine.ts`: `orientationAreas = preferredRows.filter(source === ONBOARDING)`; `scoreElement` suma ambos. Ejecutado en batch8 (M05): un taller del área confirmada desde el test puntúa **50 = 40 + 10** | Eliminar el +10 o redistribuirlo, con nueva versión de reglas y comparación antes/después. Requiere aprobación. |
| REC-H2 | **Coincidencia de tecnología por una sola palabra.** Una tecnología de nombre compuesto coincide con cualquier elemento cuyo texto contenga *una* de sus palabras (≥3 letras), p. ej. «Uno». Genera razones «trabaja X» con 6 puntos que no corresponden. | Fixtures de batch8: «Taller de mucho …» recibió `skill_match: 6` de una tecnología sin relación por compartir un token | Coincidir por frase completa o solo por ID vinculado; alias exactos del catálogo. Requiere aprobación. |
| REC-H3 | **El 10 % de contexto no suma.** Los comentarios de reglas hablan del «10 % de disponibilidad/contexto» de §60, pero desde V3 §34 el contexto es filtro duro + explicación (0 puntos). El máximo real es 95. | `scoreElement`: `CONTEXT_MATCH` con `points: 0` | Solo documental: corregir el comentario o redistribuir con aprobación. |
| REC-H4 | Interés y mejora de **tecnologías comparten** el techo de 15: una coincidencia por texto de interés (6) deja solo 9 para una tecnología de mejora vinculada. | Fixture «Laboratorio con tecnología dos»: 6 + 9 = 15 | Coherente con «cada coincidencia cuenta una vez por grupo»; se informa para la defensa. |

### Diferencias con la propuesta §10.3 (no implementada)

| | Real (v7) | Propuesta §10.3 |
|---|---|---|
| Interés de área | 40 × {1; 0,8; 0,6} | 40 × {1; 2/3; 1/3} |
| Mejora de área | 30 | 20 |
| Tecnologías | 15 compartidos entre interés y mejora | 25 interés + 15 mejora, separados |
| Orientación | +10 adicional | se incorpora a los cuatro inputs, sin sumar otra vez |
| Texto libre | factor 0,5 dentro de interés | no contemplado (solo IDs) |

---

## 4. Cambios de este batch

- API, tecnologías respaldadas: la elegibilidad de §1.6 (PERF-02, PERF-03, M08). No toca la
  afinidad, los snapshots ni los pesos.
- Web, perfil: cada chip dice su procedencia real («relacionada con …»); antes una credencial se
  rotulaba «actividad» (PERF-07).

- Web, Afinidad › «Cómo se calcula»: explicación en palabras (qué suma con los números reales, qué
  no, cuándo baja, qué significa el tope y ejemplos con las áreas propias). Las ponderaciones del
  motor quedan en «Detalle técnico del motor», cerrado.
- Web, docente › Estudiantes: el interés se muestra como «mucho / bastante / un poco», no
  «prioridad N».
- Móvil, Intereses: selector de tres intensidades con nombre (Mucho, Bastante, Un poco), igual que
  la web; por dentro siguen siendo las prioridades 1, 3 y 5 y el ranking no cambia.
