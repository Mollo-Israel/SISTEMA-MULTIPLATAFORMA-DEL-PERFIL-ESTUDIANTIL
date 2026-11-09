# AFINIA — ESPECIFICACIÓN MAESTRA FINAL V2

**Versión:** 2.0 — Línea base funcional, técnica y de UX posterior a revisión integral  
**Fecha de cierre:** 03 de octubre de 2026  
**Proyecto:** Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico en Ingeniería en Sistemas Informáticos – Univalle  
**Destinatario:** Claude Code, Codex u otro agente de desarrollo que reciba el repositorio actual de Afinia  
**Estado:** FUENTE DE VERDAD OBJETIVO PARA LA SIGUIENTE REINGENIERÍA  
**Sustituye funcionalmente:** `AFINIA_100_ESPECIFICACION_DEFINITIVA` v1.0 del 20/09/2026 en todo punto donde exista contradicción  
**Integra:** revisión funcional y de UX registrada en `corregir.docx`

---

# 0. PROPÓSITO DE ESTE DOCUMENTO

Este documento convierte la visión final de Afinia en un contrato de implementación verificable.

No debe interpretarse como:

- una invitación a reescribir el proyecto desde cero;
- una lista de ideas opcionales;
- un prototipo;
- un documento puramente académico;
- una excusa para agregar arquitectura que el repositorio no necesita.

Debe interpretarse como:

> **La descripción final del comportamiento que debe tener Afinia y de las reglas que deben respetar software, documentación, diagramas y pruebas.**

La implementación final debe cumplir simultáneamente:

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

Una funcionalidad que no puede justificar esta cadena debe ser revisada antes de incorporarse al núcleo.

---

# 1. PRECEDENCIA Y REGLA DE INTERPRETACIÓN

Orden de autoridad:

1. este documento V2;
2. decisiones explícitas que el propietario del proyecto incorpore posteriormente;
3. `AFINIA_100_ESPECIFICACION_DEFINITIVA` v1.0 solo en aspectos no contradichos;
4. software actual;
5. README, comentarios y documentación histórica.

Cuando una regla anterior contradiga esta V2, prevalece esta V2.

El agente NO debe resolver silenciosamente contradicciones.

Debe:

```text
detectar
→ registrar
→ aplicar la regla de esta V2
→ migrar de forma controlada
→ agregar prueba de regresión
```

---

# 2. INSTRUCCIÓN PRINCIPAL PARA CLAUDE CODE / CODEX

Antes de modificar código:

1. ejecutar `git status`, rama actual y últimos commits;
2. inspeccionar estructura completa del monorepo;
3. identificar arquitectura real;
4. revisar migraciones y entidades actuales;
5. revisar tests existentes;
6. revisar web y mobile existentes;
7. revisar `.env.example`, Docker y scripts npm;
8. clasificar cada requisito V2 como:
   - IMPLEMENTADO;
   - IMPLEMENTADO PERO INCORRECTO;
   - PARCIAL;
   - FALTANTE;
   - OBSOLETO;
9. generar `AUDITORIA_GAP_AFINIA_V2.md`;
10. generar plan de implementación por batches;
11. recién entonces modificar.

No:

- reescribir de cero;
- crear microservicios;
- crear capas nuevas por costumbre;
- reemplazar lógica válida;
- borrar historia;
- hacer hard reset de base como mecanismo de desarrollo;
- modificar migraciones históricas ya aplicadas;
- introducir mocks permanentes;
- introducir datos hardcodeados productivos;
- avanzar con compilación o pruebas rotas;
- afirmar que una función está terminada sin probarla.

---

# 3. VISIÓN DEL PRODUCTO

Afinia es una plataforma académica complementaria enfocada en construir y aprovechar la trayectoria académica complementaria del estudiante.

No es un SIU.

No es un LMS.

No es una certificadora.

No es una red social general.

No reemplaza Microsoft Teams.

No reemplaza GitHub.

No reemplaza sistemas oficiales de notas.

No pretende determinar quién es “mejor estudiante”.

El sistema reúne de forma estructurada:

- identidad institucional autorizada;
- intereses;
- áreas que el estudiante desea fortalecer;
- orientación inicial;
- actividades;
- participación confirmada;
- proyectos;
- contribuciones individuales;
- evidencias;
- repositorios y recursos asociados;
- certificaciones externas;
- constancias internas;
- retroalimentación académica;
- contactos;
- equipos;
- gamificación;
- historial de evolución.

A partir de esa información permite:

- representar trayectoria;
- calcular afinidad explicable basada en experiencia;
- medir respaldo;
- recomendar oportunidades;
- sugerir colaboración;
- mostrar evolución;
- generar un perfil compartible;
- exportar un resumen curricular;
- proporcionar analítica descriptiva a actores institucionales.

---

# 4. PROBLEMA QUE RESUELVE

Las experiencias complementarias de un estudiante suelen quedar dispersas entre:

- Teams;
- correos;
- GitHub;
- certificados;
- formularios;
- actividades de carrera;
- archivos personales;
- recursos externos;
- proyectos de aula;
- grupos de estudiantes.

El problema no es únicamente “guardar información”.

El problema es:

> **convertir experiencias dispersas en una trayectoria comprensible, trazable y aprovechable sin confundir declaración con evidencia ni sustituir sistemas institucionales.**

---

# 5. PRINCIPIOS NO NEGOCIABLES

## 5.1. Declaración no equivale a experiencia

Un estudiante puede declarar intereses.

No puede obtener afinidad fuerte únicamente porque diga que conoce una tecnología.

Ejemplo válido:

```text
“Me interesa React”
→ se utiliza en recomendaciones.
```

Ejemplo inválido:

```text
“Sé React”
→ Afinia asigna automáticamente afinidad alta.
```

## 5.2. Afinidad no es certificación

`AFFINITY_SCORE=80` significa que existe trayectoria relevante acumulada según reglas del sistema.

No significa:

- 80 % de dominio profesional;
- nota;
- certificación;
- evaluación psicológica;
- acreditación institucional.

## 5.3. IA no es autoridad

La IA puede:

- resumir;
- sugerir;
- identificar posibles inconsistencias;
- proponer etiquetas;
- ayudar a redactar CV;
- generar explicaciones;
- moderar contenido ambiguo.

La IA NO puede por sí sola:

- acreditar una habilidad;
- incrementar afinidad;
- marcar una evidencia como auténtica;
- emitir constancia;
- confirmar participación;
- asignar puntaje académico;
- aprobar una actividad.

Regla:

> **La IA interpreta y sugiere. Las reglas deterministas de Afinia deciden.**

## 5.4. Procedencia obligatoria

Toda señal importante debe conservar su origen.

Ejemplos:

```text
INTEREST_DECLARED
ORIENTATION_RESPONSE
ACTIVITY_CONFIRMED
PROJECT_MEMBER_CONTRIBUTION
PROJECT_EVIDENCE
GITHUB_DETECTED
EXTERNAL_CERTIFICATE
INTERNAL_CONSTANCY
TEACHER_FEEDBACK
```

## 5.5. Explicabilidad

Afinidad, respaldo y recomendaciones deben poder responder:

- qué resultado se produjo;
- por qué;
- qué fuentes contribuyeron;
- cuándo;
- con qué versión del motor.

## 5.6. Privacidad primero

El sistema no debe exponer información por comodidad.

La visibilidad debe ser explícita y controlada en backend.

## 5.7. Historia antes que hard delete

Cuentas, actividades, proyectos y otras entidades con historia no deben borrarse físicamente como operación normal.

## 5.8. No duplicar herramientas externas

GitHub aloja código.

Afinia relaciona el repositorio con la trayectoria.

Teams comunica.

Afinia registra una actividad estructurada y su participación.

Cisco/IBM/Coursera emiten credenciales.

Afinia organiza y relaciona esas credenciales.

---

# 6. ACTORES DEFINITIVOS

Se mantienen exactamente cinco actores humanos.

## 6.1. Estudiante

Clientes:

- Web.
- Mobile.

Puede:

- activar cuenta;
- recuperar acceso;
- completar onboarding;
- gestionar preferencias;
- consultar perfil;
- explorar actividades;
- inscribirse;
- registrar proyectos;
- aceptar invitaciones;
- registrar contribuciones;
- aportar evidencias;
- registrar certificaciones externas;
- consultar afinidad y respaldo;
- recibir recomendaciones;
- administrar visibilidad;
- compartir QR;
- gestionar contactos;
- crear/participar en equipos;
- consultar gamificación;
- consultar trayectoria;
- generar CV/resumen curricular.

No puede modificar:

- correo institucional;
- código universitario;
- semestre;
- rol;
- estado de cuenta;
- participación confirmada;
- constancias institucionales.

