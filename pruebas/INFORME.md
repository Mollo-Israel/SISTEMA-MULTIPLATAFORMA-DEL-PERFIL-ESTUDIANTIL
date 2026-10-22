# Informe de pruebas de calidad — Afinia

**Fecha de ejecución:** 21 de octubre de 2026
**Rama:** `feature/pruebas-calidad`
**Base:** documento *Investigación de herramientas de pruebas — Afinia* (§3 herramientas, §4 entorno, §6 evidencias)

Este informe resume qué pruebas se ejecutaron, con qué comandos, qué resultados dieron y dónde está cada evidencia. Todas las evidencias (reportes HTML, salidas de consola, JSON y capturas) están dentro de esta carpeta `pruebas/`, una subcarpeta por herramienta.

---

## 1. Resumen general

| # | Herramienta | Tipo de prueba | Resultado | Estado |
|---|---|---|---|---|
| 01 | Entorno aislado | Base `afinia_test` + API :3020 + web :5180 | Reconstruido desde cero con datos sembrados | ✅ Listo |
| 02 | Jest + SuperTest | Unitarias y de API (backend) | **30/30** pruebas aprobadas · cobertura de líneas 39,3 % | ✅ Aprobado |
| 03 | Playwright | E2E web en Chromium, Firefox y WebKit | **39/39** por navegador (117 ejecuciones) · 117 capturas | ✅ Aprobado |
| 04 | Postman + Newman | Pruebas de API por colección | **24** peticiones · **49/49** aserciones | ✅ Aprobado |
| 05 | Grafana k6 | Carga y rendimiento (RNF05) | Corrida 1 **FALLÓ** → defecto corregido → corrida 3 **aprobada** (p95 CRUD 167 ms) | ✅ Aprobado tras corrección |
| 06 | OWASP ZAP | Seguridad dinámica (pasivo + activo) | 118 reglas PASS · **0 FAIL · 0 WARN** · 4 alertas informativas | ✅ Aprobado |
| 07 | SonarQube | Análisis estático + cobertura | Quality Gate **PASSED** · 5 bugs, 1 vulnerabilidad menor | ✅ Aprobado (con observaciones) |
| 08 | Android Emulator + Expo + Maestro | Pruebas móviles | Flujos listos, **no ejecutados** (falta Android SDK en la PC) | ⏳ Pendiente |
| 09 | Tareas + SUS | Usabilidad con usuarios | Guía, plantillas y cálculo listos, **no ejecutados** (requiere personas) | ⏳ Pendiente |
| 10 | Suites propias del proyecto | Regresión completa | **2254 ok · 0 fallos** (22 suites) | ✅ Aprobado |

---

## 2. Entorno de pruebas aislado (§4) — `01-entorno/`

Las pruebas **nunca** se ejecutaron contra la base de desarrollo (`perfil_estudiantil`). Se creó un entorno separado y desechable:

| Elemento | Desarrollo | **Pruebas** |
|---|---|---|
| Base de datos | `perfil_estudiantil` | **`afinia_test`** |
| API | :3010 | **:3020** |
| Web | :5173 | **:5180** (build propio en `web/dist-pruebas`) |
| Archivos subidos | `uploads/` | `pruebas/01-entorno/almacenamiento-temporal/` (ignorado por git) |
| Correo | SMTP real | **`MAIL_TRANSPORT=console`**: no se envía ningún correo |

**Comandos:**

```bash
node scripts/pruebas/entorno.mjs reconstruir   # borra y recrea afinia_test, migra, siembra, puebla y ANALYZE
node scripts/pruebas/entorno.mjs api           # API de pruebas en :3020
node scripts/pruebas/entorno.mjs web           # web de pruebas en :5180
```

**Cuentas sembradas** (contraseña `Univalle2026*`): `ana.quispe`, `camila.flores` y `tomas.suarez` (estudiantes, `@est.univalle.edu`); `carlos.perez` (docente, semestres 1–4), `maria.gutierrez` (docente, 5–8), `jorge.vargas` (Dirección) y `lucia.fernandez` (sociedad), todos `@univalle.edu`. La contraseña del administrador se toma de `.env` y **está omitida en todas las evidencias**.

