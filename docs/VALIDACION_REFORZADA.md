# Validación reforzada de credenciales externas (V9)

Rama: `feature/afinia-validacion-reforzada` · 23/11/2026

## 1. Qué problema resuelve

La V3 comprobaba lo que el certificado **dice** contra la fuente oficial: QR, enlace, página del emisor e insignia. Pero quedaban huecos que un estudiante podía aprovechar:

| Hueco | Trampa |
|---|---|
| El duplicado solo se buscaba en el mismo dueño | Registrar el certificado, el código o el enlace de un compañero |
| No se miraba el archivo en sí | Editar el nombre con Photoshop o Canva, o generar el certificado con IA |
| No se cruzaba el QR con lo impreso | Cambiar el número impreso y dejar el QR original |
| No se verificaban las firmas digitales de los PDF | Desperdiciar la prueba más fuerte que traen muchos emisores |
| Credly sin conector, aunque tiene una API pública | Que las insignias de IBM, Cisco o AWS quedaran «sin concluir» |

## 2. Las cinco capas

### 1. Antifraude entre estudiantes (`fraud/shared-credential.service.ts`)

Una credencial es de una sola persona. Se busca en los perfiles de **otros** estudiantes:

- el mismo archivo, por su SHA-256;
- el mismo código de credencial, normalizado (`ictcra-2025…` = `ICTCRA2025…`), tanto el declarado como el leído del documento;
- el mismo enlace individual de verificación, normalizado (sin `www.`, sin `utm_*`). Las portadas de un proveedor no cuentan.

Cualquiera de las tres coincidencias es una contradicción: `shared_with_other_student`, y la credencial queda **Observada**.

Además se compara una imagen casi idéntica, con un dHash de 256 bits y como mucho 6 bits distintos. Eso solo es una advertencia, porque dos certificados legítimos de la misma plantilla se parecen mucho.

Solo se marca a quien registra **después**. Si se marcara también al primero, cualquiera podría perjudicar a otro estudiante registrando su código. Dirección ve el caso en la auditoría (`EXTERNAL_CREDENTIAL_SHARED`). El estudiante no ve quién es el otro.

### 2. Análisis forense del archivo (`forensics/`)

**PDF** (`pdf-forensics.ts`, sin dependencias):

- Lee Producer, Creator y fechas de todas las revisiones, también dentro de flujos comprimidos.
- Lee del XMP el CreatorTool, el historial de guardado y el origen IA.
- Cuenta las revisiones (`%%EOF`). A un PDF linealizado le descuenta la marca que trae de fábrica.
- Localiza las firmas (`/ByteRange`, `/Contents`) y revisa lo que se agregó **después** de la última. Solo es benigno lo que agregan los firmadores: DSS/VRI, certificados, OCSP o CRL en objetos **nuevos**. Redefinir un objeto que ya existía es una edición.

**Firma PAdES** (`pdf-signature.ts`, con `pkijs`). Tres preguntas, por separado:

1. **Integridad:** ¿el resumen firmado corresponde a los bytes?
2. **Firma:** ¿la firma del firmante es válida?
3. **Confianza:** ¿la cadena llega a una raíz pública del almacén de Mozilla que trae Node?

Si las tres se cumplen, el firmante corresponde al emisor declarado y el documento está a nombre del estudiante, la credencial queda **corroborada**, aunque la página del emisor no responda. Muchas firmas institucionales encadenan a la lista de Adobe (AATL), que no es pública en Node. Esas quedan «sin confianza verificable», nunca «falsas».

**Imágenes** (`image-forensics.ts`, sin dependencias nuevas):

- PNG: bloques tEXt, iTXt y zTXt, EXIF (eXIf) y C2PA (caBX).
- JPEG: EXIF (APP1), XMP (APP1), Photoshop (APP13) y C2PA/JUMBF (APP11).

Solo se reconocen **marcas explícitas** de IA, escritas por la propia herramienta:

- IPTC `trainedAlgorithmicMedia`, que usan OpenAI, Adobe Firefly, Google, Microsoft y Meta;
- el `claim_generator` de C2PA;
- los parámetros de Stable Diffusion (AUTOMATIC1111, ComfyUI, InvokeAI, NovelAI).

No se «adivina» si algo parece hecho con IA: un detector estadístico acusaría a estudiantes honestos. Por la misma razón, el nombre de un generador solo se busca en los campos de **programa** (Software, CreatorTool, Producer), nunca en el título: un curso «Generative AI with Gemini» no es una imagen de Gemini.

