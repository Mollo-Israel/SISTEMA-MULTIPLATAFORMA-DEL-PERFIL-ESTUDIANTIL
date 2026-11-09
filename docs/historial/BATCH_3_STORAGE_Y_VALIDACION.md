# BATCH 3 — Storage y validación

> Reporte con el formato de §142 de `AFINIA_100_ESPECIFICACION_DEFINITIVA.md`.
> Rama: `feat/afinia-100`. `main` no se ha tocado.

**BATCH:** 3 — Storage y validación (§128)
**Estado:** Completado. 703 verificaciones automatizadas en verde, 0 fallos.

---

## Implementado

### 1. El archivo deja de ser una URL y pasa a tener dueño (§27)

Este es el cambio que ordena todo lo demás, y cierra una vulnerabilidad real.

Hasta ahora `POST /uploads` devolvía una ruta pública y el cliente la reenviaba
al crear la evidencia. **Nada comprobaba de dónde salía esa ruta.** Bastaba con
adjuntar la URL de otra persona a una evidencia propia y, como la autorización
de descarga se resuelve mirando de quién es la evidencia, quedar autorizado
para leer su archivo. §27 advierte exactamente de ese patrón: *«evitar confiar
en una URL pública que el cliente devuelve luego al API»*.

Ahora la subida devuelve un identificador. El archivo es una fila de
`stored_files` con dueño, y adjuntarlo exige ser ese dueño. Los metadatos
—nombre, tipo, tamaño— los resuelve el servidor a partir de lo que realmente se
subió, no de lo que diga el cliente.

### 2. El tipo se decide por la firma, no por la declaración (§27.3)

El `Content-Type` de una subida lo escribe el cliente: no es un dato sobre el
archivo, es una afirmación de quien lo envía. Se leen los primeros bytes y se
compara con lo declarado; un ejecutable que dice ser PDF se rechaza.

Son cuatro formatos y unas veinte líneas, así que se escribe en el repositorio
en lugar de traer una dependencia. Una comprobación de seguridad que se puede
leer entera en un minuto vale más que una que hay que creerse a ciegas.

El máximo sube a 10 MB, que es lo que fija §27.3.

### 3. SHA-256 y deduplicación (§28)

Cada subida calcula la huella del contenido. Dos subidas idénticas de la misma
persona se reconocen: la segunda apunta a la primera.

**No se rechaza la subida.** El mismo diploma puede respaldar legítimamente dos
cosas distintas; lo que no debe ocurrir es que cuente dos veces, y para decidir
eso primero hay que saber que es el mismo. El mismo contenido de *otra* persona
no es duplicado suyo: cada quien responde por lo que aporta.

### 4. Extracción documental (§29)

La escalera que fija §29, en ese orden y por ese motivo: el texto nativo de un
PDF es exacto, el OCR es una aproximación y el QR es una tercera fuente que
puede corroborar a las otras dos.

**Texto nativo de PDF.** Escrito a mano sobre `zlib`, que ya viene con Node.
Las dos librerías habituales pesan entre 21 y 33 MB —vendoran su propio corpus
de PDFs de prueba— y este proyecto se clona y se entrega. Son unas 150 líneas
que cubren flujos sin comprimir y en FlateDecode, literales con escapes
octales, cadenas hexadecimales, el ajuste de posición de los arreglos `TJ` —sin
el cual el texto sale pegado— y las anotaciones de enlace, que en un
certificado suelen ser la URL de verificación.

No lo cubre todo: fuentes con CMap embebido, codificaciones CID exóticas y
documentos cifrados devuelven poco texto o ninguno. Eso no es un defecto
oculto, es el primer peldaño de una escalera que §29 diseñó precisamente porque
ningún extractor lo lee todo.

**OCR.** Puerto con adaptador sobre `tesseract.js`, cargado de forma perezosa.
No es dependencia declarada a propósito: descarga unos 15 MB de modelo en su
primer uso, y eso no puede ser requisito para levantar la API. Sin el paquete,
el recurso queda `INCONCLUSIVE`, que es exactamente lo que §29 manda cuando el
OCR no puede ejecutarse.

**QR.** Sobre PNG y JPG, con `jsqr`, `pngjs` y `jpeg-js` —aproximadamente 1 MB
entre los tres—. Sobre PDF exigiría rasterizar, que es otra dependencia pesada.
§128 pide el QR «si es viable»; sobre imagen lo es y sobre PDF no, y se dice en
lugar de simularlo.