**Evidencia:** `reconstruccion.log` (contraseñas omitidas) y `web-pruebas.log`.

---

## 3. Jest + SuperTest (§3.1) — `02-jest-supertest/`

**Comando:** `npm run pruebas:jest` (ejecuta `jest --coverage` en `api/` y copia la cobertura a esta carpeta).

La aplicación NestJS se levanta completa en memoria (`Test.createTestingModule(AppModule)`) contra `afinia_test`, y SuperTest hace las peticiones HTTP sin abrir puertos.

| Archivo | Pruebas | Qué verifica |
|---|---|---|
| `unit/reglas-negocio.spec.ts` | 15 | Topes de afinidad, nivel de registro, respaldo de proyectos, preparación por área, estado de validación de credenciales, comparación de dominios |
| `api/autenticacion.spec.ts` | 5 | Login correcto, 401 genérico, 401 sin token, `profiles/me`, recuperación de contraseña con **la misma respuesta** exista o no la cuenta (no revela usuarios) |
| `api/autorizacion-alcance.spec.ts` | 6 | El docente solo ve estudiantes de **sus semestres**; fuera de su alcance recibe 403/404; un estudiante no entra a listados ni auditoría; el administrador sí |
| `api/integridad-negocio.spec.ts` | 4 | Un área de mejora no altera la afinidad; la trayectoria solo marca para el CV lo corroborado; detección de archivos duplicados; un archivo privado no se descarga sin sesión ni por otro usuario |

**Resultado:** **30 de 30 aprobadas** en unos 17 s.

**Cobertura** (`api/src`, sin migraciones ni semillas):

| Líneas | Sentencias | Ramas | Funciones |
|---|---|---|---|
| 39,32 % | 37,44 % | 30,28 % | 21,61 % |

Entre corridas la cobertura varía unas centésimas, porque algunos caminos dependen del tiempo. El análisis de SonarQube (§8) usó una corrida anterior con 39,43 % de líneas.

La investigación no fija una meta de cobertura total: el objetivo fue cubrir las reglas de negocio críticas y el control de acceso.

**Evidencias:** `reporte/reporte-jest.html`, `cobertura/index.html`, `coverage-summary.json`, `salida-consola.txt`.
**Capturas:** `capturas/01-reporte-jest.png`, `capturas/02-cobertura-resumen.png`.

---

## 4. Playwright (§3.3) — `03-playwright/`

**Comando:** `npm run pruebas:playwright` (configuración en `playwright.config.ts`, pruebas en `pruebas-e2e/`).

Se recorrió la web real (build de producción en :5180, conectada a la API de pruebas) con **tres motores**: Chromium, Firefox y WebKit (Safari). Cada paso guarda una captura de página completa.

| Archivo | Pruebas | Recorrido |
|---|---|---|
| `01-acceso.spec.ts` | 5 | Login, login con error, recuperación de contraseña, inicio del estudiante |
| `02-estudiante.spec.ts` | 14 | Bienvenida (onboarding), perfil, visibilidad y QR, actividades, proyectos, evidencias, afinidad, recomendaciones, biblioteca, trayectoria, puntos, currículo, equipos |
| `03-personal.spec.ts` | 17 | Docente (4), Dirección (5), sociedad (3) y administración (5), incluida la previsualización de una importación CSV con filas nuevas, conflictivas e inválidas (se descarta, no se aplica) |
| `04-negativos.spec.ts` | 3 | Sin sesión → login; estudiante sin acceso a administración; docente sin acceso a aprobaciones de Dirección |

**Resultado:** **39/39 en cada navegador**, 117 ejecuciones aprobadas en 7,8 min, sin errores de consola.

**Evidencias:** `reporte/index.html` (reporte HTML con las capturas adjuntas), `resultados.json`, `salida-consola.txt`.
**Capturas:** `capturas/chromium/`, `capturas/firefox/`, `capturas/webkit/` (39 cada una, ver índice en §13) y `capturas/00-reporte-playwright.png`.

---

## 5. Postman + Newman (§3.2) — `04-postman-newman/`

