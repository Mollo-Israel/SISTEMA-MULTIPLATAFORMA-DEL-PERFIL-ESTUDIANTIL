# BATCH 5 — Proyectos

> Reporte con el formato de §142 de `AFINIA_100_ESPECIFICACION_DEFINITIVA.md`.
> Rama: `feat/afinia-100`. `main` no se ha tocado.

**BATCH:** 5 — Proyectos (§130)
**Estado:** Completado. 802 verificaciones automatizadas en verde, 0 fallos.

---

## Implementado

### 1. Nadie atribuye experiencia a otra persona (§33)

Es el cambio que ordena el batch, y §33 lo pide con todas las letras:

> No permitir que el creador atribuya unilateralmente experiencia definitiva a
> otro estudiante.

Antes, aceptar una invitación bastaba: el proyecto entero pasaba a alimentar la
afinidad del integrante, con la contribución que hubiera escrito el
responsable. Ahora aceptar crea la pertenencia, no la experiencia. Hasta que el
propio integrante revisa y confirma lo que hizo, el proyecto no cuenta en su
perfil.

El responsable **propone**; no atribuye. Y editar una contribución ya
confirmada **retira** la confirmación, de modo que el integrante tenga que
volver a revisarla. Sin eso, bastaría con cambiar el texto después de que
confirmara para atribuirle lo que uno quisiera.

### 2. Las tecnologías del integrante son las suyas (§34)

§34 lo ilustra sin ambigüedad:

```
Proyecto:     React, NestJS, PostgreSQL, Docker
Integrante A: React
Integrante B: NestJS, PostgreSQL
```

Hasta ahora entrar en ese proyecto atribuía las cuatro tecnologías a cada
integrante. `project_member_skills` separa lo que declara el proyecto de lo que
declara cada persona, y la afinidad individual usa las suyas. Si no declaró
ninguna, se cae a las del proyecto, que es lo único que se sabe.

### 3. La evidencia recalcula a quien la aporta (§35)

§35 nombra el defecto directamente:

> Corregir cualquier comportamiento que recalcule afinidad del creador cuando
> la evidencia pertenece a otro integrante.

Estaba exactamente así: la evidencia se guardaba a nombre de quien la adjuntaba
pero el recálculo se pedía siempre para `project.createdByProfileId`. Un
integrante subía una evidencia y la afinidad que se actualizaba era la de otra
persona; la suya se quedaba sin el aporte que acababa de hacer. Lo mismo al
borrarla.

De paso, esta ruta se había quedado con el patrón de archivo que el BATCH 3
abandonó en el resto del sistema: aceptaba un `fileUrl` cualquiera, lo que
permitía adjuntar el archivo de otra persona. Ahora usa `storedFileId` con
verificación de propiedad, como las demás.

### 4. Niveles de respaldo derivados (§36)

```
DECLARED     — solo información declarada
SUPPORTED    — al menos una fuente adicional
CORROBORATED — dos señales independientes y una corroboración técnica
REVIEWED     — al menos SUPPORTED y con retroalimentación docente
FLAGGED      — hay una inconsistencia grave
```

Se **deriva**, nunca se fija a mano: un proyecto no es más creíble porque
alguien marque una casilla. Y no mide calidad académica: un proyecto excelente
de una sola persona, sin repositorio público, se queda en `DECLARED`, y eso no
dice nada malo de él.

Una distinción que importa: un integrante o una evidencia son **fuentes
adicionales**, pero no corroboran técnicamente nada —los escribió alguien—. La
corroboración técnica es algo que responde por sí mismo: un repositorio, una
demo. Por eso `CORROBORATED` exige una de esas dos.

`FLAGGED` convive con cualquier nivel porque es una advertencia, no un escalón.
Y **el proyecto no se elimina** (§36): un enlace caído puede ser un servidor
apagado el fin de semana, no un intento de engañar a nadie.

### 5. GitHub opcional y detección de tecnologías (§37, §38)

Un proyecto no necesita repositorio para existir, y no tenerlo no lo penaliza.
Cuando lo hay, se consulta solo lo que §37 autoriza: metadata pública, lenguajes
reportados y la **presencia** de manifiestos. No se descarga ni se analiza el
repositorio entero, que §37 prohíbe expresamente.

Se pide un único listado de la raíz, no un recorrido del árbol: para saber si
hay un `package.json` no hace falta más.

El cruce produce tres estados (§38):

- `BOTH` — declarada y con rastro. Es la única que corrobora.
- `DECLARED` — declarada sin rastro. Puede ser perfectamente cierta: §39
  advierte que PostgreSQL no deja huella pública, y se queda como declarado.
