# Matriz de permisos real de la API — cierre V7.1

Generada el 27/11/2026 desde los decoradores `@Roles` y `@Public` de los controladores **registrados** en los módulos de `api/src` (rama `feature/afinia-v7-cierre-final`). Los controladores del módulo retirado en V7-6 (`credentials.controller.ts`, `public-credentials.controller.ts`) siguen en el código pero ningún módulo los carga: en su lugar responde `retired-credentials.controller.ts` con 410.

- ✓ = el rol pasa la guarda de roles. Dentro de cada ruta el servicio aplica además el alcance (propietario, semestres del docente, responsable de la actividad, visibilidad), que no se refleja aquí.
- «Público» = sin sesión. «Cualquier rol» = con sesión, sin `@Roles`.
- Total: 312 rutas.

Est = Estudiante · Doc = Docente · Soc = Sociedad científica · Dir = Dirección · Adm = Administración

## /academic-areas

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /academic-areas` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `PATCH /academic-areas/:id` | — | — | — | — | ✓ |
| `POST /academic-areas` | — | — | — | — | ✓ |
| `POST /academic-areas/tag-analysis` | — | — | — | — | ✓ |

## /activation

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `POST /activation/activate` | Público | Público | Público | Público | Público |
| `POST /activation/check` | Público | Público | Público | Público | Público |
| `POST /activation/forgot-password` | Público | Público | Público | Público | Público |
| `POST /activation/request` | Público | Público | Público | Público | Público |
| `POST /activation/reset-password` | Público | Público | Público | Público | Público |

## /activities

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `DELETE /activities/:id` | — | ✓ | ✓ | ✓ | ✓ |
| `DELETE /activities/:id/favorite` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /activities` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /activities/:id` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /activities/:id/participants` | — | ✓ | ✓ | ✓ | ✓ |
| `GET /activities/:id/reviews` | — | ✓ | ✓ | ✓ | ✓ |
| `GET /activities/:id/validation-reference` | — | ✓ | ✓ | ✓ | ✓ |
| `GET /activities/managed` | — | ✓ | ✓ | ✓ | ✓ |
| `GET /activities/my-registrations` | ✓ | — | — | — | — |
| `GET /activities/my-scope` | — | ✓ | — | — | — |
| `GET /activities/people` | — | ✓ | ✓ | ✓ | ✓ |
| `GET /activities/responsibles` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /activities/reviews/pending` | — | — | — | ✓ | — |
| `PATCH /activities/:id` | — | ✓ | ✓ | ✓ | ✓ |
| `PATCH /activities/:id/confirm-participation` | — | ✓ | ✓ | ✓ | ✓ |
| `POST /activities` | — | ✓ | ✓ | ✓ | ✓ |
| `POST /activities/:id/attendance/close` | — | ✓ | ✓ | ✓ | ✓ |
| `POST /activities/:id/cancel-registration` | ✓ | — | — | — | — |
| `POST /activities/:id/cancel-submission` | — | ✓ | ✓ | — | ✓ |
| `POST /activities/:id/duplicate` | — | ✓ | ✓ | ✓ | ✓ |
| `POST /activities/:id/participation-correction` | — | — | — | ✓ | ✓ |
| `POST /activities/:id/register` | ✓ | — | — | — | — |
| `POST /activities/:id/register-interest` | ✓ | — | — | — | — |
| `POST /activities/:id/review` | — | — | — | ✓ | — |
| `POST /activities/:id/submit` | — | ✓ | ✓ | — | ✓ |
| `PUT /activities/:id/favorite` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `PUT /activities/:id/validation-reference` | — | ✓ | ✓ | ✓ | ✓ |
| `PUT /activities/:id/validation-reference/model` | — | ✓ | ✓ | ✓ | ✓ |

## /activity-categories

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /activity-categories` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /activity-categories/:id/usage` | — | — | — | — | ✓ |
| `PATCH /activity-categories/:id` | — | — | — | — | ✓ |
| `POST /activity-categories` | — | — | — | — | ✓ |

## /affinity

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /affinity/me` | ✓ | — | — | — | — |
| `GET /affinity/me/areas/:areaId/breakdown` | ✓ | — | — | — | — |
| `GET /affinity/me/history` | ✓ | — | — | — | — |
| `GET /affinity/me/summary` | ✓ | — | — | — | — |
| `GET /affinity/student/:studentId` | — | ✓ | — | ✓ | ✓ |
| `GET /affinity/student/:studentId/areas/:areaId/breakdown` | — | ✓ | — | ✓ | ✓ |
| `GET /affinity/student/:studentId/summary` | — | ✓ | — | ✓ | ✓ |
| `GET /affinity/weights` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /affinity/recalculate-all` | — | — | — | — | ✓ |
| `POST /affinity/recalculate/:studentId` | — | ✓ | — | ✓ | ✓ |
| `POST /affinity/recalculate/me` | ✓ | — | — | — | — |

## /ai

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /ai/runs` | — | — | — | — | ✓ |
| `GET /ai/status` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /ai/runs/:id/accept` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /ai/suggestions` | ✓ | ✓ | ✓ | ✓ | ✓ |

