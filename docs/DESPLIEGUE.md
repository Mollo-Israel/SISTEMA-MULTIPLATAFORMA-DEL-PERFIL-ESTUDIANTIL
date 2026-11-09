# Publicar Afinia en internet

Guía paso a paso. Lista completa de variables: [`.env.production.example`](../.env.production.example).

| Parte | Dónde |
|---|---|
| Página web | Cloudflare Pages → `app.TU-DOMINIO.com` |
| API y base de datos | Railway → `api.TU-DOMINIO.com` |
| Archivos | Cloudflare R2 (bucket privado) |
| Correos | Brevo (API por HTTPS) |

> Las llaves y contraseñas se escriben **solo** en el panel de cada servicio. Nunca en el código ni en un chat.

## 0. Antes de empezar

- Publica desde una rama estable, por ejemplo `main`, con todo probado.
- Compra el dominio y agrégalo a Cloudflare, para manejar sus DNS desde ahí.
- La base de producción empieza **vacía**: no se copia la de desarrollo.
- No ejecutes `seed:populate` en producción: crea cuentas de ejemplo con una contraseña conocida.

## 1. Cloudflare R2

1. En Cloudflare: **R2 → Create bucket**, nombre `afinia-archivos`. Déjalo **privado** (sin acceso público).
2. **R2 → Manage API Tokens → Create API token**, con permiso *Object Read & Write* solo sobre ese bucket.
3. Guarda el **Account ID**, el **Access Key ID** y el **Secret Access Key**. El secreto se muestra una sola vez.

## 2. Brevo

1. Crea la cuenta y autentica tu dominio en **Senders, Domains & Dedicated IPs**. Brevo te da registros DNS: agrégalos en Cloudflare.
2. Crea el remitente `no-responder@TU-DOMINIO.com`.
3. En **SMTP & API → API Keys**, genera una llave.

El plan gratuito envía 300 correos al día. Un padrón más grande tarda más de un día en recibir sus invitaciones.

## 3. Backend en Railway

1. **New Project → Deploy from GitHub repo**, y elige este repositorio y la rama de producción. Railway usa el `Dockerfile` y [`railway.json`](../railway.json) de la raíz.
2. Agrega una base: **New → Database → PostgreSQL**.
3. En el servicio de la API, abre **Variables** y carga las de `.env.production.example`. Secretos JWT:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
4. **Solo en la primera publicación**, cambia *Pre-Deploy Command* en Settings a:
   ```bash
   npm run migration:run:prod && npm run seed:prod
   ```
   Crea las tablas, los catálogos y la cuenta de Administración. Luego vuelve a dejar `npm run migration:run:prod`.
5. **Settings → Networking → Custom Domain**: `api.TU-DOMINIO.com`. Agrega en Cloudflare el CNAME que te indique, con la **nube gris** (solo DNS).
6. Comprueba que `https://api.TU-DOMINIO.com/api/health` responda `"status":"ok"`.

Si la API no arranca, el registro del despliegue dice exactamente qué variable falta.

## 4. Web en Cloudflare Pages

1. **Workers & Pages → Create → Pages → Connect to Git**, y elige el repositorio y la rama.
2. Configuración:
   - Root directory: `web`
   - Build command: `npm run build`
   - Output directory: `dist`
3. Variables: `VITE_API_URL=https://api.TU-DOMINIO.com/api` y `NODE_VERSION=22`.
4. **Custom domains**: `app.TU-DOMINIO.com`.

La web y la API deben compartir el dominio (`app.` y `api.`): si no, el navegador puede bloquear la cookie de sesión.

## 5. Primera prueba

1. Entra a `https://app.TU-DOMINIO.com` con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
2. Crea una cuenta con tu correo institucional y comprueba que llegue la invitación (revisa también «no deseado»).
3. Activa la cuenta, sube un certificado y ábrelo: si se ve, R2 está funcionando.
4. Recarga una ruta interna, como `/student`: no debe dar error.

## 6. App móvil (opcional)

En [`mobile/eas.json`](../mobile/eas.json), cambia `TU-DOMINIO` por tu dominio. Después:

```bash
cd mobile
npx eas-cli login
npx eas-cli build --platform android --profile production
```

## 7. Actualizar el sistema

1. Cambia y prueba en tu PC, en una rama de trabajo.
2. Pasa los cambios a la rama de producción y haz `git push`.
3. Railway y Cloudflare publican solos. Si hay migraciones nuevas, se aplican antes de arrancar.

GitHub corre las comprobaciones de [`ci.yml`](../.github/workflows/ci.yml) en cada envío.

**Cuidados:** revisa los respaldos de la base antes de un cambio grande, y evita migraciones que borren columnas con datos. Volver a la versión anterior en el panel revierte el código, no los cambios ya hechos en la base.

## Probar en tu PC sin cuentas

```bash
node scripts/pruebas/r2-simulado.mjs
# En otra terminal, API con:
# STORAGE_DRIVER=r2 R2_ENDPOINT=http://127.0.0.1:3995 R2_BUCKET=prueba R2_ACCESS_KEY_ID=x R2_SECRET_ACCESS_KEY=y
```

Sin esas variables, todo sigue funcionando en local con el disco y tu Gmail.
