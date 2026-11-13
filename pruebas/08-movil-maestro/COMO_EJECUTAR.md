# Pruebas móviles: Android Emulator + APK + Maestro

**Estado (13/11/2026):** los flujos **se ejecutaron y pasaron 3 de 3** en un emulador de Android 15
(API 35, Pixel 6, 1080×2400) con Maestro 2.12.1: 95 pasos completados, 25 de ellos verificaciones.
Evidencia en `corrida-2026-11-13/` (ver su `LEEME.md`).

Falta la prueba en un **teléfono Android físico**: instalar el APK (`mobile/apk/Afinia.apk`) y repetir a mano
los pasos de los flujos, anotando el modelo y la versión de Android.

## Qué hay aquí

| Archivo | Recorrido | Capturas que genera |
|---|---|---|
| `flujos/00-bienvenida.yaml` | primer ingreso: bienvenida obligatoria (datos, intereses, mejora, colaboración) | `00a` … `00c` |
| `flujos/01-login-actividad-perfil.yaml` | ingresar → actividades → solicitar inscripción (verifica el aviso) → perfil → afinidad → sugerencias con su motivo | `01-login` … `07-recomendaciones` |
| `flujos/02-proyectos-qr.yaml` | portafolio → Colaboración: enlace del perfil (lo que lleva el QR) y canales → salir | `08-proyectos`, `09-colaboracion-qr` |
| `flujos/config.yaml` | orden de ejecución (la bienvenida primero) | — |

## Herramientas (ya instaladas en esta PC)

- SDK de Android, JDK 17 y el emulador `afinia`: `scripts/movil/instalar-herramientas-android.ps1`
  (en `%LOCALAPPDATA%\Android`).
- Maestro 2.12.1: `%LOCALAPPDATA%\Android\maestro-2.12.1\maestro\bin\maestro.bat`
  (necesita `JAVA_HOME=%LOCALAPPDATA%\Android\jdk-17`).

## Ejecutar

```bash
# 1. APK que apunta a la API de pruebas (10.0.2.2 = esta PC vista desde el emulador)
npm run mobile:apk -- http://10.0.2.2:3020/api        # renombrarlo a mobile/apk/Afinia-pruebas.apk

# 2. Base de pruebas limpia y API de pruebas en :3020
node scripts/pruebas/entorno.mjs reconstruir
node scripts/pruebas/entorno.mjs api

# 3. Emulador e instalación
%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe -avd afinia
adb install -r mobile/apk/Afinia-pruebas.apk

# 4. Flujos (la base debe estar recién reconstruida: la bienvenida se completa una sola vez)
maestro test pruebas/08-movil-maestro/flujos --format junit \
  --output pruebas/08-movil-maestro/corrida-AAAA-MM-DD/resultado-junit.xml \
  --test-output-dir pruebas/08-movil-maestro/corrida-AAAA-MM-DD
```

Notas:

- Si `npm run mobile:apk` falla con «Unable to delete directory … libfbjni.so» al recompilar, Windows dejó
  bloqueados archivos de la compilación anterior: usar otra carpeta de compilación con
  `AFINIA_APK_DIR=C:\afinia-apk2`.
- Las pestañas se tocan por su etiqueta de accesibilidad (`".*, Actividades"`), porque en Inicio hay
  tarjetas con el mismo texto.

## Compatibilidad

| Dispositivo | Android (API) | Pantalla | Flujo 00 | Flujo 01 | Flujo 02 | Observaciones |
|---|---|---|---|---|---|---|
| Pixel 6 (emulador) | 15 (35) | 1080×2400 | ✓ | ✓ | ✓ | 13/11/2026, 3 min 45 s |
| *(teléfono físico)* | | | | | | pendiente |
