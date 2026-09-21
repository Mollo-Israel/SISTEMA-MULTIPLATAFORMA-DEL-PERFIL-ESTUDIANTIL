# BATCH 4 — Actividades

> Reporte con el formato de §142 de `AFINIA_100_ESPECIFICACION_DEFINITIVA.md`.
> Rama: `feat/afinia-100`. `main` no se ha tocado.

**BATCH:** 4 — Actividades (§129)
**Estado:** Completado. 753 verificaciones automatizadas en verde, 0 fallos.

---

## Implementado

### 1. El docente vuelve a gestionar actividades, ahora acotado (§22)

§22 lo dice sin rodeos: *«Docente: actividades académicas dentro de su scope»*.
El sistema se lo había quitado en el Objetivo 3, con este comentario en el
código: «El docente ya no publica actividades: su rol es de consulta y
acompañamiento».

**No es una vuelta atrás.** Entonces se le retiró porque no existía forma de
delimitar su alcance, y ahora existe: los semestres habilitados que ya usan los
perfiles y los reportes. Lo que cambia es que ese alcance pasa a gobernar
también las actividades.

Un docente ahora:

- crea actividades académicas dirigidas a sus semestres;
- gestiona las que caigan dentro de ellos, las haya creado él u otro docente
  del mismo semestre;
- confirma la participación en las suyas.

Y no puede:

- dirigir una actividad a un semestre que no tiene habilitado —ni mezclando uno
  suyo con uno ajeno—;
- ampliar después el alcance de una actividad hasta abarcar semestres ajenos;
- gestionar una actividad de toda la carrera, que sigue siendo de la dirección;
- publicar extracurriculares, que son de la sociedad científica;
- hacer nada si no tiene ningún semestre habilitado.

Una decisión que merece explicarse: **una actividad sin alcance declarado es de
toda la carrera, y esas no las gestiona un docente**. Tratar «sin alcance» como
«alcanza a todos» convertiría el olvido de un campo en una vía para gestionar
actividades de cualquier semestre.

### 2. Máquina de estados explícita (§22)

La tabla de transiciones vive en `shared`, no repartida en condiciones por el
servicio. Así el ciclo de vida se lee de un vistazo, añadir un camino es
cambiar una línea, y web y móvil pueden ofrecer **solo** los cambios que
existen en vez de mostrar seis botones y dejar que el servidor rechace cinco.

```
DRAFT     → PUBLISHED, OPEN, CANCELLED
PUBLISHED → DRAFT, OPEN, CLOSED, FINISHED, CANCELLED
OPEN      → CLOSED, FINISHED, CANCELLED
CLOSED    → OPEN, FINISHED, CANCELLED
FINISHED  → (ninguno)
CANCELLED → (ninguno)
```

Las ausencias son tan deliberadas como las presencias. De `FINISHED` no se
sale: una actividad que ocurrió no deja de haber ocurrido, y su participación
confirmada ya alimentó perfiles. De `CANCELLED` tampoco: recuperarla sería
reabrir algo que se comunicó como cancelado; se crea otra.

`DRAFT → OPEN` sí existe porque publicar y abrir inscripciones a la vez es lo
que de verdad hace quien termina de redactar. No salta ningún control: `OPEN`
es estrictamente más visible que `PUBLISHED`.

Volver a `DRAFT` lleva además una condición que la tabla no puede expresar y
vive en el servicio: que nadie tenga aún participación confirmada.

### 3. Campos que §22 exigía y faltaban

`end_at`, `semester_scope[]`, `registration_mode`, `requirements` y
`responsible_user_id`.

El último no es redundante con `creator_id`: quien publicó una actividad puede
dejar el cargo, y la actividad sigue necesitando a alguien que confirme
participaciones. Los datos existentes se rellenaron con su creador, que es
quien venía respondiendo por ellas.

### 4. Habilidades por actividad (§73.3)

Hasta ahora una actividad solo declaraba su área, de modo que un taller de
React y uno de bases de datos aportaban lo mismo si caían en la misma área.
`activity_skills` permite que la participación diga **qué** se trabajó, no solo
dónde.

Es lo que declara quien organiza, no una medición: que una actividad trabaje
React no significa que quien asistió sepa React. Alimenta respaldo y
recomendaciones, nunca una autoevaluación ajena.

### 5. Participación: intención, inscripción y experiencia (§23)

§23 separa tres cosas que el sistema trataba casi igual:

```
INTERESTED → intención, no experiencia.
REGISTERED → inscripción, no experiencia.
CONFIRMED  → experiencia registrada.
```

El motor daba 1 punto por interés y 2 por inscripción. **Eso premiaba decir que
te interesa algo.** Ahora valen 0, que es lo que §51.2 fija explícitamente
—«Solo `CONFIRMED`»— y lo que §23 significa. Las señales se siguen registrando
con valor cero para que el desglose muestre que se tuvieron en cuenta.

Se añade `CANCELLED`: el estudiante puede darse de baja **antes** de que le
confirmen. Después no, porque ya es experiencia registrada y borrarla sería
falsear la trayectoria; si hubo un error, lo corrige el responsable marcando
ausencia.