## 6.2. Docente

Cliente:

- Web.

Puede:

- acceder únicamente a estudiantes de semestres autorizados;
- crear actividades académicas para su scope;
- enviar actividades a aprobación;
- corregir actividades observadas;
- confirmar participación de sus actividades;
- consultar perfiles permitidos;
- consultar proyectos visibles;
- registrar retroalimentación;
- consultar dashboard descriptivo;
- iniciar necesidades de equipo en contexto académico autorizado.

No puede:

- ver estudiantes fuera del scope;
- asignar notas;
- certificar competencias;
- aprobar su propia actividad cuando requiere Dirección;
- emitir certificados oficiales.

## 6.3. Director de Carrera

Cliente:

- Web.

Puede:

- crear actividades académicas de carrera;
- aprobar/observar/rechazar propuestas de Docente y Sociedad;
- supervisar criterios de gamificación asociados;
- consultar analítica agregada;
- consultar mapas de afinidad;
- consultar tendencias;
- administrar recursos académicos autorizados según política;
- emitir o habilitar constancias internas bajo reglas del sistema;
- consultar métricas históricas.

No usa Afinia para:

- notas;
- expedientes oficiales;
- certificación profesional.

## 6.4. Sociedad Científica

Cliente:

- Web.

Puede:

- crear actividades extracurriculares;
- enviarlas a aprobación;
- corregir observaciones;
- administrar participantes de sus actividades;
- confirmar participación;
- consultar métricas de sus actividades.

No puede:

- crear actividades académicas oficiales de carrera;
- aprobarse a sí misma;
- acceder a analítica global sensible.

## 6.5. Administrador del Sistema

Cliente:

- Web.

Puede:

- provisionar usuarios;
- importar padrón;
- editar datos institucionales permitidos;
- asignar rol entre los cinco roles definidos;
- cambiar estados;
- configurar TeacherScope;
- gestionar catálogos;
- gestionar parámetros técnicos;
- consultar auditoría técnica.

No es autoridad académica.

No debe:

- confirmar participación como operación ordinaria;
- otorgar constancias académicas;
- decidir afinidad;
- aprobar actividades académicas;
- visualizar contraseñas o tokens de estudiantes.

---

# 7. ROLES FIJOS

Los roles de negocio son cerrados:

```text
STUDENT
TEACHER
CAREER_DIRECTOR
SCIENTIFIC_SOCIETY
ADMIN
```

No crear una pantalla de administración genérica de roles.

El Administrador puede asignar uno de los roles definidos cuando tenga permiso.

No puede inventar roles arbitrarios en producción.

---

# 8. CLIENTES

## 8.1. Web

Soporta los cinco actores.

## 8.2. Mobile

Orientado únicamente al Estudiante.

No implementar administración móvil por paridad artificial.

La app móvil debe ofrecer una experiencia adaptada, no una simple reducción visual de la web.

---

# 9. ARQUITECTURA OBJETIVO

Conservar monolito modular.

```text
React + Vite
      │
      │ HTTPS / JSON
      ▼
NestJS API
      │
      ├── PostgreSQL
      ├── Storage privado
      ├── SMTP
      ├── GitHub API
      ├── URL checks
      └── AI Assistant Adapter opcional

React Native + Expo
      │
      └──────────► misma API
```

No migrar a microservicios.

No introducir Redis salvo necesidad demostrada.

Workers persistentes pueden utilizar PostgreSQL + scheduler si es suficiente.

---

# 10. ARRANQUE, DOCKER Y CONFIGURACIÓN

El proyecto debe ser reproducible.

## 10.1. PostgreSQL Docker

El puerto interno permanece:

```text
5432
```

El puerto host se toma de:

```text
POSTGRES_PORT
```

`.env.example` puede sugerir:

```text
POSTGRES_PORT=5435
```

para evitar conflicto frecuente con PostgreSQL local.

## 10.2. Scripts Docker

`package.json` debe ejecutar Docker Compose con el `.env` raíz explícito:

```text
docker compose --env-file .env -f docker/docker-compose.yml ...
```

Scripts mínimos:

```text
db:up
db:down
db:reset
db:logs
db:wait
db:rebuild
```

`db:rebuild` debe:

```text
reset
→ esperar health
→ migraciones
→ seed
```

No disparar migraciones antes de que PostgreSQL acepte conexiones.

## 10.3. Configuración coherente

`.env.example`, Docker, README y código deben coincidir.

No hardcodear:

- puertos;
- dominios;
- secrets;
- SMTP;
- URLs;
- TTL;
- proveedor IA;
- GitHub token.

---

# 11. IDENTIDAD Y PROVISIONAMIENTO

No existe registro público de estudiantes.

Cuenta se crea mediante:

```text
1. importación de padrón;
2. creación manual por Admin;
3. seed del Admin inicial.
```

Estado inicial:

```text
PENDING_ACTIVATION
```

Estados:

```text
PENDING_ACTIVATION
ACTIVE
SUSPENDED
INACTIVE
```

No hard delete de cuentas con historia.

---

# 12. CREACIÓN MANUAL DE ESTUDIANTE

Campos obligatorios:

```text
first_name
last_name
institutional_email
university_code
semester
role=STUDENT
```

`semester` es obligatorio.

El estudiante nunca lo edita.

Se actualiza mediante:

- padrón;
- Administrador autorizado;
- futura integración institucional real si llega a existir.

Validar:

- trim;
- espacios duplicados;
- formato;
- dominio institucional;
- código único;
- email único.

---

# 13. IMPORTACIÓN DE PADRÓN

Formato mínimo:

```text
CSV UTF-8
```

Campos:

```text
university_code
first_name
last_name
institutional_email
semester
```

Previsualización:

```text
NEW
UPDATE
UNCHANGED
CONFLICT
INVALID
```

Debe ser idempotente.

Ausencia en un nuevo archivo NO desactiva automáticamente.

Nunca sobrescribir:

- contraseña;
- preferencias;
- trayectoria;
- proyectos;
- evidencias;
- afinidad;
- privacidad.

Auditar batch y filas.

---

# 14. CORREO INSTITUCIONAL

Dominios mediante:

```text
INSTITUTIONAL_EMAIL_DOMAINS
```

Para el despliegue de Univalle pueden configurarse:

```text
univalle.edu
est.univalle.edu
```

No aceptar correo externo en usuarios institucionales.

El Admin NO recibe códigos de activación o recuperación destinados al estudiante.

---

# 15. ACTIVACIÓN DE CUENTA

## 15.1. Flujo principal

```text
Admin provisiona
→ PENDING_ACTIVATION
→ estudiante recibe correo institucional
→ correo contiene enlace de activación + código manual de respaldo
→ estudiante abre enlace o introduce código
→ define contraseña
→ cuenta ACTIVE
→ login
```

## 15.2. Enlace y código

Ambos representan el mismo evento de activación.

El enlace es el flujo principal.

El código es fallback manual.

Persistir únicamente hashes.

Campos sugeridos:

```text
id
user_id
purpose
token_hash
code_hash
created_at
expires_at
used_at
revoked_at
failed_attempts
```

Propósitos:

```text
ACCOUNT_ACTIVATION
PASSWORD_RESET
```

## 15.3. Valores iniciales definitivos

```text
ACTIVATION_TOKEN_TTL_HOURS=48
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
ACTIVATION_RESEND_COOLDOWN_SECONDS=120
ACTIVATION_RESEND_MAX_PER_DAY=5
ACTIVATION_CODE_MAX_ATTEMPTS=10
```

Nuevo token/código invalida el anterior del mismo propósito.

Usar uno invalida el evento completo.

## 15.4. Reenvío

Respuesta pública genérica.

Aplicar:

- cooldown;
- límite diario;
- rate limit global;
- auditoría;
- no enumeración de cuentas.

---

# 16. RECUPERACIÓN DE ACCESO

Mismo principio de seguridad que activación.

```text
correo institucional
→ solicitud
→ respuesta genérica
→ token/código temporal
→ nueva contraseña
→ revocación de sesiones previas
```

No enviar contraseñas.

No mostrar al Admin tokens.

---

# 17. CONTRASEÑA

Política servidor:

- mínimo 12 caracteres;
- máximo >= 128;
- al menos una mayúscula;
- al menos una minúscula;
- al menos un número;
- al menos un símbolo;
- sin espacios;
- no igual al correo;
- no contener trivialmente código universitario.

El frontend debe usar la MISMA política.

La barra visual debe alcanzar estado completo cuando todas las reglas válidas se cumplen.

No debe quedar parcialmente verde cuando el servidor ya considera válida la contraseña.

---

# 18. SESIONES

