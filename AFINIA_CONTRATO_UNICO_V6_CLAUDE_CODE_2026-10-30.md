# AFINIA — CONTRATO ÚNICO V6 PARA CLAUDE CODE / CODEX
## Correcciones incrementales de `corregir v6.docx` (38 páginas) + reglas compatibles de V5 y auditorías anteriores

**Fecha de consolidación:** 30 de octubre de 2026  
**Documento fuente prioritario:** `corregir v6.docx` (38 páginas, 58 imágenes aproximadas).  
**Contrato anterior contrastado:** `AFINIA_CONTRATO_UNICO_V5_CORRECCIONES_CLAUDE_CODE_2026-10-26.md`.  
**Nueva rama sugerida:** `feature/afinia-v6-cierre`.  
**Modo:** trabajo incremental por batches, con auditoría previa, pruebas reales y sin destrucción de la base existente.  
**Naturaleza:** instrucciones para revisar y modificar código EXISTENTE; **no** son un informe de que los cambios ya estén implementados.

> **Instrucción crítica:** este documento sustituye el **plan de ejecución** V5 para los ajustes de cierre. Es autocontenido para esta ejecución. Los requisitos históricos que no se contradicen se conservan; las decisiones V6 explícitas prevalecen. NO ejecutar los batches V5 antiguos por separado ni utilizar una implementación anterior como autorización para revertir V6.

---

# 0. INSTRUCCIONES PARA EL AGENTE — LEER ANTES DE PROGRAMAR

## 0.1 Propósito y límites

Afinia construye un **historial/perfil dinámico de trayectoria estudiantil**, con recomendaciones, proyectos, participaciones, evidencias con procedencia, colaboración y una exportación informativa seleccionable. No reemplaza SIU ni Teams. No certifica competencias, autoría, calificaciones ni empleabilidad. Los documentos externos siguen perteneciendo a sus emisores; los institucionales a las autoridades correspondientes.

**Conservar exactamente cinco roles**: `STUDENT`, `TEACHER`, `CAREER_DIRECTOR`, `SCIENTIFIC_SOCIETY`, `ADMIN`. Web para todos; app móvil enfocada en `STUDENT`. No introducir chat, un sexto actor, acreditación automática ni análisis obligatorio de IA. `AI_PROVIDER=none` debe seguir funcionando.

Las correcciones V6 buscan **coherencia de extremo a extremo**, principalmente permisos/semestres, contribuciones a proyectos, información pública versus privada, recomendaciones simples y documentación de respaldos. No son permiso para rediseñar módulos ajenos a los defectos señalados.

## 0.2 Protocolo Git obligatorio

1. Inspeccionar `git branch --show-current`, `git status --short`, `git log -5 --oneline` y remotos.
2. Determinar **qué rama contiene los avances más recientes** del V5; no asumir que el nombre por versión prueba el último commit.
3. **Si el working tree no está limpio, detener cambios** y reportar las rutas. Nunca desechar cambios ajenos.
4. Verificar que la rama base está actualizada sin hacer pull indiscriminado ni mezclar trabajo no confirmado.
5. Crear `feature/afinia-v6-cierre` **desde la rama base verificada**, o un nombre equivalente libre si ya existe; no sobrescribir una rama homónima.
6. Registrar base/commit/hash y un punto de recuperación. No hacer commit sobre la rama original.

Ejemplo **solo si la rama base correcta ya fue verificada y el árbol está limpio**:

```bash
git status --short
git branch --show-current
git switch <RAMA_BASE_VERIFICADA>
git switch -c feature/afinia-v6-cierre
git branch --show-current
```

Prohibido sin autorización: `git reset --hard`, `git clean -fdx`, `git restore .`, `git push --force`, `git branch -D`, reconstrucción destructiva de BD o volúmenes Docker, eliminar `.env`, borrar históricos/migraciones, rebases de ramas protegidas. No cambiar contraseñas por versiones compartidas del `.env`; NO registrar secretos en commits, capturas, reportes o logs.

## 0.3 BATCH V6-0 solo audita

Antes de código, generar `AUDITORIA_GAP_AFINIA_V6.md` y `PLAN_BATCHES_AFINIA_V6.md` con:

- evidencia `archivo:rango de líneas`, endpoint, esquema, UI, test y reproducción para cada defecto;
- clasificación `ALREADY_CORRECT | PARTIAL | INCORRECT | MISSING | REGRESSION | NEEDS_DECISION | NEEDS_TEST`;
- baseline de compilación y pruebas, **sin inventar PASS**;
- inventario de migraciones/históricos y riesgo de acceso/privacidad;
- orden propuesto según dependencias y `feature flags` si una migración debe convivir con clientes antiguos.

**Entregar el GAP al usuario antes de iniciar V6-1.** Un batch se ejecuta por autorización, no todos a la vez.

## 0.4 Procedimiento invariable por batch

```text
A. Verificar rama y árbol; leer implementaciones/contratos actuales.
B. Confirmar defecto con reproducción y test que falle (si corresponde).
C. Diseñar cambio mínimo; enumerar archivos/DB/rutas dependientes.
D. Implementar reutilizando componentes, servicios y tests existentes.
E. Ejecutar tests del batch + regresión acotada + build afectado.
F. Registrar PASS/FAIL reales, migraciones y pendientes; commit lógico.
G. Detenerse y entregar reporte. No pasar al siguiente sin autorización.
```

No alterar lógica fuera del alcance como “limpieza”. Si un requisito ya funciona, documentar evidencia y no reescribir. No cambiar fórmulas, permisos, estados o enum de forma incompatible sin contrato/migración/test. Almacenar temporalmente compatibilidad con clientes web/móvil si un endpoint cambia.

## 0.5 Jerarquía de fuentes y decisiones

1. Decisiones **finales y explícitas** del V6, sobre todo las últimas páginas.
2. Este contrato V6, que separa conclusiones firmes de preguntas exploratorias.
3. Contrato V5 **solo donde no contradiga** V6.
4. V4/V4.1/V3.2 para comportamientos persistentes, nunca para resucitar partes retiradas.
5. Código real y pruebas para determinar qué existe (no para invalidar requisitos).

Las preguntas del autor en el Word (“¿conviene?”, “no sé”) **no son requerimientos cerrados**. Este contrato fija alternativas conservadoras cuando hay claridad; donde requiere aprobación institucional, marcar `NEEDS_DECISION` y **no automatizar una potestad institucional**.

---

# 1. MODELO ESTABLE COMPLETO (HEREDADO SIN CONTRADICCIÓN)

```text
ADMIN provisiona cuentas por correo institucional y datos oficiales
  → estudiante activa cuenta (enlace/código, contraseña y sesión)
  → onboarding: datos base, intereses, áreas/tecnologías a mejorar,
     disponibilidad, orientación opcional, privacidad
  → recomendador de actividades/biblioteca/equipos con razones explicables
  → actividades académicas/extracurriculares/externas: publicación autorizada
  → inscripción/admisión; asistencia realmente confirmada por responsable
  → trayectoria histórica (SIN certificado ni logro automático)
  → credenciales externas/institucionales registradas con procedencia
  → proyectos DRAFT → catálogo/GitHub/contribuciones/evidencia → ACTIVE
  → Afinidad contextual por trayectoria; Support separado por respaldo
  → contactos/equipos, control de visibilidad y QR de perfil
  → resumen/exportación selectiva de historial; gamificación independiente
```

## 1.1 Invariantes transversales

- Datos institucionales (semestre, identidades/roles) no son editables por estudiante; el Docente solo gestiona estudiantes de semestres autorizados.
- `Área` es agrupación general; `Tecnología/Habilidad` es elemento contextual del catálogo, puede asociarse a varias áreas con **un contexto seleccionado por experiencia**. Tags/alias ayudan a normalización/sugerencias, **no puntúan**.
- Áreas/tecnologías de proyectos, actividades y credenciales NO provienen de inferencia automática irrevocable. Cada dato conserva origen/procedencia.
- **Afinidad** es trayectoria ponderada/versionada sobre experiencias legítimas; no es dominio, calidad profesional ni título. **Support** es fuerza/diversidad de respaldo; no equivalente a Afinidad.
- Intereses y mejora, favoritos, imágenes de galería, tags, roles, puntos de gamificación, clics, visitar recursos y QR de perfil **no suman Afinidad**.
- Participación confirmada por una autoridad responsable puede alimentar historial/afinidad conforme motor existente; solicitud/admisión **no**.
- Proyecto `DRAFT` es privado e incompleto; `ACTIVE` necesita mínimos y confirmación de contribución. Repositorio público puede aportar **señales técnicas**, no autoría personal.
- Una credencial no es auténtica por OCR/QR genérico. `AUTO_VERIFIED` exige una fuente individual oficial que identifique al titular correcto, emisión y vigencia; sin eso revisión o inconcluso.
- Gamificación usa criterios/eventos autorizados e idempotentes, con auditoría y **cero efecto en Afinidad**.
- Evitar hard delete de registros históricos. Archivo de evidencia privado requiere autenticación/autorización, aunque se vea su existencia en panel propio.
- No mostrar versiones de auditoría/batches al usuario final. UI clara, responsiva, con errores inline, componentes propios y respeto de movimiento reducido.

## 1.2 Política institucional no resuelta en V5/V6

Autonomía docente para gestionar recursos y criterios de gamificación **no** equivale a autorización ilimitada para publicar actividades, certificar logros o acceder a estudiantes ajenos. Mantener política de Dirección configurable y auditable, con revisión de actividades por defecto según contrato V5, salvo permiso institucional concretamente configurado. No otorgar a un docente scopes fuera de su asignación por el mero hecho de que Dirección comparta una actividad.

---

# 2. MAPA DE SUPERACIÓN V5 → V6 (EVITAR CONTRADICCIONES)

| Asunto | V5 / estado previo | Decisión V6 que manda |
|---|---|---|
| Scope por responsables | Unión simple de semestres | **Asignación contextual responsable↔semestres**, unión del público objetivo con atribución explícita por responsable; al quitar responsable retirar cobertura huérfana y revalidar en backend |
| Copiar actividad | Heredar todos los datos | Crear DRAFT independiente ajustado a scopes actuales del duplicador, sin heredar autorización ajena |
| Admisión/cupo | Debate sobre modo abierto/manual | Modos **independientes** de capacidad; reglas transaccionales, sin forzar selección manual solo por cupo |
| Proyecto contribución | Roles + skills del proyecto | Roles opcionales/múltiples **no puntúan**, skills del proyecto sí; miembros distintos pueden usar la misma skill; arreglar error 400 |
| Identidad | Apellidos separados y código institucional existente | UI facilita dominio por rol, pero **no fabrica correo real** ni elimina identificadores únicos por suposiciones |
| OCR de proyectos | Podía quedar como apoyo | **QUITADO del pipeline de proyectos**. No reutilizar para inferir tecnologías ni exigirlo al activar |
| Proyecto activable | “evidencia del funcionamiento o demo” | Basta **una fuente no vacía**: evidencia privada de funcionamiento **o** demo accesible validada como URL; galería no cuenta |
| Galería vs evidencia | Ambas admiten imágenes | Galería es visible según visibilidad; evidencia es privada, sin exposición en Proyectos de la carrera |
| Repositorio público | Fuente técnica y posible enlace | Mantener análisis GitHub, pero **no exponer enlace de código fuente por defecto** en la galería |
| Contactos/Equipos | Vista de colaboración con QR/Contactos/Equipos | Contactos/Equipos se quedan unidos; gestión de QR/canales se muda a Perfil→Visibilidad + vista previa |
| Recomendador de actividades | `Me interesa` feedback y `No me interesa`/descartes | **Eliminar esas acciones y señales de interacción** de actividades; `Guardar` solo favorito, `Para ti` depende de perfil/orientación |
| Más sugerencias | Pantalla mezclaba áreas/equipos/actividades | Evitar duplicación; compañeros recomendados en Equipos, actividades en Para ti |
| Participación interna | Confusión con constancia/logro | **No generar insignia/constancia** por simple asistencia; distinguir comprobante institucional real |
| Exportación | CV genérico | **Resumen de trayectoria informativo**, opcional por ítem; no prometer CV profesional validado |
| Certificados internos | Podían mezclarse con participaciones | Sección propia “Certificados institucionales recibidos”; separación de externos y evidencias |
| Página de correo | Elemento visible de sidebar Admin | Seguir protegida en `/admin/mail`, **ocultar del menú** |

