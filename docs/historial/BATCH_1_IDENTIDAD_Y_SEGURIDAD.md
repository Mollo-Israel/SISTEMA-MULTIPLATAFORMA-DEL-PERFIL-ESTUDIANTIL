# BATCH 1 — Identidad y seguridad

> Reporte con el formato de §142 de `AFINIA_100_ESPECIFICACION_DEFINITIVA.md`.
> Rama: `feat/afinia-100`. `main` no se ha tocado.

**BATCH:** 1 — Identidad y seguridad (§126)
**Estado:** Completado. 574 verificaciones automatizadas en verde, 0 fallos.

---

## Implementado

### 1. Eliminación del registro público (§9)

`POST /auth/register` ya no existe: ni la ruta, ni el DTO, ni el método del
servicio. Una cuenta solo puede nacer por alta administrativa
(`POST /users`) o por importación de padrón. El rol `ADMIN` sigue creándose
por *seed* y no es provisionable desde la interfaz.

`POST /users` acepta ahora el rol `STUDENT` —antes lo rechazaba porque el
estudiante «se registraba por su cuenta»— y la contraseña pasó a ser
**opcional**: si no se envía, el servidor guarda un hash aleatorio que nadie
conoce. La contraseña real la fija el titular al activar, de modo que no hay
ninguna clave que el administrador tenga que comunicar por un canal inseguro.

### 2. Estados de cuenta (§12)

`UserStatus` pasó de dos valores a cuatro:

| Estado | Puede operar | Cómo se llega |
|---|---|---|
| `pending_activation` | No | Al provisionar la cuenta |
| `active` | Sí | El titular activa con su token |
| `suspended` | No | Decisión administrativa reversible |
| `inactive` | No | Baja |

`OPERABLE_USER_STATUSES` es la única lista que decide quién opera, y solo
contiene `active`. Suspender o desactivar revoca en el acto todas las sesiones
y todos los tokens pendientes de esa cuenta.

Una cuenta `pending_activation` **no** se puede pasar a `active` desde la
administración: activarla es un acto de su titular, que demuestra control del
correo. Lo que sí puede hacer el administrador es reenviar el enlace.

### 3. Importación de padrón (§10)

Dos pasos separados a propósito, `POST /imports/students/preview` y
`POST /imports/students/:id/apply`. La previsualización se **persiste**: lo que
se aplica es exactamente lo que se mostró, no un segundo análisis que podría
diferir si los datos cambiaron entre medias.

Cada fila recibe un veredicto: `NEW`, `UPDATE`, `UNCHANGED`, `CONFLICT` o
`INVALID`. Solo las dos primeras escriben algo. La identificación es por
`university_code` y, en su defecto, por correo institucional; cuando ambos
apuntan a personas distintas —o se repiten dentro del archivo— la fila se marca
`CONFLICT` y no se toca nada.

Ausencia no es baja: una cuenta que no aparezca en el archivo **no** se
desactiva. Aplicar dos veces el mismo lote no duplica nada.

Los correos de activación se envían **fuera** de la transacción (RNF09): un
SMTP lento o caído no debe deshacer un padrón ya aplicado.

### 4. Activación y recuperación (§12, §13)

Cuatro endpoints públicos con su propio límite de peticiones:
`/activation/request`, `/activation/activate`, `/activation/forgot-password`,
`/activation/reset-password`.

Los tokens se guardan **solo como hash SHA-256**; la comparación usa
`timingSafeEqual`. Emitir uno nuevo revoca el anterior del mismo propósito, y
consumirlo lo marca usado: un token reutilizado se rechaza.

La respuesta es idéntica exista o no la cuenta. Si cambiara, el endpoint se
convertiría en un verificador de qué correos están registrados.

Restablecer la contraseña revoca todas las sesiones abiertas de esa cuenta.

Política de contraseña (§13): mínimo **12** caracteres, mayúscula, minúscula,
número y símbolo, sin espacios, y no puede contener el correo ni el código
universitario del titular.

### 5. Sesiones y refresh (§14)

El *login* devuelve `{ accessToken, refreshToken, expiresIn, user }`. El access
token dura minutos; el refresh es de larga duración, se guarda hasheado y
**rota en cada canje**. Reutilizar un refresh ya canjeado no devuelve nada,
porque la rotación es una actualización condicional sobre el hash anterior.

