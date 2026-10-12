# Afinia — Reporte de batches del cierre final V3.2

Fuente de verdad: `AFINIA_CIERRE_FINAL_V3_2_AJUSTES_CLAUDE_CODE_2026-10-12.md`.

Rama: `feat/afinia-v3-2`.

Formato de cada reporte: §76.

---

## BATCH 0 — Baseline y matriz de gaps

**ESTADO:** completo

**Objetivo:** contrastar el repositorio con V3.2 sin modificar código, verificando antes de cambiar (§75), y dejar el GAP y el plan.

**Hallazgos** (detalle en [`AUDITORIA_GAP_CIERRE_V3_2.md`](../AUDITORIA_GAP_CIERRE_V3_2.md)):
- Se reprodujeron contra la API real con PostgreSQL:
  - **C5:** `aws → Redes`, por la regla canónica que se aplica antes que el catálogo.
  - **C6:** un 500 por `activity_id NULL` al editar con 3 áreas, sin transacción.
  - **C9:** el borrador de un docente es visible para otro docente, para Dirección y para Administración.
  - **C10:** el creador edita después de la aprobación.
  - **C3:** a una cuenta activa se le responde «te enviamos un mensaje».
  - **C2:** el historial muestra previsualizaciones y descartados.
  - No existe «Cancelar envío».
- **C1**, con la causa real en la web: la API devuelve conteos y estados en minúsculas y la web los lee en mayúsculas. «Aplicar» queda en 0 y deshabilitado siempre.
- **C11:** la API conserva el instante. El desfase lo produce el formulario web: `slice(0,16)` de UTC en un `datetime-local`, que suma 4 h por guardado. Además, la web no pide la fecha de fin.
- **C12 ya estaba restaurado** (V3.1 B20). Dos cambios de V3.1 contradicen V3.2 y se retiran: «Crear actividad» en el menú de Sociedad (§58) y el selector de resultado en las externas (§29).

**Ya estaba correcto:** importación idempotente con plantillas diferenciadas, activación (enlace, código, token usado o reemplazado, suspendida, cooldown), taxonomía con `code`, `aliases` y área principal, oportunidades internas y externas, proyectos, GitHub, respaldo, equipos, notificaciones, recomendaciones sin afinidad, afinidad V4 sin multiplicar por skill, currículo en dos niveles, QR y paneles por actor.

**Cambios:** ninguno en el código. Se agregan `AUDITORIA_GAP_CIERRE_V3_2.md`, `PLAN_EJECUCION_CIERRE_V3_2.md` y este reporte.

**Migraciones:** ninguna. 81 aplicadas y 0 pendientes.

**Archivos modificados:** solo documentación.

**Pruebas ejecutadas:**
- `shared` build, API `tsc`, web build y móvil `tsc`: todos sin errores.
- Unitarias: 99/99.
- `migration:show`: 0 pendientes.
- Sondas de C2, C3, C5, C6, C7, C8, C9, C10 y C11 contra la API.
- Regresión completa.

**Resultados:**
- Regresión completa: **1821 correctas, 1 fallo**. El fallo, B10.36, es un artefacto de la prueba: un tope fijo de 900 estudiantes cuando la base de desarrollo ya tiene 916.

**Regresiones:** ninguna funcional.

**Pendientes:** batches 1 a 22 según [`PLAN_EJECUCION_CIERRE_V3_2.md`](../PLAN_EJECUCION_CIERRE_V3_2.md).

**Riesgos:** no están en el repositorio `corregir v2.docx` ni `corregir v3.docx`. Se toman las observaciones tal como las consolida V3.2.

---

## BATCH 1 — Importación y usuarios

**ESTADO:** completo

**Objetivo:** que la importación aplique lo válido aunque haya filas con problemas (§7.3), que el historial muestre solo lo aplicado o fallido (§7.5), validar columnas y codificación del CSV (§7.6) y dejar las grillas de usuarios e importación con 10 filas, orden y contador (§6.1, §6.2, §7.7, §8.6).

**Hallazgos verificados antes de cambiar (§75):**
- **C1:** la API ya aplicaba en forma parcial. El bloqueo estaba en la web: leía `counts.NEW` y `counts.UPDATE` cuando la API devuelve `new` y `update`. Por eso «Aplicar» quedaba en 0 y deshabilitado, y los estados del historial salían sin traducir.
- **C2:** el historial listaba también lotes `previewed` y `discarded`, y cada previsualización generaba un evento `IMPORT_PREVIEWED`.
- Una fila con una columna de menos o de más se leía por posición: el correo podía terminar en el apellido.

