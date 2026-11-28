# Afinia V7.1 — Resumen de lo implementado y decisiones pendientes

- **Contrato:** `docs/contratos/AFINIA_CONTRATO_FINAL_V7_1_CLAUDE_CODE_2026-11-25.md`
- **Rama:** `feature/afinia-v7-cierre-final`, desde `141d768`. La base quedó protegida con la etiqueta `base-v7-1-cierre-final`.
- **Fecha de cierre:** 27/11/2026.
- **Informe de cada batch:** `docs/qa/QA_V7_<n>.md`. El cierre completo está en `docs/qa/QA_V7_13.md`.

## 1. Estado en una línea

Los 14 batches (V7-0 a V7-13) están implementados, probados y cada uno tiene su commit. La matriz de aceptación §15 tiene 119 escenarios:

| Resultado | Escenarios |
|---|---|
| PASS | 116 |
| BLOCKED | 1 (M05, depende de D06) |
| NE (no ejecutado) | 2 (I08 y H05) |
| FAIL | 0 |

**El contrato no se declara cerrado del todo.** La §18 lo impide mientras queden decisiones pendientes del equipo, que se listan en la sección 4.

---

## 2. Qué se implementó en cada batch

| Batch | Commit | Qué se hizo |
|---|---|---|
| **V7-0** | `4b93e8a` | Auditoría GAP (`docs/qa/AUDITORIA_GAP_AFINIA_V7.md`) y plan de batches. Solo documentación: rama base protegida, línea base de pruebas, hallazgos por sección y decisiones D01–D08. |
| **V7-1** | `a794060` | **Filtros de estado.** Cada filtro elige un solo estado y se aplica en el servidor antes de paginar. El filtro queda en la URL, así que sobrevive a recargar y volver atrás. Detalle:<br>• Usuarios: «Activas» por omisión, más pendientes, suspendidas, inactivas y todas.<br>• Catálogos y autonomía tienen el mismo filtro. Solo Administración ve lo dado de baja.<br>• Actividades separa «Estado de la actividad» de «Revisión». |
| **V7-2** | `058d580` | **Aprobar publica y abre.** Aprobar una propuesta la publica y abre las inscripciones en una sola transacción. Si la actividad ya empezó o venció, responde 409. Además:<br>• Administración ve en solo lectura las propuestas en revisión.<br>• La asistencia se puede corregir hasta que se cierra la lista.<br>• D04: «Sin resultado» no suma trayectoria, afinidad ni exportación. |
| **V7-3** | `d7a002b` | **Credenciales externas.**<br>• Vinculada: los datos salen de la oportunidad y el archivo es obligatorio.<br>• Histórica: va directo a Dirección, sin procesamiento automático.<br>• Fases técnicas: la 1 compara textos sin porcentaje y la 2 es la de V9.<br>• Solo Dirección carga el certificado modelo, y queda versionado.<br>• Un título común ya no se marca como duplicado.<br>• Migración aditiva `1780900000000`. |
| **V7-4** | `3abd8d1` | **Revisión humana obligatoria (D01).** Solo Dirección decide; Administración consulta y la API le responde 403. Además:<br>• Dirección puede observar (pedir corrección, con reenvío) o aprobar revisando el documento.<br>• La máquina ya no corrobora sola.<br>• Una credencial pendiente, observada o rechazada no suma nada.<br>• Migración aditiva `1780910000000`. |
| **V7-5** | `0ea5753` | **Certificado institucional (D05).**<br>• General: un archivo común que se entrega automáticamente, sin duplicar, a los confirmados cuando la actividad termina.<br>• Individual: un archivo por estudiante.<br>• Reemplazar un certificado exige un motivo y queda versionado.<br>• «Ver certificado» abre con la sesión del estudiante.<br>• Migración aditiva `1780920000000`. |
| **V7-6** | `07beabe` | **Se retiran los registros verificables propios de Afinia.** Las rutas responden 410 neutro y `/verificar` muestra un aviso. Se quitaron los menús en web y móvil. Los datos históricos se conservan. |
| **V7-7** | `c20eacb` | **Proyectos.**<br>• Una señal técnica detectada antes de declarar la tecnología también la respalda.<br>• Las tecnologías se reconocen por alias exactos, nunca por subcadena.<br>• La lista de requisitos es la misma en web y API y se ve completa.<br>• Se quitó «Abrir» en las evidencias. |
| **V7-8** | `dc2e53f` | **Afinidad explicada.**<br>• «Cómo se calcula» explica el puntaje en palabras, con los números reales.<br>• Las intensidades se muestran como Mucho, Bastante o Un poco.<br>• Las tecnologías respaldadas siguen la misma regla que la afinidad.<br>• La fórmula real del recomendador está en `docs/AFINIDAD_Y_RECOMENDADOR_V7.md`, con los hallazgos REC-H1 a REC-H4. |
| **V7-9** | `fe0ff81` | **Filtros por persona.** Se puede filtrar por quién publicó (Biblioteca) y por responsable (Proyectos de la carrera). La búsqueda por nombre ignora tildes y orden. |
| **V7-10** | `b3c1569` | **Contactos y equipos.**<br>• Los contactos se buscan por nombre y apellidos, ya no por identificador.<br>• El perfil compartible ofrece «Solicitar contacto».<br>• Equipos tiene las vistas «Para ti», «Todas», «Mis necesidades» y «Mis equipos».<br>• El móvil tiene «Escanear QR» con cámara y solo acepta enlaces de Afinia. |
| **V7-11** | `54e5b36` | **Inicio de Administración.** Tarjetas con «Detalles» de solo lectura: el total real y los últimos 10. Cada tarjeta falla por separado y «Ir a gestionar» abre la página con el filtro puesto. El menú queda ordenado en Identidad, Catálogos, Gestión y Seguimiento. |
| **V7-12** | `4c915a4` | **Inicio de Dirección.** Diez tarjetas, cada una con el mismo alcance que su módulo de Dirección, y destinos filtrados (`?tipo=`, `?actividad=`…). «Credenciales en revisión» cuenta lo mismo que la bandeja. |
| **V7-13** | `cfebf08` | **Regresión integral y cierre.** Incluye la matriz de aceptación por ID, la matriz real de permisos de la API (312 rutas) y las diferencias con el documento de grado. La evidencia está en `docs/qa/evidencias-v7-13/`. |

