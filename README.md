# Sistema Multiplataforma para la Construcción del Perfil Estudiantil Dinámico

Ingeniería en Sistemas Informáticos – Univalle. Sistema completo según
`AFINIA_100_ESPECIFICACION_DEFINITIVA.md`: los diez objetivos específicos, de
extremo a extremo.

Plataforma complementaria (no reemplaza SIU, Teams, notas ni certificados oficiales) que construye un perfil estudiantil dinámico a partir de intereses, habilidades, proyectos, actividades, participación, evidencias, constancias y áreas de afinidad.

## Stack

| Capa | Tecnología |
|------|-----------|
| API central | NestJS + TypeScript + TypeORM |
| Base de datos | PostgreSQL (vía Docker) |
| Frontend web | React + Vite |
| App móvil | React Native + Expo |
| Tipos compartidos | Paquete `shared/` |
| Autenticación | JWT + control de acceso por roles |

## Estructura del monorepo

```
.
├── api/      API central NestJS (consumida por web y móvil)
├── web/      Frontend React
├── mobile/   App React Native + Expo
├── shared/   Tipos, enums y DTOs compartidos
├── docker/   docker-compose para PostgreSQL
└── docs/     Documentación y diagnóstico técnico
```

## Roles y responsabilidades

| Rol | Qué hace en el sistema |
|-----|------------------------|
| **Estudiante** | Construye su perfil dinámico, se inscribe en actividades, registra proyectos, evidencias y certificados externos, colabora con otros y consulta su trayectoria |
| **Docente** | Consulta la oferta de actividades y los perfiles de **los semestres que el administrador le habilita** |
| **Director de carrera** | Gestiona las **actividades académicas**, registra participación, emite las **constancias internas** y consulta la analítica de la carrera |
| **Sociedad científica** | Gestiona las **actividades extracurriculares**, registra participación y consulta las métricas de lo que organizó |
| **Administrador** | Usuarios institucionales, roles y estados, semestres habilitados, catálogos y criterios de gamificación |

**No hay registro público.** Ninguna cuenta se crea sola: el administrador la
provisiona —una a una o importando el padrón— y la persona la activa desde el
enlace que recibe por correo, eligiendo ahí su contraseña. Es lo que pide §12 de
la especificación, y es lo que separa una identidad institucional de un correo
cualquiera.

## Guía rápida para colaboradores

Requisitos previos:
- **Node 18+** y **npm**
- **Docker Desktop** (para PostgreSQL) — debe estar abierto
- Para la app móvil: **Expo Go** (Play Store / App Store) o un emulador

Los tres clientes (API, web, móvil) consumen la **misma API** con el **mismo JWT**.

### Paso 1 — Preparación (una sola vez)

```bash
# En la raíz del proyecto:
cp .env.example .env          # variables de entorno (valores por defecto sirven en desarrollo)

npm install                   # dependencias backend (workspaces: shared + api)
npm install --prefix web      # dependencias web
npm install --prefix mobile   # dependencias móvil (Expo)

npm run db:up                 # levanta PostgreSQL en Docker
npm run shared:build          # compila tipos compartidos
npm run api:migrate           # crea las 57 tablas (21 migraciones)
npm run seed:populate         # POBLA la base con datos institucionales realistas
```

`seed:populate` deja la base lista con **21 usuarios** (1 administrador, 2 docentes,
1 director, 1 sociedad científica y 16 estudiantes), 9 actividades, 8 proyectos con
evidencias, 6 certificados externos, constancias internas, participaciones en sus tres
estados y **áreas de afinidad calculadas** con el motor real.

### Paso 2 — Levantar los 3 servicios (una terminal cada uno)

```bash
# Terminal 1 — API (backend)
npm run api:dev        # http://localhost:3010/api   ·   Swagger: http://localhost:3010/api/docs

# Terminal 2 — Web
npm run web:dev        # http://localhost:5173

# Terminal 3 — Móvil (Expo)
npm run mobile:start   # abre Expo; escanea el QR con Expo Go
```

