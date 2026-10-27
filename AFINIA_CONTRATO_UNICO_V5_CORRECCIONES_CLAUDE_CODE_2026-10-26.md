# AFINIA — CONTRATO ÚNICO DE CIERRE V5 PARA CLAUDE CODE / CODEX
## Auditoría `corregir v5.docx` (69 páginas) + reglas vigentes de V4/V4.1 + decisiones técnicas conservadoras

**Corte documental:** 26/10/2026.  
**Base documental incorporada:** `AFINIA_CONTRATO_UNICO_CONSOLIDADO_V4_V4_1_CLAUDE_2026-10-16.md` (leído y conciliado para este contrato), auditorías V1–V4.1 y `corregir v5.docx` (69 páginas).  
**Objeto:** ejecutar únicamente correcciones funcionales y UX todavía necesarias sobre el código real. **No es una orden de reconstruir el sistema.**  
**Destino:** Claude Code / Codex trabajando en el repositorio local AfiniaC.  
**Prioridad máxima:** preservar ramas, datos, funcionalidades correctas y afirmaciones de autenticidad técnicamente defendibles.

> **LECTURA OBLIGATORIA:** Este documento es **autosuficiente para los ajustes V5**. Reemplaza como plan operativo los MD anteriores y NO se ejecutan sus batches por segunda vez. Los antecedentes V4/V4.1 se reflejan aquí como invariantes y regresiones. Si una implementación existente contradice V5, primero documentar GAP y corregir solo esa contradicción. Si falta una decisión institucional, **NO inventar autorización, certificación ni capacidad verificadora**.

> **ADVERTENCIA IMPORTANTE SOBRE EL WORD:** La auditoría contiene pruebas visuales, propuestas, preguntas y aclaraciones posteriores. Las últimas páginas —especialmente 31–33 y 68–69— corrigen interpretaciones anteriores. La duda sobre la validez de constancias y «currículo» NO está zanjada por Dirección; no tratarla como una autorización concedida. La instrucción confirmada por el tutor es proteger al producto de atribuirse funciones certificadoras.

---

# 0. CONTRATO DE EJECUCIÓN SEGURO

## 0.1 PRIMERO Git; nunca trabajar sobre la rama protegida

No presuponer que la última rama es `feature/afinia-v3-2`, `feature/afinia-v4-cierre` o `feature/afinia-v4-1-cierre`. Determinar **qué rama contiene los commits válidos más recientes**.

```powershell
git branch --show-current
git status --short
git branch -a
git log -8 --oneline --decorate
```

Si el árbol de trabajo no está limpio, **detenerse y presentar la lista exacta de archivos**: no perder avances. Comprobar relación entre ramas con `git merge-base` / `git log base..HEAD` cuando sea necesario; nunca asumir que la rama de nombre mayor contiene todo.

Después de identificar la base verificada y comprobar que está limpia, crear rama exclusiva **`feature/afinia-v5-cierre`** desde ella. Si ya existe, **NO sobrescribir ni reutilizar a ciegas**; informar y proponer nombre alternativo seguro. No hacer `pull` que genere merge inesperado; si se necesita actualizar remoto, `fetch` y comparar, luego `pull --ff-only` cuando corresponda.

Prohibiciones sin autorización explícita:

```text
git reset --hard
git clean -fdx
git restore .
git push --force
modificar, commitear o reescribir historia de ramas base
eliminar migraciones existentes
borrar .env, node_modules, uploads, colas, volúmenes Docker o datos reales
npm audit fix --force / upgrades masivos por costumbre
redefinir arquitectura o tablas funcionales sin evidencia de necesidad
```

NO abrir navegadores, procesos masivos ni aplicaciones externas en bucle para inspección si el usuario no autorizó; evitar saturar el equipo. No lanzar crawler completo, importaciones masivas ni pruebas destructivas como efecto secundario de una auditoría.

## 0.2 BATCH V5-0 = auditoría; no cambios funcionales

Entregables:

```text
AUDITORIA_GAP_AFINIA_V5.md
PLAN_BATCHES_AFINIA_V5.md
```

Por cada hallazgo:

```text
PRESERVE_PASS       evidencia de regresión ejecutada
IMPLEMENTED_UNTESTED existe, sin prueba actual
DEFECT_CONFIRMED    reproducido con causa probable/confirmada
PARTIAL             flujo parcialmente correcto
MISSING             falta
REGRESSION          antes funcionaba, ahora no
OBSOLETE            retirar de modo compatible
NEEDS_DECISION      requiere decisión institucional/usuario
BLOCKED_EXTERNAL    proveedor/verificador inaccesible o no documentado
```

Un hallazgo del Word **no equivale a un bug comprobado hoy**. Registrar `FAIL → causa → fix → regression PASS`. Informar ruta y archivos concretos antes de editar. **Esperar luz verde del usuario tras BATCH 0** para iniciar código.

## 0.3 Precedencia de decisiones

```text
(1) Este V5 — decisiones de cierre y límites de seguridad
(2) Últimas aclaraciones de corregir v5, especialmente páginas 31–33, 68–69
(3) Resto de corregir v5 (hechos observados, dudas, propuestas)
(4) Contrato único consolidado V4 + V4.1
(5) V3.2 / V3.1 y auditorías precedentes
(6) Estado del repositorio: evidencia de implementación, no autorización de negocio
```

Si hay conflicto entre dos instrucciones del V5, aplicar el **principio de menor afirmación verificadora, menor privilegio y preservación histórica**, y reportar la decisión en el GAP. NO ejecutar cambios que impliquen aval institucional sin autorización explícita.

## 0.4 Qué significa «no romper nada»

- Mantener las funciones ya validadas; editar mínimamente componentes/servicios actuales.
- No crear nuevos archivos, DTO, servicios, migraciones o columnas porque sí.
- Compartir contratos backend y tests antes de reestructurar frontend/mobile.
- No alterar por accidente contratos públicos, seed, Auth, SMTP, CORS, rutas o API.
- No reutilizar funciones de certificar para mostrar solo participación sin separar semántica.
- No mezclar scores de Afinidad, Recomendación y Gamificación.
- Commits pequeños por batch en rama nueva; no afirmar PASS si no se corrió.

---

# 1. ESTADO REAL DEL NEGOCIO: AFINIA NO CERTIFICA

**Esta es la aclaración que más pesa en las últimas páginas del V5.** Afinia es una plataforma de **registro, organización, visualización y consulta de trayectoria estudiantil**, no un emisor de certificaciones, una autoridad académica ni un verificador universal de currículos.

| Concepto | Afirmación permitida | Afirmación prohibida |
|---|---|---|
| Inscripción | «Se inscribió/solicitó participar» | «Asistió» |
| Admisión | «El responsable aceptó su inscripción» | «Completó el evento» |
| Asistencia confirmada | «La asistencia fue confirmada por el responsable en Afinia» | «Afinia certifica esta competencia» |
| Documento institucional | «Documento atribuido a la institución emisora, con procedencia registrada» | «Afinia otorgó certificación oficial» |
| Credencial externa | «Fuente oficial verificó esta credencial y su titular», **solo si se comprobó** | «Todo OCR/QR valida autenticidad» |
| Repo GitHub | «Señal técnica detectada en este repositorio» | «El estudiante domina/usó personalmente esa tecnología» |
| Curriculum / resumen | «Resumen generado con registros de trayectoria declarados y respaldados según su fuente» | «Currículum profesional 100 % certificado» |

## 1.1 Cambiar enfoque, no destruir información

Recomendación de cierre compatible:

- Nombre primario de producto: **«Mi trayectoria» / «Resumen de trayectoria estudiantil»**.
- Conservar un **exportador configurable** tipo «Resumen para prácticas/pasantías» y, si se mantiene la palabra currículo, **«Currículo estudiantil (borrador informativo)»** con leyenda visible; no CV oficial validado por Afinia.
- Mostrar **fuente, fecha, actor que confirmó, respaldo y alcance** de cada experiencia.
- Permitir elegir secciones e ítems específicos; no inventar información y no ocultar que es autodeclarada.
- No expedir documentos que aparenten tener firma/sello institucional inexistente. PDFs del estudiante no tienen carácter de certificado oficial por generarse en Afinia.
- La Universidad/Dirección **puede** emitir documentos por sus propias competencias, pero registrar ese documento no convierte a Afinia en emisor.
- **Decisión institucional pendiente:** si Dirección permite incluir constancias emitidas por ella o participaciones sin documento en un currículo formal. Mientras no se confirme: presentar en trayectoria y permitir resumen informativo claramente rotulado; **no etiquetar como «certificación oficial» ni poner sello de aprobación automática**.

**NO eliminar de forma destructiva el generador de currículo ni documentos existentes** solo por este cambio conceptual. Auditar primero dónde se usa «certificado», «constancia», «logro verificado», «CV validado» y corregir copy/permiso/propósito con migración no destructiva cuando sea indispensable.

## 1.2 Política institucional pendiente, no programar como si estuviera concedida

Preguntas a validar fuera de código:

1. ¿Dirección autoriza documentos institucionales de asistencia y cómo se emiten/firmarían?
2. ¿Se permite exportar participaciones confirmadas sin documento en un currículo profesional, o solo en un resumen de trayectoria?
3. ¿La revisión de actividades de Docentes/Sociedad sigue siendo obligatoria para todos o Dirección puede dar excepciones por docente/módulo?
4. ¿Qué regla de coordinación exige entre paralelos A/B/C para incentivos docentes?

Hasta que se confirme, adoptar política de **mínimo privilegio** y no habilitar emisión de nuevos documentos oficiales por la aplicación.

---

# 2. FLUJO COMPLETO DE AFINIA — INVARIANTES DE LAS VERSIONES PREVIAS

```text
ADMIN importa/provisiona usuario institucional (university_code único; semestre institucional)
  ↓
ACTIVACIÓN (enlace/código) → contraseña → sesión por rol
  ↓
ONBOARDING del estudiante:
  perfil base → áreas de interés → áreas que quiere mejorar
  → tecnologías de interés → tecnologías a mejorar
  → disponibilidad → privacidad → orientación opcional
  ↓
RECOMENDACIONES (preferencias y contexto; no dominio/afinidad como eje principal)
  ↓
CATÁLOGO:
  Actividades académicas / extracurriculares / oportunidades externas / Biblioteca
  ↓
PARTICIPACIÓN:
  solicitud → admisión → asistencia/ausencia
  ↓
TRAYECTORIA: participaciones confirmadas y su fuente, sin certificación automática
  + CREDENCIALES EXTERNAS: fuente oficial individual o revisión con límites
  + PROYECTOS: DRAFT → GitHub/skills contextuales/evidencias/miembros → ACTIVE
  ↓
AFINIDAD (experiencias permitidas y versionadas) / SUPPORT (calidad del respaldo)
  ↓
COLABORACIÓN y equipos / perfil público opt-in / QR
  ↓
RESUMEN DE TRAYECTORIA ESTUDIANTIL seleccionable + exportación informativa
  + GAMIFICACIÓN: puntos por hechos autorizados, sin efecto sobre afinidad
```

Cinco actores exactamente:

```text
STUDENT
TEACHER
CAREER_DIRECTOR
SCIENTIFIC_SOCIETY
ADMIN
```

Web para los cinco, mobile solo STUDENT. Afinia complementa SIU/Teams, no los sustituye. No crear sexto rol para estudiante-contacto, responsable, revisor o coordinador.

