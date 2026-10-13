# Afinia V3.2 — QA final (BATCH 21)

**Fecha:** 13/10/2026

**Rama:** `feat/afinia-v3-2`

**Entorno:**
- API NestJS sobre PostgreSQL 16 en Docker (`perfil_postgres`).
- Web compilada (`vite build`), servida con `vite preview` en el puerto 5173.
- Chromium (Playwright) para las pruebas de la web.
- Correo en modo `console`.
- Para las pruebas de GitHub y del verificador de enlaces, servidores simulados locales.

> Regla del cierre (§BATCH 21): **no se afirma ningún resultado que no se haya ejecutado.** Cada fila indica la prueba que lo respalda. Lo que no se ejecutó figura en «No ejecutado» con el motivo.

## 1. Resumen de ejecución

| Prueba | Comando | Resultado |
|---|---|---|
| Unitarias (reglas puras, guard de correo, auditoría, respaldos de OCR y correo) | `npm --prefix api run test:unit` | **130/130** |
| Integración contra PostgreSQL real + E2E de API (19 suites) | `scripts/e2e-*.mjs` | **0 fallos** (detalle en §2) |
| E2E de la web en navegador real | `node scripts/e2e-web.mjs` | **50/50** |
| Regresión completa (21 suites) tras BATCH 16–19 | `regress.sh` | **2040 correctas, 0 fallos** |
| Tipos | `tsc --noEmit` en `api`, `web` y `mobile` | sin errores |
| Móvil | `npx expo-doctor` | 18/18 |
| Móvil | `npx expo export --platform android` | bundle Hermes generado |

Las suites e2e son de integración: crean cuentas, actividades, proyectos y archivos reales en PostgreSQL a través de la API. No usan dobles de la base de datos.

## 2. Suites de la regresión completa (última corrida)

| Suite | Correctas | Fallos |
|---|---:|---:|
| e2e-objectives-40 | 249 | 0 |
| e2e-objective-5 | 116 | 0 |
| e2e-objective-6 | 85 | 0 |
| e2e-objective-7 | 89 | 0 |
| e2e-batch-1 | 59 | 0 |
| e2e-batch-2 | 65 | 0 |
| e2e-batch-3 | 58 | 0 |
| e2e-batch-4 | 48 | 0 |
| e2e-batch-5 | 50 | 0 |
| e2e-batch-6 | 53 | 0 |
| e2e-batch-7 | 57 | 0 |
| e2e-batch-8 | 63 | 0 |
| e2e-batch-9 | 52 | 0 |
| e2e-batch-10 | 42 | 0 |
| e2e-batch-11 | 46 | 0 |
| e2e-qa | 74 | 0 |
| e2e-v2 | 162 | 0 |
| e2e-v3 | 379 | 0 |
| e2e-v3-2 | 206 | 0 |
| e2e-ai-provider | 37 | 0 |
| e2e-web | 50 | 0 |

En `e2e-web`, la corrida completa dio 49/1. El fallo era la prueba nueva WEB.22k, mal armada. Corregida, la suite repetida dio 50/50.

## 3. Áreas exigidas por §BATCH 21

