# Plan de ejecución — Afinia V7.1 (V7-1 a V7-13)

- **Fuente:** `docs/auditorias/AUDITORIA_GAP_AFINIA_V7.md`. Los IDs de hallazgo (FIL-, PUB-, CRED-, …) son los de esa auditoría.
- **Rama:** `feature/afinia-v7-cierre-final`, desde `141d768`.
- **Regla:** un batch por autorización, en el orden del contrato (§14).

## Reglas comunes a todos los batches

1. **Reproducir antes de corregir.** Cada batch empieza con una prueba que falla con el defecto. Recién después se cambia el código.
2. **Entorno aislado.** Las sondas y pruebas de API corren contra `node scripts/pruebas/entorno.mjs api`: puerto `:3020`, base `afinia_test`, correo a consola, GitHub y verificadores simulados. Nunca contra la base de desarrollo ni contra una real.
3. **Pruebas.** Cada batch ejecuta:
   - las unitarias (`npm run test:unit`) y Jest (`npm --prefix api run test`);
   - una suite nueva `scripts/e2e-v7.mjs`, con un bloque por batch;
   - la suite web `scripts/e2e-v7-web.mjs` cuando cambia la interfaz;
   - `tsc` de api, web y móvil.

   Después de Jest, Playwright o seguridad se restaura la evidencia versionada de la tesis (`pruebas/02`, `pruebas/03`, `pruebas/11`).
4. **Migraciones.** Solo aditivas y compatibles: columnas nuevas con valor por omisión, valores de enum nuevos, tablas nuevas. Nunca se borran datos, tablas ni migraciones. Se aplican a la base de desarrollo y a `afinia_test`.
5. **Compatibilidad.** Si un contrato de la API que usa el móvil cambia, se adapta el móvil en el mismo batch, o se mantiene el campo viejo.
6. **Commit.** Uno lógico por batch, **solo con la autorización del usuario**. Sin push ni merge si no se pide. Nunca se suben `scripts/demo-60.ps1` ni `scripts/demo-objetivo-6.mjs`.
7. **Informe.** Cada batch cierra con el formato del contrato §17 en `docs/qa/QA_V7_<batch>.md`.

## Resumen

| Batch | Hallazgos | Decisiones | Migración | Depende de |
|---|---|---|---|---|
| V7-1 Filtros y paginación | FIL-01…07 | — | No | — |
| V7-2 Aprobar = publicar y abrir; asistencia; D04 | PUB-01…09, ASI-02, PERF-01/04 (regla) | D02, D04 · autorización §15.1, 15.2, 15.4 | No prevista | V7-1 (filtro de revisión) |
| V7-3 Formulario de credenciales y procesamiento | CRED-06…10, 13, 14 | D03, D08 · §15.7 | Sí (versiones del modelo; fase «no aplica») | — |
| V7-4 Revisión humana obligatoria | CRED-01…05, 12, 15, 16 | D01 · §15.3 | Sí (estado «observada») | V7-3 |
| V7-5 Documentos institucionales | DOC-01…06 | D04, D05 | Sí (modo general/individual, entrega por destinatario) | V7-2 |
| V7-6 Retirar registros verificables | VER-01…10, ADM-09, DIR-03 | §15.5 | No (se conservan tablas) | — |
| V7-7 Proyectos | PROY-01…08 | — | No | — |
| V7-8 Afinidad y recomendador explicados | PERF-01, 04, 05, 08, REC-01…04 | D04, D06 · §15.1, 15.6 | No (versión de reglas en código) | V7-2, V7-4, V7-5 |
| V7-9 Perfil y filtros | PERF-02, 03, 06, 07, FILT-01/02 | — | No | V7-7, V7-8 |
| V7-10 Contactos, QR móvil y equipos | CONT-01…06 | D08 | No | — |
| V7-11 Inicio de Admin | ADM-01…11 | D07 | No | V7-1, 2, 4, 5, 6 |
| V7-12 Inicio de Dirección | DIR-01…04 | — | No | V7-11 |
| V7-13 Regresión y cierre | R01–R05 y matriz completa | — | — | Todos |

---

## V7-1 · Filtros excluyentes, paginación y revisión separada

**Reproducir.**
- F01/F02: hoy no hay forma de ver **solo** suspendidas o **solo** pendientes.
- `GET /users` sin paginar.
- Actividades sin filtro de revisión.