**Comando:** `npm run pruebas:postman` (`scripts/pruebas/newman.mjs`). Genera la colección y la ejecuta con Newman; la contraseña del administrador se lee de `.env` solo al ejecutar.

La colección `afinia.postman_collection.json` se puede **importar en Postman** junto con el entorno `afinia-pruebas.postman_environment.json`. Tiene 24 peticiones en 4 carpetas:

1. **Identidad:** login, sesión, recuperación.
2. **Estudiante:** perfil, actividades, afinidad, recomendaciones, trayectoria.
3. **Autorización (negativos):** sin token, rol equivocado, recurso ajeno.
4. **Dirección y administración.**

**Resultado:** **24 peticiones, 49 aserciones, 0 fallos.**

**Evidencias:** `reporte-newman.html`, `resultados-newman.json` (contraseña de administrador omitida), `salida-consola.txt`.
**Captura:** `capturas/01-reporte-newman.png`.

> No se tomaron capturas de la **interfaz gráfica de Postman** porque es una aplicación de escritorio. Si el documento las necesita, basta importar los dos JSON en Postman y presionar *Run collection*.

---

## 6. Grafana k6 — carga (§3.5) — `05-k6/`

**Comando:** `npm run pruebas:k6` (k6 en Docker, escenario `scripts/k6/carga-basica.js`).

**Umbrales (RNF05):** p95 ≤ 3 s en CRUD y login, p95 ≤ 5 s en reportes, menos del 1 % de errores. La carga sube hasta 25 usuarios virtuales.

Esta prueba cumple el ciclo completo que pide el §6: **FALLO → defecto → corrección → regresión**.

| Corrida | p95 CRUD | p95 login | p95 reportes | Peticiones | Tasa | Errores | Resultado |
|---|---|---|---|---|---|---|---|
| 1 — `corrida-1-fallo/` | **4520 ms** | 265 ms | 570 ms | 1227 | 19,7/s | 0 % | ❌ **FALLA** (supera 3 s) |
| 2 — `corrida-2-correccion/` | 214 ms | 206 ms | 94 ms | 4658 | 74,9/s | 0 % | ✅ Aprueba |
| 3 — `corrida-3-final/` | **167 ms** | **127 ms** | **70 ms** | 4970 | 80,5/s | **0 %** | ✅ **Aprueba** |

**Defecto encontrado:**

- **Síntoma:** el listado paginado de actividades (`GET /api/activities`) tardaba ~1,8 s por petición.
- **Causa:**
  1. Una base recién creada no tiene estadísticas del planificador de PostgreSQL. Sin ellas, el JOIN de 5 tablas que genera TypeORM elegía un plan malo: 1,6 s, frente a 25 ms después de `ANALYZE`.
  2. Además, una página de 30 filas cargaba sus relaciones con un único JOIN gigante.

**Corrección (dos partes):**

1. **Producto:** `api/src/activities/activities.service.ts`, en `listar()`. Para listas **paginadas** se carga cada relación en consultas separadas (`relationLoadStrategy: 'query'`), que bajan de ~1,7 s a ~26 ms.
   - Un primer intento aplicó esto a **todas** las listas y la regresión lo detectó: con 10 000 actividades sin paginar, la API quedaba al 100 % de CPU.
   - Por eso la versión final solo lo usa con página.
2. **Entorno:** `reconstruir` ejecuta `ANALYZE` después de poblar la base, como haría el mantenimiento automático de PostgreSQL en producción.

**Regresión tras la corrección:** suites propias **2254 ok / 0 fallos** (ver §11) y Playwright 39/39 × 3.

**Diagnóstico completo:** `DIAGNOSTICO.md`.
**Evidencias:** en cada corrida, `reporte-k6.html` (panel de k6), `resumen.json` y `salida-consola.txt`.
**Capturas:** `capturas/01-corrida-1-fallo.png`, `capturas/02-corrida-2-correccion.png`, `capturas/03-corrida-3-final.png`.

> **Observación (no es regresión):** los listados **completos** de personal (`/activities` y `/activities/managed` sin página) tardan ~4 s y pesan ~27 MB con 10 000 actividades. Es un comportamiento previo. Se recomienda paginarlos en una versión futura.

