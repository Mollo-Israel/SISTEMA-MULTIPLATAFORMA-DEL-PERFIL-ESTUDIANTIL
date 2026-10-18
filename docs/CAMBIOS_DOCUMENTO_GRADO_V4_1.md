# Cambios para alinear el documento de grado con el cierre V4.1

**Documento revisado:** `Documento_Proyecto_Grado_Valdivia_Mollo_v2 (1).docx`.

**El `.docx` no se modificó.** Su SHA-256 sigue empezando por `bf5c0fb860e97e5b…`, igual que la copia de respaldo `docs/respaldo-documento/Documento_Proyecto_Grado_v2_RESPALDO_2026-10-07_V3.docx`. El contrato V4.1 (§22, BATCH 14) pide no alterar la tesis sin una solicitud. Antes de editarla a mano, haga otra copia con la fecha del día.

**Cómo se usa:**
- Se aplica **después** de `CAMBIOS_DOCUMENTO_GRADO_V2.md`, `…_V3.md` y `…_V3_2.md`, que siguen vigentes.
- Aquí está solo lo que agrega o corrige el cierre V4.1.
- Misma convención: **Quitar** / **Cambiar** / **Agregar**.

---

## 1. Resumen de diferencias con la guía V3.2

| Tema | Guía V3.2 | Software tras el cierre V4.1 |
|---|---|---|
| Actividades | Una imagen; responsable obligatorio siempre | **Hasta 5 imágenes** con carrusel. El borrador se guarda **sin responsable**: se exige al publicar, con fecha futura. **Tres pestañas**: internas académicas, internas extracurriculares y oportunidades externas. **Duplicar** una actividad. |
| Responsable asignado | Edita la actividad | Si la creó Dirección o Administración, el responsable **solo la opera** (asistencia, cierre, constancias): no cambia su contenido. |
| Asistencia | Se cierra al terminar | **FINISHED y el cierre del acta son distintos**: tras terminar, el responsable registra a los pendientes y luego «Cierra la asistencia». Una participación consolidada solo la corrige **Dirección o Administración**, con motivo, reconciliando constancia, puntos y trayectoria. |
| Recursos | Los agrega el personal | El **docente propone** recursos para sus semestres y **Dirección los revisa**. La Biblioteca muestra solo lo publicado y tiene la pestaña «**Para ti**», por intereses y metas declaradas, con su motivo. Un favorito **no es señal**. |
| Recomendaciones | Favoritos y «Guardar» suman el 5 % | Ese 5 % sale de **«Me interesa»** en otras actividades: explícito y reversible. «Guardar» es solo acceso rápido. Los motivos dicen «Coincide con tus intereses» o «Coincide con lo que quieres mejorar», y el puntaje se muestra como «N de 100», no como certeza. |
| Gamificación | Retos y recompensas del docente | **Sin retos ni recompensas** (los históricos se conservan). Los puntos salen de **criterios** que configuran Dirección o Administración, más **extras de temporada** con fechas. El **docente propone** puntos por un proyecto con respaldo y **Dirección decide** en una bandeja única. El estudiante ve su **saldo en el Perfil**. Los puntos nunca tocan la afinidad. |
| Credenciales | Respaldo (DECLARED…CORROBORATED) | Dos ejes: **estado de validación** (AUTO_VERIFIED, MANUAL_REVIEW_REQUIRED, MANUALLY_VERIFIED, INCONCLUSIVE, REJECTED) **aparte del respaldo**. La revisión manual exige un **método y una prueba externa independiente**; si no la hay, queda **inconclusa**. Credly, Cisco y Huawei se declaran **sin verificador integrado**. |
| Proyectos | Activación con repositorio y evidencia | Para activar: **una tecnología por cada área alegada**. El proyecto **se edita desde la web** (título, repositorio, áreas y tecnologías), también si está activo; quitar una tecnología confirmada pide **reconfirmación**. |
| Respaldo del proyecto | Una evidencia de contexto bastaba para CORROBORATED | CORROBORATED exige una señal técnica más una **fuente independiente** (demo accesible u otra persona que confirma su contribución), más **atribución**. Una captura apoya, pero no corrobora. El **mismo repositorio** en el proyecto de otra persona no se atribuye. Se hizo un recálculo auditado con informe antes/después. |
| GitHub | Corrobora tecnologías | Sus señales son **sugerencias con procedencia** («requirements.txt (fastapi)»); el estudiante las acepta con su área. Una «**Tecnología no catalogada**» se pide a Administración: nada se crea solo. Un 404 no se interpreta como «privado». |
| Equipos | Se invita a todo el equipo | El equipo se elige con **búsqueda** y sus miembros son **candidatos**. Se puede **excluir a alguien de ese proyecto con motivo**, sin sacarlo del equipo y con un aviso respetuoso. La confirmación es individual. |
| Privacidad | Cinco visibilidades | Nombres claros, con la aclaración de que es el registro en Afinia, **no el repositorio de GitHub**. **Un borrador nunca se publica.** El QR vive en **Mi perfil → Visibilidad**. |
| Currículo | Todo lo elegible marcado por omisión | **Nada entra solo**: el estudiante marca los ítems elegibles. |

