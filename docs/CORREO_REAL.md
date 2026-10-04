# Correo real en Afinia

Afinia envía dos tipos de correo: la **invitación de activación** cuando la
universidad crea una cuenta, y la **recuperación de contraseña**. Mientras no
haya un servidor de correo configurado, los dos se **simulan**: se escriben en
el registro de la API y en `api/.mail-outbox`, pero no llegan a ningún buzón.
Por eso, sin esta configuración, «no llega nada» al activar o recuperar.

Esta guía deja el correo real funcionando en unos diez minutos.

---

## 1. Lo que ya está hecho

No hace falta programar nada. El sistema ya trae:

- **Envío por SMTP** con `nodemailer` 10, conexión cifrada obligatoria y ritmo
  limitado para no disparar los filtros del proveedor.
- **Correos con diseño** (HTML que se ve bien también en Outlook) y versión en
  texto plano, con un botón que abre la activación ya preparada y un **código
  de 6 dígitos** para quien lee el correo en el teléfono.
- **Solo a direcciones institucionales**: `@univalle.edu` y
  `@est.univalle.edu` (variable `INSTITUTIONAL_EMAIL_DOMAINS`). A cualquier otra
  dirección no sale nada.
- **Medidas antispam**: una pausa de 2 minutos entre dos correos a la misma
  cuenta y un máximo de 5 por cuenta y día. Sin ellas, pulsar «reenviar» diez
  veces manda diez correos iguales al mismo buzón, que es exactamente lo que
  lleva a Outlook a marcar al remitente como spam.
- **Cola de envíos con reintentos**: importar un padrón de 300 estudiantes no
  deja la pantalla colgada, y si el proveedor falla un momento el correo se
  reintenta solo (1, 5, 15 y 60 minutos).
- **El administrador nunca ve el código**: solo ve si la invitación se envió,
  sigue en cola o falló, y por qué.

---

## 2. Elegir proveedor

| Proveedor | Para qué | Límite gratuito | Dificultad |
|---|---|---|---|
| **Gmail** | Empezar ya, demostración | ~500 correos/día | Baja |
| **Brevo** | Uso real, mejor entrega a Outlook | 300 correos/día | Media |
| **Microsoft 365** (correo de la universidad) | Uso institucional | El de la universidad | Depende de TI |

Para la defensa y las primeras pruebas, **Gmail** es lo más rápido. Para un
uso real con cientos de estudiantes, **Brevo** con un dominio propio entrega
mejor a los buzones de Outlook de la universidad.

---

## 3. Paso a paso con Gmail

1. Entre a la cuenta de Google que enviará los correos (mejor una creada para
   esto, p. ej. `afinia.univalle@gmail.com`, que su cuenta personal).
2. Active la **verificación en dos pasos**: *Cuenta de Google → Seguridad →
   Verificación en dos pasos*.
3. Cree una **contraseña de aplicación**: *Seguridad → Contraseñas de
   aplicaciones* (o busque «contraseñas de aplicaciones» en la configuración).
   Póngale el nombre «Afinia». Google le mostrará 16 letras en cuatro grupos.
4. Abra el archivo `.env` en la raíz del proyecto y rellene:

   ```ini
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=afinia.univalle@gmail.com
   SMTP_PASSWORD=abcd efgh ijkl mnop
   SMTP_FROM=afinia.univalle@gmail.com
   WEB_APP_URL=http://localhost:5173
   ```

   - `SMTP_PASSWORD` es la **contraseña de aplicación**, no la de la cuenta.
     Puede pegarla con los espacios: el sistema los quita.
   - `SMTP_FROM` debe ser **la misma cuenta** que `SMTP_USER`. Gmail reescribe o
     rechaza un remitente distinto.
   - `WEB_APP_URL` es la dirección donde la gente abre Afinia: va dentro del
     botón del correo. Si prueba desde otro equipo de la red, ponga la IP del
     servidor (p. ej. `http://192.168.1.20:5173`).