- `DETECTED` — hay rastro y no se declaró. Se informa sin añadirla: lo que el
  estudiante declara es suyo.

Cada respuesta repite qué significa «detectado»: indicios compatibles, no
dominio.

### 6. Demo comprobada con las protecciones de §31 (§39)

Se comprueba lo observable: que responda, si usa HTTPS, su título. Reutiliza el
verificador del BATCH 3, así que una demo que apunte al bucle local o a un
rango privado se rechaza igual, y el proyecto queda `FLAGGED`.

No se infiere backend ni base de datos desde una web desplegada (§39).

### 7. Retroalimentación y bitácora (§40, §41)

La retroalimentación docente sube el proyecto a `REVIEWED`, queda asociada a su
autor y genera evento. `REVIEWED` **no significa aprobado académicamente**:
significa que alguien con criterio lo miró.

`project_events` es la bitácora que pide §41: quince tipos de evento
estructurados, con actor y metadato mínimo. «La auditoría funcional se realiza
mediante eventos estructurados, no analizando chats». Es distinta de
`audit_events`, que registra decisiones administrativas sobre personas: ésta
cuenta la vida de un proyecto y la ven sus integrantes.

Los metadatos se sanean antes de guardarse: ninguna clave que suene a secreto
llega a persistirse.

### 8. Interfaz

- **Web** — panel de contribución donde el integrante confirma lo que hizo y
  elige **sus** tecnologías; tabla del equipo con el estado de cada
  contribución; nivel de respaldo con su explicación y sus motivos; bitácora
  desplegable.
- **Móvil** — misma confirmación de contribución, con el aviso de que sin
  confirmar el proyecto no cuenta.

---

## Migraciones

`api/src/database/migrations/1780320000000-Batch5Projects.ts`

**`up`**

- `projects` gana `backing_tier` y `backing_reasons`.
- `project_members` gana `contribution_confirmed_at`.
- `project_member_skills`, `project_repository_checks`, `project_link_checks` y
  `project_events`.
- Se crea el tipo `link_check_status_enum`: el contrato de §31 existía desde el
  BATCH 3, pero como jsonb; aquí hace falta como columna.

**Una decisión sobre datos existentes, y es la incómoda.** Las membresías ya
aceptadas quedan **sin confirmar**. §33 exige que sea el integrante quien
confirme lo que se le atribuye, y nadie lo ha hecho todavía porque hasta ahora
no existía forma de hacerlo. Darlo por confirmado sería fabricar un
consentimiento que nunca se dio.

`down` revierte todo. `synchronize` sigue en `false`.

---

## Archivos principales

**Contratos compartidos**
- `shared/src/enums/project-backing.enum.ts` *(nuevo)* — `ProjectBackingTier`,
  `TechnologyStatus`, `ProjectEventType`

**Entidades**
- `api/src/entities/project-member-skill.entity.ts` *(nuevo)*
- `api/src/entities/project-check.entity.ts` *(nuevo)* —
  `ProjectRepositoryCheck`, `ProjectLinkCheck`, `ProjectEvent`
- `api/src/entities/project.entity.ts`, `project-member.entity.ts`

**Servicios nuevos**
- `api/src/projects/repository-inspector.service.ts` — §37, §38
- `api/src/projects/project-backing.service.ts` — §36
- `api/src/projects/project-events.service.ts` — §41

**Modificados**
- `api/src/projects/projects.service.ts` — §33, §34, §35, checks y bitácora
- `api/src/projects/project-members.service.ts` — eventos y respaldo
- `api/src/project-feedback/project-feedback.service.ts` — §40
- `api/src/affinity-recalc/affinity.engine.ts` — §33 y §34
- `api/src/projects/dto/` — `add-evidence.dto.ts`, `contribution.dto.ts` *(nuevo)*

**Web**
- `web/src/components/ProjectContribution.tsx` *(nuevo)*
- `web/src/pages/student/Projects.tsx`, `services/types.ts`,
  `services/index.ts`, `index.css`

**Móvil**
- `mobile/src/screens/student/ProjectDetailScreen.tsx`, `services/index.ts`

---

## Pruebas

