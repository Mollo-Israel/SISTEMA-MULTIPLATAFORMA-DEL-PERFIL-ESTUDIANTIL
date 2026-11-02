# QA del cierre V6 — regresión integral

Fecha: 01/11/2026. Rama: `feature/afinia-v6-cierre`, desde `feature/afinia-v5-cierre@a3e55f8`; la rama V5 no se tocó.
Contrato: `AFINIA_CONTRATO_UNICO_V6_CLAUDE_CODE_2026-10-30.md`. Auditoría inicial: `AUDITORIA_GAP_AFINIA_V6.md`. Plan: `PLAN_BATCHES_AFINIA_V6.md`.

Este documento dice qué se ejecutó, con qué resultado, qué falló en el camino y qué no se ejecutó. Los fallos se registran tal cual.

## 1. Resultados

| Prueba | Alcance | Resultado |
|---|---|---|
| Compilación | `tsc` de `shared`, API, web y móvil; `vite build` de la web | Sin errores |
| Jest + SuperTest | 8 archivos, sobre `afinia_test` | **69 / 69** |
| Regresión de suites anteriores | 23 suites contra la API de desarrollo (objetivos 40–7, batches 1–11, QA, V2, V3, V3.2, V4.1, V5, IA simulada, web) | **2398 comprobaciones, 0 fallas** (ver §3: e2e-v3 se repitió sola) |
| `e2e-v6` (API) | Una sección por batch V6-1, 3, 4, 6–16; cada comprobación cita su escenario del contrato | **98 / 98** |
| `e2e-v6-web` (Playwright, Edge) | Batches V6-2…V6-7, 11, 12, 13, 15 y 16 con navegador real | **63 / 63** |
| `e2e-web` (Playwright, Edge) | Suite web anterior, con las reglas V6 | **106 / 106** |
| Newman (`pruebas/04-postman-newman`) | Colección regenerada con el aviso V6 del resumen | 34 peticiones, **70 / 70 aserciones** |
| Playwright (`pruebas/03-playwright`) | Chromium, Firefox y WebKit, contra el entorno aislado (`afinia_test`, web 5180) | **54 / 54** (en la primera corrida, 51/54: ver §3) |
| Secretos | Revisión del diff V6 completo: sin contraseñas, claves ni `.env` versionados; `.env.example` sin cambios | Limpio |

Cómo repetirlo: `npm run test:unit`, `npm run test:all` (suites anteriores), `npm run test:v6`, `npm run test:v6-web` (con `npm --prefix web run build` antes), `npm run pruebas:postman` y `npx playwright test` (con `node scripts/pruebas/entorno.mjs api` y `… web`).

## 2. Commits

| Batch | Commit | Qué cierra |
|---|---|---|
| V6-0 | `8c53eb2` | Auditoría con sondas reales y plan |
| V6-1 | `17d9774` | Responsable × semestre en la API (`activity_responsibles.semesters`) |
| V6-2 | `5e5e2cc` | Formulario por responsable; «Toda la carrera / Semestres específicos» |
| V6-3 | `61e75d8` | Duplicar sin heredar semestres; «Ver detalles» |
| V6-4 | `8a04464` | Cupo y admisión independientes; externas con admisión |
| V6-5 | `bc1e34f` | Cambios sin guardar; listados vigentes; «Apellidos por separar» solo si hay |
| V6-6 | `6bae551` | Correo asistido por rol; semestres del docente al crearlo |
| V6-7 | `c8601d2` | «Mi contribución» sin el 400 del rol anterior |
| V6-8 | `a61da30` | Proyectos sin OCR |
| V6-9 | `f52f6ee` | Imagen de evidencia con su tipo; demo https; límites |
| V6-10 | `426f801` | Galería con integrantes que aceptaron; sin repositorio |
| V6-11 | `282fa49` | QR solo en Visibilidad; vista previa real; foto opcional |
| V6-12 | `23040d2` | Recomendador sin «Me interesa / No me interesa» |
| V6-13 | `dc9f055` | Equipos → Para ti; búsqueda de contactos |
| V6-14 | `ef1d118` | Asistir no da insignia ni certificado |
| V6-15 | `5405743` | Estados de respaldo explicados; resumen por secciones |
| V6-16 | `f334821` | «Correo» fuera del menú |
| Móvil | `5a62538` | La app móvil con las reglas de V6-12 y V6-14 |
| V6-17 | (este commit) | Regresión, documentación y colección Postman |

## 3. Fallos e incidencias durante el cierre (sin maquillar)