---

## 7. OWASP ZAP — seguridad (§3.6) — `06-zap/`

**Comando:** `npm run pruebas:zap` (o `node scripts/pruebas/zap.mjs --pasivo`).

- **Herramienta:** `zap-api-scan.py` en Docker.
- **Rutas:** las toma de la definición OpenAPI de la API (`/api/docs-json`).
- **Escaneo:** **pasivo + activo**. Es seguro porque el entorno es propio y desechable.
- **Sesión:** la de un estudiante sembrado (`tomas.suarez`), que es lo que tendría un atacante con una cuenta. El token está **omitido** en la salida guardada.

**Resultado:** 310 URL analizadas · **118 reglas PASS · 0 FAIL · 0 WARN.**

Alertas **informativas** (no son vulnerabilidades):

| Alerta | Interpretación |
|---|---|
| Client Error responses (872: 401 ×586, 404 ×269, 400 ×15, 429 ×2) | Esperado: ZAP prueba rutas sin permiso o con datos inválidos, y la API responde con el código correcto. Los 429 muestran que el **límite de intentos** funciona. |
| Authentication Request Identified | ZAP reconoce el login. Sin riesgo. |
| Information Disclosure – Sensitive Info in URL | Falso positivo: el parámetro `actorUserId` es un filtro de la auditoría del administrador, no un dato sensible. |
| Non-Storable Content | Las respuestas de la API no se guardan en caché. Es lo deseado. |

**Evidencias:** `reporte-zap.html`, `reporte-zap.json`, `salida-consola.txt`.
**Captura:** `capturas/01-reporte-zap.png`.

> El escaneo se hizo cuando la API de pruebas aún estaba en el puerto 3011; luego se movió a 3020 (ver §12). La API y la base son las mismas, así que el resultado no cambia.

---

## 8. SonarQube — análisis estático (§3.7) — `07-sonarqube/`

**Comando:** `npm run pruebas:sonar`.

El comando hace todo el proceso:

1. Levanta el contenedor propio `sonarqube-afinia` en :9100 (no toca otros SonarQube de la PC).
2. Fija una contraseña local aleatoria, guardada en `.credenciales-local.json`, que git ignora.
3. Analiza `api`, `web`, `mobile` y `shared` con la cobertura de Jest.

**Resultado: Quality Gate PASSED.**

| Métrica | Valor | Calificación |
|---|---|---|
| Líneas de código | 67 639 | — |
| Bugs | 5 | Confiabilidad D (por 2 bugs «críticos», ver abajo) |
| Vulnerabilidades | 1 (menor) | Seguridad B |
| Security Hotspots | 0 | — |
| Code smells | 794 (76 críticos, 328 mayores, 389 menores, 1 info, 0 bloqueantes) | Mantenibilidad **A** |
| Duplicación | 1,4 % | — |
| Cobertura | 28,3 % | — |

La cobertura es menor que la de Jest (≈39 %) porque SonarQube también cuenta ramas y considera más archivos.

**Hallazgos de bugs y vulnerabilidades** (detalle en `bugs-y-vulnerabilidades.json`):

| Tipo | Regla | Ubicación | Evaluación |
|---|---|---|---|
| Bug (crítico) ×2 | S2871: `sort()` sin función de comparación | `web/src/pages/society/Metrics.tsx:65-66` | Real pero de bajo impacto: ordena los nombres de categorías y áreas de los filtros; las tildes pueden quedar mal ordenadas. Se corrige con `localeCompare`. |
| Bug (mayor) ×3 | S5850: precedencia de alternativas en una regex | `api/src/projects/dependency-map.ts:122,129,130` | Las expresiones funcionan como se espera (`^…(:\|$)\|otra`), pero conviene agruparlas para que sean explícitas. |
| Vulnerabilidad (menor) | S5332: uso de protocolo http | `api/src/mail/mail.service.ts:176` | Configuración del transporte SMTP; con el puerto 587 se exige STARTTLS. Se recomienda revisarlo, pero no expone datos. |

