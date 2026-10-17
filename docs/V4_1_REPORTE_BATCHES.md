# Afinia V4.1 — Reporte por batch

Formato del §25 del contrato `AFINIA_CONTRATO_UNICO_CONSOLIDADO_V4_V4_1_CLAUDE_2026-10-16.md`.

- **Hallazgos:** [`AUDITORIA_GAP_AFINIA_V4_1.md`](../AUDITORIA_GAP_AFINIA_V4_1.md)
- **Plan:** [`PLAN_BATCHES_AFINIA_V4_1.md`](../PLAN_BATCHES_AFINIA_V4_1.md)

---

## BATCH V4.1-0 — Inspección Git, baseline, comparación

| | |
|---|---|
| **Rama real** | `feature/afinia-v4-1-cierre`, creada desde `feat/afinia-v3-2` |
| **Commit base** | `8110245` |
| **Estado Git antes** | Limpio en archivos rastreados. Sin seguimiento: el contrato y `scripts/demo-60.ps1` y `scripts/demo-objetivo-6.mjs` (del usuario; no se commitean). |
| **Commit** | `3f8c8fe docs(v4.1-batch-0): …` |

- **Gaps verificados:** los 30 ajustes A41 clasificados con evidencia (sondas contra la API real y código con rutas), en `AUDITORIA_GAP_AFINIA_V4_1.md`.
- **Pruebas:** unitarias 130/130 sobre la base.
- **Cambios de código:** ninguno.

---

## BATCH V4.1-1 — Activación, validaciones, grillas y UX básica

| | |
|---|---|
| **Rama real** | `feature/afinia-v4-1-cierre` |
| **Commit base** | `3f8c8fe` |
| **Estado Git antes** | Limpio en archivos rastreados; los mismos tres archivos sin seguimiento. |

**Gaps verificados:**

| ID | Antes | Después |
|---|---|---|
| A41-001 | DEFECT_CONFIRMED (código) | Corregido |
| A41-002 | DEFECT_CONFIRMED | Corregido |
| A41-003 | PARTIAL | Corregido |
| A41-004 | DEFECT_CONFIRMED (sonda: `123123` / `!@#$%^&` / `____` → 201) | Corregido |

**Preservado (sin tocar):**
- política de activación y recuperación, cooldown, tokens, correo y sesión;
- la pestaña «Tengo el enlace» (A.2);
- búsqueda, alta, baja y reactivación de Categorías y Recursos;
- paginación existente de la gestión de actividades;
- el bloqueo de URL duplicada.

**Archivos modificados:**

| Archivo | Cambio |
|---|---|
| `web/src/App.tsx` | `key` distinta en `/activar/solicitar` – `/recuperar` y en `/activar` – `/restablecer`, para que React no reutilice la instancia con el estado anterior (A41-001) |
| `web/src/pages/admin/AreasSkills.tsx` | Se quitó «(V3.2 §10)» del texto de ayuda (A41-002) |
| `web/src/pages/admin/ActivityCategories.tsx` | Orden por columna y 10 por página (A41-003) |
| `web/src/pages/director/LearningResources.tsx` | Igual, en la vista de recursos de Dirección y Admin (A41-003) |
| `web/src/components/ActivityManager.tsx` | Orden por columna en la gestión, que ya paginaba (A41-003); validación del aula debajo del campo, también en borrador (A41-004) |
| `web/src/lib/validators.ts` | `placeName`, la misma regla que la API (A41-004) |
| `web/src/index.css` | `.scroll-x` con `position: relative` (ver «Fallo → causa → corrección») |
| `api/src/common/validation.ts` | `IsPlaceName`: al menos una letra Unicode; letras, números y puntuación razonable (A41-004) |
| `api/src/activities/dto/create-activity.dto.ts` | `@IsPlaceName()` en `location`; crear y editar comparten el DTO (A41-004) |
| `api/src/audit/audit.service.ts` | Filtro de fechas de la auditoría en hora de Bolivia (ver «Fallo → causa → corrección», punto 3) |
| `scripts/e2e-v4-1.mjs` | Suite nueva de la API para V4.1 |
| `scripts/e2e-web.mjs` | Casos WEB.41.1–41.10 |
| `package.json` | Script `test:v41`, incluido en `test:all` |

