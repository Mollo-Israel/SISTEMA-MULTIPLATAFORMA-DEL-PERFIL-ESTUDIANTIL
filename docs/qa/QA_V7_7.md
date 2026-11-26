# Informe BATCH V7-7 — Proyectos: activación y coherencia de tecnologías

Formato del contrato V7.1 §17.

## BATCH / rama / commit base / commit resultante

V7-7 · `feature/afinia-v7-cierre-final`. Base: `07beabe` (V7-6). El commit resultante es el que contiene este informe.

## Requisitos y páginas

- **Contrato:** §8.1 (activación) y §8.2 (señales de GitHub, chips y alta de tecnología), pp. 7, 12, 25–27.
- **Matriz:** P01–P12.
- **Hallazgos GAP:** PROY-01, 02, 04, 05 y 07. PROY-03, 06 y 08 ya estaban correctos y se prueban aquí.

## Decisiones Dxx confirmadas

Ninguna específica. Se conservan los mínimos de V6: título, área, tecnología del catálogo, repositorio público, invitaciones resueltas, contribuciones confirmadas y evidencia o demo. No se quitó ningún requisito para que el botón se habilite (§8.1).

## Estado previo y reproducción

Contra V7-6, en la API y la web aisladas:

| Escenario | Antes (V7-6) |
|---|---|
| P07 (PROY-04) | GitHub detectó la tecnología **antes** de que se declarara. Al elegirla, quedaba `declared` (gris) hasta un escaneo nuevo |
| P08 (PROY-05) | Una señal con un alias del catálogo («aliasq…» de «Canonica…») no respaldaba la tecnología |
| P01 (PROY-01) | La API devolvía `skill_per_area` con el nombre del área, pero la lista de la web **no tenía esa fila**: todo en verde y el botón deshabilitado |
| PROY-02 | La lista se pedía solo al montar el componente |
| P11 (PROY-07) | Las evidencias del proyecto tenían un enlace rojo «Abrir» hacia el archivo, sin la sesión |

## Ya estaba correcto (sin cambios)

- P09: con otro repositorio, `syncSkillEvidence` ya ignoraba la señal anterior. Ahora también la tabla de tecnologías.
- P01 en la API: el motivo nombra el área.
- P12: la galería «Proyectos de la carrera» lista solo los activos visibles y un borrador ajeno no se abre.
- PROY-03 (borrador incompleto; GitHub caído = aviso que no bloquea) y PROY-06 (estados y sugerencias con procedencia).

## Cambios exactos y archivos

**shared**
- `enums/project-readiness.ts` (nuevo): `PROJECT_READINESS_ROWS` y `filaDeRequisito`. Cada código que la API puede devolver pertenece a una fila, incluida «Cada área con al menos una tecnología usada en ella».

**API**
- `projects.service.ts`:
  - `syncSkillEvidence`: toda señal **con fuente** del repositorio **actual** respalda la tecnología declarada, tanto «detectada» como «ambas» (P07). Coincide por nombre o por **alias exacto** del catálogo, nunca por subcadena (P08).
  - `senalesVigentes`: la tabla de tecnologías no usa la señal de un repositorio anterior (P09) y reconoce los mismos alias que el chip.
- `repository-inspector.service.ts`: `recruzar` acepta el mapa de alias; `normalizar` es público para usar la misma normalización.

**Web**
- `ProjectReadiness.tsx`:
  - la lista espeja `PROJECT_READINESS_ROWS`, con la fila `skill_per_area`;
  - un código desconocido se muestra en su propia fila;
  - se vuelve a pedir cada vez que cambia el proyecto (`refreshKey`).
- `student/Projects.tsx`: las evidencias se listan sin «Abrir» y se consultan, con la sesión, desde «Evidencias».

**Móvil**
- Sin cambios: ya mostraba todos los motivos de la API y volvía a pedir el estado en cada carga.

## Migraciones / datos preservados / compatibilidad web-móvil

- Sin migraciones.
- Las tecnologías de los proyectos existentes se reconcilian solas la próxima vez que cambia el proyecto o su repositorio. No hay reproceso masivo, porque no cambia la afinidad por el número de detecciones (§8.2).

## Pruebas ejecutadas (comando, resultado, evidencia)

| Comando | Resultado |
|---|---|
| `e2e-v7.mjs batch7` contra V7-6 | 3 / 5 (reproducción de P07 y P08) |
| `e2e-v7-web.mjs batch7` contra la web de V7-6 | 1 / 3 (reproducción de P01 y P11) |
| `e2e-v7.mjs batch7` | **5 / 5** |
| `e2e-v7-web.mjs batch7` | **3 / 3** |
| `api/test/unit/v7-proyectos.test.ts` (paridad de códigos API, shared y web) | **4 / 4** |

## PASS / FAIL / BLOCKED / NE

| Escenario | Resultado | Evidencia |
|---|---|---|
| P01 Individual con checklist | **PASS** (motivo concreto visible; ninguna falta oculta) | V7.7.4 · W7.7.1 · unit |
| P02–P05 Equipo, evidencia o demo | **PASS**, regresión sin cambios | `e2e-v6`, `e2e-v4-1` batch9 |
| P06 Declarada antes del escaneo | **PASS** (regresión) | `e2e-v4-1` batch10 |
| P07 Detectada antes de declarar | **PASS** | V7.7.1 |
| P08 Alias del catálogo | **PASS** | V7.7.2 |
| P09 El repositorio cambia | **PASS** | V7.7.3 |
| P10 Dos integrantes con la misma tecnología | **PASS** (regresión) | `e2e-v6` |
| P11 Sin «Abrir» en evidencias | **PASS** | W7.7.2 |
| P12 Tercero | **PASS** | V7.7.5 |

## Regresiones verificadas

Corrida limpia (base reconstruida), sin fallas nuevas:
- `e2e-v7` **98 / 0** · `e2e-v6` **98 / 0** · `e2e-v5` **135 / 0** · `e2e-v2` **162 / 0** · `e2e-qa` **68 / 0**.
- Objetivos y `batch-1…11`: sin fallas, salvo B6.47.
- Jest **197 / 197** · unitarias **224 / 224**.
- Web: `e2e-web` **106 / 0** · `e2e-v6-web` **63 / 0** · `e2e-v7-web` **41 / 0** · `e2e-web-gestion` **47 / 0**.
- `tsc` sin errores en API, web y móvil.

Quedan solo las fallas previas de datos: V41.10.1–2, V3.2.15, `e2e-v3-2` (10) y B6.47.

## Riesgos o limitaciones

- La lista de requisitos de la web es un espejo de la de `shared`, porque la web no usa el paquete. Una prueba unitaria compara las dos.

## Pendientes y siguiente batch propuesto

- **Decisiones del usuario:** migrar la base de desarrollo y autorizar o no el recálculo D04.
- **Siguiente batch: V7-8**, afinidad y recomendador explicados (D04 y D06, sin recalibrar pesos).
