# Afinia V3 — Hardening y QA (BATCH 23)

Este documento registra qué se verificó en el BATCH 23 de la especificación V3.1, cómo se hizo y con qué resultado. Distingue lo que **se ejecutó** de lo que **quedó preparado** porque requiere algo que esta máquina no tiene, como un emulador de Android o personas reales para la prueba de usabilidad. Las fechas corresponden a octubre de 2026.

## 1. Resumen

| Ítem de §72 / §71 | Estado | Evidencia |
|---|---|---|
| Pruebas unitarias («Jest») | Ejecutado | `npm --prefix api run test:unit`: 99/99, con el runner nativo de Node (`node:test`). Ver §2. |
| Integración con PostgreSQL | Ejecutado | 20 suites e2e contra PostgreSQL 16 real (Docker), con migraciones `up`/`down`. Ver §3. |
| Transiciones de estado | Ejecutado | Matriz completa 6×6 de estados de actividad más alcanzabilidad (unitarias); postulación, notificación y proyecto en e2e. |
| Playwright | Ejecutado | `e2e-web` 38/38 en **Edge** y en **Chrome**. |
| Maestro | Preparado | `mobile/.maestro/flujo-estudiante.yaml` (V3). No hay emulador ni dispositivo en esta máquina. |
| ZAP | Ejecutado | Escaneo **activo** de la API: 683 URL, 118 reglas aprobadas, 0 fallos, 0 avisos. |
| Auditoría de dependencias | Ejecutado | `npm audit`. Se corrigió lo crítico; lo restante queda documentado con su mitigación. Ver §6. |
| k6 | Ejecutado | Encontró un listado sin paginar. Tras corregirlo cumple RNF09 (umbrales de V2 RNF05). Ver §5. |
| Sonar | No disponible | No hay servidor SonarQube. Lo sustituyen el análisis estático equivalente (TypeScript estricto en api, web y móvil) y ZAP con la auditoría para seguridad. |
| Compatibilidad | Ejecutado (parcial) | Edge y Chrome (escritorio y 375 px); paquete Android generado con Metro y Hermes. Sin Firefox ni Safari en la máquina. |
| Usabilidad / SUS | Preparado | Protocolo, tareas de §71 y cuestionario SUS en §8. Requiere participantes. |

## 2. Pruebas unitarias

- Reglas puras sin base de datos ni servidor:
  - afinidad (V4), recomendaciones (40/30/15/10/5), respaldo de proyectos y de habilidades;
  - verificación de credenciales, patrón de credenciales;
  - elegibilidad de necesidades por semestre;
  - elegibilidad del currículo y niveles de la trayectoria;
  - nombres de equipo y transiciones de estado.
- **Matriz de transiciones (nueva):** se prueban las 36 parejas de estados de una actividad. Solo pasan las 14 permitidas, más quedarse igual.
  - Los estados finales (`finished`, `cancelled`) no salen a ninguna parte.
  - Desde un borrador se alcanzan todos los estados.
  - Nunca se vuelve a borrador desde un estado abierto, cerrado o final.
- **Sobre «Jest»:** el proyecto usa el runner nativo de Node con `ts-node` (`api/test/register.js`). Cubre lo mismo (aserciones, `describe`/`it`) sin otra dependencia de desarrollo. Migrar a Jest no aporta cobertura nueva y sumaría dependencias con avisos de seguridad (ver §6, árbol de Jest en la app móvil).

## 3. Integración con PostgreSQL

Las suites e2e corren contra la API real conectada a PostgreSQL 16 en Docker, con el esquema creado por las migraciones (nunca `synchronize`):
- 4 de objetivos, 11 de batches V1/V2, `e2e-qa`, `e2e-v2`, `e2e-v3`, `e2e-ai-provider` y `e2e-web`.
- Cada migración de V3 se probó `up` → `down` → `up`, con copia de seguridad previa.

## 4. Seguridad (ZAP)

- **Comando:** `node scripts/zap/run-zap.mjs`
  - `zap-api-scan.py` con la definición OpenAPI.
  - Sesión de un estudiante recién creado, para atacar con lo que ese rol puede hacer.
- **Resultado:** 683 URL, **PASS 118, FAIL 0, WARN 0, INFO 0.** El escaneo incluye las rutas de V3:
  - notificaciones, postulaciones, trayectoria e ítems del currículo;
  - Inicio de Dirección y Administración;
  - listado paginado.
- Además, `e2e-v3` prueba los permisos negativos de cada ruta nueva:
  - 403 entre roles;
  - 404 al cambiar un id a mano;
  - ítems ajenos en el currículo;
  - notificaciones ajenas.

## 5. Rendimiento (k6)

- **Comando:** `node scripts/k6/run-k6.mjs` (k6 en Docker).
  - Estudiantes: subida a 25 usuarios virtuales en un minuto.
  - Dirección: 2 usuarios constantes.
  - Ahora incluye avisos, trayectoria, necesidades e ítems del currículo.

| Medida (V3 RNF09; umbrales de V2 RNF05) | Umbral | Antes | Después |
|---|---|---|---|
| CRUD p95 | ≤ 3 s | **3,94 s ✗** | **1,56 s ✓** |
| Login p95 | ≤ 3 s | 2,03 s | 1,57 s |
| Reportes p95 | ≤ 5 s | 1,19 s | 0,66 s |
| Errores | < 1 % | 0 % | 0 % |
| Peticiones atendidas en 1 min | — | 945 | 1901 |

**Hallazgo:** `GET /activities` no tenía tope. Con la base de desarrollo devolvía 3 832 actividades (6,3 MB) en cada visita, unos 440 ms con un solo usuario, y se saturaba con 25.