**Metadata (§29, paso 5).** Titular, emisor, título, fecha, credencial y URL de
verificación, por etiquetas en español e inglés. Son *candidatos*, no hechos:
sirven para comprobar si lo declarado es coherente con el papel, nunca para
sustituir lo que declaró el estudiante. Cuando una etiqueta no aparece, el
campo queda en `null`; preferimos no saber a inventar.

### 5. Niveles de respaldo (§30)

```
DECLARED     — hay algo aportado, pero nada pudo corroborarse
SUPPORTED    — el documento se leyó y su metadata es coherente
CORROBORATED — además, una URL o un QR externo respondió y encaja
```

Un nombre que no corresponde impide subir de `DECLARED` por perfectamente que
se lea el documento: si el papel es de otra persona, lo demás da igual.

La comparación de nombres es por palabras, no por cadena completa, porque los
nombres reales no coinciden literalmente casi nunca: sobra un apellido, falta
el segundo nombre, cambia el orden. `UNKNOWN` cuando no se leyó ningún nombre;
`MISMATCH` solo cuando sí se leyó uno y no comparte casi nada. Acusar de
discrepancia por no haber podido leer sería peor que no decir nada.

Cada respuesta del endpoint repite que Afinia no certifica autenticidad legal.
Se repite a propósito: quien lea un veredicto debe tener delante que esto mide
corroboración técnica.

### 6. Comprobación de enlaces con protección SSRF (§31)

Este servicio hace peticiones a direcciones que escribe un usuario. Sin cuidado
eso es una falsificación de peticiones del lado del servidor: el atacante no
alcanza la red interna, pero el servidor sí, y aquí se le está pidiendo que
vaya a donde le digan.

- solo HTTP y HTTPS, y sin credenciales incrustadas;
- se resuelve el DNS **antes** de conectar y se rechaza toda IP privada, de
  bucle local, enlace local, reservada o de operador;
- se comprueba **cada salto** de una redirección, no solo el primero, porque un
  servidor externo puede redirigir a `127.0.0.1` a propósito;
- basta que *una* resolución sea interna para rechazar: con DNS rotatorio,
  aceptar «alguna es pública» dejaría pasar el ataque una de cada dos veces;
- saltos, tiempo y tamaño de respuesta acotados.

`BLOCKED` y `UNAVAILABLE` son estados distintos a propósito. Si fueran el
mismo, la respuesta diría si una dirección interna existe o no, y el
verificador se convertiría en un escáner de la red a disposición de cualquiera.
Por el mismo motivo, un dominio que no resuelve es `UNAVAILABLE`: no está, no
es que nos negáramos a ir.

**Una comprobación encontró un agujero real durante el desarrollo.**
`http://[::ffff:127.0.0.1]/` lo normaliza `new URL` a su forma hexadecimal
`[::ffff:7f00:1]`, y el filtro comparaba texto, así que la dirección pasaba y
el servidor acababa hablando con su propio bucle local. Se sustituyó por una
expansión de la IPv6 a sus ocho grupos y una comparación numérica: la misma
dirección se escribe de muchas formas y comparar cadenas deja pasar las
variantes que no se previeron.

### 7. Registros de validación y worker persistente (§73.5, §76)

`validation_records` es a la vez la cola y el resultado. Persistir el trabajo es
lo que permite que un reinicio de la API no pierda nada.

El worker vive dentro del monolito, que es lo que §76 permite para no tener que
levantar Redis:

- **reclamo seguro**: es un `UPDATE ... WHERE status = 'pending'` condicional.
  Si dos procesos intentan llevarse la misma fila, la base decide y solo uno ve
  filas afectadas;
- **sin proceso doble**: consecuencia de lo anterior;
- **intentos registrados**: cada reclamo incrementa el contador;
- **retroceso acotado**: 30 s, 2 min, 10 min, y después `FAILED`;
- **nada se pierde al reiniciar**: al arrancar se devuelven a la cola los
  trabajos reclamados por un proceso que ya no existe.

El bucle se agenda con `setTimeout` encadenado, no con `setInterval`, para que
una vuelta lenta nunca solape con la siguiente. `POST /validation/run` permite
forzar una vuelta, que es lo que usan las pruebas para no depender del reloj.

### 8. Interfaz

- **Web** — el selector de archivo avisa cuando el contenido ya se había
  subido, la lista de certificados muestra el nivel de respaldo con su
  explicación, y el formulario acepta el código de credencial. Los textos
  evitan cualquier palabra que suene a autenticidad legal.
