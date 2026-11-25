# AFINIA — CONTRATO DE CORRECCIONES FINALES V7.1 PARA CLAUDE CODE

**Fuente prioritaria:** `correcciones finales.docx`, 32 páginas, revisión del 25/11/2026.
**Base contrastada:** `AFINIA_CONTRATO_UNICO_V6_CLAUDE_CODE_2026-10-30.md` y decisiones compatibles de versiones anteriores.
**Naturaleza:** contrato incremental de cierre sobre el software real; no es un informe de implementación ni una orden de reconstrucción.
**Rama propuesta:** `feature/afinia-v7-cierre-final` desde el último commit funcional validado por el usuario.
**Estado:** contrato consolidado V7.1; D01–D05 confirmadas por el usuario el 25/11/2026. D06–D08 conservan únicamente los límites de auditoría y cambios no autorizados indicados en §2.
**Precedencia:** aclaraciones del usuario del 25/11/2026 > este contrato V7.1 > Word de 32 páginas > V6 y decisiones compatibles. Sustituye el MD V7 anterior para esta ejecución; conserva los 14 batches V7-0 a V7-13. Las decisiones operativas propuestas en §2 no autorizan ampliaciones de alcance.

> LEER TODO, incluidos los criterios de aceptación. Este es el único plan de ejecución para esta auditoría. No ejecutar planes antiguos en paralelo. Conservar funciones estables que no sean objeto de una corrección explícita. Una captura es evidencia de un síntoma observado, no de su causa técnica. Las propuestas de este contrato no son automáticamente decisiones del usuario.

## 0. Protocolo de trabajo y protección

1. Consultar `git branch --show-current`, `git status --short`, `git log -5 --oneline`, remotos y commit base. No asumir que V6 es el HEAD correcto; pueden existir avances posteriores, despliegues o integraciones de compañeros.
2. Si hay cambios sin commit, detener modificaciones, reportar archivos y proteger el trabajo existente. No descartarlos, moverlos ni hacer stash sin autorización.
3. Una vez verificada la base limpia, crear rama nueva: `git switch -c feature/afinia-v7-cierre-final`. Si existe, no sobrescribirla ni mezclarla sin autorización. No hacer commit sobre la rama base ni publicar/mergear sin permiso.
4. Prohibido `git reset --hard`, `git clean -fdx`, `git restore .`, force push, borrar migraciones, modificar secretos, reiniciar volúmenes o hacer `db:reset` sobre datos reales. No borrar archivos para resolver fallos de build. Respetar `.env` real, package-lock y configuración de storage vigente.
5. BATCH V7-0 es exclusivamente auditoría GAP. Crear `AUDITORIA_GAP_AFINIA_V7.md` y `PLAN_BATCHES_AFINIA_V7.md`; no modificar código funcional. Por cada requisito indicar ruta/línea, API/DTO/servicio/entidad/cliente y prueba, cuando existan. Clasificar `ALREADY_CORRECT`, `INCORRECT`, `PARTIAL`, `MISSING`, `REGRESSION`, `NEEDS_TEST`, `NEEDS_DECISION`.
6. Ejecutar únicamente el batch autorizado. Reproducir antes de corregir. Preferir cambio localizado, reutilizar servicios y componentes. Por cada batch: test que reproduzca el defecto, cambio, regresión, build, informe y commit lógico. No declarar PASS sin ejecución, ni inventar capturas, endpoints o resultados. Registrar bloqueos reales (credenciales, servicios externos, entorno).
7. Antes de cualquier migración: identificar datos históricos, clientes web/móvil, API pública, jobs, integraciones y rutas. Migraciones aditivas/compatibles; nunca borrar datos históricos por retirar una vista. Usar BD de pruebas aislada.
8. Si el contrato contradice una decisión posterior explícita del usuario o el tutor, reportar la contradicción. No decidir silenciosamente por la implementación más fácil.

## 1. Invariantes de producto que siguen vigentes

Afinia es un sistema multiplataforma de **registro y construcción del perfil estudiantil dinámico y trayectoria**, no SIU, LMS, Teams, emisor de títulos, evaluador de competencias ni plataforma de verificación universal. Mantener cinco actores: estudiante, docente, Dirección de carrera, Sociedad Científica y Admin. Web para todos; móvil centrado en estudiante. No registro público de cuentas; padrón/alta institucional, activación y recuperación seguras. Semestre institucional no editable por estudiante. Mantener validaciones de dominio y ámbito docente; no fabricar correos por nombre ni inferir rol a partir del correo.

Taxonomía: área macro; tecnología/habilidad concreta; área principal y posibles relaciones secundarias; asociación contextual `area_id + skill_id` en cada experiencia. Tags y alias son apoyo de catálogo/búsqueda; no son entradas de Afinidad. Un alias no es una tecnología diferente. Tecnología desconocida puede solicitarse a Admin; alta en catálogo NO prueba uso. No obligar habilidades ficticias en charlas generales. Los selectores y DTO respetan relaciones y vigencia, sin perder referencias históricas.

Separar **Afinidad** (trayectoria registrada con respaldo según motor vigente), **recomendaciones** (preferencias y objetivos), **gamificación** (puntos de incentivo). Ninguno es nota ni dominio. No reintroducir chat, rankings, insignias nuevas, retos/recompensas separados, señales de clic «Me interesa/No me interesa» en actividades, ni IA obligatoria. Favoritos solo organización; mejoras privadas. `AI_PROVIDER=none` funciona. No tocar cálculos de Afinidad por razones estéticas.

Actividades: académicas internas, extracurriculares internas y externas. Creador, responsable y contacto son independientes. Docente/Sociedad sujetos a revisión de Dirección; Sociedad en ámbito extracurricular y externas permitidas. Dirección puede publicar las propias y Admin puede crear operativamente conforme permisos existentes; no usar esto para adjudicarle aprobación de propuestas académicas. Mantener asignación responsable×semestre, unión de cobertura para público, permiso individual por scope, revalidación al editar/quitar responsable y duplicación segura. Admisión/cupo independientes y asistencia distinta de inscripción. No cambiar permisos de responsable ni permitir borrador privado ajeno. FINISHED no reabre ordinariamente; cierre de asistencia independiente. Mantener imágenes/carrusel y aviso por cambios sin guardar.

Recursos: biblioteca de material con archivo/enlace, no cursos completados automáticamente ni certificado. Dirección controla autonomía por docente y módulo para recursos y puntos (revocable y auditada); no extender esa autonomía a aprobación de actividades. Puntos de recursos opcionales, por constatación autorizada; no por abrir/guardar. Tres familias principales de incentivos: participación, proyecto, recurso; conservar política vigente y temporadas/extras existentes sin añadir familias nuevas. No multiplicar puntos por tecnología o por duplicar solicitudes.

Proyectos: borradores privados; repositorio y señales GitHub, contribuciones por integrante, demo segura opcional o evidencia privada utilizable para activar. Galería no sustituye evidencia. OCR de proyectos retirado; no crawler de backend ni certificación de autoría. Roles no puntúan. Múltiples miembros pueden declarar/confirmar la misma tecnología legítima. No publicar repo/evidencias privadas de terceros en Proyectos de la carrera. Visibilidad de proyecto y perfil son distintas. Resumen de trayectoria seleccionable por ítems; no CV profesional garantizado. Mantener historial y exportación informativa sin emisión propia de credenciales.

## 2. Decisiones confirmadas y límites pendientes de auditoría

D01–D05 son requisitos confirmados: no volver a preguntar por ellos ni aplicar la propuesta anterior. Las implementaciones concretas deben respetar las reglas de cada sección. D06–D08 no bloquean el trabajo ordinario: auditar y conservar lo vigente en lo no autorizado; solicitar decisión solo si se pretende cambiar fórmula, almacenamiento de originales, evidencia mínima histórica o retirar notas. No convertir un límite de alcance en un requisito nuevo.

| ID | Estado | Regla definitiva o límite de trabajo | Batch |
|---|---|---|---|
| D01 | CONFIRMADA | Dirección es única autoridad de revisión de credenciales externas; Admin consulta en modo lectura, sin aprobar, observar, rechazar ni alterar respaldo o estado. Todas las nuevas credenciales externas pasan a decisión humana. | V7-3/4 |
| D02 | CONFIRMADA | Aprobar publica y abre automáticamente si la fecha de inicio aún es futura y hay cupo. Cierra al inicio o por cupo; finaliza al fin. Dirección/Admin abren al publicar sus propias actividades elegibles. No dejar aprobada en DRAFT. | V7-2 |
| D03 | CONFIRMADA | Modelo externo opcional; sin modelo o histórica, revisión manual directa. Si el modelo llega después, Dirección lo adjunta mediante acción acotada y auditada; no se desbloquea edición material ni se exige nueva aprobación de toda la actividad. Con modelo se ejecutan comprobaciones disponibles y revisión humana. | V7-3/4 |
| D04 | CONFIRMADA | Sin resultado: asistencia operacional, sin trayectoria, afinidad ni documento. Solo participación: trayectoria de asistencia confirmada y elegibilidad de afinidad. Certificado institucional: trayectoria y elegibilidad de afinidad por asistencia confirmada, documento real si entregado, sin doble conteo. Gamificación independiente, no cambiar criterios. | V7-2/5/8 |
| D05 | CONFIRMADA | General: un archivo real común, entrega automática a asistentes confirmados elegibles al finalizar y cerrar asistencia. Individual: archivo específico por estudiante, entrega individual; no distribuir el mismo documento nominal masivamente. | V7-5 |
| D06 | AUDITAR / NO RECALIBRAR SIN AUTORIZACIÓN | Recuperar fórmulas reales, pesos y explicaciones; corregir presentación y aplicar D04 al conjunto elegible. §10.3 es propuesta ilustrativa, no fórmula aprobada. Si se requieren cambios de pesos o ranking, documentarlos y pedir autorización específica. | V7-8 |
| D07 | CONSERVAR POLÍTICA ACTUAL | Mostrar original de padrón solo si ya se conserva legal y técnicamente con acceso autorizado; en caso contrario resumen real. No introducir retención nueva ni almacenar archivos de forma permanente sin autorización. Faltantes: asistentes elegibles sin entrega registrada, no obligación universal del emisor. | V7-11 |
| D08 | CONSERVAR POLÍTICA ACTUAL | Vinculada requiere archivo; histórica directa a Dirección con evidencia mínima de la política existente, sin OCR/QR automático. No ampliar ni restringir aceptación de URL individual sola sin autorización; reportar comportamiento real. Contactos abren canal externo, sin envío propio; preservar notas privadas existentes y no retirar su edición sin autorización. | V7-3/10 |

