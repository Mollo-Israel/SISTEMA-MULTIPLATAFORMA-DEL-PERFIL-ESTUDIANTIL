# BATCH 2 — Perfil y onboarding

> Reporte con el formato de §142 de `AFINIA_100_ESPECIFICACION_DEFINITIVA.md`.
> Rama: `feat/afinia-100`. `main` no se ha tocado.

**BATCH:** 2 — Perfil y onboarding (§127)
**Estado:** Completado. 643 verificaciones automatizadas en verde, 0 fallos.

---

## Implementado

### 1. Datos institucionales no editables (§17.1)

El semestre y el código universitario salen del formulario del estudiante. No
se ocultan en la interfaz: se eliminan del DTO, de modo que enviarlos devuelve
400 aunque alguien llame a la API directamente.

Esto cierra un problema real: hasta ahora cualquier estudiante podía declararse
de otro semestre, y con eso entraba o salía del alcance académico de un
docente. El control de acceso por semestre solo significa algo si el semestre
no lo elige quien es controlado.

Los datos llegan por importación de padrón. Para el alta manual y la corrección
puntual se añade `PATCH /profiles/:id/institutional-data`, reservado al
administrador y auditado: cambiar el semestre de alguien mueve quién puede
verlo, así que queda registrado quién lo hizo y desde qué valor.

### 2. Cuestionario Inicial de Orientación Académica (§16)

Doce preguntas —dentro del rango de 10–15 que fija §16— de selección simple o
múltiple. Ninguna pregunta por conocimiento técnico: todas preguntan por
preferencia, gusto o forma de trabajar, porque §16 prohíbe explícitamente que
esto evalúe.

El banco de preguntas vive versionado en código, que es lo que §73.2 permite
siempre que se persistan las ejecuciones, las respuestas y la versión. Se elige
esa vía porque un cuestionario de orientación se revisa entero y se publica
como versión nueva, no opción por opción desde una pantalla de administración.

**Responder no crea nada.** Produce `suggested_areas[]` y ahí se detiene. Solo
la confirmación del estudiante convierte esas sugerencias en intereses
efectivos, y únicamente acepta áreas que el propio cuestionario haya sugerido:
confirmar es aceptar una propuesta, no una vía alternativa para añadir
cualquier área. «Ninguna de estas» es una respuesta válida y cierra el
cuestionario igual.

El cuestionario puede repetirse. La pasada anterior no se pisa: queda como
`superseded` y el historial la conserva con sus respuestas y su versión, de
modo que un resultado antiguo se sigue leyendo con el cuestionario con el que
se respondió.

Las etiquetas del cuestionario se resuelven contra el catálogo real de áreas
por `tags` o por nombre. Una etiqueta sin área correspondiente no sugiere nada:
es preferible sugerir de menos que inventar un área que la carrera no ofrece.

### 3. Origen de los intereses (§18)

`student_interests` gana `source`: `onboarding` o `manual`. Permite responder
algo que el estudiante preguntará tarde o temprano —por qué aparece esta área
en mi perfil— y distinguir lo que eligió del catálogo de lo que confirmó tras
el cuestionario. Todo lo que ya existía se marca `manual`, que es literalmente
lo que fue.

### 4. Autoevaluación en tres niveles (§21.1)

`student_skills.level` pasa de una escala 1–5 a `basic`, `intermediate`,
`advanced`. Pedir «del 1 al 5» a una autoevaluación sugiere una exactitud que
no tiene: nadie sabe si está en un 3 o en un 4 de sí mismo. Con tres niveles,
además, cabe la etiqueta completa en pantalla y desaparece la pregunta de qué
significaba un 4.

En el móvil esto obligó a separar dos componentes que compartían implementación
por casualidad: el selector de nivel de habilidad y el de prioridad de interés
medían cosas distintas —dominio frente a preferencia— y ahora cada uno tiene el
suyo.

### 5. Autodeclarado frente a respaldado (§21.2)

El resumen del perfil ya no devuelve solo el nivel. Cada habilidad viaja con
`selfAssessed: true` y con un `backing` que cuenta la experiencia real:
proyectos que nombran la tecnología o pertenecen a su área, actividades
confirmadas, certificados y evidencias del área.