**No confundir “eliminar OCR de proyectos” con eliminar OCR/QR de credenciales.** Son casos de uso distintos.

---

# 3. ACTIVIDADES — CORRECCIÓN CRÍTICA DE RESPONSABLES Y SEMESTRES (V6 pp. 1–4, 7–10)

## 3.1 Diagnóstico a confirmar

La auditoría reporta:

- actividad creada por Admin para dos docentes; uno cubre 1–4 y otro 5–8;
- quitar el segundo responsable deja seleccionados semestres 5–8;
- al **editar** con Docente 1 solamente, puede añadir semestre fuera de su scope y guardar;
- al duplicar como Docente asignado, se heredan semestres ajenos y falla la operación;
- la UI muestra un estado que no coincide con la configuración realmente guardada.

No limitarse a limpiar chips en frontend. Inspeccionar `create/update/duplicate`, contratos DTO, consulta de permisos, tabla(s) puente, serialización y `TeacherScope`. Añadir pruebas de API contra solicitudes manipuladas.

## 3.2 Modelo lógico recomendado — responsabilidad contextual

Mantener **dos dimensiones**:

```text
Activity
  id, created_by, audience_scope, audience_semester_ids, status ...

ActivityResponsibleSemester (o proyección equivalente SIN nueva tabla innecesaria)
  activity_id
  responsible_user_id
  semester_id
```

Representa una relación N:M **con contexto de semestre**. La actividad también tiene el público objetivo derivado/autorizado. Si las tablas existentes ya permiten expresar esto, reutilizarlas; si solo guardan `responsibles[]` y `semester_ids[]` sin asociación, diseñar migración aditiva segura.

**Reglas backend:**

1. Un responsable Docente solo puede quedar asignado a semestres contenidos en su `TeacherScope` vigente.
2. Dirección puede tener cobertura de todos los semestres, **sin transferirla** al Docente por compartir actividad.
3. Para cada `semester_id` de audiencia, debe existir **al menos un responsable autorizado y asignado a ese semestre**, salvo política explícita de gestión exclusiva de Dirección/Admin.
4. Al añadir responsable, mostrar solo sus semestres; no asignarle automáticamente todos los del público.
5. Al quitar responsable, calcular cobertura restante. Si un semestre queda sin responsable, deseleccionarlo **con aviso** mientras el formulario es borrador; si actividad ya fue publicada/registró estudiantes, bloquear pérdida silenciosa y exigir reasignación/reprogramación/autorización según reglas actuales.
6. Si dos responsables cubren el mismo semestre, retirar uno NO retira ese semestre si el otro sigue asignado.
7. Ningún `PUT/PATCH` debe aceptar audiencia fuera de la unión de coberturas permitidas, ni permitir que el frontend añada `8°` al Docente de `1°–4°`.
8. Actualizaciones de responsables y coberturas deben ser **atómicas**; nunca guardar parte del cambio y dejar UI desincronizada.
9. Responsables múltiples ven/gestionan **solo sus alumnos autorizados**, con verificación backend; no extiendas TeacherScope.
10. Persistir quién era responsable/ámbito al momento del hecho cuando haya asistencia histórica; no reescribir la autoría de una confirmación ya registrada.

## 3.3 Ejemplo que Claude debe implementar/probar

```text
Carlos: 1,2,3,4
María: 5,6,7,8
Dirección: 1..8

Caso A: solo Carlos → se ofrecen 1..4.
Caso B: Carlos+María → audiencia potencial 1..8; asignación individual visible.
Caso C: quitar María → 5..8 quedan sin cobertura; impedir guardar esa audiencia
         salvo reasignación legítima. Mostrar aviso preciso.
Caso D: Carlos y María cubren 4 → quitar uno conserva 4 si el otro lo cubre.
Caso E: Dirección+Carlos → Dirección puede cubrir 1..8;
         Carlos solo sus semestres explícitamente asignados.
Caso F: request API malicioso asigna Carlos a 8 → 403/422 estable y trazable.
```

## 3.4 UX dependiente, no chips libres globales

- Elegir responsable → mostrar bloque con su nombre y únicamente sus semestres autorizados (chips), como **Área → Tecnologías**. Dirección muestra todos; Docente solo los suyos.
- Para varios responsables, bloques por persona; opción opcional de vista consolidada del público final **solo lectura**.
- Cuando no hay responsable, explicar y deshabilitar selección de semestre; para `DRAFT` permitir guardar incompleto si política existente lo admite, pero **no publicar** una actividad sin responsable/cobertura válida.
- Si Admin/Director elige “Todos los semestres”, hacerlo explícito: selector **Toda la carrera / Semestres específicos**. Con cobertura parcial, no fingir “Toda la carrera”.
- Antes de guardar, mostrar errores inline junto al responsable/semestre problemático; no borrar sin aviso datos publicados o históricos.
- Al cargar `Editar`, recuperar cobertura real por responsable; no reconstruir asignaciones arbitrarias a partir de la unión de audiencia.

## 3.5 Duplicar actividad sin elevar permisos

```text
Fuente PUBLICADA/FINISHED que el actor puede consultar/duplicar
→ crear NUEVO id con DRAFT, creador = actor actual
→ copiar contenido permitido, no arrastrar inscripciones, asistencia,
   revisión aprobada, constancias, puntos, historial, owner original
→ inicializar responsable actual y seleccionar como sugerencia solo
   la intersección de semestres con scopes del duplicador
→ si intersección vacía: DRAFT sin semestres + mensaje para completar
→ no error 400 por semestres heredados ni permisos sobre el original
```

No duplicar datos privados de otras personas ni contactos si no hay consentimiento/política. Si proyecto/actividad contiene archivos, analizar reglas existentes de referencias, no clonar sin controles.

## 3.6 Mis actividades como responsable de actividad ajena

- Mostrar botón **Ver detalles** de solo lectura, con modal accesible que explique fechas/modalidad/lugar/enlace si autorizado, áreas/tecnologías, responsable, semestre asignado, cupo, admisión, estado y contacto.
- Si el docente asignado no es el creador ni tiene permiso material de edición, **no mostrar Editar**; eso ya funciona y se preserva.
- Permisos operativos (asistencia/inscripciones/estados) siguen backend según scope y estado; ver detalles no equivale a editar.

---

# 4. ACTIVIDADES — ADMISIÓN, CUPO Y MODALIDADES (V6 pp. 5–8)

## 4.1 Cuatro combinaciones válidas; no acoplar conceptos

La fuente V6 plantea dos alternativas y termina pidiendo criterio. Elegimos la más flexible y defendible: **capacidad y política de admisión son ejes independientes**.

| Capacidad | Admisión | Qué ocurre |
|---|---|---|
| Sin límite | Abierta/automática | Solicitud elegible admitida automáticamente; nunca asistencia |
| Sin límite | Aprobación responsable | Solicitud queda pendiente hasta revisión; útil para grupos dirigidos |
| Con límite | Abierta/automática | Cupo adjudicado por regla determinista/transaccional, normalmente orden de solicitud; cerrar/rechazar al agotar cupo, sin sobrerreserva |
| Con límite | Aprobación responsable | Solicitudes pendientes; responsable admite hasta cupo, motivo para rechazo y auditabilidad |

**No imponer** “si tiene cupo, siempre selección manual”: aumenta trabajo y no evita arbitrariedad. **No imponer** “si es abierto, siempre sin límite”: hay talleres con 20 plazas e inscripción automática legítima.

El usuario verá claramente: `Admisión abierta` vs `Inscripción sujeta a aprobación`; `X/Y plazas` o `Sin límite`; `Solicitada`, `Admitida`, `Rechazada`, `En espera`, `Presente`, `Ausente` son semánticas separadas. No prometer fairness perfecta; explicar regla usada por cupo.

## 4.2 Estados y acciones por separado

```text
Solicitar inscripción
  → según admission_policy: admitida automáticamente o pendiente
  → capacity check atómico / idempotencia / TeacherScope del público

Responsable autoriza/deniega admisión
  → nunca CONFIRMED asistencia automáticamente

Evento realizado
  → responsable registra PRESENCIA/AUSENCIA en ventana controlada
  → solo presencia confirmada produce trayectoria/afinidad
```

`FINISHED` no implica que todos asistieron; `FINISHED` puede permitir el cierre posterior de lista según contrato V5 y actual. No habilitar retroactividad ilimitada. Inscripción a oportunidad externa no prueba que el proveedor emitió certificado.

## 4.3 Cobertura de formularios

- Formulario de actividades **externas** debe disponer exactamente de la misma política de admisión/cupo y controles de responsible↔semestres que académicas/extracurriculares cuando corresponda.
- Mantener pestañas distintas `Académicas`, `Extracurriculares`, `Externas`; NO volver a meter selector `Interna/Externa` que rehidrate campos incompatibles.
- Las credenciales modelo de proveedor son **opcionales**; OCR de plantilla ayuda extracción/comparación, pero no sustituye validación individual por QR/URL oficial.
- No alterar los flujos de publicación/aprobación ya correctos por crear el campo de admisión.

## 4.4 Guardar trabajo del usuario al navegar

- Para formularios **crear y editar** con cambios reales (`dirty state`), impedir pérdida inadvertida al cambiar pestaña, salir/cerrar modal, navegar con el router o recargar cuando el navegador permita advertencia.
- Modal propio: **Continuar editando / Descartar cambios y salir**; no `window.confirm`.
- No mostrar alerta si el formulario no cambió o se guardó con éxito; tras aceptar descarte, limpiar estado de edición del componente.
- Proteger sin atrapar al usuario en un bucle de popups; browser refresh puede requerir aviso nativo limitado por navegador.
- Reusar un hook/componente ya existente; no construir un mecanismo diferente en cada formulario.

---

# 5. GRIDS, CATALOGOS E IDENTIDAD (V6 pp. 9–17)

## 5.1 Listados activos por defecto