D01–D05 son aplicables. D06–D08 se manejan como límites conservadores, no como motivo para paralizar batches no afectados. No presentar pendientes de revisión o comprobaciones técnicas como certificación oficial.

## 3. Panel Inicio de Admin (pp. 1–4, 31–32)

### 3.1 Patrón de interacción único

Dashboard de trabajo diario, no CRUD duplicado. Cambiar «Ir» directo por «Detalles». Al pulsar abrir modal de solo lectura con total real, últimos 10 registros del conjunto filtrado (no 10 arbitrarios), título, resumen entendible y botón `Ir a gestionar / Ver todos` hacia el módulo existente. Si hay 0, modal accesible con mensaje vacío; si hay 1, una fila; si 11, diez y contador real. Orden descendente por fecha de evento pertinente (creación, solicitud, entrega, concesión), con desempate estable por ID. No contar duplicados de joins. Mostrar fecha Bolivia, estados humanos, sin códigos técnicos. Carga/empty/error independientes, accesibilidad (foco, Escape, cierre, retorno a disparador) y diseño responsivo. No mostrar toasts de éxito si falla consulta. El modal no permite aprobar, reenviar, dar de baja ni otras mutaciones. Las acciones se hacen en el módulo correspondiente con el filtro aplicado. No convertir el dashboard en un administrador omnipotente.

Filtros de navegación: utilizar query params o estado de ruta estable y restaurable. No inventar nombres de rutas sin inspección; mapear rutas actuales en GAP. `Ir a gestionar cuentas sin activar` debe cargar **solo pendientes de activación**, no todos los usuarios. `Ir a revisión` debe cargar únicamente review pendiente y tipo correcto. Si existen dos filtros, ambos se preservan al navegar, recargar y volver. No incluir enlaces a pantallas inexistentes ni nuevas pantallas CRUD innecesarias.

### 3.2 Inventario funcional de tarjetas y modales

| ID | Card / elemento | Contenido de Detalles (hasta 10 por conjunto) | Destino y filtro |
|---|---|---|---|
| A01 | Cuentas sin activar | nombre, rol, correo institucional autorizado, fecha de alta/invitación, estado pendiente; sin tokens/códigos | Usuarios; pendientes de activación |
| A02 | Cuentas por rol (cada fila clicable) | usuarios recientes del rol, estado, semestre cuando aplique; total/activos/pendientes del rol | Usuarios; rol elegido, filtro de estados según métrica seleccionada |
| A03 | Padrón | últimas importaciones aplicadas, fecha, autor, nombre, filas nuevas/conflictos/omitidas/errores; ver resumen y archivo si existe | Importar padrón / historial; no crear previews descartados |
| A04 | Auditoría | últimos eventos autorizados, fecha, actor, acción, objetivo; sin secretos ni datos de autenticación | Auditoría, filtros de fechas/acciones existentes |
| A05 | Áreas y tecnologías | dos sublistas: altas de áreas y altas de habilidades, nombre, fecha, estado, área de skill | Áreas y habilidades; tab correcto |
| A06 | Pedidos de tecnologías | solo solicitudes sin decidir, solicitante, tecnología, fecha y estado | Pedidos de tecnologías; pendientes |
| A07 | Categorías | altas recientes, nombre, tipo, vigencia, fecha | Categorías; historial/listado |
| A08 | Académicas internas | resumen recientes; pendientes de Dirección; cobertura de documentos institucionales emitidos | Actividades; académicas + filtro de revisión o detalle de entrega |
| A09 | Extracurriculares internas | mismas tres vistas, pero exclusivamente tipo extracurricular | Actividades; extracurriculares + filtro correspondiente |
| A10 | Externas | recientes/pendientes de revisión de actividad; cobertura de credenciales por oportunidad; últimas credenciales vinculadas e históricas, con estado | Actividades externas o revisión de credenciales según opción |
| A11 | Credenciales en revisión manual | solo pendientes de decisión, estudiante, curso/emisor, origen, fecha, resultados de asistencia técnica; histórico separado | Revisión de credenciales; pendientes, sin permisos extra |
| A12 | Recursos | altas recientes y propuestas de recursos pendientes de aprobación, creador, estado/fecha | Recursos; filtro correspondiente |
| A13 | Puntos de estudiantes | últimas concesiones y propuestas pendientes, destinatario, origen, cantidad, motivo, estado | Puntos de estudiantes; historial o propuestas pendientes |
| A14 | Gamificación | criterios/puntos de temporada y extras vigentes, fechas inicio/fin y familia; mensaje vacío cuando no hay | Gamificación; temporada/extras existentes |
| A15 | Proyectos de la carrera | últimos 10 proyectos activos compartidos y elegibles para ese listado, responsable, áreas/tecnologías, fecha | Proyectos de la carrera; orden reciente, sin evidencias privadas |

El Word menciona un card global de actividades en revisión y después cards por tipo (pp. 1–4). Para evitar duplicación, conservar una métrica global si ya es útil y abrir el mismo resumen segmentado por tipo; las tarjetas A08–A10 son la fuente visual principal. No contar dos veces los pendientes ni duplicar datos en BD. En pp. 3–4 se piden tres opciones en cards internas sin especificar claramente la tercera: se propone «recientes» + «en revisión» + «entrega institucional». Esta es una decisión de presentación, no cambio del motor. No sumar estados que representan procesos distintos.

Cobertura institucional: solo actividades con resultado institucional; mostrar asistentes confirmados, destinatarios de documentos entregados, pendientes elegibles (según D05), número de archivos separados de número de estudiantes, tipo general/individual. Desglose autorizado al seleccionar actividad, sin servir documentos privados en el card. Si archivo común cuenta para 8 entregas, son 8 destinatarios y 1 archivo; no confundir. No mostrar «todos recibieron» si faltan. Externas: por oportunidad, inscritos/admitidos elegibles según política, registrados, pendientes de revisión, aprobados, observados/rechazados, sin registro. Históricos sin activity_id se listan aparte. Sin confirmar titular, no rotular «auténtico». No contar `PENDING` como aprobado. No inventar metadata de certificados o padrones.

El archivo original de padrón es dato personal. No guardar o descargar archivos de importación sin política de retención/permiso; si no existe no reconstruirlo como original. El botón Ver/Descargar, cuando exista, usa endpoint autenticado, auditable y acotado por rol. No exponer bucket público ni URL permanentes. Mantener resumen de importación aun cuando original no se haya guardado.

### 3.3 Sidebar y estética

Quitar card Correo del Inicio. Conservar configuración técnica autorizada en `/admin/mail` (o ruta técnica existente) sin entrada visible de navegación. La mención de Brevo en el Word es plan de hosting, no autorización para cambiar SMTP, secretos, proveedores o envíos reales en este batch.

Agrupar menú de Admin con subtítulos coherentes con los otros roles: Inicio; Identidad (Usuarios, Importar padrón); Catálogos (Áreas y habilidades, Pedidos de tecnologías, Categorías); Gestión (Actividades/oportunidades, Recursos, Proyectos de la carrera); Seguimiento (Gamificación, Puntos de estudiantes, Revisión de credenciales, Auditoría); Ayuda. Adaptar nombres al diseño existente. Retirar Registros verificables (§7), no otros módulos. Añadir color discreto, jerarquía y estilos de cards coherentes con Dirección/Docente, mantener marca Afinia, contraste y layout responsive. No rehacer tema global ni añadir gráficas decorativas.

## 4. Filtros y revisión de actividades (pp. 5–6)

### 4.1 Filtros excluyentes

Sustituir checkbox «Mostrar también los suspendidos/retirados» por selector de estado exclusivo. Usuarios: `Activas` (default), `Pendientes de activación`, `Suspendidas`, `Inactivas/dadas de baja` si enum separado, `Todas` solo si utilidad explícita (no default). No equiparar pendiente de activación con suspendida. Para catálogos/recursos: `Vigentes` (default), `Retirados/dados de baja`; opcional todas. Aplicar a todos los grids equivalentes, no a módulos sin esos estados. Backend filtra antes de paginar y total corresponde a filtro. Mantener 10 filas, búsqueda, filtros combinados, asc/desc, limpiar y reinicio página 1 al cambiar filtro. Mantener permisos y referencias históricas.

Actividades: filtro independiente `Estado de actividad` y `Estado de revisión` (no mezclar enums). Ejemplo `lifecycle=DRAFT` + `review=PENDING`, `type=EXTERNAL`. Admin puede consultar propuestas enviadas a Dirección en modo lectura; no borradores privados no enviados ni botón aprobar/rechazar/cancelar revisión de terceros. Dirección revisa las propuestas autorizadas. La API aplica restricciones, no solo ocultar botones. Probar también docencia, sociedad y direct URL.

### 4.2 Publicación al aprobar

Defecto reportado: actividad aparece «Aprobada por Dirección» con lifecycle Borrador. Corregir transición transaccional `review=PENDING -> APPROVED` y publicación `DRAFT -> PUBLISHED` en una única operación autorizada. No hacer que guardar borrador publique, ni que enviar revisión publique. Observación/rechazo no publican. Resolver dates/capacity/validaciones de publicación antes de aprobación; si fecha inválida, indicar motivo y permitir corrección sin publicar accidentalmente. Notificar de forma idempotente y mantener audit trail.

**D02 confirmada — apertura automática:** al aprobar una propuesta válida, Dirección publica y habilita inscripciones automáticamente en la misma operación de negocio si `now < start_at` y hay capacidad disponible (sin límite también cuenta). `PUBLISHED` puede conservarse como paso lógico/transitorio si el modelo lo requiere; el resultado efectivo debe ser `OPEN`, sin otro clic del docente ni fecha de apertura adicional. Para propias de Dirección/Admin, aplicar al pulsar Publicar, no al guardar borrador. `review=APPROVED` y lifecycle se persisten coherentemente; no dejar una ventana inconsistente de borrador aprobado. Conservar la modalidad de admisión automática/manual y los permisos existentes: OPEN permite solicitar/inscribirse según modalidad, no implica asistencia ni aceptación automática cuando requiere revisión.

