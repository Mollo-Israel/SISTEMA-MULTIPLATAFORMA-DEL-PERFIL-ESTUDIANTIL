# AFINIA — CONTRATO ÚNICO CONSOLIDADO V4 + V4.1
## Un único archivo operativo para Claude Code / Codex · Auditoría de 90 páginas · Requisitos, reglas, batches y pruebas reconciliados

**Fecha de corte documental:** 16/10/2026  
**Última auditoría:** `corregir v4(1).docx` (90 páginas)  
**Fuentes fusionadas directamente:** `AFINIA_AJUSTES_FINALES_V4_CLAUDE_CODE_2026-10-14(1).md` (V4, 1951 líneas) y `AFINIA_AJUSTES_DE_CIERRE_V4_1_AUDITORIA_90P_CLAUDE_2026-10-16(2).md` (V4.1, 1198 líneas). **Ambos están incorporados en este archivo, con contradicciones resueltas.** V3.2/V3.1 son antecedentes de la especificación completa, no documentos adicionales exigidos para ejecutar este contrato de ajustes.  
**Objetivo:** cerrar las correcciones de la interfaz y los flujos ACTUALES sin reescribir ni destruir una rama funcional.  
**Estado de implementación:** DESCONOCIDO HASTA AUDITAR EL REPOSITORIO. Las observaciones son de las pruebas del usuario, no resultados de pruebas ejecutadas por este documento.

> **MODO DE TRABAJO EXIGIDO:** crear una rama independiente desde la rama REAL más avanzada del usuario; auditar primero; implementar cambios mínimos por batches; entregar pruebas reales; proteger versiones previas. **No es una orden para reconstruir Afinia ni para dar por cierto todo comentario exploratorio de la auditoría.**

---


> **DECLARACIÓN DE DOCUMENTO AUTOSUFICIENTE:** este MD reemplaza operativamente los dos archivos V4 y V4.1 suministrados por el usuario. No hay dos listas de batches ni dos nombres de rama obligatorios. La versión V4.1 manda; se recuperan los detalles V4 no contradictorios. El agente debe mirar el repositorio para saber qué está IMPLEMENTADO, y ejecutar solo lo faltante. Para el proyecto entero original (fuera de estos ajustes), se mantiene el código actual y los contratos previos verificables.

> **NO ES UN DOCUMENTO DE PRUEBAS EJECUTADAS.** Las observaciones del Word son hallazgos reportados por el usuario. El agente debe reproducirlas, o clasificarlas `IMPLEMENTED_UNTESTED`, antes de afirmar corrección o defecto.


### Guía de lectura de este único archivo

1. **Secciones 0–24:** decisiones funcionales definitivas y 30 ajustes A41.
2. **Sección 22:** único plan de 15 batches V4.1 (el V4 antiguo no se ejecuta como segundo plan).
3. **Secciones 23–25:** casos de aceptación, contradicciones cerradas y formato de reporte.
4. **Anexo A:** detalles técnicos válidos del V4 que podían faltar en el resumen V4.1.
5. **Anexo B:** regresiones combinadas; **Anexo C:** cobertura del V4; **Anexo D:** checklist final.
6. **Sección 26:** prompt para Claude usando SOLO este MD.

# 0. INSTRUCCIONES INNEGOCIABLES PARA EL AGENTE

## 0.1 Leer y aplicar precedencia

Fuentes en orden:

1. Este **V4.1**: decisiones finales razonadas, discrepancias aclaradas y criterios de aceptación.
2. Auditoría `corregir v4(1).docx` (90 páginas), **ya interpretada e incorporada en este contrato**: los hechos visuales orientan la auditoría del código. El Word original es evidencia complementaria si está disponible; no es requisito para ejecutar los batches. Si una ambigüedad técnica depende exclusivamente de una captura, solicitarla y no inventar.
3. **V4 antiguo consolidado dentro de este mismo archivo**, especialmente el ANEXO A (detalles conservados), ANEXO B (pruebas), ANEXO C (matriz de absorción) y ANEXO D (checklist final). No pedir un segundo archivo V4 para aplicar sus ajustes.
4. Especificaciones previas V3.2 (solo como antecedentes del sistema y contratos implementados, **si están disponibles en el repositorio**); no pedirlas de nuevo para ejecutar los requisitos V4/V4.1 ya consolidados.
5. Especificación maestra V3.1 (referencia histórica solo ante un hueco no cubierto por este contrato; solicitar el documento exacto si hay necesidad comprobada).
6. Auditorías `corregir v3`, `corregir v2`, `corregir` y documento de grado, solo si existen en el contexto y se necesita resolver un detalle del sistema original que este contrato o el código no aclaran.
7. Estado del repositorio: fuente de hechos implementados; no reemplaza contrato final.

Si falta un documento o código necesario: **reportar exactamente cuál, su ruta esperada y por qué hace falta. No inventar.**

## 0.2 Proteger ramas sin asumir cuál tiene los cambios V4

Se debe preservar **`feature/afinia-v3-2`** y, si existe, **`feature/afinia-v4-cierre`**. Es posible que Claude haya terminado batches en alguna de ellas; este documento NO supone que sucedió.

```powershell
git branch --show-current
git status --short
git branch -a
git log -5 --oneline --decorate
```

**Si `git status --short` NO está vacío: DETENERSE y pedir orientación; no descartar archivos.** Confirmar si hay commits nuevos no publicados, branches remotas o trabajo de otro agente.

Seleccionar **base verificada**:

- Si `feature/afinia-v4-cierre` existe y contiene los cambios V4 válidos más recientes, crear nueva rama **desde V4**.
- Si solo `feature/afinia-v3-2` contiene la versión íntegra, crear rama desde ella; incluir en el GAP los cambios V4 pendientes.
- Si ya existe otra rama de avance V4, reportar cuál contiene los commits necesarios y pedir confirmación si hay duda; no asumir por el nombre.

**Nombre de rama propuesto:** `feature/afinia-v4-1-cierre` (si ya existe, consultar antes de reutilizar).

En el caso local confirmado y limpio:

```powershell
git switch feature/afinia-v4-cierre
git switch -c feature/afinia-v4-1-cierre
git branch --show-current
```

**Este comando es ilustrativo, solo para el caso confirmado**; no ejecutarlo si la base no existe o hay cambios sin guardar. Usar `fetch` y `pull --ff-only` solo tras comprobar remoto/rama/upstream, sin sobrescribir trabajo local.

Prohibido sin autorización:

```text
git reset --hard
git clean -fdx
git restore .
git push --force
migración DROP destructiva
borrar .env, uploads, volúmenes, migraciones o datos reales
commits o push en ramas protegidas/anteriores
```

**BATCH 0: SOLO AUDITORÍA.** Después de presentar GAP/plan, esperar luz verde antes de cambios funcionales. No auto-crear decenas de archivos, capas, servicios, endpoints o migraciones por costumbre.

## 0.3 Clasificación por hallazgo

```text
PRESERVE_PASS       evidencia real de que sigue correcto
IMPLEMENTED_UNTESTED existe, falta regresión
PARTIAL             incompleto
DEFECT_CONFIRMED    reproducción + causa
REGRESSION          funcionaba y se rompió
MISSING             no existe
OBSOLETE            debe ocultarse/retirarse de forma controlada
BLOCKED             depende de fuente/API/decisión que falta
```

Nunca rotular PASS solo por el Word. Evidencia: comando/test, escenario, resultado, fecha, archivos o logs. Defecto: **FAIL → causa → corrección → PASS regresión**.

## 0.4 No mezclar estado de negocio, prueba técnica y sugerencia

El Word contiene afirmaciones probadas, preguntas, conjeturas y decisiones posteriores. No implementar literalmente una pregunta si produce una incoherencia.

Ejemplo: pedir repositorio **para GUARDAR DRAFT** contradice permitir borradores incompletos. V4.1 conserva la flexibilidad del borrador, y exige repo para ACTIVAR/publicar un proyecto tecnológico, como se explica más abajo.

---

# 1. RESUMEN DE LOS CAMBIOS NUEVOS RESPECTO AL MD V4 ANTERIOR

| Ref. | Hallazgo nuevo en última auditoría | Decisión V4.1 |
|---|---|---|
| V41-01 | Área de actividad sin skill | Permitir; no inventar habilidad; si existen skills, al menos una global solo si el contrato actual realmente la exige, revisar su necesidad para charlas generales |
| V41-02 | Proyecto con múltiples áreas sin skill por área | Exigir skill contextual por área **al publicar**, no al guardar DRAFT; skill desconocida puede declararse pendiente de catálogo |
| V41-03 | Borradores de todos los actores | Privados para su creador y autorizados técnicos; envío a Dirección crea bandeja PENDING, no propiedad |
| V41-04 | Admin no puede guardar DRAFT sin responsable | Responsable obligatorio **al publicar**, no al guardar DRAFT |
| V41-05 | Tres pestañas de actividades | Académicas internas, Extracurriculares internas y Externas; no confundir origen externo con patrocinio |
| V41-06 | External credential expected redundante | Quitar opción redundante del formulario interno tras verificar migración; conservar capacidad de asociar credencial externa por flujo propio |
| V41-07 | Director tiene aprobaciones de tres familias | Bandeja unificada/filtros/propuestas trazables, sin autoaprobación riesgosa |
| V41-08 | Retos/recompensas | Retirar flujos de creación; **conservar solo tabla de puntos por scope de Docente**, integrada a gamificación, sin ranking público |
| V41-09 | Insignias | Última auditoría propone retirarlas también; para nuevo trabajo V4.1 deja **solo puntos por criterios**; preservar histórico de badges si existe |
| V41-10 | Fecha inicial pasada en actividad | Validar en publicación de actividad nueva; borrador/histórica/edición tienen tratamiento distinto |
| V41-11 | Proyecto puede crearse sin repo, no editarse | DRAFT libre; para ACTIVE repo accesible obligatorio; habilitar editar DRAFT con reevaluación/reconfirmaciones |
| V41-12 | GitHub encuentra Python/FastAPI/etc. pero skills declaradas no coinciden | Pipeline de detección→normalización→catálogo→selección contextual→evidencia, sin autoafirmar tecnologías |
| V41-13 | Repo de otro compañero no devuelve datos | Diagnóstico por status/visibilidad/rate limit/API; no concluir automáticamente que es privado |
| V41-14 | Proyecto publica solo con mínimos y ya dice CORROBORATED | Separar READY_TO_PUBLISH de respaldo real; no sobreatribuir niveles |
| V41-15 | Equipo preexistente vs contactos | Equipo opcional con miembros precargados; contactos opcionales; confirmación individual sin voto colectivo |
| V41-16 | Excluir integrante al crear proyecto | Motivo obligatorio + notificación, sin cambiar automáticamente membresía histórica del equipo ni acusar al excluido |
| V41-17 | Privacidad de proyectos confusa | Opciones legibles, visibilidad del perfil Afinia ≠ accesibilidad del repositorio GitHub |
| V41-18 | Evidencias/credenciales mezcladas | Pestañas por tipo sin duplicar registros ni endpoints |
| V41-19 | QR y enlace repartidos entre Perfil/Colaboración | Mover configuración del perfil público y QR a Privacidad de Mi perfil; colaboración/equipos para contactos y equipos |
| V41-20 | Gamificación puntos no visible en perfil/progreso | Mostrar saldo e historial explicable, separado de respaldo y afinidad |
| V41-21 | Revisión de estado de afinidad y backing | No presentar “verificado” o “90 % autenticidad” sin prueba real; estados con razones y procedencia |
| V41-22 | UX poco agradable en algunos flujos | Mejorar jerarquía, legibilidad, consistencia y navegación con pruebas, sin rediseñar todo |

Las correcciones válidas del V4 anterior están incorporadas de forma expresa en las secciones funcionales y ANEXOS de este documento; no es necesario suministrar otro MD.

---

# 2. VISIÓN FUNCIONAL DE PRINCIPIO A FIN

```text
Cuenta institucional provisionada
  → activación con enlace/código y recuperación
  → perfil inicial (datos institucionales no editables)
  → áreas y habilidades DE INTERÉS
  → áreas y habilidades QUE QUIERO MEJORAR
  → disponibilidad / privacidad
  → orientación opcional
  → motor de recomendaciones por preferencias (no por dominio)
  → descubrir actividades INTERNAS / oportunidades EXTERNAS / recursos
       → intern: solicitud → confirmación institucional → constancia si corresponde
       → extern: inscripción/participación → evidencia del proveedor → validación
       → recurso: consultar/guardar, sin acreditar competencia
  → proyecto DRAFT → repo/detecciones → skills/áreas/contexto/evidencias
       → integrantes confirman contribuciones → ACTIVE si cumple
       → backing según fuentes, no solo por completar formulario
  → trayectoria auditable + afinidad por áreas + soporte
  → equipos/contactos/colaboración y perfil público opcional/QR
  → currículo personalizable: elegir secciones y experiencias concretas elegibles
  → gamificación por eventos y criterios controlados, independiente de afinidad
```

