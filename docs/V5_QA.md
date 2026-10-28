# QA del cierre V5

Fecha: 28/10/2026. Rama: `feature/afinia-v5-cierre`. Contrato: `AFINIA_CONTRATO_UNICO_V5_CORRECCIONES_CLAUDE_CODE_2026-10-26.md`.

Qué se cerró y dónde está cada cosa: `docs/MATRIZ_TRAZABILIDAD_V5.md`. Qué ajustar en la tesis: `docs/CAMBIOS_DOCUMENTO_GRADO_V5.md`.

## 1. Resultados

| Prueba | Alcance | Resultado |
|---|---|---|
| Regresión completa | 23 suites contra la API de desarrollo: las 22 anteriores y `e2e-v5` | **2390 comprobaciones, 0 fallas** |
| `e2e-v5` | Una sección por batch, cada comprobación con su escenario A01…I07 | **131 / 131** |
| `e2e-web` (Playwright, Edge) | Incluye el alta guiada (WEB.59) y la galería (WEB.60) | **102 / 102** |
| Jest + SuperTest | 8 archivos, sobre `afinia_test`; nuevo `afinia-v5-gobernanza.spec.ts` | **69 / 69** |
| k6 | Escenario `carga-basica.js` con el grupo V5 (galería, biblioteca, responsables); 25 estudiantes y 2 de Dirección durante 1 min, sobre `afinia_test` | 6830 peticiones, **0 % de fallos**, p95 = **110 ms** (umbral ≤ 3 s) |
| OWASP ZAP (API, pasivo y **activo**) | OpenAPI de la API de pruebas: 246 rutas, incluidas las 11 nuevas de V5; 802 URLs | **0 FAIL, 0 WARN, 119 PASS** |
| Compilación | `tsc` de api, web, móvil y `shared` en cada batch; `vite build` de la web | Sin errores |

La evidencia nueva va en carpetas propias, sin tocar las corridas anteriores:

- `pruebas/05-k6/corrida-v5/` (resumen, reporte HTML, consola);
- `pruebas/06-zap/corrida-v5/` (reporte HTML y JSON, consola).

En ninguno de esos archivos quedan tokens de sesión. Tras correr Jest se restauró `pruebas/02-jest-supertest/reporte/reporte-jest.html`, que es evidencia de la tesis.

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

## 5. Lo que no se cubrió, dicho claro

- **C07** (regularizar asistencia vencida la ventana de 7 días): la regla está en `bloqueoAsistencia`, pero ninguna prueba ejercita el vencimiento.
- **B01** (ida y vuelta Académica ↔ Externa en el formulario) y **F10** (aviso al dejar un área sin tecnologías): se implementaron en la web (`ActivityTabs`, `AreaSkillPicker`), sin una prueba de navegador dedicada.
- **Playwright de `pruebas/03-playwright` y Newman** no se volvieron a correr para este cierre: su evidencia sigue siendo la de la etapa de QA. Los flujos V5 en navegador están en `e2e-web` (WEB.59, WEB.60).
- **SonarQube** no se volvió a correr.

## 6. Decisiones

- **Formatos de recursos:** PDF, PNG, JPG y WEBP. DOCX, PPTX, TXT y MD no se aceptan, porque el puerto de subida reconoce el tipo por la firma del archivo, y abrirlo a esos formatos ampliaría la superficie de todas las subidas. Un documento de Office se publica en PDF o por enlace.
- **Copia del archivo de un recurso:** se sirve como descarga sin `Content-Type` (diseño anterior a V5, por seguridad).
- **Autonomía en actividades:** no se concede (ND-03) hasta que haya una decisión institucional.
- **Revocar una autonomía** no deshace lo hecho. Un ajuste posterior de lo publicado vuelve a revisión, y mientras se revisa deja de verse en la Biblioteca.
- **El descargo del resumen** (§61.4) se conservó literal. El aviso ND-02 va aparte (`TRAJECTORY_SOURCES_NOTICE`).
