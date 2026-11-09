# Auditoría final del 40 %

Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico (Afinia)
Ingeniería en Sistemas Informáticos — Universidad Privada del Valle, sede Cochabamba

---

## 1. Resumen ejecutivo

Este documento cierra el pase de alineación final entre el documento de Proyecto
de Grado y el software implementado, para los **cuatro primeros objetivos
específicos**, que corresponden a **RF1 – RF12** de los 25 requerimientos
funcionales del documento.

Se cerraron los **cuatro huecos reales** que quedaban entre lo que el documento
pide y lo que el software hacía: RF4 (categorías administrables), RF5 (intereses
separados de áreas de preferencia), RF8 (filtros de modalidad y fecha) y RF12
(regla de actividad autorizada).

**Resultado de la verificación, sobre base recreada desde cero y en dos corridas
consecutivas: 302 verificaciones automatizadas, 0 fallos.** Compilan `shared`,
`api`, `web` y el typecheck de `mobile`.

Con la implementación, las pruebas y los flujos visuales verificados, se puede
afirmar que **los cuatro primeros objetivos específicos están completamente
implementados y alineados con RF1 – RF12**.

Queda una tarea pendiente que **no depende del software**: aplicar en el archivo
Word las correcciones documentales listadas en
[`CORRECCIONES_DOCUMENTO_FINAL_40.md`](CORRECCIONES_DOCUMENTO_FINAL_40.md).

---

## 2. Estado inicial antes de este cierre

El pase anterior había dejado los cuatro objetivos funcionando de extremo a
extremo, con 246 verificaciones en verde. La auditoría contra el documento
detectó, sin embargo, cuatro divergencias reales:

| # | Hueco | RF | Impacto |
|---|---|---|---|
| 1 | Las categorías de actividad eran un `enum` fijo de 14 valores; el administrador no podía crear ni dar de baja ninguna | RF4 | El requerimiento pedía explícitamente «registrar y actualizar categorías de actividades» |
| 2 | «Intereses» y «áreas de preferencia» estaban resueltos con una sola estructura | RF5 | El requerimiento los enumera como datos declarativos distintos |
| 3 | Faltaban los filtros por modalidad y por fecha | RF8 | El requerimiento pide «categoría, área, modalidad o fecha» |
| 4 | No existía el concepto de «actividad autorizada por la carrera» | RF12 | RN-11 y el flujo alternativo 8a de la Tabla 2.21 lo exigen como verificación propia |

Además, la auditoría documentó seis contradicciones **del documento consigo
mismo**, que no eran fallos del software.

---

## 3. Correcciones realizadas

### 3.1 En el software

| # | Cambio | RF |
|---|---|---|
| 1 | Catálogo `activity_categories` administrable, con migración que preserva los datos | RF4 |
| 2 | Entidad `student_free_interests` para los intereses en texto libre | RF5 |
| 3 | Endpoints canónicos `/profiles/me/preferred-areas` para las áreas de preferencia | RF5 |
| 4 | Filtros `modality`, `fromDate` y `toDate` con validación de rango | RF8 |
| 5 | Verificación de actividad autorizada al emitir constancia y al listar elegibles | RF12 |
| 6 | Validador `IsNotBeforeField` reutilizable para rangos de fechas | RF8 |
| 7 | Seed ampliado: 14 categorías, 32 intereses en texto libre | RF4, RF5 |

### 3.2 En el documento

Preparadas, no aplicadas: 17 correcciones con texto exacto de reemplazo en
[`CORRECCIONES_DOCUMENTO_FINAL_40.md`](CORRECCIONES_DOCUMENTO_FINAL_40.md).

---

## 4. RF1 – RF12, uno por uno