**Identidad:** `university_code` no es score. El estudiante no modifica su semestre ni datos institucionales. Cuentas `PENDING_ACTIVATION / ACTIVE / SUSPENDED / INACTIVE` según contratos existentes; suspendido sin acceso. Asegurar cookies/refresh/CORS/SMTP sin regresiones. No reintroducir chat. Proyectos/evidencias privados según alcance, URLs con autorización, archivos protegidos y trazabilidad.

---

# 3. AUDITORÍA V5 POR VISTA — MATRIZ DE CAMBIOS

| Ref. | Vista / flujo | Hallazgo del Word | Tratamiento requerido |
|---|---|---|---|
| V5-01 | Docente → Actividades de la carrera | Vista pobre respecto a estudiante | Cards consistentes, detalle, favoritos, sin botón «Me interesa» docente, paginación 6 |
| V5-02 | Actividades estudiante/docente | Falta filtro de responsable | Buscador por responsable con filtro de permisos |
| V5-03 | Docente → Afinidad de estudiante | Fuentes no enlazables | Enlaces a experiencia con autorización, no recursos genéricos |
| V5-04 | Admin → Usuarios | Apellidos mezclados | Primer apellido obligatorio; segundo opcional, migración compatible |
| V5-05 | Admin → Padrón | CSV con apellidos mezclados | Plantillas/parsers/importación versionadas; partial apply sin regresión |
| V5-06 | Actividades → duplicar | Borradores copiados generan basura | Borrar solo DRAFT sin referencias; jamás borrado destructivo publicado |
| V5-07 | Actividades → fechas | Rechaza misma fecha por segundos | Validación con granularidad minuto y tolerancia segura, no aceptar eventos ya terminados |
| V5-08 | Actividades → responsables/semestres | Selector poco claro | Cascada responsable → semestres por scope, sin ampliar permisos individuales |
| V5-09 | Actividad de autoridad → docente | Edición no autorizada visible hasta guardar | Ocultar/deshabilitar acción material desde el principio, backend sigue protegiendo |
| V5-10 | Actividades → origen | Cambiar origen deja campos de externa en interna | Tres tipos/pestañas estables, formularios tipados y reset de campos incompatibles |
| V5-11 | Externas → validaciones | Campos inválidos aceptados | Igualar validación de modalidad, URL, aula y campos textuales |
| V5-12 | Inscripción/asistencia | «Confirmar participación» mezcla dos procesos | Separar aceptación/admisión de asistencia; cupo y estados claros |
| V5-13 | Recursos | Falta carga de archivo | URL o archivo seguro; streaming/objeto, sin almacenar binario en PostgreSQL |
| V5-14 | Recursos → catálogo | «Curso externo» mezcla oportunidades | Distinguir material sin certificación de actividad externa con credencial |
| V5-15 | Dirección → permisos docentes | Aprobación excesiva | Política configurable por módulo y docente, segura y auditada |
| V5-16 | Dirección → constancias | Ambigüedad acreditativa | Participación separada de documento institucional; no emisión automática Afinia |
| V5-17 | Recursos → alcance | Director/Admin sin selector semestre | Selector opcional para scope explícito; docente limitado |
| V5-18 | Gamificación | Criterios docentes revisados siempre | Aprobar solo cuando policy lo exija; por defecto restringido, explícito |
| V5-19 | Gamificación / puntos | No se sabe quién otorgó por qué | Detalle por estudiante, origen, emisor, criterios, fecha, saldo |
| V5-20 | Proyecto → contribución | Selector de todas las tecnologías | Solo skills del proyecto, filtros por áreas/roles, confirmación individual |
| V5-21 | Proyecto → visibilidad | Cinco opciones con «Además» confusas | Nombres claros, backend ACL preservado, opt-in público explícito |
| V5-22 | Proyecto → excluir | JS `alert/prompt` | Modal propio, motivo, confirmación, evento auditado |
| V5-23 | Proyecto → alta | Skill antes de GitHub | Repo-first asistido **sin bloquear DRAFT** y claims manuales etiquetados |
| V5-24 | Proyecto → scan | Sugerencia aceptada sigue «no declarada» | Reconciliar estado y UI; sin confundir detected con autenticidad |
| V5-25 | Admin → Pedidos de tecnologías | FastAPI vinculado a Python sin crear skill | Distinguir alias real y nueva tecnología; asignar área(s); actualizar pedidos y catálogo |
| V5-26 | Proyecto → galería | Falta imágenes de muestra | Hasta 5 imágenes opt-in, carrusel, permisos y validación segura |
| V5-27 | Estudiante → Proyectos de carrera | Sin galería exploratoria | Cards/galería de proyectos ACTIVE visibles para comunidad, con filtros |
| V5-28 | Proyecto → equipo/contactos | No reutiliza miembros elegibles | Equipo O contactos como origen, luego cada miembro confirma |
| V5-29 | Proyecto → roles | Roles no relacionados a áreas/skills | Catálogo configurable de roles como ayuda UX; no certificado ni bloqueo arbitrario |
| V5-30 | Gamificación → triggers | Demasiados criterios | Solo 3 familias principales de eventos controlados; opcionales |
| V5-31 | Plataforma → «currículum» | Riesgo señalado por tutor | Reposicionar como resumen de trayectoria, no documento oficial autenticado |

Las observaciones verificadas por el usuario (por ejemplo, borrador de Admin invisible al Docente hasta publicar; recursos docentes limitados por semestre; constancias no emitidas automáticamente en ciertos casos; GitHub detectó PyMongo) se tratarán como **«reportado correcto → ejecutar regresión»**, no como orden de reimplementar.

---

# 4. CATÁLOGO: ÁREAS, TECNOLOGÍAS, TAGS, ALIAS Y ROLES

## 4.1 Semántica congelada

```text
Área      = dominio macro (Bases de Datos, Redes, Desarrollo Web...)
Tecnología/Skill = elemento específico (MongoDB, SQL, Python, FastAPI, Pytest...)
Alias     = nombre ALTERNATIVO de la MISMA tecnología (postgres/postgresql)
Tag área  = metadata semántica de clasificador administrativo
Código    = identificador estable, no evidencia
Rol       = función de colaboración, no prueba de tecnología usada
```

Nombre visible «Tecnologías» puede reemplazar «Habilidades» sin renombrar destructivamente tablas o contratos backend. No confundir tecnología con nivel de dominio, interés o resultado de Afinidad.

Una tecnología tiene área principal y 0..N secundarias. Al usarla en una experiencia se selecciona **área contextual**, y no se suma automáticamente a todas las áreas relacionadas.

Áreas y tags NO puntúan; aliases NO puntúan; roles NO puntúan. No «incluir Redis automáticamente» por aparecer una etiqueta de Cloud.

## 4.2 Selector de contexto dependiente

```text
Proyecto/Actividad/Recursos: seleccionar área(s)
  → mostrar tecnologías asociadas que existan en catálogo
  → permitir seleccionar 0..N en actividad general y recurso
  → proyecto ACTIVE: ≥1 tecnología contextual en cada área activa según contrato
```

Actividad general «Introducción a IA» puede tener área IA sin mencionar TensorFlow. No forzar habilidades inventadas para aprobar formularios. Proyecto `DRAFT` no necesita completas las relaciones.

Si skill está relacionada con varias áreas, mostrarla en ambas pero guardar contexto(s) realmente usados; evitar duplicaciones accidentales y doble conteo.

## 4.3 Admin → Pedidos de tecnologías GitHub (defecto V5-25)

**Problema observado en páginas 47–52:** el operador aceptó FastAPI/Pytest como «vincular con Python», recibió aviso «tecnología agregada», pero los nombres no aparecieron como skills del catálogo ni desaparecieron las sugerencias pendientes. Se mezclaron dos operaciones distintas:

```text
A. EXISTING_SKILL_EQUIVALENT
   - Es el MISMO concepto con otro alias/denominación.
   - Ej.: postgres → PostgreSQL.
   - Agregar alias/mapping GitHub al skill existente.
   - NO crear skill nueva.

B. NEW_SKILL
   - Es tecnología diferente.
   - Ej.: FastAPI ≠ Python; Pytest ≠ Python.
   - Crear nueva skill con nombre/código únicos.
   - Elegir área principal obligatoria y secundarias opcionales.
   - Opcional: iniciar flujo de crear nueva área si realmente se necesita.
   - Asociar patrón origen (manifest/dependency) a skill nueva.
```

**NO aceptar FastAPI como alias de Python solo porque FastAPI usa Python.** «Relacionada con» no es «sinónimo». Para Pytest puede elegirse área de Ingeniería de Software / Testing según catálogo real y criterio de Admin, sin inventar una clasificación universal.

Al resolver un pedido:
- actualizar de forma atómica `request_status`, relación con skill nueva/existente, aliases/mappings, bitácora y notificación;
- devolver al estudiante estado cerrado y actualizar sugerencia vía refetch/caché;
- no afirmar «agregada» cuando solo se creó un alias;
- idempotencia ante click doble/requests repetidos;
- si nueva área, workflow Admin → catálogo y regresar al pedido conservando borrador;
- nunca insertar nuevas skills por detección GitHub sin acto explícito de Admin.

## 4.4 Catálogo «Roles de proyecto» — alcance prudente

Propuesta V5: pestañas **Áreas | Tecnologías | Roles de proyecto**. Mantener catálogo existente de roles si ya funciona; agregar **metadata** de relaciones solo si el GAP demuestra que el filtro manual es costoso o incorrecto.

```text
project_role:
  id, code, name, status
  relevant_area_ids[]
  suggested_skill_ids[] (opcional; deben ser compatibles con áreas)
```

Un integrante puede tener **varios roles**, y un rol puede relacionarse con varias áreas/tecnologías. Sin embargo:
- **No imponer que «Backend» prohíbe Python o que «DB Master» obliga a MongoDB**. Las categorías ocupacionales no son equivalencias técnicas exactas y el usuario puede desempeñar tareas cruzadas.
- Priorizar orden/filtro de sugerencias y advertir cuando se selecciona tecnología fuera del rol típico; permitir justificar y conservar la tecnología **si figura en el proyecto**.
- Roles **no generan puntuación ni avalan experiencia**. La contribución y su confirmación son las señales, sin sobreponderar.
- Mantener compatibilidad de roles históricos; no cambiar `role` singular a lista sin plan migratorio y tests.

---

# 5. ACTIVIDADES: TRES PESTAÑAS ESTABLES

## 5.1 Modelo de navegación V5

La auditoría muestra la mezcla de campos cuando se alterna «interna/externa» dentro del mismo formulario. La intención es una UX con **tres vistas diferenciadas**, no tres arquitecturas de base de datos independientes:

```text
[Académicas]     → actividad interna académica
[Extracurriculares] → actividad interna extracurricular
[Externas]      → oportunidad de proveedor externo
```

Cada pestaña presenta su lista/grid de la familia correspondiente y botón «Nueva ...» que abre **formulario tipado por la pestaña**. Retirar del formulario el toggle redundante «Origen: Interna/Externa» que mezclaba schemas/estados; si el modelo DB actual usa origin/type, conservarlo **derivado del tab y validado por backend**, no como campo editable incoherente. Cada formulario inicia su propio estado limpio y valida su tipo.

