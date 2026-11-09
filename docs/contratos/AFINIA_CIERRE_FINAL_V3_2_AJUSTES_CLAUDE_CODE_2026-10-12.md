# AFINIA — ESPECIFICACIÓN DE CIERRE FINAL V3.2
## Flujo completo, reglas definitivas y plan de ajustes por batches para Claude Code / Codex

**Fecha de consolidación:** 12 de octubre de 2026  
**Estado:** FUENTE DE VERDAD PARA EL CIERRE FINAL DEL SOFTWARE  
**Proyecto:** Afinia — Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico en Ingeniería en Sistemas Informáticos – Univalle  
**Destinatario:** Claude Code, Codex u otro agente de desarrollo que trabaje sobre el repositorio actual  
**Tipo de documento:** Consolidación final posterior a auditoría funcional, técnica y UX

---

# 0. FUENTES Y PRECEDENCIA

Este documento unifica y resuelve lo observado en:

1. `corregir v3.docx` — auditoría más reciente y de mayor prioridad;
2. decisiones posteriores sobre Áreas, Habilidades, Etiquetas y Alias;
3. `corregir v2.docx`;
4. `corregir.docx`;
5. `AFINIA_ESPECIFICACION_MAESTRA_FINAL_V3_1_2026-10-06.md`;
6. implementación actual, únicamente como evidencia de lo que existe, no como autoridad sobre la regla final.

Cuando dos fuentes se contradigan:

```text
V3.2
  ↓
corregir v3
  ↓
decisiones posteriores confirmadas
  ↓
corregir v2
  ↓
corregir v1
  ↓
V3.1
  ↓
software actual
```

Una observación temprana que después fue aclarada NO debe revivirse.

El agente debe distinguir siempre:

```text
PRESERVAR
→ ya funciona y solo requiere regresión.

CORREGIR
→ existe pero está incorrecto.

COMPLETAR
→ existe parcialmente.

NUEVO
→ falta implementar.

RETIRAR
→ existe pero contradice la versión final.

VERIFICAR
→ la auditoría no permite afirmar todavía que esté correcto.
```

---

# 1. OBJETIVO DEL CIERRE

No reescribir Afinia.

El software ya posee una base funcional importante. Este cierre busca:

- corregir incoherencias encontradas en auditoría;
- completar flujos que quedaron a medias;
- devolver funcionalidades retiradas accidentalmente;
- unificar UX;
- cerrar la taxonomía Área–Habilidad;
- consolidar actividades internas y oportunidades externas;
- dar un propósito definitivo al catálogo de Recursos;
- asegurar ownership y auditoría;
- fortalecer proyectos y evidencias;
- conservar motores explicables;
- dejar currículo, perfil y trayectoria coherentes;
- cerrar con pruebas reales.

Principio:

> **No agregar complejidad que no aporte valor. Sí agregar estructura cuando evita incoherencia, fraude, duplicación o una mala experiencia.**

---

# 2. VISIÓN DEFINITIVA DE AFINIA

Afinia no es SIU, LMS, red social general, certificadora profesional ni reemplazo de GitHub/Teams.

Afinia:

```text
IDENTIDAD INSTITUCIONAL
        ↓
PERFIL + INTERESES + OBJETIVOS
        ↓
RECOMENDACIONES
        ↓
ACTIVIDADES INTERNAS / OPORTUNIDADES EXTERNAS / RECURSOS
        ↓
PROYECTOS + EQUIPOS
        ↓
EVIDENCIAS Y VALIDACIONES
        ↓
TRAYECTORIA RESPALDADA
        ↓
AFINIDAD + SUPPORT
        ↓
COLABORACIÓN
        ↓
PERFIL / QR
        ↓
CURRÍCULO SELECCIONABLE
```

Su valor es:

> El estudiante construye de forma autónoma una trayectoria útil, mientras Afinia reutiliza información conocida, reduce trabajo manual y distingue lo declarado de lo respaldado.

---

# 3. CINCO ACTORES

Se mantienen exactamente:

```text
STUDENT
TEACHER
CAREER_DIRECTOR
SCIENTIFIC_SOCIETY
ADMIN
```

No crear nuevos roles de negocio para resolver problemas puntuales.

Un estudiante puede ser contacto operativo de una actividad sin convertirse en un sexto actor o adquirir permisos de Docente/Director.

---

# 4. PRINCIPIOS NO NEGOCIABLES

## 4.1 Declaración ≠ respaldo

```text
“Me interesa React”
≠
“tengo experiencia respaldada en React”
```

## 4.2 Tags ≠ datos del motor

Tags y aliases ayudan a clasificar/reconocer.

Los cálculos usan relaciones por ID y evidencia.

## 4.3 Afinidad ≠ dominio

Afinidad representa trayectoria respaldada por área dentro de Afinia.

No representa:

- nota;
- inteligencia;
- porcentaje profesional de dominio;
- empleabilidad;
- ranking humano.

## 4.4 IA ≠ autoridad

IA puede:

- extraer;
- resumir;
- sugerir;
- señalar inconsistencias;
- asistir.

IA no puede por sí sola:

- certificar;
- autenticar legalmente;
- confirmar asistencia;
- aprobar actividades;
- cambiar afinidad.

## 4.5 No penalizar limitaciones técnicas

Si el sistema no logra corroborar una tecnología:

```text
DECLARED
```

No:

```text
FALSE
```

## 4.6 Procedencia

Toda señal relevante debe registrar de dónde sale.

Ejemplos:

```text
ACTIVITY_CONFIRMED
PROJECT_REPOSITORY
GITHUB_LANGUAGE
GITHUB_MANIFEST
PROJECT_DEMO
PROJECT_SCREENSHOT
TEAM_MEMBER_CONFIRMATION
TEACHER_FEEDBACK
EXTERNAL_CREDENTIAL
INTERNAL_CONSTANCY
AUTHORIZED_MANUAL_REVIEW
```

---

# 5. REGLA GLOBAL DE UX

El sistema debe reutilizar lo que ya conoce.

Ejemplo:

```text
selecciona ÁREA
    ↓
se muestran HABILIDADES relacionadas
    ↓
elige una o varias
    ↓
se guardan IDs
```

Aplicar el patrón donde exista relación real:

- área → habilidades;
- semestre → scope;
- oportunidad externa finalizada → credencial elegible;
- equipo → integrantes al crear proyecto;
- proyecto → evidencias;
- currículo → experiencias elegibles.

No inventar relaciones.

Ejemplo:

```text
Área → categoría de actividad
```

NO es una dependencia obligatoria.

Una categoría como Taller puede aplicarse a Web, Redes, IA, etc.

---

# 6. REGLAS UX TRANSVERSALES DE LA AUDITORÍA FINAL

Estas reglas se aplican a toda la web cuando corresponda.

## 6.1 Grids

Máximo visual recomendado:

```text
10 filas por página
```

Si hay más:

- paginación;
- anterior/siguiente;
- páginas;
- contador total.

Añadir cuando sea útil:

- ordenar ascendente/descendente;
- búsqueda;
- filtros;
- botón Limpiar visible.

No hacer páginas verticales gigantes por cientos de filas.

## 6.2 Búsquedas

Búsqueda interactiva con debounce.

No obligar Enter si el buscador puede filtrar automáticamente.

## 6.3 Combobox grandes

Si pueden existir más de 10 opciones:

- mostrar un conjunto acotado;
- incorporar búsqueda;
- no desplegar 100 nombres en una lista enorme.

Para áreas/habilidades preferir chips/burbujas.

Para personas usar combobox con búsqueda.

## 6.4 Validaciones

Mensajes por campo.

No depender del tooltip HTML/JS genérico.

Ejemplo:

