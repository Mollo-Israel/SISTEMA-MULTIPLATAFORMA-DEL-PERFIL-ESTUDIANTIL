# Cambios para alinear el documento de grado con Afinia V3

**Documento revisado:** `Documento_Proyecto_Grado_Valdivia_Mollo_v2 (1).docx`.
- Capítulo 2: 2.1 Inicio, 2.2 Elaboración, 2.3 Construcción.
- Todavía **no tiene capítulo 3**.

**El `.docx` no se modificó.** Antes de revisarlo se hizo una copia:
- Copia: `docs/respaldo-documento/Documento_Proyecto_Grado_v2_RESPALDO_2026-10-07_V3.docx`.
- SHA-256 igual al original (`bf5c0fb8…`).

**Cómo se usa esta guía:**
- Se aplica **después** de [`CAMBIOS_DOCUMENTO_GRADO_V2.md`](CAMBIOS_DOCUMENTO_GRADO_V2.md), que sigue vigente.
- Aquí está solo lo que la V3.1 agrega o cambia.
- Convención, la misma de V2: **Quitar** = el software ya no lo hace; **Cambiar** = lo hace distinto; **Agregar** = existe y el documento no lo menciona.

---

## 1. Resumen de diferencias con el documento

| Tema | Documento actual | Software V3 |
|---|---|---|
| Alta de cuentas | Registro público (RF 1) | Provisión institucional y activación por correo (ya en la guía V2) |
| Proyectos | Un estado | **Borrador → Activo**: para activarse exige áreas, tecnología del catálogo, repositorio público, evidencia e integrantes confirmados. Respaldo: Declarado → Con respaldo → Corroborado → Revisado. |
| Repositorio | No figura | Corroboración con GitHub: lenguajes y manifiestos, caché con ETag, cuota. Nunca se descarga el código. |
| Afinidad | Usa lo declarado | **Motor V4**: solo proyectos corroborados o revisados, participaciones confirmadas y credenciales corroboradas. El borrador y lo declarado suman 0. |
| Recomendaciones | Por afinidad | **40/30/15/10/5** sin afinidad: intereses, áreas a mejorar, tecnologías de interés, orientación confirmada y lo que guardó. «No me interesa» baja lo parecido sin tocar el perfil. |
| Credenciales externas | Se adjuntan | Validación escalonada: dominio oficial, URL, QR, Open Badge, emisor; señalada si hay contradicción; revisión manual excepcional de Dirección. |
| Notificaciones | No figura | **Centro de notificaciones** con no leídas, deduplicación y recordatorios de actividades (día antes y horas antes). |
| Equipos | Chat grupal | **Necesidades con semestres objetivo**, postulaciones y aceptar o rechazar con un motivo predefinido. Sin chat. |
| Trayectoria y CV | Progreso | **Mi trayectoria** con niveles; **currículo en dos niveles** (secciones e ítems elegibles) con descargo. |
| Paneles | Paneles separados | Docente: un panel con pestañas. Dirección: Inicio + Analítica (Panorama, Afinidad, Participación, Demanda, Evolución). Sociedad: Inicio y Métricas filtrables. Administración: Inicio. |
| Requisitos | 25 RF, 6 RNF | **30 RF, 10 RNF** (§69, §70) |

---

## 2. Sección 2.1.1 — Actores (agregar a lo de V2)

- **Estudiante:** agregar «recibe notificaciones, postula a necesidades de equipo de su semestre, consulta su trayectoria con el nivel de respaldo de cada cosa y arma un currículo eligiendo secciones e ítems concretos».
- **Docente:** agregar «consulta un panel académico con pestañas por semestre, estudiantes, proyectos visibles, actividades y necesidades de equipo; su retroalimentación eleva un proyecto a “revisado”».
- **Director de Carrera:** agregar «decide la revisión manual excepcional de credenciales y consulta la analítica de la carrera (panorama, afinidad, participación, demanda y evolución)».
- **Sociedad Científica:** agregar «consulta participantes y métricas de sus actividades con filtros y comparación entre periodos».
- **Administrador:** agregar «consulta un inicio operativo (cuentas por rol, pendientes, padrón, auditoría y modo de correo)».