**Migraciones:** ninguna.

**Pruebas y comandos ejecutados:**
- `node scripts/e2e-v4-1.mjs` → **13/13**:
  - B03: «Aula 201», «Laboratorio B-12», «Auditorio Principal», «Torre Académica, piso 4» y «Salón Ñandú» se aceptan;
  - B04: «123123», «!@#$%^&», «____» y «12-34» se rechazan en su campo, y solo espacios no se guarda;
  - la misma regla al editar;
  - una actividad virtual no necesita aula.
- `node scripts/e2e-web.mjs` → **60/60**, incluidos:
  - WEB.41.1 (B01): «Olvidé mi contraseña» desde una cuenta activa abre `/recuperar` limpio;
  - WEB.41.2: sin nombres internos;
  - WEB.41.3–41.6 (B02): Categorías de a 10, orden que invierte, página 2 desde el registro 11, filtro que vuelve a la página 1;
  - WEB.41.7 y 41.8: Recursos y Actividades ordenables;
  - WEB.41.9 (B04): error del aula debajo del campo;
  - WEB.41.10: sin errores de JavaScript.
- **Regresión completa (22 suites):** 2062 correctas, 1 fallo (V32.18.7). Corregido el defecto y repetida su sección (14/14): **2063 correctas, 0 fallos**.

**Fallo → causa → corrección → regresión:**
1. **WEB.22, Sociedad en 375 px → FAIL** (la página se desbordaba 447 px).
   - *Causa:* el `<span className="sr-only">` nuevo de la columna de acciones es `position: absolute`, y el contenedor `.scroll-x` no tenía `position: relative`, así que el span escapaba del desplazamiento.
   - *Corrección:* `.scroll-x { position: relative }`, como ya hacía `.table-scroll`.
   - *Regresión:* WEB.22 PASS en los tres actores.
2. **WEB.41.4 → FAIL** por el tutorial de bienvenida, que tapaba la página en un perfil de navegador nuevo. Era un error de la prueba, no del producto.
   - *Corrección:* la prueba lo cierra con «Omitir», como las demás.
   - *Regresión:* PASS.
3. **V32.18.7, filtro de fechas de la auditoría → FAIL** en la regresión (0 eventos «de hoy»). Es un defecto del V3.2 (B18) que dependía de la hora: apareció al correr a las 23:36 de Bolivia.
   - *Causa:* `:desde::date AT TIME ZONE 'America/La_Paz'`. Con un `date`, Postgres lo convierte primero a `timestamptz` en UTC y después a hora local, así que la ventana del día quedaba corrida 8 horas. Verificado en la base: daba `2026-10-15 20:00` en lugar de `2026-10-16 04:00 UTC`.
   - *Corrección:* `(:desde::date)::timestamp AT TIME ZONE 'America/La_Paz'`, y lo mismo en `hasta`. No hay otras ocurrencias del patrón en la API.
   - *Regresión:* `e2e-v3-2 batch16` 14/14 a la misma hora.

**Efecto:**
- **Backend:** validación nueva en `location`. Ningún dato existente se modifica. Las suites y semillas solo usan lugares válidos (verificado).
- **Frontend:** las grillas y el formulario cambian como se describe arriba.
- **Móvil:** sin cambios (no edita actividades).

**Seguridad y permisos:** sin cambios. La regla del aula se aplica en la API, no solo en la web.

**Contrato y documentación:**
- `400` con `fields.location` para un aula sin letras;
- `test:v41`;
- este reporte.

**Pendientes:** ninguno de A41-001…004.

**Riesgos:**
- Si una actividad antigua tiene un lugar sin letras y alguien la edita, tendrá que corregirlo antes de guardar.
- En la base de desarrollo hay **3** actividades así, y son las creadas por las sondas del BATCH 0 («V41 Sonda …»). No hay datos reales afectados.
- No se modifican los datos guardados.

**Commit propuesto:** `fix(v4.1-batch-1): recuperar desde cuenta activa, grillas ordenables de 10 y aula con contenido reconocible`
