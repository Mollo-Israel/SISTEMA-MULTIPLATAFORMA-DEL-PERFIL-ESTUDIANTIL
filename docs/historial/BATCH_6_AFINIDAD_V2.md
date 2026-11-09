# BATCH 6 — Motor de Afinidad V2

**Especificación:** `AFINIA_100_ESPECIFICACION_DEFINITIVA.md` §48 a §57, §91, §131
**Rama:** `feat/afinia-100`
**Estado:** completo · 870 verificaciones automatizadas, 0 fallos

---

## 1. Qué pedía §131

> pesos; caps; diminishing returns; support score; support level; diversity
> rule; contributions; snapshots; recálculo. **Migrar datos existentes sin
> destruir historia.**

Los nueve puntos están implementados. La migración de datos es la parte que más
cuidado pidió y se explica en la sección 7.

---

## 2. El cambio de fondo: el puntaje pasa a significar otra cosa

Hasta aquí, la afinidad de un área era una suma de puntos sin techo, y su
*nivel* se calculaba comparándola con el área más fuerte **del propio
estudiante**. Eso tenía dos consecuencias que nadie quería:

- El área más fuerte de **cualquier** estudiante salía «alta», aunque su
  puntaje fuera mínimo. Un perfil recién empezado se veía igual de consolidado
  que uno de octavo semestre.
- Dos puntajes del mismo estudiante en fechas distintas no eran comparables: si
  el divisor cambia con el perfil, la pantalla de evolución miente.

§52 lo prohíbe en una línea: *«No normalizar solo contra el área más fuerte del
propio estudiante. Así el score puede compararse en el tiempo»*.

Ahora cada área tiene **dos** números que responden preguntas distintas (§49):

| | Pregunta que responde | Escala |
|---|---|---|
| `AFFINITY_SCORE` | ¿Qué tan relacionada está tu trayectoria con esta área? | 0–100 sobre un máximo teórico de 60 puntos |
| `SUPPORT_SCORE` | ¿Cuánta información trazable sostiene esa relación? | 0–100 |
| `SUPPORT_LEVEL` | Lectura cualitativa del anterior | LOW / MEDIUM / HIGH |

Se pueden tener a la vez afinidad alta y respaldo bajo. No es una
contradicción: es un estudiante que ha declarado mucho y todavía no ha podido
demostrarlo, y decirlo es más útil que esconderlo detrás de un único número.

---

## 3. Los pesos, tal como los fija §51

### §51.1 Preferencias — máximo 14 por área

| Señal | Puntos | Tope |
|---|---|---|
| Interés prioridad 1 → 5 | 5, 4, 3, 2, 1 | 10 |
| Habilidad básica / intermedia / avanzada | 0,5 / 1 / 1,5 | 4 |

La prioridad es información y ahora se usa: que alguien ponga un área en primer
lugar y otra en quinto dice algo, y tratarlas igual era desperdiciarlo.

La habilidad pesa poco a propósito. El nivel sigue siendo autodeclarado (§21.1)
y una autodeclaración no puede valer lo que una participación confirmada.

### §51.2 Actividades — máximo 10 por área

Solo `CONFIRMED`, +4 cada una, con rendimientos **100 % · 70 % · 50 % · 30 %**.
Cuatro actividades confirmadas dan exactamente 10, que es el tope: la escala y
el tope encajan sin sobras.

### §51.3 Proyectos — máximo 24 por área

| Nivel de respaldo | Puntos |
|---|---|
| DECLARED | 2 |
| SUPPORTED | 6 |
| CORROBORATED | 10 |
| REVIEWED | 12 |
| FLAGGED | 0 |

Rendimientos **100 % · 75 % · 50 % · 25 %** por proyecto independiente.

Ser el autor ya no vale más que ser integrante. Lo que vale es lo que se puede
comprobar, que es de lo que habla §36.

### §51.4 Certificados externos — máximo 12 por área

DECLARED 1, SUPPORTED 3, CORROBORATED 6, con la misma escala de rendimientos.

### §52 Normalización

```
máximo teórico = 14 + 10 + 24 + 12 = 60
AFFINITY_SCORE = round(min(100, RAW / 60 × 100))
```

---

## 4. El respaldo (§53) y la regla de diversidad (§54)

| Familia | Puntos | Tope |
|---|---|---|
| Participación confirmada | +8, con rendimientos | 20 |
| Constancia interna sobre esa participación | +4 | (misma familia) |
| Proyecto | 0 / 8 / 15 / 20 / 0 según nivel, con rendimientos | 45 |
| Certificado | 0 / 8 / 15 según nivel | 25 |
| Otros respaldos no contados antes | 3 a 5 | 10 |

Suman 100 exactos.

**Una lectura literal que conviene señalar:** §53.1 y §53.2 piden
explícitamente rendimientos decrecientes; §53.3 no los menciona. Se sigue la
letra —donde la especificación los pide, se aplican; donde calla, solo actúa el
tope—, en lugar de uniformarlo por estética.

### La regla de diversidad

