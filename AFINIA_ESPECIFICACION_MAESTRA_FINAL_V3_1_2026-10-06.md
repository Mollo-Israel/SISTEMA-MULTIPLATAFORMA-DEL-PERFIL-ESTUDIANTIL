# AFINIA — ESPECIFICACIÓN MAESTRA FINAL V3

**Versión:** 3.1 — Fuente de verdad funcional, técnica y de UX posterior a auditoría final  
**Fecha de cierre:** 06 de octubre de 2026  
**Proyecto:** Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico en Ingeniería en Sistemas Informáticos – Univalle  
**Destinatario:** Claude Code, Codex u otro agente de desarrollo que trabaje sobre el repositorio actual de Afinia  
**Estado:** FUENTE DE VERDAD OBJETIVO PARA LA CORRECCIÓN FINAL POR BATCHES  
**Sustituye funcionalmente:** `AFINIA_ESPECIFICACION_MAESTRA_FINAL_V2_2026-10-03.md` en todo punto donde exista contradicción  
**Integra:** auditoría funcional/UX `corregir v2.docx`, decisiones posteriores del propietario del proyecto y verificación de viabilidad técnica de GitHub, credenciales verificables, OCR/visión y URLs.
**Ajuste V3.1:** cierra la estrategia obligatoria de validación para nuevas oportunidades externas y el fallback manual excepcional para credenciales históricas sin verificador digital.

---

# 0. PROPÓSITO

Este documento define el comportamiento final esperado de Afinia.

No es:

- una invitación a reescribir el sistema desde cero;
- una lista de ideas opcionales;
- una excusa para crear arquitectura adicional;
- un prototipo;
- un documento de marketing;
- una autorización para inventar resultados de validación.

Debe interpretarse como:

> **Contrato de funcionamiento, reglas de negocio, experiencia de usuario, integridad, evidencia y pruebas que deben coincidir con el software final.**

Todo cambio debe poder trazarse:

```text
PROBLEMA
  ↓
OBJETIVO
  ↓
REQUISITO
  ↓
REGLA DE NEGOCIO
  ↓
CASO DE USO
  ↓
IMPLEMENTACIÓN
  ↓
PRUEBA
  ↓
EVIDENCIA
```

Si una función no puede justificarse dentro de esa cadena, no pertenece al núcleo o requiere revisión explícita.

---

# 1. PRECEDENCIA

Orden de autoridad:

1. este documento V3;
2. decisiones explícitas posteriores del propietario;
3. `corregir v2.docx` cuando no contradiga decisiones posteriores;
4. `AFINIA_ESPECIFICACION_MAESTRA_FINAL_V2_2026-10-03.md` cuando no sea contradicho;
5. software actual;
6. documentación histórica.

El agente no debe resolver contradicciones en silencio.

Debe:

```text
detectar
→ registrar
→ explicar
→ aplicar V3
→ migrar de forma controlada
→ probar
→ documentar
```

---

# 2. REGLAS DE TRABAJO PARA CLAUDE / CODEX

Antes de modificar un módulo:

1. revisar rama, `git status` y commits recientes;
2. inspeccionar implementación real del módulo;
3. revisar entidades, migraciones, servicios, endpoints y UI existentes;
4. revisar contratos de `shared`;
5. revisar pruebas existentes;
6. clasificar la diferencia contra V3 como IMPLEMENTADO, IMPLEMENTADO PERO INCORRECTO, PARCIAL, FALTANTE u OBSOLETO;
7. corregir solo el alcance del batch;
8. ejecutar build y pruebas del batch;
9. reportar regresiones reales;
10. no afirmar PASS sin ejecución.

Prohibido por costumbre:

- reescribir el proyecto completo;
- crear microservicios;
- duplicar servicios existentes;
- crear nuevas tablas si una estructura actual puede adaptarse;
- reescribir migraciones históricas aplicadas;
- usar `synchronize=true`;
- borrar historia para “arreglar” datos;
- hardcodear puertos, secretos, dominios, scores o IDs;
- convertir IA en autoridad;
- inventar que una evidencia fue validada;
- avanzar al siguiente batch con compilación rota;
- usar `db:reset` como solución a un defecto de migración;
- quitar una función sin reemplazar su valor cuando V3 indique compensación.

La implementación debe adaptarse a la arquitectura existente.

---

# 3. VISIÓN DEL PRODUCTO

Afinia construye una trayectoria académica complementaria del estudiante y ayuda a aprovecharla.

No es SIU, LMS, sistema de notas, sistema de materias, red social general, reemplazo de Teams, reemplazo de GitHub, certificadora profesional, autoridad legal de autenticidad, evaluador psicológico ni ranking de “mejores estudiantes”.

Afinia reúne identidad institucional, perfil, intereses, áreas que desea mejorar, actividades internas, oportunidades/cursos externos, participación institucional confirmada, proyectos, integrantes y contribuciones, evidencias, repositorios, demos, credenciales externas, constancias internas, retroalimentación, afinidad, respaldo, recomendaciones, equipos, contactos, notificaciones, evolución y currículo seleccionable.

Objetivo:

> **Que el estudiante pueda construir de manera autónoma una trayectoria útil y curricular, mientras el sistema reutiliza datos, reduce trabajo manual y diferencia con claridad lo declarado de lo respaldado.**

---

# 4. PRINCIPIO CENTRAL DE UX: EL SISTEMA DEBE AYUDAR A COMPLETAR

Afinia no debe tratar todos los campos como inputs aislados.

Cuando una relación del dominio ya existe, la UI debe utilizarla.

```text
ÁREA(S)
  ↓
solo se cargan habilidades pertenecientes a esas áreas
  ↓
el usuario elige entre un conjunto pertinente
  ↓
se guardan IDs reales
```

Aplicar este principio donde exista relación semántica real:

- área → habilidades;
- actor → tipos de actividad permitidos;
- actividad interna → participantes;
- oportunidad externa → estudiantes elegibles para adjuntar credencial;
- semestre → alcance de docente;
- equipo → integrantes disponibles al crear proyecto;
- proyecto → evidencias de ese proyecto;
- credencial externa → oportunidad externa relacionada;
- currículo → elementos elegibles existentes;
- perfil → campos de visibilidad.

NO inventar relaciones solo para “automatizar”. Una categoría como Taller, Charla o Seminario puede ser transversal a varias áreas.

---

# 5. PRINCIPIOS NO NEGOCIABLES

## 5.1 Declaración ≠ respaldo

```text
“Me interesa React”
→ personalización/recomendaciones
```

No:

```text
“Me interesa React”
→ afinidad
```

Una tecnología declarada en un proyecto no es falsa si no se pudo detectar. Debe quedar como `DECLARED / NO_CORROBORADA_AUTOMATICAMENTE`.

## 5.2 Afinidad ≠ dominio profesional

Un score por área representa trayectoria respaldada dentro de Afinia. No representa porcentaje de dominio profesional, nota, certificación, inteligencia ni probabilidad de éxito.

## 5.3 IA ≠ autoridad

La IA puede extraer, resumir, sugerir, clasificar tentativamente, señalar incoherencias, ayudar a redactar e interpretar una captura de forma contextual.

La IA no puede por sí sola autenticar legalmente un certificado, certificar una habilidad, aprobar una actividad, confirmar asistencia, aumentar afinidad, cambiar backing ni emitir constancia.

## 5.4 La ausencia de prueba no equivale a falsedad

Si Afinia no puede corroborar Redis:

```text
Redis
→ declarada
→ no corroborada automáticamente
```

No se penaliza al estudiante. Esa señal simplemente no adquiere el mismo nivel de respaldo hasta existir otra fuente válida.

## 5.5 Evidencia fuerte antes que cantidad

Diez capturas del mismo proyecto no deben valer diez veces. El sistema busca fuentes independientes, no volumen de archivos.

## 5.6 Procedencia siempre visible

Toda señal importante debe saber de dónde vino:

```text
INTEREST_DECLARED
ACTIVITY_CONFIRMED
EXTERNAL_CREDENTIAL
PROJECT_REPOSITORY
GITHUB_LANGUAGE
GITHUB_MANIFEST
PROJECT_DEMO
PROJECT_SCREENSHOT
TEAM_MEMBER_CONFIRMATION
TEACHER_FEEDBACK
INTERNAL_CONSTANCY
AI_SUGGESTION
```

## 5.7 Privacidad

Lo que no necesita exponerse no se expone.

## 5.8 No duplicar herramientas externas

- GitHub aloja código; Afinia lo relaciona y corrobora señales.
- Cisco/IBM/etc. emiten credenciales; Afinia las registra y corrobora.
- Teams comunica; Afinia no implementa chat.
- Afinia no intenta ser un navegador/crawler universal.

---

# 6. ACTORES DEFINITIVOS

Se mantienen cinco actores humanos:

```text
STUDENT
TEACHER
CAREER_DIRECTOR
SCIENTIFIC_SOCIETY
ADMIN
```

## 6.1 Estudiante

Web + Mobile.

Puede activar cuenta, recuperar acceso, completar onboarding, gestionar perfil e intereses, indicar áreas/habilidades que desea explorar o mejorar, consultar oportunidades, marcar interés, solicitar inscripción, consultar confirmaciones, registrar proyectos, usar equipos existentes al crear proyecto, confirmar su propia contribución, adjuntar evidencias de proyecto, registrar credenciales externas históricas, adjuntar credenciales de oportunidades externas finalizadas, consultar afinidad y respaldo, recibir recomendaciones, gestionar perfil compartible, compartir QR, gestionar contactos, postular a equipos, consultar trayectoria y construir currículo seleccionando secciones e ítems concretos.

