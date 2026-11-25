# Informe BATCH V7-1 — Filtros excluyentes, paginación y revisión separada

Formato del contrato V7.1 §17.

## BATCH / rama / commit base / commit resultante

V7-1 · `feature/afinia-v7-cierre-final`. Base: `4b93e8a`, que es V7-0 sobre `141d768`. El commit resultante es el que contiene este informe.

## Requisitos y páginas

- **Contrato:** §4.1 (pp. 5–6) y el apartado de filtros de navegación de §3.1.
- **Matriz:** F01–F05.
- **Hallazgos de la auditoría:** FIL-01 a FIL-07.

## Decisiones Dxx confirmadas

Ninguna D01–D05 afecta este batch. No se tocaron estados de datos.

## Estado previo y reproducción

Primero se escribió `scripts/e2e-v7.mjs batch1` y se corrió contra el código **sin cambios**, en la API aislada (`:3020`, base `afinia_test`).

**Resultado de la reproducción: 6 de 26 correctas, 20 fallidas.**

Las 20 fallidas eran exactamente las de filtrado:
- `GET /users?status=suspended&limit=10` respondía 200 con la lista completa y sin `total` (V7.1.1–V7.1.8).
- `status=borrada` respondía 200 en lugar de 400 (V7.1.10).
- Áreas, tecnologías y categorías con `?status=inactive` devolvían también las vigentes (V7.1.11–V7.1.17).
- Recursos y autonomía ignoraban el estado pedido (V7.1.18–V7.1.19).
- `GET /activities/managed?status=draft` devolvía también las abiertas (V7.1.20–V7.1.22).
- Los valores inexistentes se aceptaban (V7.1.15, V7.1.25).

Las 6 correctas eran comportamiento que debía conservarse y se conservó:
- sin `limit`, `GET /users` responde la lista completa;
- un docente recibe 403 en `/users`;
- sin filtro, Administración recibe todo el catálogo;
- un rol que no administra nunca recibe lo dado de baja;
- «No requiere revisión»;
- la propuesta del docente no entra en la gestión de Administración.

## Ya estaba correcto (sin cambios)

- Permisos de `/users` (solo Administración).
- Los catálogos dados de baja nunca llegan a quien no administra.
- La gestión de Administración no incluye propuestas ajenas. Su consulta en solo lectura corresponde a V7-2.
- 10 filas por página y orden por columna en las grillas.

## Cambios exactos y archivos

**API**

- **Nuevo `api/src/common/estado-de-listado.ts`:**
  - `leerFiltro`: un valor desconocido es un 400 con el campo señalado (`INVALID_LIST_FILTER`);
  - `estadoDeCatalogoPara`: solo Administración ve lo dado de baja y, sin filtro, recibe todo como antes;
  - `condicionDeVigencia`.
- **Catálogos** (`catalogs.controller.ts`, `catalogs.service.ts`): `?status=active|inactive|all` en `GET /academic-areas`, `/skills`, `/activity-categories` y `/learning-resources`. En recursos, `includeInactive=true` sigue valiendo y equivale a `all`.
- **Autonomía docente** (`approval-policies.controller.ts`, `approval-policies.service.ts`): `?status=active|revoked|all`. `includeRevoked=true` equivale a `all`.
- **Usuarios** (`users.controller.ts`, `users.service.ts` y nuevo `dto/query-users.dto.ts`):
  - filtros `status` (los cuatro estados o `all`), `role`, `search`, `surnames=pending`, `sort` y `dir`;
  - con `limit`/`offset`, devuelve una página `{ items, total, limit, offset, surnamesPending }` filtrada en SQL **antes** de paginar, con orden estable (desempate por id);
  - sin `limit`, la respuesta es la de siempre;
  - la búsqueda escapa los comodines de LIKE.
