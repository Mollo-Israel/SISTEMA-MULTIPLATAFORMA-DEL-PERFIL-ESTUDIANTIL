# Cambios para alinear el documento de grado con el cierre V3.2

**Documento revisado:** `Documento_Proyecto_Grado_Valdivia_Mollo_v2 (1).docx`.

**El `.docx` no se modificó.** Su SHA-256 sigue siendo `bf5c0fb860e97e5b…`, el mismo de la copia de respaldo `docs/respaldo-documento/Documento_Proyecto_Grado_v2_RESPALDO_2026-10-07_V3.docx`. Antes de editarlo a mano, haga otra copia con la fecha del día.

**Cómo se usa:**
- Se aplica **después** de [`CAMBIOS_DOCUMENTO_GRADO_V2.md`](CAMBIOS_DOCUMENTO_GRADO_V2.md) y [`CAMBIOS_DOCUMENTO_GRADO_V3.md`](CAMBIOS_DOCUMENTO_GRADO_V3.md), que siguen vigentes.
- Aquí está solo lo que el cierre V3.2 agrega o corrige.
- Misma convención: **Quitar** / **Cambiar** / **Agregar**.

---

## 1. Resumen de diferencias con la guía V3

| Tema | Guía V3 | Software tras el cierre V3.2 |
|---|---|---|
| Afinidad | Motor V4 | **Motor V5**: cada experiencia suma en el área de su **contexto explícito** (la actividad, el área elegida para cada tecnología del proyecto o de la credencial). Ya no se infiere el área por etiquetas ni por texto. |
| Etiquetas de área | Palabras con que «el motor reconoce el área» | **Metadata** que describe el área y ayuda a sugerirla al clasificar habilidades nuevas. No puntúan. |
| Habilidades | Una sola área | **1 área principal + 0..N secundarias** (ej.: React en Desarrollo web y Móvil). |
| Actividades | Un área | **Varias áreas**, habilidades por área, responsables y contactos, modalidad con aula o enlace de reunión, enlaces, imagen, hora de fin, cancelación con motivo y **resultado configurable** (solo participación, constancia, certificado de la institución, credencial externa esperada). |
| Revisión | Aprobar, observar, rechazar | Además: **borrador privado**, **retirar el envío** y la aprobada **ya no la edita su creador**; solo Dirección la ajusta, con auditoría. |
| Recursos | Recursos sueltos | **Biblioteca** permanente con búsqueda, filtros y favoritos. El favorito orienta las recomendaciones (5 %) y no suma afinidad. |
| Certificado institucional | — | Lo **entrega** el responsable a quien tiene la participación confirmada, con el **emisor real**. Afinia no figura como autora. El currículo lo nombra así. |
| Docente | Panel con pestañas | Menú con **Actividades de la carrera** (las publicadas por todos) separadas de **Mis actividades** (las suyas). |
| Administración | Auditoría técnica | **Auditoría legible** (actor, módulo, acción, fecha, resultado) con filtros. La configuración del correo **sale del producto**: es de despliegue. |
| Archivos | — | Imágenes y documentos se piden **con la sesión**, en la web y en el móvil. |
| Móvil | — | Biblioteca y detalle completo de la actividad, con fechas en hora de Bolivia. |

---

## 2. Capítulo II

### 2.1.1 Actores

- **Docente:** Cambiar a «propone actividades académicas (**Mis actividades**) y consulta las **Actividades de la carrera** publicadas por Dirección, Sociedad y otros docentes, sin que pasen a ser suyas; …» (el resto, como en la guía V3).
- **Administración:** Agregar «consulta una auditoría legible de quién hizo qué, en qué módulo, cuándo y con qué resultado». Quitar cualquier mención a configurar el correo desde el sistema.
- **Estudiante:** Agregar «consulta la Biblioteca de recursos y guarda favoritos».

### 2.1.2 Reglas de negocio

| Regla | Acción | Texto propuesto |
|---|---|---|
| RN-14 | Cambiar | «La afinidad se calcula solo con trayectoria respaldada. Cada experiencia suma en el área de su contexto explícito: el área de la actividad, o el área en que el estudiante declaró haber usado cada tecnología en su proyecto o credencial. Una habilidad con varias áreas posibles no reparte puntos entre todas. Las etiquetas de área y los textos no asignan áreas.» |
| RN-30 (nueva) | Agregar | «Las etiquetas de un área son metadata para clasificar y sugerir; no suman puntaje ni afinidad. Una habilidad tiene un área principal y puede tener áreas secundarias.» |
| RN-31 (nueva) | Agregar | «Una actividad propuesta es privada mientras es borrador. Enviada, la revisa Dirección; quien la propuso puede retirar el envío. Aprobada, su creador ya no edita el contenido; solo Dirección la ajusta y cada cambio queda auditado.» |
| RN-32 (nueva) | Agregar | «Cada actividad declara qué genera al terminar: solo participación, constancia interna, certificado emitido por la institución (con su emisor real) o credencial externa esperada. Un certificado institucional se entrega solo a quien tiene la participación confirmada.» |
| RN-33 (nueva) | Agregar | «Los recursos de aprendizaje forman una biblioteca permanente; no son actividades. Guardarlos como favoritos orienta las recomendaciones y no suma afinidad.» |
| RN-34 (nueva) | Agregar | «La configuración del servidor de correo es parte del despliegue, no una función del producto.» |

