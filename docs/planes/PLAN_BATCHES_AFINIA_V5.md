# Plan de batches — Afinia V5

**Contrato:** `AFINIA_CONTRATO_UNICO_V5_CORRECCIONES_CLAUDE_CODE_2026-10-26.md` (§18)
**Diagnóstico:** `AUDITORIA_GAP_AFINIA_V5.md`
**Rama:** `feature/afinia-v5-cierre`, desde `153cc3b`.

**Reglas de cada batch:**
- Leer los archivos concretos y confirmar el GAP.
- Hacer el cambio mínimo, con migraciones **aditivas y reversibles**: nunca se borra una columna ni un dato.
- Probar en el entorno aislado (`afinia_test`), con las suites tocadas y la regresión completa al cierre.
- Un commit por batch, sin push mientras no se pida.
- Las pruebas nuevas de cada batch se suman a `api/test/jest/` o a una suite `scripts/e2e-v5.mjs` con los escenarios §19 que cubre.
- **El siguiente batch empieza solo con luz verde.**

Se conserva la numeración del contrato. Se reordenan los batches por riesgo: primero los defectos semánticos y de seguridad confirmados (cupo, constancias, admisión), después la experiencia de uso.

| Orden | Batch | Hallazgos | Riesgo de datos | Migración |
|---|---|---|---|---|
| 1 | **V5-4** Inscripción, admisión y asistencia | V5-12 (C03, C05 confirmados) | Medio | Sí, aditiva |
| 2 | **V5-5** Constancias y resumen informativo | V5-16, V5-31 | Bajo (solo deja de emitir) | No |
| 3 | **V5-2** Actividades: pestañas, fechas, borrar borrador, validación de externas | V5-06, V5-07, V5-10, V5-11 | Bajo | No |
| 4 | **V5-3** Docente: tarjetas, filtro por responsable, edición y semestres | V5-01, V5-02, V5-08, V5-09 | Ninguno | Sí: favoritos de actividades |
| 5 | **V5-1** Apellidos | V5-04, V5-05 | Medio (784 compuestos) | Sí, aditiva |
| 6 | **V5-10 + V5-11** GitHub: estados y pedidos de tecnologías | V5-24, V5-25 | Bajo | Sí: alias o mapeo |
| 7 | **V5-12** Contribuciones, equipo, contactos y roles | V5-20, V5-22, V5-28, V5-29 | Bajo | Sí: roles múltiples (tabla puente) |
| 8 | **V5-6** Recursos: URL o archivo, tipos y alcance | V5-13, V5-14, V5-17 | Bajo | Sí: `url` nullable y `file_id` |
| 9 | **V5-7** Políticas de Dirección por docente | V5-15, V5-18 | Ninguno | Sí: tabla de política |
| 10 | **V5-8** Gamificación: 3 familias e historial detallado | V5-19, V5-30 | Bajo | Sí: columnas de actor y criterio en el historial |
| 11 | **V5-9** Alta guiada por GitHub | V5-23 | Ninguno | No |
| 12 | **V5-13** Visibilidad, imágenes y galería de proyectos | V5-21, V5-26, V5-27 | Bajo | Sí: `project_images` |
| 13 | **V5-14** Docente: enlaces a las fuentes de afinidad | V5-03 | Ninguno | No |
| 14 | **V5-15 + V5-16** Credenciales y trayectoria: revisión de copy | §3.8, V5-31 | Ninguno | No |
| 15 | **V5-17** QA integral y documentación | Todo | — | — |

---

## BATCH V5-4 — Inscripción, admisión y asistencia (riesgo alto, primero)

- **Escenarios:** C01–C08, E05.
- **Backend** (`activities.service.ts`, `registration.enum.ts`, migración nueva):
  - El eje de inscripción se distingue del de asistencia **sin romper el enum** actual:
    - `registered` = solicitud pendiente;
    - nuevo `admitted` = admisión aceptada, ocupa plaza;
    - `rejected` = nuevo, con motivo obligatorio;
    - `confirmed` / `absent` = asistencia;
    - `cancelled` = retiro.
  - `admitted` se añade como valor nuevo de `registration_status`. Las 3941 filas `confirmed` existentes **no se tocan**.
  - **`registrationMode` pasa a tener efecto:**
    - `open` sin cupo → la inscripción queda `admitted` directamente;
    - con cupo o en modo `approval` → `registered`, y el responsable admite o rechaza.
    - Las actividades existentes son todas `open`.
  - **Reserva atómica del cupo:** `SELECT … FOR UPDATE` de la fila de la actividad dentro de la transacción de admisión, y el conteo de plazas dentro de la misma transacción. `OCCUPYING_STATUSES` pasa a incluir `admitted`.
  - Registrar asistencia (`confirmed`/`absent`) solo cuando el evento ya empezó (`eventDate <= now`, con la misma tolerancia al minuto de V5-2).
  - Dentro de la ventana de regularización (ND-06): después de `FINISHED`, hasta 7 días por omisión o hasta «Cerrar asistencia». Fuera de ella, la corrección de Dirección que ya existe.
  - **Efectos (§6.2):** solo `confirmed` alimenta la trayectoria, la afinidad y los puntos. Hoy ya es así (`EXPERIENCE_STATUSES = [CONFIRMED]`): `PRESERVE`.
