# AUDITORÍA TÉCNICA DEL ESTADO ACTUAL — AFINIAC

**Fecha de corte:** 20 de septiembre de 2026  
**Fuente auditada:** `AfiniaC_AUDITORIA.7z`  
**SHA-256 del archivo recibido:** `6b540457daa8c7e040494f30d8bf11b7aef92b9eefe2d5ec1b97d1ed7737f170`  
**Modalidad:** auditoría estática e independiente del código fuente y configuración, sin modificar el proyecto.  
**Objetivo de este documento:** establecer una línea base técnica confiable del sistema existente antes de alinear el documento de proyecto de grado y antes de aplicar las observaciones de QA/corrección.

---

## 1. Resumen ejecutivo

El repositorio auditado constituye una **base funcional real y considerable**, no un prototipo compuesto únicamente por pantallas o datos simulados. El código contiene implementación concreta para los primeros siete objetivos del proyecto y para el bloque funcional identificado internamente como **RF1–RF18**, incluyendo autenticación y roles, perfil estudiantil, actividades, participación, evidencias, constancias, portafolio, motor de afinidad y recomendaciones.

El propio repositorio denomina a este estado **“70%”**. Esa cifra resulta razonable como **porcentaje de alcance planificado implementado —7 de 10 objetivos—**, pero **no debe interpretarse como un puntaje de calidad, cobertura o preparación para producción**. La auditoría encontró una arquitectura coherente y varias decisiones técnicas buenas, pero también desalineaciones reales de autorización, privacidad, integridad, configuración, interfaz móvil y documentación que deben corregirse antes de considerar el sistema completamente alineado con su especificación académica.

La arquitectura que realmente ejecuta es un **monolito modular con API REST central en NestJS**, persistencia PostgreSQL mediante TypeORM, cliente web React/Vite y cliente móvil Expo/React Native. El almacenamiento actual de archivos es local. El directorio `api/src/domain/` contiene clases conceptuales que reflejan actores o diseño de dominio, pero **no participa en el runtime**, por lo que no sería correcto describir actualmente al sistema como una implementación DDD basada en esas clases.

Los hallazgos de mayor impacto son:

1. Los **reportes del docente no respetan el alcance por semestres** que el resto del sistema centraliza mediante `TeacherScopeService`; además, el resumen de proyectos docentes puede contabilizar y devolver información de proyectos sin filtrar por visibilidad ni semestre.
2. Los archivos de evidencia/certificados se sirven como **contenido estático público por URL** (`/api/files/*`), por fuera de los guards JWT y de roles.
3. Existen **dos rutas funcionales para manejar evidencias de proyecto** con comportamiento divergente; la ruta histórica de `ProjectsService` recalcula la afinidad del propietario aunque la evidencia sea de un integrante y no elimina el archivo físico al borrar la evidencia.
4. El paquete recibido incluyó `.env` con valores reales y 27 archivos en `api/uploads/`, aunque `.gitignore` los excluye. Esto no implica por sí mismo una vulnerabilidad del runtime, pero sí un riesgo de distribución del repositorio. Los secretos que sean reales deben rotarse.
5. El móvil presenta una incompatibilidad concreta al renderizar la categoría de actividad del docente: la API devuelve el objeto `category`, mientras `categoryLabel()` espera un `string`.
6. Persisten múltiples rastros del antiguo “30%” y contradicciones de configuración/documentación, incluido el puerto de PostgreSQL de `.env.example` frente a Docker.

La conclusión general es que **AfiniaC sí dispone de una base técnica suficientemente sólida para continuar**, pero la siguiente etapa debe trabajar sobre una línea base explícita y no asumir que la auditoría histórica del repositorio —que afirma que no existen hallazgos de código/seguridad— sigue siendo válida.

---

## 2. Alcance y metodología de esta auditoría

Se inspeccionaron **344 archivos** extraídos del comprimido. El contenido extraído ocupa aproximadamente **5,7 MB** y contiene del orden de **60 mil líneas de texto/configuración**, considerando también documentación, lockfiles y SQL.

Se revisaron especialmente:

- estructura general del monorepo;
- paquetes y dependencias;
- configuración Docker y variables de entorno;
- arranque de NestJS, guards globales y CORS;
- controladores y servicios del backend;
- entidades, migraciones y esquema SQL;
- autenticación y autorización;
- reglas por rol y alcance docente;
- actividades, inscripciones, constancias y evidencias;
- proyectos, miembros, invitaciones y feedback;
- motor de afinidad y recomendaciones;
- almacenamiento de archivos;
- rutas y superficies web;
- navegación y superficies móvil;
- scripts de prueba existentes;
- documentación técnica ya incluida en el repositorio.

### Limitación importante

Esta es una **auditoría estática del snapshot recibido**. El comprimido excluye correctamente `node_modules`, por lo que no se reinstalaron dependencias ni se levantó PostgreSQL para repetir toda la suite funcional. Sí se verificó sintácticamente con `node --check` que los seis scripts `.mjs` de pruebas son válidos.

Los documentos existentes en el repositorio reportan históricamente **577 verificaciones exitosas y 0 fallos**. Ese dato se conserva como **evidencia histórica declarada por el propio repositorio**, pero no se presenta aquí como una ejecución independiente realizada durante esta auditoría.

---

## 3. Inventario técnico del repositorio

### 3.1 Estructura principal

```text
AfiniaC/
├── api/                 API NestJS
├── web/                 Frontend React + Vite
├── mobile/              App Expo + React Native
├── shared/              Enums/tipos compartidos usados principalmente por API
├── docker/              PostgreSQL
├── docs/                Auditorías, matrices y documentación histórica
├── scripts/             Pruebas E2E/API personalizadas
├── schema_afinia.sql    Snapshot del esquema
├── package.json
├── .env.example
└── README.md
```

Distribución aproximada observada:

| Área | Archivos aprox. | Líneas aprox. | Papel |
|---|---:|---:|---|
| `api/` | 159 | 13.4k | Lógica central y acceso a datos |
| `web/` | 49 | 12.5k | Cliente web |
| `mobile/` | 45 | 16.0k | Cliente móvil, incluido lockfile |
| `docs/` | 23 | 6.0k | Evidencia/documentación histórica |
| `scripts/` | 6 | 4.3k | Pruebas personalizadas |
| `shared/` | 15 | 0.35k | Contratos/enums básicos |