```text
“El título no puede contener solo símbolos.”
“La fecha final debe ser posterior a la fecha inicial.”
“Selecciona al menos un área.”
“Selecciona al menos una habilidad vinculada.”
```

## 6.5 Modales

Eliminar parpadeos/flicker observados.

Mantener:

- foco;
- transición corta;
- overlay estable;
- `prefers-reduced-motion`.

## 6.6 Botones

Las acciones reales deben parecer acciones reales.

Ejemplo:

```text
Descargar plantilla
Limpiar
Crear
Enviar a revisión
Cancelar envío
Ver detalle
```

No esconder funciones importantes como texto diminuto.

---

# 7. USUARIOS, CÓDIGO UNIVERSITARIO Y PADRÓN

## 7.1 Código universitario

Se conserva como identificador institucional único.

No alimenta ningún motor.

Sirve para:

- unicidad;
- importación;
- auditoría;
- referencia institucional.

Prefijos según actor permanecen.

## 7.2 Importación

Mantener dos contextos:

```text
[Estudiantes]
[Docentes]
```

Cada uno con plantilla propia.

### Estudiante

```text
university_code
first_name
last_name
institutional_email
current_semester
```

### Docente

```text
university_code
first_name
last_name
institutional_email
authorized_semesters
```

## 7.3 Corrección crítica: aplicación parcial

Un CSV puede contener:

```text
190 existentes
10 nuevos
3 conflictos
```

El sistema DEBE permitir aplicar los 10 nuevos.

Clasificación por fila:

```text
NEW
UPDATE
UNCHANGED
CONFLICT
INVALID
```

Al aplicar:

```text
NEW      → insertar
UPDATE   → actualizar si la política lo permite
UNCHANGED→ omitir
CONFLICT → omitir
INVALID  → omitir
```

Los conflictos NO deben bloquear filas válidas.

La respuesta debe resumir:

```text
insertados
actualizados
sin cambios
omitidos por conflicto
inválidos
```

## 7.4 Idempotencia

Aplicar dos veces el mismo padrón no duplica.

## 7.5 Preview e historial

No llenar auditoría con basura.

Regla:

```text
subir archivo
→ PREVIEW TEMPORAL
```

Si:

```text
Descartar
o
abandonar sin aplicar
```

no debe quedar como importación permanente en el historial operacional.

El historial visible normal debe priorizar:

```text
APPLIED
FAILED_TO_APPLY
```

Si por razones técnicas se conserva un preview, debe tener TTL/cleanup y no contaminar la vista.

## 7.6 CSV inválido

Validar:

- cantidad de columnas;
- encabezados;
- campos obligatorios;
- dominio institucional;
- semestre;
- university_code;
- encoding.

Una columna ausente NO debe desplazar los demás valores y hacer que el correo parezca apellido.

## 7.7 Buscador de usuarios

CORREGIR:

- filtrado automático;
- `Limpiar` visible.

---

# 8. ACTIVACIÓN DE CUENTAS

## 8.1 Preservar

La auditoría confirmó como funcional:

- envío inicial;
- reenvío;
- enlace;
- código;
- expiración;
- token ya usado;
- emisión de uno nuevo invalida anterior;
- cuenta suspendida bloqueada.

Todo debe tener prueba de regresión.

## 8.2 Flujo final

Correo:

```text
[Activar mi cuenta]
+
código de 6 dígitos
+
enlace textual de respaldo
```

En producción la página de activación muestra principalmente:

```text
Tengo el código
```

Si el usuario entra desde el botón/enlace:

- token se toma de URL;
- no necesita pegar URL manualmente;
- solo establece contraseña.

Retirar el tab visible:

```text
“Tengo el enlace”
```

cuando el sistema ya esté hosteado.

## 8.3 Cuenta ya activa

Si se solicita una nueva activación para una cuenta ACTIVE:

- no crear token;
- no encolar correo;
- no afirmar “se envió”;
- responder estado controlado;
- UI indicar que la cuenta ya está activa y dirigir a Login/Recuperación.

## 8.4 Cooldown

Mantener:

```text
ACTIVATION_RESEND_COOLDOWN_SECONDS=120
ACTIVATION_RESEND_MAX_PER_DAY=5
ACTIVATION_TOKEN_TTL_HOURS=48
```

El contador debe venir del estado del servidor.

Cerrar/reabrir la ventana NO reinicia el cooldown.

## 8.5 Decisión sobre “reenviar solo cuando caduque”

NO implementar una prohibición absoluta de 48 h.

Razón:

- el correo puede no llegar;
- el estudiante necesita reenvío razonable.

Protección final:

```text
cooldown
+
máximo diario
+
invalida token anterior
+
auditoría
```

## 8.6 Admin

Mostrar:

```text
Invitación enviada:
10/10/2026 17:44

Expira:
12/10/2026 17:44
```

y estado:

```text
Pendiente
Caducada
Activa
```

---

# 9. SESIONES Y DEMO MULTIACTOR

Una aplicación con cookie/session global no debe soportar mágicamente cuentas diferentes en varias pestañas del mismo perfil de navegador.

Es normal:

```text
misma sesión del navegador
→ misma cuenta
```

Para demo en una sola computadora usar:

- perfiles separados de Chrome/Edge;
- incógnito;
- navegadores diferentes.

NO diseñar una arquitectura multiaccount por pestaña solo por la defensa.

Lo que SÍ es obligatorio corregir:

- ownership real de datos;
- endpoints filtrados;
- `created_by`;
- `updated_by`;
- `responsible`;
- `reviewed_by`;
- permisos.

Un problema de sesión de demo NO puede explicar que una actividad del Admin aparezca como “creada por Docente”.

---

# 10. TAXONOMÍA FINAL: ÁREAS, HABILIDADES, TAGS, ALIASES Y CÓDIGOS

Esta sección SUPERA cualquier explicación anterior que dijera que los tags alimentan Afinidad.

## 10.1 Área

Macrodominio.

Ejemplos:

```text
Bases de Datos
Redes
Desarrollo Web
Desarrollo Móvil
Ciberseguridad
Inteligencia Artificial
Computación en la nube
Ingeniería de Software
Gestión de Proyectos
```

Campos:

```text
id
code
name
description?
tags[]
status
```

### code

Identificador estable.

NO suma.

NO clasifica experiencia.

NO alimenta afinidad.

## 10.2 Habilidad / tecnología

Elemento granular.

Ejemplos:

```text
PostgreSQL
MongoDB
React
NestJS
Linux
TCP/IP
AWS
Docker
Python
```

Campos lógicos:

```text
id
code
name
primary_area_id
aliases[]
status
```

y relaciones secundarias cuando corresponda.

## 10.3 Tags de Área

Valor final:

> Metadata semántica que ayuda a construir y mantener el catálogo y a sugerir el área de una nueva habilidad.

NO se usan para puntuar.

NO se copian como evidencia.

NO se convierten en afinidad.

NO sustituyen skills.

Ejemplo correcto:

```text
Área: Bases de Datos

tags:
persistencia
modelado de datos
almacenamiento
relacional
no relacional
consultas
```

Skills:

```text
SQL
PostgreSQL
MySQL
MongoDB
Redis
Oracle
```

Evitar duplicación como:

```text
tag=PostgreSQL
+
skill=PostgreSQL
```

si ya existe la skill.

## 10.4 Alias de Skill

Alias = otro nombre de LA MISMA skill.

Ejemplo:

```text
Skill: PostgreSQL
aliases:
postgres
postgresql
```

```text
Skill: React
aliases:
reactjs
react.js
```

Alias no significa “palabra relacionada con el área”.

## 10.5 Sugeridor de área

Al crear skill:

```text
nombre
+
aliases
```

el sistema analiza catálogo actual.

Prioridad:

```text
1. coincidencia exacta con skill/alias existente
2. coincidencia exacta con tag de área
3. relación con skills ya clasificadas
4. coincidencia semántica débil
5. sin confianza → no sugerir
```

NO substring bruto.

Tokens cortos:

```text
C
R
JS
AS
```

solo coincidencia exacta controlada.

El bug observado:

```text
alias=aws
→ sugería Redes
```

aunque AWS estaba asociado a Cloud debe marcarse como CORREGIR.

No adaptar el modelo al bug.

## 10.6 Protección al crear áreas

- nombre único normalizado;
- code único;
- tags normalizados;
- advertir colisiones;
- advertir tags demasiado genéricos;
- advertir si una tag duplica una skill tecnológica;
- sugerir vocabulario semántico;
- Admin decide.

IA opcional puede sugerir, no guardar.

---

# 11. UNA SKILL PUEDE PERTENECER A MÁS DE UN ÁREA

Decisión final para no crear incoherencia ni complicar motores.

## 11.1 Modelo lógico

Una skill tiene:

```text
1 área principal obligatoria
0..N áreas secundarias
```

Ejemplo:

```text
Linux
principal → Redes
secundaria → Ciberseguridad
secundaria → Computación en la nube
```

```text
Python
principal → Inteligencia Artificial
secundaria → Desarrollo Web
```

```text
Docker
principal → Computación en la nube
secundaria → Ingeniería de Software
```

## 11.2 Implementación

No obligar una reescritura innecesaria.

Si actualmente existe:

```text
skills.academic_area_id
```

puede conservarse como área principal.

Agregar solo si hace falta:

```text
skill_area_relations
skill_id
area_id
relation_type = SECONDARY
```

o una estructura equivalente.

El agente debe adaptar el modelo existente.

## 11.3 Filtro en formularios

Si el usuario elige:

```text
Bases de Datos
Redes
```

mostrar:

```text
Bases de Datos
  MongoDB
  PostgreSQL
  Redis

Redes
  Linux
  TCP/IP
  Routing
```

Las skills secundarias pueden aparecer bajo:

```text
Relacionadas con esta área
```

## 11.4 Caso ambiguo

Si una skill pertenece a varias áreas seleccionadas:

```text
Python
→ IA
→ Web
```

el formulario debe guardar el contexto de esa experiencia.

Conceptualmente:

```text
experience
area_id
skill_id
```

Ejemplo:

```text
Proyecto X
Desarrollo Web → Python
IA → TensorFlow
```

## 11.5 Regla para Afinidad

NO hacer:

```text
Python corroborado
→ sumar automáticamente en TODAS sus áreas posibles
```

El motor usa:

```text
área explícita seleccionada en la experiencia
+
skill corroborada dentro de ese contexto
```

Una experiencia aporta UNA contribución por familia a cada área explícitamente respaldada.

Varias skills dentro del mismo proyecto/área explican la contribución, pero no multiplican el proyecto infinitamente.

Esto mantiene el motor simple.

---

# 12. QUÉ ALIMENTA CADA MOTOR

## 12.1 Clasificador administrativo

Usa:

```text
area.tags
skill.name
skill.aliases
skills existentes
```

Objetivo:

- ayudar a clasificar.

No puntúa.

## 12.2 Motor de recomendaciones

Usa principalmente:

```text
interested_areas
improvement_areas
interested_skills
improvement_skills
orientation
semester/context
availability
recommendation_feedback
```

y compara con:

```text
opportunity.area_ids
opportunity.skill_ids
resource.area_ids
resource.skill_ids
```

## 12.3 Motor de Afinidad

NO usa:

```text
tags
aliases
texto libre
intereses
```

Usa:

```text
area_id
skill_id contextual
backing
evidence provenance
```

de experiencias corroboradas.

---

# 13. CATEGORÍAS DE ACTIVIDAD

Las categorías NO alimentan Afinidad ni Recomendaciones directamente.

Sirven para:

- clasificar;
- filtrar;
- limitar qué actor puede usar una categoría.

Ejemplos:

```text
Charla
Taller
Clase espejo
Feria
Seminario
Hackathon
```

Campos:

```text
name
code
description?
applies_to = ACADEMIC | EXTRACURRICULAR | BOTH
status
```

No asociar categorías obligatoriamente a áreas.

---

# 14. MODELO FINAL DE ACTIVIDADES / OPORTUNIDADES

En UX del Estudiante existe un universo común:

```text
ACTIVIDADES / OPORTUNIDADES
```

Internamente:

```text
INTERNAL
├── ACADEMIC
└── EXTRACURRICULAR

EXTERNAL
└── curso/capacitación de tercero con evidencia externa
```

Separar además:

```text
RESOURCE_LIBRARY_ITEM
```

que no es actividad.

---

# 15. QUIÉN CREA QUÉ

## Docente

Puede:

- INTERNAL ACADEMIC;
- EXTERNAL pertinente para su contexto;
- semestres dentro de TeacherScope.

Requiere Director.

## Sociedad

Puede:

- INTERNAL EXTRACURRICULAR;
- EXTERNAL complementaria permitida.

Requiere Director.

## Director

Puede:

- INTERNAL ACADEMIC;
- EXTERNAL;
- publicar sin aprobarse a sí mismo.

## Admin

Puede crear de forma excepcional:

- INTERNAL;
- EXTERNAL.

No necesita aprobación.

Pero debe conservar:

- creador;
- responsable;
- procedencia.

Admin no se convierte automáticamente en autoridad académica de la experiencia.

---

# 16. OWNER, RESPONSABLE Y CONTACTO NO SON LO MISMO

Evitar un campo ambiguo.

## owner / created_by

Quien creó el registro.

## academic_responsible(s)

Uno o varios actores que gestionan académica/operativamente.

Pueden confirmar asistencia según permisos.

## contact_person(s)

Persona a quien el estudiante puede contactar.

Puede incluir un estudiante de contexto si Docente lo asigna.

Ese estudiante:

- NO publica;
- NO aprueba;
- NO confirma asistencia salvo permiso explícito futuro;
- NO adquiere rol nuevo.

Solo es contacto/encargado visible.

---

# 17. RESPONSABLES SEGÚN ACTOR

## Docente

Por defecto:

```text
responsable = docente creador
```

Puede añadir como contacto a estudiante(s) de su scope.

## Sociedad

Por defecto:

```text
responsable = miembro creador
```

Puede seleccionar integrantes activos de Sociedad.

## Director

Por defecto:

```text
responsable = director
```

Puede asignar:

- docentes;
- miembros de Sociedad;
- él mismo.

## Admin

Puede seleccionar responsable válido.

---

# 18. CAMPOS DE ACTIVIDAD INTERNA

Mínimos:

```text
title
description?
internal_type
category_id
areas[]
skills[]
start_at
end_at
modality
semester_scope[]
responsibles[]
capacity_mode
capacity?
status
review_status
image?
```

## 18.1 Modality

```text
PRESENTIAL
VIRTUAL
HYBRID
```

### Presencial

Requiere ubicación.

No requiere meeting URL.

### Virtual

Requiere meeting URL.

Ocultar ubicación física.

### Híbrida

Requiere:

- ubicación;
- meeting URL.

## 18.2 Enlaces

Separar:

```text
meeting_url
resource_links[]
```

`resource_links` es 0..N.

Ejemplos:

- guía;
- material;
- sitio del evento;
- patrocinador;
- documento.

No forzar un “enlace externo” genérico obligatorio si no existe.

## 18.3 Imagen

Una imagen ilustrativa opcional.

Card puede mostrar una.

Detalle puede mostrar recursos adicionales.

---

# 19. ÁREAS Y HABILIDADES EN ACTIVIDADES

Una actividad puede tener:

```text
1..N áreas
1..N habilidades
```

La UI:

```text
selecciona áreas
→ despliega habilidades relacionadas
→ selecciona múltiples por área
```

El error observado:

```text
activity_areas.activity_id NULL
```

al editar con varias áreas debe CORREGIRSE.

También debe verificarse que:

- guarda >1 área;
- guarda >1 skill;
- conserva relación al editar;
- no pierde skills de áreas diferentes;
- no genera NULL;
- se ejecuta en transacción.

---

# 20. NO PEDIR TAGS MANUALES EN CADA ACTIVIDAD

El responsable ya seleccionó:

```text
areas[]
skills[]
```

No hacerlo escribir otra vez tags.

Si se requieren términos para búsqueda:

```text
search_keywords
```

se derivan de:

- nombre del área;
- tags del área;
- nombre skill;
- aliases.

Son metadata de búsqueda.

NO motor.

NO evidencia.

---

# 21. ESTADOS DE ACTIVIDAD

Separar lifecycle de review.

## Lifecycle

```text
DRAFT
PUBLISHED
OPEN
CLOSED
FINISHED
CANCELLED
```

## Review

```text
NOT_REQUIRED
PENDING
OBSERVED
APPROVED
REJECTED
```

## 21.1 DRAFT

- privado;
- solo propietario/gestores autorizados;
- incompleto permitido.

## 21.2 PUBLISHED

- visible;
- todavía no recibe inscripciones.

## 21.3 OPEN

- visible;
- inscripción habilitada.

## 21.4 CLOSED

No acepta nuevas inscripciones.

Puede ocurrir por:

- cupo completo;
- cierre manual;
- `start_at <= now`.

## 21.5 FINISHED

Automático:

```text
end_at <= now
```

## 21.6 CANCELLED

Manual.

Requiere motivo.

---

# 22. NO AUTO-PUBLICAR SOLO POR GUARDAR

Ajuste final deliberado.

Guardar un formulario completo no debe publicar accidentalmente.

Acciones explícitas:

### Director/Admin

```text
Guardar borrador
Publicar
```

### Docente/Sociedad

```text
Guardar borrador
Enviar a revisión
```

Esto evita errores operativos.

---

# 23. REVIEW DE DOCENTE Y SOCIEDAD

Flujo:

```text
DRAFT
→ SUBMIT
→ review=PENDING
→ Director
   ├─ APPROVE
   ├─ OBSERVE
   └─ REJECT
```

## 23.1 Cancelar envío

Mientras:

```text
review=PENDING
```

y todavía no hubo decisión:

```text
Cancelar envío
→ vuelve a DRAFT
```

para corregir.

## 23.2 OBSERVED

Creador:

- corrige;
- reenvía.

## 23.3 APPROVED

Después de aprobación:

- creador original NO modifica campos materiales;
- botón Editar desaparece para Docente/Sociedad;
- Director puede ajustar;
- Admin solo en función autorizada/operativa.

El creador sigue gestionando participantes cuando tenga permiso.

---

# 24. VISIBILIDAD Y OWNERSHIP DE ACTIVIDADES

## 24.1 Draft de Docente

Visible solo al Docente creador.

NO aparece a:

- otros docentes;
- estudiantes;
- Director;
- Admin en la vista operacional ordinaria;

hasta `SUBMIT`.

La auditoría técnica puede conservar trazas separadas.

## 24.2 Draft de Sociedad

Solo creador/miembros autorizados según la política de Sociedad.

## 24.3 Draft de Director

No debe aparecer como “mío” a Admin ni Docentes.

## 24.4 Draft de Admin

No debe aparecer como “mío” a Director ni Docentes.

## 24.5 Submitted

Docente/Sociedad:

```text
PENDING
→ aparece en bandeja de Director
```

Admin puede tener acceso de auditoría/soporte si la política lo conserva, pero no debe confundir ownership.

## 24.6 Approved/Published

Se muestra a actores que pueden consultar el catálogo.

---

# 25. “MIS ACTIVIDADES” VS “ACTIVIDADES DE LA CARRERA”

Separar.

## Mis actividades

Lo creado/gestionado por el actor.

## Actividades de la carrera

Actividades publicadas visibles globalmente según permisos.

Restaurar al Docente la función perdida.

Docente puede consultar actividades publicadas por:

- Dirección;
- Sociedad;
- otros docentes;
- Admin cuando corresponda.

No significa que las haya creado.

---

# 26. ACTIVIDAD APROBADA EN DIRECTOR

Cuando Director aprueba una propuesta:

- desaparece de Pendientes;
- aparece en gestión de actividades aprobadas;
- conserva creador original;
- conserva responsables;
- Director puede ajustar campos permitidos;
- toda modificación queda auditada.

Agregar filtro:

```text
Académica
Extracurricular
Externa
```

---

# 27. ACTIVIDADES INTERNAS: PARTICIPACIÓN

Estados:

```text
INTERESTED
REGISTERED
CONFIRMED
ABSENT
CANCELLED
```

Solo:

```text
CONFIRMED
```

representa experiencia institucional.

El estudiante NO sube screenshot para demostrar asistencia.

Responsable confirma.

---

# 28. RESULTADO DE ACTIVIDAD INTERNA

Solo INTERNAL muestra política de resultado.

Opciones:

```text
NONE
PARTICIPATION_ONLY
INTERNAL_CONSTANCY
INSTITUTION_ISSUED_CERTIFICATE
EXTERNAL_CREDENTIAL_EXPECTED
```

## 28.1 PARTICIPATION_ONLY

CONFIRMED queda como trayectoria.

## 28.2 INTERNAL_CONSTANCY

El responsable decide otorgarla.

Afinia la registra/distribuye.

El estudiante no vuelve a subirla.

## 28.3 INSTITUTION_ISSUED_CERTIFICATE

Si Univalle/actor institucional emite un certificado:

- Afinia NO se atribuye autoría;
- guarda issuer real;
- responsable adjunta/template/registro;
- se entrega a confirmados según decisión.

## 28.4 EXTERNAL_CREDENTIAL_EXPECTED

Una actividad interna puede conducir a una credencial externa.

Después se valida en el flujo externo.

---

# 29. OPORTUNIDADES EXTERNAS

Definición final:

> Actividad/curso/capacitación de un tercero (Cisco, IBM, Huawei, Microsoft, etc.) cuyo resultado esperado se demuestra con evidencia externa del proveedor.

Campos:

```text
provider
external_url
areas[]
skills[]
start_at
end_at
semester_scope[]
validation_reference
expected_issuer_domains
expected_keywords
credential_expected=true
```

No mostrar “Al terminar genera” como selector genérico.

El flujo externo ya sabe que el estudiante deberá acreditar el resultado.

Un enlace/libro permanente sin credencial NO es una Oportunidad Externa: es Recurso.

---

# 30. EXTERNA: INSCRIPCIÓN Y EVIDENCIA

```text
INTERESTED
→ REGISTERED/REQUESTED
→ ACCEPTED
→ FINISHED
→ EVIDENCE_ELIGIBLE
```

Regla:

```text
ACCEPTED ≠ CREDENTIAL_EARNED
```

Al terminar:

- aparece en combobox de credenciales;
- estudiante adjunta evidencia.

---

# 31. VALIDACIÓN DE CREDENCIALES EXTERNAS

Orden:

```text
1. fuente oficial verificable
2. URL / credential ID / QR
3. PDF con texto nativo
4. OCR si es escaneado
5. comparación de nombre/curso/provider
6. IA opcional como asistencia
7. resultado determinista
```

QR NO es obligatorio.

Una web puede:

- usar JS;
- CAPTCHA;
- rate-limit;
- estar caída.

Fallo técnico:

```text
INCONCLUSIVE
```

No `FALSE`.

---

# 32. NUEVA OPORTUNIDAD EXTERNA