- **e2e-v3 en la corrida completa: 18 fallos.** A mitad de la suite la sesión del administrador empezó a responder 401 (`UNAUTHENTICATED`) mientras corría Newman en paralelo; la suite usa un único token durante toda su ejecución y la máquina estaba más lenta. Repetida sola, **379 / 379**. Se registra como incidencia del entorno de prueba, no del sistema.
- **Contaminación de datos entre suites.** La prueba V6-5 deja una categoría dada de baja; `e2e-batch-4` y `e2e-batch-6` elegían la primera categoría sin mirar si estaba vigente y fallaron (12 y 1). Se corrigieron las suites para elegir solo categorías vigentes, como ya hacían `batch-8` y `objective-6`. La API ya rechazaba la categoría de baja con un mensaje claro.
- **Defectos reales encontrados por las pruebas y corregidos:**
  - V6-4: una solicitud anterior pendiente en una actividad con cupo se habría contado como admitida y superado el cupo (lo detectó la prueba unitaria).
  - V6-12: un motivo de recomendación mostraba «(prioridad 1)», que el §9.3 prohíbe.
  - V6-13: la búsqueda de contactos respondía 500 (orden por nombre de columna con `take()` en TypeORM).
  - V6-7: el caso D (quitar una tecnología usada) solo aplica a proyectos activos y si el área queda con otra tecnología; la prueba se ajustó a esa regla, que ya existía.
- **Playwright (`pruebas/03`): 3 fallos en la primera corrida**, el mismo recorrido del estudiante en los tres navegadores: buscaba la pestaña «Constancias» y la pantalla «Más sugerencias», que V6 renombró y retiró. Se actualizó `pruebas-e2e/02-estudiante.spec.ts` y la corrida completa repetida dio 54/54.
- **Newman: 1 aserción fallida** en la primera corrida: esperaba el aviso anterior del resumen. Se actualizó el generador (`scripts/pruebas/postman-coleccion.mjs`) y se regeneró la colección: 70/70.
- **Pruebas de etapas anteriores que el contrato V6 sustituye.** Se actualizaron citando la regla V6, sin relajar el resto: el 5 % de «Me interesa» y el descuento por descarte (V3 §34, V4.1 A41-015 → V6 §9), «abierta con cupo» pendiente (V5 §6 → V6 §4.1: esas pruebas declaran ahora «por aprobación»), insignias por asistir (V3 §66 → V6 §10.3), el texto del aviso del resumen (V3 §43.6 → V6 §10.4), la pantalla técnica del correo inaccesible (V3.2 §60 → V6 §12.1), el acceso rápido al QR en Colaboración (V4.1 A41-026 → V6 §8.1) y la etiqueta del diálogo de descarte (V5 → V6 §4.4).

## 4. Migraciones

Tres migraciones, **todas aditivas**. Se aplicaron en `perfil_estudiantil` y en `afinia_test`, sin reiniciar ninguna base.

| Migración | Qué agrega |
|---|---|
| `V6ResponsibleSemesters` (1780850000000) | `activity_responsibles.semesters smallint[]`, con relleno: cada docente queda con su alcance ∩ la audiencia |
| `V6GalleryConsent` (1780860000000) | `project_members.show_in_gallery boolean`, `false` por omisión |
| `V6ProfilePhoto` (1780870000000) | `student_profiles.photo_file_id` con FK a `stored_files` (`ON DELETE SET NULL`) |

No se reescribieron filas existentes: los roles anteriores en texto libre se traducen al leer (V6-7) y el historial de «Me interesa» se conserva (V6-12).

## 5. Matriz GAP final

Estado inicial (auditoría V6-0) → estado final, con el commit y las pruebas que lo demuestran.