## 3. Sección 2.1.2 — Reglas de negocio

| Regla | Acción | Texto propuesto |
|---|---|---|
| RN-09 | Cambiar | «Las evidencias de un proyecto se registran dentro del proyecto (capturas, documentación, repositorio y demo). No existe una bandeja genérica que mezcle actividades, proyectos y certificados.» |
| RN-10 | Cambiar | «Una credencial externa se valida en niveles —declarada, con respaldo o corroborada— según señales verificables (dominio oficial, código QR, Open Badge, emisor). Si contradice la referencia de la oportunidad queda señalada y no suma. Dirección puede revisarla manualmente de forma excepcional, con motivo registrado.» |
| RN-12 | Cambiar | «Un proyecto se guarda como borrador y se activa cuando cumple lo mínimo: áreas, una tecnología del catálogo, repositorio público, una evidencia de funcionamiento e integrantes confirmados. Su respaldo crece de declarado a corroborado o revisado.» |
| RN-14 | Cambiar | «La afinidad se calcula solo con trayectoria respaldada: participaciones confirmadas, proyectos activos corroborados o revisados y credenciales corroboradas. Lo declarado, los borradores, los puntos y las insignias no suman.» |
| RN-16 | Cambiar | «Las recomendaciones priorizan lo que el estudiante quiere explorar o mejorar (40 % intereses, 30 % áreas a mejorar, 15 % tecnologías de interés, 10 % orientación confirmada, 5 % lo que guardó), sin usar la afinidad para encasillarlo. “No me interesa” reduce lo parecido y no modifica el perfil.» |
| RN-18 y RN-20 | Quitar | Comunicación privada y grupal (chat retirado; ya en la guía V2). |
| RN-19 | Cambiar | «Un estudiante publica una necesidad de equipo con objetivo, semestres objetivo, áreas, habilidades faltantes y cupos. Solo la ven y postulan estudiantes de esos semestres. El responsable acepta o rechaza con un motivo predefinido; al completarse los cupos la necesidad se cierra.» |
| RN-21 | Cambiar | Agregar: «No se otorgan puntos por autodeclaración, por proyectos en borrador, por subir archivos ni por aceptar contactos. Las recompensas las entrega la Universidad.» |
| RN-28 (nueva) | Agregar | «El sistema notifica los hechos relevantes (participación confirmada, invitaciones, postulaciones, retroalimentación, credenciales) sin repetir la misma alerta. Recuerda una actividad a quienes se inscribieron el día antes y unas horas antes, y una sola vez a los interesados.» |
| RN-29 (nueva) | Agregar | «El currículo solo afirma lo verificable: proyectos activos corroborados o revisados, participaciones confirmadas y credenciales corroboradas. Lo demás permanece en la trayectoria con su nivel y no se ofrece. El documento incluye el descargo: “Documento generado a partir de información registrada y respaldada en Afinia. No constituye historial académico oficial, certificación institucional ni acreditación profesional de competencias.”» |

## 4. Sección 2.1.3 — Requerimientos funcionales (25 → 30)

Se reemplaza la lista por la de §69, conservando el formato de tabla (ID, Actores, Nombre, Descripción, Medio, Entrada, Salida).

