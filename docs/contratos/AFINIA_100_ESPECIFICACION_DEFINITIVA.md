# AFINIA — ESPECIFICACIÓN DEFINITIVA DEL SISTEMA 100 %

**Versión:** 1.0 — Línea base funcional y técnica definitiva  
**Fecha de cierre funcional:** 20 de septiembre de 2026  
**Proyecto:** Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico en Ingeniería en Sistemas Informáticos – Univalle  
**Propósito:** servir como **fuente de verdad contractual** para reingeniería, implementación, pruebas y posterior alineación documental.  
**Destinatario:** Claude Code, Codex u otro agente de desarrollo que reciba el repositorio actual de Afinia.  
**Estado de partida:** repositorio AfiniaC auditado como avance funcional aproximado del 70 %.  
**Estado objetivo:** sistema completo, coherente y trazable al 100 % según esta especificación.

---

# 0. INSTRUCCIÓN PRINCIPAL PARA EL AGENTE DE DESARROLLO

Este documento define **cómo debe funcionar Afinia al finalizar la reingeniería**. No debe interpretarse como una invitación a reescribir el proyecto desde cero.

Antes de modificar código:

1. inspeccionar el repositorio completo;
2. identificar qué funcionalidades existentes ya cumplen esta especificación;
3. reutilizar la arquitectura, entidades, servicios, migraciones, pruebas y pantallas existentes cuando sean válidos;
4. clasificar cada diferencia como conservar, refactorizar, extender, sustituir o eliminar;
5. realizar los cambios mediante migraciones y código versionado;
6. no destruir datos existentes ni resetear la base como estrategia normal;
7. no crear mocks permanentes, hardcodes ni pantallas que simulen funcionalidad real;
8. no cambiar una regla definida aquí sin marcarlo explícitamente como incidencia;
9. ejecutar regresión y añadir pruebas después de cada batch;
10. no avanzar al siguiente batch si el anterior dejó compilación, migraciones o pruebas inconsistentes.

Cuando exista contradicción entre README antiguo, comentarios del 30/70 %, documentación histórica, implementación actual y esta especificación, **esta especificación representa el comportamiento final objetivo**.

---

# 1. VISIÓN DEL PRODUCTO

Afinia no es un SIU, un LMS, una red social, una certificadora ni un reemplazo de Microsoft Teams.

Afinia es una **plataforma académica complementaria que construye progresivamente una representación explicable de la trayectoria académica complementaria del estudiante**, utilizando:

- preferencias e intereses;
- participación en actividades;
- proyectos;
- contribuciones individuales;
- evidencias;
- certificados externos;
- constancias internas;
- retroalimentación académica;
- historial de colaboración;
- señales trazables.

A partir de esa trayectoria, el sistema debe:

1. identificar áreas de afinidad;
2. indicar cuánto respaldo real existe detrás de esas afinidades;
3. explicar qué señales originaron cada resultado;
4. recomendar actividades, recursos y oportunidades;
5. apoyar la conformación de equipos complementarios;
6. permitir visualizar la evolución del perfil;
7. generar un resumen curricular/portafolio exportable;
8. proporcionar analítica descriptiva a docentes y Dirección.

**Propuesta de valor:**

> Afinia no se limita a registrar lo que un estudiante afirma saber. Construye progresivamente una trayectoria, diferencia información declarada de información respaldada, explica de dónde provienen las afinidades y utiliza esos resultados para orientar oportunidades académicas y colaboración.

---

# 2. PROBLEMA QUE RESUELVE

Las experiencias académicas complementarias suelen quedar dispersas entre Teams, SIU, repositorios, plataformas de cursos, documentos, formularios, grupos de mensajería y archivos personales. Esto dificulta que el estudiante identifique su experiencia acumulada, que los docentes conozcan la trayectoria permitida de sus estudiantes y que puedan encontrarse compañeros complementarios.

Afinia debe transformar esas experiencias dispersas en una trayectoria estructurada sin apropiarse de competencias institucionales que no le corresponden.

---

# 3. PRINCIPIOS OBLIGATORIOS

## 3.1. Procedencia antes que cantidad

Todo dato relevante debe indicar de dónde proviene: interés declarado, participación confirmada, proyecto declarado, membresía aceptada, tecnología corroborada, certificado externo, revisión docente, etc.

## 3.2. Declaración no equivale a demostración

Una autodeclaración es útil, pero no certifica competencia.

Sí puede mostrarse:

> “Nivel autodeclarado: intermedio.”

No puede mostrarse como conclusión propia:

> “Afinia certifica nivel intermedio.”

## 3.3. Perfil dinámico significa evolución real

El perfil cambia cuando existen nuevos hechos: participación confirmada, proyectos, contribuciones, evidencias, certificados, revisiones, afinidades y recomendaciones.

## 3.4. Explicabilidad

Toda afinidad y recomendación debe conservar puntuación, versión de reglas, razones, fuentes, contribuciones y fecha de cálculo.

## 3.5. Evidencia no significa certificación legal

Afinia puede extraer texto, comprobar enlaces, detectar duplicados y comparar metadata. No garantiza autenticidad jurídica salvo verificación explícita de un emisor externo.

## 3.6. Automatización antes que burocracia

No existe un auditor humano obligado a revisar cada evidencia. La validación es principalmente automática. Una evidencia no corroborable puede permanecer como declarada o inconclusa.

## 3.7. No duplicar sistemas existentes

Cada módulo debe aportar valor a la trayectoria. Actividades, chat, proyectos y certificados no deben competir con Teams, WhatsApp, GitHub o certificadoras.

---

# 4. ALCANCE ORGANIZACIONAL

El sistema se orienta inicialmente a la Universidad Privada del Valle, sede Cochabamba, carrera de Ingeniería en Sistemas Informáticos.

No debe afirmarse integración oficial con SIU, Teams, Microsoft Entra ID u otros sistemas institucionales salvo que se implemente realmente.

El correo institucional funciona como identidad previamente autorizada y canal de activación/recuperación, **no como SSO de Microsoft**.

---

# 5. ACTORES DEFINITIVOS

Se mantienen exactamente cinco actores humanos.

## 5.1. Estudiante

Clientes: móvil y web.

Puede activar cuenta, iniciar/cerrar sesión, recuperar acceso, completar onboarding, gestionar información declarativa autorizada, consultar perfil dinámico, explorar actividades, inscribirse, registrar evidencias/certificados, crear proyectos, gestionar integrantes, consultar afinidad y respaldo, recibir recomendaciones, usar QR/contactos/equipos/chat contextual, consultar gamificación y exportar trayectoria.

No puede modificar correo institucional, código universitario, semestre institucional, rol, estado de cuenta, participación confirmada ni constancias institucionales.

## 5.2. Docente

Cliente: web.

Puede consultar únicamente estudiantes de semestres autorizados, gestionar actividades académicas dentro de su contexto, confirmar participación, revisar proyectos visibles, registrar retroalimentación orientativa, iniciar necesidades de equipo y consultar reportes dentro de su scope.

No puede acceder fuera de su scope, certificar competencias, asignar notas ni consultar información académica oficial.

## 5.3. Director de Carrera

Cliente: web.

Puede gestionar actividades académicas de alcance de carrera, confirmar participación, registrar constancias internas, consultar analítica, mapas de afinidad e históricos descriptivos.

No asigna calificaciones ni emite certificados oficiales mediante Afinia.

## 5.4. Sociedad Científica

Cliente: web.

Puede gestionar actividades extracurriculares, participantes y confirmación de participación de sus propias actividades.

## 5.5. Administrador del Sistema

Cliente: web.

Puede provisionar/importar usuarios, gestionar estados, roles permitidos, scope docente, catálogos, configuración, seguridad y auditoría técnica.

**No debe convertirse en autoridad académica ordinaria.** No confirma participación, no certifica competencias ni emite constancias como operación normal.

---

# 6. CLIENTES

## 6.1. Móvil

Orientado exclusivamente al Estudiante: acceso, onboarding, perfil, actividades, proyectos, evidencias, afinidad, recomendaciones, QR, contactos, equipos, mensajería, gamificación y exportación.

## 6.2. Web

Soporta Estudiante, Docente, Director, Sociedad Científica y Administrador.

No se exige paridad administrativa en móvil.

---

# 7. ARQUITECTURA OBJETIVO

Se conserva el enfoque cliente-servidor y monolito modular:

```text
React/Vite Web ───────┐
                      │ HTTPS/JSON
Expo/React Native ────┼────────────► NestJS API
                      │                 │
                      │                 ├─ PostgreSQL
                      │                 ├─ Storage privado
                      │                 └─ Adaptadores externos controlados
                      │                    (SMTP / GitHub / URL checks)
```

No convertir a microservicios.

---

# 8. MÓDULOS OBJETIVO DE LA API

```text
auth
account-activation
users
roles
access
imports

profiles
onboarding
catalogs

activities
participation
constancies

projects
project-members
project-feedback
evidences
certificates

validation
repositories
link-checks
storage

affinity
recommendations

contacts
public-profiles
teams
messaging

gamification
trajectory-export

reports
analytics
audit
```

No es obligatorio crear una carpeta por cada línea si una agrupación mantiene cohesión. Sí es obligatorio eliminar reglas contradictorias duplicadas.

---