Access token corto + refresh rotatorio.

Inicial:

```text
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7
```

Web:

- access token en memoria cuando sea viable;
- refresh HttpOnly/Secure/SameSite apropiado en producción.

Mobile:

- Expo SecureStore.

Cambio de contraseña o suspensión:

```text
revoca sesiones activas
```

Logout:

```text
revoca sesión actual
```

---

# 19. SMTP Y ENTREGABILIDAD REAL

Desarrollo:

- SMTP local/MailHog permitido.

Producción:

- SMTP real verificado.

Abstraer con `MailPort` o equivalente.

Variables:

```text
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
SMTP_REPLY_TO
```

Documentar para producción:

- SPF;
- DKIM;
- DMARC;
- remitente verificado;
- rebotes;
- reputación;
- pruebas con Outlook.

No reportar “correo enviado” como entrega real si SMTP falló.

Persistir estado mínimo de intento:

```text
QUEUED
SENT_TO_SMTP
FAILED
```

No registrar contenido sensible.

---

# 20. ONBOARDING FINAL

El onboarding es guiado.

No mostrar al estudiante nuevo todo el sistema vacío.

## 20.1. Secuencia

```text
CUENTA ACTIVE
   ↓
PASO 1 — Perfil base
   ↓
PASO 2 — Preferencias e intereses
   ↓
PASO 3 — Áreas que desea mejorar
   ↓
PASO 4 — Disponibilidad y colaboración
   ↓
PASO 5 — Orientación académica OPCIONAL
   ↓
AFINIA HABILITADO
```

## 20.2. Obligatorio

Debe completar:

- confirmación visual de datos institucionales;
- preferencias mínimas;
- al menos un interés o área de mejora;
- configuración básica de privacidad;
- decisión de disponibilidad.

`bio` puede ser opcional.

## 20.3. Cuestionario

Es opcional.

Puede:

- saltarse;
- guardar avance;
- continuar;
- repetirse.

No es examen.

No calcula competencia.

Puede adaptar siguientes preguntas en función de respuestas anteriores.

Resultado:

```text
suggested_interests
suggested_improvement_areas
```

El estudiante confirma antes de convertir sugerencias en preferencias efectivas.

---

# 21. DATOS DECLARADOS

Se consideran declarativos:

- intereses por área;
- intereses por tecnología;
- áreas de mejora;
- disponibilidad;
- preferencias de colaboración;
- respuestas de orientación;
- bio.

Sirven para:

- recomendaciones;
- personalización;
- colaboración.

NO aportan puntos de afinidad V3.

---

# 22. ELIMINACIÓN DE “HABILIDAD AUTODECLARADA” COMO COMPETENCIA

Regla V2:

> El Estudiante ya no declara un nivel de habilidad BASIC / INTERMEDIATE / ADVANCED como señal de competencia.

Puede declarar:

```text
“Me interesa React”
“Quiero mejorar PostgreSQL”
```

No:

```text
“Soy avanzado en React”
```

como fuente del motor.

Si existe información histórica en `student_skills`:

- no borrarla silenciosamente;
- migrarla a preferencia/interés cuando sea posible;
- marcar procedencia histórica;
- dejar de usarla para afinidad.

El catálogo `skills` sigue existiendo como taxonomía controlada.

---

# 23. TAXONOMÍA: ÁREAS, HABILIDADES Y TAGS

## 23.1. AcademicArea

Representa área amplia:

```text
Desarrollo Web
Bases de Datos
Ciberseguridad
Desarrollo Móvil
Inteligencia Artificial
Redes
Gestión de Proyectos
```

Campos objetivo:

```text
id
code
name
description nullable
tags[]
status
created_at
updated_at
```

Reglas:

- `code` obligatorio y único;
- `name` obligatorio y único normalizado;
- al menos una tag/keyword;
- descripción opcional;
- trim;
- no solo símbolos;
- no nombre puramente numérico;
- baja lógica.

## 23.2. Skill

Representa tecnología o capacidad específica:

```text
React
React Native
PostgreSQL
Python
Docker
NestJS
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

Reglas:

- área obligatoria;
- code único;
- nombre único normalizado;
- no `Sin área`;
- baja lógica.

## 23.3. Validación semántica de clasificación

No es suficiente exigir un `area_id`.

Implementar:

1. reglas deterministas para aliases/clasificaciones conocidas;
2. warning de posible incoherencia;
3. asistencia IA opcional;
4. confirmación explícita con motivo para override cuando no exista regla dura.

Ejemplo:

```text
React Native
→ Mobile
```

Si una regla canónica existente lo clasifica como Mobile:

```text
intentar guardar en Web
→ bloquear
```

Para una tecnología desconocida:

```text
→ sugerir área
→ Admin confirma
```

La IA nunca crea automáticamente una clasificación definitiva sin confirmación.

## 23.4. Nombres técnicos

Las validaciones NO deben romper nombres reales:

```text
C++
C#
.NET
Node.js
CI/CD
```

Permitir caracteres técnicos controlados.

---

# 24. CATEGORÍAS DE ACTIVIDAD

Campos:

```text
id
code
name
description nullable
applies_to
status
```

`applies_to`:

```text
ACADEMIC
EXTRACURRICULAR
BOTH
```

Obligatorios:

- code;
- name;
- applies_to.

Descripción opcional.

Validación de duplicados y normalización.

---

# 25. RECURSOS EXTERNOS

Separar conceptualmente de actividades institucionales.

Ejemplos:

- Cisco;
- IBM;
- Microsoft Learn;
- Coursera;
- recursos con convenio.

Entidad `Resource`:

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

No rastrear Internet arbitrariamente para recomendar URLs.

Usar catálogo controlado.

---

# 26. ACTIVIDADES

Actores gestores:

- Docente: académicas dentro de TeacherScope;
- Director: académicas de carrera;
- Sociedad: extracurriculares.

Datos:

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
semester_scope[]
status
review_status
```

---

# 27. CICLO DE VIDA Y APROBACIÓN DE ACTIVIDADES

No mezclar aprobación institucional con ciclo temporal.

## 27.1. Lifecycle status

```text
DRAFT
PUBLISHED
OPEN
CLOSED
FINISHED
CANCELLED
```

## 27.2. Review status

```text
NOT_REQUIRED
PENDING
OBSERVED
APPROVED
REJECTED
```

## 27.3. Docente

```text
DRAFT
→ SUBMIT
→ review_status=PENDING
→ Director:
    APPROVED
    OBSERVED
    REJECTED
```

`OBSERVED`:

- permite edición;
- conserva observación;
- permite reenvío.

`REJECTED`:

- no se publica;
- conserva auditoría;
- no se reutiliza silenciosamente como aprobada.

## 27.4. Sociedad

Mismo flujo.

Solo actividades extracurriculares.

## 27.5. Director

Sus propias actividades:

```text
review_status=NOT_REQUIRED
```

Puede publicar sin una segunda autoridad ficticia.

## 27.6. Publicación

Una actividad únicamente puede pasar a `PUBLISHED/OPEN` cuando:

```text
review_status in {NOT_REQUIRED, APPROVED}
```

---

# 28. TEACHER SCOPE

Fuente única:

```text
TeacherScopeService
```

Un Docente solo puede:

- seleccionar semestres habilitados;
- ver estudiantes de dichos semestres;
- crear actividad para dichos semestres;
- ver reportes permitidos del scope;
- consultar proyectos/perfiles autorizados del scope.

Ejemplo:

```text
Docente habilitado: semestre 1 y 5

Puede crear:
[1]
[5]
[1,5]

No puede seleccionar:
[2,3,4,6,...]
```

No duplicar esta lógica en múltiples servicios.

---

# 29. PARTICIPACIÓN

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

representa experiencia.

El estudiante:

- marca interés;
- se registra;
- cancela según reglas.

El responsable:

- confirma;
- marca ausencia.

Confirmación debe ser transaccional y disparar:

```text
trayectoria
→ afinidad
→ recomendaciones
→ gamificación
→ auditoría
```

---

# 30. CONSTANCIAS INTERNAS

No son certificados oficiales.

Requieren participación `CONFIRMED`.

La actividad define:

```text
internal_constancy_enabled
```

Para actividad de Docente/Sociedad, esta opción debe quedar incluida en la aprobación de Dirección.

Quién puede emitir:

- Director;
- responsable autorizado de actividad cuando la política aprobada lo permite.

Persistir:

```text
activity_registration_id
student_profile_id
activity_id
issued_by
authorized_by nullable
created_at
```

No duplicar afinidad.

La constancia aumenta respaldo/trazabilidad del mismo evento.

---

# 31. GAMIFICACIÓN

Independiente de afinidad.

Nunca:

