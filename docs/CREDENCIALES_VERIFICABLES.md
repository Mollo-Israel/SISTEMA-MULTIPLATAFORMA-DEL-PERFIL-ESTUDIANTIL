# Registros verificables: Open Badges 3.0 y 2.0 (V8)

Rama: `feature/afinia-credenciales-verificables` · 18/11/2026

## 1. Qué problema resuelve

Antes, Afinia **validaba** las credenciales externas de un estudiante, como las de Cisco o Coursera. En cambio, lo que **Afinia misma registraba** no se podía comprobar desde afuera: las participaciones confirmadas y los certificados que entrega la institución. Si un estudiante mostraba su participación a una empresa, la empresa no tenía cómo saber si era real.

Ahora cada uno de esos hechos se puede **firmar digitalmente**. Cualquiera lo comprueba en `/verificar`, sin cuenta: con el código, el QR, el PDF, la insignia o el JSON.

## 2. Decisión sobre V5 ND-01

V5 §1.2 dice que Afinia no emite documentos con apariencia oficial «mientras Dirección no defina su política».

- **La política existe y la decide Dirección.** La tabla `credential_issuance_policies` guarda cada decisión con su justificación. Sin ninguna decisión, la emisión está **apagada**.
- **Lo firmado no es un certificado académico.** Es un «registro verificable de participación»: afirma que el responsable confirmó la asistencia, no que hubo una aprobación ni una nota. Así lo dicen el texto, el PDF y la insignia.
- **Los certificados institucionales mantienen a su emisor real.** Afinia da fe de la entrega y de la huella SHA-256 del archivo, pero no de su autoría.
- **`POST /constancies/internal` sigue sin emitir.** La prueba `afinia-no-certifica` pasa sin cambios.

## 3. Arquitectura

```
Hecho registrado ──► Firma Ed25519 ──► Registro (BD, inmutable) ──► Bitácora encadenada (BD, solo anexado)
(participación,       OB 3.0 Data          verifiable_credentials       credential_ledger
 certificado,         Integrity +
 constancia)          VC-JWT
                                    │
           ┌────────────────────────┼─────────────────────────────┐
           ▼                        ▼                             ▼
  Verificador público       Documentos estándar            Formatos portables
  /verificar               emisor + claves (Multikey,      PDF determinista con QR,
  código · archivo ·       JWKS) · listas de estado        PNG/SVG horneados,
  credencial · lote        W3C · OB 2.0 alojado            JSON OB 3.0, VC-JWT, LinkedIn
```

| Capa | Qué usa | Por qué |
|---|---|---|
| Firma | Ed25519 con `eddsa-jcs-2022` (W3C Data Integrity) y VC-JWT (`EdDSA`) | Es el formato de Open Badges 3.0 y viene en Node; no se agregó ninguna dependencia. |
| Canonización | JCS (RFC 8785) | El mismo contenido produce siempre los mismos bytes, en cualquier orden de claves. |
| Estado | W3C Bitstring Status List: una lista de **revocación** (definitiva) y otra de **suspensión** (reversible) | Un verificador externo consulta el estado sin preguntar por un código concreto. Las listas tienen 131 072 posiciones, asignadas al azar. |
| Vigencia en vivo | Consulta del hecho de origen al verificar | Si se corrige una asistencia, el registro queda «sin efecto» al instante, sin tocar el módulo de actividades. |
| Transparencia | Bitácora encadenada: `SHA-256(anterior \| n.º \| evento \| código \| JCS(datos))` | Para reescribir el pasado hay que recalcular toda la cadena, y la cabeza ya está publicada en `/public/credentials/ledger/head`. |
| Defensa en la base | Triggers de PostgreSQL | La bitácora no admite UPDATE, DELETE ni TRUNCATE. Lo firmado no se puede modificar y una revocación no se puede deshacer. |
| Claves | `CREDENTIALS_SIGNING_KEY`, o HKDF del secreto JWT | La clave privada no se guarda nunca en la base. Las claves públicas viejas se conservan, así que lo firmado con ellas se sigue verificando. |
| Código | `AF-XXXX-XXXX-XXXXC`: 60 bits aleatorios en Crockford Base32 más un dígito de control Luhn mod 32 | No se puede adivinar ni enumerar, y cualquier error de tipeo se detecta antes de consultar la base. |
| PDF | Generado a mano y **determinista**: mismos datos, mismos bytes | Al verificarlo, el PDF se vuelve a generar y se compara byte a byte; cualquier edición se detecta. Lleva el QR, un enlace activo y la credencial adjunta. |
| Insignias | PNG (bloque `iTXt` `openbadgecredential`) y SVG (`<openbadges:credential>`) | La imagen lleva la credencial firmada adentro. |
| Terceros | `did:key`, `did:jwk`, `did:web` y https, con protección SSRF | El verificador también comprueba Open Badges de otros emisores. Lo que no puede evaluar (por ejemplo, `eddsa-rdfc-2022`) lo informa como «no evaluable», nunca como falso. |