### 3.2 Stack detectado

**Backend**
- NestJS 10
- TypeORM 0.3
- PostgreSQL
- Passport + JWT
- bcryptjs
- class-validator / class-transformer
- Swagger

**Web**
- React 18
- Vite 5
- Axios
- React Router
- Framer Motion
- Recharts

**Móvil**
- Expo 54
- React 19.1
- React Native 0.81.5
- Expo SecureStore
- Expo Document Picker

**Infraestructura local**
- PostgreSQL 16-alpine
- Docker Compose
- almacenamiento local en filesystem para evidencias/archivos

### 3.3 Inconsistencias de versión/documentación

- `package.json` raíz exige `node >=20`.
- `.nvmrc` fija Node 24.
- `README.md` todavía indica “Node 18+”.

Para futuras entregas conviene declarar una sola versión soportada y probarla explícitamente.

---

## 4. Arquitectura real de ejecución

La arquitectura runtime observada es:

```text
┌──────────────────────┐       ┌──────────────────────┐
│ Web React / Vite     │       │ Expo / React Native │
└──────────┬───────────┘       └──────────┬───────────┘
           │ HTTP/JSON + JWT              │ HTTP/JSON + JWT
           └──────────────┬───────────────┘
                          ▼
                ┌───────────────────┐
                │ API REST NestJS   │
                │ /api/*            │
                └─────────┬─────────┘
                          │
        Controllers → Services → Repositories TypeORM
                          │
                 ┌────────┴─────────┐
                 ▼                  ▼
        ┌────────────────┐   ┌──────────────────┐
        │ PostgreSQL     │   │ StoragePort      │
        │ 26 tablas app  │   │ Local filesystem│
        └────────────────┘   └──────────────────┘
```

### 4.1 Patrón backend

El backend es un **monolito modular NestJS**. Cada módulo sigue principalmente el patrón:

```text
Controller → Service → Repository/Entity TypeORM → PostgreSQL
```

Además existen abstracciones puntuales bien utilizadas:

- `TeacherScopeService`: fuente central para validar los semestres permitidos a docentes.
- `AFFINITY_RECALCULATION`: puerto para desacoplar módulos que provocan cambios del motor de afinidad.
- `STORAGE_PORT`: puerto que abstrae almacenamiento de archivos.

### 4.2 Módulos cargados por `AppModule`

- Auth
- Users
- Roles
- Profiles
- Activities
- Projects
- Certificates
- Constancies
- Reports
- Catalogs
- Storage
- Evidences
- ProjectFeedback
- Recommendations
- TypeORM y Config global

Los guards `JwtAuthGuard` y `RolesGuard` se registran de forma **global**, una buena decisión porque evita depender de que cada controlador recuerde activar manualmente la protección.

### 4.3 Capa `domain/`: conceptual, no runtime

El proyecto contiene clases como:

- `Usuario`
- `Administrador`
- `Docente`
- `DirectorCarrera`
- etc.

Sin embargo, no se detectaron imports de estas clases desde la aplicación ejecutable. Por ello:

> **Estado real:** son artefactos conceptuales/documentales y no constituyen actualmente la capa de dominio que gobierna la lógica de negocio.

Esto será importante al corregir el capítulo de arquitectura y el diagrama de clases del proyecto de grado.

### 4.4 Paquete `shared/`

El README lo presenta como “tipos, enums y DTOs compartidos”. En la práctica:

- la API sí consume enums del paquete `@perfil/shared`;
- web y móvil mantienen varias constantes/etiquetas duplicadas;
- no existe una verdadera reutilización integral de DTOs entre las tres aplicaciones.

Esta duplicación ya produjo drift concreto en categorías de actividades.

---

## 5. Superficie de la API

El conteo estático de decoradores HTTP detectó **106 rutas de controlador**.

| Módulo | Rutas |
|---|---:|
| Profiles | 17 |
| Projects | 14 |
| Catalogs | 13 |
| Affinity | 11 |
| Activities | 10 |
| Users | 8 |
| Reports | 7 |
| Recommendations | 5 |
| Constancies | 5 |
| Certificates | 4 |
| Auth | 3 |
| Evidences | 3 |
| Project feedback | 3 |
| Health | 1 |
| Roles | 1 |
| Uploads | 1 |
| **Total** | **106** |

El prefijo global es `/api`. Swagger se publica en `/api/docs`.

---

## 6. Autenticación y autorización actuales

### 6.1 Registro y login

El registro público crea al usuario con rol **STUDENT desde servidor**; el cliente no puede autoasignarse un rol privilegiado mediante el DTO de registro. Es una decisión correcta.

El login:

- exige usuario activo;
- verifica contraseña con bcrypt;
- entrega JWT de acceso.

El `JwtStrategy` vuelve a cargar desde base al usuario, su rol y estado en cada petición. Esto hace que una desactivación o un cambio de rol tenga efecto aunque el JWT existente haya sido emitido antes.

### 6.2 JWT

El sistema implementa actualmente **access token**, pero no se encontró flujo real de refresh token aunque `.env.example` incluya:

- `JWT_REFRESH_SECRET`
- `JWT_REFRESH_EXPIRES`

El vencimiento por defecto del access token es largo (30 días). No existe logout server-side, lista de revocación ni rotación de refresh token.

### 6.3 Almacenamiento del token

- **Móvil:** Expo SecureStore.
- **Web:** `localStorage`.

SecureStore es adecuado para el cliente móvil. En web, `localStorage` amplifica el impacto de un eventual XSS porque un script ejecutado en el origen puede leer el token.

### 6.4 CORS y validación

Aspectos positivos:

- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`.
- CORS en producción exige `CORS_ORIGINS` explícitos.
- el secreto JWT de producción se valida para impedir el valor inseguro por defecto.

No se observó:

- rate limiting;
- lockout por intentos fallidos;
- Helmet/headers de seguridad explícitos;
- desactivación de Swagger según ambiente.

---

## 7. Roles y alcance funcional observado

Se detectan cinco roles persistentes:

| Rol | Comportamiento actual principal |
|---|---|
| `STUDENT` | Perfil, intereses, habilidades, actividades, inscripción, proyectos, evidencias, afinidad, recomendaciones, certificados/constancias propias |
| `TEACHER` | Consulta de actividades, perfiles/proyectos autorizados y feedback; reportes docentes existentes |
| `CAREER_DIRECTOR` | Gestión de actividades académicas, constancias, afinidad y reportes institucionales |
| `SCIENTIFIC_SOCIETY` | Gestión de actividades extracurriculares |
| `ADMIN` | Usuarios, roles/accesos y catálogos; soporte transversal en varias operaciones |

### 7.1 Alcance docente

Existe `TeacherScopeService`, que representa correctamente la regla de que un docente solo accede a estudiantes de los semestres asignados. Se utiliza en varios servicios relevantes, como perfiles, proyectos, constancias y afinidad.

**Excepción grave:** `ReportsService` no utiliza esa fuente de verdad. Este punto se detalla en F-01.

---

## 8. Superficie web por rol

### Estudiante

- Dashboard
- Perfil
- Intereses/habilidades
- Proyectos
- Actividades
- Evidencias
- Afinidad
- Recomendaciones

### Docente

- Dashboard
- Actividades
- Estudiantes
- Proyectos de estudiantes
- Reportes

### Director

- Dashboard
- Actividades
- Constancias
- Mapa de afinidad

### Sociedad científica

- Dashboard
- Actividades

### Administrador

- Usuarios
- Roles
- Áreas
- Habilidades
- Categorías de actividad
- Criterios de gamificación

---

## 9. Superficie móvil por rol

### Estudiante

- Inicio
- Perfil
- Intereses
- Habilidades
- Evidencias
- Actividades
- Mis actividades
- Portafolio/proyectos
- Detalle de proyecto
- Afinidad
- Recomendaciones

### Docente

- Actividades
- Resumen de estudiante
- Reporte
- pantalla “Próximamente”

### Director

- Dashboard
- Actividades
- Constancias
- Afinidad
- Participación por semestre

### Sociedad científica

- Actividades
- pantalla “Próximamente”

### Administrador

- Usuarios
- Áreas

La app móvil **no replica toda la administración web**. Roles, habilidades, categorías de actividades y gamificación están disponibles en web pero no en la superficie móvil actual. Esto puede ser totalmente válido si el alcance multiplataforma no exige paridad, pero debe quedar expresado correctamente en el documento de grado.

---

## 10. Base de datos

### 10.1 Tablas

Se detectan **26 tablas de dominio/aplicación**, más la tabla técnica `migrations` de TypeORM en el snapshot SQL.

**Identidad y acceso**
- `users`
- `roles`
- `teacher_semester_access`

**Perfil y catálogos**
- `student_profiles`
- `academic_areas`
- `skills`
- `student_interests`
- `student_free_interests`
- `student_skills`
- `gamification_criteria`

**Actividades y participación**
- `activity_categories`
- `activities`
- `activity_registrations`
- `internal_constancies`

**Portafolio y colaboración**
- `projects`
- `project_members`
- `project_invitations`
- `project_evidences`
- `project_feedback`
- `external_certificates`

**Afinidad**
- `affinity_weights`
- `affinity_results`
- `affinity_contributions`
- `affinity_snapshots`
- `affinity_snapshot_items`

**Recomendaciones**
- `recommendations`

### 10.2 Migraciones

Existen **12 migraciones TypeORM**:

1. `InitialSchema`
2. `RenameRoleValues`
3. `AddImprovementAreas`
4. `AddActivityFields`
5. `RefactorProjects`
6. `RefactorEvidenceTables`
7. `Objective1AccessAndCatalogs`
8. `Objective4EvidenceAndConstancies`
9. `Rf4CategoriesAndRf5FreeInterests`
10. `Objective5Portfolio`
11. `Objective6AffinityEngine`
12. `Objective7Recommendations`

`TypeORM synchronize` está desactivado y las migraciones no se ejecutan automáticamente al arrancar. Es una buena práctica: el esquema depende de migraciones explícitas.

### 10.3 Fortalezas del modelo

Se observaron restricciones e índices relevantes, entre ellas:

- correo único;
- un perfil por usuario;
- código universitario único cuando existe;
- relaciones únicas perfil/área y perfil/habilidad;
- alcance docente por docente/semestre;
- una inscripción por actividad/estudiante;
- una afinidad por perfil/área;
- membresías únicas de proyecto;
- recomendaciones únicas por perfil/tipo/objetivo;
- control de invitaciones pendientes duplicadas;
- control de constancias internas duplicadas por perfil/actividad.

### 10.4 Observación de modelado

`student_profiles.improvement_area_ids` almacena un arreglo de UUID en vez de una tabla relacional con FK. Los servicios validan los IDs al escribirlos, pero PostgreSQL no puede garantizar por sí solo la integridad referencial de cada elemento del arreglo.

No es un fallo inmediato, pero sí una excepción al modelo relacional dominante del proyecto.

---

## 11. Perfil estudiantil dinámico

El perfil contiene, entre otros:

- semestre;
- biografía;
- intereses por áreas;
- intereses libres;
- habilidades con nivel;
- áreas de mejora;
- visibilidad para descubrimiento de pares;
- porcentaje/estado de completitud.

La completitud se calcula con cinco bloques principales: semestre, biografía, al menos un interés de área, al menos una habilidad y al menos un área de mejora. Cada bloque aporta 20 puntos.

Semántica observada de estados:

- `INCOMPLETE`: perfil aún incompleto.
- `ACTIVE`: alcanzó 100% por primera vez.
- `UPDATED`: vuelve a recalcularse completo después de cambios posteriores.

Por tanto, `UPDATED` no debe interpretarse documentalmente como “desactualizado” ni “requiere actualización”. Es un estado que identifica un perfil completo posteriormente modificado/recalculado.

El campo `universityCode` existe en la entidad, pero los DTO de edición ordinaria de perfil no exponen una vía evidente para que el estudiante lo complete. Esto será relevante si el futuro objetivo de contactos/QR depende de ese identificador.

---

## 12. Actividades y participación

El sistema distingue actividades:

- académicas;
- extracurriculares.

Roles de gestión reales:

- actividades académicas: Director de carrera;
- extracurriculares: Sociedad científica;
- Administrador: soporte transversal;
- Docente: lectura, no publicación/gestión ordinaria.

Estados de actividad:

- draft
- published
- open
- closed
- finished
- cancelled

Estados de inscripción:

- interested
- registered
- confirmed
- absent

La capacidad se controla al momento de confirmar participación. Confirmar una participación desencadena recálculo de afinidad.

### Observaciones

- El backend no implementa una máquina de estados completa para actividades. Existen validaciones parciales, pero no una matriz estricta de transiciones permitidas.
- `evidenceRequired` se almacena, pero no se encontró una regla backend que obligue efectivamente al participante confirmado a adjuntar evidencia.
- La creación de evidencia vinculada a actividad exige que exista alguna inscripción, pero no exige específicamente que esté `registered` o `confirmed`; un registro en estado `interested` también satisface la existencia.

---

## 13. Portafolio de proyectos

El portafolio soporta:

- creación/edición de proyectos;
- estado draft/active/archived;
- área académica;
- tecnologías;
- URLs de repositorio/demo;
- visibilidad;
- miembros;
- invitaciones;
- evidencias;
- feedback docente.

Visibilidades observadas:

- privada;
- perfil;
- docentes.

El docente consulta proyectos visibles para docentes y el servicio principal de proyectos sí aplica `TeacherScopeService` para restringir por semestre.

Las invitaciones crean membresía solo cuando se aceptan; existe protección contra invitaciones pendientes duplicadas.

El feedback docente está separado de calificaciones formales, lo cual coincide con un sistema complementario de perfil y no con un SIU académico.

---

## 14. Evidencias, archivos y certificados

El modelo permite evidencias:

- tipo archivo;
- tipo enlace;
- relacionadas a proyecto, actividad y/o área.

El flujo principal `EvidencesService` elimina también el archivo físico cuando se elimina una evidencia de archivo, lo cual es correcto.

Sin embargo, coexiste una ruta histórica dentro de `ProjectsService` con comportamiento diferente. Esta duplicación es una fuente real de inconsistencias y debe unificarse posteriormente.

El upload actual es de dos pasos:

1. `POST /uploads` almacena el archivo y devuelve una URL.
2. otro endpoint crea la evidencia/certificado persistiendo esa URL.

Si el segundo paso no ocurre, el archivo puede quedar huérfano. Tampoco se observó un registro temporal ni una tarea automática de limpieza.

Los DTO aceptan `fileUrl`, `fileName`, `mimeType` y `fileSize` suministrados por el cliente, pero el backend no verifica que el `fileUrl` haya sido emitido realmente por el endpoint de uploads ni que corresponda al usuario que lo está asociando.

---

## 15. Constancias internas

La constancia se ancla a una inscripción de actividad y exige participación confirmada. Existe protección contra duplicados.

El controlador de creación permite actualmente:

- Director de carrera;
- Administrador.

No se observó un endpoint independiente de “aprobar/rechazar” después de crear. Aunque el enum incluya `pending`, `authorized` y `rejected`, el estado se decide en la creación; por ello no debe describirse actualmente como un workflow de aprobación multietapa si el documento dijera algo distinto.

La autorización además depende del rol **actual** del creador original de la actividad para verificar compatibilidad con su tipo. Esto puede fallar si el creador cambia de rol posteriormente o si un administrador intervino en la gestión.

---

## 16. Motor de afinidad

Este es uno de los componentes más desarrollados del sistema.

### 16.1 Señales observadas

El cálculo integra:

- áreas de interés preferidas;
- habilidades;
- áreas de mejora;
- participación en actividades;
- proyectos como propietario o miembro;
- evidencias;
- certificados externos;
- constancias internas.

### 16.2 Ponderaciones por defecto detectadas

| Señal | Peso base |
|---|---:|
| Interés preferido | 2 |
| Área de mejora | 1 |
| Habilidad básica | 1 |
| Habilidad intermedia | 2 |
| Habilidad avanzada | 3 |
| Actividad interesado | 1 |
| Actividad inscrito | 2 |
| Actividad confirmada | 3 |
| Proyecto propietario | 5 |
| Proyecto miembro | 5 |
| Evidencia | 2 |
| Certificado | 4 |
| Constancia | 3 |

Las ponderaciones pueden cargarse desde `affinity_weights`; si faltan pesos activos, el código completa con defaults.

### 16.3 Clasificación

El nivel se calcula de forma relativa al área más fuerte del propio estudiante, combinado con un mínimo absoluto:

- high: proporción >= 0.6 y score >= 6;
- medium: proporción >= 0.3 y score >= 3;
- low: caso restante.

### 16.4 Trazabilidad positiva

El motor conserva:

- resultado actual;
- contribuciones individuales;
- snapshots;
- items del snapshot;
- versión/hash de reglas.

El breakdown permite explicar de dónde sale cada puntaje. Para un proyecto de grado, esta trazabilidad es una fortaleza importante: evita que “afinidad” sea una caja negra.

### 16.5 Decisiones semánticas que la documentación debe describir correctamente

Estas no se clasifican automáticamente como bugs, pero deben ser intencionales:

- declarar un **área de mejora** aumenta afinidad, aunque sea una aspiración y no una capacidad demostrada;
- la prioridad 1–5 de un interés se guarda, pero el motor de afinidad usa un peso fijo de interés; la prioridad sí participa en recomendaciones;
- miembro y propietario de proyecto reciben actualmente el mismo aporte base;
- múltiples evidencias pueden acumular múltiples aportes sin aprobación cualitativa previa;
- mostrar interés o inscribirse ya contribuye antes de una participación confirmada.

Si el documento afirma otra semántica, habrá que decidir si se corrige el software o el documento, no ocultar la diferencia.

---

## 17. Motor de recomendaciones

El endpoint de recomendaciones del estudiante genera/actualiza recomendaciones a partir de:

- afinidades actuales;
- áreas preferidas;
- áreas de mejora;
- intereses libres;
- habilidades;
- actividades abiertas/publicadas;
- posibles compañeros.

Tipos persistidos:

- activity
- opportunity
- external_course
- resource
- strengthening_area
- teammate

El sistema almacena razones y puntajes, y conserva decisiones del usuario:

- new
- viewed
- saved
- dismissed

También conserva versión de reglas. Esta explicabilidad es consistente con el enfoque académico del proyecto.

No se detectó IA generativa ni un modelo de machine learning para estas recomendaciones: son **reglas deterministas ponderadas**, lo cual debe describirse así.

---

## 18. Gamificación: estado real

Existe:

- entidad `gamification_criteria`;
- catálogo/administración web de criterios.

No se encontró un motor que consuma esos criterios para asignar puntos, niveles, badges o recompensas al estudiante.

Por tanto:

> **Actualmente hay infraestructura/catálogo de gamificación, pero no gamificación funcional aplicada al comportamiento del sistema.**

No debe presentarse como módulo funcional completo mientras eso no cambie.

---

## 19. Pruebas y evidencia de calidad

Se encontraron seis scripts personalizados:

- `scripts/api-tests.mjs`
- `scripts/e2e-demo.mjs`
- `scripts/e2e-objectives-40.mjs`
- `scripts/e2e-objective-5.mjs`
- `scripts/e2e-objective-6.mjs`
- `scripts/e2e-objective-7.mjs`

Todos pasan `node --check`.

La documentación histórica reporta:

| Suite | Checks históricos declarados |
|---|---:|
| Objetivos 1–4 | 235 |
| Objetivo 5 | 109 |
| Objetivo 6 | 82 |
| Objetivo 7 | 84 |
| API/permisos | 42 |
| Demo E2E | 25 |
| **Total** | **577** |

No existen archivos Jest `.spec.ts`/`.test.ts` detectables. Además, `api/package.json` declara scripts `jest` y `eslint`, pero su `devDependencies` no contiene Jest ni ESLint. Por tanto, las pruebas realmente utilizadas son los scripts E2E personalizados, no una suite unitaria Nest/Jest convencional.

### Cobertura insuficiente detectada por esta auditoría

El script de API comprueba que el docente obtiene HTTP 200 en reportes y que un estudiante recibe 403, pero **no valida que el contenido del reporte esté restringido a los semestres del docente**. Por eso el defecto F-01 puede coexistir con una suite verde.

---

# 20. HALLAZGOS DETALLADOS

## F-01 — ALTA — Reportes docentes ignoran alcance por semestre y visibilidad

**Archivos:**
- `api/src/reports/reports.controller.ts`
- `api/src/reports/reports.service.ts`

Los endpoints docentes llaman a:

- `teacherOverview()`
- `teacherAffinitySummary()`
- `teacherProjectsSummary()`

sin enviar identidad del docente. `ReportsService` no inyecta ni usa `TeacherScopeService`.

Ejemplos concretos:

- `this.profiles.count()` cuenta todos los perfiles.
- `incompleteStudents()` devuelve nombres de todos los perfiles incompletos.
- `this.projects.count()` cuenta todos los proyectos.
- `recentProjects()` opera sobre proyectos globales.
- `basicMap()` se utiliza sin scope docente.

**Consecuencia:** un docente autorizado para determinados semestres puede recibir información fuera de su alcance. En proyectos, el resumen puede eludir incluso la visibilidad `TEACHERS` aplicada correctamente por `ProjectsService`.

**Impacto documental:** actualmente no puede afirmarse de forma absoluta que “el docente solo visualiza estudiantes/proyectos de los semestres asignados” en todo el sistema. La regla existe y funciona en varios módulos, pero tiene esta excepción.

**Corrección futura recomendada:** hacer que reportes reciban `CurrentUser`, resolver el scope con `TeacherScopeService` y aplicar el mismo filtro de semestre/visibilidad de los servicios de perfiles/proyectos.

---

## F-02 — ALTA — Archivos subidos quedan accesibles por URL sin JWT

**Archivo:** `api/src/main.ts`

El sistema registra:

```text
/api/files/*
```

mediante `useStaticAssets`. Esa ruta se sirve directamente por Express y no atraviesa los guards globales NestJS.

**Consecuencia:** quien conozca la URL puede descargar el archivo aunque no tenga sesión ni rol autorizado. Los nombres UUID disminuyen el riesgo de enumeración, pero no equivalen a autorización.

**Impacto documental:** no debe afirmarse que el acceso a evidencias está totalmente protegido por rol mientras los binarios se publiquen de esta forma.

**Corrección futura recomendada:** descarga mediante endpoint autenticado/autorizado o URLs firmadas con expiración; conservar storage como implementación interna.

---

## F-03 — ALTA OPERATIVA — El paquete de auditoría contiene `.env` reales y archivos subidos

Aunque `.gitignore` excluye `.env` y `api/uploads/`, el `.7z` recibido contiene variables de entorno con valores no vacíos y **27 archivos en `api/uploads/`**.

No se reproducen valores en este informe.

**Consecuencia:** una entrega manual del proyecto puede exponer credenciales/secretos o datos que no deberían salir con el código.

**Acción recomendada:** si esos secretos son reales, rotarlos. Para próximos handoffs, excluir explícitamente `.env`, `mobile/.env`, uploads y cualquier archivo de usuario. Mantener únicamente `.env.example` saneados.

---

## F-04 — MEDIA/ALTA — Evidencia añadida por integrante recalcula afinidad del propietario

**Archivo:** `api/src/projects/projects.service.ts`

`addEvidence()` atribuye correctamente la evidencia al perfil del integrante cuando existe, pero después ejecuta el recálculo con:

```text
project.createdByProfileId
```

no con el `studentProfileId` de la evidencia recién creada.

**Consecuencia:** la afinidad/recomendaciones del integrante pueden quedar obsoletas, mientras se recalcula innecesariamente la del propietario.

---

## F-05 — MEDIA — Eliminación histórica de evidencia de proyecto no elimina archivo físico

`ProjectsService.removeEvidence()` borra la fila de base de datos, pero no usa `StoragePort` para eliminar el archivo asociado.

`EvidencesService.remove()` sí lo hace correctamente.

**Consecuencia:** archivos huérfanos en disco y comportamiento distinto según el endpoint utilizado.

---

## F-06 — MEDIA — Dos caminos de evidencia con reglas diferentes

Actualmente conviven:

- endpoints genéricos de `EvidencesService`;
- endpoints históricos dentro de `ProjectsService`.

Las reglas de eliminación y recálculo no son equivalentes.

**Recomendación:** consolidar las mutaciones de evidencias en un único servicio/fuente de verdad.

---

## F-07 — MEDIA — Upload de dos pasos sin vínculo/procedencia verificable

El backend recibe posteriormente un `fileUrl` desde el cliente, pero no verifica de forma fuerte que:

- haya sido generado por el propio storage;
- el archivo exista;
- corresponda al usuario actual;
- siga sin asociarse a otro recurso.

Además, si el upload ocurre pero la creación de evidencia falla, queda un archivo huérfano.

**Recomendación:** persistir uploads temporales con ownership/estado o convertir upload+asociación en una operación controlada por backend.

---

## F-08 — MEDIA — Reemplazo de certificado borra archivo anterior antes de confirmar persistencia

En la actualización de certificado externo se elimina el archivo previo cuando cambia `fileUrl` antes de completar de forma transaccional toda la actualización.

**Consecuencia:** si el guardado posterior falla, la base puede conservar una referencia cuyo archivo ya fue eliminado.

---

## F-09 — MEDIA — Ciclo de estados de actividades no está completamente restringido

El servicio contiene validaciones específicas, pero no una tabla completa de transiciones permitidas. Es posible que combinaciones de transición que conceptualmente deberían ser inválidas no estén bloqueadas.

**Recomendación:** definir explícitamente la máquina de estados del documento y reflejarla en código/pruebas.

---

## F-10 — MEDIA — `evidenceRequired` es informativo, no obligatorio

El atributo existe, pero no se encontró una regla que impida completar/confirmar el flujo cuando la evidencia requerida no fue adjuntada.

**Impacto:** si el documento lo describe como obligación funcional, existe desalineación.

---

## F-11 — MEDIA — Constancias dependen del rol actual del creador de la actividad

La lógica valida compatibilidad con el rol del creador de la actividad. Si ese usuario cambia posteriormente de rol, una actividad histórica válida puede dejar de cumplir la verificación.

La autorización debería depender de la naturaleza de la actividad y de la autoridad actual que emite la constancia, no necesariamente del rol actual del creador histórico.

---

## F-12 — MEDIA — El enum de estados de constancia no representa un workflow real

Existen estados pendiente/autorizada/rechazada, pero no se observó un endpoint de transición de estado separado. El estado se establece al crear.

**Impacto:** evitar documentar un circuito “solicitud → revisión → aprobación/rechazo” si el software todavía no lo implementa.

---

## F-13 — MEDIA — JWT de larga duración sin refresh/revocación; web usa `localStorage`

El access token por defecto dura 30 días. Las variables de refresh existen en configuración de ejemplo pero el flujo no está implementado.

La revalidación de usuario/rol en DB reduce parte del riesgo, pero un token robado continúa siendo utilizable mientras la cuenta siga activa y el token no expire.

---

## F-14 — MEDIA — Falta hardening HTTP/autenticación

No se observaron:

- rate limiting;
- protección específica contra fuerza bruta;
- Helmet/headers endurecidos;
- Swagger condicionado por ambiente.

Esto es especialmente relevante antes de despliegue real, aunque no impide el desarrollo académico local.

---

## F-15 — MEDIA — Validación de archivos basada en MIME declarado

El upload valida tipo/tamaño, pero el tipo se basa en MIME suministrado durante la carga. No se encontró inspección de magic bytes/firma del archivo.

**Recomendación:** validar contenido real si estos archivos serán almacenados en un entorno expuesto.

---

## F-16 — MEDIA — Hard delete de usuarios puede chocar con relaciones

Existe `DELETE /users/:id` con eliminación física. Dado el número de FKs que pueden referenciar al usuario, una cuenta con actividad histórica puede provocar error de integridad o una semántica no deseada.

El sistema ya maneja estado activo/inactivo, por lo que para datos académicos históricos resulta más coherente preferir desactivación y reservar hard delete a casos controlados.

---

## F-17 — MEDIA — Incompatibilidad móvil al mostrar categoría de actividad docente

**Archivos:**
- `mobile/src/screens/teacher/TeacherActivities.tsx`
- `mobile/src/constants.ts`
- `api/src/activities/activities.service.ts`

La API carga `category` como relación/objeto. La pantalla llama:

```text
categoryLabel(a.category)
```

pero `categoryLabel()` espera un `string`.

**Consecuencia:** en React Native puede terminar intentando renderizar un objeto como hijo, provocando error de runtime.

En `MyActivitiesScreen`, la categoría tampoco está cargada explícitamente en la relación utilizada por el backend, por lo que puede mostrarse vacía. Además, el catálogo móvil estático no incluye `recurso_de_apoyo`.

**Origen estructural:** web/móvil duplican catálogos que la API ya modela dinámicamente.

---

## F-18 — MEDIA/BAJA — Contratos compartidos incompletos y drift entre clientes

El paquete `shared` no está funcionando como contrato único para web/API/móvil. Web y móvil duplican enums, categorías y etiquetas.

**Consecuencia:** cambios del backend pueden no reflejarse automáticamente en clientes; F-17 es un ejemplo práctico.

---

## F-19 — MEDIA/BAJA — Scripts estándar `test`/`lint` no están respaldados por dependencias declaradas

`api/package.json` declara:

- `jest`
- `eslint`

pero no declara estos paquetes en `devDependencies` y no se encontraron tests Jest.

Esto no invalida las suites `.mjs`, pero la metadata del paquete da la impresión de una infraestructura de unit testing/lint que el snapshot no contiene realmente.

---

## F-20 — MEDIA/BAJA — `.env.example` no coincide con Docker para PostgreSQL

Docker publica:

```text
5435:5432
```

pero `.env.example` define:

```text
POSTGRES_PORT=5432
```

El `.env` real del snapshot utiliza 5435, por lo que el sistema probablemente funciona en la máquina de origen, pero seguir literalmente el README + `.env.example` puede intentar conectar contra el puerto equivocado.

---

## F-21 — BAJA/DOCUMENTAL — Persisten textos del antiguo 30%

Ejemplos:

- descripción raíz del proyecto;
- descripción Swagger;
- texto de `ReportsService`;
- comentarios y scripts históricos;
- comentarios de constantes web.

Esto no rompe el runtime, pero sí perjudica una entrega de proyecto de grado porque crea evidencia contradictoria sobre el nivel de avance.

---

## F-22 — BAJA/DOCUMENTAL — README contradice roles reales de actividades

En partes del README se indica que el **docente publica actividades académicas** y que “docente/sociedad” confirma participación.

El código real asigna la gestión académica al **Director de carrera**, extracurricular a Sociedad científica y permite soporte de Administrador.

Para la documentación final debe prevalecer el código aprobado o, si tu definición funcional final exige otra cosa, el software deberá cambiar de forma deliberada.

---

## F-23 — DISEÑO — Semántica de `affinity_weights.isActive`

El motor carga pesos activos y, cuando falta alguno, repone el valor por defecto. Por tanto, desactivar un peso no desactiva necesariamente esa señal: puede hacer que vuelva al default.

Si `isActive=false` pretende “deshabilitar este factor”, la implementación no coincide con esa intención.

---

## F-24 — DISEÑO/FUTURO — `universityCode` existe pero no tiene flujo normal de carga

El modelo contempla un código universitario único, pero no hay una vía ordinaria clara en los DTO de perfil para poblarlo.

Si los objetivos futuros de QR/contactos dependen de ese dato, primero debe definirse su origen fiable: administración, importación institucional, activación o edición controlada.

---

## F-25 — ALCANCE — Administración móvil no tiene paridad con web

En móvil, Administrador dispone de Usuarios y Áreas. En web, además gestiona Roles, Habilidades, Categorías de actividad y Gamificación.

No es necesariamente un defecto: puede ser una decisión de UX/alcance. Sí es un punto que el documento debe describir sin afirmar paridad funcional completa entre plataformas.

---

## F-26 — DISEÑO — Evidencia genérica puede quedar sin contexto o con varios contextos

`CreateEvidenceDto` permite opcionalmente `projectId`, `activityId` y `academicAreaId`. El servicio valida cada uno si existe, pero no exige exactamente uno.

Por ello una evidencia puede:

- no apuntar a proyecto ni actividad ni área;
- apuntar simultáneamente a más de uno.

Esto puede ser intencional, pero la regla de negocio debe definirse expresamente para evitar ambigüedad futura.

---

## 21. Fortalezas verificadas

La auditoría no solo encontró problemas. Hay decisiones técnicas que conviene **conservar** al corregir el sistema:

1. **Guards globales de autenticación/roles.**
2. **Registro público fuerza rol STUDENT desde backend.**
3. **JWT revalida usuario, rol y estado contra DB en cada petición.**
4. **ValidationPipe estricto global.**
5. **Migraciones explícitas y `synchronize:false`.**
6. **TeacherScopeService como fuente central de alcance docente en los módulos que sí lo usan.**
7. **Catálogos se desactivan en lugar de destruir historia.**
8. **Invitación de proyecto no crea membresía hasta aceptación.**
9. **Visibilidad de proyecto y scope docente bien aplicados en `ProjectsService`.**
10. **Afinidad explicable por contribuciones + snapshots + versión de reglas.**
11. **Recomendaciones explicables con razones/puntaje y estado persistente.**
12. **SecureStore en móvil.**
13. **Storage genera nombres UUID y evita usar el nombre del cliente como ruta.**
14. **DTOs y validaciones abundantes en backend.**
15. **Frontend y móvil consumen API real en las funcionalidades principales; no son meras maquetas hardcodeadas.**
16. **La suite E2E histórica es amplia, aunque debe reforzarse con pruebas semánticas de autorización y UI.**

---

## 22. Qué afirma la auditoría histórica del 70% y qué cambia esta revisión

`docs/AUDITORIA_FINAL_70_PORCIENTO.md` declara los siete objetivos como aprobados y afirma que no hay hallazgos abiertos de código, seguridad o datos.

Esa auditoría histórica es útil como evidencia de lo que el equipo comprobó en su momento, pero **no debe tomarse como verdad absoluta actual**. Esta revisión independiente encontró defectos concretos que la suite anterior no detectó, especialmente:

- scope docente de reportes;
- privacidad de archivos estáticos;
- divergencia de evidencias de proyecto;
- incompatibilidad móvil de categorías;
- inconsistencias de configuración y documentación.

La existencia de pruebas verdes no contradice estos hallazgos: una prueba puede verificar “HTTP 200” sin verificar que el contenido devuelto tenga el alcance correcto.

---

## 23. Línea base que puede usarse para corregir el documento de grado

Mientras el software no sea modificado, estas son descripciones técnicamente seguras:

### Arquitectura

> El sistema está implementado como una arquitectura cliente-servidor con una API REST central desarrollada en NestJS. La lógica de negocio se organiza en módulos dentro de un monolito modular y utiliza TypeORM para persistencia en PostgreSQL. Cuenta con un cliente web desarrollado en React/Vite y una aplicación móvil desarrollada con Expo/React Native.

### Base de datos

> El esquema actual contiene 26 tablas de dominio/aplicación y es versionado mediante 12 migraciones TypeORM, manteniéndose deshabilitada la sincronización automática del esquema.

### Seguridad

> La API utiliza autenticación JWT y autorización por roles mediante guards globales; el rol y estado del usuario se revalidan contra la base de datos en las solicitudes autenticadas.

No debe afirmarse todavía que **todo** el acceso a archivos/evidencias está protegido por JWT, debido a F-02.

### Afinidad

> El motor de afinidad es determinista y basado en reglas ponderadas. Integra señales del perfil y de la trayectoria registrada del estudiante y conserva contribuciones y snapshots para explicar el resultado.

No debe describirse como inteligencia artificial o machine learning.

### Recomendaciones

> Las recomendaciones académicas se generan mediante reglas deterministas a partir de afinidad, preferencias, áreas de mejora, habilidades, actividades e información de posibles compañeros, conservando razones y puntajes explicables.

### Gamificación

> Existe el catálogo de criterios de gamificación, pero el motor de aplicación de puntos/recompensas aún no está implementado en este snapshot.

### Almacenamiento

> El driver efectivo actual es almacenamiento local. Aunque `.env.example` contempla configuración Cloudinary, no se encontró implementación de un driver Cloudinary activo.

### Refresh token

> El sistema utiliza JWT de acceso. Existen variables de configuración preparatorias para refresh token, pero no un flujo funcional de renovación en el código auditado.

### Multiplataforma

> Web y móvil acceden a la misma API, pero la superficie funcional por rol no es idéntica entre plataformas; la administración móvil es actualmente más reducida que la web.

---

## 24. Elementos que todavía NO existen como funcionalidad completa

A partir del snapshot recibido no deben darse por terminados:

- chat privado/grupal;
- contactos mediante QR;
- equipos/funcionalidades avanzadas asociadas a objetivos posteriores;
- gamificación aplicada como motor operativo;
- storage Cloudinary;
- refresh token real;
- paridad completa web/móvil de administración.

Las pantallas “Próximamente” del móvil confirman que parte de esos módulos se reservan para etapas posteriores.

---

## 25. Prioridad recomendada para la futura etapa de QA/corrección

Cuando se incorpore el `.txt` de observaciones del usuario y el documento de proyecto de grado, conviene ordenar la corrección así:

### Prioridad A — autorización y privacidad

- F-01 reportes docentes;
- F-02 acceso a archivos;
- saneamiento/rotación por F-03.

### Prioridad B — integridad funcional

- F-04/F-05/F-06 evidencias;
- F-08 certificados;
- F-09/F-10 actividades;
- F-11/F-12 constancias;
- F-17 móvil.

### Prioridad C — hardening

- F-07 upload;
- F-13/F-14/F-15 seguridad;
- F-16 usuarios.

### Prioridad D — coherencia arquitectura/documentación

- F-18 shared;
- F-19 tests/lint;
- F-20 entorno;
- F-21/F-22 textos obsoletos;
- F-23/F-24/F-25/F-26 decisiones de diseño.

Después de cada bloque debe ejecutarse regresión E2E y añadir una prueba específica para el defecto corregido, especialmente aquellas relacionadas con autorización negativa y alcance de datos.

---

## 26. Qué NO se hizo en esta auditoría

Para preservar el snapshot como línea base:

- no se modificó ningún archivo del proyecto;
- no se “arregló” código automáticamente;
- no se cambió el esquema;
- no se migró la base;
- no se alteraron datos;
- no se reescribió el documento académico;
- no se asumió que las observaciones futuras ya están aprobadas;
- no se mezcló el estado actual con funcionalidades planeadas para los objetivos 8–10.

---

## 27. Conclusión técnica

AfiniaC, en el estado recibido, **sí es una base de proyecto de grado técnicamente seria y utilizable**. La estructura modular del backend, el esquema relacional, los controles de rol, el modelo de actividades/proyectos, la trazabilidad del motor de afinidad y el sistema de recomendaciones muestran que hay implementación sustantiva detrás del “70%”.

La principal precaución para la siguiente fase es no confundir “módulo existente” con “módulo completamente alineado”. El código reveló algunas excepciones importantes a las reglas que la documentación histórica presenta como globales, especialmente el alcance del docente y la protección de archivos. También existen divergencias entre web/móvil, duplicación de caminos de evidencias y textos/configuraciones heredados de etapas anteriores.

Por ello, la mejor estrategia para continuar es usar **este snapshot como línea base**, después contrastarlo con:

1. el documento actual del proyecto de grado;
2. las observaciones funcionales/UX que se entreguen en `.txt`;
3. la intención final aprobada para cada RF/objetivo.

De ese cruce debe salir una única matriz de verdad con tres columnas conceptuales:

```text
REQUISITO / DOCUMENTO  ↔  SOFTWARE ACTUAL  ↔  CORRECCIÓN APROBADA
```

Solo después conviene pasar a Claude Code/Codex un `.md` de cambios cerrado, evitando que el agente “invente” comportamiento o corrija una parte a costa de desalinear otra.

---

# ANEXO A — Rutas aproximadas por módulo

```text
activities             10
affinity               11
auth                    3
catalogs               13
certificates            4
constancies             5
evidences               3
health                  1
profiles               17
project-feedback        3
projects               14
recommendations         5
reports                 7
roles                   1
uploads                 1
users                   8
--------------------------
TOTAL                  106
```

# ANEXO B — Archivos especialmente relevantes para la próxima comparación documental

```text
README.md
package.json
.env.example
docker/docker-compose.yml
schema_afinia.sql

api/src/app.module.ts
api/src/main.ts
api/src/auth/
api/src/access/teacher-scope.service.ts
api/src/entities/
api/src/database/migrations/
api/src/profiles/
api/src/activities/
api/src/projects/
api/src/evidences/
api/src/certificates/
api/src/constancies/
api/src/affinity-recalc/
api/src/recommendations/
api/src/reports/
api/src/storage/

web/src/App.tsx
web/src/navigation.ts
web/src/services/

mobile/src/navigation/RootNavigator.tsx
mobile/src/screens/
mobile/src/constants.ts

scripts/api-tests.mjs
scripts/e2e-demo.mjs
scripts/e2e-objectives-40.mjs
scripts/e2e-objective-5.mjs
scripts/e2e-objective-6.mjs
scripts/e2e-objective-7.mjs
```

# ANEXO C — Regla de trabajo para la siguiente fase

Este informe describe **lo que existe ahora**. No debe convertirse automáticamente en una lista de cambios sin contrastar las observaciones del usuario y el documento académico. Algunos hallazgos son errores objetivos; otros son decisiones de diseño que primero deben reconciliarse con el alcance del proyecto.

La siguiente etapa debería clasificar cada diferencia como una de estas tres opciones:

- **Corregir software** porque el documento/requisito final es correcto.
- **Corregir documento** porque el software representa la decisión funcional aprobada.
- **Corregir ambos** porque ni la implementación ni la redacción actual expresan correctamente la intención final.

Ese enfoque permitirá que el documento final y el sistema converjan sin perder trazabilidad.