# 9. IDENTIDAD, PROVISIONAMIENTO Y ACTIVACIÓN

## 9.1. Eliminar registro público

No debe existir un endpoint público que cree directamente una cuenta STUDENT. La pantalla “Registrarse” desaparece.

El usuario dispone de:

- Iniciar sesión.
- Activar mi cuenta.
- Olvidé mi contraseña.

## 9.2. Provisionamiento

Una cuenta se crea solo por importación administrativa, creación administrativa individual o seed inicial del Administrador.

Estado inicial:

```text
PENDING_ACTIVATION
```

## 9.3. Estados de cuenta

```text
PENDING_ACTIVATION
ACTIVE
SUSPENDED
INACTIVE
```

No eliminar físicamente una cuenta con historial.

---

# 10. IMPORTACIÓN DE PADRÓN

Formato mínimo: CSV UTF-8. XLSX puede soportarse si no compromete estabilidad.

Plantilla mínima:

```text
university_code
first_name
last_name
institutional_email
semester
```

Antes de aplicar cambios debe existir previsualización:

```text
NEW
UPDATE
UNCHANGED
CONFLICT
INVALID
```

Mostrar conteos y detalle de errores.

## 10.1. Idempotencia

Reimportar el mismo archivo no duplica cuentas, perfiles, tokens ni historial.

Identificación:

1. `university_code`;
2. correo institucional normalizado como control secundario.

Conflictos de identidad no se resuelven automáticamente.

## 10.2. Actualización permitida

La importación puede actualizar nombre institucional, apellido, semestre y correo cuando sea seguro. Nunca sobrescribe contraseña, proyectos, afinidades, evidencias, certificados, preferencias ni privacidad.

## 10.3. Ausencia en archivo nuevo

Un usuario ausente **no se desactiva automáticamente**.

## 10.4. Auditoría de importación

Persistir batch, hash, usuario que importó, archivo, versión, estado, conteos y detalle por fila.

---

# 11. CORREO INSTITUCIONAL

Configurar por entorno:

```text
INSTITUTIONAL_EMAIL_DOMAINS=
```

No inventar ni hardcodear el dominio real.

---

# 12. ACTIVACIÓN DE CUENTA

Flujo:

```text
Cuenta provisionada
→ PENDING_ACTIVATION
→ token de un solo uso
→ correo
→ enlace válido
→ nueva contraseña
→ ACTIVE
```

Guardar solamente hash del token.

Campos sugeridos:

```text
id
user_id
purpose
token_hash
created_at
expires_at
used_at
revoked_at
```

Propósitos:

```text
ACCOUNT_ACTIVATION
PASSWORD_RESET
```

Un nuevo token invalida el anterior del mismo propósito.

Valores por defecto configurables:

```text
ACTIVATION_TOKEN_TTL_HOURS=48
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
ACTIVATION_RESEND_COOLDOWN_SECONDS=120
```

Respuesta pública genérica para no enumerar cuentas.

---

# 13. CONTRASEÑAS

Política mínima:

- mínimo 12 caracteres;
- máximo >= 128;
- no igual al correo;
- no incluir trivialmente código universitario;
- validación server-side;
- hash seguro;
- nunca almacenar confirmación.

---

# 14. SESIONES

Objetivo final:

- access token corto;
- refresh token rotatorio y revocable.

Configuración inicial:

```text
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7
```

Web: refresh token HttpOnly/Secure en producción y access token en memoria cuando sea viable. Evitar access tokens largos en `localStorage`.

Móvil: `Expo SecureStore`.

Logout revoca sesión actual. Cambio de contraseña, suspensión y cierre global pueden invalidar todas las sesiones.

---

# 15. PROTECCIÓN DE ABUSO

Aplicar rate limit/cooldown a login, activación, reenvío, recuperación, upload y comprobaciones manuales de URL.

No hacer bloqueos permanentes por IP compartida.

---

# 16. ONBOARDING

Al primer acceso activo, el estudiante completa un **Cuestionario Inicial de Orientación Académica**.

Objetivo: orientar preferencias, no evaluar conocimiento.

Características:

- 10–15 preguntas aproximadamente;
- selección simple/múltiple;
- rápidas;
- no examen técnico;
- no produce “competencias”.

El cuestionario genera `suggested_areas[]`. El estudiante confirma cuáles desea incorporar como intereses. Solo la confirmación crea intereses efectivos.

Guardar versión, fecha, respuestas y resultado. Puede repetirse. El resultado no alimenta afinidad por sí solo.

---

# 17. PERFIL ESTUDIANTIL

## 17.1. Datos institucionales no editables por estudiante

```text
university_code
institutional_email
first_name
last_name
semester
account_status
role
```

## 17.2. Datos editables

```text
bio
availability
collaboration_preferences
interests
self_assessed_skills
improvement_areas
public_visibility
selected_portfolio_items
```

---

# 18. INTERESES

Usar áreas de catálogo.

```text
area_id
priority 1..5
source ONBOARDING|MANUAL
created_at
```

`priority=1` es la prioridad más alta.

Son preferencias, no evidencia.

---

# 19. INTERESES LIBRES

Puede existir texto libre, pero **no alimenta directamente afinidad** salvo asociación explícita a un área controlada.

No mapear automáticamente con IA generativa.

---

# 20. ÁREAS DE MEJORA

Regla definitiva:

```text
IMPROVEMENT_AREA → 0 puntos de afinidad.
```

Se utilizan para recomendaciones y objetivos personales.

---

# 21. HABILIDADES / TECNOLOGÍAS

Provienen de catálogo administrado y se relacionan con una o más áreas.

## 21.1. Autoevaluación

```text
BASIC
INTERMEDIATE
ADVANCED
```

Siempre etiquetado como **autodeclarado**.

## 21.2. Experiencia registrada

Separar visualmente autodeclaración de experiencia respaldada por proyectos, actividades, certificados o evidencias.

---

# 22. ACTIVIDADES

Actores gestores:

- Docente: actividades académicas dentro de su scope;
- Director: actividades académicas de carrera;
- Sociedad Científica: extracurriculares.

Datos mínimos:

```text
title
description
activity_type
category_id
academic_area_id
skills[]
start_at
end_at
modality
capacity
registration_mode
location_or_link
requirements
evidence_required
responsible_user_id
status
semester_scope[]
```

Estados:

```text
DRAFT
PUBLISHED
OPEN
CLOSED
FINISHED
CANCELLED
```

Implementar máquina de estados explícita.

---

# 23. PARTICIPACIÓN

Estados:

```text
INTERESTED
REGISTERED
CONFIRMED
ABSENT
CANCELLED
```

Reglas:

```text
INTERESTED → intención, no experiencia.
REGISTERED → inscripción, no experiencia.
CONFIRMED → experiencia/exposición registrada.
```

Solo actor responsable confirma participación.

Confirmar participación dispara actualización de trayectoria, afinidad, recomendaciones, gamificación aplicable y auditoría.

---

# 24. CONSTANCIAS INTERNAS

Una constancia interna respalda participación registrada, pero no es certificado oficial.

Debe vincular:

```text
activity_registration_id
student_profile_id
activity_id
authorized_by
created_at
```

No duplica afinidad de la participación; aumenta respaldo/trazabilidad.

---

# 25. TAXONOMÍA DE EVIDENCIAS

Tipos claros:

```text
PROJECT_EVIDENCE
EXTERNAL_CERTIFICATE
ACTIVITY_EVIDENCE
```

Toda evidencia requiere contexto.

---

# 26. MOTOR DE VALIDACIÓN Y RESPALDO

Es independiente del Motor de Afinidad.

Responsabilidad:

> Determinar qué información puede corroborarse técnicamente y cuánto respaldo posee una señal.

No determina notas ni competencia profesional.

---

# 27. PIPELINE DE ARCHIVOS

Preferir operación backend controlada en `multipart/form-data` con metadata + archivo.

Evitar confiar en una URL pública que el cliente devuelve luego al API.

## 27.1. Storage privado

No servir directorios estáticos públicos.

Descargas:

```text
JWT
→ rol
→ ownership/scope/visibilidad
→ stream
```

Con storage externo: bucket privado + URL firmada corta.

## 27.2. Metadatos

```text
original_filename
storage_key
mime_type_detected
size_bytes
sha256
uploaded_by
created_at
```

## 27.3. Formatos iniciales

```text
PDF
JPG
JPEG
PNG
```

Máximo por defecto: 10 MB configurable.

Validar firma real del archivo cuando sea posible.

---

# 28. DEDUPLICACIÓN

Calcular SHA-256.

El mismo archivo en contexto equivalente no debe multiplicar afinidad ni respaldo.

---

# 29. EXTRACCIÓN DOCUMENTAL / OCR

Orden:

```text
1. extraer texto nativo de PDF;
2. si no existe texto suficiente, OCR;
3. detectar QR cuando sea viable;
4. normalizar texto;
5. extraer candidatos de metadata.
```

Metadata posible:

```text
holder_name
issuer
certificate_title
issue_date
credential_id
verification_url
```

OCR pertenece al Motor de Validación, no al de Afinidad. Si falla, el recurso queda `INCONCLUSIVE`; no se elimina.

---

# 30. CERTIFICADOS EXTERNOS

Campos:

```text
issuer
certificate_name
issue_date
credential_id
verification_url
academic_area_id
skills[]
file
```

Backing tier:

```text
DECLARED
SUPPORTED
CORROBORATED
```

- `DECLARED`: archivo aportado, sin corroboración suficiente.
- `SUPPORTED`: documento legible + metadata consistente.
- `CORROBORATED`: URL/QR externo accesible y coherente.

Afinia nunca afirma autenticidad legal absoluta.

Comparación de nombre:

```text
MATCH
PARTIAL_MATCH
MISMATCH
UNKNOWN
```

---

# 31. COMPROBACIÓN DE ENLACES

Estados:

```text
UNVERIFIED
AVAILABLE
UNAVAILABLE
BLOCKED
```

Comprobar HTTP/HTTPS, redirects limitados, URL final, título y fecha.

Protección SSRF obligatoria:

- bloquear localhost;
- bloquear rangos privados;
- bloquear metadata cloud;
- timeout;
- límite de respuesta;
- solo HTTP/HTTPS;
- DNS seguro.


# 32. PROYECTOS

El Estudiante puede crear proyectos sin aprobación previa.

Datos mínimos:

```text
title
description
academic_area_id
status
visibility
repository_url
demo_url
general_skills[]
created_by_profile_id
created_at
updated_at
```

Estados:

```text
DRAFT
ACTIVE
ARCHIVED
```

Visibilidad:

```text
PRIVATE
PROFILE
TEACHERS
PUBLIC_LINK
```

Crear un proyecto por sí solo genera:

```text
backing_tier = DECLARED
```

No debe producir una contribución fuerte al motor.

---

# 33. INTEGRANTES DE PROYECTO

Flujo:

```text
Creador invita
→ estudiante recibe invitación
→ acepta/rechaza
→ solo aceptación crea membresía efectiva
```

Datos por integrante:

```text
project_id
student_profile_id
role
contribution
skills_used[]
status
accepted_at
updated_at
```

El integrante puede revisar y confirmar la contribución/skills que quedarán asociados con su perfil.

No permitir que el creador atribuya unilateralmente experiencia definitiva a otro estudiante.

---

# 34. TECNOLOGÍAS POR INTEGRANTE

Distinguir:

```text
project.general_skills
```

de:

```text
project_member.skills_used
```

Ejemplo:

```text
Proyecto:
React, NestJS, PostgreSQL, Docker

Integrante A:
React

Integrante B:
NestJS, PostgreSQL
```

Afinidad individual utiliza principalmente las tecnologías de la contribución propia.

---

# 35. EVIDENCIAS DE PROYECTO

Cada evidencia debe indicar:

```text
project_id
student_profile_id
evidence_type
description
file/link
academic_area_id
created_at
```

El propietario de la evidencia es el estudiante cuya trayectoria puede verse afectada.

Corregir cualquier comportamiento que recalcule afinidad del creador cuando la evidencia pertenece a otro integrante.

---

# 36. NIVELES DE RESPALDO DE PROYECTO

Estados derivados:

```text
DECLARED
SUPPORTED
CORROBORATED
REVIEWED
FLAGGED
```

## DECLARED

Solo información declarada.

## SUPPORTED

Existe al menos una fuente adicional:

- integrante aceptado;
- evidencia;
- repositorio accesible;
- demo accesible.

## CORROBORATED

Existen al menos dos señales independientes y una corroboración técnica relevante, por ejemplo:

- miembro aceptado + repositorio;
- evidencia + repo;
- repo + demo;
- repo con tecnologías detectadas + evidencia.

## REVIEWED

Proyecto al menos `SUPPORTED` y existe retroalimentación docente.

`REVIEWED` no significa “aprobado académicamente”.

## FLAGGED

Existe inconsistencia grave: enlace bloqueado, recurso eliminado, duplicación sospechosa o metadata incompatible.

No eliminar automáticamente el proyecto.

---

# 37. INTEGRACIÓN CON GITHUB

GitHub es opcional. Un proyecto no necesita GitHub para existir.

Si existe URL pública válida, obtener cuando sea permitido:

```text
repository_exists
owner
repository_name
default_branch
languages
updated_at
readme_presence
public_metadata
```

Puede inspeccionarse metadata/manifiestos públicos permitidos para corroborar tecnologías.

No descargar ni analizar ilimitadamente todo el repositorio.

Respetar rate limits y configurar token opcional:

```text
GITHUB_TOKEN
```

---

# 38. DETECCIÓN DE TECNOLOGÍAS

Se pueden utilizar señales como:

```text
package.json
requirements.txt
pyproject.toml
pom.xml
Dockerfile
docker-compose.yml
lenguajes reportados por GitHub
```

Estado por tecnología:

```text
DECLARED
DETECTED
BOTH
```

“Detected” significa que se encontraron indicios compatibles, no que el estudiante domina esa tecnología.

---

# 39. PROYECTOS HOSTEADOS SIN REPOSITORIO

Para `demo_url` puede comprobarse:

- disponibilidad;
- HTTPS;
- título;
- metadata pública.

No inferir backend o base de datos si no son observables públicamente.

Ejemplo:

```text
React declarado → puede existir señal pública.
PostgreSQL declarado → normalmente no puede inferirse desde la web desplegada.
```

Mantenerlo como declarado.

---

# 40. RETROALIMENTACIÓN DOCENTE

El docente puede registrar comentarios, observaciones y sugerencias.

No son:

- nota;
- calificación;
- certificación.

La retroalimentación aumenta el nivel de respaldo del proyecto, queda asociada al docente y genera evento de auditoría.

---

# 41. BITÁCORA DE PROYECTO

La auditoría funcional se realiza mediante eventos estructurados, no analizando chats.

Eventos sugeridos:

```text
PROJECT_CREATED
MEMBER_INVITED
MEMBER_ACCEPTED
CONTRIBUTION_UPDATED
EVIDENCE_ADDED
REPOSITORY_CHECKED
DEMO_CHECKED
FEEDBACK_ADDED
PROJECT_VISIBILITY_CHANGED
PROJECT_ARCHIVED
```

Guardar:

```text
actor_user_id
event_type
entity_type
entity_id
metadata_minimal
created_at
```

No almacenar secretos en metadata.

---

# 42. MENSAJERÍA

Se mantiene como apoyo contextual.

## 42.1. Privada

Disponible entre estudiantes con contacto/relación aceptada.

## 42.2. Grupal

Disponible a integrantes aceptados de un equipo.

Reglas:

- no alimenta afinidad;
- no puntúa por cantidad de mensajes;
- no se analiza contenido para inferir competencia;
- no se usa como prueba automática de contribución.

La bitácora estructurada es la fuente de auditoría del proyecto.

---

# 43. PERFIL PÚBLICO Y QR

Cada estudiante dispone de un identificador público opaco:

```text
public_profile_slug
```

No usar directamente email, código universitario ni UUID interno.

El slug puede rotarse.

El QR contiene únicamente una URL al perfil compartible.

---

# 44. VISIBILIDAD DEL PERFIL

El Estudiante controla campos visibles dentro de límites del sistema.

Puede compartir:

- nombre;
- bio;
- áreas principales;
- afinidades;
- nivel de respaldo;
- proyectos visibles;
- tecnologías/experiencias seleccionadas;
- disponibilidad;
- resumen de trayectoria.

Nunca exponer públicamente por defecto:

- correo institucional;
- archivos privados;
- certificados completos privados;
- chats;
- tokens;
- identificadores internos sensibles.

---

# 45. CONTACTOS

Flujo:

```text
A escanea QR de B
→ consulta perfil público permitido
→ envía solicitud
→ B acepta/rechaza
→ si acepta, contacto establecido
```

El QR no establece contacto automáticamente.

---

# 46. EQUIPOS

El objetivo es priorizar complementariedad.

Una necesidad puede declarar:

```text
purpose
project_id/activity_id opcional
required_skills[]
preferred_areas[]
max_members
availability_requirements
```

---

# 47. SUGERENCIA DE INTEGRANTES

Factores:

```text
coverage_of_required_skills
affinity_with_context
support_level
availability
existing_team_coverage
semester/scope cuando corresponda
```

Ponderación inicial:

```text
50 % cobertura de habilidades faltantes
20 % afinidad con área/proyecto
15 % disponibilidad
15 % respaldo de trayectoria relacionado
```

La recomendación debe explicar razones.

No enviar invitaciones automáticamente.

---

# 48. MOTOR DE AFINIDAD V2

Debe seguir siendo:

- determinista;
- versionado;
- explicable;
- basado en reglas.

No usar Machine Learning ni IA generativa como requisito.

---

# 49. DOS RESULTADOS DIFERENTES

Por cada área:

```text
AFFINITY_SCORE 0..100
SUPPORT_SCORE  0..100
SUPPORT_LEVEL  LOW | MEDIUM | HIGH
```

**Afinidad** responde:

> “¿Qué tan relacionada está la trayectoria/preferencia con esta área?”

**Respaldo** responde:

> “¿Cuánta información trazable sostiene esa relación?”

---

# 50. FUENTES DE AFINIDAD

Sí participan:

- intereses confirmados;
- habilidades autodeclaradas con peso débil;
- participación confirmada;
- proyectos;
- nivel de respaldo del proyecto;
- certificados externos;
- corroboraciones.

No participan directamente:

- áreas de mejora;
- puntos de gamificación;
- cantidad de mensajes;
- simple interés en actividad;
- simple inscripción sin participación;
- número bruto de archivos repetidos.