5. Compruebe la configuración **antes** de arrancar nada:

   ```bash
   npm run mail:test -- su.correo@est.univalle.edu
   ```

   Si algo falla, el mensaje dice qué variable revisar (ver §7).

6. Reinicie la API (`npm run api:dev`). En el registro debe aparecer:

   ```
   [Correo] Correo REAL: conectado a smtp.gmail.com:465 · remitente "Afinia · Univalle" <afinia.univalle@gmail.com>
   ```

7. Entre como administrador → **Correo** → *Enviar prueba*. Después cree una
   cuenta de estudiante con **su propio** correo institucional y compruebe que
   la invitación llega y que el botón abre la activación.

---

## 4. Paso a paso con Brevo

1. Cree una cuenta en <https://www.brevo.com>.
2. En *Senders & IP → Senders*, añada y verifique la dirección remitente. Si
   tiene un dominio propio, verifíquelo en *Domains* y configure los registros
   **SPF**, **DKIM** y **DMARC** que Brevo le indica: es lo que más mejora la
   entrega a Outlook.
3. En *SMTP & API → SMTP*, copie el *login* y genere una *SMTP key*.
4. En `.env`:

   ```ini
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=su_login@smtp-brevo.com
   SMTP_PASSWORD=su_smtp_key
   SMTP_FROM=no-reply@su-dominio-verificado.com
   ```

5. Siga desde el paso 5 de Gmail.

---

## 5. Microsoft 365 (correo de la universidad)

Es la opción más natural —los correos salen de una dirección `@univalle.edu`—,
pero depende de la configuración que tenga TI:

```ini
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=afinia@univalle.edu
SMTP_PASSWORD=...
SMTP_FROM=afinia@univalle.edu
```

**Microsoft está retirando el envío con usuario y contraseña (SMTP AUTH
básico).** Si `npm run mail:test` responde que *Microsoft tiene desactivado el
envío con usuario y contraseña* (código 5.7.139), hay dos salidas:

- Pedir a TI un **relé SMTP** institucional o que habilite SMTP AUTH para esa
  cuenta concreta.
- Usar **OAuth2**: registrar una aplicación en Microsoft Entra ID con permiso
  `SMTP.Send`, obtener un *refresh token* y configurar:

  ```ini
  SMTP_AUTH=oauth2
  SMTP_USER=afinia@univalle.edu
  SMTP_OAUTH_CLIENT_ID=...
  SMTP_OAUTH_CLIENT_SECRET=...
  SMTP_OAUTH_REFRESH_TOKEN=...
  ```

Si nada de eso es posible a corto plazo, Gmail o Brevo funcionan igual de bien
para la demostración.

---

## 6. Ver los correos sin enviarlos (Mailpit)

Para revisar el diseño de los correos sin mandárselos a nadie:

```bash
npm run mail:preview          # levanta Mailpit en Docker
```

En `.env`:

```ini
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_AUTH=none
SMTP_FROM=no-reply@afinia.test
```

Reinicie la API y abra <http://localhost:8025>: ahí aparece cada correo tal
como lo recibiría el estudiante. Además, cada correo queda guardado como
`.html` en `api/.mail-outbox`, que también puede abrirse en el navegador.

---

## 7. Si algo falla

`npm run mail:test` y la pantalla **Correo** traducen los errores del
proveedor. Los habituales:

| Mensaje | Qué hacer |
|---|---|
| *El servidor rechazó el usuario o la contraseña* | Con Gmail, use la **contraseña de aplicación**, no la normal. Revise `SMTP_USER`. |
| *Gmail exige una contraseña de aplicación* | Active la verificación en dos pasos y cree la contraseña de aplicación (§3). |
| *Microsoft tiene desactivado el envío con usuario y contraseña* | Ver §5: relé de TI, OAuth2, o Gmail/Brevo. |
| *No se pudo conectar a …* | Revise `SMTP_HOST` y `SMTP_PORT`. Algunas redes bloquean la salida por el 587: pruebe 465 con `SMTP_SECURE=true`. Revise antivirus o cortafuegos. |
| *El modo de cifrado no coincide con el puerto* | 465 → `SMTP_SECURE=true`; 587 → `SMTP_SECURE` vacío o `false`. |
| *SMTP_FROM no coincide con SMTP_USER* (aviso) | Con Gmail y Outlook, ponga la misma cuenta en los dos. |
| *El proveedor está limitando los envíos* | Se reintentará solo. Si se repite, baje `SMTP_MAX_PER_MINUTE`. |

