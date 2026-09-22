# BATCH 7 — Recomendaciones

**Especificación:** `AFINIA_100_ESPECIFICACION_DEFINITIVA.md` §58 a §62, §92, §109, §132
**Rama:** `feat/afinia-100`
**Estado:** completo · 932 verificaciones automatizadas, 0 fallos

---

## 1. Qué pedía §132

> Actualizar para consumir V2. Implementar actividades, fortalecimiento,
> recursos, teammates y razones.

Todo está implementado, más el `TrajectoryRecalculationService` de §109 que el
BATCH 6 dejó pendiente a propósito hasta que existiera un segundo consumidor.

---

## 2. El puntaje pasa a significar «cuánto encaja»

Antes, una recomendación sumaba puntos sueltos sin techo: 7, 9, 12. Eso servía
para ordenar la lista y para nada más. Dos recomendaciones de 7 y 9 no decían
nada sobre cuánto encajaba cada una con el estudiante.

§60 fija el reparto y ahora es literal:

| Componente | Peso | Cómo se calcula |
|---|---|---|
| Afinidad con el área | **50 %** | Proporcional al `AFFINITY_SCORE` de V2 sobre 100 |
| Interés explícito | **20 %** | Entero con prioridad 1, 60 % de él con prioridad 5 |
| Coincide con un área de mejora | **20 %** | Entero o nada |
| Disponibilidad y contexto | **10 %** | Fecha, semestre, modalidad, disponibilidad declarada |

El resultado vive entre 0 y 100, y la suma de los motivos es exactamente el
puntaje: si no cuadrara, la explicación sería falsa.

**Un detalle que hubo que resolver.** El interés puede llegar por tres caminos
—el área declarada con su prioridad, un interés escrito a mano, una habilidad—
y los tres son «interés explícito». Sumarlos por separado habría superado el
20 % que §60 concede. Comparten el presupuesto: cada uno aporta lo que quepa en
lo que queda, y su motivo lleva lo que aportó **de verdad**, no lo que la regla
le concedería en el vacío.

---

## 3. §59 · Con la misma afinidad, lo que conviene cambia

Esta es la regla que el motor anterior no tenía en absoluto.

- **Afinidad con respaldo bajo** → el estudiante sabe hacia dónde va y todavía
  no puede demostrarlo. Se priorizan talleres, retos, prácticas y herramientas:
  lo que deja algo que pueda respaldarse después.
- **Afinidad con respaldo ya construido** → ya lo demostró. Recomendarle una
  introducción sería hacerle perder el tiempo; se priorizan convocatorias,
  hackathones, retos e investigación.

§60 llama a su reparto «ranking **inicial**», así que el régimen actúa después,
con un refuerzo de 15 puntos y un motivo que lo dice con todas las letras. No
penaliza: un elemento que no encaja simplemente no lo recibe, de modo que nada
desaparece de la lista por esto — solo cambia el orden.

El régimen se decide sobre las áreas más fuertes **del propio estudiante**, no
sobre un umbral absoluto. Con el nivel absoluto de V2, casi nadie en primeros
semestres supera 25 sobre 100, y ningún régimen se activaría nunca para quien
más lo necesita.

---

## 4. §61 · El catálogo controlado

> No recomendar URLs arbitrarias obtenidas automáticamente de Internet. Usar
> catálogo controlado.

Hasta aquí, los recursos y los cursos externos eran **actividades** con una
categoría especial. Nunca encajaron: un recurso no tiene fecha, ni cupo, ni
inscripción, ni participación que confirmar. Los 71 que había en la base no
acumulaban una sola inscripción, que es la prueba de que nadie los trataba como
actividades.

Ahora viven en `learning_resources`, con los campos que §61 enumera: `title`,
`provider`, `url`, `academic_area_id`, `skills[]`, `resource_type`, `status` y
`created_by`. Ese último es el que separa un catálogo curado de una lista de
enlaces: un recurso está ahí porque una persona concreta de la carrera decidió
incluirlo, y queda registrado quién fue.

- **Escribe solo la dirección de carrera.** Un docente recibe 403, igual que un
  estudiante: §61 pide un catálogo *controlado*.
- **Solo http y https.** Un catálogo que aceptara `javascript:` sería una forma
  elegante de servir enlaces peligrosos desde una pantalla en la que el
  estudiante confía.
- **Retirar no es borrar.** Un recurso inactivo deja de recomendarse y se
  conserva, porque una recomendación de hace meses tiene que seguir pudiendo
  explicar a qué apuntaba.
- **Pantalla incluida.** Sin ella, §61 existiría solo como API y el catálogo se
  quedaría con lo que trajo la migración.

**Sobre las 71 actividades originales:** la migración las **copia**, no las
toca. Quien dirija la carrera decidirá qué hacer con ellas; esta migración no
toma esa decisión por nadie. Lo que sí hace el motor es dejar de tratarlas como
actividades, para no recomendar lo mismo dos veces por dos caminos.