---

# 51. PESOS DE AFINIDAD V2

Los pesos deben almacenarse/versionarse o centralizarse en configuración del motor.

## 51.1. Preferencias — máximo 14 puntos por área

Interés explícito:

```text
prioridad 1 → +5
prioridad 2 → +4
prioridad 3 → +3
prioridad 4 → +2
prioridad 5 → +1
```

Cap de intereses por área:

```text
10
```

Habilidad autodeclarada:

```text
BASIC        → +0.5
INTERMEDIATE → +1.0
ADVANCED     → +1.5
```

Cap por área:

```text
4
```

El nivel sigue siendo autodeclarado.

## 51.2. Actividades — máximo 10 puntos por área

Solo `CONFIRMED`.

Base:

```text
+4 por actividad confirmada
```

Rendimientos decrecientes:

```text
1ra → 100 %
2da → 70 %
3ra → 50 %
siguientes → 30 %
```

Cap:

```text
10
```

## 51.3. Proyectos — máximo 24 puntos por área

Base según backing tier:

```text
DECLARED     → 2
SUPPORTED    → 6
CORROBORATED → 10
REVIEWED     → 12
FLAGGED      → 0 hasta resolver inconsistencia
```

Por proyectos independientes:

```text
1ro → 100 %
2do → 75 %
3ro → 50 %
siguientes → 25 %
```

Cap:

```text
24
```

Usar únicamente la contribución/skills que correspondan al estudiante.

## 51.4. Certificados externos — máximo 12 puntos por área

```text
DECLARED     → 1
SUPPORTED    → 3
CORROBORATED → 6
```

Rendimientos:

```text
1ro → 100 %
2do → 75 %
3ro → 50 %
siguientes → 25 %
```

Cap:

```text
12
```

---

# 52. NORMALIZACIÓN DE AFINIDAD

Máximo teórico:

```text
14 + 10 + 24 + 12 = 60
```

Calcular:

```text
AFFINITY_SCORE = round(min(100, RAW_AFFINITY_POINTS / 60 * 100))
```

No normalizar solo contra el área más fuerte del propio estudiante. Así el score puede compararse en el tiempo.

---

# 53. PUNTAJE DE RESPALDO

## 53.1. Actividades — máximo 20

Cada participación confirmada:

```text
+8
```

con rendimientos decrecientes.

Una constancia interna puede aumentar respaldo del mismo evento:

```text
+4
```

sin crear segundo evento de afinidad.

Cap familia:

```text
20
```

## 53.2. Proyectos — máximo 45

Por proyecto:

```text
DECLARED     → 0
SUPPORTED    → 8
CORROBORATED → 15
REVIEWED     → 20
FLAGGED      → 0
```

Aplicar rendimientos decrecientes.

Cap:

```text
45
```

## 53.3. Certificados — máximo 25

```text
DECLARED     → 0
SUPPORTED    → 8
CORROBORATED → 15
```

Cap:

```text
25
```

## 53.4. Otros respaldos — máximo 10

Señales no duplicadas de trazabilidad/corroboración no contabilizadas previamente.

Cap:

```text
10
```

---

# 54. SUPPORT LEVEL

```text
0–24   → LOW
25–59  → MEDIUM
60–100 → HIGH
```

Regla adicional: para `HIGH` deben existir señales de al menos **dos familias independientes** entre:

```text
ACTIVITY
PROJECT
EXTERNAL_CERTIFICATE
ACADEMIC_REVIEW
```

Si existe una sola familia, el label máximo es `MEDIUM`, aunque el número bruto supere 60.

---

# 55. EVITAR DOBLE CONTEO

Una misma realidad no aporta varias veces por estar representada en varias tablas.

Ejemplos:

```text
Participación confirmada + constancia
→ un evento de afinidad.
→ constancia aumenta respaldo.
```

```text
Proyecto + 10 capturas del mismo proyecto
→ un proyecto con mejor respaldo.
→ no 10 proyectos.
```

```text
Repositorio + metadata del mismo repo
→ una fuente de corroboración.
```

---

# 56. CONTRIBUCIONES EXPLICABLES

Persistir por cálculo:

```text
area_id
signal_family
signal_type
source_entity_type
source_entity_id
raw_points
multiplier
final_points
support_points
reason
engine_version
created_at
```

Mantener snapshots históricos.

Versión objetivo:

```text
AFFINITY_ENGINE_VERSION=2
```

---

# 57. RECÁLCULO

Recalcular cuando cambie una señal relevante:

- interés;
- habilidad autodeclarada;
- participación confirmada;
- proyecto;
- backing tier de proyecto;
- membresía/contribución;
- evidencia;
- certificado;
- validación;
- retroalimentación.

Debe recalcular al propietario correcto de la señal.

---

# 58. MOTOR DE RECOMENDACIONES

Debe consumir:

- afinidad;
- support level;
- intereses;
- áreas de mejora;
- actividades abiertas;
- recursos;
- necesidades de equipo;
- disponibilidad.

No debe operar como motor aislado.

---

# 59. REGLAS DE RECOMENDACIÓN

## Alta afinidad + bajo respaldo

Recomendar actividades prácticas, proyectos y recursos para construir experiencia.

## Alta afinidad + respaldo alto

Recomendar actividades avanzadas, retos, oportunidades y colaboración.

## Área de mejora

Recomendar talleres, recursos y actividades de fortalecimiento.

No aumentar afinidad por marcar un área de mejora.

---

# 60. RECOMENDACIÓN DE ACTIVIDADES

Ranking inicial:

```text
50 % afinidad con área
20 % interés explícito
20 % coincidencia con área de mejora
10 % disponibilidad/contexto
```

Mostrar siempre la razón.

---

# 61. RECURSOS Y CURSOS EXTERNOS

No recomendar URLs arbitrarias obtenidas automáticamente de Internet.

Usar catálogo controlado:

```text
title
provider
url
academic_area_id
skills[]
resource_type
status
created_by
```

Un recurso inactivo no se recomienda, pero se conserva históricamente.

---

# 62. RECOMENDACIONES DE COMPAÑEROS

Priorizar:

- habilidades faltantes;
- respaldo relacionado;
- afinidad contextual;
- disponibilidad;
- visibilidad/consentimiento.

Un estudiante que deshabilitó descubrimiento no aparece.

---

# 63. EVOLUCIÓN DEL ESTUDIANTE

Usar snapshots históricos:

```text
period
area
affinity_score
support_score
support_level
```

No utilizar lenguaje predictivo.

---

# 64. TENDENCIAS PARA DIRECCIÓN

Son descriptivas:

- evolución de interés por área;
- evolución de participación;
- áreas predominantes por semestre;
- tecnologías más presentes en proyectos;
- actividades con mayor participación.

No predecir notas, abandono, aprobación, éxito profesional ni rendimiento.

---

# 65. PRIVACIDAD EN ANALÍTICA

Docente: solo scope autorizado.  
Director: agregados de carrera.  
Sociedad: métricas de sus actividades.

Umbral recomendado configurable para grupos pequeños:

```text
ANALYTICS_MIN_GROUP_SIZE=5
```

---

# 66. GAMIFICACIÓN

Es independiente de afinidad.

Nunca:

```text
puntos → afinidad
```

Acciones válidas:

- participación confirmada;
- primer proyecto respaldado;
- proyecto corroborado;
- colaboración aceptada;
- hitos de trayectoria.

No dar puntos por intereses, autodeclaraciones, mensajes, archivos repetidos o proyectos vacíos.

Persistencia real sugerida:

```text
gamification_events
student_points
badges
student_badges
```

Garantizar idempotencia. No ranking público obligatorio.

---

# 67. RESUMEN DE TRAYECTORIA

El Estudiante puede generar un **Resumen de Trayectoria Académica Complementaria**.

Incluye seleccionablemente:

- datos básicos;
- bio;
- áreas principales;
- proyectos;
- rol/contribución;
- tecnologías;
- actividades confirmadas;
- certificados externos;
- constancias internas;
- evidencias seleccionadas;
- afinidad;
- nivel de respaldo.

Exportable a PDF.

Disclaimer obligatorio equivalente a:

> “Documento generado a partir de información registrada en Afinia. No constituye historial académico oficial, certificación institucional ni acreditación profesional de competencias.”

---

# 68. REPORTES DOCENTES

Todo endpoint docente debe ejecutar:

```text
CurrentUser
→ TeacherScopeService
→ semestres autorizados
→ consulta filtrada
```

Incluye perfiles, proyectos, afinidad, participación, reportes, búsquedas, conteos y recientes.

No basta con proteger endpoint por rol: debe restringirse el contenido.

---

# 69. REPORTES DE DIRECCIÓN

Puede incluir:

- estudiantes activos;
- participación por semestre;
- actividades;
- proyectos;
- áreas;
- afinidades;
- evolución;
- tecnologías;
- actividades más demandadas.

No mostrar conversaciones privadas.

---

# 70. AUDITORÍA

Registrar eventos críticos:

- provisionamiento;
- importaciones;
- cambio de rol;
- cambio de estado;
- scope docente;
- activación;
- cambio de contraseña;
- carga/eliminación de evidencia;
- confirmación de participación;
- constancias;
- visibilidad;
- retroalimentación;
- cambios de reglas/configuración;
- acciones administrativas sensibles.

