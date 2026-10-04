# Cambios para alinear el documento de grado con Afinia V2

Documento revisado: `Documento_Proyecto_Grado_Valdivia_Mollo_v2 (1).docx` (capítulo 2: Inicio, Elaboración y Construcción). **No se modificó el `.docx`**; hay un respaldo en `docs/respaldo-documento/`. Esta guía dice qué cambiar, dónde y con qué texto, para que el documento, los diagramas y el software describan el mismo sistema (Especificación V2, §88 punto 32).

Convención: **Quitar** = el software ya no lo hace; **Cambiar** = lo hace distinto; **Agregar** = existe y el documento no lo menciona.

---

## 1. Resumen de diferencias

| Tema | Documento actual | Software V2 |
|---|---|---|
| Alta de estudiantes | Registro público (RF 1, Tabla 2.10, Figura 2.13) | **No hay registro público**: la institución provisiona (alta manual o padrón) y el titular **activa** desde su correo |
| Comunicación | Chat privado y chat grupal (RN-18, RN-20, RF 20, RF 22, Tablas 2.29 y 2.31, Figuras 2.32 y 2.34) | **Chat retirado**: contactos con canales externos (Teams, WhatsApp, LinkedIn, correo, enlace) y nota personal |
| Habilidades | Declaradas con nivel (RN-03, RF 5, RF 24) | **Sin nivel autodeclarado**: intereses por tecnología («me interesa», «quiero mejorar») y **tecnologías respaldadas** por trayectoria |
| Afinidad | Usa intereses declarados (RN-14, RF 17) | **V3**: solo lo hecho y respaldado — actividades (tope 25), proyectos (50), certificados (25); lo declarado suma 0 |
| Actividades de docente y sociedad | La sociedad publica directamente | **Aprobación de Dirección** (aprobar, observar, rechazar) antes de publicar |
| Constancias | Solo el Director las registra | Las emite Dirección o el responsable de la actividad, si la actividad las tiene **habilitadas y aprobadas**; queda quién emitió y quién autorizó |
| Móvil | Funcionalidades estudiantiles | **Solo Estudiante**, aplicado por la API |
| IA | No figura | **Asistente opcional y no autoritativo** |
| Requerimientos no funcionales | 6 | 10 (V2 §76) |

---

## 2. Sección 2.1.1 — Actores

- **Estudiante**: quitar «registro de … habilidades» y «utilizar las funcionalidades de comunicación». Agregar: «completa una bienvenida guiada, declara intereses por tecnología, comparte sus canales de contacto y descarga su CV en PDF».
- **Docente**: agregar «propone actividades académicas que la Dirección aprueba» y «consulta el Panel académico de sus semestres habilitados». Quitar «habilidades» de lo que consulta (ahora son tecnologías respaldadas).
- **Director de Carrera**: agregar «aprueba, observa o rechaza las actividades propuestas por docentes y sociedad científica, junto con su constancia y sus puntos».
- **Sociedad Científica**: cambiar «registrar y administrar» por «proponer y, una vez aprobadas por Dirección, publicar y administrar».
- **Administrador**: agregar «provisiona cuentas e importa el padrón; consulta la auditoría».

## 3. Sección 2.1.2 — Reglas de negocio

| Regla | Acción | Texto propuesto |
|---|---|---|
| RN-01 | Cambiar | «Ninguna cuenta se crea sola. El Administrador provisiona cada cuenta —una a una o importando el padrón— con su rol; las de estudiante exigen semestre y código universitario. El titular activa su cuenta desde el enlace o código enviado a su correo institucional y elige su contraseña.» |
| RN-03 | Cambiar | «El estudiante declara sus intereses por área y por tecnología, distinguiendo lo que le interesa de lo que quiere mejorar. Lo declarado orienta las recomendaciones; no se declara nivel de dominio. La información derivada de su trayectoria se incorpora progresivamente.» |
| RN-06 | Cambiar | Agregar al final: «Sus actividades requieren la aprobación de la Dirección de Carrera antes de publicarse.» |
| RN-05 bis (nueva) | Agregar | «Las actividades propuestas por Docente o Sociedad Científica se crean en borrador y se envían a revisión. La Dirección de Carrera las aprueba, las observa con un comentario o las rechaza; solo una actividad aprobada puede publicarse. La decisión queda registrada.» |
| RN-11 | Cambiar | «Una constancia interna requiere participación confirmada en una actividad que la tenga habilitada y aprobada por Dirección. La emite la Dirección o el responsable de la actividad; se registra quién la emitió y qué Dirección la autorizó.» |
| RN-14 | Cambiar | «El motor de afinidad considera solo trayectoria respaldada: participación confirmada en actividades (hasta 25 puntos por área), proyectos según su nivel de respaldo y las tecnologías que cada integrante confirmó haber usado (hasta 50) y certificados externos según su respaldo (hasta 25). Los intereses declarados no suman afinidad. Cada puntaje se puede desglosar.» |
| RN-18 | Quitar y reemplazar | «La comunicación entre estudiantes se realiza fuera de la plataforma, por los canales que cada uno decide compartir (Teams, WhatsApp, LinkedIn, correo de contacto u otro enlace). Los contactos aceptados ven esos canales; en el perfil público solo aparecen los que el estudiante marca.» |
| RN-20 | Quitar | (el chat grupal no existe) |
| RN-19 | Cambiar | Agregar: «El nombre del equipo se modera por reglas y, si la institución configura un asistente de IA, también por él; un nombre marcado no se comparte hasta corregirlo.» |
| RN-21 | Cambiar | Agregar: «Una actividad puede fijar puntos propios por participación confirmada, dentro de un tope configurable y con aprobación de Dirección.» |
| RN-28 (nueva) | Agregar | «El asistente de IA es opcional y solo sugiere. No modifica afinidad, respaldo, aprobaciones, participación ni constancias; una sugerencia solo tiene efecto cuando una persona autorizada la acepta y la guarda.» |
| RN-29 (nueva) | Agregar | «La aplicación móvil es exclusiva del Estudiante; los demás actores utilizan la aplicación web.» |