Roles: `STUDENT`, `TEACHER`, `CAREER_DIRECTOR`, `SCIENTIFIC_SOCIETY`, `ADMIN`. Estudiante usa web y móvil; el móvil sigue siendo solo estudiante. No agregar sexto rol por contacto de actividad.

---

# 3. TAXONOMÍA — MANTENER SIN REGRESIÓN

```text
Area académica = dominio macro
Skill/tecnología = elemento específico
Alias = nombre alternativo DE ESA MISMA SKILL
Tag de área = semántica para clasificar/sugerir al Admin
```

- Área tiene `code`, `name`, `tags`, `description?`, `status`.
- Skill tiene **una área principal + cero o varias secundarias**. Reutilizar tablas existentes cuando sea posible.
- La experiencia almacena `area_id + skill_id` contextual; si una skill pertenece a varias áreas globales no se puntúa automáticamente en todas.
- Sugeridor de Admin consulta catálogo actual, normalización y coincidencia exacta prioritaria. No permitir que `alias=aws` sugiera Redes por coincidencia espuria. Tokens cortos solo coincidencia exacta controlada.
- Tags/alias/códigos no suman Afinidad, no son evidencia y no se copian como skills.
- Cada skill en una experiencia se asigna a un contexto de área explícito; evitar doble asignación accidental de misma skill en varios contextos cuando no se justificó.

## 3.1 Actividades ≠ proyectos al exigir skills

**Actividad:** puede trabajar `Redes` a nivel conceptual, sin abordar una tecnología particular. Puede seleccionar áreas sin skill en alguna área (incluso una charla general sin skills). No atribuir al alumno `Linux`, `TCP/IP` ni otra tecnología que el evento no trabajó. Si el backend actual exige al menos una skill global, auditar esa restricción y flexibilizarla si impide charlas legítimas, manteniendo mínimo un área activa.

**Proyecto tecnológico ACTIVE:** cada área alegada debe estar respaldada por al menos una skill contextual seleccionada, y cada skill debe tener tipo de fuente (`DECLARED`, `REPO_LANGUAGE`, `MANIFEST`, etc.). Que una skill exista en el catálogo no implica que esté tecnológicamente corroborada. `DRAFT` puede tener cero áreas o skills.

**Credencial:** las áreas y skills derivadas del catálogo sirven para clasificar el logro; solo reciben backing si la credencial individual se verifica según sus reglas.

**Recurso:** área/skills son filtros/metadatos para búsqueda/recomendación, NO evidencia ni Afinidad.

---

# 4. ACTIVIDADES Y OPORTUNIDADES — MODELO ACTUALIZADO

## 4.1 Dos ejes de información; tres pestañas amigables

Modelo interno recomendado sin romper tablas:

```text
origin: INTERNAL | EXTERNAL
character: ACADEMIC | EXTRACURRICULAR
```

Presentación principal:

```text
Académicas internas
Extracurriculares internas
Oportunidades externas
```

¿Por qué dos ejes? Un patrocinio Cisco a una actividad organizada por Sociedad Científica **no la convierte automáticamente en curso EXTERNAL**. EXTERNAL se refiere al proveedor externo responsable de la formación/credencial; una interna patrocinada sigue siendo interna.

En vistas por rol, mostrar solo pestañas autorizadas. Sociedad puede crear/exponer colaboraciones/patrocinios conforme reglas, sin darse atribuciones académicas ajenas. No borrar un tipo de actividad existente solo porque se reordena UI.

El selector redundante `EXTERNAL_CREDENTIAL_EXPECTED` de resultado interno puede retirarse **de la interfaz** si duplica el flujo de oportunidad externa; si una actividad interna realmente otorga derecho a una credencial de proveedor, conservar la asociación por el flujo de credencial, no volver a exigir subir la asistencia.

Resultado de interna limitado a opciones pertinentes: `NONE`, `PARTICIPATION_ONLY`, `INTERNAL_CONSTANCY`, `INSTITUTION_ISSUED_CERTIFICATE`. No afirmar que Afinia emite credenciales de tercero.

## 4.2 Propietario, responsable, contacto y autoridad

Nunca usar `responsibles[]` para decidir `created_by`.

```text
created_by      autor original; inmutable y auditable
responsibles[]  quienes llevan operación, asistencia, participantes
contacts[]      puntos de contacto, sin autoridad de aprobación
reviewed_by     autoridad que decidió revisión
```

- Docente que crea su actividad académica: responsable él mismo (o reglas ya autorizadas); revisa Dirección.
- Sociedad que crea extracurricular: puede asignar integrantes de Sociedad, sujeto a revisión.
- Director que crea: no necesita autoaprobación; puede asignarse o designar operadores válidos.
- Admin: soporte excepcional; puede publicar sin revisión ordinaria, pero conserva autor y responsable académico/operativo real, y trazabilidad. No recibe automáticamente carácter académico.
- En `DRAFT`, no exigir responsable todavía; en `PUBLISH/SUBMIT`, sí validar lo necesario. Esto resuelve el Admin que no puede guardar un borrador sin responsable.

**Admin y Director no son literalmente el mismo rol.** El Director es autoridad académica ordinaria; Admin posee atribuciones operativas excepcionales. Conservar la distinción en audit y permisos.

## 4.3 Visibilidad completa por estado

```text
DRAFT (de cualquier actor)
   → solo creador en panel operativo + soporte auditado excepcional de Admin
   → NO aparece en listas 'Mis actividades' de responsables asignados
   → NO aparece en bandeja del Director (si fue creado por Docente/Sociedad)
   → NO se publica/inscribe/otorga respaldo

SUBMIT (Docente/Sociedad)
   → review_status=PENDING
   → visible al creador y a Dirección SOLO EN BANDEJA DE REVISIÓN
   → la Dirección puede aprobar/observar/rechazar, no hacerse pasar por creador ni mostrar como 'mía'
   → no visible a estudiantes

OBSERVED/REJECTED
   → vuelve al flujo del creador para corrección/consulta según regla;
   → no visible en catálogo público

APPROVED
   → se conserva `created_by` original; contenido material protegido para Docente/Sociedad
   → Dirección administra cambios excepcionales auditados
   → publicación sigue reglas de lifecycle

Director/Admin que crean:
   → NOT_REQUIRED; DRAFT privado; PUBLISH explícito

PUBLISHED
   → visible según scoping; no inscripción hasta OPEN

OPEN
   → inscripción permitida según semestres/cupo/fechas

CLOSED
   → no nuevas inscripciones; operativa restringida según razón

FINISHED
   → evento terminó; NO reabrir como edición de evento
   → participación puede necesitar regularización posterior (sección 5)

CANCELLED
   → motivo; notificar; no reabrir informalmente
```

**Aprobada NO significa que la Dirección se vuelva autora/owner**. Director adquiere capacidad de gestionar contenido aprobado, sin alterar `created_by` ni el historial.

## 4.4 Qué puede hacer responsable asignado por Admin/Director

**Puede** (solo cuando actividad sea accesible): ver, administrar inscripciones, confirmar asistencia y gestionar estados operativos expresamente autorizados, con guards.

**NO puede:** modificar título, fines, áreas/skills, fechas materiales, issuer, `created_by`, revisión o re-enviar a Dirección una actividad creada por Director/Admin. Tampoco autoaprobar.

Un responsable Director puede tener privilegios adicionales propios de su rol, pero deben auditarse; no inferir del hecho de estar asignado.

Si Docente/Sociedad creó, mientras DRAFT/OBSERVED puede editar su propuesta; una vez aprobada, no modificar el contenido aprobado sin intervención de autoridad.

## 4.5 Semestres y TeacherScope

Cuando Director/Admin asigna docentes responsables a una actividad:

```text
allowed_semesters = union(authorized_semesters de esos docentes)
```

Mostrar tras seleccionar responsables, con búsqueda si la lista es larga. Si se retira/añade responsable, revalidar semestres y advertir; no borrar silenciosamente. Cada docente opera únicamente los estudiantes dentro de su propio scope; la unión no amplía sus permisos individuales.

**Excepción razonable:** si la autoridad crea una actividad legítimamente para toda la carrera y un Docente lleva solo una parte, no atribuir cobertura académica total al Docente. Elegir entre ampliar responsables válidos, limitar semestres de la actividad, o separar operadores por semestre; no ocultar incompatibilidad ni modificar alcance sin consentimiento. Claude debe verificar si el modelo actual permite esta alternativa antes de imponer la unión en todas las actividades.

## 4.6 Fechas, cupo y estados

- En **publicación de una actividad NUEVA programada**, `start_at > now` evaluado por backend, considerando `America/La_Paz` solo para visualizar/ingresar la hora; utilizar instante consistente UTC internamente si esa es la arquitectura.
- **En DRAFT** permitir fecha faltante o fecha que será corregida; mostrar advertencia. No bloquear borrador incompleto.
- No impedir edición histórica o importación únicamente porque la fecha ya pasó; cambios materiales pospublicación requieren permiso y auditan impacto.
- `end_at > start_at` cuando ambos presentes.
- Si `start_at <= now` → cerrar inscripciones (`CLOSED`) según mecanismo actual; no permitir cambiar a OPEN sin corregir fecha o causa.
- Si cupo lleno → explicar aumento/liberación antes de OPEN.
- `FINISHED` terminal para el evento; si quieren repetir, usar **Duplicar actividad** (nuevo ID, fechas, sin copiar asistencia).
- Puede finalizarse anticipadamente con confirmación y motivo/registro si el evento terminó antes.
- `CANCELLED` pide motivo y notifica inscritos.

No basta deshabilitar selects en web: guards también en API.

## 4.7 Formulario y UX de actividades

- Múltiples áreas; no duplicar skills multiárea.
- Al EDITAR, precargar las skills ya persistidas según `area_id + skill_id`. Word comprueba que están en detalle: parece defecto de hidratación, no suponer fallo DB sin reproducir.
- Mantener límite de 6 áreas si lo confirma repositorio; no aumentar sin razón.
- `Aula 201`, `Laboratorio B-12` válidos; espacios/solo números/solo signos inválidos con error inline.
- Modalidad controla lugar y meeting URL.
- Múltiples imágenes opcionales, máximo propuesto 5, portada y carrusel; preservar imagen legacy.
- Card con imagen independiente del bloque de texto (no superposición ilegible).
- Enlaces de apoyo opcionales, más de uno.
- Cuadros max 10 filas, ordenar/buscar/limpiar/paginar, no recrear tablas ya correctas.
- Filtrar Dirección por creador/origen (Docente/Sociedad/Director/Admin), lifecycle/review; mostrar responsables con nombres y roles, sin confundir responsables con owner.

---

# 5. ASISTENCIA — CORRECCIÓN IMPORTANTE A UNA PROPUESTA DEL V4 ANTERIOR

**NO BLOQUEAR TODA CONFIRMACIÓN EN EL MISMO INSTANTE EN QUE EL RELOJ PASA A `FINISHED`.**

Justificación: una charla termina a las 20:00; el responsable suele registrar lista de asistencia a las 20:15 o al día siguiente. Si el sistema la finaliza automáticamente, bloquear registro impide otorgar constancias y trayectoria. El Word pidió no quitar confirmaciones ya consolidadas; ambas necesidades son compatibles.

Modelo mínimo sin crear un motor nuevo:

```text
activity.lifecycle = FINISHED
attendance_status = OPEN_FOR_SETTLEMENT | LOCKED
attendance_closed_at?
```

- Al terminar fecha: `FINISHED` significa evento terminado, no que todas las filas de asistencia ya fueron verificadas.
- Mientras `OPEN_FOR_SETTLEMENT`, responsable autorizado puede **confirmar/registrar estados pendientes** basándose en asistencia real.
- Una participación **ya CONFIRMED** con evidencia/constancia emitida no puede pasar libremente a ABSENT; requiere procedimiento de corrección excepcional Director/Admin con motivo y auditoría, incluso durante regularización.
- Responsable usa acción **Cerrar asistencia** cuando terminó de confirmar; después `LOCKED` no edita filas normalmente.
- Si se implementa un plazo de regularización, usar configuración real y una advertencia; **no inventar un cierre automático universal de N horas** sin aprobación del usuario.
- Director/Admin puede corregir después del cierre con motivo, cambio registrado y reconciliación de constancias, snapshot, afinidad, soporte, gamificación y currículo; preservar reversals y hechos históricos.
- Nunca permitir estudiante autoconfirmar asistencia.
- Para actividad `CANCELLED`, evitar otorgar asistencia/certificado de manera automática; aplicar reglas de eventos cancelados según evidencias previas.

Aceptar si:

```text
Evento auto-FINISHED → Docente registra una participación pendiente → CONFIRMED PASS
Evento auto-FINISHED → Docente intenta CONFIRMED anterior → ABSENT sin excepción → DENIED
Cerrar asistencia → bloqueo ordinario PASS
Director corrige con motivo → audit/derivados consistentes PASS
```

Si el repositorio ya tiene un flujo equivalente, REUTILIZAR. No añadir estado/tabla extra sin necesidad.

---

# 6. CREDENCIALES EXTERNAS — ESTADOS Y LÍMITES REALES

## 6.1 Fuentes de extracción y pruebas

```text
PDF texto        extracción nativa
PDF escaneado    OCR
PNG/JPG          OCR + QR decoder
DOCX             texto/links/QR si parser actual soporta; no exigir soporte universal
URL              validador por proveedor
```

OCR y QR son cosas distintas. Identificar un logo o leer un curso NO autentica la credencial. QR/URL deben dirigir a una **instancia individual** del certificado, no a portada de curso.

## 6.2 Dos ejes

```text
validation_status:
PENDING
AUTO_VERIFIED
MANUAL_REVIEW_REQUIRED
MANUALLY_VERIFIED
INCONCLUSIVE
REJECTED

backing:
DECLARED
SUPPORTED
CORROBORATED
FLAGGED
```

- `AUTO_VERIFIED` requiere fuente oficial: issuer + credencial + titular + estado coincidentes cuando disponibles, y pruebas técnicas verificadas; no solo 200 OK.
- `MANUALLY_VERIFIED` requiere revisión HUMANA con **prueba externa independiente del propio archivo**. Que al Admin le parezca auténtico el logo no justifica `CORROBORATED`.
- Si hubo revisión pero no fue posible verificar issuer/titular → `INCONCLUSIVE` + backing apropiado (`SUPPORTED` solo por contenido coherente) y trazas de revisión; no llamar verificado.
- `REJECTED` si hay contradicción fuerte documentada (p. ej. ID de otra persona); distinga falsedad comprobable de indisponibilidad temporal.
- `MANUAL_REVIEW_REQUIRED` no alimenta Afinidad como credencial corroborada.

## 6.3 Verificadores reales, no promesas

Candidatos:

```text
Credly / IBM
Cisco NetAcad
Huawei
Generic fallback
```

El agente debe **verificar disponibilidad técnica real** de cada adapter/API/HTML, licencias, autenticación, CAPTCHA, rate-limit, cambios y qué devuelve. Implementar solo lo comprobado con fixture permitido. No afirmar que Huawei/Cisco/Credly quedan automáticamente integrados porque una URL pública existe o por especulación del Word.

- Credly URL badge individual: comprobar que metadata pública realmente permita titular/curso/issuer; API empresarial puede exigir credenciales.
- Cisco NetAcad recognition individual: comprobar respuesta accesible y estable.
- Huawei QR/ID y verificador: si no expone API legible o requiere interacción humana, dejar `MANUAL_REVIEW_REQUIRED`/`INCONCLUSIVE`; no automatizar CAPTCHA ni eludir controles.
- `GenericVerifier` nunca auto-CORROBORATE sin fuente individual auténtica.

Seguridad: whitelist/normalización de dominios, SSRF, redirecciones, timeouts, tamaño de archivo, antivirus si aplica, logs sin secretos, no confiar en `hostname.includes` ni peticiones a IP privadas/locales.

## 6.4 Interna vs externa

- Interna `CONFIRMED` → el responsable registra asistencia y, si emite, constancia institucional. Estudiante NO sube falso comprobante de asistencia.
- Externa → inscripción/aceptación/finalización permite adjuntar evidencia, que debe validarse por proveedor; inscripción nunca significa certificado obtenido.
- Histórica → no crear actividad antigua falsa; estudiante registra certificado y evidencia, validación directa.

---

# 7. RECURSOS / BIBLIOTECA

- Material permanente: PDF, guía, documentación, libro, vídeo, URL/herramienta.
- No tiene inscripción/asistencia/FINISHED, no da afinidad ni respaldo profesional.
- Área y skills clasifican; sirven como TARGET del recomendador, no como señal aportada al perfil.
- `Todos`, `Para ti`, `Favoritos` para estudiante; favoritos y abrir **no** modifican recomendador.
- Docente puede proponer recursos para semestres autorizados; Dirección revisa; Admin/Director crean directamente con auditoría.
- No copiar `responsibles[]` a recursos: no son actividades.
- Validación inline por campo y misma política al editar/crear; nombres no solo símbolos/solo números, URL http(s) sin SSRF, imagen/desc opcional; no romper bloqueo de URL duplicada.
- Buscar en vivo, ordenar, 10/page, paginar, mostrar activos/retirados; no recrear si ya funciona.
- Gamificación asociada opcionalmente a **evidencia de hito externo validado**, nunca por click/favorito. Si esto amenaza alcance, mantenerlo como criterio opcional de evaluación manual con Director, sin estado de completado inventado.

---

# 8. ONBOARDING, PRIVACIDAD Y RECOMENDADOR

Cuatro dimensiones distintas:

```text
interested_areas
interested_skills
improvement_areas
improvement_skills
```

`Me interesa` significa preferencia explícita, NO fortaleza; `Quiero mejorar` objetivo personal, NO debilidad demostrada. Intereses pueden ser públicos según ajustes del estudiante; mejora SIEMPRE privada.

Motor de recomendaciones: personalización y sugerencias, separado de afinidad. Una `ACTIVITY_INTERESTED` explícita puede aportar señal contextual idempotente y reversible, sin reescribir intereses declarados. Favorito de actividad/recurso no aporta señal ni puntos. Inscripción tampoco equivale a interés permanente.

Pesos orientativos previamente cerrados en V4:

```text
INTEREST_DECLARED +10
IMPROVEMENT_DECLARED +5
ACTIVITY_INTERESTED +5
```

Verificar si la implementación ya los usa; evitar duplicar fuentes si hay legacy. Diferenciar en UI: `Coincide con tus intereses` vs `Coincide con lo que quieres mejorar`.

**No mostrar “100 % recomendado” como si fuera certeza, habilidad o probabilidad**. Solo si existe fórmula documentada y se indica denominador/referente exacto; caso contrario mostrar coincidencias y motivos concretos. No dar 100 % porque una sola etiqueta coincide.

---

# 9. GAMIFICACIÓN DEFINITIVA — PUNTOS, SIN SISTEMA DE RETOS

## 9.1 Alcance reducido de la auditoría final

Conservar:

```text
puntos por hechos reales
criterios controlados por Admin/Director
extras temporales por área
historial de puntos y saldos
propuesta de Docente + revisión por Dirección donde corresponde
vista de puntaje de estudiantes permitida por scope
```

Retirar de navegación y creación:

```text
Retos y recompensas
Criterios antiguos
creación de insignias/recompensas complejas
ranking público o de toda la carrera para estudiantes
```

La mención tardía del Word a quitar insignias se interpreta como reducir **nuevas mecánicas de insignias**; si ya hay badges históricos, preservarlos en DB y no borrar certificaciones/constancias. **No convertir puntos de gamificación en credenciales académicas.**

## 9.2 Tipos de hechos finitos y criterios configurables

Ejemplos:

```text
ACTIVITY_PARTICIPATION_CONFIRMED
PROJECT_CORROBORATED
TEAM_COLLABORATION_CONFIRMED
EXTERNAL_CREDENTIAL_CORROBORATED
RESOURCE_MILESTONE_MANUAL
```

Admin/Director configuran sobre esos tipos:

```text
name
trigger_type
points
active
area_id?
valid_from?
valid_until?
description?
```

No scripts administrables ni reglas arbitrarias. Controles de topes, duplicados, edición retroactiva y validez de vigencia. No permitir puntos manuales libres en formulario.

## 9.3 Flujo por módulo

**Actividad**: responsable/creador escoge criterio compatible opcional. Si Docente/Sociedad solicita aprobación, Dirección valida actividad y criterio en misma revisión. `CONFIRMED` produce evento idempotente; asegurar que no premia dos veces al editar.

**Proyecto**: estudiante NO puede darse puntos. Docente con scope propone criterio sobre un proyecto visible/que cumpla backing requerido → bandeja de Dirección con enlaces a proyecto, evidencia y razonamiento → Dirección aprueba/rechaza. Prerrequisitos mostrados como checklist informativo; no codificar un motor de evaluación flexible ni autoaprobar.

**Recurso**: no puntos por abrir/guardar. Si existe hito externo verificable de lectura/actividad asociada, Docente propone comprobación concreta y Dirección la valida. Alternativa de menor alcance: desactivar gamificación de Recursos hasta que exista prueba real. Evitar que click simule lectura.

**Extra de temporada**: Admin/Director configuran fechas de vigencia, área, trigger y bonus. No puntúa afinidad; respetar zona horaria establecida.

## 9.4 Cola de Dirección para reducir carga

No agregar un nuevo rol ni crear automatización que apruebe ciegamente. Reutilizar bandeja de revisión con:

```text
Pendientes — Actividades
Pendientes — Recursos
Pendientes — Gamificación
```

Contador, filtros, fechas, detalle reducido, approve/observe/reject, procedencia y enlace al objeto. Checklist automático de integridad **solo orientativo**, sin convertirlo en prueba de autenticidad. Si el repo ya posee bandeja unificada, ampliarla; no crear tres copias.

## 9.5 Ranking/puntos de estudiantes: mínimo alcance

Última auditoría pide conservar el **top de estudiantes** que antes estaba en Retos/Recompensas. Reubicar en Gamificación **solo para Docente con sus semestres y Director/Admin autorizados**; evitar ranking público o comparación humillante entre estudiantes. Respetar política de privacidad, auditar accesos; preferir detalle de puntos por estudiante y filtros. No publicar un Top general en Perfil QR.

## 9.6 Idempotencia y correcciones

Clave lógica equivalente a:

```text
student_id + criterion_id + source_type + source_id
```

Una recompensa por hecho. Si se invalida la fuente mediante corrección autorizada, usar reversión auditable en ledger, no borrar la historia silenciosamente.

---

# 10. PROYECTOS — ESTADOS CORRECTOS Y EDICIÓN

## 10.1 Problema real de última auditoría

Se creó un proyecto con `POST /api/projects` 201, la API buscó checks y readiness; en una prueba GitHub detectó Python/FastAPI/pytest/MongoDB y se declararon otras skills, pero el proyecto parecía poder publicarse con campos mínimos y sin repo obligatorio. Al volver, título/repo no se podía editar. Estos resultados del Word son indicios; Claude debe reproducirlos sobre rama real.

## 10.2 Separar DRAFT de ACTIVE

```text
DRAFT
→ título de trabajo suficiente o incompleto según UI
→ puede NO tener repo, áreas, skills, demo, miembros
→ solo dueño/equipo autorizado, NO puntúa afinidad
→ EDITABLE

READY_TO_PUBLISH (resultado de checklist, no necesariamente nuevo enum)
→ título válido
→ >=1 área
→ >=1 skill por cada área alegada
→ repo GitHub PÚBLICO válido y accesible para este MVP tecnológico
→ comprobación técnica ejecutada o resultado conocido con política de fallback explícita
→ evidencia contextual mínima
→ miembro/autor y contribuciones confirmadas si colaborativo
→ semántica de privacidad elegida

ACTIVE
→ se expone conforme visibilidad
→ aún puede tener backing DECLARED/SUPPORTED
→ NO AUTO-CORROBORATED por solo pasar readiness
```

**Cambio importante respecto a comentario exploratorio del Word:** NO exigir GitHub para guardar DRAFT porque eliminaría la posibilidad de trabajar incompleto. Sí es condición para **ACTIVAR/publicar** el portafolio tecnológico en este MVP si esa restricción es confirmada. Si Github está caído pero URL ya validada/cacheada, permitir estrategia transparente de estado pendiente de comprobación, nunca falsos positivos.

**Repo opcional para borrador; obligatorio para ACTIVE**. `demo_url` opcional, pero cuando hay demo se valida reachability/HTTPS/title sin inferir backend.

## 10.3 Editar proyecto y revalidar

El dueño puede editar DRAFT. Si cambia repo, título, áreas, skills o integrantes en ACTIVE:

- impedir que las detecciones antiguas continúen como respaldo del repo nuevo;
- invalidar checks/cache dependientes y ejecutar nuevas comprobaciones;
- pedir reconfirmación de contribuciones cuando la modificación afecta a integrantes;
- preservar snapshot/audit y no borrar prueba histórica;
- si no cumple ACTIVE, pasar por transición/versión definida o mantener estado visible con advertencia hasta revalidación, según contrato real; NO inventar un downgrade destructivo.

UI debe explicar qué bloquea editar/publish, no simplemente ocultar botones.

---

# 11. GITHUB — DETECCIÓN, MAPEO AL CATÁLOGO Y PROVENIENCIA

## 11.1 La API no valida universalmente que una skill “se usó”