Confirmar dispara lo que §23 enumera —trayectoria, afinidad, recomendaciones,
gamificación— y ahora también **auditoría**: es la decisión de una persona
sobre otra y debe quedar constancia de quién la tomó.

### 6. La constancia respalda, no duplica (§24, §55)

§55 pone el ejemplo textualmente:

> Participación confirmada + constancia → un evento de afinidad.
> La constancia aumenta respaldo.

El motor daba 3 puntos por la participación confirmada y **otros 3** por la
constancia que la respaldaba, sobre la misma área. La misma realidad contaba
dos veces por estar representada en dos tablas.

La constancia pasa a valer 0 puntos de afinidad. Sigue apareciendo en el
desglose —con su etiqueta cambiada a «respalda, no suma»— porque eso es
precisamente lo que la hace útil como trazabilidad.

También se corrigió una regla que había quedado desfasada: el servicio de
constancias exigía que la actividad la hubiera creado la dirección, lo que
dejaba sin constancia toda la participación en actividades de docente.

### 7. Interfaz

- **Web** — el selector de estado ofrece solo las transiciones que existen, y
  una actividad finalizada o cancelada muestra su estado sin poder editarlo.
  Nueva página «Mis actividades» para el docente. El listado del estudiante
  ahora conoce su propia inscripción, así que deja de ofrecer «Solicitar
  inscripción» a quien ya está inscrito y ofrece darse de baja.
- **Móvil** — misma baja voluntaria y el nuevo estado en el resumen.

---

## Migraciones

`api/src/database/migrations/1780310000000-Batch4Activities.ts`

**`up`**

- `cancelled` se añade al enum de inscripciones.
- `activities` gana `end_at`, `semester_scope`, `registration_mode`,
  `requirements` y `responsible_user_id`, este último rellenado con
  `creator_id` para las **353 actividades** existentes.
- Índice GIN sobre `semester_scope`, para preguntar «qué actividades alcanzan
  al semestre N» sin recorrer la tabla.
- `activity_skills`.
- Tres ponderaciones bajan a 0: `activity_interested`, `activity_registered`
  (§23) y `constancy` (§24, §55).

**`down`** revierte todo salvo el valor `cancelled` del enum: PostgreSQL no
permite retirar valores de un enum y recrearlo obligaría a reescribir la tabla.
Queda como valor en desuso, que es inofensivo, y así consta en la migración.

`synchronize` sigue en `false`.

---

## Archivos principales

**Contratos compartidos**
- `shared/src/enums/activity.enum.ts` — `ACTIVITY_TRANSITIONS`,
  `TERMINAL_ACTIVITY_STATUSES`, `canTransition`, `ACTIVITY_STATUS_LABEL`
- `shared/src/enums/registration.enum.ts` — `CANCELLED`, `RegistrationMode`,
  `EXPERIENCE_STATUSES`

**Entidades**
- `api/src/entities/activity-skill.entity.ts` *(nuevo)*
- `api/src/entities/activity.entity.ts`

**Modificados**
- `api/src/activities/activities.service.ts` — alcance del docente, máquina de
  estados, baja voluntaria, habilidades, auditoría
- `api/src/activities/activities.controller.ts`,
  `dto/create-activity.dto.ts`, `activities.module.ts`
- `api/src/affinity-recalc/affinity.engine.ts` — §23 y §55
- `api/src/constancies/constancies.service.ts` — el docente también gestiona
- `api/src/audit/audit.service.ts` — dos verbos nuevos

**Web**
- `web/src/pages/teacher/MyActivities.tsx` *(nuevo)*
- `web/src/components/ActivityManager.tsx`, `pages/student/Activities.tsx`,
  `pages/teacher/Activities.tsx`, `services/types.ts`, `services/index.ts`,
  `App.tsx`, `navigation.ts`

**Móvil**
- `mobile/src/screens/student/ActivitiesScreen.tsx`, `services/index.ts`

---

## Pruebas

| Suite | Comando | Verificaciones |
|---|---|---|
| Objetivos del 40 % | `npm run test:40` | 248 |
| Objetivo 5 | `npm run test:50` | 112 |
| Objetivo 6 | `npm run test:60` | 82 |
| Objetivo 7 | `npm run test:70` | 84 |
| BATCH 1 | `npm run test:b1` | 54 |
| BATCH 2 | `npm run test:b2` | 67 |
| BATCH 3 | `npm run test:b3` | 58 |
| **BATCH 4** *(nueva)* | `npm run test:b4` | **48** |
| | | **753** |

`scripts/e2e-batch-4.mjs` cubre:

- **§22 · gestores (B4.1–B4.13):** el docente crea en su semestre y queda como
  responsable; no puede salirse de su alcance ni mezclando semestres; no
  publica extracurriculares; sin semestres habilitados no gestiona nada; no
  toca actividades de toda la carrera ni de otros semestres; **otro docente del
  mismo semestre sí las gestiona**, porque el alcance es compartido; no puede
  ampliar el alcance después.