Si `credential_expected=true`, antes de publicar configurar al menos:

## A. fuente oficial

o

## B. referencia

```text
PDF/imagen guía
issuer
course title
keywords
patrones
dominios
```

La guía ayuda a comparar.

No prueba autenticidad por semejanza visual.

---

# 33. CREDENCIALES HISTÓRICAS

No recrear una actividad antigua.

El estudiante registra:

```text
provider
credential_name
date
credential_id?
verification_url?
file?
areas[]
skills[]
```

Si existe prueba oficial:

```text
CORROBORATED
```

Si solo existe documento coherente:

```text
SUPPORTED
```

Si no existe mecanismo digital y es un caso histórico relevante:

```text
AUTHORIZED_MANUAL_REVIEW
```

como excepción.

Registrar:

```text
reviewed_by
reviewed_at
reason
decision
```

No convertir esto en revisión manual masiva.

---

# 34. BACKING DE CREDENCIAL

```text
DECLARED
SUPPORTED
CORROBORATED
FLAGGED
```

Afinidad V4 solo usa:

```text
CORROBORATED
```

---

# 35. CATÁLOGO DE RECURSOS — PROPÓSITO FINAL

Cerrar la ambigüedad de la pestaña Recursos.

Un Recurso es material permanente.

Ejemplos:

- libro;
- documentación;
- guía;
- tutorial;
- video;
- herramienta;
- enlace académico;
- repositorio educativo;
- sitio de aprendizaje.

NO tiene:

- fecha inicio;
- fecha fin;
- inscripción;
- asistencia;
- certificado;
- afinidad.

Campos:

```text
title
description
resource_type
url
provider/source?
areas[]
skills[]
image?
status
created_by
```

## 35.1 Estudiante

Nueva experiencia:

```text
Biblioteca / Recursos
```

Puede:

- buscar;
- filtrar por área/skill;
- abrir;
- guardar/favorito.

## 35.2 Recomendaciones

Los Recursos pueden ser recomendados según:

- áreas de interés;
- áreas a mejorar;
- skills de interés;
- skills a mejorar.

Un FAVORITO explícito de Recurso puede utilizarse como señal secundaria de preferencia.

Una simple visita/click NO debe reescribir el perfil.

## 35.3 Afinidad

Recurso:

```text
NO aporta afinidad
```

porque consultar un libro no demuestra experiencia.

---

# 36. “ME INTERESA” EN ACTIVIDADES

Decisión final por precedencia de la auditoría más reciente:

```text
ME_INTERESA
```

es:

- favorito;
- recordatorio/notificación;
- organización personal.

NO modifica intereses del perfil.

NO aumenta Afinidad.

NO se usa como señal principal del recomendador.

Si la actividad ya terminó:

- no mostrar Solicitar inscripción;
- puede permitir Guardar/Favorito;
- no generar recordatorios de evento futuro.

---

# 37. CARDS DE ACTIVIDAD

Mantener tamaño visual consistente.

Descripción larga:

- truncar;
- no deformar cards.

Card base:

- imagen;
- título;
- tipo;
- estado;
- fecha/hora inicio;
- fecha/hora fin;
- área(s) resumidas;
- skills resumidas;
- modalidad;
- meeting URL cuando corresponda;
- primer resource link útil;
- cupo/resumen;
- CTA.

Si hay demasiadas áreas/skills:

```text
Bases de Datos
Redes
+2
```

Detalle:

- descripción completa;
- todas áreas;
- skills;
- aula;
- responsables;
- capacidad;
- links;
- recursos;
- outcome;
- provider externo;
- motivo cancelación.

---

# 38. FECHAS Y HORAS

Corregir el bug donde:

```text
16:45
→ regresa 20:48
```

Reglas:

- persistencia UTC o estrategia ya adoptada;
- conversión consistente;
- UI usa timezone definido;
- al editar se recupera exactamente el instante original;
- `end_at > start_at`;
- tests de timezone.

---

# 39. PROYECTOS — FLUJO FINAL

## DRAFT

Puede guardarse incompleto.

No aparece como experiencia respaldada.

## ACTIVE

Requiere:

```text
title
>=1 area
>=1 skill
repository_url pública válida
miembros confirmados si grupal
contribución propia confirmada
evidencia contextual mínima
```

`demo_url` opcional.

---

# 40. ÁREAS Y SKILLS EN PROYECTOS

Una proyecto puede tener varias áreas.

Cada área despliega skills relacionadas.

Skill multiárea usa contexto explícito.

Ejemplo:

```text
Proyecto X

Bases de Datos
→ MongoDB

Redes
→ Linux
→ TCP/IP

Desarrollo Web
→ React
→ NestJS
```

Este es el dato real del motor.

No tags.

---

# 41. GITHUB

Mantener:

- validar repo;
- metadata;
- languages;
- tree/contents limitado;
- manifests;
- cache;
- rate-limit;
- retry.

No:

- clonar;
- ejecutar código;
- AST completo;
- SBOM obligatorio.

## 41.1 Languages

Corrobora presencia de lenguaje.

No dominio.

## 41.2 Manifests

Ejemplo:

```text
react
@nestjs/core
pg
fastapi
```

generan candidatos de skills.

## 41.3 Skill no detectada

```text
DECLARED
```

No penalizar.

---

# 42. DEMO / HOSTING

`demo_url`:

- existe;
- responde;
- HTTPS;
- status;
- redirects;
- title;
- metadata.

No usar crawler para afirmar:

- backend;
- base de datos;
- stack oculto.

---

# 43. SCREENSHOTS DE PROYECTO

Sí sirven como evidencia contextual.

No sirven para certificar stack.

OCR/IA pueden decir:

- parece un dashboard;
- hay un login;
- se observa pantalla móvil.

No:

```text
“esto demuestra NestJS”
```

---

# 44. BACKING DE PROYECTO

```text
DECLARED
SUPPORTED
CORROBORATED
REVIEWED
FLAGGED
```

Para CORROBORATED:

```text
repo válido
+
>=1 señal técnica
+
>=1 señal independiente
```

Señal técnica:

- language;
- manifest;
- dependency.

Independiente:

- demo;
- miembros confirmados;
- evidencia contextual.

---

# 45. EQUIPOS E INTEGRANTES

No votación por mayoría.

Cada persona confirma SU información.

```text
rol
contribución
skills
```

Si rechaza:

- creador corrige;
- vuelve a confirmar.

Proyecto grupal no se activa hasta confirmaciones requeridas.

---

# 46. NECESIDADES Y EQUIPOS

```text
Crear necesidad
→ semestres
→ áreas
→ skills faltantes
→ cupos
→ postulaciones
→ aceptar/rechazar
→ equipo
```

Al crear proyecto:

```text
Agregar individualmente
o
Usar equipo existente
```

---

# 47. NOTIFICACIONES

Eventos mínimos:

```text
ACCOUNT_ACTIVATION
ACTIVITY_REVIEW_SUBMITTED
ACTIVITY_REVIEW_OBSERVED
ACTIVITY_APPROVED
ACTIVITY_REGISTRATION_ACCEPTED
ACTIVITY_STARTING
PARTICIPATION_CONFIRMED
EXTERNAL_EVIDENCE_AVAILABLE
PROJECT_CONFIRMATION_REQUIRED
PROJECT_CONTRIBUTION_CHANGED
TEACHER_FEEDBACK_RECEIVED
CONTACT_REQUEST
TEAM_APPLICATION
TEAM_APPLICATION_ACCEPTED
TEAM_APPLICATION_REJECTED
```

Dedupe.

No spam.

`ME_INTERESA` puede controlar recordatorios sin cambiar recomendaciones.

---

# 48. PERFIL Y ONBOARDING

Orden:

```text
Perfil base
→ Intereses por área
→ Áreas a mejorar
→ Skills de interés
→ Skills a mejorar
→ Disponibilidad
→ Privacidad
→ cuestionario/orientación opcional
```

Datos declarativos:

```text
recomendaciones
```

No Afinidad.

La vista Intereses/Habilidades no debe duplicarse en sidebar si ya vive en Mi Perfil.

Usar tabs.

---

# 49. RECOMENDACIONES

Objetivo:

> recomendar lo que desea explorar o mejorar.

Fuentes:

```text
interested_areas
improvement_areas
interested_skills
improvement_skills
orientation
semester
availability
recommendation_feedback
resource_favorites (peso bajo)
```

NO usar Afinidad como factor principal.

No usar `ME_INTERESA` de actividad como mutación automática del perfil.

---

# 50. AFINIDAD V4

Afinidad por área.

Fuentes:

```text
INTERNAL_ACTIVITY_CONFIRMED
PROJECT_CORROBORATED_OR_REVIEWED
EXTERNAL_CREDENTIAL_CORROBORATED
```

No:

```text
tags
aliases
intereses
resource clicks
gamificación
capturas por cantidad
IA
```

## 50.1 Skill multiárea

La experiencia debe indicar:

```text
area_id + skill_id
```

Solo ese contexto alimenta el área.

## 50.2 No multiplicar por skill

Un proyecto en un área es una contribución de la familia Proyecto.

Tener:

```text
React
TypeScript
NestJS
```

no convierte un proyecto en tres proyectos.

Las skills explican.

No inflan.

---

# 51. HABILIDADES EN LA UI DE AFINIDAD

Mostrar:

```text
Desarrollo Web
Afinidad: 72/100

Habilidades respaldadas
React
  Proyecto X
  Actividad Y

NestJS
  Proyecto X
```

No:

```text
React = 87% dominio
```

---

# 52. SUPPORT

Separado de Afinidad.

Puede reconocer señales SUPPORTED que todavía no puntúan Afinidad.

Regla:

```text
Afinidad = trayectoria corroborada
Support  = fuerza/diversidad del respaldo
```

---

# 53. GAMIFICACIÓN

Independiente.

Sirve para participación e incentivo.

No Afinidad.

Puntos:

- eventos controlados;
- idempotentes.

Recompensas:

- insignias;
- beneficios definidos por Universidad.

No prometer recompensa física automática.

---

# 54. CURRÍCULO SELECTIVO

Paso 1:

```text
secciones
```

Paso 2:

```text
ítems concretos
```

Ejemplo:

```text
Proyectos
[x] Afinia
[ ] Proyecto Y

Actividades académicas
[x] Clase espejo X
[ ] Taller Y

Extracurriculares
[x] Feria X

Credenciales
[x] Cisco X
[ ] IBM Y
```

Elegibilidad:

### Proyecto

```text
ACTIVE
+
CORROBORATED/REVIEWED
```

### Actividad interna

```text
CONFIRMED
```

### Credencial externa

```text
CORROBORATED
```

Constancia complementa actividad.

No duplicar.

Preview antes de PDF.

IA solo mejora redacción sin inventar.

---

# 55. PRIVACIDAD Y QR

Perfil público opt-in.

QR:

- slug opaco;
- muestra solo datos permitidos.

Solicitud de contacto:

```text
scan
→ perfil permitido
→ solicitar
→ aceptar/rechazar
```

Chat sigue retirado.

---

# 56. DOCENTE — FUNCIONES QUE DEBEN EXISTIR

La auditoría final detectó regresión grave: fueron retiradas funciones.

Restaurar/verificar:

```text
Inicio/Panel académico
Actividades de la carrera
Mis actividades
Perfiles de estudiantes de su scope
Proyectos de estudiantes de su scope
Necesidades de equipo de su scope
Reporte/analítica por semestre
Feedback
```

No dos dashboards duplicados.

Docente ve estudiantes solo por TeacherScope.

---

# 57. DIRECTOR — VISTAS

```text
Inicio
Aprobaciones
Actividades gestionadas/aprobadas
Participantes/constancias
Recursos
Analítica
```

Analítica:

```text
Panorama
Afinidad
Participación
Demanda
Evolución
```

Evitar tres pantallas planas iguales.

---

# 58. SOCIEDAD — VISTAS

```text
Inicio
Mis actividades
Participantes
Métricas
```

Retirar vista separada:

```text
Crear actividad
```

si `Mis actividades` ya contiene botón Crear.

Métricas:

- filtros;
- interacción;
- drill-down.

---

# 59. ADMIN — AUDITORÍA

La auditoría no debe parecer consola de DBA.

No mostrar como filtros principales:

```text
entity=user
delta
```

sin traducción.

UI:

```text
Actor
Módulo
Acción
Fecha
Resultado
```

Detalle avanzado puede contener info técnica.

Los filtros deben funcionar.

---

# 60. CORREO / CONFIGURACIÓN TÉCNICA

La pantalla:

```text
Correo (configuración técnica)
```

NO debe formar parte del producto final ordinario.

SMTP/secrets son configuración de despliegue.

Puede existir únicamente:

- en desarrollo;
- o detrás de un modo técnico explícito no expuesto al Admin normal.

Nunca mostrar password SMTP.

---

# 61. AYUDA

Mantener Centro de Ayuda.

Completar por rol:

- activar cuenta;
- perfil;
- actividades;
- proyecto;
- evidencias;
- afinidad;
- currículo;
- privacidad.

Permitir:

- imágenes;
- video configurado.

---

# 62. RESTAURAR DISTINCIÓN “MIS” VS “TODAS”

Regla transversal.

Ejemplos:

```text
Mis actividades
Actividades de la carrera
```

```text
Mis proyectos
Proyectos visibles
```

No hacer que permisos amplios conviertan todo en propiedad del usuario.

Ownership siempre por `created_by`/relación real.

---

# 63. ACTORES Y EDICIÓN POST-APROBACIÓN

Docente/Sociedad:

```text
APPROVED
→ no editar contenido
```

Director:

- puede ajustar lo aprobado;
- cambios auditados.

Admin:

- solo soporte/operación autorizada;
- cambios auditados.

---

# 64. PARTICIPANTES

Corregir grid responsivo.

No mover columnas.

Paginación.

Filtros.

Acciones por estado.

---

# 65. ACTIVIDAD PASADA

Si:

```text
start_at <= now
```

no permitir nueva inscripción si CLOSED.

Si `FINISHED`:

- no inscripción;
- mostrar estado;
- puede guardarse como favorito histórico si se desea;
- no enviar recordatorios futuros.

---

# 66. MOBILE

Student-only.

No copiar web 1:1.

Priorizar:

- onboarding;
- perfil;
- actividades;
- recursos;
- proyectos;
- afinidad;
- notificaciones;
- trayectoria;
- equipos;
- currículo si es viable.

No actualizar Expo “porque sí”.

Primero:

```text
npx expo-doctor
```

y revisar compatibilidad real.

---

# 67. COSAS OBSERVADAS COMO FUNCIONALES QUE NO SE DEBEN ROMPER

Según auditoría:

- validación de cuentas suspendidas;
- dominios institucionales;
- validaciones de usuario Admin;
- activación por enlace;
- activación por código;
- token usado;
- token caducado;
- nuevo token invalida anterior;
- cooldown de activación;
- plantillas diferenciadas estudiante/docente;
- normalización de código;
- categorías con `applies_to`;
- sociedad aislando drafts mejor que otros roles;
- no inscripción cuando actividad ya pasó.

Todas deben entrar como regresión.

---

# 68. DEFECTOS CRÍTICOS IDENTIFICADOS EN LA ÚLTIMA AUDITORÍA

## C1 — Importación bloquea válidos por inválidos

CORREGIR.