## 4. Sección 2.1.3 — Requerimientos funcionales

La V2 define 25 RF (§75). Correspondencia con las tablas actuales:

| Documento | V2 | Acción |
|---|---|---|
| RF 1 Registrar cuenta de estudiante | RF01 Provisionar e importar cuentas · RF02 Activar cuenta | **Reemplazar** por dos RF (abajo) |
| RF 2 Gestionar sesión | RF03 Acceso, sesión y recuperación | Cambiar: agregar recuperación de contraseña y cierre de sesiones |
| RF 3 Usuarios, roles y estados | RF04 Usuarios, roles fijos, estados y alcance docente | Cambiar nombre |
| RF 4 Catálogos y gamificación | RF05 Catálogos y configuración | Cambiar: habilidades con alias y validación del área |
| — | RF06 Onboarding y preferencias | **Agregar** |
| RF 5 / RF 6 Perfil | RF07 Perfil dinámico y evolución | Cambiar: sin nivel de habilidad; tecnologías respaldadas |
| RF 7 Gestionar actividades | RF08 Actividades y aprobación | Cambiar: agregar revisión de Dirección |
| RF 8, RF 9, RF 10 | RF09, RF10 | Sin cambios de fondo |
| RF 11 Evidencias y certificados | RF11 | Cambiar: certificados con tecnologías; validación automática de respaldo |
| RF 12 Constancia | RF12 | Cambiar según RN-11 |
| RF 13–RF 16 Proyectos | RF13–RF16 | Cambiar RF 14: cada integrante confirma rol, contribución y tecnologías usadas |
| RF 17 Afinidad | RF17 Afinidad y respaldo V3 | Cambiar según RN-14; agregar el respaldo y el desglose |
| RF 18 Recomendaciones | RF18 | Cambiar: reparto 35/25/20/10/10 y motivos visibles |
| RF 19 Contactos QR | RF19 Perfil compartible y QR · RF20 Contactos | Separar en dos; agregar canales de contacto |
| **RF 20 Comunicación privada** | — | **Quitar** |
| RF 21 Equipos | RF21 | Cambiar: moderación de nombres; el docente consulta necesidades de su alcance |
| **RF 22 Comunicación grupal** | — | **Quitar** |
| RF 23 Progreso y gamificación | RF22 | Renumerar |
| — | RF23 Trayectoria y CV | **Agregar**: CV en PDF con 3 plantillas y presentación asistida opcional |
| RF 24 Panel docente | RF24 Panel académico docente | Cambiar: resumen por semestre; quitar «habilidades declaradas» |
| RF 25 Reportes y tendencias | RF25 Analítica descriptiva | Cambiar: umbral de privacidad; métricas de Sociedad |

Texto propuesto para los RF nuevos o reemplazados:

- **RF01 Provisionar e importar cuentas.** Actor: Administrador. El sistema debe permitir crear cuentas institucionales con su rol (las de estudiante con semestre y código universitario) e importar el padrón desde una planilla validada fila por fila. Medio: panel web «Usuarios» e «Importar padrón». Salida: cuenta en estado pendiente de activación e invitación enviada al correo.
- **RF02 Activar cuenta institucional.** Actor: todos. El sistema debe permitir activar la cuenta con el enlace o el código recibido por correo (vigencia 48 h, 10 intentos) y elegir una contraseña que cumpla la política. Medio: pantalla «Activar cuenta» (web y móvil).
- **RF06 Gestionar bienvenida y preferencias.** Actor: Estudiante. El sistema debe guiar al estudiante en cinco pasos —confirmar datos institucionales, intereses por área y tecnología, disponibilidad, privacidad y un cuestionario opcional— y exigir los cuatro primeros antes de habilitar el resto del sistema.
- **RF20 Gestionar contactos y canales.** Actor: Estudiante. El sistema debe permitir solicitar, aceptar y deshacer contactos, configurar canales de contacto externos validados y anotar a cada contacto con alias, contexto y canal preferido.
- **RF23 Generar trayectoria y CV.** Actor: Estudiante. El sistema debe generar un PDF con las secciones elegidas y una de tres plantillas, con la advertencia de que no es un documento oficial; una presentación sugerida por IA solo se incluye si el estudiante la aceptó.