Estos 6 hallazgos quedan como **backlog de mejora** y no bloquean el Quality Gate.

**Evidencias:** `resumen.json`, `bugs-y-vulnerabilidades.json`, `salida-analisis.txt` (token omitido).
**Capturas:** `capturas/01-panel-sonarqube.png`, `capturas/02-issues-sonarqube.png`, `capturas/03-medidas-cobertura.png`.

---

## 9. Pruebas móviles: Android Emulator + Expo + Maestro (§3.4) — `08-movil-maestro/` ⏳

**No se ejecutaron:** esta PC no tiene Android SDK, Java ni Maestro.

**Lo que queda listo:**

- `flujos/01-login-actividad-perfil.yaml`: login → actividades → inscripción → perfil → afinidad → recomendaciones (7 capturas).
- `flujos/02-proyectos-qr.yaml`: proyectos → colaboración / QR.
- `COMO_EJECUTAR.md`: instalación paso a paso, comando con la API de pruebas (`EXPO_PUBLIC_API_URL=http://10.0.2.2:3020/api`) y la **matriz de compatibilidad** por dispositivo que pide el §6.

**Qué falta:** instalar Android Studio y Maestro, y ejecutar `maestro test`. Las capturas quedarán en `capturas/`.

---

## 10. Usabilidad: tareas + SUS (§3.8) — `09-usabilidad-sus/` ⏳

**No se ejecutó:** requiere participantes reales (5 a 8 estudiantes).

**Lo que queda listo:**

- `GUIA_SESION.md`: 6 tareas (T1–T6), cuestionario SUS en español, cuentas por participante y reglas del moderador.
- `registro-tareas.csv` y `respuestas-sus.csv`: plantillas para llenar.
- `calcular-sus.mjs`: calcula el puntaje SUS (fórmula verificada con los casos 100, 0, 50 y 75) y genera `resultados-usabilidad.md`.

---

## 11. Regresión con las suites propias del proyecto — `10-regresion-suites-propias/`

Además de las herramientas del documento, se ejecutaron las **22 suites E2E propias** del proyecto (V2, V3, V4.1, lotes 1–11, objetivos, QA, web). Se corrieron después de la corrección de k6, para comprobar que no se rompió nada.

| Ejecución | Resultado |
|---|---|
| Primera pasada | 2217 ok · 8 fallos, **todos** en `e2e-ai-provider` |
| Reintento de `e2e-ai-provider` (tras mover el entorno de pruebas al puerto 3020) | 37/37 ok |
| **Total final** | **2254 ok · 0 fallos** |

Los 8 fallos **no eran del producto**: la suite `e2e-ai-provider` levanta un servidor propio en el puerto 3011, que la API de pruebas estaba ocupando. Ver §12.

**Evidencias:** `resumen-regresion.txt` y `registros/*.log` (uno por suite, más `e2e-ai-provider.reintento.log`).

---

## 12. Incidencias durante la ejecución y cómo se resolvieron

| # | Incidencia | Tipo | Resolución |
|---|---|---|---|
| 1 | k6: p95 CRUD 4,52 s > 3 s | **Defecto del sistema** | Corregido en `activities.service.ts` + `ANALYZE` en el entorno (§6). Ciclo completo documentado. |
| 2 | La primera corrección colgó la API con listas completas de 10 000 filas | Regresión detectada **por las pruebas** | La estrategia se limitó a listas paginadas; la regresión pasó. |
| 3 | `e2e-ai-provider` 8 fallos | Conflicto de entorno (puerto 3011) | El entorno de pruebas se movió a 3020/5180; reintento 37/37. |
| 4 | Una prueba de Jest esperaba un arreglo y la API devuelve `{scope, students}` | Error **de la prueba**, no del sistema | Se corrigió la prueba. |
| 5 | Playwright: la cuenta de prueba aún no completó la bienvenida | Preparación de datos | Se capturó la bienvenida y luego se completa por API (`asegurarBienvenida`). |
| 6 | Los JSON de Newman y k6 incluían la contraseña del administrador o tokens de sesión | Protección de evidencias | Los scripts omiten contraseña y tokens (`[omitida]`, `[token omitido]`); la contraseña del administrador se lee de `.env` y nunca está en el código de las pruebas. |
| 7 | SonarQube: la cobertura salía en 0 % | Error del script de análisis (rutas del lcov) | Se corrigió la conversión de rutas: 28,3 %. |
| 8 | SonarQube: conexión abortada al fijar la contraseña en el primer arranque | Arranque lento del servidor | Reintentos y verificación de la credencial en `sonar.mjs`. |