### Pruebas de la corrida final (V7-13)

| Batería | Resultado |
|---|---|
| Unitarias (Node) | 252 / 252 |
| Jest + SuperTest | 197 / 197 |
| e2e de la API | Sin fallas nuevas. Quedan 14 fallas anteriores a V7, fuera del contrato: V41.10.1–2, V3.2.15, 10 de `e2e-v3-2` y B6.47 |
| e2e de la web | 79, 63, 47 y 106 aprobadas, 0 fallidas |
| Playwright (3 navegadores) | 54 / 54 |
| Newman | 34 solicitudes, 70 aserciones, 0 fallas |
| Seguridad | 79 / 79 y 7 / 7 |
| Maestro (emulador Android 15) | 3 / 3 |
| `tsc` de API, web y móvil | Sin errores |

---

## 3. Lo que no se implementó o no se pudo probar

| Ítem | Motivo |
|---|---|
| **Corrección del recomendador (REC-H1 a REC-H4)** | Cambia puntajes, así que necesita la decisión D06. M05 queda BLOCKED. |
| **Migración en la base de desarrollo** | No se tocó la base de desarrollo sin autorización. Las migraciones solo se aplicaron en `afinia_test`. |
| **Recálculo de afinidad D04 en desarrollo** | Afecta a 2.116 estudiantes (ver `docs/qa/IMPACTO_D04_AFINIDAD.md`). Espera autorización. |
| **I08: caída del almacenamiento** | No se simuló. |
| **H05** | No aplica, por D07: el padrón original no se guarda. |
| **T04 y R05 en un teléfono físico** | Solo se probaron en el emulador. |
| **k6, ZAP y SonarQube** | No se repitieron. Siguen valiendo las corridas del capítulo III. |
| **Página de estudiantes para Dirección** | No existe. La tarjeta lleva a Analítica › Participación. |
| **Fallas e2e anteriores a V7** | Están fuera del alcance del contrato. |
| **Riesgos de seguridad R1 a R12** del capítulo III (sin 2FA, CSP en el hosting…) | Sin cambios en V7. |