## /approval-policies

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /approval-policies` | — | — | — | ✓ | ✓ |
| `GET /approval-policies/direct-actions` | — | — | — | ✓ | ✓ |
| `GET /approval-policies/me` | — | ✓ | — | — | — |
| `GET /approval-policies/teachers` | — | — | — | ✓ | ✓ |
| `POST /approval-policies` | — | — | — | ✓ | — |
| `POST /approval-policies/:id/revoke` | — | — | — | ✓ | — |

## /audit

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /audit/events` | — | — | — | — | ✓ |
| `GET /audit/log` | — | — | — | — | ✓ |
| `GET /audit/log/catalog` | — | — | — | — | ✓ |

## /auth

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `DELETE /auth/sessions` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /auth/me` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /auth/sessions` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /auth/login` | Público | Público | Público | Público | Público |
| `POST /auth/logout` | Público | Público | Público | Público | Público |
| `POST /auth/refresh` | Público | Público | Público | Público | Público |

## /certificates

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `DELETE /certificates/external/:id` | ✓ | — | — | — | — |
| `GET /certificates/external/eligible-opportunities` | ✓ | — | — | — | — |
| `GET /certificates/external/my` | ✓ | — | — | — | — |
| `PATCH /certificates/external/:id` | ✓ | — | — | — | — |
| `POST /certificates/external` | ✓ | — | — | — | — |
| `POST /certificates/external/:id/check` | ✓ | — | — | — | — |
| `POST /certificates/external/:id/manual-review` | ✓ | — | — | — | — |

## /constancies

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /constancies/internal/activity/:activityId` | — | — | — | ✓ | ✓ |
| `GET /constancies/internal/eligible/:activityId` | — | ✓ | ✓ | ✓ | ✓ |
| `GET /constancies/internal/institution-certificates/:activityId/status` | — | ✓ | ✓ | ✓ | ✓ |
| `GET /constancies/internal/my` | ✓ | — | — | — | — |
| `GET /constancies/internal/student/:studentId` | — | ✓ | — | ✓ | ✓ |
| `POST /constancies/internal` | — | ✓ | ✓ | ✓ | — |
| `POST /constancies/internal/institution-certificates/:activityId` | — | ✓ | ✓ | ✓ | — |
| `PUT /constancies/internal/institution-certificates/:activityId/general-file` | — | ✓ | ✓ | ✓ | — |

## /contacts

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `DELETE /contacts/:profileId` | ✓ | — | — | — | — |
| `DELETE /contacts/requests/:id` | ✓ | — | — | — | — |
| `GET /contacts` | ✓ | — | — | — | — |
| `GET /contacts/requests/received` | ✓ | — | — | — | — |
| `GET /contacts/requests/sent` | ✓ | — | — | — | — |
| `GET /contacts/search` | ✓ | — | — | — | — |
| `PATCH /contacts/:profileId/note` | ✓ | — | — | — | — |
| `PATCH /contacts/requests/:id` | ✓ | — | — | — | — |
| `POST /contacts/requests` | ✓ | — | — | — | — |

## /credentials

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `ALL /credentials/*` | 410 | 410 | 410 | 410 | 410 |

## /evidences

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `DELETE /evidences/:id` | ✓ | — | — | — | ✓ |
| `GET /evidences/my` | ✓ | — | — | — | ✓ |
| `POST /evidences` | ✓ | — | — | — | ✓ |