En un cambio de tab, si el formulario tiene cambios sin guardar, confirmar antes de descartar o preservar borrador local independiente; NO vaciar silenciosamente los datos. No afirmar que el problema se soluciona únicamente «haciendo refresh»: revisar estado React, componentes reutilizados, defaults, DTOs y persistencia. La sesión debe ser robusta ante:

```text
Interna → Externa → Interna
Externa → Interna → Externa
crear → editar → cambiar tab → volver
```

**Resultado interno:** `NONE`, `PARTICIPATION_ONLY`, y **documento emitido por institución solo si formalmente habilitado**. No reintroducir `EXTERNAL_CREDENTIAL_EXPECTED` en un combo interno; la credencial de tercero se gestiona en el flujo externo. La participación confirmada no implica constancia automática.

## 5.2 Separar carácter de categoría

- Carácter: académica / extracurricular / externa.
- Categoría: charla, clase espejo, taller, seminario, hackathon, etc., `applies_to` cuando corresponda.
- Áreas: temas abordados.
- Tecnologías: competencias o herramientas específicas realmente tratadas, si corresponde.
- Patrocinador externo no transforma por sí solo una actividad interna en oportunidad externa.

Reutilizar entidades existentes; tres tabs UI no son 3 tablas nuevas por defecto.

## 5.3 Matriz de roles

| Actor | Crea | Revisión | Opera |
|---|---|---|---|
| Docente | Académica interna / oportunidad externa autorizada por scope | Dirección salvo excepción formal explícita | sus actividades y asignadas publicadas; estudiantes de su scope |
| Sociedad | Extracurricular interna / externa complementaria autorizada | Dirección según política vigente | su propuesta y actividades aprobadas |
| Director | Académica / externa / operaciones de carrera | NOT_REQUIRED en propias | revisión y correcciones excepcionales |
| Admin | Excepcional, operativamente en nombre de responsable | NOT_REQUIRED en propias, **sin fingir autoridad académica** | soporte limitado y auditado |
| Estudiante | No crea actividades institucionales | — | se inscribe/asiste; no autoconfirma |

**Política de aprobación de actividades:** En V5 aparecen dos frases incompatibles («siempre aprobar», y al final «Dirección decide exenciones docentes para actividades/recursos/criterios»). **No asumir automáticamente excepciones para Actividades**. Default: aprobación de Dirección para Docente/Sociedad; habilitar un mecanismo de permiso específico solo si Dirección lo autoriza expresamente y existe auditoría/alcance. Ver sección 9.

## 5.4 Formulario y validación

- Título requerido con contenido significativo y mensajes inline.
- Descripción opcional, no aceptar basura como texto significativo cuando se proporciona.
- Fecha inicio/fin: `end_at > start_at` y manejo correcto de zona horaria Bolivia.
- Modalidad PRESENTIAL: lugar requerido; no meeting URL obligatorio.
- VIRTUAL: meeting URL válida requerida; lugar físico no obligatorio.
- HYBRID: lugar + URL válidas.
- Lugar permite «Aula 201», «Lab B-12», no solo números/símbolos/espacios.
- `resource_links[]`: múltiples URLs http/https válidas y seguras.
- Imagen(es) 0..5 (si ya implementadas, NO recrear): portada y galería; card con texto debajo, no encima de imagen clara.
- Capacidad opcional; limitada y validada.
- Áreas 1..N al publicar; actividades introductorias pueden NO tener skills.
- Responsables requeridos al publicar, no necesariamente al guardar DRAFT.
- Semestres según actor/scope; Admin/Director pueden elegir toda carrera o subconjunto.
- Campo criterio gamificación opcional, nunca puntos libres por alumno.
- En **Externa**, además: proveedor, URL oficial, issuer/domains, patrón o PDF guía opcional; si falta un verificador individual no prometer auto-validación. Validar también modalidad, lugar, enlaces y texto, exactamente como interna.
- No permitir que al regresar de externa a interna queden campos del proveedor visibles o se guarden silenciosamente en interna.

## 5.5 Fechas: evitar falsa precisión sin abrir agujero

Problema reportado: escoger hora actual de interfaz (resolución minuto) produce error por segundos/milisegundos del servidor.

**NO solucionar aceptando indiscriminadamente horas pasadas durante todo el día:** permitiría abrir a las 23:59 un evento que inició a las 08:00 sin el control debido.

Regla recomendada:

```text
DRAFT: aceptar fechas incompletas o históricas si se explican y no publican.
PUBLICAR/ABRIR evento nuevo:
  comparar al minuto, con tolerancia acotada 1–2 minutos configurable,
  y explicitar que inicio hoy puede ser ahora.
  end_at > now y end_at > start_at.
EDITAR futuro: revalidar con política de cambios auditados.
CLOSED/FINISHED histórico: preservar hora real, no convertir automáticamente a «hoy».
```

Si `start_at` no se proporciona, puede precargarse hora local actual en UI para comodidad; no fijar fecha definitiva sin confirmación al publicar. Tests de timezone `America/La_Paz`, UTC y reloj cliente/servidor.

## 5.6 Ownership, permisos, borradores y eliminación

Separar inmutable:

```text
created_by     autor real
responsibles[] operadores
contacts[]     personas contacto
reviewed_by    autoridad que decidió
```

- `DRAFT` privado para autor (Admin con acceso de soporte excepcional auditado), incluso si Docente asignado como responsable.
- Docente/Sociedad `SUBMIT → PENDING → APPROVED|OBSERVED|REJECTED`. La bandeja de Dirección solo recibe enviados, no drafts.
- Si aprobado, el creador no modifica contenido material sin autorización; puede realizar tareas operativas permitidas.
- Director/Admin crean DRAFT y publican explícitamente sin autoaprobarse.
- Si Admin/Director crea y asigna Docente, este NO pasa a ser creador ni debe ver opción de «Editar contenido» para luego recibir 403 al guardar. UI oculta/deshabilita según permisos reales, backend sigue verificando.
- Borradores duplicados de actividades FINISHED deben ser entidades nuevas, con nuevo ID, sin heredar participantes, asistencia, puntos, revisiones, aprobación, constancias ni notificaciones.
- **Borrar borrador**: solo si DRAFT privado, propietario autorizado, sin historial/participaciones/referencias; confirmar con modal, acción transaccional/auditada. Si hay dependencias, preferir soft-delete/archivar. Una vez enviada, aprobada, publicada o con participantes, NO borrar físicamente.
- No permitir borrar actividad publicada «porque todavía no ha ocurrido». Usar `CANCELLED` con motivo o archivo histórico.

## 5.7 Estados y semestres

Lifecycle `DRAFT/PUBLISHED/OPEN/CLOSED/FINISHED/CANCELLED`, review `NOT_REQUIRED/PENDING/OBSERVED/APPROVED/REJECTED` por separado.

`FINISHED` significa que **el evento terminó**, NO que el responsable ya registró toda la asistencia. No reabrir para nuevas inscripciones; permitir **regularización de asistencia controlada** antes de un cierre/lock distinto, con fecha límite/autorización cuando corresponda. Después del lock, solo corrección excepcional Director/Admin con motivo, recálculo y auditoría. No atribuir asistencia en bloque.

`CLOSED` por cupo o inicio: no inscripciones. Reapertura solo si causa se corrigió y `end_at` no terminó. `CANCELLED` requiere motivo, notificaciones y no revive sin autorización; si hay nueva edición se duplica.

**Semestres por responsable:** UI dependiente:

```text
Seleccionar responsables docentes → mostrar sus semestres autorizados
```

- Para actividad gestionada por varios docentes, union de scopes en selector global, **pero cada Docente solo administra sus propios estudiantes**.
- Si la actividad es global sin Docentes responsables, Admin/Director puede elegir todos o subconjunto.
- Cambiar responsables revalida semestres, nunca borra silenciosamente.
- Mostrar qué semestre está cubierto por quién; evitar chips de semestres inhabilitados sin explicación.

---

# 6. INSCRIPCIÓN, ADMISIÓN Y ASISTENCIA — TRES COSAS DISTINTAS

**Este es uno de los defectos de semántica de mayor riesgo (páginas 26–28).**

No mezclar:

```text
INTERESTED      «Me interesa» / preferencia recomendador (no matrícula)
REQUESTED       «Solicité inscripción»
REGISTERED/ACCEPTED «Admisión aceptada; tiene plaza»
WAITLISTED      «Lista de espera», solo si ya existe y se necesita
REJECTED        «Solicitud rechazada», con motivo si corresponde
CONFIRMED       «Asistió», confirmado por responsable autorizado
ABSENT          «No asistió» (si había inscripción aceptada)
CANCELLED       «Inscripción cancelada/retirada»
```

**No asumir un nuevo enum exacto antes de inspeccionar tablas y migraciones.** Si `REGISTERED` hoy es solicitud pendiente, documentar y diferenciar `registration_status` de `attendance_status` (o su equivalente) sin perder históricos. Presentar en UI etiquetas distintas:

```text
Solicitó inscripción → Pendiente / Admitida / Rechazada
Asistencia         → Sin registrar / Presente / Ausente
```

## 6.1 Política de admisión para reducir trabajo sin perder cupos

- Si el evento es abierto, sin selección individual y con cupo libre: **autoaceptación configurable**. No atribuye asistencia.
- Si cupo limitado o grupo específico: aprobación individual por responsable, con criterio y motivo de rechazo; operación atomic/transactional para no sobrepasar cupo.
- Si se desea autoaceptación con cupo, requiere decremento/reserva atómica y validación de scope, no simple contador visual.
- En cualquier política: **solo CONFIRMED attendance** contribuye a trayectoria/afinidad. La mera solicitud o admisión no.
- Interés y favoritos son distintos y no reservan cupo.
- Un docente no puede confirmar su propia asistencia como estudiante ni la de otro scope sin autorización.
- Al finalizar evento, asistencia puede registrarse después en ventana controlada (ver sección 5.7). `FINISHED` no marca a todos presentes ni ausentes automáticamente.

## 6.2 Efectos

```text
REQUESTED → no trayectoria, no afinidad, no puntos
ACCEPTED  → acceso/aforo, no trayectoria, no afinidad, no puntos
CONFIRMED attendance → trayectoria respaldada por actor y actividad;
                         afinidad de áreas según motor existente;
                         puntos si criterio autorizado (idempotente)
ABSENT    → no afinidad, no constancia y no puntos por asistencia
```

Si se corrige asistencia después del lock: dejar histórico original/corrección, recalcular snapshots de forma versionada, emitir reversión de puntos y ajustar artefactos que dependían de ese dato. No reescribir silenciosamente un PDF ya exportado; mostrar fecha de generación y estado consultable.

---

# 7. CONSTANCIAS INTERNAS, PARTICIPACIONES Y DOCUMENTOS EMITIDOS

## 7.1 No son lo mismo

Separar tres niveles:

```text
(1) Registro de participación confirmada
    - dato operacional: inscripción aceptada + asistencia confirmada.
    - fuente: actor responsable en Afinia.
    - no genera automáticamente PDF/constancia/credencial.

(2) Documento de participación emitido por la institución (si Dirección lo autoriza)
    - documento asociado a esa participación, con issuer real y evidencia.
    - es una decisión de autoridad, no una decisión de Afinia.
    - requiere firma/validación institucional si se pretende carácter oficial.

(3) Credencial externa de tercero
    - proveedor externo; evidencia/URL/QR/verificador individual.
    - flujo de validación aparte.
```