Endpoints: `POST /auth/refresh`, `POST /auth/logout`,
`DELETE /auth/sessions` (cerrar todas) y `GET /auth/sessions` (ver las
abiertas, con dispositivo y última actividad).

El estado de la cuenta se explica **después** de verificar la contraseña. Al
revés, «esta cuenta está suspendida» ante una clave incorrecta confirmaría que
la cuenta existe.

### 6. Rate limiting (§15)

Un único limitador global configurable más dos perfiles concretos aplicados por
decorador: `AUTH_RATE_LIMIT` en `/auth/login` y `ACTIVATION_RATE_LIMIT` en los
cuatro endpoints de activación. Los tres se leen de variables de entorno, de
modo que el entorno de pruebas puede subirlos sin tocar código.

### 7. Seguridad de entorno (§83, §84, §100)

- **Descarga de archivos autorizada.** Se eliminó `useStaticAssets`, que servía
  el directorio de subidas a cualquiera que adivinara un nombre. Ahora
  `GET /files/:key` exige sesión y comprueba la autorización real: propiedad,
  pertenencia al proyecto, alcance del docente y visibilidad. Los certificados
  son del titular o del administrador, de nadie más. Una clave desconocida
  devuelve 404, no 403, para no confirmar qué archivos existen. El recorrido de
  rutas se rechaza y, además, se verifica que la ruta resuelta siga dentro del
  almacén.
- **Auditoría (§70).** Tabla `audit_events` con actor, tipo, entidad y
  metadatos. `record()` nunca lanza: auditar no puede tumbar la operación que
  está auditando. Los metadatos se saneen antes de guardarse —se eliminan
  claves como `password` o `token` y se truncan las cadenas largas—.
- **Cabeceras y arranque.** `helmet`, `trust proxy`, Swagger detrás de
  `SWAGGER_ENABLED`, y `assertEnvironment()` que impide arrancar en producción
  sin `WEB_ORIGINS`, `INSTITUTIONAL_EMAIL_DOMAINS` ni `SMTP_HOST`.
- **Alcance del docente en reportes (§68).** *Hallazgo crítico H1 del BATCH 0:*
  los tres reportes docentes devolvían agregados de toda la carrera, incluida
  la lista nominal de estudiantes con perfil incompleto, sin filtrar por los
  semestres habilitados. Ahora los tres resuelven el alcance con
  `TeacherScopeService` antes de consultar, y un docente sin semestres recibe
  formas vacías, no los datos de todos.

### 8. Correo (`MAIL_PORT`)

Puerto con dos adaptadores: consola (registra el mensaje) y SMTP (carga
`nodemailer` de forma perezosa). La fábrica elige consola cuando `SMTP_HOST`
está vacío. En ese caso —y solo si además no es producción— el token de
activación viaja en la respuesta, para poder probar el alta sin servidor de
correo. En producción nunca se expone.

### 9. Interfaz web (§126)

- `tokenStore` guarda el par de tokens y el interceptor de respuesta renueva la
  sesión de forma transparente ante un 401, reintentando la petición original
  una sola vez. Las peticiones que caducan a la vez comparten un único canje:
  como el refresh rota, sin eso solo la primera funcionaría y el resto cerraría
  la sesión del usuario.
- `LoginPage` perdió el modo «crear cuenta» y ganó enlaces a activar y
  recuperar. La portada ofrece «Activar mi cuenta» en lugar de «Crear mi
  cuenta».
- Pantallas nuevas: `/activar`, `/activar/solicitar`, `/recuperar` y
  `/restablecer`, con los requisitos de contraseña visibles mientras se
  escribe.
- `/admin/imports`: subir CSV, contadores por veredicto que además filtran la
  tabla, aplicar o descartar con confirmación, e historial de lotes con su
  detalle fila por fila. Incluye descarga de la plantilla.
- La gestión de usuarios muestra los cuatro estados, reenvía el enlace de
  activación a las cuentas pendientes y suspende o reactiva el resto. El alta
  ya no pide contraseña.

### 10. Interfaz móvil (§126)

- Mismo almacén de dos tokens sobre `SecureStore`, con idéntica renovación
  compartida.
- `LoginScreen` pasó de dos modos (entrar / registrarse) a cuatro: entrar,
  activar, recuperar y restablecer. El registro desapareció.