- **Web** (`ActivityManager.tsx`, `student/Activities.tsx`, `constants.ts`):
  - dos columnas, «Inscripción: Pendiente / Admitida / Rechazada» y «Asistencia: Sin registrar / Presente / Ausente»;
  - acciones «Admitir», «Rechazar (motivo)», «Presente» y «Ausente»;
  - selector «Modo de inscripción» en el formulario.
- **Móvil:** solo cambian las etiquetas del estado (pantalla de actividades del estudiante).
- **Pruebas:**
  - C05 (dos admisiones concurrentes con cupo 1 → una 200 y una 409);
  - C03 (asistencia antes del evento → 409);
  - C06 (abierta sin cupo → `admitted`, asistencia pendiente);
  - C08 (rechazo con motivo ≠ ausencia);
  - E05 (confirmar dos veces → un solo evento de puntos).

## BATCH V5-5 — Constancias y resumen informativo

- **Escenarios:** H01–H04, I04.
- **Backend:**
  - `sincronizarConstancia` **deja de emitir constancias nuevas**. Una corrección de asistencia sigue revocando las existentes (historia intacta).
  - `outcomePolicy` deja de aceptar `internal_constancy` **en actividades nuevas** (400 con mensaje). Las 2497 existentes la conservan como dato histórico y, al editarse, pasan a «Solo participación» con aviso.
  - El flujo «certificado emitido por la institución» (V3.2 §28.3) se conserva: registra un documento real con su emisor.
- **Web:**
  - Dirección → «Constancias» pasa a llamarse «Participaciones confirmadas». En otra pestaña, «Documentos emitidos por la institución (históricos y registrados)».
  - Se quita «Afinia emite la constancia» (`ActivityManager.tsx:93`, `ActivityCard.tsx:17`, `Approvals.tsx:171`).
  - El menú «CV / Exportar» pasa a «Resumen de trayectoria», con la leyenda «Currículo estudiantil (borrador informativo)» visible en la vista previa y en el PDF.
  - Se ajusta la ayuda (`help/content.ts`).
- **Pruebas:** H02 (confirmar no crea constancia); H03 (las constancias históricas siguen visibles con su emisor); I04 (búsqueda de «Afinia emite», «certificado por Afinia» y «CV oficial» en `web/src` y `mobile/src` = 0).

## BATCH V5-2 — Actividades: pestañas, fechas, borrar borrador y validación de externas

- **Escenarios:** B01–B07, B10.
- **Backend:**
  - `assertInicioFuturo`: compara al minuto (`floor(start/60s) >= floor(now/60s) − tolerancia`), con `ACTIVITY_START_TOLERANCE_MINUTES=2` en `.env.example`.
  - `assertCompleta`: las reglas de modalidad se aplican también a las externas. Una externa virtual exige un enlace de acceso: `meetingUrl` o el `externalUrl` oficial (ver la auditoría, §8.2).
  - Nuevo `DELETE /activities/:id`: solo DRAFT, autor (o Admin auditado), sin inscripciones, revisiones, constancias, puntos ni copias que lo referencien; en transacción y con auditoría. Si no cumple → 409 con la razón.
- **Web (`ActivityManager.tsx`):**
  - Pestañas «Académicas | Extracurriculares | Externas». Cada «Nueva…» abre un formulario con estado propio; el origen se deriva de la pestaña.
  - Se quita el selector de origen dentro del formulario.
  - Al cambiar de pestaña con cambios sin guardar, se pide confirmación.
  - El combo interno ya no ofrece «Credencial externa esperada». Las 115 internas que la tienen la muestran como dato de solo lectura.
  - Botón «Borrar borrador» con modal.
- **Pruebas:** B01 (Playwright: Académica → Externa → Académica, sin campos de proveedor); B02/B03 (API); B04/B05 (reloj del servidor fijado en la prueba); B06; B07.

## BATCH V5-3 — Vista docente, filtro por responsable, edición y semestres