```text
puntos → afinidad
```

## 31.1. Catálogo global

Admin mantiene plantillas/criterios permitidos.

## 31.2. Regla por actividad

Docente, Director o Sociedad pueden asociar/configurar reglas permitidas para una actividad.

Para Docente/Sociedad, Dirección revisa dichas reglas junto con la actividad.

Campos:

```text
criterion_id
activity_id
trigger_type
points
badge_id nullable
description
```

No permitir scripts o expresiones arbitrarias.

Triggers controlados, por ejemplo:

```text
PARTICIPATION_CONFIRMED
PROJECT_SUPPORTED
PROJECT_CORROBORATED
TEAM_COLLABORATION_CONFIRMED
TRAJECTORY_MILESTONE
```

Puntos:

- positivos;
- rango configurable;
- idempotentes.

No puntos por:

- mensajes;
- intereses;
- archivos repetidos;
- proyectos vacíos;
- autodeclaraciones.

## 31.3. Insignias

Son reconocimiento interno de Afinia.

No son certificados.

No tienen valor académico oficial.

---

# 32. PROYECTOS

El Estudiante puede crear proyecto sin aprobación previa.

Campos:

```text
title
description
primary_academic_area_id
status
visibility
repository_url nullable
demo_url nullable
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

Proyecto vacío:

```text
backing_tier=DECLARED
afinidad=0
support=0
```

---

# 33. INTEGRANTES

Flujo:

```text
creador invita
→ estudiante acepta/rechaza
→ aceptación crea membresía
```

Campos:

```text
project_id
student_profile_id
role
contribution
status
accepted_at
```

No atribuir experiencia unilateralmente.

El integrante confirma su:

- rol;
- contribución;
- skills utilizadas.

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

Afinidad individual utiliza principalmente:

```text
skills_used
```

del integrante.

No asumir que todos los integrantes utilizaron todas las tecnologías.

---

# 35. EVIDENCIAS DE PROYECTO

Cada evidencia:

```text
project_id
student_profile_id
evidence_type
description
file_or_link
created_at
```

El propietario de la señal es:

```text
student_profile_id
```

Nunca recalcular automáticamente al creador si la evidencia corresponde a otro miembro.

---

# 36. BACKING TIER DE PROYECTO

```text
DECLARED
SUPPORTED
CORROBORATED
REVIEWED
FLAGGED
```

## DECLARED

Solo declaración.

## SUPPORTED

Al menos una señal adicional:

- miembro aceptado;
- evidencia;
- repo accesible;
- demo accesible.

## CORROBORATED

Al menos dos señales independientes y una comprobación técnica relevante.

## REVIEWED

Proyecto al menos `SUPPORTED` + feedback docente.

No significa aprobado académicamente.

## FLAGGED

Inconsistencia significativa.

No eliminar proyecto.

No aportar afinidad mientras esté `FLAGGED`.

---

# 37. GITHUB

GitHub es opcional.

Un proyecto sin GitHub puede alcanzar respaldo mediante otras señales.

Si repo público válido:

obtener de forma limitada:

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

Puede revisar manifiestos permitidos:

```text
package.json
requirements.txt
pyproject.toml
pom.xml
Dockerfile
docker-compose.yml
```

No clonar repositorios completos indiscriminadamente.

No inferir dominio profesional.

---

# 38. URL DESPLEGADA

Para `demo_url` comprobar:

- disponibilidad;
- HTTPS;
- redirects seguros;
- título;
- metadata pública.

No inferir backend o base de datos no observable.

---

# 39. STORAGE Y ARCHIVOS

Storage privado.

Nunca servir la carpeta de uploads como directorio público.

Flujo:

```text
JWT
→ rol
→ ownership/scope/visibilidad
→ stream/url firmada
```

Metadatos:

```text
original_filename
storage_key
mime_type_detected
size_bytes
sha256
uploaded_by
created_at
```

Formatos iniciales:

```text
PDF
JPG
JPEG
PNG
```

Máximo configurable.

Hash SHA-256 obligatorio para deduplicación.

---

# 40. OCR Y EXTRACCIÓN

Pipeline:

```text
1. PDF texto nativo
2. si insuficiente → OCR
3. QR si es viable
4. normalización
5. extracción metadata
```

Estados:

```text
PENDING
PROCESSING
COMPLETED
INCONCLUSIVE
FAILED
```

Fallo de OCR:

- no destruye archivo;
- no bloquea el sistema;
- deja estado inconcluso.

---

# 41. CERTIFICADOS EXTERNOS

Campos:

```text
issuer
certificate_name
issue_date
credential_id nullable
verification_url nullable
academic_area_id
skills[]
file
```

Backing:

```text
DECLARED
SUPPORTED
CORROBORATED
```

Afinia no afirma autenticidad legal absoluta.

---

# 42. VALIDACIÓN TÉCNICA

Motor de Validación separado de Afinidad.

Responsabilidad:

> determinar qué señales pueden corroborarse técnicamente.

Puede usar:

- SHA-256;
- OCR;
- metadata;
- QR;
- GitHub;
- URL checks;
- comparación de identidad;
- reglas deterministas;
- AI Assistant como apoyo.

No puede:

- emitir nota;
- certificar profesionalmente;
- confirmar automáticamente una habilidad.

---

# 43. AI ASSISTANT

Se incorpora como componente opcional, desacoplado y no autoritativo.

## 43.1. Interfaz

Crear `AiAssistancePort` o equivalente.

Configuración:

```text
AI_PROVIDER=none|openai_compatible
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
AI_TIMEOUT_MS=
AI_MAX_INPUT_CHARS=
```

El sistema base debe funcionar con:

```text
AI_PROVIDER=none
```

## 43.2. Tareas permitidas

```text
TAG_SUGGESTION
EVIDENCE_SUMMARY
INCONSISTENCY_EXPLANATION
CV_TEXT_ASSIST
ANALYTICS_NARRATIVE
CONTENT_MODERATION_FLAG
```

## 43.3. Reglas

Resultado IA siempre lleva:

```text
provider
model
task_type
input_fingerprint
result
created_at
accepted_by nullable
```

Nunca modificar automáticamente:

- affinity score;
- support score;
- backing tier;
- activity approval;
- participation;
- constancy.

Para que una sugerencia afecte metadata:

```text
IA sugiere
→ usuario/actor autorizado confirma
→ regla determinista procesa
```

## 43.4. Privacidad

No enviar:

- contraseñas;
- tokens;
- sesiones;
- archivos privados completos sin política explícita;
- PII innecesaria.

Preferir metadata y texto normalizado mínimo.

---

# 44. MODERACIÓN DE NOMBRES DE EQUIPOS

Primera barrera:

- reglas;
- longitud;
- caracteres;
- lista configurable de términos prohibidos.

IA opcional:

- flag de ambigüedad;
- sugerencia de cambio.

No depender exclusivamente de IA.

Si está flaggeado:

```text
no publicar/compartir hasta corregir
```

---

# 45. MOTOR DE AFINIDAD V3

Versión objetivo:

```text
AFFINITY_ENGINE_VERSION=3
```

Debe ser:

- determinista;
- reproducible;
- versionado;
- explicable;
- independiente de IA generativa.

## 45.1. Cambio fundamental respecto V2

NO aportan afinidad:

- intereses;
- orientación;
- áreas de mejora;
- disponibilidad;
- tecnologías de interés;
- autodeclaraciones históricas.

Estos datos solo alimentan recomendaciones.

Afinidad V3 responde:

> **¿Qué tan relacionada está la trayectoria RESPALDADA del estudiante con esta área?**

---

# 46. FUENTES DE AFINIDAD V3

Participan:

```text
ACTIVITY_CONFIRMED
PROJECT_SUPPORTED_OR_BETTER
EXTERNAL_CERTIFICATE_SUPPORTED_OR_BETTER
```

Retroalimentación/constancia aumentan respaldo.

No deben crear por sí mismas un evento duplicado de afinidad.

---

# 47. PUNTAJE DE AFINIDAD V3

Máximo directo:

```text
100
```

Familias:

```text
Actividades    25
Proyectos      50
Certificados   25
```

## 47.1. Actividades

Solo `CONFIRMED`.

Base:

```text
10
```

Multiplicadores por eventos independientes del área:

```text
1ro → 1.00
2do → 0.70
3ro → 0.50
4to+ → 0.30
```

Cap:

```text
25
```

## 47.2. Proyectos

Por backing:

```text
DECLARED     → 0
SUPPORTED    → 10
CORROBORATED → 18
REVIEWED     → 22
FLAGGED      → 0
```

Multiplicadores:

```text
1ro → 1.00
2do → 0.75
3ro → 0.50
4to+ → 0.25
```

Cap:

```text
50
```

Utilizar únicamente experiencia atribuible al estudiante.

## 47.3. Certificados externos

```text
DECLARED     → 0
SUPPORTED    → 8
CORROBORATED → 15
```

Multiplicadores:

```text
1ro → 1.00
2do → 0.75
3ro → 0.50
4to+ → 0.25
```

Cap:

```text
25
```

## 47.4. Resultado

```text
AFFINITY_SCORE = round(
  min(
    100,
    ACTIVITY_POINTS +
    PROJECT_POINTS +
    CERTIFICATE_POINTS
  )
)
```

No comparar contra el área más fuerte del propio estudiante.

---

# 48. ASIGNACIÓN DE PROYECTO A ÁREA

No sumar un proyecto a todas las áreas por `general_skills`.

Para un integrante:

1. tomar `project_member.skills_used`;
2. mapear cada skill a su `academic_area_id`;
3. considerar proyecto relevante para áreas donde existan skills aceptadas del integrante;
4. si no existen skills por integrante, no generar afinidad fuerte automáticamente.

El `primary_academic_area_id` sirve para clasificación del proyecto, no para atribuir experiencia indiscriminada a todos los miembros.

---

# 49. SUPPORT SCORE V3

Mantener un resultado separado.

```text
SUPPORT_SCORE 0..100
SUPPORT_LEVEL LOW|MEDIUM|HIGH
```

## Actividades — cap 20

Participación confirmada:

```text
+8
```

Constancia del mismo evento:

```text
+4 adicional de respaldo
```

No duplica afinidad.

## Proyectos — cap 45

```text
DECLARED     → 0
SUPPORTED    → 8
CORROBORATED → 15
REVIEWED     → 20
FLAGGED      → 0
```

Aplicar rendimientos decrecientes.

## Certificados — cap 25

```text
DECLARED     → 0
SUPPORTED    → 8
CORROBORATED → 15
```

## Otros respaldos — cap 10

Únicamente señales independientes no contabilizadas.

## Nivel

```text
0–24   LOW
25–59  MEDIUM
60–100 HIGH
```

Para HIGH:

al menos dos familias independientes:

```text
ACTIVITY
PROJECT
EXTERNAL_CERTIFICATE
ACADEMIC_REVIEW
```

Con una sola familia, máximo `MEDIUM`.

---

# 50. EVITAR DOBLE CONTEO

Ejemplos:

```text
Participación + constancia
→ 1 evento de afinidad.
→ constancia aumenta support.
```

```text
Proyecto + 10 screenshots
→ 1 proyecto con mejor respaldo.
```

```text
Repo + metadata del mismo repo
→ una familia de corroboración.
```

```text
Mismo certificado subido 3 veces
→ no multiplica.
```

---

# 51. CONTRIBUCIONES EXPLICABLES

Persistir:

```text
student_profile_id
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

