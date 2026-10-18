# Afinia V4.1 — QA integral, seguridad y documentación (BATCH V4.1-14)

**Rama:** `feature/afinia-v4-1-cierre`. `main` no se tocó: es ancestro de la rama (fusión fast-forward, sin conflictos). No se hizo push.

## 1. Compilación

| Paquete | Comando | Resultado |
|---|---|---|
| shared | `npm run shared:build` | OK |
| API | `npx tsc --noEmit -p api/tsconfig.json` y `npm --prefix api run build:e2e` | OK, sin errores |
| Web | `npx tsc --noEmit -p web/tsconfig.json` y `npm --prefix web run build` | OK (solo el aviso habitual de tamaño de chunk) |
| Móvil (Expo) | `npx tsc --noEmit -p mobile/tsconfig.json` | OK |

## 2. Pruebas

- **Unitarias:** `npm --prefix api run test:unit` → **141/141**.
- **E2E (22 suites, API real y Postgres):** `scratchpad/regress.sh` → **2254 comprobaciones correctas, 0 fallos** (18/10/2026).
- **`e2e-v4-1.mjs`:** una sección por batch, de V4.1-1 a V4.1-13. Cada prueba cita el ajuste (A41-xxx) o el caso del contrato (Bxx, 23.x) que verifica.
- **`e2e-web.mjs`:** Playwright con Edge. Incluye WEB.41 a WEB.52 para V4.1, más el control de desplazamiento horizontal en teléfono.

## 3. Migraciones (todas aditivas, con `up` y `down`, `pg_dump` previo y probadas `run → revert → run`)

| Migración | Batch | Respaldo previo |
|---|---|---|
| `1780700000000-V41ActivityImages` | 2 | `pre-v41-b2.dump` |
| `1780710000000-V41AttendanceSettlement` | 4 | `pre-v41-b4.dump` |
| `1780710000001-V41PointsReversal` | 4 | `pre-v41-b4.dump` |
| `1780720000000-V41ResourceReview` | 5 | `pre-v41-b5.dump` |
| `1780730000000-V41GamificationCriteria` | 7 | `pre-v41-b7.dump` |
| `1780740000000-V41CredentialValidation` | 8 | `pre-v41-b8.dump` (en `down`, los valores del enum se conservan: PostgreSQL no los quita) |
| `1780750000000-V41GithubProvenance` | 10 | `pre-v41-b10.dump` |

**Recálculo de datos:** uno solo, el del respaldo de proyectos (V4.1-10). Se ejecutó en seco, luego se aplicó y quedó auditado (`PROJECT_BACKING_RECALCULATED`): 535 de 3541 proyectos cambiaron, con informe antes/después.

## 4. Seguridad y rutas negativas (muestras verificadas)

- **401 sin sesión, 403 o 404 por rol o propiedad:**
  - estudiante → tabla de puntos, criterios, revisión de credenciales, pedidos de tecnologías y recálculo de respaldo;
  - docente → aprobar propuestas o revisar credenciales;
  - integrante → editar el proyecto o excluir a otros;
  - ajeno → proyecto privado.
- **SSRF:**
  - URLs y QR hacia red interna, IP privadas o metadata de nube se **bloquean** (V3.9.9, V3.9.10, V41.8.7);
  - el único origen de prueba permitido es `LINK_CHECK_TEST_ORIGINS`, que se ignora en producción.
- **Subidas:**
  - deduplicación por sha256 por usuario;
  - archivos protegidos con la sesión (V3.2);
  - acceso de Dirección a un documento solo con una revisión pedida (V3.9.21, V3.9.26).
- **Privacidad:**
  - un borrador no aparece en el perfil público ni por enlace (V41.12.1, V41.12.3);
  - el resumen público no expone correo ni identificadores (V41.12.4).
- **Auditoría nueva:**
  - `GAMIFICATION_PROPOSED`, `GAMIFICATION_PROPOSAL_REVIEWED` y `GAMIFICATION_SCOPE_VIEWED`;
  - `RESOURCE_PROPOSED` y `RESOURCE_REVIEWED`;
  - `PARTICIPATION_CORRECTED` y `ACTIVITY_DUPLICATED`;
  - `SKILL_REQUESTED`, `SKILL_REQUEST_DECIDED` y `PROJECT_BACKING_RECALCULATED`;
  - método, prueba y rol en `EXTERNAL_CREDENTIAL_MANUAL_REVIEWED`.
- **Correo:** las pruebas corren con `MAIL_TRANSPORT=console`; no se imprimieron credenciales SMTP.
- **GitHub:**
  - cuota agotada, 404, 500 inestable y red caída **no concluyen** «privado» ni «falso» (V41.10.10);
  - caché con ETag.
- **CORS, cookies y sesiones:** sin cambios en V4.1. Siguen cubiertos por `e2e-batch-1` y `e2e-batch-11`.

## 5. Configuración

V4.1 no agregó variables de entorno: `.env.example` sigue vigente. Lo verificaron un `diff` de los commits V4.1 y la búsqueda de `config.get` y `process.env`.

## 6. Documentación

- `docs/V4_1_REPORTE_BATCHES.md`: el informe §25 de cada batch.
- `docs/MATRIZ_TRAZABILIDAD_V4_1.md`: A41-001 a A41-030.
- `docs/V4_1_IMPACTO_MOVIL.md`: el impacto en la app móvil.
- `docs/CAMBIOS_DOCUMENTO_GRADO_V4_1.md`: cambios para la tesis (el `.docx` **no** se modificó).
- **Swagger:** cada endpoint nuevo tiene `@ApiOperation` y DTO con validación (`/api/docs` con `SWAGGER_ENABLED`).

## 7. UI obsoleta retirada

- «Retos y recompensas» (web, menú y rutas, con redirección) y la pestaña «Recompensas».
- El campo de puntos libres de la actividad.
- La opción «credencial externa esperada» del resultado interno.
- La preselección automática de todo el currículo.

## 8. Pendientes declarados (no bloquean)

- **BLOCKED:** verificadores reales de Credly/IBM, Cisco NetAcad y Huawei. Ninguno se pudo comprobar con un caso legítimo (acceso, licencia, CAPTCHA, titular visible). Quedan declarados «sin verificador integrado».
- OAuth de GitHub y atribución por commits (§11.5, opcional): no se improvisó su alcance.
- Las mejoras móviles listadas en `docs/V4_1_IMPACTO_MOVIL.md`.
- La sección «Evidencias» del currículo solo existe en la API anterior (no se ofrece en el paso 1 de la web).
- La gamificación ligada a recursos sigue desactivada hasta que exista un hito externo verificable (§9.3, alternativa de menor alcance).