Guardias: si el cupo está agotado, no habilitar inscripciones; CLOSED. Si `now >= start_at`, no abrir ni aceptar inscripción nueva. Si `now >= end_at`, no abrir ni reactivar una actividad vencida; rechazar publicación tardía inválida con motivo y permitir corrección según política vigente, sin crear asistencia ficticia. Si llega inicio en actividad publicada/abierta, CLOSED; al fin FINISHED. No ampliar inscripción ni reabrir canceladas/finalizadas. No deshacer cierres manuales válidos ni reabrir automáticamente por liberación de cupo salvo regla existente autorizada. No modificar el cierre de asistencia por cambiar lifecycle.

Implementar en backend mediante reconciliación de estado/servicio existente, job si corresponde, con guard autoritativo de fechas y cupo en cada mutación de inscripción. La página solo refresca datos; no depender de que alguien abra el navegador. Proteger carreras aprobación/inscripción/cupo y scheduler, usar instante servidor y timezone America/La_Paz en presentación. Mantener idempotencia de notificaciones y auditoría. Probar aprobación antes del inicio, directa publicación, aprobación repetida, cierre al inicio sin navegador abierto, cupo lleno, fechas pasadas, fin y admisión manual/automática. Inventariar aprobadas que quedaron DRAFT por defecto anterior; reportar cantidades y fechas, reparar únicamente elegibles de forma auditada y autorizada; nunca abrir retroactivamente actividades vencidas.

## 5. Credenciales externas e históricas — revisión humana obligatoria (pp. 7–11, 13, 28–29)

### 5.1 Cambio de contrato respecto V6

V6 permitía auto-verificación individual con fuente oficial. El Word final indica **toda credencial externa requiere decisión humana**. Se retira cualquier bypass de revisión por OCR, QR, URL, Open Badges, detector o coincidencia. Una URL individual oficial puede ofrecer respaldo fuerte, pero sigue pendiente hasta decisión. La plataforma no declara autenticidad universal. No escribir nuevo `AUTO_VERIFIED` como estado terminal académico. Separar hallazgos de máquina, estado de revisión y respaldo. No dar afinidad/puntos/visibilidad de aprobado por upload, parser o verificador.

**Permisos (D01 confirmada):** Dirección es la única autoridad de revisión de credenciales externas; Admin consulta historial y bandeja en lectura. Admin no aprueba, observa, rechaza, solicita corrección ni modifica respaldo/estado, ni por API directa, ni vía endpoints genéricos. No delegar a Docente/Sociedad por analogía con actividades. Auditar la situación real antes de cambiar. La regla «siempre revisión» sí debe aplicarse a nuevos casos. Cualquier excepción para estados previos requiere decisión explícita y migración no destructiva; no revocar masivamente credenciales ya aceptadas ni alterar afinidad histórica sin informe de impacto.

### 5.2 Tipos/origen y formulario

- Vinculada a oportunidad externa: elegir solo oportunidades finalizadas y elegibles del estudiante (admisión/participación exigida según política existente; nunca permitir a otro estudiante registrar usando ID arbitrario). Recuperar del servidor título/nombre de certificado esperado si existe (si no, título de actividad como referencia), proveedor/emisor esperado, áreas y skills/contextos del catálogo configurados por creador. Mostrar de solo lectura para estudiante, también en edición; backend deriva los IDs de la oportunidad y no confía en el body. No confundir proveedor con emisor real; revisión puede corregir discrepancia documentada. Fecha emisión manual, descripción opcional. Archivo certificado obligatorio para nuevas vinculadas; preservar formatos seguros actuales y límite vigente. No pedir nuevamente clasificación ni permitir autoadjudicarse skills. Si el responsable cambia catálogo después, preservar snapshot de actividad/credencial y auditar cambios; no remapear históricos silenciosamente.
- Histórica obtenida antes o fuera de Afinia: no obligar a recrear actividad ni recuperar plantilla. Nombre, emisor, fecha, áreas/skills como declaración del estudiante, descripción opcional y evidencia mínima; D08: mantener la política vigente sobre archivo y URL individual sola; documentarla en GAP. No ampliar ni endurecer formatos/evidencia mínima histórica sin autorización. Sin evidencia mínima válida no hay solicitud de revisión (borrador posible si existe). Enviar directamente a revisión humana, sin ejecutar OCR/QR automáticamente. Marcar fases técnicas `NOT_APPLICABLE` por histórica, no fallidas. Reviewer puede consultar fuente aportada manualmente. No usar histórica para eludir elegibilidad de una oportunidad vinculada ni duplicar credenciales.
- Campos enlace de verificación y código del certificado son opcionales, colapsados en «Si tu certificado incluye enlace o código de verificación». Explicar diferencia entre URL de curso, enlace individual y código de credencial. Extraerlos cuando sea posible y ofrecer confirmación. No exigir que el estudiante sepa el patrón ni pedir URL inventada. No crear otro campo obligatorio por cada mecanismo. Validar URL/archivo seguro, no bloquear por ausencia de QR, modelo, URL ni por timeout del proveedor.
- Un mismo estudiante y oportunidad no deben generar filas duplicadas activas por reintentos. Corrección/reenvío conserva historial. Evitar duplicados entre historial/vinculada mediante identificación contextual y señales, sin prohibir certificados legítimos distintos solo por título común. SHA-256 indica identidad de archivo, no autenticidad; nunca rechazar automáticamente dos alumnos por modelo común o nombres similares.

### 5.3 Tres fases visibles de ayuda a la revisión

Para nuevas vinculadas con modelo vigente, permitir cargar archivo y `Comprobar información` (similar al flujo GitHub) con resultados comprensibles; envío a revisión no depende de que los chequeos sean positivos. Si ya existe worker, reutilizar; no hacer OCR pesado dentro de request. Si no se ejecuta comprobación explícita, encolar al enviar, y dejar claro qué está pendiente. Una revisión no se pierde si el worker falla. No bloquear por integración externa no disponible. Si usuario reemplaza archivo, invalidar resultados anteriores como vigentes y conservarlos como intentos históricos. Asociar resultado a hash/versión de archivo, referencia y fecha. Un resultado tardío no sobrescribe un veredicto humano ni se aplica a otro archivo.

**Fase 1 — Lectura y comparación documental:** extraer texto nativo del PDF primero; OCR solo cuando necesario (PDF escaneado, imágenes). DOCX si el formato ya está admitido de forma segura, no ejecutar macros. Comparar campos estables del modelo (curso, proveedor, estructura textual) con archivo. El nombre del modelo suele ser diferente y NO es discrepancia: comparar nombre extraído con identidad institucional del estudiante, no con titular del ejemplo; considerar abreviaturas, tildes y apellidos, sin inferir identidad fuerte por nombre. Mostrar textos coincidentes, faltantes, variaciones o imposibilidad de leer; no inventar porcentaje de autenticidad. Sin modelo: fase automática omitida por ausencia de referencia; la credencial va directamente a Dirección. No confundir omisión con fallo ni con resultado favorable. Sin texto legible: inconcluso; no acusar fraude. No incluir OCR de proyectos.

**Fase 2 — QR, enlace y fuente externa:** decodificar QR por librería específica (no confundir con OCR), extraer enlaces PDF/documento y código opcional, consultar solo dominios/proveedores permitidos con controles SSRF y límites. Reutilizar adaptadores existentes Cisco/Credly/Huawei si están probados; no prometer APIs universales. Distinguir: sin QR/enlace; URL alcanzable; curso identificado; registro individual localizado; titular coincide/no coincide/no visible; estado/fecha/issuer conocidos o desconocidos; error de red/CAPTCHA/rate limit. Un QR a curso genérico demuestra como mucho existencia de página/curso, NO quién lo cursó. Verificar redirecciones, host exacto y protocolo; evitar private IP, DNS rebinding, esquemas peligrosos, descarga ilimitada y URLs con secretos. No cargar sitios como contenido ejecutable incrustado. No aceptar un dominio escrito por cualquier estudiante como autoridad. Un QR copiado de otro titular es una señal de discrepancia para revisión, no aprobación. Si la fuente no responde, `INCONCLUSIVE` técnico. En vinculadas con modelo, comprobar tanto OCR como QR/enlace cuando estén disponibles, no detenerse después de un OCR favorable. En históricas o vinculadas sin modelo, omitir procesamiento automático de fases 1/2 y enviar directamente a Dirección; esta puede consultar manualmente el enlace/código aportado si existe. No exigir las tres fases como condición de envío o aprobación. Mostrar razones reales de omisión por fase.

**Fase 3 — Revisión de Dirección (D01):** bandeja de todas las solicitudes presentadas, con prioridad visual por pendientes, no autoaprobación. Mostrar archivo, origen, estudiante, oportunidad/áreas/skills, emisor, fecha, hallazgos de fase 1/2, fuentes y discrepancias. Permitir aceptar, observar/solicitar corrección, rechazar con motivo y posibilidad de reenviar conforme reglas. Reviewer registra qué respaldo contrastó; aprobar no equivale a certificar jurídicamente. Si solo puede constatar apariencia, no elevar a CORROBORATED por simple clic; usar `REVIEWED`/respaldo parcial según enum existente y política. Si evidencia externa individual suficiente y Dirección aprueba, puede calificarse `CORROBORATED` como respaldo de trayectoria, no sello universal de autenticidad. Si la política actual considera aprobación administrativa suficiente para incorporarlo al historial, mostrar exactamente ese alcance. No usar «100 % verificado». No enviar rechazo automático por falta de QR/modelo. Rechazos/observaciones notificados y auditados.

### 5.4 Estados lógicos y representación

No imponer nombres nuevos si existen equivalentes. Mapear en GAP (incluidas migraciones, shared, app móvil) y probar. Los siguientes son semánticas, no una obligación de agregar siete columnas:

| Dimensión | Valores lógicos |
|---|---|
| Procesamiento técnico | no aplica / pendiente / procesando / completado con hallazgos / inconcluso / error técnico |
| Revisión | pendiente / en revisión si existe / observada / aprobada / rechazada |
| Respaldo | declarado / con respaldo parcial / corroborado / revisado según alcance / observado; mantener enum actual y explicar |

