# Pruebas móviles: Android Emulator + Expo + Maestro

**Estado:** los flujos están **listos, pero no se ejecutaron**. En esta PC no hay Android SDK, Java ni Maestro, y Maestro necesita un emulador o un dispositivo para correr.

## Qué hay aquí

| Archivo | Recorrido | Capturas que genera |
|---|---|---|
| `flujos/01-login-actividad-perfil.yaml` | iniciar sesión → actividades → inscribirse → perfil → afinidad → recomendaciones (el flujo representativo del §3.4) | `01-login` … `07-recomendaciones` |
| `flujos/02-proyectos-qr.yaml` | proyectos → colaboración / QR | `08-proyectos`, `09-colaboracion-qr` |
| `capturas/` | aquí deja Maestro las capturas | — |

## Pasos (una sola vez)

1. **Android Studio:** instálalo desde https://developer.android.com/studio y crea un dispositivo virtual en *Device Manager*, por ejemplo Pixel 7 con Android 14 (API 34).
2. **Maestro** (en PowerShell):
   ```
   iwr -useb https://get.maestro.mobile.dev | iex
   ```
   Requiere Java 17. Android Studio ya trae uno: añade `JAVA_HOME` apuntando a `C:\Program Files\Android\Android Studio\jbr`.
3. **Expo Go** en el emulador. Se instala solo la primera vez que corres `npx expo start --android`.

## Ejecutar

```bash
# 1. Entorno de pruebas (desde la raíz del proyecto)
node scripts/pruebas/entorno.mjs api            # API de pruebas en :3020

# 2. App móvil apuntando a la API de pruebas (10.0.2.2 = tu PC vista desde el emulador)
cd mobile
set EXPO_PUBLIC_API_URL=http://10.0.2.2:3020/api
npx expo start --android

# 3. Flujos con capturas
maestro test ../pruebas/08-movil-maestro/flujos --test-output-dir ../pruebas/08-movil-maestro/capturas
```

Maestro deja un registro por paso y las capturas (`takeScreenshot`) en `capturas/`.

## Compatibilidad (matriz pedida en el §6)

Completa esta tabla con cada dispositivo o emulador en el que corras los flujos. El documento pide además al menos un Android físico.

| Dispositivo | Android (API) | Pantalla | Flujo 01 | Flujo 02 | Observaciones |
|---|---|---|---|---|---|
| Pixel 7 (emulador) | 14 (34) | 1080×2400 | | | |
| *(dispositivo físico)* | | | | | |