No puede modificar correo institucional, código universitario, rol, estado, datos institucionales autorizados, confirmación de asistencia propia ni constancia institucional propia.

## 6.2 Docente

Web.

Puede operar dentro de TeacherScope, crear actividades internas académicas, proponer oportunidades externas pertinentes, enviar a revisión del Director, corregir observaciones, gestionar participantes de sus actividades, confirmar asistencia en actividades internas propias, consultar estudiantes permitidos, consultar proyectos visibles, registrar feedback y participar en necesidades/equipos cuando corresponda.

No puede aprobar su propia propuesta que requiera Dirección, ver estudiantes fuera del scope ni emitir certificación profesional.

## 6.3 Director de Carrera

Web.

Puede crear actividades internas académicas, crear oportunidades externas, publicar sus propias propuestas sin una autoridad ficticia superior, aprobar/observar/rechazar propuestas de Docente y Sociedad, consultar analítica agregada, supervisar constancias, gestionar participantes cuando sea responsable, consultar tendencias y mapa de afinidad y administrar recursos académicos permitidos.

## 6.4 Sociedad Científica

Web.

Puede crear actividades internas extracurriculares, proponer oportunidades externas de carácter complementario, enviar a Dirección, corregir observaciones, gestionar sus participantes, confirmar asistencia y consultar métricas de sus actividades.

No puede crear actividad académica oficial de carrera, aprobarse a sí misma ni consultar analítica global privada.

## 6.5 Administrador

Web.

Es autoridad técnica/operativa del sistema.

Puede provisionar, importar, corregir datos institucionales, gestionar catálogos, configurar alcance docente, crear actividades/oportunidades de forma excepcional/operativa, publicar directamente cuando actúa como Admin según política V3, registrar el responsable académico/operativo correspondiente, gestionar configuración y auditar.

Regla crítica:

> **Que Admin pueda crear/publicar excepcionalmente una actividad no convierte al Admin en emisor académico automático.**

Si la actividad interna genera constancia o reconocimiento institucional debe existir un responsable válido, la asistencia debe ser confirmada por el responsable permitido y `issued_by` debe conservar la procedencia real.

Admin nunca “inventa” asistencia o competencia solo por estar por encima técnicamente.

---

# 7. CÓDIGO UNIVERSITARIO E IMPORTACIÓN

Todos los actores pueden conservar un `university_code` único con prefijos controlados.

Su función principal es unicidad institucional, importación, auditoría y referencias internas. No alimenta afinidad ni recomendaciones.

## 7.1 Importación masiva

Se soportan como mínimo dos modalidades en la misma experiencia de importación.

### Estudiantes

```text
university_code
first_name
last_name
institutional_email
semester/current_semester
```

### Docentes

```text
university_code
first_name
last_name
institutional_email
authorized_semesters[]
```

No es necesario padrón masivo para Director, Sociedad y Admin porque son pocos y se crean manualmente.

La UI puede usar `Importar padrón [Estudiantes] [Docentes]` o autodetectar el esquema de forma segura.

Siempre debe existir preview: `NEW`, `UPDATE`, `UNCHANGED`, `CONFLICT`, `INVALID`.

Importación idempotente.

---

# 8. SEMESTRE Y ALCANCE

No modelar materias, no copiar malla curricular y no asociar materias oficiales a áreas.

## 8.1 Estudiante

Mantener `current_semester` como dato institucional principal.

Para casos excepcionales de arrastre/repetición puede existir `academic_scope_semesters[]`.

Ejemplo:

```text
current_semester = 2
academic_scope_semesters = [1,2]
```

El estudiante no edita estos campos. Admin autorizado los gestiona.

## 8.2 Docente

Puede tener múltiples semestres habilitados.

```text
teacher_scope = [1,5]
```

La pantalla independiente de “alcance docente” se retira si duplica Usuarios.

En Gestión de usuarios:

```text
filtrar Docentes
→ Configurar semestres
```

---

# 9. TAXONOMÍA: ÁREAS, HABILIDADES, TAGS, ALIASES Y CÓDIGOS

## 9.1 AcademicArea

Área amplia: Desarrollo Web, Bases de Datos, Desarrollo Móvil, IA, Ciberseguridad, Redes, Ingeniería de Software, Gestión de Proyectos, etc.

Campos:

```text
id
code
name
description?
tags[]
status
```

`code` es identificador estable y NO puntúa ni alimenta un motor por sí mismo.

`tags` ayudan a reconocer/clasificar y sirven para sugerencias, pero no reemplazan relaciones por ID.

## 9.2 Skill

Tecnología/capacidad granular:

```text
React
React Native
NestJS
PostgreSQL
Python
Docker
MongoDB
```

Campos:

```text
id
code
name
academic_area_id
aliases[]
status
```

Reglas: área obligatoria, código único, nombre único normalizado, aliases múltiples y soporte de nombres técnicos reales (`C++`, `C#`, `.NET`, `Node.js`, `CI/CD`).

## 9.3 Sugerencia de área

Cuando Admin escribe una habilidad desconocida:

```text
nombre + aliases
→ comparar catálogo dinámico actual
→ sugerir área(s)
```

NO debe depender únicamente de una tabla hardcodeada.

Debe consultar tags de áreas, aliases y skills ya clasificadas. Esto es clasificación determinista basada en datos actuales, no ML.

IA opcional puede sugerir, nunca guardar sola.

## 9.4 Protección contra tags basura

Al crear/editar área:

- normalizar;
- advertir tags demasiado genéricas;
- detectar colisiones semánticas;
- mostrar áreas que comparten tags;
- requerir confirmación explícita si hay conflicto;
- bloquear duplicados exactos.

No significa que una tag jamás pueda repetirse; significa que la UI debe hacer visible el riesgo.

## 9.5 Regla de uso

Los motores consumen IDs/relaciones confirmadas. Tags/aliases ayudan a llegar a esos IDs.

---

# 10. AUTENTICACIÓN, ACTIVACIÓN Y CORREO

Se mantiene la lógica V2:

```text
Admin provisiona
→ PENDING_ACTIVATION
→ correo institucional
→ enlace principal + código fallback
→ contraseña
→ ACTIVE
```

Valores iniciales:

```text
ACTIVATION_TOKEN_TTL_HOURS=48
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
ACTIVATION_RESEND_COOLDOWN_SECONDS=120
ACTIVATION_RESEND_MAX_PER_DAY=5
ACTIVATION_CODE_MAX_ATTEMPTS=10
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7
```

El enlace y el código representan el mismo evento. Usar uno invalida el otro. Persistir hashes.

SMTP real con adapter, errores explícitos, cola y sin afirmar entrega si SMTP falla.

La prueba del código de activación manual queda obligatoria.

---

# 11. ONBOARDING Y PERFIL

Secuencia:

```text
ACTIVE
 ↓
Perfil base
 ↓
Intereses por área
 ↓
Áreas a mejorar
 ↓
Habilidades/tecnologías de interés
 ↓
Habilidades/tecnologías a mejorar
 ↓
Disponibilidad / colaboración
 ↓
Privacidad básica
 ↓
Orientación opcional
 ↓
Sistema completo
```

Datos declarativos no aumentan afinidad; alimentan recomendaciones/personalización.

## 11.1 Perfil web

No debe parecer formulario vertical interminable.

Usar tabs/secciones:

```text
Sobre mí
Intereses y objetivos
Disponibilidad / colaboración
Visibilidad
```

La vista “Intereses y habilidades” no debe duplicarse en menú si ya vive dentro de Mi Perfil.

## 11.2 Avatar

Preferencia V3: catálogo de avatares/ilustraciones predeterminadas para evitar moderación de imágenes obscenas y simplificar privacidad.

---

# 12. MODELO UNIFICADO DE ACTIVIDADES Y OPORTUNIDADES

En UX, el Estudiante ve un único universo de oportunidades.

```text
OPORTUNIDADES
├── INTERNAL
│   ├── ACADEMIC
│   └── EXTRACURRICULAR
└── EXTERNAL
    └── curso/recurso/certificación de proveedor externo
```

Ejemplos INTERNAL: charla, clase espejo, taller, feria, actividad de Sociedad, seminario, evento académico.

Ejemplos EXTERNAL: Cisco, IBM, Microsoft Learn, Coursera y proveedores externos autorizados.

## 12.1 Campos comunes

```text
id
title
description
origin_type = INTERNAL|EXTERNAL
internal_type = ACADEMIC|EXTRACURRICULAR|null
category_id
areas[]
skills[]
start_at
end_at
modality
capacity?
registration_mode
location_or_link?
requirements?
semester_scope[]
responsible_user_id
created_by
status
review_status
```

Para EXTERNAL:

```text
provider
external_url
credential_expected
validation_reference_id?
expected_issuer_domains[]
expected_keywords[]
```

## 12.2 Quién crea

### Docente
- INTERNAL ACADEMIC dentro de scope;
- puede proponer EXTERNAL pertinente;
- requiere Director.

### Sociedad
- INTERNAL EXTRACURRICULAR;
- puede proponer EXTERNAL complementaria;
- requiere Director.

### Director
- INTERNAL ACADEMIC;
- EXTERNAL;
- `review_status=NOT_REQUIRED`.

### Admin
- INTERNAL o EXTERNAL de forma excepcional/operativa;
- `review_status=NOT_REQUIRED`;
- debe registrar responsable correspondiente;
- no se convierte automáticamente en emisor académico.

## 12.3 Revisión

```text
PENDING
OBSERVED
APPROVED
REJECTED
NOT_REQUIRED
```

Docente/Sociedad:

```text
DRAFT
→ SUBMIT
→ PENDING
→ Director
   ├─ APPROVED
   ├─ OBSERVED
   └─ REJECTED
```

Director/Admin: `NOT_REQUIRED`.

Una oportunidad solo es visible cuando su revisión lo permite.

---

# 13. PARTICIPACIÓN INTERNA

Estados:

```text
INTERESTED
REGISTERED
CONFIRMED
ABSENT
CANCELLED
```

El estudiante marca interés, solicita/se registra y cancela según reglas.

El responsable confirma o marca ausencia.

Solo `CONFIRMED` representa experiencia institucional.

## 13.1 No pedir evidencia al estudiante

Para INTERNAL el responsable ya conoce inscripción/asistencia. Por tanto NO existe el flujo “estudiante sube screenshot para demostrar que fue”. La señal institucional es más fuerte que una autodeclaración.

---

# 14. RESULTADOS DE ACTIVIDAD INTERNA

Al crear actividad, el responsable define qué puede generarse al finalizar:

```text
NONE
INTERNAL_CONSTANCY
EXTERNAL_CREDENTIAL_EXPECTED
OTHER_AUTHORIZED_RESOURCE
```

La aprobación de Dirección incluye esta política cuando corresponda.

## 14.1 Constancia interna

Si:

```text
participation = CONFIRMED
AND activity.internal_constancy_enabled = true
```

el responsable autorizado emite la constancia. El sistema la adjunta automáticamente a la trayectoria del estudiante. El estudiante no vuelve a subirla.

Afinia registra y genera la constancia siguiendo la decisión del actor responsable. No se presenta como certificado profesional.

## 14.2 Credencial externa derivada de actividad interna

Si una actividad interna conduce a una credencial de tercero, Afinia registra la actividad, la entidad externa emite la credencial y el estudiante posteriormente registra/adjunta esa credencial para validarla como externa.

---

# 15. PARTICIPACIÓN EN OPORTUNIDAD EXTERNA

La inscripción no demuestra haber obtenido el certificado.

Separar:

```text
INTERESTED
→ REGISTERED/REQUESTED
→ ACCEPTED
→ fecha finalizada
→ EVIDENCE_ELIGIBLE
```

El responsable puede confirmar que el estudiante fue aceptado/registrado en la oportunidad.

Pero:

```text
ACCEPTED ≠ CREDENTIAL_EARNED
```

Cuando `accepted = true` y `end_at <= now`, la oportunidad aparece en el selector de `Adjuntar credencial / evidencia externa`.

---

# 16. CREDENCIALES EXTERNAS HISTÓRICAS

Un estudiante puede haber obtenido una credencial antes de que existiera Afinia.

No obligar a Admin a recrear una actividad histórica.

Flujo:

```text
Registrar credencial histórica
→ proveedor
→ nombre
→ fecha
→ ID de credencial si existe
→ URL de verificación si existe
→ archivo si existe
→ áreas
→ skills
→ validación técnica
```

No requiere oportunidad previa ni plantilla guía histórica.

Persistir `source = HISTORICAL_EXTERNAL`.

---

# 17. REFERENCIA DE VALIDACIÓN PARA NUEVAS OPORTUNIDADES EXTERNAS

Cuando un responsable crea una nueva oportunidad externa puede registrar una referencia de validación:

- ejemplo de certificado;
- PDF/imagen guía;
- nombre esperado del curso;
- proveedor;
- dominios oficiales conocidos;
- keywords;
- patrón de ID de credencial cuando se conozca.

Objetivo: facilitar extracción, comparar coherencia y reducir falsos positivos.

NO usar semejanza visual como autenticidad absoluta. Un archivo “parecido” a la plantilla no prueba que sea auténtico.

---

# 18. VALIDACIÓN DE CREDENCIAL EXTERNA

La validación debe ser escalonada.

## 18.1 QR no es obligatorio

No asumir que todos los certificados tienen QR. Soportar `QR_PRESENT` y `QR_ABSENT`. La ausencia de QR no invalida una credencial.

## 18.2 URL/QR oficial

Si existe URL/QR:

1. extraer URL;
2. validar esquema HTTP/HTTPS;
3. aplicar protección SSRF;
4. verificar dominio;
5. seguir redirects limitados;
6. recuperar página cuando sea técnicamente posible;
7. extraer metadata/texto público mínimo;
8. comparar nombre, curso, issuer y credential ID;
9. registrar resultado.

Posibles estados:

```text
VERIFIED_MATCH
REACHABLE_NO_STRUCTURED_PROOF
MISMATCH
INCONCLUSIVE
UNREACHABLE
```

Una web puede requerir JavaScript, CAPTCHA, rate limit, cambiar HTML o estar temporalmente caída. Por eso no se promete que cualquier URL de cualquier proveedor pueda validarse automáticamente.

Si falla técnicamente, no se marca falso; queda inconcluso.

## 18.3 Open Badges / credencial verificable

Si el proveedor entrega Open Badges 3.0 / Verifiable Credentials u otro formato firmado compatible, validar estructura, prueba criptográfica, issuer, subject/recipient y status cuando exista.

Esta es una señal muy fuerte, pero no todos los proveedores usan este estándar. No hacerlo requisito global.

## 18.4 PDF con texto nativo

Extraer primero texto nativo y comparar campos esperados.

## 18.5 Imagen o PDF escaneado

OCR sirve para nombre, título, proveedor, fecha, credential ID, URL/QR y texto relevante.

OCR NO determina por sí solo autenticidad.

## 18.6 IA visual opcional

Puede ayudar a extraer, resumir, marcar incoherencia visual o detectar que el documento parece no corresponder al tipo esperado.

No puede marcar `CORROBORATED` por sí sola.

---

# 19. BACKING DE CREDENCIAL EXTERNA

```text
DECLARED
SUPPORTED
CORROBORATED
FLAGGED
```

## DECLARED

Metadata sin evidencia suficiente.

## SUPPORTED

Ejemplos: archivo legible; OCR/texto coincide con identidad, proveedor y curso; plantilla esperada compatible; contexto de oportunidad previa coincide.

No constituye autenticidad fuerte.

## CORROBORATED

Requiere señal verificable fuerte, por ejemplo URL oficial que identifica la credencial y coincide, QR a verificación oficial que coincide, credential ID comprobado, Open Badge/VC verificable o adaptador oficial de proveedor cuando exista.

## FLAGGED

Contradicción significativa: nombre distinto, curso incompatible, issuer incompatible, URL a dominio no permitido, manipulación evidente o datos contradictorios.

No borrar automáticamente.

---

# 20. REGLA DE CONFIANZA

Afinia NO promete “90 % de precisión global para cualquier certificado del mundo” porque depende de la señal disponible.

Sí puede prometer:

```text
cuando existe una fuente oficial verificable,
Afinia la comprueba determinísticamente;
cuando solo existe OCR/archivo,
Afinia informa que el respaldo es parcial;
cuando no puede concluir,
no inventa una conclusión.
```

Este diseño es más defendible que asignar un porcentaje artificial de “autenticidad”.

---

# 21. PROYECTOS — PRINCIPIO GENERAL

Un proyecto puede guardarse antes de estar completo como `DRAFT`. No debe aparecer como experiencia respaldada.

Para pasar a `ACTIVE` debe cumplir requisitos mínimos.

## 21.1 Campos

```text
title
description?
areas[]
skills[]
repository_url
demo_url?
team_id?
visibility
status
```

## 21.2 Multiárea

Proyecto puede tener una o varias áreas.

Al seleccionar áreas:

```text
Área A
Área B
 ↓
mostrar solo skills de A y B
```

Las burbujas deben agruparse visualmente por área.

---

# 22. REQUISITOS PARA ACTIVAR/PUBLICAR PROYECTO

Para el alcance actual de Ingeniería en Sistemas:

```text
title ✓
>= 1 area ✓
>= 1 skill ✓
repository_url pública y válida ✓
integrantes confirmados cuando sea grupal ✓
contribución propia confirmada ✓
evidencia visual/contextual mínima ✓
```

`demo_url` es opcional, recomendable y agrega señal independiente.

Un `DRAFT` puede no cumplirlos.

## 22.1 Evidencia visual/contextual mínima

Puede ser captura(s) del funcionamiento, demo accesible, documentación visible o recurso de presentación.

Sirve para demostrar contexto/funcionalidad, no para certificar tecnología.

---

# 23. EVIDENCIAS DE PROYECTO

No existe una bandeja genérica mezclando actividades, proyectos y certificados.

Dentro de Proyecto:

```text
Repositorio
Demo
Capturas
Documentación
Integrantes
Contribuciones
Validación técnica
Feedback
Bitácora
```

Las evidencias del proyecto viven en el proyecto.

---

# 24. GITHUB — ALCANCE DEFINITIVO

La integración GitHub se mantiene porque ofrece señales técnicas verificables de forma razonable.

## 24.1 Qué consultar

Para repo público:

```text
repository exists
owner/name
default branch
updated_at/pushed_at
README presence
languages
tree limitado
manifests conocidos
```

No clonar repo completo.

## 24.2 Languages API

Usar el endpoint oficial de lenguajes. Retorna bytes de código por lenguaje. Esto corrobora presencia de lenguaje, no certifica dominio.

## 24.3 Manifest detection

Buscar únicamente archivos controlados:

```text
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
requirements.txt
pyproject.toml
pom.xml
build.gradle
Dockerfile
docker-compose.yml
```

Reglas deterministas:

```text
package.json contains "react"
→ skill candidate React

package.json contains "@nestjs/core"
→ skill candidate NestJS

package.json contains "pg"
→ señal de uso/cliente PostgreSQL

requirements.txt contains "fastapi"
→ FastAPI

docker-compose contains postgres service
→ señal adicional PostgreSQL
```

