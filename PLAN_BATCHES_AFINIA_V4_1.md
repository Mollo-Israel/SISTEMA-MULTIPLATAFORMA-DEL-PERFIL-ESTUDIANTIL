# Plan de batches — Afinia V4.1

**Base:** `feat/afinia-v3-2` (`8110245`)

**Rama de trabajo:** `feature/afinia-v4-1-cierre`, local.

**Fuente de los hallazgos:** [`AUDITORIA_GAP_AFINIA_V4_1.md`](AUDITORIA_GAP_AFINIA_V4_1.md)

**Reglas de cada batch (§22, §25, D.2):**
- uno por vez, y se espera la validación del usuario antes del siguiente;
- cambios mínimos, reutilizando lo existente;
- migraciones con `up` y `down`, no destructivas y con `pg_dump` previo;
- pruebas reales: la sonda del caso y una regresión de las 21 suites;
- reporte con el formato del §25;
- commit en español;
- sin push salvo autorización.

Lo marcado PRESERVE_PASS no se toca, solo se vuelve a probar.

| Batch | Ajustes | Qué se cambia (mínimo) | Pruebas de aceptación | Migración |
|---|---|---|---|---|
| **V4.1-1** Activación, validaciones, grillas | A41-001…004 | **Web:** `key={mode}` en las rutas `/activar/solicitar` y `/recuperar`; quitar «(V3.2 §10)» del hint; paginación y orden en Categorías, Actividades (orden) y Recursos con los componentes de `ui.tsx`. **API y web:** el aula exige al menos una letra Unicode, con error bajo el campo. | B01, B02, B03, B04; regresión de activación (QA.x, V32.2.x) | No |
| **V4.1-2** Formulario de actividad | A41-005…007, V41-01 | `findManagedBy` carga `activitySkills` y la edición hidrata desde el detalle. El responsable se exige al publicar o enviar, no al guardar el DRAFT. Una actividad conceptual sin skill es válida (con al menos un área). **Varias imágenes (0..5):** tabla `activity_images`, compatible con `image_file_id` como portada, y carrusel en el detalle. | B05, B06, B07, B08, B09, B10; crear → editar → refrescar | Sí: `activity_images` (aditiva), copiando la imagen actual como portada |
| **V4.1-3** Estados, revisión, alcance, pestañas | A41-008…010, 012, 013 | `veBorrador`: un responsable asignado no ve el DRAFT de la autoridad. Lo PENDING solo en la bandeja, no en el `managed` del Director. Al publicar, inicio en el futuro. Mensajes de CLOSED por fecha o cupo. «Duplicar actividad». Unión de alcances de los docentes responsables (verificando la alternativa «carrera completa»). Pestañas `origin` × `character`. Ocultar «Credencial externa esperada» del formulario interno. | B11, B12, B13, B14, B15, B16, 23.3, 23.4, 23.5; negativos de API con cada actor | No (el estado actual alcanza); se confirmará en el batch |
| **V4.1-4** Asistencia | A41-011 | `attendance_status` (`open_for_settlement` / `locked`) y `attendance_closed_at`. Acción «Cerrar asistencia». El responsable no pasa un CONFIRMED a ABSENT. Corrección excepcional de Dirección o Admin con motivo, auditoría y reconciliación (constancia, afinidad, puntos, trayectoria). Sin cierre automático de N horas. | B17, B18, B19; idempotencia | Sí: columnas aditivas en `activities` |
| **V4.1-5** Recursos y Biblioteca | A41-014 | Título y quién publica con contenido significativo (API y web). El docente propone dentro de sus semestres; Dirección revisa; Admin y Director crean directo. Pestaña «Para ti» en la Biblioteca. | B20, B21, B22, B23 | Sí, posible: estado de revisión del recurso (aditivo) |
| **V4.1-6** Recomendaciones | A41-015 | Quitar `RESOURCE_FAVORITE_AREA` y `SIMILAR_SAVED` del cálculo. Agregar `ACTIVITY_INTERESTED`, idempotente y reversible. Razones textuales («Coincide con tus intereses» / «…con lo que quieres mejorar»). El porcentaje con su fórmula o sin porcentaje. Actualizar V32.10.x. | B24, B25 | No |
| **V4.1-7** Gamificación simplificada | A41-016, 017, 027 | Vigencia de temporada en los criterios. Reversos auditables en el ledger. El criterio reemplaza los «puntos» libres de la actividad. Bandeja de propuestas en Dirección (proyecto y recurso). Retirar «Retos y recompensas» del menú y bloquear su creación **sin borrar históricos**. La tabla de puntos por alcance pasa a Gamificación. Saldo en el Perfil. | B26, B27, B28, 23.10 | Sí: `valid_from` / `valid_until` y tabla de propuestas (aditivas) |
| **V4.1-8** Credenciales externas | A41-018 | Eje `validation_status` derivado de los estados actuales, sin romperlos. La revisión manual exige el método y una prueba externa independiente para quedar verificada; si no, queda INCONCLUSIVE y SUPPORTED. **Adaptadores reales solo si se comprueban** (si no, quedan explícitamente inconclusos). | B29, B30, B31, B32, 23.9; SSRF | Sí, posible: columnas de revisión (aditivas) |
| **V4.1-9** Proyectos: borrador y readiness | A41-019 | Verificar en la web la edición de título y repo (la API ya lo permite). Skill por cada área solo al activar. Reconfirmación al cambiar integrantes. Lista de verificación explicable. | B33, 23.2 | No previsto |
| **V4.1-10** GitHub y respaldo | A41-020, 021 | Sugerencias con procedencia (aceptar o rechazar). «Tecnología no catalogada» con pedido al Admin. Diagnóstico 404 / 403 / rate-limit. **Regla de respaldo:** readiness ≠ CORROBORATED, señales del mismo repo = una sola fuente, atribución antes de corroborar y el repo ajeno no se atribuye. **Recálculo con plan auditado** de los proyectos existentes. | B34, B35, 23.6, 23.7 | Sí, posible: procedencia por skill (aditiva) + recálculo controlado |
| **V4.1-11** Equipos y confirmaciones | A41-022, 023 | Combobox de equipo con búsqueda. Miembros precargados como candidatos editables. Excluir del proyecto con motivo y aviso, sin tocar el equipo. Historial. | B36, B37, 23.8 | Sí, posible: motivo de exclusión (aditiva) |
| **V4.1-12** Privacidad y vistas | A41-024…026 | Textos de visibilidad (Afinia ≠ GitHub, enlace con o sin sesión). Pestañas de Evidencias sobre el mismo origen de datos. QR y perfil público en Mi perfil → Visibilidad, con acceso rápido en Colaboración. Informe de impacto en el móvil. | 401 y 403 en perfiles; sin duplicados | No |
| **V4.1-13** Afinidad, trayectoria, currículo | A41-027…029 | Sin tocar la fórmula. Verificar que tras V4.1-10 la afinidad y la elegibilidad usan el respaldo correcto. Puntos visibles en la trayectoria. | B38, 23.11 | No |
| **V4.1-14** QA, seguridad y documentación | A41-030 | Compilar shared, API, web y móvil. Unitarias, integración y E2E (21 suites más las nuevas). Negativos HTTP, CORS y sesiones, SMTP, GitHub, proveedores, subidas y URLs. `expo-doctor`. Swagger, `.env.example`, runbook y guía del documento de grado (sin modificar el `.docx`). | B39, B40 y la lista de D.1 | No |

## Orden sugerido y por qué

1. **V4.1-1** y **V4.1-2**: correcciones localizadas, de bajo riesgo y alta visibilidad para el usuario.
2. **V4.1-3** y **V4.1-4**: permisos y asistencia, que afectan la seguridad y los datos derivados.
3. **V4.1-10** (respaldo) antes que **V4.1-13**: la afinidad y el currículo dependen de un respaldo correcto.
4. **V4.1-7** (gamificación): retira interfaz, conserva datos.
5. El resto, en el orden del contrato.

## Decisiones que necesitan confirmación del usuario antes de su batch

- **V4.1-2:** máximo de **5 imágenes** por actividad, y tamaño por archivo (el actual de las subidas, a confirmar en la infraestructura).
- **V4.1-4:** ¿habrá un plazo de regularización configurable, o solo el cierre manual («Cerrar asistencia»)? El contrato prohíbe inventar un cierre automático.
- **V4.1-10:** autorizar el **recálculo** del respaldo de los proyectos existentes, con informe previo de cuántos cambian de nivel.
- **V4.1-8:** qué proveedores priorizar (Credly / IBM, Cisco, Huawei) y si hay acceso real para probarlos.