| ID | Inicial | Final | Batch / commit | Pruebas |
|---|---|---|---|---|
| V6-SCOPE-01a/b/c | INCORRECT | **CORREGIDO** | V6-1 `17d9774`, V6-2 `5e5e2cc` | V6.1.1–1.15, V6W.2.1–2.10 |
| V6-SCOPE-02 | INCORRECT | **CORREGIDO** | V6-3 `61e75d8` | V6.3.1–3.8 |
| V6-ACT-01 | ALREADY_CORRECT / MISSING (modal) | **CORREGIDO** | V6-3 | V6.3.9, V6W.3.1–3.5 |
| ACT-10 | ALREADY_CORRECT | Sin cambios (sigue correcto) | — | V6.1.14 |
| V6-ACT-02 | ALREADY_CORRECT / cambio de regla | **CORREGIDO** (abierta con cupo = por orden) | V6-4 `8a04464` | V6.4.1–4.8 (ADM-02 concurrente) |
| V6-ACT-03 | MISSING | **CORREGIDO** | V6-4 | V6.4.9, V6W.4.1–4.2 |
| ADM-07/08 · V6-CERT-01 | PARTIAL | **CORREGIDO** | V6-14 `ef1d118` | V6.14.1–14.4 |
| V6-UX-01 | PARTIAL | **CORREGIDO** | V6-5 `bc1e34f` | V6W.5.1–5.7 |
| V6-GRID-01 | MISSING | **CORREGIDO** | V6-5 | V6W.5.8–5.10 |
| V6-USER-01 | PARTIAL | **CORREGIDO** | V6-5 | V6W.5.11, 5.11b |
| V6-USER-02 | PARTIAL | **CORREGIDO** | V6-6 `6bae551` | V6W.6.1–6.4 |
| V6-USER-03 | MISSING | **CORREGIDO** | V6-6 | V6.6.1–6.6, V6W.6.4 |
| V6-PROJ-01 | INCORRECT | **CORREGIDO** (reproducido: rol libre heredado → 400) | V6-7 `c8601d2` | V6.7.1–7.11a, V6W.7.1–7.3 |
| V6-PROJ-02 | ALREADY_CORRECT | Sigue correcto | — | V6.7.4–7.5 |
| V6-PROJ-03 | INCORRECT | **CORREGIDO** (OCR solo en credenciales) | V6-8 `a61da30` | V6.8.2 |
| V6-PROJ-04 | ALREADY_CORRECT | Sigue correcto, ahora probado | V6-8 | V6.8.1, 8.3, 8.4 |
| V6-PROJ-05 | PARTIAL | **CORREGIDO** (https, sin credenciales, aviso de terceros) | V6-9 `f52f6ee` | V6.9.4 |
| V6-PROJ-06 | INCORRECT | **CORREGIDO** (causa: sin `Content-Type`) | V6-9 | V6.9.1–9.3 |
| §7.6 límites | — | **CORREGIDO** (5 archivos / 8 enlaces) | V6-9 | V6.9.5–9.6 |
| V6-PROJ-07 | PARTIAL | **CORREGIDO** | V6-10 `426f801` | V6.10.1–10.6 |
| V6-PROFILE-01 | PARTIAL | **CORREGIDO** | V6-11 `282fa49` | V6W.11.1–11.5, WEB.51.2 |
| V6-PROFILE-02 | MISSING | **CORREGIDO** | V6-11 | V6.11.1–11.6 |
| V6-REC-01 | INCORRECT según V6 | **CORREGIDO** (web y móvil) | V6-12 `23040d2`, `5a62538` | V6.12.1–12.8, V6W.12.1–12.3 |
| V6-REC-02 | INCORRECT según V6 | **CORREGIDO** | V6-12, `5a62538` | V6W.12.4 |
| CONTACT | PARTIAL | **CORREGIDO** | V6-13 `dc9f055` | V6.13.1–13.5, V6W.13.1 |
| TEAM-01 | MISSING | **CORREGIDO** | V6-13 | V6.13.6–13.9, V6W.13.2 |
| V6-CERT-02 | ALREADY_CORRECT (texto) | **CORREGIDO** (nombre de la pestaña) | V6-14 | V6W.15.2, WEB.51.1 |
| HIST-02 | PARTIAL | **CORREGIDO** | V6-15 `5405743` | V6W.15.1 |
| V6-TRAJ-01 | PARTIAL | **CORREGIDO** | V6-15 | V6.15.1–15.2 |
| V6-ADMIN-01 | INCORRECT según V6 | **CORREGIDO** | V6-16 `f334821` | V6.16.1–16.2, V6W.16.1–16.3, WEB.22d–22e |

## 6. Definición de terminado (§19)

