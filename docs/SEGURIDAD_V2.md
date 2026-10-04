# Afinia — Revisión de seguridad, rendimiento y calidad (V2 §79, BATCH 16)

Fecha: 2026-10-04 · Rama: `feat/afinia-v2` · Entorno: desarrollo local (Windows 10, Docker Desktop, PostgreSQL 16, API en modo watch).

Este documento resume qué se verificó, con qué herramienta y con qué resultado. Cada afirmación remite a una prueba que se puede volver a correr. Lo que no se pudo ejecutar en esta máquina se indica como **pendiente**, con el procedimiento para hacerlo.

## 1. Resumen

| Área (§79) | Herramienta | Resultado |
|---|---|---|
| Autorización negativa, sesión, rate limit, enumeración, archivos, SSRF | 19 suites e2e contra la API real | 1400 comprobaciones, 0 fallos |
| Reglas puras | runner nativo de Node (`npm run test:unit`) | 33 pruebas, 0 fallos |
| Web en navegador | Playwright con Edge (`npm run test:web`) | 22 comprobaciones, 0 fallos |
| Escaneo dinámico | OWASP ZAP (`zap-api-scan`, escaneo activo autenticado) | 0 FAIL, 0 WARN, 118 reglas pasan |
| Dependencias | `npm audit --omit=dev` | ver §5 |
| Rendimiento | k6 en Docker (`node scripts/k6/run-k6.mjs`) | cumple RNF05, ver §6 |
| Cabeceras | inspección de respuesta | correctas, ver §3 |
| Móvil | `expo-doctor`, `tsc` | 18/18, limpio; emulador **pendiente** |
| Calidad interna | SonarQube (Docker) | 0 bugs, 1 vulnerabilidad (falso positivo), mantenibilidad A, ver §7 |
| Compatibilidad | Chrome y Edge (Playwright) | Firefox **pendiente** |

## 2. Lista de §79.6

| Punto | Cómo se controla | Evidencia |
|---|---|---|
| Autorización negativa | Guardas de rol + comprobación de propiedad o alcance en cada servicio; nunca solo en la pantalla | B11 (403 por rol), B5/B6/obj-40 (proyectos y evidencias ajenas), V2.5 (solo Dirección decide), V2.8.7/IA.20 (la IA no abre puertas), V2.14 (auditoría y necesidades), V2.15 (móvil) |
| TeacherScope | Una sola fuente (`TeacherScopeService`) para perfiles, proyectos, paneles e IA | obj-6, B9, V2.13.1, V2.14.2, IA.20 |
| Sesión | Access token corto; refresh rotatorio con revocación; cookie HttpOnly en web; sesión no emitida a personal desde el móvil | B1, B2, V2.2, V2.15 |
| Rate limit | Global 5000/min; login, activación y recuperación estrechos; IA 20/min por persona | B1, B2.2 (429 con `retryAfterSeconds`) |
| Enumeración | Mismo mensaje para correo inexistente y contraseña errónea; perfil público cerrado responde 404 | B1, B8 |
| Archivos | Sin estáticos: la descarga pasa por un controlador que exige sesión y autorización; tipo y tamaño validados | B3, B11 (descarga ajena 404/403) |
| SSRF | El verificador de enlaces bloquea IP privadas, `localhost` y metadatos de nube (169.254.169.254) | B3 §31 |
| CORS | Lista blanca `WEB_ORIGINS`; credenciales solo para orígenes permitidos | inspección (§3) |
| Datos sensibles en respuestas | `User.toJSON()` excluye el hash; vista mínima de actividades para el estudiante; correo institucional nunca expuesto por omisión | V2.5.31, V2.11.7, V2.12.5 |
| Auditoría | Eventos sin contraseñas, tokens ni códigos (filtro de claves prohibidas) | B5, V2.14.6 |
| IA | Entrada saneada (correos, teléfonos, tokens, URL con parámetros); solo huella guardada; clave nunca en respuestas | IA.5, IA.9, IA.19, IA.26, unitarias |

### Hallazgos corregidos durante la V2

1. **Hash de contraseña en respuestas** (previo a V2): los listados de actividades incluían `creator.passwordHash`. Corregido con `User.toJSON()` (BATCH 5).
2. **Exposición innecesaria en el listado del estudiante**: llegaban el correo, rol y estado del creador y datos internos de la revisión de Dirección. Ahora el estudiante recibe una vista mínima (BATCH 16).
3. **Cola de correo y reloj**: un envío recién encolado podía esperar hasta el siguiente encolado si el reloj de la base iba atrasado respecto del de Node (BATCH 8).
4. **IA y cifras inventadas de un dígito**: «2 años» de experiencia que el texto no tenía pasaba la validación; ahora se compara cualquier número (BATCH 16, encontrado por las unitarias).
5. **Menú lateral en teléfonos**: ocupaba 256 px aunque estuviera oculto; el contenido quedaba con ~120 px (BATCH 16, encontrado por Playwright).

## 3. Cabeceras y CORS