`SUPPORT_LEVEL` sale de 0–24 LOW, 25–59 MEDIUM, 60–100 HIGH, **pero para HIGH
hacen falta señales de al menos dos familias independientes** entre ACTIVITY,
PROJECT, EXTERNAL_CERTIFICATE y ACADEMIC_REVIEW. Con una sola, el techo es
MEDIUM aunque el número bruto pase de 60.

**La decisión de diseño que hubo que tomar aquí.** Al principio cada señal
declaraba a mano qué familia acreditaba, y una constancia interna se marcaba
como ACADEMIC_REVIEW *además* de reforzar la familia de actividades. El
resultado era que una participación confirmada y su constancia —una sola
realidad, documentada dos veces— acreditaban dos familias independientes y
abrían la puerta a un respaldo alto. Eso es exactamente lo que §54 quiere
impedir y lo que §55 llama contar dos veces por estar en dos tablas.

La familia pasó a **derivarse** de la cubeta de respaldo a la que la señal
aporta de verdad. §53.1 manda la constancia a la cubeta de actividades, así que
lo que acredita es ACTIVITY. ACADEMIC_REVIEW queda para lo que §53.4 describe:
señales académicas que no estaban contadas en ningún otro sitio —una constancia
sin participación registrada, una retroalimentación docente sobre un proyecto
que no llegó a REVIEWED—. Con eso la regla tiene dientes.

Una señal acredita su familia aunque el tope ya estuviera lleno. Lo contrario
sería perverso: la cuarta actividad haría desaparecer una familia, y tener más
evidencia saldría perjudicado.

---

## 5. Lo que ya no suma, y por qué se sigue viendo

§50 excluye del cálculo las áreas de mejora, el simple interés en una actividad,
la inscripción sin participación y las evidencias repetidas. Todas se siguen
**registrando** con cero puntos y su motivo escrito, porque §91 pide dos listas:

```
¿Por qué?
+ Interés prioritario
+ 2 actividades confirmadas
+ Proyecto X corroborado

No contribuye:
- Área de mejora
- Actividad solo marcada como interesada
```

La segunda lista es la que de verdad orienta. La pregunta de un estudiante casi
nunca es «por qué tengo 60», sino «por qué no tengo más».

**Un hueco que apareció al probarlo.** El desglose solo se guardaba para las
áreas que entraban en el ranking. Eso dejaba mudo justo el caso en que más
preguntas surgen: un proyecto marcado por inconsistencia vale 0 (§51.3), su área
no entra en el ranking, y con el criterio anterior la explicación desaparecía
con ella. El estudiante veía que su proyecto no contaba y no tenía forma de
saber por qué. Ahora el desglose se guarda entero.

---

## 6. §57 · Recálculo: tres disparadores que faltaban

§57 enumera las señales que obligan a recalcular y exige hacerlo «al propietario
correcto de la señal». Tres no estaban conectadas:

1. **Cambio de nivel de respaldo de un proyecto.** §51.3 puntúa el proyecto
   según su nivel, así que cambiarlo cambia la afinidad de **todo el equipo**.
   Antes, un docente dejaba retroalimentación, el proyecto subía a REVIEWED y
   los puntajes seguían reflejando el nivel anterior hasta que alguien tocara
   otra cosa por casualidad. Ahora el cambio de nivel recalcula al creador y a
   todos los integrantes.

2. **Veredicto de validación.** Un certificado pasaba a CORROBORATED y el
   puntaje del estudiante seguía siendo el del nivel anterior. Ahora el
   veredicto recalcula a su dueño —el dueño del recurso, no quien pidió
   reprocesar, que pueden ser personas distintas—.

3. **Cambio de reglas.** `POST /affinity/recalculate-all` (solo ADMIN) recalcula
   el padrón completo. Sin esto, quien no volviera a entrar al sistema
   conservaría indefinidamente un puntaje calculado con la ponderación vieja.

### Un defecto de concurrencia que esto destapó

Persistir es «borrar y volver a insertar». Con los disparadores nuevos, dos
recálculos del mismo perfil se solapan de forma rutinaria: adjuntar un
certificado recalcula, y el veredicto del validador sobre ese mismo certificado
vuelve a hacerlo segundos después. Ambos borraban, ambos insertaban, y el
segundo chocaba contra `uq_affinity_result` con un error 500.

Se cierra con `pg_advisory_xact_lock` por perfil dentro de la transacción: se
libera solo al terminar, vive en la base y no en memoria —dos instancias de la
API se pisarían igual— y solo serializa el mismo perfil, así que dos estudiantes
distintos se siguen recalculando en paralelo.

---

## 7. §131 · Migrar sin destruir historia

La migración añade columnas, pero **no recalcula**: el cálculo vive en el motor
y reescribirlo en SQL sería tener dos versiones de la misma regla, que es como
empiezan las discrepancias que nadie sabe explicar.

- **Instantáneas históricas:** intactas, marcadas con `engine_version = 1`. Una
  gráfica de evolución puede así distinguir un cambio de escala de una caída
  real. Comparar un puntaje V1 con uno V2 sin mirar ese campo haría ver un
  desplome donde solo hubo un cambio de unidad.