Los dos números van separados a propósito. `level` es lo que el estudiante dice
de sí mismo; `backing` es lo que puede demostrar. Combinarlos daría un único
número que no significaría ninguna de las dos cosas.

### 6. Áreas de mejora a cero (§20)

La ponderación `improvement_area` baja de 1 punto a 0. Querer aprender algo no
es tener afinidad con ello; §20 las destina a recomendaciones y objetivos
personales, y ahí se quedan.

La señal **no desaparece del desglose**: sigue registrándose con 0 puntos para
que el estudiante vea que se tuvo en cuenta y que no sumó, en lugar de que se
esfume sin explicación. Eso obligó a distinguir en el motor dos situaciones que
valen lo mismo y significan lo contrario: una ponderación mal configurada, que
debe descartarse en silencio, y una que vale cero a propósito.

### 7. Disponibilidad y preferencias de colaboración (§17.2)

`availability` (`looking`, `open`, `busy`, `unspecified`) y
`collaboration_preferences` —modos, tipos de colaboración, horas por semana y
una nota—. Por defecto sin declarar: no se asume que alguien busca equipo solo
porque no ha abierto esa pantalla.

### 8. Privacidad (§44)

`public_profile_enabled` y `public_visibility_config`. El estudiante decide qué
se muestra **dentro de los límites del sistema**: la lista de campos es cerrada
y lo que nunca es publicable —correo institucional, código universitario,
archivos y certificados privados, conversaciones, identificadores internos— no
tiene clave en esa configuración, de modo que ninguna combinación de valores
puede activarlo. Enviar una clave que no existe devuelve 400.

Todo nace apagado. Compartir es una decisión explícita, no un ajuste que ocurre
por no haber mirado la pantalla. La respuesta incluye `neverShared` para que la
interfaz pueda enseñar qué queda fuera en lugar de pedir que se confíe en ello.

### 9. Interfaz web

- `/student/onboarding` — cuestionario paso a paso, con avance automático en
  las preguntas de una sola respuesta, barra de progreso y pantalla de
  sugerencias donde se elige qué incorporar. Muestra el resultado confirmado y
  permite repetir.
- `/student/privacy` — interruptor del perfil compartible, casillas por campo
  que se guardan al momento, y la lista explícita de lo que nunca se comparte.
- `Perfil dinámico` — tarjeta de datos institucionales en solo lectura, con
  borde discontinuo que dice «esto no se edita» sin un candado por campo, más
  el bloque de disponibilidad y colaboración.
- `Intereses y habilidades` — el desplegable de nivel pasa a las tres etiquetas
  con nombre.

### 10. Interfaz móvil

- `SkillsScreen` — selector de tres niveles con la etiqueta completa, y bajo
  cada habilidad, cuántos registros de experiencia la respaldan.
- `ProfileScreen` — semestre y código universitario pasan a un bloque de solo
  lectura que explica de dónde vienen.
- `PriorityPicker` nuevo, separado del selector de nivel.

---

## Migraciones

`api/src/database/migrations/1780290000000-Batch2ProfileAndOnboarding.ts`

**`up`**

- `student_skills.level` cambia de `smallint` a enum. La conversión agrupa en
  el propio `USING`, de modo que no existe ningún instante con la columna a
  medias: 1–2 → `basic`, 3 → `intermediate`, 4–5 → `advanced`. Se verificó
  sobre los datos reales: **92 filas convertidas, ninguna perdida** (62
  `advanced`, 30 `intermediate`).
- `student_interests.source`, con `manual` para las **171 filas** existentes.
- `student_profiles` gana `availability`, `collaboration_preferences`,
  `public_profile_enabled` y `public_visibility_config`.
- `onboarding_runs` y `onboarding_answers`, con un índice único parcial que
  garantiza una sola ejecución vigente por estudiante dejando convivir cuantas
  `superseded` haga falta.
- `affinity_weights.points` de `improvement_area` pasa a 0.

**`down`**