**Corrección:**
- Paginación opcional (`limit` ≤ 100, `offset`), búsqueda de texto en el servidor (`q`; los comodines escritos se buscan literalmente) y «las mías» (`mine=interested|enrolled`). Lo más próximo sale primero.
- La respuesta paginada es `{ items, total, limit, offset }`.
- Sin `limit` el listado es el de siempre, por compatibilidad. Ahora tarda 30 a 50 ms.
- La web y la app del estudiante piden páginas con «Ver más»; la web pide además «Interesadas» e «Inscritas» al servidor.
- Pruebas `e2e-v3` V3.23.1–V3.23.10.

## 6. Dependencias (`npm audit --omit=dev`)

| Paquete | Antes | Después | Notas |
|---|---|---|---|
| api / raíz | 1 crítica, 4 altas | **0 críticas**, 4 altas, 8 moderadas | `npm audit fix` actualizó `proxy-addr` (crítica). |
| web | 2 moderadas | 2 moderadas | Ninguna alta ni crítica. |
| shared | 0 | 0 | |
| móvil | 1 crítica, 30 altas | **0 críticas**, 23 altas | `npm audit fix` actualizó `shell-quote` (crítica), `axios`, `form-data` y otras. |

**Riesgo residual aceptado, con mitigación:**
- **api:** las 4 altas son `multer` y `body-parser` (de `@nestjs/platform-express` 10.4.22, la última 10.x) y `js-yaml` y `lodash` (de `@nestjs/swagger` 7.4.2).
  - `npm audit` solo ofrece NestJS 12, un cambio mayor fuera del alcance de V3 («no rewrites»).
  - Se intentó forzar las versiones parchadas con `overrides`. npm 11 con workspaces no las aplicó de forma estable, así que se revirtió para no dejar dependencias en un estado incierto.
  - Mitigaciones vigentes:
    - las subidas usan `multer` con `fileSize` máximo y `files: 1`;
    - el cuerpo JSON y urlencoded está limitado a 256 kb;
    - Swagger (que es lo que trae `js-yaml` y `lodash`) se monta en desarrollo; en producción (`NODE_ENV=production`) solo si se pide explícitamente con `SWAGGER_ENABLED=true`, lo que no debe hacerse.
- **móvil:** las 23 altas son de la cadena de compilación de Expo (Metro, Jest, `@expo/cli`, `node-forge` de firma), no del código que se ejecuta en el teléfono. Su corrección exige otra versión mayor de Expo. `expo-doctor` 18/18 y el paquete Android compilan tras el arreglo.

## 7. Compatibilidad

- **Web:**
  - `e2e-web` (38 comprobaciones) aprobado en **Microsoft Edge** y **Google Chrome** (`E2E_BROWSER=msedge|chrome`).
  - Escritorio a 1280–1366 px y teléfono a 375 px para los cinco actores.
  - Movimiento reducido.
- **Móvil:** Expo SDK 54, React Native 0.81. Se generó el paquete Android (`expo export --platform android`, Hermes) sin errores.
- **No verificado aquí:** Firefox y Safari (no instalados) e iOS (requiere macOS).

## 8. Usabilidad (SUS) — protocolo preparado

**Participantes:** 5 a 8 estudiantes y 2 docentes de la carrera, en sesiones individuales de 30 minutos, con pensamiento en voz alta. Ningún dato personal sale de la sesión.

**Tareas** (§71):
1. Crear una habilidad sin equivocarse de área (Administración).
2. Registrar un proyecto y llevarlo de borrador a activo.
3. Explicar con sus palabras la diferencia entre una tecnología «declarada» y una «corroborada».
4. Registrar un certificado externo de una oportunidad terminada.
5. Construir un currículo eligiendo secciones e ítems concretos.
6. Crear una necesidad de equipo para su semestre y aceptar o rechazar una postulación.
7. Confirmar su contribución en un proyecto ajeno.

**Medidas:** éxito por tarea (sí, con ayuda o no), tiempo, errores y el cuestionario SUS al final.

**Cuestionario SUS** (escala de 1 a 5, de «muy en desacuerdo» a «muy de acuerdo»):
1. Creo que me gustaría usar Afinia con frecuencia.
2. Encontré Afinia innecesariamente compleja.
3. Me pareció fácil de usar.
4. Creo que necesitaría ayuda de una persona técnica para usarla.
5. Las funciones están bien integradas.
6. Hay demasiada inconsistencia.
7. La mayoría de las personas aprendería a usarla muy rápido.
8. Me resultó muy engorrosa de usar.
9. Me sentí con confianza al usarla.
10. Necesité aprender muchas cosas antes de poder usarla.

**Cálculo:** a los ítems impares se les resta 1; los pares se restan de 5; la suma se multiplica por 2,5. Un puntaje de 68 o más es el promedio de referencia.

**Estado:** el protocolo está listo, pero **no se aplicó**: requiere participantes reales y queda para la validación con usuarios.

## 9. Cómo repetirlo

```bash
npm --prefix api run test:unit
bash regress.sh                      # 20 suites; API levantada con MAIL_TRANSPORT=console
E2E_BROWSER=chrome node scripts/e2e-web.mjs
node scripts/k6/run-k6.mjs           # requiere Docker
node scripts/zap/run-zap.mjs         # requiere Docker y Swagger montado (desarrollo); respaldar la base antes
npm audit --omit=dev                 # en raíz, web y mobile
cd mobile && npx expo-doctor && npx expo export --platform android
maestro test mobile/.maestro/flujo-estudiante.yaml -e EMAIL=... -e PASSWORD=...   # con emulador
```