- Cerrar sesión avisa al servidor; si falla —sin red, por ejemplo— se limpia
  igualmente el teléfono, porque dejar al usuario dentro sería peor que perder
  una revocación que la caducidad resolverá sola.

---

## Migraciones

`api/src/database/migrations/1780280000000-Batch1IdentityAndSecurity.ts`

**`up`**

- Recrea `users_status_enum` con los cuatro valores. El `USING` convierte los
  datos existentes, de modo que **los 230 usuarios que había al migrar se
  conservaron como `active`**. El nuevo `DEFAULT` es `pending_activation`.
- Crea `account_tokens`, `auth_sessions`, `import_batches`,
  `import_batch_rows` y `audit_events`.
- Añade el índice único parcial `UQ_student_profiles_university_code`, que solo
  aplica cuando el código no es nulo.

**`down`**

Revierte las cinco tablas y el índice, y devuelve el enum a dos valores
mapeando `pending_activation` y `suspended` a `inactive`. La reversión es
posible; lo que no puede recuperar es la distinción entre esos estados, porque
en el esquema anterior no existe.

`synchronize` sigue en `false`.

---

## Archivos principales

**Contratos compartidos**
- `shared/src/enums/identity.enum.ts` *(nuevo)*
- `shared/src/enums/user.enum.ts`

**Entidades**
- `api/src/entities/account-token.entity.ts` *(nuevo)*
- `api/src/entities/auth-session.entity.ts` *(nuevo)*
- `api/src/entities/import-batch.entity.ts` *(nuevo)*
- `api/src/entities/audit-event.entity.ts` *(nuevo)*

**Módulos nuevos**
- `api/src/identity/` — `account-tokens.service.ts`, `auth-sessions.service.ts`,
  `activation.service.ts`, `activation.controller.ts`
- `api/src/imports/` — `csv.parser.ts`, `imports.service.ts`,
  `imports.controller.ts`
- `api/src/audit/` — `audit.service.ts`, `audit.controller.ts`
- `api/src/mail/` — `mail.port.ts`, `mail.module.ts`

**Modificados**
- `api/src/auth/auth.service.ts`, `auth.controller.ts` *(sin `register`)*
- `api/src/users/users.service.ts`, `users.controller.ts`,
  `dto/create-user.dto.ts`, `dto/set-status.dto.ts`
- `api/src/reports/reports.service.ts` *(corrección H1)*
- `api/src/storage/file-access.service.ts`, `files.controller.ts` *(nuevos)*,
  `storage.module.ts`
- `api/src/main.ts`, `app.module.ts`, `common/validation.ts`,
  `config/identity.config.ts`, `config/environment.check.ts`, `load-env.ts`

**Web**
- `web/src/api/client.ts`, `services/index.ts`, `services/types.ts`,
  `auth/AuthContext.tsx`, `pages/LoginPage.tsx`, `pages/LandingPage.tsx`,
  `pages/admin/Users.tsx`, `App.tsx`, `navigation.ts`
- `web/src/pages/auth/` *(nuevo)* — `SetPasswordPage.tsx`,
  `RequestTokenPage.tsx`, `passwordPolicy.ts`
- `web/src/pages/admin/Imports.tsx` *(nuevo)*

**Móvil**
- `mobile/src/api/client.ts`, `services/index.ts`, `auth/AuthContext.tsx`,
  `screens/LoginScreen.tsx`

**Configuración**
- `.env.example` reescrito según §100 (unas 30 variables, agrupadas y
  comentadas).

---

## Pruebas

| Suite | Comando | Verificaciones |
|---|---|---|
| Objetivos del 40 % | `npm run test:40` | 242 |
| Objetivo 5 | `npm run test:50` | 112 |
| Objetivo 6 | `npm run test:60` | 82 |
| Objetivo 7 | `npm run test:70` | 84 |
| **BATCH 1** *(nueva)* | `npm run test:b1` | **54** |
| | | **574** |

`scripts/e2e-batch-1.mjs` cubre los puntos que §87 declara obligatorios:

- **§87.2 — Importación (B1.1–B1.21):** plantilla incompleta rechazada, los
  cinco veredictos, conflicto por código y correo cruzados, duplicado dentro
  del archivo, aplicar solo `NEW`/`UPDATE`, idempotencia, ausencia que no
  desactiva, descarte, y que un no administrador no pueda importar.