| RF | Nombre | Cierre en este pase | Estado |
|---|---|---|---|
| RF1 | Registrar cuenta de estudiante | Sin cambios; ya cumplía | **CUMPLIDO** |
| RF2 | Gestionar sesión de usuario | Sin cambios; ya cumplía | **CUMPLIDO** |
| RF3 | Gestionar usuarios institucionales, roles y estados | Sin cambios; ya cumplía, incluidos los semestres habilitados | **CUMPLIDO** |
| RF4 | Gestionar catálogos y criterios de gamificación | **Cerrado:** categorías de actividad administrables | **CUMPLIDO** |
| RF5 | Gestionar perfil estudiantil | **Cerrado:** intereses en texto libre separados de las áreas de preferencia | **CUMPLIDO** |
| RF6 | Visualizar perfil estudiantil dinámico | Ampliado: el resumen expone `freeInterests` y `preferredAreas` por separado | **CUMPLIDO** |
| RF7 | Gestionar actividades académicas y extracurriculares | Ajustado: la categoría sale del catálogo y se valida contra el tipo | **CUMPLIDO** |
| RF8 | Consultar actividades disponibles | **Cerrado:** filtros de modalidad y fecha | **CUMPLIDO** |
| RF9 | Registrar interés o inscripción en actividad | Sin cambios; ya cumplía | **CUMPLIDO** |
| RF10 | Registrar asistencia y participación | Sin cambios; ya cumplía | **CUMPLIDO** |
| RF11 | Gestionar evidencias y certificados externos | Sin cambios; ya cumplía, con subida real de archivos | **CUMPLIDO** |
| RF12 | Registrar constancia interna autorizada | **Cerrado:** regla de actividad autorizada | **CUMPLIDO** |

El detalle por RF —entidad, controlador, servicio, endpoint, pantalla, prueba y
figura del documento— está en
[`MATRIZ_TRAZABILIDAD_40.md`](MATRIZ_TRAZABILIDAD_40.md).

---

## 5. Reglas de negocio verificadas

RN-01, RN-02, RN-03, RN-04, RN-05, RN-06, RN-07, RN-08, RN-09, RN-10, RN-11,
RN-21 y RN-23, cada una con su prueba automatizada. La tabla completa, con el
enunciado del documento y la prueba que lo respalda, está en la matriz de
trazabilidad.

Las reglas RN-12 a RN-20, RN-22 y RN-24 a RN-26 corresponden a los objetivos 5 a
10 y quedan fuera de este 40 %.

---

## 6. Cambios de base de datos

| Tabla | Cambio | Preservación de datos |
|---|---|---|
| `activity_categories` | **Nueva.** `code`, `name`, `description`, `applies_to`, `is_active`, con únicos por código y por nombre | Sembrada con las 14 categorías del enum anterior, mismo código |
| `activities` | Nueva columna `category_id` (FK `RESTRICT`, indexada). Se retira la columna `category` y su tipo enum | **32 actividades antes, 32 después, 0 sin categoría, distribución idéntica** |
| `student_free_interests` | **Nueva.** `student_profile_id`, `name`, `description`, con único funcional por `(perfil, lower(name))` | Tabla nueva; no afecta datos existentes |
| `student_interests` | **Sin cambios físicos.** Conserva su nombre; pasa a representar las áreas de preferencia en el dominio y la API | Intacta |

Total del proyecto: **9 migraciones, 19 tablas**. `synchronize: false` se mantiene.

**Sobre el nombre `student_interests`.** Se optó por conservar el nombre físico
en lugar de renombrar la tabla. La razón es de seguridad de datos: el renombrado
no aportaba nada funcional y sí introducía riesgo sobre una tabla con datos de
demostración y de pruebas. El significado queda documentado en la entidad, en el
DTO y en la API, donde el concepto se llama **área de preferencia**.

---

## 7. Migraciones

| Archivo | Contenido |
|---|---|
| `1780220000000-Rf4CategoriesAndRf5FreeInterests.ts` | Crea `activity_categories` con las 14 categorías; agrega `activities.category_id` y lo rellena mapeando por código; red de seguridad para valores sin equivalente; retira el enum; crea `student_free_interests` con su índice funcional único |