Revierte todo. La escala numérica vuelve, pero no la precisión: lo que era un 5
y lo que era un 4 regresan como el mismo 4, porque agrupar fue irreversible.
Queda anotado en la propia migración.

`synchronize` sigue en `false`.

---

## Archivos principales

**Contratos compartidos**
- `shared/src/enums/onboarding.enum.ts` *(nuevo)* — `OnboardingRunStatus`,
  `OnboardingQuestionType`, `InterestSource`
- `shared/src/enums/profile.enum.ts` — `SkillLevel`, `AvailabilityStatus`,
  `CollaborationMode`, `CollaborationInterest`, `PublicProfileField`,
  `DEFAULT_PUBLIC_VISIBILITY`

**Entidades**
- `api/src/entities/onboarding-run.entity.ts` *(nuevo)* — `OnboardingRun` y
  `OnboardingAnswer`
- `api/src/entities/student-profile.entity.ts`,
  `student-interest.entity.ts`, `student-skill.entity.ts`

**Módulo nuevo**
- `api/src/onboarding/` — `questionnaire.ts` (banco versionado),
  `onboarding.service.ts`, `onboarding.controller.ts`,
  `dto/onboarding.dto.ts`

**Modificados**
- `api/src/profiles/profiles.service.ts` — datos institucionales, visibilidad,
  y el desglose declarado/respaldado
- `api/src/profiles/profiles.controller.ts`
- `api/src/profiles/dto/` — `create-profile.dto.ts`, `update-profile.dto.ts`,
  `set-skills.dto.ts`, `institutional-data.dto.ts` *(nuevo)*,
  `visibility.dto.ts` *(nuevo)*
- `api/src/affinity-recalc/affinity.engine.ts` — §20 y los tres niveles
- `api/src/audit/audit.service.ts` — tres verbos nuevos
- `api/src/database/seeds/populate.seed.ts`

**Web**
- `web/src/pages/student/Onboarding.tsx` *(nuevo)*
- `web/src/pages/student/Privacy.tsx` *(nuevo)*
- `web/src/pages/student/Profile.tsx`, `InterestsSkills.tsx`
- `web/src/services/types.ts`, `services/index.ts`, `App.tsx`,
  `navigation.ts`, `index.css`

**Móvil**
- `mobile/src/components/LevelPicker.tsx` (reescrito),
  `PriorityPicker.tsx` *(nuevo)*
- `mobile/src/screens/student/SkillsScreen.tsx`, `ProfileScreen.tsx`,
  `InterestsScreen.tsx`
- `mobile/src/services/index.ts`

**Pruebas**
- `scripts/e2e-batch-2.mjs` *(nuevo)*, `scripts/lib/fixtures.mjs`
- Las cuatro suites anteriores, migradas al nuevo reparto de datos

---

## Pruebas

| Suite | Comando | Verificaciones |
|---|---|---|
| Objetivos del 40 % | `npm run test:40` | 244 |
| Objetivo 5 | `npm run test:50` | 112 |
| Objetivo 6 | `npm run test:60` | 82 |
| Objetivo 7 | `npm run test:70` | 84 |
| BATCH 1 | `npm run test:b1` | 54 |
| **BATCH 2** *(nueva)* | `npm run test:b2` | **67** |
| | | **643** |

`scripts/e2e-batch-2.mjs` cubre:

- **§17 (B2.1–B2.12):** el perfil nace sin semestre; el estudiante no puede
  declarar semestre ni código, ni por el endpoint del administrador; el
  administrador sí, con rango validado; lo propio —biografía, disponibilidad,
  preferencias— sí lo edita, y una disponibilidad inventada se rechaza.
- **§16 (B2.13–B2.32):** el cuestionario tiene entre 10 y 15 preguntas y
  declara su versión; no lo ve un docente ni alguien sin sesión; se rechazan el
  cuestionario a medias, la opción inventada, la pregunta inventada, el exceso
  de opciones y dos respuestas en una pregunta simple; responder produce
  sugerencias ordenadas y **no crea ningún interés**; se guardan todas las
  respuestas, no solo el resultado.