---

## 2. Capítulo II

### 2.1.1 Actores

- **Docente:** Agregar «propone recursos para sus semestres y propone puntos por un proyecto de un estudiante de su alcance; Dirección decide».
- **Director de carrera:** Agregar «revisa en una bandeja única actividades, recursos y propuestas de puntos; configura los criterios de puntos; corrige participaciones consolidadas con motivo; verifica credenciales solo con prueba externa».
- **Administración:** Agregar «soporte excepcional y auditado en la revisión de credenciales y en la corrección de participaciones; decide los pedidos de tecnologías no catalogadas; ejecuta el recálculo auditado del respaldo».
- **Estudiante:** Cambiar «canjea recompensas» por «consulta su saldo y su historial de puntos». Agregar «acepta o descarta sugerencias de tecnologías detectadas en su repositorio».

### 2.1.2 Reglas de negocio (agregar)

- **RN-V41-1:** Un borrador nunca se publica, sin importar la visibilidad elegida.
- **RN-V41-2:** CORROBORATED exige una fuente independiente. Readiness no equivale a corroborado.
- **RN-V41-3:** Una credencial solo se verifica manualmente con una prueba externa independiente del archivo.
- **RN-V41-4:** No hay puntos libres: los puntos salen de un criterio configurado, y los de un proyecto, de una propuesta aprobada.
- **RN-V41-5:** Excluir a alguien de un proyecto exige motivo y no toca su equipo.
- **RN-V41-6:** El responsable asignado por una autoridad solo opera la actividad.

---

## 3. Capítulo III (diseño)

- **Modelo de datos — agregar:**
  - `activity_images`;
  - `gamification_proposals`;
  - `skill_requests`;
  - columnas de vigencia y bono en `gamification_criteria`;
  - estado y cierre de asistencia en `activities`;
  - revisión en `learning_resources`;
  - método y prueba en `validation_records`;
  - `provenance` en `project_skills`;
  - `dismissed_suggestions` en `projects`.
- **Casos de uso — agregar:**
  - «Cerrar asistencia»;
  - «Corregir participación (excepcional)»;
  - «Proponer recurso» y «Revisar recurso»;
  - «Proponer puntos» y «Decidir propuesta»;
  - «Verificar credencial con prueba externa»;
  - «Aceptar sugerencia de GitHub»;
  - «Pedir tecnología no catalogada»;
  - «Excluir integrante con motivo».
- **Quitar:** los casos de uso «Crear reto», «Ofrecer recompensa» y «Canjear».

## 4. Capítulo IV (pruebas)

**Agregar:** el cierre V4.1 terminó con **22 suites E2E** y **141 pruebas unitarias** en verde. La traza de cada ajuste está en `docs/MATRIZ_TRAZABILIDAD_V4_1.md`, y el detalle por batch en `docs/V4_1_REPORTE_BATCHES.md`.