> **Móvil:** la dirección de la API ya **no se configura a mano**. La app la
> deduce del mismo equipo que sirvió el paquete, así que funciona igual en un
> celular físico, en el emulador de Android y en el simulador de iOS, y
> sigue funcionando al cambiar de red.
>
> Solo hace falta que el celular esté en la **misma Wi‑Fi** que el equipo y que
> la API esté levantada en el puerto **3010**.
>
> Si aun así no conecta, el mensaje de error indica a qué dirección intentó
> llegar. Dos salidas:
> - `cd mobile && npx expo start --tunnel` — evita la red local por completo.
> - `EXPO_PUBLIC_API_URL=http://TU_IP:3010/api` — fuerza una dirección concreta.
>
> Si el celular alcanza Expo (puerto 8081) pero no la API (3010), es el
> cortafuegos de Windows: hay que permitir Node.js en redes privadas.
>
> ⚠️ **Revise primero `mobile/.env`.** Si tiene una `EXPO_PUBLIC_API_URL`
> escrita a mano, esa gana sobre la detección automática, y queda obsoleta en
> cuanto cambia la IP del equipo. El síntoma es un error de conexión contra una
> dirección que ya no existe. Comente esa línea y reinicie con
> `npx expo start -c`: las variables se incrustan al empaquetar, así que no
> basta con guardar el archivo.

### Cuentas para iniciar sesión

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Administrador (único) | `admin@univalle.edu` | `Admin123*` |
| Docente (semestres 1–4) | `carlos.perez@univalle.edu` | `Univalle2026*` |
| Docente (semestres 5–8) | `maria.gutierrez@univalle.edu` | `Univalle2026*` |
| Director de carrera | `jorge.vargas@univalle.edu` | `Univalle2026*` |
| Sociedad científica | `lucia.fernandez@univalle.edu` | `Univalle2026*` |
| Estudiante (ejemplo) | `ana.quispe@est.univalle.edu` | `Univalle2026*` |

Hay 16 estudiantes con el patrón `nombre.apellido@est.univalle.edu` y contraseña
`Univalle2026*`. Son las cuentas que deja el seed, ya activadas; una cuenta nueva
se crea desde **Administración → Usuarios** o importando el padrón, y nace
`PENDING_ACTIVATION` hasta que su dueño usa el enlace de activación.

> Si reinicias el PC, basta con `npm run db:up` para recuperar la base (los datos persisten).
> Para reconstruir la base desde cero: `npm run db:reset && npm run api:migrate && npm run seed:populate`.

## Pruebas automáticas

Las suites hablan HTTP contra la API en marcha: comprueban el sistema, no sus
piezas por separado.

```bash
npm run api:dev      # en una terminal

# en otra terminal:
npm run test:all     # las 15 suites -> 1139 verificaciones, 0 fallos
```

O una por una:

| Script | Cubre | Verificaciones |
|--------|-------|----------------|
| `npm run test:40` | Objetivos 1 a 4 | 248 |
| `npm run test:50` | Objetivo 5 — portafolio | 116 |
| `npm run test:60` | Objetivo 6 — motor de afinidad | 86 |
| `npm run test:70` | Objetivo 7 — recomendaciones | 89 |
| `npm run test:b1` … `test:b11` | Los once batches de AFINIA 100 | 600 |

## Flujo principal (end-to-end)