- **Móvil** — mismo cambio de contrato y mismo aviso de duplicado.

---

## Migraciones

`api/src/database/migrations/1780300000000-Batch3StorageAndValidation.ts`

**`up`**

- `stored_files` con los metadatos de §27.2, índice único por clave de
  almacenamiento e índice compuesto `(sha256, uploaded_by_user_id)`, que es
  exactamente como consulta la deduplicación.
- `validation_records` con índice único por recurso —lo que hace idempotente
  encolar dos veces— y un índice sobre `(status, next_attempt_at)`, que es lo
  único que pregunta el worker.
- `stored_file_id` en `project_evidences` y `external_certificates`, y
  `credential_id` en los certificados.

**Nada se reescribe.** Las columnas `file_url`, `file_name`, `mime_type` y
`file_size` que ya existían se conservan y se siguen rellenando, de modo que
las evidencias y los certificados anteriores siguen funcionando igual. Lo que
cambia es de dónde viene la autoridad.

`down` revierte todo. `synchronize` sigue en `false`.

---

## Archivos principales

**Contratos compartidos**
- `shared/src/enums/validation.enum.ts` *(nuevo)* — `ValidationResourceType`,
  `ValidationStatus`, `BackingTier`, `IdentityMatchStatus`, `LinkCheckStatus`

**Entidades**
- `api/src/entities/stored-file.entity.ts` *(nuevo)*
- `api/src/entities/validation-record.entity.ts` *(nuevo)*
- `api/src/entities/project-evidence.entity.ts`,
  `external-certificate.entity.ts`

**Motor de validación** *(nuevo)*
- `api/src/validation/pdf-text.ts` — extractor de texto sin dependencias
- `api/src/validation/metadata.extractor.ts` — candidatos y comparación de
  nombres
- `api/src/validation/link-checker.service.ts` — §31 con protección SSRF
- `api/src/validation/ocr.port.ts` — puerto y adaptador perezoso
- `api/src/validation/document-extraction.service.ts` — la escalera de §29
- `api/src/validation/validation.service.ts` — cola, veredicto y niveles
- `api/src/validation/validation.worker.ts` — §76
- `api/src/validation/validation.controller.ts`, `validation.module.ts`

**Almacenamiento**
- `api/src/storage/file-signature.ts` *(nuevo)* — detección por firma real
- `api/src/storage/uploads.service.ts` *(nuevo)* — SHA-256, dedup, propiedad
- `api/src/storage/uploads.controller.ts`, `storage.port.ts`,
  `local-storage.driver.ts`, `storage.module.ts`

**Modificados**
- `api/src/evidences/`, `api/src/certificates/` — adjuntan por identificador y
  encolan validación
- `api/src/audit/audit.service.ts` — dos verbos nuevos
- `api/src/app.module.ts`

**Clientes**
- `web/src/services/types.ts`, `services/index.ts`,
  `pages/student/Evidences.tsx`, `index.css`
- `mobile/src/services/index.ts`, `screens/student/EvidencesScreen.tsx`

**Dependencias añadidas:** `jsqr`, `pngjs`, `jpeg-js` (≈1 MB en total, solo
para leer códigos QR de imágenes).

---

## Pruebas

| Suite | Comando | Verificaciones |
|---|---|---|
| Objetivos del 40 % | `npm run test:40` | 246 |
| Objetivo 5 | `npm run test:50` | 112 |
| Objetivo 6 | `npm run test:60` | 82 |
| Objetivo 7 | `npm run test:70` | 84 |
| BATCH 1 | `npm run test:b1` | 54 |
| BATCH 2 | `npm run test:b2` | 67 |
| **BATCH 3** *(nueva)* | `npm run test:b3` | **58** |
| | | **703** |

`scripts/e2e-batch-3.mjs` construye sus propios PDFs y PNGs en memoria en vez
de guardar binarios en el repositorio: así la prueba enseña exactamente qué
contiene el documento que después dice haber leído. Cubre:

- **§27 (B3.1–B3.13):** la subida devuelve identificador y no URL; se calcula
  la huella; el tipo se detecta del contenido; un ejecutable que dice ser PDF se
  rechaza, y un PNG declarado como PDF también; archivo vacío y sin sesión
  rechazados; **otro estudiante no puede adjuntar mi archivo**; un identificador
  inventado devuelve 404.