**Cambios:**
- **API:**
  - Nuevo estado `failed` con `failure_reason`. Si la transacción de aplicar falla, el lote queda FAILED con su motivo; los correos se enmascaran como `[correo]`.
  - La respuesta de aplicar trae `summary`: `inserted`, `updated`, `unchanged`, `skippedConflict` e `invalid`.
  - Las previsualizaciones son temporales:
    - Descartar borra el lote, y sus filas caen en cascada.
    - Las previsualizaciones que nadie aplica en `IMPORT_PREVIEW_TTL_HOURS` (24 por omisión) se borran solas.
    - El historial solo lista `applied` y `failed`.
    - Previsualizar ya no se audita; aplicar sigue auditado como `IMPORT_APPLIED`.
  - CSV:
    - Cada fila guarda cuántas columnas traía; con más o menos que la cabecera queda INVALID con un mensaje en español.
    - Un archivo que no es UTF-8 se rechaza con `IMPORT_ENCODING`.
    - Esto rige para estudiantes y para docentes.
  - Listado de usuarios:
    - La búsqueda incluye el código universitario.
    - Cada invitación pendiente informa `expiresAt` y `expired`, leídos en una sola consulta del último token de activación vigente.
- **Web:**
  - Los conteos y estados de importación se normalizan en `importsService` (C1).
  - Etiqueta «Falló» con el motivo.
  - Confirmar avisa cuántas filas quedan fuera y el aviso final muestra el resumen completo.
  - Componentes compartidos `usePaginacion`, `useOrden`, `ThOrden` y `Paginacion` (10 filas, anterior/siguiente, páginas, contador), aplicados a:
    - el listado de usuarios;
    - la previsualización;
    - el historial;
    - el detalle de un lote.
  - Usuarios:
    - Búsqueda con debounce, sin Enter, y «Limpiar» siempre visible.
    - Estado Pendiente / Caducada / Activa.
    - «Invitación enviada · Expira: …».
  - `.table-scroll` pasa a ser posicionado, para que el texto solo para lectores de pantalla no ensanche la página a 375 px.
- **Pruebas:**
  - B10.36 compara contra el total real de la carrera en lugar del tope fijo de 900.

**Migraciones:** `1780600000000-V32ImportHistory`. Agrega el valor de enum `failed` y la columna `failure_reason`. El `down` recrea el enum sin `failed` (los lotes fallidos pasan a `discarded`). Probada en orden `run → revert → run`. Respaldo previo: `pg_dump` en el scratchpad (17 MB).

**Archivos modificados:**
- `shared/src/enums/identity.enum.ts`
- `api/src/entities/import-batch.entity.ts`
- `api/src/imports/{csv.parser,imports.service,teacher-import.service}.ts`
- `api/src/users/{users.service.ts,types/public-user.ts}`
- `api/src/database/migrations/1780600000000-V32ImportHistory.ts`
- `api/test/unit/imports.test.ts`
- `web/src/components/ui.tsx`, `web/src/index.css`
- `web/src/pages/admin/{Imports,Users}.tsx`
- `web/src/services/{index,types}.ts`
- `scripts/e2e-v3-2.mjs` (nuevo), `scripts/e2e-batch-10.mjs`
- `.env.example`

**Pruebas ejecutadas:**
- `shared` build, `tsc` de API y web, build de la web.
- Unitarias: **107/107**. Hay 8 nuevas: columnas, codificación, comillas, resumen, lote FAILED sin correos y recorte del motivo.
- Suite `e2e-v3-2 batch1`: **25/25**. Cubre:
  - 200 existentes + 10 nuevos;
  - un conflicto que no bloquea a la fila nueva;
  - columna faltante o sobrante, en estudiantes y docentes;
  - duplicados de correo y de código dentro del archivo;
  - CSV que no es UTF-8;
  - previsualización fuera del historial, descarte que borra y nueva subida del mismo archivo;
  - historial solo `applied`/`failed`, con auditoría solo al aplicar;
  - búsqueda por código y vencimiento de la invitación;
  - 403 para un estudiante.

**Resultados:**
- Regresión completa: **1846 correctas y 1 fallo**.
- El fallo, WEB.22 (la grilla de usuarios a 375 px), se corrigió con `.table-scroll` posicionado. Al repetir `e2e-web` dio 38/38.
- Total final: **1847 correctas, 0 fallos**.

**Regresiones:** ninguna.

**Pendientes:** los estados FAILED solo se provocan en las pruebas unitarias; forzarlos de punta a punta exigiría romper la base. La paginación del resto de grillas se hace en los batches de cada módulo.

**Riesgos:** `IMPORT_PREVIEW_TTL_HOURS` borra las previsualizaciones viejas al abrir la pantalla o al subir otro archivo, no con un temporizador. Una previsualización de hace 23 h sigue disponible.