Respuesta de `GET /api/health`:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: no-referrer
Cross-Origin-Opener-Policy: same-origin
X-Permitted-Cross-Domain-Policies: none
X-RateLimit-Limit / Remaining / Reset
```

Sin `Content-Security-Policy` en la API a propósito: no sirve HTML. La CSP corresponde al servidor que publique la web. CORS solo admite los orígenes de `WEB_ORIGINS`.

## 4. OWASP ZAP

Ejecución: `node scripts/zap/run-zap.mjs` (Docker, `ghcr.io/zaproxy/zaproxy:stable`, `zap-api-scan.py` con la definición OpenAPI y **escaneo activo**). La sesión es la de un estudiante recién creado: el escaneo ataca cada ruta con lo que ese rol puede hacer. La base se respaldó antes y se restauró después (el escaneo activo crea datos basura).

| Resultado | Valor |
|---|---|
| URLs importadas / visitadas | 236 / 586 |
| Reglas que pasan | 118 |
| FAIL | 0 |
| WARN | 0 |
| Alertas informativas | 4 |

Comprobación de que el escaneo fue autenticado: en el registro de la API, durante el escaneo, los 401 vinieron solo de `/auth/login` y `/auth/refresh` (ZAP probando credenciales falsas; también aparecieron dos 429 del límite de login, como debe ser). El resto respondió 200 (278), 403 en rutas de personal (13), 400 por validación (1 507) y 404 (3): las cargas maliciosas mueren en el `ValidationPipe` (`whitelist` y `forbidNonWhitelisted`) o en las guardas de rol.

Alertas informativas y su lectura:

- *Client Error response code*: las respuestas 4xx de arriba; esperadas ante ataques.
- *Authentication Request Identified*: el login; informativa.
- *Sensitive Information in URL*: el filtro `actorUserId` (un UUID) de `GET /audit/events`, que solo usa la Administración. Falso positivo: no es un secreto.
- *Non-Storable Content*: respuestas de la API que no se deben guardar en caché; correcto para datos personales.

El informe completo queda en `scripts/zap/out/zap-api.html` (no se versiona).

## 5. Dependencias (`npm audit --omit=dev`)

| Paquete | Antes | Después | Decisión |
|---|---|---|---|
| Web: `axios`, `form-data` (alta) | vulnerables | corregidas (`axios` 1.20.0) | `npm audit fix` compatible, sin cambios de versión mayor |
| Web: `react-router` (moderada) | 6.30.x | sin cambio | la corrección exige React Router 7 (mayor). La ruta afectada (redirecciones con barra invertida) no se usa con datos externos en la web. Pendiente para una migración planificada |
| API: `@nestjs/platform-express` → `multer` (alta) | NestJS 10 | sin cambio | la corrección exige NestJS 12 (dos versiones mayores). Mitigación: las subidas exigen sesión, tienen tope de tamaño (`MAX_UPLOAD_MB`) y tipo validado; el JSON está limitado a 256 KB |
| API: `js-yaml`, `lodash` vía `@nestjs/swagger` (alta) | Swagger 7 | sin cambio | corrección solo con Swagger 12 (mayor). Swagger se deshabilita en producción (`SWAGGER_ENABLED=false`) |
| Móvil | — | — | sin vulnerabilidades en dependencias de producción |

Recomendación: planificar la migración NestJS 10 → 11/12 y React Router 6 → 7 como cambio propio, con su regresión, no como parche.

## 6. Rendimiento (k6, RNF05)

Escenario (§79.7): login, listados, perfiles, recomendaciones y reportes; 25 estudiantes virtuales en rampa y 2 de Dirección durante 60 s, contra la API de desarrollo en modo watch y una base con datos de miles de corridas de prueba (1716 actividades abiertas).

| Métrica | Umbral RNF05 | Resultado |
|---|---|---|
| CRUD sin archivos, p95 | ≤ 3 s | 1,76 s |
| Login, p95 | ≤ 3 s | 0,49 s |
| Reportes, p95 | ≤ 5 s | 0,86 s |
| Errores | < 1 % | 0 % |

Primera corrida (antes de corregir): p95 2,45 s y 583 MB transferidos en 741 pedidos. El listado de actividades del estudiante pesaba 3 MB por pedido. Se corrigió con la vista mínima del estudiante (3,0 → 1,9 MB) y compresión HTTP (1,9 MB → 125 KB transferidos). Con datos reales —decenas de actividades por semestre, no miles— el listado es órdenes de magnitud menor; si creciera, el siguiente paso es paginar en el servidor (`limit`/`offset`) y llevar la búsqueda de la web al servidor.

## 7. Calidad interna (SonarQube)

Servidor `sonarqube:community` y escáner `sonarsource/sonar-scanner-cli` en Docker, con `sonar-project.properties` (sin migraciones, semillas ni compilados).

| Métrica | Primer análisis | Tras corregir |
|---|---|---|
| Líneas de código | 52 711 | 52 697 |
| Bugs | 16 | **0** (fiabilidad A) |
| Vulnerabilidades | 2 | 1 (falso positivo, abajo) |
| Security hotspots | 0 | 0 |
| Olores de código | 599 | 583 |
| Duplicación | 1,3 % | 1,3 % |
| Mantenibilidad | A | A |

Corregido: cuatro `.sort()` sin comparador (dos ordenaban números como texto: 10 antes que 2), dos botones de envío sin `type`, enlaces de la portada sin `href` (inalcanzables con el teclado), un identificador generado con `Math.random` (ahora `useId`), una condición siempre verdadera y un `map` con función que recibía el índice sin quererlo.

Falso positivo: «Using http protocol» en el transporte SMTP. Con el puerto 587 el transporte exige STARTTLS (`requireTLS`) y TLS 1.2 como mínimo; con 465, TLS directo. No se envía nada en claro.

Los 583 olores son en su mayoría estilo (complejidad cognitiva de funciones largas, anidamiento de ternarios en JSX). No se persiguen como métrica de vanidad (§79.9).

## 8. Pendientes, con procedimiento

- **Maestro / emulador Android** (§79.5): no hay SDK de Android en esta máquina. Flujo listo en `mobile/.maestro/flujo-estudiante.yaml`; ver el encabezado del archivo.
- **Firefox** (§79.8): Playwright necesita su propia compilación de Firefox (`npx playwright install firefox`); la suite web corre igual cambiando el navegador.
- **Usabilidad / SUS** (§79.10): requiere personas; se registra fuera del sistema.
