# QA del cierre V5

Fecha: 28/10/2026. Rama: `feature/afinia-v5-cierre`. Contrato: `AFINIA_CONTRATO_UNICO_V5_CORRECCIONES_CLAUDE_CODE_2026-10-26.md`.

Qué se cerró y dónde está cada cosa: `docs/MATRIZ_TRAZABILIDAD_V5.md`. Qué ajustar en la tesis: `docs/CAMBIOS_DOCUMENTO_GRADO_V5.md`.

## 1. Resultados

| Prueba | Alcance | Resultado |
|---|---|---|
| Regresión completa | 23 suites contra la API de desarrollo: las 22 anteriores y `e2e-v5` | **2390 comprobaciones, 0 fallas** |
| `e2e-v5` | Una sección por batch, cada comprobación con su escenario A01…I07; incluye C07 (V5.4.18–4.21) | **135 / 135** |
| `e2e-web` (Playwright, Edge) | Incluye el alta guiada (WEB.59), la galería (WEB.60), B01 (WEB.61) y F10 (WEB.62) | **106 / 106** |
| Jest + SuperTest | 8 archivos, sobre `afinia_test`; nuevo `afinia-v5-gobernanza.spec.ts` | **69 / 69** |
| Playwright (`pruebas/03-playwright`) | Chromium, Firefox y WebKit; nuevo `pruebas-e2e/05-v5.spec.ts` (galería, alta guiada, recurso completado, autonomía, recursos por semestre, historial de puntos) | **54 / 54** |
| Newman (`pruebas/04-postman-newman`) | Nueva carpeta «05 · Cierre V5» (solo lecturas y rechazos) | 34 peticiones, **70 / 70 aserciones** |
| k6 | Escenario `carga-basica.js` con el grupo V5 (galería, biblioteca, responsables); 25 estudiantes y 2 de Dirección durante 1 min, sobre `afinia_test` | 6830 peticiones, **0 % de fallos**, p95 = **110 ms** (umbral ≤ 3 s) |
| OWASP ZAP (API, pasivo y **activo**) | OpenAPI de la API de pruebas: 246 rutas, incluidas las 11 nuevas de V5; 802 URLs | **0 FAIL, 0 WARN, 119 PASS** |
| Compilación | `tsc` de api, web, móvil y `shared` en cada batch; `vite build` de la web | Sin errores |

La evidencia de k6 y ZAP va en carpetas propias, sin tocar las corridas anteriores: `pruebas/05-k6/corrida-v5/` y `pruebas/06-zap/corrida-v5/`. En ninguno de esos archivos quedan tokens de sesión.

La evidencia de Jest, Playwright, Newman y SonarQube (`pruebas/02`, `03`, `04` y `07`) se regeneró con el estado final del cierre V5: es la que corresponde al sistema entregado.

## 2. Migraciones

Nueve migraciones V5, **todas aditivas**: nada se borra ni se recalcula. Se aplicaron en `perfil_estudiantil` y en `afinia_test`.

| Migración | Qué agrega |
|---|---|
| `V5AdmissionAttendance` | Estado `rejected` y `decision_reason` |
| `V5ActivityFavorites` | Favoritos de actividades |
| `V5Surnames` | Primer y segundo apellido |
| `V5SkillRequestResolution` | Resolución de pedidos (`alias` / `new_skill`) |
| `V5MemberRoles` | `roles[]` de los integrantes |
| `V5ResourceFile` | Enlace o archivo en recursos (CHECK) |
| `V5ApprovalPolicies` | Autonomía docente y `policy_id` |
| `V5GamificationFamilies` | Disparador nuevo y criterio, quién otorgó y quién aprobó en el historial. Desactiva los criterios de las familias retiradas. |
| `V5ProjectImages` | Imágenes de muestra |

`V5GamificationFamilies` agrega un valor a un enum de PostgreSQL. Como ese valor no se puede usar en la misma transacción, la migración confirma la transacción en ese punto y sigue en otra. Reconstruyó con certeza quién otorgó 4202 de los 7927 eventos previos (quién confirmó cada asistencia), y criterio y aprobación de los que vinieron de propuestas. El resto queda en nulo y se muestra como «no registrado».

## 3. Pruebas anteriores que se adaptaron

Se adaptaron porque la V5 cambia la regla, no para que pasen. Ninguna se relajó.

