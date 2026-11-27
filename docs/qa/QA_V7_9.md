# Informe BATCH V7-9 — Tecnologías respaldadas y filtros por persona

Formato del contrato V7.1 §17.

## BATCH / rama / commit base / commit resultante

V7-9 · `feature/afinia-v7-cierre-final`. Base: `dc2e53f` (V7-8). El commit resultante es el que contiene este informe.

## Requisitos y páginas

- **Contrato:**
  - §9: tecnologías respaldadas, pp. 17–20;
  - §11: filtros de Biblioteca y Proyectos de la carrera, pp. 20–21;
  - trazabilidad 20 y 21 (la parte de contactos de la fila 21 es de V7-10).
- **Matriz:** M08, M09, B01 y B02.
- **Hallazgos GAP:**
  - FILT-01 y FILT-02;
  - PERF-02, 03, 06 y 07 se revisaron contra lo entregado en V7-8.

## Decisiones Dxx confirmadas

- **D06 (límite):** los filtros no cambian ninguna fórmula, preferencia ni puntaje.
- **D01 / D04:** las tecnologías respaldadas siguen la misma elegibilidad que la afinidad (V7-8). En este batch no se cambió esa regla; se verificó.
- No hubo decisiones nuevas.

## Estado previo y reproducción

Contra V7-8 (`dc2e53f`), en la API aislada (:3020, `afinia_test`):

| Escenario | Antes (V7-8) |
|---|---|
| B01 | No existía el filtro por publicador: `GET /library/publishers` → 404, y `publisherId` se ignoraba (un publicador sin recursos devolvía los 10 resultados) |
| B01 | La tarjeta del recurso no decía quién lo publicó |
| B02 | No existía el filtro por responsable: `GET /projects/community/owners` → 404, y `ownerId` se ignoraba (filtrar por una integrante devolvía los 7 proyectos ajenos) |
| Web | Biblioteca y Proyectos de la carrera no tenían ningún campo para filtrar por persona |

`e2e-v7.mjs batch9` contra V7-8: **0 / 10**.

## Ya estaba correcto (sin cambios)

Tecnologías respaldadas, según lo entregado y probado en V7-8:
- **M08:**
  - proyecto: no borrador, contribución confirmada y señal técnica de esa tecnología en ese proyecto;
  - actividad: participación confirmada y con resultado;
  - credencial: corroborada y sin revisión pendiente, observada ni rechazada.
- **PERF-07:** cada chip dice su procedencia en palabras.
- **M09:** una actividad sin tecnología no crea ninguna.
- **PERF-06:** la sección no se edita a mano.

Ya funcionaban antes de este batch:
- **Galería:** solo proyectos ACTIVE y visibles según el rol; búsqueda, área, tecnología, «Limpiar» y paginación de 6 en el servidor.
- **Biblioteca:** pestañas «Todos / Para ti / Mis favoritos», búsqueda, área, habilidad y paginación de 12 en el servidor.

## Cambios exactos y archivos

**API**
- `common/busqueda-nombre.ts` (nuevo). Búsqueda de personas por nombre y apellidos:
  - normaliza tildes, mayúsculas, comas, guiones y espacios;
  - acepta las palabras en cualquier orden («Quispe, Ana» = «ana quispe»);
  - cada palabra va como parámetro: no se interpola texto ni se aceptan expresiones regulares del usuario;
  - con menos de 2 letras no busca;
  - no usa extensiones de PostgreSQL (`translate` + `lower`).
  - Queda lista para el buscador de contactos de V7-10.
- `library/library.service.ts`, `library.controller.ts`:
  - `GET /library/publishers?q=` sugiere hasta 10 personas, con solo nombre e identificador. Solo aparece quien publicó recursos que quien consulta puede ver: vigentes, aprobados y de su semestre. Quien solo propuso un recurso pendiente no aparece.
  - `GET /library?publisherId=` filtra por `created_by` en el servidor, antes de contar y paginar. Se combina con texto, área, habilidad, tipo, «Para ti» y «Mis favoritos».
  - Cada recurso trae `publishedBy`, el nombre de quien lo publicó, sin correo.
  - La regla de visibilidad quedó en un único método (`visibles`) que usan el listado y las sugerencias.
- `projects/project-gallery.service.ts`, `project-gallery.controller.ts`:
  - `GET /projects/community/owners?q=` sugiere a los responsables (quien lleva el proyecto) de proyectos que quien consulta puede ver en la galería. No sugiere a cualquier integrante.
  - `GET /projects/community?ownerId=` filtra en el servidor antes de paginar.
  - La visibilidad por rol (estudiante, docente con su alcance, Administración) se extrajo a `visibles(user)`, compartido por el listado y las sugerencias. Así un responsable que solo tiene proyectos visibles a docentes no se le sugiere a un estudiante.

**Web**
- `components/FiltroPersona.tsx` (nuevo): campo accesible (`combobox`/`listbox`).
  - Las sugerencias llegan del servidor a los 250 ms y desde 2 letras; sin coincidencias muestra «Nadie con ese nombre.».
  - Se filtra siempre por el identificador elegido, nunca por igualdad de nombre.
- `student/Library.tsx`: filtro «Publicado por»; «Publicado por …» en la tarjeta. «Limpiar» lo quita sin cambiar de pestaña.
- `CareerProjects.tsx`: filtro «Responsable». «Limpiar» restaura todos los filtros.
- `services/index.ts` y `services/types.ts`: los parámetros y los métodos nuevos.
- `index.css`: sugerencias flotantes bajo el campo.