Importante: `dependency present ≠ dominio profesional`.

## 24.4 Skills detectadas

Cada skill del proyecto puede tener:

```text
DECLARED
CORROBORATED_BY_GITHUB_LANGUAGE
CORROBORATED_BY_MANIFEST
CORROBORATED_BY_ACADEMIC_REVIEW
```

Si no se detecta, queda `DECLARED`. No restar puntos y no marcar falso.

## 24.5 Tecnología nueva no catalogada

Si estudiante escribe una tecnología no existente:

```text
texto
→ normalización
→ sugerencia de área
→ posible solicitud/alta controlada
```

No crear skill global automáticamente sin política.

## 24.6 Rate limit y resiliencia

La integración debe cachear resultados, guardar timestamp, usar ETag cuando convenga, respetar rate-limit, usar token opcional por entorno y degradar con gracia.

Para repos públicos puede funcionar sin token, pero el entorno de demo/desarrollo debe soportar `GITHUB_TOKEN` para mayor cuota.

## 24.7 SBOM / dependency graph

No hacer SBOM requisito del núcleo. Puede investigarse como mejora opcional.

Razón: disponibilidad depende del repositorio/configuración y no es necesario para cumplir el objetivo. Manifests + languages ya ofrecen una implementación defendible y acotada.

---

# 25. COMPLEJIDAD DE GITHUB — DECISIÓN

Nivel estimado:

```text
MODERADO, CONTROLABLE
```

No requiere ML.

Implementación mínima:

1. validar URL GitHub;
2. parsear owner/repo;
3. GET repo;
4. GET languages;
5. GET tree o contents;
6. leer manifests conocidos;
7. ejecutar mapping determinista;
8. persistir resultado;
9. exponer explicación en UI;
10. cache/retry/rate limit.

No clonar ni ejecutar código del estudiante. No instalar dependencias del repo. No analizar todo el AST.

---

# 26. DEMO / HOSTING

Mantener `demo_url`.

Validar HTTP/HTTPS, accesibilidad, redirects seguros, HTTPS, status, título, metadata pública y timestamp.

Esto prueba `existe un despliegue accesible`.

No prueba `backend = NestJS` ni `database = PostgreSQL`.

Eliminar el objetivo de crawler universal para detectar backend/DB.

---

# 27. CAPTURAS DE PROYECTO

Mantener como evidencia contextual.

Validar tipo real, tamaño, hash SHA-256, ownership, metadata y duplicados.

OCR/IA pueden describir login visible, dashboard, formulario, pantalla móvil, gráfica o sistema aparentemente funcionando.

No pueden afirmar “esta captura demuestra NestJS” ni “esta captura demuestra autoría”.

---

# 28. BACKING DE PROYECTO

```text
DECLARED
SUPPORTED
CORROBORATED
REVIEWED
FLAGGED
```

## DECLARED

Proyecto todavía sin respaldo técnico suficiente. No elegible para afinidad fuerte ni currículo verificado.

## SUPPORTED

Existe repo válido y al menos una señal técnica/contextual utilizable.

## CORROBORATED

Debe existir:

```text
repo accesible
+
>= 1 corroboración técnica relevante
+
>= 1 señal independiente adicional
```

Señal técnica: language, manifest o dependency.

Señal independiente: demo accesible, confirmación de integrantes o evidencia contextual consistente.

## REVIEWED

Proyecto `SUPPORTED` o `CORROBORATED` + feedback docente registrado. No significa aprobación académica oficial.

## FLAGGED

Contradicción importante. No suma afinidad mientras siga flagged.

---

# 29. NO CASTIGAR LIMITACIONES DE AUTOMATIZACIÓN

Si el estudiante declara Redis y GitHub no permite corroborarlo con las reglas disponibles:

```text
Redis = DECLARED
```

No `Redis = FALSE`.

El proyecto puede seguir siendo corroborado por otras señales.

Si un Docente autorizado deja feedback específico y confirma la tecnología, puede registrarse `CORROBORATED_BY_ACADEMIC_REVIEW`.

---

# 30. INTEGRANTES Y CONTRIBUCIONES

No usar “votación por mayoría” como verdad. Usar **confirmación individual**.

```text
creador/integración de equipo propone:
- integrante
- rol
- contribución
- skills
        ↓
cada integrante recibe notificación
        ↓
confirma o solicita corrección de SU información
        ↓
cuando todos los requeridos confirman
→ proyecto puede activarse/publicarse
```

Esto impide que el líder se atribuya todo unilateralmente.

## 30.1 Roles de proyecto

Usar catálogo controlado amigable: Responsable, Frontend, Backend, Base de Datos, Mobile, QA, UX/UI, DevOps, Datos/IA, Documentación u otro controlado.

No usar el texto de rol como fuente directa de afinidad. La afinidad se basa en skills/evidencias corroboradas.

## 30.2 Contribución

Texto breve + skills. El estudiante confirma su propia contribución.

---

# 31. EQUIPOS ANTES DE PROYECTOS

Afinia debe permitir crear equipo como entidad real.

```text
Crear necesidad/equipo
→ objetivo
→ semestres objetivo
→ áreas
→ skills faltantes
→ cupos
→ estudiantes ven/postulan
→ responsable acepta/rechaza
→ equipo constituido
```

Luego al crear proyecto:

```text
Integrantes:
( ) agregar individualmente
( ) usar uno de mis equipos
```

Si usa equipo, precarga integrantes, conserva auditoría y cada integrante confirma su contribución cuando corresponda.

---

# 32. CONTACTOS Y QR

No chat.

QR contiene URL/slug opaco.

```text
A escanea perfil B
→ ve lo permitido
→ solicita contacto
→ B acepta/rechaza
→ contacto
```

Contacto permite acceso solo a los campos que la política de privacidad autoriza para contactos.

No usar número de contactos como indicador de habilidad.

---

# 33. NOTIFICACIONES

Notificaciones son módulo funcional, no detalle accesorio.

Eventos mínimos:

```text
ACCOUNT_ACTIVATION
ACTIVITY_INTEREST_REMINDER
ACTIVITY_REGISTRATION_ACCEPTED
ACTIVITY_STARTING
PARTICIPATION_CONFIRMED
EXTERNAL_EVIDENCE_AVAILABLE
PROJECT_MEMBER_CONFIRMATION_REQUIRED
PROJECT_CONTRIBUTION_CHANGED
TEACHER_FEEDBACK_RECEIVED
CONTACT_REQUEST
TEAM_APPLICATION
TEAM_APPLICATION_ACCEPTED
TEAM_APPLICATION_REJECTED
TEAM_INVITATION
```

## 33.1 Anti-spam

Para `REGISTERED`, recordatorio razonable, por ejemplo 1 día antes + horas antes.

Para `INTERESTED`, menos frecuencia.

No enviar repetidamente la misma alerta.

Persistir `type`, `recipient_id`, `entity_type`, `entity_id`, `dedupe_key`, `created_at`, `read_at`, `delivered_at`.

---

# 34. RECOMENDACIONES — DECISIÓN FINAL

El objetivo es recomendar lo que el estudiante quiere explorar, quiere mejorar, declaró como interés o señaló en onboarding. No encasillarlo por lo que ya sabe.

Por tanto el ranking base NO depende de afinidad como factor principal.

Consume:

```text
interested_areas
improvement_areas
interested_skills
improvement_skills
orientation
semester/context
availability
dismissal feedback
opportunity status/date/capacity
```

Ponderación inicial sugerida:

```text
40 % intereses explícitos
30 % áreas de mejora
15 % skills de interés/mejora
10 % orientación confirmada
 5 % feedback de recomendaciones
```

Aplicar filtros duros antes: visible, aprobada, abierta, fecha, semestre, capacidad, actor, tipo y recurso activo.

## 34.1 “No me interesa”

No modifica silenciosamente los intereses del perfil.

Guardar `RECOMMENDATION_DISMISSED` y reducir prioridad de oportunidades similares.

Para quitar un interés real: `Mi perfil → Intereses`.

## 34.2 UX

“Recomendaciones” deja de ser una gran pantalla aislada si duplica Actividades.

Dentro de Actividades/Oportunidades:

```text
[Para ti] [Todas] [Interesadas] [Inscritas] [Historial]
```

Cada recomendación explica por qué se muestra.

---

# 35. MOTOR DE AFINIDAD — VERSIÓN OBJETIVO

Debido al endurecimiento de fuentes, usar:

```text
AFFINITY_ENGINE_VERSION=4
```

Conservar snapshots anteriores. No sobrescribir V2/V3.

Afinidad V4 responde:

> **¿Qué tan relacionada está la trayectoria corroborada del estudiante con esta área dentro de Afinia?**

No calcula dominio.

## 35.1 Fuentes V4

Sí puntúan:

```text
INTERNAL_ACTIVITY_CONFIRMED
PROJECT_CORROBORATED_OR_REVIEWED
EXTERNAL_CREDENTIAL_CORROBORATED
```

No puntúan directamente intereses, áreas a mejorar, orientación, disponibilidad, contactos, puntos, badges, proyecto DRAFT, project skill solo declarada, certificado DECLARED/SUPPORTED, screenshots por cantidad ni IA.

## 35.2 Actividades

Solo `CONFIRMED`. Usar áreas/skills configuradas en la actividad.

```text
base 10
1ro 1.00
2do 0.70
3ro 0.50
4to+ 0.30
cap familia = 25
```

## 35.3 Proyectos

Solo `CORROBORATED` o `REVIEWED`.

Para cada integrante usar skills confirmadas y corroboradas para él.

