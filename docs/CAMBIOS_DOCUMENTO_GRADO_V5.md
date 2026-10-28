# Cambios para alinear el documento de grado con el cierre V5

**Documento revisado:** `Documento_Proyecto_Grado_Valdivia_Mollo_v2 (1).docx`.

**El `.docx` no se modificó.** El contrato V5 (§18, BATCH V5-17) pide entregar esta lista al autor y no editar la tesis. Antes de editarla a mano, guarde otra copia con la fecha del día.

**Cómo se usa:**
- Se aplica **después** de las guías V2, V3, V3.2 y V4.1 (`CAMBIOS_DOCUMENTO_GRADO_*.md`), que siguen vigentes.
- Aquí está solo lo que agrega o corrige el cierre V5.
- Misma convención: **Quitar** / **Cambiar** / **Agregar**.

---

## 1. Resumen de diferencias con la guía V4.1

| Tema | Guía V4.1 | Software tras el cierre V5 |
|---|---|---|
| Constancias | El responsable confirma y, si está habilitada, se emite la constancia interna | **Afinia no emite constancias ni certificados.** La asistencia queda como «registro del responsable» en la trayectoria. Las constancias anteriores se conservan como historia. Un documento de la institución se registra **con su emisor real**. |
| Inscripción | «Confirmar participación» admitía y registraba asistencia a la vez | **Tres pasos distintos:** solicitar, ser admitido y asistir. La admisión respeta el cupo de forma atómica, y la asistencia solo se registra **después de que empieza** el evento, hasta 7 días después. Rechazar una solicitud exige motivo y no es una ausencia. Una actividad abierta y sin cupo admite al instante. |
| Formulario de actividades | Interna y externa en el mismo formulario | **Tres pestañas sin mezcla de campos.** Al cambiar de pestaña se pide confirmación. Una fecha «ahora» se acepta con tolerancia de un minuto. Las externas validan su modalidad (presencial con lugar; virtual con enlace). Un borrador propio sin referencias **se puede borrar**; lo publicado se cancela, nunca se borra. |
| Vista docente | Lista de actividades | **Tarjetas de 6 por página**, con filtro por responsable y favoritos. El botón Editar aparece **solo** si el docente puede editar; si solo opera la actividad, la ve en lectura. |
| Apellidos | Un solo campo `lastName` | **Primer apellido obligatorio y segundo opcional.** Los apellidos compuestos anteriores **no se parten por suposición**: quedan «por separar» hasta que Administración los corrija. El padrón CSV tiene las columnas nuevas y acepta la plantilla antigua. |
| Recursos | Solo enlace | **Enlace, archivo o ambos** (PDF, PNG, JPG o WEBP; un video va por enlace). Dirección elige **toda la carrera o semestres específicos**. «Curso externo» pasa a «**Curso de autoaprendizaje (sin acreditación automática)**». |
| Revisión docente | Todo lo del docente pasa por Dirección | **REQUIRE_REVIEW por defecto.** Dirección puede conceder a un docente **autonomía por módulo** (recursos o puntos), con motivo, y revocarla. Lo que el docente hace con ella queda en un **historial de acciones directas**. Las **actividades siguen siempre con revisión** (decisión institucional pendiente, ND-03). La sociedad científica no hereda estas excepciones. |
| Gamificación | Criterios por hecho, más propuestas de proyecto | **Solo tres familias:** participación confirmada, reconocimiento docente de un proyecto y **recurso completado** (un docente da fe con sustento). Colaboración aceptada, hito de trayectoria y primer proyecto respaldado quedan retirados, con sus eventos pasados intactos. Cada punto guarda **criterio, quién lo otorgó y quién lo aprobó**. «Puntos de estudiantes» muestra el historial por estudiante con estado: aplicado, revertido o pendiente. |
| Proyectos: contribución | El integrante elegía tecnologías de todo el catálogo | **Solo tecnologías del proyecto.** Un integrante puede tener **varios roles**. El proyecto puede nacer **individual, de un equipo o con contactos invitados**; nadie es integrante hasta aceptar. |
| Proyectos: alta | Repositorio en el formulario | **«Analizar repositorio» es opcional** y va primero: sugiere tecnologías con su fuente, y el estudiante decide cuáles incluir. El borrador se guarda sin GitHub. Con la cuota agotada, el análisis queda «inconcluso» y no se borra nada. |
| GitHub y pedidos | Un pedido de tecnología se «vinculaba» a otra | Las señales se cruzan con la **revisión vigente** del repositorio. Un pedido se resuelve como **alias** (otro nombre de la misma tecnología) o como **tecnología nueva** con su área. FastAPI no es un alias de Python. |
| Visibilidad | «Además, …» | «Solo yo y los integrantes», «También mi equipo», «También docentes autorizados», «**Toda la comunidad Afinia**», «Público por enlace». La ACL no cambia. |
| Galería | No existía | **«Proyectos de la carrera»** para toda la comunidad con sesión: solo proyectos activos y compartidos, de 6 en 6, con filtros. Cada proyecto admite **de 0 a 5 imágenes de muestra** con portada, que **no son evidencias**. |
| Afinidad | Desglose con motivo y familia | Cada contribución enlaza a su **fuente real** (actividad, proyecto o credencial), y solo si quien mira puede abrirla. Puntos, recursos y roles nunca son fuente de afinidad. |
| Credenciales | «Verificada» | Afinia **informa el resultado de la consulta al proveedor en una fecha**; no certifica. Un QR que lleva a la página del curso no identifica al titular. |
| Resumen de trayectoria | Descargo de no oficialidad | Además, el resumen explica que las participaciones son el **registro del responsable**, y que solo se incluyen en este resumen informativo (ND-02). |