En tabla «Mis credenciales y su validación», mostrar estado de revisión arriba, detalle expandible con tres fases y fecha, resultado y limitaciones. Después de decisión humana conservar los hallazgos anteriores, quién/fecha/motivo según permiso. Histórico: «No aplica comparación automática: credencial obtenida fuera de Afinia» y revisión pendiente. Vinculada sin modelo: «Sin documento de referencia; enviada a revisión manual»; fases 1/2 omitidas, fase 3 pendiente. En ningún caso mostrar tres checks verdes ficticios. No mostrar mensajes de fase inventados; ocultar códigos internos de error en vista estudiante, conservarlos en logs técnicos sin datos sensibles. El sistema debe aceptar el envío de un archivo legítimo aun cuando todas las herramientas de contraste fallen. No aceptar archivo corrupto, malware, tipo prohibido o tamaño excesivo; eso es seguridad de carga, no juicio de autenticidad.

### 5.5 Configuración de oportunidad externa (p. 10)

Diferenciar enlace oficial informativo (página del curso) de enlace individual del certificado que se obtiene después. Proveedor y nombre esperado se reutilizan; autocompletar host del enlace oficial como sugerencia, sin convertirlo automáticamente en dominio confiable. Dominios oficiales adicionales, palabras clave, patrón de código y certificado modelo: sección avanzada, instrucciones claras, opcionales (D03 confirmada). No pedir expresiones regulares arbitrarias peligrosas; validar patrón simple y longitud. Modelo privado, solo para comparación y nunca se entrega. Reutilizar datos de actividad en el registro del estudiante, sin duplicarlos como campos editables. Si no hay modelo, mostrar estado explícito de omisión y revisión directa. No cambiar formularios de internas por imitar externos.

**Modelo recibido después de aprobación (D03):** no bloquear aprobación por ausencia de modelo, ni reabrir toda la edición. Acción específica `Adjuntar/actualizar certificado modelo` solo para Dirección sobre oportunidad externa autorizada, reutilizando storage privado y validaciones existentes. El docente responsable proporciona el archivo a Dirección por el canal institucional existente; no crear otro módulo de solicitudes ni dar al docente permiso de editar actividad aprobada. Dirección puede adjuntar el modelo incluso después de FINISHED para apoyar revisiones, sin cambiar título, emisor, fechas, áreas, skills, cupo, aprobaciones, asistencia o trayectoria. Registrar actor, fecha, versión/hash y motivo; acceso restringido. Si se reemplaza, mantener procedencia de comprobaciones previas. Nuevos envíos usan modelo vigente; solicitudes todavía pendientes pueden volver a comprobarse por acción explícita de Dirección si hay archivo disponible, conservando intento anterior. Nunca autoaprobar, modificar decisiones ya emitidas, reabrir históricas ni reprocesar masivamente por adjuntar modelo. Si no se adjunta nunca, revisión manual directa sigue disponible. La referencia no es el documento a entregar al estudiante.

## 6. Asistencia y documentos institucionales (pp. 3, 14–15)

### 6.1 Estados y bloqueo

Mantener el estado del evento independiente del cierre de lista. `FINISHED` no obliga a marcar todos presentes ni a bloquear una lista que aún se está completando. Mientras asistencia abierta y actor autorizado/scope válido, corregir presencia/ausencia. Al cerrar lista, congelar para responsables ordinarios; quitar botón «Corregir» y aplicar guard en API. No permitir reabrir por URL directa. Si existe flujo excepcional de Dirección con motivo, auditoría y recálculo, conservarlo separado del botón normal; confirmar política antes de extenderlo. No perder participaciones, puntos o afinidad por borrado silencioso. No forzar cierre con asistentes sin estado; informar y aplicar reglas vigentes. Admisión no es presencia.

### 6.2 Resultado de actividad

D04 confirmada para internas académicas y extracurriculares:

| Resultado | Asistencia operacional | Trayectoria del estudiante | Afinidad | Documento |
|---|---|---|---|---|
| Sin resultado | Sí | No | No | No |
| Solo participación | Sí | Sí, si CONFIRMED | Elegible según motor vigente | No |
| Certificado emitido por la institución (general/individual) | Sí | Sí, si CONFIRMED | Elegible según motor vigente | Archivo real si se entrega |

Sin resultado no genera experiencia de trayectoria, tecnologías respaldadas derivadas de esa actividad, ítem exportable ni contribución de Afinidad/Support basada en esa actividad. No borrar registro operacional, auditoría ni asistencia. Solo participación y certificado institucional cuentan una única experiencia confirmada, no una por documento ni por skill. Puntos opcionales y política de resultado son ejes distintos: no cambiar criterios de gamificación ni otorgar puntos nuevos por el mero cambio de estado. Aplicar guard de elegibilidad tanto a escritura como a recálculo, perfil, exportación y consultas. Mantener fórmula/pesos de Afinidad; identificar históricos afectados y reportar impacto antes de recálculo controlado autorizado, sin borrado de datos ni ajustes silenciosos. No presentar una reunión sin resultado como logro.

### 6.3 General vs individual (D05 confirmada)

Solo cuando resultado sea certificado institucional, mostrar tipo `GENERAL / INDIVIDUAL` y campos pertinentes. Un certificado modelo es guía; un documento general es archivo oficial efectivamente destinado a todos los asistentes elegibles. Si un archivo contiene el nombre de una sola persona NO entregarlo masivamente. GENERAL: cargar un documento real, privado hasta entrega; al cumplir `FINISHED AND attendance_closed`, distribuir automáticamente e idempotentemente a asistentes CONFIRMED elegibles, usando el archivo real cargado por responsable autorizado. No exigir otro clic de entrega si el documento común fue configurado para esa finalidad. Si primero se cerró asistencia, el evento de finalización también debe disparar la entrega cuando se cumplan ambos requisitos. Si falta archivo, indicar pendiente, nunca fabricar PDF/QR; puede entregarse posteriormente con permiso. INDIVIDUAL: carga por estudiante, vínculo a asistencia confirmada, no botón de entregar el mismo archivo a todos. Permitir carga individual y entrega por estudiante cuando corresponda; no exigir una nueva interfaz de carga anticipada si no existe. Si ya existe carga anticipada privada segura, conservarla sin exponer documento antes de que se cumplan los requisitos de entrega. No crear nuevos certificados para ausentes, solicitudes rechazadas o externos por este flujo.

Un estudiante por actividad tiene una entrega activa del tipo previsto; si ya entregado, UI «Entregado» fecha y ver archivo autorizado en lugar de botón Entregar. Reintento no duplica ni cambia archivo silenciosamente. Si reemplazo excepcional se autoriza, versionar, justificar y mantener historial de revocación/reemplazo; no permitir segunda credencial inadvertida. Si se permiten varios tipos documentales por actividad en futuro, requiere contrato nuevo, no inferirlo ahora. Mantener cierre y entrega transaccionales o cola idempotente con estado por destinatario. Fallo de almacenamiento se muestra, se reintenta sin duplicar, no reportar éxito antes de persistir.

### 6.4 Abrir certificado recibido

Reproducir defecto p.14: el estudiante recibe entrada pero «Ver certificado» no abre el documento. Inspeccionar ID de entrega, object key, bucket/driver, MIME, URL expirada, autorización de API, cookies/token y respuesta. No resolver haciendo público el storage. Reutilizar apertura segura de evidencias que ya funciona. Ver/descargar únicamente titular y actores autorizados, renovar URL firmada de corta duración si corresponde; validar path y no filtrar secrets. PDF debe abrir/renderizar o descargarse; no XML de error, 403/404 oculto ni enlace roto. Mostrar error accionable si objeto no existe, no simular archivo. No confundir con evidencia del proyecto. Probar acceso cruzado entre estudiantes, archivo general compartido, individual, sesión expirada y almacenamiento local/externo si disponible.

## 7. Retirar emisión/verificación propia de Afinia (pp. 16, 28–29)

Decisión firme: eliminar módulo visible `Registros verificables` para estudiante, Dirección y Admin; quitar enlaces de home/landing, menú y ruta pública `/verificar` (incluida navegación móvil, rutas de deep-link, QR generados por ese módulo, botones PDF/QR/insignia/Open Badge/VC JWT propios y ayuda). No dejar acceso funcional oculto por URL directa. Identificar APIs públicas, rutas de emisión, política de emisión, firma, trabajos de generación/verificación y dependencia Open Badges/VC que existan; deshabilitar nuevas emisiones y verificación propia. No borrar librerías compartidas que sirven para lectura de QR externo, perfil QR u otros flujos. No afectar QR de perfil/solicitud de contacto, tokens de activación, ni certificados institucionales ya emitidos por entidad competente. No crear documentos que aparenten estar certificados por Afinia.

Históricos: captura p.29 muestra registros propios existentes. Inventariar cantidad real, dependencias y exportaciones; conservarlos como histórico interno restringido con estado legado/no emitible. No borrar tablas ni claves/migraciones, ni exponer sus datos públicamente. Si hubo URLs externas ya compartidas, proponer respuesta 410/404 neutra y procedimiento de transición autorizado; no redirigir a perfil con datos personales. No confirmar vigencia de credencial propia antigua en UI. Verificar que retirar esa generación no elimina trayectoria, participaciones ni puntos, y que no hay jobs aún emitiendo. Si hay documentos oficialmente emitidos fuera de Afinia que utilizan Open Badges, esta decisión no prohíbe consultar una fuente externa como señal para revisión humana; no agregar un verificador nuevo universal. Ajustar textos a «registro de trayectoria / revisión de evidencias», no «verificación de certificados por Afinia».

## 8. Proyectos: activación y coherencia de tecnologías (pp. 7, 12, 25–27)

### 8.1 Defecto crítico de activación

Capturas: todos los checks verdes, botón no habilitado/no activa. Reproducir con proyecto individual (responsable único) y equipo; inspeccionar network, respuesta y DTO, estados de backing, invitaciones, contribuciones, evidencia/demo, stale cache, flags y guard backend. No asumir causa. No quitar requisitos para conseguir botón verde. Una única evaluación de elegibilidad autoritativa o contrato compartido con códigos de razones; UI usa mismos resultados y refresca tras cambios. Si todas condiciones reales cumplen, botón habilitado y transición DRAFT->ACTIVE autorizada. Si falla, indicar razón concreta, no checklist falso. Tras éxito actualizar estado y visibilidad, sin generar duplicados de historial/afinidad. Cualquier requisito oculto debe explicarse o corregirse si contradictorio con contrato.

