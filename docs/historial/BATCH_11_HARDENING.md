# BATCH 11 — Hardening final

**Especificación:** `AFINIA_100_ESPECIFICACION_DEFINITIVA.md` §83, §84, §85, §86, §100, §102, §103, §110, §136
**Rama:** `feat/afinia-100`
**Estado:** completo · 1139 verificaciones automatizadas, 0 fallos

---

## 1. Qué pedía §136

> Revisar: autorización de archivos; cabeceras; CORS; Swagger; registros;
> limpieza de huérfanos; seguridad de URL; revocación de sesión; permisos;
> dependencias; compilación limpia.

Once puntos. Cinco ya estaban bien y se auditaron sin tocarlos. Seis tenían algo
roto o ausente, y ese es el contenido real de este batch.

Un hardening que solo se afirma en un documento no es hardening: cada punto de
abajo tiene una verificación que falla si alguien lo deshace.

---

## 2. CORS miraba una variable que nadie define

Es el hallazgo más serio del batch, y no se veía.

`resolveCorsOptions` leía `CORS_ORIGINS`. Pero §100 nombra la variable
`WEB_ORIGINS`, y `assertEnvironment` —la comprobación que impide arrancar un
despliegue mal configurado— también exige `WEB_ORIGINS`.

Las dos mitades nunca se hablaron. Quien configurara el sistema siguiendo la
especificación definía `WEB_ORIGINS`, el arranque le decía que todo estaba en
orden, y CORS se quedaba sin lista, aceptando **cualquier origen**. En
producción ni siquiera fallaba ruidosamente: la validación de entorno veía su
variable presente y dejaba pasar.

El fallo tenía la peor forma posible: silencioso, y precisamente en quien hizo
las cosas bien.

Ahora `resolveCorsOptions` lee `WEB_ORIGINS`, que es el nombre que fija §100.
`CORS_ORIGINS` sigue funcionando como alias histórico, para no romper un
despliegue que ya lo tuviera puesto.

De paso, un `*` explícito se respeta pero nunca con credenciales: las dos cosas
juntas convierten cualquier página en un cliente autenticado.

---

## 3. Un cuerpo desmedido respondía «error del servidor»

No había límite de cuerpo para JSON. Las subidas van por `multipart` con su
propio tope (§27), pero un `POST /auth/login` con cuatrocientos mil caracteres
de contraseña se procesaba entero. No tiene ningún uso legítimo y sí sirve para
agotar la memoria del proceso.

Puesto el límite en 256 kB, apareció el segundo problema: express lanza su error
con un `status` de 413 pero **sin ser un `HttpException`**, así que el filtro lo
recogía por la rama del error no controlado y respondía 500.

La diferencia no es cosmética. Un 500 le dice al cliente «falló el servidor,
reintenta»; un 413 le dice «tu petición es demasiado grande, no la reintentes
igual». El primero invita justo a repetir lo que no debe repetirse.

El filtro ahora reconoce los errores de express que traen un estado 4xx propio y
los responde con ese estado.

---

## 4. §85 · Borrar una cuenta destruía una trayectoria entera

`DELETE /users/:id` hacía un borrado real. Mirando el grafo de claves foráneas,
de `student_profiles` cuelgan **veintiocho tablas en cascada**: afinidad,
proyectos, evidencias, contribuciones, puntos, equipos, mensajes.

Borrar una cuenta no era quitar a alguien de una lista. Era destruir su historial
académico completo y, con los proyectos compartidos, parte del de otros. Un clic
de administración, irreversible, sin aviso.

§85 lo dice sin rodeos: *preferir `status = INACTIVE` sobre hard delete*, y
reservar el borrado a *datos de prueba o cuentas sin historial*.

Ahora:

- `DELETE /users/:id` **da de baja**: estado inactivo y sesiones revocadas. Es
  lo que se persigue el 99 % de las veces —cerrar el acceso— y deja la historia
  intacta.
- `DELETE /users/:id?hard=true` borra de verdad, y **se niega con 409** si la
  cuenta tiene perfil estudiantil. El mensaje no se limita a negar: explica que
  lo que corresponde es dar de baja.

No se cuenta el historial tabla por tabla. La existencia del perfil es condición
suficiente, porque es de él de donde cuelga todo lo demás.

---

## 5. §136 · Los archivos que nadie llegó a adjuntar

Subir un archivo y adjuntarlo son dos pasos. Quien abandona el formulario entre
uno y otro deja el archivo escrito en disco y su fila en `stored_files`, sin que
nada vuelva a nombrarlo nunca.

No es un fallo visible —nadie ve un error— pero acumula: cada intento descartado
de subir una constancia se queda ahí para siempre.