No registrar contraseñas, tokens, contenido completo de chat ni binarios.


# 71. BASE DE DATOS — PRINCIPIO

La base actual posee un esquema funcional considerable. No reemplazarla de cero.

Usar migraciones incrementales y mantener:

```text
synchronize=false
```

---

# 72. TABLAS EXISTENTES A REUTILIZAR/ADAPTAR

Según el snapshot auditado:

```text
users
roles
teacher_semester_access

student_profiles
academic_areas
skills
student_interests
student_free_interests
student_skills
gamification_criteria

activity_categories
activities
activity_registrations
internal_constancies

projects
project_members
project_invitations
project_evidences
project_feedback
external_certificates

affinity_weights
affinity_results
affinity_contributions
affinity_snapshots
affinity_snapshot_items

recommendations
```

No eliminar historia sin migración explícita.

---

# 73. NUEVAS ESTRUCTURAS REQUERIDAS

Los nombres son sugeridos y pueden adaptarse a convenciones existentes.

## 73.1. Provisionamiento y seguridad

```text
import_batches
import_batch_rows
account_tokens
auth_sessions
```

## 73.2. Onboarding

```text
onboarding_question_versions
onboarding_questions
onboarding_options
onboarding_runs
onboarding_answers
```

Si preguntas/opciones quedan versionadas en código, como mínimo persistir runs, respuestas y versión.

## 73.3. Actividades

```text
activity_skills
```

## 73.4. Proyectos

```text
project_member_skills
project_repository_checks
project_link_checks
```

El backing tier puede almacenarse en `projects` o derivarse/persistirse en tabla específica.

## 73.5. Validación

Tabla genérica cuidadosamente diseñada o tablas específicas:

```text
validation_records
```

Campos sugeridos:

```text
id
resource_type
resource_id
status
backing_tier
extracted_data JSONB
identity_match_status
duplicate_of_id nullable
validator_version
started_at
finished_at
error_code
created_at
updated_at
```

Si el polimorfismo debilita integridad referencial, separar:

```text
certificate_validations
project_evidence_validations
```

## 73.6. Colaboración

```text
contact_requests
contacts
team_needs
teams
team_members
team_invitations
conversations
conversation_members
messages
```

## 73.7. Perfil público

En `student_profiles` o tabla dedicada:

```text
public_profile_slug
public_profile_enabled
public_visibility_config JSONB
```

## 73.8. Gamificación

```text
gamification_events
badges
student_badges
```

## 73.9. Auditoría

```text
audit_events
```

---

# 74. INTEGRIDAD DE BASE DE DATOS

Crear/confirmar constraints para:

- correo único;
- código universitario único;
- un perfil por usuario;
- membresía única por estudiante/proyecto;
- invitación pendiente equivalente no duplicada;
- inscripción única por estudiante/actividad;
- slug público único;
- hash de token único;
- refresh/session token hash único;
- skills de actividad sin duplicados;
- skills de miembro sin duplicados;
- eventos de gamificación idempotentes;
- resultados de afinidad consistentes por perfil/área.

---

# 75. TRANSACCIONES

Usar transacciones para operaciones multi-entidad:

- aplicar importación;
- aceptar integrante;
- confirmar participación;
- registrar constancia;
- crear evidencia y metadata;
- persistir recálculo de afinidad;
- otorgar gamificación.

Evitar estados parciales.

---

# 76. PROCESAMIENTO ASÍNCRONO DE VALIDACIÓN

OCR, GitHub y URL checking pueden ser lentos.

Estados:

```text
PENDING
PROCESSING
COMPLETED
INCONCLUSIVE
FAILED
```

Persistir el trabajo.

Puede utilizarse worker dentro del monolito basado en BD + scheduler para evitar introducir Redis si no es necesario.

Requisitos:

- reclamar jobs de forma segura;
- evitar procesamiento doble;
- registrar intentos;
- backoff limitado;
- no perder jobs al reiniciar API.

---

# 77. CONTRATOS COMPARTIDOS

El paquete `shared` debe evolucionar hacia fuente real de contratos/enums cuando sea práctico.

Evitar duplicar entre API/web/móvil:

- roles;
- estados;
- categorías;
- participación;
- labels;
- tipos básicos.

El backend sigue siendo autoridad de validación.

---

# 78. API — GRUPOS CANÓNICOS

Agrupación conceptual:

```text
/api/auth/*
/api/activation/*
/api/users/*
/api/imports/*
/api/catalogs/*

/api/profile/*
/api/onboarding/*

/api/activities/*
/api/participation/*
/api/constancies/*

/api/projects/*
/api/evidences/*
/api/certificates/*
/api/validation/*

/api/affinity/*
/api/recommendations/*

/api/public-profiles/*
/api/contacts/*
/api/teams/*
/api/conversations/*

/api/gamification/*
/api/trajectory/*

/api/reports/*
/api/analytics/*
```

No cambiar una ruta existente solo por estética si su contrato final es correcto.

---

# 79. REQUERIMIENTOS FUNCIONALES DEFINITIVOS — 25

## RF01 — Provisionar e importar cuentas institucionales

Actor: Administrador.

Permite crear cuentas individuales, importar padrón, previsualizar, validar, aplicar idempotentemente y auditar.

## RF02 — Activar cuenta institucional

Actores: usuarios provisionados.

Permite recibir/solicitar activación, validar token y establecer contraseña.

## RF03 — Gestionar acceso, sesión y recuperación

Actores: todos.

Incluye login, logout, refresh, recuperación y revocación.

## RF04 — Gestionar usuarios, roles, estados y scope docente

Actor: Administrador.

Incluye estados y semestres autorizados del Docente.

## RF05 — Gestionar catálogos y configuración funcional

Actor: Administrador.

Incluye áreas, habilidades, categorías, gamificación, recursos y configuraciones autorizadas.

## RF06 — Gestionar onboarding y perfil declarativo

Actor: Estudiante.

Incluye cuestionario, intereses, habilidades autodeclaradas, áreas de mejora, disponibilidad, bio y visibilidad.

## RF07 — Visualizar perfil dinámico y evolución

Actor: Estudiante.

Incluye trayectoria, afinidad, respaldo, proyectos, actividades, certificados, constancias y evolución.

## RF08 — Gestionar actividades

Actores: Docente, Director, Sociedad Científica según tipo/contexto.

## RF09 — Consultar actividades

Actor: Estudiante.

Filtros por área, categoría, habilidad, modalidad, fecha y responsable.

## RF10 — Gestionar interés, inscripción y participación

Estudiante gestiona INTERESTED/REGISTERED. Responsable gestiona CONFIRMED/ABSENT.

## RF11 — Gestionar evidencias y certificados externos

Actor: Estudiante.

Incluye upload/link, metadata, extracción, comprobación, deduplicación y respaldo.

## RF12 — Gestionar constancias internas

Actor: Director.

Requiere participación confirmada.

## RF13 — Gestionar portafolio de proyectos

Actor: Estudiante.

Incluye alta, edición, visibilidad, repo, demo y estado.

## RF14 — Gestionar integrantes, contribuciones y tecnologías por integrante

Actor: Estudiante.

Incluye invitación, aceptación/rechazo, rol, contribución y skills.

## RF15 — Gestionar respaldo y retroalimentación de proyectos

Estudiante aporta evidencias, sistema corrobora y Docente retroalimenta dentro de scope.

## RF16 — Consultar proyectos autorizados

Actores: Estudiante y Docente.

Aplicar ownership, membresía, visibilidad y scope.

## RF17 — Calcular y consultar afinidad y respaldo

Actor: Estudiante.

Motor V2 explicable, versionado y con snapshots.

## RF18 — Generar y consultar recomendaciones

Actor: Estudiante.

Incluye actividades, recursos, fortalecimiento, compañeros y oportunidades.

## RF19 — Gestionar perfil compartible, QR y contactos

Actor: Estudiante.

Incluye slug, QR, visibilidad, solicitud, aceptación y rechazo.

## RF20 — Gestionar conformación de equipos

Actores: Estudiante y Docente como iniciador cuando corresponda.

Incluye necesidad, skills, sugerencias, invitaciones y aceptación.

## RF21 — Gestionar comunicación contextual

Actor: Estudiante.

Incluye chat privado autorizado y chat grupal de equipo. No alimenta afinidad.

## RF22 — Consultar progreso y gamificación

Actor: Estudiante.

Solo acciones verificables/configuradas.

## RF23 — Generar resumen de trayectoria

Actor: Estudiante.

Incluye selección, vista previa y PDF.

## RF24 — Consultar panel académico docente

Actor: Docente.

Siempre mediante TeacherScope.

## RF25 — Consultar analítica, mapa de afinidad y tendencias históricas

Actor: Director.

Descriptivo, no predictivo.

---

# 80. REQUERIMIENTOS NO FUNCIONALES — 10

## RNF01 — Usabilidad

Interfaces consistentes y comprensibles. Objetivo de prueba: >= 80 % de participantes completa tareas principales sin ayuda directa.

## RNF02 — Multiplataforma

Estudiante web+móvil; institucionales web; misma API y datos.

## RNF03 — Seguridad

Hash de contraseñas, JWT access/refresh, revocación, RBAC, resource policies, archivos privados, rate limit, DTO validation, CORS, headers de seguridad y secrets por entorno.