**Cambios.**
- **API usuarios.** `GET /users` acepta `status`, `role`, `q`, `page`, `pageSize` y `sort`, filtra en SQL antes de paginar y devuelve `{ items, total }`. Se conserva la respuesta actual sin `page` para los selectores de responsable (`listUsersByRole`).
- **Web usuarios.** Selector «Activas» (por omisión), «Pendientes de activación», «Suspendidas», «Inactivas», «Todas». Estado en la URL (`?status=&role=&q=&page=`). Al cambiar de filtro vuelve a la página 1.
- **Catálogos.** Áreas, tecnologías y categorías: «Vigentes / Retirados» en la URL, en lugar de la casilla. Recursos igual, reutilizando `includeInactive`.
- **Actividades gestionadas.** Filtros independientes `lifecycle`, `review` y `type` en la API y en la URL, con paginación en el servidor. Admin consulta propuestas enviadas en solo lectura; la API ya lo restringe.

**Pruebas.** 0, 1 y 11 registros por filtro · página 2 → cambio de filtro → página 1 · recarga conserva filtros · permisos de docente, sociedad y URL directa.

**Salida.** Cumple F01–F05. Ningún estado de datos cambia.

## V7-2 · Aprobación = publicación y apertura; asistencia; regla D04

**Reproducir.**
- A03: aprobar deja `draft`.
- A10: con FINISHED y la lista abierta no se puede pasar un presente a ausente.
- A14: «Publicar» una propia no abre.
- I01: una «Sin resultado» suma afinidad.

**Cambios.**
- `review('approve')` aplica en **una transacción**: revisión APPROVED → validación de fechas y cupo → `OPEN` si `now < start_at` y hay cupo. Si la fecha ya pasó, responde 409 con el motivo y la propuesta queda pendiente para corregirla, sin publicar. El aviso pasa a «Dirección aprobó y publicó…» y es idempotente (`dedupeKey` estable, sin `Date.now()`).
- Publicar las propias de Dirección o Admin abre en el mismo paso si son elegibles.
- La inscripción usa `<=` frente al inicio (PUB-06).
- El trabajador de ciclo de vida ya cierra y finaliza; solo se le agregan pruebas.
- **Asistencia.** «Consolidada» pasa a significar **lista cerrada**, no FINISHED. Con la lista abierta y dentro de la ventana de 7 días, el responsable corrige presente o ausente. La corrección excepcional de Dirección no cambia.
- **D04.** Hay que confirmar antes cómo se trata `internal_constancy` (§15.2). Una regla única `participacionCuentaComoTrayectoria(outcomePolicy)` en `shared` se aplica a afinidad, tecnologías respaldadas, trayectoria y exportación. Sin resultado = no cuenta. **No se recalcula a nadie** hasta tener la autorización §15.1 y el informe antes/después.

**Pruebas.** A03–A06, A10–A16, I01, I10, I11 · aprobación concurrente con inscripción · regresión de responsable × semestre y admisión (A07–A09).

**Salida.** No queda ninguna aprobada en borrador por la vía nueva. Las 76 históricas vencidas se reportan y no se abren.

## V7-3 · Credenciales: formulario, origen y procesamiento técnico

**Reproducir.**
- C04: cambiar en el cuerpo áreas o tecnologías de una vinculada.
- C06: vinculada sin archivo.
- C01: la histórica entra a OCR y QR.
- C27: el docente cambia el modelo después de la aprobación.

**Cambios.**
- **Vinculada.** El servidor deriva título, emisor esperado, áreas y tecnologías de la oportunidad, y guarda una copia fija con la credencial. Se ignora lo que traiga el cuerpo. El archivo es **obligatorio** en las nuevas.
- **Histórica.** Va directo a revisión. Sus fases 1 y 2 quedan en `NOT_APPLICABLE`, un valor nuevo y aditivo.
- **Comprobar información.** Acción opcional antes de enviar, que reutiliza el trabajador de V9. Cada resultado queda asociado al **hash** del archivo. Reemplazar el archivo invalida los anteriores, que se conservan como intentos.
- **D03.** Acción `Adjuntar/actualizar certificado modelo` **solo para Dirección**, con versión, hash, autor, fecha y motivo. Se usa una tabla aditiva de versiones de la referencia. Al docente se le niega cambiar el modelo después de la aprobación.
- **Formulario web.** Los campos de la oportunidad se muestran en solo lectura. Enlace y código van colapsados en «Si tu certificado incluye enlace o código».

