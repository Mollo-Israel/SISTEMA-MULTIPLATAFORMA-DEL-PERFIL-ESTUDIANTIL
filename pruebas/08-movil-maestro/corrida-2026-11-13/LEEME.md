# Maestro en Android, 13/11/2026

Resultado: **3 de 3 flujos aprobados**, 95 pasos completados (25 verificaciones), 3 min 45 s
(`resultado-junit.xml`, `salida-consola.txt`; detalle por paso en `2026-11-13_*/<flujo>/commands.json`).

- Emulador: Pixel 6, Android 15 (API 35), 1080×2400. Maestro 2.12.1.
- App: APK de release compilado con `npm run mobile:apk -- http://10.0.2.2:3020/api` (incluye la corrección D-14).
- API y base: entorno de pruebas aislado (:3020, `afinia_test`), reconstruido justo antes.
- Cuenta: `ana.quispe@est.univalle.edu` (estudiante sembrada).

Capturas que tomaron los flujos: `2026-11-13_*/<flujo>/takeScreenshot/`.

## Ejecución anterior y defecto D-14

`../corrida-2026-11-13-antes-de-D14/` es una ejecución completa previa (también 3/3). Al revisar sus capturas
(`04-inscripcion.png`) se vio que, al inscribirse en una actividad interna abierta, que admite al instante, la app
móvil avisaba «Inscripción enviada. Queda pendiente de aprobación del responsable», mientras la tarjeta decía
«Tu estado: admitido». La web ya distinguía los dos casos (V6 §4.1).

Corrección: `mobile/src/screens/student/ActivitiesScreen.tsx` usa la misma regla y los mismos textos que
`web/src/pages/student/Activities.tsx` («Inscripción admitida» / «Solicitud enviada»). El flujo 01 ahora verifica
ese aviso. Esta corrida es con el APK corregido.

Ajustes de los flujos respecto de los borradores de octubre (antes no se habían podido ejecutar): `appId` de la app
real (`com.afinia.app`) en vez de Expo Go, flujo nuevo de bienvenida, pestañas tocadas por su etiqueta de
accesibilidad, la inscripción se hace desde «Todas» → «Ver detalle», y la salida se hace desde la pestaña Perfil.