- Languages API indica distribución aproximada de lenguajes en repo; no nivel de competencia ni autoría.
- Manifests (`package.json`, requirements, pyproject, pom, Gradle, etc.) pueden revelar dependencias **declaradas**; no garantizan que un módulo específico se haya utilizado en la solución final.
- Code search/árbol público puede apoyar detección limitada, pero no prometer inspección total, clonado, ejecución, AST universal ni detección de tecnologías de backend por hosting.
- Repos privados normalmente no son accesibles sin autorización; no deducir privacidad por un solo fallo. Diagnosticar 404/403, redirecciones, URL, API rate-limit, timeout, nombre cambiado, rama/manifest o falta de dependencia reconocida.

## 11.2 Pipeline obligatorio

```text
repository_url
→ validar host GitHub y forma owner/repo; URL puede incluir /tree/branch pero normalizar repo raíz
→ comprobar visibilidad/accesibilidad con API pública
→ obtener languages, manifests y metadata limitados
→ normalizar nombres: fastapi, FastAPI; pymongo, MongoDB (si aplica)
→ cotejar catalog skills por code/name/alias y mapeos controlados
→ asociar skill(s) candidatas con area primaria/secundaria
→ mostrar SUGERENCIAS, con evidencia y confianza de detección
→ estudiante acepta / rechaza / declara manualmente
→ guardar area_id + skill_id + provenance
→ recalcular respaldo técnico limitado
```

**No autogenerar skills globales en DB** por cada dependencia. Una detección desconocida se muestra como `Tecnología no catalogada: ...`, puede solicitarse evaluación al Admin sin puntuar como skill confirmada ni bloquear un DRAFT.

## 11.3 Separar tres capas

```text
A. DETECTED_SIGNAL:
   GitHub vio lenguaje o manifest; reporte de señal.

B. STUDENT_CLAIM:
   estudiante afirma haber utilizado skill X en este proyecto y área contextual.

C. BACKING_DECISION:
   sistema evalúa si esa afirmación tiene evidencia suficiente para SUPPORTED/CORROBORATED.
```

Que GitHub detecte Python no debe añadir automáticamente al CV «domina Python» ni acreditar al alumno. Si estudiante declaró PostgreSQL pero no hay señal técnica válida, queda declarado; la ausencia no prueba engaño. Una skill sugerida puede ser aceptada con contexto de proyecto, sin transformarse en CORROBORATED por un clic.

## 11.4 Política anti-error del catálogo

- Mapear por catálogo y adapters conocidos; normalizar case, delimitadores, paquetes y alias.
- No hacer substring bruto (`as`, `py`, `go`) que produzca categorías arbitrarias.
- Mostrar por qué cada sugerencia apareció: `language=Python`, `requirements.txt: fastapi`, etc.
- Si aparecen múltiples áreas candidatas, alumno elige contexto; no sumar una skill en todas las áreas.
- Si no hay skill de catálogo compatible, no crearla automáticamente: Admin evalúa solicitud de nueva skill, con alias/área.
- No afirmar “skills validadas” por el mero hecho de encontrarlas en un manifest; usar “señales detectadas” / “respaldadas parcialmente”.

## 11.5 Repos ajenos, colaboración y autoría

Ver repositorio público de otra persona NO demuestra participación del estudiante. Es precisamente un riesgo de fraude. Autorización técnica podría basarse en:

- OAuth GitHub para vinculación opt-in de cuenta (no obligatorio ni improvisar alcance);
- contribuciones atribuibles por commits/PRs públicos con limitaciones;
- verificación individual de equipo;
- evidencia contextual y revisión docente cuando corresponde.

No declarar 90 % de autenticidad. Presentar escala de respaldo y qué pruebas respaldan CADA afirmación, no cifra artificial.

---

# 12. BACKING DE PROYECTO ≠ ESTADO DEL PROYECTO

Mantener estados existentes de backing si ya están codificados:

```text
DECLARED
SUPPORTED
CORROBORATED
REVIEWED
FLAGGED
```

**Interpretación V4.1** (ajustar al contrato físico actual sin cambiar nombres por estética):

| Estado | Qué significa | Lo que NO significa |
|---|---|---|
| `DECLARED` | Se aportó afirmación sin prueba suficiente | Falso o fraudulento |
| `SUPPORTED` | Hay al menos una señal pertinente: repo accesible, manifest, evidencia contextual, etc. | Validación fuerte ni autoría probada |
| `CORROBORATED` | Al menos dos tipos de evidencia compatibles y suficientemente independientes para la **afirmación concreta**, con titular/contribución apropiadamente atribuidos y checks explicables | Certificación oficial o 100 % verdadero |
| `REVIEWED` | Revisión institucional humana registrada, alcance y revisor conocidos | Verificación criptográfica/tercero o evaluación profesional de todas las skills |
| `FLAGGED` | Contradicción/inconsistencia material identificada que requiere atención | Culpabilidad automática |

**No ascender a CORROBORATED solo por** completar campos, crear DRAFT, publicar ACTIVE, obtener un 200 de GitHub, un language o capturas. Lenguaje y manifest del MISMO repo son señales relacionadas, no dos fuentes completamente independientes. Si no hay prueba independiente, permanecer SUPPORTED. Una screenshot sin procedencia tampoco añade autenticidad automáticamente.

Backings pueden ser por **proyecto** y, sobre todo, por **skill claim**. Proyecto soportado ≠ cada tecnología verificada. La aportación de Afinidad por área se calcula de acuerdo con el motor V4 existente y sus fuentes autorizadas, no multiplicando por skills/detecciones.

Si el motor actual asigna CORROBORATED indebidamente, marcar defecto y proponer mínima corrección + migración/recálculo de snapshots solo si es necesario; no recalcular silenciosamente todos los perfiles sin plan/auditoría.

---

# 13. EQUIPOS, CONTACTOS E INTEGRANTES — FLUJO DE PROYECTOS

Crear proyecto:

```text
1. Proyecto individual → dueño únicamente.
2. Añadir contacto(s) ya aceptado(s) → invitación individual opcional.
3. Usar equipo existente → combobox con búsqueda, carga miembros actuales.
```

Equipo es grupo colaborativo existente, NO necesariamente un conjunto de contactos. Contacto es persona que aceptó vínculo individual; no se vuelve miembro de equipo automáticamente. Si no hay equipo ni contactos, el proyecto puede ser individual.

Al seleccionar equipo:

- precargar miembros **como candidatos a integrar el proyecto**; no garantizar automáticamente que todos trabajaron;
- mostrar nombres, roles y propuestas de aportación;
- permitir quitar participantes de ESTE PROYECTO antes de enviar invitaciones, con motivo si proviene de un equipo, y notificar al miembro de forma respetuosa; **NO eliminarlo del equipo original** como efecto colateral;
- conservar historial de quién invitó, excluyó y por qué; no notificar una acusación ni compartir datos privados innecesarios;
- el creador no confirma en nombre de los demás.

Cada integrante decide:

```text
ACCEPT_ROLE_AND_CONTRIBUTION
REJECT/REQUEST_CORRECTION
```

Si uno discrepa, DRAFT/activación bloqueada hasta resolución o exclusión justificada sin fabricar consentimiento. Confirmación individual, no votación por mayoría.

El estudiante confirma **su contribución** y las skills que personalmente usó, no «contribución del equipo» genérica. Guardar contexto área–skill por persona y evidencia según disponibilidad. Cambios posteriores que afecten roles/skills exigen nueva confirmación.

Notificaciones deben ser idempotentes y útiles; no enviar eventos duplicados por recargas.

---

# 14. PRIVACIDAD DE PROYECTOS — NOMBRES CLAROS

Propuesta de UI, sujeta al modelo real:

```text
Solo yo (borrador/privado)
Integrantes del proyecto
Docentes autorizados (según semestre y políticas)
Comunidad Afinia (solo usuarios autenticados si así está implementado)
Público por enlace (acceso permitido sin iniciar sesión, si está habilitado)
```

No imponer cinco tipos si backend solo admite tres: **traducir opciones reales con ayudas claras** y mantener control granular de alcance.

Aclarar:

- visibilidad del **registro de Afinia**, no de GitHub;
- repositorio público de GitHub puede ser visible mundialmente aunque proyecto Afinia sea privado;
- QR público de perfil NO expone evidencias privadas ni proyectos excluidos;
- `DRAFT` nunca se vuelve público por elegir una visibilidad anticipada.

En `Público por enlace`, especificar si requiere login o no; no mostrar botón con semántica falsa. Pruebas 401/403 y perfiles externos.

---

# 15. VISTAS DE EVIDENCIAS Y CREDENCIALES

En página del estudiante donde ahora hay mezcla de evidencias y certificados, proponer pestañas claras sin romper datos:

```text
Evidencias de proyectos
Credenciales externas
Constancias y certificados institucionales recibidos
```

Dentro de Credenciales externas:

```text
Registrar credencial histórica
Acreditar oportunidad externa finalizada
Mis credenciales y su validación
```

No hacer que el usuario registre nuevamente una constancia interna emitida por el responsable. Estados de validación visibles con explicación. No duplicar una credencial por estar en varias pestañas; consulta diferente sobre registro único.

UX: botones y nombres coherentes, detalle de proveedor, QR/verifier si existe, fecha, estado, qué se verifica y qué falta. Nada de `100 % verificado` sin fuente externa fuerte.

---

# 16. COLABORACIÓN, EQUIPOS, PERFIL PÚBLICO Y QR

- En sidebar estudiante, agrupar `Colaboración` con Contactos y Equipos; no duplicar Equipo como menú y tab redundantes si sirve la misma función.
- Mover `Mi enlace y QR` al apartado **Mi perfil → Visibilidad/Privacidad** (tab o subsección), sin crear dos fuentes de verdad.
- Conservar la acción QR dentro de Colaboración como **acceso rápido al mismo ajuste**, si mejora UX, no como almacenamiento distinto.
- Perfil opt-in; alias/canales/slug público según política; no publicar correo institucional, áreas de mejora, token ni datos académicos privados por defecto.
- Un QR se puede compartir para solicitar contacto o mostrar perfil público permitido; aclarar diferencia y seguridad. No convertir QR en permiso de edición ni autoagregar contactos sin aceptación.

---

# 17. PERFIL, MI PROGRESO, AFINIDAD, CURRÍCULO

## 17.1 Perfil

- Vista tabulada y accesible de datos institucionales, intereses, áreas de mejora privadas, habilidades, privacidad y QR.
- Saldo de puntos de gamificación visible al estudiante, con enlace al historial.
- Intereses públicos solo con opt-in/ajuste; mejora siempre privada.

## 17.2 Mi progreso / trayectoria

Historia explicable por actividad interna confirmada, proyecto, evidencias, credencial, constancia, colaboración, y gamificación; evitar mezclar puntos con puntuación académica. Historial de premios idempotente y reversions documentados.

## 17.3 Afinidad

- Afinidad V4 por áreas, SOLO experiencias respaldadas de familias permitidas.
- No tags, intereses, favoritos, clicks, IA, gamificación.
- Skill contextual explica aportación; no asignar porcentaje de «dominio de PostgreSQL».
- `SUPPORTED` y `CORROBORATED` se muestran con fuentes; no confundir con validación formal de certificado.

## 17.4 Currículo

Mantener dos niveles de selección:

```text
Secciones (proyectos, internas, extracurriculares, credenciales, etc.)
  → ítems específicos elegibles dentro de cada sección
```

Un DRAFT no es elegible. Proyecto solo si cumple política de visibilidad/backing curricular de la especificación actual; interna solo `CONFIRMED`; credencial externa solo `CORROBORATED` cuando se etiqueta como verificada. Preview, PDF con disclaimers y sin datos inventados. No incluir automáticamente TODAS las experiencias.

---

# 18. UX/UI GLOBAL SIN REDISEÑO DESTRUCTIVO

La última nota pide que la aplicación sea más agradable visualmente. No basta con “hacerlo bonito”: hay defectos concretos.

Aplicar donde haya gap:

- Jerarquía clara: título, propósito, formularios y resumen sin saturación.
- Cards con imagen independiente de información crítica; consistencia de altura, truncado y modal legible.
- Selección de áreas con chips agrupados, skills filtradas por área, mostrar conteos y máximo real.
- `Volver`, `Cancelar`, `Guardar borrador`, `Publicar` o `Enviar a revisión` coherentes con estado.
- Valores precargados al editar y feedback inline por campo; no perder selecciones.
- Búsqueda reactiva, filtro, `Limpiar`, ordenamiento, 10 filas por página cuando corresponda.
- Modales estables, no flicker, foco, teclado y `prefers-reduced-motion`.
- Diferencia visual entre `DRAFT`, `PENDING`, `APPROVED`, `PUBLISHED`, `OPEN`, `CLOSED`, `FINISHED`.
- Docente ve `Mis actividades` y `Actividades de la carrera` separados; Director tiene bandeja y filtros; Sociedad no tiene vista Crear redundante.
- Responsive en desktop/tablet/móvil web; móvil Expo estudiante se verifica después del contrato backend.
- NO introducir colores/diseño nuevo que rompan la identidad existente sin propuesta revisable; conservar branding Afinia y accesibilidad.