| Documento actual | V3 | Acción |
|---|---|---|
| RF 1 Registrar cuenta de estudiante | RF01 Provisionar e importar cuentas | Cambiar (actor: Administrador) |
| — | RF02 Activar y recuperar cuenta | Agregar |
| RF 2 Gestionar sesión | RF03 Gestionar sesión | Cambiar el número |
| RF 3 Usuarios, roles y estados | RF04 Usuarios y alcance académico (semestres del docente) | Cambiar |
| RF 4 Catálogos y criterios | RF05 Taxonomía; los criterios pasan a RF26 | Cambiar |
| RF 5, RF 6 Perfil | RF06 Onboarding y perfil; RF27 Trayectoria y perfil | Cambiar |
| RF 7, RF 8 Actividades | RF07 Oportunidades internas y externas (con revisión de Dirección) | Cambiar |
| RF 9, RF 10 Inscripción y asistencia | RF08 Participación interna | Cambiar |
| RF 12 Constancia | RF09 Resultados internos | Cambiar |
| — | RF10 Oportunidad externa | Agregar |
| RF 11 Evidencias y certificados | RF11 Credencial histórica; RF12 Validar credencial; RF18 Evidencias de proyecto | Dividir |
| RF 13, RF 15 Proyecto y portafolio | RF13 Gestionar proyecto | Cambiar |
| RF 14 Integrantes | RF14 Equipo de proyecto; RF15 Contribución individual | Dividir |
| — | RF16 Corroborar repositorio GitHub; RF17 Verificar demo; RF19 Calcular respaldo | Agregar |
| RF 16 Retroalimentación | Dentro de RF19 (eleva a revisado) y RF29 | Cambiar |
| RF 17 Afinidades | RF20 Afinidad V4; RF21 Support | Dividir |
| RF 18 Recomendaciones | RF22 Generar recomendaciones | Cambiar |
| — | RF23 Gestionar notificaciones | Agregar |
| RF 19 Contactos QR | RF24 Contactos y QR (sin chat) | Cambiar |
| RF 20 Comunicación privada | — | Quitar |
| RF 21 Equipos | RF25 Necesidades y equipos (postulaciones) | Cambiar |
| RF 22 Comunicación grupal | — | Quitar |
| RF 23 Progreso y gamificación | RF26 Gamificación | Cambiar |
| — | RF28 Currículo seleccionable | Agregar |
| RF 24 Panel docente | RF29 Panel docente (alcance y drill-down) | Cambiar |
| RF 25 Reportes y tendencias | RF30 Analítica institucional (Dirección y Sociedad) | Cambiar |

El detalle de cada RF (módulo, rutas, pantalla y prueba) está en [`MATRIZ_TRAZABILIDAD_V3.md`](MATRIZ_TRAZABILIDAD_V3.md). Sirve para las columnas «Medio», «Entrada» y «Salida».

## 5. Sección 2.1.4 — Requerimientos no funcionales (6 → 10)

| Documento actual | V3 |
|---|---|
| RNF 1 Interfaces claras | RNF01 Usabilidad (pestañas, errores por campo, etiquetas, 375 px) |
| RNF 3 Acceso y privacidad | RNF02 Seguridad y RNF03 Privacidad (separadas) |
| RNF 5 Integridad y trazabilidad | RNF04 Integridad |
| — | **RNF05 Explicabilidad** (afinidad, respaldo, recomendaciones y validación muestran su porqué) |
| — | **RNF06 Resiliencia** (GitHub, SMTP, URL e IA no derriban el núcleo) |
| RNF 6 Estructura modular | RNF07 Mantenibilidad |
| — | **RNF08 Configuración** (`.env`, migraciones con `up` y `down`) |
| RNF 4 Tiempos de respuesta | RNF09 Rendimiento (validaciones asíncronas, caché, paginación; p95 ≤ 3 s) |
| RNF 2 Compatibilidad multiplataforma | Se conserva dentro de RNF01 y RNF07 (web y Android) |
| — | **RNF10 Veracidad** (el currículo y la IA no afirman lo que no está respaldado) |

## 6. Sección 2.1.5 — Casos de uso