## RNF04 — Privacidad

Acceso mínimo necesario, perfil público opt-in, archivos privados, scope docente y chats excluidos de inferencia de competencia.

## RNF05 — Rendimiento

En entorno controlado:

```text
95 % CRUD sin archivos <= 3 s
reportes habituales <= 5 s
```

OCR/repo checks pueden ser async.

## RNF06 — Integridad y trazabilidad

FKs, unique constraints, transacciones, timestamps, actor responsable y audit log.

## RNF07 — Mantenibilidad

Monolito modular, servicios cohesivos, migraciones, contratos compartidos y sin lógica duplicada.

## RNF08 — Explicabilidad

Afinidad, respaldo y recomendaciones muestran razones y fuentes.

## RNF09 — Resiliencia de integraciones

Fallo de GitHub, SMTP, OCR o URL check no destruye información ni bloquea el sistema completo.

## RNF10 — Portabilidad/configuración

No hardcodear dominios, puertos, secrets, URLs, expiraciones ni credenciales externas.

---

# 81. LÍMITES DEFINITIVOS

Afinia NO:

- reemplaza SIU;
- reemplaza Teams;
- gestiona notas;
- administra asignaturas oficiales;
- predice rendimiento;
- diagnostica estudiantes;
- emite certificados oficiales;
- certifica profesionalmente habilidades;
- garantiza autenticidad jurídica de certificados externos;
- gestiona pagos;
- gestiona propiedad intelectual;
- aloja repositorios Git;
- es red social general;
- reemplaza mensajería institucional;
- utiliza ranking público obligatorio;
- convierte puntos en valor académico;
- utiliza IA generativa como núcleo;
- necesita integración oficial con Microsoft;
- necesita ML para afinidad;
- analiza chats para inferir competencia.

---

# 82. CHATBOT GENERATIVO

Fuera del alcance obligatorio.

No implementar en la versión base final descrita aquí.

Puede considerarse trabajo futuro solo si respeta privacidad/permisos y no modifica resultados, certifica o toma decisiones.

---

# 83. SEGURIDAD DE ARCHIVOS

Corregir el hallazgo actual de archivos servidos estáticamente.

Conocer una URL no debe permitir descarga sin autorización.

---

# 84. HARDENING

Agregar/confirmar:

- Helmet o headers equivalentes;
- rate limit;
- Swagger deshabilitable en producción;
- CORS explícito;
- límites de body/upload;
- logging sin secretos;
- validación de entorno al iniciar.

---

# 85. ELIMINACIÓN DE USUARIOS

Preferir:

```text
status = INACTIVE
```

sobre hard delete.

Hard delete solo para datos de prueba o cuentas sin historial bajo reglas controladas.

---

# 86. BORRADO Y REEMPLAZO DE ARCHIVOS

Al eliminar:

- autorizar;
- eliminar registro;
- eliminar archivo si ya no tiene referencias;
- reintentar/compensar fallos;
- evitar huérfanos.

Al reemplazar:

```text
guardar nuevo
→ validar/persistir
→ commit
→ retirar anterior
```

No borrar primero el archivo anterior.

---

# 87. PRUEBAS OBLIGATORIAS

No basta verificar HTTP 200.

## 87.1. Autorización negativa

Probar:

- estudiante no accede a admin;
- docente no ve otro semestre;
- docente no ve proyecto privado;
- sociedad no modifica actividad ajena;
- archivo no descarga sin autorización;
- miembro no edita proyecto sin permiso.

## 87.2. Importación

Probar:

- mismo CSV dos veces;
- usuario nuevo;
- actualización de semestre;
- conflictos;
- fila inválida;
- ausencia no desactiva.

## 87.3. Activación

Probar token válido, expirado, usado, revocado, reemplazado y cooldown.

## 87.4. Afinidad

Fixtures deterministas:

- área de mejora = 0;
- interested/registered = 0 experiencia;
- confirmed contribuye;
- constancia no duplica;
- proyecto declared pesa poco;
- backing modifica peso;
- evidencias repetidas no multiplican;
- evidencia de integrante recalcula al integrante;
- máximo 100;
- snapshots/version.

## 87.5. Validación

Probar:

- hash duplicado;
- PDF con texto;
- imagen OCR;
- URL válida;
- URL caída;
- URL privada bloqueada;
- GitHub público;
- repo inexistente;
- caída de API externa.

## 87.6. Recomendaciones

Probar:

- afinidad alta + respaldo bajo;
- área de mejora;
- actividad coincidente;
- skill faltante para equipo;
- usuario no visible no aparece.

---

# 88. UX OBLIGATORIA

La UI debe distinguir visualmente:

```text
Declarado por estudiante
Participación confirmada
Con respaldo
Corroborado
Revisado por docente
No se pudo comprobar
```

Evitar iconografía/textos que aparenten certificación oficial.

---

# 89. PERFIL FINAL DEL ESTUDIANTE

Debe presentar aproximadamente:

```text
Datos básicos
Bio
Semestre institucional

Intereses
Áreas de mejora

Afinidades
- score
- support level
- explicación

Experiencia registrada
- actividades
- proyectos
- certificados
- constancias

Tecnologías
- autodeclaradas
- respaldadas por experiencias

Evolución
Recomendaciones
Gamificación
Resumen de trayectoria
```

---

# 90. PANTALLA DE PROYECTO

Debe mostrar:

```text
Título
Descripción
Estado
Área
Tecnologías generales
Repositorio
Demo
Estado de enlaces
Nivel de respaldo

Integrantes
- rol
- contribución
- skills

Evidencias
Corroboraciones
Feedback docente
Bitácora funcional
```

---

# 91. PANTALLA DE AFINIDAD

Ejemplo:

```text
DESARROLLO WEB

Afinidad: 82/100
Respaldo: HIGH

¿Por qué?
+ Interés prioritario
+ 2 actividades confirmadas
+ Proyecto X corroborado
+ Proyecto Y respaldado
+ Certificado externo corroborado

No contribuye:
- Área de mejora
- Actividad solo marcada como interesada
```

---

# 92. PANTALLA DE RECOMENDACIONES

Cada recomendación responde:

```text
Qué se recomienda
Por qué
Qué área se relaciona
Qué señal la originó
```

Ejemplo:

> Taller de Ciberseguridad — recomendado porque marcaste Ciberseguridad como área de mejora y actualmente tu respaldo en esa área es bajo.

---

# 93. PANTALLA DE EQUIPOS

Mostrar:

```text
Objetivo
Skills requeridas
Skills cubiertas
Vacantes
Candidatos sugeridos
Motivo de sugerencia
Disponibilidad
```

No mostrar “ranking de mejores estudiantes”.

---

# 94. CLASES/ENTIDADES CONCEPTUALES DEL DISEÑO FINAL

El diagrama académico posterior debe corresponder a entidades/runtime reales.

Clases principales:

```text
User
Role
TeacherSemesterAccess
AccountToken
AuthSession
ImportBatch
ImportBatchRow

StudentProfile
AcademicArea
Skill
StudentInterest
StudentSkill
OnboardingRun
OnboardingAnswer

ActivityCategory
Activity
ActivitySkill
ActivityRegistration
InternalConstancy

Project
ProjectMember
ProjectMemberSkill
ProjectInvitation
ProjectEvidence
ProjectFeedback
RepositoryCheck
LinkCheck

ExternalCertificate
ValidationRecord

AffinityWeight
AffinityResult
AffinityContribution
AffinitySnapshot
AffinitySnapshotItem

Recommendation
Resource

ContactRequest
Contact
TeamNeed
Team
TeamMember
TeamInvitation
Conversation
ConversationMember
Message

GamificationCriterion
GamificationEvent
Badge
StudentBadge

AuditEvent
```

No es obligatorio implementar herencia `Student extends User`, `Teacher extends User`, etc. El enfoque rol + perfil actual puede conservarse.

---

# 95. RELACIONES PRINCIPALES

```text
Role 1 ─── * User
User 1 ─── 0..1 StudentProfile
User 1 ─── * AuthSession
User 1 ─── * AccountToken

Teacher(User) * ─── * Semester
mediante TeacherSemesterAccess

StudentProfile * ─── * AcademicArea
mediante StudentInterest

StudentProfile * ─── * Skill
mediante StudentSkill

Activity * ─── 1 AcademicArea
Activity * ─── * Skill
Activity 1 ─── * ActivityRegistration
StudentProfile 1 ─── * ActivityRegistration

Project 1 ─── * ProjectMember
StudentProfile 1 ─── * ProjectMember
ProjectMember * ─── * Skill
Project 1 ─── * ProjectEvidence
StudentProfile 1 ─── * ProjectEvidence
Project 1 ─── * ProjectFeedback

StudentProfile 1 ─── * ExternalCertificate

StudentProfile 1 ─── * AffinityResult
AcademicArea 1 ─── * AffinityResult
AffinityResult 1 ─── * AffinityContribution

StudentProfile 1 ─── * Recommendation

StudentProfile * ─── * StudentProfile
mediante Contact

Team 1 ─── * TeamMember
StudentProfile 1 ─── * TeamMember

Conversation 1 ─── * Message
Conversation * ─── * User
mediante ConversationMember
```

---

# 96. REGLAS PARA EL DIAGRAMA DE CLASES ACADÉMICO