---

# 19. COSAS VALIDAS SEGÚN AUDITORÍAS QUE HAY QUE PRESERVAR

Estas observaciones son de la auditoría; ejecutar regresiones actuales:

- Invitación/código de activación/TTL/token/cooldown; recovery principal funciona; corregir solo la navegación desde cuenta activa.
- Admin detecta cuenta ya activa y no vuelve a activarla.
- Importador por estudiante/docente y checks de código, sin romper los partial applies arreglados.
- Área principal + secundarias y filtros de skills existentes.
- Activity time start/end recupera fechas correctamente al editar, meeting HTTPS, contacto opcional, responsables persistidos, links apoyo, imagen legacy.
- Activity backend muestra skills en detalles; editor no las hidrata.
- Cierre de inscripción a inicio, FINISHED automático, no inscripción tras cerrar, cancelación con motivo.
- Skill multiárea en UI evita asignación duplicada accidental.
- Interna confirma participación y muestra constancias al estudiante.
- Recursos detectan URL duplicada, buscar, editar/retirar/reactivar y favorito funcionan.
- Biblioteca `Para ti` se alimenta de intereses/objetivos, sin dar puntaje por consulta.
- Proyecto Github encuentra tecnologías en algunos repos; no perder esa integración al arreglarla.
- Contactos aceptados no implican automáticamente pertenencia a equipo.
- CV seleccionable por experiencia concreta.

Si alguno deja de funcionar, reportar REGRESSION; no falsear PASS por ser históricamente correcto.

---

# 20. MATRIZ DE ROLES Y TRANSICIONES A PROBAR

| Origen/actor | DRAFT visible | Para revisión | Edita contenido pre-aprobación | Edita contenido post-aprobación | Operación/Asistencia |
|---|---|---|---|---|---|
| Docente creador | Docente creador | Director al enviar PENDING | Docente | Director; docente no | Docente responsable permitido |
| Sociedad creadora | Creador/miembros autorizados | Director al enviar PENDING | Sociedad autorizada | Director; sociedad no | Responsables sociedad permitidos |
| Director creador | Director creador | no requiere | Director | Director | Responsables autorizados |
| Admin creador | Admin creador | no requiere | Admin | Admin/Director según permiso auditado | Responsables autorizados |
| Docente asignado por autoridad | NO si DRAFT autoridad | nunca envía a revisión | NO modifica contenido material | NO | SÍ desde publicada según scope |
| Estudiante | no DRAFT | no aprueba | no edita actividad | no | solicita, no se autoconfirma |

**Nota:** `PENDING` sí llega a Director en bandeja. `created_by` nunca cambia a Director al aprobar. Admin lectura de auditoría excepcional no debe crear “mis actividades”.

---

# 21. BACKLOG DE AJUSTES CODIFICADO

| ID | Módulo | Acción requerida |
|---|---|---|
| A41-001 | Auth | recuperar desde ACTIVATION ACTIVE lleva a `/recuperar`, sin estado residual |
| A41-002 | UI | quitar textos de implementación como “V3.2” |
| A41-003 | Grids | Categorías order/paginación; Actividades ordenar; Recursos paginación/orden |
| A41-004 | Validación | aulas/lugares: no basura numérica/símbolos, sí `Aula 201` |
| A41-005 | Activities | editar hidrata skills multiárea correctas |
| A41-006 | Activities media | 0..5 imágenes (propuesto), portada/carrusel, card sin overlay ilegible |
| A41-007 | Activities form | DRAFT no exige responsable; publicación sí |
| A41-008 | Activities review | Draft creador privado; PENDING Dirección bandeja; APPROVED lock de contenido |
| A41-009 | Activities scopes | responsable distinto de creator, TeacherScope y semestres consistentes |
| A41-010 | Activities states | guards CLOSED/FINISHED/CANCELLED y hora de inicio válida al publicar |
| A41-011 | Attendance | FINISHED distinto de cierre de asistencia; corrección excepcional auditada |
| A41-012 | Activities UX | tres pestañas internas académicas, internas extracurriculares, externas |
| A41-013 | Activities outcomes | quitar opción redundante de credencial externa esperada sin perder enlace real |
| A41-014 | Resources | validación inline, review Docente, `Para ti`, favorito no señal |
| A41-015 | Recommendations | interés/mejora/ACTIVITY_INTERESTED separados, Guardar sin score, porcentajes honestos |
| A41-016 | Gamification | criterios fijos, bonos temporales, ledger idempotente, bandeja única |
| A41-017 | Gamification UX | retirar retos/recompensas y badges nuevos; trasladar vista de puntos con privacidad |
| A41-018 | Credentials | validation_status separado de backing, providers probados, Admin excepciones |
| A41-019 | Projects | DRAFT flexible; ACTIVE requiere repo y contexto real; editar con revalidación |
| A41-020 | GitHub | mapping language/manifests→skills sin sobreafirmar, manejo fallback/repos ajenos |
| A41-021 | Backing | readiness ≠ CORROBORATED; evidencias independientes y atribución por skill |
| A41-022 | Collaboration | equipo opcional, contactos, miembros precargados, confirmación individual |
| A41-023 | Team members | exclusión del proyecto con razón, notificación sin expulsión del equipo original |
| A41-024 | Project privacy | textos claros, regla Afinia ≠ GitHub |
| A41-025 | Evidence UI | evidencias proyectos/externas/internas separadas sin duplicar |
| A41-026 | Profile/QR | mover configuración pública/QR a perfil privacidad y equipos a colaboración |
| A41-027 | Trajectory | mostrar historial/saldo gamificación con trazabilidad |
| A41-028 | Affinity | V4 sin tags, intereses, gamificación ni claims no corroborados |
| A41-029 | Curriculum | selección secciones + ítems elegibles, transparencia del respaldo |
| A41-030 | Quality | pruebas reales, API security/roles, UI responsive, regresión y docs |

---

# 22. PLAN INCREMENTAL DE BATCHES

**NO lanzar todos los batches de golpe.** Completar uno, revisar resultados y luego siguiente. Si ya fue resuelto, marcar PRESERVE_PASS y omitir cambios.

## BATCH V4.1-0 — Inspección Git, baseline, comparación

Sin código funcional. Inventariar ramas, `git status`, commits, migraciones, contratos, tests actuales; localizar docx/MD; mapear A41-001..030 con estado y pruebas. Emitir:

```text
AUDITORIA_GAP_AFINIA_V4_1.md
PLAN_BATCHES_AFINIA_V4_1.md
```

No hacer resets; no levantar DB desde cero si no se pidió.

## BATCH V4.1-1 — Activación, validaciones, grids y UX básica

A41-001..004. Solo correcciones localizadas; separar frontend/backend checks. Pruebas de `forgot password`, ramas de navegación, grid count/order, aulas válidas/invalidas, regresiones de activación.

## BATCH V4.1-2 — Formulario de actividad e imágenes

A41-005..007. Recuperar skill chips persistidas, múltiples imágenes con backwards compatibility, corregir card y detalles; responsable opcional DRAFT, obligatorio publicar. Pruebas crear→editar→refrescar y upload 0/1/3/5, tamaño/tipo MIME, permisos.

## BATCH V4.1-3 — Estados, aprobación, ownership, tipos

A41-008..010, A41-012..013. Matriz de roles, DRAFT/PENDING/APPROVED, semestres, tabs internas/externas, guards de fecha/cupo, edit lock. Contratos y DB no destructivos. Pruebas negativas APIs con actores distintos.

## BATCH V4.1-4 — Asistencia y derivados

A41-011. Regularización pos-FINISHED sin reversión libre, `Cerrar asistencia`, excepción auditada, sincronización de trayectoria, constancias, affinity snapshots y ledger de puntos. Concurrencia y idempotencia.

## BATCH V4.1-5 — Recursos y biblioteca

A41-014. Validación create/edit, reviewer, scopes, búsqueda, paginación, Para ti, favoritos sin feedback. Aceptación TeacherScope y Director revisa.

## BATCH V4.1-6 — Recomendaciones y privacidad declarativa

A41-015. 4 preferencias, activity interested vs save, idempotencia/deshacer, explicaciones y privacidad. NO afectar Affinity.

## BATCH V4.1-7 — Gamificación simplificada

A41-016..017, A41-027. Criterios/ledger/extra de temporada, revisión por Dirección, ocultar Retos/Recompensas, histórico preservado, vista top Docente limitada scope, puntaje/historia personal. No crear badges nuevos si V4.1 los retiró.

## BATCH V4.1-8 — Certificados externos

A41-018. `validation_status`, extraction, QR decoder/OCR, provider adapters reales o explícitamente inconclusos, fraud mismatches y manual fallback sin inventar veracidad. Test fixtures legítimos/controlados, rate limits, SSRF.

## BATCH V4.1-9 — Proyectos: borrador, edición y readiness

A41-019. Repo no exigido para DRAFT, sí para ACTIVE; editar y revalidar; fecha/inputs; checklist de publicación; estado no auto-CORROBORATED. Test proyectos individuales y sin repo.

## BATCH V4.1-10 — GitHub, catálogo y evidencias

A41-020..021. Adapters GitHub, languages/manifests, dedupe/sugerencias/normalización, repos ajenos/privados y fallos de red; resolver mapping con DB sin sumar skills automáticas. Backing semántico y atribución individual.

## BATCH V4.1-11 — Equipos y confirmaciones

A41-022..023. Contacto individual vs equipo preexistente, combobox con búsqueda, precarga, excluir proyecto con motivo y aviso, confirmación individual de roles/contribución, protección de pertenencia a equipo. Tests negativos.

## BATCH V4.1-12 — Privacidad y vistas de evidencias/colaboración

A41-024..026. Etiquetas de visibilidad, rutas QR/perfil, tabs de credenciales y evidencias sin duplicar backend; mobile Student impact report.

## BATCH V4.1-13 — Afinidad, trayectoria, currículo

A41-028..029 y checklist de A41-027. No alterar fórmula V4 si ya es correcta; corregir entradas/backing incorrectas; CV secciones+ítems; privacy/visibility. Solo migraciones si se prueban necesarias.

## BATCH V4.1-14 — QA integral, seguridad y documentación

A41-030. Compilar shared/API/web, tests unit/integration/E2E reales, DB migrations no destructivas, rutas HTTP negativas, CORS cookies/sesiones, SMTP, GitHub API fallback, verificación de proveedores, seguridad de uploads/URLs, conflictos de branch, mobile/Expo. Actualizar Swagger, `.env.example`, runbook, UML/casos de uso/documento de grado en trabajos coordinados; no alterar tesis automáticamente sin solicitud. Retirar UI obsoleta, documentar pendientes.

---

# 23. PRUEBAS ESPECÍFICAS DE ACEPTACIÓN

## 23.1 Áreas / habilidades en actividades

```text
Actividad conceptual IA: área=IA, skills=[]
→ se guarda / publica si otros requisitos válidos
→ no inventa Python/Machine Learning

Actividad BD+Redes: skills MongoDB solo en BD
→ Redes sigue siendo área válida general
→ Affinity solo procesa experiencia y área según reglas del motor, sin inventar skill
```

## 23.2 Áreas/skills en proyecto

```text
DRAFT title="Proyecto X", sin repo
→ guardar PASS
→ publicar NO PERMITIDO

Proyecto activo:
Áreas: BD+Web
Skills: BD→MongoDB, Web→React
Repo público válido
Contribuciones verificadas según caso
→ readiness puede PASS
→ backing permanece según señales, no por readiness
```

## 23.3 Activity Admin + docente responsable

```text
Admin DRAFT, asigna Docente Carlos
→ solo Admin lo ve en panel operativo
→ Docente no ve, no puede forzar publicación
Admin PUBLISHED
→ Docente autorizado puede operación, no editar contenido material
```

## 23.4 Activity Docente/Sociedad + revisión

```text
Docente DRAFT
→ Director no ve en gestión ordinaria/bandeja
Docente SUBMIT
→ Director ve en PENDING, no 'creada por mí'
Director APPROVED
→ creador no edita material; sigue operativo donde corresponde
```

## 23.5 Fecha y asistencia

```text
Publicar actividad nueva con inicio ayer
→ rechazar, error inline/API claro
Guardar DRAFT con fecha futura aún no elegida
→ permitir

Evento llega a FINISHED por reloj
→ responsable registra pendientes y confirma
→ NO puede retirar libremente una confirmación previa consolidada
→ Cerrar asistencia congela; excepción Director/Admin auditable
```

## 23.6 Repo ajeno y claim dudoso