---

## 4. Decisiones que debe tomar el equipo

| # | Decisión | Opciones | Qué pasa mientras no se decida |
|---|---|---|---|
| 1 | **D06 — Recomendador** | (a) Corregir REC-H1 a REC-H4 (ver abajo) con una nueva versión de reglas y comparación antes/después. (b) Adoptar la propuesta §10.3. (c) Dejarlo como está y explicarlo en la defensa. | Se mantiene la fórmula vigente y M05 queda BLOCKED. |
| 2 | **Migrar la base de desarrollo** | Correr `npm --prefix api run migration:run`. Las tres migraciones son aditivas. | En desarrollo faltan las columnas de V7-3 a V7-5. |
| 3 | **Recálculo D04** | Autorizar `POST /affinity/recalculate-all` en desarrollo. | Las actividades «Sin resultado» siguen sumando en los puntajes ya guardados. |
| 4 | **APK y QR en un teléfono físico** | Generar el APK (`npm run mobile:apk`) y probar «Escanear QR». | T04 y R05 quedan probados solo en el emulador. |
| 5 | **¿Una credencial «aprobada» da tecnologías respaldadas?** | Hoy no: aprobar revisando solo el documento no suma afinidad ni da chips. Cambiarlo es una línea en `backed-skills.service.ts`, sin migración. | Queda la opción conservadora. |
| 6 | **¿Los proyectos archivados siguen contando?** | Hoy sí, como trayectoria terminada. Excluirlos cambia también la afinidad. | Siguen contando. |
| 7 | **¿Dirección necesita una página propia de estudiantes?** | Crearla en un batch nuevo, o dejar el acceso por Analítica. | La tarjeta lleva a Analítica. |
| 8 | **¿Se actualiza el documento de grado?** | Aplicar las diferencias de la sección 5. | El documento describe el comportamiento anterior en RF 20 y RF 13, y las cifras de Jest de antes. |
| 9 | **Fusionar la rama** | Abrir un PR y fusionar `feature/afinia-v7-cierre-final` en `main`. | La rama ya está en el remoto, pero sin fusionar. |

### Hallazgos del recomendador (decisión D06)

- **REC-H1:** el test de orientación cuenta dos veces. Un área confirmada recibe el interés (hasta 40) y además +10 por orientación.
- **REC-H2:** una tecnología de nombre compuesto coincide por una sola palabra.
- **REC-H3:** el 10 % de «contexto» no suma puntos; el máximo real es 95. Esto es solo documental.
- **REC-H4:** el interés y la mejora de tecnologías comparten un techo de 15. Es coherente, pero conviene explicarlo en la defensa.

---

## 5. Diferencias con el documento de grado

El documento no se editó. La lista completa está en `docs/qa/QA_V7_13.md`, sección «Diferencias para el documento de grado».

**Capítulo II:**
- **RF 20:** la revisión de credenciales ya no es «excepcional». Toda credencial externa pasa por Dirección, y Administración solo consulta.
- **RF 13:**
  - Aprobar una propuesta la publica y abre las inscripciones.
  - Un docente con autonomía **no** publica actividades directamente.
- **Credenciales verificables:** Afinia ya no emite ni verifica registros propios.
- **QR:** el móvil ahora escanea el QR de un perfil, y los contactos se buscan por nombre.

**Capítulo III:**

| Ítem | Documento | Hoy |
|---|---|---|
| Jest | 14 suites, 120 casos | 18 suites, 197 casos |
| Gitleaks | 196 commits | 212 commits, con 1 falso positivo nuevo: una clave pública `did:key` |
| npm audit móvil | 26 | 25 |
| Maestro | 3 min 45 s | 3 min 36 s |

La evidencia que cita hoy el documento sigue intacta en `pruebas/`.