**Móvil:** sin cambios. El móvil no tiene pantallas de Biblioteca ni de Proyectos de la carrera.

**Pruebas**
- `api/test/unit/v7-busqueda-nombre.test.ts`: 9 pruebas.
- `scripts/e2e-v7.mjs batch9`: 10 comprobaciones.
- `scripts/e2e-v7-web.mjs batch9`: 6 comprobaciones.

## Migraciones / datos preservados / compatibilidad web-móvil

- Sin migraciones ni cambios de datos. Los filtros solo leen.
- Los parámetros nuevos son opcionales. Sin ellos, las respuestas son las de antes: en la prueba, sin publicador siguen los 10 recursos visibles. `publishedBy` es un campo agregado.
- El móvil no usa estos endpoints. Su `libraryService` sigue funcionando sin cambios.

## Pruebas ejecutadas (comando, resultado, evidencia)

| Comando | Resultado |
|---|---|
| `e2e-v7.mjs batch9` contra V7-8 | 0 / 10 (reproducción) |
| `e2e-v7.mjs batch9` | **10 / 10** |
| `e2e-v7-web.mjs batch9` | **6 / 6** |
| `npm --prefix api run test:unit` | **233 / 233** (9 nuevas) |

## PASS / FAIL / BLOCKED / NE

| Escenario | Resultado | Evidencia |
|---|---|---|
| B01 Búsqueda del publicador sin tildes, mayúsculas, coma ni orden | **PASS** | V7.9.1, W7.9.1 |
| B01 Solo publicadores reales y visibles, sin correo; mínimo 2 letras; sin enumeración | **PASS** | V7.9.2, V7.9.3, W7.9.2 |
| B01 Filtro en el servidor antes de paginar (8 → 5 + 3) | **PASS** | V7.9.4 |
| B01 «Publicado por» con datos reales | **PASS** | V7.9.5, W7.9.1 |
| B01 Búsqueda combinada, sin coincidencias y restauración | **PASS** | V7.9.6, W7.9.3 |
| B01 No cambia preferencias, favoritos ni afinidad | **PASS** | V7.9.7 |
| B02 Responsable real, no cualquier integrante | **PASS** | V7.9.8, V7.9.10 |
| B02 Respeta la visibilidad (privado, solo docentes) | **PASS** | V7.9.8, V7.9.9 |
| B02 Paginación (7 → 6 + 1), combinada con texto y área | **PASS** | V7.9.9, V7.9.10 |
| B02 «Limpiar» restaura los filtros | **PASS** | W7.9.5 |
| M08 Tecnologías respaldadas solo de fuentes elegibles | **PASS** (V7-8) | `e2e-v7 batch8` V7.8.8 en la regresión |
| M09 Actividad sin tecnología | **PASS** (V7-8) | `e2e-v7 batch8` V7.8.9 en la regresión |

## Regresiones verificadas

Corrida limpia (base reconstruida) con la API y la web de V7-9, sin fallas nuevas:
- `e2e-v7` **117 / 0** · `e2e-v6` **98 / 0** · `e2e-v5` **135 / 0** · `e2e-v2` **162 / 0** · `e2e-qa` **68 / 0**.
- `e2e-v4-1` 171 / 2 (V41.10.1–2, previas) · `e2e-v3` 378 / 1 (V3.2.15, previa) · `e2e-v3-2` 197 / 10 (las mismas 10 de V7-7 y V7-8).
- Objetivos 5, 6, 7 y 40, y `batch-1…11`: sin fallas, salvo B6.47 (previa).
- Jest **197 / 197** · unitarias **233 / 233**.
- Web: `e2e-web` **106 / 0** · `e2e-v6-web` **63 / 0** · `e2e-v7-web` **54 / 0** · `e2e-web-gestion` **47 / 0**.
- `tsc` sin errores en API, web y móvil.

Ajuste de la prueba nueva: en la corrida completa, otros batches crean recursos cuyo texto contiene el sufijo de la corrida. V7.9.6 ahora cuenta solo los recursos de este batch («Recurso filtro …»). No es un cambio de comportamiento.

## Riesgos o limitaciones

- **Credencial «aprobada» (respaldo parcial) y tecnologías respaldadas.** Cuando Dirección aprueba revisando solo el documento (`approved`, C22), la credencial entra en la trayectoria y en el CV como «revisada», pero su respaldo queda en `supported`. Por eso no suma afinidad y no da tecnologías respaldadas, que siguen la misma regla que la afinidad desde V7-8. Es la opción conservadora: no se atribuye una tecnología solo por un documento sin contraste externo. Si se prefiere que una aprobación de Dirección también dé chips, es un cambio de una línea en `backed-skills.service.ts`, sin migración, y se deja para decisión.
- **Proyectos archivados.** «Proyectos activos elegibles» (§9) se aplica como «no borrador», igual que en la afinidad: un proyecto archivado (terminado) sigue siendo trayectoria. Excluirlo cambiaría también la afinidad, así que no se toca sin decisión (D06).
- La búsqueda por nombre compara subcadenas normalizadas. «an» encuentra «Ana» y también «Juan». Es lo esperable en un buscador con sugerencias, con un máximo de 10.

## Pendientes y siguiente batch propuesto

- **Siguen pendientes del usuario:**
  - D06 (REC-H1 a REC-H3, §10.3);
  - migrar la base de desarrollo;
  - autorizar o no el recálculo D04.
- **Siguiente batch: V7-10** (contactos, QR móvil, canales y equipos). Necesita autorización para agregar `expo-camera` (T04 y T05).