Mínimos conservados del V6: título, área contextual, tecnología de catálogo, repositorio público válido cuando es requisito vigente de proyecto tecnológico, invitaciones resueltas y miembros aceptados con contribuciones confirmadas (propietario incluido; proyecto individual sin invitaciones es válido), evidencia privada utilizable O demo segura/accesible. Galería no cuenta. No OCR. No exigir coincidencia GitHub de todas las skills, no bloquear por tecnología declarada sin señal si el resto cumple. Si API GitHub temporalmente indisponible, estado pendiente/inconcluso y razón, no inventar PASS ni quitar requisito. Guardar borrador incompleto continúa. Respeto permisos de edición/activación del responsable. Reintentos/idempotencia y cambios posteriores de repo/contribución deben invalidar solo checks dependientes y recalcular de forma trazable.

### 8.2 Señales GitHub, chips y alta de tecnología

Distinguir `declarada sin señal`, `detectada y declarada`, `detectada aún no seleccionada`, `verificación técnica inconclusa`. Verde significa «detectada en repositorio», no competencia ni autoría; gris declarada; texto/tooltip accesible, no solo color. Caso 1: se declara Python antes de escaneo; señal detectada -> chip y tabla coherentes. Caso 2: GitHub detecta Python, luego el usuario la agrega -> reconciliar contra señales persistidas del repo actual sin exigir escaneo redundante cuando vigentes. Caso 3: FastAPI/Pytest detectadas pero no existen; solicitar alta a Admin, no mapear a alias de Python; Admin aprueba catálogo, estudiante selecciona skill y área contextual, se vincula señal actual exacta por catálogo/alias real. Aprobar catálogo por sí solo no pinta verde. Si no hay señal vigente, permanece declarada.

Implementar reconciliación de asociaciones tras cambios de catálogo/skills/proyecto/resultado de escaneo; conservar evidencia de origen (repo, commit/ref cuando exista, fichero/manifest o languages, timestamp). No confiar en estado de UI, evitar resultados de repos anteriores. No mapear substrings ingenuos ni confundir dependencia con uso efectivo. No aumentar Afinidad por número de detecciones ni por asociar automáticamente todas las tecnologías a cada integrante. Chips de área: si se decide colorearlos, indicar «contiene al menos una tecnología con señal» solo para contexto explícito, no «área corroborada» por pertenecer al catálogo; conservar estilo neutro si no hay semántica comprobada. Probar stale cache/reload, alta de tecnología, eliminar/reagregar skill, alias, fallo temporal y señal de repo ajeno. No cambiar motor de puntos por color.

### 8.3 Evidencias privadas

Quitar enlace rojo `Abrir` de evidencias en vista Proyectos. Mantener alta, edición autorizada, eliminación controlada y resumen; abrir/descargar desde `Evidencias y credenciales -> Evidencias de proyectos`, que el usuario reporta funcional. No retirar enlace de demo permitido en ficha pública ni confundir repo con evidencia. No eliminar endpoints compartidos necesarios ni introducir acceso público. Verificar que enlaces y archivos siguen abriendo en la sección correcta y otro estudiante no accede por URL directa. No ejecutar OCR en proyectos.

## 9. Perfil: tecnologías respaldadas y explicación de Afinidad (pp. 17–20)

Afinidad no equivale a interés ni dominio. La pantalla «Cómo se calcula» muestra en captura familias con topes y ponderaciones, pero también información interna confusa. Auditar código real: versión, fuentes, eligibility, pesos por respaldo, multiplicadores por repetición, caps por familia, rounding, deduplicación, cálculo de Support, timestamps/snapshots y recálculo por cambios. Entregar tabla de fórmula REAL y ejemplos con fixtures. No deducir fórmula exacta desde captura ni asumir que versión V4 o V2 histórica sigue ejecutándose. Si se modifica elegibilidad de credenciales o de resultados de actividad, evaluar impacto, versionar reglas y no reescribir snapshots sin autorización.

Explicación usuario: «Afinidad refleja cuánto de tu trayectoria registrada se relaciona con un área. Las experiencias con respaldo y la repetición controlada contribuyen; no mide cuánto sabes ni califica tu rendimiento». Mostrar ejemplos reales por área y procedencia; ocultar «prioridad 5», códigos de enum y señales de cero puntos si confunden. Si llega al máximo de escala, significa saturación del índice según reglas, no dominio. Puede bajar si se corrige/revoca evidencia, se corrige clasificación o cambia elegibilidad según versión; no por no usar app, salvo que el algoritmo real tenga decaimiento aprobado. No introducir decaimiento temporal por intuición. Más eventos válidos pueden no aumentar si tope alcanzado. No bajar Afinidad por «quiero mejorar», favoritos o falta de actividad reciente. D04 fija elegibilidad de actividades; D06 limita cambios de fórmula. No recalibrar pesos por corregir elegibilidad.

Tecnologías respaldadas por trayectoria: no permitir edición manual de esta sección. Proyectos activos elegibles: incluir solo tecnología contextual que tiene respaldo técnico del proyecto y contribución individual confirmada del estudiante; no por ser miembro, rol ni selección sin señal. Actividad interna: tecnología configurada por responsable y participación confirmada elegible, mostrar «relacionada con participación en…» no «domina» ni uso individual garantizado. Credencial externa: incluir skills solo si origen y revisión/respaldos satisfacen política vigente; una declaración histórica no se vuelve tecnología corroborada por autorregistro. Diferenciar fuente de cada chip, deduplicar por skill y contexto, conservar varias experiencias como explicación. Una actividad sin skill no crea una habilidad ficticia. Corrección/revocación debe actualizar chips sin eliminar historial legítimo. No exponer datos de mejora privados ni archivo fuente en perfil público.

## 10. Recomendador: fórmula comprensible, no algoritmo inventado como implementado (pp. 17–19, 24)

### 10.1 Significado de inputs

`Me interesa` de PERFIL = gusto/preferencia, no experiencia. `Quiero mejorar` = objetivo de aprendizaje, no déficit ni evaluación, privado. Interés de área tiene tres intensidades («Un poco», «Bastante», «Mucho»); habilidad de interés es selección binaria, igual que mejora. Estos no son tags de texto; el motor usa IDs del catálogo y sus contextos. Orientación inicial opcional sugiere elecciones que estudiante confirma; no contar una sugerencia no confirmada como experiencia. No sumar dos veces el mismo interés por venir de test y perfil. Recomendaciones son candidatos ordenados, no predicción de que gustará ni Afinidad. Favorito/guardar, clicks, inscripción, puntos, visita a recurso y «Me interesa» de actividades retirado no cambian ranking. Mantener tres salidas: Actividades, Biblioteca, Equipos, cada una con filtros de elegibilidad propios.

### 10.2 Auditoría obligatoria del ranking

Localizar fórmula que hoy procesa niveles, áreas, skills, test y disponibilidad. Documentar con nombres de variables, escala, normalización, pesos, desempate, fuentes obsoletas y explicación UI. La captura no prueba si los pesos mostrados realmente son los ejecutados. Explicar por qué dos áreas pueden recomendar ambas y cuál aparece primero. Si el algoritmo vigente ya hace esto de forma consistente, conservarlo y simplificar presentación. Si hay términos de clic retirados o dobles conteos, reportar defecto y proponer ajuste, no cambiar silenciosamente. D06 requiere aprobación de nueva fórmula.

### 10.3 Propuesta determinista para discusión (D06, NO implementar sin aprobar)

Por cada actividad/recurso/necesidad elegible, usar coincidencia de IDs. Candidato sin ninguna coincidencia puede estar en Todas, no en Para ti. Definir cuatro señales acotadas [0,1]:

- IA: máximo nivel de interés entre áreas coincidentes; Un poco=1/3, Bastante=2/3, Mucho=1; si no coincide =0.
- MA: 1 si coincide al menos un área de mejora, si no 0.
- IS: 1 si coincide al menos una habilidad de interés, si no 0.
- MS: 1 si coincide al menos una habilidad de mejora, si no 0.

`score = 40*IA + 20*MA + 25*IS + 15*MS` (0..100). Interés total 65, mejora 35; la intensidad ordena candidatos incluso cuando ambos se recomiendan. Cada coincidencia cuenta una vez por grupo, no se multiplica por cantidad de tags ni por número de áreas añadidas. Contexto de skill en área correcta cuando existe; no contar alias como skill distinta. Usar máximo/indicador es una decisión deliberada de simplicidad: no recompensa cantidad de coincidencias dentro de un grupo, si se quiere premiar cobertura requerirá otra fórmula aprobada. Test confirmado se incorpora a los cuatro inputs, no suma otra vez. Elegibilidad/scope/disponibilidad se aplican antes del score; desempate estable por fecha relevante/ID. No ocultar legítimas coincidencias bajas; top/paginación ordenados. No porcentaje visible de dominio o de certeza; mostrar razón textual. Score interno no es puntos de gamificación.

Ejemplo ilustrativo (no datos reales): Bases de Datos = Mucho, Móvil = Un poco; sin otros matches: candidato BD 40, Móvil 13,33; ambos pueden aparecer, BD arriba. BD + MongoDB de interés = 65. Solo objetivo de mejora Redes =20; Redes + skill de mejora=35. Si candidato coincide con skill pero no área declarada, IS=1 y puede recomendarse. Si coincide con las cuatro dimensiones al máximo =100, no hay probabilidad ni experiencia inferida. Si una persona no declara preferencias, Para ti puede estar vacío con invitación a editar perfil; no inventar intereses. Para equipos mantener reglas específicas de necesidad, cupo, semestre y disponibilidad; no aplicar fórmula genérica si destruye complementariedad vigente. Las sugerencias no revelan los objetivos privados de otra persona.

### 10.4 Pruebas y ayuda de usuario