**No renombrar indiscriminadamente toda la funcionalidad de constancias a «participación»**, porque destruiría una distinción real: una asistencia y un documento institucional son datos diferentes. Se puede **cambiar la navegación/etiquetas** para evitar apariencia certificadora, conservando la procedencia histórica y los documentos institucionales realmente emitidos.

## 7.2 Pantalla de Dirección

- Primera función: «Participaciones confirmadas» (consultar asistentes por actividad y fecha).
- Segunda función, separada **y solo si la autoridad confirma política**: «Documentos emitidos por la institución» con quién aprobó, fecha, referencia y archivo.
- No emitir masivamente constancias por defecto, ni simular que cada CONFIRMED tiene diploma.
- No incluir actividades externas en lote de constancias internas (un recurso de Cisco no debe aparecer como actividad interna institucional).
- Si existe una tabla llamada `internal_constancies`, conservarla y migrar/cambiar presentación sin borrar datos ni reasignar issuer.
- Un documento ya emitido conserva historial y no se descarta por cambiar el copy.

## 7.3 Inclusión en resumen/currículo

- Participaciones confirmadas pueden mostrarse como **experiencias de trayectoria** etiquetadas.
- Documentos institucionales: registrar como **«Documento emitido por [emisor]»** y, si procede, enlazar el archivo existente.
- Credenciales externas: mostrar `validation_status`, `backing`, issuer y fuente.
- No presentar ninguna de estas tres cosas como «Afinia certifica la actividad/el estudiante».
- Decisión sobre su valor formal en «currículo profesional»: **NEEDS_DECISION**. Mientras tanto exportar solo resumen informativo con disclaimer y selección detallada, sin promesa de verificación universal.

---

# 8. RECURSOS / BIBLIOTECA — MATERIAL, NO CERTIFICACIÓN

Recurso = documentación, libro, tutorial, guía, enlace, video hospedado externamente, herramienta, etc. No asistencia, no FINISHED, no afinidad, no constancia. **«Curso externo con credencial» es oportunidad externa**. Un curso libre sin certificado puede ser recurso de aprendizaje con tipo neutral «Curso de autoaprendizaje (sin acreditación automática)», si el catálogo necesita ese rótulo.

## 8.1 URL o archivo obligatorio

Debe tener al menos una fuente real:

```text
external_url HTTPS/HTTP seguro  OR  uploaded_file autorizado
```

- Permitir ambos si hay una razón, pero exigir al menos uno al publicar.
- Subida: PDF, formatos de texto/documento y quizá imagen cuando sea material educativo; tipos allowlist, size max por configuración, MIME real, antivirus/validación cuando exista.
- **No permitir cargar MP4 pesados en este batch**; usar enlaces (Drive/YouTube) si son legales/compartibles. No se garantiza que una URL de Drive sea pública; validar alcance.
- Guardar metadatos en BD, bytes en almacenamiento existente/objeto compatible; no blob binario masivo en PostgreSQL. No introducir Supabase/Firebase/Cloudinary nuevo por costumbre.
- Validar SSRF/URLs, descarga segura, límites de tamaño, names, permisos y limpieza de huérfanos.
- Mantener URL duplicada bloqueada según reglas actuales; permitir archivo sin URL.
- Clasificar por áreas/skills, semestre, tipo, proveedor, estado y creador.

## 8.2 Scope y publicación

Docente solo sus semestres, salvo permiso extra explícito. Director/Admin puede optar:

```text
Toda la carrera
Semestres específicos
```

Mantener a Docente/Sociedad dentro de las reglas de aprobación acordadas; para **recursos docentes** el V5 favorece excepciones configurables otorgadas por Dirección por docente, pero **DEFAULT REQUIRE_REVIEW** hasta que se conceda. Recurso no necesita responsables como actividad.

## 8.3 Gamificación de recurso

Un criterio opcional al crear recurso solo configura **posibilidad de otorgar puntos por cumplimiento comprobado externamente**. Abrir, favorito o descargar NO demuestra que se terminó. Si Docente tiene permiso, puede registrar hito con motivo/sustento y puntos; si no, proponer a Dirección. Director ve todos en historial.

## 8.4 Recomendaciones de biblioteca

`Todos | Para ti | Mis favoritos`.

El motor usa áreas/skills de recurso para comparar contra perfil (`interested_*`, `improvement_*`). Abrir o guardar recursos NO retroalimenta preferencias, no altera afinidad ni gamificación.

---

# 9. GOBERNANZA CONFIGURABLE: ACTIVIDADES / RECURSOS / GAMIFICACIÓN

## 9.1 Qué está realmente confirmado

Según V5, la Dirección comunicó **autonomía docente para la gestión de su materia y posibilidad de incentivos**, con obligación de coordinación entre paralelos. **Eso no equivale automáticamente a que cualquier Docente pueda emitir certificaciones o publicar cualquier actividad para toda la Universidad.**

La propuesta de V5 es reducir revisión manual de Dirección mediante **exenciones configurables** para docentes seleccionados.

## 9.2 Política final implementable, conservadora

Concepto lógico, sin imponer tabla nueva si ya hay modelo de permisos:

```text
ApprovalPolicy:
  module: ACTIVITY | RESOURCE | GAMIFICATION
  scope: GLOBAL_DEFAULT | TEACHER_OVERRIDE
  decision: REQUIRE_REVIEW | DIRECT_ALLOWED
  granted_by: CAREER_DIRECTOR
  granted_at
  revoked_at?
  justification?
```

**Default para Docente:** `REQUIRE_REVIEW` en cada módulo hasta que Dirección configure excepciones. Para Sociedad aplicar su política específica vigente; no heredar exenciones docentes de forma automática. `ADMIN`/`CAREER_DIRECTOR` tienen facultades propias ya definidas, sin auto-aprobar cuando el proceso exija un revisor distinto.

**Conflicto a registrar en GAP:** una parte del Word sostiene «actividades siempre requieren aprobación», otra sugiere «Dirección puede eximir determinados docentes también en actividades». Para no reinterpretar la facultad institucional: implementar primero **RESOURCE y GAMIFICATION** con override, y dejar `ACTIVITY` en revisión obligatoria por defecto; activar opción de override de `ACTIVITY` **solo con confirmación institucional concreta**. Evitar habilitarla por comentario exploratorio.

Si Director establece excepciones, registrar **quién, cuándo, para qué módulo, para qué Docente, qué semestres/grupos**. Revocación no borra puntos/contenidos históricos; afecta acciones futuras. Los estudiantes de A/B/C deben tener criterios coordinados según política de la materia, pero **no inventar módulo de malla/materias/paralelos** si el sistema no cuenta con esos datos. Registrar la exigencia de coordinación como requisito institucional `NEEDS_DECISION` si faltan IDs institucionales.

## 9.3 UI según policy

Docente autorizado:

```text
Guardar/Enviar/publicar según permiso
Puntos otorgados (directo) + registro visible a Dirección
```

Docente sin permiso directo:

```text
Enviar a revisión
Pendiente de Dirección
aprobado/observado/rechazado
```

NO diseñar la seguridad solo en UI; aplicar guardia backend, policy en cada endpoint, audit. Director puede ver historial de acciones directas sin necesitar aprobarlas a posteriori.

## 9.4 Cola de Dirección

```text
Pendientes de actividades
Pendientes de recursos
Pendientes de criterios/gamificación
```

Mostrar solo lo que realmente requiere revisión. Si un docente tiene autorización directa, los eventos se registran en historial/auditoría, NO como pendientes.

## 9.5 IA opcional para ayudar, no para decidir

No introducir una API pagada ni asistente de IA obligatorio para que Dirección deje de revisar. Validaciones deterministas de campos, permisos y catálogos primero. `AI_PROVIDER=none` debe funcionar. IA opcional podrá resumir inconsistencias, nunca aprobar ni emitir constancia/certificado automáticamente.

---

# 10. GAMIFICACIÓN V5 — SOLO 3 FAMILIAS CONTROLADAS

Gamificación es **puntuación interna de incentivo**; no nota, certificado, competencia, respaldos ni Afinidad.

**Familias operativas principales:**

```text
ACTIVITY_PARTICIPATION_CONFIRMED
PROJECT_TEACHER_RECOGNITION
RESOURCE_COMPLETION_ATTESTED
```

No crear una regla interpretativa/programable por cada recurso o criterio. Pueden conservarse en historial triggers previos ya registrados; no borrarlos. Criterios controlados por catálogo de Admin/Dirección, seleccionables opcionalmente en formularios compatibles. «Proyecto que gustó al Docente» = **reconocimiento discrecional, motivado**, no una validación técnica. «Recurso completado» = declaración autorizada del Docente sobre cumplimiento, no deducción por un click.

## 10.1 Configuración de criterio

```text
id, name, description
trigger_type (enum permitido)
points, active
area_scope? / valid_from? / valid_until?
created_by / updated_by
```

Máximo de puntos según límites ya existentes; no permitir scripts ni puntos libres sin criterio. Campo **opcional** en actividad y recurso; propuesta de Docente asociada a proyecto en su panel de retroalimentación.

## 10.2 Eventos y permisos

**Actividad:** criterio asignado al crear (si se aprueba cuando corresponde); puntos SOLO después de asistencia `CONFIRMED`, nunca por `INTERESTED` / `REQUESTED` / `ACCEPTED`.

**Proyecto:** docente ve estudiantes de su TeacherScope; adjunta comentario/reconocimiento opcional + criterio; si tiene `DIRECT_ALLOWED` puntos directos, si no propuesta PENDING. No marcar proyecto «CORROBORATED» por haber ganado puntos.

**Recurso:** criterio opcional al crearse; al acreditar externamente una actividad educativa relacionada con ese recurso, docente autorizado registra el hito con sustento mínimo; según policy, directo o revisión. No lectura automática ni validez académica.

**Dirección:** puede configurar policy y revisar propuestas; ve historial completo de puntos otorgados por docentes exceptuados.

**Admin:** administración técnica/global de catálogo de criterios; no sustituye autoridad académica ni puede atribuir arbitrariamente resultados sin trazabilidad.

## 10.3 Historial y puntos por estudiante

En «Puntos de estudiantes» permitir abrir estudiante y ver:

```text
fecha / puntos (+/-)
criterio / área si corresponde
origen (actividad, proyecto o recurso) + enlace autorizado
Docente que otorgó / Director que aprobó si hubo revisión
motivo/contexto
estado (APPLIED / PENDING / REVERSED)
```

Sin ranking público de «mejores estudiantes». El docente solo ve estudiantes autorizados. Reversión registrada en ledger sin borrar transacciones, idempotencia `student + criterion + source + event`, auditoría de permisos y concurrencia.

---

# 11. PROYECTOS — ALTA ASISTIDA POR GITHUB, NO EXCLUSIVA

## 11.1 Crear DRAFT siempre accesible

El usuario propone ocultar Áreas/Skills hasta escanear GitHub para impedir claims arbitrarios. Esta **no puede ser una precondición absoluta del borrador**, porque:

- repositorio puede estar temporalmente inaccesible, rate-limited o ser privado;
- no todas las tecnologías aparecen en lenguaje/manifests;
- el estudiante puede todavía no haber publicado su código;
- los proyectos necesitan borradores incompletos y corregibles.

**Flujo recomendado de UX:**