- **Escenarios:** B08, B09, I02, I03.
- **Backend:**
  - `responsibleId` en `QueryActivitiesDto` y en `listar`.
  - Favoritos de actividades: tabla `activity_favorites (user_id, activity_id)`, sin efecto en el recomendador (§14.1).
  - El detalle para el docente oculta `meetingUrl` si no es responsable (§16, B6).
- **Web:**
  - `teacher/Activities.tsx` pasa a usar las tarjetas `ActivityCard` paginadas de 6 en 6, con el servidor; ya no descarga la lista completa.
  - Filtro de responsable con búsqueda. Favorito con estrella, sin «Me interesa».
  - El mismo filtro en la vista del estudiante.
  - `editable()` también tiene en cuenta si el usuario creó la actividad: el responsable ve «Gestionar operación», no «Editar».
  - En el formulario, cada responsable muestra «cubre 1.º–4.º»; quitar uno avisa.

## BATCH V5-1 — Apellidos

- **Escenarios:** A01–A05.
- **Migración aditiva:** `users.first_surname varchar(50) null` y `users.second_surname varchar(50) null`.
  - **No** se rellenan desde `last_name` cuando tiene espacios (784 casos).
  - Las filas sin espacio se pueden copiar a `first_surname` sin ambigüedad.
  - `last_name` se conserva y pasa a calcularse como `first_surname + ' ' + second_surname` cuando se editan.
- **DTO:** `firstSurname` obligatorio en las altas nuevas y `secondSurname` opcional. `lastName` se sigue aceptando por compatibilidad: scripts, seed y clientes viejos.
- **Padrón:**
  - plantilla nueva con `first_surname` y `second_surname`;
  - la plantilla vieja con `last_name` se sigue aceptando y la previsualización avisa «apellido sin separar»;
  - preview, aplicación parcial e idempotencia **sin cambios**.
- **Web:** dos campos en Usuarios. Un filtro «Apellidos por separar» para corregir los legados.
- **Pruebas:** A01–A05 y la regresión de activación, login y padrón (`e2e-batch-1`, `e2e-v4-1`).

## BATCH V5-10 + V5-11 — GitHub: estados y pedidos de tecnologías

- **Escenarios:** F03, F04, F07, F08, F09.
- **Backend:**
  - `GET /projects/:id/checks` recruza `technologySignals` con las tecnologías **actuales** del proyecto (sin llamar a GitHub).
  - `decideSkillRequest` con tres decisiones:
    - `alias`: el nombre detectado se agrega a `aliases` de una tecnología existente, verificando que sea la misma (aviso explícito);
    - `new_skill`: se crea la tecnología con área principal, secundarias y alias del nombre detectado, reutilizando `CatalogsService` y su validación de clasificación;
    - `rejected`.
  - Todo en una transacción e idempotente ante el doble clic. La notificación dice lo que de verdad pasó.
- **Web:**
  - colores y textos del §12.3: gris «Declarada», verde «Declarada · detectada en el repositorio», neutro «Sugerida», ámbar «Pendiente», rojo solo si hay un rechazo real;
  - después de «La usé», refrescar las señales;
  - Admin elige entre «Es otro nombre de…» y «Es una tecnología nueva».

## BATCH V5-12 — Contribuciones, equipo, contactos y roles

- **Escenarios:** G01–G06, I01.
- **Backend:**
  - `confirmMyContribution` y `proposeContribution` exigen `skillIds ⊆ tecnologías del proyecto` (400 con la lista de las que sobran).
  - Roles múltiples: tabla `project_member_roles`. `project_members.role` se conserva como rol principal.
  - `ROLE_HINTS` (rol → áreas sugeridas) va en `shared` como **ayuda de orden**, no como prohibición.
- **Web:**
  - el selector de contribución lista solo las tecnologías del proyecto, agrupadas por área;
  - origen «Individual / Equipo / Contactos»;
  - los 5 diálogos nativos (`window.prompt`/`window.alert`) se reemplazan por `Modal` con motivo obligatorio.

## BATCH V5-6 — Recursos: URL o archivo, tipos y alcance

- **Escenarios:** D01–D07.
- **Migración:** `learning_resources.url` pasa a nullable y se agrega `file_id uuid null` (FK a `stored_files`), con el CHECK `url IS NOT NULL OR file_id IS NOT NULL`.
- **Subida:** por el puerto de almacenamiento existente, con allowlist (PDF, DOCX, PPTX, TXT, MD, PNG, JPG), sin video, tamaño máximo configurable, MIME real (`file-signature.ts`) y limpieza de huérfanos (que ya existe).
- **Etiqueta:** «Curso externo» pasa a «Curso de autoaprendizaje (sin acreditación automática)».
- **Web:** selector «Toda la carrera / Semestres específicos» para Dirección y Admin.