```text
Estudiante vincula repo de otro autor (público)
→ GitHub devuelve languages/manifests
→ no se afirma automáticamente participación/autoría
→ no CORROBORATED sin evidencia atribuible
```

## 23.7 Mapping GitHub

```text
Repo tiene requirements.txt: fastapi
→ sugerir skill FastAPI si existe; evidence 'manifest'
→ no agregar Django ni auto-crear skill global

Usuario declara PostgreSQL sin señal
→ DECLARED; no marcar FALSE
```

## 23.8 Proyecto equipo

```text
Elegir equipo 4 integrantes
→ precarga 4 posibles integrantes
→ creador excluye 1 CON motivo
→ no borra membresía del equipo original
→ notificación controlada al excluido
→ otros 3 confirman rol/skills personales
→ ACTIVE condicionado a checklist/confirmaciones
```

## 23.9 Certificado con QR falso

```text
Documento dice estudiante A
URL individual oficial dice B
→ mismatch, FLAGGED/REJECTED controlado

QR solo lleva a página genérica de curso
→ no AUTO_VERIFIED

Admin revisa documento sin fuente independiente
→ registra revisión, no CORROBORATED por apariencia
```

## 23.10 Gamificación y Top

```text
Docente propone criterio de proyecto de alumno en scope
→ Director aprueba
→ +puntos una vez
→ historial visible solo al estudiante/roles autorizados
→ Top docente NO incluye estudiante fuera de TeacherScope
```

## 23.11 Currículo

```text
Estudiante elige Proyectos: A sí/B no; internas X sí/Y no; externas Z sí
→ export incluye solo A, X, Z elegibles
→ sin reclamar skills no respaldadas como verificadas
```

---

# 24. RIESGOS, CONTRADICCIONES CERRADAS Y NO-ALCANCE

| Tensión del Word | Riesgo de seguirla literalmente | Cierre defendible V4.1 |
|---|---|---|
| “exigir una skill por área siempre” | charlas generales inventan skills | solo proyecto ACTIVE; actividades pueden ser generales |
| “repo requerido para crear proyecto” | rompe DRAFT incompleto | requerir repo para ACTIVE; DRAFT libre |
| “Github detecta skill = tecnología validada” | dependencia no prueba uso ni autoría | señal + elección + evidencia atribuida + backing real |
| “el proyecto cumple requisitos = corroborado” | confunde completitud con evidencia | readiness separado de backing |
| “cerrar asistencia al FINISHED” | impide confirmar asistencia tras clase | cierre de acta independiente |
| “director no ve hasta APROBADO” | imposibilita aprobar | ve solo en PENDING bandeja revisión, no DRAFT |
| “Admin/Director casi mismo rol” | autoridad académica y soporte se mezclan | permisos distintos y auditoría |
| “patrocinio=actividad EXTERNAL” | confunde organizador con sponsor | ejes character/origin separados |
| “quitar external credential outcome” | pierde link de curso mixto | quitar opción redundante sin borrar evidencia/relaciones |
| “no más retos ni insignias” | borrado de datos históricos | retirar creación/vistas, conservar históricos |
| “top de estudiantes” | ranking público/privacidad | vista privada por TeacherScope / roles autorizados |
| “certificado revisado manualmente” | Admin aprueba falsificaciones visuales | revisión sin fuente deja SUPPORTED/INCONCLUSIVE |
| “90 % verdadero” | métrica inventada sin dataset | estados explicables, sin porcentaje de autenticidad |
| “página abre en 200 = certificado válido” | enlaza solo curso/otra persona | verificar emisor, titular, logro, ID, vigencia |
| “skills en todo el proyecto” | alguien atribuye habilidades de un miembro a otro | contexto persona/área/skill + confirmación individual |
| “mover QR” | dos configuraciones con estados distintos | una fuente de verdad en Perfil/Privacidad |

**NO ALCANCE:** chat, NLP/ML que atribuya dominio, crawler para inferir backend, ejecutar repositorio ajeno, OCR como autenticador, clasificar falsedad por ausencia de señal, universal credential API, multicuenta por pestaña, retos creados libremente, badges nuevos, puntos por clicks, puntuación de afinidad por puntos o intereses, refactor destructivo de módulos correctos, reescribir tesis automáticamente.

---

# 25. REPORTE OBLIGATORIO POR BATCH

```text
BATCH: V4.1-N
RAMA REAL:
COMMIT BASE:
ESTADO GIT ANTES:

GAPS verificados (A41-xxx):
Preservado (sin tocar):
Archivos realmente modificados:
Migraciones:

Pruebas y comandos ejecutados:
- ... → PASS/FAIL con salida resumida
- ...

Fallo → causa → corrección → regresión:
Efecto backend/frontend/mobile:
Seguridad/permisos:
Cambios de contrato/documentación:
Regresiones:
Pendientes:
Riesgos:
Commit en español propuesto:
```

La descripción del commit/push que se proponga al usuario debe estar en español y no atribuir verificaciones o tests no ejecutados. No hacer `push` sin confirmar el flujo establecido en repo/skill Git.

---


# ANEXO A. ESPECIFICACIONES V4 CONSERVADAS Y COMPLETADAS (NORMATIVO)

Este anexo incorpora el nivel de detalle operativo del MD V4 del 14/10 que el V4.1 resumía. **Solo aplica donde NO contradice las decisiones posteriores del cuerpo V4.1.** Las reglas siguientes son parte integral de este documento; no enviar el viejo MD como segundo archivo.

## A.1 Invariantes de arquitectura y valores del proyecto

- Afinia complementa SIU/Teams; no sustituye registros académicos oficiales, emite notas, califica, ni certifica competencias universalmente. Cinco actores, móvil solo estudiante.
- El estudiante declara intereses y áreas de mejora; **no se certifica a sí mismo habilidades** ni altera sus datos académicos institucionales. Afinidad es trayectoria respaldada, nunca una prueba de dominio, nota o empleabilidad.
- Una experiencia incorpora `area_id` y `skill_id` contextual donde exista. Skill multiárea no produce varios aportes por duplicación accidental. Tags, aliases y texto libre son para catálogo/búsqueda/ayuda de clasificación, nunca puntos de Afinidad.
- `DECLARED` no significa “mentiroso”; `SUPPORTED` no equivale a autenticado. Ni OCR ni imagen ni sugerencia de IA conceden autoría por sí mismos.
- Puntos, badges históricos, extras y ranking privado de gamificación quedan **fuera del cálculo de Afinidad/Support**. Recursos y favoritos también.
- Preferir bajas lógicas, historial e idempotencia. No eliminar migraciones, reportes ni datos previos de usuarios por simplificar interfaces.

## A.2 Identidad, activación, recuperación y mensajes internos

- En `/activar/solicitar`, si API identifica cuenta `ACTIVE`, conservar mensaje correcto; enlace `Olvidé mi contraseña` debe navegar a `/recuperar` y restaurar el formulario de recuperación, sin dejar estado de activación anterior. Backend existente de recuperación no debe reescribirse salvo defecto reproducido.
- Mantener temporalmente `Tengo el enlace` mientras despliegue real del link no esté confirmado; no eliminar por parecer redundante. Verificar enlace/token/expiración y no exponer secretos en el navegador/logs.
- Ninguna pantalla, formulario, correo o ayuda para usuario final debe mostrar “según V3.2”, nombres internos de batches o pruebas. Conservar textos útiles, idioma claro y estados consistentes.
- No alterar la política de activación/recuperación, límites de reenvío, JWT/cookies/CORS/SMTP sin prueba de una regresión relacionada.

## A.3 Tabla/listado de datos compartida (UX)

Cuando el listado tenga suficientes registros, usar **10 filas por página** como estándar (no diez elementos en cards obligatoriamente), navegación anterior/siguiente, total, página, búsqueda reactiva y orden asc/desc sobre columnas que realmente sean ordenables. Deben coexistir sin errores con filtros y `Limpiar`. Reiniciar/clamp página al cambiar filtro y comprobar totales. Integrar en componentes existentes en lugar de crear un framework nuevo.

Focos V4:

| Vista | No perder | Añadir/ajustar si falta |
|---|---|---|
| Categorías | crear, editar, baja lógica, búsqueda | order, paginación, validación |
| Oportunidades | filtros de estado, tabla de gestión, paginación existente | ordenar, actor/origen, responsables |
| Recursos admin | búsqueda, URL única, baja/reactivación, edición | 10/page, orden, errores inline |
| Proyectos/estudiantes/otros | funcionalidad previa | solo verificar consistencia; no tocar indiscriminadamente |

Errores de validación de formulario deben mostrarse **debajo del campo correspondiente**; toast/alert solo para estado global, red, éxito o una acción no asociada a campo. UI y API aplican mismas reglas principales.

## A.4 Campos de lugares, actividades y recursos

### Aula/lugar presencial o híbrido

Válidos: `Aula 201`, `Laboratorio B-12`, `Auditorio Principal`, `Torre Académica, piso 4`.

Inválidos: solo espacios, `123123`, `!@#$%^&`, `____`.

Reglas: `trim`, longitud acotada, al menos una letra Unicode, números y puntuación razonables; evitar regex ASCII que rechace nombres con acento/ñ. Solo exigir aula física según modalidad que lo necesita. URLs de reunión cuando existan deben usar esquema válido y protección contra URLs peligrosas.

### Recurso académico

- **Título:** obligatorio, contenido significativo; no solo números, signos o espacios.
- **Quién publica:** obligatorio, texto significativo; no concluir que esta persona sea responsable operativo de actividad.
- **URL:** obligatoria `http/https`, única según política normalizada, controles backend SSRF cuando el servidor la consulta; no usar `includes` para verificar dominio ni permitir IP locales/resolución privada a través de redirecciones.
- **Tipo:** enum/lista controlada. **Descripción:** opcional pero significativa si viene. **Imagen:** opcional y validar tipo/tamaño. **Áreas/skills:** etiquetas de clasificación y de recomendación, no respaldo.
- Aplicar create y edit coherentemente; conservar búsqueda en vivo, favoritos, retirar/reactivar.

### Actividad

- `start_at`, `end_at` y modalidad se guardan y recuperan sin deriva de huso horario; `end_at > start_at` cuando están presentes; no permitir publicar actividad futura con `start_at` pasado.
- `DRAFT` admite incompletos, incluida ausencia de responsable; verificar condiciones completas al **publicar o enviar a revisión**, no al guardar borrador.
- Contactos y links de apoyo opcionales; responsable obligatorio al publicar según tipo y rol. Semestres sin selección significan toda la carrera **solo cuando la autoridad y los responsables realmente pueden abarcarla**; no agrandar TeacherScope mediante asignación global.
- Cap de áreas según límite realmente implementado (6 en auditoría). En charlas genéricas un área puede no tener habilidad específica; proyecto ACTIVE sí requiere un contexto tecnológico por área declarada.

## A.5 Imágenes: contrato de compatibilidad

- Imágenes opcionales en actividades, máximo propuesto de **5** con límites MIME, tamaño por archivo y total configurados tras auditar la infraestructura. **0, 1 y varias** deben funcionar.
- Primera imagen es portada; detalle expone carrusel accesible con teclado, foco y controles; compatibilidad de `image_url`/propiedad legada. No romper clientes móviles que solo esperan portada: contrato puede entregar `cover_image` + `images[]` si API actual lo permite con migración segura.
- Subida/edición/quitar una foto no elimina las demás accidentalmente. Archivos huérfanos se limpian solo conforme política existente, no con eliminación inmediata ciega.
- Card: imagen en región independiente; título, fechas, modalidad, áreas, skills y CTA fuera de imagen, para legibilidad con fotos blancas u oscuras. Evitar bajar opacidad global indiscriminadamente.

## A.6 Actividades: revisión, operación, guards y ejemplos

Estados de ciclo de vida: `DRAFT`, `PUBLISHED`, `OPEN`, `CLOSED`, `FINISHED`, `CANCELLED` (verificar enums reales antes de añadir). Revisión distinta: `NOT_REQUIRED`, `PENDING`, `OBSERVED`, `APPROVED`, `REJECTED` o equivalentes actuales.