Fixtures: misma actividad con Mucho/Bastante/Un poco ordenadas; solo skill; solo mejora; ambas; varios skills iguales/alias; sin preferencias; cambio de nivel; guardar 10 veces; perfil privado; oportunidad cerrada; recurso retirado; equipo lleno. Mostrar «Te interesa Bases de Datos» / «Coincide con MongoDB» / «Quieres fortalecer Redes», no prioridad numérica. Informe técnico para defensa: algoritmo real, fórmula y ejemplos ejecutados (no confundir propuesta §10.3 con implementación). No exponer preferencias privadas en cards públicas de equipos. Cualquier ajuste requiere versión y comparación previa/posterior en fixtures.

## 11. Filtros de Biblioteca y Proyectos de la carrera (pp. 20–21)

Biblioteca: agregar filtro de creador/publicador por nombre, similar al responsable de actividades, junto a título/descripción, área y tecnología. Recurso no tiene por qué tener responsable operativo; filtrar por `created_by` o relación real de publicador, no crear campo redundante ni confundirlo con la entidad que escribió el material. Mostrar texto «Publicado por» si corresponde a datos reales. En Proyectos de la carrera agregar filtro por responsable del proyecto, no por cualquier miembro indistintamente. Buscar por nombre y apellidos normalizados, respetar privacidad y visibilidad de proyectos, filtrar servidor antes de paginar, botón Limpiar restaura filtros sin alterar pestaña. Mantener Para ti y favoritos de Biblioteca y resultados existentes; filtro no cambia preferencias ni Afinidad. No filtrar usando correo privado ni ofrecer enumeración indiscriminada de usuarios. Probar paginación, búsqueda combinada, sin coincidencias y restauración.

## 12. Contactos, QR, canales y equipos (pp. 21–25)

### 12.1 Buscador de contactos

Web y móvil permiten buscar por nombres y apellidos sin que el formato de comas impida encontrar coincidencias. Normalizar Unicode/acentos, case, espacios repetidos y separadores usuales (coma, guion cuando sea útil sin confundir identidad). Buscar tokens sobre nombre(s)/apellidos; admitir orden razonable `Quispe, Ana` y `Ana Quispe` con coincidencia de los términos relevantes. No usar regex aportada por usuario ni consultas interpoladas. Respetar mínimo de texto existente, limitación de resultados, paginación y protección contra enumeración; mantener criterios de descubrimiento/consentimiento, excluir usuarios no elegibles y propio usuario. No mostrar correo institucional ni identificadores internos por defecto. Resolver mediante ID real al solicitar, no por igualdad de nombre; dos homónimos permanecen personas distintas.

En web retirar el formulario de pegar identificador de perfil/solicitud por código y el texto «nombre o identificador»; usar búsqueda por nombre/apellidos y botón Solicitar contacto. Esto no elimina el enlace compartible/QR de Mi perfil ni su vista previa. Móvil admite dos caminos: búsqueda textual o escanear QR con cámara (pedir permiso de cámara bajo interacción, mensaje/fallback de búsqueda si no hay acceso). El QR abre perfil resumido autorizado y permite solicitar contacto desde él, no añade automáticamente ni da acceso a campos privados. No seguir URLs arbitrarias desde QR; validar formato/enlace Afinia y manejar identificador revocado/privado/no existente. Si llega invitado a perfil público, no exponer acción autenticada sin iniciar sesión; preservar objetivo tras login solo si flujo seguro ya existe. No implementar registro público nuevo.

Solicitudes deben ser idempotentes, visibles como pendientes, destinatario acepta/rechaza; no enviar duplicadas, no permitir auto-contacto, y respetar bloqueos/remoción. No crear chat. Mantener el QR de perfil separado de todo módulo de certificados retirado en §7.

### 12.2 Canales externos y nota (D08)

El Word considera que es mejor enviar un mensaje por un canal elegido. No convertirlo en chat ni enviar correo haciéndose pasar por el estudiante desde SMTP de Afinia. Mantener canales voluntarios en Mi perfil → Visibilidad (correo de contacto, Teams, WhatsApp, LinkedIn, otro enlace si existe), consentimientos y visibilidad. En Mis contactos, acciones `Contactar por correo` abre `mailto:` con destinatario autorizado y asunto/cuerpo opcional; WhatsApp abre enlace seguro solo con número compartido y normalizado; Teams/LinkedIn abren enlace validado existente. El usuario confirma envío dentro de su cliente; Afinia no garantiza entrega. Abrir Outlook no implica API ni acceso a buzón. No usar cuenta institucional privada cuando no fue compartida, ni exponer teléfono a desconocidos. Si no hay canales visibles, mostrar mensaje neutro. Las notas privadas/alias/canal preferido existentes no se pierden; D08 decide si retirar la edición visible o conservarla. Si se retira vista, mantener datos históricos. No almacenar texto de mensajes externos ni introducir secretos OAuth/integraciones sin autorización.

### 12.3 Equipos

Dentro de Contactos/Equipos, organizar equipos por `Para ti`, `Todas las necesidades abiertas` (elegibilidad de semestre/scope y reglas reales), `Mis equipos / Mis necesidades` según UI existente. Reutilizar componentes de tabs, tarjetas/grid, búsqueda y paginación; no renderizar lista gigante. 10 por página o tamaño existente compatible. Cada necesidad muestra descripción, áreas, skills, vacantes, condiciones y disponibilidad pública permitida. Para ti usa recomendaciones según perfil confirmado y reglas de complementariedad existentes (§10); no exponer objetivos privados de otros. Mantener crear necesidad, postular/solicitar unirse, decisión del responsable, invitaciones, aceptación/rechazo, membresías y equipos reutilizables en proyectos. No convertir postulación en contribución confirmada ni experiencia. Probar cupo, cambios de estado, permiso, equipo lleno y ausencia de preferencias. No rehacer gestión de equipos si ya funciona; corrección es organización, paginación y comprensión.

## 13. Inicio de Dirección (p. 30)

Aplicar patrón de detalles de solo lectura §3.1 a cada card/métrica/acción diaria realmente existente en Dirección. No copiar permisos ni módulos propios de Admin. Priorizar:

| Card o acción existente | Modal y destino |
|---|---|
| Actividades por aprobar | 10 propuestas pendientes, creador/tipo/fecha; Ir a Aprobaciones con filtro pendiente y tipo |
| Credenciales en revisión | 10 solicitudes pendientes, origen/estudiante/estado de fases; Ir a revisión de credenciales |
| Estudiantes | resumen reciente y totales del scope; destino de gestión/consulta de estudiantes realmente existente |
| Proyectos | proyectos elegibles recientes y estado; Ir a Proyectos de la carrera según permiso |
| Actividades | recientes por tipo/estado; Ir al módulo con filtros |
| Participaciones | hechos recientes, asistencia pendiente/cerrada y estado; Ir a Participaciones con contexto |
| Recursos (si visible) | altas y propuestas pendientes; Ir a Recursos según filtro |
| Autonomía docente | docentes con autorización por módulo/estado; Ir a Autonomía docente, sin cambiar desde modal |
| Puntos de estudiantes (si visible) | últimas concesiones y propuestas pendientes; Ir a Puntos de estudiantes |
| Analítica / Cómo va la carrera | resumen real de métricas disponibles, sin inventar valores; Ir a sección analítica correspondiente (Panorama, Afinidad, Participación, Demanda, Evolución si existen) |

No duplicar cards si una métrica y una acción abren el mismo modal; reutilizar. Si no hay ruta de gestión para alguna métrica, abrir resumen y enlace a vista válida existente, reportar gap, no crear CRUD nuevo. Conservar dashboard y colores actuales de Dirección, solo mejorar UX y filtros. Eliminar Registros verificables del menú y acciones. Admin no hereda aprobaciones por reutilizar un componente. Todas las consultas aplican role/scope en servidor. No dar acceso a documentos privados en cards de analítica.

## 14. Batches V7 (orden de ejecución único)

Ejecutar uno por autorización. Las Dxx detienen solo decisiones de negocio dependientes, no la auditoría ni ajustes independientes. No arrancar un batch grande sin identificar subcommits/test plan.

| Batch | Alcance / entregable | Dependencia y criterios de salida |
|---|---|---|
| V7-0 | Rama nueva, GAP, inventario DB/rutas/estados, baseline, decisiones confirmadas D01–D05, límites D06–D08 y plan | Sin código funcional; identificar rama y hash, tests reales; entregar GAP para aprobación |
| V7-1 | Filtros excluyentes, paginación, query params y revisión separada | No modificar estados de datos; tests de 0/1/11 registros, permisos y navegación |
| V7-2 | Aprobación/publicación, lectura Admin de propuestas, asistencia lock | Aplicar D02 y D04 confirmadas para transiciones/resultados; pruebas transaccionales y regresión de responsable×semestre/admisión |
| V7-3 | Credenciales: formulario, origen, hidratación bloqueada, procesamiento técnico | D03 confirmada y límite D08; fases según modelo, histórica/sin modelo revisión directa, carga tardía por Dirección, archivo vinculado obligatorio, errores técnicos no bloquean envío |
| V7-4 | Bandeja, revisión humana obligatoria, decisión, historial, estados y elegibilidad | D01 confirmada; Admin solo lectura, ningún bypass automático; revisar impacto en Afinidad sin recalibrar; no reclasificar históricos masivamente |
| V7-5 | Documentos institucionales, modo general/individual, entrega, abrir archivo | D04/D05 confirmadas; cierre lista independiente; idempotencia, storage privado y tests de acceso cruzado |
| V7-6 | Retirar Registros verificables y `/verificar` en web/móvil/API, detener emisión propia | Inventario previo; conservar histórico; QR perfil y OCR/QR externo intactos |
| V7-7 | Proyectos: checklist/activación, reconciliar señal GitHub/chips y alta de skill, retirar Abrir de Proyectos | Reproducción antes de corregir; activación legítima, evidencia segura, contribuciones no regresan |
| V7-8 | Explicar Afinidad, respaldos y recomendador; corregir UI técnica | D06 antes de cambiar fórmula; entregar fórmula REAL y pruebas; confirmar elegibilidad afectada por V7-4/5 |
| V7-9 | Perfil: tecnologías respaldadas, filtro publicador Biblioteca y responsable Proyectos | Contratos de respaldo V7-7/8; no exposición privada ni cambios de score por filtros |
| V7-10 | Contactos búsqueda, QR móvil, canales externos, equipos tabs/paginación | D08 para notas; no chat; permiso cámara, consentimiento, scope y solicitudes idempotentes |
| V7-11 | Inicio Admin completo, modales, contadores, filtros y sidebar/color | V7-1/2/4/5 para datos; D07 para nuevas retenciones; 15 grupos de datos con UX coherente, quitar card correo |
| V7-12 | Inicio Dirección y modales con permisos | Reutilizar V7-11 sin elevar rol; filtrar tipo/estado; no rehacer analítica |
| V7-13 | Regresión integral web/API/móvil y seguridad, documentación, trazabilidad, entrega | Builds, pruebas reales, informe por requisito; defectos no resueltos explícitos; no declarar cerrado si decisión crítica pendiente |