El `down` restituye el enum `activities_category_enum` **rellenándolo desde el
catálogo**, de modo que revertir la migración no pierde la categoría de ninguna
actividad.

Las ocho migraciones anteriores no se modificaron.

---

## 8. Endpoints nuevos o modificados

**Nuevos (8)**

```
GET    /activity-categories
POST   /activity-categories
PATCH  /activity-categories/:id
GET    /activity-categories/:id/usage
GET    /profiles/me/free-interests
POST   /profiles/me/free-interests
PATCH  /profiles/me/free-interests/:id
DELETE /profiles/me/free-interests/:id
```

**Canónicos nuevos, con alias histórico conservado (2)**

```
POST /profiles/me/preferred-areas    (alias deprecado: POST /profiles/me/interests)
PUT  /profiles/me/preferred-areas    (alias deprecado: PUT  /profiles/me/interests)
```

**Modificados (4)**

| Endpoint | Cambio |
|---|---|
| `POST /activities` | `category` (enum) pasa a `categoryId` (UUID del catálogo); se valida existencia, vigencia y tipo aplicable |
| `PATCH /activities/:id` | Ídem al cambiar de categoría |
| `GET /activities` | Nuevos filtros `categoryId`, `modality`, `fromDate` y `toDate` |
| `GET /profiles/me/summary` | Expone `freeInterests` y `preferredAreas` por separado; `interests` se conserva por compatibilidad |

Total del proyecto: **84 rutas**. Documentación interactiva en `/api/docs`.

---

## 9. Pantallas nuevas o modificadas

**Web — nueva (1)**

- *Categorías de actividad* (administrador): alta, edición, activación y baja,
  con sugerencia automática de código y aviso de cuántas actividades usan la
  categoría antes de darla de baja.

**Web — modificadas (4)**

- *Actividades académicas* y *Actividades extracurriculares*: el selector de
  categoría se alimenta del catálogo y filtra por el tipo aplicable.
- *Actividades del programa* (docente): el filtro de categoría usa el catálogo.
- *Intereses y habilidades* (estudiante): usa el endpoint canónico de áreas de
  preferencia.

**Móvil — modificadas (3)**

- *Intereses y áreas de preferencia*: rehecha. Dos secciones diferenciadas —
  alta, edición y borrado de intereses en texto libre, y el selector de áreas de
  preferencia con prioridad.
- *Actividades*: los cuatro filtros del RF8 (categoría, área, modalidad y rango
  de fechas), aplicados en el servidor, combinables y con botón de limpiar.
- *Gestión de actividades* (director y sociedad): la categoría se elige del
  catálogo, filtrada por el tipo.

---

## 10. Correcciones realizadas al documento

Ninguna aplicada automáticamente sobre el `.docx`. Se creó un respaldo íntegro
(`docs/respaldo-documento/`, 77 partes, ZIP verificado) y se documentaron
**17 correcciones** con sección, texto actual, texto corregido, motivo y RF
afectado, en
[`CORRECCIONES_DOCUMENTO_FINAL_40.md`](CORRECCIONES_DOCUMENTO_FINAL_40.md).

**Motivo de no editar el archivo:** 22 MB, 43 figuras incrustadas, índices y
numeración automática. Una reescritura programática arriesga corromper estilos,
referencias cruzadas o imágenes. La regla del pase era explícita: nunca dañar el
documento para automatizar una corrección cosmética.

---

## 11. Divergencias documentales corregidas