## /files

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /files/:key` | ✓ | ✓ | ✓ | ✓ | ✓ |

## /gamification

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /gamification/challenges` | — | — | — | — | — |
| `GET /gamification/me` | ✓ | — | — | — | — |
| `GET /gamification/me/wallet` | ✓ | — | — | — | — |
| `GET /gamification/proposals` | — | ✓ | — | ✓ | ✓ |
| `GET /gamification/redemptions` | — | — | — | — | — |
| `GET /gamification/rewards` | ✓ | — | — | — | — |
| `GET /gamification/scope-points` | — | — | — | — | — |
| `GET /gamification/students/:profileId/history` | — | — | — | — | — |
| `PATCH /gamification/challenges/:id` | — | — | — | — | — |
| `PATCH /gamification/redemptions/:id` | — | — | — | — | — |
| `PATCH /gamification/rewards/:id` | — | — | — | — | — |
| `POST /gamification/challenges` | — | — | — | — | — |
| `POST /gamification/challenges/:id/award` | — | — | — | — | — |
| `POST /gamification/proposals` | — | ✓ | — | — | — |
| `POST /gamification/proposals/:id/review` | — | — | — | ✓ | ✓ |
| `POST /gamification/rewards` | — | — | — | — | — |
| `POST /gamification/rewards/:id/redeem` | ✓ | — | — | — | — |

## /gamification-criteria

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /gamification-criteria` | — | — | — | ✓ | ✓ |
| `GET /gamification-criteria/available` | — | ✓ | ✓ | ✓ | ✓ |
| `PATCH /gamification-criteria/:id` | — | — | — | ✓ | ✓ |
| `POST /gamification-criteria` | — | — | — | ✓ | ✓ |

## /health

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /health` | Público | Público | Público | Público | Público |

## /help

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /help` | Público | Público | Público | Público | Público |

## /imports

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /imports/students` | — | — | — | — | ✓ |
| `GET /imports/students/:batchId` | — | — | — | — | ✓ |
| `GET /imports/teachers` | — | — | — | — | ✓ |
| `GET /imports/teachers/:batchId` | — | — | — | — | ✓ |
| `POST /imports/students/:batchId/apply` | — | — | — | — | ✓ |
| `POST /imports/students/:batchId/discard` | — | — | — | — | ✓ |
| `POST /imports/students/preview` | — | — | — | — | ✓ |
| `POST /imports/teachers/:batchId/apply` | — | — | — | — | ✓ |
| `POST /imports/teachers/:batchId/discard` | — | — | — | — | ✓ |
| `POST /imports/teachers/preview` | — | — | — | — | ✓ |

## /learning-resources

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /learning-resources` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /learning-resources/reviews/pending` | — | — | — | ✓ | ✓ |
| `PATCH /learning-resources/:id` | — | ✓ | — | ✓ | ✓ |
| `POST /learning-resources` | — | ✓ | — | ✓ | ✓ |
| `POST /learning-resources/:id/review` | — | — | — | ✓ | ✓ |

## /library

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `DELETE /library/:id/favorite` | ✓ | — | — | — | — |
| `GET /library` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /library/publishers` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `PUT /library/:id/favorite` | ✓ | — | — | — | — |

## /mail

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /mail/status` | — | — | — | — | ✓ |
| `POST /mail/test` | — | — | — | — | ✓ |
| `POST /mail/verify` | — | — | — | — | ✓ |

## /notifications

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /notifications/me` | — | — | — | — | — |
| `GET /notifications/me/unread-count` | — | — | — | — | — |
| `PATCH /notifications/:id/read` | — | — | — | — | — |
| `POST /notifications/admin/run-reminders` | — | — | — | — | ✓ |
| `POST /notifications/me/read-all` | — | — | — | — | — |

## /onboarding

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /onboarding/me` | ✓ | — | — | — | — |
| `GET /onboarding/me/history` | ✓ | — | — | — | — |
| `GET /onboarding/questionnaire` | ✓ | — | — | — | — |
| `POST /onboarding/runs` | ✓ | — | — | — | — |
| `POST /onboarding/runs/:runId/confirm` | ✓ | — | — | — | — |