1. Admin provisiona la cuenta (o importa el padrón) y confirma roles y áreas académicas.
2. La persona activa su cuenta desde el enlace del correo y elige su contraseña.
3. Estudiante crea su perfil dinámico.
4. Estudiante registra intereses (por área) y habilidades (con nivel).
5. Director publica actividad académica; sociedad científica, extracurricular.
6. Estudiante consulta actividades (web o móvil).
7. Estudiante registra interés o inscripción.
8. Docente/sociedad confirma participación (el estudiante no puede confirmar la suya).
9. Estudiante registra proyecto académico y adjunta evidencia (enlace o archivo).
10. El motor de validación comprueba lo adjuntado y le asigna un nivel de respaldo.
11. El motor de afinidad recalcula tras cada cambio relevante, y su puntaje se puede abrir línea por línea.
12. El estudiante recibe recomendaciones explicadas, colabora por QR, contactos y equipos, y ve su progreso.
13. Docente consulta el perfil permitido de sus semestres (sin datos sensibles ni notas).
14. Dirección y sociedad consultan analítica descriptiva, con umbral de privacidad.

## Scripts útiles (raíz)

| Script | Descripción |
|--------|-------------|
| `npm run db:up` / `db:down` | Levanta/apaga PostgreSQL (Docker) |
| `npm run db:reset` | Reinicia PostgreSQL desde cero (borra el volumen) |
| `npm run api:build` / `api:dev` | Compila / ejecuta la API |
| `npm run api:migrate` | Aplica migraciones TypeORM |
| `npm run seed` | Seeds base (roles, áreas, habilidades, admin) |
| `npm run seed:populate` | Pobla la base con cuentas institucionales y datos amplios |
| `npm run test:all` | Las 15 suites de integración |
| `npm run web:dev` / `web:build` | Servidor de desarrollo / compilación web |
| `npm run mobile:start` | Inicia Expo (app móvil) |
| `npm run mobile:typecheck` | Comprobación de tipos del móvil |

## Alcance

Los diez objetivos específicos están implementados de extremo a extremo:

1. **Usuarios, autenticación, roles y control de acceso.** Identidad provisionada
   por la institución con activación real, sesión por rol, desactivación efectiva
   (un usuario desactivado pierde acceso de inmediato, aunque su token siga
   vigente), **semestres habilitados por docente**, importación idempotente del
   padrón y catálogos con estado.
2. **Perfil estudiantil dinámico.** Semestre institucional que el estudiante no
   puede cambiar, áreas de interés con prioridad, habilidades con nivel y su
   origen —lo autodeclarado se muestra como autodeclarado—, áreas de mejora,
   completitud automática y un resumen que integra la trayectoria real.
3. **Actividades académicas y extracurriculares.** El director de carrera gestiona
   las académicas y la sociedad científica las extracurriculares, sobre un
   **catálogo de categorías administrable**, con estados, cupos, filtros por
   categoría, área, modalidad y fecha, detalle e inscripción desde la app móvil.
4. **Participación, evidencias y certificados, con validación automática.**
   Registro de asistencia por el responsable, **subida real de archivos**
   verificados por su firma y no por lo que declare el cliente, evidencias
   asociadas a proyecto, actividad o área, certificados externos, constancia
   interna emitida solo por el director, y un motor que comprueba lo adjuntado y
   le asigna un **nivel de respaldo** en vez de darlo por bueno.
5. **Portafolio de proyectos estudiantiles.** Proyectos con área, tecnologías,
   enlaces, evidencias y **nivel de visibilidad**; invitación de integrantes donde
   **la pertenencia se crea solo cuando el invitado acepta**; el docente consulta
   el portafolio de sus semestres habilitados y registra retroalimentación
   orientativa, sin nota ni aprobación.
6. **Motor de afinidad V2, explicable.** Calcula niveles por área a partir de
   intereses, habilidades, participación, proyectos, evidencias, certificados y
   constancias, con rendimientos decrecientes y topes por familia de señal. Cada
   puntaje se abre para ver **de dónde sale**, línea por línea, y la suma del
   desglose es exactamente el puntaje. Junto a la afinidad va el **respaldo**:
   cuánto de eso está demostrado. Es orientación, no evaluación.