| # | Condición | Evidencia |
|---|---|---|
| 1 | Rama V6 propia; V5 preservada | `feature/afinia-v6-cierre`; V5 sin commits nuevos |
| 2 | Ningún semestre queda sin responsable | V6.1.2–1.5, V6W.2.4–2.6b |
| 3 | La API rechaza alcances manipulados | V6.1.6 (403 `RESPONSIBLE_SCOPE_EXCEEDED`) |
| 4 | Duplicar crea un borrador propio sin heredar | V6.3.1–3.5 |
| 5 | El docente ve el detalle sin editar | V6.3.9, V6W.3.1–3.4 |
| 6 | Cuatro combinaciones de cupo × admisión, concurrentes | V6.4.1–4.7 |
| 7 | Externas con la misma admisión | V6.4.9, V6W.4.1 |
| 8 | Admitir no es asistir | V6.4.8 |
| 9 | Cambios reales piden confirmar | V6W.5.1–5.6 |
| 10 | Listados vigentes por omisión | V6W.5.8–5.10 |
| 11 | Docente con semestres desde el alta | V6.6.1, V6W.6.4 |
| 12 | El correo no se inventa | V6W.6.1–6.3 |
| 13 | El 400 de contribución, reproducido y corregido | V6.7.1–7.3, V6W.7.2 |
| 14 | Tecnologías compartidas y varios roles | V6.7.4–7.5 |
| 15 | Sin OCR en proyectos; sigue en credenciales | V6.8.2; suites de credenciales V3/V5 |
| 16 | Activar pide evidencia o demo | V6.8.1, 8.3, 8.4 |
| 17 | La galería no sustituye evidencia ni filtra lo privado | V6.8.1, V6.10.5 |
| 18 | Demo con controles realistas y SSRF | V6.9.4; B5.33, B11.39 |
| 19 | La imagen se abre con su tipo y autorización | V6.9.1–9.3 |
| 20 | Galería con información consentida, sin repositorio | V6.10.1–10.6 |
| 21 | QR y canales en Visibilidad con vista previa fiel | V6W.11.1–11.4 |
| 22 | Foto opcional, privada por omisión | V6.11.1–11.6 |
| 23 | Sin «Me interesa / No me interesa» en actividades | V6W.12.1–12.3 |
| 24 | El perfil separa interés y mejora; los favoritos no mueven el motor | V6.12.1–12.5 |
| 25 | Equipos con «Para ti»; el contacto pide permiso | V6.13.5–13.9 |
| 26 | La asistencia no es certificado ni logro automático | V6.14.1–14.4 |
| 27 | Certificados internos y externos diferenciados | V6.15.1, V6W.15.2 |
| 28 | «Con respaldo» explicado sin prometer competencias | V6W.15.1 |
| 29 | Exportación informativa, sin certificado de Afinia | V6.15.2; B9.46, V2.12.8, V3.18.26 |
| 30 | `/admin/mail` solo para Administración, fuera del menú | V6.16.1–16.2, V6W.16.1–16.3 |
| 31 | Build, pruebas y QA documentados; sin secretos ni migraciones destructivas | §1, §4 |
| 32 | Afinidad no recalibrada | Ningún cambio en `affinity-recalc/`; V6.12.5 |

## 7. Decisiones tomadas en el cierre

- **Ranking del recomendador (V6-12):** se retiró la señal de clics (5 %) y el descuento por descarte. Los pesos de lo declarado (40/30/15/10) **no se recalibraron** (§9.5: sin datos para hacerlo); el total máximo queda en 95 y el orden es el mismo. La huella `RULES_VERSION` cambia y queda guardada en cada recomendación.
- **Abierta con cupo (V6-4):** se adjudica por orden de solicitud con la fila bloqueada; al agotarse, la solicitud no se guarda (409 `ACTIVITY_FULL`). No hay lista de espera: no existe ese estado y no se inventó.
- **Externas (V6-4):** guardan cupo y admisión como las internas, pero su plaza la sigue confirmando el proveedor (nunca automática).
- **Galería (V6-10):** el nombre del dueño se seguía mostrando, porque él decidió compartir el proyecto con la comunidad; los demás integrantes, solo si lo aceptan.
- **Móvil (V6-11):** el enlace y el QR siguen en Colaboración porque la app no tiene pantalla de Visibilidad; no quedan duplicados.
- **Correo (V6-16):** el menú ya no lo muestra en ningún modo; la ruta queda siempre registrada detrás del rol. El límite de pruebas de correo (3/min) puede responder 429 antes que el 403 de rol: ambos niegan el acceso.

## 8. Lo que no se ejecutó en este cierre

- **k6, OWASP ZAP y SonarQube** no se volvieron a correr: V6 no agrega carga relevante ni dependencias nuevas, y sus últimas corridas son del cierre V5 (`pruebas/05-k6/corrida-v5/`, `pruebas/06-zap/corrida-v5/`, `pruebas/07-sonarqube`). Las rutas nuevas de V6 (`/contacts/search`, `/team-needs/for-me`, `/projects/:id/my-gallery-consent`, `/profiles/me/photo`, `/public/profiles/:slug/photo`) **no** están cubiertas por esa corrida de ZAP.
- **Maestro (móvil)** no se ejecutó: los cambios móviles se verificaron con `tsc` y revisión de pantallas, no en un dispositivo.
- El documento de grado (`.docx`) no se modificó.
