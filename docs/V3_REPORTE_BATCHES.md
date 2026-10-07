# Afinia V3.1 — Reportes por batch

Formato de la Especificación Maestra V3.1 §73. Un batch no se declara completo si algo relevante falla.

---

## BATCH 0 — Baseline V3

**ESTADO:** completo

**Objetivo:**
- Inventariar el estado real sin modificar funcionalidad (§72 B0).

**Hallazgos iniciales:**
- Builds de `shared`, `api`, `web` y `mobile` en verde; 38/38 migraciones aplicadas; 36/36 unitarias; regresión de integración del commit base `9c95580`: 1421/0.
- `corregir v2.docx` no está en el repositorio; `corregir.docx` es la auditoría anterior, ya atendida. V3 se toma como fuente única.

**Cambios:**
- `AUDITORIA_GAP_AFINIA_V3.md`: 90 puntos de V3 contrastados con el código (36 implementados, 22 parciales, 11 incorrectos, 20 faltantes, 1 obsoleto) y 20 eventos de auditoría faltantes.
- `PLAN_BATCHES_V3.md`: alcance concreto de cada batch, migraciones probables y dependencias.
- Rama `feat/afinia-v3` creada desde `feat/afinia-v2`.

**Migraciones:** ninguna.

**Archivos:** `AFINIA_ESPECIFICACION_MAESTRA_FINAL_V3_1_2026-10-06.md`, `AUDITORIA_GAP_AFINIA_V3.md`, `PLAN_BATCHES_V3.md`.

**Pruebas ejecutadas:** builds de los cuatro paquetes, `migration:show`, `npm run test:unit`.

**Resultados:** todo en verde.

**Regresiones:** ninguna.

**Decisiones:**
- Contradicciones V2 ↔ V3 resueltas a favor de V3 y listadas en la auditoría (§1 de la V3).

**Pendientes:** batches 1 a 24.

**Riesgos:**
- B6 (modelo unificado de oportunidades) y B14 (Afinidad V4) transforman datos existentes: copia de seguridad antes de migrar y `down` probado.

---

## BATCH 1 — Configuración y reproducibilidad

**ESTADO:** completo

**Objetivo:**
- Que la configuración documentada coincida con la que el código usa, sin cambiar reglas de negocio (§72 B1, RNF08).

**Hallazgos iniciales:**
- 57 variables de entorno leídas por la API; todas documentadas en `.env.example` salvo un alias antiguo.
- `STORAGE_DRIVER=local` estaba documentada, pero el código no la leía: el driver estaba fijo.
- Los ejemplos de la web y del móvil, y el valor por defecto del cliente web, apuntaban a la API en el puerto 3000; la API escucha en `API_PORT=3010`.
- Ya cumplían: `db:wait`, `db:rebuild`, puertos configurables (`API_PORT`, `POSTGRES_PORT`), secretos JWT obligatorios y distintos en producción, `GITHUB_TOKEN` opcional, `AI_PROVIDER=none` por omisión, SMTP con adaptador, `ACTIVATION_CODE_MAX_ATTEMPTS=10`.
- Ningún archivo versionado contiene secretos; `.env`, `web/.env` y `mobile/.env` están ignorados.

**Cambios:**
- `STORAGE_DRIVER` se respeta: `local` es el único valor válido; uno desconocido detiene el arranque con un mensaje claro (`storage-driver.factory.ts`).
- `.env.example` documenta el alias `ACCOUNT_EMAILS_MAX_PER_DAY` y el comportamiento de `STORAGE_DRIVER`.
- `web/.env.example`, `mobile/.env.example` y el cliente web apuntan a `http://localhost:3010/api`.

**Migraciones:** ninguna.

**Archivos:** `api/src/storage/storage-driver.factory.ts`, `api/src/storage/storage.module.ts`, `api/test/unit/rules.test.ts`, `.env.example`, `web/.env.example`, `mobile/.env.example`, `web/src/api/client.ts`, `web/src/services/index.ts`.

**Pruebas ejecutadas:**
- `npm run test:unit`: 38/38 (2 nuevas: driver local y driver desconocido).
- Arranque real de la API con el nuevo selector.
- `scripts/e2e-batch-3.mjs` (almacenamiento y validación): 58/0.
- `tsc` de `api` y `web`.

**Resultados:** todo en verde.

**Regresiones:** ninguna.

**Decisiones:**
- Las suites de integración se corren con `MAIL_TRANSPORT=console`; con SMTP real se niegan a correr para no enviar cientos de correos a direcciones inventadas.

**Pendientes:** ninguno del batch.

**Riesgos:** ninguno nuevo.