Snapshots históricos obligatorios.

---

# 52. RECÁLCULO

Crear mecanismo central:

```text
TrajectoryRecalculationService
```

o equivalente.

Se dispara cuando cambia una señal relevante:

- participación confirmada;
- proyecto;
- miembro;
- contribución;
- backing;
- evidencia;
- certificado;
- validación;
- feedback;
- constancia.

Debe recalcular al estudiante correcto.

El botón “Recalcular” en UI puede existir como solicitud manual, pero el sistema NO debe depender de que el estudiante lo presione para mantenerse consistente.

---

# 53. MOTOR DE RECOMENDACIONES

Determinista y explicable.

Consume:

- intereses;
- tecnologías de interés;
- áreas de mejora;
- respuestas/sugerencias de onboarding;
- afinidad;
- support;
- actividades abiertas;
- recursos;
- necesidades de equipo;
- disponibilidad;
- privacidad.

No depende de IA.

IA puede redactar explicación adicional, nunca cambiar ranking sin regla versionada.

---

# 54. RANKING DE ACTIVIDADES / RECURSOS

Ponderación inicial V2:

```text
35 % interés explícito
25 % área de mejora
20 % orientación/onboarding confirmado
10 % afinidad/support contextual
10 % disponibilidad/contexto
```

Aplicar primero filtros duros:

- visibilidad;
- fecha;
- cupo;
- semestre;
- estado;
- tipo de actor;
- recurso activo.

Mostrar razón.

Ejemplo:

> Taller de PostgreSQL — recomendado porque marcaste Bases de Datos como área a fortalecer y PostgreSQL como tecnología de interés.

Para oportunidades avanzadas puede elevarse prioridad si:

```text
AFFINITY alta + SUPPORT alto
```

---

# 55. EQUIPOS Y RECOMENDACIÓN DE PERSONAS

No usar popularidad.

No crear ranking público.

Una necesidad define:

```text
purpose
project_id/activity_id nullable
required_skills[]
preferred_areas[]
max_members
availability_requirements
```

Ranking inicial:

```text
50 % cobertura de skills faltantes
20 % afinidad contextual
15 % disponibilidad
15 % respaldo de trayectoria
```

Solo utilizar habilidades/experiencias respaldadas.

No enviar invitación automática.

Explicar:

> “Sugerido porque posee contribuciones respaldadas en React y disponibilidad compatible.”

---

# 56. CONTACTOS

No existe chat interno.

Flujo:

```text
A consulta perfil compartido de B
→ A solicita contacto
→ B acepta/rechaza
→ contacto
```

Un contacto puede registrar:

- alias;
- fecha;
- contexto opcional;
- canal preferido.

No se infiere competencia por número de contactos.

---

# 57. CHAT — DECISIÓN FINAL

El chat interno se ELIMINA del alcance.

Eliminar/deprecar:

- UI de chat;
- endpoints de mensajería;
- creación de nuevas conversaciones;
- RF asociado a mensajes.

Si tablas históricas contienen datos:

- no hard drop sin auditoría;
- conservar/archivar de forma controlada;
- retirar acceso funcional.

No implementar:

- WebSockets;
- mensajería privada;
- chat grupal;
- análisis de mensajes.

La colaboración se cubre mediante:

- contactos;
- equipos;
- invitaciones;
- enlaces externos de contacto autorizados.

---

# 58. PERFIL PÚBLICO Y QR

Slug opaco y rotable.

QR contiene únicamente URL.

Perfil público es opt-in.

Campos potencialmente compartibles:

- nombre;
- bio;
- áreas principales;
- afinidades;
- support level;
- proyectos seleccionados;
- experiencias seleccionadas;
- insignias;
- disponibilidad;
- canales de contacto seleccionados.

Nunca exponer por defecto:

- correo institucional;
- código universitario;
- tokens;
- archivos privados;
- certificados completos;
- IDs internos.

---

# 59. CANALES DE CONTACTO

El Estudiante puede opcionalmente configurar:

```text
Teams
WhatsApp
LinkedIn
correo de contacto permitido
otro enlace permitido
```

No exponer automáticamente correo institucional.

Validar formato y privacidad.

---

# 60. PERFIL DINÁMICO VS TRAYECTORIA

## Perfil dinámico

Resumen personalizable.

Incluye selección de:

- bio;
- afinidades;
- proyectos destacados;
- actividades destacadas;
- insignias;
- contactos/canales;
- áreas de interés.

## Mi trayectoria / Mi progreso

Histórico completo:

- proyectos;
- contribuciones;
- actividades;
- constancias;
- certificados;
- evidencias;
- equipos;
- evolución;
- snapshots;
- afinidad/support.

No confundir ambas vistas.

---

# 61. CV / RESUMEN CURRICULAR

El Estudiante puede generar PDF.

No es historial académico oficial.

Debe usar únicamente datos existentes en Afinia.

## 61.1. Datos

Seleccionables:

- datos básicos;
- bio;
- proyectos;
- contribuciones;
- tecnologías respaldadas;
- actividades;
- certificados externos;
- constancias;
- insignias;
- afinidades/support;
- contacto autorizado.

## 61.2. Plantillas

Implementar inicialmente 2–3 plantillas estáticas, profesionales y mantenibles.

No construir un diseñador libre tipo Canva.

## 61.3. IA

IA puede:

- mejorar redacción;
- proponer resumen;
- reorganizar descripción;
- generar alternativas.

Nunca:

- inventar experiencia;
- inventar cargo;
- inventar certificación;
- modificar datos institucionales.

El usuario debe aprobar texto generado antes de exportar.

## 61.4. Disclaimer

PDF debe indicar:

> Documento generado a partir de información registrada en Afinia. No constituye historial académico oficial, certificación institucional ni acreditación profesional de competencias.

---

# 62. DOCENTE — PANEL FINAL

Debe mostrar únicamente scope permitido.

Agrupar por semestre.