```text
CORROBORATED → 18
REVIEWED     → 22
FLAGGED      → 0
```

Rendimiento:

```text
1ro 1.00
2do 0.75
3ro 0.50
4to+ 0.25
cap = 50
```

No repartir automáticamente todas las skills del proyecto a todos los integrantes.

## 35.4 Credenciales externas

Solo `CORROBORATED`.

```text
CORROBORATED → 15
```

Rendimiento:

```text
1ro 1.00
2do 0.75
3ro 0.50
4to+ 0.25
cap = 25
```

## 35.5 Resultado

```text
AFFINITY_SCORE =
round(
  min(
    100,
    ACTIVITY_POINTS +
    PROJECT_POINTS +
    EXTERNAL_CREDENTIAL_POINTS
  )
)
```

---

# 36. HABILIDADES DENTRO DE AFINIDAD

No inventar un score de dominio por skill.

La UI puede mostrar:

```text
Área: Desarrollo Web
Afinidad: 72/100

Habilidades respaldadas:
React
  - Proyecto A
  - Proyecto B
NestJS
  - Proyecto A
TypeScript
  - Proyecto A
  - Proyecto C
```

Esto da granularidad sin fingir `React = 87 % de dominio`.

---

# 37. SUPPORT / RESPALDO

Separado de afinidad.

Puede conservar `0..100` y `LOW | MEDIUM | HIGH`.

`SUPPORTED` puede aportar a support aunque todavía no aporte a Afinidad V4.

Regla:

```text
afinidad = trayectoria corroborada
support = fuerza/cantidad/diversidad de respaldo
```

Para HIGH exigir varias familias independientes.

---

# 38. EVITAR DOBLE CONTEO

```text
actividad + constancia
→ un evento de afinidad
→ constancia refuerza support
```

```text
proyecto + 10 screenshots
→ un proyecto
```

```text
repo + languages + manifest
→ corroboraciones internas del mismo proyecto
→ no tres proyectos
```

```text
mismo certificado repetido
→ no multiplica
```

SHA-256 obligatorio para duplicados de archivo.

---

# 39. BITÁCORA Y FEEDBACK DE PROYECTO

Bitácora: historial de cambios, miembros, cambio de evidencia, validación, visibilidad y contribuciones.

Por defecto: equipo + actores autorizados. No hacer pública toda la bitácora.

Feedback docente: visible a miembros y, si la política lo permite, a otros usuarios. No exponer información privada accidental.

---

# 40. PRIVACIDAD DE PROYECTO

Estados:

```text
PRIVATE
TEAM
TEACHERS
PROFILE
PUBLIC_LINK
```

El creador/equipo decide dentro de límites permitidos.

La información interna de auditoría no se vuelve pública únicamente porque el proyecto se comparta.

---

# 41. PERFIL DINÁMICO

Perfil = resumen, no toda la trayectoria.

Puede mostrar bio, áreas de interés, afinidades seleccionadas, proyectos seleccionados, actividades seleccionadas, credenciales seleccionadas, badges, disponibilidad y canales.

El usuario elige qué mostrar según política.

---

# 42. MI TRAYECTORIA / MI PROGRESO

Histórico completo: proyectos, actividades internas, constancias, oportunidades externas, credenciales externas, equipos, feedback, evolución, afinidad y support.

Debe distinguir:

```text
Declarado
Con respaldo
Corroborado
Revisado
Inconcluso
```

Usar lenguaje natural.

---

# 43. CURRÍCULO / RESUMEN CURRICULAR — DECISIÓN FINAL

El currículo NO selecciona únicamente “secciones”. Selección en dos niveles.

## 43.1 Paso 1 — secciones

```text
[ ] Perfil / resumen
[ ] Proyectos
[ ] Actividades académicas internas
[ ] Actividades extracurriculares internas
[ ] Credenciales / cursos externos
[ ] Constancias
[ ] Habilidades respaldadas
[ ] Insignias
[ ] Contacto
```

## 43.2 Paso 2 — ítems

Si marca Proyectos:

```text
[x] Sistema IoT
[ ] App de reservas
[x] Plataforma X
```

Si marca Actividades:

```text
[x] Clase espejo ...
[ ] Taller ...
```

Si marca Credenciales externas:

```text
[x] Cisco ...
[ ] IBM ...
```

El mismo principio para todas las secciones.

## 43.3 Solo mostrar ítems elegibles

### Proyecto elegible para currículo verificado

```text
status=ACTIVE
AND backing in {CORROBORATED, REVIEWED}
```

### Actividad interna elegible

```text
participation=CONFIRMED
```

Si existe constancia, puede incluirse.

### Credencial externa elegible

```text
backing=CORROBORATED
```

Una credencial `SUPPORTED` puede seguir en trayectoria, pero no se ofrece por defecto para currículo verificado.

## 43.4 Preview

```text
seleccionar
→ previsualizar
→ cambiar orden/selección permitida
→ generar PDF
```

No permitir editar hechos para convertirlos en otra cosa.

## 43.5 IA

Puede mejorar redacción de descripciones. Debe mostrar propuesta y el usuario confirma.

Nunca inventar cargo, tecnología, actividad, certificado, fecha o contribución.

## 43.6 Disclaimer

> Documento generado a partir de información registrada y respaldada en Afinia. No constituye historial académico oficial, certificación institucional ni acreditación profesional de competencias.

---

# 44. ACTIVIDADES INTERNAS EN CURRÍCULO

No exigir que siempre exista certificado.

Una actividad con `CONFIRMED` es una experiencia institucional trazable y puede entrar como “Participación confirmada en ...”.

Si además hay constancia, puede mostrar “Constancia interna disponible”. No duplicar como dos experiencias distintas.

---

# 45. ACTIVIDADES EXTERNAS EN CURRÍCULO

La oportunidad externa en sí no basta.

Para afirmar en currículo que el curso fue completado:

```text
external credential = CORROBORATED
```

`ACCEPTED/REGISTERED` solo prueba inscripción/contexto, no finalización.

---

# 46. VALIDATION ENGINE

Separado de afinidad.

Responsabilidades:

- hashes;
- OCR;
- PDF native text;
- QR;
- URL checks;
- provider domain;
- GitHub;
- demo URL;
- manifest parsing;
- identity matching;
- template/reference matching;
- reglas deterministas;
- IA auxiliar.

Estados:

```text
PENDING
PROCESSING
COMPLETED
INCONCLUSIVE
FAILED
```

Una integración caída no borra información.

---

# 47. IA ASISTENTE

Mantener adapter opcional:

```text
AI_PROVIDER=none|openai_compatible
```

Tareas permitidas:

```text
TAG_SUGGESTION
AREA_SUGGESTION
EVIDENCE_FIELD_EXTRACTION
EVIDENCE_SUMMARY
INCONSISTENCY_EXPLANATION
SCREENSHOT_CONTEXT_SUMMARY
CV_TEXT_ASSIST
ANALYTICS_NARRATIVE
CONTENT_MODERATION_FLAG
```

No producir decisiones autoritativas como `CERTIFICATE_AUTHENTIC=true`, `SKILL_VERIFIED=true` o `AFFINITY_SCORE=...` sin reglas deterministas externas.

Fallback obligatorio. Con `AI_PROVIDER=none` todo lo esencial funciona.

---

# 48. RECURSOS EXTERNOS — VALIDACIÓN NUEVA VS HISTÓRICA

## Nueva oportunidad

Ventajas: Afinia conoce proveedor, curso, fecha, estudiante aceptado, puede almacenar referencia y puede esperar dominios/keywords.

Esto aumenta capacidad de validación.

## Histórica

No existe referencia previa obligatoria.

Usar lo disponible:

```text
credential URL
QR
credential ID
PDF
image
OCR
issuer
name
date
```

Si solo existe archivo: `SUPPORTED`.

Si existe prueba oficial: `CORROBORATED`.

---

# 49. SEGURIDAD URL / SSRF

Toda URL suministrada por usuario o QR:

- solo HTTP/HTTPS;
- bloquear localhost;
- bloquear rangos privados;
- bloquear metadata cloud;
- resolver DNS de forma segura;
- limitar redirects;
- timeout;
- limitar tamaño;
- no descargar contenido arbitrario ilimitado.

Aplicar a credential verification, demo, external resource y generic link checker.

---

# 50. DASHBOARD ESTUDIANTE

La auditoría considera la idea actual correcta.

Debe saludar, mostrar progreso, mostrar acciones, mostrar “Para ti”, mostrar próximos eventos, tener cards navegables y evitar tablas como experiencia principal.

Es referencia visual para otros roles.

---

# 51. DOCENTE — UX FINAL

Evitar `Inicio` y `Panel académico` si ambos son resúmenes casi idénticos.

Preferir:

```text
Inicio / Panel académico
├── Resumen
├── Por semestre
├── Estudiantes
├── Proyectos visibles
├── Actividades
└── Necesidades/equipos
```

Drill-down, filtros, cards + gráficos + acciones. No solo tablas planas.

---

# 52. DIRECTOR — UX / BI FINAL

Evitar tres pantallas repetidas: Panel, Mapa, Tendencias.

Propuesta:

```text
Inicio
Aprobaciones
Actividades
Constancias
Recursos
Analítica
```

`Analítica`:

```text
[Panorama]
[Afinidad]
[Participación]
[Demanda]
[Evolución]
```

Afinidad = foto agregada actual de distribución por áreas.

Tendencia/Evolución = cambio histórico en el tiempo.

Demanda = qué actividades/recursos atraen interés, registros y confirmaciones.

Participación = inscritos/confirmados/ausentes por contexto.

No predecir rendimiento.