```text
Nuevo proyecto → título mínimo → GUARDAR BORRADOR
   ↳ URL GitHub pública (si disponible)
     → «Analizar repositorio» explícito
     → detectar languages/manifests/paths
     → mapear a skills catálogo / mostrar sugerencias
     → estudiante ACEPTA/RECHAZA sugerencias
     → se preseleccionan áreas contextuales relacionadas
     → puede agregar skills no detectadas como DECLARED
   ↳ Si no hay GitHub, puede seguir completando DRAFT,
     pero no presentar corroboración del código.
   ↳ ACTIVE: cumplir mínimos definidos en especificación previa
     (repo válido público en proyectos tecnológicos, miembros/contribuciones
      confirmados, respaldo contextual mínimo y al menos un área/skill).
```

La detección **no demuestra que el estudiante usó personalmente la tecnología**. Aceptar sugerencia significa «la incluyo en el proyecto», y la señal aporta al respaldo de tecnología **dentro del repo**, no certificar persona. Para cada claim:

```text
skill_id
area_id_context
source = REPO_LANGUAGE | REPO_MANIFEST | DECLARED | OTHER_EVIDENCE
signal_status = DETECTED | NO_SIGNAL | INCONCLUSIVE
person_attribution = SELF_CONFIRMED | MEMBER_CONFIRMED | NOT_CONFIRMED
```

## 11.2 Reglas al quitar tecnología y área

Si GitHub detecta MongoDB, área sugerida Bases de Datos. Si estudiante quita MongoDB:

- **NO borrar el área automáticamente** si otra skill aceptada sigue vinculada allí.
- Si es la última skill, mostrar confirmación para retirar área (si no hay contribuciones/evidencias asociadas); no borrar silenciosamente.
- Si skill tiene área principal/secundarias, pedir **contexto explícito**; no sumar automáticamente a varias.
- Si estudiante descarta una sugerencia, no ofrecerla repetidamente en la misma sesión salvo nuevo análisis/cambio, y mantener fuente de desestimación.
- Si repo falla, no borrar habilidades que ya guardó el usuario; marcar señales `INCONCLUSIVE` / desactualizadas con timestamp.

## 11.3 Reanálisis idempotente

- Botón «Volver a comprobar».
- No duplicar sugerencias ni claims; reconciliar por `project_id`, canonical skill, source evidence y versión/commit.
- Reactivar sugerencias nuevas cuando manifiestos cambien.
- Si tecnología previamente detectada desaparece, mostrar pérdida de señal actual e histórico; no borrar proyecto ni recalcular puntos históricos de manera silenciosa.
- No declarar «validación técnica plena» por depender de la respuesta de la API GitHub.

---

# 12. GITHUB: NORMALIZAR, RECONCILIAR Y EXPLICAR

## 12.1 Pipeline de prueba

```text
Repositorio público accesible
→ status HTTP / URL / owner / default branch
→ GitHub languages
→ manifests conocidos / archivos relevantes con límites y rate limit
→ nombre crudo (pymongo/pytest/fastapi/etc.)
→ normalización controlada
→ catálogo skill / alias / pattern
→ sugerencia con provenance
→ aceptación o descarte del estudiante
→ estado de señal técnica (no identidad)
```

No clonar/ejecutar código. No inferir backend oculto por crawl a demo. No usar SBOM obligatorio. No llamar GitHub en cada render de UI; cache, expiración, backoff, rate limits y respuestas controladas.

## 12.2 Caso PyMongo / MongoDB

Un manifest que contiene `pymongo` puede constituir señal sobre **el uso de driver MongoDB en el repo**, pero no prueba un servidor MongoDB activo, diseño de base de datos ni autoría del alumno. Si catálogo mapea `pymongo → MongoDB`, explicar «se encontró dependencia compatible»; no afirmar «certificado MongoDB».

Un `Python` presente en repository language map es señal del repo; si el alumno hace clic «La usé» debe:

1. asociarla a skill existente + área contextual;
2. actualizar `claim_status` a DECLARED/SELECTED y su señal técnica detectada si sigue vigente;
3. retirar la acción «La usé» por ya aplicada;
4. pintar correctamente badge según *signal_status*, no por texto del botón;
5. evitar confundir estado «Sugerida no declarada» con claim declarado.

Si Admin crea FastAPI o Pytest como skill nueva a partir de pedido, notificar y permitir seleccionarla en proyecto actual; una vez catalogada no debe quedar indefinidamente «no existe» por cache obsoleta. Evitar que la resolución retroactivamente certifique persona.

## 12.3 Colores y textos

No usar solo color, incluir etiqueta:

```text
Gris:  Declarada; sin señal técnica del repo confirmada.
Verde: Declarada + señal técnica detectada en fuente de código
       («Detectada en repositorio»; NO «competencia profesional validada»).
Azul/neutro: Sugerencia detectada todavía NO añadida al proyecto.
Ámbar: fuente inconclusa / solicitud de catálogo pendiente.
Rojo:  inconsistencia o rechazo REAL con razón, NO sugerencia por aceptar.
```

**La Afinidad NO debe asignar «máxima puntuación» automáticamente por cada etiqueta verde**. Se evalúa la **experiencia/familia** y su respaldo, sin multiplicar por 5 tecnologías ni confundir GitHub con título individual. Mantener motor versionado y snapshots, no alterar fórmula sin diseño y tests de equivalencia.

## 12.4 ¿Qué significa «Vincular con...» de Admin?

**Solo sinonimia real:** alias de skill existente.  
**Nueva tecnología distinta:** crear skill y vincularla a **área(s)**.  
**Nuevo área:** catálogo Admin con validación, volver a resolver solicitud.  

No permitir sinónimos incorrectos como `FastAPI=Python`, `Pytest=Python`. Dejar trazabilidad y actualizar estado en todos los clientes.

---

# 13. PROYECTOS: CONTRIBUCIONES, EQUIPO, CONTACTOS Y ROLES

## 13.1 Origen de colaboradores

Un solo creador del proyecto. Modo:

```text
INDIVIDUAL          sin equipo/contactos adicionales
FROM_TEAM           seleccionar equipo existente del usuario
FROM_CONTACTS       seleccionar 1..N contactos autorizados
```

`FROM_TEAM` vs `FROM_CONTACTS` excluyentes **como origen del selector** para mantener la UX simple; no presuponer que una entidad «contacto» es necesariamente integrante hasta que acepte invitación. La membresía no se copia irrevocablemente desde el equipo; el proyecto tiene su propia lista de integrantes con confirmación individual.

- Equipo existente: precargar IDs válidos de miembros; cada miembro confirma unirse al proyecto y su contribución.
- Contactos: invitar contactos con permisos/privacidad; cada uno acepta.
- Si no acepta, no atribuirle experiencia.
- Excluir propuesto: motivo, modal propio y auditoría; **no expulsar del equipo general**.
- Si una invitación no ha sido aceptada, no mostrar persona como integrante consolidado.

## 13.2 Cada contribución debe limitarse a tecnologías del proyecto

```text
project.skills[]      ← catálogo total de habilidades alegadas en el proyecto
member.contribution.skills ⊆ project.skills[]
```

Por tanto el selector de «tecnologías que usaste» **NO lista las 80 skills de Afinia**, sino **solo las del proyecto**, agrupadas por área contextual. Si hay nuevas detecciones GitHub, primero las acepta el creador en el proyecto; después aparecen como opcionales para el integrante. Roles pueden priorizar filtros sin impedir contribuciones reales fuera de la categoría típica.

Cada miembro puede tener varios roles y varios skills contextuales. Todos deben confirmar su propia descripción; nadie se autoatribuye el trabajo de otros. No dar a todos los miembros automáticamente todas las skills del proyecto. La prueba de repo no determina automáticamente a qué commit/persona se atribuye un skill.

## 13.3 No repartir Afinidad como dinero

El Word habla de «repartir puntos de afinidad». **No implementar suma global dividida equitativamente entre miembros**. Afinidad corresponde a trayectoria de cada estudiante según *contribución individual confirmada + respaldo*; puede que dos miembros tengan experiencias distintas. Un proyecto grupal no debe duplicar respaldo sin contribuciones confirmadas. El cálculo se basa en familia proyecto y áreas, no conteo de roles/skills.

## 13.4 Privacidad y galerías

- DRAFT siempre privado.
- ACTIVE visible según opción elegida y permisos.
- Etiquetas de visibilidad claras: «Solo yo y miembros», «También docentes autorizados», «Toda la comunidad Afinia», «Público por enlace» **solo si el proyecto ya soporta esa opción con opt-in explícito y control de PII**.
- No borrar funcionalidad de público/QR existente por una duda de copy, pero **no hacer pública una ficha académica sin consentimiento**.
- 0..5 imágenes de muestra del proyecto (PNG/JPG/WEBP, límites y validación MIME), carrusel en detalle/galería, portada definida, safe storage. Diferentes de evidencias privadas: **no publicarlas sin permiso**.
- «Proyectos de la carrera» para comunidad autenticada, solo ACTIVE con visibilidad correspondiente, filtros por área/skill, cards 6 por página, respeto de perfiles/autorías y privacidad.

---

# 14. RECOMENDACIONES, AFINIDAD Y SUPPORT — FAMILIAS DISTINTAS

## 14.1 Interés y mejora

```text
interested_areas[]
interested_skills[]
improvement_areas[]
improvement_skills[]
```

- «Me interesa» en perfil: gusto/preferencia; puede mostrarse si permisos y opt-in.
- «Quiero mejorar»: objetivo personal, **privado**; NO significa incompetencia.
- «Me interesa» en card de actividad: **feedback explícito del recomendador**; usa áreas/skills de actividad; idempotente/reversible; no reescribe los intereses declarados.
- «Guardar/favorito» de actividad/recurso: organización; no modifica recomendador, afinidad ni puntos.
- Docentes pueden guardar actividades en favoritos para acceso rápido, pero NO botón «Me interesa» que altere preferencias como estudiante.

El recomendador usa perfil/orientación/contexto, no presuponiendo dominio ni Afinidad como factor principal; metas y motivaciones se explican. Evitar copy «100 % probabilidad de éxito»; es coincidencia determinista si se muestra porcentaje.

## 14.2 Afinidad por áreas

Solo fuentes legítimas según motor vigente y versionado:

```text
INTERNAL_ACTIVITY_ATTENDANCE_CONFIRMED
PROJECT_BACKING_ELIGIBLE con contribución individual confirmada
EXTERNAL_CREDENTIAL_CORROBORATED donde fuente oficial lo justifique
```

Intereses, mejoras, tags, roles, favoritos, gamificación, OCR aislado, clics y visualizaciones = **cero Afinidad**. No sumar un punto por cada skill/imagen/miembro. No volver score de afinidad a «porcentaje de dominio de Python».

**Atención:** el criterio exacto de `CORROBORATED` para proyectos y credenciales debe preservar el motor real versionado hasta auditarlo. No modificar los pesos/caps sin comparar V4.1, contratos del código y tests. La conclusión de V5 exige bajar las afirmaciones, no dar un «máximo» por badge verde.

## 14.3 Support / provenance

Eje separado sobre fuerza/diversidad de respaldo, procedencia, disponibilidad, fecha y calidad técnica. Señal `SUPPORTED` no implica `CORROBORATED`. Si proveedor no responde o GitHub falla: `INCONCLUSIVE`/sin corroboración nueva; no `FALSE` automáticamente.

---

# 15. CREDENCIALES EXTERNAS: VALIDACIÓN REALISTA Y ESTADOS