| Divergencia | Resolución |
|---|---|
| Figura 2.3 incluye «Validar y aprobar evidencias», que no existe en ningún RF, especificación, secuencia ni regla | Se elimina del diagrama. El software no implementa un flujo que el documento no define |
| Figura 2.3 conecta al Estudiante con «Registrar y gestionar asistencias» | Se corrige el trazado: RN-08 y RF10 lo reservan al responsable, y el software ya lo hace así |
| Figura 2.3 no incluye el óvalo de RF7 | Se añade |
| Figura 2.11 incluye un «Servicio de notificaciones» ausente del resto del documento | Se elimina del diagrama |
| Figura 2.12 llama `InternalCertificate` a la constancia interna | Se renombra a `ConstanciaInterna`, coherente con RN-11 |
| Figura 2.12 separa `ActivityRegistration` de `ActivityParticipation` | Se fusiona en el diagrama: el software usa un ciclo de vida por estados, más simple y suficiente |
| Figura 2.12 dibuja herencia entre `Evidence` y los certificados | Se quita del diagrama: la implementación usa entidades independientes relacionadas |
| Figura 2.12 incluye cuatro atributos sin uso funcional | Se retiran del diagrama en lugar de crear columnas muertas |
| Figuras 2.22 y 2.24 nombran componentes que no existen en el código | Se alinean los nombres; el flujo no cambia |

---

## 12. Pruebas ejecutadas

Sobre base recreada desde cero (`db:reset` → `api:migrate` → `seed:populate`) y
repetidas dos veces seguidas para detectar dependencias de estado:

| Suite | Comando | 1.ª corrida | 2.ª corrida |
|---|---|---|---|
| Objetivos del 40 % | `npm run test:40` | **235 OK · 0 fallos** | **235 OK · 0 fallos** |
| Validaciones de backend | `npm run test:api` | **42 OK · 0 fallos** | **42 OK · 0 fallos** |
| Flujo de 14 pasos | `npm run demo:e2e` | **25 OK · 0 fallos** | **25 OK · 0 fallos** |
| **Total** | | **302 · 0 fallos** | **302 · 0 fallos** |

**56 verificaciones nuevas** en este pase, agrupadas en el bloque *Cierre final*:

- **RF4 (18):** catálogo consultable, migración conservó las 14 categorías, alta,
  código duplicado, nombre duplicado, formato de código inválido, edición, alta
  por un no administrador, publicación con categoría nueva, categoría fuera de
  tipo, categoría inexistente, baja, uso informado, la actividad existente
  conserva su categoría dada de baja, no se publica con categoría de baja, la
  categoría de baja deja de ofrecerse.
- **RF5 (16):** consulta, alta con y sin descripción, duplicado sin distinguir
  mayúsculas, vacío, demasiado largo, edición, edición ajena, listado, áreas de
  preferencia aparte, ambos en el perfil dinámico, estructuras distintas, borrado.
- **RF8 (14):** modalidad, fecha desde, fecha hasta, rango de un día, filtros
  combinados, rango invertido, fecha inválida, modalidad inexistente, sin
  resultados, limpieza de filtros.
- **RF12 (8):** borrador, cancelada, elegibles de actividad no autorizada,
  confirmación por la sociedad, emisión sobre extracurricular autorizada,
  duplicado, actor no autorizado, integración en el perfil.

---

## 13. Resultado de compilación

| Paquete | Comando | Resultado |
|---|---|---|
| `shared` | `npm run shared:build` | **OK** |
| `api` | `npm run api:build` | **OK** |
| `web` | `npm run web:build` | **OK** |
| `mobile` | `npm run mobile:typecheck` | **OK** |

---

## 14. Evidencias de cumplimiento

| Objetivo | Evidencia demostrable en la aplicación |
|---|---|
| 1 | El administrador crea un docente, le asigna semestres y lo desactiva; el docente pierde el acceso en el acto. Crea y da de baja una categoría de actividad y un área académica |
| 2 | El estudiante registra semestre, intereses en texto libre, habilidades, áreas de preferencia y áreas de mejora; la completitud llega a 100 % y el perfil dinámico integra todo. El docente solo ve los semestres habilitados |
| 3 | El director publica una actividad académica y la sociedad una extracurricular; el estudiante las filtra por categoría, área, modalidad y fecha, abre el detalle y se inscribe |
| 4 | El responsable confirma la participación; el estudiante sube un PDF real como evidencia y registra un certificado externo; el director emite la constancia interna y el perfil dinámico la muestra |