---

# 53. SOCIEDAD — UX FINAL

```text
Inicio
Mis actividades
Crear actividad
Participantes
Métricas
```

Inicio = resumen breve.

Métricas = filtros, periodo, categoría, área, comparación y click a actividad.

No duplicar un panel estático.

---

# 54. ADMIN — UX FINAL

```text
Inicio
Usuarios
Importar padrón
Áreas / habilidades
Categorías
Actividades / oportunidades operativas
Recursos/configuración
Gamificación
Auditoría
Ayuda/configuración técnica
```

No pantalla genérica de Roles. TeacherScope dentro de Usuarios. Catálogos con asistencia semántica.

---

# 55. COLABORACIÓN / NECESIDAD DE EQUIPO

Crear necesidad:

```text
purpose
target_semesters[]
areas[]
required_skills[]
max_members
availability
```

Área → solo skills de esa área.

Estudiante permitido ve la necesidad y puede Postular.

Responsable acepta o rechaza. Si rechaza puede registrar motivo controlado/breve.

No permitir abuso de texto libre innecesario. Usar motivos predefinidos + comentario opcional cuando ayude.

---

# 56. RECOMENDACIÓN DE PERSONAS

No popularidad y no ranking público.

Usar skills corroboradas, áreas pertinentes, availability, semester eligibility y support.

Afinidad puede ayudar aquí como contexto de equipo, no como ranking de valor humano.

Explicar: “Sugerido porque posee experiencia respaldada en React y disponibilidad compatible.”

---

# 57. GAMIFICACIÓN

Puede mantenerse. Es incentivo. No alimenta afinidad.

Puntos por eventos controlados.

No puntos por autodeclaración, spam, subir múltiples archivos o marcar intereses.

Recompensas físicas dependen de Universidad, no de Afinia.

---

# 58. ANALÍTICA Y TENDENCIAS

Descriptiva.

Datos: participación, demanda, áreas, skills presentes, proyectos corroborados, recursos consultados y evolución.

No predicción de abandono, nota, éxito laboral ni ranking de estudiantes.

IA puede redactar narrativa a partir de cifras deterministas.

---

# 59. PERFIL PÚBLICO

Opt-in. Slug rotable.

Nunca por defecto: email institucional, código universitario, IDs internos, archivos privados.

Campos individualmente configurables.

---

# 60. MOBILE

Student-only.

No clonar visualmente la web.

Flujos prioritarios: onboarding, perfil, actividades, oportunidades, proyectos, afinidad, notificaciones, trayectoria, colaboración y currículo/preview cuando sea viable.

Revisar Expo real antes de actualizar.

---

# 61. ESTRUCTURAS EXISTENTES A REVISAR

Adaptar cuando existan:

```text
users
teacher_semester_access
student_profiles
academic_areas
skills
student_interests
student_skill_interests
activity_categories
activities
activity_reviews
activity_registrations
internal_constancies
projects
project_members
project_member_skills
project_invitations
project_evidences
project_feedback
project_repository_checks
project_link_checks
external_certificates
external_certificate_skills
validation_records
affinity_results
affinity_contributions
affinity_snapshots
recommendations
public_profile_config
contact_requests
contacts
team_needs
teams
team_members
team_invitations
gamification_events
badges
ai_assistance_runs
audit_events
```

---

# 62. ESTRUCTURAS V3 PROBABLES

Crear solo si no existe equivalente:

```text
user_academic_scope_semesters
teacher_import_rows / import role discriminator
activity_areas
activity_skills
external_opportunity_validation_references
external_credential_checks
project_areas
project_skill_evidence
notifications
recommendation_feedback
trajectory_exports
trajectory_export_items
```

No crear todas automáticamente.

---

# 63. ESTADOS IMPORTANTES

## Cuenta

```text
PENDING_ACTIVATION
ACTIVE
SUSPENDED
INACTIVE
```

## Revisión actividad

```text
NOT_REQUIRED
PENDING
OBSERVED
APPROVED
REJECTED
```

## Lifecycle oportunidad

```text
DRAFT
PUBLISHED
OPEN
CLOSED
FINISHED
CANCELLED
```

## Participación interna

```text
INTERESTED
REGISTERED
CONFIRMED
ABSENT
CANCELLED
```

## Proyecto

```text
DRAFT
ACTIVE
ARCHIVED
```

## Backing proyecto

```text
DECLARED
SUPPORTED
CORROBORATED
REVIEWED
FLAGGED
```

## Credencial externa

```text
DECLARED
SUPPORTED
CORROBORATED
FLAGGED
```

## Validación

```text
PENDING
PROCESSING
COMPLETED
INCONCLUSIVE
FAILED
```

---

# 64. REGLAS DE ELEGIBILIDAD RESUMIDAS

Actividad interna aporta trayectoria:

```text
CONFIRMED
```

Constancia interna:

```text
CONFIRMED + política de constancia
```

Oportunidad externa permite adjuntar credencial:

```text
ACCEPTED/REGISTERED + FINISHED
```

Credencial externa aporta afinidad/currículo verificado:

```text
CORROBORATED
```

Proyecto puede ser visible como experiencia:

```text
ACTIVE + requisitos mínimos
```

Proyecto aporta afinidad/currículo verificado:

```text
CORROBORATED o REVIEWED
```

---

# 65. AUDITORÍA

Eventos mínimos:

```text
USER_PROVISIONED
IMPORT_APPLIED
ACCOUNT_ACTIVATED
SESSION_REVOKED
ACTIVITY_CREATED
ACTIVITY_SUBMITTED
ACTIVITY_APPROVED
ACTIVITY_OBSERVED
ACTIVITY_REJECTED
ACTIVITY_REGISTERED
PARTICIPATION_CONFIRMED
CONSTANCY_ISSUED
EXTERNAL_OPPORTUNITY_ACCEPTED
EXTERNAL_EVIDENCE_ENABLED
EXTERNAL_CREDENTIAL_CREATED
EXTERNAL_CREDENTIAL_CHECKED
EXTERNAL_CREDENTIAL_MANUAL_REVIEWED
PROJECT_CREATED
PROJECT_ACTIVATED
MEMBER_INVITED
MEMBER_ACCEPTED
CONTRIBUTION_CONFIRMED
PROJECT_EVIDENCE_ADDED
REPOSITORY_CHECKED
DEMO_CHECKED
PROJECT_BACKING_CHANGED
FEEDBACK_ADDED
AFFINITY_RECALCULATED
CONTACT_ACCEPTED
TEAM_APPLICATION_CREATED
TEAM_MEMBER_ACCEPTED
CURRICULUM_EXPORTED
AI_SUGGESTION_CREATED
AI_SUGGESTION_ACCEPTED
```

No loggear secretos.

---

# 66. SEGURIDAD DE ARCHIVOS

Storage privado.

Metadatos:

```text
original_filename
storage_key
mime_detected
size
sha256
uploaded_by
created_at
```

No confiar solo en extensión. Descarga siempre autorizada.

---

# 67. VALIDACIONES DE UI

Errores por campo. No depender del mensaje nativo del navegador.

Ejemplos:

- “Selecciona al menos un área.”
- “El repositorio es obligatorio para activar el proyecto.”
- “Esta habilidad pertenece a otra área.”
- “La oportunidad todavía no finalizó; podrás adjuntar tu credencial después.”
- “No pudimos corroborar esta tecnología automáticamente; seguirá como declarada.”
- “La URL de verificación no pertenece a un dominio esperado.”
- “Tu contribución requiere confirmación.”

---

# 68. UX: EVITAR CRUD GENÉRICO

Estudiante: cards, tabs, progresos, badges de estado, explicaciones, CTAs y no jerga técnica.

Institucionales: tabla cuando aporta, filtros, drill-down, gráficos, cards de acción y vistas con propósitos diferentes.

No tener tres dashboards iguales con nombres distintos.

---

# 69. RF V3

## RF01 — Provisionar e importar cuentas
Admin crea manualmente e importa Estudiantes/Docentes.

## RF02 — Activar y recuperar cuenta
Link + code + SMTP.

## RF03 — Gestionar sesión
Login, refresh, logout, revocación.

## RF04 — Gestionar usuarios y alcance académico
Roles fijos, estados, semestres, TeacherScope.

## RF05 — Gestionar taxonomía
Áreas, skills, aliases, tags, categorías.

## RF06 — Gestionar onboarding/perfil
Intereses, mejora, skills de interés, privacidad.

## RF07 — Gestionar oportunidades internas/externas
Creación, revisión, publicación.

## RF08 — Gestionar participación interna
Interés, inscripción, confirmación, ausencia.

## RF09 — Gestionar resultados internos
Constancias/recursos decididos por responsables.

## RF10 — Gestionar oportunidad externa
Registro/aceptación/elegibilidad de evidencia.

## RF11 — Registrar credencial externa histórica
Sin oportunidad previa obligatoria.

## RF12 — Validar credencial externa
URL, QR, OCR, archivo, issuer, estándar verificable.

## RF13 — Gestionar proyecto
Draft, active, áreas, skills, repo, demo, visibilidad.

## RF14 — Gestionar equipo de proyecto
Integrantes y confirmaciones.

## RF15 — Gestionar contribución individual
Rol, contribución, skills confirmadas.

## RF16 — Corroborar repo GitHub
Metadata, languages, manifests, skills detectables.

## RF17 — Verificar demo
Accesibilidad y metadata.

## RF18 — Gestionar evidencias de proyecto
Contextuales, privadas y deduplicadas.

## RF19 — Calcular backing
Proyecto y credencial.

## RF20 — Calcular Afinidad V4
Solo trayectoria corroborada.