---

## 2. Capítulo II

### 2.1.1 Actores

- **Docente:**
  - **Cambiar** «propone recursos y puntos; Dirección decide» por «propone recursos y puntos; Dirección decide, salvo que le haya concedido autonomía en ese módulo».
  - **Agregar** «da fe, con sustento, de que un estudiante de su alcance completó un recurso».
- **Director de carrera:**
  - **Agregar** «concede y revoca autonomía docente por módulo, con motivo, y ve el historial de acciones directas».
  - **Agregar** «elige toda la carrera o semestres específicos para los recursos».
- **Administración:**
  - **Agregar** «resuelve los pedidos de tecnologías como alias o como tecnología nueva con su área».
  - **Agregar** «corrige los apellidos que quedaron por separar».
  - **Agregar** «no concede autonomía docente: esa autoridad es académica».
- **Sociedad científica:** **Agregar** «no hereda las excepciones de revisión de los docentes».

### 2.1.2 Reglas de negocio (agregar)

1. **Afinia no emite certificados ni constancias.** Registra la participación como dato del responsable.
2. Solicitar, ser admitido y asistir son tres estados distintos. La asistencia se registra desde que empieza el evento y hasta 7 días después.
3. Un recurso necesita al menos una fuente real: un enlace o un archivo.
4. Sin una excepción vigente de Dirección, lo que propone un docente se revisa. Las actividades siempre se revisan.
5. Solo tres familias de puntos. Los puntos no cambian la afinidad ni el respaldo de un proyecto.
6. Quien contribuye a un proyecto solo declara tecnologías del proyecto.
7. El análisis de repositorio es opcional, no guarda nada por su cuenta y no atribuye uso personal.
8. Las imágenes de muestra de un proyecto se ven solo donde el proyecto se ve.

### 2.2 Requisitos

- **Cambiar** el requisito de constancias internas por «registro de participación confirmada por el responsable, sin emisión de documentos».
- **Agregar** como funcionales:
  - autonomía docente por módulo;
  - historial de puntos por estudiante;
  - galería «Proyectos de la carrera»;
  - imágenes de muestra;
  - análisis opcional de repositorio;
  - recursos con archivo y alcance por semestre;
  - enlaces a las fuentes de la afinidad.