- Áreas, tecnologías, categorías, recursos, usuarios: por defecto **vigentes/activos**; selector claro `Mostrar también dados de baja / suspendidos` si rol tiene permiso.
- No ocultar por defecto datos históricos en reportes/relaciones antiguas; filtro del grid ≠ eliminación de BD.
- Actividades: mantener filtro por estados (borrador/publicada/abierta/cerrada/finalizada/cancelada); no reducir todas a "activo" cuando eso borra distinciones útiles.
- Grids: máximo 10 filas/página salvo justificación; búsqueda reactiva, paginación, orden y limpiar filtros. Cards de exploración 6/página donde ya se decidió.

## 5.2 Botón “Apellidos por separar (0)”

Auditar uso real; probablemente es indicador administrativo de **migración de datos heredados de apellidos**. Si 0 no necesita intervención, quitarlo de la UI principal o presentarlo discretamente en un panel técnico, **no borrar la migración ni perder la posibilidad de corregir registros antiguos**. No afirmar propósito sin inspeccionar código.

## 5.3 Usuarios: correo asistido, NO inventado

Intención V6: facilitar al Admin que seleccione rol y capture el **identificador local** del correo, agregando dominio institucional visualmente:

```text
STUDENT             → @est.univalle.edu
TEACHER/DIRECTOR    → @univalle.edu
ADMIN/SOCIETY       → revisar contrato institucional existente, no asumir dominio/alias
```

Mostrar vista previa completa, validar unicidad, normalizar espacios/case, permitir captura manual del correo institucional exacto si política lo exige. **No generar automáticamente direcciones reales basadas en nombre y apellido sin padrón/confirmación**, porque existen homónimos, colisiones, iniciales variables y formatos distintos. Los ejemplos de Word son orientativos, no un algoritmo oficial confirmado.

Mantener `university_code` **independiente del correo y del rol**; no quitar prefijos `EST-`, `DOC-`, `DIR-` por una ocurrencia. No inferir rol a partir del dominio, texto alfanumérico ni existencia de números. Identidad autorizada = rol almacenado y asignación institucional; código = identificador estable con unicidad y reglas/migraciones vigentes. El propio V6 detecta inconsistencia al intentar eliminar prefijos (pp. 16–17). Si la Universidad entrega padrón oficial de códigos y patrones, integrar por validación documentada; no fabricar números aleatorios o códigos que aparenten ser reales.

En el alta de Docente, incluir **semestres que dicta desde la creación**, no solo en Editar, con validación del backend. No aceptar que el campo sea obligatorio sin saber política de docentes sin carga aún; si no tiene asignación, cuenta puede quedar pendiente de configuración, pero no gestionar otros semestres.

## 5.4 Permisos y seguridad identidad

- Alta/importación: correo institucional, nombres, primer apellido requerido, segundo opcional; import CSV coherente, idempotente, previsualización antes de aplicar.
- El estudiante nunca redefine rol/semestre/código oficial; no derivar un cambio de rol editando correo.
- No exponer nombres/correos completos sin necesidad en ejemplos, logs ni enlaces públicos.
- Pruebas de duplicados de correo/código, colisiones de iniciales, correos completos versus parte local, teacher sin semestres, edición y migraciones existentes.

---
# 6. PROYECTOS — CONTRIBUCIONES Y ERROR 400 (V6 pp. 10–14)

## 6.1 Defecto confirmado por el usuario, causa aún no demostrada

```text
PUT /api/projects/:id/my-contribution
HTTP 400
code=VALIDATION_ERROR
```

Aparece con al menos un integrante (Luis); otro (Ana) parece registrar sus roles/tecnologías. **No diagnosticarlo como “error de API” sin inspección**: podría ser DTO, combinación de roles, skills/áreas, longitud mínima de texto, membresía, permisos, datos obsoletos o estado de invitación. Capturar respuesta JSON exacta en Network de cliente de prueba y compararla con validaciones del backend **sin volcar tokens ni datos personales**. Si hay condición legítima, corregir UX para advertir antes de enviar; si el backend rechaza algo permitido por contrato, corregir ambos lados.

## 6.2 Reglas de contribución final

- Un proyecto tiene miembros/invitaciones; **cada integrante** confirma o corrige su propia contribución, no la del compañero.
- **Roles** son descriptivos y pueden ser **0..N** (si el contrato existente requiere al menos uno al confirmar, documentar y decidir explícitamente; no crear 10 roles artificiales). Se puede ser Backend y Responsable; pueden faltar Frontend/QA si no existieron.
- **Tecnologías** seleccionables en la contribución: subconjunto de las tecnologías de **ese proyecto**, aceptadas por el propietario (declaradas o con señal GitHub). Se muestran filtradas por las áreas contextuales del proyecto; no el catálogo entero.
- **NO hacer exclusivas las tecnologías entre miembros**. Ana y Luis pueden confirmar ambos MongoDB si realmente lo trabajaron; una skill no es un recurso que se reparte una sola vez.
- Una persona **no hereda** todas las tecnologías del proyecto por ser integrante, coordinador o haber elegido rol.
- Si se usan asociaciones de roles↔áreas↔tecnologías, son **sugerencias/filtros UX**, no evidencia ni veto sobre experiencia real. No impedir seleccionar una tecnología del proyecto legítimamente trabajada solo porque un rol está asociado a otra área.
- La misma tecnología no se duplica para la misma persona/proyecto/contexto. `student_id, project_id, skill_id, area_context` controlan deduplicación según diseño vigente.
- El confirmador se identifica **siempre por la sesión**; no permitir `student_id` arbitrario en body.
- Si el propietario del proyecto aprueba/responde contribuciones, mantener confirmaciones y trazabilidad existente; no reemplazar por una confirmación unilateral encubierta.

## 6.3 Señal GitHub versus evidencia personal

```text
Tecnología declarada por integrante
   + señal repo detectada  → respaldo técnico del proyecto (no del autor)
   + contribución individual confirmada → atribución de esa experiencia al miembro
```

Una etiqueta verde significa **“detectada en repositorio”** y en interfaz debe acompañarse de texto; no “competencia verificada”. Gris significa declarada sin señal. Dos miembros pueden tener la misma skill, pero el motor no debe duplicar una cantidad global ni hacer distribución proporcional de “puntos de proyecto” como dinero.

**No modificar pesos de Afinidad por intuición de color**. Auditar engine versionado V3/V4.1/V5, caps y snapshots. Si falta mapeo correcto, documentar propuestas y pruebas; no recalibrar silenciosamente. Los roles de proyecto no puntúan.

## 6.4 Pruebas de regresión mínimas

```text
Proyecto A con MongoDB, Node.js y TypeScript; Ana y Luis aceptados.
A) Ana: Backend + Responsable; MongoDB + Node.js → 2xx y persistencia.
B) Luis: Backend; MongoDB + TypeScript → 2xx y persistencia.
C) Ambos usan MongoDB → permitido, sin eliminar contribución ajena.
D) Eliminar tecnología del proyecto que tiene contribuciones → guard con aviso.
E) Seleccionar skill que no pertenece al proyecto → rechazo controlado.
F) Falsificar user_id miembro ajeno → 403.
G) Estado de invitación pendiente/excluido → no auto confirmación.
H) Después de guardar/reload, roles y technologies iguales, contador correcto.
I) Intento inválido muestra error inline preciso, no solo 400 genérico.
```

---

# 7. PROYECTOS — OCR RETIRADO, ACTIVACIÓN Y EVIDENCIA PRIVADA (V6 pp. 18–22)

## 7.1 Decisión final inequívoca

**ELIMINAR OCR COMO PARTE DE LA VALIDACIÓN DE PROYECTOS**: ni captura de pantalla ni demo se procesan con OCR para determinar tecnologías, calidad o funcionamiento. No borrar librerías OCR si se utilizan en **certificados**. No mantener una ejecución oculta que consuma recursos ni bloquear `ACTIVE` por OCR. Si el Word dice que “Claude ya lo quitó”, comprobar en repo y marcar `ALREADY_CORRECT` si corresponde.

## 7.2 Tres clases de soporte distintas

| Tipo | Finalidad | Privacidad | ¿Sirve como mínimo de activación? |
|---|---|---|---|
| `project_gallery_images` (0..5) | Mostrar visualmente el proyecto en ficha visible | Según `visibility` del proyecto | **NO**; la imagen decorativa no acredita funcionamiento |
| `project_evidence` (link/captura/documento, limitado) | Registro privado de funcionamiento y procedencia para el propietario/equipo/revisor autorizado | Privado, endpoint de descarga autenticado | **SÍ**, al menos un elemento utilizable, sin declararlo auténtico |
| `demo_url` (opcional) | Permitir visitar demostración desplegada | Puede exponerse en ficha visible si pasó controles y estudiante consintió | **SÍ**, si accesible según chequeos definidos |

**No transformar imágenes de galería en evidencias**, ni publicar evidencias privadas en tarjetas/proyectos de la carrera/QR.

## 7.3 Condiciones de DRAFT→ACTIVE

Conservar los requisitos previos aplicables (no reescribir el resto):

- título válido;
- al menos un área contextual;
- al menos una tecnología del catálogo;
- repo público GitHub válido **si el contrato actual lo exige para la categoría de proyecto tecnológico**; V6 no autoriza sustituir el respaldo del repo por una galería;
- integrantes aceptados y contribución individual confirmada según caso;
- **`exists_usable_private_evidence OR validated_demo_url`**;
- NO exigir OCR, ni exigir demo y evidencia simultáneamente.

`validated_demo_url` NO significa que el sistema certificó el contenido o las tecnologías; solo que pasó criterios básicos de seguridad/alcance y accesibilidad. Si el usuario sube solo galería, no cumple el requisito de evidencia/demostración. Si tiene prueba privada válida, demo es opcional. Si tiene demo segura, puede activar sin subir captura privada adicional.

**Evidencia privada** puede ser enlace o archivo, con descripción/metadata/procedencia. No usar una URL vacía que pase simple regex como evidencia “válida”. El repo público tampoco sustituye implícitamente el mínimo de demostración.

## 7.4 Seguridad de URLs de demo: defensa por capas, NO promesa infalible

- Aceptar únicamente `https://` (si se requiere HTTP local en desarrollo, no exponerlo como demo pública sin una política explícita).
- Validar URL sintácticamente, impedir esquemas `javascript:`, `file:`, `data:`, credenciales en URL y destinos de red privada/loopback/link-local, incluso después de redirecciones/DNS re-resolve si backend realiza peticiones.
- Limitar tiempo, tamaño de respuesta, número de redirecciones; no descargar ni ejecutar scripts externos en servidor. **No rastrear el sitio completo ni inferir backend**.
- Opcionalmente aplicar proveedor conocido de reputación de URLs mediante adapter, con caché y política explícita. Si falla, marcar evaluación inconclusa; no afirmar detectar el 100 % de phishing, adultos o malware.
- Si no hay certeza suficiente de seguridad, **no mostrar como “seguro/verificado”**. Como mínimo, enlace externo con `rel="noopener noreferrer"`, advertencia de que lleva a sitio de terceros, y posibilidad de reportarlo.
- Mantener provenance/fecha de último chequeo. Verificación de accesibilidad es temporal; no certificación permanente de confianza.
- Evitar SSRF en validaciones de URL de evidencias, demos y credenciales externas.

## 7.5 Proyectos de la carrera — exposición mínima deliberada