## BATCH V5-7 — Políticas de Dirección por docente

- **Escenarios:** E01–E04, E08.
- **Tabla** `approval_policies`: `id, module (RESOURCE|GAMIFICATION|ACTIVITY), teacher_user_id, decision (DIRECT_ALLOWED), granted_by, granted_at, revoked_at, revoked_by, justification`.
  - Sin fila = `REQUIRE_REVIEW`.
  - `ACTIVITY` se rechaza en la API hasta que se resuelva ND-03.
- **Guardia** en los endpoints de recursos y de propuestas de puntos. Auditoría al otorgar y al revocar.
- **Web (Dirección):** pestaña «Autonomía docente» y un historial de acciones directas.
- **Sociedad:** no hereda la política (E08).

## BATCH V5-8 — Gamificación: 3 familias e historial detallado

- **Escenarios:** E05–E07, D08.
- **Disparadores:** se agrega `recurso_completado_atestiguado`.
  - Los criterios nuevos solo ofrecen las 3 familias.
  - Los demás disparadores quedan marcados como «retirados» (como ya se hizo en V4.1 con `RETIRED_GAMIFICATION_TRIGGERS`).
  - El motor automático **deja de crear eventos nuevos** para ellos; el historial de 7234 eventos queda intacto.
- **Historial:** columnas nullable `criterion_id`, `awarded_by` y `approved_by`. El estado se deriva: los puntos positivos son «aplicados», las reversiones existentes son «revertidas» y las propuestas pendientes salen de `gamification_proposals`.
- **Web:** detalle por estudiante en «Puntos de estudiantes», con fecha, ±puntos, criterio, origen, quién y motivo.

## BATCH V5-9 — Alta guiada por GitHub

- **Escenarios:** F01, F02, F05, F06, F10–F12.
- Paso «Repositorio → Analizar» como primera sección **opcional** del alta.
- Si el análisis falla o hay límite de peticiones → `INCONCLUSIVE`, sin borrar lo declarado (ya es así: `PRESERVE`).
- Aviso al quitar la última tecnología de un área.

## BATCH V5-13 — Visibilidad, imágenes y galería de proyectos

- **Escenarios:** G07–G09.
- **Etiquetas:** «Solo yo y los integrantes» / «También docentes autorizados» / «Toda la comunidad Afinia» / «Público por enlace». Los valores del enum y la ACL no cambian.
- **Imágenes:** `project_images (project_id, file_id, position, is_cover)`, de 0 a 5, PNG/JPG/WEBP, separadas de las evidencias.
- **Galería:** `GET /projects/community` y la página «Proyectos de la carrera», solo ACTIVE con visibilidad `profile`, `public_link` o `teachers` según el rol. 6 por página, con filtros.

## BATCH V5-14 — Docente: enlaces a las fuentes de afinidad

- **Escenario:** H08.
- Cada contribución de la afinidad enlaza a su entidad: actividad, proyecto o credencial, con la vista que el docente ya está autorizado a ver.
- El feedback de un proyecto muestra los puntos otorgados, el criterio y quién los otorgó.

## BATCH V5-15 + V5-16 — Credenciales y trayectoria

- **Escenarios:** H05–H07.
- **Regresión** de los estados de credenciales que ya existen.
- **Copy:** «Afinia informa el resultado de la consulta al proveedor en la fecha X», no «certifica».
- **Exportación:** «Mi trayectoria» seleccionable con el aviso de ND-02.

## BATCH V5-17 — QA integral y documentación

- **Regresión completa:**
  - las 22 suites;
  - Jest, Playwright (×3) y Newman, actualizados con los flujos nuevos;
  - k6 sobre los listados paginados nuevos.
- **Amenazas:** URL/SSRF y subida de archivos (ZAP sobre los endpoints nuevos).
- **Documentación:**
  - Swagger, `shared`, `.env.example`, README y ayuda;
  - `MATRIZ_TRAZABILIDAD_V5.md`;
  - `CAMBIOS_DOCUMENTO_GRADO_V5.md`: lista para el autor; **no se edita** el `.docx` (§18, V5-17).

---

## Cosas que este plan **no** hace (§21, «Fuera de alcance»)

- No emite certificados.
- No crea un sexto rol.
- No reintroduce el chat ni «Retos y recompensas».
- No clona ni ejecuta repositorios.
- No usa IA obligatoria (`AI_PROVIDER=none` sigue funcionando).
- No crea un módulo de malla ni de paralelos (ND-04).
- No añade infraestructura cloud nueva.
- No hace `db:reset` ni migraciones destructivas.