El guion paso a paso está en [`DEMO_40_PORCIENTO.md`](DEMO_40_PORCIENTO.md).

---

## 15. Deuda técnica no bloqueante

1. **Sin paginación** en `/users`, `/activities` y `/profiles/students`.
   Correcto con datos de demostración; necesario antes de escalar.
2. **`jest` declarado sin instalar** en `api/package.json`: `npm test` falla. La
   cobertura real está en los scripts `.mjs`, que necesitan la API viva.
3. **Sin refresh token.** El acceso dura 30 días. El riesgo principal —que un
   usuario desactivado siguiera operando— ya está cerrado porque el estado se
   verifica en cada petición.
4. **Sin límite de intentos** en `/auth/login`.
5. **Recálculo de afinidad síncrono** y sin transacción en el `delete` + `insert`.
   El N+1 ya se eliminó. El puerto existente hace barato moverlo a una cola.
6. **Los intereses en texto libre todavía no alimentan el motor de afinidad.** Se
   persisten, se editan y aparecen en el perfil dinámico, como exige RF5. Su
   contribución al cálculo de afinidad se definirá en el Objetivo 6, para no
   desestabilizar un motor que ya funciona.
7. **El bundle web supera 500 kB**; conviene dividirlo por rutas.
8. **La jerarquía POO de `api/src/domain/`** sigue sin estar conectada a los
   guards: es el modelo conceptual, no el mecanismo de autorización en ejecución.
9. **Solo hay driver local de almacenamiento.** El puerto está listo para un
   proveedor remoto; no se implementó ninguno.
10. **Las correcciones del documento están pendientes de aplicar** en el Word.

---

## 16. Funciones fuera del 40 %

Corresponden a los objetivos 5 a 10 del documento (RF13 – RF25):

- Portafolio de proyectos completo: invitaciones a integrantes (RF14) y
  retroalimentación docente (RF16). *El registro de proyectos y evidencias ya
  funciona, heredado del 30 %, pero no se cuenta dentro del 40 %.*
- Motor de afinidad completo y recomendaciones académicas (RF17, RF18).
  *El motor existe y funciona; su objetivo propio es el 6.*
- Contactos por QR, chat privado, equipos y chat grupal (RF19 – RF22).
- Gamificación: puntos, insignias y progreso (RF23). *Los criterios ya se
  administran; falta el motor que los aplique.*
- Paneles, mapa de afinidad y estimación de tendencias (RF24, RF25).
  *Los reportes básicos existen, heredados del 30 %.*

Estos módulos siguen apareciendo como **«Próximamente»** en la navegación, y
únicamente ellos: dentro de RF1 – RF12 no queda ningún marcador de pendiente.

---

## 17. Conclusión

Los cuatro huecos identificados en la auditoría contra el documento están
cerrados y verificados. La implementación cubre RF1 – RF12 con modelo de datos,
migraciones, permisos, validaciones, endpoints, pantallas que consumen la API
real y pruebas automatizadas que pasan de forma repetible sobre una base
recreada desde cero.

**Los cuatro primeros objetivos específicos están completamente implementados.**

Esta afirmación se sostiene sobre 302 verificaciones automatizadas en verde, la
compilación limpia de los cuatro paquetes y la trazabilidad completa de RF1 – RF12
en la matriz.

Con una salvedad que conviene declarar sin rodeos: **la alineación documental
todavía no está aplicada en el archivo Word**. Las 17 correcciones están
especificadas con su texto exacto, pero mientras no se apliquen, el documento
seguirá conteniendo diagramas que se contradicen entre sí y con su propia
especificación. Eso no afecta al software —que está del lado correcto en todos
los casos— pero sí a la coherencia del expediente que se presenta en la defensa.