Mostrar solo `ACTIVE` con `visibility=COMMUNITY` o equivalente y permisos adecuados:

- título, descripción permitida, áreas y tecnologías contextuales, señal legible de respaldo;
- carrusel de hasta cinco imágenes de galería, sin usar la evidencia privada como fallback;
- **nombre visible de integrantes que consintieron la visibilidad**, y sus roles declarados/confirmados; no solo “2 confirmados”; ocultar quien no otorgó permiso/según política;
- demo si existe, accesible y está permitida;
- **NO mostrar por defecto enlace del repo GitHub ni código fuente en esta ficha**, aunque el repo sea público. No prometer que esa decisión lo vuelve secreto; un repositorio público puede encontrarse por otras vías;
- no mostrar archivos/enlaces de evidencias privadas ni controles de edición.

Mantener control del propietario/equipo sobre visibilidad; cambiar a comunidad no debe hacer públicas automáticamente todas las propiedades privadas del proyecto, autores o miembros.

## 7.6 Límites razonables de archivos (propuesta V6 sujeta al almacenamiento existente)

- Galería: máximo **5 imágenes**; PNG/JPEG/WEBP, MIME por contenido, máximo por archivo conservador (p.ej. 5 MiB) y total acotado; procesamiento seguro si ya existe; no imponer 2 MiB como regla rígida para capturas HD.
- Evidencia de funcionamiento: máximo **5 archivos tipo imagen/documento** y **hasta 8 enlaces**, o constantes actuales equivalentes más restrictivas si hay compatibilidad. Si ya existen límites por documento, verificar antes de cambiarlos. No habilitar formatos ejecutables, SVG activo, archivos enormes o ZIP por costumbre.
- Cada evidencia con propietario/contexto, tipo MIME real y acceso protegido; no usar el nombre de archivo como autorización.
- El límite definitivo debe quedar en contrato compartido + validación API + texto UI, **sin inventar soporte de “cualquier formato”**.

## 7.7 BUG: imagen de evidencia abre XML/archivo incorrecto

La captura del Word muestra un visor/archivo XML al intentar abrir una imagen; causa no demostrada. Inspeccionar respuesta HTTP (`status`, `Content-Type`, bytes, redirect), endpoint y storage. Posibles fallos: ruta equivocada, URL de objeto privada, firma vencida, render incorrecto, extensión engañosa, falta de auth, respuesta de error XML de proveedor. **No declarar que es “por el formato” sin verificar**.

Corregir para que:

- propietario/miembros autorizados vean imagen en visor privado integrado;
- otro estudiante/visitante reciba 403/404 sin fuga de ruta/archivo;
- JPG/PNG/WEBP/PDF permitidos se entreguen con MIME correcto y `Content-Disposition` adecuado; formato no soportado dé mensaje claro;
- links públicos de galería sigan visibles solo bajo su policy;
- el enlace de evidencia privada no se incluya en HTML/JSON público.

---

# 8. PERFIL, CONTACTOS, EQUIPOS Y VISIBILIDAD (V6 pp. 23–25, 31–33)

## 8.1 Navegación de estudiante

Consolidar en sidebar **“Contactos / Equipos”** o “Colaboración”, con dos pestañas persistentes:

```text
Contactos
Equipos
```

No perder el contenido ya funcional. Retirar tab `Mi enlace / QR` de esa vista **solo después** de moverlo de forma segura a `Mi perfil → Visibilidad`. Preservar bookmarks/rutas antiguas con redirección que no filtre datos.

## 8.2 Mi perfil → Visibilidad

- Mostrar configuración de publicación/visibilidad del perfil, QR + enlace compartible, control de identificador y canales opt-in (Teams, WhatsApp, LinkedIn, email de contacto voluntario, otro enlace).
- Cada canal tiene **selector por canal** para aparecer en perfil compartido; el correo institucional no debe aparecer por defecto. No interpretar “quiero ser encontrado” como consentimiento para publicar teléfono o email.
- Agregar pestaña **“Vista previa pública / Así verán mi perfil”** que renderice solo los campos que un visitante del contexto elegido realmente puede ver. Ideal: reutilizar el mismo componente/política del perfil compartido; no crear preview ficticia que muestre datos privados.
- QR sirve para **abrir perfil**, no crea automáticamente un contacto ni salta aceptación. Mostrar botón Solicitar contacto cuando autorizado.
- Si perfil no está publicado, QR no debe permitir bypass; mostrar estado privado/respetar opt-in.

## 8.3 Foto opcional del estudiante

- Mantener avatares existentes y agregar **una foto personalizada opcional**; fallback avatar si no existe.
- Subida autenticada, tamaño y MIME controlados, orientación EXIF/metadata según capacidades, edición/reemplazo/eliminación.
- **Foto personal no pública por defecto**: respetar la política del perfil y vista previa. No exponer la imagen de un estudiante por URL adivinable/endpoint público si perfil es privado.
- No crear reconocimiento facial ni verificar identidad por fotografía.

## 8.4 Contactos

- Buscar por nombre/apellido o identificador **solo entre perfiles que permiten ser descubiertos**. Evitar enumeración masiva de estudiantes/correos oficiales; límites y paginación.
- Solicitar contacto por identificador/QR; QR escaneado en móvil abre perfil y permite **solicitar**, nunca añade automáticamente.
- Aceptación/rechazo por destinatario, registro idempotente, solicitud pendiente visible, bloqueo/remoción según contrato actual.
- Para cámara móvil, permiso solicitado por interacción y fallback de pegar código/abrir enlace si no hay cámara; no exigir función nativa de escaneo si Expo Go/SDK no la soporta sin verificación.

## 8.5 Equipos + recomendador del contexto de equipos

Se mantienen capacidades actuales (crear equipo, invitar, aceptar, necesidades/roles, disponibilidad). Agregar `Equipos → Para ti` donde se muestren **necesidades y posibles equipos/colaboradores** derivados de perfil/intereses/objetivos y compatibilidad permitida, **sin exponer objetivos de mejora privados de otros estudiantes**.

Flujo:

```text
Necesidad publicada (áreas/tecnologías, descripción, cupos, condiciones)
 → el recomendador filtra roles/scope/disponibilidad, privacidad y elegibilidad
 → tarjeta con “Por qué podría encajar”, detalle y Solicitar unirme
 → responsable/miembros autorizados aceptan o rechazan
 → membresía queda confirmada; NO se inventa una participación en proyecto
```

No trasladar actividades al módulo de equipos ni incluir recomendaciones de equipo como lista mezclada en actividades. No crear reclutamiento para perfiles privados/ocultos sin permiso.

---

# 9. RECOMENDADOR V6 — SIMPLIFICACIÓN DELIBERADA (pp. 26–31)

## 9.1 Esta decisión sustituye expresamente V4/V5

**RETIRAR de actividades**:

```text
“Me interesa” como clic/estado separado
“No me interesa”
“Descartadas” por recomendación de actividad
pestaña “Interesadas”
feedback incremental basado en estos clics
```

**CONSERVAR**:

```text
“Para ti”      → resultado del recomendador
“Todas”        → exploración general
“Inscritas”    → estados de registro/admisión
“Guardadas”    → favoritos para acceso rápido, sin alterar ranking
“Historial”    → participaciones pasadas
```

Botones por tarjeta: `Ver detalles`, `Solicitar inscripción` si elegible, `Guardar/Quitar de guardadas`; “Me gusta” solo si se utiliza como **nombre visible de favorito**, sin otra señal de recomendación. Evitar dos tipos de favorito con semántica duplicada.

`Me interesa` **en perfil/onboarding** permanece y significa preferencia declarada; **NO** equivale al botón de actividades eliminado. `Quiero mejorar` en perfil es meta privada. No eliminar esas cuatro familias de datos.

## 9.2 Fuentes autorizadas del ranking

```text
interested_areas        → preferencia explícita, peso mayor
interested_skills       → preferencia explícita, peso mayor
improvement_areas       → objetivo de fortalecer, peso secundario
improvement_skills      → objetivo de fortalecer, peso secundario
orientation_questionnaire (opcional)
availability/contexto, elegibilidad, semestres y fechas
```

**No usar** clicks/favoritos/inscripción/descarte para reescribir pesos. Si el motor V5 tenía `ACTIVITY_INTERESTED`, retirar la fuente de cómputo **para nuevas recomendaciones**, con migración de compatibilidad o ignorando eventos históricos; no borrar historial sin revisión. Si el motor estaba versionado, registrar nueva versión/semántica de recomendador para trazabilidad. No tocar score de Afinidad.

## 9.3 Explicaciones útiles, sin cifras internas

Incorrecto al usuario:

```text
“Prioridad 5”
“+24 puntos de interés”
“100 % seguro que te servirá”
“afinidad profesional validada”
```

Correcto:

```text
“Te lo sugerimos porque te interesa Bases de Datos.”
“Coincide con MongoDB, una tecnología que quieres explorar.”
“Relacionado con tu objetivo de mejorar en Redes.”
```

Si se muestra porcentaje de coincidencia, debe corresponder a fórmula documentada y **no** a probabilidad/competencia. Simplificación preferida: etiquetas/ranking explicables sin número bruto. Criterios de orden estables y desempates deterministas.

## 9.4 “Más sugerencias” y zonas duplicadas

- Revisar rutas actuales; si `Más sugerencias` solo duplica `Actividades → Para ti` y mezcla áreas/equipos, retirarla de la navegación, preservar endpoints útiles y redirigir las rutas antiguas a secciones apropiadas.
- `Actividades → Para ti`: actividades elegibles.
- `Biblioteca → Para ti`: recursos etiquetados relacionados, sin que favoritos retroalimenten el motor.
- `Equipos → Para ti`: necesidades/colegas compatibles y permisibles.
- “Áreas de fortalecimiento” puede seguir como sección personal descriptiva del perfil, no segunda pantalla confusa de actividades.
- Mantener orientaciones opcionales privadas y no mostrar recomendaciones de equipo basadas en datos ocultos del otro integrante.

## 9.5 No afinar fórmula sin datos

Conservar motor determinista actual donde cumpla la intención; si hay que retirar señal de interés en actividades, medir diferencia con fixtures. No inventar un «algoritmo estilo YouTube» ni entrenar ML. Documentar pesos reales según config/engine y dar 3 ejemplos contrastados:

- solo interés;
- solo mejora;
- interés+mejora;

Ninguno implica Afinidad. Probar que dar 10 clics a Guardar no altera ranking, score, puntos ni trayectoria.

---
# 10. AFINIDAD, RESPALDO Y RESUMEN DE TRAYECTORIA (V6 pp. 33–35)

## 10.1 Lenguaje académico correcto

Afinidad indica **mayor presencia de experiencias relacionadas** con un área/tecnología en la trayectoria registrada, de acuerdo con **fuentes, ponderaciones, límites y respaldo de la versión actual del motor**. No afirma “domina esta habilidad”, “es experto”, “aprobó esta materia” ni “tiene 90 % de capacidad”.

V6 dice coloquialmente “cantidad, no calidad”; esa expresión debe **interpretarse como recurrencia/contexto de experiencias**, NO reemplazar el algoritmo actual por un contador bruto de eventos que permita spam. Una misma actividad no duplica señal por constancia, imagen, puntos o 3 etiquetas. Mantener desduplicación, caps, respaldo y versionado.