## /profiles

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `DELETE /profiles/me/free-interests/:id` | ✓ | — | — | — | — |
| `DELETE /profiles/me/photo` | ✓ | — | — | — | — |
| `GET /profiles/:studentId/allowed` | — | ✓ | — | ✓ | ✓ |
| `GET /profiles/me` | ✓ | — | — | — | — |
| `GET /profiles/me/contact-channels` | ✓ | — | — | — | — |
| `GET /profiles/me/free-interests` | ✓ | — | — | — | — |
| `GET /profiles/me/onboarding` | ✓ | — | — | — | — |
| `GET /profiles/me/photo` | ✓ | — | — | — | — |
| `GET /profiles/me/public-link` | ✓ | — | — | — | — |
| `GET /profiles/me/skill-interests` | ✓ | — | — | — | — |
| `GET /profiles/me/summary` | ✓ | — | — | — | — |
| `GET /profiles/me/visibility` | ✓ | — | — | — | — |
| `GET /profiles/peers` | ✓ | — | — | — | — |
| `GET /profiles/students` | — | ✓ | — | ✓ | ✓ |
| `PATCH /profiles/:studentId/institutional-data` | — | — | — | — | ✓ |
| `PATCH /profiles/me` | ✓ | — | — | — | — |
| `PATCH /profiles/me/free-interests/:id` | ✓ | — | — | — | — |
| `PATCH /profiles/me/onboarding` | ✓ | — | — | — | — |
| `POST /profiles/me` | ✓ | — | — | — | — |
| `POST /profiles/me/free-interests` | ✓ | — | — | — | — |
| `POST /profiles/me/interests` | ✓ | — | — | — | — |
| `POST /profiles/me/onboarding/complete` | ✓ | — | — | — | — |
| `POST /profiles/me/onboarding/institutional-confirmation` | ✓ | — | — | — | — |
| `POST /profiles/me/onboarding/privacy` | ✓ | — | — | — | — |
| `POST /profiles/me/preferred-areas` | ✓ | — | — | — | — |
| `POST /profiles/me/public-link/rotate` | ✓ | — | — | — | — |
| `POST /profiles/me/skills` | ✓ | — | — | — | — |
| `PUT /profiles/me/contact-channels` | ✓ | — | — | — | — |
| `PUT /profiles/me/interests` | ✓ | — | — | — | — |
| `PUT /profiles/me/photo` | ✓ | — | — | — | — |
| `PUT /profiles/me/preferred-areas` | ✓ | — | — | — | — |
| `PUT /profiles/me/skill-interests` | ✓ | — | — | — | — |
| `PUT /profiles/me/skills` | ✓ | — | — | — | — |
| `PUT /profiles/me/visibility` | ✓ | — | — | — | — |

## /project-backing

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `POST /project-backing/recalculate` | — | — | — | — | ✓ |