## RF21 — Calcular Support
Respaldo separado.

## RF22 — Generar recomendaciones
Intereses/objetivos + contexto, no encasillamiento.

## RF23 — Gestionar notificaciones
Eventos, read state, anti-spam.

## RF24 — Gestionar contactos/QR
Sin chat.

## RF25 — Gestionar necesidades/equipos
Semestre, áreas, skills, postulaciones.

## RF26 — Gestionar gamificación
Independiente de afinidad.

## RF27 — Gestionar trayectoria/perfil
Resumen e histórico.

## RF28 — Construir currículo seleccionable
Secciones + ítems concretos + preview + PDF.

## RF29 — Consultar panel docente
Scope y drill-down.

## RF30 — Consultar analítica institucional
Director/Sociedad según permisos.

---

# 70. RNF V3

## RNF01 Usabilidad
Relaciones contextuales, campos filtrados, tabs, mensajes claros, responsive y accesibilidad básica.

## RNF02 Seguridad
RBAC, resource policies, hash, sessions, rate-limit, CORS, SSRF y archivos privados.

## RNF03 Privacidad
Mínimo acceso, perfil opt-in y analytics agregada.

## RNF04 Integridad
FK, unique, transacciones, idempotencia e historial.

## RNF05 Explicabilidad
Afinidad, backing, recommendations y validation.

## RNF06 Resiliencia
GitHub/SMTP/OCR/URL/AI no derriban núcleo.

## RNF07 Mantenibilidad
Monolito modular y sin arquitectura innecesaria.

## RNF08 Configuración
`.env.example` y sin hardcodes.

## RNF09 Rendimiento
Async para validaciones lentas y cache GitHub/URL.

## RNF10 Veracidad
No elevar una señal más allá de lo que la fuente demuestra.

---

# 71. PRUEBAS OBLIGATORIAS

## Unitarias

- código universitario;
- import discriminada;
- semestre/scope;
- clasificación área-skill;
- review de actividad;
- lifecycle;
- participación;
- elegibilidad externa;
- credential backing;
- project backing;
- GitHub mapping;
- demo URL;
- affinity V4;
- support;
- recommendation feedback;
- notification dedupe;
- CV eligibility.

## Integración

- import Estudiante;
- import Docente;
- activación;
- código manual;
- login/refresh;
- TeacherScope;
- actividad Docente → Director → publicación;
- actividad Sociedad → Director;
- actividad Director;
- actividad Admin excepcional;
- participación interna → constancia;
- oportunidad externa → accepted → finalizada → evidence eligible;
- credencial histórica;
- credencial con URL;
- credencial con OCR inconcluso;
- credencial histórica sin verificador → revisión manual excepcional;
- proyecto draft → active;
- GitHub check;
- manifest mapping;
- demo check;
- member confirmation;
- backing;
- affinity;
- team → project;
- CV selection.

## E2E

Todos los actores web y Mobile Estudiante.

## Seguridad

Authorization negative, SSRF, CORS, file access, rate limit, session y secret leakage.

## Usabilidad

Tareas reales: crear skill sin equivocarse de área; registrar proyecto; entender tecnología “declarada vs corroborada”; registrar certificado externo; construir currículo seleccionando ítems; crear necesidad/equipo; confirmar contribución.

---

# 72. BATCHES FINALES DE IMPLEMENTACIÓN

## BATCH 0 — Baseline V3

Objetivo: no modificar funcionalidad aún; inventariar estado real.

Acciones: branch/status; build shared/api/web/mobile; migraciones pendientes; tests actuales; auditoría gap V3; mapa de entidades/endpoints/pantallas.

Salida:

```text
AUDITORIA_GAP_AFINIA_V3.md
PLAN_BATCHES_V3.md
```

## BATCH 1 — Configuración y reproducibilidad

- `.env.example`;
- Docker;
- puertos;
- `db:wait`;
- `db:rebuild`;
- shared build;
- secrets;
- SMTP;
- GitHub token opcional;
- AI optional.

No cambiar negocio.

## BATCH 2 — Identidad, códigos, importación y semestres

- university_code todos roles;
- prefijos;
- import Estudiante;
- import Docente;
- preview/idempotencia;
- `current_semester`;
- `academic_scope_semesters`;
- TeacherScope dentro de Usuarios;
- retirar pantalla duplicada.

## BATCH 3 — Activación, sesión y correo

- link;
- code fallback;
- code attempts;
- refresh concurrency;
- HttpOnly cookie web;
- SecureStore mobile;
- SMTP real;
- recovery;
- tests.

## BATCH 4 — Taxonomía inteligente y UX relacional

- áreas;
- skills;
- aliases múltiples;
- tags;
- colisiones;
- sugerencia dinámica;
- área → skills;
- multiárea;
- validaciones por campo.

No IA obligatoria.

## BATCH 5 — Perfil y onboarding

- tabs de Mi Perfil;
- quitar menú redundante;
- intereses;
- mejora;
- skills interés/mejora;
- disponibilidad;
- privacidad;
- orientación opcional;
- avatares controlados;
- UX.

## BATCH 6 — Modelo de actividades/oportunidades

- INTERNAL/EXTERNAL;
- ACADEMIC/EXTRACURRICULAR;
- campos comunes;
- responsible;
- Director/Admin NOT_REQUIRED;
- Teacher/Society review;
- multiárea;
- skills filtradas;
- migración de actividades actuales.

## BATCH 7 — Participación interna y resultados

- INTERESTED;
- REGISTERED;
- CONFIRMED;
- ABSENT;
- constancia automática tras decisión de responsable;
- eliminar evidencia self-service de actividad interna;
- outcome policy;
- auditoría.

## BATCH 8 — Oportunidades externas y credenciales

- ACCEPTED/eligibility;
- selector al finalizar;
- credential historical;
- validation reference para nuevas;
- file/URL/QR;
- backing;
- UX;
- notificación de evidencia disponible.

## BATCH 9 — Motor de validación de credenciales

Orden:

```text
native PDF text
→ QR/URL
→ OCR
→ identity/course/provider comparison
→ optional AI extraction
→ deterministic backing
```

- SSRF;
- domain validation;
- inconclusive;
- provider verifier abstraction solo si ya aporta;
- Open Badge/VC detection opcional;
- tests.

No prometer universalidad.

## BATCH 10 — Proyectos: modelo y UX

- DRAFT/ACTIVE;
- multiárea;
- skills;
- repo required for ACTIVE;
- demo optional;
- evidence contextual;
- visibility;
- mover evidencia genérica dentro de proyecto;
- requisitos para activar.

## BATCH 11 — GitHub y demo

- repository parser;
- repo metadata;
- languages;
- tree/contents;
- manifest detector;
- mapping skill;
- cache;
- rate-limit;
- timeout/retry;
- demo URL checker;
- no crawler backend;
- no SBOM obligatorio.

## BATCH 12 — Equipos de proyecto y contribuciones

- team reuse;
- miembros;
- rol controlado;
- contribución;
- skills por integrante;
- confirmación individual;
- notificaciones;
- bloqueo de publicación hasta confirmación requerida;
- bitácora.

## BATCH 13 — Backing de proyecto

- DECLARED;
- SUPPORTED;
- CORROBORATED;
- REVIEWED;
- FLAGGED;
- skill evidence status;
- no penalizar skill no detectable;
- teacher review;
- explicación UI.

## BATCH 14 — Afinidad V4 y Support

- versionado;
- migración snapshots;
- fuentes endurecidas;
- multiárea por skills corroboradas;
- contribution records;
- support;
- no doble conteo;
- recálculo automático;
- UI por área + skills respaldadas.

## BATCH 15 — Recomendaciones + feedback

- mover recomendaciones dentro de Actividades/Oportunidades;
- tabs;
- ranking por intereses/mejora;
- `RECOMMENDATION_DISMISSED`;
- explicación;
- hard filters;
- no modificar interés silenciosamente.

## BATCH 16 — Notificaciones

- centro de notificaciones;
- dedupe;
- read/unread;
- activity reminders;
- team/contact/project/feedback;
- evidence eligibility;
- frecuencia.

## BATCH 17 — Colaboración, contactos y equipos

- QR;
- contacts;
- privacy;
- need;
- target semesters;
- area → skills;
- application;
- accept/reject;
- team;
- usar team en project;
- chat sigue retirado.

## BATCH 18 — Trayectoria, perfil y currículo

- Mi trayectoria;
- niveles de respaldo;
- perfil resumido;
- curriculum builder;
- secciones;
- ítems;
- eligibility;
- preview;
- PDF;
- templates;
- AI text optional;
- disclaimer.

## BATCH 19 — Gamificación

- mantener independiente;
- criterios;
- points;
- badges;
- idempotencia;
- rewards;
- eliminar cualquier conexión accidental con affinity.

## BATCH 20 — Dashboards y BI por actor

Docente: fusionar redundancias y drill-down.

Director: Inicio, Aprobaciones y Analítica con tabs.

Sociedad: resumen vs métricas interactivas.

Admin: UX de catálogos y usuarios.

## BATCH 21 — UX Web transversal

- formularios;
- tabs;
- cards;
- loaders;
- empty states;
- modal flicker;
- validation;
- navigation;
- mobile-width web;
- terminology;
- no “panel admin” para Estudiante.

## BATCH 22 — Mobile

- Expo actual;
- doctor;
- student flow;
- notificaciones;
- profile;
- activities;
- projects;
- trajectory;
- device test.

## BATCH 23 — Hardening / QA

- Jest;
- integration PostgreSQL;
- state transitions;
- Playwright;
- Maestro;
- ZAP;
- dependency audit;
- k6;
- Sonar;
- compatibility;
- usability/SUS.