7. **Recomendaciones académicas ligeras.** Actividades, oportunidades, cursos,
   recursos de apoyo, áreas de fortalecimiento y posibles compañeros. **Cada
   sugerencia explica por qué**, y su puntaje es la suma de sus motivos. El
   estudiante guarda o descarta, y lo descartado no vuelve.
8. **Colaboración.** Perfil público con enlace propio, **contactos por QR**,
   equipos formados a partir de una necesidad declarada, y mensajería que solo se
   abre entre quienes tienen una relación que la justifique.
9. **Gamificación y trayectoria.** Puntos e insignias derivados de hechos reales
   —nunca incrementados a ciegas—, resumen de trayectoria y **exportación a PDF**.
10. **Reportes y analítica descriptiva.** Evolución del estudiante, tendencias de
    la carrera, mapa de áreas, panel del docente limitado a su alcance y métricas
    de la sociedad científica, todo con **umbral de privacidad** para no describir
    grupos tan pequeños que describirlos sea señalar a una persona.

### Documentación

Empiece por [`docs/EL_SISTEMA_COMPLETO.md`](docs/EL_SISTEMA_COMPLETO.md): todo el
sistema explicado con diagramas de flujo, sin necesidad de abrir el código.

Los batches de AFINIA 100, cada uno con lo que cambió y por qué:

- [`docs/BATCH_1_IDENTIDAD_Y_SEGURIDAD.md`](docs/BATCH_1_IDENTIDAD_Y_SEGURIDAD.md)
- [`docs/BATCH_2_PERFIL_Y_ONBOARDING.md`](docs/BATCH_2_PERFIL_Y_ONBOARDING.md)
- [`docs/BATCH_3_STORAGE_Y_VALIDACION.md`](docs/BATCH_3_STORAGE_Y_VALIDACION.md)
- [`docs/BATCH_4_ACTIVIDADES.md`](docs/BATCH_4_ACTIVIDADES.md)
- [`docs/BATCH_5_PROYECTOS.md`](docs/BATCH_5_PROYECTOS.md)
- [`docs/BATCH_6_AFINIDAD_V2.md`](docs/BATCH_6_AFINIDAD_V2.md)
- [`docs/BATCH_7_RECOMENDACIONES.md`](docs/BATCH_7_RECOMENDACIONES.md)
- [`docs/BATCH_8_COLABORACION.md`](docs/BATCH_8_COLABORACION.md)
- [`docs/BATCH_9_GAMIFICACION_Y_EXPORT.md`](docs/BATCH_9_GAMIFICACION_Y_EXPORT.md)
- [`docs/BATCH_10_REPORTES_Y_ANALITICA.md`](docs/BATCH_10_REPORTES_Y_ANALITICA.md)
- [`docs/BATCH_11_HARDENING.md`](docs/BATCH_11_HARDENING.md)
- [`docs/BATCH_12_REGRESION_Y_LIMPIEZA.md`](docs/BATCH_12_REGRESION_Y_LIMPIEZA.md)

El estado final punto por punto, con qué demuestra cada uno:
[`docs/CHECKLIST_FINAL_AFINIA_100.md`](docs/CHECKLIST_FINAL_AFINIA_100.md).

Las matrices de trazabilidad y los informes de avance del 40 % al 70 % siguen en
[`docs/`](docs/). Son el registro de cómo se llegó hasta aquí, no la descripción
del sistema actual: para eso está la especificación definitiva.

## Fuera del alcance, a propósito

- **Predicción de rendimiento, abandono o éxito profesional.** No es que falte:
  §64 la prohíbe. El sistema describe lo que ocurrió y se cuida de no sugerir que
  anticipa nada.
- **Certificados oficiales.** Los emite la universidad. Aquí solo hay constancias
  internas de participación, que son otra cosa y lo dicen.
- **Integración real con SIU y Teams.** El padrón entra por importación de archivo.
- **Autoridad académica.** No hay notas, ni aprobación, ni evaluación de personas.