## /projects

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `DELETE /projects/:id/evidences/:evidenceId` | ✓ | — | — | — | ✓ |
| `DELETE /projects/:id/images/:imageId` | ✓ | — | — | — | — |
| `DELETE /projects/:id/members/:memberId` | ✓ | — | — | — | ✓ |
| `GET /projects/:id` | ✓ | ✓ | — | — | ✓ |
| `GET /projects/:id/checks` | ✓ | ✓ | — | ✓ | ✓ |
| `GET /projects/:id/images` | — | — | — | — | — |
| `GET /projects/:id/invitations` | ✓ | — | — | — | ✓ |
| `GET /projects/:id/members` | ✓ | ✓ | — | — | ✓ |
| `GET /projects/:id/members/detailed` | ✓ | ✓ | — | ✓ | ✓ |
| `GET /projects/:id/points` | ✓ | ✓ | — | — | ✓ |
| `GET /projects/:id/readiness` | ✓ | — | — | — | ✓ |
| `GET /projects/:id/suggestions` | ✓ | — | — | — | — |
| `GET /projects/:id/timeline` | ✓ | ✓ | — | ✓ | ✓ |
| `GET /projects/:projectId/feedback` | ✓ | ✓ | — | — | ✓ |
| `GET /projects/community` | — | — | — | — | — |
| `GET /projects/community/owners` | — | — | — | — | — |
| `GET /projects/institutional` | — | ✓ | — | — | ✓ |
| `GET /projects/invitations/mine` | ✓ | — | — | — | — |
| `GET /projects/my` | ✓ | — | — | — | — |
| `GET /projects/public/:token` | Público | Público | Público | Público | Público |
| `PATCH /projects/:id` | ✓ | — | — | — | ✓ |
| `PATCH /projects/:id/images/:imageId` | ✓ | — | — | — | — |
| `PATCH /projects/:id/invitations/:invitationId/cancel` | ✓ | — | — | — | ✓ |
| `PATCH /projects/:id/members/:memberId/contribution` | ✓ | — | — | — | ✓ |
| `PATCH /projects/:projectId/feedback/:feedbackId` | — | ✓ | — | — | — |
| `PATCH /projects/invitations/:invitationId` | ✓ | — | — | — | — |
| `POST /projects` | ✓ | — | — | — | — |
| `POST /projects/:id/checks/recheck` | ✓ | — | — | — | ✓ |
| `POST /projects/:id/evidences` | ✓ | — | — | — | ✓ |
| `POST /projects/:id/images` | ✓ | — | — | — | — |
| `POST /projects/:id/invitations` | ✓ | — | — | — | ✓ |
| `POST /projects/:id/invite-team` | ✓ | — | — | — | — |
| `POST /projects/:id/my-contribution/correction` | ✓ | — | — | — | — |
| `POST /projects/:id/suggestions/accept` | ✓ | — | — | — | — |
| `POST /projects/:id/suggestions/dismiss` | ✓ | — | — | — | — |
| `POST /projects/:id/suggestions/request-skill` | ✓ | — | — | — | — |
| `POST /projects/:projectId/feedback` | — | ✓ | — | — | — |
| `POST /projects/:projectId/feedback/skills/:skillId` | — | ✓ | — | — | — |
| `POST /projects/admin/recompute-backing` | — | — | — | — | ✓ |
| `POST /projects/repository/analyze` | ✓ | — | — | — | — |
| `PUT /projects/:id/my-contribution` | ✓ | — | — | — | — |
| `PUT /projects/:id/my-gallery-consent` | ✓ | — | — | — | — |

## /public

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `ALL /public/credentials/*` | 410 | 410 | 410 | 410 | 410 |
| `GET /public/profiles/:slug` | Público | Público | Público | Público | Público |
| `GET /public/profiles/:slug/photo` | Público | Público | Público | Público | Público |

## /recommendations

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /recommendations/me` | ✓ | — | — | — | — |
| `GET /recommendations/me/:id` | ✓ | — | — | — | — |
| `GET /recommendations/me/history` | ✓ | — | — | — | — |
| `GET /recommendations/rules` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `PATCH /recommendations/me/:id` | ✓ | — | — | — | — |

## /reports

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /reports/admin/home` | — | — | — | — | ✓ |
| `GET /reports/admin/home/:tarjeta/:segmento` | — | — | — | — | ✓ |
| `GET /reports/admin/overview` | — | — | — | — | ✓ |
| `GET /reports/director/affinity-map` | — | — | — | ✓ | ✓ |
| `GET /reports/director/home` | — | — | — | ✓ | — |
| `GET /reports/director/home/:tarjeta/:segmento` | — | — | — | ✓ | — |
| `GET /reports/director/overview` | — | — | — | ✓ | ✓ |
| `GET /reports/director/participation-by-semester` | — | — | — | ✓ | ✓ |
| `GET /reports/director/pending` | — | — | — | ✓ | ✓ |
| `GET /reports/director/projects-summary` | — | — | — | ✓ | ✓ |
| `GET /reports/director/trends` | — | — | — | ✓ | ✓ |
| `GET /reports/me/evolution` | ✓ | — | — | — | — |
| `GET /reports/society/activities` | — | — | ✓ | — | ✓ |
| `GET /reports/student/:studentId/evolution` | — | ✓ | — | ✓ | ✓ |
| `GET /reports/teacher/affinity-summary` | — | ✓ | — | — | ✓ |
| `GET /reports/teacher/overview` | — | ✓ | — | — | ✓ |
| `GET /reports/teacher/projects-summary` | — | ✓ | — | — | ✓ |
| `GET /reports/teacher/support-summary` | — | ✓ | — | — | ✓ |
| `GET /reports/teacher/team-needs` | — | ✓ | — | — | — |