## 5. Sección 2.1.4 — Requerimientos no funcionales

La V2 define diez (§76). Agregar o ajustar:

| RNF V2 | Acción en el documento |
|---|---|
| RNF01 Usabilidad y accesibilidad | Ajustar RNF 1: agregar «sin parpadeo de ventanas emergentes» y «respeta la preferencia de movimiento reducido» |
| RNF02 Multiplataforma | Ajustar RNF 2: «la aplicación móvil es exclusiva del estudiante» |
| RNF03 Seguridad | Ajustar RNF 3: refresh rotatorio y revocable, límites de peticiones, CORS, cabeceras, archivos privados y protección SSRF |
| RNF04 Privacidad | **Agregar**: mínimo acceso, perfil público opcional, alcance docente, analítica agregada con umbral |
| RNF05 Rendimiento | Igual a RNF 4 actual (3 s / 5 s); evidencia: prueba de carga con k6 |
| RNF06 Integridad y trazabilidad | Igual a RNF 5; agregar auditoría |
| RNF07 Mantenibilidad | Igual a RNF 6; quitar «comunicación» de la lista de módulos |
| RNF08 Explicabilidad | **Agregar**: afinidad, respaldo, recomendaciones y sugerencias de IA muestran su procedencia |
| RNF09 Resiliencia de integraciones | **Agregar**: la caída de correo, GitHub, OCR o IA no destruye información ni detiene funciones centrales |
| RNF10 Portabilidad y configuración | **Agregar**: entornos reproducibles con Docker y variables de entorno documentadas |

## 6. Sección 2.1.5 — Casos de uso

| Elemento | Acción |
|---|---|
| Figura 2.1 y Tabla 2.10 «Registrar Cuenta de Estudiante» | Reemplazar por «Provisionar cuenta» (Administrador) y «Activar cuenta» (todos) |
| Figura 2.2 / Tabla 2.14 | Quitar «habilidades con nivel»; agregar caso «Completar bienvenida» |
| Figura 2.3 / Tabla 2.16 | Agregar caso «Revisar actividad» (Dirección) con flujos aprobar / observar / rechazar |
| Tabla 2.21 | Agregar como actor al responsable de la actividad y la condición «constancia habilitada» |
| Figura 2.6 y Tablas 2.29, 2.31 | **Quitar** «Gestionar Comunicación Privada» y «Gestionar Comunicación Grupal»; agregar «Gestionar canales de contacto» |
| Figura 2.7 | Agregar caso «Generar CV» |
| Figura 2.8 / Tabla 2.33 | Renombrar a «Consultar Panel Académico»; agregar «Consultar necesidades de equipo» |

## 7. Sección 2.2 — Elaboración

- **Figura 2.9 (contexto)**: agregar el proveedor de IA opcional (compatible con `/chat/completions`) y el servidor SMTP; quitar el chat.
- **Figura 2.10 (contenedores)**: la aplicación móvil solo con el actor Estudiante.
- **Figura 2.11 (componentes)**: agregar los módulos `ai`, `help` y la revisión dentro de `activities`; retirar `messaging`.
- **Figura 2.12 (clases)**: quitar `Conversation`, `ConversationMember` y `Message` del modelo activo (se conservan como historia) y `StudentSkill` con nivel; agregar `StudentSkillInterest`, `ActivityReview`, `ActivityGamificationRule`, `ExternalCertificateSkill`, `StudentContactChannel`, `ContactNote`, `AiAssistanceRun`; agregar a `Activity` el estado de revisión y a `ProjectMember` el indicador de responsable.
- **Secuencias**: rehacer 2.13 (registro → provisión y activación), 2.17 (perfil → bienvenida), 2.19 (agregar envío y revisión), 2.24 (emisor y autorizante), 2.29 (afinidad V3); **quitar 2.32 y 2.34** (chat).

## 8. Sección 2.3 — Construcción

- **Figura 2.38 (despliegue)**: agregar el contenedor de PostgreSQL con el puerto por `POSTGRES_PORT`, el proveedor de IA opcional y el SMTP.
- **Figura 2.39 (paquetes)**: igual que componentes.

## 9. Para el capítulo de pruebas

Evidencia disponible para citar: 19 suites contra la API real (1406 comprobaciones, 0 fallos), 33 pruebas unitarias, 22 comprobaciones de navegador con Playwright, k6 cumpliendo RNF05 (CRUD p95 1,76 s; reportes p95 0,86 s), OWASP ZAP sin alertas de riesgo y SonarQube sin bugs. Detalle en `docs/SEGURIDAD_V2.md` y `docs/V2_REPORTE_BATCHES.md`. Pendientes declarados: prueba en emulador Android con Maestro y evaluación SUS con usuarios.