| Suite | Comando | Verificaciones |
|---|---|---|
| Objetivos del 40 % | `npm run test:40` | 248 |
| Objetivo 5 | `npm run test:50` | 114 |
| Objetivo 6 | `npm run test:60` | 82 |
| Objetivo 7 | `npm run test:70` | 84 |
| BATCH 1 | `npm run test:b1` | 54 |
| BATCH 2 | `npm run test:b2` | 67 |
| BATCH 3 | `npm run test:b3` | 58 |
| BATCH 4 | `npm run test:b4` | 48 |
| **BATCH 5** *(nueva)* | `npm run test:b5` | **47** |
| | | **802** |

`scripts/e2e-batch-5.mjs` cubre:

- **§32 y §41 (B5.1–B5.5):** el alta no necesita aprobación, deja `DECLARED` y
  queda en la bitácora con su autor.
- **§33 y §34 (B5.6–B5.19):** aceptar **no** atribuye experiencia todavía; la
  contribución figura sin confirmar; el responsable propone y sigue sin contar;
  quien no es integrante no confirma nada; el integrante confirma y declara
  **una** tecnología, no las cuatro del proyecto; entonces sí alimenta su
  afinidad; y volver a editarla retira la confirmación.
- **§35 (B5.20–B5.26):** la evidencia del integrante queda a su nombre, **su**
  afinidad sube y la del creador **no cambia**; no se puede adjuntar el archivo
  de otra persona.
- **§36 a §39 (B5.27–B5.35):** con integrante y evidencia sube de `DECLARED` y
  se explica por qué; un proyecto sin repositorio se crea igual y no se
  penaliza; una demo que apunta al bucle local se rechaza y el proyecto queda
  marcado, no eliminado; la respuesta declara qué significa «detectado».
- **§40 y §41 (B5.36–B5.47):** la retroalimentación lleva a `REVIEWED`; la
  bitácora registra invitación, aceptación, confirmación, evidencia,
  retroalimentación y cada cambio de nivel; ningún evento guarda secretos; un
  estudiante ajeno no la consulta.

**Una comprobación afirmaba lo contrario de §33.** `15.28 El proyecto
colaborativo alimenta la afinidad del integrante` daba por bueno que aceptar
bastara. Se reescribió en tres: que aceptar **no** atribuye (15.28), que el
integrante confirma (15.28b) y que entonces sí cuenta (15.28c).

`npm run web:build` y `npx tsc --noEmit` en `mobile/` pasan sin errores.

---

## Resultados

- **802 verificaciones OK · 0 fallos.**
- Se corrige el defecto que §35 nombra: el recálculo iba al creador cuando la
  evidencia era de otro integrante.
- Se cierra la última ruta que aceptaba un `fileUrl` arbitrario.
- Se acaba con la atribución unilateral de experiencia.
- `main` intacta. Nada se ha fusionado.

---

## Pendientes

Todo lo de §130 está cubierto. Lo que sigue:

- **BATCH 6 (§131)** — afinidad V2 completa: pesos por prioridad, topes por
  área, rendimientos decrecientes, `SUPPORT_SCORE`, `SUPPORT_LEVEL`, regla de
  diversidad y normalización sobre 60.

Dos decisiones conscientes:

- **La comprobación del repositorio es superficial a propósito.** Se mira la
  raíz y los lenguajes que reporta el proveedor; no se leen las dependencias de
  un `package.json`. §37 prohíbe el análisis ilimitado, y la presencia del
  fichero ya es la señal que §38 pide.
- **Solo se inspecciona GitHub.** §37 habla de GitHub; otros proveedores no se
  consultan y el proyecto simplemente no puede corroborarse por esa vía.

---

## Riesgos

1. **Las membresías existentes quedan sin confirmar, y eso baja afinidades.**
   Quien ya estaba en un proyecto ajeno verá que deja de contarle hasta que
   entre y confirme su contribución. Es lo que §33 exige, pero conviene
   avisarlo: no es un fallo, es un consentimiento que nunca se pidió.
2. **Sin salida a internet, ningún proyecto llega a `CORROBORATED`.** El
   repositorio y la demo quedarán como no comprobados.
   `REPOSITORY_CHECK_ENABLED=false` y `LINK_CHECK_ENABLED=false` lo dejan
   explícito en ese entorno.
3. **La cuota pública de GitHub es de 60 consultas por hora por IP.** Cada
   proyecto con repositorio gasta tres. Con un `GITHUB_TOKEN` sube a 5000. Si
   se agota, el resultado es `UNVERIFIED` —no se sabe—, nunca «no existe».
4. **Un integrante puede declararse tecnologías que no usó.** Es autodeclarado,
   como la autoevaluación de §21.1, y el sistema lo trata igual: lo que
   corrobora es el repositorio, no lo que alguien escriba.