- reflejar entidades realmente utilizadas;
- no inventar operaciones inexistentes;
- no representar actores como herencia si runtime no la usa;
- mostrar cardinalidades reales;
- agrupar por paquetes;
- no describir DDD si no existe.

---

# 97. PAQUETES FUNCIONALES

```text
1. Acceso e Identidad
2. Perfil y Onboarding
3. Actividades y Participación
4. Evidencias y Validación
5. Portafolio de Proyectos
6. Afinidad y Recomendaciones
7. Colaboración y Equipos
8. Gamificación y Trayectoria
9. Reportes y Analítica
```

---

# 98. DIAGRAMA DE COMPONENTES OBJETIVO

```text
[Web React] ─┐
             ├─► [API NestJS]
[Mobile] ────┘       │
                     ├─ Auth/Identity
                     ├─ Profiles/Onboarding
                     ├─ Activities
                     ├─ Projects
                     ├─ Evidence Validation
                     ├─ Affinity
                     ├─ Recommendations
                     ├─ Collaboration
                     ├─ Gamification
                     └─ Analytics
                         │
                 ┌───────┼──────────┐
                 ▼       ▼          ▼
             PostgreSQL Storage   SMTP/GitHub
```

---

# 99. DESPLIEGUE

Mínimo:

```text
Dispositivo móvil → Expo/React Native
Navegador → React/Vite
ambos → HTTPS → NestJS API
                  ├─ PostgreSQL
                  └─ Storage privado
```

Integraciones opcionales/controladas:

```text
SMTP
GitHub API
```

No dibujar servicios inexistentes.

---

# 100. VARIABLES DE ENTORNO OBJETIVO

Ejemplo:

```text
NODE_ENV
API_PORT
WEB_ORIGINS

POSTGRES_HOST
POSTGRES_PORT
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD

JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
ACCESS_TOKEN_TTL_MINUTES
REFRESH_TOKEN_TTL_DAYS

ACTIVATION_TOKEN_TTL_HOURS
PASSWORD_RESET_TOKEN_TTL_MINUTES
ACTIVATION_RESEND_COOLDOWN_SECONDS

INSTITUTIONAL_EMAIL_DOMAINS

SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM

STORAGE_DRIVER
STORAGE_PATH
MAX_UPLOAD_MB

GITHUB_TOKEN
ANALYTICS_MIN_GROUP_SIZE
```

`.env.example`, Docker y README deben coincidir. Nunca incluir `.env` real en entregas.

---

# 101. EMAIL

Abstraer mediante `MailPort` o equivalente.

Desarrollo puede usar SMTP local. Producción requiere SMTP real configurado.

No hardcodear proveedor.

---

# 102. OBSERVABILIDAD

Logging estructurado mínimo:

```text
request_id
user_id cuando corresponda
route
status
duration
error_code
```

No loggear JWT completos, passwords, activation tokens, refresh tokens ni binarios.

---

# 103. ERRORES DE API

Formato consistente:

```text
code
message
details opcional
request_id opcional
```

No exponer stack traces en producción.

---

# 104. ESTADOS VISUALES DE VALIDACIÓN

Usar lenguaje como:

```text
Declarado
Con respaldo
Corroborado
Revisado
No se pudo comprobar
```

No usar:

```text
Certificado por Afinia
Competencia validada oficialmente
```

---

# 105. PRIVACIDAD DE CERTIFICADOS

Archivo privado por defecto.

El estudiante puede hacer visibles metadata seleccionada y estado de respaldo sin publicar el PDF completo.

---

# 106. PRIVACIDAD DE PROYECTOS

La visibilidad se aplica en backend, no solo ocultando botones.

---

# 107. POLICIES DE RECURSO

Conservar guards globales y complementar con políticas como:

```text
canViewProfile
canViewProject
canEditProject
canViewEvidence
canManageActivity
canConfirmParticipation
canAccessConversation
```

RBAC por sí solo no basta.

---

# 108. TEACHER SCOPE COMO FUENTE ÚNICA

`TeacherScopeService` o equivalente debe usarse por perfiles, proyectos, afinidad, reportes, feedback, actividades y equipos cuando corresponda.

No duplicar lógica de semestre en múltiples servicios.

---

# 109. RECOMPUTACIÓN CENTRALIZADA

Crear mecanismo central tipo:

```text
TrajectoryRecalculationService
```

o evento interno equivalente que coordine:

```text
affinity
recommendations
gamification cuando corresponda
```

Debe recibir el `student_profile_id` correcto.

---

# 110. SWAGGER

Actualizar título, versión, descripciones, ejemplos, roles y estados.

Eliminar referencias a 30 %/70 %.

Deshabilitable en producción.

---

# 111. README FINAL

Debe describir propósito, arquitectura, prerequisitos reales, versión Node, puertos, Docker, `.env.example`, migraciones, seed, web, mobile y pruebas.

No conservar instrucciones contradictorias.

---

# 112. DATOS DEMO

Seeds de desarrollo pueden existir si están claramente identificados.

No mezclar demo con comportamiento productivo.

---

# 113. MIGRACIONES

Toda modificación de esquema mediante nuevas migraciones.

No reescribir migraciones históricas aplicadas como si nunca hubieran existido.

---

# 114. MIGRACIÓN DE DATOS ANTIGUOS

Al migrar:

- mapear estados;
- mantener IDs cuando sea posible;
- conservar timestamps;
- preservar evidencias;
- recalcular afinidad V2;
- conservar snapshots V1 como históricos si es viable;
- marcar versión de motor.

No comparar V1 y V2 como la misma escala sin indicar versión.

---

# 115. PROTECCIÓN CONTRA GAMING

Impedir que un estudiante mejore artificialmente perfil mediante:

- proyectos vacíos;
- archivos duplicados;
- mensajes;
- intereses repetidos;
- áreas de mejora;
- muchas URLs;
- múltiples evidencias del mismo hecho.

Mecanismos:

- caps;
- rendimientos decrecientes;
- hash;
- backing tiers;
- familias de fuentes;
- idempotencia.

---

# 116. NO SOBRE-PROMETER

Sí:

> “Experiencia registrada.”

> “Afinidad identificada.”

> “Respaldo alto.”

> “Certificado externo aportado.”

> “Participación confirmada.”

No:

> “Competencia certificada.”

> “Perfil profesional garantizado.”

> “Validado por la Universidad.”

> “La IA confirma que domina X.”

---

# 117. RELACIÓN CON TEAMS/SIU

Ejemplo de diferenciación:

```text
Teams:
anuncia una clase espejo.

Afinia:
registra actividad estructurada,
confirma participación,
relaciona área/skills,
actualiza trayectoria,
recalcula afinidad,
genera recomendaciones.
```

---

# 118. RELACIÓN CON GITHUB

```text
GitHub:
aloja código.

Afinia:
relaciona repositorio con proyecto,
integrantes y contribuciones,
corrobora metadata pública
y lo integra a trayectoria.
```

---

# 119. RELACIÓN CON CERTIFICADORAS

```text
Cisco/Coursera/etc.:
emiten credencial.

Afinia:
organiza credencial,
extrae metadata,
comprueba mecanismo de verificación cuando existe
y la integra a trayectoria.
```

---

# 120. FLUJO COMPLETO DEL ESTUDIANTE

```text
ADMIN importa/provisiona
        ↓
PENDING_ACTIVATION
        ↓
correo + token
        ↓
activación
        ↓
login
        ↓
onboarding
        ↓
intereses + autodeclaraciones + mejora
        ↓
perfil inicial
        ↓
actividades / proyectos / certificados
        ↓
validación y respaldo
        ↓
trayectoria
        ↓
afinidad + support
        ↓
recomendaciones
        ↓
QR / contactos / equipos
        ↓
colaboración
        ↓
evolución
        ↓
gamificación
        ↓
resumen de trayectoria PDF
```

---

# 121. EJEMPLO COMPLETO

```text
Admin importa a Ana
→ Ana queda PENDING_ACTIVATION
→ recibe correo
→ activa cuenta
→ onboarding sugiere Desarrollo Web
→ Ana confirma Desarrollo Web
→ declara React INTERMEDIATE
→ afinidad inicial moderada / respaldo LOW
→ Docente publica taller React
→ Ana se inscribe
→ Docente confirma participación
→ sube afinidad y respaldo
→ Ana crea Proyecto X
→ invita a Bruno
→ Bruno acepta
→ Ana declara contribución Frontend/React
→ agrega GitHub
→ GitHub confirma repo + React
→ agrega evidencia
→ proyecto pasa a CORROBORATED
→ Docente agrega feedback
→ proyecto pasa a REVIEWED
→ Afinia recalcula
→ recomienda Hackathon Web
→ Ana comparte QR
→ recibe solicitud de colaboración
→ forma equipo
→ exporta Resumen de Trayectoria
```

---

# 122. INFORMACIÓN QUE NO CAMBIA AFINIDAD

```text
100 mensajes → 0 afinidad.
Área de mejora → 0 afinidad.
20 actividades solo interesadas → 0 experiencia.
10 copias del mismo screenshot → no multiplican.
ADVANCED autodeclarado → señal débil, no respaldo.
```

---

# 123. INFORMACIÓN FUERTE

```text
participación confirmada
+ proyecto con integrante aceptado
+ repositorio accesible
+ tecnología detectada
+ evidencia
+ feedback docente
```