Puede incluir:

- estudiantes activos;
- áreas con afinidad;
- nivel de respaldo;
- actividades;
- participación;
- proyectos visibles;
- evolución agregada;
- necesidades de equipo.

Renombrar “Reporte del curso” si no representa una asignatura oficial.

Preferir:

```text
Resumen de estudiantes
Panel académico
Resumen por semestre
```

No afirmar datos oficiales de asignatura que Afinia no posee.

---

# 63. DIRECCIÓN — ANALÍTICA

Descriptiva, no predictiva.

Puede incluir:

- estudiantes activos;
- participación por semestre;
- afinidad agregada;
- support agregado;
- tendencias de interés;
- tecnologías presentes en proyectos;
- actividades más demandadas;
- recursos más consultados;
- evolución histórica.

No predecir:

- notas;
- abandono;
- éxito profesional;
- rendimiento.

IA opcional puede generar resumen narrativo de tendencias, pero los valores deben provenir de consultas deterministas.

---

# 64. SOCIEDAD — MÉTRICAS

Solo sobre sus actividades.

Puede ver:

- inscritos;
- confirmados;
- ausentes;
- participación histórica;
- áreas/categorías;
- repetición de actividades;
- métricas comparables.

No ver datos privados fuera de necesidad.

IA opcional puede resumir tendencias, sin inventar cifras.

---

# 65. TUTORIAL / CENTRO DE AYUDA

Implementar:

- tutorial de primer uso;
- centro de ayuda accesible;
- pasos por actor cuando corresponda;
- imágenes;
- texto corto;
- soporte para video explicativo configurable.

No bloquear el sistema después del onboarding.

El tutorial puede reabrirse.

Variable o configuración para video:

```text
HELP_VIDEO_URL
```

---

# 66. UX/UI OBLIGATORIA

La interfaz actual no debe sentirse como panel administrativo genérico para todos.

## 66.1. Estudiante

Priorizar:

- tarjetas;
- progreso;
- jerarquía visual;
- iconografía;
- gráficos explicables;
- llamados a acción;
- textos breves;
- lenguaje natural.

Evitar terminología interna como:

```text
backing_tier
support_score
validation_record
```

Mostrar:

```text
Con respaldo
Respaldo alto
No se pudo comprobar
```

## 66.2. Modales / overlays

Eliminar parpadeos intermitentes.

Revisar:

- montaje/desmontaje duplicado;
- portales;
- animaciones;
- loading states;
- key inestables;
- re-render;
- backdrop;
- focus trap.

Criterio:

> abrir/cerrar modal, drawer, popover o diálogo no produce flicker visible ni superposición incorrecta.

## 66.3. Animación

Sutil.

Objetivo orientativo:

```text
150–250 ms
```

Respetar `prefers-reduced-motion`.

No animaciones decorativas que ralenticen tareas.

## 66.4. Validación

Errores específicos por campo.

No mostrar únicamente:

> “Datos inválidos”.

Ejemplos:

- “El correo debe pertenecer a un dominio institucional permitido.”
- “El semestre es obligatorio.”
- “Ya existe un área con este código.”

---

# 67. MOBILE

Revisar versión real de Expo/RN.

No asumir “SDK 58” únicamente porque aparezca en una nota.

El agente debe:

1. identificar SDK actual;
2. identificar última versión estable compatible al momento de implementación;
3. revisar dependencias;
4. preparar migración controlada;
5. ejecutar `expo doctor`;
6. validar Android Emulator y dispositivo físico cuando sea posible.

No actualizar por moda si rompe dependencias.

Mobile es Estudiante-only.

---

# 68. SEGURIDAD DE URL CHECKS

SSRF obligatorio:

- bloquear localhost;
- bloquear rangos privados;
- bloquear metadata cloud;
- resolver DNS de forma segura;
- limitar redirects;
- timeout;
- limitar response size;
- solo HTTP/HTTPS.

---

# 69. AUDITORÍA

Registrar eventos críticos.

Ejemplos:

```text
USER_PROVISIONED
IMPORT_APPLIED
ACCOUNT_ACTIVATED
ACCOUNT_SUSPENDED
PASSWORD_CHANGED
SESSION_REVOKED

ACTIVITY_SUBMITTED
ACTIVITY_APPROVED
ACTIVITY_OBSERVED
ACTIVITY_REJECTED
PARTICIPATION_CONFIRMED
CONSTANCY_ISSUED

PROJECT_CREATED
MEMBER_INVITED
MEMBER_ACCEPTED
CONTRIBUTION_CONFIRMED
EVIDENCE_ADDED
REPOSITORY_CHECKED
FEEDBACK_ADDED

AFFINITY_RECALCULATED
PUBLIC_PROFILE_CHANGED
CONTACT_ACCEPTED
TEAM_INVITATION_ACCEPTED

AI_SUGGESTION_CREATED
AI_SUGGESTION_ACCEPTED
```

No registrar:

- password;
- token completo;
- secret;
- binario;
- contenido privado innecesario.

---

# 70. BASE DE DATOS

Conservar esquema existente cuando sea válido.

Migraciones incrementales.

```text
synchronize=false
```

No reescribir migraciones históricas aplicadas.

---

# 71. ESTRUCTURAS A REVISAR / ADAPTAR

Mantener o adaptar las existentes:

```text
users
roles
teacher_semester_access

student_profiles
academic_areas
skills
student_interests
student_free_interests
student_skills   # migrar/retirar uso como competencia

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
gamification_criteria
```

---

# 72. ESTRUCTURAS V2 PROBABLES

Los nombres pueden adaptarse.

```text
account_tokens
auth_sessions

import_batches
import_batch_rows

onboarding_runs
onboarding_answers

student_skill_interests
activity_skills
activity_reviews
activity_gamification_rules

project_member_skills
project_repository_checks
project_link_checks

validation_records

public_profile_config
contact_requests
contacts

team_needs
teams
team_members
team_invitations

gamification_events
badges
student_badges

ai_assistance_runs
trajectory_exports
audit_events
```

No crear todas por costumbre.

Primero comprobar si alguna entidad actual ya satisface la necesidad.

---

# 73. INTEGRIDAD

Constraints mínimos:

- email único;
- university_code único;
- perfil único por usuario;
- area code único;
- area name normalizado único;
- skill code único;
- skill name normalizado único;
- skill requiere area;
- category code único;
- inscripción estudiante/actividad única;
- miembro estudiante/proyecto único;
- invitación pendiente equivalente no duplicada;
- slug público único;
- token hash único;
- session token hash único;
- activity skill sin duplicado;
- member skill sin duplicado;
- gamification event idempotente;
- affinity result consistente por perfil/área/version.

---

# 74. TRANSACCIONES

Usar transacción para:

- aplicar importación;
- aceptar miembro;
- confirmar participación;
- emitir constancia;
- crear evidencia + metadata;
- recalcular afinidad;
- otorgar gamificación;
- aprobar actividad si cambia múltiples entidades;
- aceptar equipo/invitación cuando corresponda.

---

# 75. RF DEFINITIVOS — 25

## RF01 — Provisionar e importar cuentas institucionales

Admin crea individualmente o importa padrón con previsualización, idempotencia y auditoría.

## RF02 — Activar cuenta institucional

Usuario provisionado activa mediante enlace/código de un solo uso y define contraseña.

## RF03 — Gestionar acceso, sesión y recuperación

Login, logout, refresh, recuperación y revocación.

## RF04 — Gestionar usuarios, roles fijos, estados y TeacherScope

Admin administra estado, rol permitido, semestre institucional y scope docente.

## RF05 — Gestionar catálogos y configuración funcional

Áreas, skills, categorías, recursos, criterios globales de gamificación y configuración autorizada.

## RF06 — Gestionar onboarding y preferencias

Perfil base, intereses, áreas de mejora, disponibilidad, privacidad y orientación opcional.

## RF07 — Visualizar perfil dinámico y evolución

Resumen, trayectoria, afinidad, respaldo y evolución.

## RF08 — Gestionar actividades y aprobación

Docente, Director y Sociedad según alcance; incluye revisión de Dirección cuando corresponda.

## RF09 — Consultar actividades y recursos

Estudiante filtra y consulta oportunidades disponibles.

## RF10 — Gestionar interés, inscripción y participación

INTERESTED/REGISTERED por Estudiante; CONFIRMED/ABSENT por responsable.

## RF11 — Gestionar evidencias y certificados externos

Archivos/links, extracción, deduplicación, comprobación y respaldo.

## RF12 — Gestionar constancias internas

Sobre participación confirmada y bajo autorización definida.

## RF13 — Gestionar portafolio de proyectos

Alta, edición, estado, visibilidad, repo, demo y clasificación.