## 15.1 Formatos admitidos y extracción

PDF con texto → parser; PDF escaneado/PNG/JPG → OCR + QR decoder; DOCX si existe parser seguro; otros formatos con rechazo claro. No prometer cualquier archivo.

**Validación fuerte:** fuente oficial individual muestra credencial + issuer + estado + **titular coincidente**; QR que solo va a página del curso NO acredita titular. Si no hay fuente individual verificada, no `AUTO_VERIFIED`.

Ejes diferentes:

```text
validation_status:
PENDING | AUTO_VERIFIED | MANUAL_REVIEW_REQUIRED | MANUALLY_VERIFIED |
INCONCLUSIVE | REJECTED

backing:
DECLARED | SUPPORTED | CORROBORATED | FLAGGED
```

Caso de mismatch de identidad → `REJECTED/FLAGGED` con evidencia y razón, sin falso positivo por mera indisponibilidad técnica. Referentes de proveedor (Credly/IBM, Cisco NetAcad, Huawei) **solo se marcan habilitados si la integración real fue probada**. No suponer API pública ilimitada o scraping infalible. Admin revisa casos excepcionales, no todos.

## 15.2 No convertir esta validación en certificación propia

El resultado de Afinia es «fuente corroborada al consultar el proveedor en fecha X» o «revisión administrativa según evidencia disponible», NO «Afinia certifica por sí misma». La revisión manual de Admin sin prueba oficial no equivale necesariamente a autenticidad universal: etiquetar `MANUALLY_REVIEWED`/`SUPPORTED` según evidencia y política real, sin forzar `CORROBORATED` como automático. Si el contrato previo ya tiene `MANUALLY_VERIFIED`, precisar condiciones de ese estado antes de promocionar backing.

---

# 16. UX/UI Y PERMISOS TRANSVERSALES

- Sin `window.alert`, `window.confirm`, `window.prompt` para flujos sensibles. Componentes modales existentes con motivo, confirmación, error inline y accesibilidad.
- Grids: 10 filas por página, filtros y `Limpiar`, búsqueda reactiva, sort cuando aporta, contadores. Cards: 6 por página para vistas de exploración.
- Combobox de personas y catálogos grandes con búsqueda, navegación teclado y focus; chips para áreas/tecnologías.
- Títulos/fechas/scope/URL con validaciones inline; mostrar errores en el campo, no solo toast.
- Copy consistente y no técnico: evitar referencias V3.2/V4/V5 en UI pública.
- Modales sin parpadeo, estado controlado al cambiar tabs, `prefers-reduced-motion`, contraste suficiente.
- Mostrar botón Editar **solo donde backend autoriza editar**; una vista de lectura no debe simular edición.
- Cada link de fuente de Afinidad/participación lleva a entidad real con autorización; no navegar al archivo privado por ruta pública.
- Accesos Docente: datos estudiantiles limitados TeacherScope, aunque pueda consultar actividades publicadas para colaboración. No filtrar meeting URL sensible a cualquier visitante.
- Logout/login, refresh cookie, sesiones simultáneas de distintos navegadores, API health y CORS se mantienen sin regresión.
- No permitir que formularios de recursos/actividades filtren archivos, JWT, credenciales SMTP, secretos o tokens en logs.

---

# 17. PUNTOS QUE SE CONSERVAN, NO REIMPLEMENTAR

Reportados correctos en auditorías (exigen regresión, no rediseño):

1. Activación por enlace/código, expiración, invalidación anterior y cooldown; cuenta ACTIVE no reenvía activación.
2. Contratos de `Auth`/cookie HttpOnly, CORS con credenciales configurado; no «arreglar» cambiando baseURL sin evidencia.
3. Padrón preview/partial apply/idempotencia e importación diferenciada Student/Teacher.
4. Áreas con código/tags semánticos, skill principal/secundarias, sugeridor semántico sin substring crudo.
5. Actividades multiárea y skills contextuales; no reintroducir `NULL activity_id`.
6. Borrador privado de Admin aunque Docente esté asignado.
7. Creador vs operador separado; responsables no editan contenido material de autoridad.
8. Actividad interna/externa con datos persistidos; corregir tab-state, no rehacer tablas automáticamente.
9. Semestres de Docente restringidos; Docente ve solo sus alumnos en panel académico.
10. Actividad al terminar no acepta nuevas inscripciones; FINISHED histórico no se reabre normalmente.
11. Confirmación de asistencia y trayectoria auditable, sin autoconfirmación por alumno.
12. Recursos: URL duplicada bloqueada, activar/retirar, favoritos y biblioteca «Para ti» si ya existen.
13. Proyectos: DRAFT editable, repo metadata validable, recheck, equipos/contactos/confirmaciones según rama real.
14. Privacidad opt-in, QR, no chat, currículo/resumen seleccionable por experiencia.
15. Gamificación con ledger idempotente, sin ranking público ni «Retos y recompensas» como producto paralelo.
16. Validaciones de credenciales por estado cuando ya implementadas; no sustituir adaptadores reales por promesas.

**Estado actual de estas funciones DESCONOCIDO**: validar antes de etiquetar PASS. Si un punto todavía falla, corregirlo en el batch pertinente.

---

# 18. PLAN INCREMENTAL V5 — ÚNICO PLAN VIGENTE

Cada batch: leer archivos concretos → confirmar GAP → implementar cambio mínimo → pruebas → reporte → commit lógico (si está autorizado) → siguiente solo con luz verde. No ejecutar todos en lote.

## BATCH V5-0 — Branch + auditoría GAP, SIN CAMBIOS

- Proteger base real, crear rama independiente verificada.
- Releer contratos existentes, shared, API, Web, mobile, migraciones y tests pertinentes; registrar versiones.
- Identificar qué V4/V4.1 ya está completo y qué V5 agrega.
- Entregables: `AUDITORIA_GAP_AFINIA_V5.md`, `PLAN_BATCHES_AFINIA_V5.md`.
- Diagnóstico de políticas institucionales `NEEDS_DECISION`.
- Pruebas no destructivas/build baseline cuando tenga dependencias disponibles; no reset de BD.

## BATCH V5-1 — Identidad y padrón: apellidos

- Primer apellido obligatorio; segundo opcional.
- Contratos DTO/web/seed/import CSV y plantillas Student/Teacher.
- Plan de compatibilidad para `lastName` histórico: **no dividir automáticamente apellidos compuestos como si fuese exacto**. Migración segura que preserve texto original y permita corrección explícita; documentar campo legacy si procede.
- Regresión activation/login/padrón idempotente y partial apply.

## BATCH V5-2 — Actividades UX: tres tipos, cards, fechas

- Tres pestañas y formularios por tipo; eliminar toggle de origen redundante en UI, sin reemplazar DB por tres tablas.
- Estado limpio por tab, evitar campos externos en internas.
- Validaciones Externas/Internas homogéneas y mensajes inline.
- Fecha actual a precisión minuto, `end > start`, no pasado arbitrario.
- Duplicar FINISHED a DRAFT sin copiar historias.
- Borrar DRAFT seguro, no publicaciones.

## BATCH V5-3 — Actividades docente, permisos y semestres

- Cards tipo estudiante sin CTA inscríbete ni «Me interesa» para Docente; favorito simple; 6 por página.
- Filtro buscable responsable; detalle según rol/autorización.
- Ocultar edición de contenido en responsables de actividad de Admin/Director.
- Responsables → semestres con scope y mensaje; no ampliar TeacherScope.
- Guardar validaciones de imagen/cupo/modalidad; preservar aprobaciones.

## BATCH V5-4 — Inscripción, admisión, asistencia y FINISHED

- Dos ejes distintos admission y attendance; aceptar no es asistir.
- Decisión de inscripción manual o autoaceptación según evento, cupo/alcance transaccional.
- Rechazo justificado, estados claros; participación confirma solo con asistente responsable.
- FINISHED sin inscripción nueva, pero periodo de registro de asistencia controlado.
- Recalcular solo efectos debidos; pruebas de ausencia, cupo, duplicado, scopes.

## BATCH V5-5 — Participaciones/constancias/contrato institucional

- Separar registro de asistencia de documento emitido.
- Revisar UI de «Constancias internas» para que no sugiera acreditación automática.
- Mantener documentos históricos y issuer sin falsificar o borrar.
- «Resumen de trayectoria» informativo; export sin aval institucional.
- NO activar firma/sello/certificado nuevo hasta decisión formal.

## BATCH V5-6 — Recursos URL/archivo, tipos y scope

- Publicación requiere URL o archivo válido; backend storage seguro, límite MIME/size.
- Excluir MP4 pesado; preferir enlace externo para video.
- Clasificación correcta de recurso educativo vs oportunidad externa con credencial.
- Director/Admin elige toda la carrera o semestres específicos.
- Docente sus semestres, política de revisión por módulo.
- Campo criterio gamificación opcional, sin puntos automáticos por abrir.

## BATCH V5-7 — Políticas de Dirección por Docente

- Auditar esquema de permisos existente antes de agregar tabla/columna.
- Implementar control `REQUIRE_REVIEW` default para recursos/gamificación; override firmado por Director por Docente y módulo, revocable/auditado.
- Actividades conservan aprobación por defecto; excepciones solo tras confirmación institucional.
- Historial de acciones directas visible a Dirección.
- Tests cross-role y permisos por defecto.

## BATCH V5-8 — Gamificación: 3 familias y auditoría

- Criterios fijos compatibles: actividad confirmada, proyecto reconocido por Docente, recurso completado atestiguado por Docente.
- Configuración de puntos/recompensa interna por criterios, opcional en formulario.
- Proyecto: campo en feedback Docente con autorización o pendiente Dirección.
- Recurso: no click/favorito = completado.
- Detalle de ledger «Puntos de estudiantes», causante, motivo, origen y estado.
- Idempotencia/reversión; NO tocar Afinidad.

## BATCH V5-9 — GitHub: repo-first asistido para DRAFT

- CTA «Analizar repositorio», no forzar URL para guardar DRAFT.
- Detección language/manifest, mapear por patrón/alias correcto.
- Presentar sugerencias + fuente, aceptar/descartar y proponer áreas contextuales.
- Skill no detectada manual declarada permitida.
- Recheck no duplica, no borra sin confirmación.
- Repo de tercero: nunca asumir autoría personal.

## BATCH V5-10 — GitHub: estados, UI y conciliación

- Reparar Python aceptado que permanece «no declarado».
- Verde solo «detectada en repositorio», gris «declarada», ámbar «pendiente», neutral «sugerida».
- No rojo por mera sugerencia sin aceptar, ni falsa puntuación máxima.
- Casos PyMongo/MongoDB, Python, FastAPI, Pytest.
- Refetch de caché; tests server/client al reanalizar.

## BATCH V5-11 — Pedidos de tecnologías y taxonomía

- Resolver «alias de la misma skill» vs «crear tecnología nueva».
- Crear skills nuevas por área principal/secundarias; no FastAPI=Python.
- Crear área nueva como opción excepcional del Admin.
- Actualizar proyecto/catálogo/solicitud/notificaciones sin inconsistencia.
- No crear nuevas skills automáticamente desde GitHub.

## BATCH V5-12 — Equipos, contactos, roles y contribuciones