| Prueba | Antes | Ahora (V5) |
|---|---|---|
| V3.19.6, B9.16 | Una colaboración aceptada daba puntos | Ya no suma: es una familia retirada (§10) |
| V41.5.4 | Docente fuera de sus semestres → 400 | → **403** (D06), con el error en su campo |
| B6.31 | Una tecnología ajena al proyecto se guardaba sin sumar | Se **rechaza** con `SKILL_NOT_IN_PROJECT` (V5-20) |
| objective-6 17.9c / 17.12 | El integrante declaraba una tecnología antes de que el proyecto la tuviera | El proyecto la agrega primero |
| WEB.46.2 | «Proponer puntos por un proyecto» | La tarjeta elige proyecto o recurso completado |
| batch-4, objectives-40, v2, batch-10 | Asistencia registrada en eventos futuros | Se reordenaron o adelantaron la fecha: la asistencia solo se registra desde que empieza el evento (C03) |

## 4. Defectos encontrados por la propia regresión

- **El limpiador de huérfanos** no consideraba `activity_images` ni el material de los recursos (`2a07ef2`). Con `ON DELETE CASCADE`, borrar el archivo se llevaba la fila: 71 imágenes de galería en riesgo en desarrollo. Ahora también respeta las imágenes de proyectos.
- **El commit de V5-12** (`cd7664b`) aplicó dos fragmentos de los servicios web en el lugar equivocado al separar los cambios por batch. Se corrigió en `232c8e8`, y se comprobó que cada commit intermedio compila (API y web) en un worktree temporal.
- **Las sugerencias de Python** seguían apareciendo después de aceptarlo (instantánea vieja), y `findEligible` exigía constancias. Ambos se corrigieron en sus batches.

## 5. SonarQube y lo que queda como deuda, dicho claro

SonarQube no es parte del plan V5-17, pero se volvió a correr para completar la evidencia (`pruebas/07-sonarqube/resumen.json`). El código de V5 es «código nuevo» para su Quality Gate. El primer análisis encontró:

- **1 bug nuevo:** `reduce()` sin valor inicial en `gamification.service`. Inofensivo en la práctica (solo se llama con listas no vacías), pero se corrigió.
- **24 incidencias mecánicas:** `role` → `<output>` y `<fieldset>` por accesibilidad, props de solo lectura, una importación duplicada, una función anidada de más, espacios ambiguos y nombres en `catch`. Se corrigieron.
- **69 incidencias de estilo** que **quedan como deuda técnica documentada:** 43 ternarios anidados, 14 funciones con complejidad cognitiva alta y 12 plantillas de texto anidadas. Corregirlas exige reescribir funciones ya probadas, sin cambio de comportamiento; se prefirió no arriesgar regresiones al cierre.

Análisis final, tras las correcciones: **5 bugs (todos anteriores a V5), 1 vulnerabilidad (anterior), 69 incidencias nuevas (solo de estilo)**, duplicación del código nuevo 0,5 %, cobertura total 29,2 %.

La condición «cobertura ≥ 80 % del código nuevo» solo mide Jest. El código de V5 se prueba de extremo a extremo (`e2e-v5`, `e2e-web`, Playwright), y SonarQube no cuenta esas pruebas. Por eso el Quality Gate queda en ERROR por cobertura y por las incidencias de estilo, no por defectos.

Los otros 5 bugs y la vulnerabilidad que reporta SonarQube son anteriores a V5:

- comparaciones de orden en `society/Metrics.tsx`;
- precedencia de expresiones regulares en `dependency-map.ts`;
- un enlace `http` en una plantilla de `mail.service`.

**Observación de rendimiento (anterior a V5):** la base de desarrollo acumula 12 436 actividades de las corridas de pruebas, y para Dirección y Administración `GET /activities/managed` devuelve la lista completa (unos 35 MB en unos 6 s). Con el volumen real de una carrera es mucho menor, pero se recomienda paginar en el servidor también para esos roles, como ya se hace para estudiantes y docentes.

## 6. Decisiones

- **Formatos de recursos:** PDF, PNG, JPG y WEBP. DOCX, PPTX, TXT y MD no se aceptan, porque el puerto de subida reconoce el tipo por la firma del archivo, y abrirlo a esos formatos ampliaría la superficie de todas las subidas. Un documento de Office se publica en PDF o por enlace.
- **Copia del archivo de un recurso:** se sirve como descarga sin `Content-Type` (diseño anterior a V5, por seguridad).
- **Autonomía en actividades:** no se concede (ND-03) hasta que haya una decisión institucional.
- **Revocar una autonomía** no deshace lo hecho. Un ajuste posterior de lo publicado vuelve a revisión, y mientras se revisa deja de verse en la Biblioteca.
- **El descargo del resumen** (§61.4) se conservó literal. El aviso ND-02 va aparte (`TRAJECTORY_SOURCES_NOTICE`).