Si una corrección pequeña necesita componente compartido antes de su batch, registrar dependencia y pedir autorización para ese cambio limitado. No ejecutar un plan V6 aparte. Los contratos anteriores aportan contexto, no otra cola de cambios. No programar módulos nuevos de autenticidad, emisión, chat o analítica predictiva.

## 15. Matriz de aceptación (mínimo obligatorio; ampliar con hallazgos GAP)

Cada fila es un escenario a ejecutar, no un resultado. Registrar pasos, entorno, datos de prueba, resultado observado, PASS/FAIL/BLOCKED/NE y evidencia. Reproducir con fixtures sanitizados, no con datos personales reales innecesarios.

| ID | Escenario | Esperado |
|---|---|---|
| G01 | árbol Git sucio | detener cambios; no descartar; informar |
| G02 | nueva rama desde base verificada | hash base igual; rama anterior intacta |
| F01 | Usuarios filtro Suspendidas | solo suspendidas; no activas ni pendientes |
| F02 | Pendientes de activación | solo estado real de activación pendiente; no confundir con baja |
| F03 | catálogo retirados + búsqueda | solo retirados coincidentes, total filtrado |
| F04 | cambio de filtro en página 2 | página 1 y resultados correctos |
| F05 | entrar desde card con filtros | filtros persistidos tras recarga y navegación |
| A01 | Admin consulta propuesta pendiente | ve detalle; no ve borrador privado ajeno |
| A02 | Admin intenta aprobar propuesta de docente por API | 403 o rechazo equivalente; sin cambios |
| A03 | Dirección aprueba propuesta válida | revisión aprobada + publicación y apertura automática atómicas si fecha futura/cupo; no queda borrador |
| A04 | Dirección observa/rechaza | no publica; conserva trazabilidad |
| A05 | aprobación repetida | no notificación/efecto duplicado |
| A06 | llegada de inicio/fin y cupo agotado | cierre/inicio y finalización automáticos en backend; no abrir inscripción indebida |
| A07 | edición quita responsable de 5–8 | no conserva semestres huérfanos; respeta 1–4 |
| A08 | responsable asignado de scope parcial | ve detalle publicado, opera solo scope; no edita material ajeno |
| A09 | duplicación docente de actividad ajena | borrador con scope propio, sin asistentes/documentos heredados |
| A10 | evento FINISHED con lista abierta | se puede terminar registro permitido; no confundir cierre |
| A11 | asistencia cerrada, intento Corregir UI y API | no botón normal; API bloquea al responsable normal |
| A12 | ausencia vs solicitud admitida | no se atribuye presencia ni documento |
| C01 | histórica con archivo sin QR | envío directo manual, fases técnicas no aplican |
| C02 | histórica con URL individual sola | comportamiento conforme D08; sin escaneo automático |
| C03 | vinculada, elegir actividad finalizada elegible | título/emisor esperado/áreas/skills recuperados y bloqueados |
| C04 | modificar IDs bloqueados en body | servidor rechaza/deriva de actividad; no altera taxonomía |
| C05 | oportunidad no elegible/otra cuenta | no permite registro vinculado |
| C06 | vinculada sin archivo | validación inline y API, no crea envío sin archivo |
| C07 | archivo sin QR y sin modelo | fases técnicas omitidas y revisión manual directa, sin bloqueo |
| C08 | modelo con otro titular | comparar titular con estudiante, no con modelo |
| C09 | certificado versión distinta | diferencias explicadas; no bloquear revisión |
| C10 | QR a página general del curso | fuente localizada, identidad no corroborada, revisión pendiente |
| C11 | QR individual con titular coincidente | evidencia favorable, sigue revisión humana pendiente |
| C12 | QR de otra persona | discrepancia visible; no aprobar automáticamente |
| C13 | timeout/CAPTCHA/rate limit | inconcluso, no acusar fraude ni bloquear envío |
| C14 | OCR y QR ambos positivos | aun así revisión pendiente |
| C15 | OCR y QR ambos negativos/inconclusos | se envía si archivo seguro; revisión decide |
| C16 | URL a host privado/redirección maliciosa | rechazar consulta insegura, registrar motivo; no SSRF |
| C17 | estudiante fuerza AUTO_VERIFIED en body | no autorizado, no genera afinidad |
| C18 | reintento upload/envío | no crea duplicado; conserva intentos |
| C19 | reemplazo de archivo con worker en curso | resultado viejo no se aplica al nuevo hash |
| C20 | Dirección aprueba con fuente suficiente | decisión y respaldo coherentes, actor/fecha/método, fases conservadas |
| C21 | revisión observa/rechaza | motivo visible y corrección conforme política; no afinidad por pendiente/rechazada |
| C22 | aprobación manual sin prueba concluyente | etiqueta de revisión con alcance; no falsa autenticidad ni corroboración fuerte |
| C23 | credencial antigua previamente aprobada | no se revoca silenciosamente al desplegar V7 |
| I01 | sin resultado / solo participación | sin resultado: asistencia operacional sin trayectoria/afinidad/skills respaldadas; solo participación CONFIRMED: trayectoria y elegibilidad de afinidad, sin documento |
| I02 | general con archivo real y lista cerrada | entrega automática a confirmados elegibles una vez al cumplir fin y cierre de lista |
| I03 | general sin archivo | pendiente, sin fabricar PDF |
| I04 | individual con dos personas | dos archivos correctos; no botón mismo archivo a todos |
| I05 | repetir entrega al mismo alumno | no duplicado; botón Entregado |
| I06 | estudiante abre certificado recibido | archivo correcto, autenticado; MIME correcto |
| I07 | otro estudiante solicita archivo individual | 403/404 equivalente, sin fuga |
| I08 | falla storage en entrega/lectura | error claro, sin éxito falso; retry idempotente |
| V01 | landing, sidebar estudiante/Dirección/Admin | sin enlace Registros verificables ni Verificar |
| V02 | ruta pública `/verificar` directa | no verificación funcional; respuesta neutra definida |
| V03 | API/job de emisión propia | no genera nuevos documentos; permisos no bypass |
| V04 | QR perfil y QR externo | siguen funcionando; no dependen de módulo retirado |
| V05 | histórico propio anterior | preservado restringido; no se emite ni se muestra como credencial profesional |
| P01 | individual con checklist completo | activa y actualiza UI, sin requisito artificial de equipo |
| P02 | equipo con todos los requisitos reales | activa con contribuciones confirmadas |
| P03 | falta evidencia y demo | no activa; razón visible aunque tenga galería |
| P04 | evidencia privada válida sin demo | activa si resto cumple |
| P05 | demo segura sin evidencia | activa si resto cumple |
| P06 | Python declarado antes del escaneo | detectada/verde con fuente tras escaneo |
| P07 | Python detectado antes de declarar | selección reconcilia señal vigente, sin stale gris |
| P08 | FastAPI/Pytest aprobadas en catálogo | señal previa vigente reconciliada; no autoatribuir si no hay señal |
| P09 | repo cambia/falla temporalmente | no usar señal de repo anterior como vigente, inconcluso explicado |
| P10 | dos integrantes confirman misma skill | ambas contribuciones permitidas, sin duplicar globalmente |
| P11 | proyecto lista evidencias | no enlace Abrir; sección Evidencias conserva acceso legítimo |
| P12 | proyecto visible a tercero | no repo privado/evidencias ni acceso directo no autorizado |
| M01 | Mucho vs Bastante vs Un poco | diferencia de orden explicada conforme fórmula real aprobada |
| M02 | solo skill de interés | recomendación elegible, razón específica |
| M03 | solo mejora | recomendación elegible, objetivos privados |
| M04 | favorito/click repetido | 0 efecto en recomendador, Afinidad y puntos |
| M05 | interés de test ya confirmado | no doble conteo |
| M06 | Afinidad llega al tope | explicación saturación; no dominio profesional |
| M07 | revocar/corregir respaldo | recálculo según reglas reales y auditoría; no decaimiento inventado |
| M08 | tecnologías respaldadas en perfil | solo fuentes elegibles; contexto, no autoatribución de roles |
| M09 | actividad con área general sin skill | sin inventar skill en perfil |
| B01 | Biblioteca filtrar por publicador | resultados correctos y paginados; no cambiar preferencias |
| B02 | Proyectos por responsable | filtra por responsable real, no cualquier miembro; respeta visibilidad |
| T01 | buscar «Ana Quispe» y «Quispe, Ana» | encuentra mismo perfil descubrible; no requiere coma |
| T02 | acentos, espacios y homónimos | normalización sin confundir identidad ni exponer datos privados |
| T03 | web sin formulario identificador | búsqueda y solicitud funcionan; QR compartible en perfil intacto |
| T04 | móvil escanea QR válido | perfil autorizado y Solicitar contacto; no contacto automático |
| T05 | QR privado/revocado/no Afinia | mensaje seguro; no navegar arbitrariamente |
| T06 | solicitud duplicada/auto-contacto | idempotente o rechazo; consentimiento intacto |
| T07 | contacto sin canal compartido | no exponer correo/teléfono; mensaje claro |
| T08 | canal correo/WhatsApp | abre cliente externo; no envía como estudiante desde SMTP |
| T09 | equipos con 11+ necesidades | paginación; tabs Para ti/Todas/Mis según contrato |
| T10 | equipo lleno o scope no elegible | no permite solicitud indebida |
| H01 | cada modal de Admin con 0/1/11 elementos | total real, máximo 10, vacío correcto, Ir filtrado |
| H02 | card A01 con activas y pendientes | solo pendientes; CRUD no duplicado |
| H03 | fila rol | modal rol correcto, destino filtrado |
| H04 | padrón sin original almacenado | resumen disponible; no descarga inventada |
| H05 | padrón con original autorizado | descarga autenticada, auditada, sin acceso ajeno |
| H06 | card entrega general 1 archivo a 8 | 8 destinatarios y 1 archivo, no confundir métricas |
| H07 | card externa con histórica/vinculada/pendiente | agrupación y filtros correctos, no «verificado» antes de revisión |
| H08 | propuestas de puntos/tecnologías/recursos | solo pendientes en vista de trabajo, histórico en sección separada |
| H09 | temporada inexistente/vigente | vacío honesto o fechas/bonus reales |
| H10 | proyecto borrador privado en BD | no se lista como proyecto compartido reciente |
| H11 | Admin sin card correo | ruta técnica autorizada aún funciona; SMTP no cambiado |
| H12 | Dirección abre cada card | mismo patrón, roles propios, sin permisos Admin |
| H13 | consultas dashboard fallan | error/retry, no ceros falsos como datos válidos |
| H14 | modal teclado/responsive | foco, cierre, retorno y scrolling correctos |
| R01 | activación/cuenta/padrón y recuperación | regresión sin cambios de identidad |
| R02 | autorización autónoma recursos/puntos | permisos y revocación intactos; actividad no hereda autonomía |
| R03 | puntos por recurso/actividad/proyecto | opcionales, idempotentes y sin Afinidad |
| R04 | export resumen selectivo | solo ítems elegibles seleccionados, no sello de Afinia |
| R05 | cliente Android y web con contratos afectados | sin errores nuevos; bloquear explícitamente si no se puede ejecutar |
| A13 | docente aprobado para fecha futura y capacidad disponible, sin abrir navegador | OPEN automático, inscripciones disponibles según modalidad |
| A14 | Dirección/Admin guardan borrador y luego publican | borrador privado hasta publicar; publicación abre automáticamente si elegible |
| A15 | inicio transcurre sin refrescar interfaz; petición directa de inscripción | backend cierra y rechaza inscripción tardía; al fin FINISHED |
| A16 | aprobación concurrente con inicio/cupo; propuesta vencida | no apertura tardía ni sobrecupo; motivo claro; no revivir FINISHED |
| C24 | Admin intenta aprobar/observar/rechazar por API | denegado; estado, respaldo y auditoría sin mutación de decisión |
| C25 | oportunidad sin modelo se aprueba; estudiante sube archivo válido | no bloqueo de publicación ni envío; manual directo, fases 1/2 omitidas |
| C26 | Dirección agrega modelo después de aprobación o finalización | versión auditada privada; no cambia datos materiales ni estado; nuevos envíos usan referencia |
| C27 | docente intenta actualizar modelo por endpoint de edición general o acción específica | denegado; no se desbloquea formulario ni se evita revisión |
| C28 | modelo incorporado después de revisión aprobada; worker tardío | decisión anterior intacta; solo pendiente puede recomprobarse explícitamente, historial preservado |
| I09 | documento general real, actividad finalizada y lista cerrada, presentes/ausentes | entrega automática a confirmados elegibles; no duplicados ni entrega a ausentes |
| I10 | Sin resultado, asistencia confirmada, recálculo y exportación | asistencia conservada; ninguna contribución de afinidad/Support, skill respaldada ni entrada de trayectoria/exportación por esa actividad; gamificación conserva política vigente |
| I11 | Solo participación y certificado institucional de la misma actividad | una experiencia por participación confirmada; documento no añade otra contribución |