## C2 — Preview/import history genera basura

CORREGIR.

## C3 — Solicitud activación para cuenta ACTIVE

CORREGIR.

## C4 — Tags/skills con responsabilidades confusas

CORREGIR con taxonomía V3.2.

## C5 — Sugeridor `aws → Redes`

CORREGIR.

## C6 — Actividad multiárea falla con NULL activity_id

CORREGIR.

## C7 — Skills no persisten correctamente en actividad

CORREGIR.

## C8 — Ownership Admin/Director/Docente mezclado

CORREGIR.

## C9 — Draft de Docente visible antes de submit

CORREGIR.

## C10 — Creator puede editar después de APPROVED

CORREGIR.

## C11 — Fecha/hora cambia en edición

CORREGIR.

## C12 — Funciones Docente retiradas

RESTAURAR.

## C13 — Audit UI demasiado técnica

REDISEÑAR.

## C14 — Configuración técnica SMTP visible

RETIRAR de producto final.

## C15 — Recursos sin propósito claro

COMPLETAR como Biblioteca.

## C16 — Cards desiguales por descripción

CORREGIR.

## C17 — Participantes no responsive

CORREGIR.

---

# 69. DECISIONES QUE NO SE IMPLEMENTAN

No:

```text
tags puntuando afinidad
skills multiplicando score
crawler para inferir backend
OCR de screenshot certificando stack
IA como juez
multiaccount por pestaña
SBOM obligatorio
chat
materias/malla curricular
ranking público
```

---

# 70. MODELO LÓGICO MÍNIMO PARA TAXONOMÍA

No obliga nombres exactos de tabla.

```text
academic_area
  id
  code
  name
  description
  tags
  status

skill
  id
  code
  name
  primary_area_id
  aliases
  status

skill_area_relation
  skill_id
  area_id
  relation_type SECONDARY
```

Para experiencias:

```text
activity_area
activity_skill_context

project_area
project_skill_context

external_credential_area
external_credential_skill_context
```

El agente debe reutilizar tablas equivalentes si ya existen.

---

# 71. REGLA PARA EVITAR DOBLE CONTEO

```text
Proyecto + 5 skills
→ 1 contribución de proyecto al área
```

```text
Actividad + constancia
→ 1 experiencia
```

```text
Repo + language + manifest
→ evidencias del mismo proyecto
```

```text
10 screenshots
→ no 10 experiencias
```

---

# 72. BATCHES DE CIERRE

Estos batches NO significan reimplementar módulos que ya están correctos.

Cada batch:

```text
auditar
→ preservar lo correcto
→ corregir gap
→ migrar si hace falta
→ probar
→ documentar
```

---

# BATCH 0 — BASELINE Y MATRIZ DE GAPS

NO modificar código.

Generar:

```text
AUDITORIA_GAP_CIERRE_V3_2.md
PLAN_EJECUCION_CIERRE_V3_2.md
```

Comparar repositorio contra este documento.

Por cada punto:

```text
IMPLEMENTED
INCORRECT
PARTIAL
MISSING
OBSOLETE
REGRESSION
```

Ejecutar:

- shared build;
- api build;
- web build;
- tests existentes;
- migraciones pendientes.

---

# BATCH 1 — IMPORTACIÓN Y USUARIOS

Corregir:

- partial apply;
- preview temporal;
- historial limpio;
- columnas CSV;
- búsqueda automática;
- Limpiar visible;
- paginación;
- sorting;
- expiración de invitación visible.

Preservar:

- templates Student/Teacher;
- idempotencia;
- conflictos;
- normalización.

Pruebas:

- 200 existentes + 10 nuevos;
- conflicto no bloquea NEW;
- missing column;
- duplicate email;
- duplicate code;
- discard preview;
- reupload.

---

# BATCH 2 — ACTIVACIÓN Y SESIÓN

Corregir:

- ACTIVE no solicita nuevo email;
- countdown persistente;
- eliminar “Tengo el enlace” en prod;
- estado expiración Admin;
- refresh race si sigue presente.

Definir demo multi-rol con perfiles de navegador.

No implementar multiaccount por tab.

---

# BATCH 3 — TAXONOMÍA V3.2

Implementar:

- tags solo clasificación;
- aliases;
- área principal;
- áreas secundarias;
- sugeridor dinámico;
- exact matching prioritario;
- short token protection;
- bug AWS;
- warnings de catálogo.

Actualizar ayudas UI:

### Tags
“Palabras clave y conceptos del dominio que ayudan a clasificar nuevas habilidades. No afectan directamente la afinidad.”

### Alias
“Otros nombres de esta misma habilidad.”

### Área principal
“Área canónica principal de la habilidad.”

Pruebas:

- AWS → Cloud;
- Python → IA + Web secondary;
- Linux → Redes + secundarios;
- tag repetida;
- token `as`;
- alta de área nueva participa inmediatamente.

---

# BATCH 4 — ACTIVIDADES: INTEGRIDAD DE DATOS

Prioridad crítica.

Corregir:

```text
activity_areas.activity_id NULL
```

Asegurar:

- múltiples áreas;
- múltiples skills;
- mapping contextual;
- create;
- update;
- rollback transaccional;
- no pérdida de relaciones.

---

# BATCH 5 — ACTIVIDADES: FORMULARIO Y ESTADOS

Completar:

- title validation;
- start/end;
- modality;
- conditional location;
- meeting_url;
- resource_links[];
- multiple responsibles;
- searchable person combobox;
- image;
- capacity;
- semester scope;
- lifecycle.

Implementar acciones explícitas:

- Guardar borrador;
- Publicar;
- Enviar revisión.

---

# BATCH 6 — REVIEW, OWNERSHIP Y PERMISOS

Corregir:

- drafts privados;
- submit;
- cancel submit;
- observe;
- approve;
- reject;
- approved immutable para creator;
- Director management;
- Admin ownership separado;
- “Mis actividades” correcto;
- “Actividades de la carrera”.

Pruebas cruzadas con todos los roles.

---

# BATCH 7 — CARDS, PARTICIPANTES Y UX DE ACTIVIDADES

Corregir:

- card height;
- truncation;
- details;
- status CTA;
- grid participantes;
- filters;
- pagination;
- modal flicker;
- date/time.

---

# BATCH 8 — RESULTADOS INTERNOS Y EXTERNOS

Internal:

- participation;
- constancy;
- institution-issued certificate reference;
- external credential expected.

External:

- fixed evidence flow;
- evidence eligibility;
- reference validator;
- provider data.

---

# BATCH 9 — RECURSOS / BIBLIOTECA

Convertir Recursos en biblioteca permanente.

Agregar vista Estudiante.

- areas;
- skills;
- URL;
- type;
- provider;
- favorite;
- recommended resources.

No Afinidad.

---

# BATCH 10 — PERFIL, ONBOARDING Y RECOMENDACIONES

- tabs Mi Perfil;
- remove duplicated Interest page;
- questionnaire optional;
- declared data;
- recommendation model;
- resource favorite low weight;
- Activity “Me interesa” not model input;
- “No me interesa” feedback separado.

---

# BATCH 11 — PROYECTOS Y TAXONOMÍA CONTEXTUAL

- Draft;
- Active requirements;
- multi-area;
- skill contexts;
- repo;
- demo;
- screenshots;
- visibility;
- validation messages.

---

# BATCH 12 — GITHUB, DEMO Y BACKING

- repo;
- languages;
- manifests;
- cache;
- rate-limit;
- demo check;
- no crawler backend;
- skill provenance;
- project backing.

---

# BATCH 13 — EQUIPOS, CONTRIBUCIONES Y NOTIFICACIONES

- team needs;
- applications;
- team reuse;
- per-member confirmation;
- role;
- contribution;
- skills;
- notifications;
- audit.