- **§87.3 — Activación (B2.1–B2.11):** cuenta pendiente que no puede entrar,
  token inválido, contraseña débil rechazada, activación válida, token
  reutilizado, respuesta genérica ante correo inexistente, restablecimiento que
  cierra las sesiones.
- **§14 — Sesiones (B3.1–B3.11):** el *login* entrega ambos tokens, el refresh
  rota, el access renovado sirve de verdad, el refresh reutilizado se rechaza,
  cerrar sesión invalida la suya, cerrar todas invalida todas, y suspender la
  cuenta corta el acceso en el acto.
- **§68 — Alcance docente (B4.1–B4.8):** un docente sin semestres no recibe ni
  conteos de carrera ni la lista nominal; con un semestre, el informe declara su
  alcance y nunca supera el total de la carrera; el director sí ve el agregado.
- **§83 — Archivos (B5.1–B5.2):** sin sesión se rechaza antes de mirar el
  archivo, y el recorrido de rutas no alcanza nada fuera del almacén.

Las cuatro suites anteriores se migraron al flujo real —provisionar, activar,
entrar— en lugar de saltárselo. El bloque RF1 de la suite del 40 % se reescribió
como RF01/RF02 (1.1–1.14) para comprobar lo contrario de lo que comprobaba: que
el registro público **no** existe.

**Dos comprobaciones afirmaban lo que §83 corrige.** `4.21 El archivo queda
accesible por su URL` daba por buena la vulnerabilidad. Se invirtieron: ahora
verifican que sin sesión hay 401, que el titular sí descarga y que un tercero
no.

**Verificación manual adicional**

```text
GET /api/files/cualquier.pdf  sin sesión   -> 401  (antes servía el archivo)
12 inicios de sesión seguidos              -> 200  (límites configurados)
POST /users sin contraseña                 -> 201  pending_activation + token
```

`npm run web:build` y `npx tsc --noEmit` en `mobile/` pasan sin errores.

---

## Resultados

- **574 verificaciones OK · 0 fallos.**
- Ningún usuario existente perdió el acceso: los 230 que había al aplicar la
  migración quedaron en `active`.
- Dos hallazgos críticos del BATCH 0 quedan cerrados: **H1** (reportes docentes
  sin alcance) y **H2** (almacén de archivos servido sin autorización).
- `main` intacta. Nada se ha fusionado.

---

## Pendientes

Ninguno dentro de §126. Lo que sigue pertenece a los batches posteriores:

- **BATCH 2 (§127)** — datos institucionales no editables, cuestionario de
  onboarding, `suggested_areas[]`, disponibilidad, preferencias de
  colaboración, visibilidad.
- **BATCH 3 (§128)** — SHA-256 de evidencias, extracción de PDF, OCR,
  verificador de enlaces a prueba de SSRF, `validation_records`.

Dos detalles conscientes, documentados en el código:

- `bcrypt` trunca a 72 bytes, mientras que §13 admite hasta 128 caracteres. Una
  contraseña más larga que eso se compara por sus primeros 72 bytes. Se deja
  anotado en el código en lugar de silenciarlo; cambiar de algoritmo excede
  este batch.
- El token de activación se devuelve en la respuesta **solo** cuando no hay
  SMTP y el entorno no es producción. Es lo que permite que las suites prueben
  el camino completo sin servidor de correo.

---

## Riesgos

1. **Toda cuenta nueva nace inutilizable hasta que su titular la active.** Es
   el comportamiento que pide §12, pero cambia la operativa: quien provisione
   cuentas debe saber que el enlace es imprescindible. La pantalla de
   administración reenvía el enlace en un clic.
2. **Sin SMTP configurado, en producción nadie podría activar su cuenta.** Por
   eso `assertEnvironment()` impide arrancar en producción sin `SMTP_HOST`. En
   desarrollo solo avisa.
3. **El `down` de la migración no distingue estados.** Revertir convierte
   `pending_activation` y `suspended` en `inactive`, porque el esquema anterior
   no tiene dónde guardarlos. Hay respaldo previo en
   `backups/baseline-pre-afinia100-20260920.sql`.
4. **Los límites de peticiones locales están subidos** para que las suites
   quepan. Los valores de producción son los de `.env.example`, más
   restrictivos.