- `DRAFT` privado para quien crea; Admin con facultad técnica auditada puede inspeccionar sin apropiárselo. Docente responsable de una actividad creada por Director/Admin **no** la recibe en sus vistas mientras siga DRAFT.
- Docente/Sociedad: enviar a revisión crea `PENDING` accesible a Dirección en **bandeja de revisiones**. No se vuelve público ni cuenta como “actividad de Dirección”. Tras aprobar, contenido material se congela para creador; operación autorizada sigue disponible a responsable.
- Director/Admin: `NOT_REQUIRED` en creación propia; al publicar ya revisado por autoridad, responsable Docente/Sociedad no tiene botón para volver a enviar a revisión. Director es autoridad académica ordinaria, Admin soporte excepcional, no intercambiables.
- Responsable puede gestionar inscritos, asistencia, estados operativos si autorizado y fechas/alcance compatibles, **no** cambiar título, origen, clasificación, reglas de resultado ni autoría material sin permiso de autoridad.
- Si hay docentes responsables: para elegir semestres mostrables usar **unión de scopes** como límite máximo cubierto, sin extender el scope de cada docente. Excepción autoridad de carrera completa: resolver operadores válidos antes de publicar y no esconder estudiantes que ningún responsable puede gestionar.
- `CLOSED` por inicio pasado: no reabrir a OPEN hasta editar/programar fecha futura válida. Mensaje específico de la causa; `CLOSED` por cupo lleno requiere liberar/ampliar cupo. `FINISHED` es terminal para evento: para otra edición/repetición duplicar evento nuevo sin asistentes anteriores. Finalización anticipada si evento acabó antes requiere confirmación; `CANCELLED` exige motivo y aviso a inscritos.
- **IMPORTANTE SOBRE ASISTENCIA:** este antiguo V4 inicialmente proponía lock automático al FINISHED. Queda **SUPERADO por sección 5 de V4.1**: FINISHED del evento y cierre de acta de asistencia son independientes; se pueden confirmar pendientes tras FINISHED; no retirar libremente CONFIRMED consolidado. Todo downstream (constancia, afinidad, puntos, trayectoria) se revisa en corrección excepcional auditada.

## A.7 Participación, constancias y trayectoria

- Estudiante puede interesarse/guardar/inscribirse/darse de baja según política; **no puede confirmar por sí mismo asistencia**.
- Responsable valida participación real; `CONFIRMED` es único origen de participación interna que alimenta trayectoria/afinidad. `ABSENT`, `INTERESTED`, `REGISTERED` no se transforman en experiencia validada.
- Constancia interna solo cuando actividad/resultados lo permiten y responsable/entidad institucional la emite. Se adjunta automáticamente al estudiante correspondiente cuando cumple, sin que él la suba de nuevo. **Actividad + constancia no se suman como dos experiencias distintas**.
- Tras evento `FINISHED`, responsable puede todavía resolver asistencias PENDIENTES hasta `attendance_status=LOCKED`. `CONFIRMED` consolidado no puede pasarse libremente a `ABSENT`; Director/Admin con motivo y trazabilidad puede hacer rectificación y reconciliar efectos, no borrar historial.

## A.8 Certificados externos: campos, procedencia y estados detallados

Procesamiento soportado **solo en capacidades demostradas**:

```text
PDF texto          → extraer texto e hyperlinks
PDF escaneado      → OCR, QR decodificador independiente
PNG/JPEG           → OCR + QR decoder
DOCX               → texto/hyperlinks/QR si adaptador probado
URL individual     → consulta de emisor verificable si permitido
formato no soportado → UNSUPPORTED_FORMAT (sin marcar fraude)
```

Dos dimensiones:

```text
validation_status: PENDING | AUTO_VERIFIED | MANUAL_REVIEW_REQUIRED |
                   MANUALLY_VERIFIED | INCONCLUSIVE | REJECTED
backing:           DECLARED | SUPPORTED | CORROBORATED | FLAGGED
```

Mapeo **condicionado** (no una función incondicional de estado):

| Situación | validation_status | Backing máximo defendible |
|---|---|---|
| QR/URL solo abre curso general | MANUAL_REVIEW_REQUIRED / INCONCLUSIVE | SUPPORTED si documento coherente |
| Documento sin URL/QR verificable | MANUAL_REVIEW_REQUIRED | DECLARED/SUPPORTED según evidencia |
| Proveedor emite resultado individual auténtico, titular/curso/ID válidos, sin contradicción | AUTO_VERIFIED | CORROBORATED |
| Revisión humana con prueba **externa independiente** suficiente | MANUALLY_VERIFIED | CORROBORATED |
| Revisor humano solo considera plausible documento | INCONCLUSIVE (revisión registrada) | SUPPORTED; NO VERIFICADO |
| Fuente oficial individual identifica titular diferente o rechazo comprobado | REJECTED y motivo | FLAGGED |
| Fallo de red, timeout, CAPTCHA, titular oculto | INCONCLUSIVE / MANUAL_REVIEW_REQUIRED | NO asumir falso ni verificado |

Metadatos mínimos de auditoría donde corresponda: `reviewed_by`, `reviewed_at`, `review_reason`, `decision`, `validation_method`, proveedor/URL normalizada, campos comparados, `checked_at`, errores/sin secretos y estado de disponibilidad de prueba. No registrar credenciales privadas completas en logs.

Adaptadores candidatos: Credly/IBM (`credly.com/badges/<id>`), Cisco Networking Academy (páginas individuales verificables cuando accesibles), Huawei (QR/código/canal oficial) y Generic fallback. Un validador genérico puede leer y orientar pero **nunca auto-CORROBORATE** por imagen/QR de página genérica. **No dar por hecha ninguna integración** hasta probar fuente oficial real, acceso, estabilidad, licencia, límites, privacidad y posibilidad de extraer titular. No automatizar CAPTCHA ni prometer una API universal gratuita.

## A.9 Recomendador: estados, razones y efectos por interacción

Mantenemos CUATRO dimensiones declarativas (sin asignar competencia):

```text
interested_areas     → interés personal, potencialmente visible por decisión del estudiante
interested_skills    → interés personal, potencialmente visible
improvement_areas    → meta de mejora, siempre PRIVADA
improvement_skills   → meta de mejora, siempre PRIVADA
```

Pesos ilustrativos de V4, aplicar una sola vez si la implementación actual los adopta y documenta:

```text
INTEREST_DECLARED    +10
IMPROVEMENT_DECLARED  +5
ACTIVITY_INTERESTED   +5
```

Son pesos internos del recomendador, no gamificación ni Afinidad. En `ACTIVITY_INTERESTED`, tomar área/skill **realmente clasificadas en la actividad**, asociar señal al estudiante y actividad, hacer toggle/deshacer idempotente, sin cambiar preferencias declaradas, y con cap documentado si se usan scores 0..100. Inscripción no se interpreta como retroalimentación permanente.

**Guardar/Quitar guardado** de actividad y recursos no altera ninguna fuente de recomendación, afinidad ni puntos; es solo acceso rápido. **Para ti** consume las preferencias, orientación y `Me interesa` de actividades; un recurso solo aporta sus metadatos como target, no como feedback.

UI debe distinguir «Coincide con tus intereses» y «Coincide con lo que quieres mejorar»; puede mostrar coincidencias parciales con nombres de áreas/skills. No imprimir «100% recomendado» por coincidir una skill ni tratar el porcentaje como probabilidad, dominio o éxito. Si aparece porcentaje, precisar su denominador y fórmula real; de otro modo mostrar razones textuales.

Pestañas de actividades a conservar/adaptar sin duplicar flujos: `Para ti`, `Todas`, `Interesadas`, `Inscritas`, `Guardadas`, `Historial` según capacidades reales. `Guardar` y `Me interesa` son acciones distintas; biblioteca: `Todos los recursos`, `Para ti`, `Mis favoritos`.

## A.10 Gamificación: reglas implementables sin crear otro subsistema

- Objetivo: reconocer hechos validados, incentivar participación y mostrar historial; NO calificar, acreditar destreza ni modificar Afinidad/Support.
- Triggers finitos en código según los que existan y se necesiten: `ACTIVITY_PARTICIPATION_CONFIRMED`, `PROJECT_CORROBORATED`, `TEAM_COLLABORATION_CONFIRMED`, `TRAJECTORY_MILESTONE`, `EXTERNAL_CREDENTIAL_CORROBORATED`, `RESOURCE_MILESTONE_MANUAL`. No implementar triggers hipotéticos sin un caso y evidencia de origen.
- Criterio configurado por Admin/Director sobre trigger permitido: `name`, `description`, `trigger_type`, `points`, `active`, `valid_from?`, `valid_until?`, `area_id?`. Campo `badge_id?` de V4 queda **HISTÓRICO/LEGADO**: V4.1 excluye crear nuevos badges; no borrar asociaciones ya existentes.
- En actividad: reemplazar puntos libres por **criterio de gamificación opcional** compatible con confirmación; Docente/Sociedad proponen durante revisión de actividad, Director valida en mismo acto. Autoridad que crea puede asociar directamente, sin revisión propia.
- En proyecto: estudiante no puede concederse puntos; Docente autorizado dentro de TeacherScope propone sobre proyecto visible con backing adecuado; Director ve título, dueño, áreas/skills, repo, evidencia/estado, criterio solicitado y motivos, decide y registra. Checklist ayuda al revisor pero no autoaprueba.
- En recurso: click/guardar nunca equivale a leer/aprender; **si no hay hito externamente comprobable, no dar puntos**. Si existe, propuesta humana controlada `RESOURCE_MILESTONE_MANUAL` con revisión de Dirección; no crear estado de finalización automático del recurso.
- Bonus temporal por área: `area_id`, trigger habilitado, puntos adicionales, vigencia inicio/fin, activo, creador; zona horaria consistente; no acumular repetidamente la misma fuente por recargas.
- Idempotencia lógica `(student_id, criterion_id, source_type, source_id)` con constraint/transacción adecuados; registrar reversos auditables cuando hechos son corregidos. No borrado silencioso de premios.
- Estudiante visualiza saldo e historial: «+10 Participación confirmada — Taller X», «+20 Proyecto corroborado — Y», «+5 Bono temporada». La tabla de puntos que antes estaba en Retos y Recompensas se reubica en Gamificación y se restringe a Docente en sus semestres y a autoridad competente, sin ranking público.
- Eliminar del menú y de la creación normal Retos/Recompensas, «Criterios antiguos» e insignias nuevas. **Preservar históricos** aunque UI desaparezca; no destruir otras funciones.

## A.11 Catálogo vs procedencia de habilidades

- Área general con `code`, tags semánticas opcionales, descripción; skill con code, name, alias(s) de la **misma skill**, área principal y secundarias (si ya existe o se implementó). No intentar identificar un área por `alias=aws` en una habilidad no relacionada usando substring.
- Para actividades conceptuales, **no obligar a inventar skill por cada área**. Cuando una actividad sea de Redes de nivel general, puede existir área sin habilidad; el motor no adjudica skills no trabajadas.
- Para proyecto tecnológico `ACTIVE`, cada área declarada necesita una skill contextual defendible. Si GitHub detecta una dependencia, sugerirla desde catálogo con procedencia; no crear nueva skill global ni afirmar autoría. Si la tecnología no está catalogada, estudiante puede declarar/solicitar revisión sin acreditación automática; el camino de validación para publicar debe definirse en el backend actual sin forzar categoría falsa.
- `DETECTED_SIGNAL` (lenguaje/manifest), `STUDENT_CLAIM` (uso alegado por estudiante) y `BACKING_DECISION` son registros/etapas conceptualmente distintos: no confundir detección con corroboración.

## A.12 Listas de funciones comprobadas por usuario: preservar, pero volver a verificar

No romper las funcionalidades que la auditoría indicaba correctas: detección de cuenta activa; recuperación principal; edición de fechas; reunión URL HTTPS; campos de responsables/contactos; áreas y habilidades persistidas en detalle API; imagen actual; semestres válidos; contacto/enlaces de apoyo opcionales; `end_at > start_at`; cierre automático; no inscripción al cerrar; FINISHED automático; skill multiárea sin selección duplicada; cancelar con motivo; responsable gestiona asistencia; constancia interna visible; bloqueo de URL duplicada; recurso editable/retirable/reactivable; búsqueda reactiva de biblioteca y favoritos. Esto es **observación previa**, no PASS automático en rama actual.

---

# ANEXO B. MATRIZ ÚNICA DE REGRESIÓN CONSOLIDADA (NORMATIVO)

Estas pruebas son adicionales a los escenarios 23.1–23.11 del cuerpo principal; ejecutar solo las que apliquen al batch y documentar resultado real. Las entradas marcadas FAIL deben contener causa/solución antes de retestar; no fingir PASS.