- **§16 y §18 (B2.33–B2.44):** no se confirma un área que no se sugirió;
  confirmar sí crea intereses, marcados como `onboarding` y con prioridad
  válida; no se confirma dos veces; el cuestionario se repite conservando el
  historial; una pasada sustituida ya no se confirma; «ninguna» es válido; otro
  estudiante no toca un cuestionario ajeno.
- **§21 (B2.45–B2.55):** se acepta el vocabulario de tres niveles y se rechazan
  tanto la escala numérica anterior como un nivel inventado; el resumen etiqueta
  la habilidad como autodeclarada y trae su respaldo aparte; sin proyectos el
  respaldo es cero aunque el nivel sea alto; un proyecto con esa tecnología
  cuenta como respaldo y **no** altera la autoevaluación.
- **§20 (B2.56–B2.57):** declarar un área de mejora no mueve el puntaje de
  afinidad, pero el área sí queda registrada como objetivo personal.
- **§44 (B2.58–B2.66):** todo nace apagado; se activa y se eligen campos; los
  no elegidos siguen apagados; no existe forma de activar el correo
  institucional ni los archivos; el sistema declara qué queda siempre fuera; un
  docente no consulta la privacidad de un estudiante.

**Una comprobación se reescribió por pasar en falso.** B2.37 leía
`GET /profiles/me/interests`, endpoint que no existe: la respuesta vacía hacía
que la condición se cumpliera sin comprobar nada. Se expuso `source` en el
resumen del perfil —que además §18 pide poder consultar— y la comprobación pasó
a leer de ahí.

`npm run web:build` y `npx tsc --noEmit` en `mobile/` pasan sin errores.

---

## Resultados

- **643 verificaciones OK · 0 fallos.**
- Los datos existentes se conservaron: 92 autoevaluaciones convertidas a los
  tres niveles y 171 intereses marcados como `manual`.
- El área de mejora deja de sumar afinidad y la cadena de puntajes de la suite
  del Objetivo 6 se recalculó exacta en lugar de relajar las comprobaciones.
- `main` intacta. Nada se ha fusionado.

---

## Pendientes

Ninguno dentro de §127. Lo que sigue pertenece a batches posteriores:

- **BATCH 3 (§128)** — SHA-256 de evidencias, extracción de PDF, OCR,
  verificador de enlaces a prueba de SSRF, `validation_records`, worker
  asíncrono persistente.
- **BATCH 8 (§133)** — el perfil público con slug y QR. Este batch deja la
  configuración de visibilidad y el interruptor, pero no el slug ni la página
  compartible: `public_profile_slug` se añadirá con el QR, que es donde hace
  falta.

Dos decisiones conscientes:

- **El semestre sigue contando para la completitud del perfil.** Un perfil sin
  semestre está incompleto de verdad, aunque ya no dependa del estudiante. Si
  falta, lo que hay que arreglar es la importación, no pedírselo a él.
- **La respuesta del cuestionario exige responderlo entero.** Un resultado
  calculado sobre tres respuestas orientaría mal y el estudiante no tendría
  forma de saberlo.

---

## Riesgos

1. **Quien no esté en el padrón se queda sin semestre.** Antes se lo ponía él
   mismo. Ahora, si la importación no lo cubre, alguien tiene que asignarlo a
   mano desde la administración. Es el precio de que el alcance por semestre
   signifique algo.
2. **La conversión de la escala de habilidades no es reversible.** El `down`
   devuelve la columna numérica pero no la distinción entre lo que era un 4 y
   lo que era un 5.
3. **El banco de preguntas vive en código.** Cambiarlo exige un despliegue y
   subir `QUESTIONNAIRE_VERSION`. Es deliberado —§73.2 lo permite— pero
   conviene saberlo antes de prometer que la carrera puede editarlo sola.
4. **Las etiquetas del cuestionario dependen del catálogo de áreas.** Si la
   carrera renombra sus áreas a términos que no coinciden con ningún sinónimo,
   el cuestionario sugerirá menos áreas en lugar de fallar. Es el modo de fallo
   elegido, pero pasa desapercibido: conviene revisar las sugerencias tras
   cualquier cambio grande del catálogo.