## RF14 — Gestionar integrantes, contribuciones y skills por integrante

Invitación, aceptación, rol, contribución y confirmación de skills.

## RF15 — Gestionar respaldo y retroalimentación de proyectos

Evidencias, repo, demo, backing y feedback.

## RF16 — Consultar proyectos autorizados

Ownership, membresía, visibilidad, TeacherScope y recurso.

## RF17 — Calcular y consultar afinidad y respaldo V3

Determinista, explicable, versionado y con snapshots.

## RF18 — Generar y consultar recomendaciones

Actividades, recursos, fortalecimiento, colaboración y oportunidades.

## RF19 — Gestionar perfil compartible y QR

Slug, visibilidad, selección y QR.

## RF20 — Gestionar contactos y red de colaboración

Solicitud, aceptación, rechazo y canales permitidos.

## RF21 — Gestionar equipos y sugerencias complementarias

Necesidades, skills, sugerencias, invitaciones y membresía.

## RF22 — Gestionar progreso y gamificación

Eventos, puntos, badges e historial.

## RF23 — Generar trayectoria y CV

Vista completa, selección, plantillas, asistencia IA opcional y PDF.

## RF24 — Consultar panel académico docente

Solo TeacherScope.

## RF25 — Consultar analítica descriptiva institucional

Director a nivel agregado; Sociedad en sus actividades.

---

# 76. RNF DEFINITIVOS — 10

## RNF01 — Usabilidad y accesibilidad

- interfaz clara;
- sin parpadeo de overlays;
- validaciones por campo;
- responsive;
- navegación coherente;
- tareas principales >=80 % completadas sin ayuda directa en prueba de usabilidad;
- soporte básico de teclado/foco/contraste.

## RNF02 — Multiplataforma

Estudiante web + mobile; institucionales web; misma API.

## RNF03 — Seguridad

Hash, JWT, refresh, revocación, RBAC, resource policies, rate limit, CORS, headers, archivos privados, validación, SSRF protection.

## RNF04 — Privacidad

Mínimo acceso, perfil opt-in, scope docente, analytics agregada, PII protegida.

## RNF05 — Rendimiento

En entorno controlado:

```text
95 % CRUD sin archivos <= 3 s
reportes habituales <= 5 s
```

Tareas lentas async.

## RNF06 — Integridad y trazabilidad

FKs, unique constraints, transacciones, timestamps, actor, audit trail, idempotencia.

## RNF07 — Mantenibilidad

Monolito modular, contratos compartidos, migraciones, servicios cohesivos, sin duplicación innecesaria.

## RNF08 — Explicabilidad

Afinidad, respaldo, recomendación y asistencia IA muestran razón/procedencia.

## RNF09 — Resiliencia de integraciones

Fallo de SMTP/GitHub/OCR/URL/IA no destruye información ni derriba funciones centrales.

## RNF10 — Portabilidad y configuración

Entornos reproducibles, Docker consistente, `.env.example` real, sin hardcodes.

---

# 77. PANTALLAS / UX POR ACTOR

## Estudiante

Mínimo:

```text
Inicio
Mi perfil
Onboarding/Preferencias
Actividades
Proyectos
Evidencias y certificados
Afinidad
Recomendaciones
Colaboración
Equipos
Mi progreso
Gamificación
CV / Exportar
Privacidad
Ayuda
```

“Orientación académica” no debe quedar como isla confusa si forma parte del onboarding.

## Admin

Mínimo:

```text
Usuarios
Importar padrón
Áreas académicas
Catálogo de habilidades
Categorías de actividad
Recursos
Criterios globales de gamificación
TeacherScope
Auditoría/configuración permitida
```

Eliminar pantalla genérica de “Roles”.

## Docente

```text
Inicio
Mis actividades
Actividades disponibles
Estudiantes
Perfiles
Proyectos
Panel académico
Necesidades de equipo
```

## Director

```text
Inicio
Actividades
Aprobaciones
Constancias
Mapa de afinidad
Tendencias
Recursos
Analítica
```

## Sociedad

```text
Inicio
Mis actividades extracurriculares
Crear actividad
Participantes
Métricas históricas
```

---

# 78. NO ALCANCE FINAL

Afinia NO:

- reemplaza SIU;
- reemplaza Teams;
- gestiona notas;
- administra asignaturas oficiales;
- predice abandono;
- predice rendimiento;
- diagnostica estudiantes;
- emite certificados oficiales;
- certifica profesionalmente skills;
- garantiza autenticidad jurídica;
- aloja repositorios;
- usa chat interno;
- usa cantidad de mensajes como señal;
- mantiene ranking público obligatorio;
- convierte puntos en nota;
- usa IA como núcleo de afinidad;
- requiere ML;
- requiere SSO Microsoft;
- permite al Admin conocer contraseñas;
- permite al estudiante cambiar semestre;
- expone archivos por URL sin autorización.

---

# 79. PRUEBAS OBLIGATORIAS

No basta HTTP 200.

## 79.1. Unitarias

Cubrir:

- password policy;
- cooldown;
- clasificación;
- activity review rules;
- activity lifecycle;
- participation;
- backing tiers;
- affinity V3;
- support;
- recommendation weights;
- gamification idempotency;
- visibility;
- team suggestion scoring.

## 79.2. Integración

Flujos reales con PostgreSQL aislado:

- import → activación → login;
- password reset;
- TeacherScope;
- activity submit → review → publish;
- registration → confirm;
- evidence → storage → authorization;
- project → member → contribution;
- GitHub check;
- affinity recalculation;
- gamification;
- public profile/QR;
- contact;
- team invitation;
- export PDF.

## 79.3. Transición

Probar:

- cuenta;
- actividad lifecycle;
- activity review;
- participación;
- proyecto;
- invitaciones;
- equipos cuando tengan estado.

## 79.4. E2E Web

Playwright.

Actores:

- Estudiante;
- Admin;
- Docente;
- Director;
- Sociedad.

## 79.5. E2E Mobile

Android Emulator + Expo Development Build + Maestro o equivalente aprobado.

## 79.6. Seguridad

- autorización negativa;
- ZAP;
- dependencias;
- headers;
- CORS;
- SSRF;
- archivos;
- sesión;
- rate limit;
- enumeración.

## 79.7. Rendimiento

k6:

- login;
- listados;
- perfiles;
- recomendaciones;
- reportes;
- endpoints críticos.

## 79.8. Compatibilidad

Web:

- Chrome;
- Edge;
- Firefox.

Mobile:

- Android soportado por Expo objetivo.

## 79.9. Calidad interna

SonarQube:

- bugs;
- vulnerabilities;
- smells;
- duplicación;
- coverage útil.

No perseguir 100 % de coverage como vanity metric.

## 79.10. Usabilidad

Tareas representativas + SUS.

Registrar:

- tarea;
- éxito;
- ayuda requerida;
- errores;
- observaciones;
- SUS.

---

# 80. MATRIZ DE TRAZABILIDAD

Crear y mantener:

```text
RF/RNF
→ Caso de uso
→ módulo
→ endpoint
→ pantalla
→ prueba
→ resultado
→ evidencia
```

La documentación final no debe describir una funcionalidad que no exista.

---

# 81. MIGRACIÓN DE AFINIDAD V2 → V3

No sobrescribir historia.

Conservar snapshots V2 con:

```text
engine_version=2
```

Generar nuevos resultados:

```text
engine_version=3
```

No comparar V2 y V3 como si fueran la misma escala sin indicar versión.

Actualizar:

- API;
- web;
- mobile;
- pruebas;
- textos;
- reportes;
- documento académico.

Las pruebas V2 existentes se conservan como histórico/regresión del algoritmo antiguo cuando aporten valor, pero la suite final debe añadir V3.

---

# 82. MIGRACIÓN DE HABILIDADES AUTODECLARADAS

Auditar tabla/datos.

Clasificar registros históricos.

Si representan preferencia:

```text
migrar a student_skill_interests
```

Si no puede determinarse:

```text
conservar histórico
no usar en Afinidad V3
```

Eliminar UI de nivel autodeclarado.

Actualizar recomendaciones para utilizar intereses específicos.

---

# 83. RETIRO DE CHAT

Auditar:

- rutas;
- entidades;
- servicios;
- pantallas;
- datos existentes.

Si no hay datos reales útiles:

- retirar controladamente mediante migración.

Si hay datos:

- conservar histórico;
- deshabilitar creación;
- retirar UI;
- no exponer en trayectoria.

Actualizar RF y documentación.

---

# 84. AI ASSISTANT — CRITERIOS DE ACEPTACIÓN

Debe existir fallback.

Con `AI_PROVIDER=none`:

- sistema inicia;
- afinidad funciona;
- recomendaciones funcionan;
- evidencia se procesa por reglas disponibles;
- CV se genera con plantilla determinista.

Con proveedor:

- puede sugerir tags;
- puede resumir;
- puede mejorar CV;
- puede generar narrativa analítica.

Ningún test de afinidad debe depender de una respuesta probabilística del modelo.

Usar mocks solo en tests de contrato del adaptador, no como funcionalidad productiva.

---

# 85. CRITERIOS CLAVE DE ACEPTACIÓN

## Cuenta

Correo externo no provisionado no crea cuenta.

Admin no ve contraseña/token.

## Activación

Enlace/código válido funciona.

Usado/expirado/revocado falla.

Cooldown funciona.

## Perfil

Estudiante no cambia semestre.

## Declaraciones

Interés no aumenta Afinidad V3.

## Actividad

Docente no publica sin aprobación.

Director puede observar y devolver.

Solo CONFIRMED produce experiencia.

## Constancia

No existe sin participación confirmada.

No duplica afinidad.

## Proyecto

Proyecto vacío no aumenta afinidad.

Miembro no recibe skills sin aceptar.

## GitHub

Detectar React corrobora uso técnico, no certifica dominio.

## Evidencia

Duplicado SHA-256 no multiplica.

## Afinidad

Solo trayectoria respaldada puntúa.

Nunca >100.

## IA

Sugerencia no modifica score automáticamente.

## TeacherScope

Docente nunca obtiene estudiante de semestre no autorizado.

## Archivo

Conocer URL no basta para descargar.

## QR

No expone email/código por defecto.

## Chat

No existe funcionalidad de mensajería interna final.

## CV

No inventa experiencias.

---

# 86. BATCHES DE IMPLEMENTACIÓN V2

## BATCH 0 — Baseline

- rama nueva;
- git clean;
- build;
- tests existentes;
- migraciones;
- inventario;
- `AUDITORIA_GAP_AFINIA_V2.md`.

## BATCH 1 — Configuración y reproducibilidad

- Docker `--env-file`;
- db wait/rebuild;
- `.env.example`;
- README;
- puertos;
- validación de entorno.

## BATCH 2 — Identidad, activación y correo

- manual student semester;
- activación link+code;
- reset;
- sessions;
- rate limits;
- SMTP real adapter;
- password meter;
- pruebas.

## BATCH 3 — Onboarding y preferencias

- wizard;
- intereses;
- skill interests;
- improvement areas;
- questionnaire opcional;
- privacidad;
- retiro self-skill level.

## BATCH 4 — Catálogos

- áreas;
- codes;
- tags;
- skills con área obligatoria;
- categorías;
- validaciones;
- eliminar roles UI;
- semantic warnings.

## BATCH 5 — Actividades y aprobación

- lifecycle;
- review status;
- Director approval;
- TeacherScope;
- Society restrictions;
- participation;
- constancy policy;
- activity gamification rules.

## BATCH 6 — Evidencia y validación

- private storage;
- SHA;
- PDF/OCR;
- link checker;
- SSRF;
- validation records;
- worker.

## BATCH 7 — Proyectos

- members;
- contributions;
- member skills;
- backing tiers;
- GitHub;
- demo;
- feedback;
- owner-correct recalculation.

## BATCH 8 — AI Assistant

- port/adapter;
- tag suggestions;
- evidence summary;
- moderation;
- privacy;
- failure fallback.

No integrar IA con score.

## BATCH 9 — Afinidad V3

- migration version;
- formula;
- support;
- contributions;
- snapshots;
- recomputation;
- tests.

## BATCH 10 — Recomendaciones

- interests;
- improvement;
- orientation;
- affinity context;
- activities;
- resources;
- reasons.

## BATCH 11 — Colaboración

- public profile;
- QR;
- contacts;
- teams;
- suggestions;
- invitations;
- moderation;
- retirar chat.

## BATCH 12 — Gamificación y trayectoria/CV

- events;
- points;
- badges;
- My Progress;
- PDF templates;
- AI text optional.

## BATCH 13 — Reportes y analítica

- TeacherScope;
- docente;
- director;
- sociedad;
- privacy threshold;
- narrative AI optional.

## BATCH 14 — UX Web

- student-focused redesign;
- modal flicker;
- validation;
- onboarding;
- help/tutorial;
- responsive;
- reduced motion.

## BATCH 15 — Mobile

- Expo audit;
- controlled upgrade;
- student flow parity;
- mobile UX;
- emulator/device testing.

## BATCH 16 — Hardening y QA

- security;
- permissions;
- ZAP;
- k6;
- Sonar;
- Playwright;
- Maestro;
- compatibility;
- usability.

## BATCH 17 — Cleanup y documentación

- dead code;
- obsolete routes;
- old V2 texts;
- chat artifacts;
- stale README;
- Swagger;
- diagrams;
- Chapter II alignment;
- Chapter III evidence.

---

# 87. REPORTE OBLIGATORIO POR BATCH

```text
BATCH:
Estado:

Objetivo:
- ...

Cambios:
- ...

Migraciones:
- ...

Archivos:
- ...

Pruebas:
- ...

Resultados:
- ...

Regresiones:
- ...

Pendientes:
- ...

Riesgos:
- ...
```

No reportar “completo” con tests relevantes fallando.

---

# 88. DEFINICIÓN DE TERMINADO

Afinia V2 se considera terminada cuando:

1. RF01–RF25 funcionan.
2. RNF01–RNF10 tienen evidencia.
3. no existe registro público.
4. manual student requiere semester.
5. activación/recovery llegan al correo institucional configurado.
6. contraseña y barra usan la misma política.
7. onboarding guiado funciona.
8. cuestionario es opcional.
9. habilidades autodeclaradas no alimentan afinidad.
10. catálogos tienen integridad.
11. Teacher/Society activities requieren Dirección.
12. Director approval tiene auditoría.
13. constancias requieren participación confirmada.
14. gamificación no afecta afinidad.
15. archivos son privados.
16. GitHub/OCR/URL son resilientes.
17. IA es opcional y no autoritativa.
18. proyectos atribuyen experiencia al integrante correcto.
19. Afinidad V3 es explicable.
20. support es visible.
21. recomendaciones explican motivos.
22. QR no filtra datos sensibles.
23. contactos/equipos funcionan.
24. chat interno está retirado.
25. CV no inventa información.
26. analítica es descriptiva.
27. web no presenta flicker en overlays.
28. estudiante no recibe experiencia visual de “panel admin”.
29. mobile está validado.
30. Docker/README/env son reproducibles.
31. pruebas completas pasan.
32. documento de grado, diagramas y software describen el mismo sistema.

---

# 89. REGLA FINAL DE DISEÑO

Cada módulo debe responder:

```text
¿Ayuda a construir,
respaldar,
interpretar
o aprovechar
la trayectoria académica complementaria del estudiante?
```

Si la respuesta es no:

- no pertenece al núcleo;
- debe justificarse como soporte técnico;
- o debe retirarse.

---

# 90. CADENA FINAL DE AFINIA

```text
IDENTIDAD INSTITUCIONAL AUTORIZADA
        ↓
PREFERENCIAS Y ORIENTACIÓN
        ↓
OPORTUNIDADES RECOMENDADAS
        ↓
EXPERIENCIAS REALES
        ↓
EVIDENCIA Y CORROBORACIÓN
        ↓
TRAYECTORIA
        ↓
AFINIDAD V3 + RESPALDO
        ↓
RECOMENDACIONES MÁS PRECISAS
        ↓
COLABORACIÓN Y EQUIPOS
        ↓
EVOLUCIÓN
        ↓
PERFIL / QR / CV
```

---

# 91. FUENTE DE VERDAD FINAL ESPERADA

Al finalizar:

```text
DOCUMENTO FINAL DE GRADO
          ↕
AFINIA_ESPECIFICACION_MAESTRA_FINAL_V2
          ↕
SOFTWARE
          ↕
PRUEBAS
```

deben representar el mismo sistema.

---

# 92. INSTRUCCIÓN FINAL AL AGENTE

No optimices para “tener muchas funciones”.

Optimiza para:

```text
coherencia
trazabilidad
seguridad
integridad
explicabilidad
valor académico
experiencia de usuario
mantenibilidad
reproducibilidad
```

Antes de implementar una función nueva:

```text
1. encuentra su requisito;
2. encuentra su regla;
3. encuentra sus datos;
4. encuentra su actor;
5. encuentra su criterio de aceptación;
6. encuentra su prueba.
```

Si no puedes hacerlo, detente y reporta la ambigüedad.

**FIN — AFINIA ESPECIFICACIÓN MAESTRA FINAL V2**