### 2.1.3 / 2.1.4 Requerimientos

No cambia la numeración RF01–RF30 / RNF01–RNF10 de la guía V3. Ajustar el texto:
- **RF de actividades:** agregar varias áreas y habilidades, responsables y contactos, modalidad con aula o reunión, cancelación con motivo, resultado configurable y ciclo automático (cerrar inscripciones al empezar, finalizar al terminar).
- **RF de recursos:** biblioteca con búsqueda, filtros por área o habilidad y favoritos.
- **RF de auditoría:** consulta legible con filtros por módulo, acción, actor, fechas y resultado.
- **RNF de seguridad:** agregar «los archivos se sirven solo con sesión y a quien puede ver la entidad que los contiene; la superficie técnica del correo no existe en producción salvo modo técnico explícito».
- **RNF de usabilidad:** agregar «fechas y horas en la zona de la institución (America/La_Paz), sea cual sea la del dispositivo».

### 2.1.5 Casos de uso

Agregar:
- «Retirar el envío de una actividad»;
- «Entregar certificado institucional»;
- «Consultar Biblioteca y guardar favorito»;
- «Consultar auditoría».

Cambiar «Registrar proyecto» y «Registrar credencial externa» para que incluyan elegir el área de cada tecnología.

### 2.2 Elaboración (diagramas)

Los diagramas nuevos están en [`DIAGRAMAS_V3_2.md`](DIAGRAMAS_V3_2.md):
- revisión de una actividad propuesta;
- ciclo de la actividad;
- afinidad por contexto;
- archivos protegidos;
- auditoría;
- superficie del correo.

- **2.2.2 Clases:** agregar
  - `skill_area_relations` (áreas secundarias);
  - `activity_areas`, `activity_skills.academic_area_id`, `activity_responsibles` y `activity_contacts`;
  - en `activities`: `meeting_url`, `resource_links`, `image_file_id`, `cancellation_reason`, `outcome_policy` y `certificate_issuer`;
  - `project_skills.academic_area_id`;
  - `external_certificate_areas` y `external_certificate_skills.academic_area_id`;
  - `learning_resource_areas` y `learning_resource_favorites`;
  - en `internal_constancies`: `kind`, `issuer_name`, `stored_file_id` y `certificate_code`.
- **2.2.3 Secuencia y estados:** reemplazar el estado de la actividad de la guía V3 por los §1 y §2 de `DIAGRAMAS_V3_2.md`. Agregar el §3 (afinidad V5) junto a la descripción del motor.

### 2.3 Construcción

- Agregar un párrafo sobre el cierre: 22 batches (V3.2), cada uno con su reporte (`docs/V3_2_REPORTE_BATCHES.md`), migraciones con `up` y `down` probadas en ambos sentidos, y una regresión completa antes de cada commit.
- **Despliegue:** agregar las variables `ACTIVITY_LIFECYCLE_INTERVAL_MS`, `MAIL_DIAGNOSTICS_ENABLED` y `VITE_TECHNICAL_MODE`, y que el correo se configura solo en el servidor.

---

## 3. Capítulo III — Transición: pruebas y resultados

Actualizar las cifras de la estructura propuesta en la guía V3 con las del cierre. Ver [`V3_2_QA.md`](V3_2_QA.md): todas salen de corridas reales del 13/10/2026.

- **3.1 Estrategia:**
  - unitarias, **130**;
  - integración contra PostgreSQL real, **19 suites de API**;
  - navegador, Playwright en Chromium;
  - total de la regresión: **21 suites, 2040 comprobaciones, 0 fallos**.
- **3.2 Funcionales:** usar [`MATRIZ_TRAZABILIDAD_V3_2.md`](MATRIZ_TRAZABILIDAD_V3_2.md) junto con la V3.
- **3.3 Seguridad:** agregar
  - permisos negativos del cierre (borrador ajeno 404, aprobada bloqueada 409, auditoría y correo solo Admin);
  - archivos con sesión;
  - SSRF;
  - respaldos de GitHub, SMTP y OCR.
- **ZAP, k6:** las cifras de la guía V3 siguen siendo las últimas medidas. **No se repitieron en el cierre**, y así debe decirse.
- **3.5 Usabilidad:** sigue pendiente la prueba SUS con participantes. **No reportar resultados que no existan.**
- **3.6 Compatibilidad móvil:** en el cierre se verificaron `tsc`, `expo-doctor` (18/18) y la compilación Android. El recorrido en un teléfono no se hizo en esta etapa.