**Móvil.** También registra vinculadas: elige la oportunidad en `EvidencesScreen.tsx:455-504` y envía `activityId`. Hay que adaptar ese formulario en este mismo batch: archivo obligatorio y campos de la oportunidad en solo lectura. El móvil no tiene interfaz V9 de fases.

**Pruebas.** C01–C09, C13, C15, C16, C18, C19, C25–C27.

## V7-4 · Revisión humana obligatoria (D01)

**Reproducir.**
- C24: Admin decide por API.
- C14/C17: corroboración automática.

**Cambios.**
- La bandeja de Dirección muestra **todas** las credenciales presentadas, con prioridad a las pendientes.
- Decisiones: aprobar, observar o solicitar corrección (valor nuevo `observed`, aditivo) y rechazar con motivo. Hay reenvío y queda historial.
- El trabajador ya no asigna `CORROBORATED` ni `AUTO_VERIFIED` a casos nuevos. Sus hallazgos se guardan como ayuda.
- Solo la aprobación humana habilita afinidad, tecnologías y puntos.
- Admin: `@Roles` sin ADMIN en las decisiones (403) y su página pasa a solo lectura.
- Las 271 corroboradas automáticas se tratan según §15.3; por omisión no se tocan.

**Pruebas.** C10–C12, C14, C17, C20–C24, C28 · que la afinidad no suba con una credencial pendiente o rechazada.

## V7-5 · Documentos institucionales (D04, D05)

**Reproducir.**
- I06: «Ver certificado» no abre.
- I05: reentregar cambia el archivo.
- I02: no hay entrega automática.

**Cambios.**
- Modo `GENERAL / INDIVIDUAL`, solo cuando el resultado es «certificado institucional». Columna aditiva con valor por omisión `null` para lo histórico.
- **GENERAL:** un archivo real privado. Al cumplirse `FINISHED` y la lista cerrada se entrega de forma automática e idempotente a los CONFIRMED. El disparador está en el trabajador de ciclo de vida y en `closeAttendance`.
- **INDIVIDUAL:** carga y entrega por estudiante.
- Estado por destinatario; un reintento no duplica. Un reemplazo solo con versión y motivo.
- «Ver certificado» pasa a usar `BotonArchivo`.

**Pruebas.** I02–I09, H06 · acceso cruzado entre estudiantes · sesión expirada · fallo del almacenamiento.

## V7-6 · Retirar «Registros verificables» y `/verificar`

**Inventario previo.** Ya hecho en la auditoría §7: 2 registros vigentes, 4 entradas del libro y la política activada en desarrollo.

**Cambios.**
- **Web:** fuera las rutas `/verificar*`, `/director/credentials` y `/admin/verifiable-credentials`; la pestaña del estudiante; los enlaces de la landing y del menú; y la ayuda.
- **Móvil:** fuera la sección de Evidencias.
- **API:** las rutas de emisión y descarga responden 410 o se retiran. Las públicas devuelven un **410 neutro** sin datos (§15.5). La política queda apagada.
- **Se conservan** tablas, claves, migraciones y datos, como histórico interno restringido.
- No se tocan el QR del perfil, la lectura de QR externos de V9 ni los certificados institucionales.

**Pruebas.** V01–V05 · `afinia-no-certifica.spec.ts` sigue en verde.

## V7-7 · Proyectos: activación, señales y chips

**Reproducir.**
- P01: un proyecto con un área sin tecnología muestra todo verde y el botón deshabilitado.
- P07: la señal detectada antes de declarar queda gris.

**Cambios.**
- Una sola lista de requisitos compartida en `shared`, con `skill_per_area` visible.
- El componente vuelve a pedir el estado tras cada cambio.
- `syncSkillEvidence` reconcilia con `recruzar` y con los alias del catálogo. Nunca usa la señal de otro repositorio.
- Se quita «Abrir» en la lista de evidencias de Proyectos.

**Pruebas.** P01–P12 · caché vieja · alta de tecnología por Admin · quitar y volver a agregar.

## V7-8 · Afinidad y recomendador explicados