- Selector Individual / Equipo existente / Contactos, sin atribución implícita.
- Multirol por integrante compatible con esquema actual; roles asociados a áreas/skills como sugerencias, NO control rígido absurdo.
- Selector de skills individuales ⊆ skills del proyecto, áreas contextuales.
- Confirmación por miembro; revisión de cambios posteriores.
- Excluir con modal propio, sin borrar de equipo general.
- No dividir puntuación de Afinidad global como saldo entre personas.

## BATCH V5-13 — Privacidad y galería de proyectos

- Etiquetas entendibles, ACL backend intacto; público solo opt-in.
- 0..5 imágenes de presentación distintas de evidencias privadas; carrusel.
- Galería «Proyectos de la carrera» solo ACTIVE visibles según alcance y autores.
- Carga segura, permisos, filtros, paginación 6; links a fuente con autorización.

## BATCH V5-14 — Docente: panel y trazabilidad de Afinidad

- Vista «Actividades de la carrera» mejorada, sin inscribir Docente como alumno automáticamente.
- Vínculos desde señales/áreas de afinidad hacia participación/proyecto/credencial del estudiante, con scope.
- Feedback de proyecto muestra puntos, criterio y docente emisor si se otorgaron.
- Preservar perfiles/proyectos/analítica/scope del Docente de V4.1.

## BATCH V5-15 — Credenciales externas, evidencia y límites de afirmación

- Revisar `validation_status` separado de `backing`, sin cambiar si ya funciona.
- QR/URL individual con titular + issuer + logro; OCR no autentica solo.
- Inconcluso vs falso; excepciones Admin con evidencia y razones.
- Revisar copy: Afinia informa sobre verificación, no emite certificados.
- Proveedores solo si API/consulta técnica real fue probada.

## BATCH V5-16 — Afinidad, trayectoria y export informativo

- Mantener motor determinista/versionado; recalcular solo por cambios de fuente legítima.
- Diferenciar área de experiencia vs estado de skill; no puntos por color.
- «Mi trayectoria» con origen y estados claramente explicados.
- Export seleccionable de proyectos/actividades/credenciales, sin afirmación profesional oficial.
- Si dirección pendiente, marcar funcionalidad formal `NEEDS_DECISION`, no suprimir lo ya existente por ansiedad.

## BATCH V5-17 — QA integral / seguridad / documentación

- Integración PostgreSQL y tests por permisos; regresión frontend móvil/compartidos.
- Validar amenazas URL/SSRF/upload, CORS/auth, UI tabs, caché y timezones.
- Actualizar Swagger, DTO shared, migraciones, README, `.env.example`, manuales, ayuda, trazabilidad de tesis y evidencias de pruebas realmente ejecutadas.
- No modificar capítulos de la tesis salvo tarea separada y explícita.

---

# 19. MATRIZ DE ESCENARIOS DE ACEPTACIÓN V5

## A. Identidad/padrón

```text
A01: Cuenta Student creada con apellido1 obligatorio y apellido2 vacío → éxito.
A02: Datos legacy con «Pérez García» → se conserva texto y no se asigna erróneamente como dos apellidos.
A03: Plantilla CSV antigua se importa con política documentada, sin desplazamiento de columnas.
A04: 190 existentes + 10 nuevos + conflictos → aplicar solo válidos, sin duplicados.
A05: Admin ve nombres/apellidos correctamente; User status y auth sin regresión.
```

## B. Tipos y formularios

```text
B01: Abrir Académica → Externa → Académica, no aparecen campos issuer en académica.
B02: Crear Externa presencial con lugar="1234" → inline error, no persistir.
B03: Externa virtual sin meeting URL → inline error según modalidad.
B04: Hora local 18:33 y selector 18:33 → tolerancia de minuto coherente.
B05: Hora local 23:59 y evento 08:00 → NO publicar como futuro.
B06: Duplicar FINISHED → nueva DRAFT, 0 participantes, 0 constancias, 0 puntos.
B07: Eliminar DRAFT propio sin referencias → confirmación y retiro; publicado no tiene Eliminar.
B08: Responsable Docente de actividad Admin DRAFT no la ve; PUBLISHED la ve sin Editar material.
B09: Con responsables A (1–4) y B (5–6), scope permitido unión; cada uno gestiona sus propios alumnos.
B10: Charla IA general solo Área IA y 0 skills → se puede publicar si demás requisitos.
```

## C. Admisión/asistencia

```text
C01: Student solicita → REQUESTED, no crea afinidad/puntos/constancia.
C02: Responsable acepta → ACCEPTED/REGISTERED, no crea asistencia.
C03: Responsable confirma presencia luego de evento → CONFIRMED, trayectoria según reglas.
C04: Responsable marca ABSENT → no atribución.
C05: Cupo=1 solicitudes concurrentes; solo 1 admisión se acepta.
C06: Autoaceptación habilitada sin cupo → inscripción inmediata, asistencia todavía pendiente.
C07: FINISHED sin cierre de attendance permite regularizar dentro de ventana; vencida requiere Director.
C08: Rechazo con motivo notifica, no se confunde con ausencia.
```

## D. Recurso

```text
D01: Recurso con URL válida y sin archivo → éxito.
D02: Recurso con archivo permitido sin URL → éxito, bytes fuera de PG.
D03: Sin URL ni archivo → inline error.
D04: MP4 pesado → rechazado, se ofrece usar enlace.
D05: Director selecciona 3° y 5° → solo esos estudiantes según alcance.
D06: Docente de 2° intenta publicación para 8° → 403 backend.
D07: Guardar favorito/abrir recurso → no puntos, no afinidad, no feedback de recomendador.
D08: Recurso con criterio «completado» → puntos solo con declaración Docente autorizada y auditada.
```

## E. Governance/gamificación

```text
E01: Docente default REQUIRE_REVIEW → propuesta queda PENDING.
E02: Director autoriza Teacher para GAMIFICATION → reconocimiento directo con actor+origen+motivo auditados.
E03: Director revoca permiso → operaciones futuras a PENDING; ledger histórico intacto.
E04: Director puede filtrar historial de puntos por alumno y Docente.
E05: Procesar confirmación dos veces → un solo evento de puntos.
E06: Project Teacher Recognition → no altera project backing, Affinity ni tecnicidad del repo.
E07: Resource Completion Manual → no se dispara por descarga/click/guardar.
E08: Sociedad no hereda excepciones de docentes.
```

## F. GitHub y catálogo

```text
F01: Nuevo proyecto sin repo → Guardar DRAFT funciona.
F02: Pegar URL pública + Analizar → sugerencias, fuente y estado técnico.
F03: Dependencia PyMongo → sugiere MongoDB en contexto, no certificar servidor.
F04: Aceptar Python detectado → aparece seleccionado y desaparece «La usé»; badge indica señal.
F05: Reanalizar misma revisión → no duplicar claims/sugerencias.
F06: GitHub rate limit → INCONCLUSIVE; no borrar declaraciones.
F07: Pedido FastAPI → crear tecnología nueva con área principal; NO alias de Python.
F08: Pedido Pytest → skill nueva con área decidida por Admin o rechazo motivado.
F09: Admin resuelve pedido → aparece inmediatamente catálogo; notificación coincide con acción.
F10: Quitar única skill de un área → advertir; no borrar datos por sorpresa.
F11: Skill multiárea → elegir contexto, no duplicar puntos.
F12: Repo ajeno → detecciones ≠ contribución personal confirmada.
```

## G. Proyectos/equipo/privacidad

```text
G01: Contribuyente solo ve tecnologías alegadas por proyecto, no todo catálogo.
G02: Equipo preexistente → invitados precargados, cada uno debe aceptar.
G03: Contacto externo a equipo → invitación; sin aceptar, no es autor confirmado.
G04: Multirol → Responsable + DB Master puede seleccionarse, sin generar evidencia.
G05: Rol Backend no bloquea arbitrariamente tecnología realmente usada y declarada.
G06: Excluir miembro del proyecto muestra modal interno y deja historial, no lo quita del equipo formal.
G07: Galería pública comunidad muestra solo ACTIVE con permiso adecuado.
G08: Galería de proyecto 0–5 imágenes; evidencia privada nunca se publica sin consentimiento.
G09: Public link/QR no expone correo institucional ni evidencias privadas por defecto.
```

## H. Trajectory/certificates

```text
H01: Confirmación de participación se presenta como registro del responsable, NO como certificado Afinia.
H02: Actividad de participación simple no genera constancia automáticamente.
H03: Documento institucional histórico conserva issuer y trazabilidad sin afirmar emisión Afinia.
H04: PDF de resumen selecciona ítems, tiene fecha y aviso de naturaleza informativa.
H05: QR a página general del curso → NO AUTO_VERIFIED.
H06: Credly/Cisco/Huawei sin prueba individual disponible → INCONCLUSIVE/MANUAL_REVIEW, no falso ni corroborado.
H07: Archivo titular Juan, verificador titular Pedro → mismatch con evidencia y revisión.
H08: Afinidad ve source IDs, no gamificación, recursos ni roles como respaldo.
```

## I. Regresión transversal

```text
I01: Abrir modal de exclusión no usa window.prompt.
I02: Grids 10 filas, cards de exploración 6, búsqueda/reactividad y filtros.
I03: Docente sin permiso ve acción lectura, no botón Editar que falla al final.
I04: No aparece en UI lenguaje técnico «V5», «CORROBORATED 100% certeza», «certificado por Afinia».
I05: Expo Student-only, backend/shared/web no pierden contratos por migraciones.
I06: Protección en endpoints (no solo en botones), pruebas 403 con roles externos.
I07: No se creó ningún segundo sistema de retos, chat, ML o emisión de certificados.
```

---

# 20. REGLAS DE IMPLEMENTACIÓN POR BATCH

Formato de entrega:

```text
BATCH ID:
RAMA Y COMMIT BASE:
ALCANCE AUTORIZADO:
HALLAZGO (con ruta, endpoint, estado):
YA CORRECTO (preservado):
DEFECTOS REPRODUCIDOS:
CAUSA RAÍZ:
ARCHIVOS MODIFICADOS:
MIGRACIONES Y RIESGO DE DATOS:
PRUEBAS REALES (comandos + resultados):
REGRESIONES (escenarios PASS / FAIL):
SECURITY CHECK:
PENDIENTES / NEEDS_DECISION:
COMMIT ID (solo en nueva rama):
```

**Regla antifabricación:** no decir «100% funcional» si no se probó. No usar datos falsos para evidencias de tesis; distinguir mocks de resultados de ejecución. No usar `db:reset` salvo autorización explícita porque destruye datos locales. Si el entorno falla por `.env`, Docker o dependencies, documentar como problema de entorno sin atribuirlo automáticamente a defectos funcionales.

**Antes de cada batch**: inspeccionar código real, hacer plan de archivos mínimos, conservar compatibilidad, ejecutar build/tests de los módulos tocados y chequear regresiones. En caso de FAIL, detener avance, arreglar o revertir en rama nueva con historia y volver a probar. No abrir PR ni merge a ramas anteriores sin aprobación.

---

# 21. DECISIONES RESUELTAS Y NO-ALCANCE

