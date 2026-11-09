# Plan de batches — Afinia V6

Se basa en `AUDITORIA_GAP_AFINIA_V6.md`. Se ejecuta en orden, en `feature/afinia-v6-cierre`, con un commit por batch y pruebas propias en `scripts/e2e-v6.mjs`. Cada batch se cierra con su regresión acotada y el build afectado. Nada destructivo: migraciones aditivas sobre `perfil_estudiantil` y `afinia_test`.

| # | Batch | Defectos del GAP | Migración | Riesgo |
|---|---|---|---|---|
| 1 | V6-1 Responsable × semestre en la API | V6-SCOPE-01a–d | Sí: `activity_responsibles.semesters smallint[]` con *backfill* | Alto: permisos |
| 2 | V6-2 Formulario por responsable | V6-SCOPE-01 (UI), Toda la carrera / específicos | No | Medio |
| 3 | V6-3 Duplicar seguro + «Ver detalles» | V6-SCOPE-02, V6-ACT-01 | No | Bajo |
| 4 | V6-4 Admisión y cupo; externas | V6-ACT-02b, V6-ACT-03 | No | Medio: regla |
| 5 | V6-5 Cambios sin guardar + grids | V6-UX-01, V6-GRID-01, V6-USER-01 | No | Bajo |
| 6 | V6-6 Identidad asistida y semestres del docente al crear | V6-USER-02, V6-USER-03 | No | Bajo |
| 7 | V6-7 Contribución 400 | V6-PROJ-01 | No (no reescribe filas) | Bajo |
| 8 | V6-8 Sin OCR en proyectos; mínimos de activación | V6-PROJ-03, PRO-05..08 | No | Medio: respaldo |
| 9 | V6-9 Demo segura, `Content-Type`, límites | V6-PROJ-05, V6-PROJ-06, §7.6 | No | Medio |
| 10 | V6-10 Galería: integrantes consentidos, sin repositorio | V6-PROJ-07 | Sí: `project_members.show_in_gallery` | Medio: privacidad |
| 11 | V6-11 Perfil: QR solo en Visibilidad, vista previa, foto | V6-PROFILE-01/02 | Sí: `student_profiles.photo_file_id` | Medio: privacidad |
| 12 | V6-12 Recomendador sin «Me interesa / No me interesa» | V6-REC-01/02 | No | Medio |
| 13 | V6-13 Equipos → Para ti y búsqueda de contactos | TEAM-01, CONTACT | No | Medio: enumeración |
| 14 | V6-14 Participación sin insignia; certificados institucionales | ADM-08, V6-CERT-01/02 | No | Bajo |
| 15 | V6-15 Estados de respaldo explicados; resumen separado | HIST-02, V6-TRAJ-01 | No | Bajo |
| 16 | V6-16 Correo fuera del menú | V6-ADMIN-01 | No | Bajo |
| 17 | V6-17 Regresión integral y documentación | — | — | — |

## Diseño clave de V6-1 (responsable × semestre)

- `activity_responsibles.semesters smallint[] NOT NULL DEFAULT '{}'`.
  - Para un docente, debe estar contenido en su `TeacherScope`.
  - Para Dirección, Administración o la Sociedad, vacío significa «cubre toda la audiencia».
- **API:**
  - `responsibleAssignments: [{ userId, semesters[] }]` en crear y editar, compatible con `responsibleUserIds`. Sin asignación explícita, el docente queda con la intersección de su alcance y la audiencia.
  - Regla: cada semestre de la audiencia debe tener al menos un responsable asignado a ese semestre. Se valida en **toda** creación o edición de una actividad no borrador, en académicas, extracurriculares y externas, y también al publicar.
  - Al quitar un responsable en una actividad publicada con inscritos de semestres que quedarían huérfanos: **409** con la lista, sin pérdida silenciosa.
- **Auditoría:** antes y después de las asignaciones, en una transacción.
- **Pruebas:** ACT-01..ACT-06 y el caso F (Carlos al 8.º por API).