## /roles

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /roles` | — | — | — | — | ✓ |

## /skill-requests

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /skill-requests` | — | — | — | — | ✓ |
| `POST /skill-requests/:id/decision` | — | — | — | — | ✓ |

## /skills

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /skills` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /skills/classify` | — | — | — | — | ✓ |
| `PATCH /skills/:id` | — | — | — | — | ✓ |
| `POST /skills` | — | — | — | — | ✓ |

## /team-applications

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `DELETE /team-applications/:id` | ✓ | — | — | — | — |
| `GET /team-applications/mine` | ✓ | — | — | — | — |
| `PATCH /team-applications/:id` | ✓ | — | — | — | — |

## /team-needs

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /team-needs` | ✓ | — | — | — | — |
| `GET /team-needs/:id/applications` | ✓ | — | — | — | — |
| `GET /team-needs/:id/suggestions` | ✓ | — | — | — | — |
| `GET /team-needs/for-me` | ✓ | — | — | — | — |
| `GET /team-needs/mine` | ✓ | — | — | — | — |
| `PATCH /team-needs/:id` | ✓ | — | — | — | — |
| `POST /team-needs` | ✓ | — | — | — | — |
| `POST /team-needs/:id/applications` | ✓ | — | — | — | — |
| `POST /team-needs/:id/team` | ✓ | — | — | — | — |

## /teams

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /teams/invitations/mine` | ✓ | — | — | — | — |
| `GET /teams/mine` | ✓ | — | — | — | — |
| `PATCH /teams/:id` | ✓ | — | — | — | — |
| `PATCH /teams/invitations/:id` | ✓ | — | — | — | — |
| `POST /teams/:id/invitations` | ✓ | — | — | — | — |

## /trajectory

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /trajectory/me` | ✓ | — | — | — | — |

## /trajectory-summary

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /trajectory-summary/items` | ✓ | — | — | — | — |
| `GET /trajectory-summary/pdf` | ✓ | — | — | — | — |
| `GET /trajectory-summary/sections` | ✓ | — | — | — | — |
| `POST /trajectory-summary/pdf` | ✓ | — | — | — | — |
| `POST /trajectory-summary/preview` | ✓ | — | — | — | — |

## /uploads

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `POST /uploads` | — | — | — | — | — |
| `POST /uploads/cleanup-orphans` | — | — | — | — | ✓ |

## /users

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `DELETE /users/:id` | — | — | — | — | ✓ |
| `GET /users` | — | — | — | — | ✓ |
| `GET /users/:id` | — | — | — | — | ✓ |
| `GET /users/:id/semesters` | — | — | — | — | ✓ |
| `PATCH /users/:id` | — | — | — | — | ✓ |
| `PATCH /users/:id/status` | — | — | — | — | ✓ |
| `POST /users` | — | — | — | — | ✓ |
| `POST /users/:id/resend-activation` | — | — | — | — | ✓ |
| `PUT /users/:id/semesters` | — | — | — | — | ✓ |

## /validation

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /validation/:resourceType/:resourceId` | ✓ | — | — | — | ✓ |
| `GET /validation/manual-reviews` | — | — | — | ✓ | ✓ |
| `GET /validation/queue` | — | — | — | — | ✓ |
| `POST /validation/manual-reviews/:certificateId` | — | — | — | ✓ | — |
| `POST /validation/manual-reviews/:certificateId/recheck` | — | — | — | ✓ | — |
| `POST /validation/reprocess-outdated` | — | — | — | — | ✓ |
| `POST /validation/run` | — | — | — | — | ✓ |

## /verified-emails

| Ruta | Est | Doc | Soc | Dir | Adm |
|---|:-:|:-:|:-:|:-:|:-:|
| `DELETE /verified-emails/:id` | ✓ | — | — | — | — |
| `GET /verified-emails` | ✓ | — | — | — | — |
| `POST /verified-emails` | ✓ | — | — | — | — |
| `POST /verified-emails/:id/confirm` | ✓ | — | — | — | — |
| `POST /verified-emails/:id/resend` | ✓ | — | — | — | — |