| Área | Qué se comprobó | Pruebas |
|---|---|---|
| **Autorización negativa** | Un actor sin permiso recibe 403/404, también al cambiar un id en la URL o el cuerpo (docente fuera de su alcance, borradores ajenos, actividad aprobada bloqueada, documentos ajenos, auditoría y correo solo para Admin). | 101 comprobaciones con «-> 403/404» en su nombre. Ejemplos: V32.6.2–6.6, V32.8.4, V32.8.7, V32.8.14, V32.16.2, V32.18.1, V32.18.10, V32.19.5, B2.44 |
| **CORS / sesión** | Origen no autorizado sin permiso; refresh en cookie HttpOnly y SameSite, limitada a `/api/auth`; rotación; F5 durante la renovación; logout revoca. | B11.19, V2.2.6–2.2.10, RF03 (e2e-batch-1) |
| **Cabeceras de seguridad** | HSTS, `nosniff`, sin `X-Powered-By`; cuerpo desmedido rechazado. | B11.16–B11.20 |
| **Seguridad de archivos** | Descarga sin sesión → 401; solo el titular, quien lo entregó o quien tiene alcance; otro estudiante → 404. La web y el móvil piden los archivos con el token (antes recibían 401). | B5.1, B11.23–B11.26, V32.8.10, WEB.22k |
| **SSRF** | La metadata de la nube no se consulta; la URL leída de un QR pasa por la misma protección. | V3.9.9, V3.9.10 |
| **Respaldo de GitHub** | ETag y 304 sin gastar cuota; cuota agotada → «sin comprobar», sin bloquear; fallo pasajero reintentado. | V3.11.10–V3.11.15 |
| **Respaldo de SMTP** | Sin servidor se simula; SMTP pedido sin servidor explica el problema; valor desconocido → «auto»; la invitación informa QUEUED / SENT_TO_SMTP / FAILED; las suites se niegan a correr con SMTP real. | unitarias «respaldo del correo» (3), V2.2.2, `asegurarCorreoDePrueba` |
| **Respaldo de OCR** | Sin motor, o con un PDF sin texto, no se lanza: el documento queda INCONCLUSIVE, no FAILED. Proveedor caído → UNREACHABLE / INCONCLUSIVE. | unitarias «respaldo del OCR» (4), B3.32, V3.9.6 |
| **Responsive** | Todas las pantallas de estudiante, docente, Dirección, Sociedad y Admin caben en 375 px sin desplazamiento horizontal ni errores de JavaScript; movimiento reducido. | WEB.14, WEB.20–WEB.22 |
| **Usabilidad (automatizable)** | Menús por rol; pestaña activa única; ayuda por tema; filtros de auditoría que funcionan; validación por campo. | WEB.6–WEB.12d, WEB.22b–22j, V32.5.x (validación por campo) |

## 4. Criterios de aceptación §73

| Criterio | Pruebas |
|---|---|
| Importación aplica filas válidas aunque haya conflictos; sin previsualizaciones basura | V32.1.x |
| Cuenta activa no manda correo; espera persistente; token anterior invalidado | V32.2.x, QA.13–QA.17, B2.2 |
| Etiquetas no puntúan; alias; áreas secundarias; selector | V32.3.x, V32.15.4–15.5 |
| Actividad: varias áreas, habilidades, fechas, propiedad, ciclo, revisión, creador sin editar lo aprobado | V32.4.x–V32.7.x |
| Recursos: acceso del estudiante, permanentes, recomendables, sin afinidad | V32.9.x, V32.10.x |
| Proyecto: borrador incompleto, activo con requisitos, GitHub, demo opcional | V32.11.x, V3.11.x, B5.17b, B5.30 |
| Afinidad: solo evidencia autorizada, habilidad en su contexto, sin etiquetas | V32.15.1–15.5 |
| Currículo: secciones, ítems, elegibilidad, vista previa, PDF | V3.18.x, V32.19.1–19.5 |
| Docente: funciones restauradas | V32.16.1–16.3, WEB.12c–12d |

## 5. No ejecutado (no se afirma)

- **Usabilidad con personas.** No hubo sesiones con estudiantes ni docentes. Lo de §3 es lo automatizable.
- **Recorrido en un teléfono físico o en Expo Go.** El móvil se verificó con `tsc`, `expo-doctor` y la compilación del bundle Android, no ejecutándolo.
- **OCR real con `tesseract.js`.** El paquete no está instalado a propósito (`ocr.port.ts`). Se probó el camino sin motor.
- **SMTP real.** Por diseño, las suites no envían correo real. El envío real se comprueba a mano con `npm run mail:test` (docs/CORREO_REAL.md).
- **Escaneo OWASP ZAP.** Hay resultados anteriores en `scripts/zap/out/`, pero no se volvió a correr en este cierre.
- **Producción con `NODE_ENV=production`.** El 404 del diagnóstico de correo se probó con pruebas unitarias del guard, no levantando la API en ese modo.

## 6. Incidencias del entorno durante el QA

Dos veces la API en modo `watch` se reinició en medio de una suite: al instalar dependencias del móvil y al cambiar archivos de pruebas. La suite en curso dio `fetch failed`. Al repetirla, sin cambios de código, pasó entera. Para una corrida limpia conviene levantar la API sin `watch` (`npm --prefix api run start`).