---

## 5. §62 · Compañeros: primero lo que falta

§62 fija un orden de prioridad y el motor lo respeta:

1. **Habilidades faltantes** — el compañero declara algo que el estudiante no,
   en un área que a él le importa. Vale más que compartir área: un equipo se
   forma por lo que le falta, no por lo que ya tiene repetido.
2. **Respaldo relacionado** — tiene trayectoria respaldada en un área común.
3. **Afinidad contextual** — comparten área fuerte.
4. **Disponibilidad** — declaró que busca equipo o que escucha propuestas.
5. **Visibilidad y consentimiento** — quien desactivó aparecer en sugerencias no
   aparece, y nunca se muestra su correo ni su puntaje.

La disponibilidad por sí sola no basta: sin una de las tres primeras razones, no
hay sugerencia.

---

## 6. §109 · Recomputación centralizada

El BATCH 6 dejó esto fuera a propósito: un coordinador con un solo coordinado es
un cascarón. Ahora hay dos.

`TrajectoryRecalculationService` es el único punto de entrada para decir «a este
estudiante le cambió algo relevante». Recalcula la afinidad y después invalida
sus recomendaciones. Los diecisiete puntos del sistema que antes llamaban al
motor de afinidad ahora llaman al coordinador, y el punto de enganche de la
gamificación (§66, BATCH 9) es una línea, no un recorrido por todo el código.

El token pasó de `AFFINITY_RECALCULATION` a `TRAJECTORY_RECALCULATION`. Nombraba
solo la mitad de lo que hace desde que las recomendaciones también dependen del
cálculo, y de los nombres que mienten salen los errores que nadie encuentra.

**Por qué invalida en vez de regenerar.** Regenerar aquí obligaría a recorrer el
catálogo entero de actividades y recursos en medio de la transacción de quien
acaba de subir un certificado. Marcarlas como no vigentes es barato, y la
siguiente consulta las recalcula con datos frescos. Lo que el estudiante decidió
—guardada, descartada— no se toca: es suyo y sobrevive a cualquier recálculo
(RN-16).

---

## 7. Un defecto que las pruebas destaparon

El comparador de texto aceptaba tokens puramente numéricos. Un año, un código o
un identificador que apareciera a la vez en un interés y en el título de una
actividad producía una coincidencia — y una recomendación que no se podía
explicar a quien preguntara por qué se la habían hecho. Los números sueltos ya
no cuentan como coincidencia.

---

## 8. Lo que conviene saber

**Las recomendaciones de recursos cambian de origen.** Un estudiante que tuviera
guardado un «curso externo» que en realidad era una actividad seguirá viéndolo
en su historial; la recomendación vigente apunta ahora a la entrada equivalente
del catálogo.

**El catálogo arranca con 71 entradas** heredadas de las actividades
convertidas, todas con proveedor «Catálogo de la carrera». Conviene revisarlas y
asignarles el proveedor real y sus habilidades desde la pantalla nueva.

**Las necesidades de equipo de §58 no se consumen todavía.** La tabla
`team_needs` es §73.6 y la crea el BATCH 8; el motor consume hoy todo lo demás
que §58 enumera —afinidad, respaldo, intereses, áreas de mejora, actividades
abiertas, recursos y disponibilidad—. Enganchar las necesidades de equipo es una
línea cuando la tabla exista.

---

## 9. Verificación

| Suite | Verificaciones |
|---|---|
| `e2e-objectives-40` | 248 |
| `e2e-objective-5` | 116 |
| `e2e-objective-6` | 86 |
| `e2e-objective-7` | 89 |
| `e2e-batch-1` | 54 |
| `e2e-batch-2` | 67 |
| `e2e-batch-3` | 58 |
| `e2e-batch-4` | 48 |
| `e2e-batch-5` | 49 |
| `e2e-batch-6` | 60 |
| `e2e-batch-7` | 57 |
| **Total** | **932 · 0 fallos** |

`npm run web:build` y `npx tsc --noEmit` en `mobile/` pasan limpios. La
migración se ejecutó ida y vuelta sobre la base real.

### Comprobaciones que afirmaban la regla anterior

| Antes | Ahora |
|---|---|
| `18.15` Un área de preferencia aporta 6 puntos | Aporta 12 de los 20 que §60 concede al interés |
| `18.10` / `18.11` El curso y el recurso son actividades | Son entradas del catálogo controlado (§61) |
| `18.28` Los motivos de un compañero solo nombran áreas | También habilidades: §62 las pone primero |
| `18.57` Están publicadas las reglas de puntuación | El reparto de §60 suma 100, más los regímenes de §59 |

---

## 10. Siguiente

**BATCH 8 (§133)** — colaboración: perfil público, slug, QR, contactos,
necesidades de equipo, sugerencias, invitaciones, equipos y mensajería
contextual. Sin analizar mensajes.