## 10.2 Estados de respaldo — explicar «Con respaldo»

El usuario entiende `DECLARED`, `CORROBORATED`, `REVIEWED`, `INCONCLUSIVE` pero no encuentra dónde se genera `SUPPORTED / Con respaldo`.

**No ocultar el problema poniendo colores nuevos sin definir contratos.** Inspeccionar enum y eventos que producen `SUPPORTED` (p. ej. enlace legible, archivo subido o evidencia rastreable que aún no comprueba contenido/identidad). Crear documentación/ayuda con ejemplos verificables del motor real:

| Estado de presentación | Explicación NO engañosa |
|---|---|
| Declarado | Lo registraste; no tenemos señal comprobable suficiente |
| Con respaldo | Hay fuente consultable/documento o señal parcial, sin verificación individual concluyente |
| Corroborado | Se contrastó una señal específica con una fuente según reglas aplicables |
| Revisado | Fue objeto de revisión humana identificada; indicar qué se revisó realmente |
| Inconcluso | El proceso no pudo determinar más por falta/indisponibilidad de prueba |
| Rechazado/observado | Existe motivo y procedimiento de corrección/revisión |

Revisado no significa automáticamente “profesionalmente certificado”. Para repositorios, `DETECTED`/verde es **señal de código**, no acreditación personal. Para credenciales, el verificador individual puede corroborar titular, pero Afinia no es emisor. `SUPPORTED` no implica tener certificado.

## 10.3 Registro de actividades y logros/documentos

**Asistencia ≠ certificado**. La confirmación de presencia queda en trayectoria aunque la actividad no emita documento. En la sección “certificados institucionales recibidos” **no poner automáticamente** “Participó en el taller” como constancia, insignia o certificado.

- `PARTICIPATION_CONFIRMED` genera entrada histórica con actor/fecha/contexto y señales previstas por motor.
- Solo **emisor institucional autorizado** puede asociar o emitir un documento institucional identificado, con issuer, fecha, autorización/procedencia y documento correspondiente.
- `Resultado al finalizar: Sin resultado / Solo participación / Certificado emitido por institución` debe mapearse de forma clara a acciones permitidas, nunca generar “certificado” al inscribirse o asistir.
- Para instituciones que emiten documentos con QR/plantilla: OCR puede extraer texto y QR verificar titular **si existe endpoint individual oficial disponible**. Solo OCR de nombre/logotipo no autentica.
- No fingir que Afinia es Dirección ni asignar a Admin permisos académicos por ser técnico del sistema.

## 10.4 Resumen de trayectoria, NO CV profesional garantizado

El objetivo central es historial estudiantil. Mantener exportación como:

> “Resumen de trayectoria estudiantil — selección de experiencias registradas en Afinia. La fuente y nivel de respaldo de cada entrada se muestran de forma individual. No constituye certificación institucional ni acreditación profesional.”

Preservar selector **granular**: estudiante elige qué proyectos, qué actividades académicas/extracurriculares, qué credenciales externas/institucionales, y datos de perfil incluir, con opciones por registro. No presentar todo como “logros verificados”. Separar en PDF/preview:

```text
Participaciones registradas (sin documento emitido)
Proyectos y aportes individuales (con nivel de respaldo)
Credenciales externas (emisor/URL oficial o revisión/estado)
Certificados institucionales recibidos (emisor oficial, si realmente existen)
Otros datos seleccionados (opt-in)
```

Excluir o explicar elementos `DRAFT`, `REJECTED`, `INCONCLUSIVE` según política; no falsificar que son respaldados. Export debe mostrar fecha de generación y advertencia. No borrar formatos existentes: renombrar/simplificar contenido primero y comprobar compatibilidad. Si el usuario cambia privacidad o respaldo, exportes anteriores no se actualizan solos.

---

# 11. CREDENCIALES EXTERNAS E INSTITUCIONALES (V6 pp. 10, 35–37)

## 11.1 Tres conjuntos distintos

1. **Evidencias privadas de proyectos:** fuentes del estudiante, NO credenciales.
2. **Credenciales externas:** Cisco/IBM/Credly/Huawei y otras, actuales o históricas; fuente externa, verificación limitada al titular/estado.
3. **Certificados institucionales recibidos:** documentos cuya emisión real corresponde a Universidad/autoridad, no a Afinia. Puede incluir históricos si respaldados y emitidos, pero no inventar actas retroactivas.

No mover una **credencial externa** a la pestaña “Certificados institucionales” solo porque el Word habla de reordenar vistas: equivaldría a falsear emisor. Mantener tabs separados dentro de “Evidencias y credenciales”, con nombres comprensibles y trazabilidad de `issuer_type`.

Sugerencia de pestañas:

```text
Evidencias de proyectos (privadas)
Credenciales externas
Certificados institucionales recibidos
```

La **participación sin documento** se ve en Historial/Trayectoria, no como certificado.

## 11.2 Fuente de autoridad y captura

- Actividad externa: datos de emisor, dominios oficiales, cursos esperados y **certificado modelo opcional**. Ausencia del modelo no invalida publicación; al recibir certificado se usan QR/URL individual y fallback manual/estado inconcluso.
- Documento institucional: si Dirección realmente publica/otorga certificado, configurar issuer institucional, plantilla o referencia opcional y método de entrega. Una plantilla puede mejorar OCR, NO autentica titular por sí sola.
- Registro histórico externo: no exige recrear una actividad ya finalizada; conserva emisora, fecha, posible URL de verificación y archivo. No autoaprobación si no hay prueba individual.
- Registro histórico institucional: solo emisor competente/registro acreditado; **no usar la pantalla para fabricar constancias no emitidas**.
- Permisos y trazabilidad de revisión: quién verificó, fecha, método, evidencia usada, limitaciones, resultado. Admin técnico no equivale a Dirección académica.

## 11.3 Validador de credenciales: controles de realidad

```text
PDF textual → parser de texto
PDF escaneado, PNG/JPG → OCR + QR decoder
DOCX cuando soporte actual sea seguro → extracción de texto/URL
  ↓
URL/QR del emisor → validar dominio y consultar fuente individual si accesible
  ↓
comparar titular, curso, issuer, fecha/id y estado de credencial
  ↓
AUTO_VERIFIED solo si match suficiente con fuente oficial individual
INCONCLUSIVE / MANUAL_REVIEW_REQUIRED si falta información
REJECTED cuando haya motivo demostrado y apelación/corrección
```

QR que lleva a página genérica del curso **no prueba identidad**, y una captura con nombre puede ser falsificada. No asumir que todo QR permite consulta, que todos los emisores ofrecen API, que OCR valida fraude o que “90 % de precisión” existe sin un dataset real. Si el API de proveedor no responde, NO convertir esa falla en fraude; registrar inconcluso y reintentar controladamente.

`validation_status` separado de `backing` si ya está implementado; verificar migraciones. `REVIEWED`/aprobación manual debe explicar alcance de revisión, sin atribuir verificación oficial cuando solo revisaron apariencia.

## 11.4 Permisos y representación pública

No publicar nombre, ID del certificado, documento completo, QR, email o fecha sensible por defecto. Perfil/export solo según titular, visibilidad y permiso. Cada QR de certificado puede incluir identificador personal; tratar como dato sensible y no mezclarlo con QR público de perfil.

---

# 12. MENÚ, ADMIN MAIL Y UX TRANSVERSAL (V6 p. 38 y anteriores)

## 12.1 Administración de correo

- Ruta `/admin/mail` debe continuar operativa con guard real de rol `ADMIN` y chequeo backend.
- Retirar opción **Correo (configuración técnica)** del menú lateral ordinario, según V6.
- Ocultar el enlace **no es** control de acceso. Pruebas: estudiante/docente/director no pueden abrir la ruta ni invocar endpoints SMTP; Admin sí mediante URL, sin revelar credenciales SMTP completas al cliente.
- Si hay configuración real de SMTP en servidor, nunca exponer contraseña/clave/secretos, incluso a Admin, por endpoints de lectura. Mostrar máscara/estado y acciones autorizadas. No subir `.env` ni secretos a capturas/commits.

## 12.2 Guardrails de UX

- Formularios: validación inline coherente entre frontend/backend. Modal propio para confirmar descartes, reversión, bajas, exclusiones, errores de estado. No `alert`/`prompt` nativos.
- Controles grandes: selector buscable, chips, filtros dependientes, teclado y accesibilidad. No crear autoasignaciones ocultas al elegir un responsable, área o tecnología.
- Avisos con lenguaje claro. Evitar “Prioridad 5”, “100 % habilidades”, “probado por IA”, “certificado por Afinia”.
- Click a “Ver detalle” abre modal con campos y permisos correctos, no formularios de edición de solo lectura.
- Menús no duplicados ni rutas huérfanas al mover QR/Contactos/Equipos. Mobile expone solo funciones STUDENT.
- En listas, dar de baja oculta por defecto, pero mantener recuperables y referenciados los datos históricos.
- Validar timezones Bolivia en actividades; no comparar `datetime-local` por milisegundos contra hora de servidor sin margen/explicación. No permitir por error agendar fechas históricas como futuras, ni borrar fechas registradas.

---

# 13. MATRIZ DE PENDIENTES V6 — QUÉ ES DECISIÓN, QUÉ REQUIERE INVESTIGACIÓN

| Código | Tema | Tipo | Regla de ejecución |
|---|---|---|---|
| V6-SCOPE-01 | Desincronización responsables↔semestres | `BUG CRÍTICO` | Confirmar con API+UI y corregir consistencia transaccional |
| V6-SCOPE-02 | Duplicar actividad con semestres ajenos | `BUG/UX` | Crear draft nuevo filtrado, sin heredar permisos ni registros |
| V6-ACT-01 | Ver detalles para docente | `CAMBIO DIRECTO` | Modal solo lectura, sin editar |
| V6-ACT-02 | Admisión vs cupo | `DECISIÓN TÉCNICA` | Independientes; cuatro combinaciones válidas con cupo atómico |
| V6-ACT-03 | Externas sin admisión | `GAP` | Unificar reglas sin mezclar campos de origen |
| V6-UX-01 | Salida de formularios con cambios | `CAMBIO DIRECTO` | Guard dirty reutilizable, sin interceptar navegación limpia |
| V6-GRID-01 | Activos primero | `CAMBIO DIRECTO` | Filtro; conservar historial y control de baja |
| V6-USER-01 | “Apellidos por separar 0” | `INSPECCIÓN` | Entender migración antes de ocultar |
| V6-USER-02 | Dominios por rol y código | `DECISIÓN CON RIESGO` | Asistir correo, **no inventar direcciones/códigos**; validar rol almacenado |
| V6-USER-03 | Semestres Docente al crear | `GAP` | Mismo scope y validación que editar |
| V6-PROJ-01 | PUT contribution 400 | `BUG CRÍTICO` | Repro exacta, no inventar causa |
| V6-PROJ-02 | Roles múltiples/skills compartidas | `REGLA` | Permitidos, roles no puntúan, atribución personal explícita |
| V6-PROJ-03 | Quitar OCR de proyectos | `DECISIÓN FINAL` | No afecta OCR/QR de certificados |
| V6-PROJ-04 | Evidencia OR demo | `DECISIÓN FINAL` | Galería no sustituye; mantener otros guardrails |
| V6-PROJ-05 | Demo safe URL | `CONTROL PARCIAL` | SSRF/HTTPS/metadata/advisory; no prometer detector infalible |
| V6-PROJ-06 | Evidencia imagen abre XML | `BUG` | HTTP/content-type/storage/auth a investigar |
| V6-PROJ-07 | Proyectos de la carrera y privacidad | `DECISIÓN FINAL` | Solo ACTIVE autorizado; galería separada, evidencia privada, ocultar repo por defecto |
| V6-PROFILE-01 | QR/canales en Mi Perfil | `DECISIÓN FINAL` | Visibilidad + preview fiel a permisos; contacto no automático |
| V6-PROFILE-02 | Foto opcional | `CAMBIO DIRECTO` | Un archivo; avatar fallback; opt-in |
| V6-REC-01 | Eliminar click “Me interesa/No me interesa” | `DECISIÓN FINAL` | Solo en cards de actividades, perfil interesado permanece |
| V6-REC-02 | Más sugerencias duplicadas | `CAMBIO DIRECTO` | Contextualizar en Actividades/Recursos/Equipos |
| V6-CERT-01 | Participación no certificado | `DECISIÓN FINAL` | Trayectoria sí, insignia/constancia automática no |
| V6-CERT-02 | Certificados internos/externos | `DECISIÓN FINAL` | Separación por emisor; OCR/QR verificables solo cuando corresponda |
| V6-TRAJ-01 | Exportación informativa | `DECISIÓN FINAL` | Resumen seleccionable, sin sello oficial ni dominio atribuido |
| V6-ADMIN-01 | Ocultar correo sidebar | `DECISIÓN FINAL` | Mantener `/admin/mail` protegido |