- **Códigos de ponderación sustituidos** (`interest`, `project_owned`,
  `project_member`, `certificate`): no se borran, se desactivan. Hay
  contribuciones históricas que los referencian y borrarlos dejaría el desglose
  pasado sin sentido.
- **Puntajes vigentes:** los recalcula `AffinityBackfillService` al arrancar,
  solo para los perfiles que todavía llevan la versión anterior. Es idempotente
  y se agota solo. En esta base recalculó **339 perfiles en 9 segundos, 0
  errores**.
- **`down()` probado de verdad.** El primer intento falló: las explicaciones de
  V2 son más largas que el límite anterior de 200 caracteres y encoger la
  columna a secas revienta. Se recortan antes. `revert` y `run` se ejecutaron
  ida y vuelta sobre la base real.

### Dónde viven los pesos

§51 admite dos caminos: almacenarlos y versionarlos, o centralizarlos en la
configuración del motor. Se hacen los dos, cada uno donde sirve:

- Los **puntos base** viven en `affinity_weights`. Es lo único que un director
  podría querer ajustar, y ahí queda registrado y auditable sin desplegar.
- La **estructura** —topes, rendimientos, normalización, umbrales— vive en
  `shared/src/enums/affinity-engine.ts`. No es un parámetro: cambiarla cambia el
  significado del número, y eso debe pasar por una versión del motor, no por un
  `UPDATE`.

`GET /affinity/weights` publica las dos mitades. Mostrar solo los pesos daría
una explicación incompleta: el tope de un área cambia el resultado tanto como el
peso.

---

## 8. Lo que conviene saber

**Los niveles bajan, y es correcto.** Con la escala absoluta de §52, un perfil
con 5,5 de 60 puntos es honestamente bajo. Antes su área más fuerte salía
«alta» por el solo hecho de ser la primera. Habrá estudiantes que vean caer su
nivel sin haber hecho nada distinto; lo que cambió es que el número ahora
significa algo comparable.

**Un proyecto FLAGGED vale 0 hasta resolver la inconsistencia** (§51.3). El
proyecto no se elimina y el motivo aparece escrito en el desglose. En las
pruebas, un proyecto que declara un repositorio de GitHub inexistente se queda
en cero para todo su equipo: es duro, y es lo que la especificación manda.

**Las recomendaciones se tocaron lo mínimo.** La sugerencia de compañeros
filtraba por «nivel no bajo», que con la escala absoluta deja fuera a casi
cualquier estudiante de primeros semestres —justo a quienes más les sirve—. Se
sustituyó por «las áreas más fuertes de cada uno», que es lo que la regla quería
decir. El consumo completo de V2 en recomendaciones es §132, en el BATCH 7.

**§109 (`TrajectoryRecalculationService`) queda para el BATCH 7.** El puerto
`AFFINITY_RECALCULATION` ya es la indirección central que usa todo el sistema;
convertirlo en el coordinador que §109 describe tiene sentido cuando aparezca el
segundo consumidor —las recomendaciones—, no antes, para no dejar un cascarón
vacío.

---

## 9. Verificación

| Suite | Verificaciones |
|---|---|
| `e2e-objectives-40` | 248 |
| `e2e-objective-5` | 116 |
| `e2e-objective-6` | 86 |
| `e2e-objective-7` | 84 |
| `e2e-batch-1` | 54 |
| `e2e-batch-2` | 67 |
| `e2e-batch-3` | 58 |
| `e2e-batch-4` | 48 |
| `e2e-batch-5` | 49 |
| `e2e-batch-6` | 60 |
| **Total** | **870 · 0 fallos** |

`npm run web:build` y `npx tsc --noEmit` en `mobile/` pasan limpios.

### Comprobaciones que afirmaban la regla anterior

Se reescribieron, no se borraron. Donde la regla cambió de sentido, la
comprobación nueva demuestra además por qué la anterior no servía:

| Antes | Ahora |
|---|---|
| `17.8` Una habilidad avanzada aporta 3 puntos | Aporta 1,5: el nivel lo declaró el propio estudiante (§51.1) |
| `17.14` Una evidencia aporta 2 puntos | Una evidencia NO suma afinidad por sí sola (§50, §55) |
| `17.21` El área más fuerte tiene peso relativo 1 | Ya no se normaliza contra sí misma; el divisor es 60 para todos (§52) |
| `17.36` El área con más trayectoria queda en nivel alto | El nivel sale de los cortes absolutos de §54, no del ranking interno |
| `17.38` El peso relativo compara con la más fuerte del perfil | Ese campo desapareció del contrato (§52) |
| `B4.43` La suma del desglose es el puntaje del área | Es el puntaje **crudo** del área (§52) |
| `B5.23` La evidencia sube la afinidad de quien la aportó | Figura en **su** desglose y no en el del creador (§35), sin sumar (§55) |
| `15.28c` Confirmada, el proyecto alimenta su afinidad | El proyecto está FLAGGED y vale 0, con el motivo visible (§51.3) |

---

## 10. Siguiente

**BATCH 7 (§132)** — recomendaciones que consuman V2: actividades,
fortalecimiento, recursos, compañeros y razones, más el
`TrajectoryRecalculationService` de §109.