- **§22 · estados (B4.14–B4.21):** transiciones válidas, reapertura de
  inscripciones, rechazo de las que no existen con el motivo exacto, estados
  finales irreversibles y ventana de fechas coherente.
- **§73.3 · habilidades (B4.22–B4.26):** se declaran, se publican en el
  detalle, una inexistente se rechaza y el cambio reemplaza en vez de acumular.
- **§23 · participación (B4.27–B4.36):** interés e inscripción; baja voluntaria
  y reinscripción; solo el responsable confirma —ni un docente fuera del
  alcance ni el propio estudiante—; confirmar sí alimenta la afinidad; ya
  confirmada, el estudiante no puede borrar su experiencia; queda auditado con
  su autor.
- **§24 y §55 · constancias (B4.37–B4.43):** la constancia se vincula a la
  inscripción concreta, **no vuelve a sumar** lo que la participación ya
  aportó, pero sí aparece en el desglose con cero puntos, y el invariante de la
  suma se mantiene.
- **§23 · cero por intención (B4.44–B4.48):** en un área aislada, manifestar
  interés no mueve el puntaje, inscribirse tampoco, y confirmar sí.

**Una comprobación afirmaba lo contrario de §22.** `3.6 El docente NO publica
actividades -> 403` daba por buena la regla anterior. Se invirtió y se le
añadieron las dos que de verdad importan: que sí publica dentro de su alcance
(3.6) y que **no** puede salirse de él (3.6b, 3.6c).

**Dos comprobaciones pasaban en falso y se corrigieron.** Leían
`summary.affinity.areas`, que no existe —el campo es `affinities`—, de modo que
comparaban `0 === 0` sin comprobar nada. Una de ellas era B2.56 del BATCH 2,
que decía verificar que el área de mejora no suma. Ahora leen el dato real.

**Una prueba era intermitente y se estabilizó.** El worker de validación corre
solo cada pocos segundos, así que a veces se llevaba el trabajo justo antes de
que la prueba forzara su vuelta, y la lectura caía con el veredicto todavía en
`PROCESSING`. No era un fallo del sistema sino dos caminos hacia el mismo
resultado; la prueba ahora espera al resultado, no a quién lo produjo.
Verificado con tres ejecuciones seguidas.

**Una prueba era frágil por acumulación de datos.** La búsqueda de compañeros
devuelve 20 resultados como máximo, y la suite del Objetivo 7 creaba una
persona con el mismo apellido en cada pasada; a la vigesimoprimera, el
estudiante recién creado quedaba fuera del corte. Ahora el apellido lleva un
sufijo único por ejecución.

`npm run web:build` y `npx tsc --noEmit` en `mobile/` pasan sin errores.

---

## Resultados

- **753 verificaciones OK · 0 fallos.**
- Se cierra un doble conteo real: participación confirmada + constancia sumaban
  dos veces sobre la misma área.
- Se cierra otro: el interés y la inscripción puntuaban sin que hubiera
  experiencia.
- Las 353 actividades existentes conservan su responsable.
- `main` intacta. Nada se ha fusionado.

---

## Pendientes

Todo lo de §129 está cubierto. Lo que sigue pertenece a batches posteriores:

- **BATCH 5 (§130)** — proyectos: `project_member_skills`, contribución
  confirmada por el integrante, niveles de respaldo, GitHub, bitácora.
- **BATCH 6 (§131)** — afinidad V2 completa: pesos por prioridad, topes por
  área, rendimientos decrecientes, `SUPPORT_SCORE` y normalización sobre 60.
  Este batch ajustó tres ponderaciones porque §23, §24 y §55 lo exigen, pero
  el rebalanceo íntegro es de BATCH 6.

Una decisión consciente: `registration_mode` se almacena y se expone, pero la
aprobación previa que implica `APPROVAL` no cambia todavía el flujo de
inscripción. §22 pide el campo; el circuito de aprobación no está descrito en
ninguna sección, y no lo he inventado.

---

## Riesgos

1. **Un docente sin semestres habilitados no puede gestionar actividades.** Es
   correcto —sin alcance no hay nada que gestionar—, pero el mensaje debe ser
   claro para quien lo sufra: lo es, y le dice a quién pedirlo.
2. **Las actividades antiguas no tienen `semester_scope`.** Eso las convierte
   en actividades de carrera, que es lo que eran de hecho: las creó la
   dirección. Ningún docente las gestionará, y es el comportamiento correcto.
3. **Bajar `constancy` a 0 reduce puntajes ya calculados.** Un estudiante con
   constancias verá su afinidad bajar en el próximo recálculo. Es la
   corrección de un doble conteo, no una pérdida, pero conviene anticiparlo si
   alguien compara capturas de antes y después.
4. **El cambio en `activity_interested` y `activity_registered` es del mismo
   tipo.** Quien acumulaba puntos por marcar interés en muchas actividades verá
   una caída. Era exactamente lo que §23 quiere evitar.