| Tema | Decisión V5 |
|---|---|
| Dirección y docente | autonomía condicionada por policy, privilegio por módulo, default revisión |
| Actividad interna | asistencia confirmada ≠ documento institucional |
| Admisión | solicitar/aceptar distinto de asistir |
| Constancias | preservar registros y issuer; NO emitir documentos oficiales por Afinia |
| Currículo | export informativo y selectivo, no promesa de validez profesional universal |
| Repo-first | UX recomendada, no condición para DRAFT |
| GitHub detected | evidencia de repositorio, no prueba de autoría/competencia |
| Alias FastAPI/Python | NO sinónimos; crear skill nueva si Admin autoriza |
| Rol de proyecto | ayuda para filtrar, no prueba ni prohibición total |
| Gamificación | solo 3 familias principales, políticas de aprobación, no Afinidad |
| Favoritos | organización; sin puntos ni recomendación |
| Me interesa actividad | feedback estudiante al recomendador, no afinidad |
| Proyecto público | solo opt-in con ACL; no publicar automáticamente evidencias privadas |
| Recurso | URL o archivo; no MP4 pesado, no certificado por visita |
| Fechas | precisión al minuto y tolerancia acotada, no «cualquier hora pasada hoy» |
| QR externo | solo fuerte si verifica credencial individual + titular |
| IA/OCR | asistentes, no juez ni emisor |
| Revisión exención actividades | NECESITA confirmación institucional; default aprobación |
| Móvil | estudiante únicamente; no cambios de SDK por costumbre |

**Fuera de alcance:** usar OCR para «detectar backend real» de capturas, crawler para tecnología backend, clonación/ejecución de repositorios, entrenamiento de IA certificadora, ranking público de capacidad, gamificación por clics, cambio de notas/malla, reintroducir chat o retos y recompensas, automodificación de datos institucionales por estudiante, emisión de certificados profesionales por Afinia, integración de APIs pagas sin necesidad comprobada, cambio completo de stack, nueva infraestructura cloud obligatoria.

---

# 22. CHECKLIST DE DEFINICIÓN DE TERMINADO

- [ ] Código sobre rama V5 nueva protegida, rama base intacta.
- [ ] GAP V5 entregado con estados y evidencias.
- [ ] No se borraron datos, migraciones, proyectos ni documentos anteriores.
- [ ] Se distingue inscripción, admisión y asistencia; cupos seguros.
- [ ] Participación no se llama automáticamente constancia o certificado.
- [ ] Resumen de trayectoria no promete certificación institucional.
- [ ] Apellidos normalizados con compatibilidad legacy.
- [ ] Formulario 3 pestañas sin contaminación entre schemas.
- [ ] Externa valida lugar/URL/modalidad igual que interna.
- [ ] Duplicación a DRAFT y borrado seguro de DRAFT.
- [ ] Horas válidas con comparación robusta al minuto.
- [ ] Docente tiene vista de actividades paginada con filtros, favoritos sin «Me interesa».
- [ ] Docente puede navegar a fuentes de Afinidad autorizadas.
- [ ] Edición denegada no aparece como acción aparentemente permitida.
- [ ] Recursos URL/archivo y scope conforme permisos.
- [ ] Exenciones docentes configurables, auditadas, default restrictivo.
- [ ] Criterios de gamificación opcionales, idempotentes y aislados.
- [ ] Historial de puntos visible por alumno con origen y actor.
- [ ] GitHub repo-first asistido sin bloquear DRAFT.
- [ ] PyMongo→MongoDB explicado como señal, no competencia certificada.
- [ ] Python aceptado deja de ser sugerencia pendiente.
- [ ] FastAPI/Pytest catalogables como skills independientes por área.
- [ ] Equipo/contactos/confirmaciones individuales sin autoría falsa.
- [ ] Roles de proyectos son filtros UX, no certificadores.
- [ ] Visibilidad y galería de proyectos respetan opt-in.
- [ ] Credenciales externas tienen estados honestos, no QR general auto-verificado.
- [ ] Afinidad/versionado y métricas no confunden puntos con respaldo.
- [ ] QA y regresión reales con resultados y riesgos registrados.
- [ ] Pendientes de Dirección documentados y NO implementados como facultades adquiridas.

---

# 23. PROMPT INICIAL PARA CLAUDE CODE

> Lee **íntegro** `AFINIA_CONTRATO_UNICO_V5_CORRECCIONES_CLAUDE_CODE_2026-10-26.md`. Es el **único contrato operativo V5** y reemplaza los planes anteriores. No hagas cambios de código todavía. Inspecciona ramas y working tree, determina la rama REAL con los últimos avances válidos y protege las anteriores. Crea una rama nueva `feature/afinia-v5-cierre` solamente si la base está limpia y la situación no es ambigua. Ejecuta **únicamente BATCH V5-0**: matriz GAP con archivos y evidencias, mapa de permisos, puntos `NEEDS_DECISION` y plan de batches mínimo. **No borres archivos/datos ni ejecutes db:reset**. Cuando termines BATCH 0, entrégame el diagnóstico y detente hasta autorización para comenzar BATCH V5-1.

---

# ANEXO A. TRAZABILIDAD DE LAS 69 PÁGINAS DE `corregir v5.docx`

La numeración es de páginas visibles en el Word auditado. Sirve para localizar el origen de cada observación si el usuario suministra capturas adicionales. **No significa que todas sean requisitos aprobados por Dirección.**

| Páginas | Contenido observado o planteado | Sección normativa V5 | Naturaleza |
|---|---|---|---|
| 1–2 | Autonomía docente/gamificación y pendientes de Dirección | 1, 9, 10 | Confirmación parcial + política pendiente |
| 3–7 | Cards docentes, favoritos, detalles y filtro por responsable; colaboración docente | 3, 16, V5-3 | Mejora UX; acceso sensible limitado |
| 8 | Fuente navegable de afinidad en perfil de estudiante visto por Docente | 14, 16, V5-14 | Mejora trazabilidad |
| 9–10 | Apellido1/apellido2 en cuentas y CSV de padrón | 3, V5-1 | Ajuste estructural con migración cuidadosa |
| 11–12 | Duplicar, borrar borradores y problema de milisegundos/hora actual | 5, V5-2 | Defecto UX + controles de historial |
| 13–15 | Cascada responsables-semestres, drafts privados, edición denegada visible | 5, V5-3 | Preservar autorización y mejorar UI |
| 16–24 | Alternancia interna/externa revive campos y resultado eliminado; tres tabs | 5, V5-2 | Regresión probable a reproducir |
| 25 | Validaciones insuficientes en Externas | 5, V5-2 | Defecto probable a reproducir |
| 26–28 | «Constancia», admisión y asistencia mezcladas; cupos/participación | 6, 7, V5-4/5 | Aclaraciones posteriores tienen prioridad |
| 28–29 | Recurso URL/archivo y tipos; video pesado | 8, V5-6 | Diseño y límites técnicos |
| 30–31 | Exenciones docentes; bandejas Dirección; reinterpretación constancias | 7, 9, V5-5/7 | Política por confirmar parcialmente |
| 32–35 | Constancia solo de Dirección, recurso-gamificación, historial de puntos | 7, 8, 10, V5-5/8 | Distinguir participación/documento |
| 36 | Exenciones por docente incluso actividad propuestas | 9, V5-7 | **NEEDS_DECISION** para actividades |
| 36–38 | Rol/contribución restringido a skills del proyecto | 4, 13, V5-12 | UX vinculante y rol no certificador |
| 39–40 | Opciones de visibilidad confusas, `window.prompt` al excluir | 13, 16, V5-12/13 | Simplificar copy; modal propio |
| 41–43 | Escaneo GitHub antes de elegir skills, rescan y manejo de áreas | 11, 12, V5-9/10 | Repo-first solo guiado; DRAFT flexible |
| 44–46 | Colores y estados, Python detectado/declarado, sugerencias desactualizadas | 12, V5-10 | Corrección UI y procedencia |
| 47–53 | FastAPI/Pytest erróneamente vinculados a Python, catálogo inconsistente | 4, 12, V5-11 | Nueva skill ≠ alias |
| 54–57 | Imágenes de proyectos y galería de proyectos de carrera | 13, V5-13 | Solo ACTIVE y permiso explícito |
| 58–60 | Equipo/contactos, multirol, relación rol-área-tech | 4, 13, V5-12 | UX sugerida, sin prueba de autoría por rol |
| 61–67 | Tres tipos de criterios, filtros combobox, recursos semestre, bonus opcionales | 8–10, V5-6/8 | Gamificación aislada de afinidad |
| 68–69 | Tutor: Afinia no certifica; peligro de constancias/currículo profesional | 1, 7, 15, V5-5/16 | **LÍMITE PRINCIPAL; decisión institucional pendiente** |

# ANEXO B. INVENTARIO DE RIESGOS QUE NO DEBE RESOLVER CLAUDE CON SUPOSICIONES

**B1. Política de aprobación académica.** Autonomía de clase no implica exención universal de revisión ni potestad para firmar documentos oficiales. Default restrictivo; exención individual por módulo únicamente con facultad comprobada.

**B2. «Constancia interna».** La asistencia confirmada constituye un registro dentro de Afinia. Si Dirección entrega otro documento, existe un artefacto diferente con emisor real. No sumar ambas veces a Afinidad. No otorgar estado `CORROBORATED` universal por el nombre del documento.

**B3. Resumen vs currículo profesional.** Puede exportarse una selección de experiencias del estudiante en formato informativo; la plataforma NO avala todas las afirmaciones como certificación profesional. Esperar decisión institucional antes de introducir sello, firma, constancia automática o textos de validez formal.

**B4. GitHub lenguaje/manifest.** Tecnología detectada en repositorio ≠ usada personalmente por un miembro; credencial tecnológica del estudiante ≠ detección. El motor conserva respaldo independiente de roles y colores.

**B5. Nuevas habilidades derivadas de GitHub.** Una dependencia puede sugerir skill; solo Admin incorpora al catálogo. Alias requiere identidad conceptual; biblioteca/framework y lenguaje son entidades diferentes.

**B6. Docentes en actividades ajenas.** Consultar actividad publicada ≠ acceso automático a datos de todos sus estudiantes ni a reuniones privadas sin permiso. No ampliar `TeacherScope` por mejorar cards.

**B7. Seguridad de archivo.** Recurso por enlace/archivo no autoriza volcar PDF o vídeo gigante a PostgreSQL ni aceptar URL interna SSRF. Primero inspeccionar puerto de almacenamiento existente.

**B8. Fechas.** El bug de comparación por milisegundos se arregla con granularidad/tolerancia acotada; no haciendo legal una inscripción en evento que ya finalizó.

**B9. Borrador privado.** Borrar DRAFT sin participantes puede ser seguro; no eliminar trazas legales/auditoría ni romper duplicados existentes. Para publicado, cancelar/desactivar sin hard delete.

**B10. Periodo de asistencia.** FINISHED del evento no debe bloquear la captura posterior legítima de asistencia, pero tampoco habilitar cambios ilimitados sin audit/log y límite de ventana.

**B11. Solicitud automática.** En actividades sin selección puede habilitarse aceptación automática con permiso/configuración, pero nunca implica asistencia. Cupo necesita reserva atómica.

**B12. Cinco actores.** Responsable, emisor, contacto, revisor, coordinador, integrante y rol técnico son conceptos/relaciones, NO nuevos tipos globales de cuenta.

---

# FIN — AFINIA, CONTRATO ÚNICO V5

**Criterio rector:** Afinia documenta una trayectoria **con procedencia y límites claros**, automatiza trabajo repetitivo y conserva soberanía académica de la Universidad. No se convierte por una interfaz bonita en una entidad certificadora, ni atribuye automáticamente competencias a partir de etiquetas, puntos, imágenes, dependencias o comentarios.