**No hay evidencias de código ni resultados PASS dentro de este contrato**. El Word aporta observaciones del usuario y capturas; el estado preciso debe establecerlo Claude en V6-0 y en cada batch.

---

# 14. PLAN ÚNICO DE EJECUCIÓN V6 — BATCHES EN ORDEN

Se ejecutan **uno por uno**. Un batch que contenga migración no se inicia sin inventario previo de datos y estrategia de compatibilidad. QA final NO reemplaza QA de cada batch.

## BATCH V6-0 — Proteger rama, inspeccionar, baseline sin editar

**Alcance:** identificar rama posterior a V5, estado Git, builds vigentes, rutas/servicios relacionados, pruebas; `AUDITORIA_GAP_AFINIA_V6.md` + `PLAN_BATCHES_AFINIA_V6.md`.

**Cierre:** ningún cambio funcional y lista priorizada con riesgos/archivos y evidencia. Solicitar autorización para V6-1.

## BATCH V6-1 — Responsable×semestre: contrato, API y persistencia

**Dependencia:** V6-0. **Prioridad máxima.**

- Reproducir edición de actividad con dos docentes de scopes complementarios.
- Definir representación responsable↔semestre dentro del modelo existente, migración aditiva SOLO si imprescindible.
- Endpoints create/update deben validar cobertura por responsable; eliminar asignación huérfana de manera explícita; transacciones; preservar históricos.
- Tests API: overlap, removals, dirección+docente, requests falsificados, escenarios con inscripciones previas.

**No tocar:** algoritmo de afinidad, UI fuera del formulario, datos históricos aprobados sin negociación.

## BATCH V6-2 — Formularios de actividades: semestres contextuales y edición

- Campos por responsable, chips habilitados, audiencia derivada y selector Toda la carrera/Específicos para autoridad.
- Hidratar igual en crear/editar/cambiar tabs (académicas/extracurriculares/externas).
- Mensajes inline cuando se retira responsable o se pierde cobertura.
- Revalidar en frontend como UX; backend sigue autoridad.
- Probar guardar/reload, cambios parciales, misma actividad después de editar y semestres reales.

## BATCH V6-3 — Duplicación segura + ver detalles para responsables

- Duplicar crea DRAFT nuevo con ownership actual, sin permisos heredados, sin inscripciones/historia/constancias/puntos.
- Copiar solo scopes permitidos, y si ninguno: sin semestres con aviso.
- Modal “Ver detalles” para responsable Docente con permisos de solo lectura; no devolver botón Editar.
- Pruebas de creador asignado, docente externo y actividad finalizada.

## BATCH V6-4 — Admisión/capacidad y externas

- Dos ejes independientes; 4 combinaciones; cupo atómico e idempotente.
- Mismo campo y reglas para actividades externas.
- Estados `REQUESTED/ACCEPTED` ≠ asistencia `CONFIRMED/ABSENT`.
- Autorización de semestres, aforo, rechazo motivado, cierre/evento finalizado.

## BATCH V6-5 — Unsaved changes + grids + UX transversal

- Reutilizar guard de dirty form en crear/editar, sin romper navegación normal.
- Catálogos/usuarios muestran vigentes por defecto y opción de bajas/históricos.
- Inspeccionar contador `Apellidos por separar` y mejorar UI sin borrar herramienta de migración.
- 10 filas/grid, 6 cards/exploración según módulos, búsquedas y filtros existentes.

## BATCH V6-6 — Identidad institucional y docente recién creado

- Formulario de correo con dominio asistido por rol + vista previa, campo editable bajo política, no generación ficticia de correos oficiales.
- Separación de nombre/apellidos y previsualización import CSV ya existentes.
- Semestres de Docente en create y edit, backend seguro.
- `university_code` con unicidad/semántica actual, no derivación desde iniciales ni inferencia de rol por email.

## BATCH V6-7 — Contributions 400: diagnóstico y corrección mínima

- Capturar payload/salida sanitizada y ruta `PUT /projects/:id/my-contribution`.
- Repro con dos miembros, roles múltiples, misma tecnología usada por ambos.
- Corregir validación/serialización/auth y feedback conforme contrato real.
- No recálculo de afinidad sin necesidad; cubrir tests end-to-end.

## BATCH V6-8 — Proyecto: retirar OCR y definir mínimos de activación

- Revisar que OCR realmente esté fuera de pipeline proyecto.
- `demo válida OR evidencia privada usable` sin usar galería como prueba.
- Conservar GitHub de proyecto, contribuciones, áreas, tecnologías y requisitos existentes.
- Fixture con solo demo, solo evidencia, ambos, ninguno, solo galería y URL maliciosa.

## BATCH V6-9 — URL demo, storage y privacidad de evidencia

- SSRF, redirects, HTTPS y allowlist/adapter reputación si está disponible; timeout y errores inconclusos.
- Arreglar apertura de imágenes que devuelve XML; verificar permisos y MIME real.
- Archivos 0..5 y links hasta 8 u otro límite vigente fundamentado; validación API y frontend idéntica.
- Tests de exposición no autorizada de evidencia y de galería pública.

## BATCH V6-10 — Galería de proyectos de la carrera

- Visible solo ACTIVE + COMMUNITY; imágenes 0..5, carrusel.
- Nombres/roles de miembros consentidos; demo permitida; **no repo link** ni evidencia privada.
- Búsqueda/filtros, cards legibles, acceso a detalle sin elevar privilegios.
- Snapshot de privacidad/serialización pública.

## BATCH V6-11 — Perfil compartible: QR, canales, preview y foto

- Mover QR y canales a `Mi perfil → Visibilidad`, quitar tab viejo sin perder URLs.
- Preview **real** de lo visible al lector, opt-in por canal, no publicar correo/telefono automáticamente.
- Foto opcional/fallback avatar, MIME/size y permisos.
- Redirecciones del menú y contratos web/mobile relevantes.

## BATCH V6-12 — Recomendador V6 de actividades y UX “Para ti”

- Retirar feedback `Me interesa/No me interesa` de cards de actividad y pestañas `Interesadas/Descartadas`.
- Mantener campos del perfil `interested_*` y `improvement_*`.
- Guardar/Quitar de guardadas solo organización.
- Razones legibles sin porcentajes de dominio, sin números crudos; ranking versionado si cambia semántica.
- Pruebas de que likes/favoritos no afectan recomendador/Afinidad.

## BATCH V6-13 — Equipos para ti y contactos por QR/búsqueda

- Quitar recomendaciones de equipos de `Más sugerencias` general; exhibirlas en Equipos.
- Ver detalles/solicitar unirse a necesidad publicada; permisos, aprobación, no membresía automática.
- Búsqueda de contactos solo de perfiles descubribles; QR abre perfil y ofrece solicitud, cámara móvil opcional.
- Preservar seguridad de datos educativos y experiencia de quienes no publican perfil.

## BATCH V6-14 — Participación, certificados y documentos institucionales

- Eliminar constancia/logro automático por confirmación simple.
- Mantener historial/afinidad de presencia real.
- Certificados institucionales solo cuando emisor competente los haya emitido; externos separados.
- Plantilla OCR/QR opcional, verificación de titular individual, estados respaldados/inconclusos.
- No alterar la verificación externa ya implementada salvo bug confirmado.

## BATCH V6-15 — Historial, explicación de respaldo y export informativo

- Explicación de `DECLARED/SUPPORTED/CORROBORATED/REVIEWED/INCONCLUSIVE` en UI según modelo real.
- Resumen **selectivo** de trayectoria, separar participaciones, proyectos, externos e institucionales.
- PDFs sin sello oficial falso ni afirmaciones de dominio; fecha/estado/issuer/fuente.
- Preservar registros históricos, no inventar cualificación profesional.

## BATCH V6-16 — Ocultar admin mail del menú sin quitar la función

- Sidebar Admin sin opción técnica; ruta `/admin/mail` accesible a Admin autorizado.
- Guards web y backend, no secreto en JSON/DOM/Swagger.
- Redirecciones/estado de configuración SMTP actual sin romper.

## BATCH V6-17 — Regresión integral, auditoría de seguridad y documentación

- Ejecutar tests unitarios/integración/E2E pertinentes reales, build de shared/API/web/mobile según impacto, migraciones sobre DB de prueba **sin reset destructivo**.
- Verificar permisos por cinco roles, flujo móvil Student, controles de tiempo/cookies, pruebas contractuales.
- Revisar SQL migrations idempotentes, Swagger, ayuda, README, `.env.example` sin secretos, privacidad y trazabilidad académica.
- Entregar `QA_V6_REGRESION.md`, matriz GAP final, tests y hashes/commits. Registrar FAIL e incidencias sin maquillarlas.

---
# 15. CONDICIONES V5 QUE SIGUEN VIGENTES Y NO DEBEN PERDERSE

El V6 no pide repetir ni deshacer el trabajo estable de la auditoría previa. Estas reglas se mantienen **si ya están implantadas correctamente**, y solo se revisan si una regresión V6 las afecta.

## 15.1 Taxonomía/áreas/tecnologías/roles