| ID | Caso mínimo reproducible | Resultado exigido |
|---|---|---|
| B01 | Ingresar cuenta ACTIVE en pedir activación, clic «Olvidé mi contraseña» | Ruta `/recuperar`, formulario correcto, estado previo limpiado |
| B02 | Categorías 25 registros, buscar/ordenar/paginar | 10/page, total consistente, filtros y navegación sin duplicados |
| B03 | Aula presencial `Aula 201`, `Laboratorio B-12` | Aceptadas |
| B04 | Aula presencial `123123`, `!@#$`, espacios | Error inline; backend también rechaza |
| B05 | Crear actividad `BD, Redes`, skills `MongoDB, Linux`, guardar→editar | Mantiene ambas áreas y chips de skills correctas sin duplicar |
| B06 | Actividad conceptual `IA` sin skill concreta | Publicación posible con demás requisitos; no inventa skill |
| B07 | Skill multiárea elegida ya en un contexto | No se añade dos veces accidentalmente ni duplica Afinidad |
| B08 | Actividad con 0/1/3/5 imágenes, modificar una | Conserva imágenes previas, portada y carrusel; valida límite/tamaño |
| B09 | Card con imagen blanca y con imagen oscura | Texto, fecha y CTA legibles fuera de imagen |
| B10 | Admin crea DRAFT sin responsable | Guarda; visible solo creador/soporte auditado; no Docente asignado |
| B11 | Admin publica y asigna Docente con scope 1–4 | Docente la ve operativamente; no edita contenido material ni envía revisión |
| B12 | Docente crea DRAFT, luego SUBMIT | Director NO ve draft; SÍ lo ve en bandeja PENDING, no como dueño |
| B13 | Docente A scope 1–4, Docente B scope 5–6 responsables | Semestres elegibles conforme cobertura, cada docente solo su propio scope |
| B14 | Reabrir CLOSED con fecha de inicio ya pasada | Denegado + mensaje corregir fecha |
| B15 | Reabrir CLOSED por cupo completo | Denegado + mensaje ampliar/liberar cupo |
| B16 | Duplicar FINISHED | Nueva actividad sin participantes/constancias históricas |
| B17 | Event auto-FINISHED con inscripciones pendientes | Responsable registra confirmaciones durante regularización |
| B18 | Participación CONFIRMED con constancia; responsable intenta ABSENT libre | Bloqueado; rectificación de Director/Admin requiere motivo/audit/reversos |
| B19 | Cerrar asistencia tras regularización | Bloqueo ordinario, historial preservado |
| B20 | Crear recurso `Título=123456`, `Quién publica=!!!!`, URL inválida | Errores inline y validación backend |
| B21 | Crear recurso URL ya existente | Duplicado rechazado; edit y retirar/reactivar no se dañan |
| B22 | Recurso añadido a Favoritos o abierto | No cambia preferencia declarada/recomendador/Afinidad/Support/puntos |
| B23 | Biblioteca `Para ti` en perfil con intereses y mejora | Filtra por área/skill con explicación; no atribuye dominio |
| B24 | Activity `Me interesa`: clic repetido, reload, quitar | Una sola señal, reversible; Guardar no modifica motor |
| B25 | Perfil intereses y objetivos de mejora | Intereses conforme privacidad; mejora nunca pública; no afinidad |
| B26 | Gamificación: mismo evento confirmación 3 veces | Una recompensa idempotente; historial/ranking privado correctos |
| B27 | Proyecto visible, Docente dentro de scope propone criterio | Director aprueba/rechaza; estudiante no se autopremia |
| B28 | Recurso se abre y se guarda sin evidencia de lectura | Cero puntos y cero experiencia |
| B29 | Certificado QR llega a curso genérico | NO `AUTO_VERIFIED`; estado inconcluso/revisión |
| B30 | Documento a nombre A; verificador individual oficial muestra B | Mismatch motivado, FLAGGED/REJECTED sin inventar evidencia |
| B31 | Fuente oficial inaccesible / CAPTCHA / proveedor no soportado | Estado inconcluso/revisión, no falso `CORROBORATED` |
| B32 | Admin marca manualmente certificado “parece genuino” sin fuente externa | No puede llamarse `MANUALLY_VERIFIED` fuerte/`CORROBORATED` |
| B33 | Proyecto individual DRAFT sin repo | Guardar y editar; publicar bloqueado con checklist explicable |
| B34 | Repo con FastAPI en manifest y MongoDB sin evidencia de autoría | Sugerencias con provenance, no dominio ni CORROBORATED automático |
| B35 | Repo ajeno público | Se detectan señales, pero no se atribuye automáticamente al estudiante |
| B36 | Equipo preexistente 4 miembros, excluir 1 del proyecto con motivo | Equipo original no cambia; historial y notificación controlada |
| B37 | Tres integrantes confirman roles individualmente | Publicación según checklist; sin autopermiso del creador sobre otros |
| B38 | Currículo marca proyectos A/no B, actividades X/no Y, externa Z | Exporta solo ítems seleccionados elegibles y afirmaciones honestas |
| B39 | Invitar/activar/correo/recuperar | Sin filtración de tokens; plantillas y rutas siguen funcionales |
| B40 | Usuario no autorizado intenta endpoints de actividad/recurso/proyecto | 401/403 según contrato; filtrar en backend además de la UI |

---

# ANEXO C. MATRIZ DE ABSORCIÓN DEL ANTIGUO V4 (CONTROL DE COBERTURA)

El MD V4 original contenía **secciones 0–71** y un plan V4-0..V4-12. Ese plan quedó **reemplazado** por el ÚNICO plan V4.1-0..V4.1-14. La tabla siguiente demuestra dónde se conserva el contenido antiguo sin incorporar órdenes V4 superadas.

| Secciones antiguas V4 | Materia | Ubicación contractual consolidada |
|---|---|---|
| 0–4 | propósito, Git, BATCH0, principios | secciones 0, 2, 19, 22, A.1 |
| 5–11 | credenciales, OCR, QR, proveedores, Admin | sección 6 y A.8; prevalecen verificadores reales y prueba externa |
| 12–14 | recuperación, Tengo enlace, textos | secciones 21–23 y A.2 |
| 15–16 | grids, aula/lugar | sección 4.7, 18, A.3–A.4 |
| 17–19 | skill edición, multiárea, 6 áreas | sección 3, 4.7, A.11 |
| 20–22 | imágenes y cards | sección 4.7, A.5 |
| 23–27 | lifecycle, owner/responsable, draft, scope | sección 4, A.6 |
| 28–29 | asistencia, constancias | sección 5, A.7; **V4 lock al FINISHED sustituido** |
| 30–36 | validaciones recursos, grilla, biblioteca, docentes | sección 7, A.3–A.4 |
| 37–47 | gamificación, triggers, incentivos, retirada de retos | sección 9, A.10; **badges nuevos fuera, historial preservado** |
| 48–59 | intereses, mejoras, feedback Me interesa, favoritos, Para ti | sección 8, A.9 |
| 60–63 | inline, funcionalidades anteriores, defectos, cambios | secciones 1, 19, 21 y A.12 |
| 64 | batches V4-0..V4-12 | reemplazados por sección 22 V4.1-0..V4.1-14; no ejecutar dos planes |
| 65 | pruebas de regresión anteriores | sección 23 + anexo B |
| 66–71 | no-alcance, commits, checklist y resumen | secciones 24–27, anexo D |

**Cambios expresamente SUPERADOS y que Claude no debe reimplantar:** rama fija `feature/afinia-v4-cierre` como rama de trabajo nuevo; lock de asistencia al instante FINISHED; publicación que obliga skill en toda área incluso charla; generar `CORROBORATED` por solo OCR/manual visual; badges nuevos; ranking público; `100 % recomendado` por coincidencia parcial; duplicar recursos/puntos por click; guardar proyectos sin repo prohibido; repetir checklist V4 anterior y V4.1 a la vez.

---

# ANEXO D. DEFINICIÓN DE CIERRE ÚNICA Y REPORTE DE TRABAJO

## D.1 Checklist final de aceptación

**Ningún punto puede darse como cumplido sin evidencia en la rama de trabajo real.**

- [ ] Se confirmó base Git con commits pertinentes; ramas `feature/afinia-v3-2` y V4 conservadas, sin reset destructivo.
- [ ] Solo se ejecutó el plan V4.1 y el BATCH0 auditó antes de programar.
- [ ] Activación recupera correctamente; ninguna vista muestra nombres internos V3.2.
- [ ] Búsqueda/orden/paginación y errores inline correctos sin quitar datos existentes.
- [ ] Actividad guarda/edita contexto area-skill; conceptual sin skills específicas válida.
- [ ] Media 0–5 imágenes compatible con portada anterior y accesible en detalle.
- [ ] DRAFT privado, PENDING visible solo en revisión, APPROVED congela contenido material; creador no se sustituye al aprobar.
- [ ] Rol Director es académico, Admin operativo; responsables no editan material ajeno ni reenvían revisión.
- [ ] Semestres muestran alcance real y TeacherScope individual se respeta.
- [ ] CLOSED por fecha/cupo muestra causa; FINISHED terminal como evento; CANCELLED tiene motivo/notificación.
- [ ] FINISHED no bloquea registro inicial pendiente; cierre de acta separado; revisión excepcional no destruye historial.
- [ ] Interna confirma participación/constancias por responsable; nada de doble cómputo.
- [ ] Recursos siguen buscables/favoritos, admiten revisión Docente, Para ti, validaciones coherentes y cero afinidad por interacción.
- [ ] Interés y mejora separados; ACTIVITY_INTERESTED idempotente/reversible; Guardar sin feedback; razones del recomendador transparentes.
- [ ] Gamificación por criterios fijos, sin puntos manuales libres ni retos/badges nuevos; con ledger y extras temporales.
- [ ] Puntaje total e historial visibles al dueño; top accesible solo por roles/scope.
- [ ] Certificaciones aceptan evidencias y estados separados; QR genérico no autentica; revisión humana necesita prueba independiente para llamarse verificada.
- [ ] Validadores Credly/Cisco/Huawei implementados solo hasta nivel probado; errores no se presentan como falsedad.
- [ ] Proyectos DRAFT editables sin repo; ACTIVE con repo accesible, evidencias mínimas y claims contextualizadas.
- [ ] GitHub lenguajes/manifests → catálogo con procedencia; repo de tercero no prueba participación; backing no sube por completar formulario.
- [ ] Equipo existente se precarga sin inventar contribuciones; exclusiones con motivo/aviso; confirmaciones individuales; no se destruye grupo original.
- [ ] Privacidad Afinia ≠ GitHub; `Mi perfil/Privacidad` concentra QR, `Colaboración` concentra contactos/equipos.
- [ ] Evidencias de proyectos, credenciales externas e internas se muestran sin duplicar fuente de datos.
- [ ] Afinidad independiente de tags, IA, recursos, puntos, favorites e intereses; no se presentan dominios inventados.
- [ ] Currículo permite escoger secciones e ítems concretos elegibles; export sin experiencias no verificadas rotuladas como certificadas.
- [ ] Contratos API/shared/web/mobile afectados, autorizaciones y migraciones no destructivas revisadas.
- [ ] Pruebas batch y QA final ejecutados, fallos documentados, build/tests con resultados reales, documentación actualizada.

## D.2 Regla de entregas y commits

Por cada batch, usar **el reporte de sección 25** (rama, commit base, archivos, migraciones, PASS/FAIL, cause→fix→regression). No escribir commits en inglés por inercia; proponer descripciones **en español**, concisas, reflejando cambios reales y tests ejecutados. Respetar skill Git/AGENTS.md si están presentes. No hacer push no autorizado, ni crear nueva arquitectura/archivos por costumbre. Tras un batch, esperar validación antes de continuar.

## D.3 Definición documental de “terminado”

Este MD está **consolidado** como contrato de trabajo, pero NO significa que Afinia esté implementada ni que los fixes sean PASS. Claude debe comparar contra el repositorio, clasificar los 30 hallazgos A41, ejecutar los batches autorizados y mostrar evidencia antes de declararlos cerrados.

---

# 26. MENSAJE INICIAL PARA CLAUDE CODE / CODEX — ARCHIVO ÚNICO

> Lee **COMPLETO ESTE ÚNICO ARCHIVO** `AFINIA_CONTRATO_UNICO_CONSOLIDADO_V4_V4_1_CLAUDE_2026-10-16.md`, incluidos anexos A–D. Los ajustes V4 y V4.1 están fusionados y reconciliados aquí; **no necesitas otro MD V4**. Revisa el estado actual del repositorio y su documentación disponible para confirmar implementaciones, no para sustituir estas reglas. **No toques código funcional todavía.** Comprueba Git/ramas/commits y crea una nueva rama segura desde la base realmente más avanzada cuando esté comprobado que no hay cambios sin guardar. Ejecuta ÚNICAMENTE el BATCH V4.1-0 y entrega `AUDITORIA_GAP_AFINIA_V4_1.md` y `PLAN_BATCHES_AFINIA_V4_1.md` con pruebas y rutas exactas. No inventes tests ni integraciones de proveedores. Espera autorización antes del primer batch de código.

---

# 27. CONCLUSIÓN CONTRACTUAL

Afinia funciona cuando puede diferenciar las cosas que el estudiante **declara** (intereses, metas, skills), las que **señala la tecnología** (repo, manifest, URL, OCR), las que **la institución constata** (asistencia/constancias/revisión), y las que **un emisor externo permite verificar** (credencial de persona específica). Esa diferencia define BACKING, perfil, afinidad y elegibilidad curricular, sin inventar certeza. El sistema debe reutilizar sus relaciones de Área–Skill–Contexto–Fuente, ayudar al usuario a completar lo faltante y preservar el trabajo ya correcto en cada batch.

**FIN — AFINIA V4.1**