---

## 13. Índice de capturas

| Carpeta | Capturas |
|---|---|
| `02-jest-supertest/capturas/` | `01-reporte-jest`, `02-cobertura-resumen` |
| `03-playwright/capturas/` | `00-reporte-playwright` + una carpeta por navegador (`chromium/`, `firefox/`, `webkit/`) con las 39 capturas de abajo |
| `04-postman-newman/capturas/` | `01-reporte-newman` |
| `05-k6/capturas/` | `01-corrida-1-fallo`, `02-corrida-2-correccion`, `03-corrida-3-final` |
| `06-zap/capturas/` | `01-reporte-zap` |
| `07-sonarqube/capturas/` | `01-panel-sonarqube`, `02-issues-sonarqube`, `03-medidas-cobertura` |

**Capturas de Playwright** (iguales en los tres navegadores):

| Acceso | Estudiante | Personal | Negativos |
|---|---|---|---|
| 01-01 login | 02-00 bienvenida/onboarding | 03-01 docente: panel | 04-01 sin sesión → login |
| 01-02 login con error | 02-01 perfil | 03-02 docente: estudiantes (alcance) | 04-02 estudiante sin acceso a admin |
| 01-03 recuperar: formulario | 02-02 visibilidad y QR | 03-03 docente: mis actividades | 04-03 docente sin acceso a Dirección |
| 01-04 recuperar: respuesta | 02-03 actividades | 03-04 docente: puntos | |
| 01-05 inicio del estudiante | 02-04 proyectos | 03-05 Dirección: inicio | |
| | 02-05 evidencias: credenciales | 03-06 Dirección: aprobaciones | |
| | 02-06 evidencias: constancias | 03-07 Dirección: actividades | |
| | 02-07 afinidad | 03-08 Dirección: credenciales | |
| | 02-08 recomendaciones | 03-09 Dirección: analítica | |
| | 02-09 biblioteca | 03-10 sociedad: inicio | |
| | 02-10 trayectoria | 03-11 sociedad: actividades | |
| | 02-11 puntos | 03-12 sociedad: participantes | |
| | 02-12 currículo | 03-13 admin: usuarios | |
| | 02-13 colaboración/equipos | 03-14 admin: importar | |
| | | 03-15 admin: previsualización CSV | |
| | | 03-16 admin: criterios de puntos | |
| | | 03-17 admin: auditoría | |

Las capturas de los reportes se regeneran con `npm run pruebas:capturas`. Usa un navegador sin ventana, así que no interfiere con el trabajo en la PC.

---

## 14. Cómo repetir todo

```bash
# 1. Entorno (Docker Desktop encendido)
node scripts/pruebas/entorno.mjs reconstruir
npm run pruebas:api        # en una terminal (deja la API en :3020)
npm run pruebas:web        # en otra terminal (deja la web en :5180)

# 2. Pruebas
npm run pruebas:jest
npm run pruebas:playwright
npm run pruebas:postman
npm run pruebas:k6
npm run pruebas:zap
npm run pruebas:sonar      # después de pruebas:jest (usa su cobertura)

# 3. Capturas de los reportes
npm run pruebas:capturas
```

## 15. Pendientes para completar el capítulo

1. **Móvil:** instalar Android Studio y Maestro, y ejecutar los flujos de `08-movil-maestro/`. Llenar la matriz de compatibilidad, con al menos un Android físico.
2. **Usabilidad:** hacer la sesión con 5–8 estudiantes siguiendo `09-usabilidad-sus/GUIA_SESION.md` y ejecutar `calcular-sus.mjs`.
3. **Opcional:** corregir los 6 hallazgos de SonarQube (§8) y paginar los listados completos de personal (§6).