- Áreas generales; tecnologías con un área principal y posibles contextos secundarios; tags y aliases para descubrimiento, no para Afinidad.
- Actividades introductorias pueden tener un área sin skill particular, si la actividad no trata una tecnología específica. **No imponer una habilidad falsa por cada área**.
- Proyectos tecnológicos `ACTIVE` conservan mínimo de área y skill y contexto real.
- Si GitHub detecta FastAPI/Pytest y no existen en catálogo: solicitar alta de **tecnologías nuevas** asociadas a áreas, no convertirlas por fuerza en alias de Python. Solo sinonimia verdadera se vincula a skill existente.
- La API GitHub aporta señales de manifest/languages con fuentes y fechas; conserva botón volver a comprobar, rechazo de sugerencias, reanálisis idempotente, estado inconcluso por falla/red/rate-limit.
- Roles de proyectos pueden asociarse a áreas y tecnologías para facilitar selectores, pero no puntúan ni validan contribuciones por sí mismos. No crear lógica rígida donde `Backend` signifique automáticamente “sabe Python”.

## 15.2 Actividades y roles institucionales

- Tres grupos separados: **académicas internas, extracurriculares internas y oportunidades externas**. La Sociedad Científica maneja extracurriculares según su alcance.
- Docente/Sociedad publican conforme política de revisión de Dirección; Admin/Director según facultades existentes. Separar `created_by` de `responsibles[]` y `contacts[]`.
- Borrador de Admin/Director no aparece al docente responsable hasta estar publicado; el responsable designado gestiona operación autorizada, no el contenido material de otro.
- `DRAFT / PUBLISHED / OPEN / CLOSED / FINISHED / CANCELLED` son estados de ciclo de vida distintos de revisión; `FINISHED` no vuelve a OPEN en operación normal; duplicar para repetir.
- No editar asistencia libremente después del cierre de la lista; correcciones excepcionales con motivo/auditoría y recálculos. No convertir `FINISHED` inmediatamente en “lista de asistencia inmutable” si la lista se termina de registrar después de la sesión.
- Resultado de actividad externa puede derivar en subir credencial emitida por **tercero**, no generar documento por Afinia.
- Imagen(es) de actividad pueden ser 0..5 en carrusel según V5, sin publicar evidencias privadas; modificar solo si detecta regresión.

## 15.3 Biblioteca y recursos

- Recurso es material: URL o archivo permitido, sin MP4 pesado por defecto; herramientas/guías/libros/tutoriales, no entidad de certificación.
- Área/tecnología son metadatos de match para `Biblioteca → Para ti`; abrir o favorito no retroalimenta recomendación, Afinidad ni gamificación.
- Profesor crea para su scope conforme aprobación configurable; Dirección/Admin pueden escoger toda la carrera o semestres específicos; política por Docente auditable.
- No mezclar “Curso externo” de biblioteca (material) con “Oportunidad externa” (actividad de proveedor con seguimiento y posible certificado).

## 15.4 Gobernanza de Dirección configurable

- `RESOURCE` y `GAMIFICATION`: Dirección puede definir exenciones por docente/scope/fecha; valor por defecto revisión si no se configuró. Aprobación directa o pendiente se muestra claramente.
- `ACTIVITY`: mantener revisión obligatoria **por defecto**; una posible excepción por docente depende de confirmación institucional documentada, no de una frase exploratoria. No elevar permisos por aproximación.
- Registrar qué autoridad autorizó el override, alcance, fecha, expiración y revocación; mantener trazabilidad de hechos históricos.
- Coordinar incentivos para paralelos de la materia cuando exista una asignación institucional identificable; no inventar un módulo completo de paralelos si aún no existe.

## 15.5 Gamificación sin Afinidad

- Criterios de eventos controlados para **participación confirmada**, **proyecto valorado por docente autorizado** y **material/recurso completado tras constatación humana**; no puntos por clic ni por favoritos.
- En proyecto: criterio opcional junto a retroalimentación docente; en actividad: criterio opcional al crear; recurso: criterio opcional pero **no se entrega por abrirlo**.
- Si un docente tiene exención de Dirección para un tipo de criterio, aplicación directa **con historial visible**; si no, propuesta PENDING a Dirección.
- Datos mínimos: `criterion_id`, `source_type`, `source_id`, `student_id`, responsable que propuso/aplicó, fecha, motivo y estado. Idempotencia y reversión auditada, no borrado de puntos históricos.
- No reintroducir `Retos y recompensas` como módulo separado ni “criterios antiguos” en UI.

## 15.6 Datos con historial, transparencia y privacidad

- No usar hard delete por rapidez. Estados de baja y filtros públicos no eliminan referencias viejas.
- Privacidad de `improvement_areas/skills` siempre privada; intereses solo públicos con consentimiento/controles.
- Proyectos: fuente/repo y evidencia se protegen por endpoint; información pública mínima y revisable.
- Credenciales: `validation_status` y `backing` son ejes distintos; no afirmar 100 % autenticidad con OCR visual.
- Perfil QR/contacto no abre email o teléfono institucional por defecto.
- Resumen seleccionable de trayectoria, no diploma oficial; exportar secciones/ítems individualmente.

---

# 16. MATRIZ DE PRUEBAS V6 — ACEPTACIÓN MEDIBLE, NO DESCRIPCIÓN GENÉRICA

Usar fixtures **no personales** y permisos controlados en base de datos de pruebas; documentar IDs sintéticos. En cada prueba registrar precondiciones, acción, resultado esperado, respuesta real, logs/trace, estado PASS/FAIL. No basta comprobar que la pantalla “se ve bien”.

## 16.1 Actividades: scopes y duplicación

| ID | Escenario | Esperado |
|---|---|---|
| ACT-01 | Carlos tiene 1–4; creación con Carlos, elegir 8 | UI bloquea; API también rechaza 8 |
| ACT-02 | Carlos 1–4, María 5–8; actividad con ambos, quitar María antes de publicar | Retira cobertura 5–8 con aviso, no quedan chips huérfanos |
| ACT-03 | Ambos cubren semestre 4; quitar uno | Semestre 4 permanece si otro sigue responsable autorizado |
| ACT-04 | Dirección cubre 1–8 + Carlos 1–4 | Audiencia puede 1–8 por Dirección; Carlos solo gestiona 1–4 |
| ACT-05 | Editar actividad guardada y agregar 8 a Carlos | Backend rechaza aunque se fuerce request |
| ACT-06 | Editar con inscripciones activas y remover responsable único de inscritos | Bloqueo/reasignación explícita, sin pérdida silenciosa de acceso/historial |
| ACT-07 | Duplicar como Carlos una actividad que incluía 5–8 por María | Nuevo DRAFT independiente con solo scopes elegibles de Carlos |
| ACT-08 | Duplicar actividad sin ningún semestre elegible | DRAFT guardable incompleto si permite; aviso; no publicar |
| ACT-09 | Docente responsable de actividad creada por Admin | Ve detalle, no botón Editar material |
| ACT-10 | Docente asignado a DRAFT de Admin | No lo ve hasta publicación, salvo atribución explícita autorizada |
| ACT-11 | Reabrir CLOSED por cupo/fecha pasada | Guard específico; no bypass de fecha/cupo |
| ACT-12 | Duplicar FINISHED | No arrastra participantes, constancias, puntos ni historial |

## 16.2 Actividades: admisión y asistencia

| ID | Escenario | Esperado |
|---|---|---|
| ADM-01 | Sin cupo + admisión abierta | Solicitud autoaceptada, asistencia pendiente |
| ADM-02 | 2 plazas + admisión abierta; 3 peticiones simultáneas | Máximo 2 admitidos, condición transaccional |
| ADM-03 | Sin cupo + admisión manual | Permite aprobación responsable; no presente automático |
| ADM-04 | 2 plazas + manual; 3 aprobaciones simultáneas | Nunca sobrepasar cupo |
| ADM-05 | Actividad externa | Dispone del mismo selector admisión/cupo y scope |
| ADM-06 | Docente confirma a alumno fuera de su scope | Rechazo autorizado 403/422 |
| ADM-07 | Admitido pero ausente | No constancia/afinidad/puntos por asistencia |
| ADM-08 | Asistencia confirmada en actividad sin certificado | Traza en historial, **no** certificado/insignia automática |
| ADM-09 | FINISHED con lista aún abierta por política | Puede registrar presencia dentro de ventana controlada, no reabrir actividad |

## 16.3 Identidad, filtros y formularios

| ID | Escenario | Esperado |
|---|---|---|
| ID-01 | Crear estudiante con parte local de correo | UI anexa `@est.univalle.edu`, muestra preview y valida unicidad |
| ID-02 | Crear docente con correo real diferente de sugerencia | Se respeta correo institucional válido confirmado, no se inventa alias |
| ID-03 | Código duplicado entre roles | Rechazo según política global, no inferir rol del texto |
| ID-04 | Docente nuevo asigna 3 semestres desde Alta | Persisten y rigen permisos inmediatamente |
| ID-05 | Segundo apellido ausente en import o alta | Aceptado; primer apellido requerido |
| UX-01 | Formulario nuevo sin modificar; cambiar tab | Sin alerta innecesaria |
| UX-02 | Formulario editado sin guardar; cambiar tab/cerrar | Modal claro: continuar o descartar; datos conservados si cancela |
| UX-03 | Grid Áreas con una dada de baja | No sale en vigente, sí al activar filtro de bajas |
| UX-04 | “Apellidos por separar (0)” | No rompe migración, no ocupa lugar confuso en UI ordinaria |

## 16.4 Proyectos: miembros, evidencias, galería, privacidad

| ID | Escenario | Esperado |
|---|---|---|
| PRO-01 | Ana y Luis aceptados, ambos usan MongoDB | Ambas contribuciones persistidas sin conflicto |
| PRO-02 | Miembro que antes recibía PUT 400 | Solicitud válida 2xx; error inválido específico |
| PRO-03 | Dos roles para mismo integrante | Guardado, sin Afinidad por rol |
| PRO-04 | Miembro intenta asignar skill que no existe en proyecto | 4xx controlado, no modifica datos |
| PRO-05 | DRAFT sin repo ni evidencias | Guardable como DRAFT; no ACTIVE si mínimos exigen repo |
| PRO-06 | Proyecto con repo + contribución + solo galería | No cumple prueba de funcionamiento |
| PRO-07 | Proyecto con repo + contribución + evidencia privada y sin demo | Puede activar si restantes mínimos se cumplen |
| PRO-08 | Proyecto con repo + contribución + demo validada sin evidencia | Puede activar si restantes mínimos se cumplen |
| PRO-09 | Imagen de evidencia privada como usuario propietario | Se abre con MIME correcto, no XML de error |
| PRO-10 | Visitante intenta abrir evidencia privada por URL | 403/404 sin fuga de datos |
| PRO-11 | Proyecto COMMUNITY ACTIVE con 3 fotos | Carrusel; nombres/roles permitidos, NO repo/evidencias privadas |
| PRO-12 | Proyecto DRAFT y visibilidad COMMUNITY configurada | No aparece públicamente |
| PRO-13 | URL demo `http://127.0.0.1/`, IP privada, redirect interno | Rechazo SSRF; sin solicitud a red privada |
| PRO-14 | Demo HTTPS segura pasa chequeo básico | Mostrar si permiso; no afirmar certificación del sitio |
| PRO-15 | GitHub `pymongo` → MongoDB | Indicar señal de dependencia, no garantía de autoría o servidor activo |
| PRO-16 | API GitHub falla temporalmente | Marcar inconcluso, preservar datos existentes |

## 16.5 Recomendaciones, perfil y colaboración