**Si el correo llega a «No deseado»:** márquelo como «No es spam» la primera
vez. A largo plazo, lo que de verdad lo resuelve es enviar desde un dominio
propio con SPF, DKIM y DMARC configurados (Brevo o Microsoft 365), no desde una
cuenta gratuita.

---

## 8. Producción

Con `NODE_ENV=production` la API **se niega a arrancar** si el correo está mal
configurado: sin `SMTP_HOST`, con `MAIL_TRANSPORT=console`, con un remitente
inventado o con `WEB_APP_URL` sin `https://`. Es preferible a descubrirlo con el
primer estudiante que no recibe su invitación.

En producción no se guarda ninguna copia local de los correos: el código de
activación solo existe en el buzón de su destinatario.

### 8.1. Entregabilidad (V2 §19)

Antes de abrir el sistema a los estudiantes, con el dominio desde el que se
envía (por ejemplo `afinia.univalle.edu` o el dominio de la universidad):

| Registro / tarea | Qué es | Cómo se comprueba |
|---|---|---|
| **SPF** | Registro DNS `TXT` que dice qué servidores pueden enviar en nombre del dominio (`v=spf1 include:<proveedor> -all`). | `nslookup -type=txt dominio` muestra el `v=spf1`. |
| **DKIM** | Firma criptográfica de cada correo; el proveedor da una clave pública para publicar en DNS. | En un correo recibido, «Mostrar original» → `DKIM: PASS`. |
| **DMARC** | Política para correos que fallan SPF/DKIM. Empezar con `v=DMARC1; p=none; rua=mailto:dmarc@dominio` para observar, y pasar a `p=quarantine` cuando los informes salgan limpios. | `nslookup -type=txt _dmarc.dominio`. |
| **Remitente verificado** | `SMTP_FROM` debe ser una dirección del dominio autenticado (con Gmail y Outlook, la misma cuenta de `SMTP_USER`). | «Correo → Probar» en Administración. |
| **Rebotes** | Un correo a una dirección inexistente vuelve como rebote al remitente. Revise ese buzón (o el panel del proveedor) tras importar un padrón: un rebote suele ser un error tipográfico en el padrón. | Panel del proveedor / buzón de `SMTP_FROM`. |
| **Reputación** | No enviar ráfagas: la API ya limita el ritmo (`SMTP_MAX_PER_MINUTE`), espera 2 minutos entre reenvíos y corta a 5 por día. | Panel del proveedor (tasa de rebote < 2 %). |
| **Prueba con Outlook** | Envíe una invitación de prueba a una cuenta `@est.univalle.edu` real y confirme que llega a «Bandeja de entrada», no a «Correo no deseado», y que el botón y el código se ven bien. | Manual, antes de cada despliegue que cambie el remitente. |

Afinia registra el estado de cada intento (`QUEUED`, `SENT_TO_SMTP`, `FAILED`).
`SENT_TO_SMTP` significa que el servidor de correo **aceptó** el mensaje; si
después lo rebota, eso solo se ve en el proveedor. Por eso el sistema nunca dice
«entregado».

---

## 9. Las pruebas automáticas y el correo real

Las suites de integración crean cientos de cuentas con correos inventados.
Con un SMTP real serían cientos de correos a direcciones que no existen:
rebotes, y el remitente marcado como spam. Por eso **las suites se niegan a
correr si la API está enviando correo real** y lo dicen. Para correrlas,
arranque la API con `MAIL_TRANSPORT=console` (o con Mailpit, que es local).

Las suites leen el código de activación de `api/.mail-outbox`, igual que el
estudiante lo leería de su buzón. La API ya no se lo entrega al administrador
en ningún caso.