---

## 3. Capítulo III (diseño)

### 3.1 Modelo de datos (agregar; todas las migraciones son aditivas)

| Migración | Qué agrega |
|---|---|
| `V5AdmissionAttendance` | Estado `rejected` y `decision_reason` en las inscripciones. |
| `V5ActivityFavorites` | Favoritos de actividades del personal. |
| `V5Surnames` | Columnas de primer y segundo apellido en `users`. |
| `V5SkillRequestResolution` | Resolución `alias` o `new_skill` de los pedidos de tecnologías. |
| `V5MemberRoles` | `project_members.roles[]`. |
| `V5ResourceFile` | `learning_resources.url` nullable, más `file_id` con CHECK «enlace o archivo». |
| `V5ApprovalPolicies` | Tabla `approval_policies` (módulo, docente, motivo, quién y cuándo concede y revoca), más `policy_id` en recursos y propuestas. |
| `V5GamificationFamilies` | Disparador `recurso_completado_atestiguado`; `criterion_id`, `awarded_by` y `approved_by` en el historial; propuestas sobre recursos; criterio opcional en recursos. |
| `V5ProjectImages` | Tabla `project_images` (0 a 5, una portada). |

### 3.2 Diagramas (actualizar)

- **Ciclo de la inscripción:** `registered` → `accepted` / `rejected` → `confirmed` / `absent`. La admisión y la asistencia van en pasos distintos, con el cupo bloqueado al admitir.
- **Alta de un proyecto:**
  1. título y repositorio;
  2. «Analizar repositorio» (opcional);
  3. sugerencias aceptadas o descartadas;
  4. áreas y tecnologías;
  5. borrador;
  6. activación.
- **Autonomía docente:** propuesta → (con excepción) aplicada e historial / (sin excepción) bandeja de Dirección.

### 3.3 Interfaz (agregar capturas)

- «Autonomía docente» (Dirección).
- «Proyectos de la carrera».
- Imágenes del proyecto.
- «Analizar repositorio».
- «Ver historial» en «Puntos de estudiantes».
- Formulario de recursos con «Enlace o archivo» y «Para quién es».

---

## 4. Capítulo IV (pruebas)

- **Agregar** la suite `scripts/e2e-v5.mjs`, con una sección por batch del contrato. Cada comprobación cita su escenario (A01…I07).
- **Agregar** la prueba Jest `afinia-v5-gobernanza.spec.ts`, junto a `afinia-no-certifica.spec.ts`.
- **Actualizar** la tabla de resultados con la corrida final del cierre V5 y el detalle de lo ejecutado (ver `docs/V5_QA.md`).
- **Explicar** que algunas comprobaciones de etapas anteriores se adaptaron porque la V5 cambia la regla, sin relajar ninguna:
  - V3.19.6 y B9.16: una colaboración aceptada ya no suma puntos.
  - V41.5.4: un docente fuera de sus semestres recibe 403.
  - B6.31: una tecnología ajena al proyecto se rechaza.

---

## 5. Decisiones que el documento debe nombrar como pendientes institucionales

| ID | Pregunta | Qué hace el software mientras tanto |
|---|---|---|
| ND-02 | ¿Las participaciones sin documento pueden ir a un currículo formal? | Solo en el «Resumen de trayectoria» informativo, con su aviso. |
| ND-03 | ¿Dirección puede eximir de revisión a docentes también en actividades? | No: las actividades siguen con revisión obligatoria. |
| ND-04 | ¿Hay que coordinar criterios entre paralelos A/B/C? | No se crea un módulo de malla ni de paralelos. |

**Decisión técnica (nómbrela en limitaciones):** los recursos aceptan PDF, PNG, JPG y WEBP. DOCX, PPTX, TXT y MD no se aceptan, porque el puerto de subida reconoce el tipo por la firma del archivo y esos formatos ampliarían la superficie de todas las subidas. Un documento de Office se publica exportado a PDF o por enlace.
