# Reporte por batch — Afinia V2

Formato de la especificación V2 §87. Un bloque por batch, en orden.

---

## BATCH 0 — Baseline

**Estado:** completo

**Objetivo:** rama nueva, línea base, inventario y auditoría de brechas.

**Cambios:**
- Rama `feat/afinia-v2` desde `feat/afinia-100` (`6e679cf`).
- `AUDITORIA_GAP_AFINIA_V2.md`: clasificación de cada requisito, 13 contradicciones registradas (C1–C13) y plan por batches.

**Migraciones:** ninguna.

**Pruebas / resultados:** línea base 16 suites, 1213 comprobaciones, 0 fallos; API, web y móvil compilan.

**Pendientes:** los batches 1–17.

**Riesgos:** Docker Desktop se detiene solo en esta máquina; los scripts de base lo detectan y lo dicen.

---

## BATCH 1 — Configuración y reproducibilidad

**Estado:** completo

**Objetivo:** que el entorno se levante igual en cualquier máquina (§10) y que los valores de identidad sean los de §15.3.

**Cambios:**
- Scripts de Docker con `--env-file .env` explícito; nuevos `db:wait` (espera a `pg_isready`, avisa si Docker no corre) y `db:rebuild` (reset → espera → migraciones → seed).
- `.env.example`: `POSTGRES_PORT=5435`, TTL 48 h / 30 min, `ACTIVATION_RESEND_MAX_PER_DAY`, `ACTIVATION_CODE_MAX_ATTEMPTS=10`, bloque `AI_*`, `TEAM_NAME_FORBIDDEN_TERMS`, `HELP_VIDEO_URL`.
- Defaults en código iguales a §15.3; intentos del código configurables (antes constante 5). El nombre anterior `ACCOUNT_EMAILS_MAX_PER_DAY` se sigue aceptando.
- Validación de entorno: `AI_PROVIDER` y sus variables (error en producción, aviso en desarrollo).
- README: scripts, puerto, credenciales del admin desde `.env` (antes contradecía a `.env.example`).

**Migraciones:** ninguna.

**Archivos:** `package.json`, `scripts/db-wait.mjs`, `.env.example`, `README.md`, `api/src/config/identity.config.ts`, `api/src/config/environment.check.ts`, `api/src/identity/account-tokens.service.ts`, `scripts/e2e-qa.mjs`, `docs/CORRECCIONES_QA.md`.

**Pruebas:** `npm run db:wait`; `e2e-qa` (QA.10 48 h; QA.11b 9 intentos no anulan; QA.12 el 10.º sí); `e2e-batch-1`.

**Resultados:** QA 72/72, B1 56/56.

**Regresiones:** ninguna.

**Pendientes:** `db:rebuild` no se ejecutó sobre la base de desarrollo porque borra sus datos; sus pasos (`db:reset`, `db:wait`, `api:migrate`, `seed`) se probaron por separado.

**Riesgos:** el `.env` local sigue con `POSTGRES_PORT=5432` porque su contenedor ya publica ese puerto; cambiarlo exige recrear el contenedor.
