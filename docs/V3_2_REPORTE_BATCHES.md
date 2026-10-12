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