| ID | Escenario | Esperado |
|---|---|---|
| REC-01 | Perfil interesa BD y quiere mejorar Redes | Para ti explica ambas coincidencias separadas |
| REC-02 | Guardar/quitar actividad repetidas veces | Favorito toggle idempotente, no cambia recomendador/Afinidad |
| REC-03 | UI actividades actualizada | Sin tabs Interesadas/Descartadas ni botoncitos de feedback antiguos |
| REC-04 | API histórica “interested” existe | No afecta ranking nuevo; datos no desaparecen sin migración |
| REC-05 | “Más sugerencias” / equipos | Colaboradores recomendados viven en Equipos, no pantalla mezclada |
| REC-06 | Recurso favorito | No modifica preferencias/afinidad |
| PERF-01 | Perfil no publicado + abrir QR en otra sesión | No revela datos privados |
| PERF-02 | Teams público, WhatsApp privado | Preview y perfil compartido exponen solo Teams |
| PERF-03 | Foto de perfil ausente | Avatar fallback; sin imagen rota |
| PERF-04 | Foto subida con perfil privado | No se expone por endpoint público |
| CONTACT-01 | QR escaneado de estudiante | Perfil/solicitud, nunca contacto automático |
| CONTACT-02 | Usuario rechaza solicitud | No aparece como contacto confirmado |
| TEAM-01 | Necesidad abierta y estudiante elegible | Aparece en Equipos→Para ti con motivo claro |
| TEAM-02 | Necesidad cerrada o perfil indisponible | No se recomienda / no filtra datos privados |

## 16.6 Certificados, historial, admin

| ID | Escenario | Esperado |
|---|---|---|
| CRED-01 | Actividad con asistencia CONFIRMED sin documento | Trayectoria sí, certificado institucional no |
| CRED-02 | QR solo redirige a curso general | No AUTO_VERIFIED del titular |
| CRED-03 | Verificador oficial individual devuelve otro nombre | No acreditar; revisión/rechazo según evidencia |
| CRED-04 | OCR falla pero enlace oficial individual válido | Evaluar fuente individual; OCR no determina falsedad |
| CRED-05 | Certificado institucional real emitido por autoridad | Se presenta como institucional, issuer real, no Afinia |
| CRED-06 | Credencial histórica Cisco | No se convierte en documento institucional |
| HIST-01 | Export con 2 proyectos de 5 y 1 certificado | Incluye solo ítems seleccionados y advertencia informativa |
| HIST-02 | Estado SUPPORTED | Tooltip explica qué fuente parcial existe realmente |
| ADM-TECH-01 | Admin abre `/admin/mail` | Acceso si guard autoriza y datos sensibles enmascarados |
| ADM-TECH-02 | Docente/estudiante abre `/admin/mail` o endpoint técnico | Denegado con guard web y API |
| ADM-TECH-03 | Sidebar Admin | Correo técnico no aparece en navegación normal |

---

# 17. TRAZABILIDAD COMPLETA DEL WORD `corregir v6.docx` (38 PÁGINAS)

El origen de cada requerimiento se rastrea en las capturas/observaciones del documento. Si se descubre conflicto entre una frase temprana y una conclusión posterior, aplicar el **criterio final explicitado** en este contrato.

| Páginas del Word | Observación original | Regla definitiva aquí | Batch |
|---|---|---|---|
| 1–4 | Duplicación, quitar responsable, semestres huérfanos, edición fuera de scope | Modelo contextual responsable↔semestre, sin ascenso de permisos | 1–3 |
| 5 | Docente asignado ya no edita, necesita detalle | Modal de solo lectura | 3 |
| 5–6 | Debate entre admisión abierta/manual y cupo | Ejes independientes y cupo atómico | 4 |
| 7–8 | Externas sin admisión/semestres; cambios sin guardar | Formularios simétricos, dirty-guard | 2,4,5 |
| 9 | Grids activos y “Apellidos por separar 0” | Filtros sin eliminar historia; inspección del indicador | 5 |
| 10 | Toda carrera vs semestres específicos; certificado plantilla externo opcional | Scope visible; QR/OCR no depende obligatoriamente de plantilla | 2,14 |
| 10–14 | `PUT my-contribution` 400; roles/skills por miembro | Repro API y contribuciones compartidas sin duplo | 7 |
| 15–17 | Correo institucional asistido y duda sobre código/rol | Correo real confirmado; identificador independiente; docente scope al crear | 6 |
| 17 | Dar de baja y quitar del grid principal | Vigentes por defecto, mostrar bajas | 5 |
| 18 | Proyecto COMMUNITY; quitar OCR de proyectos | Mantener publicación; eliminar solo OCR de proyectos | 8,10 |
| 19–20 | Demo o evidencia (no ambas); distinción galería | Activar con OR; galería no es evidencia | 8 |
| 20–21 | Seguridad de demo, evidencia privada, no repo visible | Controles URL/SSRF, exposición mínima por permisos | 9,10 |
| 21–22 | Límites flexibles; archivo evidencia abre XML | Límites coherentes + corrección storage/MIME | 9 |
| 23–25 | Contactos/Equipos, QR/canales a Perfil→Visibilidad | Mover vista/preview y conservar controles | 11,13 |
| 26 | Foto opcional, avatar fallback | Foto con privacidad y control de formato | 11 |
| 26–29 | Simplificar recomendaciones; eliminar feedback y descartadas | Para ti basado en perfil; favorito no score | 12 |
| 30–32 | “Más sugerencias” mezcla fortalecimiento/equipos; Teams para ti | Contextualizar recomendaciones a cada módulo | 12–13 |
| 32–33 | Buscar contacto por nombre y QR de móvil | Solo perfiles descubribles, solicitud con consentimiento | 13 |
| 33 | Estado “Con respaldo” no explicado | Explicar estados según contrato real | 15 |
| 34–35 | Resumen no CV profesional, Afinidad como trayectoria | Export seleccionable, copy responsable y motor versionado | 15 |
| 35–37 | Reunión no emite logro; certificados internos vs externos | Emisor real, secciones separadas, OCR/QR solo cuando procede | 14–15 |
| 38 | Ocultar correo técnico del sidebar | Ruta protegida permanece | 16 |

---

# 18. INFORME OBLIGATORIO POR BATCH

Entregar en español, conciso pero verificable. Plantilla:

```text
BATCH: V6-X
RAMA: feature/afinia-v6-cierre
COMMIT BASE: <hash>
COMMIT ACTUAL: <hash o sin commit>
OBJETIVO: ...

1. REQUISITOS DE WORD APLICABLES: páginas ...
2. ESTADO PREVIO Y REPRODUCCIÓN REAL: ...
3. CORRECTO ANTES, NO TOCADO: ...
4. DEFECTOS CONFIRMADOS: ...
5. DECISIONES / RIESGOS / NEEDS_DECISION: ...
6. ARCHIVOS CAMBIADOS Y JUSTIFICACIÓN: ...
7. DB/MIGRACIONES/CONTRATOS: ...
8. TESTS EJECUTADOS (comando, conteo PASS/FAIL, salidas): ...
9. REGRESIONES COMPROBADAS: ...
10. PENDIENTES O BLOQUEOS: ...
11. CÓMO PROBARLO MANUALMENTE (actor, URL, datos): ...
12. CONFIRMACIÓN DE QUE NO SE MODIFICÓ LA RAMA BASE: ...
```

No escribir “0 errores” sin comando ejecutado. Si una prueba depende de SMTP, proveedor externo, Expo dispositivo, GitHub o credenciales y no pudo ejecutarse, escribir `NOT_EXECUTED`/`BLOCKED`, no PASS. No introducir secrets en screenshots/tests. Si hay error: `FAIL → causa confirmada → fix → regression PASS`. Si entorno falla, separar de defecto del sistema.

---

# 19. DEFINICIÓN DE TERMINADO V6

La implementación V6 está cerrada cuando, con evidencia de pruebas:

1. Rama base preservada y nueva rama V6 usada por todos los commits.
2. Actividad no conserva semestres sin responsable autorizado tras cambios.
3. API rechaza scopes de docentes alterados manualmente en requests.
4. Duplicación crea borrador propio y no hereda permisos/inscripciones.
5. Docente ve detalle completo sin entrar a edición prohibida.
6. Admisión y cupo funcionan en las cuatro combinaciones, incluso concurrentes.
7. Oportunidades externas tienen la misma semántica de admisión y scopes.
8. Inscripción/admisión no equivale a asistencia confirmada.
9. Formularios con cambios reales advierten antes de descartarlos.
10. Catálogos/usuarios muestran vigentes por defecto, bajas recuperables.
11. Alta Docente permite definir semestres desde el inicio.
12. Correo sugerido por rol no crea identificadores institucionales falsos.
13. Caso `PUT my-contribution 400` reproducido y corregido para payload válido.
14. Dos miembros pueden compartir tecnologías y múltiples roles sin atribución automática.
15. OCR retirado de proyectos, conservado donde tiene propósito en certificados.
16. DRAFT→ACTIVE requiere demo válida **o** evidencia privada usable, además de otros mínimos vigentes.
17. Galería 0..5 no sustituye evidencia y no filtra material privado.
18. Demo tiene controles realistas y evita SSRF/URLs no seguras.
19. Apertura de imagen de evidencia funciona con MIME/autorizar, sin XML de error.
20. Proyectos de la carrera muestran información consentida y no exponen repo/evidencias por defecto.
21. QR/canales están en Perfil→Visibilidad con preview fiel.
22. Foto opcional conserva avatar fallback y privacidad.
23. Actividades ya no tienen feedback “Me interesa/No me interesa” ni pestañas de descartes.
24. Perfil sigue teniendo interés y mejora separados; favoritos no cambian motor.
25. Equipos tienen recomendaciones propias y contactos solicitan permiso; QR no autoagrega.
26. Historial de asistencia no se presenta como certificado/logro automático.
27. Certificados internos/externos siguen emisores/validaciones diferenciados.
28. `SUPPORTED` se explica sin sugerir verificación de competencias.
29. Exportación por ítems informa trayectoria sin certificado profesional de Afinia.
30. `/admin/mail` funciona para Admin pero no figura en sidebar y no se expone a otros roles.
31. Build/tests/QA ejecutados y documentados; no hay secretos, fugas de PII ni migración destructiva.
32. Ningún motor de Afinidad fue recalibrado por conveniencia visual ni por gamificación o favoritos.

---

# 20. MENSAJE DE ARRANQUE PARA CLAUDE CODE

```text
Lee íntegro AFINIA_CONTRATO_UNICO_V6_CLAUDE_CODE_2026-10-30.md.
Es el contrato único de cambios V6; no ejecutes planes viejos en paralelo.
Verifica la rama con los avances más recientes del V5 y comprueba que el
working tree esté limpio. Sin alterar esa rama, crea feature/afinia-v6-cierre.
Ejecuta SOLO el BATCH V6-0, sin modificar código funcional.
Entregame AUDITORIA_GAP_AFINIA_V6.md + PLAN_BATCHES_AFINIA_V6.md,
con referencias de código y pruebas baseline reales.
No elimines archivos, datos, migraciones ni credenciales; no hagas resets.
Espera autorización antes de iniciar V6-1.
```

**FIN DEL CONTRATO ÚNICO V6.**