`OrphanFilesService` barre lo abandonado cada seis horas. Tres decisiones que
importan:

**Qué cuenta como huérfano.** El archivo que no menciona ningún certificado ni
ninguna evidencia, y que tampoco es el original del que otro se declaró duplicado
(§28). Borrar ese original dejaría a su duplicado apuntando a nada, y con él la
única razón por la que el sistema sabe que no debe contar dos veces el mismo
documento.

**El periodo de gracia.** Veinticuatro horas por omisión. Es lo que separa
«abandonado» de «todavía en curso»; sin él, la limpieza sería una carrera contra
el usuario que está llenando el formulario.

**El orden de borrado.** Primero el archivo, después su fila. Al revés, una caída
entre ambos pasos dejaría un archivo que nadie puede volver a encontrar para
borrarlo. En este orden, una caída deja una fila cuyo archivo ya no está, y la
vuelta siguiente la recoge y termina el trabajo.

`POST /uploads/cleanup-orphans`, solo administración, permite provocar una vuelta
sin esperar a la siguiente.

---

## 6. §84 · Un enlace sin esquema no es un enlace

Se comprobó primero lo que ya hacía `validator.isURL` por omisión, en vez de
suponerlo: `javascript:`, `data:`, `vbscript:` y `file:` **ya se rechazaban**. No
había un agujero de ejecución de scripts.

Lo que sí pasaba: `ftp://…` se aceptaba, y `ejemplo.com` sin esquema también.
Este último es el que molesta de verdad, porque el navegador lo interpreta como
ruta relativa y el enlace guardado no lleva a ninguna parte.

Los seis campos de URL del sistema —enlace de actividad, de certificado, de
evidencia, de evidencia de proyecto, repositorio y demo— exigen ahora `http` o
`https` con esquema explícito.

---

## 7. §102, §103 · Registro y forma del error

**Identificador de petición.** `RequestIdMiddleware` pone un `x-request-id` en
cada petición. Va como middleware y no como interceptor a propósito: un error en
un guard ocurre **antes** de los interceptores, y sin identificador ese error no
se puede rastrear, que es justo cuando más falta hace. El identificador que
llegue de fuera se sanea antes de reutilizarlo.

**Una sola forma de error.** `{ code, message, details?, requestId? }`, la misma
para los cuatrocientos y para los quinientos: un cliente que distingue dos
formatos según el estado acaba tratando mal uno de los dos.

**Nada de trazas en producción.** Una traza revela rutas del sistema de archivos,
versiones de dependencias y, cuando el error viene de la base, fragmentos de la
consulta con los valores dentro. Un error no controlado responde un mensaje
genérico y su `requestId`: quien lo reporta da ese identificador y el registro
del servidor tiene el detalle. El usuario obtiene lo justo para pedir ayuda, y
nadie obtiene un mapa del sistema.

Un `QueryFailedError` nunca llega tal cual: el mensaje de PostgreSQL suele
incluir el nombre de la restricción, el de la tabla y los valores que chocaron.

**El registro no toca cuerpos ni cabeceras.** Solo ruta, estado, usuario,
duración y código. Es donde viajan las contraseñas y los tokens.

**Mensajes de validación en español.** `class-validator` los redacta en inglés, y
al usuario le llegaba «password must be a string». Se traducen en un solo sitio:
ponerlo decorador por decorador serían doscientas ediciones que además hay que
repetir en cada DTO nuevo, y basta olvidarse una vez. Un mensaje escrito a mano
en el DTO sigue ganando siempre.

---

## 8. Lo que se auditó y ya estaba bien

No todo lo de §136 estaba roto. Estos cinco puntos se verificaron y se
conservaron sin cambios:

- **§83 · autorización de archivos.** Los archivos no se sirven como estáticos.
  La descarga pasa por `FilesController`, que exige sesión y comprueba la
  autorización sobre la entidad que contiene el archivo. Conocer la URL no basta:
  verificado con sesión ajena y sin sesión.
- **§84 · cabeceras.** `helmet` puesto, con la CSP delegada al cliente web porque
  esta API no sirve HTML.
- **§110 · Swagger.** Deshabilitado en producción salvo `SWAGGER_ENABLED=true`.
- **§14 · revocación de sesión.** Cerrar sesión invalida el token de refresco de
  verdad, no solo en el cliente.
- **Permisos.** El rol y el estado se leen de la base en cada petición, no del
  token: un usuario desactivado pierde el acceso de inmediato y un rol manipulado
  dentro del token no tiene ningún efecto.

---

## 9. Dependencias

`npm audit fix` aplicado (sin `--force`): solo movió dependencias de desarrollo.

