# BASELINE DE REINGENIERÍA — AFINIA 100 %

**Entregable del BATCH 0** (§125 de `AFINIA_100_ESPECIFICACION_DEFINITIVA.md`).
**Fecha:** 20 de septiembre de 2026
**Rama de reingeniería:** `feat/afinia-100`
**Punto de partida:** `810c19a`

Este documento congela el estado del sistema **antes** de aplicar la
especificación definitiva. Sirve para tres cosas: saber qué había, poder volver
atrás y poder demostrar después qué cambió y por qué.

---

## 1. Estado verificado del punto de partida

Todo lo de esta sección se ejecutó, no se asumió.

### 1.1. Compilación

| Paquete | Comando | Resultado |
|---|---|---|
| `api` | `tsc --noEmit` | limpio |
| `web` | `tsc --noEmit && vite build` | limpio |
| `mobile` | `tsc --noEmit` | limpio |

### 1.2. Regresión

Ejecutada contra la API en `http://localhost:3010/api`:

| Suite | Resultado |
|---|---|
| `test:40` — objetivos 1 a 4 | 235 verificaciones · 0 fallos |
| `test:50` — objetivo 5 | 112 verificaciones · 0 fallos |
| `test:60` — objetivo 6 | 82 verificaciones · 0 fallos |
| `test:70` — objetivo 7 | 84 verificaciones · 0 fallos |
| **Total** | **513 · 0 fallos** |

### 1.3. Migraciones

12 migraciones, todas aplicadas, ninguna pendiente. `synchronize=false`.

```
InitialSchema
RenameRoleValues
AddImprovementAreas
AddActivityFields
RefactorProjects
RefactorEvidenceTables
Objective1AccessAndCatalogs
Objective4EvidenceAndConstancies
Rf4CategoriesAndRf5FreeInterests
Objective5Portfolio
Objective6AffinityEngine
Objective7Recommendations
```

### 1.4. Superficie actual

| Métrica | Valor |
|---|---|
| Entidades | 26 |
| Tablas en base | 26 (+ `migrations`) |
| Endpoints | 106 |
| Controladores | 16 |

### 1.5. Datos vivos en la base

Hay datos útiles: **no se resetea la base como estrategia** (§0.6, §71).

| Tabla | Filas |
|---|---|
| `users` | 230 |
| `student_profiles` | 127 |
| `projects` | 91 |
| `activities` | 141 |
| `affinity_results` | 214 |
| `recommendations` | 144 |

### 1.6. Respaldo lógico

```
backups/baseline-pre-afinia100-20260920.sql   (776 KB, pg_dump --clean --if-exists)
```

---

## 2. Inventario de diferencias contra la especificación

Clasificación según §0.4: **conservar · refactorizar · extender · sustituir · eliminar**.

### 2.1. Conservar — ya cumple

| Elemento | Referencia |
|---|---|
| Monolito modular NestJS + TypeORM, `synchronize=false`, migraciones con `up`/`down` | §7, §71, §113 |
| `TeacherScopeService` como fuente única (perfiles, proyectos, constancias, afinidad) | §108 |
| Visibilidad de proyecto aplicada en backend (`assertCanView`) | §106 |
| Guards globales `JwtAuthGuard → RolesGuard` + `ValidationPipe` estricto | §107 |
| Puertos `AFFINITY_RECALCULATION` y `STORAGE_PORT` | §109 |
| Invitación → aceptación crea membresía efectiva | §33 |
| Constancia interna única por estudiante+actividad | §24 |
| Retroalimentación docente con scope, explícitamente no es nota | §40 |
| Contribuciones y snapshots de afinidad persistidos | §56 |
| `persist()` transaccional | §75 |
| `peer_discoverable` como consentimiento previo | §62 |
| 513 verificaciones E2E con autorización negativa | §87.1 |

**La arquitectura objetivo de la especificación es la que ya existe.** No se reescribe el proyecto.

### 2.2. Hallazgos críticos

#### H1 — Los reportes docentes no filtran por scope

`api/src/reports/reports.controller.ts` — los tres endpoints `teacher/*` no reciben
`@CurrentUser` y los métodos del servicio no aceptan parámetros:

```ts
this.profiles.count()          // todos los perfiles de la carrera
this.incompleteStudents()      // devuelve lista nominal
this.affinityEngine.basicMap() // mapa de afinidad de toda la carrera
```

Un docente habilitado solo en un semestre recibe hoy nombres de estudiantes de
toda la carrera. Viola §68 y el criterio de aceptación §139.

#### H2 — Archivos servidos estáticamente

`api/src/main.ts:19`

```ts
app.useStaticAssets(LocalStorageDriver.resolveRoot(config), { prefix: '/api/files/' });
```

Conocer la URL basta para descargar. Es el hallazgo que §83 ordena corregir.

#### H3 — Registro público activo

`POST /auth/register` crea cuentas `STUDENT`. §9.1 lo elimina.