---

# BATCH 14 — CREDENCIALES EXTERNAS

- new external;
- historical;
- URL;
- QR optional;
- native PDF;
- OCR;
- provider match;
- manual legacy fallback;
- backing.

---

# BATCH 15 — AFINIDAD V4 Y SUPPORT

Actualizar para skill multiárea.

Reglas:

- contextual area+skill;
- no tags;
- no skill multiplication;
- only authorized source families;
- explainability;
- snapshots versioned.

---

# BATCH 16 — DOCENTE

Restaurar:

- Activities of Career;
- student profiles;
- student projects;
- academic panel;
- needs;
- semester context.

Eliminar duplicación de paneles.

---

# BATCH 17 — DIRECTOR Y SOCIEDAD

Director:

- approvals;
- approved management;
- analytics tabs.

Sociedad:

- remove duplicate create view;
- metrics drill-down;
- participants;
- approved edit lock.

---

# BATCH 18 — ADMIN, AUDITORÍA Y SETTINGS

- human audit UI;
- filters;
- hide technical mail config;
- help;
- global grids;
- visible buttons.

---

# BATCH 19 — TRAYECTORIA, PRIVACIDAD, QR Y CURRÍCULO

- trajectory;
- backed status;
- profile visibility;
- contacts;
- QR;
- curriculum section selection;
- item selection;
- preview;
- export.

---

# BATCH 20 — MOBILE

Solo después de web/backend stable.

- Expo doctor;
- compatibility;
- student flows;
- notifs;
- activities;
- resources;
- projects;
- profile;
- trajectory.

---

# BATCH 21 — QA FINAL

Ejecutar:

- unit;
- integration PostgreSQL;
- E2E;
- authorization negatives;
- CORS/session;
- file security;
- SSRF;
- GitHub fallback;
- SMTP fallback;
- OCR fallback;
- responsiveness;
- usability.

No afirmar resultados no ejecutados.

---

# BATCH 22 — CLEANUP Y DOCUMENTACIÓN

Retirar:

- views redundantes;
- technical mail menu;
- old tags wording;
- old skill single-area assumptions where superseded;
- old recommendation behavior;
- stale routes;
- old generic evidence UI.

Actualizar:

- Swagger;
- README;
- `.env.example`;
- diagrams;
- Chapter II;
- Chapter III;
- traceability.

---

# 73. CRITERIOS DE ACEPTACIÓN DE CIERRE

## Usuarios/import

- se aplican filas válidas aunque existan conflictos;
- no preview basura;
- búsqueda instantánea;
- expiración visible.

## Activación

- active account no manda correo;
- cooldown persiste;
- token anterior invalida;
- código y botón funcionan.

## Taxonomía

- tags no puntúan;
- alias reconoce misma skill;
- skill puede tener áreas secundarias;
- selector filtra correctamente;
- AWS no sugiere Redes sin razón.

## Actividad

- 2+ áreas se guardan;
- skills se guardan;
- fechas correctas;
- ownership correcto;
- lifecycle correcto;
- review correcto;
- creator no edita approved.

## Recursos

- estudiante puede acceder;
- son permanentes;
- pueden recomendarse;
- no afinidad.

## Proyecto

- Draft incompleto;
- Active exige;
- GitHub;
- demo optional;
- screenshot contextual;
- skill no detectada no penaliza.

## Afinidad

- solo evidencia autorizada;
- skill contextual;
- no tags;
- no multiplicar por skill.

## Currículo

- secciones;
- ítems concretos;
- elegibilidad;
- preview;
- no inventa.

## Docente

- funciones restauradas.

## UX

- grids;
- modals;
- cards;
- filters;
- buttons;
- mobile responsive.

---

# 74. MATRIZ DE DECISIONES QUE RESUELVE CONTRADICCIONES

| Tema | Decisión final |
|---|---|
| Tags de área | Metadata para clasificar/sugerir; NO motor |
| Habilidad | Dato granular real y respaldable |
| Skill en varias áreas | 1 principal + 0..N secundarias |
| Afinidad skill multiárea | usa contexto explícito de la experiencia |
| Código de área/skill | identificador; NO score |
| Categoría | clasificación de actividad; NO motor |
| “Me interesa” actividad | favorito/notificación; NO perfil |
| Recursos | biblioteca permanente; NO actividad |
| Recursos y recomendación | perfil + favorito explícito de recurso como señal secundaria |
| Admin y actividad | puede crear/publicar excepcionalmente |
| Student responsable | contacto operativo, NO autoridad |
| Publicar por Guardar | NO; acción explícita |
| External Opportunity | evidencia externa esperada |
| Internal outcome | configurable |
| QR certificado | opcional |
| OCR | extracción, no autenticidad |
| IA | asistencia, no autoridad |
| GitHub | language/manifest, no dominio |
| Demo URL | disponibilidad, no backend |
| Browser multirole | perfiles separados; no multiaccount por pestaña |
| Proyecto | Draft → Active con requisitos |
| Skill no detectada | DECLARED, no FALSE |
| Afinidad | por área, no % de dominio skill |
| Chat | retirado |

---

# 75. INSTRUCCIÓN OPERATIVA PARA CLAUDE CODE / CODEX

Al recibir este documento:

1. leerlo completo;
2. no programar inmediatamente;
3. ejecutar BATCH 0;
4. inspeccionar el repositorio real;
5. producir GAP;
6. indicar qué puntos ya están cerrados;
7. indicar qué puntos son regresiones;
8. proponer orden concreto de archivos/migraciones;
9. esperar aprobación del usuario antes del primer batch de código si así se solicita.

Nunca asumir que porque el documento diga “corregir” el archivo actual sigue igual.

La auditoría fue realizada sobre una versión concreta; algunos puntos pueden haber sido arreglados después.

Por eso:

```text
verificar primero
→ cambiar después
```

---

# 76. FORMATO DE REPORTE POR BATCH

```text
BATCH:
ESTADO:

Objetivo:
-

Hallazgos:
-

Ya estaba correcto:
-

Cambios:
-

Migraciones:
-

Archivos modificados:
-

Pruebas ejecutadas:
-

Resultados:
-

Regresiones:
-

Pendientes:
-

Riesgos:
-
```

---

# 77. DEFINICIÓN FINAL DE AFINIA

Afinia se considera coherente cuando puede explicarse de esta forma:

> El estudiante declara lo que le interesa y quiere mejorar para recibir recomendaciones. Participa en experiencias internas que la Universidad confirma, puede completar oportunidades externas que requieren evidencia del proveedor y construye proyectos cuyo respaldo se apoya en repositorios, manifests, demos, evidencias contextuales y confirmaciones de integrantes. Afinia organiza esas señales, conserva su procedencia y calcula afinidad por áreas sin convertir el resultado en una nota o certificación. El estudiante utiliza esa trayectoria para colaborar, mostrar su perfil y construir un currículo seleccionando únicamente las experiencias que desea presentar y cuyo nivel de respaldo sea suficiente.

---

# 78. REGLA FINAL DE DISEÑO

Antes de agregar un campo preguntar:

```text
¿el sistema ya conoce este dato?
¿puede inferirse de una relación real?
¿lo necesita un motor?
¿solo es metadata?
¿el usuario debería escribirlo?
¿puedo evitar trabajo duplicado?
```

Antes de validar evidencia preguntar:

```text
¿qué demuestra realmente esta fuente?
¿estoy diciendo más de lo que puedo probar?
¿qué pasa cuando la fuente falla?
¿estoy penalizando al estudiante por una limitación del sistema?
```

Antes de crear una nueva arquitectura preguntar:

```text
¿ya existe una estructura adaptable?
```

---

# FIN
## AFINIA — ESPECIFICACIÓN DE CIERRE FINAL V3.2