- **§28 (B3.14–B3.17):** misma huella para el mismo contenido; la primera
  subida no es duplicado de nada; la segunda apunta a la primera; el mismo
  contenido de otra persona no se marca como duplicado.
- **§29 y §30 (B3.18–B3.35):** la validación se encola al crear; el texto sale
  del PDF sin OCR; se extraen titular, emisor, fecha normalizada a ISO,
  credencial y URL de verificación de la anotación; nombre coincidente →
  `MATCH` y `SUPPORTED`; nombre ajeno → `MISMATCH` y no pasa de `DECLARED`;
  documento ilegible → `INCONCLUSIVE` **y el recurso no se elimina**; sin nombre
  leído → `UNKNOWN`, no `MISMATCH`; el duplicado se reconoce.
- **§31 (B3.36–B3.50):** trece direcciones que el sistema se niega a consultar
  —localhost por nombre, bucle local IPv4 e IPv6, IPv4 mapeada en IPv6, los
  tres rangos privados, metadata de nube, rango de operador, bucle local en
  decimal y abreviado, IPv6 privada, dominio `.local`— más que un servidor
  ausente es `UNAVAILABLE` y no `BLOCKED`.
- **§76 (B3.51–B3.58):** la cola informa de cada estado; encolar es idempotente;
  procesada la cola no queda trabajo ni nada atrapado en `PROCESSING`; el
  veredicto es del titular y la cola es del administrador.

**Tres comprobaciones se reescribieron por asertar en la capa equivocada.**
`localhost`, `2130706433` y `127.1` los rechaza el DTO antes de llegar al
verificador —defensa en profundidad—, así que la comprobación fallaba pese a
que el sistema hacía lo correcto. Ahora se verifica la propiedad que importa:
el servidor nunca consulta esas direcciones, sin importar cuál de las dos
barreras lo detuvo.

`npm run web:build` y `npx tsc --noEmit` en `mobile/` pasan sin errores.

---

## Resultados

- **703 verificaciones OK · 0 fallos.**
- Se cierra la vulnerabilidad de adjuntar el archivo de otra persona.
- Se cierra un bypass de SSRF encontrado durante el desarrollo
  (`::ffff:127.0.0.1` en forma hexadecimal).
- Los datos existentes se conservan: las columnas antiguas siguen ahí y las
  evidencias anteriores funcionan igual.
- `main` intacta. Nada se ha fusionado.

---

## Pendientes

Todo lo de §128 está cubierto. Dos matices declarados, no omitidos:

- **El OCR necesita instalar `tesseract.js`.** Está implementado y se activa
  solo si el paquete está presente. Sin él, los documentos sin texto quedan
  `INCONCLUSIVE`, que es el estado que §29 prevé para ese caso.
- **El QR se lee de imágenes, no de PDFs.** Rasterizar un PDF exigiría otra
  dependencia pesada. §128 pide el QR «si es viable».

Lo que sigue pertenece a batches posteriores:

- **BATCH 4 (§129)** — actividades: docente como gestor en su alcance,
  `activity_skills`, máquina de estados explícita, constancias sin doble
  conteo.
- **BATCH 5 (§130)** — proyectos: `project_member_skills`, contribución
  confirmada por el integrante, niveles de respaldo, GitHub.

---

## Riesgos

1. **El extractor de PDF no lee todos los PDFs.** Los documentos con fuentes
   CID o cifrados darán poco texto y acabarán en `INCONCLUSIVE`. Es un modo de
   fallo previsto y seguro —el recurso se conserva—, pero conviene saber que un
   `INCONCLUSIVE` no significa que el documento sea falso.
2. **Sin salida a internet, ningún certificado llega a `CORROBORATED`.** El
   verificador de enlaces dejará todo en `UNAVAILABLE`. `LINK_CHECK_ENABLED=false`
   lo deja en `UNVERIFIED`, que es más honesto en ese entorno.
3. **El worker corre dentro de la API.** Con varias instancias, todas atienden
   la misma cola; el reclamo condicional lo soporta, pero el trabajo no se
   reparte de forma equilibrada. Para el volumen de una carrera no es problema.
4. **La deduplicación es por dueño.** Dos estudiantes con el mismo archivo no
   se detectan entre sí. Es deliberado —cada quien responde por lo que aporta—,
   pero si algún día hiciera falta detectar un documento compartido entre
   personas, el dato ya está: basta consultar por huella sin filtrar por dueño.