| Severidad | Señales | Efecto |
|---|---|---|
| Crítica | `ai_generated`, `signature_broken`, `modified_after_signature` | Contradicción: la credencial queda **Observada** |
| Advertencia | `image_editor` (Photoshop, GIMP…), `online_editor` (Canva, iLovePDF…), `incremental_edits`, `modified_later`, `future_date`, `near_duplicate_other_student` | No acusa, pero el documento ya no respalda por sí solo: hace falta la fuente oficial o una persona |
| Información | `reprinted`, `content_credentials`, `signature_untrusted` | Solo se muestra a quien revisa |

### 3. Coherencia entre el QR y el código impreso (`credential-integrity.rules.ts`)

Si el QR lleva un código **de la misma forma** que el impreso (mismas letras iniciales, mismo largo y mismo comienzo) pero distinto, se marca `qr_code_mismatch`. Es la huella típica de una edición: se cambió el número y se dejó el QR original. El UUID de una insignia de Credly dentro del QR no se confunde con el número de un certificado.

### 4. Conectores por proveedor

Se probaron los portales con consultas reales el 23/11/2026:

| Proveedor | Resultado | Qué hace Afinia |
|---|---|---|
| **Credly** (IBM, Cisco, AWS…) | API pública Open Badges en JSON | **Integrado.** Consulta la aserción oficial, la clase de la insignia y el emisor, y comprueba que el emisor sea el declarado (`badge_issuer_mismatch` si no lo es) |
| Udemy | Cloudflare «Just a moment…» | No se burla: va a revisión humana |
| Huawei | Akamai «Access Denied» | Igual |
| Accredible | API con token del emisor | Igual |
| Cisco NetAcad (PDF) | Página que necesita JavaScript | Igual. Las insignias de Cisco van por Credly |

### 5. Correos personales comprobados (`verified-emails.*`)

Credly y Open Badges guardan el destinatario como `sha256(correo + sal)`. Ese correo es el personal con el que el estudiante se inscribió, casi nunca el institucional.

- El estudiante agrega su correo en **Evidencias y credenciales → Correos con los que recibes insignias**, y Afinia le envía un código de 6 dígitos a ese buzón. Solo cuentan los correos comprobados: declarar uno no basta, porque cualquiera puede escribir el de otra persona.
- El código se guarda como SHA-256, dura 15 minutos y admite 5 intentos. Se puede reenviar una vez por minuto y como mucho 5 veces al día. Cada estudiante puede tener hasta 3 correos.
- Un correo comprobado es de **una sola** cuenta. Lo garantiza un índice único parcial en la base. El mensaje de error no revela de quién es.
- Al comprobar o quitar un correo, se vuelven a validar las credenciales del estudiante.
- El puerto de correo solo envía a direcciones institucionales. La única excepción nueva es `email_ownership`, y por definición va a ese correo.

## 3. Endpoints nuevos

Todos son solo para el rol estudiante.

- `GET /verified-emails`
- `POST /verified-emails` con `{ email }`: límite de 5 por minuto.
- `POST /verified-emails/:id/resend`
- `POST /verified-emails/:id/confirm` con `{ code }`
- `DELETE /verified-emails/:id`

## 4. Datos

- Migración `1780890000000-V9VerifiedEmails`: tabla `student_verified_emails`. Es aditiva.
- El resto viaja dentro de `validation_records.credential_check` (jsonb), así que no hace falta ninguna migración: `forensics`, `sharing` (solo conteos) y `qrCodeMismatch`.
- `VALIDATOR_VERSION` pasa de 3 a 4. `POST /validation/reprocess-outdated` vuelve a evaluar lo ya validado.
- Dependencia nueva: `pkijs` 3.2.4, con `asn1js`, para verificar firmas CMS. Es puro JavaScript y no tiene binarios.

## 5. Pruebas

| Suite | Resultado |
|---|---|
| `api/test/jest/unit/validacion-reforzada.spec.ts` | 41/41 |
| `api/test/jest/api/validacion-reforzada.spec.ts` | 16/16 |
| Jest completo | 214/214 |
| Unitarias de Node | 167/167 |

La suite unitaria fabrica cada trampa:

- un PDF firmado de verdad, con un certificado generado en la prueba, y luego retocado;
- una página agregada tras la firma;
- un objeto redefinido;
- un PNG de Stable Diffusion, un C2PA de ChatGPT y un JPEG de GIMP;
- un QR con otro número;
- una insignia de Credly con respuestas simuladas.

La de API usa a Ana y a Luis contra `afinia_test`.

## 6. Límites (dichos, no escondidos)

- Un documento **sin** señales no queda probado como auténtico, porque los metadatos se pueden borrar. La autenticidad la da la fuente oficial: el QR, el enlace, la firma o la insignia.
- No se analizan los píxeles para detectar retoques (ELA y similares). Dan demasiados falsos positivos para acusar a alguien.
- No se resuelven captchas ni se evaden protecciones anti-bots. Esos proveedores van a revisión de Dirección con una prueba externa.