## 16. Trazabilidad de las 32 páginas

| Páginas | Hallazgo / decisión del Word | Sección / batch |
|---|---|---|
| 1 | Inicio Admin, detalles 10 y navegación filtrada, resumen sin acciones directas | §3; V7-11 |
| 2 | credenciales pendientes, rol, padrón, auditoría, quitar correo, áreas/skills, pedidos tecnología | §3; V7-11 |
| 3 | pendientes por tipo, Admin solo consulta, categorías, entregas institucionales y participación | §§3–6; V7-2/5/11 |
| 4 | externas, cobertura, recursos, puntos, temporada, proyectos recientes | §3; V7-11 |
| 5 | filtros solo suspendidos y pendientes de activación | §4; V7-1 |
| 6 | review filter, lectura Admin, aprobación publica; conflicto apertura | §4, D02; V7-2 |
| 7 | quitar Abrir de Proyectos; histórica directa a revisión, no bloquear por fallo técnico | §§5,8; V7-3/7 |
| 8 | OCR, QR/enlace y revisión humana siempre; no garantía de autenticidad | §5; V7-3/4 |
| 9 | precargar nombre/emisor/áreas/skills; archivo obligatorio, escaneo previo opcional | §5; V7-3 |
| 10 | campos técnicos de oportunidad, modelo, detalle de fases | §5, D03; V7-3 |
| 11 | Dirección decide y fases persistentes | §5, D01; V7-4 |
| 12 | proyecto checklist verde sin activar, chips inconsistentes MongoDB/Python | §8; V7-7 |
| 13 | recuperar y bloquear áreas/skills de oportunidad | §5; V7-3 |
| 14 | certificado no abre, botón de entrega repetida | §6; V7-5 |
| 15 | asistencia cerrada sin corrección ordinaria, general/individual | §6, D05; V7-2/5 |
| 16 | retirar registros verificables/Open Badges propios | §7; V7-6 |
| 17 | niveles de interés de área, skills binarias | §10; V7-8 |
| 18 | explicar orden de recomendaciones y Afinidad | §§9–10; V7-8 |
| 19 | tope y posible descenso de Afinidad, lenguaje simple | §9; V7-8 |
| 20 | filtro Biblioteca por publicador, tecnologías respaldadas de perfil | §§9,11; V7-9 |
| 21 | filtro proyecto por responsable, buscar contactos sin comas/identificador | §§11–12; V7-9/10 |
| 22 | escanear QR, vista previa y solicitud móvil | §12; V7-10 |
| 23 | retirar solicitud manual por ID en web, nota/canal de contacto | §12, D08; V7-10 |
| 24 | canal externo, recomendaciones y paginación de equipos | §12; V7-10 |
| 25 | organizar como Biblioteca, detectar tecnología al guardar | §§8,12; V7-7/10 |
| 26 | detectar antes de declarar, etiqueta no refresca | §8; V7-7 |
| 27 | alta posterior Admin, chip y activación | §8; V7-7 |
| 28 | quitar `/verificar` y enlace landing | §7; V7-6 |
| 29 | retirar módulo de Admin/Dirección, no afirmar autenticidad propia/externa | §§5,7; V7-4/6 |
| 30 | Inicio Dirección: detalles por acción/card | §13; V7-12 |
| 31 | agrupar sidebar Admin por subtítulos | §3; V7-11 |
| 32 | color/jerarquía en Inicio Admin como otros actores | §3; V7-11 |

## 17. Informe de ejecución obligatorio por batch

```text
BATCH / rama / commit base / commit resultante:
Requisitos y páginas:
Decisiones Dxx confirmadas (adjuntar referencia a respuesta del usuario):
Estado previo y reproducción (archivo/línea, request/respuesta sanitizados):
Ya estaba correcto (sin cambios):
Cambios exactos y archivos:
Migraciones / datos preservados / compatibilidad web-móvil:
Pruebas ejecutadas (comando, resultado, evidencia):
PASS / FAIL / BLOCKED / NE (real, no estimado):
Regresiones verificadas:
Riesgos o limitaciones:
Pendientes y siguiente batch propuesto:
```

En cierre, generar resumen de cambios con matriz de aceptación por ID, matriz de permisos real, fórmula vigente de recomendador y Afinidad con ejemplos ejecutados, alcance de credenciales/respaldos, lista de vistas retiradas y comprobación de rutas, y evidencia de rama protegida. Actualizar ayuda y Swagger solo donde cambie contrato; no modificar documento de grado ni inventar que su trazabilidad está actualizada sin instrucción. Si se requiere cambiar documento académico, entregar lista de diferencias para que autores decidan.

## 18. Definición de terminado

- Todos los requisitos inequívocos del Word tienen implementación comprobada o clasificación documentada ALREADY_CORRECT.
- D01–D05 implementadas y probadas; D06–D08 auditadas con políticas existentes preservadas y cambios no autorizados fuera de alcance. No presentar como terminado un flujo cuya política siga sin resolver.
- Inicio Admin y Dirección muestran resúmenes reales de hasta diez, filtros correctos y sin elevación de permisos.
- Certificados externos nunca se autoaprueban; histórica y vinculada siguen flujos diferentes, fases persistentes, revisión humana y lenguaje honesto.
- Entrega institucional no fabrica certificados, respeta destinatario, archivo y cierre de asistencia, sin duplicados.
- Sin emisión ni página pública de verificación propia; datos legados preservados, QR de perfil y comprobaciones externas intactas.
- Proyectos activables cuando cumplen condiciones reales; tecnologías y señales reconciliadas sin atribución personal falsa; evidencia privada protegida.
- Recomendador y Afinidad tienen fórmula real verificable y explicación entendible. Favoritos no puntúan. Puntos independientes.
- Contactos y equipos organizados, búsquedas correctas, consentimiento y canales externos; no chat.
- Rama anterior intacta, pruebas y resultados reales, defectos pendientes explícitos. No se exige una cifra de éxito inventada.

## 19. Prompt de inicio para Claude Code

> Lee completo este contrato V7.1. Es el único plan de correcciones de la auditoría final. Primero identifica la rama con los últimos avances válidos y protégela; crea una rama nueva `feature/afinia-v7-cierre-final` solo si la base fue verificada y el árbol está limpio. Ejecuta exclusivamente V7-0: auditoría GAP, inventario, baseline y plan. No toques código funcional, no descartes trabajo ni borres datos/migraciones. Aplica D01–D05 como decisiones confirmadas. Audita D06–D08 y conserva lo vigente sin ampliar el alcance; solicita autorización solo para los cambios expresamente reservados. No inventes fórmulas ni resultados. Al terminar entrega el GAP y espera autorización antes de V7-1. Conserva todo lo que ya funciona.

**FIN — AFINIA V7.1, correcciones finales consolidadas.**