Además, el validador de credenciales externas que ya existía ahora **verifica de verdad** las firmas de las insignias. Antes `proofVerified` era siempre `false`: la firma se detectaba, pero no se comprobaba.

## 4. Qué comprueba el verificador (por código)

| Comprobación | Falla si… |
|---|---|
| Registro | el código no existe o su dígito de control no coincide |
| Clave del emisor | la clave no está registrada o su huella no corresponde a su identificador |
| Firma digital | cambió cualquier byte de lo firmado |
| Huella del contenido | la huella guardada no corresponde al contenido |
| Bitácora | no hay sello de emisión, la entrada no cuadra o la cadena está rota |
| Revocación y suspensión | Dirección lo revocó o lo suspendió |
| Hecho registrado | la participación dejó de estar confirmada |
| Archivo (si se subió uno) | el PDF no es idéntico al original |

Posibles resultados: `valid`, `revoked`, `suspended`, `without_effect`, `altered`, `invalid`, `not_found`, `document_recognized`, `valid_external`, `unverifiable` y `expired`.

El informe público **no muestra** el correo ni el motivo de una revocación.

## 5. Endpoints

**Públicos**, con límite de peticiones:
- `GET /public/credentials/issuer`
- `GET /public/credentials/keys`
- `GET /public/credentials/status/{revocation|suspension}`
- `GET /public/credentials/ledger/head`
- `GET /public/credentials/ob2/{issuer|badges/:code|badges/:code/image.svg|assertions/:code}`
- `GET /public/credentials/:code`
- `GET /public/credentials/:code/ob3`
- `POST /public/credentials/verify`
- `POST /public/credentials/verify-file`
- `POST /public/credentials/verify-batch`

**Con sesión:**
- `GET /credentials/mine` y `POST /credentials/mine/issue`: estudiante.
- `GET|POST /credentials/policy`: Dirección decide; Administración solo lee.
- `GET /credentials/registry`, `/registry/:id` y `/registry/integrity`: Dirección y Administración.
- `POST /credentials/registry/issue-pending` y `/registry/:id/{suspend|lift|revoke}`: solo Dirección.
- `GET /credentials/:id/download/{pdf|json|jwt|svg|png|qr}`: el titular o Dirección.

## 6. Pantallas

- **Pública**: `/verificar` y `/verificar/:code`, con cuatro pestañas (código, archivo, credencial y varios códigos). Hay un enlace desde la portada.
- **Estudiante**: la pestaña «Registros verificables» en Evidencias y credenciales. Desde ahí descarga el PDF con QR, la insignia y los formatos JSON, SVG y VC-JWT, y puede agregar el registro a LinkedIn.
- **Dirección**: «Registros verificables». Incluye la política con su historia, la emisión en lote, la suspensión, el levantamiento y la revocación con motivo, la auditoría de integridad y el detalle con la bitácora.
- **Administración**: la misma pantalla, solo en lectura.
- **Móvil**: una sección en Evidencias para compartir el enlace, abrir el PDF o la insignia, verificar y agregar a LinkedIn.

## 7. Pruebas

| Suite | Resultado |
|---|---|
| `api/test/jest/unit/credenciales-cripto.spec.ts`: vectores RFC 8032 y RFC 8785, manipulación, Luhn, PDF, QR e insignias | 16/16 |
| `api/test/jest/api/credenciales-verificables.spec.ts`: de punta a punta contra `afinia_test` | 21/21 |
| Jest completo, que incluye `afinia-no-certifica` | 157/157 |
| Unitarias de Node (`npm run test:unit`) | 167/167 |
| Seguridad del capítulo III (`pruebas:seguridad`) | 79/79 y 7/7 estáticas |
| Playwright, Chromium | 18/18 |

## 8. Producción

1. Definir `CREDENTIALS_PUBLIC_API_URL` (estable) y `CREDENTIALS_SIGNING_KEY` (32 bytes aleatorios, guardados como secreto).
2. Ejecutar la migración `V8VerifiableCredentials`, que es aditiva.
3. Dirección habilita la emisión desde su panel, con una justificación.