produce respaldo fuerte sin afirmar certificación profesional.

---

# 124. MIGRACIÓN DESDE EL 70 % — BATCHES

No implementar todo en una modificación masiva.

Cada batch:

```text
1. diagnóstico de archivos afectados;
2. migración;
3. backend;
4. web/móvil;
5. pruebas;
6. limpieza;
7. commit.
```

---

# 125. BATCH 0 — BASELINE

Antes de modificar:

- rama de reingeniería;
- build actual;
- suites E2E actuales;
- estado de migraciones;
- inventario de diferencias;
- backup lógico si existe BD con datos útiles.

Entregable sugerido:

```text
BASELINE_REENGINEERING.md
```

---

# 126. BATCH 1 — IDENTIDAD Y SEGURIDAD

Implementar:

- eliminación del registro público;
- account states;
- importación;
- activación;
- password reset;
- sessions/refresh;
- rate limiting;
- seguridad de entorno;
- UI web/móvil correspondiente;
- pruebas.

---

# 127. BATCH 2 — PERFIL Y ONBOARDING

Implementar:

- datos institucionales no editables;
- cuestionario;
- intereses;
- habilidades autodeclaradas;
- áreas de mejora;
- disponibilidad;
- privacidad;
- shared contracts.

---

# 128. BATCH 3 — STORAGE Y VALIDACIÓN

Implementar:

- storage privado;
- descarga autorizada;
- SHA-256;
- extracción PDF;
- OCR;
- QR documental si es viable;
- link checker seguro;
- validation records;
- worker async persistente;
- unificación de rutas de evidencias.

---

# 129. BATCH 4 — ACTIVIDADES

Implementar:

- Docente como gestor dentro de scope;
- Director;
- Sociedad;
- skills por actividad;
- máquina de estados;
- participación;
- confirmación;
- constancias sin doble conteo.

---

# 130. BATCH 5 — PROYECTOS

Implementar:

- contribuciones por integrante;
- skills por integrante;
- backing tiers;
- GitHub opcional;
- demo checks;
- evidencias;
- feedback;
- bitácora;
- corrección de recálculo por integrante.

---

# 131. BATCH 6 — MOTOR DE AFINIDAD V2

Implementar exactamente:

- pesos;
- caps;
- diminishing returns;
- support score;
- support level;
- diversity rule;
- contributions;
- snapshots;
- recálculo.

Migrar datos existentes sin destruir historia.

---

# 132. BATCH 7 — RECOMENDACIONES

Actualizar para consumir V2.

Implementar actividades, fortalecimiento, recursos, teammates y razones.

---

# 133. BATCH 8 — COLABORACIÓN

Implementar:

- perfil público;
- slug;
- QR;
- contactos;
- necesidades de equipo;
- sugerencias;
- invitaciones;
- equipos;
- mensajería contextual.

No analizar mensajes.

---

# 134. BATCH 9 — GAMIFICACIÓN Y EXPORT

Implementar:

- eventos idempotentes;
- puntos;
- badges;
- progreso;
- resumen de trayectoria;
- PDF.

---

# 135. BATCH 10 — REPORTES Y ANALÍTICA

Implementar:

- TeacherScope en todos los reportes docentes;
- dashboard docente;
- mapa Dirección;
- evolución descriptiva;
- privacy threshold;
- métricas agregadas.

---

# 136. BATCH 11 — HARDENING FINAL

Revisar:

- files authorization;
- headers;
- CORS;
- Swagger;
- logs;
- orphan cleanup;
- URL safety;
- session revocation;
- permisos;
- dependencias;
- compilación limpia.

---

# 137. BATCH 12 — REGRESIÓN Y LIMPIEZA

Eliminar:

- textos obsoletos 30/70 %;
- rutas obsoletas;
- servicios duplicados;
- DTOs muertos;
- pantallas “Próximamente” ya implementadas;
- catálogos hardcodeados inconsistentes;
- scaffolding temporal.

Conservar pruebas, migraciones y documentación útil.

---

# 138. DEFINICIÓN DE TERMINADO

No basta compilar.

Para declarar 100 %:

1. funcionan los 25 RF;
2. no existe registro público;
3. activación real;
4. importación idempotente;
5. archivos privados;
6. scope docente global;
7. validación automática funcional;
8. proyectos con respaldo;
9. afinidad V2 explicable;
10. support visible;
11. recomendaciones consumen V2;
12. QR/contactos/equipos funcionan;
13. mensajería autorizada;
14. gamificación real;
15. export PDF;
16. analítica descriptiva;
17. pruebas cubren permisos;
18. frontend/móvil consumen API real;
19. README/config coherentes;
20. no existen mocks permanentes sustituyendo funciones.

---

# 139. CRITERIOS DE ACEPTACIÓN CLAVE

```text
Cuenta:
Un correo externo no provisionado no puede crear cuenta.

Perfil:
El estudiante no puede cambiar su semestre institucional.

Habilidad:
ADVANCED autodeclarado se muestra como autodeclarado.

Actividad:
Solo CONFIRMED se considera experiencia.

Proyecto:
Crear 10 proyectos vacíos no construye respaldo alto.

Evidencia:
Subir 10 veces el mismo archivo no multiplica resultados.

Repo:
Detectar React respalda uso, no dominio profesional.

Afinidad:
Área de mejora no suma.

Chat:
100 mensajes no aumentan afinidad.

Docente:
Nunca recibe datos de estudiantes fuera de scope.

Archivo:
Conocer URL no permite descargar sin autorización.
```

---

# 140. REGLA FINAL PARA CLAUDE CODE / CODEX

No optimizar para “marcar RF como hechos”.

Optimizar para:

```text
coherencia
integridad
seguridad
trazabilidad
explicabilidad
valor académico
mantenibilidad
```

Si una implementación rápida viola estas propiedades, no está terminada.

---

# 141. ORDEN DE TRABAJO DEL AGENTE

```text
PASO 1  Auditar diferencias.
PASO 2  Generar plan por batches.
PASO 3  Presentar archivos/migraciones afectados.
PASO 4  Implementar un batch.
PASO 5  Ejecutar pruebas.
PASO 6  Corregir regresiones.
PASO 7  Commit.
PASO 8  Continuar.
```

No mezclar todo en un commit gigante.

---

# 142. REPORTE TRAS CADA BATCH

Formato mínimo:

```text
BATCH:
Estado:

Implementado:
- ...

Migraciones:
- ...

Archivos principales:
- ...

Pruebas:
- ...

Resultados:
- ...

Pendientes:
- ...

Riesgos:
- ...
```

No reportar “completado” con pruebas relevantes fallando.

---

# 143. REGLA DE CONSERVACIÓN

No eliminar funcionalidad existente solo porque esta especificación la reorganiza.

Primero comprobar uso, datos, dependencias y pruebas; luego migrar o retirar controladamente.

---

# 144. FUENTE DE VERDAD FINAL

Al terminar:

```text
DOCUMENTO FINAL DE GRADO
            ↕
ESTA ESPECIFICACIÓN
            ↕
SOFTWARE
```

deben describir el mismo sistema.

---

# 145. CHECKLIST FINAL

```text
[ ] Sin registro público
[ ] Importación idempotente
[ ] Activación segura
[ ] Recuperación segura
[ ] Sesiones revocables
[ ] Datos institucionales protegidos
[ ] Onboarding
[ ] Perfil dinámico
[ ] Habilidades diferenciadas
[ ] Áreas de mejora sin afinidad
[ ] Actividades por responsabilidad
[ ] Participación confirmada
[ ] Storage privado
[ ] Hash de evidencia
[ ] Extracción/OCR
[ ] Link checking seguro
[ ] Certificados con backing tier
[ ] Proyectos con backing tier
[ ] Contribuciones por integrante
[ ] GitHub opcional
[ ] Feedback docente
[ ] Bitácora
[ ] Afinidad V2
[ ] Support score
[ ] Snapshots
[ ] Recomendaciones
[ ] QR
[ ] Contactos
[ ] Equipos complementarios
[ ] Mensajería contextual
[ ] Gamificación real
[ ] Export trayectoria
[ ] Teacher scope completo
[ ] Analítica descriptiva
[ ] Seguridad/hardening
[ ] Regresión
[ ] README final
[ ] Cero comportamiento obsoleto contradictorio
```

---

# 146. CIERRE

Afinia debe terminar siendo una plataforma donde la trayectoria complementaria del estudiante no dependa de una lista de afirmaciones personales ni de información dispersa.

Cadena final:

```text
IDENTIDAD AUTORIZADA
        ↓
PREFERENCIAS
        ↓
EXPERIENCIAS
        ↓
RESPALDO
        ↓
TRAYECTORIA
        ↓
AFINIDAD EXPLICABLE
        ↓
RECOMENDACIONES
        ↓
COLABORACIÓN
        ↓
VISIBILIZACIÓN DE EXPERIENCIA
```

La pregunta que cada módulo debe superar es:

> **¿Esta funcionalidad ayuda a construir, respaldar, interpretar o aprovechar la trayectoria académica complementaria del estudiante?**

Si la respuesta es no, la funcionalidad no pertenece al núcleo de Afinia.

---

**FIN — AFINIA 100 % / ESPECIFICACIÓN DEFINITIVA**