- **Actividades gestionadas** (`activities.controller.ts`, `activities.service.ts` y nuevo `dto/query-managed-activities.dto.ts`):
  - filtros `type`, `originType`, `status` (ciclo de vida) y `review` (`unsubmitted`, `pending`, `observed`, `approved`, `rejected`, `not_required`);
  - se aplican en SQL antes de comprobar, fila por fila, qué gestiona cada quien. Solo restringen y nunca amplían lo visible.

**Web**

- **Nuevo `web/src/hooks/useFiltroUrl.ts`:** los filtros viven en la URL. Se escriben con `replace`, el valor por omisión no se escribe y un valor desconocido se lee como el de omisión.
- **`components/ui.tsx`:**
  - `FiltroEstado`, un selector con etiqueta visible, reemplaza a `VerTambien` (casilla «Mostrar también…»), que se retiró;
  - `GrillaEnCarga` atenúa la grilla y la marca `aria-busy` mientras llega el resultado de otro filtro, para que nunca se lea como si ya fuera del filtro nuevo.
- **`pages/admin/Users.tsx`:**
  - el selector «Estado de la cuenta» ofrece Activas (por omisión), Pendientes de activación, Suspendidas, Inactivas y Todas;
  - búsqueda, rol, apellidos por separar, orden y página van en la URL;
  - la API pagina; cambiar un filtro vuelve a la página 1; «Limpiar» restaura todo;
  - si una página queda vacía (por ejemplo, tras suspender su última cuenta), se vuelve a la última que tiene filas;
  - al crear una cuenta, el aviso explica que queda en «Pendientes de activación».
- **`AreasSkills.tsx` y `ActivityCategories.tsx`:**
  - «Vigentes / Dadas de baja / Todas»;
  - cada grilla pide a la API solo su estado; los selectores del formulario siguen recibiendo la lista completa, con sus referencias históricas;
  - cambiar de pestaña conserva el filtro.
- **`director/LearningResources.tsx`:** «Vigentes / Retirados / Todos», solo para Dirección y Administración (el docente solo ve lo vigente).
- **`director/TeacherAutonomy.tsx`:** «Vigentes / Revocadas / Todas».
- **`components/ActivityManager.tsx`:**
  - la API filtra el tipo y el origen de la pestaña;
  - «Estado de la actividad» y «Revisión» son dos selectores independientes, los dos en la URL (`?status=draft&review=pending`), con «Limpiar».
- **`services/index.ts`:** parámetros opcionales nuevos. Sin ellos, las llamadas son las de siempre.
- **`constants.ts` e `index.css`:** opciones y estilos del selector.

**Pruebas**

- Nuevas:
  - `scripts/e2e-v7.mjs` (API, bloque `batch1`);
  - `scripts/e2e-v7-web.mjs` (navegador, bloque `batch1`);
  - `api/test/unit/v7-filtros.test.ts` (11 unitarias).
- **Adaptadas, porque el requisito cambió por contrato:**
  - `scripts/e2e-v6-web.mjs`: V6W.5.8–5.11 pasan de la casilla al selector;
  - `scripts/e2e-web-gestion.mjs`: WG.4.5 (revocadas) y WG.5.3 (reponer desde «Retirados»);
  - `scripts/e2e-web.mjs` acepta `WEB_URL`, como las demás suites, para correr contra el entorno aislado.

## Migraciones / datos preservados / compatibilidad web-móvil

- **Sin migraciones.** Los filtros solo leen y no cambian ningún estado.
- **Compatibilidad:** sin los parámetros nuevos, todos los endpoints responden igual que antes (V7.1.9, V7.1.13, V7.1.26). La app móvil no usa estos filtros y compila sin cambios.

## Pruebas ejecutadas (comando, resultado, evidencia)