**Cambios.**
- Documento técnico con la fórmula **real** y ejemplos **ejecutados** con fixtures.
- «Cómo se calcula» en lenguaje simple, con ejemplos por área. Se ocultan códigos y «prioridad N», también en la vista docente.
- Se aplica D04 en el motor con una versión de reglas nueva. El recálculo solo corre con autorización.
- Recomendador: se mantiene la fórmula salvo que D06 diga otra cosa, y se muestran razones en texto.

**Pruebas.** M01–M07 y los fixtures de §10.4.

## V7-9 · Perfil y filtros

**Cambios.**
- Tecnologías respaldadas, solo desde fuentes elegibles:
  - proyecto ACTIVE con contribución confirmada **y** señal técnica de esa tecnología;
  - actividad con resultado y participación confirmada;
  - credencial **aprobada por Dirección**.
- Cada chip dice su fuente (corrige PERF-07).
- Biblioteca: filtro por publicador (`created_by`).
- Proyectos de la carrera: filtro por responsable. Ambos filtran en el servidor, por nombre normalizado y sin exponer correos.

**Pruebas.** M08, M09, B01, B02.

## V7-10 · Contactos, QR móvil, canales y equipos

**Cambios.**
- **Búsqueda.** Tokens normalizados (minúsculas, sin tildes, sin coma) contra nombre y apellidos, en cualquier orden. Consultas parametrizadas, sin extensiones nuevas de PostgreSQL salvo autorización.
- **Web.** Se retira el formulario de identificador. El QR y el enlace de Mi perfil siguen.
- **Móvil.** Escaneo de QR con permiso de cámara. Necesita una **dependencia nueva** (`expo-camera`, compatible con SDK 54) y un APK nuevo. Si el usuario prefiere no agregar dependencias, el batch queda BLOCKED en T04/T05 y se ofrece la búsqueda como alternativa.
- **Equipos.** Pestañas «Para ti / Todas / Mis necesidades / Mis equipos» con paginación de 10.

**Pruebas.** T01–T10.

## V7-11 · Inicio de Admin

**Cambios.**
- Endpoint de resumen por tarjeta: total real y últimos 10, ordenados por fecha con desempate por ID, sin duplicados de joins.
- Modal accesible de solo lectura (foco, Escape, retorno al botón) con «Ir a gestionar», que lleva los filtros de V7-1.
- Tarjetas A01–A15. Fuera la tarjeta Correo; `/admin/mail` sigue por URL.
- Menú con subtítulos Identidad, Catálogos, Gestión y Seguimiento. Color y jerarquía coherentes con Dirección.

**Pruebas.** H01–H11, H13, H14.

## V7-12 · Inicio de Dirección

**Cambios.**
- Reutiliza el modal de V7-11 con las consultas del alcance de Dirección.
- «Credenciales en revisión» cuenta todas las pendientes (D01).

**Pruebas.** H12 · ninguna elevación de permisos.

## V7-13 · Regresión integral y cierre

**Ejecución.** Todas las suites (unitarias, Jest, e2e-v2…v7, web-gestion, Playwright, Newman, seguridad). Además, `tsc` del móvil y Maestro en Android si el equipo está disponible; si no, BLOCKED explícito.

**Entregables.**
- Matriz de aceptación por ID con PASS / FAIL / BLOCKED / NE reales.
- Matriz de permisos.
- Fórmulas con ejemplos ejecutados.
- Lista de vistas retiradas.
- Lista de diferencias para el documento de grado. No se edita el documento.

---

## Decisiones que conviene responder antes de empezar

| # | Batch | Pregunta (detalle en la auditoría §15) |
|---|---|---|
| 1 | V7-2 | ¿Se autoriza el recálculo de afinidad por D04, después del informe antes/después? |
| 2 | V7-2 | ¿`internal_constancy` histórica cuenta como «Solo participación»? |
| 3 | V7-4 | ¿Se dejan como están las 271 credenciales corroboradas por la máquina? |
| 4 | V7-6 | ¿Respuesta 410 neutra para los enlaces `/verificar` ya compartidos? |
| 5 | V7-8 | D06: ¿se mantiene la fórmula actual del recomendador? |
| 6 | V7-10 | ¿Se autoriza agregar `expo-camera` para escanear el QR en el móvil? |