## BATCH 24 — Cleanup y documentación

- routes obsolete;
- generic evidence UI obsolete;
- duplicated dashboards;
- stale TeacherScope page;
- old recommendation page;
- V3 Swagger;
- README;
- diagrams;
- Chapter II;
- Chapter III;
- traceability matrix;
- final evidence.

---

# 73. REPORTE OBLIGATORIO POR BATCH

```text
BATCH:
ESTADO:

Objetivo:
- ...

Hallazgos iniciales:
- ...

Cambios:
- ...

Migraciones:
- ...

Archivos:
- ...

Pruebas ejecutadas:
- ...

Resultados:
- ...

Regresiones:
- ...

Decisiones:
- ...

Pendientes:
- ...

Riesgos:
- ...
```

No “completo” si algo relevante falla.

---

# 74. CRITERIOS CLAVE DE ACEPTACIÓN

## Taxonomía
- seleccionar área filtra skills;
- skill no puede guardar área incoherente silenciosamente;
- catálogo nuevo participa en sugerencias.

## Actividad interna
- estudiante no adjunta evidencia de asistencia;
- responsable confirma;
- constancia aparece automáticamente cuando corresponde.

## Externa nueva
- no adjuntar antes de finalizar;
- solo oportunidad elegible aparece;
- evidencia pasa validación.

## Externa histórica
- puede registrarse sin recrear actividad;
- no requiere template histórico;
- queda SUPPORTED o CORROBORATED según señales;
- si no existe verificador digital, solo una revisión manual excepcional autorizada puede elevar una histórica a CORROBORATED.

## QR
- ausencia no falla;
- presencia se procesa.

## URL
- caída del proveedor → INCONCLUSIVE, no “falso”.

## Proyecto
- DRAFT incompleto permitido;
- ACTIVE exige repo + taxonomía + confirmaciones + evidencia contextual;
- demo opcional;
- GitHub no certifica dominio;
- skill no detectada no penaliza.

## GitHub
- language endpoint se usa para lenguaje;
- manifest se usa para framework/dependency;
- no inferir DB/backend desde demo web;
- rate limit manejado.

## Integrantes
- cada integrante confirma su propia contribución;
- creador no puede atribuir experiencia unilateralmente.

## Afinidad
- solo señales V4 autorizadas;
- <=100;
- explicable;
- skill visible como evidencia, no porcentaje de dominio.

## Recomendaciones
- prioridad por interés/mejora;
- “no me interesa” no cambia perfil en secreto.

## Currículo
- elegir secciones;
- elegir ítems concretos;
- solo ítems elegibles;
- preview;
- no inventa.

## UX
- no vistas redundantes;
- no formularios interminables cuando tabs resuelven;
- mensajes específicos.

---

# 75. DECISIONES EXPLÍCITAMENTE DESCARTADAS

No implementar como núcleo:

```text
OCR de screenshot para certificar stack de proyecto
crawler de demo para inferir backend/base de datos
IA como autenticador final
score de “dominio” por skill
materias/malla curricular
chat
ranking público
SBOM como dependencia obligatoria
clonado/ejecución automática de repos de estudiantes
revisión humana de absolutamente todos los certificados
```

---

# 76. COMPENSACIONES AL QUITAR TECNOLOGÍA POCO CONFIABLE

Se quita:

```text
crawler que pretende descubrir backend
```

Se compensa con:

```text
GitHub languages
+ manifest/dependency detection
+ repo metadata
+ demo availability
+ evidencia contextual
+ member confirmation
+ academic feedback
```

Se quita:

```text
OCR como verificador tecnológico de screenshot
```

Se compensa con:

```text
repo técnico
+ manifests
+ demo
+ screenshot contextual
+ review
```

No se pierde valor; se reemplaza una afirmación débil por señales defendibles.

---

# 77. FACTIBILIDAD TÉCNICA VERIFICADA

A fecha de cierre de V3:

## GitHub

La REST API oficial permite obtener repositorio, listar lenguajes y bytes, obtener contenido de archivos/directorios, obtener árboles Git recursivos con límites documentados, acceder sin autenticación a recursos públicos y usar autenticación para aumentar cuota.

Por tanto:

> La integración propuesta de metadata + languages + manifests es técnicamente viable y no requiere clonar repositorios.

## Credenciales

Open Badges 3.0 demuestra que existen credenciales digitales con metadata y pruebas criptográficas verificables.

Pero no todos los certificados del mundo son Open Badges, tienen QR o exponen API.

Por tanto la arquitectura debe ser gradual.

## IA visual

Las APIs multimodales pueden analizar imágenes. Esto justifica su uso como extractor/asistente, no como autoridad de autenticidad.

---

# 78. REGLA DE DEFENSA ANTE TRIBUNAL

No decir:

> “Afinia sabe que este estudiante domina React.”

Decir:

> “Afinia encontró señales corroborables de uso de React en un proyecto asociado al estudiante y conserva la procedencia de esa corroboración.”

No decir:

> “OCR comprobó que el certificado es real.”

Decir:

> “Afinia extrajo datos del documento y, cuando existe una fuente oficial verificable, los contrasta; cuando no existe, conserva un nivel de respaldo menor y no afirma autenticidad absoluta.”

No decir:

> “La IA valida todo.”

Decir:

> “La IA es auxiliar; las decisiones que afectan trayectoria y afinidad se basan en reglas y fuentes trazables.”

---

# 79. CADENA FINAL DE AFINIA V3

```text
IDENTIDAD INSTITUCIONAL
        ↓
PERFIL / INTERESES / OBJETIVOS
        ↓
OPORTUNIDADES PERSONALIZADAS
        ↓
ACTIVIDADES INTERNAS
        │
        ├─ participación confirmada
        └─ constancia cuando corresponde
        ↓
OPORTUNIDADES EXTERNAS
        │
        └─ credencial + validación
        ↓
PROYECTOS
        │
        ├─ repo
        ├─ manifests/languages
        ├─ demo
        ├─ evidencia contextual
        └─ contribución confirmada
        ↓
MOTOR DE VALIDACIÓN
        ↓
TRAYECTORIA RESPALDADA
        ↓
AFINIDAD V4 + SUPPORT
        ↓
COLABORACIÓN / EQUIPOS
        ↓
EVOLUCIÓN
        ↓
PERFIL / QR
        ↓
CURRÍCULO SELECCIONABLE
```

---

# 80. DEFINICIÓN DE TERMINADO V3

Afinia V3 se considera final cuando:

1. import Estudiante funciona;
2. import Docente funciona;
3. código universitario es consistente;
4. semestre/scopes son coherentes;
5. activación link funciona;
6. activación code funciona;
7. SMTP real funciona;
8. refresh funciona sin carrera destructiva;
9. catálogo área-skill es dinámico;
10. área filtra skills;
11. profile UX no duplica Intereses;
12. actividades internal/external están diferenciadas;
13. review por actor funciona;
14. Admin excepcional conserva responsable;
15. actividad interna no requiere evidencia del estudiante;
16. CONFIRMED es trazable;
17. constancia automática funciona;
18. oportunidad externa habilita evidencia tras finalizar;
19. credencial histórica funciona y posee fallback de revisión excepcional cuando no existe verificador oficial;
20. QR es opcional;
21. URL verification degrada con gracia;
22. OCR no sobreafirma;
23. proyecto DRAFT incompleto funciona;
24. ACTIVE exige evidencia mínima;
25. GitHub languages funciona;
26. manifest detection funciona;
27. demo check funciona;
28. crawler backend no existe;
29. member confirmation funciona;
30. team reutilizable en proyecto funciona;
31. backing de proyecto es explicable;
32. no se penaliza una skill no detectable;
33. Afinidad V4 usa solo señales autorizadas;
34. Support permanece separado;
35. recomendaciones reflejan intereses/objetivos;
36. “No me interesa” no altera perfil silenciosamente;
37. notificaciones no hacen spam;
38. dashboards tienen propósitos diferentes;
39. currículo permite elegir sección e ítems;
40. currículo solo ofrece experiencias elegibles;
41. PDF no inventa información;
42. chat sigue retirado;
43. IA sigue opcional;
44. web cumple UX;
45. mobile cumple flujo Estudiante;
46. seguridad/QA pasan;
47. Swagger/README/env coinciden;
48. documento de grado, software, diagramas y pruebas describen el mismo sistema.

---

# 81. FUENTE DE VERDAD FINAL

Al finalizar:

```text
DOCUMENTO FINAL DE GRADO
        ↕
AFINIA_ESPECIFICACION_MAESTRA_FINAL_V3
        ↕
SOFTWARE
        ↕
PRUEBAS
        ↕
EVIDENCIAS
```

deben representar el mismo sistema.

---

# 82. INSTRUCCIÓN FINAL AL AGENTE

No optimizar para cantidad de funciones.

Optimizar para:

```text
coherencia
UX
trazabilidad
veracidad
automatización útil
reducción de trabajo manual
privacidad
seguridad
explicabilidad
mantenibilidad
defendibilidad académica
```

Antes de agregar tecnología “inteligente” preguntar:

```text
¿qué afirma esta señal realmente?
¿puedo demostrar esa afirmación?
¿qué pasa cuando falla?
¿estoy penalizando al estudiante por una limitación del sistema?
¿puedo resolverlo con una fuente más fuerte y más simple?
```

La regla final es:

> **Afinia debe ayudar al estudiante a construir una trayectoria con la menor fricción posible, pero nunca debe convertir comodidad tecnológica en falsa certeza.**

---

# FIN — AFINIA ESPECIFICACIÓN MAESTRA FINAL V3