| Comando | Resultado |
|---|---|
| `API_URL=…:3020/api node scripts/e2e-v7.mjs batch1`, antes del cambio | 6 / 26 (reproducción) |
| `API_URL=…:3020/api node scripts/e2e-v7.mjs batch1`, después | **27 / 27** (las 26 más V7.1.27 de Sociedad, agregada al pedir el contrato probar también sociedad) |
| `node scripts/e2e-v7-web.mjs batch1` (web `:5180` + API `:3020`) | **9 / 9** |
| `npm --prefix api run test:unit` | **178 / 178** (167 anteriores + 11 nuevas) |
| `npm --prefix api run test` (Jest + SuperTest, base `afinia_test`) | **214 / 214** (18 suites); reporte versionado restaurado |
| `node scripts/e2e-v6-web.mjs batch5` | **13 / 13** |
| `node scripts/e2e-web-gestion.mjs`, todas | **47 / 47** |
| `node scripts/e2e-web.mjs`, todas (web `:5180` + API `:3020`) | **106 / 106** (incluida WEB.44.2, sensible a tiempos) |
| `tsc` api / web / móvil | OK / OK / OK |

Nota de entorno: las suites que consultan la base con `psql` necesitan `POSTGRES_DB=afinia_test` contra la API aislada. Sin esa variable, miran la base de desarrollo. Así salieron 4 falsas fallas en la primera corrida de `e2e-web-gestion`; con la variable correcta, 47 / 47.

## PASS / FAIL / BLOCKED / NE

| Escenario | Resultado | Evidencia |
|---|---|---|
| F01 Usuarios «Suspendidas» | **PASS** | V7.1.1 · W7.1.2 |
| F02 Pendientes de activación | **PASS** | V7.1.2 · W7.1.4 |
| F03 Catálogo «Dadas de baja» + búsqueda | **PASS** | V7.1.11–17 · W7.1.7 |
| F04 Cambio de filtro en página 2 → página 1 | **PASS** | W7.1.5 |
| F05 Filtros persistidos tras recarga y navegación | **PASS** | W7.1.3 · W7.1.6 · W7.1.8 |
| 0 / 1 / 11 registros | **PASS** | V7.1.6 · W7.1.5 |
| Permisos (docente, sociedad, Admin sin propuestas ajenas, URL directa) | **PASS** | V7.1.10 · V7.1.14 · V7.1.24 · V7.1.27 · W7.1.6 |

## Regresiones verificadas

Ver la tabla de pruebas. Las suites web anteriores que tocan estas pantallas (`e2e-v6-web` batch 5, `e2e-web-gestion` completa y `e2e-web` completa) corrieron contra el código nuevo sin fallas.

Playwright (`pruebas-e2e/`) **no se corrió en este batch**, a propósito. Reescribe la evidencia versionada del capítulo III (`pruebas/03-playwright`, 288 archivos), y sus visitas a estas pantallas son de humo; las suites de arriba las cubren a fondo. Se corre una sola vez en la regresión integral de V7-13.

## Riesgos o limitaciones

- **Actividades (FIL-06 sigue PARCIAL).** La API ya filtra tipo, origen, estado y revisión. En la web, la tabla aplica estado y revisión sobre la lista de la pestaña, que la API ya filtró por tipo y origen. No se recorta más porque «Participantes» y el detalle usan esa misma lista. «Actividades que gestiona» sigue sin paginación de servidor. Con las ~14 mil actividades de la base de desarrollo, la cuenta Admin tarda unos segundos en cargar. Paginar en el servidor obligaría a separar Participantes de la grilla, y eso es un cambio de estructura que este batch no hace.
- **Consulta de propuestas por Admin.** Que Admin vea las propuestas de docentes en solo lectura es V7-2. Hoy el filtro «En revisión» de Admin muestra solo lo que gestiona.
- **Cuenta recién creada.** Con «Activas» por omisión, una cuenta recién creada no aparece en la grilla hasta activarse. El aviso de creación lo explica.

## Pendientes y siguiente batch propuesto

**V7-2:**
- aprobar = publicar y abrir (D02);
- consulta de propuestas por Admin en solo lectura;
- corrección de asistencia con la lista abierta;
- regla D04.

Antes del recálculo de afinidad hay que entregar el informe de impacto de D04.