Quedan **4 advertencias de severidad alta en dependencias de producción**:
`multer`, `js-yaml` (vía `@nestjs/swagger`), `lodash` (vía `@nestjs/config`) y
una transitiva más. Las cuatro se resuelven únicamente subiendo NestJS de la 10 a
la 12, que son **cambios mayores** en `@nestjs/platform-express`, `@nestjs/config`
y `@nestjs/typeorm`.

**No se hizo, deliberadamente.** Un salto de dos versiones mayores en el
framework, a esta altura del proyecto, es una decisión de alcance que no
corresponde tomar dentro de un batch de hardening. Queda documentado para que se
decida a la vista, no por omisión.

---

## 10. Migraciones

Ninguna. El batch no cambia el esquema: `OrphanFilesService` consulta tablas que
ya existen y la baja de usuarios usa la columna `status` que ya estaba.

---

## 11. Archivos principales

**Nuevos**

- `api/src/common/request-context.ts` — identificador por petición (§102).
- `api/src/common/http-exception.filter.ts` — forma única de error (§103).
- `api/src/common/request-logging.interceptor.ts` — registro sin secretos (§102).
- `api/src/common/validation-messages.ts` — mensajes de validación en español.
- `api/src/storage/orphan-files.service.ts` — limpieza de huérfanos (§136).
- `scripts/e2e-batch-11.mjs` — la suite del batch.

**Modificados**

- `api/src/config/security.config.ts` — CORS lee `WEB_ORIGINS` (§100).
- `api/src/main.ts` — límite de cuerpo, filtro, interceptor, mensajes.
- `api/src/app.module.ts` — middleware del identificador de petición.
- `api/src/users/users.service.ts`, `users.controller.ts` — baja antes que
  borrado (§85).
- `api/src/storage/uploads.controller.ts`, `storage.module.ts` — limpieza.
- Seis DTO con campos de URL — esquema `http`/`https` obligatorio (§84).
- `.env.example` — variables de la limpieza de huérfanos.

---

## 12. Pruebas

```
npm run test:b11
```

46 verificaciones sobre la API en marcha: formato de error, trazabilidad,
cabeceras, CORS, límite de cuerpo, autorización de descarga, limpieza de
huérfanos, seguridad de URL, revocación de sesión y baja de usuarios.

**Regresión completa** — 15 suites contra la API en marcha:

| Suite | Verificaciones |
|---|---|
| `e2e-objectives-40` | 248 |
| `e2e-objective-5` | 116 |
| `e2e-objective-6` | 86 |
| `e2e-objective-7` | 89 |
| `e2e-batch-1` … `e2e-batch-11` | 600 |
| **Total** | **1139 · 0 fallos** |

**Compilación limpia** — `tsc --noEmit` en `api/` y en `mobile/`, y
`npm run web:build`: los tres sin errores.

**Verificación aparte del borrado de huérfanos.** La suite demuestra que la
limpieza *no* se lleva lo que está en uso; que *sí* se lleva lo abandonado exige
envejecer la fila a mano, porque nadie va a esperar veinticuatro horas, y eso se
hace por `psql`, fuera del alcance de una suite que solo habla HTTP. Comprobado:
la fila desaparece de `stored_files` y el archivo desaparece del disco.

---

## 13. Pendientes

- **`scripts/api-tests.mjs` está obsoleta.** Es la suite de la etapa del 30 % y
  prueba `POST /auth/register`, una ruta que la especificación definitiva
  **eliminó**: §12 exige cuenta *provisionada* por la institución, no
  autorregistro. Falla entera desde el primer paso y seguiría fallando aunque
  todo el sistema estuviera perfecto. Es material de BATCH 12 (§137, «rutas
  obsoletas»), no una regresión de este batch.
- Subida de NestJS 10 → 12, con las 4 advertencias altas que arrastra (§9).

---

## 14. Riesgos

- **La limpieza de huérfanos borra datos.** Es su trabajo, pero conviene decirlo:
  el periodo de gracia es la única defensa contra barrer un archivo en curso. Si
  alguien baja `ORPHAN_CLEANUP_GRACE_HOURS` a un valor pequeño, la defensa
  desaparece. Por eso el valor por omisión es generoso y `.env.example` lo
  advierte.
- **Dar de baja no es anonimizar.** §85 queda cumplido en cuanto a no destruir
  trayectorias, pero una cuenta inactiva conserva su nombre y su correo. Si
  aparece un requisito de borrado de datos personales, no se resuelve con esto.
- **El límite de 256 kB es una apuesta.** Ningún cuerpo JSON legítimo del sistema
  se acerca; si en el futuro alguna importación masiva lo necesita, fallará con
  413 y habrá que subirlo para esa ruta, no globalmente.