#### H4 — Sesiones sin refresh ni revocación

Un único `jwtService.sign(payload)`. Sin `auth_sessions`, sin rotación, el
logout no revoca nada. §14, RNF03.

#### H5 — Sin protección de abuso

Sin `helmet`, sin `Throttler`, sin rate limit. §15, §84.

### 2.3. Motor de afinidad — V1 frente a V2

| Aspecto | Actual (V1) | Spec V2 | Acción |
|---|---|---|---|
| Normalización | relativa al área más fuerte del estudiante + pisos 6/3 | `round(min(100, RAW/60*100))`; §52 prohíbe la relativa | sustituir |
| `SUPPORT_SCORE` | no existe | 0..100 obligatorio (§49, §53) | crear |
| `SUPPORT_LEVEL` + regla de diversidad | no existe | §54 | crear |
| Rendimientos decrecientes | no existen | §51 | crear |
| Caps por familia | no existen | 14/10/24/12 (§51) | crear |
| Área de mejora | +1.00 | **0** (§20, §50, §122) | corregir |
| `activity_interested` / `activity_registered` | +1.00 / +2.00 | no participan (§50) | corregir |
| Base de proyecto | fija +5.00 | por backing tier 2/6/10/12/0 (§51.3) | sustituir |
| Base de certificado | fija +4.00 | por backing tier 1/3/6 (§51.4) | sustituir |
| Versión | hash sha256 | `AFFINITY_ENGINE_VERSION=2` (§56) | refactorizar |

Los pesos V2 dependen de backing tiers que aún no existen: **BATCH 6 no puede
ejecutarse antes que 3, 4 y 5.**

### 2.4. Estructuras ausentes (§73)

~24 tablas nuevas sobre las 26 existentes:

| Paquete | Ausente |
|---|---|
| Identidad | `import_batches`, `import_batch_rows`, `account_tokens`, `auth_sessions` |
| Onboarding | `onboarding_runs`, `onboarding_answers` |
| Actividades | `activity_skills`, `semester_scope` |
| Proyectos | `project_member_skills`, `project_repository_checks`, `project_link_checks`, backing tier, bitácora |
| Validación | `validation_records` |
| Colaboración | `contact_requests`, `contacts`, `team_needs`, `teams`, `team_members`, `team_invitations`, `conversations`, `conversation_members`, `messages` |
| Perfil público | `public_profile_slug`, `public_profile_enabled`, `public_visibility_config` |
| Gamificación | `gamification_events`, `badges`, `student_badges` |
| Recursos | `resources` (§61) |
| Auditoría | `audit_events` |

Paquetes funcionales completamente ausentes: onboarding (§16), validación /
OCR / link-check / GitHub (§26–§39), colaboración / QR / equipos / mensajería
(§43–§47), gamificación real (§66), export de trayectoria (§67).

Otros faltantes: `availability` y `collaboration_preferences` en el perfil
(§17.2); máquina de estados de actividad (§22); el Docente no figura como
gestor de actividades —`MANAGER_ROLES` es `[CAREER_DIRECTOR, SCIENTIFIC_SOCIETY,
ADMIN]`— cuando §22 se lo exige dentro de su scope.

`.env.example` declara 19 variables; §100 define ~30.

---

## 3. Riesgo conocido que condiciona el orden

**Eliminar el registro público rompe las 513 verificaciones.** Las suites lo
usan 13 veces:

| Suite | Llamadas a `/auth/register` |
|---|---|
| `test:40` | 9 |
| `test:50` | 1 |
| `test:60` | 2 |
| `test:70` | 1 |

El BATCH 1 debe migrar las suites a un *fixture* de provisionamiento +
activación en el mismo batch. De lo contrario la regresión queda inservible
justo cuando más se necesita.

---

## 4. Decisiones de orden adoptadas

Ninguna cambia una regla de la especificación; solo el momento de aplicarla.

1. **H1 y H2 se corrigen en el BATCH 1**, no en el 10 y el 3. Son las dos fugas
   de datos reales y se resuelven con poco código. Los BATCH 3 y 10 conservan lo
   que las amplía.
2. **BATCH 6 se ejecuta después del 5**, porque los pesos V2 se definen sobre
   backing tiers que nacen en los BATCH 3 y 5.

---

## 5. Cómo volver atrás

```bash
git checkout feat/mejoras-ux          # estado previo a la reingeniería
docker exec -i perfil_postgres psql -U perfil_user -d perfil_estudiantil \
  < backups/baseline-pre-afinia100-20260920.sql
```

---

## 6. Incidencias registradas (§0.8)

Contradicciones del documento de grado detectadas antes de esta reingeniería.
Se registran, no se corrigen por cuenta propia:

- Figuras 2.29 y 2.30 colocan el camino de éxito dentro de la rama `alt`
  rotulada como «datos insuficientes».
- La Figura 2.12 contradice a la Tabla 2.23.
- Las Figuras 2.3 y 2.11 contienen elementos sin RF que los respalde.
