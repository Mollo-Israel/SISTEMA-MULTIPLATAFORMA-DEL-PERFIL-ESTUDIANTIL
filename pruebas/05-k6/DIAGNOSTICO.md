# Diagnóstico del FAIL de k6 (corrida 1)

**Síntoma:** umbral `http_req_duration{tipo:crud}` p(95) < 3000 ms no cumplido: p95 = 4,52 s (corrida-1-fallo/).

## 1. Qué endpoint

Medición individual con la API de pruebas (base `afinia_test` recién creada):

| Endpoint | Tiempo |
|---|---|
| `GET /activities?status=open&limit=30` | **~1.800 ms** (19 actividades) |
| resto (`/profiles/me/summary`, `/affinity/me/summary`, `/recommendations/me`, `/trajectory/me`, …) | 7–80 ms |

## 2. Dónde, dentro del endpoint

Instrumentación de `ActivitiesService.findPage` con Jest: **1.776 de 1.816 ms** eran `repository.find()` con cinco relaciones en un solo JOIN.

Cada relación por separado tardaba ~5 ms. La misma consulta con `relationLoadStrategy: 'query'` tardaba 26 ms.

## 3. Primera corrección y regresión (FAIL)

- **Primera corrección:** se cargaron las relaciones por consultas separadas en todos los listados. k6 pasó (corrida-2-correccion/).
- **La regresión de las 22 suites propias detectó un FAIL nuevo:** con la base de desarrollo, que tiene **10.104 actividades**, `GET /activities/managed` dejó la API al 100 % de CPU. TypeORM unía en memoria miles de filas.
- **Se corrigió la corrección:** las consultas separadas se usan solo para una página (≤ 30 ids); la lista completa vuelve al JOIN original.

## 4. Causa raíz (reproducida)

Misma consulta JOIN, base recreada desde cero:

| Medición | Base recién creada (sin estadísticas) | Tras `ANALYZE` |
|---|---|---|
| Dirección · lista completa | 1.736 / 1.679 / 1.521 ms | 26 / 25 / 24 ms |
| Dirección · gestionadas | 1.607 / 1.584 / 1.484 ms | 23 / 24 / 23 ms |

Sin estadísticas del planificador, PostgreSQL estima un costo enorme para el JOIN de cinco tablas y elige un mal plan. Con `jit = on` y `jit_above_cost = 100000`, probablemente además compila JIT. Ocurre en una base nueva, tras una migración, una restauración o una importación masiva, hasta que pasa el autovacuum.

## 5. Correcciones finales

1. **Entorno:** `scripts/pruebas/entorno.mjs reconstruir` ejecuta `ANALYZE` al terminar de sembrar.
2. **Código:** `activities.service.ts`, la página del listado (≤ 30) carga sus relaciones por consultas separadas. Así es rápido con o sin estadísticas. La lista completa conserva el JOIN.
3. **Recomendación de despliegue:** ejecutar `ANALYZE` después de migrar, restaurar o importar.

**Regresión final:** corrida-3-final/ (k6) y las 22 suites propias (pruebas/10-regresion-suites-propias).