- **Quitar:** «Enviar mensaje privado» y «Enviar mensaje grupal».
- **Agregar:**
  - «Consultar notificaciones» (todos los actores).
  - «Postular a necesidad de equipo» y «Responder postulación» (Estudiante).
  - «Activar proyecto» (Estudiante; incluye «Verificar repositorio»).
  - «Construir currículo» (Estudiante; incluye «Seleccionar ítems elegibles»).
  - «Revisar credencial manualmente» (Director).
  - «Consultar analítica» (Director: Panorama, Afinidad, Participación, Demanda, Evolución).

## 7. Sección 2.2 — Elaboración (diagramas)

Los diagramas actualizados, en Mermaid, están en [`DIAGRAMAS_V3.md`](DIAGRAMAS_V3.md). Se exportan como imagen para el `.docx`.
- **2.2.1.2 Contenedores / 2.2.1.3 Componentes:** usar el §1 (arquitectura). Agregar los módulos `notifications`, `collaboration` (necesidades y postulaciones), `validation`, `trajectory`, y GitHub como sistema externo con caché.
- **2.2.2 Clases:** agregar las entidades del §6:
  - `Notification`, `TeamApplication` y `team_needs.target_semesters`;
  - `ProjectArea` y `ProjectSkill`;
  - `GithubApiCache`;
  - `ExternalOpportunityValidationReference`.
  - Quitar `Conversation` y `Message` como funcionalidad (se conservan solo como datos históricos).
- **2.2.3 Secuencia:** agregar «Postulación a una necesidad» (§4) y «Construir currículo» (§5). Agregar los diagramas de estado de actividad (§2) y de proyecto (§3).

## 8. Sección 2.3 — Construcción

- **2.3.1 Despliegue:**
  - API NestJS y PostgreSQL 16 (Docker).
  - Web estática servida por Vite o Nginx.
  - App Android (Expo SDK 54, Hermes).
  - SMTP institucional o modo simulado.
  - GitHub API de solo lectura.
- **Agregar** un párrafo de construcción incremental: 24 batches V3, cada uno con un reporte, migraciones con `up` y `down`, una regresión completa (20 suites) y un commit propio (`docs/V3_REPORTE_BATCHES.md`).

---

## 9. Capítulo 3 (nuevo) — Transición: pruebas y resultados

El documento no tiene capítulo 3. Se propone esta estructura con material ya producido (todas las cifras salen de corridas reales; ver [`V3_QA_HARDENING.md`](V3_QA_HARDENING.md)).

**3.1 Estrategia de pruebas.** Pirámide:
- Unitarias de reglas puras: 99.
- Integración contra PostgreSQL real: 20 suites, más de 1 700 comprobaciones.
- Navegador: Playwright en Edge y Chrome.
- Móvil: contrato de la API más empaquetado Android.
- Rendimiento: k6.
- Seguridad dinámica: ZAP.

**3.2 Pruebas funcionales por requerimiento.** Tabla RF → prueba, tomada de `MATRIZ_TRAZABILIDAD_V3.md`.

**3.3 Pruebas de seguridad.**
- Permisos negativos (403 entre roles, 404 por id ajeno).
- ZAP activo: 683 URL, 118 reglas aprobadas, 0 fallos, 0 avisos.
- Auditoría de dependencias, con el riesgo residual y su mitigación.

**3.4 Pruebas de rendimiento.** Tabla de k6 antes y después:
- CRUD p95 de 3,94 s a 1,56 s; 0 % de errores.
- El hallazgo fue un listado sin paginar, y se explica cómo se corrigió.

**3.5 Pruebas de usabilidad.** Protocolo SUS con las siete tareas de §71. **Se aplica con participantes y se reportan sus resultados**; hoy solo está el protocolo.

**3.6 Compatibilidad.** Edge, Chrome, 375 px y Android. Lo no verificado (Firefox, Safari, iOS) se declara.

**3.7 Resultados y discusión.** Qué se cumplió de los objetivos específicos y qué quedó como trabajo futuro:
- notificaciones push;
- NestJS 11/12;
- Maestro en dispositivo;
- prueba SUS con usuarios.
