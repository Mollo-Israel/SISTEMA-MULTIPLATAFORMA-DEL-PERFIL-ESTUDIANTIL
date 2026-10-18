# Matriz de trazabilidad · Afinia V4.1

Cada ajuste del contrato (§21, A41-001 a A41-030) aparece con:

- el batch donde se cerró;
- dónde vive en el código;
- las pruebas que lo verifican.

El detalle de cada batch, con sus fallos, causas y correcciones, está en `docs/V4_1_REPORTE_BATCHES.md`.

Las pruebas `V41.N.x` están en `scripts/e2e-v4-1.mjs` (sección `batchN`). Las `WEB.4x` están en `scripts/e2e-web.mjs` (Playwright).

**Estados:**
- **CERRADO:** implementado y probado.
- **CERRADO · BLOCKED parcial:** lo verificable está hecho; lo que depende de terceros no se afirma.
- **VERIFICADO:** ya cumplía; quedó probado.

| ID | Ajuste | Batch | Código principal | Pruebas | Estado |
|---|---|---|---|---|---|
| A41-001 | Recuperar desde la activación lleva a `/recuperar`, sin estado residual | 1 | `web/src/App.tsx` (`key` por modo) | WEB.41.x | CERRADO |
| A41-002 | Sin textos de implementación («V3.2») | 1 | páginas web | WEB.41.x | CERRADO |
| A41-003 | Grillas: orden y paginación (Categorías, Actividades, Recursos) | 1 | `components/ui.tsx` (`usePaginacion`, `useOrden`) | WEB.41.x | CERRADO |
| A41-004 | Aula o lugar con palabras, no basura | 1 | `common/validation` (`IsPlaceName`), `lib/validators` | V41.1.1–1.5 | CERRADO |
| A41-005 | Editar hidrata las habilidades multiárea | 2 | `activities.service` (`findManagedBy`) | V41.2.1–2.2 | CERRADO |
| A41-006 | 0 a 5 imágenes, portada y carrusel | 2 | `activity_images`, `ActivityCard.tsx` | V41.2.x, WEB.42.x | CERRADO |
| A41-007 | DRAFT sin responsable; publicar lo exige | 2 | `assertCompleta` | V41.2.x | CERRADO |
| A41-008 | Borrador privado, bandeja de Dirección, contenido bloqueado al aprobar | 3 | `veBorrador`, `filtrarGestionables` | V41.3.x | CERRADO |
| A41-009 | Responsable ≠ creador; alcance y semestres | 3 | `assertSoloOperacion`, `assertCobertura` | V41.3.x | CERRADO |
| A41-010 | Guardas CLOSED/FINISHED/CANCELLED; fecha futura al publicar | 3 | `assertInicioFuturo`, guardas de reapertura | V41.3.x | CERRADO |
| A41-011 | FINISHED ≠ cierre de asistencia; corrección excepcional auditada | 4 | `closeAttendance`, `correctParticipation` | V41.4.1–4.x, WEB.44.x | CERRADO |
| A41-012 | Tres pestañas por origen | 3 | `ActivityManager.tsx` | WEB.43.x | CERRADO |
| A41-013 | Sin la opción redundante «credencial externa esperada» | 3 | `ActivityManager.tsx` | WEB.43.x | CERRADO |
| A41-014 | Recursos: validación, propuesta docente, «Para ti», favorito sin señal | 5 | `catalogs.service`, `library.service` | V41.5.x, WEB.45.x | CERRADO |
| A41-015 | Interés / mejora / «Me interesa»; «Guardar» sin puntaje; porcentajes honestos | 6 | `recommendations.engine` | V41.6.1–6.8 | CERRADO |
| A41-016 | Criterios fijos, extras de temporada, ledger idempotente, bandeja única | 7 | `catalogs.service`, `gamification-proposals.service` | V41.7.1–7.20 | CERRADO |
| A41-017 | Sin retos ni recompensas; puntos por alcance con privacidad | 7 | `gamification-extras.controller` (410), `StudentPoints.tsx` | V41.7.1, V41.7.18–7.19, WEB.46.x | CERRADO |
| A41-018 | Estado de validación aparte del respaldo; revisión con prueba externa; Administración como excepción | 8 | `credential-check.rules`, `validation.service` | V41.8.1–8.12, WEB.47.x | CERRADO · BLOCKED parcial (Credly, Cisco y Huawei sin verificador comprobable) |
| A41-019 | DRAFT flexible; ACTIVE con repo y una tecnología por área; editar y revalidar | 9 | `project-readiness.rules`, `Projects.tsx` | V41.9.1–9.13, WEB.48.1 | CERRADO |
| A41-020 | GitHub: sugerencias con procedencia, no catalogada → Administración, diagnóstico honesto | 10 | `projects.service` (`suggestions`), `repository-inspector` | V41.10.1–10.5, V41.10.8, V41.10.10, WEB.49.1 | CERRADO |
| A41-021 | Readiness ≠ CORROBORATED; fuente independiente; atribución; recálculo auditado | 10 | `project-backing.rules`, `project-backing.service` | V41.10.6–10.9, V41.10.11 | CERRADO (informe 535 / 3541) |
| A41-022 | Equipo con búsqueda; miembros precargados como candidatos; confirmación individual | 11 | `Projects.tsx`, `project-members.service` | V41.11.3, V41.11.7–11.8, WEB.50.1 | CERRADO |
| A41-023 | Excluir del proyecto con motivo, sin sacar del equipo; aviso respetuoso | 11 | `project-members.service` (`registrarExclusion`) | V41.11.1–11.2, V41.11.4–11.6, V41.11.9–11.11 | CERRADO |
| A41-024 | Privacidad de proyectos con nombres claros; Afinia ≠ GitHub; un borrador nunca se publica | 12 | `PROJECT_VISIBILITY_*`, `public-profile.service` | V41.12.1–12.5 | CERRADO |
| A41-025 | Evidencias en tres pestañas, sin duplicar | 12 | `Evidences.tsx` | WEB.51.x | CERRADO |
| A41-026 | QR en Mi perfil → Visibilidad; Contactos y Equipos en Colaboración | 12 | `Profile.tsx`, `Collaboration.tsx`, `navigation.ts` | WEB.51.x | CERRADO |
| A41-027 | Saldo e historial de puntos, aparte del respaldo | 7 y 13 | `Profile.tsx` (`SaldoPuntos`), `Progress.tsx` | V41.7.20, V41.13.4 | CERRADO |
| A41-028 | Afinidad V4 sin etiquetas, intereses, gamificación ni afirmaciones sin corroborar | 13 | motor de afinidad (sin cambios); entradas corregidas en el 10 | V41.13.3 (+ V32.15.x, B6.x) | VERIFICADO |
| A41-029 | Currículo: secciones e ítems elegibles; nada entra solo | 13 | `cv-eligibility.rules`, `Progress.tsx` | V41.13.1–13.2 (+ V3.18.10–3.18.24), WEB.52.x | CERRADO |
| A41-030 | Calidad: pruebas reales, seguridad, responsive, regresión y documentación | 14 | `docs/V4_1_QA.md` | 22 suites + unitarias | CERRADO |

## Casos de regresión del contrato (§23, B01–B40)

Están citados en el nombre de cada prueba (por ejemplo, «V41.10.9 B35 23.6 …») y pueden buscarse por su código:

```
grep -n "B35" scripts/e2e-v4-1.mjs
```
